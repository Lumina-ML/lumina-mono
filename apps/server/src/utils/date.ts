export function toDate(value: unknown): Date {
  return value ? new Date(value as string | number | Date) : new Date();
}

export function toDateOrNull(value: unknown): Date | null {
  return value ? new Date(value as string | number | Date) : null;
}