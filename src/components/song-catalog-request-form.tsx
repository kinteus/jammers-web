"use client";

import { type FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { pick, type Locale } from "@/lib/i18n";

import { Button } from "@/components/ui/button";
import { Loader } from "@/components/ui/loader";

type FeedbackState =
  | { tone: "success"; message: string }
  | { tone: "error"; message: string }
  | null;

export function SongCatalogRequestForm({
  eventId,
  locale,
}: {
  eventId: string;
  locale: Locale;
}) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting || !formRef.current) {
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    const formData = new FormData(formRef.current);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch("/api/song-catalog-request", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        const error = payload?.error;
        setFeedback({
          tone: "error",
          message:
            error === "auth-required"
              ? pick(locale, {
                  en: "Sign in again and resend the request.",
                  ru: "Войди заново и отправь запрос ещё раз.",
                })
              : error === "invalid-request"
                ? pick(locale, {
                    en: "Fill in both artist and track title before sending.",
                    ru: "Перед отправкой заполни и артиста, и название трека.",
                  })
                : error === "database-unavailable"
                  ? pick(locale, {
                      en: "The local database is unavailable right now. Try again in a moment.",
                      ru: "Локальная база сейчас недоступна. Попробуй ещё раз чуть позже.",
                    })
                  : pick(locale, {
                      en: "The request could not be sent right now. Try again in a moment.",
                      ru: "Сейчас не получилось отправить запрос. Попробуй ещё раз чуть позже.",
                    }),
        });
        return;
      }

      formRef.current.reset();
      setFeedback({
        tone: "success",
        message: pick(locale, {
          en: "The request is saved. Admins will see it in the catalog queue.",
          ru: "Запрос сохранён. Админы увидят его в очереди каталога.",
        }),
      });
      router.refresh();
    } catch (error) {
      setFeedback({
        tone: "error",
        message:
          error instanceof DOMException && error.name === "AbortError"
            ? pick(locale, {
                en: "The request took too long. Please try again.",
                ru: "Запрос выполнялся слишком долго. Попробуй ещё раз.",
              })
            : pick(locale, {
                en: "Network error while sending the request. Please try again.",
                ru: "Сетевая ошибка при отправке запроса. Попробуй ещё раз.",
              }),
      });
    } finally {
      window.clearTimeout(timeoutId);
      setIsSubmitting(false);
    }
  }

  return (
    <form className="grid gap-4 lg:grid-cols-2" onSubmit={handleSubmit} ref={formRef}>
      <input name="eventId" type="hidden" value={eventId} />
      <label className="block space-y-2 text-sm text-sand">
        <span>{pick(locale, { en: "Artist", ru: "Артист" })}</span>
        <input className="w-full px-4 py-3" name="artistName" required />
      </label>
      <label className="block space-y-2 text-sm text-sand">
        <span>{pick(locale, { en: "Track title", ru: "Название трека" })}</span>
        <input className="w-full px-4 py-3" name="trackTitle" required />
      </label>
      <label className="block space-y-2 text-sm text-sand lg:col-span-2">
        <span>{pick(locale, { en: "Comment", ru: "Комментарий" })}</span>
        <textarea className="min-h-24 w-full px-4 py-3" name="comment" />
      </label>
      {feedback ? (
        <div
          className={`rounded-xl border px-4 py-3 text-sm lg:col-span-2 ${
            feedback.tone === "success"
              ? "border-blue/30 bg-blue/12 text-white"
              : "border-red/30 bg-red/10 text-white"
          }`}
          role="status"
        >
          {feedback.message}
        </div>
      ) : null}
      <div className="lg:col-span-2">
        {isSubmitting ? (
          <Button
            aria-busy="true"
            disabled
            type="submit"
            variant="secondary"
          >
            <Loader className="text-white" />
            <span>{pick(locale, { en: "Sending request...", ru: "Отправляем запрос..." })}</span>
          </Button>
        ) : (
          <Button type="submit" variant="secondary">
            {pick(locale, { en: "Ask admins to add the song", ru: "Попросить админов добавить песню" })}
          </Button>
        )}
      </div>
    </form>
  );
}
