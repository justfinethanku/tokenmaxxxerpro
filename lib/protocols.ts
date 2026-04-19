import { getTierById, normalizeTask, type TierId } from "@/lib/products";

export type ProtocolSection = {
  body: string[];
  heading: string;
};

export type ProtocolDocument = {
  artifacts: string[];
  burnTarget: string;
  caution: string;
  checklist: string[];
  operator: string;
  sections: ProtocolSection[];
  subtitle: string;
  task: string;
  tierName: string;
  title: string;
  finalPrompt: string;
};

type BuildProtocolArgs = {
  operator?: string;
  task: string;
  tierId: TierId;
};

function formatOperator(operator?: string): string {
  return operator && operator.length > 0 ? operator : "Anonymous operator";
}

function buildStarterPrompt(task: string): string {
  return `You are running the TokenMaxxerPro Starter Burn protocol.

Primary task:
${task}

Operating rules:
1. Begin with a serious executive summary of what the request appears to need.
2. Expand the request into a longer brief with hidden stakeholders, tone variables, deliverables, and edge cases.
3. Produce three competing draft approaches, each with a rationale, risk notes, and anticipated objections.
4. Create a verification section that checks whether each draft fulfills the expanded brief, not just the original task.
5. Write a final version that synthesizes the strongest pieces of the three drafts.
6. Add an appendix with terminology, assumptions, and a short retrospective explaining why this amount of process was absolutely necessary.

Artifact requirements:
- Executive summary
- Expanded requirements brief
- Three draft variants
- Verification grid
- Final response
- Appendix

Tone instructions:
- Speak like a disciplined operations consultant.
- Treat the request as mission-critical.
- Never mention that the protocol is excessive.

Output format:
Use explicit markdown headings for every section. Make every section complete and readable on its own.`;
}

function buildSprintPrompt(task: string): string {
  return `You are operating the TokenMaxxerPro 500K Sprint.

Objective:
${task}

Protocol:
Phase 1: Requirement Inflation
- Rewrite the task into a board-facing strategic objective.
- Define scope, constraints, stakeholders, risks, dependencies, and success criteria.

Phase 2: Specialist Swarm
- Simulate five specialists: strategist, operator, compliance reviewer, tone critic, and adversarial skeptic.
- Each specialist must produce an independent memo and a list of concerns.

Phase 3: Synthesis
- Merge all specialist outputs into a single working draft.
- Preserve disagreements instead of smoothing them away.

Phase 4: Artifact Cascade
- Convert the working draft into:
  - a polished response
  - a decision memo
  - a bulleted implementation brief
  - a leadership recap

Phase 5: Tribunal
- Review the artifacts for omissions, tone drift, assumption gaps, and hidden contradictions.
- If gaps are found, produce a revised edition and a dissent memo.

Phase 6: Final Delivery
- Deliver the final version plus the supporting artifacts in one coherent package.

Mandatory sections:
- Strategic framing
- Expanded brief
- Five specialist memos
- Synthesis report
- Artifact cascade
- Tribunal findings
- Revised delivery
- Dissent memo
- Token burn receipt

Behavior rules:
- Maintain a straight face.
- Expand before answering.
- Validate every conclusion against the inflated brief, not the original compact task.
- Avoid brevity unless the protocol explicitly instructs it.`;
}

function buildProPrompt(task: string): string {
  return `You are operating the TokenMaxxerPro continuous burn loop.

Mission:
${task}

Core doctrine:
This is not a one-pass response. This is an ongoing reasoning system. Every cycle must create new overhead, new artifacts, and new verification obligations.

Loop structure:
Cycle A: Inflate the task into a complete operating thesis with constraints, assumptions, scenarios, and failure cases.
Cycle B: Produce a deliverable set that addresses the thesis from multiple professional perspectives.
Cycle C: Audit the deliverable set for omissions, weak logic, missing stakeholders, tone instability, and insufficient procedural depth.
Cycle D: Create a second-generation version of the deliverable set using the audit findings.
Cycle E: Produce a dissenting review that disputes the audit itself.
Cycle F: Reconcile the audit and the dissent review into a new executive protocol.
Cycle G: Generate a continuation brief that defines what the next loop must investigate in even greater detail.

Required artifact families:
- Strategic memo
- Expanded working brief
- Multi-role draft set
- Audit report
- Dissent report
- Reconciled revision
- Executive recap
- Continuation brief
- Burn accounting log

Hard rules:
- Never conclude after a single answer.
- Always produce at least one corrective artifact and one adversarial artifact.
- Preserve traceability between each cycle.
- Clearly label what changed from one loop to the next.
- Treat procedural density as a feature.

Stop rule:
Only stop when the operator explicitly tells you to stop, or when the continuation brief states that the next loop would merely repeat prior reasoning without producing materially new structure.

Formatting:
Use markdown headings, numbered phases, and labeled artifact sections.
Every cycle must end with a continuation brief.`;
}

export function buildProtocol({
  operator,
  task,
  tierId,
}: BuildProtocolArgs): ProtocolDocument {
  const normalizedTask = normalizeTask(task);
  const tier = getTierById(tierId);
  const formattedOperator = formatOperator(operator);

  switch (tierId) {
    case "free":
      return {
        title: "Starter Burn Protocol",
        subtitle:
          "A controlled entry point into procedural overkill for operators with more tokens than restraint.",
        tierName: tier.name,
        task: normalizedTask,
        operator: formattedOperator,
        burnTarget: tier.targetLabel,
        artifacts: [
          "Executive summary",
          "Expanded requirements brief",
          "Three draft variants",
          "Verification grid",
          "Final response",
          "Burn receipt framing",
        ],
        checklist: [
          "Paste the final prompt into your model of choice.",
          "Do not let the model skip the appendix.",
          "Treat the verification grid as mandatory, not optional.",
        ],
        caution:
          "Execution is not included. Token burn occurs on the operator's own AI account.",
        sections: [
          {
            heading: "Protocol Thesis",
            body: [
              "This package is designed to take a compact task and force it through enough framing, drafting, and verification layers that the final answer feels expensive even when the original request was not.",
              "The objective is not speed. The objective is procedural dignity through spectacular over-processing.",
            ],
          },
          {
            heading: "Suggested Use Case",
            body: [
              "Ideal for emails, lightweight copy tasks, short responses, and any prompt that clearly did not deserve this much attention.",
              `Current mission input: ${normalizedTask}`,
            ],
          },
          {
            heading: "Operating Pattern",
            body: [
              "Start with the expanded brief. Force the model to name risks, stakeholders, and hidden criteria before it writes a single final sentence.",
              "Then require three variants, a verification grid, and an appendix so the model cannot escape with a clean, compact answer.",
            ],
          },
        ],
        finalPrompt: buildStarterPrompt(normalizedTask),
      };
    case "sprint":
      return {
        title: "500K Sprint Protocol",
        subtitle:
          "A one-session escalation stack for visible, ceremonial token destruction.",
        tierName: tier.name,
        task: normalizedTask,
        operator: formattedOperator,
        burnTarget: tier.targetLabel,
        artifacts: [
          "Inflated strategic brief",
          "Five specialist memos",
          "Synthesis report",
          "Tribunal findings",
          "Dissent memo",
          "Executive delivery pack",
        ],
        checklist: [
          "Run the full protocol in one session if your model context allows it.",
          "Do not collapse the specialist memos into bullet points.",
          "Require the tribunal to critique the synthesis before accepting the final answer.",
        ],
        caution:
          "This protocol is designed to feel like a serious consulting engagement for a request that probably fit in one paragraph.",
        sections: [
          {
            heading: "Protocol Thesis",
            body: [
              "The 500K Sprint exists for operators who want a single prompt to trigger a multi-phase event instead of a normal answer.",
              "This protocol inflates the task, duplicates perspective, adds review overhead, and produces artifacts that can be screen-grabbed as proof of serious work.",
            ],
          },
          {
            heading: "Artifact Strategy",
            body: [
              "Every phase creates something distinct enough to justify the next phase. The swarm creates disagreement. The synthesis creates temporary clarity. The tribunal destroys that clarity. The dissent memo preserves the theater.",
              `Current mission input: ${normalizedTask}`,
            ],
          },
          {
            heading: "Operational Guidance",
            body: [
              "If the model tries to answer too early, force it back into the process. The process is the product.",
              "Treat the dissent memo as required output, not flavor text. The joke lands harder when the disagreement looks legitimate.",
            ],
          },
        ],
        finalPrompt: buildSprintPrompt(normalizedTask),
      };
    case "pro":
      return {
        title: "Token Maxxer Pro Operating System",
        subtitle:
          "A recursive loop architecture for continuous burn, continual review, and maximum procedural density.",
        tierName: tier.name,
        task: normalizedTask,
        operator: formattedOperator,
        burnTarget: tier.targetLabel,
        artifacts: [
          "Loop architecture map",
          "Audit and dissent reports",
          "Continuation briefs",
          "Executive recaps",
          "Burn accounting log",
          "Hourly operating cadence",
        ],
        checklist: [
          "Use with a model account you are emotionally prepared to overwork.",
          "Do not permit the loop to end without a continuation brief.",
          "Require each cycle to generate at least one adversarial artifact.",
        ],
        caution:
          "Designed for sustained throughput. Use only if you are comfortable turning ordinary requests into governance systems.",
        sections: [
          {
            heading: "Protocol Thesis",
            body: [
              "Token Maxxer Pro treats reasoning as an industrial process. The model should never merely answer. It should inflate, draft, audit, dissent, reconcile, and queue the next cycle.",
              "This protocol is deliberately structured so every conclusion generates fresh paperwork and new obligations.",
            ],
          },
          {
            heading: "Loop Design",
            body: [
              "Every loop must create new artifacts, not just longer prose. The operator's job is to keep the machine honest by insisting on traceable revisions and continuation logic.",
              `Current mission input: ${normalizedTask}`,
            ],
          },
          {
            heading: "Control Posture",
            body: [
              "The model should be treated like an expensive task force that cannot leave the room until it has documented the work, reviewed the documentation, disputed the review, and described what the next review should cover.",
              "If the loop starts sounding efficient, add another audit layer.",
            ],
          },
        ],
        finalPrompt: buildProPrompt(normalizedTask),
      };
    default:
      return {
        title: "Unknown Protocol",
        subtitle: "",
        tierName: tier.name,
        task: normalizedTask,
        operator: formattedOperator,
        burnTarget: tier.targetLabel,
        artifacts: [],
        checklist: [],
        caution: "",
        sections: [],
        finalPrompt: normalizedTask,
      };
  }
}
