import React from "react";

import { cn } from "@/lib/utils";

function renderInline(text: string, keyPrefix: string) {
  const tokens: React.ReactNode[] = [];
  const pattern = /(\*\*([^*]+)\*\*|\[([^\]]+)\]\((https?:\/\/[^)]+)\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null = null;
  let counter = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(text.slice(lastIndex, match.index));
    }

    if (match[2]) {
      tokens.push(
        <strong key={`${keyPrefix}-strong-${counter++}`} className="font-semibold text-sand">
          {match[2]}
        </strong>,
      );
    } else if (match[3] && match[4]) {
      tokens.push(
        <a
          className="text-gold underline underline-offset-4 transition hover:text-white"
          href={match[4]}
          key={`${keyPrefix}-link-${counter++}`}
          rel="noreferrer"
          target="_blank"
        >
          {match[3]}
        </a>,
      );
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    tokens.push(text.slice(lastIndex));
  }

  return tokens;
}

export function MarkdownContent({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  const lines = value.split("\n");
  const blocks: React.ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index]?.trim() ?? "";
    if (!line) {
      index += 1;
      continue;
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      const headingClass =
        level === 1
          ? "font-display text-3xl font-semibold uppercase tracking-[0.03em] text-sand"
          : level === 2
            ? "font-display text-2xl font-semibold uppercase tracking-[0.03em] text-sand"
            : "text-lg font-semibold text-sand";
      blocks.push(
        React.createElement(
          level === 1 ? "h1" : level === 2 ? "h2" : "h3",
          { className: headingClass, key: `heading-${index}` },
          renderInline(text, `heading-${index}`),
        ),
      );
      index += 1;
      continue;
    }

    const unordered = line.match(/^[-*]\s+(.+)$/);
    if (unordered) {
      const items: React.ReactNode[] = [];
      let listIndex = index;
      while (listIndex < lines.length) {
        const listLine = lines[listIndex]?.trim() ?? "";
        const itemMatch = listLine.match(/^[-*]\s+(.+)$/);
        if (!itemMatch) {
          break;
        }
        items.push(
          <li className="leading-7 text-white/78" key={`li-${listIndex}`}>
            {renderInline(itemMatch[1], `li-${listIndex}`)}
          </li>,
        );
        listIndex += 1;
      }
      blocks.push(
        <ul className="space-y-2 pl-5 marker:text-gold list-disc" key={`ul-${index}`}>
          {items}
        </ul>,
      );
      index = listIndex;
      continue;
    }

    const ordered = line.match(/^\d+\.\s+(.+)$/);
    if (ordered) {
      const items: React.ReactNode[] = [];
      let listIndex = index;
      while (listIndex < lines.length) {
        const listLine = lines[listIndex]?.trim() ?? "";
        const itemMatch = listLine.match(/^\d+\.\s+(.+)$/);
        if (!itemMatch) {
          break;
        }
        items.push(
          <li className="leading-7 text-white/78" key={`oli-${listIndex}`}>
            {renderInline(itemMatch[1], `oli-${listIndex}`)}
          </li>,
        );
        listIndex += 1;
      }
      blocks.push(
        <ol className="space-y-2 pl-5 marker:text-gold list-decimal" key={`ol-${index}`}>
          {items}
        </ol>,
      );
      index = listIndex;
      continue;
    }

    const paragraphLines = [line];
    let paragraphIndex = index + 1;
    while (paragraphIndex < lines.length) {
      const nextLine = lines[paragraphIndex]?.trim() ?? "";
      if (
        !nextLine ||
        /^#{1,3}\s+/.test(nextLine) ||
        /^[-*]\s+/.test(nextLine) ||
        /^\d+\.\s+/.test(nextLine)
      ) {
        break;
      }
      paragraphLines.push(nextLine);
      paragraphIndex += 1;
    }

    blocks.push(
      <p className="leading-7 text-white/78" key={`p-${index}`}>
        {renderInline(paragraphLines.join(" "), `p-${index}`)}
      </p>,
    );
    index = paragraphIndex;
  }

  return <div className={cn("space-y-4", className)}>{blocks}</div>;
}
