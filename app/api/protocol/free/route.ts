import { NextResponse } from "next/server";

import { normalizeOperator, normalizeTask } from "@/lib/products";
import { signDownloadToken } from "@/lib/tokens";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      operator?: string;
      task?: string;
    };
    const normalizedTask = normalizeTask(body.task ?? "");

    if (normalizedTask.length < 18) {
      return NextResponse.json(
        { error: "Mission input is too short to generate a protocol." },
        { status: 400 },
      );
    }

    const token = signDownloadToken({
      issuedAt: Date.now(),
      kind: "protocol",
      operator: normalizeOperator(body.operator ?? ""),
      task: normalizedTask,
      tierId: "free",
    });

    return NextResponse.json({
      downloadUrl: `/api/protocol/download?token=${encodeURIComponent(token)}`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to compile the starter protocol.",
      },
      { status: 500 },
    );
  }
}
