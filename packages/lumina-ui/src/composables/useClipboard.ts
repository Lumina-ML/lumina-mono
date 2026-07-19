import { ref, type Ref } from "vue";

export interface UseClipboardReturn {
  copied: Ref<boolean>;
  copy: (text: string) => Promise<boolean>;
}

/**
 * 剪贴板 Composable。
 *
 * 复制成功后 2 秒内 copied 为 true。
 */
export function useClipboard(): UseClipboardReturn {
  const copied = ref(false);
  let timer: ReturnType<typeof setTimeout> | null = null;

  async function copy(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
      copied.value = true;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        copied.value = false;
      }, 2000);
      return true;
    } catch {
      return false;
    }
  }

  return {
    copied,
    copy,
  };
}
