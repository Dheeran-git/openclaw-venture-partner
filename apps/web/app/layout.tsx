import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OpenClaw Venture Partner",
  description: "Autonomous AI deal-flow agent.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-bg-page text-fg-primary font-sans">
        {children}
      </body>
    </html>
  );
}
