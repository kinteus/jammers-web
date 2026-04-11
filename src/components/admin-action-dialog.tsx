"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { Button, type ButtonProps } from "@/components/ui/button";

export function AdminActionDialog({
  badge,
  children,
  description,
  title,
  triggerLabel,
  triggerVariant = "secondary",
}: {
  badge: string;
  children: React.ReactNode;
  description: string;
  title: string;
  triggerLabel: string;
  triggerVariant?: ButtonProps["variant"];
}) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <Button className="w-full justify-between gap-3" variant={triggerVariant}>
          <span>{triggerLabel}</span>
          <span className="text-[10px] tracking-[0.18em] text-white/42">{badge}</span>
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/55 backdrop-blur-[3px]" />
        <Dialog.Content className="brand-shell fixed left-1/2 top-1/2 z-50 max-h-[88vh] w-[min(1080px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border-white/10 shadow-card">
          <div className="h-1 w-full stage-rule" />
          <div className="space-y-5 p-5 md:p-6">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-red">
                  {badge}
                </p>
                <Dialog.Title className="font-display text-2xl font-semibold uppercase tracking-[0.04em] text-sand">
                  {title}
                </Dialog.Title>
                <Dialog.Description className="max-w-2xl text-sm leading-6 text-white/68">
                  {description}
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button
                  aria-label="Close admin dialog"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-sm border border-white/10 bg-white/6 text-white/68 transition hover:-translate-y-0.5 hover:bg-white/10 hover:text-white active:translate-y-0.5"
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
