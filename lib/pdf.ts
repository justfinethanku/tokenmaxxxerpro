import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";

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

  const drawParagraphs = (text: string, style: TextStyle) => {
    const x = style.x ?? MARGIN;
    const color = style.color ?? rgb(0.13, 0.16, 0.2);
    const lineHeight = style.lineHeight ?? style.fontSize * 1.42;
    const gapAfter = style.gapAfter ?? style.fontSize * 0.55;
    const maxWidth = PAGE_WIDTH - x - MARGIN;

    for (const paragraph of text.split("\n")) {
      const lines = wrapParagraph(paragraph, style.font, style.fontSize, maxWidth);

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
    }
  };

  const drawBulletList = (items: string[]) => {
    for (const item of items) {
      drawParagraphs(`• ${item}`, {
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

  drawParagraphs(protocol.tierName.toUpperCase(), {
    font: monoFont,
    fontSize: 11,
    color: rgb(0.56, 0.68, 0.18),
    gapAfter: 10,
  });

  drawParagraphs(protocol.title, {
    font: sansBoldFont,
    fontSize: 28,
    color: rgb(0.07, 0.11, 0.15),
    lineHeight: 34,
    gapAfter: 10,
  });

  drawParagraphs(protocol.subtitle, {
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
  drawParagraphs(`Operator: ${protocol.operator}`, {
    font: monoFont,
    fontSize: 10,
    color: rgb(0.33, 0.4, 0.48),
    gapAfter: 6,
  });
  drawParagraphs(`Mission: ${protocol.task}`, {
    font: sansBoldFont,
    fontSize: 12,
    color: rgb(0.11, 0.15, 0.2),
    gapAfter: 6,
  });
  drawParagraphs(`Target Burn: ${protocol.burnTarget}`, {
    font: monoFont,
    fontSize: 10,
    color: rgb(0.33, 0.4, 0.48),
    gapAfter: 16,
  });

  drawParagraphs("Artifact Output", {
    font: sansBoldFont,
    fontSize: 14,
    color: rgb(0.08, 0.11, 0.16),
    gapAfter: 8,
  });
  drawBulletList(protocol.artifacts);
  cursorY -= 8;

  drawParagraphs("Operator Checklist", {
    font: sansBoldFont,
    fontSize: 14,
    color: rgb(0.08, 0.11, 0.16),
    gapAfter: 8,
  });
  drawBulletList(protocol.checklist);
  cursorY -= 8;

  drawParagraphs("Sections", {
    font: sansBoldFont,
    fontSize: 18,
    color: rgb(0.08, 0.11, 0.16),
    gapAfter: 10,
  });

  for (const section of protocol.sections) {
    drawParagraphs(section.heading, {
      font: sansBoldFont,
      fontSize: 15,
      color: rgb(0.09, 0.12, 0.17),
      gapAfter: 6,
    });

    for (const paragraph of section.body) {
      drawParagraphs(paragraph, {
        font: sansFont,
        fontSize: 11,
        color: rgb(0.2, 0.25, 0.31),
        gapAfter: 8,
      });
    }
  }

  cursorY -= 8;
  drawParagraphs("Final Paste-Ready Prompt", {
    font: sansBoldFont,
    fontSize: 18,
    color: rgb(0.08, 0.11, 0.16),
    gapAfter: 10,
  });

  for (const paragraph of protocol.finalPrompt.split("\n")) {
    drawParagraphs(paragraph, {
      font: monoFont,
      fontSize: 9.5,
      color: rgb(0.12, 0.16, 0.21),
      gapAfter: 4,
      lineHeight: 13,
    });
  }

  cursorY -= 6;
  drawParagraphs("Caution", {
    font: sansBoldFont,
    fontSize: 14,
    color: rgb(0.73, 0.25, 0.21),
    gapAfter: 6,
  });
  drawParagraphs(protocol.caution, {
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
