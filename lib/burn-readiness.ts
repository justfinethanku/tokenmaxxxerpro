export const READINESS_QUESTIONS = [
  {
    prompt: "A task takes one prompt. Your next move?",
    options: [
      "Accept this disturbing outcome.",
      "Request three alternative framings.",
      "Convene a council to define ‘done’.",
    ],
  },
  {
    prompt: "The agents agree. What went wrong?",
    options: [
      "Nothing. Agreement is useful.",
      "The dissent budget was underspent.",
      "We forgot the counter-counter-auditor.",
    ],
  },
  {
    prompt: "What does success look like?",
    options: [
      "A useful answer.",
      "A useful answer with appendices.",
      "A status meeting about the appendices.",
    ],
  },
] as const;

export function assessReadiness(answers: readonly number[]) {
  if (
    answers.length !== READINESS_QUESTIONS.length ||
    Array.from(answers).some(
      (answer) => !Number.isInteger(answer) || answer < 0 || answer > 2,
    )
  ) {
    throw new Error("Complete all three questions before certification.");
  }
  const score = answers.reduce((total, answer) => total + answer, 0);
  if (score <= 1)
    return {
      score,
      rank: "Dangerously efficient",
      copy: "You still believe a finished task is a reason to stop. Our fictional remediation department has been notified.",
    };
  if (score <= 4)
    return {
      score,
      rank: "Committee material",
      copy: "Promising procedural instincts. With enough review passes, your next grocery list could become a governance framework.",
    };
  return {
    score,
    rank: "Chief Incineration Officer",
    copy: "You have transcended output. You understand that the real deliverable is another round of feedback.",
  };
}

export const INITIAL_BURN = 8_742_091_600;
export function simulatedBurn(elapsedSeconds: number) {
  return (
    INITIAL_BURN +
    Math.floor(
      Math.max(0, Number.isFinite(elapsedSeconds) ? elapsedSeconds : 0),
    ) *
      14_208
  );
}
