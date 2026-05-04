import type { Metadata } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/auth-context";
import { ActiveDoctorProvider } from "@/lib/active-doctor-context";
import { TopNav } from "@/components/ui/TopNav";
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
      <body className="flex min-h-screen flex-col bg-surface-page text-text-body">
        <AuthProvider>
          <ActiveDoctorProvider>
            <TopNav />

            <main className="mx-auto flex-1 w-full max-w-content px-6 py-12">
              {children}
            </main>

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
          </ActiveDoctorProvider>
        </AuthProvider>
      </body>
    </html>
  );
}