<script setup lang="ts">
import { computed, ref } from "vue";
import { Plus, X, Search } from "lucide-vue-next";
import { LInput, LTag, LButton } from "@lumina/ui";

export type FilterOperator =
  | "contains"
  | "equals"
  | ">"
  | ">="
  | "<"
  | "<="
  | "between";

export interface FilterChip {
  id: string;
  field: string;
  operator: FilterOperator;
  value: string;
}

const props = defineProps<{
  modelValue: FilterChip[];
  fields: Array<{ key: string; label: string; type: "text" | "number" | "date" }>;
  /** Optional quick search (matches name across visible fields). */
  quickSearch?: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [chips: FilterChip[]];
  "update:quickSearch": [value: string];
}>();

const addingNew = ref(false);
const draftField = ref<string>("");
const draftOp = ref<FilterOperator>("contains");
const draftValue = ref("");

function startAdd() {
  addingNew.value = true;
  draftField.value = props.fields[0]?.key ?? "";
  draftOp.value = "contains";
  draftValue.value = "";
}

function confirmAdd() {
  if (!draftField.value || !draftValue.value.trim()) {
    addingNew.value = false;
    return;
  }
  const chip: FilterChip = {
    id: `f-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    field: draftField.value,
    operator: draftOp.value,
    value: draftValue.value.trim(),
  };
  emit("update:modelValue", [...props.modelValue, chip]);
  addingNew.value = false;
}

function removeChip(id: string) {
  emit(
    "update:modelValue",
    props.modelValue.filter((c) => c.id !== id),
  );
}

function fieldLabel(key: string): string {
  return props.fields.find((f) => f.key === key)?.label ?? key;
}

function fieldType(key: string): "text" | "number" | "date" {
  return props.fields.find((f) => f.key === key)?.type ?? "text";
}

const operatorsFor = (type: string): FilterOperator[] => {
  if (type === "number")
    return ["=", ">", ">=", "<", "<=", "between"] as FilterOperator[];
  if (type === "date") return [">", "<", "between"] as FilterOperator[];
  return ["contains", "equals"] as FilterOperator[];
};

const quickSearchModel = computed({
  get: () => props.quickSearch ?? "",
  set: (v: string) => emit("update:quickSearch", v),
});

const opSymbol = (op: FilterOperator) => {
  switch (op) {
    case "contains":
      return "contains";
    case "equals":
      return "=";
    case ">":
      return ">";
    case ">=":
      return "≥";
    case "<":
      return "<";
    case "<=":
      return "≤";
    case "between":
      return "between";
  }
};
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <LInput
      v-model:value="quickSearchModel"
      size="small"
      placeholder="Quick search…"
      style="width: 200px"
    >
      <template #prefix>
        <Search class="h-3.5 w-3.5 text-fg-tertiary" />
      </template>
    </LInput>

    <LTag
      v-for="chip in modelValue"
      :key="chip.id"
      size="small"
      closable
      type="info"
      @close="removeChip(chip.id)"
    >
      <span class="font-mono">{{ fieldLabel(chip.field) }}</span>
      <span class="mx-1 text-fg-tertiary">{{ opSymbol(chip.operator) }}</span>
      <span class="font-mono">{{ chip.value }}</span>
      <LIconButton
        class="!ml-1 !text-fg-tertiary hover:!text-fg-primary"
        aria-label="Remove filter"
        @click="removeChip(chip.id)"
      >
        <X class="h-3 w-3" />
      </LIconButton>
    </LTag>

    <!-- Add chip form -->
    <div
      v-if="addingNew"
      class="flex items-center gap-1 rounded-md border border-border bg-card p-1"
    >
      <LSelect
        v-model="draftField"
        size="small"
        class="!text-xs"
      >
        <option
          v-for="f in fields"
          :key="f.key"
          :value="f.key"
        >
          {{ f.label }}
        </option>
      </LSelect>
      <LSelect
        v-model="draftOp"
        size="small"
        class="!text-xs"
      >
        <option
          v-for="op in operatorsFor(fieldType(draftField))"
          :key="op"
          :value="op"
        >
          {{ opSymbol(op) }}
        </option>
      </LSelect>
      <LInput
        v-model="draftValue"
        type="text"
        placeholder="value"
        size="small"
        class="!w-24 !font-mono !text-xs"
        @keydown.enter="confirmAdd"
        @keydown.esc="addingNew = false"
      />
      <LButton size="xs" @click="confirmAdd">Add</LButton>
      <LButton size="xs" quaternary @click="addingNew = false">
        <X class="h-3 w-3" />
      </LButton>
    </div>

    <LButton v-else size="xs" @click="startAdd">
      <Plus class="mr-1 h-3 w-3" />
      Filter
    </LButton>
  </div>
</template>