import { format, formatDistanceToNow } from "date-fns";
import { zhCN, enUS } from "date-fns/locale";

const locale = navigator.language.startsWith("zh") ? zhCN : enUS;

export function useDateFormat() {
  function formatDate(date: string | Date | number, fmt = "yyyy-MM-dd HH:mm"): string {
    return format(new Date(date), fmt, { locale });
  }

  function formatRelative(date: string | Date | number): string {
    return formatDistanceToNow(new Date(date), { addSuffix: true, locale });
  }

  function formatDurationMs(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  return { formatDate, formatRelative, formatDurationMs };
}
