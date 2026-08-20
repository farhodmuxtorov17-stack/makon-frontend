<script setup lang="ts">
import { BUILDINGS } from "~/data/buildings";
import {
  MATERIAL_REQUESTS,
  SERVICE_REQUESTS,
  checklistFor,
  materialsFor,
  materialsTotal,
  type MaterialRequest,
  type ServiceRequest,
  type WorkMaterialLine,
} from "~/data/operations";
import type { Capability } from "~/types/rbac";
import { dateShort, todayIso } from "~/utils/format";

type ServiceStatus = ServiceRequest["status"];

/** Material so‘rovi reyestrdagi yozuvga asos va haqiqiy pozitsiyalarni qo‘shadi */
interface MaterialRequestEntry extends MaterialRequest {
  reason?: string;
  lines?: WorkMaterialLine[];
}

interface FlowAction {
  key: string;
  labelKey: string;
  next: ServiceStatus;
  variant: "primary" | "secondary" | "success";
  icon: string;
  progress: number;
  noteKey: string;
  questionKey: string;
  /** Amalni bajarish uchun yetarli bo‘lgan huquqlar */
  capabilities: Capability[];
  /** Murojaatchi o‘z arizasini shu bosqichda o‘zi tasdiqlashi mumkin */
  byRequester?: boolean;
}

/** Biriktirish bosqichi rahbarga ham, ijrochiga ham ochiq */
const ASSIGN_OR_EXECUTE: Capability[] = [
  "workorder.assign",
  "workorder.execute",
];
const EXECUTE_ONLY: Capability[] = ["workorder.execute"];
/** Bajarilgan ishni ijrochining o‘zi yopmaydi: tasdiq murojaatchi tomonidan beriladi */
const CONFIRM_ONLY: Capability[] = ["workorder.assign"];

const route = useRoute();
const auth = useAuthStore();

const { t } = useI18n();
const { money, field, priorityLabel, moduleTitle, tr } = useAppLabels();

/** Kategoriya ma’lumotda o‘zbekcha saqlanadi, ko‘rinadigan nomi lug‘atdan olinadi */
const CATEGORY_KEY: Record<string, string> = {
  Santexnika: "serviceCategory.plumbing",
  Elektr: "serviceCategory.electric",
  Konditsioner: "serviceCategory.hvac",
  Qurilish: "serviceCategory.construction",
  Tozalash: "serviceCategory.cleaning",
  Boshqa: "serviceCategory.other",
};

const requests = useState<ServiceRequest[]>("service-requests", () =>
  SERVICE_REQUESTS.map((r) => ({ ...r })),
);

/**
 * Bino doirasi kartochkada ham tekshiriladi: ro'yxat filtrlangani bilan
 * to'g'ridan-to'g'ri havola boshqa obyektning arizasini ochib berardi.
 */
const request = computed(() => {
  const found = requests.value.find((r) => r.id === String(route.params.id));
  if (!found) return undefined;
  const site = BUILDINGS.find((b) => b.name === found.buildingName);
  return site && !auth.inScope(site.id) ? undefined : found;
});

/**
 * Chek-list holati ariza id si bo‘yicha saqlanadi va ish topshiriqlari
 * sahifalari bilan bitta manbani bo‘lishadi, bandlar esa ariza
 * kategoriyasidan quriladi: santexnika ishida elektr bandi chiqmaydi.
 */
const checks = useState<Record<string, boolean[]>>("work-order-checks", () =>
  Object.fromEntries(
    SERVICE_REQUESTS.map((r) => [r.id, checklistFor(r).map((c) => c.done)]),
  ),
);

const checklist = computed(() => {
  const r = request.value;
  if (!r) return [];
  const items = checklistFor(r);
  const saved = checks.value[r.id];
  const fits = !!saved && saved.length === items.length;
  return items.map((c, i) => ({
    label: c.label,
    done: fits ? saved![i] === true : c.done,
  }));
});

const doneCount = computed(() => checklist.value.filter((c) => c.done).length);

function toggleCheck(index: number) {
  const r = request.value;
  if (!canExecute.value || !r) return;
  const items = checklistFor(r);
  const saved = checks.value[r.id];
  const list =
    saved && saved.length === items.length
      ? [...saved]
      : items.map((c) => c.done);
  list[index] = !list[index];
  checks.value[r.id] = list;
}

/** Materiallar ariza kodiga bog‘langan: har bir arizada o‘z pozitsiyalari */
const materials = computed(() =>
  request.value ? materialsFor(request.value.code) : [],
);
const materialsSum = computed(() =>
  request.value ? materialsTotal(request.value.code) : 0,
);

/** Material so‘rovlari reyestri: material sahifasi va ombor bilan umumiy */
const materialRequests = useState<MaterialRequestEntry[]>(
  "material-requests",
  () => MATERIAL_REQUESTS.map((r) => ({ ...r })),
);

const materialRequest = computed(() =>
  materialRequests.value.find((m) => m.workOrder === request.value?.code),
);

/** «Material so‘rash» amalida reyestrga haqiqiy so‘rov yoziladi */
function ensureMaterialRequest(r: ServiceRequest) {
  const open = materialRequests.value.find(
    (m) =>
      m.workOrder === r.code &&
      (m.status === "SUBMITTED" || m.status === "APPROVED"),
  );
  if (open) return;
  const lines = materialsFor(r.code);
  if (!lines.length) return;
  const seq =
    materialRequests.value.reduce(
      (m, x) => Math.max(m, Number(x.code.slice(-4)) || 0),
      0,
    ) + 1;
  const numbered = String(seq).padStart(4, "0");
  materialRequests.value.unshift({
    id: `mr-${numbered}`,
    code: `MT-${new Date().getFullYear()}-${numbered}`,
    workOrder: r.code,
    requester: auth.user?.fullName ?? t("field.executor"),
    items: lines.length,
    amount: lines.reduce((s, l) => s + l.qty * l.price, 0),
    status: "SUBMITTED",
    createdAt: todayIso(),
    buildingName: r.buildingName,
    reason: t("svc.materialReason", { code: r.code, title: r.title }),
    lines,
  });
}

const history = ref<
  Array<{ labelKey: string; status: ServiceStatus; at: string }>
>([]);

const timeline = computed(() => {
  const r = request.value;
  if (!r) return [];
  return [
    ...history.value.map((h) => ({
      label: t(h.labelKey),
      status: h.status,
      at: h.at || t("svc.justNow"),
    })),
    {
      label: t("svc.timelineCreated"),
      status: "NEW" as ServiceStatus,
      at: `${dateShort(r.createdAt.slice(0, 10))} ${r.createdAt.slice(11)}`,
    },
  ];
});

const ACCEPT: FlowAction = {
  key: "accept",
  labelKey: "svc.actionAccept",
  next: "ASSIGNED",
  variant: "primary",
  icon: "check",
  progress: 10,
  noteKey: "svc.noteAccepted",
  questionKey: "svc.askAccept",
  capabilities: ASSIGN_OR_EXECUTE,
};

const START: FlowAction = {
  key: "start",
  labelKey: "svc.actionStart",
  next: "IN_PROGRESS",
  variant: "primary",
  icon: "wrench",
  progress: 35,
  noteKey: "svc.noteStarted",
  questionKey: "svc.askStart",
  capabilities: EXECUTE_ONLY,
};

const FLOW: Record<string, FlowAction[]> = {
  NEW: [ACCEPT],
  TRIAGE: [ACCEPT],
  ASSIGNED: [START],
  INSPECTION: [START],
  RETURNED: [START],
  IN_PROGRESS: [
    {
      key: "material",
      labelKey: "svc.actionMaterial",
      next: "MATERIAL_PENDING",
      variant: "secondary",
      icon: "box",
      progress: 50,
      noteKey: "svc.noteMaterial",
      questionKey: "svc.askMaterial",
      capabilities: EXECUTE_ONLY,
    },
    {
      key: "finish",
      labelKey: "svc.actionFinish",
      next: "COMPLETED",
      variant: "success",
      icon: "check",
      progress: 100,
      noteKey: "svc.noteFinished",
      questionKey: "svc.askFinish",
      capabilities: EXECUTE_ONLY,
    },
  ],
  MATERIAL_PENDING: [
    {
      key: "resume",
      labelKey: "svc.actionResume",
      next: "IN_PROGRESS",
      variant: "primary",
      icon: "refresh",
      progress: 60,
      noteKey: "svc.noteResumed",
      questionKey: "svc.askResume",
      capabilities: EXECUTE_ONLY,
    },
  ],
  COMPLETED: [
    {
      key: "confirm",
      labelKey: "svc.actionSendConfirm",
      next: "TENANT_CONFIRMATION",
      variant: "primary",
      icon: "send",
      progress: 100,
      noteKey: "svc.noteSentToConfirm",
      questionKey: "svc.askSendConfirm",
      capabilities: EXECUTE_ONLY,
    },
  ],
  TENANT_CONFIRMATION: [
    {
      key: "close",
      labelKey: "svc.actionConfirmClose",
      next: "CLOSED",
      variant: "success",
      icon: "check",
      progress: 100,
      noteKey: "svc.noteClosed",
      questionKey: "svc.askClose",
      capabilities: CONFIRM_ONLY,
      byRequester: true,
    },
  ],
  CLOSED: [],
};

const canExecute = computed(() => auth.can("workorder.execute"));

/** Amal huquqi: rol huquqi yoki murojaatchining o‘z tasdig‘i */
function allowedAction(action: FlowAction) {
  if (action.capabilities.some((c) => auth.can(c))) return true;
  return (
    action.byRequester === true &&
    auth.user?.fullName === request.value?.requester
  );
}

/** Rolga tegishli bo‘lmagan bosqich tugmasi umuman ko‘rsatilmaydi */
const actions = computed(() =>
  request.value ? (FLOW[request.value.status] ?? []).filter(allowedAction) : [],
);

const isClosed = computed(() => request.value?.status === "CLOSED");
const stageActions = computed(() =>
  request.value ? (FLOW[request.value.status] ?? []) : [],
);

/** Amal huquqi yo‘q rolga bosqichni kim yopishini aytadigan matn */
const waitingText = computed(() => {
  const r = request.value;
  if (!r) return "";
  if (r.status === "TENANT_CONFIRMATION")
    return t("svc.waitingConfirm", { requester: r.requester });
  return t("svc.waitingExecutor");
});

const pending = ref<FlowAction | null>(null);
const confirmOpen = computed({
  get: () => pending.value !== null,
  set: (v: boolean) => {
    if (!v) pending.value = null;
  },
});

function applyAction() {
  const action = pending.value;
  const r = request.value;
  if (action && r && allowedAction(action)) {
    r.status = action.next;
    r.progress = Math.max(r.progress, action.progress);
    if (!r.assignee && canExecute.value)
      r.assignee = auth.user?.fullName ?? t("field.executor");
    // SLA buzilgani tarixiy fakt: ish yakunlansa ham belgisi olib tashlanmaydi
    if (action.key === "material") ensureMaterialRequest(r);
    history.value.unshift({
      labelKey: action.noteKey,
      status: action.next,
      at: "",
    });
  }
  pending.value = null;
}

const PRIORITY_STYLE: Record<string, { text: string; shape: string }> = {
  Yuqori: { text: "text-danger-600", shape: "dot" },
  "O‘rtacha": { text: "text-warn-600", shape: "ring" },
  Past: { text: "text-ink-500", shape: "bar" },
};

const info = computed(() => {
  const r = request.value;
  if (!r) return [];
  return [
    { label: field("object"), value: r.buildingName },
    { label: t("svc.unitLocation"), value: r.unitCode },
    { label: field("requester"), value: r.requester },
    {
      label: field("category"),
      value: tr(CATEGORY_KEY[r.category], r.category),
    },
    {
      label: field("createdAt"),
      value: `${dateShort(r.createdAt.slice(0, 10))} ${r.createdAt.slice(11)}`,
    },
    { label: field("completeBy"), value: dateShort(r.dueAt) },
    { label: field("executor"), value: r.assignee ?? t("common.unassigned") },
  ];
});
</script>

<template>
  <AppTopbar
    :title="request?.title ?? t('svc.requestNotFound')"
    :subtitle="
      request
        ? `${request.code} · ${request.buildingName}`
        : t('svc.recordMissing')
    "
    :breadcrumb="[
      { label: moduleTitle('serviceRequests'), to: '/service-requests' },
      { label: request?.code ?? t('field.application') },
    ]"
  >
    <template #actions>
      <UiButton variant="secondary" size="sm" to="/service-requests">
        <UiIcon name="chevronLeft" :size="16" />
        {{ t("svc.backToQueue") }}
      </UiButton>
    </template>
  </AppTopbar>

  <main class="scroll-slim flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
    <template v-if="request">
      <section class="grid gap-5 xl:grid-cols-3">
        <div class="min-w-0 space-y-5 xl:col-span-2">
          <UiCard>
            <div class="flex flex-wrap items-center gap-2.5">
              <UiStatus kind="service" :value="request.status" />
              <span
                class="inline-flex items-center gap-1.5 text-[13px] font-semibold"
                :class="PRIORITY_STYLE[request.priority]?.text"
              >
                <svg
                  class="size-3 shrink-0"
                  viewBox="0 0 12 12"
                  aria-hidden="true"
                >
                  <circle
                    v-if="PRIORITY_STYLE[request.priority]?.shape === 'dot'"
                    cx="6"
                    cy="6"
                    r="4"
                    fill="currentColor"
                  />
                  <circle
                    v-else-if="
                      PRIORITY_STYLE[request.priority]?.shape === 'ring'
                    "
                    cx="6"
                    cy="6"
                    r="3.6"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  />
                  <rect
                    v-else
                    x="1.8"
                    y="4.6"
                    width="8.4"
                    height="2.8"
                    rx="1.4"
                    fill="currentColor"
                  />
                </svg>
                {{
                  t("svc.priorityValue", {
                    value: priorityLabel(request.priority),
                  })
                }}
              </span>
              <span
                v-if="request.slaBreached"
                class="inline-flex items-center gap-1.5 rounded-pill bg-danger-50 px-2.5 py-1 text-xs font-semibold text-danger-700 ring-1 ring-inset ring-danger-100"
              >
                <svg
                  class="size-3 shrink-0 text-danger-500"
                  viewBox="0 0 12 12"
                  aria-hidden="true"
                >
                  <path d="M6 1.2 11.4 10.8H.6z" fill="currentColor" />
                </svg>
                {{ t("svc.slaBreached") }}
              </span>
            </div>

            <h2 class="mt-3 text-[22px] font-bold leading-tight text-ink-900">
              {{ request.title }}
            </h2>
            <p class="tabular mt-1 text-[13px] font-semibold text-brand-600">
              {{ request.code }}
            </p>

            <dl
              class="mt-5 grid gap-x-5 gap-y-4 border-t border-ink-100 pt-5 sm:grid-cols-2 lg:grid-cols-4"
            >
              <div v-for="f in info" :key="f.label" class="min-w-0">
                <dt class="text-[12px] text-ink-500">{{ f.label }}</dt>
                <dd
                  class="mt-0.5 truncate text-[14px] font-semibold text-ink-900"
                >
                  {{ f.value }}
                </dd>
              </div>
            </dl>

            <div class="mt-5 border-t border-ink-100 pt-5">
              <h3 class="text-[13px] font-semibold text-ink-700">
                {{ t("svc.problemDescription") }}
              </h3>
              <p class="mt-1.5 text-[14px] leading-relaxed text-ink-600">
                {{ request.description }}
              </p>
            </div>

            <div class="mt-5 border-t border-ink-100 pt-5">
              <div class="flex items-baseline justify-between">
                <h3 class="text-[13px] font-semibold text-ink-700">
                  {{ t("svc.completionLevel") }}
                </h3>
                <span class="tabular text-[13px] font-bold text-ink-900"
                  >{{ request.progress }}%</span
                >
              </div>
              <div class="mt-2 h-2.5 overflow-hidden rounded-pill bg-ink-100">
                <div
                  class="h-full rounded-pill transition-all duration-300"
                  :class="
                    request.progress === 100 ? 'bg-ok-500' : 'bg-brand-500'
                  "
                  :style="{ width: `${Math.max(request.progress, 2)}%` }"
                />
              </div>
            </div>
          </UiCard>

          <UiCard
            :title="t('svc.beforeAfter')"
            :subtitle="t('svc.beforeAfterHint')"
          >
            <div class="grid gap-4 sm:grid-cols-2">
              <div
                class="relative overflow-hidden rounded-field ring-1 ring-ink-200"
              >
                <svg
                  viewBox="0 0 400 240"
                  class="block h-44 w-full"
                  aria-hidden="true"
                >
                  <rect width="400" height="240" fill="#eef2f8" />
                  <path d="M0 0h400L262 82H138z" fill="#e2e8f2" />
                  <path d="M0 240l138-70h124l138 70z" fill="#cbd4e3" />
                  <path d="M0 0v240l138-70V82z" fill="#e8edf5" />
                  <path d="M400 0v240l-138-70V82z" fill="#e8edf5" />
                  <rect x="138" y="82" width="124" height="88" fill="#dfe6f0" />
                  <rect
                    x="150"
                    y="14"
                    width="46"
                    height="6"
                    rx="3"
                    fill="#cbd4e3"
                  />
                  <rect
                    x="212"
                    y="14"
                    width="46"
                    height="6"
                    rx="3"
                    fill="#cbd4e3"
                  />
                  <rect
                    x="164"
                    y="104"
                    width="72"
                    height="46"
                    rx="4"
                    fill="#cbd4e3"
                  />
                  <path
                    d="M60 190h44M296 190h44"
                    stroke="#b9c4d6"
                    stroke-width="4"
                    stroke-linecap="round"
                  />
                </svg>
                <span
                  class="absolute left-3 top-3 rounded-pill bg-ink-900/70 px-2.5 py-1 text-[12px] font-semibold text-white"
                >
                  {{ t("svc.before") }}
                </span>
              </div>

              <div
                class="relative overflow-hidden rounded-field ring-1 ring-ink-200"
              >
                <svg
                  viewBox="0 0 400 240"
                  class="block h-44 w-full"
                  aria-hidden="true"
                >
                  <rect width="400" height="240" fill="#f4f8ff" />
                  <path d="M0 0h400L262 82H138z" fill="#e0eaff" />
                  <path d="M0 240l138-70h124l138 70z" fill="#c7d9fe" />
                  <path d="M0 0v240l138-70V82z" fill="#eef4ff" />
                  <path d="M400 0v240l-138-70V82z" fill="#eef4ff" />
                  <rect x="138" y="82" width="124" height="88" fill="#e6eeff" />
                  <rect
                    x="150"
                    y="12"
                    width="46"
                    height="9"
                    rx="4.5"
                    fill="#739afa"
                  />
                  <rect
                    x="212"
                    y="12"
                    width="46"
                    height="9"
                    rx="4.5"
                    fill="#739afa"
                  />
                  <rect
                    x="118"
                    y="40"
                    width="60"
                    height="7"
                    rx="3.5"
                    fill="#a1bffd"
                  />
                  <rect
                    x="222"
                    y="40"
                    width="60"
                    height="7"
                    rx="3.5"
                    fill="#a1bffd"
                  />
                  <rect
                    x="164"
                    y="104"
                    width="72"
                    height="46"
                    rx="4"
                    fill="#a1bffd"
                  />
                  <path
                    d="M60 190h44M296 190h44"
                    stroke="#8fb0fb"
                    stroke-width="4"
                    stroke-linecap="round"
                  />
                </svg>
                <span
                  class="absolute left-3 top-3 rounded-pill bg-ok-600/90 px-2.5 py-1 text-[12px] font-semibold text-white"
                >
                  {{ t("svc.after") }}
                </span>
              </div>
            </div>
          </UiCard>

          <UiCard
            :title="t('svc.materialsUsed')"
            :subtitle="t('svc.positionCount', { n: materials.length })"
            flush
            :padded="false"
          >
            <template #actions>
              <UiButton
                v-if="auth.canRoute('/facility/materials')"
                variant="ghost"
                size="sm"
                to="/facility/materials"
              >
                {{ moduleTitle("materials") }}
                <UiIcon name="chevronRight" :size="15" />
              </UiButton>
            </template>

            <UiTable
              :columns="[
                { key: 'name', label: field('name') },
                {
                  key: 'qty',
                  label: field('quantity'),
                  align: 'right',
                  numeric: true,
                },
                { key: 'unit', label: field('unitOfMeasure') },
                {
                  key: 'price',
                  label: field('price'),
                  align: 'right',
                  numeric: true,
                },
                {
                  key: 'total',
                  label: field('amount'),
                  align: 'right',
                  numeric: true,
                },
              ]"
              :rows="
                materials.map((m) => ({
                  ...m,
                  id: m.code,
                  total: m.qty * m.price,
                }))
              "
              :empty="t('svc.noMaterialsForRequest')"
            >
              <template #cell-price="{ row }">{{ money(row.price) }}</template>
              <template #cell-total="{ row }">
                <span class="font-bold text-ink-900">{{
                  money(row.total)
                }}</span>
              </template>
            </UiTable>

            <div
              class="flex items-center justify-between border-t border-ink-200 bg-surface-sunken px-4 py-3.5"
            >
              <span class="text-[13px] font-semibold text-ink-700">{{
                t("common.total")
              }}</span>
              <span class="tabular text-[16px] font-bold text-ink-900">{{
                money(materialsSum)
              }}</span>
            </div>

            <div
              v-if="materialRequest"
              class="flex flex-wrap items-center justify-between gap-2 border-t border-ink-100 px-4 py-3"
            >
              <span class="text-[13px] text-ink-600">
                {{ t("svc.warehouseRequest") }}
                <b class="tabular text-ink-900">{{ materialRequest.code }}</b>
                · {{ dateShort(materialRequest.createdAt) }}
              </span>
              <UiStatus
                kind="material"
                :value="materialRequest.status"
                size="sm"
              />
            </div>
          </UiCard>
        </div>

        <div class="min-w-0 space-y-5">
          <UiCard :title="t('svc.checklistTitle')">
            <template #actions>
              <span class="tabular text-[13px] font-bold text-ink-700">
                {{ doneCount }} / {{ checklist.length }}
              </span>
            </template>

            <ul class="space-y-1">
              <li v-for="(c, i) in checklist" :key="c.label">
                <button
                  type="button"
                  class="flex w-full items-center gap-3 rounded-field px-2 py-2.5 text-left transition-colors"
                  :class="
                    canExecute ? 'hover:bg-brand-50/60' : 'cursor-default'
                  "
                  :aria-pressed="c.done"
                  :disabled="!canExecute"
                  @click="toggleCheck(i)"
                >
                  <span
                    class="grid size-5 shrink-0 place-items-center rounded-full ring-1 transition-colors"
                    :class="
                      c.done
                        ? 'bg-ok-500 text-white ring-ok-500'
                        : 'bg-white text-transparent ring-ink-300'
                    "
                  >
                    <svg
                      class="size-3"
                      viewBox="0 0 12 12"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M2.6 6.3 5 8.7l4.4-5"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                    </svg>
                  </span>
                  <span
                    class="min-w-0 flex-1 text-[14px]"
                    :class="
                      c.done
                        ? 'text-ink-500 line-through'
                        : 'font-medium text-ink-800'
                    "
                  >
                    {{ c.label }}
                  </span>
                  <span
                    class="shrink-0 text-[12px] font-semibold"
                    :class="c.done ? 'text-ok-600' : 'text-ink-400'"
                  >
                    {{ c.done ? t("svc.done") : t("svc.pending") }}
                  </span>
                </button>
              </li>
            </ul>
          </UiCard>

          <UiCard
            :title="t('svc.requestActions')"
            :subtitle="t('svc.requestActionsHint')"
          >
            <div v-if="actions.length" class="space-y-2.5">
              <UiButton
                v-for="a in actions"
                :key="a.key"
                :variant="a.variant"
                block
                @click="pending = a"
              >
                <UiIcon :name="a.icon" :size="17" />
                {{ t(a.labelKey) }}
              </UiButton>
            </div>
            <p
              v-else-if="isClosed"
              class="rounded-field bg-ok-50 px-4 py-3 text-[13px] font-medium text-ok-700"
            >
              {{ t("svc.closedNoAction") }}
            </p>
            <p
              v-else-if="stageActions.length"
              class="rounded-field bg-surface-sunken px-4 py-3 text-[13px] leading-relaxed text-ink-600"
            >
              {{ waitingText }}
            </p>
            <p
              v-else
              class="rounded-field bg-surface-sunken px-4 py-3 text-[13px] text-ink-600"
            >
              {{ t("svc.noActionAtStage") }}
            </p>
          </UiCard>

          <UiCard
            :title="t('svc.requestTimeline')"
            :subtitle="t('svc.requestTimelineHint')"
            flush
            :padded="false"
          >
            <ul class="divide-y divide-ink-100 border-t border-ink-100">
              <li
                v-for="(h, i) in timeline"
                :key="i"
                class="flex items-start gap-3 px-5 py-3.5"
              >
                <span
                  class="mt-1 size-2.5 shrink-0 rounded-full"
                  :class="i === 0 ? 'bg-brand-500' : 'bg-ink-300'"
                />
                <span class="min-w-0 flex-1">
                  <span class="block text-[14px] font-medium text-ink-800">{{
                    h.label
                  }}</span>
                  <span class="mt-1 flex items-center gap-2">
                    <UiStatus kind="service" :value="h.status" size="sm" />
                    <span class="text-[12px] text-ink-500">{{ h.at }}</span>
                  </span>
                </span>
              </li>
            </ul>
          </UiCard>
        </div>
      </section>
    </template>

    <UiCard v-else>
      <div class="py-10 text-center">
        <p class="text-[16px] font-semibold text-ink-900">
          {{ t("svc.notFoundTitle") }}
        </p>
        <p class="mt-1.5 text-[13px] text-ink-500">
          {{ t("svc.notFoundHint") }}
        </p>
        <UiButton class="mt-5" to="/service-requests">
          <UiIcon name="chevronLeft" :size="17" />
          {{ t("svc.backToQueueLong") }}
        </UiButton>
      </div>
    </UiCard>
  </main>

  <UiModal
    v-model="confirmOpen"
    :title="pending ? t(pending.labelKey) : t('svc.confirmAction')"
    :subtitle="t('svc.confirmActionHint')"
    size="sm"
  >
    <p class="text-[14px] leading-relaxed text-ink-700">
      {{ pending ? t(pending.questionKey) : "" }}
    </p>
    <p
      v-if="request"
      class="mt-3 rounded-field bg-surface-sunken px-4 py-3 text-[13px] text-ink-600"
    >
      <span class="tabular font-bold text-ink-900">{{ request.code }}</span>
      · {{ request.title }}
    </p>

    <template #footer>
      <UiButton variant="ghost" @click="pending = null">{{
        t("common.cancel")
      }}</UiButton>
      <UiButton :variant="pending?.variant ?? 'primary'" @click="applyAction">
        <UiIcon name="check" :size="16" />
        {{ t("common.confirm") }}
      </UiButton>
    </template>
  </UiModal>
</template>
