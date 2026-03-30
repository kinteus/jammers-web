import Link from "next/link";

import { signOutAction } from "@/server/actions";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type SiteHeaderProps = {
  user: {
    role: "USER" | "ADMIN";
    telegramUsername: string | null;
    fullName: string | null;
  } | null;
};

export function SiteHeader({ user }: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-ink/10 bg-sand/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <Link className="font-display text-xl font-bold tracking-tight text-ink" href="/">
            Jammers Setlist
          </Link>
          <Badge className="hidden md:inline-flex">Concert Planning Board</Badge>
        </div>

        <nav className="flex items-center gap-3">
          <Link className="text-sm font-medium text-ink/70 hover:text-ink" href="/">
            Events
          </Link>
          {user ? (
            <>
              <Link className="text-sm font-medium text-ink/70 hover:text-ink" href="/profile">
                My space
              </Link>
              {user.role === "ADMIN" ? (
                <Link className="text-sm font-medium text-ink/70 hover:text-ink" href="/admin">
                  Admin
                </Link>
              ) : null}
              <form action={signOutAction}>
                <Button size="sm" variant="secondary" type="submit">
                  {user.telegramUsername ? `@${user.telegramUsername}` : user.fullName ?? "Sign out"}
                </Button>
              </form>
            </>
          ) : (
            <Link href="/profile">
              <Button size="sm" variant="accent">
                Sign in
              </Button>
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
