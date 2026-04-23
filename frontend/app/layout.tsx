import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/auth-context";
import "./globals.css";

// Editorial serif for display (page titles + numeric KPIs). DESIGN.md §3.2.
const newsreader = Newsreader({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

// Body / UI — Geist handles ~95% of text.
const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

// Data only — times, IDs, counts, timestamps.
const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "MediSlot",
  description: "Medical appointment scheduling — clinical, quiet, exacting.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${newsreader.variable} ${geistSans.variable} ${geistMono.variable}`}
    >
      <body className="min-h-screen flex flex-col bg-surface-page text-text-body">
        <AuthProvider>
          {/* Top nav — 56px, sticky, hairline divider. DESIGN.md §4 layout shell. */}
          <header className="h-topnav sticky top-0 z-20 bg-surface-raised border-b border-border">
            <nav className="mx-auto flex h-full max-w-content items-center justify-between px-6">
              <Link
                href="/"
                className="flex items-center gap-2.5 text-text-primary no-underline"
              >
                <span
                  aria-hidden
                  className="relative block h-[22px] w-[22px] shrink-0 rounded-[5px] bg-primary-700"
                >
                  {/* inline plus glyph, matches shared.css .brand-mark */}
                  <span className="absolute left-[6px] top-[10px] h-[2px] w-[10px] rounded-[1px] bg-white" />
                  <span className="absolute left-[10px] top-[6px] h-[10px] w-[2px] rounded-[1px] bg-white" />
                </span>
                <span
                  className="font-display text-md font-medium"
                  style={{ letterSpacing: "-0.015em" }}
                >
                  Medi
                  <em className="font-normal italic text-primary-600">Slot</em>
                </span>
              </Link>

              <ul className="flex items-center gap-5 text-sm text-text-body">
                <li>
                  <Link
                    href="/doctors"
                    className="text-text-body no-underline transition-colors hover:text-text-primary"
                  >
                    Find a doctor
                  </Link>
                </li>
                <li>
                  <Link
                    href="/appointments"
                    className="text-text-body no-underline transition-colors hover:text-text-primary"
                  >
                    My appointments
                  </Link>
                </li>
                <li>
                  <Link
                    href="/login"
                    className="inline-flex h-[34px] items-center justify-center rounded-md border border-border-strong bg-surface-raised px-3.5 text-sm font-medium text-text-primary no-underline transition-colors hover:bg-neutral-50"
                  >
                    Sign in
                  </Link>
                </li>
              </ul>
            </nav>
          </header>

          <main className="mx-auto w-full max-w-content flex-1 px-6 py-12">
            {children}
          </main>

          {/* Toasts — bottom-right stack, tinted. DESIGN.md §4 Toast. */}
          <Toaster
            richColors
            position="bottom-right"
            toastOptions={{
              style: {
                fontFamily: "var(--font-sans)",
                borderRadius: "var(--radius-md)",
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
