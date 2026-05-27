import Link from "next/link";

import { pick, type Locale } from "@/lib/i18n";

import { BrandLogo } from "@/components/brand-logo";

export function SiteFooter({ locale }: { locale: Locale }) {
  const links = [
    { href: "/", label: pick(locale, { en: "Home", ru: "Главная" }) },
    { href: "/archive", label: pick(locale, { en: "Setlists", ru: "Сетлисты" }) },
    { href: "/about", label: pick(locale, { en: "About", ru: "О нас" }) },
    { href: "/faq", label: "FAQ" },
  ];

  return (
    <footer className="site-footer text-sand/72">
      <div className="mx-auto max-w-[1440px] px-5 py-8 md:px-6 md:py-10">
        <div className="grid gap-8 md:grid-cols-[minmax(0,1.2fr)_minmax(180px,0.6fr)_minmax(260px,0.8fr)]">
          <div className="space-y-4">
            <Link className="block max-w-[170px]" href="/">
              <BrandLogo variant="dark" />
            </Link>
            <p className="max-w-sm text-sm">
              {pick(locale, {
                en: "Live gig boards for the Cyprus music community.",
                ru: "Живые сетлисты для музыкального коммьюнити Кипра.",
              })}
            </p>
          </div>

          <nav aria-label="Footer" className="space-y-3">
            <h2 className="font-display text-base uppercase text-sand">
              {pick(locale, { en: "Navigate", ru: "Навигация" })}
            </h2>
            <div className="grid gap-2 text-sm">
              {links.map((link) => (
                <Link className="hover:text-gold" href={link.href} key={link.href}>
                  {link.label}
                </Link>
              ))}
            </div>
          </nav>

          <div className="space-y-3">
            <h2 className="font-display text-base uppercase text-sand">
              {pick(locale, { en: "Contact & legal", ru: "Контакты и правила" })}
            </h2>
            <div className="grid gap-2 text-sm">
              <a className="hover:text-gold" href="mailto:maksim.naumov.music@gmail.com">
                maksim.naumov.music@gmail.com
              </a>
              <a className="hover:text-gold" href="https://t.me/kinteus" rel="noreferrer" target="_blank">
                Telegram: @kinteus
              </a>
              <Link className="hover:text-gold" href="/privacy">
                {pick(locale, { en: "Privacy policy", ru: "Политика приватности" })}
              </Link>
              <Link className="hover:text-gold" href="/terms">
                {pick(locale, { en: "Terms of use", ru: "Правила использования" })}
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 border-t border-white/10 pt-5 text-xs md:flex-row md:items-center md:justify-between">
          <p>© 2026 The Jammers. Cyprus.</p>
          <p>{pick(locale, { en: "Made with loud guitars and louder drummers.", ru: "Сделано с громкими гитарами и ещё более громкими барабанами." })}</p>
        </div>
      </div>
    </footer>
  );
}
