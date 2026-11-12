import { describe, expect, it } from "vitest";
import { parseImportFile } from "./import";

describe("parseImportFile", () => {
  it("parses CSV with header correctly", () => {
    const csv = `Word,Translation,SourceLang,TargetLang,Box,Sentence,SourceTitle,SourceURL\n"Integrity","نزاهة","en","ar","2","He has integrity","Ted","https://youtube.com"`;
    const rows = parseImportFile(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.text).toBe("Integrity");
    expect(rows[0]!.translation).toBe("نزاهة");
    expect(rows[0]!.sentence).toBe("He has integrity");
  });

  it("parses Anki tab-separated values", () => {
    const tsv = `Redundancy\tتكرار\tAvoid data redundancy\nOverwhelmed\tمذهول`;
    const rows = parseImportFile(tsv);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.text).toBe("Redundancy");
    expect(rows[0]!.translation).toBe("تكرار");
    expect(rows[0]!.sentence).toBe("Avoid data redundancy");
    expect(rows[1]!.text).toBe("Overwhelmed");
    expect(rows[1]!.translation).toBe("مذهول");
  });

  it("parses simple dash or colon lists", () => {
    const list = `Apple - تفاحة\nBanana : موز`;
    const rows = parseImportFile(list);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.text).toBe("Apple");
    expect(rows[0]!.translation).toBe("تفاحة");
    expect(rows[1]!.text).toBe("Banana");
    expect(rows[1]!.translation).toBe("موز");
  });
});
