export type TierId = "free" | "sprint" | "pro";

export type Tier = {
  id: TierId;
  name: string;
  eyebrow: string;
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
  "Design an email responder workflow for creators who want every incoming message treated like a board-level event.";

export const TIERS: Tier[] = [
  {
    id: "free",
    name: "Starter Burn",
    eyebrow: "Tastefully irresponsible",
    price: 0,
    priceLabel: "Free",
    targetLabel: "30k-80k tokens per run",
    runtimeLabel: "Single-session protocol",
    description:
      "A controlled first exposure to overbuilt prompting, delivered as a clean PDF protocol.",
    callout: "Includes a structured prompt, artifact checklist, and burn receipt framing.",
    paymentRequired: false,
    deliverables: [
      "Prompt PDF",
      "Artifact checklist",
      "Token burn receipt",
    ],
  },
  {
    id: "sprint",
    name: "500K Sprint",
    eyebrow: "Professional waste acceleration",
    price: 10,
    priceLabel: "$10",
    targetLabel: "300k-700k tokens in one session",
    runtimeLabel: "Escalation protocol",
    description:
      "Turns one tiny request into a multi-phase burn event with expansion, review, arbitration, and executive recap layers.",
    callout: "Designed for one dramatic, visible reasoning incident.",
    paymentRequired: true,
    deliverables: [
      "Master protocol PDF",
      "Swarm role map",
      "Review and dissent loops",
    ],
  },
  {
    id: "pro",
    name: "Token Maxxer Pro",
    eyebrow: "Continuous burn infrastructure",
    price: 50,
    priceLabel: "$50",
    targetLabel: "Up to ~500k tokens per hour",
    runtimeLabel: "Looping operating system",
    description:
      "A recursive protocol stack for operators who believe the model should never be allowed to stop touching the task.",
    callout: "Designed for sustained throughput, ritualized verification, and procedural excess.",
    paymentRequired: true,
    deliverables: [
      "Flagship protocol PDF",
      "Hourly loop architecture",
      "Governance and audit cadence",
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
