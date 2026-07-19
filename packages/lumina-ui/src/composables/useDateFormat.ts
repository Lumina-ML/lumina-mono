import { computed, type ComputedRef, type MaybeRefOrGetter, toValue } from "vue";

export type DateFormatPreset =
  | "datetime"
  | "date"
  | "time"
  | "iso"
  | "relative"
  | "short"
  | "long";

export interface UseDateFormatOptions {
  preset?: DateFormatPreset;
  locale?: string;
  timezone?: string;
  /** 自定义 Intl.DateTimeFormat options，优先级高于 preset */
  options?: Intl.DateTimeFormatOptions;
}

const presets: Record<DateFormatPreset, Intl.DateTimeFormatOptions> = {
  datetime: {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  },
  date: { year: "numeric", month: "short", day: "numeric" },
  time: { hour: "2-digit", minute: "2-digit", second: "2-digit" },
  iso: {},
  relative: {},
  short: { year: "numeric", month: "numeric", day: "numeric" },
  long: {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  },
};

function toDate(value: Date | string | number | undefined): Date | undefined {
  if (value === undefined || value === null) return undefined;
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function formatRelative(date: Date, now: Date): string {
  const diffMs = date.getTime() - now.getTime();
  const diffSec = Math.round(diffMs / 1000);
  const diffMin = Math.round(diffSec / 60);
  const diffHour = Math.round(diffMin / 60);
  const diffDay = Math.round(diffHour / 24);

  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

  if (Math.abs(diffSec) < 60) return rtf.format(diffSec, "second");
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, "minute");
  if (Math.abs(diffHour) < 24) return rtf.format(diffHour, "hour");
  if (Math.abs(diffDay) < 30) return rtf.format(diffDay, "day");
  if (diffDay > 0) return rtf.format(Math.round(diffDay / 30), "month");
  return rtf.format(Math.round(diffDay / 365), "year");
}

/**
 * 日期格式化 Composable。
 *
 * 基于原生 Intl.DateTimeFormat，支持预设与自定义选项。
 */
export function useDateFormat(
  value: MaybeRefOrGetter<Date | string | number | undefined>,
  options: UseDateFormatOptions = {},
): ComputedRef<string> {
  const { preset = "datetime", locale, timezone, options: customOptions } = options;

  return computed(() => {
    const date = toDate(toValue(value));
    if (!date) return "";

    if (preset === "iso") {
      return date.toISOString();
    }

    if (preset === "relative") {
      return formatRelative(date, new Date());
    }

    const formatter = new Intl.DateTimeFormat(locale, {
      ...presets[preset],
      ...customOptions,
      timeZone: timezone ?? customOptions?.timeZone,
    });

    return formatter.format(date);
  });
}
