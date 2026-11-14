import { describe, expect, it } from "vitest";
import { getVerbConjugation } from "./verbs";

describe("getVerbConjugation", () => {
  it("detects 'left' as past and past participle of 'leave'", () => {
    const res = getVerbConjugation("left");
    expect(res).not.toBeNull();
    expect(res?.base).toBe("leave");
    expect(res?.past).toBe("left");
    expect(res?.pastParticiple).toBe("left");
    expect(res?.presentParticiple).toBe("leaving");
    expect(res?.thirdPerson).toBe("leaves");
    expect(res?.currentTenses).toContain("past");
    expect(res?.currentTenses).toContain("past_participle");
    expect(res?.isIrregular).toBe(true);
  });

  it("detects 'went' as past tense of 'go'", () => {
    const res = getVerbConjugation("went");
    expect(res).not.toBeNull();
    expect(res?.base).toBe("go");
    expect(res?.past).toBe("went");
    expect(res?.pastParticiple).toBe("gone");
    expect(res?.currentTenses).toEqual(["past"]);
  });

  it("detects 'broken' as past participle of 'break'", () => {
    const res = getVerbConjugation("broken");
    expect(res).not.toBeNull();
    expect(res?.base).toBe("break");
    expect(res?.past).toBe("broke");
    expect(res?.pastParticiple).toBe("broken");
    expect(res?.currentTenses).toContain("past_participle");
  });

  it("detects base form 'leave'", () => {
    const res = getVerbConjugation("leave");
    expect(res).not.toBeNull();
    expect(res?.base).toBe("leave");
    expect(res?.past).toBe("left");
    expect(res?.currentTenses).toContain("base");
  });

  it("detects regular verb past tense like 'played'", () => {
    const res = getVerbConjugation("played");
    expect(res).not.toBeNull();
    expect(res?.base).toBe("play");
    expect(res?.past).toBe("played");
    expect(res?.currentTenses).toContain("past");
  });

  it("detects continuous participle like 'leaving'", () => {
    const res = getVerbConjugation("leaving");
    expect(res).not.toBeNull();
    expect(res?.base).toBe("leave");
    expect(res?.currentTenses).toContain("present_participle");
  });
});
