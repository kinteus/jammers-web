"use client";

import { useEffect, useState, useTransition } from "react";
import { GripVertical, ListOrdered } from "lucide-react";
import { useRouter } from "next/navigation";

import { moveSetlistItemAction, reorderSetlistSectionAction } from "@/server/actions";

import { Loader } from "@/components/ui/loader";
import { SubmitButton } from "@/components/ui/submit-button";

type AdminSetlistStackItem = {
  id: string;
  title: string;
  artistName: string;
  lineupSummary: string;
  orderIndex: number;
};

type AdminSetlistStackProps = {
  emptyLabel: string;
  eventId: string;
  eventSlug: string;
  items: AdminSetlistStackItem[];
  moveLabel: string;
  section: "MAIN" | "BACKLOG";
  title: string;
  targetSection: "MAIN" | "BACKLOG";
};

function reorderItems(items: AdminSetlistStackItem[], fromId: string, toId: string) {
  const next = [...items];
  const fromIndex = next.findIndex((item) => item.id === fromId);
  const toIndex = next.findIndex((item) => item.id === toId);

  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
    return items;
  }

  const [dragged] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, dragged);
  return next;
}

export function AdminSetlistStack({
  emptyLabel,
  eventId,
  eventSlug,
  items,
  moveLabel,
  section,
  targetSection,
  title,
}: AdminSetlistStackProps) {
  const router = useRouter();
  const [currentItems, setCurrentItems] = useState(items);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [isSaving, startTransition] = useTransition();

  useEffect(() => {
    if (!draggedId && !isSaving) {
      setCurrentItems(items);
    }
  }, [draggedId, isSaving, items]);

  async function persistOrder(nextItems: AdminSetlistStackItem[]) {
    const formData = new FormData();
    formData.set("eventId", eventId);
    formData.set("eventSlug", eventSlug);
    formData.set("section", section);
    formData.set("itemIds", JSON.stringify(nextItems.map((item) => item.id)));

    await reorderSetlistSectionAction(formData);
    router.refresh();
  }

  function handleDrop(targetId: string) {
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      return;
    }

    const nextItems = reorderItems(currentItems, draggedId, targetId);
    setCurrentItems(nextItems);
    setDraggedId(null);
    startTransition(() => {
      void persistOrder(nextItems);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ListOrdered className="h-4 w-4 text-gold" />
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/62">
            {title}
          </p>
        </div>
        {isSaving ? <Loader label="Saving order..." /> : null}
      </div>

      {currentItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 px-4 py-5 text-sm text-white/55">
          {emptyLabel}
        </div>
      ) : (
        <div className="space-y-3">
          {currentItems.map((item, index) => (
            <div
              className="brand-shell-soft rounded-2xl border border-white/10 px-4 py-4"
              draggable={!isSaving}
              key={item.id}
              onDragOver={(event) => event.preventDefault()}
              onDragStart={() => setDraggedId(item.id)}
              onDrop={() => handleDrop(item.id)}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-full border border-white/10 bg-black/20 text-white/54">
                    <GripVertical className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-white/42">
                      {section} · {index + 1}
                    </p>
                    <p className="truncate text-base font-semibold text-sand">
                      {item.artistName} - {item.title}
                    </p>
                    <p className="text-sm leading-6 text-white/64">{item.lineupSummary}</p>
                  </div>
                </div>

                <form action={moveSetlistItemAction} className="flex flex-wrap items-center gap-2">
                  <input name="eventId" type="hidden" value={eventId} />
                  <input name="eventSlug" type="hidden" value={eventSlug} />
                  <input name="itemId" type="hidden" value={item.id} />
                  <input name="section" type="hidden" value={targetSection} />
                  <input name="orderIndex" type="hidden" value={1} />
                  <SubmitButton pendingLabel="Moving..." size="sm" type="submit" variant="secondary">
                    {moveLabel}
                  </SubmitButton>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
