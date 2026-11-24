import { describe, expect, it } from "vitest";
import { ageFromBirthMonth, isEligibleAge } from "./age";

const today = new Date(2026, 10, 24); // 2026-11-24

describe("ageFromBirthMonth", () => {
  it("誕生月に入った時点で加齢する", () => {
    expect(ageFromBirthMonth("2008-11", today)).toBe(18);
    expect(ageFromBirthMonth("2008-12", today)).toBe(17);
    expect(ageFromBirthMonth("2008-10", today)).toBe(18);
  });

  it("形式が不正なら例外を投げる", () => {
    expect(() => ageFromBirthMonth("2008/11", today)).toThrow();
    expect(() => ageFromBirthMonth("2008-13", today)).toThrow();
  });
});

describe("isEligibleAge", () => {
  it("18歳以上だけを通す", () => {
    expect(isEligibleAge("2008-11", today)).toBe(true);
    expect(isEligibleAge("2008-12", today)).toBe(false);
    expect(isEligibleAge("1990-04", today)).toBe(true);
  });

  it("未来や現実離れした生年月は通さない", () => {
    expect(isEligibleAge("2030-01", today)).toBe(false);
    expect(isEligibleAge("1880-01", today)).toBe(false);
  });
});
