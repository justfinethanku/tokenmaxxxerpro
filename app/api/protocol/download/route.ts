import { NextResponse } from "next/server";

import { UnsupportedPdfTextError } from "@/lib/pdf-fonts";
import { generateProtocolPdf } from "@/lib/pdf";
import { buildProtocol } from "@/lib/protocols";
import { verifyDownloadToken } from "@/lib/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function buildFilename(tierId: string, orderId?: string): string {
  const suffix = orderId ? orderId.slice(-6).toLowerCase() : "manual";
  return `tokenmaxxerpro-${tierId}-protocol-${suffix}.pdf`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json(
      { error: "Missing download token." },
      { status: 400 },
    );
  }

  const payload = verifyDownloadToken(token);

  if (!payload) {
    return NextResponse.json(
      { error: "Download token was invalid or expired." },
      { status: 401 },
    );
  }

  const protocol = buildProtocol({
    operator: payload.operator,
    task: payload.task,
    tierId: payload.tierId,
  });

  // Tokens store the mission text. The PDF is rendered on each download, so a
  // link issued before Unicode fonts were vendored uses this renderer too.
  let pdfBytes: Uint8Array;
  try {
    pdfBytes = await generateProtocolPdf(protocol);
  } catch (error) {
    if (error instanceof UnsupportedPdfTextError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    throw error;
  }

  const responseBody = Uint8Array.from(pdfBytes).buffer;

  return new NextResponse(responseBody, {
    status: 200,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Disposition": `attachment; filename="${buildFilename(
        payload.tierId,
        payload.orderId,
      )}"`,
      "Content-Type": "application/pdf",
    },
  });
}
