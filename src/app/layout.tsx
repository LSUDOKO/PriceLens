import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SeedProvider } from "./seed-provider";
import { ThemeToggle } from "./theme-toggle";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PriceLens — Multi-Product Price Comparison",
  description: "Compare prices across Shopee, Lazada, Amazon, airlines, hotels, and events. Find the best deals with AI-powered MCP integration.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <head>
        <script dangerouslySetInnerHTML={{
          __html: `
            (function() {
              try {
                var theme = localStorage.getItem('pricelens-theme');
                if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.classList.add('dark');
                }
              } catch(e) {}
            })();
          `,
        }} />
      </head>
      <body className="min-h-full bg-background text-foreground antialiased">
        <SeedProvider />
        <ThemeToggle />
        <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-lg">
          <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
            <div className="flex items-center gap-6">
              <a href="/" className="flex items-center gap-2 font-semibold text-lg tracking-tight">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-xs font-bold text-white">
                  PL
                </span>
                PriceLens
              </a>
              <div className="hidden sm:flex items-center gap-1">
                <NavLink href="/" label="Price Explorer" />
                <NavLink href="/heatmap" label="Compare" />
                <NavLink href="/alerts" label="Alerts" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <a
                href="https://github.com/LSUDOKO/PriceLens"
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted hover:text-foreground transition-colors"
              >
                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                GitHub
              </a>
              <div className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
                </span>
                DynamoDB
              </div>
            </div>
          </div>
          {/* Mobile nav */}
          <div className="flex sm:hidden border-t border-border px-4 py-2 gap-2">
            <MobileNavLink href="/" label="Explorer" />
            <MobileNavLink href="/heatmap" label="Compare" />
            <MobileNavLink href="/alerts" label="Alerts" />
          </div>
        </nav>
        <main className="mx-auto max-w-7xl px-4 sm:px-6 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="rounded-md px-3 py-1.5 text-sm font-medium text-muted hover:text-foreground hover:bg-secondary transition-colors"
    >
      {label}
    </a>
  );
}

function MobileNavLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="flex-1 text-center rounded-md px-2 py-1.5 text-xs font-medium text-muted hover:text-foreground hover:bg-secondary transition-colors"
    >
      {label}
    </a>
  );
}
