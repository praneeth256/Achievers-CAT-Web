import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/AppShell";
import { Analytics } from "@vercel/analytics/next";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "ACHIEVERS CAT — Prepare smarter for CAT",
  description:
    "Daily practice, sectional and full mocks, and study materials for CAT aspirants. Track your streak, attempt CAT-pattern mocks, and download your scorecard.",
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="antialiased flex min-h-screen flex-col">
        <AppShell>{children}</AppShell>
        <Analytics />
      </body>
    </html>
  );
}
