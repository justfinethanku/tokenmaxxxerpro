"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  assessReadiness,
  INITIAL_BURN,
  READINESS_QUESTIONS,
  simulatedBurn,
} from "@/lib/burn-readiness";

export function BurnMeter() {
  const [burn, setBurn] = useState(INITIAL_BURN);
  const [running, setRunning] = useState(true);
  const burnRef = useRef(INITIAL_BURN);
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const started = performance.now();
    const base = burnRef.current;
    let timer: ReturnType<typeof setInterval> | undefined;
    const sync = () => {
      clearInterval(timer);
      if (running && !preference.matches && !document.hidden) {
        timer = setInterval(() => {
          burnRef.current =
            base +
            simulatedBurn((performance.now() - started) / 1000) -
            INITIAL_BURN;
          setBurn(burnRef.current);
        }, 1000);
      }
    };
    sync();
    preference.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      clearInterval(timer);
      preference.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [running]);
  return (
    <div className="burn-meter">
      <div>
        <span className="eyebrow">
          <span className="status-dot" /> Global disposal index
        </span>
        <strong
          aria-label={`${burn.toLocaleString("en-US")} simulated tokens incinerated`}
        >
          {burn.toLocaleString("en-US")}
        </strong>
        <p>Fictional tokens incinerated. Real commitment to the bit.</p>
      </div>
      <div className="meter-control">
        <span className="eyebrow">+14,208 / sec · simulated</span>
        <button
          type="button"
          onClick={() => setRunning(!running)}
          aria-pressed={!running}
        >
          {running ? "Pause meter" : "Resume meter"}{" "}
          <span aria-hidden="true">{running ? "Ⅱ" : "▷"}</span>
        </button>
      </div>
    </div>
  );
}

export function FacilityHero() {
  return (
    <>
      <a className="skip-link" href="#protocols">
        Skip to protocols
      </a>
      <header className="facility-nav">
        <a className="wordmark" href="#" aria-label="TokenMaxxerPro home">
          <Image
            className="flame-mark"
            src="/images/facility-mark.svg"
            alt=""
            width={30}
            height={30}
          />{" "}
          tokenmaxxer<span>pro</span>
          <sup>™</sup>
        </a>
        <nav aria-label="Main navigation">
          <a href="#assessment">Get assessed</a>
          <a href="#protocols">
            The protocols <span aria-hidden="true">↗</span>
          </a>
        </nav>
      </header>
      <section className="facility-hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow orange">Enterprise-grade inefficiency</p>
          <h1 id="hero-title">
            Do less.
            <br />
            Prompt more.
            <br />
            <em>Burn everything.</em>
          </h1>
          <p className="hero-deck">
            Your simple task deserves a 14-agent review committee. We sell the
            protocols to make that happen.
          </p>
          <div className="hero-actions">
            <a className="primary-button" href="#protocols">
              Escalate a simple task <span aria-hidden="true">↗</span>
            </a>
            <a className="text-link" href="#assessment">
              Am I burn-ready? <span aria-hidden="true">↓</span>
            </a>
          </div>
          <p className="hero-fine">
            Actual PDFs. Actual prices. Deeply unnecessary procedures.
            <br />
            You run the prompts. We do not spend your tokens.
          </p>
        </div>
        <div className="machine-scene">
          <div className="machine-label">
            <span className="status-dot" /> FACILITY 001 / OPERATIONALLY
            EXCESSIVE
          </div>
          <Image
            src="/images/token-incinerator.webp"
            alt="An elaborate miniature token furnace with a conveyor of paperwork and a glowing orange incineration chamber"
            width={960}
            height={960}
            priority
            sizes="(max-width: 760px) 100vw, 48vw"
          />
          <div className="machine-caption">
            <span>INPUT: ONE SIMPLE QUESTION</span>
            <span>OUTPUT: A PROCESS</span>
          </div>
          <span className="machine-seal" aria-hidden="true">
            0%<small>restraint</small>
          </span>
        </div>
      </section>
      <BurnMeter />
      <div className="trust-strip">
        <p className="eyebrow">Accredited by absolutely nobody</p>
        <span>ISO 000: Unnecessary</span>
        <span>∞ review passes</span>
        <span>Human-out-of-the-loop-ish</span>
      </div>
    </>
  );
}

export function ReadinessAssessment() {
  const [answers, setAnswers] = useState<number[]>([]);
  const [result, setResult] = useState<ReturnType<
    typeof assessReadiness
  > | null>(null);
  const resultRef = useRef<HTMLHeadingElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const returningToQuiz = useRef(false);
  useEffect(() => {
    if (result) resultRef.current?.focus();
    else if (returningToQuiz.current) {
      formRef.current?.querySelector<HTMLInputElement>("input")?.focus();
      returningToQuiz.current = false;
    }
  }, [result]);
  const complete = READINESS_QUESTIONS.every((_, index) =>
    Number.isInteger(answers[index]),
  );
  function submit(event: FormEvent) {
    event.preventDefault();
    if (complete) setResult(assessReadiness(answers));
  }
  return (
    <section
      id="assessment"
      className="assessment section-space"
      aria-labelledby="assessment-title"
    >
      <div className="section-intro">
        <p className="eyebrow orange">02 / Operator certification</p>
        <h2 id="assessment-title">
          Are you qualified
          <br />
          to do too much?
        </h2>
        <p>
          Three questions. Zero scientific validity. A credential your fictional
          procurement team will respect.
        </p>
        <div className="cert-stamp" aria-hidden="true">
          BURN READINESS
          <br />
          <b>
            NOT A REAL
            <br />
            QUALIFICATION
          </b>
          <br />
          DEPARTMENT OF MORE
        </div>
      </div>
      <div className="quiz-panel">
        {result ? (
          <div className="quiz-result">
            <p className="eyebrow orange">
              Assessment complete / {result.score} of 6
            </p>
            <h3 ref={resultRef} tabIndex={-1}>
              {result.rank}
            </h3>
            <p>{result.copy}</p>
            <p className="fine-print">
              For entertainment only. No account, email, or actual certification
              required.
            </p>
            <a className="primary-button" href="#protocols">
              Review the protocols <span aria-hidden="true">↗</span>
            </a>
            <button
              type="button"
              className="text-link"
              onClick={() => {
                returningToQuiz.current = true;
                setResult(null);
                setAnswers([]);
              }}
            >
              Demand a reassessment
            </button>
          </div>
        ) : (
          <form ref={formRef} onSubmit={submit}>
            {READINESS_QUESTIONS.map((question, index) => (
              <fieldset key={question.prompt}>
                <legend>
                  <span className="orange">0{index + 1}.</span>{" "}
                  {question.prompt}
                </legend>
                {question.options.map((option, optionIndex) => (
                  <label key={option} className="quiz-option">
                    <input
                      type="radio"
                      name={`question-${index}`}
                      value={optionIndex}
                      checked={answers[index] === optionIndex}
                      onChange={() =>
                        setAnswers((previous) => {
                          const next = [...previous];
                          next[index] = optionIndex;
                          return next;
                        })
                      }
                      required
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </fieldset>
            ))}
            <button
              className="primary-button"
              type="submit"
              disabled={!complete}
            >
              Issue my entirely fake credential{" "}
              <span aria-hidden="true">↗</span>
            </button>
          </form>
        )}
      </div>
    </section>
  );
}

export function FacilityExtras() {
  return (
    <>
      <ReadinessAssessment />
      <section className="section-space" aria-labelledby="comparison-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow orange">03 / Competitive landscape</p>
            <h2 id="comparison-title">
              A category of our own.
              <br />
              For legal reasons.
            </h2>
          </div>
          <p>
            All competitors below are fictional.
            <br />
            All inefficiencies are aspirational.
          </p>
        </div>
        <div
          className="comparison-scroll"
          tabIndex={0}
          role="region"
          aria-label="Fictional competitor comparison, scroll horizontally on small screens"
        >
          <table>
            <caption className="sr-only">
              Satirical comparison with fictional alternatives
            </caption>
            <thead>
              <tr>
                <th scope="col">Critical capability</th>
                <th scope="col">Just Answer It™</th>
                <th scope="col">Synergy Sludge™</th>
                <th scope="col" className="our-column">
                  TokenMaxxerPro
                </th>
              </tr>
            </thead>
            <tbody>
              {[
                [
                  "Finishes the task",
                  "Unfortunately",
                  "Eventually",
                  "Define ‘finishes’",
                ],
                [
                  "Review of the review",
                  "No",
                  "Available in Q7",
                  "Standard procedure",
                ],
                [
                  "Manufactured disagreement",
                  "None",
                  "Manual",
                  "A core competency",
                ],
                [
                  "Something you can download",
                  "A useful answer",
                  "A vision deck",
                  "An actual protocol PDF",
                ],
              ].map((row) => (
                <tr key={row[0]}>
                  {row.map((cell, index) =>
                    index === 0 ? (
                      <th scope="row" key={cell}>
                        {cell}
                      </th>
                    ) : (
                      <td
                        key={cell}
                        className={index === 3 ? "our-column" : undefined}
                      >
                        {cell}
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="section-space" aria-labelledby="testimonials-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow orange">
              04 / Entirely fabricated social proof
            </p>
            <h2 id="testimonials-title">The inefficiency is mutual.</h2>
          </div>
          <p>
            Fictional people. Fictional organizations.
            <br />
            Uncomfortably plausible feedback.
          </p>
        </div>
        <div className="testimonials">
          {[
            [
              "“We turned a two-line email into a 96-page alignment exercise. The email remains unsent.”",
              "Dr. Millicent Loop",
              "VP of Pre-Approval, Bureau of Later",
            ],
            [
              "“Finally, a product that treats my context window like a quarterly spending obligation.”",
              "Bramble Q. Ledger",
              "Chief Overhead Officer, Nothingworks",
            ],
            [
              "“The counter-audit discovered that the audit needed a counter-audit. We have never felt so seen.”",
              "Unit 7B",
              "Interim Chair, Committee of Committees",
            ],
          ].map(([quote, name, role], index) => (
            <figure key={name}>
              <span className="quote-number">FIELD REPORT / 00{index + 1}</span>
              <blockquote>{quote}</blockquote>
              <figcaption>
                <b>{name}</b>
                <span>{role}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>
      <section className="faq section-space" aria-labelledby="faq-title">
        <div>
          <p className="eyebrow orange">05 / Procedural clarification</p>
          <h2 id="faq-title">
            Before you escalate
            <br />
            to support.
          </h2>
        </div>
        <div>
          {[
            [
              "Wait. What am I actually buying?",
              "A personalized PDF of prompts and procedures. The free starter is free; Ascent is $10; Sovereign is $50. No subscription, hosted automation, compute, or model account is included.",
            ],
            [
              "Will this site actually burn my tokens?",
              "No. You download the PDF and decide whether to run its prompts in your own AI account. Any model usage and costs are yours. The counter above is a simulation, because even our telemetry is committed to the premise.",
            ],
            [
              "Are the burn targets guaranteed?",
              "No. Token estimates depend on the model, context limits, and how you run the protocol. They are targets, not a metered service or a promise of usage.",
            ],
            [
              "What are the unofficial terms of inefficiency?",
              "Clause 1: A committee may be formed to interpret this clause. Clause 2: That committee requires a subcommittee. Clause 3: These joke clauses add no purchase conditions. The actual delivery and pricing terms above apply.",
            ],
          ].map(([question, answer]) => (
            <details key={question}>
              <summary>
                {question}
                <span aria-hidden="true">+</span>
              </summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
