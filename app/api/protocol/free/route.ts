import { NextResponse } from "next/server";

import { normalizeOperator, normalizeTask } from "@/lib/products";
import { signDownloadToken } from "@/lib/tokens";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  if (
    typeof body !== "object" ||
    body === null ||
    Array.isArray(body) ||
    !("task" in body) ||
    typeof body.task !== "string"
  ) {
    return NextResponse.json(
      { error: "Provide a mission string and an optional operator string." },
      { status: 400 },
    );
  }

  const operator = "operator" in body ? body.operator : undefined;
  if (operator != null && typeof operator !== "string") {
    return NextResponse.json(
      { error: "Provide an optional operator string." },
      { status: 400 },
    );
  }

  try {
    const normalizedTask = normalizeTask(body.task);

    if (normalizedTask.length < 18) {
      return NextResponse.json(
        { error: "Mission input is too short to generate a protocol." },
        { status: 400 },
      );
    }

    const token = signDownloadToken({
      issuedAt: Date.now(),
      kind: "protocol",
      operator: normalizeOperator(operator ?? ""),
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
