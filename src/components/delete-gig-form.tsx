"use client";

import { useId, useState } from "react";

import { isDeleteGigConfirmationValid } from "@/lib/delete-gig-confirmation";
import { pick, type Locale } from "@/lib/i18n";

import { SubmitButton } from "@/components/ui/submit-button";

// Deleting a gig removes its board, setlist, seats and invites, so the admin must type its title.
// `collapsed` hides the form behind a "More" toggle for dense lists (admin dashboard rows).
export function DeleteGigForm({
  action,
  collapsed = false,
  eventId,
  eventTitle,
  locale,
}: {
  action: (formData: FormData) => void | Promise<void>;
  collapsed?: boolean;
  eventId: string;
  eventTitle: string;
  locale: Locale;
}) {
  const [expanded, setExpanded] = useState(!collapsed);
  const [typed, setTyped] = useState("");
  const inputId = useId();
  const canDelete = isDeleteGigConfirmationValid(typed, eventTitle);

  if (!expanded) {
    return (
      <button
        aria-expanded={false}
        className="inline-flex h-8 items-center rounded-sm border border-transparent px-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/60 hover:border-white/10 hover:bg-white/8 hover:text-white"
        data-delete-gig-toggle={eventId}
        onClick={() => setExpanded(true)}
        type="button"
      >
        {pick(locale, { en: "More ▾", ru: "Ещё ▾" })}
      </button>
    );
  }

  return (
    <form
      action={action}
      className="flex w-full flex-col gap-2 rounded-md border border-red/25 bg-red/[0.06] p-3 sm:w-auto"
      data-delete-gig-form={eventId}
    >
      <input name="eventId" type="hidden" value={eventId} />
      <input name="eventSlug" type="hidden" value={eventId} />
      <label className="space-y-1 text-xs text-white/70" htmlFor={inputId}>
        <span className="block">
          {pick(locale, {
            en: "Type the gig title to delete it permanently:",
            ru: "Введи название гига, чтобы удалить его навсегда:",
          })}
        </span>
        <span className="block font-semibold text-sand">{eventTitle}</span>
      </label>
      <input
        autoComplete="off"
        className="w-full px-3 py-2 text-sm"
        id={inputId}
        name="confirmTitle"
        onChange={(event) => setTyped(event.target.value)}
        placeholder={eventTitle}
        value={typed}
      />
      <div className="flex flex-wrap gap-2">
        <SubmitButton
          className="border-red/45 bg-red/12 text-white hover:border-red/65 hover:bg-red/18"
          disabled={!canDelete}
          pendingLabel={pick(locale, { en: "Deleting...", ru: "Удаляем..." })}
          size="sm"
          type="submit"
          variant="secondary"
        >
          {pick(locale, { en: "Delete gig", ru: "Удалить гиг" })}
        </SubmitButton>
        {collapsed ? (
          <button
            className="h-8 px-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/60 hover:text-white"
            onClick={() => {
              setExpanded(false);
              setTyped("");
            }}
            type="button"
          >
            {pick(locale, { en: "Cancel", ru: "Отмена" })}
          </button>
        ) : null}
      </div>
    </form>
  );
}
