import { MessageCircleMore, ShieldCheck, Video } from "lucide-react";

import { getCurrentUser } from "@/lib/auth/current-user";
import { getLocale } from "@/lib/i18n-server";
import { pick } from "@/lib/i18n";
import { extractYoutubeId } from "@/lib/site-content";
import { sendFaqFeedbackAction } from "@/server/actions";
import { getFaqPageData } from "@/server/query-data";

import { MarkdownContent } from "@/components/markdown-content";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";

export const dynamic = "force-dynamic";

type FaqPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function FaqPage({ searchParams }: FaqPageProps) {
  const params = await searchParams;
  const [faq, locale, user] = await Promise.all([getFaqPageData(), getLocale(), getCurrentUser()]);
  const notice = typeof params.notice === "string" ? params.notice : null;
  const error = typeof params.error === "string" ? params.error : null;

  return (
    <div className="space-y-8 text-sand">
      <section className="space-y-4 border-b border-white/8 pb-8">
        <Badge>FAQ</Badge>
        <div className="space-y-2">
          <h1 className="font-display text-4xl font-semibold uppercase tracking-[0.03em] text-sand">
            {pick(locale, { en: "How The Jammers works", ru: "Как всё устроено у The Jammers" })}
          </h1>
          <p className="max-w-3xl text-sm leading-6 text-white/72">
            {pick(locale, {
              en: "The essentials in one place: how to join, what the line-up means and how to send feedback to the team.",
              ru: "Всё важное в одном месте: как участвовать, что значат детали лайнапа и как отправить обратную связь команде.",
            })}
          </p>
        </div>
      </section>

      {notice === "feedback-sent" ? (
        <div className="rounded-xl border border-blue/30 bg-blue/12 px-4 py-3 text-sm text-white">
          {pick(locale, {
            en: "Feedback sent. The team will see it in Telegram.",
            ru: "Сообщение отправлено. Команда увидит его в Telegram.",
          })}
        </div>
      ) : null}

      {error === "feedback-failed" ? (
        <div className="rounded-xl border border-red/30 bg-red/10 px-4 py-3 text-sm text-white">
          {pick(locale, {
            en: "Feedback could not be delivered right now. Please try again a bit later.",
            ru: "Не получилось доставить сообщение прямо сейчас. Попробуй ещё раз чуть позже.",
          })}
        </div>
      ) : null}

      {error === "feedback-invalid" ? (
        <div className="rounded-xl border border-red/30 bg-red/10 px-4 py-3 text-sm text-white">
          {pick(locale, {
            en: "Please fill in your name and message.",
            ru: "Заполни имя и само сообщение.",
          })}
        </div>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card className="brand-shell space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-gold" />
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/56">
              {pick(locale, { en: "Participation rules", ru: "Правила участия" })}
            </p>
          </div>
          <MarkdownContent value={faq.participationRulesMarkdown} />
        </Card>

        <Card className="brand-shell space-y-4">
          <div className="flex items-center gap-2">
            <Video className="h-4 w-4 text-gold" />
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/56">
              {pick(locale, { en: "Line-up technical details", ru: "Технические детали лайнапа" })}
            </p>
          </div>
          <MarkdownContent value={faq.lineupDetailsMarkdown} />
          {faq.lineupVideoUrls.length > 0 ? (
            <div className="grid gap-4">
              {faq.lineupVideoUrls.map((url) => {
                const youtubeId = extractYoutubeId(url);
                if (!youtubeId) {
                  return null;
                }

                return (
                  <div className="overflow-hidden rounded-xl border border-white/10 bg-black/20" key={url}>
                    <div className="aspect-video">
                      <iframe
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        className="h-full w-full"
                        referrerPolicy="strict-origin-when-cross-origin"
                        src={`https://www.youtube.com/embed/${youtubeId}`}
                        title="YouTube video"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </Card>
      </section>

      <section id="feedback">
        <Card className="brand-shell space-y-5">
          <div className="flex items-center gap-2">
            <MessageCircleMore className="h-4 w-4 text-gold" />
            <div className="space-y-1">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/56">
                {pick(locale, { en: "Feedback", ru: "Обратная связь" })}
              </p>
              <h2 className="font-display text-3xl font-semibold uppercase tracking-[0.03em] text-sand">
                {pick(locale, {
                  en: "Send a message to the team",
                  ru: "Отправить сообщение команде",
                })}
              </h2>
            </div>
          </div>

          <form action={sendFaqFeedbackAction} className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm">
              <span>{pick(locale, { en: "Your name", ru: "Как к тебе обращаться" })}</span>
              <input
                className="w-full px-4 py-3"
                defaultValue={user?.fullName ?? user?.telegramUsername ?? ""}
                name="name"
                required
              />
            </label>
            <label className="space-y-2 text-sm">
              <span>{pick(locale, { en: "Contact", ru: "Контакт для ответа" })}</span>
              <input
                className="w-full px-4 py-3"
                defaultValue={
                  user?.telegramUsername ? `@${user.telegramUsername}` : user?.email ?? user?.phone ?? ""
                }
                name="contact"
                placeholder="@telegram / email / phone"
              />
            </label>
            <label className="space-y-2 text-sm md:col-span-2">
              <span>{pick(locale, { en: "Message", ru: "Сообщение" })}</span>
              <textarea className="min-h-36 w-full px-4 py-3" name="message" required />
            </label>
            <div className="md:col-span-2">
              <SubmitButton
                pendingLabel={pick(locale, { en: "Sending...", ru: "Отправляем..." })}
                type="submit"
              >
                {pick(locale, { en: "Send feedback", ru: "Отправить сообщение" })}
              </SubmitButton>
            </div>
          </form>
        </Card>
      </section>
    </div>
  );
}
