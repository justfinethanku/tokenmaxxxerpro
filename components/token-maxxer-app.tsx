"use client";

import { useEffect, useState } from "react";

import {
  DEFAULT_TASK,
  TIERS,
  estimateBurn,
  formatNumber,
  formatUsd,
  getTierById,
  normalizeOperator,
  normalizeTask,
  type TierId,
} from "@/lib/products";
import {
  PayPalCheckout,
  type PaidCheckoutSuccess,
} from "@/components/paypal-checkout";

type DownloadState = {
  copy: string;
  downloadUrl: string;
  headline: string;
  receipt?: string;
};

type ConsoleLine = {
  code: string;
  detail: string;
  message: string;
};

function BurnLog({ lines }: { lines: ConsoleLine[] }) {
  const [visibleCount, setVisibleCount] = useState(1);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setVisibleCount((current) => {
        if (current >= lines.length) {
          window.clearInterval(timer);
          return current;
        }

        return current + 1;
      });
    }, 180);

    return () => window.clearInterval(timer);
  }, [lines.length]);

  return (
    <div className="scrollbar-thin mt-4 max-h-[360px] space-y-3 overflow-y-auto pr-2">
      {lines.slice(0, visibleCount).map((line) => (
        <div
          key={`${line.code}-${line.detail}`}
          className="rounded-[20px] border border-line/70 bg-black/26 p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-accent">
              {line.code}
            </p>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
              Active
            </p>
          </div>
          <p className="mt-3 text-sm leading-6 text-foreground/76">
            {line.message}
          </p>
          <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.22em] text-foreground/52">
            {line.detail}
          </p>
        </div>
      ))}
    </div>
  );
}

function buildArtifactPreview(tierId: TierId, task: string): string[] {
  const compactTask = normalizeTask(task) || "Your mission input";

  switch (tierId) {
    case "free":
      return [
        `Mission brief for: ${compactTask}`,
        "Expanded requirements memo",
        "Three overbuilt draft variants",
        "Verification grid and burn receipt",
      ];
    case "sprint":
      return [
        "Inflated strategic objective",
        "Five specialist swarm memos",
        "Tribunal findings and dissent report",
        "Executive delivery pack with burn accounting",
      ];
    case "pro":
      return [
        "Loop operating system architecture",
        "Continuation briefs for repeated cycles",
        "Audit and counter-audit outputs",
        "Hourly burn governance paperwork",
      ];
    default:
      return [];
  }
}

function buildConsoleLines(
  tierId: TierId,
  task: string,
  burnEstimate: number,
): ConsoleLine[] {
  const compactTask = normalizeTask(task) || "Pending mission input";
  const shared = [
    {
      code: "SCAN",
      message: "Mission input normalized for theatrical over-processing.",
      detail: compactTask,
    },
    {
      code: "SCOPE",
      message: "Task expanded into stakeholder-aware operating language.",
      detail: `${formatNumber(burnEstimate)} token target`,
    },
  ];

  if (tierId === "free") {
    return [
      ...shared,
      {
        code: "DRAFT",
        message: "Starter burn protocol assembled with appendix pressure.",
        detail: "Three variants + verification grid",
      },
      {
        code: "SEAL",
        message: "Prompt package prepared for PDF delivery.",
        detail: "Single-session protocol",
      },
    ];
  }

  if (tierId === "sprint") {
    return [
      ...shared,
      {
        code: "SWARM",
        message: "Specialist panel instantiated for performative disagreement.",
        detail: "5 memo-producing roles",
      },
      {
        code: "TRIB",
        message: "Tribunal stage inserted to reject premature clarity.",
        detail: "Audit + dissent",
      },
      {
        code: "PACK",
        message: "Executive artifact bundle primed for high-drama delivery.",
        detail: "500K sprint packet",
      },
    ];
  }

  return [
    ...shared,
    {
      code: "LOOP",
      message: "Recursive burn cadence scheduled for repeated continuation.",
      detail: "Hourly operational rhythm",
    },
    {
      code: "AUDT",
      message: "Audit and counter-audit checkpoints chained together.",
      detail: "No clean exits permitted",
    },
    {
      code: "CTRL",
      message: "Burn governance layer armed for sustained throughput theater.",
      detail: "Flagship protocol PDF",
    },
  ];
}

function environmentLabel(): string {
  return process.env.NEXT_PUBLIC_PAYPAL_ENVIRONMENT === "live"
    ? "Live checkout armed"
    : "Sandbox checkout armed";
}

export function TokenMaxxerApp() {
  const [task, setTask] = useState(DEFAULT_TASK);
  const [operator, setOperator] = useState("");
  const [selectedTierId, setSelectedTierId] = useState<TierId>("free");
  const [downloadState, setDownloadState] = useState<DownloadState | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isFreeGenerating, setIsFreeGenerating] = useState(false);

  const normalizedTask = normalizeTask(task);
  const normalizedOperator = normalizeOperator(operator);
  const selectedTier = getTierById(selectedTierId);
  const burnEstimate = estimateBurn(normalizedTask, selectedTierId);
  const taskIsReady = normalizedTask.length >= 18;
  const artifactPreview = buildArtifactPreview(selectedTierId, normalizedTask);
  const consoleLines = buildConsoleLines(
    selectedTierId,
    normalizedTask,
    burnEstimate,
  );

  const handleFreeGenerate = async () => {
    setErrorMessage(null);
    setIsFreeGenerating(true);

    try {
      const response = await fetch("/api/protocol/free", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          operator: normalizedOperator,
          task: normalizedTask,
        }),
      });

      const json = (await response.json()) as {
        downloadUrl?: string;
        error?: string;
      };

      if (!response.ok || !json.downloadUrl) {
        throw new Error(
          json.error ?? "Starter protocol failed to compile into a PDF.",
        );
      }

      setDownloadState({
        copy: "Starter burn protocol ready for immediate deployment.",
        downloadUrl: json.downloadUrl,
        headline: "Starter PDF ready",
      });
    } catch (error) {
      setDownloadState(null);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Starter protocol generation failed.",
      );
    } finally {
      setIsFreeGenerating(false);
    }
  };

  const handlePaidSuccess = (result: PaidCheckoutSuccess) => {
    setErrorMessage(null);
    setDownloadState({
      copy: `${result.tierName} is sealed. Download the protocol PDF and go torch your own context window.`,
      downloadUrl: result.downloadUrl,
      headline: `${result.tierName} ready`,
      receipt: `${formatUsd(Number(result.amount))} captured • ${result.captureId}`,
    });
  };

  return (
    <div className="relative isolate overflow-hidden">
      <header className="mx-auto flex w-full max-w-[1440px] items-center justify-between px-5 pb-4 pt-5 sm:px-8 lg:px-10">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-accent">
            Brand New Technology
          </p>
          <p className="mt-2 text-sm text-foreground/66">
            Your tokens. Our methodology.
          </p>
        </div>
        <div className="rounded-full border border-line bg-panel px-4 py-2 font-mono text-[11px] uppercase tracking-[0.24em] text-muted">
          {environmentLabel()}
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-10 px-5 pb-16 sm:px-8 lg:px-10">
        <section className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(340px,420px)] lg:items-start">
          <div className="space-y-8">
            <div className="max-w-4xl space-y-5">
              <p className="font-mono text-[11px] uppercase tracking-[0.36em] text-muted">
                TokenMaxxerPro
              </p>
              <h1 className="max-w-5xl text-balance text-[clamp(3rem,7vw,6.4rem)] font-semibold uppercase leading-[0.96] tracking-[-0.05em] text-foreground">
                Extraordinary token consumption for tiny requests.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-foreground/72 sm:text-xl">
                Turn a trivial task into a serious operating event. We do not
                provide the tokens. We provide the protocol that convinces your
                model to burn them with dignity.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-[28px] border border-line bg-panel px-5 py-6">
                <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">
                  Burn estimate
                </p>
                <p className="mt-3 text-3xl font-semibold text-accent">
                  {formatNumber(burnEstimate)}
                </p>
                <p className="mt-2 text-sm text-foreground/62">Designed throughput</p>
              </div>
              <div className="rounded-[28px] border border-line bg-panel px-5 py-6">
                <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">
                  Delivery
                </p>
                <p className="mt-3 text-3xl font-semibold text-foreground">
                  PDF
                </p>
                <p className="mt-2 text-sm text-foreground/62">
                  Structured prompt package
                </p>
              </div>
              <div className="rounded-[28px] border border-line bg-panel px-5 py-6">
                <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">
                  Guarantee
                </p>
                <p className="mt-3 text-3xl font-semibold text-foreground">
                  No hosted burn
                </p>
                <p className="mt-2 text-sm text-foreground/62">
                  Your AI bill remains your problem
                </p>
              </div>
            </div>

            <section className="grain panel-shadow rounded-[34px] border border-line-strong bg-panel-strong p-5 sm:p-7">
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="space-y-6">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-4">
                      <label
                        htmlFor="task"
                        className="font-mono text-[11px] uppercase tracking-[0.28em] text-muted"
                      >
                        Mission Input
                      </label>
                      <span className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted">
                        {normalizedTask.length}/420
                      </span>
                    </div>
                    <textarea
                      id="task"
                      value={task}
                      onChange={(event) => setTask(event.target.value.slice(0, 420))}
                      rows={6}
                      className="min-h-[180px] w-full rounded-[28px] border border-line bg-black/20 px-5 py-4 text-base leading-7 text-foreground outline-none placeholder:text-foreground/28 focus:border-accent/70 focus:bg-black/32"
                      placeholder="Write a task so small it feels insulting to over-engineer."
                    />
                    <p className="text-sm leading-6 text-foreground/58">
                      Good inputs: emails, landing page copy, a client note, a
                      short response, or anything else that clearly deserved a
                      single prompt instead of a protocol stack.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <label
                      htmlFor="operator"
                      className="font-mono text-[11px] uppercase tracking-[0.28em] text-muted"
                    >
                      Operator ID
                    </label>
                    <input
                      id="operator"
                      value={operator}
                      onChange={(event) =>
                        setOperator(event.target.value.slice(0, 120))
                      }
                      className="w-full rounded-[22px] border border-line bg-black/20 px-4 py-3 text-sm text-foreground outline-none placeholder:text-foreground/28 focus:border-accent/70 focus:bg-black/32"
                      placeholder="Optional email or operator name"
                    />
                  </div>

                  <div className="space-y-4">
                    <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-muted">
                      Choose Burn Tier
                    </p>
                    <div className="grid gap-3">
                      {TIERS.map((tier) => {
                        const isSelected = tier.id === selectedTierId;

                        return (
                          <button
                            key={tier.id}
                            type="button"
                            onClick={() => {
                              setSelectedTierId(tier.id);
                              setDownloadState(null);
                              setErrorMessage(null);
                            }}
                            className={`rounded-[28px] border px-5 py-5 text-left ${
                              isSelected
                                ? "border-accent/70 bg-accent-muted"
                                : "border-line bg-black/16 hover:border-line-strong hover:bg-black/28"
                            }`}
                          >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-muted">
                                  {tier.eyebrow}
                                </p>
                                <h2 className="mt-2 text-2xl font-semibold text-foreground">
                                  {tier.name}
                                </h2>
                              </div>
                              <div className="text-left sm:text-right">
                                <p className="text-2xl font-semibold text-accent">
                                  {tier.priceLabel}
                                </p>
                                <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted">
                                  {tier.runtimeLabel}
                                </p>
                              </div>
                            </div>
                            <p className="mt-4 max-w-3xl text-sm leading-6 text-foreground/72">
                              {tier.description}
                            </p>
                            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.2em] text-muted">
                              <span>{tier.targetLabel}</span>
                              <span className="h-1 w-1 rounded-full bg-line-strong" />
                              <span>{tier.callout}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="space-y-4 rounded-[30px] border border-line bg-black/18 p-5">
                  <div>
                    <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-muted">
                      Selected Package
                    </p>
                    <h2 className="mt-3 text-3xl font-semibold text-foreground">
                      {selectedTier.name}
                    </h2>
                    <p className="mt-3 text-sm leading-6 text-foreground/70">
                      {selectedTier.callout}
                    </p>
                  </div>

                  <div className="space-y-2 rounded-[24px] border border-line bg-panel px-4 py-4">
                    <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-muted">
                      Deliverables
                    </p>
                    {artifactPreview.map((artifact) => (
                      <div
                        key={artifact}
                        className="border-b border-line/70 py-2 text-sm text-foreground/72 last:border-b-0"
                      >
                        {artifact}
                      </div>
                    ))}
                  </div>

                  {selectedTier.paymentRequired ? (
                    <PayPalCheckout
                      disabled={!taskIsReady}
                      operator={normalizedOperator}
                      task={normalizedTask}
                      tierId={selectedTierId as Exclude<TierId, "free">}
                      onError={setErrorMessage}
                      onSuccess={handlePaidSuccess}
                    />
                  ) : (
                    <button
                      type="button"
                      disabled={!taskIsReady || isFreeGenerating}
                      onClick={handleFreeGenerate}
                      className="w-full rounded-[28px] bg-accent px-5 py-4 text-center text-base font-semibold text-[#071106] hover:-translate-y-0.5 hover:bg-[#defd77] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0"
                    >
                      {isFreeGenerating
                        ? "Compiling starter protocol..."
                        : "Generate starter PDF"}
                    </button>
                  )}

                  <p className="text-xs leading-6 text-foreground/58">
                    Paid tiers deliver the PDF after checkout capture. Free tier
                    compiles immediately. None of these products spend your
                    tokens for you.
                  </p>

                  {errorMessage ? (
                    <div className="rounded-[22px] border border-danger/40 bg-danger/10 px-4 py-3 text-sm leading-6 text-foreground/82">
                      {errorMessage}
                    </div>
                  ) : null}

                  {downloadState ? (
                    <div className="rounded-[24px] border border-accent/40 bg-accent-muted px-4 py-4">
                      <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-accent">
                        {downloadState.headline}
                      </p>
                      <p className="mt-3 text-sm leading-6 text-foreground/76">
                        {downloadState.copy}
                      </p>
                      {downloadState.receipt ? (
                        <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.22em] text-foreground/58">
                          {downloadState.receipt}
                        </p>
                      ) : null}
                      <a
                        href={downloadState.downloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 inline-flex rounded-full border border-accent/60 px-4 py-2 text-sm font-semibold text-accent hover:bg-accent/12"
                      >
                        Download PDF
                      </a>
                    </div>
                  ) : null}
                </div>
              </div>
            </section>
          </div>

          <aside className="panel-shadow grain overflow-hidden rounded-[34px] border border-line-strong bg-panel-strong lg:sticky lg:top-5">
            <div className="border-b border-line px-5 py-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-muted">
                Burn Console
              </p>
              <div className="mt-4 flex items-end justify-between gap-4">
                <div>
                  <p className="text-[clamp(2.8rem,8vw,4rem)] font-semibold leading-none text-accent">
                    {formatNumber(burnEstimate)}
                  </p>
                  <p className="mt-3 text-sm text-foreground/64">
                    Designed burn target for the current configuration.
                  </p>
                </div>
                <div className="rounded-full border border-line bg-black/20 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.24em] text-muted">
                  {selectedTier.targetLabel}
                </div>
              </div>
            </div>

            <div className="space-y-4 p-5">
              <div className="rounded-[26px] border border-line bg-black/20 p-4">
                <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-muted">
                  Live Log
                </p>
                <BurnLog
                  key={`${selectedTierId}:${normalizedTask}`}
                  lines={consoleLines}
                />
              </div>

              <div className="grid gap-3">
                <div className="rounded-[24px] border border-line bg-black/20 p-4">
                  <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-muted">
                    Pricing posture
                  </p>
                  <p className="mt-3 text-lg font-semibold text-foreground">
                    {selectedTier.priceLabel}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-foreground/64">
                    You are purchasing a protocol PDF, not compute. The machine
                    remains your machine to abuse.
                  </p>
                </div>
                <div className="rounded-[24px] border border-line bg-black/20 p-4">
                  <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-muted">
                    Operational stance
                  </p>
                  <p className="mt-3 text-sm leading-6 text-foreground/64">
                    This product solves the wrong problem extremely well. That
                    is the joke, and also the feature.
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </section>

        <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[34px] border border-line bg-panel px-5 py-6 sm:px-7">
            <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-muted">
              What ships in the PDF
            </p>
            <h2 className="mt-4 max-w-2xl text-3xl font-semibold uppercase tracking-[-0.04em] text-foreground">
              Structured prompts, artifact logic, and enough process to make a
              tiny request look federally regulated.
            </h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-[24px] border border-line bg-black/18 p-5">
                <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-muted">
                  Core sections
                </p>
                <div className="mt-4 space-y-3 text-sm leading-6 text-foreground/72">
                  <p>Objective and operating thesis</p>
                  <p>Artifact requirements and audit layers</p>
                  <p>Prompt block formatted for direct paste</p>
                  <p>Operator checklist and caution notes</p>
                </div>
              </div>
              <div className="rounded-[24px] border border-line bg-black/18 p-5">
                <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-muted">
                  Product truth
                </p>
                <div className="mt-4 space-y-3 text-sm leading-6 text-foreground/72">
                  <p>The free tier gives a real starter protocol.</p>
                  <p>The sprint tier gives one dramatic burn event.</p>
                  <p>The pro tier gives the recursive operating system.</p>
                  <p>None of them touch your API bill.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[34px] border border-line bg-panel px-5 py-6 sm:px-7">
            <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-muted">
              Positioning
            </p>
            <div className="mt-6 space-y-4">
              {TIERS.map((tier) => (
                <div
                  key={tier.id}
                  className="rounded-[24px] border border-line bg-black/18 p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-muted">
                        {tier.eyebrow}
                      </p>
                      <h3 className="mt-2 text-2xl font-semibold text-foreground">
                        {tier.name}
                      </h3>
                    </div>
                    <p className="text-xl font-semibold text-accent">
                      {tier.priceLabel}
                    </p>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-foreground/70">
                    {tier.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
