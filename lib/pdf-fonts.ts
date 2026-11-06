import type { Font } from "@pdf-lib/fontkit";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { join } from "node:path";

type FontkitEngine = {
  create(buffer: Uint8Array, postscriptName?: string): Font;
};

// Load the CommonJS build. Its ESM entry only has a default export, which the
// test compiler and Turbopack do not resolve the same way.
const nodeRequire = createRequire(join(process.cwd(), "package.json"));

function loadFontkit(): FontkitEngine {
  const loaded = nodeRequire("@pdf-lib/fontkit") as FontkitEngine & {
    default?: FontkitEngine;
  };

  if (typeof loaded.create === "function") {
    return loaded;
  }

  if (loaded.default && typeof loaded.default.create === "function") {
    return loaded.default;
  }

  throw new Error("Could not load the PDF font engine.");
}

const fontkit = loadFontkit();
import {
  PDFDocument,
  StandardFonts,
  type PDFFont,
} from "pdf-lib";

const FONT_DIRECTORY = join(process.cwd(), "assets", "fonts");

export type UnicodeFontKey = "sans" | "sansBold" | "sc" | "emoji";
export type UnicodeFontStyle = "regular" | "bold" | "mono";

const FONT_FILES: Record<UnicodeFontKey, string> = {
  sans: "NotoSans-Regular.ttf",
  sansBold: "NotoSans-Bold.ttf",
  sc: "NotoSansSC-Regular.ttf",
  emoji: "NotoEmoji-Regular.ttf",
};

export class UnsupportedPdfTextError extends Error {
  readonly characters: readonly string[];

  constructor(characters: readonly string[]) {
    const unique = uniqueCharacters(characters);
    super(formatUnsupportedCharacters(unique));
    this.name = "UnsupportedPdfTextError";
    this.characters = unique;
  }
}

function uniqueCharacters(characters: readonly string[]): string[] {
  const unique: string[] = [];
  const seen = new Set<number>();

  for (const character of characters) {
    const codePoint = character.codePointAt(0);
    if (codePoint === undefined || seen.has(codePoint)) {
      continue;
    }

    seen.add(codePoint);
    unique.push(character);
  }

  return unique;
}

function formatUnsupportedCharacters(characters: readonly string[]): string {
  const shown = characters.slice(0, 12).map((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    const hex = codePoint.toString(16).toUpperCase().padStart(4, "0");
    const printable = codePoint >= 32 && codePoint !== 127 && character.trim().length > 0;
    return printable ? `${character} (U+${hex})` : `U+${hex}`;
  });
  const hiddenCount = characters.length - shown.length;
  const extra = hiddenCount > 0 ? ` and ${hiddenCount} more` : "";

  return `These characters cannot be embedded in the protocol PDF: ${shown.join(", ")}${extra}. Remove them and try again.`;
}

// Paragraph wrapping discards these characters. They are not drawn as glyphs.
export function isUndrawnWhitespace(character: string): boolean {
  return character !== " " && /^\s$/u.test(character);
}

export function canEncodeWinAnsi(font: PDFFont, text: string): boolean {
  try {
    font.encodeText(text);
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes("cannot encode")) {
      return false;
    }

    throw error;
  }
}

let winAnsiProbe: Promise<PDFFont> | null = null;

function getWinAnsiProbe(): Promise<PDFFont> {
  if (!winAnsiProbe) {
    winAnsiProbe = PDFDocument.create().then((pdf) =>
      pdf.embedFont(StandardFonts.Helvetica),
    );
  }

  return winAnsiProbe;
}

let fontBytes: Record<UnicodeFontKey, Uint8Array> | null = null;

export function readUnicodeFontBytes(): Record<UnicodeFontKey, Uint8Array> {
  if (!fontBytes) {
    fontBytes = {
      sans: readFileSync(join(FONT_DIRECTORY, FONT_FILES.sans)),
      sansBold: readFileSync(join(FONT_DIRECTORY, FONT_FILES.sansBold)),
      sc: readFileSync(join(FONT_DIRECTORY, FONT_FILES.sc)),
      emoji: readFileSync(join(FONT_DIRECTORY, FONT_FILES.emoji)),
    };
  }

  return fontBytes;
}

let unicodeCoverage: Record<UnicodeFontKey, Font> | null = null;

export function loadUnicodeCoverage(): Record<UnicodeFontKey, Font> {
  if (!unicodeCoverage) {
    const bytes = readUnicodeFontBytes();
    unicodeCoverage = {
      sans: fontkit.create(bytes.sans),
      sansBold: fontkit.create(bytes.sansBold),
      sc: fontkit.create(bytes.sc),
      emoji: fontkit.create(bytes.emoji),
    };
  }

  return unicodeCoverage;
}

export function unicodeFallbackOrder(style: UnicodeFontStyle): UnicodeFontKey[] {
  if (style === "bold") {
    return ["sansBold", "sans", "sc", "emoji"];
  }

  return ["sans", "sansBold", "sc", "emoji"];
}

export function unicodeFontSupports(codePoint: number): boolean {
  const coverage = loadUnicodeCoverage();
  return unicodeFallbackOrder("regular").some((key) =>
    coverage[key].hasGlyphForCodePoint(codePoint),
  );
}

export function registerUnicodeFontkit(pdf: PDFDocument): void {
  pdf.registerFontkit(fontkit);
}

export async function findUnsupportedPdfCharacters(text: string): Promise<string[]> {
  if (text.length === 0) {
    return [];
  }

  const probe = await getWinAnsiProbe();
  if (canEncodeWinAnsi(probe, text)) {
    return [];
  }

  const missing: string[] = [];
  const seen = new Set<number>();

  for (const character of Array.from(text)) {
    const codePoint = character.codePointAt(0);
    if (codePoint === undefined || seen.has(codePoint)) {
      continue;
    }

    seen.add(codePoint);

    if (
      isUndrawnWhitespace(character) ||
      canEncodeWinAnsi(probe, character) ||
      unicodeFontSupports(codePoint)
    ) {
      continue;
    }

    missing.push(character);
  }

  return missing;
}

export async function assertPdfTextSupported(text: string): Promise<void> {
  const missing = await findUnsupportedPdfCharacters(text);
  if (missing.length > 0) {
    throw new UnsupportedPdfTextError(missing);
  }
}
