export type VerbTenseType =
  | "base"
  | "past"
  | "past_participle"
  | "present_participle"
  | "third_person";

export interface VerbConjugation {
  base: string;
  past: string;
  pastParticiple: string;
  presentParticiple: string;
  thirdPerson: string;
  currentTenses: VerbTenseType[];
  tenseLabelEn: string;
  tenseLabelAr: string;
  isIrregular: boolean;
}

// Comprehensive dictionary of common English irregular verbs: [base, past, pastParticiple]
const IRREGULAR_VERBS: [string, string, string][] = [
  ["arise", "arose", "arisen"],
  ["awake", "awoke", "awoken"],
  ["be", "was", "been"],
  ["bear", "bore", "born"],
  ["beat", "beat", "beaten"],
  ["become", "became", "become"],
  ["begin", "began", "begun"],
  ["bend", "bent", "bent"],
  ["bet", "bet", "bet"],
  ["bind", "bound", "bound"],
  ["bite", "bit", "bitten"],
  ["bleed", "bled", "bled"],
  ["blow", "blew", "blown"],
  ["break", "broke", "broken"],
  ["breed", "bred", "bred"],
  ["bring", "brought", "brought"],
  ["build", "built", "built"],
  ["burn", "burned", "burned"],
  ["burst", "burst", "burst"],
  ["buy", "bought", "bought"],
  ["cast", "cast", "cast"],
  ["catch", "caught", "caught"],
  ["choose", "chose", "chosen"],
  ["cling", "clung", "clung"],
  ["come", "came", "come"],
  ["cost", "cost", "cost"],
  ["creep", "crept", "crept"],
  ["cut", "cut", "cut"],
  ["deal", "dealt", "dealt"],
  ["dig", "dug", "dug"],
  ["do", "did", "done"],
  ["draw", "drew", "drawn"],
  ["dream", "dreamed", "dreamed"],
  ["drink", "drank", "drunk"],
  ["drive", "drove", "driven"],
  ["eat", "ate", "eaten"],
  ["fall", "fell", "fallen"],
  ["feed", "fed", "fed"],
  ["feel", "felt", "felt"],
  ["fight", "fought", "fought"],
  ["find", "found", "found"],
  ["flee", "fled", "fled"],
  ["fly", "flew", "flown"],
  ["forbid", "forbade", "forbidden"],
  ["forget", "forgot", "forgotten"],
  ["forgive", "forgave", "forgiven"],
  ["freeze", "froze", "frozen"],
  ["get", "got", "gotten"],
  ["give", "gave", "given"],
  ["go", "went", "gone"],
  ["grow", "grew", "grown"],
  ["hang", "hung", "hung"],
  ["have", "had", "had"],
  ["hear", "heard", "heard"],
  ["hide", "hid", "hidden"],
  ["hit", "hit", "hit"],
  ["hold", "held", "held"],
  ["hurt", "hurt", "hurt"],
  ["keep", "kept", "kept"],
  ["kneel", "knelt", "knelt"],
  ["know", "knew", "known"],
  ["lay", "laid", "laid"],
  ["lead", "led", "led"],
  ["lean", "leaned", "leaned"],
  ["leap", "leaped", "leaped"],
  ["learn", "learned", "learned"],
  ["leave", "left", "left"],
  ["lend", "lent", "lent"],
  ["let", "let", "let"],
  ["lie", "lay", "lain"],
  ["light", "lit", "lit"],
  ["lose", "lost", "lost"],
  ["make", "made", "made"],
  ["mean", "meant", "meant"],
  ["meet", "met", "met"],
  ["pay", "paid", "paid"],
  ["prove", "proved", "proven"],
  ["put", "put", "put"],
  ["quit", "quit", "quit"],
  ["read", "read", "read"],
  ["ride", "rode", "ridden"],
  ["ring", "rang", "rung"],
  ["rise", "rose", "risen"],
  ["run", "ran", "run"],
  ["say", "said", "said"],
  ["see", "saw", "seen"],
  ["seek", "sought", "sought"],
  ["sell", "sold", "sold"],
  ["send", "sent", "sent"],
  ["set", "set", "set"],
  ["shake", "shook", "shaken"],
  ["shine", "shone", "shone"],
  ["shoot", "shot", "shot"],
  ["show", "showed", "shown"],
  ["shrink", "shrank", "shrunk"],
  ["shut", "shut", "shut"],
  ["sing", "sang", "sung"],
  ["sink", "sank", "sunk"],
  ["sit", "sat", "sat"],
  ["sleep", "slept", "slept"],
  ["slide", "slid", "slid"],
  ["smell", "smelled", "smelled"],
  ["speak", "spoke", "spoken"],
  ["speed", "sped", "sped"],
  ["spell", "spelled", "spelled"],
  ["spend", "spent", "spent"],
  ["spill", "spilled", "spilled"],
  ["spin", "spun", "spun"],
  ["spit", "spat", "spat"],
  ["split", "split", "split"],
  ["spread", "spread", "spread"],
  ["stand", "stood", "stood"],
  ["steal", "stole", "stolen"],
  ["stick", "stuck", "stuck"],
  ["sting", "stung", "stung"],
  ["strike", "struck", "struck"],
  ["swear", "swore", "sworn"],
  ["sweep", "swept", "swept"],
  ["swim", "swam", "swum"],
  ["swing", "swung", "swung"],
  ["take", "took", "taken"],
  ["teach", "taught", "taught"],
  ["tear", "tore", "torn"],
  ["tell", "told", "told"],
  ["think", "thought", "thought"],
  ["throw", "threw", "thrown"],
  ["understand", "understood", "understood"],
  ["undertake", "undertook", "undertaken"],
  ["upset", "upset", "upset"],
  ["wake", "woke", "woken"],
  ["wear", "wore", "worn"],
  ["win", "won", "won"],
  ["withdraw", "withdrew", "withdrawn"],
  ["write", "wrote", "written"],
];

// Build fast lookup maps
const BASE_TO_IRREGULAR = new Map<string, [string, string]>();
const INFLECTION_TO_BASE = new Map<string, Array<{ base: string; past: string; pastParticiple: string }>>();

for (const [base, past, pp] of IRREGULAR_VERBS) {
  const presentPart = getPresentParticiple(base);
  const third = getThirdPersonSingular(base);
  BASE_TO_IRREGULAR.set(base.toLowerCase(), [past.toLowerCase(), pp.toLowerCase()]);

  const addMapping = (form: string) => {
    const key = form.toLowerCase();
    const list = INFLECTION_TO_BASE.get(key) || [];
    list.push({ base, past, pastParticiple: pp });
    INFLECTION_TO_BASE.set(key, list);
  };

  addMapping(base);
  addMapping(past);
  addMapping(pp);
  addMapping(presentPart);
  addMapping(third);
}

// Generate continuous (-ing) form
export function getPresentParticiple(base: string): string {
  const b = base.toLowerCase();
  if (b === "be") return "being";
  if (b === "see") return "seeing";
  if (b === "flee") return "fleeing";
  if (b.endsWith("ie")) return b.slice(0, -2) + "ying"; // die -> dying, lie -> lying
  if (b.endsWith("ee") || b.endsWith("oe") || b.endsWith("ye")) return b + "ing";
  // silent e (vowel + consonant + e) e.g. make -> making, write -> writing, leave -> leaving
  if (b.endsWith("e") && !b.endsWith("le") && b.length > 2) {
    return b.slice(0, -1) + "ing";
  }
  // Short CVC doubling
  if (/^[a-z]*[bcdfghjklmnpqrstvwxyz][aeiou][bcdfghjklmnpqrstvz]$/.test(b) && b.length <= 5) {
    if (!b.endsWith("w") && !b.endsWith("x") && !b.endsWith("y")) {
      return b + b.slice(-1) + "ing";
    }
  }
  return b + "ing";
}

// Generate 3rd person singular (-s / -es) form
export function getThirdPersonSingular(base: string): string {
  const b = base.toLowerCase();
  if (b === "be") return "is";
  if (b === "have") return "has";
  if (b === "do") return "does";
  if (b === "go") return "goes";
  if (b.endsWith("s") || b.endsWith("sh") || b.endsWith("ch") || b.endsWith("x") || b.endsWith("z") || b.endsWith("o")) {
    return b + "es";
  }
  if (b.endsWith("y") && b.length > 1 && !/[aeiou]y$/.test(b)) {
    return b.slice(0, -1) + "ies"; // study -> studies
  }
  return b + "s";
}

// Generate regular past / past participle (-ed) form
export function getRegularPast(base: string): string {
  const b = base.toLowerCase();
  if (b.endsWith("e")) return b + "d";
  if (b.endsWith("y") && b.length > 1 && !/[aeiou]y$/.test(b)) {
    return b.slice(0, -1) + "ied"; // study -> studied
  }
  // Short CVC doubling: stop -> stopped
  if (/^[a-z]*[bcdfghjklmnpqrstvwxyz][aeiou][bcdfghjklmnpqrstvz]$/.test(b) && b.length <= 5) {
    if (!b.endsWith("w") && !b.endsWith("x") && !b.endsWith("y")) {
      return b + b.slice(-1) + "ed";
    }
  }
  return b + "ed";
}

function getTenseLabels(tenses: VerbTenseType[]): { en: string; ar: string } {
  if (tenses.includes("past") && tenses.includes("past_participle")) {
    return { en: "Past Simple (V2) & Past Participle (V3)", ar: "ماضي بسيط وتصريف ثالث" };
  }
  if (tenses.includes("past")) {
    return { en: "Past Simple (V2)", ar: "الماضي البسيط" };
  }
  if (tenses.includes("past_participle")) {
    return { en: "Past Participle (V3)", ar: "التصريف الثالث للفعل" };
  }
  if (tenses.includes("present_participle")) {
    return { en: "Continuous / Gerund (-ing)", ar: "المضارع المستمر / اسم الفاعل" };
  }
  if (tenses.includes("third_person")) {
    return { en: "3rd Person Singular (-s)", ar: "المضارع للمفرد الغائب" };
  }
  return { en: "Present / Base Form (V1)", ar: "المصدر / المضارع البسيط" };
}

/**
 * Detects English verb conjugations for irregular or regular verbs.
 * Returns null if word does not look like a verb or is non-English.
 */
export function getVerbConjugation(rawWord: string, hintBase?: string): VerbConjugation | null {
  const word = (rawWord || "").trim().toLowerCase().replace(/[^a-z]/g, "");
  if (!word || word.length < 2) return null;

  // 1. If explicit hintBase is supplied (e.g. from Google Translate dictionary)
  const effectiveBase = (hintBase || "").trim().toLowerCase().replace(/[^a-z]/g, "");

  // 2. Check Irregular Verbs table
  let candidateBase: string | null = null;
  let pastForm = "";
  let ppForm = "";

  if (effectiveBase && BASE_TO_IRREGULAR.has(effectiveBase)) {
    candidateBase = effectiveBase;
    const forms = BASE_TO_IRREGULAR.get(effectiveBase)!;
    pastForm = forms[0];
    ppForm = forms[1];
  } else if (BASE_TO_IRREGULAR.has(word)) {
    candidateBase = word;
    const forms = BASE_TO_IRREGULAR.get(word)!;
    pastForm = forms[0];
    ppForm = forms[1];
  } else if (INFLECTION_TO_BASE.has(word)) {
    const list = INFLECTION_TO_BASE.get(word)!;
    const item = list[0];
    if (item) {
      candidateBase = item.base;
      pastForm = item.past;
      ppForm = item.pastParticiple;
    }
  }

  if (candidateBase && pastForm && ppForm) {
    const presentPart = getPresentParticiple(candidateBase);
    const third = getThirdPersonSingular(candidateBase);

    const currentTenses: VerbTenseType[] = [];
    if (word === candidateBase) currentTenses.push("base");
    if (word === pastForm) currentTenses.push("past");
    if (word === ppForm && !currentTenses.includes("past_participle")) currentTenses.push("past_participle");
    if (word === presentPart) currentTenses.push("present_participle");
    if (word === third) currentTenses.push("third_person");

    if (currentTenses.length === 0) {
      currentTenses.push("base");
    }

    const { en, ar } = getTenseLabels(currentTenses);

    return {
      base: candidateBase,
      past: pastForm,
      pastParticiple: ppForm,
      presentParticiple: presentPart,
      thirdPerson: third,
      currentTenses,
      tenseLabelEn: en,
      tenseLabelAr: ar,
      isIrregular: true,
    };
  }

  // 3. Regular verb detection (if hintBase provided or regular verb endings)
  let regBase: string | null = null;
  const currentTenses: VerbTenseType[] = [];

  if (effectiveBase && effectiveBase !== word) {
    regBase = effectiveBase;
    if (word.endsWith("ing")) currentTenses.push("present_participle");
    else if (word.endsWith("ed")) {
      currentTenses.push("past");
      currentTenses.push("past_participle");
    } else if (word.endsWith("s")) currentTenses.push("third_person");
    else currentTenses.push("base");
  } else if (word.endsWith("ing") && word.length >= 4) {
    // e.g. walking -> walk, making -> make
    currentTenses.push("present_participle");
    const stem = word.slice(0, -3);
    if (stem.endsWith("yy")) regBase = stem.slice(0, -1);
    else if (/[bcdfghjklmnpqrstvz]{2}$/.test(stem) && stem[stem.length - 1] === stem[stem.length - 2]) {
      regBase = stem.slice(0, -1); // stopping -> stop
    } else if (stem.endsWith("y")) {
      regBase = stem; // playing -> play
    } else {
      regBase = stem.endsWith("e") ? stem : stem + "e"; // might be like -> liking or walk -> walking
      // Prefer stem without e if common
      regBase = stem;
    }
  } else if (word.endsWith("ed") && word.length >= 4) {
    currentTenses.push("past");
    currentTenses.push("past_participle");
    const stem = word.slice(0, -2);
    if (stem.endsWith("i")) regBase = stem.slice(0, -1) + "y"; // studied -> study
    else if (/[bcdfghjklmnpqrstvz]{2}$/.test(stem) && stem[stem.length - 1] === stem[stem.length - 2]) {
      regBase = stem.slice(0, -1); // stopped -> stop
    } else if (word.endsWith("eed")) {
      regBase = word.slice(0, -1); // agreed -> agree
    } else {
      regBase = stem;
    }
  } else if (word.endsWith("ies") && word.length >= 4) {
    currentTenses.push("third_person");
    regBase = word.slice(0, -3) + "y"; // studies -> study
  } else if (word.endsWith("es") && word.length >= 4) {
    currentTenses.push("third_person");
    regBase = word.slice(0, -2); // watches -> watch
  } else if (word.endsWith("s") && word.length >= 3 && !word.endsWith("ss")) {
    currentTenses.push("third_person");
    regBase = word.slice(0, -1); // plays -> play
  }

  if (regBase && regBase.length >= 2) {
    const past = getRegularPast(regBase);
    const pp = past;
    const presentPart = getPresentParticiple(regBase);
    const third = getThirdPersonSingular(regBase);

    if (currentTenses.length === 0) currentTenses.push("base");
    const { en, ar } = getTenseLabels(currentTenses);

    return {
      base: regBase,
      past,
      pastParticiple: pp,
      presentParticiple: presentPart,
      thirdPerson: third,
      currentTenses,
      tenseLabelEn: en,
      tenseLabelAr: ar,
      isIrregular: false,
    };
  }

  return null;
}
