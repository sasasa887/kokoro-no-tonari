/**
 * ストリーミング中の JSON（{"crisis":..,"emotion":..,"reply":"..."}）から、
 * reply の文字列だけを少しずつ取り出す。
 * 構造化出力はスキーマのキー順で出るため、reply が最後に来る前提で
 * 画面には返答の本文だけを流せる。最終的な値は全文を JSON.parse して確定させる。
 */
export class ReplyExtractor {
  private buffer = "";
  private replyStart = -1; // reply の文字列が始まる位置（開きの " の次）
  private cursor = 0; // reply 内で次に読む位置
  private done = false;

  /** 新しい断片を加え、新たに確定した reply の文字列を返す */
  push(chunk: string): string {
    this.buffer += chunk;
    if (this.done) return "";

    if (this.replyStart < 0) {
      const m = /"reply"\s*:\s*"/.exec(this.buffer);
      if (!m) return "";
      this.replyStart = m.index + m[0].length;
      this.cursor = this.replyStart;
    }

    let out = "";
    while (this.cursor < this.buffer.length) {
      const ch = this.buffer[this.cursor];
      if (ch === '"') {
        this.done = true;
        break;
      }
      if (ch === "\\") {
        const next = this.buffer[this.cursor + 1];
        if (next === undefined) break; // エスケープの途中で切れている
        if (next === "u") {
          const hex = this.buffer.slice(this.cursor + 2, this.cursor + 6);
          if (hex.length < 4) break;
          out += String.fromCharCode(parseInt(hex, 16));
          this.cursor += 6;
          continue;
        }
        const map: Record<string, string> = { n: "\n", t: "\t", r: "\r", b: "\b", f: "\f", '"': '"', "\\": "\\", "/": "/" };
        out += map[next] ?? next;
        this.cursor += 2;
        continue;
      }
      out += ch;
      this.cursor += 1;
    }
    return out;
  }

  get text(): string {
    return this.buffer;
  }
}
