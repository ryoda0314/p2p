import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "P2P Video Chat",
  description: "WebRTCを使った1対1の低遅延ビデオ通話",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="bg-gray-950 text-gray-100 min-h-screen">
        {children}
      </body>
    </html>
  );
}
