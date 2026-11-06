import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";

import {
  canEncodeWinAnsi,
  isUndrawnWhitespace,
  loadUnicodeCoverage,
  readUnicodeFontBytes,
  registerUnicodeFontkit,
  unicodeFallbackOrder,
  UnsupportedPdfTextError,
  type UnicodeFontKey,
  type UnicodeFontStyle,
} from "@/lib/pdf-fonts";
import type { ProtocolDocument } from "@/lib/protocols";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 56;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

type TextStyle = {
  color?: ReturnType<typeof rgb>;
  font: PDFFont;
  fontSize: number;
  gapAfter?: number;
  lineHeight?: number;
  x?: number;
};

function wrapParagraph(
  paragraph: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number,
): string[] {
  const words = paragraph.split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return [""];
  }

  const lines: string[] = [];
  let currentLine = words[0];

  for (const word of words.slice(1)) {
    const candidate = `${currentLine} ${word}`;

    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      currentLine = candidate;
      continue;
    }

    lines.push(currentLine);
    currentLine = word;
  }

  lines.push(currentLine);
  return lines;
}

function wrapMeasured(
  paragraph: string,
  measure: (text: string) => number,
  maxWidth: number,
): string[] {
  const words = paragraph.split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return [""];
  }

  const lines: string[] = [];
  let current = "";

  const append = (word: string) => {
    if (current.length === 0) {
      current = word;
      return;
    }

    const candidate = `${current} ${word}`;
    if (measure(candidate) <= maxWidth) {
      current = candidate;
      return;
    }

    lines.push(current);
    current = word;
  };

  for (const word of words) {
    if (measure(word) <= maxWidth) {
      append(word);
      continue;
    }

    if (current.length > 0) {
      lines.push(current);
      current = "";
    }

    let chunk = "";
    for (const character of Array.from(word)) {
      const next = chunk + character;
      if (chunk.length > 0 && measure(next) > maxWidth) {
        lines.push(chunk);
        chunk = character;
      } else {
        chunk = next;
      }
    }

    current = chunk;
  }

  if (current.length > 0) {
    lines.push(current);
  }

  return lines;
}

function addFooter(page: PDFPage, pageNumber: number, monoFont: PDFFont): void {
  page.drawLine({
    start: { x: MARGIN, y: 40 },
    end: { x: PAGE_WIDTH - MARGIN, y: 40 },
    thickness: 1,
    color: rgb(0.16, 0.21, 0.29),
  });

  page.drawText(`TOKENMAXXERPRO / PAGE ${pageNumber}`, {
    x: MARGIN,
    y: 23,
    size: 9,
    font: monoFont,
    color: rgb(0.53, 0.62, 0.72),
  });
}

export async function generateProtocolPdf(
  protocol: ProtocolDocument,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const sansFont = await pdf.embedFont(StandardFonts.Helvetica);
  const sansBoldFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  const monoFont = await pdf.embedFont(StandardFonts.Courier);

  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let cursorY = PAGE_HEIGHT - MARGIN;

  const ensureSpace = (height: number) => {
    if (cursorY - height > 52) {
      return;
    }

    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    cursorY = PAGE_HEIGHT - MARGIN;
  };

  const embeddedFonts = new Map<UnicodeFontKey, PDFFont>();
  let fontkitRegistered = false;

  const embedFallback = async (key: UnicodeFontKey): Promise<PDFFont> => {
    const existing = embeddedFonts.get(key);
    if (existing) {
      return existing;
    }

    if (!fontkitRegistered) {
      registerUnicodeFontkit(pdf);
      fontkitRegistered = true;
    }

    const font = await pdf.embedFont(readUnicodeFontBytes()[key], {
      subset: true,
    });
    embeddedFonts.set(key, font);
    return font;
  };

  const drawParagraphs = async (text: string, style: TextStyle) => {
    const x = style.x ?? MARGIN;
    const color = style.color ?? rgb(0.13, 0.16, 0.2);
    const lineHeight = style.lineHeight ?? style.fontSize * 1.42;
    const gapAfter = style.gapAfter ?? style.fontSize * 0.55;
    const maxWidth = PAGE_WIDTH - x - MARGIN;
    const unicodeStyle: UnicodeFontStyle =
      style.font === sansBoldFont
        ? "bold"
        : style.font === sansFont
          ? "regular"
          : "mono";

    for (const paragraph of text.split("\n")) {
      // Standard fonts keep the original ASCII layout. Unicode runs are measured separately.
      if (canEncodeWinAnsi(style.font, paragraph)) {
        const lines = wrapParagraph(
          paragraph,
          style.font,
          style.fontSize,
          maxWidth,
        );

        for (const line of lines) {
          ensureSpace(lineHeight + 4);
          page.drawText(line, {
            x,
            y: cursorY,
            size: style.fontSize,
            font: style.font,
            color,
          });
          cursorY -= lineHeight;
        }

        cursorY -= gapAfter;
        continue;
      }

      const order = unicodeFallbackOrder(unicodeStyle);
      const coverage = loadUnicodeCoverage();
      const missing: string[] = [];
      const seen = new Set<number>();

      for (const character of Array.from(paragraph)) {
        const codePoint = character.codePointAt(0);
        if (codePoint === undefined || seen.has(codePoint)) {
          continue;
        }

        seen.add(codePoint);
        if (
          isUndrawnWhitespace(character) ||
          canEncodeWinAnsi(style.font, character)
        ) {
          continue;
        }

        const supported = order.some((key) =>
          coverage[key].hasGlyphForCodePoint(codePoint),
        );
        if (!supported) {
          missing.push(character);
        }
      }

      if (missing.length > 0) {
        throw new UnsupportedPdfTextError(missing);
      }

      const needed = new Set<UnicodeFontKey>();
      for (const character of Array.from(paragraph)) {
        if (canEncodeWinAnsi(style.font, character)) {
          continue;
        }

        const codePoint = character.codePointAt(0);
        if (codePoint === undefined) {
          continue;
        }

        const key = order.find((candidate) =>
          coverage[candidate].hasGlyphForCodePoint(codePoint),
        );
        if (key) {
          needed.add(key);
        }
      }

      for (const key of needed) {
        await embedFallback(key);
      }

      const pickFont = (character: string): PDFFont => {
        if (canEncodeWinAnsi(style.font, character)) {
          return style.font;
        }

        const codePoint = character.codePointAt(0);
        const key =
          codePoint === undefined
            ? undefined
            : order.find((candidate) =>
                coverage[candidate].hasGlyphForCodePoint(codePoint),
              );
        const font = key ? embeddedFonts.get(key) : undefined;
        if (!font) {
          throw new UnsupportedPdfTextError([character]);
        }

        return font;
      };

      const measure = (value: string) => {
        let width = 0;
        let run = "";
        let runFont: PDFFont | null = null;

        const flush = () => {
          if (runFont && run.length > 0) {
            width += runFont.widthOfTextAtSize(run, style.fontSize);
          }

          run = "";
          runFont = null;
        };

        for (const character of Array.from(value)) {
          const font = pickFont(character);
          if (runFont !== font) {
            flush();
            runFont = font;
          }

          run += character;
        }

        flush();
        return width;
      };

      const lines = wrapMeasured(paragraph, measure, maxWidth);

      for (const line of lines) {
        ensureSpace(lineHeight + 4);
        let runX = x;
        let run = "";
        let runFont: PDFFont | null = null;

        const flush = () => {
          if (!runFont || run.length === 0) {
            run = "";
            runFont = null;
            return;
          }

          page.drawText(run, {
            x: runX,
            y: cursorY,
            size: style.fontSize,
            font: runFont,
            color,
          });
          runX += runFont.widthOfTextAtSize(run, style.fontSize);
          run = "";
          runFont = null;
        };

        for (const character of Array.from(line)) {
          const font = pickFont(character);
          if (runFont !== font) {
            flush();
            runFont = font;
          }

          run += character;
        }

        flush();
        cursorY -= lineHeight;
      }

      cursorY -= gapAfter;
    }
  };

  const drawBulletList = async (items: string[]) => {
    for (const item of items) {
      await drawParagraphs(`• ${item}`, {
        font: sansFont,
        fontSize: 11,
        color: rgb(0.2, 0.25, 0.31),
        gapAfter: 4,
        lineHeight: 15,
      });
    }
  };

  page.drawRectangle({
    x: MARGIN,
    y: PAGE_HEIGHT - 138,
    width: 180,
    height: 10,
    color: rgb(0.82, 1, 0.28),
  });

  await drawParagraphs(protocol.tierName.toUpperCase(), {
    font: monoFont,
    fontSize: 11,
    color: rgb(0.56, 0.68, 0.18),
    gapAfter: 10,
  });

  await drawParagraphs(protocol.title, {
    font: sansBoldFont,
    fontSize: 28,
    color: rgb(0.07, 0.11, 0.15),
    lineHeight: 34,
    gapAfter: 10,
  });

  await drawParagraphs(protocol.subtitle, {
    font: sansFont,
    fontSize: 13,
    color: rgb(0.3, 0.36, 0.42),
    lineHeight: 19,
    gapAfter: 18,
  });

  page.drawRectangle({
    x: MARGIN,
    y: cursorY - 78,
    width: CONTENT_WIDTH,
    height: 78,
    color: rgb(0.95, 0.97, 1),
  });

  cursorY -= 20;
  await drawParagraphs(`Operator: ${protocol.operator}`, {
    font: monoFont,
    fontSize: 10,
    color: rgb(0.33, 0.4, 0.48),
    gapAfter: 6,
  });
  await drawParagraphs(`Mission: ${protocol.task}`, {
    font: sansBoldFont,
    fontSize: 12,
    color: rgb(0.11, 0.15, 0.2),
    gapAfter: 6,
  });
  await drawParagraphs(`Target Burn: ${protocol.burnTarget}`, {
    font: monoFont,
    fontSize: 10,
    color: rgb(0.33, 0.4, 0.48),
    gapAfter: 16,
  });

  await drawParagraphs("Artifact Output", {
    font: sansBoldFont,
    fontSize: 14,
    color: rgb(0.08, 0.11, 0.16),
    gapAfter: 8,
  });
  await drawBulletList(protocol.artifacts);
  cursorY -= 8;

  await drawParagraphs("Operator Checklist", {
    font: sansBoldFont,
    fontSize: 14,
    color: rgb(0.08, 0.11, 0.16),
    gapAfter: 8,
  });
  await drawBulletList(protocol.checklist);
  cursorY -= 8;

  await drawParagraphs("Sections", {
    font: sansBoldFont,
    fontSize: 18,
    color: rgb(0.08, 0.11, 0.16),
    gapAfter: 10,
  });

  for (const section of protocol.sections) {
    await drawParagraphs(section.heading, {
      font: sansBoldFont,
      fontSize: 15,
      color: rgb(0.09, 0.12, 0.17),
      gapAfter: 6,
    });

    for (const paragraph of section.body) {
      await drawParagraphs(paragraph, {
        font: sansFont,
        fontSize: 11,
        color: rgb(0.2, 0.25, 0.31),
        gapAfter: 8,
      });
    }
  }

  cursorY -= 8;
  await drawParagraphs("Final Paste-Ready Prompt", {
    font: sansBoldFont,
    fontSize: 18,
    color: rgb(0.08, 0.11, 0.16),
    gapAfter: 10,
  });

  for (const paragraph of protocol.finalPrompt.split("\n")) {
    await drawParagraphs(paragraph, {
      font: monoFont,
      fontSize: 9.5,
      color: rgb(0.12, 0.16, 0.21),
      gapAfter: 4,
      lineHeight: 13,
    });
  }

  cursorY -= 6;
  await drawParagraphs("Caution", {
    font: sansBoldFont,
    fontSize: 14,
    color: rgb(0.73, 0.25, 0.21),
    gapAfter: 6,
  });
  await drawParagraphs(protocol.caution, {
    font: sansFont,
    fontSize: 11,
    color: rgb(0.32, 0.18, 0.17),
    gapAfter: 8,
  });

  // Finalize every page once, including the last page, after content pagination.
  for (const [index, pdfPage] of pdf.getPages().entries()) {
    addFooter(pdfPage, index + 1, monoFont);
  }

  return pdf.save();
}
