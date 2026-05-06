import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OpenClaw Venture Partner",
  description: "Autonomous AI deal-flow agent for freelancers and small agencies.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="dark">
      <body>
        <a href="#main" className="oc-skip-link">
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
