import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "中文闪卡 - Chinese Flashcards",
  description: "A spaced repetition learning tool for Chinese characters with stroke practice and character breakdown.",
  keywords: ["Chinese", "Flashcards", "Hanzi", "Pinyin", "Spaced Repetition", "Language Learning", "汉字", "拼音"],
  authors: [{ name: "Chinese Flashcards App" }],
  icons: {
    icon: "/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        {/* Load Chinese fonts for proper character display */}
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;600;700&family=Noto+Serif+SC:wght@400;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground font-sans`}
        style={{
          fontFamily: "'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', 'SimHei', sans-serif",
        }}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
