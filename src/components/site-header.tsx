import Link from "next/link";

import { pick, type Locale } from "@/lib/i18n";
import { signOutAction } from "@/server/actions";

import { BrandLogo } from "@/components/brand-logo";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { SignInLink } from "@/components/sign-in-link";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";

type SiteHeaderProps = {
  locale: Locale;
  user: {
    role: "USER" | "ADMIN";
    telegramUsername: string | null;
    fullName: string | null;
  } | null;
};

export function SiteHeader({ locale, user }: SiteHeaderProps) {
  const navLinkClass =
    "inline-block text-sm font-semibold text-white/82 transition duration-200 hover:text-gold active:translate-y-0.5 active:text-white";
  const primaryLinks = [
    { href: "/", label: pick(locale, { en: "Home", ru: "Главная" }) },
    { href: "/#published", label: pick(locale, { en: "Setlists", ru: "Сетлисты" }) },
    { href: "/about", label: pick(locale, { en: "About Us", ru: "О нас" }) },
    { href: "/faq", label: pick(locale, { en: "FAQ", ru: "FAQ" }) },
  ];

  return (
    <header className="header-stage sticky top-0 z-50 border-b border-white/10 text-white shadow-[0_18px_46px_rgba(0,0,0,0.42)] backdrop-blur">
      <div className="h-1 w-full stage-rule" />
      <div className="mx-auto max-w-[1440px] px-5 py-4 md:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center justify-between gap-4 sm:block">
            <Link className="block" href="/">
              <BrandLogo className="max-w-[180px] sm:max-w-[240px]" variant="dark" />
            </Link>
            <div className="sm:hidden">
              <LocaleSwitcher locale={locale} />
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:items-end">
            <div className="hidden sm:flex sm:flex-wrap sm:items-center sm:justify-end sm:gap-4">
              <LocaleSwitcher locale={locale} />
              {user ? (
                <>
                  <span className="border-l border-white/14 pl-4 text-sm text-white/72">
                    {user.telegramUsername
                      ? `@${user.telegramUsername}`
                      : user.fullName ?? pick(locale, { en: "Signed in", ru: "В системе" })}
                  </span>
                  <form action={signOutAction}>
                    <SubmitButton
                      className="border-white/18 bg-white/8 text-white hover:border-gold/28 hover:bg-white/12"
                      pendingLabel={pick(locale, { en: "Signing out...", ru: "Выходим..." })}
                      size="sm"
                      type="submit"
                      variant="secondary"
                    >
                      {pick(locale, { en: "Sign out", ru: "Выйти" })}
                    </SubmitButton>
                  </form>
                </>
              ) : (
                <SignInLink>
                  <Button className="shadow-glow" size="sm" variant="primary">
                    {pick(locale, { en: "Sign in", ru: "Войти" })}
                  </Button>
                </SignInLink>
              )}
            </div>

            <div className="flex items-center justify-between gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
              <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 sm:justify-end sm:gap-4">
                {primaryLinks.map((link) => (
                  <Link className={navLinkClass} href={link.href} key={link.href}>
                    {link.label}
                  </Link>
                ))}
                {user ? (
                  <>
                    <Link className={navLinkClass} href="/profile">
                      {pick(locale, { en: "Profile", ru: "Профиль" })}
                    </Link>
                    {user.role === "ADMIN" ? (
                      <Link className={navLinkClass} href="/admin">
                        Admin
                      </Link>
                    ) : null}
                  </>
                ) : null}
              </nav>

              <div className="flex shrink-0 items-center gap-3 sm:hidden">
                {user ? (
                  <>
                    <span className="hidden truncate text-sm text-white/72 min-[480px]:inline">
                      {user.telegramUsername
                        ? `@${user.telegramUsername}`
                        : user.fullName ?? pick(locale, { en: "Signed in", ru: "В системе" })}
                    </span>
                    <form action={signOutAction}>
                      <SubmitButton
                        className="border-white/18 bg-white/8 text-white hover:border-gold/28 hover:bg-white/12"
                        pendingLabel={pick(locale, { en: "Signing out...", ru: "Выходим..." })}
                        size="sm"
                        type="submit"
                        variant="secondary"
                      >
                        {pick(locale, { en: "Sign out", ru: "Выйти" })}
                      </SubmitButton>
                    </form>
                  </>
                ) : (
                  <SignInLink>
                    <Button className="shadow-glow" size="sm" variant="primary">
                      {pick(locale, { en: "Sign in", ru: "Войти" })}
                    </Button>
                  </SignInLink>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
