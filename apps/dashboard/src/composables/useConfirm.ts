/**
 * Promise-based confirmation dialog — a drop-in replacement for the native
 * `window.confirm`, but rendered through `LDialog` so it matches the dark
 * theme, is keyboard-accessible, and is testable.
 *
 * A single reactive singleton backs one `<ConfirmHost>` mounted at the app
 * root (see `app/App.vue`). Call sites just `await confirm({...})` and branch
 * on the boolean result:
 *
 *   const { confirm } = useConfirm();
 *   if (await confirm({ title: "Delete?", tone: "danger" })) doDelete();
 */
import { reactive } from "vue";

export type ConfirmTone = "default" | "warning" | "danger";

export interface ConfirmOptions {
  title: string;
  /** Body text. Rendered as plain text (no HTML). */
  message?: string;
  confirmText?: string;
  cancelText?: string;
  /** Colors the confirm button + optional warning banner. */
  tone?: ConfirmTone;
}

interface ConfirmState extends Required<ConfirmOptions> {
  open: boolean;
  resolve: ((value: boolean) => void) | null;
}

const state = reactive<ConfirmState>({
  open: false,
  title: "",
  message: "",
  confirmText: "Confirm",
  cancelText: "Cancel",
  tone: "default",
  resolve: null,
});

export function useConfirm() {
  function confirm(options: ConfirmOptions): Promise<boolean> {
    // Reject any previously-open request so we never leak a pending promise.
    if (state.resolve) {
      state.resolve(false);
      state.resolve = null;
    }
    return new Promise<boolean>((resolve) => {
      state.title = options.title;
      state.message = options.message ?? "";
      state.confirmText = options.confirmText ?? "Confirm";
      state.cancelText = options.cancelText ?? "Cancel";
      state.tone = options.tone ?? "default";
      state.resolve = resolve;
      state.open = true;
    });
  }

  return { confirm };
}

/** Internal accessor for the host component — not part of the public API. */
export function useConfirmHost() {
  function settle(value: boolean) {
    state.open = false;
    const resolve = state.resolve;
    state.resolve = null;
    resolve?.(value);
  }
  return { state, settle };
}
