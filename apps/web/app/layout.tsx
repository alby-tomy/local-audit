import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LocalAudit AI",
  description: "Automated website audits and AI-powered fixes for local businesses.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
