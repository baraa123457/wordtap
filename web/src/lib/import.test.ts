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

  it("swaps inverted pairs where column 1 is Arabic and column 2 is English", () => {
    const list = `متوافق\tCompatible\nنزاهة - Integrity`;
    const rows = parseImportFile(list);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.text).toBe("Compatible");
    expect(rows[0]!.translation).toBe("متوافق");
    expect(rows[0]!.src_lang).toBe("en");
    expect(rows[0]!.target_lang).toBe("ar");

    expect(rows[1]!.text).toBe("Integrity");
    expect(rows[1]!.translation).toBe("نزاهة");
    expect(rows[1]!.src_lang).toBe("en");
    expect(rows[1]!.target_lang).toBe("ar");
  });
});
