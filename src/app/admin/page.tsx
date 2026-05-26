import type { Metadata } from "next";
import Link from "next/link";

import { getCurrentUser } from "@/lib/auth/current-user";
import { normalizeTelegramUsername } from "@/lib/auth/telegram-username";
import { getEffectiveEventStatus } from "@/lib/domain/event-status";
import { getDefaultLineupInput } from "@/lib/domain/lineup";
import { DEFAULT_MAX_SET_TRACK_COUNT } from "@/lib/domain/setlist-limit";
import {
  DEFAULT_TRACK_INFO_FIELDS,
  formatTrackInfoFieldsForTextarea,
} from "@/lib/track-info-flags";
import { env } from "@/lib/env";
import { formatVideoUrlsForTextarea } from "@/lib/site-content";
import { isSuperAdminUser } from "@/lib/auth/admin-access";
import { getLocale } from "@/lib/i18n-server";
import { pick } from "@/lib/i18n";
import { isDatabaseUnavailableError } from "@/lib/prisma-errors";
import {
  createCommunityQuoteAction,
  createCatalogSongAction,
  createEventAction,
  createKnownGroupAction,
  deleteCommunityQuoteAction,
  deleteEventAction,
  grantAdminRoleAction,
  revokeAdminRoleAction,
  setBanAction,
  setRatingAction,
  updateCommunityQuoteAction,
  updateCommunityQuoteSettingsAction,
  updateEventStatusAction,
  updateFaqContentAction,
} from "@/server/actions";
import { isDatabaseAvailable } from "@/server/database-health";
import { getAdminDashboardData, getFaqPageData } from "@/server/query-data";

import { AdminActionDialog } from "@/components/admin-action-dialog";
import { DatabaseUnavailableState } from "@/components/database-unavailable-state";
import { AdminTimezoneOffsetField } from "@/components/admin-timezone-offset-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin",
  robots: {
    index: false,
    follow: false,
  },
};

type AdminPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getQuickAction(
  event: {
  status: string;
  effectiveStatus?: string;
  },
  locale: Awaited<ReturnType<typeof getLocale>>,
) {
  const status = event.effectiveStatus ?? event.status;

  if (status === "DRAFT") {
    return {
      label: pick(locale, { en: "Open gig", ru: "Открыть гиг" }),
      pendingLabel: pick(locale, { en: "Opening...", ru: "Открываем..." }),
      status: "OPEN" as const,
    };
  }
  if (status === "OPEN") {
    return {
      label: pick(locale, { en: "Close gig", ru: "Закрыть гиг" }),
      pendingLabel: pick(locale, { en: "Closing...", ru: "Закрываем..." }),
      status: "CLOSED" as const,
    };
  }
  return null;
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const params = await searchParams;
  const [user, locale] = await Promise.all([getCurrentUser(), getLocale()]);
  if (!user || user.role !== "ADMIN") {
    if (!(await isDatabaseAvailable())) {
      return (
        <DatabaseUnavailableState
          locale={locale}
          title={pick(locale, {
            en: "Admin data can't load right now",
            ru: "Сейчас админские данные не загружаются",
          })}
        />
      );
    }

    return (
      <Card className="brand-shell">
        <p className="text-sm text-ember">
          {pick(locale, {
            en: "Admin access required.",
            ru: "Нужен доступ администратора.",
          })}
        </p>
      </Card>
    );
  }

  let data;
  let faq;

  try {
    [data, faq] = await Promise.all([getAdminDashboardData(), getFaqPageData()]);
  } catch (error) {
    if (!isDatabaseUnavailableError(error)) {
      throw error;
    }

    return (
      <DatabaseUnavailableState
        locale={locale}
        title={pick(locale, {
          en: "Admin data can't load right now",
          ru: "Сейчас админские данные не загружаются",
        })}
      />
    );
  }
  const defaultLineup = JSON.stringify(getDefaultLineupInput(), null, 2);
  const defaultTrackInfoFields = formatTrackInfoFieldsForTextarea(DEFAULT_TRACK_INFO_FIELDS);
  const notice = typeof params.notice === "string" ? params.notice : null;
  const canManageAdmins = isSuperAdminUser(user);
  const adminUsers = data.users
    .filter((member) => member.role === "ADMIN")
    .sort((left, right) => {
      const leftName = left.telegramUsername ?? left.fullName ?? "";
      const rightName = right.telegramUsername ?? right.fullName ?? "";
      return leftName.localeCompare(rightName);
    });
  const primaryAdminTelegramId = env.PRIMARY_ADMIN_TELEGRAM_ID;
  const primaryAdminUsername = normalizeTelegramUsername(env.DEFAULT_ADMIN_USERNAME);

  return (
    <div className="space-y-8 text-sand">
      {notice === "faq-saved" ? (
        <div className="rounded-xl border border-blue/30 bg-blue/12 px-4 py-3 text-sm text-white">
          {pick(locale, {
            en: "FAQ saved. The public page is already serving the updated content.",
            ru: "FAQ обновлён. Публичная страница уже показывает новую версию контента.",
          })}
        </div>
      ) : null}

      {notice === "community-quotes-saved" ? (
        <div className="rounded-xl border border-blue/30 bg-blue/12 px-4 py-3 text-sm text-white">
          {pick(locale, {
            en: "Community quotes saved. The home page has already picked up the latest set.",
            ru: "Цитаты сообщества сохранены. Главная страница уже подтянула актуальный набор.",
          })}
        </div>
      ) : null}

      {notice === "event-deleted" ? (
        <div className="rounded-xl border border-red/30 bg-red/12 px-4 py-3 text-sm text-white">
          {pick(locale, {
            en: "Gig deleted. The public board and admin workspace have been removed.",
            ru: "Гиг удалён. Публичный борд и админское рабочее пространство убраны.",
          })}
        </div>
      ) : null}

      <section className="space-y-5">
        <div className="space-y-2">
          <Badge>{pick(locale, { en: "Admin cockpit", ru: "Панель админа" })}</Badge>
          <h1 className="font-display text-4xl font-semibold text-sand">
            {pick(locale, {
              en: "Open only the tool you need",
              ru: "Открывай только тот инструмент, который нужен прямо сейчас",
            })}
          </h1>
          <p className="max-w-3xl text-sm leading-6 text-white/70">
            {pick(locale, {
              en: "The admin home stays compact by default. Heavy workflows live behind focused pop-up panels instead of competing on the screen at once.",
              ru: "Админская главная по умолчанию остаётся компактной. Тяжёлые сценарии живут в отдельных фокусных панелях и не спорят друг с другом на одном экране.",
            })}
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="brand-shell-soft rounded-2xl px-5 py-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
              {pick(locale, { en: "Events", ru: "Гиги" })}
            </p>
            <p className="mt-2 text-3xl font-semibold text-sand">{data.events.length}</p>
          </div>
          <div className="brand-shell-soft rounded-2xl px-5 py-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
              {pick(locale, { en: "Song requests", ru: "Запросы на песни" })}
            </p>
            <p className="mt-2 text-3xl font-semibold text-sand">{data.songRequests.length}</p>
          </div>
          <div className="brand-shell-soft rounded-2xl px-5 py-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
              {pick(locale, { en: "Admins", ru: "Админы" })}
            </p>
            <p className="mt-2 text-3xl font-semibold text-sand">{adminUsers.length}</p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <AdminActionDialog
            badge={pick(locale, { en: "Create event", ru: "Создать гиг" })}
            closeLabel={pick(locale, { en: "Close admin dialog", ru: "Закрыть админское окно" })}
            description={pick(locale, {
              en: "Launch a new gig board without keeping the full form open on the page.",
              ru: "Запусти новый борд гига, не держа большую форму постоянно открытой на странице.",
            })}
            title={pick(locale, { en: "Launch a new gig board", ru: "Запустить новый борд гига" })}
            triggerLabel={pick(locale, { en: "Create gig", ru: "Создать гиг" })}
          >
            <form action={createEventAction} className="grid gap-4 md:grid-cols-2">
              <AdminTimezoneOffsetField />
              <label className="space-y-2 text-sm md:col-span-2">
                <span>{pick(locale, { en: "Title", ru: "Название" })}</span>
                <input className="w-full px-4 py-3" name="title" required />
              </label>
              <label className="space-y-2 text-sm md:col-span-2">
                <span>{pick(locale, { en: "Description", ru: "Описание" })}</span>
                <textarea className="min-h-24 w-full px-4 py-3" name="description" />
              </label>
              <label className="space-y-2 text-sm">
                <span>{pick(locale, { en: "Starts at", ru: "Начало" })}</span>
                <input className="w-full px-4 py-3" name="startsAt" required type="datetime-local" />
              </label>
              <label className="space-y-2 text-sm">
                <span>{pick(locale, { en: "Registration opens at", ru: "Старт регистрации" })}</span>
                <input className="w-full px-4 py-3" name="registrationOpensAt" required type="datetime-local" />
              </label>
              <label className="space-y-2 text-sm">
                <span>{pick(locale, { en: "Registration closes at", ru: "Окончание регистрации" })}</span>
                <input className="w-full px-4 py-3" name="registrationClosesAt" required type="datetime-local" />
              </label>
              <label className="space-y-2 text-sm">
                <span>{pick(locale, { en: "Venue", ru: "Площадка" })}</span>
                <input className="w-full px-4 py-3" name="venueName" />
              </label>
              <label className="space-y-2 text-sm">
                <span>{pick(locale, { en: "Venue map URL", ru: "Ссылка на карту площадки" })}</span>
                <input className="w-full px-4 py-3" name="venueMapUrl" />
              </label>
              <label className="space-y-2 text-sm">
                <span>{pick(locale, { en: "Max main-set songs", ru: "Макс. песен в мейн-сете" })}</span>
                <input
                  className="w-full px-4 py-3"
                  defaultValue={DEFAULT_MAX_SET_TRACK_COUNT}
                  min={1}
                  name="maxSetTrackCount"
                  type="number"
                />
              </label>
              <label className="space-y-2 text-sm">
                <span>{pick(locale, { en: "Max tracks per user", ru: "Макс. треков на человека" })}</span>
                <input className="w-full px-4 py-3" defaultValue={3} name="maxTracksPerUser" type="number" />
              </label>
              <label className="space-y-2 text-sm md:col-span-2">
                <span>{pick(locale, { en: "Stage notes", ru: "Заметки по сцене" })}</span>
                <textarea className="min-h-24 w-full px-4 py-3" name="stageNotes" />
              </label>
              <label className="space-y-2 text-sm flex items-center gap-3 md:col-span-2">
                <input defaultChecked name="allowPlayback" type="checkbox" />
                {pick(locale, {
                  en: "Allow playback usage in proposals",
                  ru: "Разрешить использование плейбэка в заявках",
                })}
              </label>
              <label className="space-y-2 text-sm md:col-span-2">
                <span>{pick(locale, { en: "Track info flags", ru: "Флаги трека" })}</span>
                <textarea
                  className="min-h-24 w-full px-4 py-3"
                  defaultValue={defaultTrackInfoFields}
                  name="trackInfoFieldsInput"
                />
                <p className="text-xs leading-5 text-white/55">
                  {pick(locale, {
                    en: "One label per line. These flags appear on track proposals and inside the board as extra context only.",
                    ru: "По одной подписи на строку. Эти флаги появляются в заявках и внутри борда только как дополнительный контекст.",
                  })}
                </p>
              </label>
              <label className="space-y-2 text-sm md:col-span-2">
                <span>{pick(locale, { en: "Lineup JSON", ru: "JSON лайнапа" })}</span>
                <textarea
                  className="min-h-48 w-full px-4 py-3 font-mono text-xs"
                  defaultValue={defaultLineup}
                  name="lineupJson"
                />
              </label>
              <SubmitButton
                className="md:col-span-2"
                pendingLabel={pick(locale, { en: "Creating gig...", ru: "Создаём гиг..." })}
                type="submit"
              >
                {pick(locale, { en: "Create event", ru: "Создать гиг" })}
              </SubmitButton>
            </form>
          </AdminActionDialog>

          <AdminActionDialog
            badge={pick(locale, { en: "Song catalog", ru: "Каталог песен" })}
            closeLabel={pick(locale, { en: "Close admin dialog", ru: "Закрыть админское окно" })}
            description={pick(locale, {
              en: "Keep controlled catalog edits out of the main admin canvas until you need them.",
              ru: "Держи управляемые изменения каталога вне основного полотна админки, пока они действительно не понадобятся.",
            })}
            title={pick(locale, { en: "Add songs to the controlled catalog", ru: "Добавить песни в каталог" })}
            triggerLabel={pick(locale, { en: "Song catalog", ru: "Каталог песен" })}
          >
            <form action={createCatalogSongAction} className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm">
                <span>{pick(locale, { en: "Artist", ru: "Артист" })}</span>
                <input className="w-full px-4 py-3" name="artistName" required />
              </label>
              <label className="space-y-2 text-sm">
                <span>{pick(locale, { en: "Track", ru: "Трек" })}</span>
                <input className="w-full px-4 py-3" name="trackTitle" required />
              </label>
              <label className="space-y-2 text-sm">
                <span>{pick(locale, { en: "Duration (seconds)", ru: "Длительность (секунды)" })}</span>
                <input className="w-full px-4 py-3" defaultValue={240} name="durationSeconds" type="number" />
              </label>
              <label className="space-y-2 text-sm md:col-span-2">
                <span>{pick(locale, { en: "Notes", ru: "Заметки" })}</span>
                <textarea className="min-h-24 w-full px-4 py-3" name="notes" />
              </label>
              <SubmitButton
                className="md:col-span-2"
                pendingLabel={pick(locale, { en: "Saving song...", ru: "Сохраняем песню..." })}
                type="submit"
              >
                {pick(locale, { en: "Upsert song", ru: "Создать или обновить песню" })}
              </SubmitButton>
            </form>
          </AdminActionDialog>

          <AdminActionDialog
            badge={pick(locale, { en: "Moderation", ru: "Модерация" })}
            closeLabel={pick(locale, { en: "Close admin dialog", ru: "Закрыть админское окно" })}
            description={pick(locale, {
              en: "Ban and rate musicians only when you need those controls.",
              ru: "Используй блокировку и рейтинг музыкантов только тогда, когда действительно нужен модераторский контекст.",
            })}
            title={pick(locale, { en: "Moderation", ru: "Модерация" })}
            triggerLabel={pick(locale, { en: "Moderation", ru: "Модерация" })}
          >
            <div className="grid gap-6 md:grid-cols-2">
              <form action={setBanAction} className="space-y-3">
                <h3 className="font-display text-2xl font-semibold text-sand">
                  {pick(locale, { en: "Ban user", ru: "Заблокировать пользователя" })}
                </h3>
                <input
                  className="w-full px-4 py-3"
                  name="telegramUsername"
                  placeholder={pick(locale, { en: "telegram username", ru: "username в Telegram" })}
                  required
                />
                <input
                  className="w-full px-4 py-3"
                  name="reason"
                  placeholder={pick(locale, { en: "reason", ru: "причина" })}
                />
                <input className="w-full px-4 py-3" defaultValue={7} name="durationDays" type="number" />
                <label className="flex items-center gap-3 text-sm">
                  <input name="isPermanent" type="checkbox" />
                  {pick(locale, { en: "Permanent ban", ru: "Постоянный бан" })}
                </label>
                <SubmitButton
                  pendingLabel={pick(locale, { en: "Applying ban...", ru: "Применяем бан..." })}
                  type="submit"
                  variant="secondary"
                >
                  {pick(locale, { en: "Apply ban", ru: "Применить бан" })}
                </SubmitButton>
              </form>

              <form action={setRatingAction} className="space-y-3">
                <h3 className="font-display text-2xl font-semibold text-sand">
                  {pick(locale, { en: "Rate musician", ru: "Оценить музыканта" })}
                </h3>
                <input
                  className="w-full px-4 py-3"
                  name="telegramUsername"
                  placeholder={pick(locale, { en: "telegram username", ru: "username в Telegram" })}
                  required
                />
                <input className="w-full px-4 py-3" defaultValue={3} max={5} min={1} name="score" type="number" />
                <textarea
                  className="min-h-24 w-full px-4 py-3"
                  name="note"
                  placeholder={pick(locale, { en: "internal note", ru: "внутренняя заметка" })}
                />
                <SubmitButton pendingLabel={pick(locale, { en: "Saving rating...", ru: "Сохраняем рейтинг..." })} type="submit">
                  {pick(locale, { en: "Save rating", ru: "Сохранить рейтинг" })}
                </SubmitButton>
              </form>
            </div>
          </AdminActionDialog>

          <AdminActionDialog
            badge={pick(locale, { en: "Known groups", ru: "Известные составы" })}
            closeLabel={pick(locale, { en: "Close admin dialog", ru: "Закрыть админское окно" })}
            description={pick(locale, {
              en: "Manage recurring ensembles without keeping the full member list in view all the time.",
              ru: "Управляй повторяющимися составами, не удерживая длинный список участников всё время на экране.",
            })}
            title={pick(locale, { en: "Known groups", ru: "Известные составы" })}
            triggerLabel={pick(locale, {
              en: `Known groups (${data.groups.length})`,
              ru: `Известные составы (${data.groups.length})`,
            })}
          >
            <div className="grid gap-6 lg:grid-cols-[0.9fr,1.1fr]">
              <form action={createKnownGroupAction} className="space-y-3">
                <input
                  className="w-full px-4 py-3"
                  name="name"
                  placeholder={pick(locale, { en: "Group name", ru: "Название состава" })}
                  required
                />
                <textarea
                  className="min-h-24 w-full px-4 py-3"
                  name="description"
                  placeholder={pick(locale, { en: "Description", ru: "Описание" })}
                />
                <input
                  className="w-full px-4 py-3"
                  name="memberUsernames"
                  placeholder={pick(locale, {
                    en: "comma-separated telegram usernames",
                    ru: "username в Telegram через запятую",
                  })}
                  required
                />
                <SubmitButton pendingLabel={pick(locale, { en: "Creating group...", ru: "Создаём состав..." })} type="submit">
                  {pick(locale, { en: "Create known group", ru: "Создать известный состав" })}
                </SubmitButton>
              </form>
              <div className="grid gap-3">
                {data.groups.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-white/60">
                    {pick(locale, { en: "No known groups yet.", ru: "Пока нет сохранённых составов." })}
                  </div>
                ) : (
                  data.groups.map((group) => (
                    <div key={group.id} className="rounded-2xl border border-white/10 p-4">
                      <p className="font-semibold text-sand">{group.name}</p>
                      <p className="mt-1 text-sm text-white/70">
                        {group.members.map((member) => `@${member.user.telegramUsername}`).join(", ")}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </AdminActionDialog>

          <AdminActionDialog
            badge={pick(locale, { en: "FAQ", ru: "FAQ" })}
            closeLabel={pick(locale, { en: "Close admin dialog", ru: "Закрыть админское окно" })}
            description={pick(locale, {
              en: "Update public FAQ content without keeping the entire markdown editor always open.",
              ru: "Обновляй публичный FAQ, не держа весь markdown-редактор постоянно раскрытым.",
            })}
            title={pick(locale, { en: "Public FAQ content", ru: "Публичный FAQ" })}
            triggerLabel={pick(locale, { en: "FAQ content", ru: "Контент FAQ" })}
            triggerVariant="accent"
          >
            <div className="space-y-5">
              <form action={updateFaqContentAction} className="grid gap-4">
                <label className="space-y-2 text-sm">
                  <span>{pick(locale, { en: "Participation rules (Markdown)", ru: "Правила участия (Markdown)" })}</span>
                  <textarea
                    className="min-h-56 w-full px-4 py-3"
                    defaultValue={faq.participationRulesMarkdown}
                    name="participationRulesMarkdown"
                  />
                </label>
                <label className="space-y-2 text-sm">
                  <span>{pick(locale, { en: "Line-up technical details (Markdown)", ru: "Технические детали лайнапа (Markdown)" })}</span>
                  <textarea
                    className="min-h-56 w-full px-4 py-3"
                    defaultValue={faq.lineupDetailsMarkdown}
                    name="lineupDetailsMarkdown"
                  />
                </label>
                <label className="space-y-2 text-sm">
                  <span>{pick(locale, { en: "YouTube video links", ru: "Ссылки на YouTube" })}</span>
                  <textarea
                    className="min-h-32 w-full px-4 py-3"
                    defaultValue={formatVideoUrlsForTextarea(faq.lineupVideoUrls)}
                    name="lineupVideoUrlsInput"
                    placeholder="https://www.youtube.com/watch?v=..."
                  />
                </label>
                <div className="flex flex-wrap gap-3">
                  <SubmitButton pendingLabel={pick(locale, { en: "Saving FAQ...", ru: "Сохраняем FAQ..." })} type="submit">
                    {pick(locale, { en: "Save FAQ", ru: "Сохранить FAQ" })}
                  </SubmitButton>
                  <Link href="/faq">
                    <Button type="button" variant="secondary">
                      {pick(locale, { en: "Open public FAQ", ru: "Открыть публичный FAQ" })}
                    </Button>
                  </Link>
                </div>
              </form>
              <div className="rounded-2xl border border-white/10 p-4 text-sm leading-6 text-white/72">
                {pick(locale, {
                  en: "FAQ feedback goes to the Telegram chat configured in ",
                  ru: "Сообщения из FAQ уходят в Telegram-чат, указанный в ",
                })}
                <code>TELEGRAM_FEEDBACK_CHAT_ID</code>
                {pick(locale, {
                  en: ". If it is empty, visitors see a delivery error instead of a silent submit.",
                  ru: ". Если переменная пуста, посетители увидят ошибку доставки вместо молчаливой отправки.",
                })}
              </div>
            </div>
          </AdminActionDialog>

          <AdminActionDialog
            badge={pick(locale, { en: "Community quotes", ru: "Цитаты сообщества" })}
            closeLabel={pick(locale, { en: "Close admin dialog", ru: "Закрыть админское окно" })}
            description={pick(locale, {
              en: "Curate the quotes block under the home hero. The pool can stay large while each page load surfaces a new limited selection in the original language.",
              ru: "Управляй блоком цитат под hero на главной. Пул может быть большим, а каждая загрузка страницы показывает новый ограниченный набор на оригинальном языке.",
            })}
            title={pick(locale, { en: "Community quotes", ru: "Цитаты сообщества" })}
            triggerLabel={pick(locale, {
              en: `Community quotes (${data.communityQuotes.length} total / ${faq.communityQuotesDesktopDisplayLimit} desktop / ${faq.communityQuotesMobileDisplayLimit} mobile)`,
              ru: `Цитаты сообщества (${data.communityQuotes.length} всего / ${faq.communityQuotesDesktopDisplayLimit} desktop / ${faq.communityQuotesMobileDisplayLimit} mobile)`,
            })}
          >
            <div className="space-y-6" id="community-quotes">
              <form action={updateCommunityQuoteSettingsAction} className="brand-shell-soft grid gap-4 rounded-2xl border border-white/10 p-4">
                <div className="space-y-1">
                  <h3 className="font-display text-2xl font-semibold text-sand">
                    {pick(locale, { en: "Display settings", ru: "Настройки показа" })}
                  </h3>
                  <p className="max-w-2xl text-sm leading-6 text-white/66">
                    {pick(locale, {
                      en: "Keep a big archive, but limit how many quotes appear on the home wall at once. Every refresh picks a fresh combination.",
                      ru: "Храни большой архив, но ограничивай число цитат на главной стене за один раз. Каждое обновление страницы выбирает новую комбинацию.",
                    })}
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-[220px_auto] md:items-end">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="space-y-2 text-sm">
                      <span>{pick(locale, { en: "Desktop quotes", ru: "Цитат на desktop" })}</span>
                      <input
                        className="w-full px-4 py-3"
                        defaultValue={faq.communityQuotesDesktopDisplayLimit}
                        max={60}
                        min={1}
                        name="communityQuotesDesktopDisplayLimit"
                        type="number"
                      />
                    </label>
                    <label className="space-y-2 text-sm">
                      <span>{pick(locale, { en: "Mobile quotes", ru: "Цитат на mobile" })}</span>
                      <input
                        className="w-full px-4 py-3"
                        defaultValue={faq.communityQuotesMobileDisplayLimit}
                        max={24}
                        min={1}
                        name="communityQuotesMobileDisplayLimit"
                        type="number"
                      />
                    </label>
                  </div>
                  <div className="flex items-end">
                    <SubmitButton pendingLabel={pick(locale, { en: "Saving settings...", ru: "Сохраняем настройки..." })} type="submit">
                      {pick(locale, { en: "Save display settings", ru: "Сохранить настройки показа" })}
                    </SubmitButton>
                  </div>
                </div>
              </form>

              <form action={createCommunityQuoteAction} className="grid gap-4">
                <label className="space-y-2 text-sm">
                  <span>{pick(locale, { en: "Quote text", ru: "Текст цитаты" })}</span>
                  <textarea className="min-h-24 w-full px-4 py-3" name="text" required />
                </label>
                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px_auto] md:items-end">
                  <label className="space-y-2 text-sm">
                    <span>{pick(locale, { en: "Source label", ru: "Подпись источника" })}</span>
                    <input
                      className="w-full px-4 py-3"
                      name="sourceLabel"
                      placeholder={pick(locale, {
                        en: "Backstage classic / chat lore / @username",
                        ru: "Классика бэкстейджа / история из чата / @username",
                      })}
                    />
                  </label>
                  <label className="space-y-2 text-sm">
                    <span>{pick(locale, { en: "Display order", ru: "Порядок показа" })}</span>
                    <input className="w-full px-4 py-3" defaultValue={0} name="displayOrder" type="number" />
                  </label>
                  <label className="flex items-center gap-3 text-sm md:pb-3">
                    <input defaultChecked name="isActive" type="checkbox" />
                    {pick(locale, { en: "Visible on home", ru: "Показывать на главной" })}
                  </label>
                </div>
                <SubmitButton pendingLabel={pick(locale, { en: "Saving quote...", ru: "Сохраняем цитату..." })} type="submit">
                  {pick(locale, { en: "Add quote", ru: "Добавить цитату" })}
                </SubmitButton>
              </form>

              <div className="grid gap-3">
                {data.communityQuotes.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-white/60">
                    {pick(locale, {
                      en: "No community quotes yet. Add the first one and it will appear under the hero on the home page.",
                      ru: "Пока нет ни одной цитаты. Добавь первую, и она появится под hero на главной странице.",
                    })}
                  </div>
                ) : (
                  data.communityQuotes.map((quote) => (
                    <div key={quote.id} className="brand-shell-soft rounded-2xl border border-white/10 p-4">
                      <form action={updateCommunityQuoteAction} className="grid gap-4">
                        <input name="quoteId" type="hidden" value={quote.id} />
                        <label className="space-y-2 text-sm">
                          <span>{pick(locale, { en: "Quote text", ru: "Текст цитаты" })}</span>
                          <textarea className="min-h-24 w-full px-4 py-3" defaultValue={quote.textEn} name="text" required />
                        </label>
                        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px_auto] md:items-end">
                          <label className="space-y-2 text-sm">
                            <span>{pick(locale, { en: "Source label", ru: "Подпись источника" })}</span>
                            <input className="w-full px-4 py-3" defaultValue={quote.sourceLabel ?? ""} name="sourceLabel" />
                          </label>
                          <label className="space-y-2 text-sm">
                            <span>{pick(locale, { en: "Display order", ru: "Порядок показа" })}</span>
                            <input className="w-full px-4 py-3" defaultValue={quote.displayOrder} name="displayOrder" type="number" />
                          </label>
                          <label className="flex items-center gap-3 text-sm md:pb-3">
                            <input defaultChecked={quote.isActive} name="isActive" type="checkbox" />
                            {pick(locale, { en: "Visible on home", ru: "Показывать на главной" })}
                          </label>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="text-xs leading-5 text-white/52">
                            {pick(locale, {
                              en: `Created by @${quote.createdBy.telegramUsername ?? quote.createdBy.fullName ?? "unknown"}${quote.updatedBy ? ` · last edit by @${quote.updatedBy.telegramUsername ?? quote.updatedBy.fullName ?? "unknown"}` : ""}.`,
                              ru: `Создал(а) @${quote.createdBy.telegramUsername ?? quote.createdBy.fullName ?? "неизвестно"}${quote.updatedBy ? ` · последнее изменение: @${quote.updatedBy.telegramUsername ?? quote.updatedBy.fullName ?? "неизвестно"}` : ""}.`,
                            })}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <SubmitButton pendingLabel={pick(locale, { en: "Saving...", ru: "Сохраняем..." })} size="sm" type="submit">
                              {pick(locale, { en: "Save quote", ru: "Сохранить цитату" })}
                            </SubmitButton>
                            <SubmitButton
                              className="border-red/45 bg-red/12 text-white hover:border-red/65 hover:bg-red/18"
                              formAction={deleteCommunityQuoteAction}
                              pendingLabel={pick(locale, { en: "Deleting...", ru: "Удаляем..." })}
                              size="sm"
                              type="submit"
                              variant="secondary"
                            >
                              {pick(locale, { en: "Delete", ru: "Удалить" })}
                            </SubmitButton>
                          </div>
                        </div>
                      </form>
                    </div>
                  ))
                )}
              </div>
            </div>
          </AdminActionDialog>

          <AdminActionDialog
            badge={pick(locale, { en: "Admin access", ru: "Доступ админов" })}
            closeLabel={pick(locale, { en: "Close admin dialog", ru: "Закрыть админское окно" })}
            description={pick(locale, {
              en: "Review the current admin roster and update it only when necessary.",
              ru: "Проверяй текущий состав админов и меняй его только тогда, когда это действительно нужно.",
            })}
            title={pick(locale, { en: "Admin access", ru: "Доступ админов" })}
            triggerLabel={pick(locale, { en: "Admin roster", ru: "Список админов" })}
          >
            <div className="grid gap-6 lg:grid-cols-[0.85fr,1.15fr]">
              <div className="space-y-3">
                <h2 className="font-display text-3xl font-semibold">
                  {pick(locale, { en: "Current admins", ru: "Текущие админы" })}
                </h2>
                <div className="grid gap-3">
                  {adminUsers.map((member) => {
                    const username =
                      member.telegramUsername ??
                      member.fullName ??
                      pick(locale, { en: "unknown", ru: "неизвестно" });
                    const isPrimaryAdmin =
                      primaryAdminTelegramId
                        ? member.telegramId === primaryAdminTelegramId
                        : normalizeTelegramUsername(member.telegramUsername) === primaryAdminUsername;

                    return (
                      <div
                        key={member.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 p-4"
                      >
                        <div>
                          <p className="font-semibold text-sand">@{username}</p>
                          <p className="mt-1 text-sm text-white/60">
                            {isPrimaryAdmin
                              ? pick(locale, { en: "Primary admin", ru: "Главный админ" })
                              : pick(locale, { en: "Admin", ru: "Админ" })}
                          </p>
                        </div>
                        {canManageAdmins && !isPrimaryAdmin ? (
                          <form action={revokeAdminRoleAction}>
                            <input name="userId" type="hidden" value={member.id} />
                            <SubmitButton pendingLabel={pick(locale, { en: "Removing...", ru: "Удаляем..." })} size="sm" type="submit" variant="ghost">
                              {pick(locale, { en: "Remove admin", ru: "Убрать админа" })}
                            </SubmitButton>
                          </form>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-display text-2xl font-semibold">
                  {pick(locale, { en: "Manage admin list", ru: "Управление списком админов" })}
                </h3>
                {canManageAdmins ? (
                  <form action={grantAdminRoleAction} className="space-y-3">
                    <p className="text-sm text-white/60">
                      {primaryAdminTelegramId
                        ? pick(locale, {
                            en: "Only the configured primary admin can promote or demote admins.",
                            ru: "Повышать и понижать админов может только настроенный главный админ.",
                          })
                        : pick(locale, {
                            en: `Only @${primaryAdminUsername} can promote or demote admins.`,
                            ru: `Повышать и понижать админов может только @${primaryAdminUsername}.`,
                          })}
                    </p>
                    <input
                      className="w-full px-4 py-3"
                      name="telegramUsername"
                      placeholder={pick(locale, { en: "telegram username", ru: "username в Telegram" })}
                      required
                    />
                    <SubmitButton pendingLabel={pick(locale, { en: "Granting access...", ru: "Выдаём доступ..." })} type="submit">
                      {pick(locale, { en: "Grant admin access", ru: "Выдать доступ админа" })}
                    </SubmitButton>
                  </form>
                ) : (
                  <div className="rounded-2xl border border-white/10 p-4 text-sm text-white/60">
                    {pick(locale, {
                      en: "Admin list changes are reserved for the primary admin.",
                      ru: "Изменение списка админов доступно только главному админу.",
                    })}
                  </div>
                )}
              </div>
            </div>
          </AdminActionDialog>
          <AdminActionDialog
            badge={pick(locale, { en: "Community queue", ru: "Очередь сообщества" })}
            closeLabel={pick(locale, { en: "Close admin dialog", ru: "Закрыть админское окно" })}
            description={pick(locale, {
              en: "Inspect incoming requests and recent user state only when moderation context is needed.",
              ru: "Проверяй входящие запросы и недавнее состояние пользователей только тогда, когда нужен контекст по модерации.",
            })}
            title={pick(locale, { en: "Song requests and recent users", ru: "Запросы на песни и недавние пользователи" })}
            triggerLabel={pick(locale, { en: "Queue overview", ru: "Обзор очереди" })}
          >
            <div className="space-y-6">
              <div>
                <p className="font-semibold text-sand">{pick(locale, { en: "Song requests", ru: "Запросы на песни" })}</p>
                <div className="mt-3 grid gap-3">
                  {data.songRequests.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-white/60">
                      {pick(locale, { en: "No open song requests.", ru: "Сейчас нет открытых запросов на песни." })}
                    </div>
                  ) : (
                    data.songRequests.map((request) => (
                      <div key={request.id} className="rounded-2xl border border-white/10 p-4 text-sm">
                        <p>
                          {request.artistName} - {request.trackTitle}
                        </p>
                        <p className="mt-1 text-white/60">
                          {pick(locale, {
                            en: `Requested by @${request.requestedBy.telegramUsername}`,
                            ru: `Запросил(а) @${request.requestedBy.telegramUsername}`,
                          })}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <p className="font-semibold text-sand">{pick(locale, { en: "Users", ru: "Пользователи" })}</p>
                <div className="mt-3 grid gap-3">
                  {data.users.slice(0, 8).map((member) => (
                    <div key={member.id} className="rounded-2xl border border-white/10 p-4 text-sm">
                      <p>@{member.telegramUsername ?? member.fullName}</p>
                      <p className="mt-1 text-white/60">
                        {member.bans.length > 0
                          ? pick(locale, { en: "Has active ban", ru: "Есть активный бан" })
                          : pick(locale, { en: "Active", ru: "Активен" })}{" "}
                        · {pick(locale, { en: "Ratings", ru: "Оценки" })}:{" "}
                        {member.ratingsReceived.map((rating) => rating.score).join(", ") ||
                          pick(locale, { en: "none", ru: "нет" })}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </AdminActionDialog>
        </div>
      </section>

      <section className="space-y-4">
        <div className="space-y-2">
          <Badge>{pick(locale, { en: "Gig workspaces", ru: "Рабочие пространства гигов" })}</Badge>
          <h2 className="font-display text-3xl font-semibold text-sand">
            {pick(locale, { en: "All gigs, with fast next moves", ru: "Все гиги и быстрые следующие действия" })}
          </h2>
          <p className="max-w-3xl text-sm leading-6 text-white/70">
            {pick(locale, {
              en: "Keep the full list visible for quick operations. Each row gives you the next likely product action without forcing a trip into the event screen first.",
              ru: "Держи полный список на виду для быстрых операций. Каждая строка даёт вероятное следующее действие без обязательного перехода внутрь экрана гига.",
            })}
          </p>
        </div>

        <div className="grid gap-3">
          {data.events.map((event) => {
            const effectiveStatus = getEffectiveEventStatus(event);
            const quickAction = getQuickAction({
              status: event.status,
              effectiveStatus,
            }, locale);

            return (
              <Card className="brand-shell rounded-[1.35rem] border-white/10 p-4" key={event.id}>
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="border-blue/24 bg-blue/16 text-white">{effectiveStatus}</Badge>
                      <span className="text-sm text-white/58">
                        {event.tracks.length} {pick(locale, { en: "active tracks", ru: "активных треков" })}
                      </span>
                    </div>
                    <div>
                      <p className="font-semibold text-sand">{event.title}</p>
                      {effectiveStatus !== event.status ? (
                        <p className="mt-1 text-xs text-white/45">
                          {pick(locale, { en: "Stored status", ru: "Сохранённый статус" })}: {event.status}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/admin/events/${event.id}`}>
                      <Button size="sm" variant="secondary">
                        {pick(locale, { en: "Open event admin", ru: "Открыть админку гига" })}
                      </Button>
                    </Link>

                    {quickAction ? (
                      <form action={updateEventStatusAction}>
                        <input name="eventId" type="hidden" value={event.id} />
                        <input name="eventSlug" type="hidden" value={event.id} />
                        <input name="status" type="hidden" value={quickAction.status} />
                        <SubmitButton pendingLabel={quickAction.pendingLabel} size="sm" type="submit">
                          {quickAction.label}
                        </SubmitButton>
                      </form>
                    ) : null}

                    <form action={deleteEventAction}>
                      <input name="eventId" type="hidden" value={event.id} />
                      <input name="eventSlug" type="hidden" value={event.id} />
                      <SubmitButton
                        className="border-red/45 bg-red/12 text-white hover:border-red/65 hover:bg-red/18"
                        pendingLabel={pick(locale, { en: "Deleting...", ru: "Удаляем..." })}
                        size="sm"
                        type="submit"
                        variant="secondary"
                      >
                        {pick(locale, { en: "Delete gig", ru: "Удалить гиг" })}
                      </SubmitButton>
                    </form>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
