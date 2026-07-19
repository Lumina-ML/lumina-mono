<script setup lang="ts">
import { computed, ref } from "vue";
import { useMutation, useQueryClient } from "@tanstack/vue-query";
import {
  LCard,
  LSkeleton,
  LButton,
  LEmpty,
  LInput,
  LTextarea,
  LSelect,
  LStatistic,
  LDialog,
  LTag,
} from "@lumina/ui";
import {
  Plus,
  ListOrdered,
  Search,
  Briefcase,
  Send,
  Terminal,
  Image as ImageIcon,
} from "lucide-vue-next";
import { useProjects } from "@/modules/project/composables/useProjects";
import {
  useLaunchQueues,
  useLaunchJobs,
} from "@/modules/launch/composables/useLaunch";
import { LaunchService } from "@/services/launch.service";
import { useToast } from "@/composables/useToast";
import { useDateFormat } from "@/composables/useDateFormat";
import QueueRow from "@/modules/launch/pages/QueueRow.vue";

const toast = useToast();
const queryClient = useQueryClient();
const { formatDate } = useDateFormat();

const { data: projects } = useProjects();
const selectedProjectId = ref<string | null>(null);

const effectiveProjectId = computed(() => {
  if (selectedProjectId.value) return selectedProjectId.value;
  return projects.value?.items?.[0]?.id;
});

const { data: queues, isLoading: queuesLoading } =
  useLaunchQueues(effectiveProjectId);
const { data: jobs, isLoading: jobsLoading } = useLaunchJobs(effectiveProjectId);

const totalRuns = computed(
  () =>
    queues.value?.items.reduce((a, q) => a + (q._count?.runs ?? 0), 0) ?? 0,
);

const projectOptions = computed(() =>
  (projects.value?.items ?? []).map((p) => ({
    label: p.name,
    value: p.id,
  })),
);

const search = ref("");
const filteredQueues = computed(() => {
  const q = search.value.trim().toLowerCase();
  const items = queues.value?.items ?? [];
  if (!q) return items;
  return items.filter(
    (x) =>
      x.name.toLowerCase().includes(q) || x.id.toLowerCase().includes(q),
  );
});

const filteredJobs = computed(() => {
  const q = search.value.trim().toLowerCase();
  const items = jobs.value?.items ?? [];
  if (!q) return items;
  return items.filter(
    (x) =>
      x.name.toLowerCase().includes(q) || x.id.toLowerCase().includes(q),
  );
});

// ── Create queue dialog ───────────────────────────────────────────────
const queueOpen = ref(false);
const newQueueName = ref("");
const queueError = ref<string | null>(null);
const createQueueMutation = useMutation({
  mutationFn: () =>
    LaunchService.createQueue(effectiveProjectId.value!, {
      name: newQueueName.value.trim(),
    }),
  onSuccess: () => {
    toast.success("Queue created");
    queueOpen.value = false;
    newQueueName.value = "";
    queueError.value = null;
    queryClient.invalidateQueries({ queryKey: ["launch-queues"] });
  },
  onError: (e) => {
    const msg = (e as Error).message ?? "Unknown error";
    queueError.value = msg;
    toast.error(`Failed: ${msg}`);
  },
});

function openCreateQueue() {
  newQueueName.value = "";
  queueError.value = null;
  queueOpen.value = true;
}

function submitQueue() {
  queueError.value = null;
  if (!newQueueName.value.trim()) {
    queueError.value = "Name is required";
    return;
  }
  createQueueMutation.mutate();
}

// ── Create job dialog ──────────────────────────────────────────────────
const jobOpen = ref(false);
const newJobName = ref("");
const newJobImage = ref("");
const newJobCommandText = ref("");
const newJobArgsText = ref("");
const newJobEnvJson = ref("{}");
const jobError = ref<string | null>(null);
const createJobMutation = useMutation({
  mutationFn: () => {
    const command = newJobCommandText.value
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    const args = newJobArgsText.value
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    let env: Record<string, string> = {};
    const envText = newJobEnvJson.value.trim();
    if (envText && envText !== "{}") {
      try {
        const parsed = JSON.parse(envText);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          for (const [k, v] of Object.entries(parsed)) {
            env[k] = String(v);
          }
        } else {
          throw new Error("Env must be a JSON object");
        }
      } catch (e) {
        throw new Error(`Invalid env JSON: ${(e as Error).message}`);
      }
    }
    return LaunchService.createJob(effectiveProjectId.value!, {
      name: newJobName.value.trim(),
      ...(newJobImage.value.trim()
        ? { image: newJobImage.value.trim() }
        : {}),
      ...(command.length ? { command } : {}),
      ...(args.length ? { args } : {}),
      ...(Object.keys(env).length ? { env } : {}),
    });
  },
  onSuccess: () => {
    toast.success("Job created");
    jobOpen.value = false;
    resetJobForm();
    queryClient.invalidateQueries({ queryKey: ["launch-jobs"] });
  },
  onError: (e) => {
    const msg = (e as Error).message ?? "Unknown error";
    jobError.value = msg;
    toast.error(`Failed: ${msg}`);
  },
});

function resetJobForm() {
  newJobName.value = "";
  newJobImage.value = "";
  newJobCommandText.value = "";
  newJobArgsText.value = "";
  newJobEnvJson.value = "{}";
  jobError.value = null;
}

function openCreateJob() {
  resetJobForm();
  jobOpen.value = true;
}

function submitJob() {
  jobError.value = null;
  if (!newJobName.value.trim()) {
    jobError.value = "Name is required";
    return;
  }
  createJobMutation.mutate();
}

// ── Enqueue run dialog ─────────────────────────────────────────────────
const enqueueOpen = ref(false);
const enqueueJobId = ref<string | null>(null);
const enqueueQueueId = ref<string | null>(null);
const enqueueError = ref<string | null>(null);

const jobOptions = computed(() =>
  (jobs.value?.items ?? []).map((j) => ({
    label: j.name + (j.image ? `  (${j.image})` : ""),
    value: j.id,
  })),
);
const queueOptions = computed(() =>
  (queues.value?.items ?? []).map((q) => ({
    label: q.name,
    value: q.id,
  })),
);

const enqueueMutation = useMutation({
  mutationFn: () =>
    LaunchService.createRun(effectiveProjectId.value!, {
      queueId: enqueueQueueId.value!,
      jobId: enqueueJobId.value!,
    }),
  onSuccess: () => {
    toast.success("Run enqueued");
    enqueueOpen.value = false;
    queryClient.invalidateQueries({ queryKey: ["launch-runs"] });
    queryClient.invalidateQueries({ queryKey: ["launch-queues"] });
  },
  onError: (e) => {
    const msg = (e as Error).message ?? "Unknown error";
    enqueueError.value = msg;
    toast.error(`Failed: ${msg}`);
  },
});

function openEnqueue() {
  enqueueJobId.value = jobOptions.value[0]?.value ?? null;
  enqueueQueueId.value = queueOptions.value[0]?.value ?? null;
  enqueueError.value = null;
  enqueueOpen.value = true;
}

function submitEnqueue() {
  enqueueError.value = null;
  if (!enqueueJobId.value || !enqueueQueueId.value) {
    enqueueError.value = "Pick both a queue and a job";
    return;
  }
  enqueueMutation.mutate();
}
</script>

<template>
  <div class="space-y-6">
    <!-- Toolbar -->
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="flex items-center gap-2">
        <LSelect
          v-model:value="selectedProjectId"
          :options="projectOptions"
          placeholder="Pick a project"
          style="width: 220px"
          clearable
        />
        <LInput
          v-model:value="search"
          size="small"
          placeholder="Search…"
          style="width: 200px"
        >
          <template #prefix>
            <Search class="h-3.5 w-3.5 text-fg-tertiary" />
          </template>
        </LInput>
      </div>
      <div class="flex items-center gap-2">
        <LButton
          size="sm"
          quaternary
          :disabled="!effectiveProjectId || (jobs?.items.length ?? 0) === 0 || (queues?.items.length ?? 0) === 0"
          @click="openEnqueue"
        >
          <Send class="mr-1 h-3 w-3" />
          Enqueue run
        </LButton>
        <LButton
          size="sm"
          quaternary
          :disabled="!effectiveProjectId"
          @click="openCreateJob"
        >
          <Briefcase class="mr-1 h-3 w-3" />
          New job
        </LButton>
        <LButton
          size="sm"
          :disabled="!effectiveProjectId"
          @click="openCreateQueue"
        >
          <Plus class="mr-1 h-3 w-3" />
          New queue
        </LButton>
      </div>
    </div>

    <!-- Stats -->
    <div class="grid gap-3 sm:grid-cols-3">
      <LCard class="p-4">
        <LStatistic
          label="Queues"
          :value="String(queues?.items.length ?? 0)"
        />
      </LCard>
      <LCard class="p-4">
        <LStatistic label="Jobs" :value="String(jobs?.items.length ?? 0)" />
      </LCard>
      <LCard class="p-4">
        <LStatistic label="Total runs" :value="String(totalRuns)" />
      </LCard>
    </div>

    <!-- Queues list -->
    <LCard class="p-0">
      <div class="flex items-center gap-2 border-b border-border px-4 py-3">
        <ListOrdered class="h-4 w-4 text-fg-tertiary" />
        <h3 class="text-sm font-medium">Queues</h3>
        <span class="font-mono text-xs text-fg-tertiary">
          {{ filteredQueues.length }}
        </span>
      </div>

      <LSkeleton v-if="queuesLoading" class="p-8" :repeat="3" />

      <LEmpty
        v-else-if="filteredQueues.length === 0"
        class="p-12"
        title="No launch queues"
        description="Create a queue to enqueue jobs for remote agents."
      >
        <LButton
          class="mt-2"
          :disabled="!effectiveProjectId"
          @click="openCreateQueue"
        >
          <Plus class="mr-1 h-3 w-3" />
          Create queue
        </LButton>
      </LEmpty>

      <ul v-else class="divide-y divide-border">
        <li v-for="q in filteredQueues" :key="q.id" class="px-4 py-3">
          <QueueRow :queue="q" />
        </li>
      </ul>
    </LCard>

    <!-- Jobs list -->
    <LCard class="p-0">
      <div class="flex items-center gap-2 border-b border-border px-4 py-3">
        <Briefcase class="h-4 w-4 text-fg-tertiary" />
        <h3 class="text-sm font-medium">Jobs</h3>
        <span class="font-mono text-xs text-fg-tertiary">
          {{ filteredJobs.length }}
        </span>
      </div>

      <LSkeleton v-if="jobsLoading" class="p-8" :repeat="3" />

      <LEmpty
        v-else-if="filteredJobs.length === 0"
        class="p-12"
        title="No jobs defined"
        description="Jobs are the unit of work an agent runs. Each job has a name, optional image, and command."
      >
        <LButton
          class="mt-2"
          :disabled="!effectiveProjectId"
          @click="openCreateJob"
        >
          <Plus class="mr-1 h-3 w-3" />
          Create job
        </LButton>
      </LEmpty>

      <ul v-else class="divide-y divide-border">
        <li
          v-for="j in filteredJobs"
          :key="j.id"
          class="flex items-center justify-between px-4 py-3 text-sm"
        >
          <div class="min-w-0 flex-1 space-y-1">
            <div class="flex flex-wrap items-center gap-2">
              <span class="font-medium">{{ j.name }}</span>
              <span class="font-mono text-[10px] text-fg-tertiary">
                {{ j.id.slice(0, 8) }}
              </span>
              <LTag v-if="j.image" size="small" type="info">
                <ImageIcon class="mr-0.5 h-3 w-3" />
                {{ j.image }}
              </LTag>
            </div>
            <div
              v-if="j.command && j.command.length"
              class="flex flex-wrap items-center gap-1 text-[11px] text-fg-tertiary"
            >
              <Terminal class="h-3 w-3" />
              <code class="font-mono">{{ j.command.join(" ") }}</code>
              <template v-if="j.args && j.args.length">
                <span>{{ j.args.join(" ") }}</span>
              </template>
            </div>
          </div>
          <span class="font-mono text-[10px] text-fg-tertiary">
            {{ formatDate(j.createdAt) }}
          </span>
        </li>
      </ul>
    </LCard>

    <!-- Create queue dialog -->
    <LDialog
      v-model:show="queueOpen"
      title="New launch queue"
      width="420px"
      @close="queueError = null"
    >
      <div class="space-y-3">
        <div>
          <label
            for="queue-name"
            class="mb-1 block text-xs font-medium text-fg-secondary"
          >
            Name <span class="text-accent-danger">*</span>
          </label>
          <LInput
            id="queue-name"
            v-model:value="newQueueName"
            placeholder="e.g. training-default"
            autofocus
          />
        </div>
        <div
          v-if="queueError"
          class="rounded-md border border-accent-danger/30 bg-accent-danger/10 px-3 py-2 text-xs text-accent-danger"
        >
          {{ queueError }}
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <LButton quaternary @click="queueOpen = false">Cancel</LButton>
          <LButton
            :loading="createQueueMutation.isPending.value"
            :disabled="!newQueueName.trim()"
            @click="submitQueue"
          >
            Create
          </LButton>
        </div>
      </template>
    </LDialog>

    <!-- Create job dialog -->
    <LDialog
      v-model:show="jobOpen"
      title="New launch job"
      width="560px"
      @close="resetJobForm"
    >
      <div class="space-y-3">
        <div>
          <label
            for="job-name"
            class="mb-1 block text-xs font-medium text-fg-secondary"
          >
            Name <span class="text-accent-danger">*</span>
          </label>
          <LInput
            id="job-name"
            v-model:value="newJobName"
            placeholder="e.g. train-resnet50"
            autofocus
          />
        </div>
        <div>
          <label
            for="job-image"
            class="mb-1 block text-xs font-medium text-fg-secondary"
          >
            Image
          </label>
          <LInput
            id="job-image"
            v-model:value="newJobImage"
            placeholder="e.g. lumina/train:latest (optional)"
          />
          <p class="mt-1 text-[11px] text-fg-tertiary">
            When set, agents dispatch this job to a container runner instead
            of a local subprocess.
          </p>
        </div>
        <div class="grid gap-3 sm:grid-cols-2">
          <div>
            <label
              for="job-command"
              class="mb-1 block text-xs font-medium text-fg-secondary"
            >
              Command
            </label>
            <LTextarea
              id="job-command"
              v-model:value="newJobCommandText"
              :rows="3"
              placeholder="One entry per line, e.g.&#10;python&#10;-m"
            />
          </div>
          <div>
            <label
              for="job-args"
              class="mb-1 block text-xs font-medium text-fg-secondary"
            >
              Args
            </label>
            <LTextarea
              id="job-args"
              v-model:value="newJobArgsText"
              :rows="3"
              placeholder="One entry per line, e.g.&#10;train.py&#10;--epochs 10"
            />
          </div>
        </div>
        <div>
          <label
            for="job-env"
            class="mb-1 block text-xs font-medium text-fg-secondary"
          >
            Environment (JSON object)
          </label>
          <LTextarea
            id="job-env"
            v-model:value="newJobEnvJson"
            :rows="3"
            placeholder='{"CUDA_VISIBLE_DEVICES": "0"}'
          />
        </div>
        <div
          v-if="jobError"
          class="rounded-md border border-accent-danger/30 bg-accent-danger/10 px-3 py-2 text-xs text-accent-danger"
        >
          {{ jobError }}
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <LButton quaternary @click="jobOpen = false">Cancel</LButton>
          <LButton
            :loading="createJobMutation.isPending.value"
            :disabled="!newJobName.trim()"
            @click="submitJob"
          >
            Create job
          </LButton>
        </div>
      </template>
    </LDialog>

    <!-- Enqueue run dialog -->
    <LDialog
      v-model:show="enqueueOpen"
      title="Enqueue launch run"
      width="460px"
      @close="enqueueError = null"
    >
      <div class="space-y-3">
        <p class="text-xs text-fg-tertiary">
          Enqueue a run onto a queue with a specific job. Pick one of each.
        </p>
        <div>
          <label class="mb-1 block text-xs font-medium text-fg-secondary">
            Queue
          </label>
          <LSelect
            v-model:value="enqueueQueueId"
            :options="queueOptions"
            placeholder="Pick a queue"
            style="width: 100%"
          />
        </div>
        <div>
          <label class="mb-1 block text-xs font-medium text-fg-secondary">
            Job
          </label>
          <LSelect
            v-model:value="enqueueJobId"
            :options="jobOptions"
            placeholder="Pick a job"
            style="width: 100%"
          />
        </div>
        <div
          v-if="enqueueError"
          class="rounded-md border border-accent-danger/30 bg-accent-danger/10 px-3 py-2 text-xs text-accent-danger"
        >
          {{ enqueueError }}
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <LButton quaternary @click="enqueueOpen = false">Cancel</LButton>
          <LButton
            :loading="enqueueMutation.isPending.value"
            :disabled="!enqueueJobId || !enqueueQueueId"
            @click="submitEnqueue"
          >
            <Send class="mr-1 h-3 w-3" />
            Enqueue
          </LButton>
        </div>
      </template>
    </LDialog>
  </div>
</template>