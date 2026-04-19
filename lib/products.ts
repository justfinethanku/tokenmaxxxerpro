export type TierId = "free" | "sprint" | "pro";

export type Tier = {
  id: TierId;
  name: string;
  eyebrow: string;
  artifactCount: number;
  enrollmentNote?: string;
  price: number;
  priceLabel: string;
  targetLabel: string;
  runtimeLabel: string;
  description: string;
  callout: string;
  paymentRequired: boolean;
  deliverables: string[];
};

export const DEFAULT_TASK =
  "Draft an email responder workflow that treats every incoming message as a board-level event requiring layered review.";

export const TIERS: Tier[] = [
  {
    id: "free",
    name: "Aperture",
    eyebrow: "Initial Access",
    artifactCount: 4,
    price: 0,
    priceLabel: "Free",
    targetLabel: "50k target burn",
    runtimeLabel: "One-time prompt",
    description:
      "A starter PDF that turns one simple task into a needlessly heavy AI workflow.",
    callout:
      "Signed PDF with the main prompt, review steps, and burn framing.",
    paymentRequired: false,
    deliverables: [
      "Main prompt",
      "Review checklist",
      "Burn receipt",
    ],
  },
  {
    id: "sprint",
    name: "Ascent",
    eyebrow: "Session Acceleration",
    artifactCount: 7,
    price: 10,
    priceLabel: "$10",
    targetLabel: "500k session target",
    runtimeLabel: "One-session run",
    description:
      "A heavier prompt that adds fake specialists, review passes, and disagreement around one task.",
    callout:
      "Built to burn about 500k tokens in a single run.",
    paymentRequired: true,
    deliverables: [
      "Main prompt",
      "Agent map",
      "Review log",
    ],
  },
  {
    id: "pro",
    name: "Sovereign",
    eyebrow: "Continuous Enrollment",
    artifactCount: 9,
    enrollmentNote: "By enrollment",
    price: 50,
    priceLabel: "$50",
    targetLabel: "~500k per hour",
    runtimeLabel: "Hourly loop",
    description:
      "A looping prompt that keeps the model reviewing, rewriting, auditing, and handing work back to itself.",
    callout:
      "Built for repeated hourly runs with clear loop instructions.",
    paymentRequired: true,
    deliverables: [
      "Main prompt",
      "Hourly loop",
      "Audit cadence",
    ],
  },
];

const tierMap = new Map<TierId, Tier>(TIERS.map((tier) => [tier.id, tier]));

export function getTierById(tierId: string): Tier {
  const tier = tierMap.get(tierId as TierId);

  if (!tier) {
    throw new Error(`Unknown tier: ${tierId}`);
  }

  return tier;
}

export function normalizeTask(task: string): string {
  return task.replace(/\s+/g, " ").trim().slice(0, 420);
}

export function normalizeOperator(operator: string): string {
  return operator.replace(/\s+/g, " ").trim().slice(0, 120);
}

export function estimateBurn(task: string, tierId: TierId): number {
  const normalizedTask = normalizeTask(task);
  const promptWeight =
    normalizedTask.length === 0
      ? 0
      : Math.min(normalizedTask.split(" ").length * 420, 48000);

  switch (tierId) {
    case "free":
      return 52000 + promptWeight;
    case "sprint":
      return 480000 + promptWeight * 2;
    case "pro":
      return 500000 + promptWeight * 3;
    default:
      return 0;
  }
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}
