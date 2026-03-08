import type { Metadata } from "next";
import {
  Geist,
  Geist_Mono,
  Noto_Sans_SC,
  Noto_Serif_SC,
} from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import ServiceWorkerRegister from "@/components/service-worker-register";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const notoSansSC = Noto_Sans_SC({
  variable: "--font-noto-sans-sc",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const notoSerifSC = Noto_Serif_SC({
  variable: "--font-noto-serif-sc",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  title: "中文闪卡 - Chinese Flashcards",
  description:
    "A spaced repetition learning tool for Chinese characters with stroke practice and character breakdown.",
  keywords: [
    "Chinese",
    "Flashcards",
    "Hanzi",
    "Pinyin",
    "Spaced Repetition",
    "Language Learning",
    "汉字",
    "拼音",
  ],
  authors: [{ name: "Chinese Flashcards App" }],
  icons: {
    icon: "/logo.svg",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Chinese Flashcards",
  },
  formatDetection: {
    telephone: false,
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
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <meta name="apple-mobile-web-app-title" content="Chinese Flashcards" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${notoSansSC.variable} ${notoSerifSC.variable} font-chinese-ui antialiased bg-background text-foreground font-sans`}
      >
        <ServiceWorkerRegister />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
