"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Plus, X } from "lucide-react";

import { pick, type Locale } from "@/lib/i18n";

import { Button } from "@/components/ui/button";

export function TrackProposalDialog({
  children,
  locale,
  onOpenChange,
  open,
}: {
  children: React.ReactNode;
  locale: Locale;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
}) {
  return (
    <Dialog.Root onOpenChange={onOpenChange} open={open}>
      <Dialog.Trigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          {pick(locale, { en: "Add song", ru: "Добавить песню" })}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/45 backdrop-blur-[2px]" />
        <Dialog.Content className="brand-shell fixed left-1/2 top-1/2 z-50 max-h-[88vh] w-[min(920px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border-white/10 shadow-card">
          <div className="h-1 w-full stage-rule" />
          <div className="space-y-5 p-5 md:p-6">
            <div className="flex items-start justify-between gap-4 border-b border-ink/10 pb-4">
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-red">
                  {pick(locale, { en: "Add song", ru: "Добавить песню" })}
                </p>
                <Dialog.Title className="font-display text-2xl font-semibold uppercase tracking-[0.04em] text-sand">
                  {pick(locale, { en: "Propose a track", ru: "Предложить трек" })}
                </Dialog.Title>
                <Dialog.Description className="max-w-2xl text-sm leading-6 text-white/68">
                  {pick(locale, {
                    en: "1. Choose the song. 2. Set only the useful arrangement. 3. Publish it straight back to the board.",
                    ru: "1. Выбери песню. 2. Оставь только полезную аранжировку. 3. Сразу публикуй трек обратно на борд.",
                  })}
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button
                  aria-label={pick(locale, {
                    en: "Close add song dialog",
                    ru: "Закрыть окно добавления песни",
                  })}
                  className="ui-tooltip inline-flex h-9 w-9 items-center justify-center rounded-sm border border-white/10 bg-white/6 text-white/68 transition hover:-translate-y-0.5 hover:bg-white/10 hover:text-white"
                  data-tip={pick(locale, { en: "Close", ru: "Закрыть" })}
                  title={pick(locale, { en: "Close", ru: "Закрыть" })}
                  type="button"
                >
                  <X className="h-4 w-4" />
                </button>
              </Dialog.Close>
            </div>
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
