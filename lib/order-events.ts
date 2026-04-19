import { put } from "@vercel/blob";

type OrderEventSource = "capture-route" | "paypal-webhook";

export type OrderEventRecord = {
  amount?: string;
  captureId?: string;
  currencyCode?: string;
  downloadIssued?: boolean;
  eventId?: string;
  eventType: string;
  operator?: string;
  orderId?: string;
  payerEmail?: string;
  provider: "paypal";
  recordedAt: string;
  recordId: string;
  source: OrderEventSource;
  status?: string;
  storageHint: "blob" | "console";
  summary?: string;
  taskLength?: number;
  taskPreview?: string;
  tierId?: string;
  verified?: boolean;
};

function hasBlobWriteToken(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function normalizePathSegment(value: string | undefined, fallback: string): string {
  if (!value) {
    return fallback;
  }

  return value.replace(/[^a-zA-Z0-9-_]+/g, "-").replace(/^-+|-+$/g, "") || fallback;
}

function buildPathname(record: OrderEventRecord): string {
  const datePrefix = record.recordedAt.slice(0, 10);
  const eventSlug = normalizePathSegment(record.eventType.toLowerCase(), "event");
  const orderSlug = normalizePathSegment(record.orderId, "unknown-order");

  return `order-events/${datePrefix}/${orderSlug}/${record.recordId}-${eventSlug}.json`;
}

export function summarizeTask(task?: string): {
  taskLength?: number;
  taskPreview?: string;
} {
  if (!task) {
    return {};
  }

  const normalized = task.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return {};
  }

  return {
    taskLength: normalized.length,
    taskPreview:
      normalized.length > 140 ? `${normalized.slice(0, 137)}...` : normalized,
  };
}

export async function logOrderEvent(
  record: Omit<OrderEventRecord, "recordId" | "recordedAt" | "storageHint">,
): Promise<{ pathname?: string; storage: "blob" | "console" }> {
  const finalizedRecord: OrderEventRecord = {
    ...record,
    recordId: crypto.randomUUID(),
    recordedAt: new Date().toISOString(),
    storageHint: hasBlobWriteToken() ? "blob" : "console",
  };

  if (!hasBlobWriteToken()) {
    console.info("[tokenmaxxerpro][order-event]", finalizedRecord);
    return { storage: "console" };
  }

  const pathname = buildPathname(finalizedRecord);

  await put(pathname, JSON.stringify(finalizedRecord, null, 2), {
    access: "private",
    addRandomSuffix: false,
    contentType: "application/json",
  });

  return {
    pathname,
    storage: "blob",
  };
}

export async function safelyLogOrderEvent(
  record: Omit<OrderEventRecord, "recordId" | "recordedAt" | "storageHint">,
): Promise<void> {
  try {
    await logOrderEvent(record);
  } catch (error) {
    console.error("[tokenmaxxerpro][order-event-failed]", {
      error: error instanceof Error ? error.message : "Unknown order log error.",
      eventType: record.eventType,
      orderId: record.orderId,
      source: record.source,
    });
  }
}
