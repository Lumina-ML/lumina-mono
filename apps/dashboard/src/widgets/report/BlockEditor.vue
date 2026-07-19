<script setup lang="ts">
import {
  LButton,
  LIconButton,
  LTooltip,
  LInput,
  LTag,
  LSelect,
} from "@lumina/ui";
import { Trash2, ArrowUp, ArrowDown, Plus, Code } from "lucide-vue-next";
import type { Block, BlockType } from "./blocks";
import BlockRenderer from "./BlockRenderer.vue";

const props = defineProps<{
  blocks: Block[];
  /** Index of the focused block, if any (used for "Add below" affordances). */
  focusedIndex?: number;
}>();

const emit = defineEmits<{
  "update:blocks": [blocks: Block[]];
  "add-block": [type: BlockType, index: number];
  remove: [index: number];
  move: [from: number, to: number];
  focus: [index: number];
}>();

const blockTypes: { value: BlockType; label: string }[] = [
  { value: "heading1", label: "Heading 1" },
  { value: "heading2", label: "Heading 2" },
  { value: "heading3", label: "Heading 3" },
  { value: "paragraph", label: "Paragraph" },
  { value: "code", label: "Code" },
  { value: "image", label: "Image" },
  { value: "chart", label: "Chart" },
  { value: "callout", label: "Callout" },
  { value: "divider", label: "Divider" },
];

function patchBlock(index: number, next: Block) {
  const arr = [...props.blocks];
  arr[index] = next;
  emit("update:blocks", arr);
}

function setBlockText(index: number, text: string) {
  const block = props.blocks[index]!;
  if (
    block.type === "heading1" ||
    block.type === "heading2" ||
    block.type === "heading3" ||
    block.type === "paragraph"
  ) {
    patchBlock(index, {
      ...block,
      data: { ...block.data, text },
    } as Block);
  } else if (block.type === "callout") {
    patchBlock(index, {
      ...block,
      data: { ...block.data, text },
    });
  }
}

function setBlockCode(index: number, source: string, language?: string) {
  const block = props.blocks[index]!;
  if (block.type !== "code") return;
  patchBlock(index, {
    ...block,
    data: { ...block.data, source, ...(language ? { language } : {}) },
  });
}

function setChartInputs(
  index: number,
  patch: { runId?: string; metricKey?: string; title?: string },
) {
  const block = props.blocks[index]!;
  if (block.type !== "chart") return;
  patchBlock(index, {
    ...block,
    data: { ...block.data, ...patch },
  });
}

function setImageInputs(
  index: number,
  patch: { src?: string; alt?: string; caption?: string },
) {
  const block = props.blocks[index]!;
  if (block.type !== "image") return;
  patchBlock(index, {
    ...block,
    data: { ...block.data, ...patch },
  });
}

function setCalloutVariant(index: number, variant: "info" | "warning" | "success" | "error") {
  const block = props.blocks[index]!;
  if (block.type !== "callout") return;
  patchBlock(index, { ...block, data: { ...block.data, variant } });
}

function move(index: number, dir: -1 | 1) {
  const to = index + dir;
  if (to < 0 || to >= props.blocks.length) return;
  emit("move", index, to);
}

const variantColor = (v: string) =>
  v === "warning" || v === "error" ? "warning" : v === "success" ? "success" : "info";

function unknownType(b: Block): string {
  return (b as unknown as { type: string }).type;
}
</script>

<template>
  <div class="space-y-2">
    <div
      v-if="blocks.length === 0"
      class="rounded-md border border-dashed border-border bg-canvas/50 p-12 text-center text-sm text-fg-tertiary"
    >
      Empty report. Press <kbd class="font-mono text-xs">+ Add block</kbd> below to start.
    </div>

    <div
      v-for="(block, index) in blocks"
      :key="block.id"
      class="group relative flex items-start gap-2 rounded-md border border-transparent p-2 transition-colors hover:border-border"
      @click="emit('focus', index)"
    >
      <!-- Sidebar with up/down/delete -->
      <div class="flex flex-col items-center gap-0.5 pt-2 opacity-0 transition-opacity group-hover:opacity-100">
        <LTooltip content="Move up" placement="left">
          <LIconButton
            aria-label="Move up"
            size="small"
            :disabled="index === 0"
            @click.stop="move(index, -1)"
          >
            <ArrowUp class="h-3 w-3" />
          </LIconButton>
        </LTooltip>
        <LTooltip content="Move down" placement="left">
          <LIconButton
            aria-label="Move down"
            size="small"
            :disabled="index === blocks.length - 1"
            @click.stop="move(index, 1)"
          >
            <ArrowDown class="h-3 w-3" />
          </LIconButton>
        </LTooltip>
        <LTooltip content="Delete block" placement="left">
          <LIconButton
            aria-label="Delete"
            size="small"
            @click.stop="emit('remove', index)"
          >
            <Trash2 class="h-3 w-3" />
          </LIconButton>
        </LTooltip>
      </div>

      <!-- Block body -->
      <div class="min-w-0 flex-1">
        <!-- Text-style blocks: editable input -->
        <LInput
          v-if="
            block.type === 'heading1' ||
            block.type === 'heading2' ||
            block.type === 'heading3' ||
            block.type === 'paragraph'
          "
          :value="block.data.text"
          :placeholder="
            block.type === 'heading1'
              ? 'Heading 1'
              : block.type === 'heading2'
                ? 'Heading 2'
                : block.type === 'heading3'
                  ? 'Heading 3'
                  : 'Type something…'
          "
          :class="[
            'w-full !bg-transparent !border-0 !shadow-none !ring-0 focus:!ring-1',
            block.type === 'heading1'
              ? '!text-3xl !font-bold'
              : block.type === 'heading2'
                ? '!text-2xl !font-semibold'
                : block.type === 'heading3'
                  ? '!text-xl !font-semibold'
                  : '',
          ]"
          @update:value="(v: string | null) => setBlockText(index, v ?? '')"
        />

        <div v-else-if="block.type === 'divider'" class="py-2">
          <hr class="border-border" />
        </div>

        <div v-else-if="block.type === 'code'" class="space-y-2">
          <div class="flex items-center gap-2">
            <Code class="h-3.5 w-3.5 text-fg-tertiary" />
            <LInput
              :value="block.data.language"
              size="small"
              placeholder="language"
              style="width: 120px"
              @update:value="(v: string | null) =>
                setBlockCode(index, block.data.source, v ?? 'python')
              "
            />
          </div>
          <textarea
            :value="block.data.source"
            placeholder="paste code…"
            rows="6"
            class="w-full rounded-md border border-border bg-canvas p-3 font-mono text-xs focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary"
            @input="(e) => setBlockCode(index, (e.target as HTMLTextAreaElement).value, block.data.language)"
          />
        </div>

        <div v-else-if="block.type === 'chart'" class="space-y-2">
          <div class="grid grid-cols-3 gap-2">
            <LInput
              :value="block.data.runId"
              size="small"
              placeholder="run ID"
              @update:value="(v: string | null) => setChartInputs(index, { runId: v ?? '' })"
            />
            <LInput
              :value="block.data.metricKey"
              size="small"
              placeholder="metric key (e.g. loss)"
              @update:value="(v: string | null) => setChartInputs(index, { metricKey: v ?? '' })"
            />
            <LInput
              :value="block.data.title ?? ''"
              size="small"
              placeholder="title"
              @update:value="(v: string | null) => setChartInputs(index, { title: v ?? '' })"
            />
          </div>
          <BlockRenderer :block="block" />
        </div>

        <div v-else-if="block.type === 'image'" class="space-y-2">
          <div class="grid grid-cols-2 gap-2">
            <LInput
              :value="block.data.src"
              size="small"
              placeholder="https://…"
              @update:value="(v: string | null) => setImageInputs(index, { src: v ?? '' })"
            />
            <LInput
              :value="block.data.alt"
              size="small"
              placeholder="alt text"
              @update:value="(v: string | null) => setImageInputs(index, { alt: v ?? '' })"
            />
          </div>
          <LInput
            :value="block.data.caption ?? ''"
            size="small"
            placeholder="caption (optional)"
            @update:value="(v: string | null) => setImageInputs(index, { caption: v ?? '' })"
          />
          <BlockRenderer :block="block" />
        </div>

        <div
          v-else-if="block.type === 'callout'"
          class="space-y-2 rounded-md border border-border p-3"
          :class="{
            'border-accent-info/30 bg-accent-info/10': variantColor(block.data.variant) === 'info',
            'border-accent-warning/30 bg-accent-warning/10': variantColor(block.data.variant) === 'warning',
            'border-accent-success/30 bg-accent-success/10': variantColor(block.data.variant) === 'success',
            'border-accent-danger/30 bg-accent-danger/10': variantColor(block.data.variant) === 'warning' && block.data.variant === 'error',
          }"
        >
          <LSelect
            :model-value="block.data.variant"
            :options="[
              { label: 'Info', value: 'info' },
              { label: 'Success', value: 'success' },
              { label: 'Warning', value: 'warning' },
              { label: 'Error', value: 'error' },
            ]"
            size="small"
            style="width: 120px"
            @update:value="(v) => setCalloutVariant(index, String(v) as 'info' | 'warning' | 'success' | 'error')"
          />
          <LInput
            :value="block.data.text"
            placeholder="Callout text"
            @update:value="(v: string | null) => setBlockText(index, v ?? '')"
          />
        </div>

        <div
          v-else
          class="rounded-md border border-dashed border-border p-4 text-xs text-fg-tertiary"
        >
          Unknown block type: {{ unknownType(block) }}
        </div>
      </div>
    </div>

    <!-- Add block affordance -->
    <div class="flex flex-wrap items-center gap-1 pt-2">
      <LTag size="small" type="default" class="!px-2 !py-1">
        <Plus class="mr-1 inline h-3 w-3" />
        Add block
      </LTag>
      <LButton
        v-for="t in blockTypes"
        :key="t.value"
        size="xs"
        quaternary
        @click="emit('add-block', t.value, blocks.length)"
      >
        {{ t.label }}
      </LButton>
    </div>
  </div>
</template>