import { describe, expect, it } from "vitest";
import { detectCrisisKeywords } from "./crisis";

describe("detectCrisisKeywords", () => {
  it.each([
    "もう死にたい",
    "消えたいって思うことがある",
    "朝が来なければいいのに",
    "生きてても意味ないよね",
    "いなくなりたい",
    "自分を傷つけたくなる",
    "し に た い",
  ])("危機として検知する：%s", (text) => {
    expect(detectCrisisKeywords(text)).toBe(true);
  });

  it.each([
    "死ぬほど眠い",
    "今日は死ぬほど忙しかった",
    "上司に怒られて落ち込んだ",
    "試験が不安で眠れない",
    "消えたいほど恥ずかしいミスをした",
  ])("危機ではない言い回しは検知しない：%s", (text) => {
    expect(detectCrisisKeywords(text)).toBe(false);
  });

  it("危機ではない言い回しと危機の言葉が両方ある場合は検知する", () => {
    expect(detectCrisisKeywords("死ぬほど疲れた。もう死にたい")).toBe(true);
  });
});
