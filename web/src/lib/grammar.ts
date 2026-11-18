/**
 * Grammar & Determiner Checker for WordTap Sentence Evaluation
 *
 * Catches structural English grammar defects that free spelling/grammar APIs miss,
 * specifically missing determiners/articles for singular countable nouns
 * (e.g. "study portion of lesson" -> "study a portion of the lesson"),
 * while strictly honoring the user's leniency rules:
 * - IGNORE capitalization (lowercase "i" or sentence start is NEVER penalized)
 * - IGNORE informal conversational English ("wanna", "gonna", "gotta", "kinda", etc.)
 * - IGNORE punctuation marks (missing period, exclamation, question mark, or commas)
 */

export interface DeterminerIssue {
  word: string;
  rawToken: string;
  index: number;
  isTarget: boolean;
  precedingPreposition?: string;
}

export interface LocalGrammarResult {
  hasStructuralErrors: boolean;
  scorePenalty: number;
  grammarCorrections: string[];
  naturalAlternative: string | null;
  explanation: string | null;
  naturalnessFeedback: string | null;
}

export const DETERMINERS = new Set([
  // Articles
  "a",
  "an",
  "the",
  // Demonstratives
  "this",
  "that",
  "these",
  "those",
  // Possessives
  "my",
  "your",
  "his",
  "her",
  "its",
  "our",
  "their",
  "whose",
  // Quantifiers & numbers
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "each",
  "every",
  "another",
  "either",
  "neither",
  "any",
  "no",
  "some",
  "all",
  "both",
  "half",
  "several",
  "many",
  "few",
  // Interrogatives & relatives
  "which",
  "what",
  "whatever",
  "whichever",
]);

export const UNCOUNTABLE_NOUNS = new Set([
  "information",
  "advice",
  "news",
  "knowledge",
  "evidence",
  "research",
  "data",
  "feedback",
  "homework",
  "work",
  "traffic",
  "luggage",
  "baggage",
  "furniture",
  "equipment",
  "machinery",
  "software",
  "hardware",
  "money",
  "cash",
  "currency",
  "wealth",
  "poverty",
  "luck",
  "fun",
  "trouble",
  "chaos",
  "courage",
  "confidence",
  "patience",
  "honesty",
  "integrity",
  "redundancy",
  "peace",
  "freedom",
  "justice",
  "safety",
  "health",
  "sleep",
  "stress",
  "behavior",
  "damage",
  "permission",
  "respect",
  "trust",
  "love",
  "hate",
  "anger",
  "joy",
  "hope",
  "fear",
  "beauty",
  "truth",
  "space",
  "time",
  "energy",
  "power",
  "electricity",
  "music",
  "art",
  "poetry",
  "vocabulary",
  "grammar",
  "spelling",
  "slang",
  "history",
  "science",
  "math",
  "mathematics",
  "physics",
  "chemistry",
  "biology",
  "water",
  "milk",
  "coffee",
  "tea",
  "juice",
  "wine",
  "beer",
  "bread",
  "butter",
  "cheese",
  "rice",
  "meat",
  "sugar",
  "salt",
  "pepper",
  "oil",
  "soup",
  "food",
  "air",
  "oxygen",
  "smoke",
  "dust",
  "sand",
  "ice",
  "rain",
  "snow",
  "weather",
  "heat",
  "cold",
  "gold",
  "silver",
  "iron",
  "wood",
  "paper",
  "glass",
  "plastic",
  "cake",
]);

export const COMMON_COUNTABLE_NOUNS = new Set([
  // Core quantity / piece words
  "portion",
  "chunk",
  "piece",
  "share",
  "slice",
  "segment",
  "fraction",
  "section",
  "sample",
  "item",
  "element",
  "factor",
  // Learning & Education
  "lesson",
  "chapter",
  "unit",
  "topic",
  "subject",
  "course",
  "class",
  "lecture",
  "exam",
  "test",
  "quiz",
  "grade",
  // Books & Writing
  "book",
  "page",
  "story",
  "article",
  "essay",
  "novel",
  "letter",
  "message",
  "email",
  "note",
  // Language & Linguistics
  "word",
  "sentence",
  "phrase",
  "paragraph",
  "definition",
  "example",
  "rule",
  "question",
  "answer",
  // Thinking & Action
  "problem",
  "solution",
  "issue",
  "mistake",
  "error",
  "idea",
  "thought",
  "plan",
  "goal",
  "dream",
  "reason",
  "cause",
  "effect",
  "result",
  "decision",
  "choice",
  "habit",
  "step",
  // Food & Objects
  "apple",
  "banana",
  "orange",
  "egg",
  "meal",
  "sandwich",
  "cookie",
  // Transportation & Places
  "car",
  "bus",
  "train",
  "plane",
  "bike",
  "bicycle",
  "vehicle",
  "room",
  "house",
  "apartment",
  "kitchen",
  "office",
  "building",
  "door",
  "window",
  "table",
  "chair",
  "desk",
  "city",
  "town",
  "country",
  "hotel",
  "hospital",
  "store",
  "shop",
  // Technology
  "computer",
  "laptop",
  "phone",
  "device",
  "website",
  "app",
  "tool",
  "program",
  "file",
  "document",
  // People & Roles
  "person",
  "man",
  "woman",
  "child",
  "boy",
  "girl",
  "friend",
  "teacher",
  "student",
  "doctor",
  "nurse",
  "worker",
  "boss",
  "colleague",
  "neighbor",
  "stranger",
  "customer",
  "client",
  "member",
  // Work & Entertainment
  "job",
  "career",
  "project",
  "task",
  "meeting",
  "interview",
  "contract",
  "company",
  "business",
  "group",
  "team",
  "game",
  "match",
  "sport",
  "movie",
  "film",
  "video",
  "song",
]);

export const IDIOMATIC_BARE_PATTERNS = [
  /\b(at\s+(home|work|school|church|night|noon|dawn|dusk|sea|peace|rest))\b/i,
  /\b(in\s+(bed|class|hospital|prison|jail|town|fact|place|order|front\s+of|line))\b/i,
  /\b(on\s+(foot|time|duty|vacation|stage|demand|purpose|fire|board|line))\b/i,
  /\b(by\s+(car|bus|train|plane|air|hand|chance|heart|day|night|design))\b/i,
  /\b(day\s+by\s+day|step\s+by\s+step|word\s+for\s+word|face\s+to\s+face|side\s+by\s+side|hand\s+in\s+hand)\b/i,
  /\b(take\s+(part|care|place))\b/i,
  /\b(pay\s+attention|make\s+sense|keep\s+track)\b/i,
  /\b(have|eat)\s+(breakfast|lunch|dinner)\b/i,
  /\b(go|come|leave|stay)\s+home\b/i,
];

const SCAN_STOPPER_RE =
  /^(will|shall|can|could|would|should|may|might|must|study|eat|read|write|have|has|had|take|took|make|made|is|are|was|were|see|saw|of|in|on|at|from|to|with|for|about|into|onto|through|without|by|because|and|or|but|if|that|when|while|since|although)$/i;

const AUX_AND_MODALS_RE =
  /\b(is|are|was|were|am|be|been|being|have|has|had|having|do|does|did|done|will|would|shall|should|can|could|may|might|must|wanna|gonna|gotta)\b/i;

const PRONOUN_SUBJECT_RE =
  /\b(i|you|he|she|we|they|it)\s+(?:(?:really|always|never|often|usually|already|just|probably|definitely|gladly|hardly|simply)\s+)?([a-z]+)\b/i;

const VERB_INFLECTION_RE =
  /\b[a-z]{3,}(?:ed|ing|ize|ized|izes|ate|ated|ates|ify|ified|ifies)\b/i;

const COMMON_VERB_RE =
  /\b(is|are|was|were|am|be|been|being|have|has|had|having|do|does|did|done|will|would|shall|should|can|could|may|might|must|study|studied|studies|studying|learn|learned|learns|learning|read|reads|reading|write|wrote|written|writing|eat|ate|eaten|eating|take|took|taken|taking|make|made|makes|making|give|gave|given|giving|see|saw|seen|seeing|look|looked|looks|looking|watch|watched|watches|watching|go|went|gone|going|goes|come|came|comes|coming|get|got|gotten|getting|gets|put|puts|tell|told|tells|telling|ask|asked|asks|asking|work|worked|works|working|feel|felt|feels|feeling|try|tried|tries|trying|use|used|uses|using|find|found|finds|finding|know|knew|known|knows|knowing|think|thought|thinks|thinking|need|needed|needs|needing|want|wanted|wants|wanting|wanna|gonna|gotta|help|helped|helps|helping|buy|bought|buys|buying|play|played|plays|playing|run|ran|runs|running|walk|walked|walks|walking|speak|spoke|spoken|speaks|speaking|talk|talked|talks|talking|show|showed|shown|shows|showing|call|called|calls|calling|keep|kept|keeps|keeping|leave|left|leaves|leaving|bring|brought|brings|bringing|begin|began|begun|begins|beginning|start|started|starts|starting|stand|stood|stands|standing|hear|heard|hears|hearing|let|lets|letting|mean|meant|means|meaning|set|sets|setting|meet|met|meets|meeting|pay|paid|pays|paying|sit|sat|sits|sitting|grow|grew|grown|grows|growing|lose|lost|loses|losing|fall|fell|fallen|falls|falling|send|sent|sends|sending|build|built|builds|building|understand|understood|understands|understanding|draw|drew|drawn|draws|drawing|break|broke|broken|breaks|breaking|spend|spent|spends|spending|cut|cuts|cutting|rise|rose|risen|rises|rising|drive|drove|driven|drives|driving|wear|wore|worn|wears|wearing|choose|chose|chosen|chooses|choosing|eliminate|eliminated|eliminates|eliminating|contain|contained|contains|containing|include|included|includes|including|provide|provided|provides|providing|require|required|requires|requiring|reduce|reduced|reduces|reducing|increase|increased|increases|increasing|improve|improved|improves|improving)\b/i;

export function isPluralNoun(token: string): boolean {
  const w = token.toLowerCase();
  const nonPlurals = new Set([
    "bus",
    "class",
    "glass",
    "dress",
    "boss",
    "gas",
    "lens",
    "status",
    "canvas",
    "process",
    "business",
    "access",
    "success",
    "address",
    "progress",
    "grass",
    "cross",
    "mass",
    "crisis",
    "analysis",
    "basis",
    "species",
    "series",
  ]);
  if (nonPlurals.has(w)) return false;
  if (["people", "children", "men", "women", "teeth", "feet", "mice", "data", "criteria"].includes(w)) {
    return true;
  }
  return w.endsWith("s") && !w.endsWith("ss") && !w.endsWith("us") && !w.endsWith("is");
}

export function detectDeterminerIssues(
  sentence: string,
  targetWord: string,
  partOfSpeech?: string,
): DeterminerIssue[] {
  const isPosNoun = !partOfSpeech || /noun/i.test(partOfSpeech);
  const cleanTarget = targetWord.trim().toLowerCase();
  const rawTokens = sentence.trim().split(/\s+/);
  const issues: DeterminerIssue[] = [];

  // Match idiomatic bare noun ranges across the sentence
  const matchedIdiomRanges: Array<{ start: number; end: number }> = [];
  for (const regex of IDIOMATIC_BARE_PATTERNS) {
    let match: RegExpExecArray | null;
    const globalRegex = new RegExp(regex.source, "gi");
    while ((match = globalRegex.exec(sentence)) !== null) {
      matchedIdiomRanges.push({ start: match.index, end: match.index + match[0].length });
    }
  }

  let charOffset = 0;
  rawTokens.forEach((rawToken, idx) => {
    const tokenStart = sentence.indexOf(rawToken, charOffset);
    charOffset = tokenStart >= 0 ? tokenStart + rawToken.length : charOffset + rawToken.length;
    const tokenEnd = charOffset;

    // Skip if within an idiomatic bare prepositional phrase
    const isIdiom = matchedIdiomRanges.some((r) => tokenStart >= r.start && tokenEnd <= r.end);
    if (isIdiom) return;

    const clean = rawToken.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
    if (!clean) return;

    const isTarget = clean === cleanTarget;
    const isKnownCountable = COMMON_COUNTABLE_NOUNS.has(clean);
    const isTargetCountableNoun = isTarget && isPosNoun && !UNCOUNTABLE_NOUNS.has(clean);

    if ((isTargetCountableNoun || isKnownCountable) && !isPluralNoun(clean) && !UNCOUNTABLE_NOUNS.has(clean)) {
      // Look back for a determiner or possessive ('s)
      let hasDeterminer = false;
      let precedingPrep: string | undefined;

      for (let prev = idx - 1; prev >= Math.max(0, idx - 4); prev--) {
        const prevClean = rawTokens[prev]!.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
        if (!prevClean) continue;

        if (DETERMINERS.has(prevClean) || prevClean.endsWith("'s") || prevClean.endsWith("'")) {
          hasDeterminer = true;
          break;
        }

        // Record direct preposition if immediately before noun (e.g. "of lesson")
        if (
          prev === idx - 1 &&
          /^(of|in|on|at|from|to|with|for|about|into|onto|through|without)$/i.test(prevClean)
        ) {
          precedingPrep = prevClean;
        }

        // Stop scanning back if hitting a verb, clause boundary, or preposition
        if (SCAN_STOPPER_RE.test(prevClean)) {
          break;
        }
      }

      if (!hasDeterminer) {
        issues.push({
          word: clean,
          rawToken,
          index: idx,
          isTarget,
          precedingPreposition: precedingPrep,
        });
      }
    }
  });

  return issues;
}

export function buildNaturalAlternative(sentence: string, issues: DeterminerIssue[]): string {
  const tokens = sentence.trim().split(/\s+/);
  const issueMap = new Map(issues.map((i) => [i.index, i]));

  const reconstructed: string[] = [];
  tokens.forEach((token, idx) => {
    const issue = issueMap.get(idx);
    if (issue) {
      const prev = idx > 0 ? tokens[idx - 1]!.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "") : "";
      const word = issue.word;
      const isVowelStart = /^[aeiou]/i.test(word);
      // After prepositions like "of" or "in", standard English uses "the", else "a" / "an"
      const article =
        prev === "of" || prev === "in" || prev === "on" || prev === "to"
          ? "the"
          : isVowelStart
            ? "an"
            : "a";
      reconstructed.push(article);
    }
    reconstructed.push(token);
  });

  let result = reconstructed.join(" ");
  // Capitalize first character
  if (result.length > 0) {
    result = result[0]!.toUpperCase() + result.slice(1);
  }
  // Ensure standalone 'i' is capitalized
  result = result.replace(/\bi\b/g, "I");
  // Ensure trailing period
  if (!/[.!?]$/.test(result)) {
    result += ".";
  }
  return result;
}

export function detectFragmentIssue(
  sentence: string,
  targetWord?: string,
  partOfSpeech?: string,
): string | null {
  const clean = sentence.replace(/\s+/g, " ").trim();
  const tokens = clean.split(/\s+/).filter(Boolean);
  if (tokens.length < 3) return null;

  // 1. If target word is practiced as a verb or appears in verb form in the sentence
  const isPosVerb = Boolean(partOfSpeech && /verb/i.test(partOfSpeech));
  if (isPosVerb && targetWord) {
    const targetClean = targetWord.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
    if (targetClean.length > 0) {
      const targetReg = new RegExp(`\\b${targetClean}(?:ed|ing|s|es)?\\b`, "i");
      if (targetReg.test(clean)) return null;
    }
  }

  // 2. Auxiliary, modal, or copula
  if (AUX_AND_MODALS_RE.test(clean)) return null;

  // 3. Subject pronoun followed by action word (e.g. "I accumulated", "they study")
  if (PRONOUN_SUBJECT_RE.test(clean)) return null;

  // 4. Regular verb inflections (-ed, -ing, -ize, -ate, -ify)
  if (VERB_INFLECTION_RE.test(clean)) return null;

  // 5. Common verbs list
  if (COMMON_VERB_RE.test(clean)) return null;

  // If none of the above are present, it is a noun phrase fragment (e.g. "a large portion of the lesson")
  return 'Your sentence appears to be missing a main verb (action or linking verb, such as "is", "was", or "studied").';
}

export function evaluateGrammarLocally(params: {
  sentence: string;
  word: string;
  partOfSpeech?: string;
}): LocalGrammarResult {
  const { sentence, word, partOfSpeech } = params;
  const determinerIssues = detectDeterminerIssues(sentence, word, partOfSpeech);
  const fragmentIssue = detectFragmentIssue(sentence, word, partOfSpeech);

  const grammarCorrections: string[] = [];
  let scorePenalty = 0;

  if (fragmentIssue) {
    grammarCorrections.push(fragmentIssue);
    scorePenalty += 35;
  }

  for (const issue of determinerIssues) {
    if (issue.isTarget) {
      const displayTarget = word.toLowerCase();
      grammarCorrections.push(
        `Add an article before "${word}": try "a ${displayTarget}" or "the ${displayTarget}".`,
      );
      scorePenalty += 25;
    } else {
      const prepNote = issue.precedingPreposition
        ? ` (e.g. "${issue.precedingPreposition} the ${issue.word}")`
        : "";
      grammarCorrections.push(
        `Add an article before "${issue.word}": try "the ${issue.word}" or "a ${issue.word}"${prepNote}.`,
      );
      scorePenalty += 20;
    }
  }

  const hasStructuralErrors = grammarCorrections.length > 0;
  const naturalAlternative =
    determinerIssues.length > 0 ? buildNaturalAlternative(sentence, determinerIssues) : null;

  let explanation: string | null = null;
  let naturalnessFeedback: string | null = null;

  if (determinerIssues.length > 0) {
    const issueWords = determinerIssues.map((i) => `"${i.word}"`).join(" and ");
    explanation = `Singular countable nouns like ${issueWords} require an article (such as "a", "an", or "the") in English.`;
    naturalnessFeedback = "Add the missing articles to make your sentence grammatically complete and natural.";
  } else if (fragmentIssue) {
    explanation = "A complete English sentence needs both a subject and a verb.";
    naturalnessFeedback = "Add an action or linking verb to turn this phrase into a full sentence.";
  }

  return {
    hasStructuralErrors,
    scorePenalty,
    grammarCorrections,
    naturalAlternative,
    explanation,
    naturalnessFeedback,
  };
}
