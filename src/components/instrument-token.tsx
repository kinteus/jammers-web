import {
  AudioLines,
  Drum,
  Guitar,
  MicVocal,
  Piano,
  Shapes,
  type LucideIcon,
} from "lucide-react";

import { getRoleFamilyLabel, pick, type Locale } from "@/lib/i18n";
import { getRoleFamilyKey, type RoleFamilyKey } from "@/lib/role-families";
import { cn } from "@/lib/utils";

const instrumentIconMap: Record<RoleFamilyKey, LucideIcon> = {
  rhythm: Drum,
  guitars: Guitar,
  bass: AudioLines,
  vocals: MicVocal,
  keys: Piano,
  extras: Shapes,
};

const instrumentToneMap: Record<RoleFamilyKey, string> = {
  rhythm: "border-red/18 bg-red/10 text-red",
  guitars: "border-blue/18 bg-blue/10 text-blue",
  bass: "border-gold/18 bg-gold/10 text-gold",
  vocals: "border-white/16 bg-white/10 text-white",
  keys: "border-red/16 bg-red/8 text-sand",
  extras: "border-white/14 bg-white/8 text-white/82",
};

export function getInstrumentFamilyLabel(
  label: string,
  locale: Locale,
  key?: string,
) {
  const family = getRoleFamilyKey(label, key);
  return getRoleFamilyLabel(family, locale);
}

export function InstrumentToken({
  label,
  locale,
  meta,
  keyHint,
  compact = false,
  className,
}: {
  label: string;
  locale: Locale;
  meta?: string | null;
  keyHint?: string;
  compact?: boolean;
  className?: string;
}) {
  const family = getRoleFamilyKey(label, keyHint);
  const Icon = instrumentIconMap[family];

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03]",
        compact ? "px-3 py-2" : "px-4 py-3",
        className,
      )}
    >
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-lg border",
          compact ? "h-9 w-9" : "h-10 w-10",
          instrumentToneMap[family],
        )}
      >
        <Icon className={compact ? "h-4 w-4" : "h-5 w-5"} />
      </span>
      <span className="min-w-0 space-y-0.5">
        <span className="block text-sm font-semibold text-sand">{label}</span>
        {meta ? (
          <span className="block text-xs leading-5 text-white/56">{meta}</span>
        ) : (
          <span className="block text-xs leading-5 text-white/56">
            {pick(locale, {
              en: `${getRoleFamilyLabel(family, locale)} role`,
              ru: `${getRoleFamilyLabel(family, locale)}-роль`,
            })}
          </span>
        )}
      </span>
    </div>
  );
}
