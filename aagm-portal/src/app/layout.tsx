import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AAGM Portal — Subsidy & Income Guarantee",
  description:
    "Internal operations portal for Anesthesia Associates of Greater Miami",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <div className="flex min-h-screen flex-col">
          <header className="sticky top-0 z-50 border-b border-border bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
            <div className="mx-auto flex h-14 max-w-screen-2xl items-center justify-between px-6">
              <a href="/dashboard" className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
                  AG
                </div>
                <div>
                  <span className="text-sm font-semibold tracking-tight text-foreground">
                    AAGM Portal
                  </span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    Subsidy & Income Guarantee
                  </span>
                </div>
              </a>
              <nav className="flex items-center gap-1">
                <a
                  href="/dashboard"
                  className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  Dashboard
                </a>
                <a
                  href="/settings/contracts"
                  className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  Contracts
                </a>
              </nav>
            </div>
          </header>
          <main className="flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}
