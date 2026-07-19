<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import {
  LPopover,
  LButton,
  LIconButton,
  LEmpty,
} from "@lumina/ui";
import {
  Bell,
  BellRing,
  Check,
  Trash2,
  X,
  CircleCheck,
  CircleAlert,
  CircleX,
  CircleDot,
} from "lucide-vue-next";
import { useNotificationsStore, type AppNotification } from "@/stores/notifications";
import { useDateFormat } from "@/composables/useDateFormat";

const router = useRouter();
const notifications = useNotificationsStore();
const { formatDate } = useDateFormat();

const unread = computed(() => notifications.unreadCount);
const open = computed({
  get: () => notifications.open,
  set: (v: boolean) => (notifications.open = v),
});

function iconFor(n: AppNotification) {
  switch (n.level) {
    case "success":
      return CircleCheck;
    case "warning":
      return CircleAlert;
    case "error":
      return CircleX;
    default:
      return CircleDot;
  }
}

function colorFor(n: AppNotification): string {
  switch (n.level) {
    case "success":
      return "text-accent-success";
    case "warning":
      return "text-accent-warning";
    case "error":
      return "text-accent-danger";
    default:
      return "text-accent-info";
  }
}

function onClickItem(n: AppNotification) {
  notifications.markRead(n.id);
  if (n.link) {
    open.value = false;
    router.push(n.link);
  }
}
</script>

<template>
  <LPopover
    v-model:show="open"
    placement="bottom-end"
    :padding="0"
    trigger="click"
  >
    <template #trigger>
      <LIconButton
        :aria-label="`Notifications (${unread} unread)`"
        class="relative"
      >
        <BellRing v-if="unread > 0" class="h-5 w-5" />
        <Bell v-else class="h-5 w-5" />
        <span
          v-if="unread > 0"
          class="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-danger px-1 text-[10px] font-semibold text-white"
        >
          {{ unread > 9 ? "9+" : unread }}
        </span>
      </LIconButton>
    </template>

    <div class="flex h-[420px] w-[360px] flex-col">
      <div class="flex items-center justify-between border-b border-border px-3 py-2">
        <div class="text-sm font-medium">Notifications</div>
        <div class="flex items-center gap-1">
          <button
            v-if="notifications.items.length > 0"
            type="button"
            class="rounded p-1 text-xs text-fg-tertiary hover:bg-canvas hover:text-fg-primary"
            @click="notifications.markAllRead"
          >
            <Check class="h-3.5 w-3.5" />
          </button>
          <button
            v-if="notifications.items.length > 0"
            type="button"
            class="rounded p-1 text-xs text-fg-tertiary hover:bg-canvas hover:text-accent-danger"
            aria-label="Clear all"
            @click="notifications.clear"
          >
            <Trash2 class="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div class="flex-1 overflow-auto">
        <LEmpty
          v-if="notifications.items.length === 0"
          class="p-8"
          title="No notifications yet"
          description="Run, artifact, and sweep events will land here."
        />
        <ul v-else class="divide-y divide-border">
          <li
            v-for="n in notifications.items"
            :key="n.id"
            class="group flex items-start gap-2 px-3 py-2 hover:bg-canvas"
            :class="n.read ? 'opacity-60' : ''"
          >
            <button
              type="button"
              class="flex min-w-0 flex-1 items-start gap-2 text-left"
              @click="onClickItem(n)"
            >
              <component
                :is="iconFor(n)"
                class="mt-0.5 h-4 w-4 flex-shrink-0"
                :class="colorFor(n)"
              />
              <div class="min-w-0 flex-1">
                <div class="flex items-center justify-between gap-2">
                  <div class="truncate text-sm font-medium">{{ n.title }}</div>
                  <span
                    v-if="!n.read"
                    class="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent-primary"
                    aria-label="Unread"
                  />
                </div>
                <div
                  v-if="n.body"
                  class="line-clamp-2 text-xs text-fg-tertiary"
                >
                  {{ n.body }}
                </div>
                <div class="mt-0.5 font-mono text-[10px] text-fg-tertiary">
                  {{ formatDate(n.occurredAt) }}
                </div>
              </div>
            </button>
            <button
              type="button"
              class="rounded p-1 text-fg-tertiary opacity-0 hover:bg-canvas hover:text-accent-danger group-hover:opacity-100"
              :aria-label="`Dismiss ${n.title}`"
              @click="notifications.dismiss(n.id)"
            >
              <X class="h-3 w-3" />
            </button>
          </li>
        </ul>
      </div>

      <div class="border-t border-border px-3 py-2 text-right">
        <LButton size="sm" text @click="open = false">Close</LButton>
      </div>
    </div>
  </LPopover>
</template>
