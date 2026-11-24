import { describe, expect, it } from "vitest";
import { parseChatOutput } from "./claude";
import { ReplyExtractor } from "./reply-extractor";
import { trimHistory, type ChatMessage } from "./schema";

function feed(chunks: string[]): string {
  const ex = new ReplyExtractor();
  return chunks.map((c) => ex.push(c)).join("");
}

describe("ReplyExtractor", () => {
  const full = JSON.stringify({ crisis: false, emotion: "calm", reply: "つらかったね。\n\"何が\"一番？ ✨" });

  it("一度に渡しても reply だけを取り出す", () => {
    expect(feed([full])).toBe("つらかったね。\n\"何が\"一番？ ✨");
  });

  it("1文字ずつ渡しても同じ結果になる（エスケープの途中で切れても壊れない）", () => {
    expect(feed(full.split(""))).toBe("つらかったね。\n\"何が\"一番？ ✨");
  });

  it("\\u エスケープが分割されても復元する", () => {
    const raw = '{"crisis":false,"emotion":"calm","reply":"a\\u3042b"}';
    expect(feed([raw.slice(0, 44), raw.slice(44)])).toBe("aあb");
  });

  it("reply が終わった後の文字は出さない", () => {
    expect(feed(['{"crisis":true,"emotion":"concerned","reply":"ok"', "}"])).toBe("ok");
  });
});

describe("parseChatOutput", () => {
  it("スキーマに合う JSON を受け入れる", () => {
    expect(parseChatOutput('{"crisis":true,"emotion":"concerned","reply":"x"}')).toEqual({
      crisis: true,
      emotion: "concerned",
      reply: "x",
    });
  });

  it("形式が違えばエラーにする", () => {
    expect(() => parseChatOutput("not json")).toThrow();
    expect(() => parseChatOutput('{"crisis":"yes","emotion":"calm","reply":"x"}')).toThrow();
    expect(() => parseChatOutput('{"crisis":false,"emotion":"angry","reply":"x"}')).toThrow();
  });
});

describe("trimHistory", () => {
  it("直近20発言に絞り、先頭を user にそろえる", () => {
    const msgs: ChatMessage[] = Array.from({ length: 25 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: String(i),
    }));
    const t = trimHistory(msgs);
    expect(t.length).toBeLessThanOrEqual(20);
    expect(t[0].role).toBe("user");
    expect(t.at(-1)?.content).toBe("24");
  });
});
