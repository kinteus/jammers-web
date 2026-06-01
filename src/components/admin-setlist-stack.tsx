"use client";

import { Fragment, useEffect, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, GripVertical, ListOrdered } from "lucide-react";
import { useRouter } from "next/navigation";

import { moveSetlistItemAction, reorderSetlistSectionAction } from "@/server/actions";

import { Loader } from "@/components/ui/loader";
import { SubmitButton } from "@/components/ui/submit-button";

type AdminSetlistStackItem = {
  id: string;
  title: string;
  artistName: string;
  lineupSummary: string;
  drummerLabel?: string;
  moveDisabled?: boolean;
  moveDisabledLabel?: string;
  orderIndex: number;
};

type AdminSetlistStackProps = {
  emptyLabel: string;
  eventId: string;
  eventSlug: string;
  items: AdminSetlistStackItem[];
  moveLabel: string;
  movePendingLabel: string;
  savingLabel: string;
  section: "MAIN" | "BACKLOG";
  sectionLabel: string;
  clusterItemLabel?: string;
  clusterItemsLabel?: string;
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

export function reorderSetlistItems(
  items: AdminSetlistStackItem[],
  itemId: string,
  direction: "down" | "up",
) {
  const index = items.findIndex((item) => item.id === itemId);
  const targetIndex = direction === "up" ? index - 1 : index + 1;

  if (index < 0 || targetIndex < 0 || targetIndex >= items.length) {
    return items;
  }

  const next = [...items];
  const [item] = next.splice(index, 1);
  next.splice(targetIndex, 0, item);
  return next;
}

function getDrummerClusterLabel(
  items: AdminSetlistStackItem[],
  index: number,
  itemLabel: string,
  itemsLabel: string,
) {
  const drummerLabel = items[index]?.drummerLabel;
  if (!drummerLabel || items[index - 1]?.drummerLabel === drummerLabel) {
    return null;
  }

  let count = 1;
  for (let nextIndex = index + 1; nextIndex < items.length; nextIndex += 1) {
    if (items[nextIndex]?.drummerLabel !== drummerLabel) {
      break;
    }
    count += 1;
  }

  return `${drummerLabel} · ${count} ${count === 1 ? itemLabel : itemsLabel}`;
}

export function AdminSetlistStack({
  emptyLabel,
  eventId,
  eventSlug,
  items,
  moveLabel,
  movePendingLabel,
  savingLabel,
  section,
  sectionLabel,
  clusterItemLabel = "song",
  clusterItemsLabel = "songs",
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

  function handleMove(itemId: string, direction: "down" | "up") {
    const nextItems = reorderSetlistItems(currentItems, itemId, direction);
    if (nextItems === currentItems) {
      return;
    }

    setCurrentItems(nextItems);
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
        {isSaving ? <Loader label={savingLabel} /> : null}
      </div>

      {currentItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 px-4 py-5 text-sm text-white/55">
          {emptyLabel}
        </div>
      ) : (
        <div className="space-y-3">
          {currentItems.map((item, index) => {
            const drummerClusterLabel = getDrummerClusterLabel(
              currentItems,
              index,
              clusterItemLabel,
              clusterItemsLabel,
            );

            return (
              <Fragment key={item.id}>
                {drummerClusterLabel ? (
                  <p className="border-l-2 border-gold/60 pl-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/58">
                    {drummerClusterLabel}
                  </p>
                ) : null}
                <div
                  className="brand-shell-soft rounded-2xl border border-white/10 px-4 py-4"
                  draggable={!isSaving}
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
                          {sectionLabel} · {index + 1}
                        </p>
                        <p className="truncate text-base font-semibold text-sand">
                          {item.artistName} - {item.title}
                        </p>
                        <p className="text-sm leading-6 text-white/64">{item.lineupSummary}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <button
                        aria-label={`Move ${item.artistName} - ${item.title} up`}
                        className="ui-tooltip inline-flex h-8 w-8 items-center justify-center rounded-sm border border-white/12 bg-white/6 text-white/72 transition hover:border-white/20 hover:bg-white/12 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
                        data-tip="Move up"
                        disabled={isSaving || index === 0}
                        onClick={() => handleMove(item.id, "up")}
                        title="Move up"
                        type="button"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        aria-label={`Move ${item.artistName} - ${item.title} down`}
                        className="ui-tooltip inline-flex h-8 w-8 items-center justify-center rounded-sm border border-white/12 bg-white/6 text-white/72 transition hover:border-white/20 hover:bg-white/12 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
                        data-tip="Move down"
                        disabled={isSaving || index === currentItems.length - 1}
                        onClick={() => handleMove(item.id, "down")}
                        title="Move down"
                        type="button"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                      <form
                        action={moveSetlistItemAction}
                        className="flex flex-wrap items-center gap-2"
                      >
                        <input name="eventId" type="hidden" value={eventId} />
                        <input name="eventSlug" type="hidden" value={eventSlug} />
                        <input name="itemId" type="hidden" value={item.id} />
                        <input name="section" type="hidden" value={targetSection} />
                        <input name="orderIndex" type="hidden" value={1} />
                        <SubmitButton
                          disabled={item.moveDisabled}
                          pendingLabel={movePendingLabel}
                          size="sm"
                          title={item.moveDisabled ? item.moveDisabledLabel : undefined}
                          type="submit"
                          variant="secondary"
                        >
                          {item.moveDisabled ? (item.moveDisabledLabel ?? moveLabel) : moveLabel}
                        </SubmitButton>
                      </form>
                    </div>
                  </div>
                </div>
              </Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}
