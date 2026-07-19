<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { Search, CornerDownLeft, ArrowUp, ArrowDown } from "lucide-vue-next";
import { LCard, LInput, LButton, LTag } from "@lumina/ui";
import {
  getAllCommands,
  getRecentCommands,
  recordCommandUsage,
  type CommandItem,
} from "@/utils/commands";
import { useCommandStore } from "@/stores/command";
import { useThemeStore } from "@/stores/theme";
import { bindCommandPaletteState } from "@/utils/commands";

const commandStore = useCommandStore();
const themeStore = useThemeStore();

bindCommandPaletteState({
  toggleTheme: () => themeStore.toggleDark(),
  isDark: () => themeStore.isDark,
});

const recent = ref<CommandItem[]>(getRecentCommands());
const all = ref<CommandItem[]>(getAllCommands());
const activeIndex = ref(0);
const inputRef = ref<InstanceType<typeof LInput> | null>(null);
const listRef = ref<HTMLDivElement | null>(null);

const filtered = computed<CommandItem[]>(() => {
  const q = commandStore.query.trim().toLowerCase();
  const base: CommandItem[] = q
    ? all.value
    : [...recent.value.map((r) => ({ ...r, group: "Recent" as const })), ...all.value];
  if (!q) return base.slice(0, 30);

  return base
    .filter((item) => {
      const haystack = [
        item.title,
        item.description ?? "",
        ...(item.keywords ?? []),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    })
    .slice(0, 30);
});

const grouped = computed(() => {
  const out: Record<string, CommandItem[]> = {};
  for (const item of filtered.value) {
    if (!out[item.group]) out[item.group] = [];
    out[item.group].push(item);
  }
  return out;
});

const groupOrder = ["Recent", "Pages", "Actions", "Settings"] as const;

const flatItems = computed<CommandItem[]>(() =>
  groupOrder.flatMap((g) => grouped.value[g] ?? []),
);

watch(filtered, () => {
  activeIndex.value = 0;
});

watch(
  () => commandStore.open,
  async (open) => {
    if (open) {
      recent.value = getRecentCommands();
      all.value = getAllCommands();
      await nextTick();
      const inputEl = (inputRef.value?.$el as HTMLElement | undefined)?.querySelector("input");
      inputEl?.focus();
    }
  },
);

function execute(item: CommandItem) {
  recordCommandUsage(item.id);
  commandStore.hide();
  void item.perform();
}

function onKeydown(e: KeyboardEvent) {
  // Global open/close toggle
  const isModK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
  if (isModK) {
    e.preventDefault();
    commandStore.toggle();
    return;
  }
  if (!commandStore.open) return;
  if (e.key === "Escape") {
    e.preventDefault();
    commandStore.hide();
    return;
  }
  if (e.key === "ArrowDown") {
    e.preventDefault();
    if (flatItems.value.length === 0) return;
    activeIndex.value = (activeIndex.value + 1) % flatItems.value.length;
    scrollActiveIntoView();
    return;
  }
  if (e.key === "ArrowUp") {
    e.preventDefault();
    if (flatItems.value.length === 0) return;
    activeIndex.value =
      (activeIndex.value - 1 + flatItems.value.length) % flatItems.value.length;
    scrollActiveIntoView();
    return;
  }
  if (e.key === "Enter") {
    const item = flatItems.value[activeIndex.value];
    if (item) {
      e.preventDefault();
      execute(item);
    }
  }
}

function scrollActiveIntoView() {
  nextTick(() => {
    const el = listRef.value?.querySelector<HTMLElement>(
      `[data-cmd-index="${activeIndex.value}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  });
}

function flatIndexFor(item: CommandItem): number {
  return flatItems.value.findIndex((i) => i.id === item.id);
}

function onBackdropClick() {
  commandStore.hide();
}

onMounted(() => {
  window.addEventListener("keydown", onKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeydown);
});
</script>

<template>
  <Teleport to="body">
    <Transition name="cmd-fade">
      <div
        v-if="commandStore.open"
        class="fixed inset-0 z-[100] flex items-start justify-center bg-black/40 px-4 pt-[12vh] backdrop-blur-sm"
        @mousedown.self="onBackdropClick"
      >
        <LCard class="w-full max-w-xl overflow-hidden p-0">
          <!-- Search input -->
          <div class="flex items-center gap-2 border-b border-border px-4 py-2">
            <Search class="h-4 w-4 text-fg-tertiary" />
            <LInput
              ref="inputRef"
              :value="commandStore.query"
              :placeholder="`Search pages, actions...`"
              size="small"
              class="flex-1"
              @update:value="(v: string | null) => (commandStore.query = v ?? '')"
            />
            <LTag size="small" type="default">ESC</LTag>
          </div>

          <!-- Result list -->
          <div
            ref="listRef"
            class="max-h-[55vh] overflow-y-auto py-2"
          >
            <div
              v-if="flatItems.length === 0"
              class="px-6 py-12 text-center text-sm text-fg-tertiary"
            >
              No results for "{{ commandStore.query }}"
            </div>

            <template v-for="group in groupOrder" :key="group">
              <div v-if="grouped[group]?.length" class="pb-1">
                <div
                  class="px-4 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wider text-fg-tertiary"
                >
                  {{ group }}
                </div>
                <LButton
                  v-for="item in grouped[group]"
                  :key="item.id"
                  text
                  size="sm"
                  :data-cmd-index="flatIndexFor(item)"
                  :class="[
                    '!flex !h-auto !w-full !justify-start !gap-3 !rounded-none !px-4 !py-2',
                    flatIndexFor(item) === activeIndex
                      ? '!bg-canvas !text-fg-primary'
                      : '!text-fg-secondary',
                  ]"
                  @mouseenter="activeIndex = flatIndexFor(item)"
                  @click="execute(item)"
                >
                  <span class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border border-border bg-canvas text-fg-tertiary">
                    <component
                      :is="item.icon"
                      v-if="item.icon"
                      class="h-4 w-4"
                    />
                  </span>
                  <span class="flex min-w-0 flex-1 flex-col items-start">
                    <span class="truncate font-medium text-fg-primary">
                      {{ item.title }}
                    </span>
                    <span
                      v-if="item.description"
                      class="truncate text-xs text-fg-tertiary"
                    >
                      {{ item.description }}
                    </span>
                  </span>
                  <span
                    v-if="item.shortcut?.length"
                    class="flex flex-shrink-0 items-center gap-1"
                  >
                    <LTag
                      v-for="key in item.shortcut"
                      :key="key"
                      size="small"
                      type="default"
                      class="font-mono !text-[10px]"
                    >
                      {{ key }}
                    </LTag>
                  </span>
                </LButton>
              </div>
            </template>
          </div>

          <!-- Footer -->
          <div
            class="flex items-center justify-between border-t border-border bg-canvas px-4 py-2 text-[11px] text-fg-tertiary"
          >
            <div class="flex items-center gap-3">
              <span class="flex items-center gap-1">
                <ArrowUp class="h-3 w-3" />
                <ArrowDown class="h-3 w-3" />
                navigate
              </span>
              <span class="flex items-center gap-1">
                <CornerDownLeft class="h-3 w-3" />
                select
              </span>
            </div>
            <span class="font-mono">
              {{ commandStore.shortcutLabel }}
            </span>
          </div>
        </LCard>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.cmd-fade-enter-active,
.cmd-fade-leave-active {
  transition: opacity 150ms ease;
}
.cmd-fade-enter-from,
.cmd-fade-leave-to {
  opacity: 0;
}
</style>