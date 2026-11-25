import { getSupabase } from "./supabase";
import { reviewWord } from "./api";
import { isDue } from "./format";
import { deriveWordLearningStatus, type FsrsRating, type FsrsScheduleResult } from "./fsrs";
import type { Word } from "./schemas";
import type { ExerciseType } from "./learn-api";

export type LearningStage = 1 | 2 | 3 | 4;
export type SessionType = "initial_learning" | "spaced_repetition";
export type SessionStatus = "in_progress" | "completed";

export type WordStagePayload = {
  definition?: string;
  pronunciation?: string;
  partOfSpeech?: string;
  userSentence?: string;
  usedVideo?: boolean;
  stageAttempts?: number;
};

export type WordStageProgress = {
  wordId: string;
  currentStage: LearningStage;
  completedStages: LearningStage[];
  attempts: number;
  answers: Partial<Record<1 | 2 | 3, { answer: string; passed: boolean; completedAt: string }>>;
  definition: string;
  pronunciation: string;
  partOfSpeech: string;
  userSentence: string;
  completed: boolean;
};

export type LearningSessionState = {
  sessionId: string;
  userId: string;
  sessionType: SessionType;
  langFilter: string;
  wordIds: string[];
  completedWordIds: string[];
  currentWordIndex: number;
  currentWordId: string | null;
  currentStage: LearningStage;
  wordProgress: Record<string, WordStageProgress>;
  status: SessionStatus;
  xpEarned: number;
  resumed: boolean;
  createdAt: string;
  updatedAt: string;
};

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const STORAGE_PREFIX = "wordtap_learn_session_v2";
const WORD_PROGRESS_PREFIX = "wordtap_word_progress_v2";

function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `sess-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getDefaultStore(): KeyValueStore | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  return window.localStorage;
}

export function sessionStorageKey(
  userId: string,
  sessionType: SessionType,
  langFilter: string,
): string {
  return `${STORAGE_PREFIX}:${userId}:${sessionType}:${langFilter}`;
}

export function wordProgressStorageKey(userId: string): string {
  return `${WORD_PROGRESS_PREFIX}:${userId}`;
}

/**
 * Determines whether a word has already completed its Initial Learning sequence (Stages 1, 2, 3, and 4).
 * Uses explicit `initial_learning_completed` flag first, falling back cleanly for legacy rows.
 */
export function isInitialLearningCompleted(
  word: Word,
  localProgress?: WordStageProgress,
): boolean {
  if (localProgress?.completed) return true;
  if (word.initial_learning_completed === true) return true;
  if (word.initial_learning_completed === false) return false;
  const completedStages = word.completed_stages || [];
  if (completedStages.includes(1) && completedStages.includes(2) && completedStages.includes(3) && completedStages.includes(4)) {
    return true;
  }
  const status = deriveWordLearningStatus(word);
  return status === "review" || status === "mastered";
}

/**
 * Computes the next strictly sequential stage (1..4) for a word from its monotonically completed stages.
 * Never skips a stage and never drops back below an already-completed stage.
 */
export function computeNextSequentialStage(completedStages: number[]): LearningStage {
  const set = new Set(completedStages);
  if (!set.has(1)) return 1;
  if (!set.has(2)) return 2;
  if (!set.has(3)) return 3;
  return 4;
}

function normalizeCompletedStages(stages: number[] | null | undefined): LearningStage[] {
  const valid = new Set<LearningStage>();
  for (const s of stages || []) {
    if (s === 1 || s === 2 || s === 3 || s === 4) valid.add(s);
  }
  return ([1, 2, 3, 4] as LearningStage[]).filter((s) => valid.has(s));
}

function readLocalWordProgressMap(
  userId: string,
  store: KeyValueStore | null,
): Record<string, WordStageProgress> {
  if (!store) return {};
  try {
    const raw = store.getItem(wordProgressStorageKey(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, WordStageProgress>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeLocalWordProgressMap(
  userId: string,
  map: Record<string, WordStageProgress>,
  store: KeyValueStore | null,
): void {
  if (!store) return;
  try {
    store.setItem(wordProgressStorageKey(userId), JSON.stringify(map));
  } catch {
    // ignore quota errors
  }
}

function saveLocalSession(session: LearningSessionState, store: KeyValueStore | null): void {
  if (!store) return;
  try {
    const key = sessionStorageKey(session.userId, session.sessionType, session.langFilter);
    store.setItem(key, JSON.stringify(session));

    // Also mirror individual word progress for cross-session continuity
    const wordMap = readLocalWordProgressMap(session.userId, store);
    for (const [wid, prog] of Object.entries(session.wordProgress)) {
      const existing = wordMap[wid];
      const mergedStages = normalizeCompletedStages([
        ...(existing?.completedStages || []),
        ...prog.completedStages,
      ]);
      const completed = Boolean(existing?.completed || prog.completed);
      wordMap[wid] = {
        ...existing,
        ...prog,
        completedStages: mergedStages,
        currentStage: completed ? 4 : computeNextSequentialStage(mergedStages),
        completed,
      };
    }
    writeLocalWordProgressMap(session.userId, wordMap, store);
  } catch {
    // ignore storage errors
  }
}

function loadLocalSession(
  userId: string,
  sessionType: SessionType,
  langFilter: string,
  store: KeyValueStore | null,
): LearningSessionState | null {
  if (!store) return null;
  try {
    const raw = store.getItem(sessionStorageKey(userId, sessionType, langFilter));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LearningSessionState;
    if (!parsed || parsed.userId !== userId || parsed.sessionType !== sessionType) return null;
    return parsed;
  } catch {
    return null;
  }
}

function buildInitialWordProgress(
  word: Word,
  saved?: WordStageProgress,
): WordStageProgress {
  const mergedStages = normalizeCompletedStages([
    ...(word.completed_stages || []),
    ...(saved?.completedStages || []),
  ]);
  const completed = isInitialLearningCompleted(word, saved);
  const nextStage = completed ? 4 : computeNextSequentialStage(mergedStages);

  const stageAnswers = (word.stage_answers || {}) as Record<
    string,
    { answer?: string; passed?: boolean; completedAt?: string; definition?: string; userSentence?: string }
  >;

  return {
    wordId: word.id,
    currentStage: nextStage,
    completedStages: mergedStages,
    attempts: Math.max(word.attempts_count || 0, saved?.attempts || 0),
    answers: {
      ...(stageAnswers.stage_1?.answer
        ? {
            1: {
              answer: stageAnswers.stage_1.answer,
              passed: Boolean(stageAnswers.stage_1.passed),
              completedAt: stageAnswers.stage_1.completedAt || "",
            },
          }
        : {}),
      ...(stageAnswers.stage_2?.answer
        ? {
            2: {
              answer: stageAnswers.stage_2.answer,
              passed: Boolean(stageAnswers.stage_2.passed),
              completedAt: stageAnswers.stage_2.completedAt || "",
            },
          }
        : {}),
      ...(stageAnswers.stage_3?.answer
        ? {
            3: {
              answer: stageAnswers.stage_3.answer,
              passed: Boolean(stageAnswers.stage_3.passed),
              completedAt: stageAnswers.stage_3.completedAt || "",
            },
          }
        : {}),
      ...(saved?.answers || {}),
    },
    definition: saved?.definition || word.definition || "",
    pronunciation: saved?.pronunciation || word.pronunciation || "",
    partOfSpeech: saved?.partOfSpeech || word.part_of_speech || "",
    userSentence: saved?.userSentence || stageAnswers.stage_3?.answer || "",
    completed,
  };
}

/**
 * PURE DETERMINISTIC STATE MACHINE:
 * Creates or resumes an Initial Learning Session.
 *
 * Guarantees:
 * - Strictly separates Initial Learning from Spaced Repetition.
 * - Never includes words that already completed Initial Learning (unless explicitly focused via focusWordId).
 * - Orders words deterministically (created_at ASC, id ASC) — zero randomization.
 * - Every new word ALWAYS starts at Stage 1.
 * - Incomplete words resume at their exact saved stage (never jumping or skipping).
 * - Restores the exact in-progress session on refresh / close & reopen.
 */
export function createOrResumeInitialLearningSession(params: {
  userId: string;
  words: Word[];
  langFilter?: string;
  limit?: number;
  focusWordId?: string | null;
  store?: KeyValueStore | null;
  remoteActiveSession?: Partial<LearningSessionState> | null;
}): LearningSessionState {
  const {
    userId,
    words,
    langFilter = "all",
    limit = 10,
    focusWordId = null,
    remoteActiveSession = null,
  } = params;
  const store = params.store === undefined ? getDefaultStore() : params.store;
  const wordsById = new Map(words.map((w) => [w.id, w]));
  const localWordMap = readLocalWordProgressMap(userId, store);

  // Focus mode for a single explicitly chosen word (from /words -> "Learn")
  if (focusWordId) {
    const target = wordsById.get(focusWordId);
    const nowIso = new Date().toISOString();
    if (!target) {
      return {
        sessionId: generateId(),
        userId,
        sessionType: "initial_learning",
        langFilter: `word:${focusWordId}`,
        wordIds: [],
        completedWordIds: [],
        currentWordIndex: 0,
        currentWordId: null,
        currentStage: 1,
        wordProgress: {},
        status: "completed",
        xpEarned: 0,
        resumed: false,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
    }

    const focusKey = `word:${focusWordId}`;
    const existingFocus = loadLocalSession(userId, "initial_learning", focusKey, store);
    if (
      existingFocus &&
      existingFocus.status === "in_progress" &&
      existingFocus.currentWordId === focusWordId
    ) {
      const prog = existingFocus.wordProgress[focusWordId] || buildInitialWordProgress(target, localWordMap[focusWordId]);
      const stage = computeNextSequentialStage(prog.completedStages);
      return {
        ...existingFocus,
        currentStage: stage,
        wordProgress: { ...existingFocus.wordProgress, [focusWordId]: { ...prog, currentStage: stage } },
        resumed: true,
      };
    }

    // Starting fresh focus learning on this word: strictly starts at Stage 1
    const freshProg: WordStageProgress = {
      wordId: target.id,
      currentStage: 1,
      completedStages: [],
      attempts: target.attempts_count || 0,
      answers: {},
      definition: target.definition || "",
      pronunciation: target.pronunciation || "",
      partOfSpeech: target.part_of_speech || "",
      userSentence: "",
      completed: false,
    };

    const focusSession: LearningSessionState = {
      sessionId: generateId(),
      userId,
      sessionType: "initial_learning",
      langFilter: focusKey,
      wordIds: [target.id],
      completedWordIds: [],
      currentWordIndex: 0,
      currentWordId: target.id,
      currentStage: 1,
      wordProgress: { [target.id]: freshProg },
      status: "in_progress",
      xpEarned: 0,
      resumed: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    saveLocalSession(focusSession, store);
    return focusSession;
  }

  // 1. Try restoring an existing in-progress Initial Learning session (prefer newest of remote vs local)
  const localSess = loadLocalSession(userId, "initial_learning", langFilter, store);
  const candidate =
    remoteActiveSession &&
    remoteActiveSession.status === "in_progress" &&
    Array.isArray(remoteActiveSession.wordIds) &&
    remoteActiveSession.wordIds.length > 0
      ? (!localSess ||
          localSess.status !== "in_progress" ||
          (remoteActiveSession.updatedAt || "") >= (localSess.updatedAt || "")
        ? remoteActiveSession
        : localSess)
      : localSess;

  if (
    candidate &&
    candidate.status === "in_progress" &&
    Array.isArray(candidate.wordIds) &&
    candidate.wordIds.length > 0
  ) {
    // Filter to words that still exist in the user's vocabulary while preserving exact order
    const validWordIds = candidate.wordIds.filter((id) => wordsById.has(id));
    if (validWordIds.length > 0) {
      const progressMap: Record<string, WordStageProgress> = {};
      const completedSet = new Set<string>(candidate.completedWordIds || []);

      for (const wid of validWordIds) {
        const w = wordsById.get(wid)!;
        const savedProg = candidate.wordProgress?.[wid] || localWordMap[wid];
        const prog = buildInitialWordProgress(w, savedProg);
        if (completedSet.has(wid) || prog.completed) {
          prog.completed = true;
          completedSet.add(wid);
        }
        progressMap[wid] = prog;
      }

      // Find the first uncompleted word strictly in session order (never skip, never restart completed)
      const nextIndex = validWordIds.findIndex((id) => !completedSet.has(id));
      if (nextIndex !== -1) {
        const activeWordId = validWordIds[nextIndex]!;
        const activeProg = progressMap[activeWordId]!;
        const restoredStage = computeNextSequentialStage(activeProg.completedStages);
        activeProg.currentStage = restoredStage;

        const restored: LearningSessionState = {
          sessionId: candidate.sessionId || generateId(),
          userId,
          sessionType: "initial_learning",
          langFilter,
          wordIds: validWordIds,
          completedWordIds: validWordIds.filter((id) => completedSet.has(id)),
          currentWordIndex: nextIndex,
          currentWordId: activeWordId,
          currentStage: restoredStage,
          wordProgress: progressMap,
          status: "in_progress",
          xpEarned: candidate.xpEarned || 0,
          resumed: true,
          createdAt: candidate.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        saveLocalSession(restored, store);
        return restored;
      }
    }
  }

  // 2. No active in-progress session: deterministically create a new sequential Initial Learning session
  //    ONLY from uncompleted words (created_at ASC, id ASC — zero randomness!)
  const uncompletedWords = [...words]
    .filter((w) => !isInitialLearningCompleted(w, localWordMap[w.id]))
    .sort((a, b) => {
      const tDiff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (tDiff !== 0) return tDiff;
      return a.id.localeCompare(b.id);
    })
    .slice(0, Math.max(1, limit));

  const nowIso = new Date().toISOString();

  if (uncompletedWords.length === 0) {
    return {
      sessionId: generateId(),
      userId,
      sessionType: "initial_learning",
      langFilter,
      wordIds: [],
      completedWordIds: [],
      currentWordIndex: 0,
      currentWordId: null,
      currentStage: 1,
      wordProgress: {},
      status: "completed",
      xpEarned: 0,
      resumed: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
  }

  const wordIds = uncompletedWords.map((w) => w.id);
  const progressMap: Record<string, WordStageProgress> = {};
  for (const w of uncompletedWords) {
    progressMap[w.id] = buildInitialWordProgress(w, localWordMap[w.id]);
  }

  const firstWordId = wordIds[0]!;
  const firstStage = computeNextSequentialStage(progressMap[firstWordId]!.completedStages);
  progressMap[firstWordId]!.currentStage = firstStage;

  const created: LearningSessionState = {
    sessionId: generateId(),
    userId,
    sessionType: "initial_learning",
    langFilter,
    wordIds,
    completedWordIds: [],
    currentWordIndex: 0,
    currentWordId: firstWordId,
    currentStage: firstStage,
    wordProgress: progressMap,
    status: "in_progress",
    xpEarned: 0,
    resumed: firstStage > 1,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  saveLocalSession(created, store);
  return created;
}

/**
 * STRICT DETERMINISTIC TRANSITION:
 * Advances the active word strictly from Stage 1 -> 2, 2 -> 3, or 3 -> 4.
 * Rejects any attempt to skip stages or advance a non-current word.
 */
export function transitionAdvanceStage(
  session: LearningSessionState,
  params: {
    wordId: string;
    completedStage: 1 | 2 | 3;
    answer: string;
    passed: boolean;
    payload?: WordStagePayload;
    xpDelta?: number;
  },
  store: KeyValueStore | null = getDefaultStore(),
): LearningSessionState {
  if (session.status !== "in_progress") {
    throw new Error("Cannot advance stage on a completed session.");
  }
  if (session.currentWordId !== params.wordId) {
    throw new Error(
      `Strict sequence violation: active word is ${session.currentWordId}, cannot advance ${params.wordId}.`,
    );
  }
  if (session.currentStage !== params.completedStage) {
    throw new Error(
      `Strict sequence violation: expected stage ${session.currentStage}, received stage ${params.completedStage}.`,
    );
  }

  const prevProg = session.wordProgress[params.wordId] || {
    wordId: params.wordId,
    currentStage: params.completedStage,
    completedStages: [],
    attempts: 0,
    answers: {},
    definition: "",
    pronunciation: "",
    partOfSpeech: "",
    userSentence: "",
    completed: false,
  };

  const nextStage = (params.completedStage + 1) as LearningStage;
  const mergedStages = normalizeCompletedStages([
    ...prevProg.completedStages,
    params.completedStage,
  ]);
  const nowIso = new Date().toISOString();

  const updatedProg: WordStageProgress = {
    ...prevProg,
    currentStage: nextStage,
    completedStages: mergedStages,
    attempts: prevProg.attempts + Math.max(1, params.payload?.stageAttempts ?? 1),
    answers: {
      ...prevProg.answers,
      [params.completedStage]: {
        answer: params.answer,
        passed: params.passed,
        completedAt: nowIso,
      },
    },
    definition: params.payload?.definition || prevProg.definition,
    pronunciation: params.payload?.pronunciation || prevProg.pronunciation,
    partOfSpeech: params.payload?.partOfSpeech || prevProg.partOfSpeech,
    userSentence: params.payload?.userSentence || prevProg.userSentence,
  };

  const nextSession: LearningSessionState = {
    ...session,
    currentStage: nextStage,
    wordProgress: {
      ...session.wordProgress,
      [params.wordId]: updatedProg,
    },
    xpEarned: session.xpEarned + Math.max(0, params.xpDelta || 0),
    resumed: false,
    updatedAt: nowIso,
  };

  saveLocalSession(nextSession, store);
  return nextSession;
}

/**
 * STRICT DETERMINISTIC TRANSITION:
 * Completes the current word at Stage 4 (after verifying Stages 1, 2, AND 3 were ALL completed)
 * and transitions directly to the next uncompleted word at Stage 1 (or completes the session).
 */
export function transitionCompleteWord(
  session: LearningSessionState,
  params: {
    wordId: string;
    xpDelta?: number;
    markEasy?: boolean;
  },
  store: KeyValueStore | null = getDefaultStore(),
): LearningSessionState {
  if (session.status !== "in_progress") {
    throw new Error("Cannot complete word on an already completed session.");
  }
  if (session.currentWordId !== params.wordId) {
    throw new Error(
      `Strict sequence violation: active word is ${session.currentWordId}, cannot complete ${params.wordId}.`,
    );
  }
  if (!params.markEasy && session.currentStage !== 4) {
    throw new Error(
      `Strict sequence violation: word must reach Stage 4 before completion (currently Stage ${session.currentStage}).`,
    );
  }

  const prevProg = session.wordProgress[params.wordId] || {
    wordId: params.wordId,
    currentStage: 1 as LearningStage,
    completedStages: [],
    attempts: 0,
    answers: {},
    definition: "",
    pronunciation: "",
    partOfSpeech: "",
    userSentence: "",
    completed: false,
  };
  const hasAllRequired =
    params.markEasy ||
    (prevProg.completedStages.includes(1) &&
      prevProg.completedStages.includes(2) &&
      prevProg.completedStages.includes(3));

  if (!hasAllRequired) {
    throw new Error(
      "Cannot mark word as completed without validating Stages 1, 2, and 3.",
    );
  }

  const nowIso = new Date().toISOString();
  const completedStages = normalizeCompletedStages(
    params.markEasy ? [1, 2, 3, 4] : [...prevProg.completedStages, 4],
  );
  const updatedProg: WordStageProgress = {
    ...prevProg,
    currentStage: 4,
    completedStages,
    completed: true,
  };

  const completedWordIds = session.completedWordIds.includes(params.wordId)
    ? session.completedWordIds
    : [...session.completedWordIds, params.wordId];
  const completedSet = new Set(completedWordIds);

  // Locate next uncompleted word strictly in session.wordIds order
  const nextIndex = session.wordIds.findIndex((id) => !completedSet.has(id));
  const nextWordId = nextIndex !== -1 ? session.wordIds[nextIndex]! : null;
  const nextWordProgress = {
    ...session.wordProgress,
    [params.wordId]: updatedProg,
  };

  let nextStage: LearningStage = 1;
  if (nextWordId) {
    const np = nextWordProgress[nextWordId];
    nextStage = np ? computeNextSequentialStage(np.completedStages) : 1;
    if (np) {
      nextWordProgress[nextWordId] = { ...np, currentStage: nextStage };
    }
  }

  const nextSession: LearningSessionState = {
    ...session,
    completedWordIds,
    currentWordIndex: nextIndex !== -1 ? nextIndex : session.wordIds.length,
    currentWordId: nextWordId,
    currentStage: nextStage,
    wordProgress: nextWordProgress,
    status: nextWordId === null ? "completed" : "in_progress",
    xpEarned: session.xpEarned + Math.max(0, params.xpDelta || 0),
    resumed: false,
    updatedAt: nowIso,
  };

  saveLocalSession(nextSession, store);
  return nextSession;
}

/**
 * Removes a deleted word from the active learning session and advances cleanly
 * to the next remaining uncompleted word (or completes the session if none remain).
 */
export function transitionRemoveWord(
  session: LearningSessionState,
  wordId: string,
  store: KeyValueStore | null = getDefaultStore(),
): LearningSessionState {
  const nextWordIds = session.wordIds.filter((id) => id !== wordId);
  const nextCompletedIds = session.completedWordIds.filter((id) => id !== wordId);
  const completedSet = new Set(nextCompletedIds);

  const nextWordProgress: Record<string, WordStageProgress> = {};
  for (const [id, prog] of Object.entries(session.wordProgress)) {
    if (id !== wordId) nextWordProgress[id] = prog;
  }

  const nextIndex = nextWordIds.findIndex((id) => !completedSet.has(id));
  const nextWordId = nextIndex !== -1 ? nextWordIds[nextIndex]! : null;
  let nextStage: LearningStage = 1;
  if (nextWordId) {
    const np = nextWordProgress[nextWordId];
    nextStage = np ? computeNextSequentialStage(np.completedStages) : 1;
    if (np) {
      nextWordProgress[nextWordId] = { ...np, currentStage: nextStage };
    }
  }

  const nextSession: LearningSessionState = {
    ...session,
    wordIds: nextWordIds,
    completedWordIds: nextCompletedIds,
    currentWordIndex: nextIndex !== -1 ? nextIndex : nextWordIds.length,
    currentWordId: nextWordId,
    currentStage: nextWordId ? nextStage : 4,
    wordProgress: nextWordProgress,
    status: nextWordId ? "in_progress" : "completed",
    resumed: false,
    updatedAt: new Date().toISOString(),
  };

  saveLocalSession(nextSession, store);
  return nextSession;
}

/**
 * SEPARATE SPACED REPETITION SESSION BUILDER:
 * Strictly independent from Initial Learning!
 * - Only includes words that have ALREADY completed initial learning.
 * - Deterministically ordered by next_review ASC, id ASC (most overdue first).
 * - Never modifies initial_learning_completed, current_stage, or completed_stages.
 */
export type SpacedReviewQueueItem = {
  word: Word;
  reviewExerciseStage: 1 | 2 | 3;
};

export function buildSpacedRepetitionQueue(
  words: Word[],
  options: {
    userId: string;
    limit?: number;
    missedOnly?: boolean;
    now?: Date;
    store?: KeyValueStore | null;
  },
): SpacedReviewQueueItem[] {
  const now = options.now ?? new Date();
  const limit = Math.max(1, options.limit ?? 20);
  const store = options.store === undefined ? getDefaultStore() : options.store;
  const localMap = readLocalWordProgressMap(options.userId, store);

  const eligible = words.filter((w) => isInitialLearningCompleted(w, localMap[w.id]));
  const due = eligible.filter((w) => isDue(w.next_review, now));
  const pool = options.missedOnly
    ? eligible.filter((w) => (w.wrong_count || 0) > 0)
    : due.length > 0
    ? due
    : eligible;

  const sorted = [...pool].sort((a, b) => {
    if (options.missedOnly) {
      const diff = (b.wrong_count || 0) - (a.wrong_count || 0);
      if (diff !== 0) return diff;
    }
    const tDiff = new Date(a.next_review).getTime() - new Date(b.next_review).getTime();
    if (tDiff !== 0) return tDiff;
    return a.id.localeCompare(b.id);
  });

  // Deterministic review exercise rotation (cycles Stage 2 -> Stage 3 -> Stage 1 across reviews)
  // without ever touching the word's initial learning progression.
  const reviewCycle: Array<1 | 2 | 3> = [2, 3, 1];
  return sorted.slice(0, limit).map((word) => {
    const repCount = Math.max(0, (word.fsrs_reps || 0) + (word.correct_count || 0));
    const reviewExerciseStage = reviewCycle[repCount % reviewCycle.length]!;
    return { word, reviewExerciseStage };
  });
}

// ---------------------------------------------------------------------------
// Supabase Remote Persistence Helpers (with graceful fallback before migration 011)
// ---------------------------------------------------------------------------

export async function fetchActiveRemoteLearningSession(
  userId: string,
  langFilter = "all",
): Promise<Partial<LearningSessionState> | null> {
  if (!userId || userId === "demo") return null;
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("learning_sessions")
      .select(
        "id,user_id,session_type,lang_filter,word_ids,completed_word_ids,current_word_index,current_word_id,current_stage,status,xp_earned,created_at,updated_at",
      )
      .eq("user_id", userId)
      .eq("session_type", "initial_learning")
      .eq("lang_filter", langFilter)
      .eq("status", "in_progress")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    return {
      sessionId: String(data.id),
      userId: String(data.user_id),
      sessionType: "initial_learning",
      langFilter: String(data.lang_filter),
      wordIds: Array.isArray(data.word_ids) ? data.word_ids.map(String) : [],
      completedWordIds: Array.isArray(data.completed_word_ids)
        ? data.completed_word_ids.map(String)
        : [],
      currentWordIndex: Number(data.current_word_index || 0),
      currentWordId: data.current_word_id ? String(data.current_word_id) : null,
      currentStage: (Number(data.current_stage) || 1) as LearningStage,
      status: data.status === "completed" ? "completed" : "in_progress",
      xpEarned: Number(data.xp_earned || 0),
      createdAt: String(data.created_at),
      updatedAt: String(data.updated_at),
    };
  } catch {
    return null;
  }
}

export async function upsertRemoteLearningSession(
  session: LearningSessionState,
): Promise<string | null> {
  if (!session.userId || session.userId === "demo" || session.wordIds.some((id) => id.startsWith("sample-"))) {
    return null;
  }
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("learning_sessions")
      .upsert(
        {
          id: session.sessionId,
          user_id: session.userId,
          session_type: session.sessionType,
          lang_filter: session.langFilter,
          word_ids: session.wordIds,
          completed_word_ids: session.completedWordIds,
          current_word_index: session.currentWordIndex,
          current_word_id: session.currentWordId,
          current_stage: session.currentStage,
          status: session.status,
          xp_earned: session.xpEarned,
          updated_at: session.updatedAt,
        },
        { onConflict: "id" },
      )
      .select("id")
      .maybeSingle();
    if (error || !data) return null;
    return String(data.id);
  } catch {
    return null;
  }
}

export async function persistStageAdvanceRemote(params: {
  sessionId: string;
  wordId: string;
  completedStage: 1 | 2 | 3;
  answer: string;
  passed: boolean;
  payload?: WordStagePayload;
  xpDelta: number;
}): Promise<void> {
  if (params.wordId.startsWith("sample-")) return;
  try {
    const supabase = getSupabase();
    await supabase.rpc("advance_initial_learning_stage", {
      p_session_id: params.sessionId,
      p_word_id: params.wordId,
      p_completed_stage: params.completedStage,
      p_answer: params.answer,
      p_passed: params.passed,
      p_stage_payload: params.payload || {},
      p_xp_delta: params.xpDelta,
    });
  } catch {
    // Local session mirror preserves exact stage if migration 011 isn't applied yet
  }
}

export async function persistCompleteInitialWordRemote(params: {
  sessionId: string;
  wordId: string;
  rating: FsrsRating;
  schedule: FsrsScheduleResult;
  xpDelta: number;
}): Promise<void> {
  if (params.wordId.startsWith("sample-")) return;
  try {
    const supabase = getSupabase();
    const { error } = await supabase.rpc("complete_initial_learning_word", {
      p_session_id: params.sessionId,
      p_word_id: params.wordId,
      p_rating: params.rating,
      p_fsrs_stability: params.schedule.stability,
      p_fsrs_difficulty: params.schedule.difficulty,
      p_fsrs_reps: params.schedule.reps,
      p_fsrs_lapses: params.schedule.lapses,
      p_interval_days: params.schedule.intervalDays,
      p_next_review: params.schedule.nextReviewIso,
      p_box: params.schedule.box,
      p_learning_status: params.schedule.learningStatus,
      p_xp_delta: params.xpDelta,
    });

    if (!error) return;

    // Backward-compatible fallback to legacy review_word if migration 011 isn't applied yet
    const legacyGrade = (params.rating - 1) as 0 | 1 | 2 | 3;
    await reviewWord(params.wordId, params.rating > 1, legacyGrade).catch(() => {});
  } catch (err) {
    console.warn("Could not persist initial word completion remotely:", err);
  }
}

export async function persistSpacedReviewRemote(params: {
  wordId: string;
  exerciseType: ExerciseType;
  answer: string;
  result: boolean;
  rating: FsrsRating;
  schedule: FsrsScheduleResult;
}): Promise<void> {
  if (params.wordId.startsWith("sample-")) return;
  const supabase = getSupabase();
  const { error } = await supabase.rpc("record_spaced_repetition_review", {
    p_word_id: params.wordId,
    p_exercise_type: params.exerciseType,
    p_answer: params.answer,
    p_result: params.result,
    p_rating: params.rating,
    p_learning_status: params.schedule.learningStatus,
    p_fsrs_stability: params.schedule.stability,
    p_fsrs_difficulty: params.schedule.difficulty,
    p_fsrs_reps: params.schedule.reps,
    p_fsrs_lapses: params.schedule.lapses,
    p_interval_days: params.schedule.intervalDays,
    p_next_review: params.schedule.nextReviewIso,
    p_box: params.schedule.box,
  });

  if (!error) return;

  // Fallback to legacy review_word if migration 011 isn't applied yet
  const legacyGrade = (params.rating - 1) as 0 | 1 | 2 | 3;
  await reviewWord(params.wordId, params.rating > 1, legacyGrade);
}
