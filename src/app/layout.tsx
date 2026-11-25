import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ココロのとなり",
  description: "AIのコーチに話して、モヤモヤを整理するアプリ",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body className="antialiased">
        <div className="mx-auto flex min-h-dvh max-w-md flex-col px-4">{children}</div>
        <footer className="mx-auto max-w-md px-4 pb-4 text-center text-xs text-muted">
          このアプリは医療行為ではありません。
        </footer>
      </body>
    </html>
  );
}
