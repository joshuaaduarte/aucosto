import { describe, expect, it } from "vitest";
import { detectSlashTrigger, SLASH_COMMANDS } from "@/lib/use-slash-commands";

describe("detectSlashTrigger", () => {
  it("matches a bare slash", () => {
    const value = "/";
    const match = detectSlashTrigger(value, value.length);
    expect(match).toEqual({ start: 0, end: 1, query: "" });
  });

  it("matches a slash with a partial word", () => {
    const value = "/ha";
    const match = detectSlashTrigger(value, value.length);
    expect(match).toEqual({ start: 0, end: 3, query: "ha" });
  });

  it("stops matching once a space follows the command", () => {
    const value = "/do ";
    expect(detectSlashTrigger(value, value.length)).toBeNull();
  });

  it("does not trigger mid-sentence for unrelated slashes", () => {
    const value = "3/4 cup";
    const match = detectSlashTrigger(value, 3);
    expect(match).toEqual({ start: 1, end: 3, query: "4" });
    expect(SLASH_COMMANDS.some((cmd) => cmd.id.startsWith("4"))).toBe(false);
  });

  it("ignores a slash typed inside an unclosed @[mention] bracket", () => {
    const value = "@[John/Doe";
    const match = detectSlashTrigger(value, value.length);
    expect(match).toBeNull();
  });

  it("matches again once the mention bracket is closed", () => {
    const value = "@[John Doe] /do";
    const match = detectSlashTrigger(value, value.length);
    expect(match).toEqual({ start: 12, end: 15, query: "do" });
  });
});
