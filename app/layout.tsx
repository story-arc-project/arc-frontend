import type { Metadata } from "next";
import "./globals.css";

import { ToastContainer } from "@/components/ui";
import AuthProvider from "@/contexts/AuthContext";

export const metadata: Metadata = {
  title: "ARC",
  description: "포트폴리오 아카이빙 및 AI 연계 자동화 플랫폼",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-dynamic-subset.css"
        />
      </head>
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          {children}
          {/* 앱 전역 토스트 표시 지점 — (auth)·(main) 모두 커버 (FRT-45). */}
          <ToastContainer />
        </AuthProvider>
      </body>
    </html>
  );
}
