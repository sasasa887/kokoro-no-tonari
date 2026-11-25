/** 対象年齢（企画書：18歳以上に限定） */
export const MIN_AGE = 18;
export const MAX_AGE = 120;

/** 日本時間での年と月（サーバーが UTC でも、利用者の暦に合わせて判定する） */
export function tokyoYearMonth(date: Date): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "numeric",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month") };
}

/**
 * 生年月（"YYYY-MM"）から、基準日時点（日本時間）の満年齢を返す。
 * 日は分からないため、誕生月の1日生まれとみなす（同じ月に入った時点で加齢）。
 */
export function ageFromBirthMonth(birthMonth: string, today: Date = new Date()): number {
  const match = /^(\d{4})-(\d{2})$/.exec(birthMonth);
  if (!match) throw new Error(`生年月の形式が不正です: ${birthMonth}`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) throw new Error(`月が不正です: ${birthMonth}`);

  const now = tokyoYearMonth(today);
  let age = now.year - year;
  if (now.month < month) age -= 1;
  return age;
}

export function isEligibleAge(birthMonth: string, today: Date = new Date()): boolean {
  const age = ageFromBirthMonth(birthMonth, today);
  // 未来の日付や現実離れした値は不可
  if (age < 0 || age > MAX_AGE) return false;
  return age >= MIN_AGE;
}
