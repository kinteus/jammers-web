import Link from "next/link";

import { pick, type Locale } from "@/lib/i18n";
import { signOutAction } from "@/server/actions";

import { BrandLogo } from "@/components/brand-logo";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Button } from "@/components/ui/button";

type SiteHeaderProps = {
  locale: Locale;
  user: {
    role: "USER" | "ADMIN";
    telegramUsername: string | null;
    fullName: string | null;
  } | null;
};

export function SiteHeader({ locale, user }: SiteHeaderProps) {
  return (
    <header className="header-stage sticky top-0 z-50 border-b border-white/10 text-white shadow-[0_18px_46px_rgba(0,0,0,0.42)] backdrop-blur">
      <div className="h-1 w-full stage-rule" />
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4 px-5 py-4 md:px-6">
        <Link className="block" href="/">
          <BrandLogo className="max-w-[240px]" variant="dark" />
        </Link>

        <nav className="flex flex-wrap items-center justify-end gap-4">
          <LocaleSwitcher locale={locale} />
          <Link className="text-sm font-semibold text-white/82 hover:text-gold" href="/">
            {pick(locale, { en: "Gigs", ru: "Гиги" })}
          </Link>
          <Link className="text-sm font-semibold text-white/82 hover:text-gold" href="/faq">
            {pick(locale, { en: "FAQ", ru: "FAQ" })}
          </Link>
          {user ? (
            <>
              <Link className="text-sm font-semibold text-white/82 hover:text-gold" href="/profile">
                {pick(locale, { en: "Profile", ru: "Профиль" })}
              </Link>
              {user.role === "ADMIN" ? (
                <Link className="text-sm font-semibold text-white/82 hover:text-gold" href="/admin">
                  Admin
                </Link>
              ) : null}
              <span className="border-l border-white/14 pl-4 text-sm text-white/72">
                {user.telegramUsername
                  ? `@${user.telegramUsername}`
                  : user.fullName ?? pick(locale, { en: "Signed in", ru: "В системе" })}
              </span>
              <form action={signOutAction}>
                <Button className="border-white/18 bg-white/8 text-white hover:border-gold/28 hover:bg-white/12" size="sm" type="submit" variant="secondary">
                  {pick(locale, { en: "Sign out", ru: "Выйти" })}
                </Button>
              </form>
            </>
          ) : (
            <Link href="/profile">
              <Button className="shadow-glow" size="sm" variant="primary">
                {pick(locale, { en: "Sign in", ru: "Войти" })}
              </Button>
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
