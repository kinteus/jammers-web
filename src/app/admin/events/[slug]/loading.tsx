import { Loader } from "@/components/ui/loader";
import { Card } from "@/components/ui/card";
import { pick } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";

export default async function AdminEventLoading() {
  const locale = await getLocale();

  return (
    <Card>
      <div role="status" aria-live="polite" className="flex items-center gap-3 py-8 text-sand">
        <Loader />
        <span>{pick(locale, { en: "Loading gig admin…", ru: "Загружаем админку гига…" })}</span>
      </div>
    </Card>
  );
}
