"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, runTransaction, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import { logActivity } from "@/lib/firebase/activity";
import AssetImage from "@/components/AssetImage";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Loader2,
  Trophy,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

type MediaValue = {
  type: "text" | "image";
  value: string;
};

type MCQ = {
  title?: string;
  question: MediaValue;
  options: {
    label: string;
    content: MediaValue;
  }[];
  correctOption: string;
  solution: MediaValue;
  explanation?: MediaValue;
};

type Package = {
  published?: boolean;

  quant: MCQ[];

  varc: {
    type: "RC" | "VA";
    title?: string;
    passage: MediaValue;
    questions: MCQ[];
  };

  dilr: {
    title?: string;
    set: MediaValue;
    questions: MCQ[];
  };
};

type Section = "quant" | "varc" | "dilr";

const todayIST = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
  }).format(new Date());

const sectionLabel = (s: Section) =>
  s === "quant"
    ? "Quantitative Aptitude"
    : s === "varc"
      ? "VARC"
      : "DILR";

const yesterdayIST = (date: string) => {
  const d = new Date(`${date}T12:00:00+05:30`);
  d.setDate(d.getDate() - 1);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
  }).format(d);
};


function Content({
  media,
  alt,
}: {
  media?: MediaValue;
  alt: string;
}) {
  if (!media?.value) return null;

  if (media.type === "image") {
    return (
      <AssetImage
        assetId={media.value}
        alt={alt}
      />
    );
  }

  return (
    <div className="whitespace-pre-wrap text-[15px] leading-relaxed text-foreground">
      {media.value}
    </div>
  );
}

function DailyQuestionContent() {
  /*
   * IMPORTANT: useSearchParams() is required here instead of reading
   * window.location.search once. Next.js client navigation between
   * /daily/question?section=quant and /daily/question?section=varc
   * keeps the same page component mounted, so a one-time window.location
   * read would leave the page stuck on Quant.
   */
  const searchParams = useSearchParams();

  const requestedSection =
    (searchParams.get("section") || "quant") as Section;

  const section: Section =
    requestedSection === "quant" ||
    requestedSection === "varc" ||
    requestedSection === "dilr"
      ? requestedSection
      : "quant";

  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [data, setData] = useState<Package | null>(null);
  const [attempt, setAttempt] = useState<any>(null);

  const [answers, setAnswers] = useState<
    Record<number, string>
  >({});

  const [seconds, setSeconds] = useState(15 * 60);

  const [started, setStarted] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);


  /*
   * Current question being displayed.
   *
   * Example:
   * 0 = Question 1
   * 1 = Question 2
   * 2 = Question 3
   */
  const [currentQuestion, setCurrentQuestion] =
    useState(0);

  const requestedDate = searchParams.get("date");
  const date = useMemo(
    () => /^\d{4}-\d{2}-\d{2}$/.test(requestedDate || "") ? requestedDate! : todayIST(),
    [requestedDate]
  );

  /*
   * When the user changes Daily Practice section from the Header,
   * reset all section-specific state before loading the new section.
   * This prevents Quant data/answers/results from flashing on VARC
   * or DILR during client-side navigation.
   */
  useEffect(() => {
    setData(null);
    setAttempt(null);
    setAnswers({});
    setSeconds(15 * 60);
    setStarted(false);
    setSubmitted(false);
    setSaving(false);
    setCurrentQuestion(0);
  }, [section, date]);

  /*
   * --------------------------------------------------
   * AUTH
   * --------------------------------------------------
   */

  useEffect(() => {
    setUser(auth.currentUser);
    setAuthLoading(false);
    return onAuthStateChanged(auth, (session) => {
      setUser(session);
      setAuthLoading(false);
    });
  }, []);

  /*
   * --------------------------------------------------
   * LOAD DAILY PACKAGE / ATTEMPT / STATS
   * --------------------------------------------------
   */

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    (async () => {
      try {
        const attemptId = `${date}_${section}_${user.uid}`;
        const [packageSnapshot, attemptSnapshot] = await Promise.all([
          getDoc(doc(db, "daily_packages", date)),
          getDoc(doc(db, "daily_attempts", attemptId)),
        ]);
        const packageRow = packageSnapshot.exists() ? packageSnapshot.data() : null;
        const savedAttempt = attemptSnapshot.exists() ? attemptSnapshot.data() : null;
        if (!cancelled && packageRow) {
          setData({ quant: packageRow.quant, varc: packageRow.varc, dilr: packageRow.dilr } as Package);
        }

        if (!cancelled && savedAttempt) {

          setAttempt(savedAttempt);

          /*
           * Restore the student's answers.
           */
          if (savedAttempt.answers) {
            const restoredAnswers: Record<
              number,
              string
            > = {};

            Object.entries(
              savedAttempt.answers
            ).forEach(([key, value]) => {
              restoredAnswers[Number(key)] =
                String(value);
            });

            setAnswers(restoredAnswers);
          }

          setSubmitted(true);

          /*
           * If the student has already submitted,
           * open Question 1 initially.
           */
          setCurrentQuestion(0);
        }

      } catch (error) {
        console.error(
          "Could not load daily practice:",
          error
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, date, section]);

  /*
   * --------------------------------------------------
   * QUESTIONS
   *
   * RC -> maximum 4
   * VA -> maximum 5
   * --------------------------------------------------
   */

  const questions = useMemo(() => {
    if (!data) return [];

    if (section === "quant") {
      return data.quant || [];
    }

    if (section === "varc") {
      if (data.varc.type === "RC") {
        return (data.varc.questions || []).slice(0, 4);
      }

      return (data.varc.questions || []).slice(0, 5);
    }

    return data.dilr.questions || [];
  }, [data, section]);

  /*
   * --------------------------------------------------
   * TITLE
   * --------------------------------------------------
   */

  const title = useMemo(() => {
    if (!data) {
      return sectionLabel(section);
    }

    if (section === "quant") {
      return "Quantitative Aptitude";
    }

    if (section === "varc") {
      return data.varc.type === "VA"
        ? "VA of the Day"
        : "RC of the Day";
    }

    return "DILR Set of the Day";
  }, [data, section]);

  /*
   * --------------------------------------------------
   * TIMER
   * --------------------------------------------------
   */

  useEffect(() => {
    if (!started || submitted) return;

    if (seconds <= 0) {
      submitAttempt(true);
      return;
    }

    const intervalId = window.setInterval(() => {
      setSeconds((current) =>
        Math.max(0, current - 1)
      );
    }, 1000);

    return () =>
      window.clearInterval(intervalId);

    // submitAttempt intentionally excluded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, submitted, seconds]);

  /*
   * --------------------------------------------------
   * SUBMIT
   *
   * Correct = +3
   * Wrong   = -1
   * Blank   = 0
   * --------------------------------------------------
   */

  async function submitAttempt(auto = false) {
    if (
      !user ||
      !data ||
      submitted ||
      saving ||
      questions.length === 0
    ) {
      return;
    }

    setSaving(true);

    const answeredIndexes =
      Object.keys(answers);

    const correct = questions.reduce(
      (sum, question, index) => {
        return (
          sum +
          (answers[index] ===
          question.correctOption
            ? 1
            : 0)
        );
      },
      0
    );

    const answeredCount =
      answeredIndexes.length;

    const wrong = Math.max(
      0,
      answeredCount - correct
    );

    const total = questions.length;

    /*
     * CAT marking:
     *
     * Correct = +3
     * Wrong = -1
     * Unanswered = 0
     */
    const score =
      correct * 3 - wrong;

    try {
      const attemptId = `${date}_${section}_${user.uid}`;
      const attemptRef = doc(db, "daily_attempts", attemptId);
      const leaderboardRef = doc(db, "daily_leaderboards", `${date}_${section}`, "entries", user.uid);
      const streakRef = doc(db, "user_streaks", user.uid);
      const statRef = doc(db, "daily_section_stats", `${date}_${section}`);
      const savedAttempt = await runTransaction(db, async (transaction) => {
        const [oldAttempt, oldStreak, oldStat] = await Promise.all([
          transaction.get(attemptRef), transaction.get(streakRef), transaction.get(statRef),
        ]);
        const attemptData = { userId: user.uid, date, section, score, correct, wrong, total, answers, timeTakenSeconds: 15 * 60 - seconds, timedOut: auto, updatedAt: serverTimestamp() };
        transaction.set(attemptRef, attemptData, { merge: true });
        transaction.set(leaderboardRef, { ...attemptData, displayName: user.displayName || "Student" }, { merge: true });
        if (!oldAttempt.exists()) {
          const prior = oldStreak.data();
          const yesterday = yesterdayIST(date);
          const currentStreak = prior?.lastActivityDate === yesterday ? Number(prior.currentStreak || 0) + 1 : 1;
          transaction.set(streakRef, { userId: user.uid, currentStreak, longestStreak: Math.max(currentStreak, Number(prior?.longestStreak || 0)), lastActivityDate: date, updatedAt: serverTimestamp() }, { merge: true });
          transaction.set(statRef, { date, section, count: Number(oldStat.data()?.count || 0) + 1, updatedAt: serverTimestamp() }, { merge: true });
        }
        return attemptData;
      });
      setAttempt(savedAttempt);

      setSubmitted(true);
      setStarted(false);
      void logActivity(user, "daily", `${sectionLabel(section)} · ${date}`);

      /*
       * After submitting, take the student to
       * Question 1 so they can review everything.
       */
      setCurrentQuestion(0);
    } catch (error) {
      console.error(
        "Could not save daily attempt:",
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : "Could not save your score. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  /*
   * --------------------------------------------------
   * NAVIGATION
   * --------------------------------------------------
   */

  function goToNextQuestion() {
    if (
      currentQuestion <
      questions.length - 1
    ) {
      setCurrentQuestion(
        (previous) =>
          previous + 1
      );

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }
  }

  function goToPreviousQuestion() {
    if (currentQuestion > 0) {
      setCurrentQuestion(
        (previous) =>
          previous - 1
      );

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }
  }

  /*
   * --------------------------------------------------
   * AUTH / LOADING
   * --------------------------------------------------
   */

  if (authLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="animate-spin text-brand" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="font-display text-2xl font-bold">
          Sign in to attempt today&apos;s
          practice
        </h1>

        <Link
          href="/login"
          className="mt-6 inline-flex rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white"
        >
          Continue with Google
        </Link>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="font-display text-2xl font-bold">
          Today&apos;s practice is being
          prepared.
        </h1>
      </div>
    );
  }

  /*
   * --------------------------------------------------
   * DISPLAY VALUES
   * --------------------------------------------------
   */

  const timeText =
    `${String(
      Math.floor(seconds / 60)
    ).padStart(2, "0")}:${String(
      seconds % 60
    ).padStart(2, "0")}`;

  const answered =
    Object.keys(answers).length;

  const question =
    questions[currentQuestion];

  const selected =
    answers[currentQuestion];

  const isQuestionCorrect =
    submitted &&
    selected ===
      question?.correctOption;

  const isQuestionWrong =
    submitted &&
    !!selected &&
    selected !==
      question?.correctOption;

  const finalScore =
    Number(attempt?.score || 0);

  const finalCorrect =
    Number(attempt?.correct || 0);

  const finalWrong =
    Number(attempt?.wrong || 0);

  const unanswered =
    Math.max(
      0,
      questions.length -
        finalCorrect -
        finalWrong
    );

  /*
   * --------------------------------------------------
   * PAGE
   * --------------------------------------------------
   */

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_160px] lg:gap-6">
      <div>
      {/* --------------------------------------------------
          HEADER
      -------------------------------------------------- */}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-dark">
            Daily Practice ·{" "}
            {new Date(
              `${date}T12:00:00`
            ).toLocaleDateString(
              "en-IN",
              {
                day: "numeric",
                month: "short",
                year: "numeric",
              }
            )}
          </p>

          <h1 className="mt-1 font-display text-2xl font-bold">
            {title}
          </h1>

          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            <span>
              {questions.length} questions
            </span>

            <span>·</span>

            <span>
              Question{" "}
              {currentQuestion + 1} of{" "}
              {questions.length}
            </span>

            <span>·</span>

            <span className="font-semibold text-brand-darker">
              +3 correct
            </span>

            <span>·</span>

            <span className="font-semibold text-danger">
              −1 wrong
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* SCORE AFTER SUBMISSION */}

          {submitted ? (
            <div className="rounded-xl border border-brand/30 bg-brand-tint px-4 py-2.5 text-center shadow-sm lg:hidden">
              <div className="flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-brand-darker">
                <Trophy size={12} />
                Score
              </div>

              <div className="mt-0.5 font-mono text-xl font-extrabold tabular-nums text-brand-dark">
                {finalScore}/
                {questions.length * 3}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-white px-4 py-2.5 text-center shadow-sm lg:hidden">
              <div className="flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted">
                <Clock3 size={12} />
                Time left
              </div>

              <div className="mt-0.5 font-mono text-xl font-extrabold tabular-nums text-brand-dark">
                {timeText}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* --------------------------------------------------
          READY SCREEN
          
          IMPORTANT:
          Passage / DILR set is NOT displayed here.
      -------------------------------------------------- */}

      {!started && !submitted && (
        <div className="mt-6 rounded-2xl border border-border bg-white p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-tint text-brand-darker">
            <Clock3 size={22} />
          </div>

          <h2 className="mt-3 font-display text-xl font-bold">
            Ready?
          </h2>

          <p className="mt-1 text-sm text-muted">
            You have{" "}
            <strong className="text-brand-darker">
              15 minutes
            </strong>{" "}
            for this section.
          </p>

          <p className="mt-3 text-xs font-semibold text-muted">
            Marking: +3 correct · −1 wrong ·
            0 unanswered
          </p>

          <p className="mt-2 text-xs text-muted">
            One question will appear at a
            time.
          </p>

          <button
            onClick={() => {
              setStarted(true);
              setCurrentQuestion(0);
            }}
            className="mt-5 rounded-full bg-brand px-6 py-3 text-sm font-bold text-white hover:bg-brand-dark"
          >
            Start {sectionLabel(section)} Test
          </button>
        </div>
      )}

      {/* --------------------------------------------------
          RUNNING MESSAGE
      -------------------------------------------------- */}

      {started && !submitted && (
        <div className="mt-5 rounded-xl border border-brand/20 bg-brand-tint px-4 py-3 text-sm font-semibold text-brand-darker">
          Timer is running. You can move between
          questions using Previous and Next.
        </div>
      )}

      {/* --------------------------------------------------
          SHARED RC PASSAGE
          
          This is shown:
          
          1. While attempting
          2. While viewing results
          
          It is NOT shown before Start.
          
          Therefore the passage stays visible while
          Question 1, Question 2, Question 3 and
          Question 4 are being viewed.
      -------------------------------------------------- */}

      {(started || submitted) &&
        section === "varc" &&
        data.varc.type === "RC" && (
          <div className="mt-6 rounded-2xl border border-brand/20 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-lg font-bold">
                {data.varc.title ||
                  "Reading Comprehension"}
              </h2>

              <span className="rounded-full bg-brand-tint px-3 py-1 text-[11px] font-bold text-brand-darker">
                Read for all questions
              </span>
            </div>

            <div className="mt-4 border-t border-border pt-4">
              <Content
                media={data.varc.passage}
                alt="RC passage"
              />
            </div>
          </div>
        )}

      {/* --------------------------------------------------
          SHARED DILR SET
          
          Like RC, it remains visible while navigating
          between all DILR questions.
      -------------------------------------------------- */}

      {(started || submitted) &&
        section === "dilr" && (
          <div className="mt-6 rounded-2xl border border-brand/20 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-lg font-bold">
                {data.dilr.title ||
                  "DILR Set"}
              </h2>

              <span className="rounded-full bg-brand-tint px-3 py-1 text-[11px] font-bold text-brand-darker">
                Set for all questions
              </span>
            </div>

            <div className="mt-4 border-t border-border pt-4">
              <Content
                media={data.dilr.set}
                alt="DILR set"
              />
            </div>
          </div>
        )}

      {/* --------------------------------------------------
          ONE QUESTION ONLY
      -------------------------------------------------- */}

      {(started || submitted) &&
        question && (
          <div className="mt-5">
            <div className="rounded-2xl border border-border bg-white p-5 sm:p-6">
              {/* QUESTION HEADER */}

              <div className="flex items-center justify-between gap-4">
                <div className="text-xs font-bold uppercase tracking-wide text-muted">
                  Question{" "}
                  {currentQuestion + 1} of{" "}
                  {questions.length}
                </div>

                {/* MARKING */}

                {!submitted ? (
                  <div className="flex items-center gap-2 text-[11px] font-bold">
                    <span className="rounded-full bg-brand-tint px-2.5 py-1 text-brand-darker">
                      +3
                    </span>

                    <span className="rounded-full bg-red-50 px-2.5 py-1 text-danger">
                      −1
                    </span>
                  </div>
                ) : (
                  <div
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      isQuestionCorrect
                        ? "bg-brand-tint text-brand-darker"
                        : isQuestionWrong
                          ? "bg-red-50 text-danger"
                          : "bg-surface-muted text-muted"
                    }`}
                  >
                    {isQuestionCorrect
                      ? "+3"
                      : isQuestionWrong
                        ? "−1"
                        : "0"}
                  </div>
                )}
              </div>

              {/* QUESTION TITLE */}

              {question.title && (
                <h3 className="mt-2 font-display text-lg font-bold">
                  {question.title}
                </h3>
              )}

              {/* QUESTION */}

              <div className="mt-5">
                <Content
                  media={question.question}
                  alt={`Question ${
                    currentQuestion + 1
                  }`}
                />
              </div>

              {/* OPTIONS */}

              <div className="mt-7 grid gap-2.5">
                {question.options.map(
                  (option) => {
                    const optionIsCorrect =
                      submitted &&
                      option.label ===
                        question.correctOption;

                    const optionIsWrong =
                      submitted &&
                      selected ===
                        option.label &&
                      option.label !==
                        question.correctOption;

                    const optionIsSelected =
                      selected ===
                      option.label;

                    return (
                      <button
                        key={
                          option.label
                        }
                        disabled={
                          !started ||
                          submitted
                        }
                        onClick={() =>
                          setAnswers(
                            (previous) => ({
                              ...previous,
                              [currentQuestion]:
                                option.label,
                            })
                          )
                        }
                        className={`rounded-xl border px-4 py-3 text-left transition ${
                          optionIsCorrect
                            ? "border-brand bg-brand-tint"
                            : optionIsWrong
                              ? "border-danger/40 bg-red-50"
                              : optionIsSelected
                                ? "border-brand bg-brand-tint"
                                : "border-border hover:border-brand/50"
                        }`}
                      >
                        <div className="flex gap-3">
                          <span className="mt-0.5 shrink-0 font-semibold">
                            {option.label}.
                          </span>

                          <div className="min-w-0 flex-1">
                            <Content
                              media={
                                option.content
                              }
                              alt={`Option ${option.label}`}
                            />
                          </div>

                          {optionIsCorrect && (
                            <CheckCircle2
                              className="mt-0.5 shrink-0 text-brand"
                              size={18}
                            />
                          )}
                        </div>
                      </button>
                    );
                  }
                )}
              </div>

              {/* RESULT / SOLUTION */}

              {submitted && (
                <div className="mt-7 rounded-2xl bg-surface-muted p-5">
                  <p
                    className={`text-sm font-bold ${
                      isQuestionCorrect
                        ? "text-brand-darker"
                        : isQuestionWrong
                          ? "text-danger"
                          : "text-muted"
                    }`}
                  >
                    {isQuestionCorrect
                      ? "Correct! +3 marks"
                      : isQuestionWrong
                        ? `Incorrect — ${question.correctOption} was the correct answer. −1 mark`
                        : `Not attempted — correct answer: ${question.correctOption}`}
                  </p>

                  {question.solution
                    ?.value && (
                    <div className="mt-5">
                      <p className="mb-2 text-xs font-semibold">
                        Solution
                      </p>

                      <Content
                        media={
                          question.solution
                        }
                        alt="Solution"
                      />
                    </div>
                  )}

                  {question.explanation
                    ?.value && (
                    <div className="mt-5 border-t border-border pt-4">
                      <p className="mb-2 text-xs font-semibold">
                        Explanation
                      </p>

                      <Content
                        media={
                          question.explanation
                        }
                        alt="Explanation"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* --------------------------------------------------
                NAVIGATION
            -------------------------------------------------- */}

            <div className="mt-5 flex items-center justify-between gap-3">
              {/* PREVIOUS */}

              <button
                onClick={
                  goToPreviousQuestion
                }
                disabled={
                  currentQuestion === 0
                }
                className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-5 py-2.5 text-sm font-semibold text-foreground transition hover:border-brand hover:text-brand-darker disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ArrowLeft size={16} />
                Previous
              </button>

              {/* QUESTION PROGRESS */}

              <div className="hidden items-center gap-1.5 sm:flex">
                {questions.map(
                  (_, index) => {
                    const hasAnswer =
                      !!answers[index];

                    const isCurrent =
                      index ===
                      currentQuestion;

                    return (
                      <button
                        key={index}
                        onClick={() =>
                          setCurrentQuestion(
                            index
                          )
                        }
                        className={`h-8 w-8 rounded-full text-xs font-bold transition ${
                          isCurrent
                            ? "bg-brand text-white"
                            : hasAnswer
                              ? "bg-brand-tint text-brand-darker"
                              : "border border-border bg-white text-muted hover:border-brand"
                        }`}
                      >
                        {index + 1}
                      </button>
                    );
                  }
                )}
              </div>

              {/* NEXT / SUBMIT */}

              {currentQuestion <
              questions.length - 1 ? (
                <button
                  onClick={
                    goToNextQuestion
                  }
                  className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-dark"
                >
                  Next Question
                  <ArrowRight size={16} />
                </button>
              ) : submitted ? (
                <Link
                  href="/daily"
                  className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-dark"
                >
                  Back to Daily
                  <ArrowRight size={16} />
                </Link>
              ) : (
                <button
                  disabled={saving}
                  onClick={() =>
                    submitAttempt(false)
                  }
                  className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                >
                  {saving
                    ? "Saving…"
                    : "Submit Section"}
                  {!saving && (
                    <CheckCircle2
                      size={16}
                    />
                  )}
                </button>
              )}
            </div>

            {/* MOBILE PROGRESS */}

            <div className="mt-4 text-center text-xs text-muted sm:hidden">
              Question{" "}
              {currentQuestion + 1} of{" "}
              {questions.length}
            </div>
          </div>
        )}

      {/* --------------------------------------------------
          SUBMITTED SUMMARY
          
          No giant score block below all questions.
          Score remains in the header.
      -------------------------------------------------- */}

      {submitted && (
        <div className="mt-6 rounded-2xl border border-brand/30 bg-brand-tint p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-brand-darker">
                Section complete
              </p>

              <p className="mt-1 text-sm text-muted">
                {finalCorrect} correct ·{" "}
                {finalWrong} wrong ·{" "}
                {unanswered} unanswered
              </p>
            </div>

            <div className="text-right">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                Your Score
              </p>

              <p className="font-display text-2xl font-bold text-brand-darker">
                {finalScore}/
                {questions.length * 3}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/daily"
              className="inline-flex rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-white"
            >
              Back to Daily Practice
            </Link>

            <Link
              href="/"
              className="inline-flex rounded-full border border-border bg-white px-5 py-2.5 text-sm font-bold text-foreground"
            >
              View Live Rankings
            </Link>
          </div>
        </div>
      )}
      </div>

      <aside className="hidden lg:sticky lg:top-20 lg:block lg:self-start">
        <div className="rounded-2xl border border-border bg-white p-4 text-center shadow-sm">
          {submitted ? <><p className="text-[10px] font-bold uppercase tracking-wider text-brand-darker"><Trophy className="mx-auto mb-1" size={14} />Score</p><p className="font-mono text-2xl font-extrabold tabular-nums text-brand-dark">{finalScore}/{questions.length * 3}</p></> : <><p className="text-[10px] font-bold uppercase tracking-wider text-muted"><Clock3 className="mx-auto mb-1" size={14} />Time left</p><p className="font-mono text-2xl font-extrabold tabular-nums text-brand-dark">{timeText}</p><p className="mt-2 text-xs text-muted">{currentQuestion + 1} of {questions.length}</p></>}
        </div>
      </aside>
      </div>
    </div>
  );
}

/*
 * useSearchParams() requires a Suspense boundary in Next.js when this
 * route is statically rendered. Keeping the boundary here also makes
 * query-string navigation reliable in production builds.
 */
export default function DailyQuestionPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="animate-spin text-brand" />
        </div>
      }
    >
      <DailyQuestionContent />
    </Suspense>
  );
}
