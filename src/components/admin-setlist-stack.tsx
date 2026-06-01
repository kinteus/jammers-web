"use client";

import { Fragment, useEffect, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Download, ListOrdered, Save } from "lucide-react";
import { useRouter } from "next/navigation";

import { moveSetlistItemAction, reorderSetlistSectionAction } from "@/server/actions";

import { Loader } from "@/components/ui/loader";
import { SubmitButton } from "@/components/ui/submit-button";

type AdminSetlistStackItem = {
  id: string;
  title: string;
  artistName: string;
  comment?: string | null;
  lineupSummary: string;
  drummerLabel?: string;
  moveDisabled?: boolean;
  moveDisabledLabel?: string;
  orderIndex: number;
  originatorLabel?: string | null;
  playbackRequired?: boolean;
  seats?: AdminSetlistStackSeat[];
};

type AdminSetlistStackProps = {
  deferOrderSave?: boolean;
  emptyLabel: string;
  eventId: string;
  eventSlug: string;
  exportCsvLabel?: string;
  items: AdminSetlistStackItem[];
  moveLabel: string;
  movePendingLabel: string;
  saveOrderLabel?: string;
  savingLabel: string;
  section: "MAIN" | "BACKLOG";
  sectionLabel: string;
  clusterItemLabel?: string;
  clusterItemsLabel?: string;
  title: string;
  targetSection: "MAIN" | "BACKLOG";
  unsavedOrderLabel?: string;
};

type AdminSetlistStackSeat = {
  label: string;
  status: string;
  isOptional: boolean;
  user: {
    fullName: string | null;
    telegramUsername: string | null;
  } | null;
};

const csvHeaders = [
  "id",
  "Band",
  "Song",
  "Comments from orgs",
  "Status",
  "Vocal 1",
  "Vocal 2",
  "Vocal 3",
  "Guitar 1",
  "Guitar 2",
  "Bass",
  "Drums",
  "Keyboard",
  "Additional Tool 1",
  "Additional Tool 2",
  "PB",
  "Tone",
  "Originator",
  "Next Song",
  "Cover (url)",
  "Duration (мс)",
];

const csvSeatColumns = [
  "Vocal 1",
  "Vocal 2",
  "Vocal 3",
  "Guitar 1",
  "Guitar 2",
  "Bass",
  "Drums",
  "Keyboard",
  "Additional Tool 1",
  "Additional Tool 2",
] as const;

function getOrderKey(items: AdminSetlistStackItem[]) {
  return items.map((item) => item.id).join("\u0000");
}

function getYoutubeSearchUrl(artistName: string, title: string) {
  const query = `${artistName} ${title}`;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

function getFullTitle(item: AdminSetlistStackItem) {
  return `${item.artistName} - ${item.title}`;
}

function escapeCsvCell(value: string | number | null | undefined) {
  const text = value == null ? "" : String(value);
  if (!/[",\n\r]/.test(text)) {
    return text;
  }
  return `"${text.replaceAll('"', '""')}"`;
}

function getSeatCsvColumn(label: string) {
  const normalized = label.trim().toLowerCase();
  if (/^vocal\b.*\b1\b|^vox\b.*\b1\b/.test(normalized)) return "Vocal 1";
  if (/^vocal\b.*\b2\b|^vox\b.*\b2\b/.test(normalized)) return "Vocal 2";
  if (/^vocal\b.*\b3\b|^vox\b.*\b3\b/.test(normalized)) return "Vocal 3";
  if (/^guitar\b.*\b1\b/.test(normalized)) return "Guitar 1";
  if (/^guitar\b.*\b2\b/.test(normalized)) return "Guitar 2";
  if (normalized === "bass" || normalized.startsWith("bass ")) return "Bass";
  if (normalized === "drums" || normalized.startsWith("drums ")) return "Drums";
  if (normalized === "keyboard" || normalized === "keys" || normalized.startsWith("keyboard ")) {
    return "Keyboard";
  }
  if (/^additional tool\b.*\b1\b|^additional\b.*\b1\b|^other\b.*\b1\b/.test(normalized)) {
    return "Additional Tool 1";
  }
  if (/^additional tool\b.*\b2\b|^additional\b.*\b2\b|^other\b.*\b2\b/.test(normalized)) {
    return "Additional Tool 2";
  }
  return null;
}

function formatUserLabel(user: AdminSetlistStackSeat["user"]) {
  if (!user) {
    return "";
  }
  if (user.telegramUsername) {
    return `@${user.telegramUsername}`;
  }
  return user.fullName ?? "";
}

function buildSetlistCsv(items: AdminSetlistStackItem[]) {
  const rows = items.map((item, index) => {
    const seatsByColumn = new Map<string, string>();
    for (const seat of item.seats ?? []) {
      if (seat.status !== "CLAIMED" || !seat.user) {
        continue;
      }
      const column = getSeatCsvColumn(seat.label);
      if (column && !seatsByColumn.has(column)) {
        seatsByColumn.set(column, formatUserLabel(seat.user));
      }
    }

    const values: Array<string | number | null | undefined> = [
      index + 1,
      item.artistName,
      item.title,
      item.comment,
      "",
      ...csvSeatColumns.map((column) => seatsByColumn.get(column) ?? ""),
      item.playbackRequired ? "yes" : "",
      "",
      item.originatorLabel ?? "",
      index < items.length - 1 ? index + 2 : "",
      "",
      "",
    ];

    return values.map(escapeCsvCell).join(",");
  });

  return [csvHeaders.join(","), ...rows].join("\n");
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

function getClusterRange(items: AdminSetlistStackItem[], index: number) {
  const drummerLabel = items[index]?.drummerLabel;
  if (!drummerLabel) {
    return null;
  }

  let start = index;
  while (start > 0 && items[start - 1]?.drummerLabel === drummerLabel) {
    start -= 1;
  }

  let end = index + 1;
  while (end < items.length && items[end]?.drummerLabel === drummerLabel) {
    end += 1;
  }

  return { end, start };
}

export function reorderSetlistCluster(
  items: AdminSetlistStackItem[],
  clusterIndex: number,
  direction: "down" | "up",
) {
  const range = getClusterRange(items, clusterIndex);
  if (!range) {
    return items;
  }

  const cluster = items.slice(range.start, range.end);

  if (direction === "up") {
    if (range.start === 0) {
      return items;
    }

    const previousRange = getClusterRange(items, range.start - 1);
    if (!previousRange) {
      return items;
    }

    return [
      ...items.slice(0, previousRange.start),
      ...cluster,
      ...items.slice(previousRange.start, range.start),
      ...items.slice(range.end),
    ];
  }

  if (range.end >= items.length) {
    return items;
  }

  const nextRange = getClusterRange(items, range.end);
  if (!nextRange) {
    return items;
  }

  return [
    ...items.slice(0, range.start),
    ...items.slice(range.end, nextRange.end),
    ...cluster,
    ...items.slice(nextRange.end),
  ];
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
  deferOrderSave = false,
  emptyLabel,
  eventId,
  eventSlug,
  exportCsvLabel,
  items,
  moveLabel,
  movePendingLabel,
  saveOrderLabel,
  savingLabel,
  section,
  sectionLabel,
  clusterItemLabel = "song",
  clusterItemsLabel = "songs",
  targetSection,
  title,
  unsavedOrderLabel = "Unsaved order",
}: AdminSetlistStackProps) {
  const router = useRouter();
  const [currentItems, setCurrentItems] = useState(items);
  const [savedOrderKey, setSavedOrderKey] = useState(() => getOrderKey(items));
  const [isSaving, startTransition] = useTransition();
  const hasUnsavedOrder = getOrderKey(currentItems) !== savedOrderKey;

  useEffect(() => {
    setCurrentItems(items);
    setSavedOrderKey(getOrderKey(items));
  }, [items]);

  async function persistOrder(nextItems: AdminSetlistStackItem[], refreshAfterSave: boolean) {
    const formData = new FormData();
    formData.set("eventId", eventId);
    formData.set("eventSlug", eventSlug);
    formData.set("section", section);
    formData.set("itemIds", JSON.stringify(nextItems.map((item) => item.id)));

    await reorderSetlistSectionAction(formData);
    setSavedOrderKey(getOrderKey(nextItems));
    if (refreshAfterSave) {
      router.refresh();
    }
  }

  function handleMove(itemId: string, direction: "down" | "up") {
    const nextItems = reorderSetlistItems(currentItems, itemId, direction);
    if (nextItems === currentItems) {
      return;
    }

    setCurrentItems(nextItems);
    if (!deferOrderSave) {
      startTransition(() => {
        void persistOrder(nextItems, true);
      });
    }
  }

  function handleClusterMove(clusterIndex: number, direction: "down" | "up") {
    const nextItems = reorderSetlistCluster(currentItems, clusterIndex, direction);
    if (nextItems === currentItems) {
      return;
    }

    setCurrentItems(nextItems);
    if (!deferOrderSave) {
      startTransition(() => {
        void persistOrder(nextItems, true);
      });
    }
  }

  function handleSaveOrder() {
    if (!hasUnsavedOrder) {
      return;
    }
    startTransition(() => {
      void persistOrder(currentItems, false);
    });
  }

  function handleExportCsv() {
    const blob = new Blob([buildSetlistCsv(currentItems)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${eventSlug}-${section.toLowerCase()}-set.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
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
        <div className="flex flex-wrap items-center justify-end gap-2">
          {hasUnsavedOrder ? (
            <span className="rounded-sm border border-gold/20 bg-gold/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-gold">
              {unsavedOrderLabel}
            </span>
          ) : null}
          {exportCsvLabel ? (
            <button
              aria-label={`Export ${title} CSV`}
              className="ui-tooltip inline-flex h-8 items-center justify-center gap-1.5 rounded-sm border border-white/12 bg-white/6 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/72 transition hover:border-white/20 hover:bg-white/12 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
              data-tip={exportCsvLabel}
              disabled={currentItems.length === 0}
              onClick={handleExportCsv}
              title={exportCsvLabel}
              type="button"
            >
              <Download className="h-3.5 w-3.5" />
              {exportCsvLabel}
            </button>
          ) : null}
          {deferOrderSave && saveOrderLabel ? (
            <button
              aria-label={`Save ${title} order`}
              className="ui-tooltip inline-flex h-8 items-center justify-center gap-1.5 rounded-sm border border-gold/30 bg-gold/14 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-sand transition hover:border-gold/45 hover:bg-gold/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
              data-tip={saveOrderLabel}
              disabled={!hasUnsavedOrder || isSaving}
              onClick={handleSaveOrder}
              title={saveOrderLabel}
              type="button"
            >
              <Save className="h-3.5 w-3.5" />
              {saveOrderLabel}
            </button>
          ) : null}
          {isSaving ? <Loader label={savingLabel} /> : null}
        </div>
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
                  <div className="flex flex-wrap items-center justify-between gap-2 border-l-2 border-gold/60 pl-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/58">
                      {drummerClusterLabel}
                    </p>
                    <div className="flex items-center gap-1">
                      <button
                        aria-label={`Move ${item.drummerLabel} cluster up`}
                        className="ui-tooltip inline-flex h-7 w-7 items-center justify-center rounded-sm border border-white/12 bg-white/6 text-white/70 transition hover:border-white/20 hover:bg-white/12 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
                        data-tip="Move drummer block up"
                        disabled={isSaving || index === 0}
                        onClick={() => handleClusterMove(index, "up")}
                        title="Move drummer block up"
                        type="button"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        aria-label={`Move ${item.drummerLabel} cluster down`}
                        className="ui-tooltip inline-flex h-7 w-7 items-center justify-center rounded-sm border border-white/12 bg-white/6 text-white/70 transition hover:border-white/20 hover:bg-white/12 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
                        data-tip="Move drummer block down"
                        disabled={isSaving || getClusterRange(currentItems, index)?.end === currentItems.length}
                        onClick={() => handleClusterMove(index, "down")}
                        title="Move drummer block down"
                        type="button"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ) : null}
                <div
                  className="brand-shell-soft rounded-lg border border-white/10 px-3 py-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-white/42">
                        {sectionLabel} · {index + 1}
                      </p>
                      <a
                        aria-label={`Search on YouTube: ${getFullTitle(item)}`}
                        className="block min-w-0 truncate text-base font-semibold text-sand transition hover:text-white hover:underline"
                        href={getYoutubeSearchUrl(item.artistName, item.title)}
                        rel="noreferrer"
                        target="_blank"
                        title={getFullTitle(item)}
                      >
                          {item.artistName} - {item.title}
                      </a>
                      <p className="text-sm leading-6 text-white/64">{item.lineupSummary}</p>
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
