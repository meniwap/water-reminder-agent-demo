import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AquaTrack – תזכורת שתייה יומית",
  description: "עקוב אחר כמות המים שאתה שותה כל יום עם AquaTrack",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
