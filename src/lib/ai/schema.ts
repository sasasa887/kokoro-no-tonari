import { z } from "zod";

export const EMOTIONS = ["happy", "calm", "concerned", "thinking", "cheer"] as const;
export type Emotion = (typeof EMOTIONS)[number];

/** 対話の返答。crisis と emotion を先に出させ、reply を最後にしてストリーミング表示する。 */
export const ChatOutputSchema = z.object({
  crisis: z.boolean(),
  emotion: z.enum(EMOTIONS),
  reply: z.string(),
});
export type ChatOutput = z.infer<typeof ChatOutputSchema>;

export const CHAT_OUTPUT_JSON_SCHEMA = {
  type: "object",
  properties: {
    crisis: { type: "boolean" },
    emotion: { type: "string", enum: [...EMOTIONS] },
    reply: { type: "string" },
  },
  required: ["crisis", "emotion", "reply"],
  additionalProperties: false,
} as const;

export const TAGS = ["仕事", "学業", "人間関係", "健康", "生活", "その他"] as const;

export const ReflectionSchema = z.object({
  summary: z.string(),
  insights: z.array(z.string()),
  next_step: z.string(),
  mood_estimate: z.number().int().min(1).max(5),
  tags: z.array(z.enum(TAGS)),
});
export type Reflection = z.infer<typeof ReflectionSchema>;

export const ChatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(2000),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

/** AIに送るのは直近20発言まで（企画書「AI設計」：費用を抑える） */
export const MAX_HISTORY = 20;

export function trimHistory(messages: ChatMessage[]): ChatMessage[] {
  let trimmed = messages.slice(-MAX_HISTORY);
  // API の制約：最初のメッセージは user にする
  while (trimmed.length > 0 && trimmed[0].role !== "user") trimmed = trimmed.slice(1);
  return trimmed;
}
