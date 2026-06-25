import { describe, expect, it } from "vitest";
import { parseMentions, mentionNames } from "@/lib/mention-parser";

describe("parseMentions", () => {
  it("extracts a single @Name", () => {
    const result = parseMentions("Called @Mom today");
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe("Mom");
  });

  it("extracts multiple @mentions", () => {
    const names = mentionNames("Met @Ana and @Carlos today");
    expect(names).toContain("Ana");
    expect(names).toContain("Carlos");
    expect(names).toHaveLength(2);
  });

  it("ignores email@address.com", () => {
    const result = parseMentions("email@example.com is not a mention");
    expect(result).toHaveLength(0);
  });

  it("two-word mention @Ana Duarte", () => {
    const result = parseMentions("Working with @Ana Duarte on the wedding");
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe("Ana Duarte");
  });

  it("does not consume second word if lowercase", () => {
    const result = parseMentions("Talked with @Ana and @Bob");
    expect(result).toHaveLength(2);
    expect(result[0]!.name).toBe("Ana");
    expect(result[1]!.name).toBe("Bob");
  });

  it("@mention at start of string", () => {
    const result = parseMentions("@Mom called");
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe("Mom");
    expect(result[0]!.start).toBe(0);
  });

  it("deduplicates same name", () => {
    const result = parseMentions("@Ana is great. Thanks @Ana!");
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe("Ana");
  });

  it("returns empty array for empty string", () => {
    expect(parseMentions("")).toHaveLength(0);
  });

  it("returns empty array when no @ present", () => {
    expect(parseMentions("hello world no mentions here")).toHaveLength(0);
  });

  it("records correct start and end positions", () => {
    const result = parseMentions("Hello @World");
    expect(result[0]!.start).toBe(6);
    expect(result[0]!.end).toBe(12);
  });

  it("two-word form records end after second word", () => {
    const result = parseMentions("@Ana Duarte rocks");
    expect(result[0]!.start).toBe(0);
    expect(result[0]!.end).toBe(11); // "@Ana Duarte" = 11 chars
  });

  it("does not match purely numeric names", () => {
    // @123 won't match because name must start with a letter
    const result = parseMentions("@123 not a mention");
    expect(result).toHaveLength(0);
  });

  it("handles mention followed by punctuation", () => {
    const result = parseMentions("Thanks @Ana!");
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe("Ana");
  });

  it("extracts mention from middle of sentence", () => {
    const result = parseMentions("Had lunch with @Carlos yesterday");
    expect(result[0]!.name).toBe("Carlos");
  });

  it("multiple mentions including a two-word form", () => {
    const names = mentionNames("Met @Ana Duarte and @Bob today");
    expect(names).toContain("Ana Duarte");
    expect(names).toContain("Bob");
    expect(names).toHaveLength(2);
  });

  // Bracket form @[Full Name] — inserted by the mention picker for names with spaces
  it("extracts bracket-form @[Full Name]", () => {
    const result = parseMentions("Worked with @[Ana Duarte] today");
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe("Ana Duarte");
  });

  it("bracket-form records correct start and end positions", () => {
    const result = parseMentions("Met @[Ana Duarte] yesterday");
    expect(result[0]!.start).toBe(4);
    expect(result[0]!.end).toBe(17); // "@[Ana Duarte]" = 13 chars, starts at 4
  });

  it("bracket-form deduplicates same name", () => {
    const result = parseMentions("@[Ana Duarte] and @[Ana Duarte] again");
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe("Ana Duarte");
  });

  it("mixes bracket-form and bare-form mentions", () => {
    const names = mentionNames("With @[Ana Duarte] and @Bob");
    expect(names).toContain("Ana Duarte");
    expect(names).toContain("Bob");
    expect(names).toHaveLength(2);
  });

  it("bracket-form at start of string", () => {
    const result = parseMentions("@[Ana Duarte] reviewed this");
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe("Ana Duarte");
    expect(result[0]!.start).toBe(0);
  });

  it("bracket-form with three-word name", () => {
    const result = parseMentions("Thanks @[Mary Jane Watson]");
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe("Mary Jane Watson");
  });

  it("ignores empty brackets @[]", () => {
    const result = parseMentions("@[] is not a mention");
    expect(result).toHaveLength(0);
  });
});
