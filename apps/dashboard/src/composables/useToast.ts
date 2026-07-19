/**
 * Thin wrapper around vue-sonner's toast() so call sites don't have to import
 * from "vue-sonner" directly. Centralizes defaults and lets us swap the
 * implementation later (e.g. native notifications, audit-log hook).
 */
import { toast } from "vue-sonner";

export type ToastVariant = "info" | "success" | "warning" | "error";

export interface ToastOptions {
  variant?: ToastVariant;
  duration?: number;
  /** Optional undo handler — surfaces an Undo button in the toast. */
  undo?: () => void;
}

function show(message: string, opts: ToastOptions = {}) {
  const { variant = "info", duration = 4000, undo } = opts;
  const config: Parameters<typeof toast>[1] = {
    duration,
    ...(undo
      ? {
          action: {
            label: "Undo",
            onClick: () => undo(),
          },
        }
      : {}),
  };
  switch (variant) {
    case "success":
      toast.success(message, config);
      break;
    case "warning":
      toast.warning(message, config);
      break;
    case "error":
      toast.error(message, config);
      break;
    default:
      toast(message, config);
  }
}

export function useToast() {
  return {
    show,
    info: (m: string, opts?: Omit<ToastOptions, "variant">) =>
      show(m, { ...opts, variant: "info" }),
    success: (m: string, opts?: Omit<ToastOptions, "variant">) =>
      show(m, { ...opts, variant: "success" }),
    warning: (m: string, opts?: Omit<ToastOptions, "variant">) =>
      show(m, { ...opts, variant: "warning" }),
    error: (m: string, opts?: Omit<ToastOptions, "variant">) =>
      show(m, { ...opts, variant: "error" }),
  };
}