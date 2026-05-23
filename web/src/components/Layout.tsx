import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { Menu, X, Mic, Github } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useUserStore } from "@/store/userStore";
import type { Lang } from "@/lib/api";
import { UserMenu } from "@/components/UserMenu";

const NAV_ITEMS = [
  { to: "/", label: "Home", end: true },
  { to: "/test", label: "Free Test" },
  { to: "/practice", label: "Practice" },
  { to: "/pinyin", label: "Pinyin Chart" },
  { to: "/dashboard", label: "Dashboard" },
];

const LANGS: { code: Lang; label: string }[] = [
  { code: "uz", label: "O'z" },
  { code: "ru", label: "Ру" },
  { code: "en", label: "EN" },
];

export function Layout() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const language = useUserStore((s) => s.language);
  const setLanguage = useUserStore((s) => s.setLanguage);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground font-chinese text-lg">声</span>
            <span className="text-lg tracking-tight">ShengAI</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <div className="hidden items-center rounded-lg border border-border bg-secondary/40 p-0.5 sm:flex">
              {LANGS.map((l) => (
                <button
                  key={l.code}
                  onClick={() => setLanguage(l.code)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-semibold transition-colors",
                    language === l.code
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  aria-pressed={language === l.code}
                >
                  {l.label}
                </button>
              ))}
            </div>

            <Button asChild size="sm" className="hidden sm:inline-flex">
              <Link to="/test">
                <Mic className="h-4 w-4" />
                Try Free
              </Link>
            </Button>

            <div className="hidden md:block">
              <UserMenu />
            </div>

            <button
              onClick={() => setOpen((o) => !o)}
              className="rounded-md p-2 text-muted-foreground hover:bg-secondary md:hidden"
              aria-label="Toggle navigation"
              aria-expanded={open}
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {open && (
          <div className="border-t border-border/60 md:hidden">
            <div className="container flex flex-col gap-1 py-3">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      "rounded-md px-3 py-2 text-sm font-medium",
                      isActive
                        ? "bg-secondary text-foreground"
                        : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                    )
                  }
                >
                  {item.label}
                </NavLink>
              ))}
              <div className="mt-2 flex items-center gap-1 rounded-lg border border-border bg-secondary/40 p-0.5">
                {LANGS.map((l) => (
                  <button
                    key={l.code}
                    onClick={() => setLanguage(l.code)}
                    className={cn(
                      "flex-1 rounded-md px-2.5 py-1.5 text-xs font-semibold",
                      language === l.code ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                    )}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
              <Button asChild className="mt-2 w-full">
                <Link to="/test">
                  <Mic className="h-4 w-4" />
                  Try Free
                </Link>
              </Button>
              <div className="mt-2">
                <UserMenu compact />
              </div>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-border/60 bg-secondary/30">
        <div className="container flex flex-col items-start gap-6 py-10 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 font-semibold">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground font-chinese">声</span>
              <span>ShengAI</span>
            </div>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Built at <strong>Build with AI EdTech Hackathon 2026</strong> — New Uzbekistan University. Track: General Education.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 hover:text-foreground"
            >
              <Github className="h-4 w-4" /> GitHub
            </a>
            <Link to="/pinyin" className="hover:text-foreground">Pinyin Chart</Link>
            <Link to="/test" className="hover:text-foreground">Free Test</Link>
            <span>© 2026 ShengAI Team</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
