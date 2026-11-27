import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Foundation status | Gyan Agents",
  description: "Finance domain coverage from the Gyan Agents registry.",
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a href="#main" className="skip">Skip to status</a>
        <header className="bar">
          <div className="frame flex items-center justify-between gap-4">
            <span className="wordmark">Gyan <span>Agents</span></span>
            <span className="label">Read-only workspace</span>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
