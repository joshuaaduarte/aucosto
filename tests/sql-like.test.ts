import { describe, expect, it } from "vitest";
import { likeLiteral } from "@/lib/sql-like";

describe("likeLiteral", () => {
  it("escapes LIKE wildcards and the escape character", () => {
    expect(likeLiteral("__")).toBe("\\_\\_");
    expect(likeLiteral("__pay__:")).toBe("\\_\\_pay\\_\\_:");
    expect(likeLiteral("50%\\off")).toBe("50\\%\\\\off");
    expect(likeLiteral("Flexible")).toBe("Flexible");
  });
});
