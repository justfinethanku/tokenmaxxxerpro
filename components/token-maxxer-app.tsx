"use client";

import {
  startTransition,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
} from "react";

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
  type Tier,
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
  tierName: string;
};

type PointerState = {
  active: boolean;
  x: number;
  y: number;
  rotateX: number;
  rotateY: number;
};

const DEFAULT_POINTER: PointerState = {
  active: false,
  x: 50,
  y: 50,
  rotateX: 0,
  rotateY: 0,
};

const DEEP_EMBERS = [
  {
    blur: 82,
    bottom: "4%",
    delay: "-14s",
    drift: "32px",
    duration: "34s",
    left: "8%",
    opacity: 0.14,
    size: 240,
  },
  {
    blur: 70,
    bottom: "16%",
    delay: "-9s",
    drift: "-26px",
    duration: "30s",
    left: "24%",
    opacity: 0.09,
    size: 180,
  },
  {
    blur: 92,
    bottom: "8%",
    delay: "-21s",
    drift: "22px",
    duration: "38s",
    left: "48%",
    opacity: 0.08,
    size: 260,
  },
  {
    blur: 78,
    bottom: "10%",
    delay: "-11s",
    drift: "-18px",
    duration: "33s",
    left: "66%",
    opacity: 0.1,
    size: 210,
  },
  {
    blur: 66,
    bottom: "3%",
    delay: "-27s",
    drift: "18px",
    duration: "29s",
    left: "84%",
    opacity: 0.08,
    size: 170,
  },
  {
    blur: 58,
    bottom: "34%",
    delay: "-7s",
    drift: "14px",
    duration: "24s",
    left: "58%",
    opacity: 0.06,
    size: 132,
  },
];

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);

    updatePreference();
    mediaQuery.addEventListener("change", updatePreference);

    return () => mediaQuery.removeEventListener("change", updatePreference);
  }, []);

  return prefersReducedMotion;
}

function AnimatedNumber({
  className,
  prefix = "",
  suffix = "",
  value,
}: {
  className?: string;
  prefix?: string;
  suffix?: string;
  value: number;
}) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const ref = useRef<HTMLSpanElement | null>(null);
  const previousValueRef = useRef(0);
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (prefersReducedMotion) {
      return;
    }

    const startValue = previousValueRef.current;
    const delta = value - startValue;
    const duration = 800;
    const startedAt = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const progress = Math.min((now - startedAt) / duration, 1);
      const eased = 1 - (1 - progress) ** 3;
      const nextValue = Math.round(startValue + delta * eased);

      setDisplayValue(nextValue);

      if (progress < 1) {
        frame = window.requestAnimationFrame(tick);
        return;
      }

      previousValueRef.current = value;
    };

    frame = window.requestAnimationFrame(tick);

    return () => window.cancelAnimationFrame(frame);
  }, [prefersReducedMotion, value]);

  if (prefersReducedMotion) {
    return (
      <span ref={ref} className={className}>
        {prefix}
        {formatNumber(value)}
        {suffix}
      </span>
    );
  }

  return (
    <span ref={ref} className={className}>
      {prefix}
      {formatNumber(displayValue)}
      {suffix}
    </span>
  );
}

function buildArtifactPreview(tierId: TierId, task: string): string[] {
  const compactTask = normalizeTask(task) || "Mission brief pending";

  switch (tierId) {
    case "free":
      return [
        `Cleaned-up task brief for: ${compactTask}`,
        "Main XML prompt with role instructions",
        "Review checklist and QA notes",
        "Signed burn receipt for operator records",
      ];
    case "sprint":
      return [
        "Expanded task brief and burn plan",
        "Specialist roles and handoff map",
        "Review, dissent, and arbitration steps",
        "Signed PDF with session burn estimate",
      ];
    case "pro":
      return [
        "Loop operating system and hourly cadence",
        "Role handoffs for each cycle",
        "Audit, counter-audit, and escalation rules",
        "Signed PDF with continuation steps",
      ];
    default:
      return [];
  }
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="sub-card rounded-[18px] p-4">
      <p className="eyebrow text-muted">{label}</p>
      <p className="mt-3 text-sm leading-6 text-foreground/74">{value}</p>
    </div>
  );
}

function VaultUnlockAnimation({ animationKey }: { animationKey: string }) {
  return (
    <div key={animationKey} className="vault-animation" aria-hidden="true">
      <div className="vault-animation__track" />
      <div className="vault-animation__envelope" />
      <div className="vault-animation__seal" />
      <div className="vault-animation__vault">
        <div className="vault-animation__ring" />
        <div className="vault-animation__core" />
      </div>
    </div>
  );
}

function TierCard({
  onSelect,
  prefersReducedMotion,
  selected,
  tier,
}: {
  onSelect: () => void;
  prefersReducedMotion: boolean;
  selected: boolean;
  tier: Tier;
}) {
  const [pointer, setPointer] = useState<PointerState>(DEFAULT_POINTER);

  const handlePointerMove = (event: MouseEvent<HTMLButtonElement>) => {
    if (prefersReducedMotion) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * 100;
    const y = ((event.clientY - bounds.top) / bounds.height) * 100;
    const rotateY = ((x - 50) / 50) * 3.2;
    const rotateX = ((50 - y) / 50) * 3.2;

    setPointer({
      active: true,
      rotateX,
      rotateY,
      x,
      y,
    });
  };

  const resetPointer = () => setPointer(DEFAULT_POINTER);
  const style = {} as CSSProperties;

  if (!prefersReducedMotion) {
    style.transform = `perspective(1100px) rotateX(${pointer.rotateX}deg) rotateY(${pointer.rotateY}deg) translateY(${selected ? -4 : pointer.active ? -6 : 0}px)`;
  }

  (style as Record<string, string>)["--bloom-x"] = `${pointer.x}%`;
  (style as Record<string, string>)["--bloom-y"] = `${pointer.y}%`;

  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseMove={handlePointerMove}
      onMouseLeave={resetPointer}
      onBlur={resetPointer}
      data-selected={selected}
      style={style}
      className="tier-card glass-panel rounded-[28px] p-6 text-left focus-visible:outline-none"
    >
      <div className="relative z-10 flex h-full flex-col">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow text-muted">{tier.eyebrow}</p>
            <h3 className="mt-4 font-display text-[2.2rem] leading-none tracking-[-0.05em] text-foreground">
              {tier.name}
            </h3>
          </div>

          {tier.enrollmentNote ? (
            <span className="rounded-full border border-line px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-muted-strong">
              {tier.enrollmentNote}
            </span>
          ) : null}
        </div>

        <div className="mt-10 flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow text-muted">Enrollment</p>
            <div className="tier-price mt-3 font-display text-[3rem] leading-none tracking-[-0.06em] text-foreground tabular-nums">
              {tier.price === 0 ? (
                "Free"
              ) : (
                <AnimatedNumber prefix="$" value={tier.price} />
              )}
            </div>
          </div>

          <div className="rounded-full border border-line px-4 py-2 text-[10px] uppercase tracking-[0.22em] text-muted">
            {selected ? "Selected class" : "Select class"}
          </div>
        </div>

        <p className="mt-5 max-w-sm text-sm leading-7 text-foreground/72">
          {tier.description}
        </p>

        <div className="mt-6 grid gap-3 border-t border-line pt-5 sm:grid-cols-3">
          <Metric label="Target burn" value={tier.targetLabel} />
          <Metric label="Runtime" value={tier.runtimeLabel} />
          <Metric label="Artifacts" value={`${tier.artifactCount} issued`} />
        </div>
      </div>
    </button>
  );
}

function EnrollmentModal({
  downloadState,
  errorMessage,
  isOpen,
  onClose,
  onError,
  onSuccess,
  operator,
  task,
  tier,
}: {
  downloadState: DownloadState | null;
  errorMessage: string | null;
  isOpen: boolean;
  onClose: () => void;
  onError: (message: string) => void;
  onSuccess: (result: PaidCheckoutSuccess) => void;
  operator: string;
  task: string;
  tier: Tier;
}) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/72 px-4 py-4 backdrop-blur-md sm:items-center sm:px-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="enrollment-modal-title"
        className="glass-panel relative w-full max-w-[740px] rounded-[32px] p-5 sm:p-7"
      >
        <div className="relative z-10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="eyebrow text-muted">
                {downloadState ? "Issued" : "Enrollment"}
              </p>
              <h2
                id="enrollment-modal-title"
                className="mt-3 font-display text-[2.2rem] leading-none tracking-[-0.05em] text-foreground"
              >
                {downloadState ? `${tier.name} unlocked` : `${tier.name} access`}
              </h2>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="secondary-button rounded-full px-4 py-2 text-[11px] uppercase tracking-[0.22em] text-muted-strong"
            >
              Close
            </button>
          </div>

          {downloadState ? (
            <div className="mt-8 flex flex-col items-center gap-6 text-center">
              <VaultUnlockAnimation animationKey={downloadState.receipt ?? tier.id} />
              <div className="max-w-md space-y-3">
                <p className="eyebrow text-accent-ember">Issuance complete</p>
                <p className="text-base leading-7 text-foreground/76">
                  {downloadState.copy}
                </p>
                {downloadState.receipt ? (
                  <p className="eyebrow text-muted">{downloadState.receipt}</p>
                ) : null}
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <a
                  href={downloadState.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="primary-button rounded-full px-6 py-3 text-sm font-medium"
                >
                  Download dossier
                </a>
                <button
                  type="button"
                  onClick={onClose}
                  className="secondary-button rounded-full px-6 py-3 text-sm text-foreground/78"
                >
                  Return to page
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-8 space-y-6">
              <div className="grid gap-4 border-b border-line pb-6 sm:grid-cols-3">
                <Metric label="Class" value={tier.name} />
                <Metric label="Target burn" value={tier.targetLabel} />
                <Metric label="Runtime" value={tier.runtimeLabel} />
              </div>

              <div className="rounded-[24px] border border-line bg-black/16 p-5">
                <p className="eyebrow text-muted">Mission brief</p>
                <p className="mt-3 text-sm leading-7 text-foreground/74">
                  {task}
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <Metric
                    label="Operator"
                    value={operator || "Not provided"}
                  />
                  <Metric label="Delivery" value="Immediate PDF issuance" />
                </div>
              </div>

              <PayPalCheckout
                disabled={false}
                operator={operator}
                task={task}
                tierId={tier.id as Exclude<TierId, "free">}
                onError={onError}
                onSuccess={onSuccess}
              />

              {errorMessage ? (
                <div className="rounded-[22px] border border-danger/35 bg-danger/10 px-4 py-3 text-sm leading-6 text-foreground/82">
                  {errorMessage}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function TokenMaxxerApp() {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [task, setTask] = useState(DEFAULT_TASK);
  const [operator, setOperator] = useState("");
  const [selectedTierId, setSelectedTierId] = useState<TierId | null>(null);
  const [downloadState, setDownloadState] = useState<DownloadState | null>(null);
  const [modalDownloadState, setModalDownloadState] =
    useState<DownloadState | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isEnrollmentOpen, setIsEnrollmentOpen] = useState(false);
  const [isFreeGenerating, setIsFreeGenerating] = useState(false);

  const normalizedTask = normalizeTask(task);
  const normalizedOperator = normalizeOperator(operator);
  const selectedTier = selectedTierId ? getTierById(selectedTierId) : null;
  const fallbackTier = TIERS[0];
  const burnEstimate = selectedTier
    ? estimateBurn(normalizedTask, selectedTier.id)
    : 0;
  const taskIsReady = normalizedTask.length >= 18;
  const artifactPreview = selectedTier
    ? buildArtifactPreview(selectedTier.id, normalizedTask)
    : [];
  const terms = selectedTier
    ? [
        {
          label: "Delivery",
          value: selectedTier.paymentRequired
            ? "Delivered right after PayPal payment."
            : "Delivered right after you submit the task.",
        },
        {
          label: "Compute",
          value: "Not included. You run the prompt in your own AI account.",
        },
        {
          label: "Record",
          value: selectedTier.paymentRequired
            ? "PayPal receipt plus signed PDF."
            : "Signed PDF plus free download record.",
        },
        {
          label: "Style",
          value: "Serious tone, too many steps, clear instructions.",
        },
      ]
    : [];

  const handleFreeGenerate = async () => {
    if (!selectedTier) {
      return;
    }

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
        throw new Error(json.error ?? "The dossier could not be issued.");
      }

      setDownloadState({
        copy: `${selectedTier.name} is ready. Download the PDF and run it in your own model account.`,
        downloadUrl: json.downloadUrl,
        headline: `${selectedTier.name} issued`,
        tierName: selectedTier.name,
      });
    } catch (error) {
      setDownloadState(null);
      setErrorMessage(
        error instanceof Error ? error.message : "Free issuance failed.",
      );
    } finally {
      setIsFreeGenerating(false);
    }
  };

  const handlePaidSuccess = (result: PaidCheckoutSuccess) => {
    const successState = {
      copy: `${result.tierName} is ready. Download the PDF and run it in your own model account.`,
      downloadUrl: result.downloadUrl,
      headline: `${result.tierName} issued`,
      receipt: `${formatUsd(Number(result.amount))} captured • record ${result.captureId}`,
      tierName: result.tierName,
    };

    setErrorMessage(null);
    setDownloadState(successState);
    setModalDownloadState(successState);
  };

  const openEnrollment = () => {
    if (!selectedTier) {
      return;
    }

    setErrorMessage(null);
    setModalDownloadState(null);
    setIsEnrollmentOpen(true);
  };

  const closeEnrollment = () => {
    setIsEnrollmentOpen(false);
    setModalDownloadState(null);
  };

  return (
    <div className="relative isolate overflow-hidden">
      <div aria-hidden className="deep-embers">
        {DEEP_EMBERS.map((ember, index) => {
          const style = {
            animationDelay: ember.delay,
            animationDuration: ember.duration,
            bottom: ember.bottom,
            filter: `blur(${ember.blur}px)`,
            height: ember.size,
            left: ember.left,
            width: ember.size,
            "--ember-drift": ember.drift,
            "--ember-opacity": `${ember.opacity}`,
          } as CSSProperties;

          return (
            <span
              key={`${ember.left}-${ember.duration}-${index}`}
              className="deep-embers__ember"
              style={style}
            />
          );
        })}
      </div>
      <div aria-hidden className="page-grain" />

      <main className="relative z-10 mx-auto flex w-full max-w-[1520px] flex-col gap-8 px-5 pb-14 pt-6 sm:px-8 lg:px-10 lg:pb-20 lg:pt-8">
        <section className="relative space-y-10 border-b border-line/70 pb-12 pt-6 lg:space-y-12 lg:pb-16 lg:pt-10">
          <div aria-hidden className="hero-head hidden lg:block" />

          <div className="relative z-10 space-y-6 lg:max-w-[780px]">
            <div className="space-y-6">
              <div className="fade-blur-up inline-flex items-center gap-3 [--delay:120ms]">
                <span className="brand-mark" />
              </div>
              <h1 className="hero-wordmark fade-blur-up w-fit max-w-full whitespace-nowrap font-display text-[clamp(1.95rem,7.2vw,7.4rem)] leading-[0.9] tracking-[-0.085em] [--delay:180ms]">
                tokenMAxXxERpro
              </h1>
              <p className="fade-blur-up max-w-2xl text-lg leading-8 text-foreground/72 sm:text-[1.18rem] [--delay:260ms]">
                A protocol built for operators who understand that restraint is
                for amateurs. Load it into your model. Burn tokens like the
                real professionals.
              </p>
            </div>
          </div>

          <div className="fade-blur-up grid gap-4 pt-2 [--delay:320ms] xl:grid-cols-3">
            {TIERS.map((tier) => (
              <TierCard
                key={tier.id}
                onSelect={() => {
                  startTransition(() => {
                    setSelectedTierId(tier.id);
                    setErrorMessage(null);
                    setDownloadState(null);
                  });
                }}
                prefersReducedMotion={prefersReducedMotion}
                selected={tier.id === selectedTierId}
                tier={tier}
              />
            ))}
          </div>

          {downloadState ? (
            <section
              aria-live="polite"
              className="glass-panel rounded-[28px] px-5 py-5 sm:px-6"
            >
              <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="eyebrow text-accent-ember">{downloadState.headline}</p>
                  <p className="mt-3 text-sm leading-7 text-foreground/76">
                    {downloadState.copy}
                  </p>
                  {downloadState.receipt ? (
                    <p className="mt-3 eyebrow text-muted">{downloadState.receipt}</p>
                  ) : null}
                </div>

                <a
                  href={downloadState.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="primary-button inline-flex rounded-full px-6 py-3 text-sm font-medium"
                >
                  Download dossier
                </a>
              </div>
            </section>
          ) : null}

          {errorMessage ? (
            <section className="rounded-[24px] border border-danger/35 bg-danger/10 px-5 py-4 text-sm leading-7 text-foreground/82">
              {errorMessage}
            </section>
          ) : null}

          {selectedTier ? (
            <div className="glass-panel rounded-[32px] p-5 sm:p-6 lg:p-7">
              <div className="relative z-10">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="eyebrow text-muted">Selected Class</p>
                    <h2 className="mt-4 font-display text-[2.3rem] leading-none tracking-[-0.05em] text-foreground">
                      Mission brief
                    </h2>
                    <p className="mt-4 max-w-md text-sm leading-7 text-foreground/68">
                      Enter the task. {selectedTier.name} will turn it into a
                      longer, hotter, more complicated process.
                    </p>
                  </div>

                  <div className="rounded-full border border-line px-4 py-2 text-[11px] uppercase tracking-[0.22em] text-muted-strong">
                    {selectedTier.name}
                  </div>
                </div>

                <div className="mt-7 space-y-5">
                  <div>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <label htmlFor="task" className="eyebrow text-muted">
                        Mission brief
                      </label>
                      <span className="eyebrow text-muted">
                        {normalizedTask.length}/420
                      </span>
                    </div>
                    <textarea
                      id="task"
                      value={task}
                      onChange={(event) =>
                        setTask(event.target.value.slice(0, 420))
                      }
                      rows={6}
                      className="field-input min-h-[180px] w-full rounded-[24px] px-5 py-4 text-base leading-7 text-foreground placeholder:text-foreground/28"
                      placeholder="Describe the simple task you want to turn into a ridiculous token-burning workflow."
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="operator"
                      className="mb-3 block eyebrow text-muted"
                    >
                      Operator reference
                    </label>
                    <input
                      id="operator"
                      value={operator}
                      onChange={(event) =>
                        setOperator(event.target.value.slice(0, 120))
                      }
                      className="field-input w-full rounded-[20px] px-4 py-3 text-sm text-foreground placeholder:text-foreground/28"
                      placeholder="Optional name or email"
                    />
                  </div>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <Metric label="Protocol class" value={selectedTier.name} />
                  <Metric
                    label="Estimated burn"
                    value={`${formatNumber(burnEstimate)} tokens`}
                  />
                  <Metric
                    label="Artifact count"
                    value={`${selectedTier.artifactCount} PDF items`}
                  />
                </div>

                <div className="glass-divider mt-6 pt-6">
                  <div className="flex flex-col gap-3 sm:flex-row">
                    {selectedTier.paymentRequired ? (
                      <button
                        type="button"
                        disabled={!taskIsReady}
                        onClick={openEnrollment}
                        className="primary-button rounded-full px-6 py-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0"
                      >
                        Open {selectedTier.name} enrollment
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={!taskIsReady || isFreeGenerating}
                        onClick={handleFreeGenerate}
                        className="primary-button rounded-full px-6 py-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0"
                      >
                        {isFreeGenerating
                          ? "Issuing dossier..."
                          : `Issue ${selectedTier.name} dossier`}
                      </button>
                    )}
                  </div>

                  <p className="mt-4 text-xs leading-6 text-foreground/56">
                    Free access downloads right away. Paid classes open PayPal
                    and deliver right after payment. No hosted compute is
                    included.
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </section>

        {selectedTier ? (
          <section className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(280px,0.55fr)]">
            <div className="glass-panel rounded-[28px] px-5 py-6 sm:px-7">
              <div className="relative z-10">
                <h2 className="font-display text-[2.2rem] leading-none tracking-[-0.05em] text-foreground">
                  What&apos;s inside {selectedTier.name}
                </h2>

                <div className="mt-6 divide-y divide-line rounded-[24px] border border-line bg-black/16">
                  {artifactPreview.map((artifact) => (
                    <div
                      key={artifact}
                      className="flex items-start justify-between gap-4 px-5 py-4"
                    >
                      <p className="text-sm leading-7 text-foreground/74">
                        {artifact}
                      </p>
                      <span className="mt-1 h-2 w-2 rounded-full bg-accent/70 shadow-[0_0_18px_rgba(255,109,87,0.55)]" />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="glass-panel rounded-[28px] px-5 py-6 sm:px-6">
              <div className="relative z-10">
                <p className="eyebrow text-muted">Enrollment Terms</p>
                <div className="mt-6 space-y-5">
                  {terms.map((term) => (
                    <div
                      key={term.label}
                      className="border-b border-line pb-5 last:border-b-0 last:pb-0"
                    >
                      <p className="eyebrow text-muted">{term.label}</p>
                      <p className="mt-3 text-sm leading-7 text-foreground/72">
                        {term.value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        ) : null}

        <footer className="border-t border-line/70 pb-6 pt-8">
          <div className="grid gap-5 border-b border-line/70 pb-8 sm:grid-cols-3">
            <div>
              <p className="eyebrow text-muted">Delivery format</p>
              <p className="mt-3 text-sm leading-7 text-foreground/74">
                PDF prompts you can paste straight into your model.
              </p>
            </div>
            <div>
              <p className="eyebrow text-muted">Token liability</p>
              <p className="mt-3 text-sm leading-7 text-foreground/74">
                All burn occurs against the operator&apos;s own AI account.
              </p>
            </div>
            <div>
              <p className="eyebrow text-muted">Access model</p>
              <p className="mt-3 text-sm leading-7 text-foreground/74">
                Free sample, one-session burn, or an hourly loop.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-5 pt-8 text-sm text-foreground/56 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="eyebrow text-muted">tokenMAxXxERpro</p>
              <p className="mt-3 max-w-md leading-7">
                Legal: you are buying a prompt PDF, not compute, model access,
                or hosted automation.
              </p>
            </div>
            <div className="max-w-md">
              <p className="eyebrow text-muted">Support</p>
              <p className="mt-3 leading-7">
                Your PDF appears on-page after download or payment. Keep the PDF
                and receipt for your own records.
              </p>
            </div>
          </div>
        </footer>
      </main>

      <EnrollmentModal
        downloadState={modalDownloadState}
        errorMessage={errorMessage}
        isOpen={isEnrollmentOpen}
        onClose={closeEnrollment}
        onError={setErrorMessage}
        onSuccess={handlePaidSuccess}
        operator={normalizedOperator}
        task={normalizedTask || DEFAULT_TASK}
        tier={selectedTier ?? fallbackTier}
      />
    </div>
  );
}
