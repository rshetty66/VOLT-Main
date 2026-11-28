import { zipSync, strToU8 } from "fflate";
import { describe, expect, it } from "vitest";
import { ZIP_LIMITS, extractForLibrary } from "../server/attachments";

const MAX = 2_000_000;

describe("knowledge base: any file type", () => {
  it("keeps audio and video (.mov, .mp3) with a searchable label instead of refusing them", async () => {
    const mov = await extractForLibrary("Board walkthrough.MOV", new Uint8Array(2048).fill(7), MAX);
    expect(mov.note).toBe("Video: stored, not transcribed");
    expect(mov.text).toContain("Board walkthrough.MOV");
    const mp3 = await extractForLibrary("cfo-call.mp3", new Uint8Array([1, 2, 3]), MAX);
    expect(mp3.note).toBe("Audio: stored, not transcribed");
  });

  it("keeps an unknown type, and a document with no readable text, with a label", async () => {
    expect((await extractForLibrary("model.bin", new Uint8Array([0, 1]), MAX)).note).toBe(".bin file: stored, not read");
    expect((await extractForLibrary("noext", new Uint8Array([0, 1]), MAX)).note).toBe("File: stored, not read");
    const pdf = await extractForLibrary("scan.pdf", strToU8("not a pdf"), MAX);
    expect(pdf.note).toBe("Stored, text not read");
    expect(pdf.text).toContain("not a valid PDF");
  });

  it("still reads documents, and reads html and xml as text", async () => {
    const csv = await extractForLibrary("tb.csv", strToU8("account,balance\n1000,25"), MAX);
    expect(csv.note).toBeUndefined();
    expect(csv.text).toContain("1000,25");
    expect((await extractForLibrary("p.html", strToU8("<html><title>T</title><body><p>Close in five days</p></body></html>"), MAX)).text).toContain("Close in five days");
    expect((await extractForLibrary("c.xml", strToU8("<a>IFRS 17</a>"), MAX)).text).toContain("IFRS 17");
  });

  it("unpacks a zip in memory and reads the documents inside; media, images and nested zips are listed, not read", async () => {
    const zip = zipSync({
      "pack/tb.csv": strToU8("account,balance\n4000,99"),
      "pack/notes.md": strToU8("# Close notes\nAccruals are late"),
      "pack/clip.mov": new Uint8Array(10),
      "pack/chart.png": new Uint8Array(10),
      "inner.zip": zipSync({ "x.txt": strToU8("hidden") }),
      "__MACOSX/._tb.csv": new Uint8Array(4),
    });
    const out = await extractForLibrary("close-pack.zip", zip, MAX);
    expect(out.text).toContain("## File: pack/tb.csv");
    expect(out.text).toContain("4000,99");
    expect(out.text).toContain("Accruals are late");
    expect(out.text).toContain("pack/clip.mov");
    expect(out.text).not.toContain("hidden");
    expect(out.text).not.toContain("__MACOSX");
    expect(out.note).toBe("Zip: 2 of 5 files read");
  });

  it("guards against path traversal names and zip bombs", async () => {
    const zip = zipSync({ "../../etc/evil.txt": strToU8("payload"), "/abs/root.txt": strToU8("root") });
    const out = await extractForLibrary("t.zip", zip, MAX);
    expect(out.text).toContain("## File: etc/evil.txt");
    expect(out.text).not.toContain("../");
    // 30 MB of zeros packs to a few KB; over the per-entry limit it is never unpacked.
    const bomb = zipSync({ "zeros.txt": new Uint8Array(ZIP_LIMITS.entryBytes + 1) }, { level: 9 });
    expect(bomb.length).toBeLessThan(100_000);
    const b = await extractForLibrary("bomb.zip", bomb, MAX);
    expect(b.text).toContain("over the zip limits");
    expect(b.note).toBe("Zip: stored, no readable documents inside");
  });

  it("keeps a damaged zip with a label", async () => {
    expect((await extractForLibrary("bad.zip", strToU8("PK not really"), MAX)).note).toBe("Zip: stored, could not be opened");
  });

  it("refuses an empty file", async () => {
    await expect(extractForLibrary("a.mov", new Uint8Array(0), MAX)).rejects.toMatchObject({ code: "empty" });
  });
});
