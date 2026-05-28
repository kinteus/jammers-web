import Link from "next/link";

import { pick, type Locale } from "@/lib/i18n";

import { BrandLogo } from "@/components/brand-logo";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { SignInLink } from "@/components/sign-in-link";
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
  const navLinkClass =
    "inline-block border-b-2 border-transparent py-2 text-sm font-bold text-sand/78 transition duration-200 hover:border-gold hover:text-gold active:translate-y-0.5";
  const primaryLinks = [
    { href: "/", label: pick(locale, { en: "Home", ru: "Главная" }) },
    { href: "/archive", label: pick(locale, { en: "Setlists", ru: "Сетлисты" }) },
    { href: "/about", label: pick(locale, { en: "About Us", ru: "О нас" }) },
    { href: "/faq", label: pick(locale, { en: "FAQ", ru: "FAQ" }) },
  ];

  return (
    <header className="header-stage sticky top-0 z-50 border-b border-white/10 text-white shadow-[0_18px_46px_rgba(0,0,0,0.42)]">
      <div className="h-1 w-full stage-rule" />
      <div className="mx-auto max-w-[1440px] px-5 py-3 md:px-6">
        <div className="grid items-center gap-4 md:grid-cols-[260px_minmax(0,1fr)_auto]">
          <div className="flex items-center justify-between gap-4">
            <Link className="block" href="/">
              <BrandLogo className="max-w-[180px] md:max-w-[230px]" priority variant="dark" />
            </Link>
            <div className="md:hidden">
              <LocaleSwitcher locale={locale} />
            </div>
          </div>

          <nav className="flex flex-wrap items-center gap-x-6 gap-y-1 md:justify-center">
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

          <div className="hidden items-center justify-end gap-3 md:flex">
            <LocaleSwitcher locale={locale} />
            {user ? (
              <Button
                asChild
                className="min-h-11 border-white/18 bg-white/8 px-4 text-white hover:border-gold/28 hover:bg-white/12"
                size="sm"
                variant="secondary"
              >
                <Link href="/profile">
                  {user.telegramUsername
                    ? `@${user.telegramUsername}`
                    : user.fullName ?? pick(locale, { en: "Profile", ru: "Профиль" })}
                </Link>
              </Button>
            ) : (
              <SignInLink>
                <Button className="min-h-11 px-5 shadow-glow" size="sm" variant="primary">
                  {pick(locale, { en: "Sign in", ru: "Войти" })}
                </Button>
              </SignInLink>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
