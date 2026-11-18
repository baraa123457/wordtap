import { describe, expect, it } from "vitest";
import {
  buildSpacedRepetitionQueue,
  createOrResumeInitialLearningSession,
  transitionAdvanceStage,
  transitionCompleteWord,
  type KeyValueStore,
} from "./learning-session-manager";
import type { Word } from "./schemas";

class MemoryStore implements KeyValueStore {
  private data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
}

function makeWord(index: number, overrides: Partial<Word> = {}): Word {
  const ts = new Date(Date.UTC(2026, 10, 1, 10, index, 0)).toISOString();
  return {
    id: `word-${String(index).padStart(2, "0")}`,
    text: `vocab${index}`,
    translation: `معنى${index}`,
    src_lang: "en",
    target_lang: "ar",
    source_title: "",
    source_url: "",
    sentence: "",
    times_seen: 1,
    box: 0,
    next_review: ts,
    correct_count: 0,
    wrong_count: 0,
    last_practiced: null,
    created_at: ts,
    initial_learning_completed: false,
    current_stage: 1,
    completed_stages: [],
    ...overrides,
  };
}

describe("Strict Sequential Learning Session Manager (all 10 scenarios)", () => {
  const tenNewWords = Array.from({ length: 10 }, (_, i) => makeWord(i + 1));

  it("Scenarios 1-5: 10 new words follow strict WORD_1(1->2->3->4) -> WORD_2(1) progression", () => {
    const store = new MemoryStore();
    let sess = createOrResumeInitialLearningSession({
      userId: "user-1",
      words: tenNewWords,
      limit: 10,
      store,
    });

    // 1. Session contains 10 new words in deterministic order
    expect(sess.wordIds).toHaveLength(10);
    expect(sess.wordIds[0]).toBe("word-01");
    expect(sess.wordIds[1]).toBe("word-02");

    // 2. Word 1 starts strictly at Stage 1
    expect(sess.currentWordIndex).toBe(0);
    expect(sess.currentWordId).toBe("word-01");
    expect(sess.currentStage).toBe(1);

    // Guard: cannot skip Stage 1 -> Stage 2 directly or jump to Word 2
    expect(() =>
      transitionAdvanceStage(
        sess,
        { wordId: "word-01", completedStage: 2, answer: "x", passed: true },
        store,
      ),
    ).toThrow(/expected stage 1/i);
    expect(() =>
      transitionAdvanceStage(
        sess,
        { wordId: "word-02", completedStage: 1, answer: "x", passed: true },
        store,
      ),
    ).toThrow(/active word is word-01/i);

    // 3. Complete Stage 1 -> Word 1 moves to Stage 2
    sess = transitionAdvanceStage(
      sess,
      {
        wordId: "word-01",
        completedStage: 1,
        answer: "Unwilling or hesitant",
        passed: true,
        payload: { definition: "Unwilling or hesitant" },
        xpDelta: 10,
      },
      store,
    );
    expect(sess.currentWordId).toBe("word-01");
    expect(sess.currentStage).toBe(2);
    expect(sess.wordProgress["word-01"]?.completedStages).toEqual([1]);

    // 4. Complete Stage 2 -> Word 1 moves to Stage 3
    sess = transitionAdvanceStage(
      sess,
      {
        wordId: "word-01",
        completedStage: 2,
        answer: "vocab1",
        passed: true,
        xpDelta: 15,
      },
      store,
    );
    expect(sess.currentWordId).toBe("word-01");
    expect(sess.currentStage).toBe(3);
    expect(sess.wordProgress["word-01"]?.completedStages).toEqual([1, 2]);

    // Guard: cannot complete word before Stage 3 is done
    expect(() =>
      transitionCompleteWord(sess, { wordId: "word-01" }, store),
    ).toThrow(/Stage 4/i);

    // 5. Complete Stage 3 -> Stage 4, then complete Word 1 -> Word 2 starts strictly at Stage 1
    sess = transitionAdvanceStage(
      sess,
      {
        wordId: "word-01",
        completedStage: 3,
        answer: "I used vocab1 in a real sentence.",
        passed: true,
        payload: { userSentence: "I used vocab1 in a real sentence." },
        xpDelta: 20,
      },
      store,
    );
    expect(sess.currentWordId).toBe("word-01");
    expect(sess.currentStage).toBe(4);

    sess = transitionCompleteWord(sess, { wordId: "word-01", xpDelta: 5 }, store);
    expect(sess.completedWordIds).toEqual(["word-01"]);
    expect(sess.currentWordIndex).toBe(1);
    expect(sess.currentWordId).toBe("word-02");
    expect(sess.currentStage).toBe(1);
    expect(sess.wordProgress["word-01"]?.completed).toBe(true);
  });

  it("Scenarios 6 & 7: Refresh during Stage 2 and close/reopen restore exact session, word, and stage", () => {
    const store = new MemoryStore();
    let sess = createOrResumeInitialLearningSession({
      userId: "user-refresh",
      words: tenNewWords,
      limit: 10,
      store,
    });
    const originalSessionId = sess.sessionId;

    // Complete Stage 1 on Word 1 -> now at Stage 2
    sess = transitionAdvanceStage(
      sess,
      {
        wordId: "word-01",
        completedStage: 1,
        answer: "Meaning 1",
        passed: true,
        payload: { definition: "Meaning 1" },
        xpDelta: 10,
      },
      store,
    );
    expect(sess.currentStage).toBe(2);

    // Simulate page refresh / browser close & reopen using the same persisted store
    const restored = createOrResumeInitialLearningSession({
      userId: "user-refresh",
      words: tenNewWords,
      limit: 10,
      store,
    });

    expect(restored.resumed).toBe(true);
    expect(restored.sessionId).toBe(originalSessionId);
    expect(restored.currentWordId).toBe("word-01");
    expect(restored.currentWordIndex).toBe(0);
    expect(restored.currentStage).toBe(2);
    expect(restored.wordProgress["word-01"]?.completedStages).toEqual([1]);
    expect(restored.wordProgress["word-01"]?.definition).toBe("Meaning 1");
  });

  it("Scenario 8: Completing 4 words sequentially skips zero words and repeats zero words", () => {
    const store = new MemoryStore();
    let sess = createOrResumeInitialLearningSession({
      userId: "user-seq",
      words: tenNewWords,
      limit: 10,
      store,
    });

    const visitedOrder: string[] = [];
    for (let i = 0; i < 4; i++) {
      const wid = sess.currentWordId!;
      visitedOrder.push(wid);
      expect(sess.currentStage).toBe(1);

      sess = transitionAdvanceStage(sess, { wordId: wid, completedStage: 1, answer: "a", passed: true }, store);
      expect(sess.currentStage).toBe(2);
      sess = transitionAdvanceStage(sess, { wordId: wid, completedStage: 2, answer: "b", passed: true }, store);
      expect(sess.currentStage).toBe(3);
      sess = transitionAdvanceStage(sess, { wordId: wid, completedStage: 3, answer: "c", passed: true }, store);
      expect(sess.currentStage).toBe(4);
      sess = transitionCompleteWord(sess, { wordId: wid }, store);
    }

    expect(visitedOrder).toEqual(["word-01", "word-02", "word-03", "word-04"]);
    expect(sess.completedWordIds).toEqual(["word-01", "word-02", "word-03", "word-04"]);
    expect(sess.currentWordId).toBe("word-05");
    expect(sess.currentStage).toBe(1);

    // Reloading never restarts completed words 1..4
    const reloaded = createOrResumeInitialLearningSession({
      userId: "user-seq",
      words: tenNewWords,
      limit: 10,
      store,
    });
    expect(reloaded.currentWordId).toBe("word-05");
    expect(reloaded.currentStage).toBe(1);
  });

  it("Scenario 9: Spaced Repetition queue is strictly separate and never interferes with Initial Learning", () => {
    const store = new MemoryStore();
    const completedOldWord = makeWord(99, {
      id: "word-done-99",
      initial_learning_completed: true,
      completed_stages: [1, 2, 3, 4],
      current_stage: 4,
      learning_status: "review",
      box: 2,
      next_review: "2026-10-01T00:00:00Z", // overdue for spaced repetition
    });

    const mixedPool = [completedOldWord, ...tenNewWords];

    // Initial Learning session MUST exclude completedOldWord and start strictly at word-01 Stage 1
    let initSess = createOrResumeInitialLearningSession({
      userId: "user-sep",
      words: mixedPool,
      limit: 5,
      store,
    });
    expect(initSess.wordIds).not.toContain("word-done-99");
    expect(initSess.currentWordId).toBe("word-01");
    expect(initSess.currentStage).toBe(1);

    // Move word-01 to Stage 2
    initSess = transitionAdvanceStage(
      initSess,
      { wordId: "word-01", completedStage: 1, answer: "def", passed: true },
      store,
    );

    // Spaced Repetition queue MUST ONLY include completedOldWord and NEVER include uncompleted new words
    const srQueue = buildSpacedRepetitionQueue(mixedPool, {
      userId: "user-sep",
      limit: 20,
      now: new Date("2026-11-18T12:00:00Z"),
      store,
    });
    expect(srQueue.map((item) => item.word.id)).toEqual(["word-done-99"]);

    // Initial Learning session remains completely intact at word-01 Stage 2!
    const stillInit = createOrResumeInitialLearningSession({
      userId: "user-sep",
      words: mixedPool,
      limit: 5,
      store,
    });
    expect(stillInit.currentWordId).toBe("word-01");
    expect(stillInit.currentStage).toBe(2);
  });

  it("Scenario 10: Multiple users maintain completely independent sessions and progress", () => {
    const sharedBrowserStore = new MemoryStore();

    let userA = createOrResumeInitialLearningSession({
      userId: "user-A",
      words: tenNewWords,
      limit: 10,
      store: sharedBrowserStore,
    });
    userA = transitionAdvanceStage(
      userA,
      { wordId: "word-01", completedStage: 1, answer: "a1", passed: true },
      sharedBrowserStore,
    );
    userA = transitionAdvanceStage(
      userA,
      { wordId: "word-01", completedStage: 2, answer: "a2", passed: true },
      sharedBrowserStore,
    );
    expect(userA.currentWordId).toBe("word-01");
    expect(userA.currentStage).toBe(3);

    // User B starts fresh on the same device: must start at Word 1 Stage 1!
    const userB = createOrResumeInitialLearningSession({
      userId: "user-B",
      words: tenNewWords,
      limit: 10,
      store: sharedBrowserStore,
    });
    expect(userB.sessionId).not.toBe(userA.sessionId);
    expect(userB.currentWordId).toBe("word-01");
    expect(userB.currentStage).toBe(1);
    expect(userB.wordProgress["word-01"]?.completedStages).toEqual([]);

    // User A returning still resumes at Stage 3!
    const userARestored = createOrResumeInitialLearningSession({
      userId: "user-A",
      words: tenNewWords,
      limit: 10,
      store: sharedBrowserStore,
    });
    expect(userARestored.currentStage).toBe(3);
  });
});
