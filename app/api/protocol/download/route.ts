import { NextResponse } from "next/server";

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
  const pdfBytes = await generateProtocolPdf(protocol);
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
