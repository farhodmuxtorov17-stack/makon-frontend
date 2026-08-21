<script setup lang="ts">
import {
  MATERIAL_REQUESTS,
  SERVICE_REQUESTS,
  STOCK_ITEMS,
  materialsFor,
  type MaterialRequest,
  type ServiceRequest,
  type WorkMaterialLine,
} from "~/data/operations";
import { BUILDINGS } from "~/data/buildings";
import { dateShort, num, todayIso } from "~/utils/format";

/** Material so‘rovi reyestrdagi yozuvga asos va haqiqiy pozitsiyalarni qo‘shadi */
interface MaterialRequestEntry extends MaterialRequest {
  reason?: string;
  lines?: WorkMaterialLine[];
}

const auth = useAuthStore();

const { t } = useI18n();
const {
  money,
  columns: labelColumns,
  field,
  moduleTitle,
  statusLabel,
} = useAppLabels();

/** Havola faqat ochiladigan bo‘lsa ko‘rsatiladi. Super rahbar hamma joyga kiradi. */
function canOpen(path: string) {
  if (!auth.role) return false;
  return auth.role === "SUPER_HEAD" || auth.canRoute(path);
}

/** So‘rov bo‘yicha qarorni bino rahbari qabul qiladi, omborchi esa beradi */
const canDecide = computed(() => auth.can("workorder.assign"));

const requests = useState<ServiceRequest[]>("service-requests", () =>
  SERVICE_REQUESTS.map((r) => ({ ...r })),
);

/**
 * Reyestr umumiy: arizadan yaratilgan so‘rov shu ro‘yxatga tushadi va
 * ombor sahifasi aynan shu yozuvlarni ko‘radi. Sahifadan chiqilsa ham
 * yo‘qolmaydi.
 */
const list = useState<MaterialRequestEntry[]>("material-requests", () =>
  MATERIAL_REQUESTS.map((r) => ({ ...r })),
);

const tab = ref("all");
const query = ref("");

const tabs = computed(() => {
  const count = (status: string) =>
    scopedList.value.filter((r) => r.status === status).length;
  return [
    { value: "all", label: t("tab.all"), count: scopedList.value.length },
    {
      value: "SUBMITTED",
      label: statusLabel("material", "SUBMITTED"),
      count: count("SUBMITTED"),
    },
    {
      value: "APPROVED",
      label: statusLabel("material", "APPROVED"),
      count: count("APPROVED"),
    },
    {
      value: "ISSUED",
      label: statusLabel("material", "ISSUED"),
      count: count("ISSUED"),
    },
    {
      value: "REJECTED",
      label: statusLabel("material", "REJECTED"),
      count: count("REJECTED"),
    },
  ];
});

/**
 * Reyestr biriktirilgan obyektlar bilan cheklanadi.
 *
 * Ilgari hech qanday soha tekshiruvi yo'q edi: bino rahbari o'ziga
 * biriktirilmagan binoning material so'rovini «Tasdiqlash» tugmasi bilan
 * hal qila olardi.
 */
const scopedNames = computed(
  () => new Set(BUILDINGS.filter((b) => auth.inScope(b.id)).map((b) => b.name)),
);

/** Sohadagi yozuvlar: yorliq sanoqlari ham shu ro'yxatdan chiqadi */
const scopedList = computed(() =>
  list.value.filter((r) => scopedNames.value.has(r.buildingName)),
);

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();
  return scopedList.value.filter((r) => {
    if (tab.value !== "all" && r.status !== tab.value) return false;
    if (
      q &&
      ![r.code, r.workOrder, r.buildingName, r.requester].some((v) =>
        v.toLowerCase().includes(q),
      )
    )
      return false;
    return true;
  });
});

const rows = computed(() => filtered.value.map((r) => ({ ...r })));

const totalAmount = computed(() =>
  filtered.value.reduce((s, r) => s + r.amount, 0),
);

const columns = computed(() =>
  labelColumns([
    { key: "code", field: "number", width: "160px" },
    { key: "workOrder", field: "workOrder" },
    { key: "buildingName", field: "object" },
    { key: "items", field: "positions", align: "right", numeric: true },
    { key: "amount", field: "amount", align: "right", numeric: true },
    { key: "status", field: "status" },
    { key: "createdAt", field: "date" },
  ]),
);

/** So‘rov pozitsiyalari oynasidagi ustunlar ham bitta lug‘atdan o‘qiladi */
const detailColumns = computed(() =>
  labelColumns([
    { key: "name", field: "name" },
    { key: "unit", field: "unitOfMeasure" },
    { key: "qty", field: "quantity", align: "right", numeric: true },
    { key: "price", field: "price", align: "right", numeric: true },
    { key: "total", field: "amount", align: "right", numeric: true },
  ]),
);

/**
 * So‘rov pozitsiyalari haqiqiy: yangi so‘rovda foydalanuvchi qo‘shgan
 * qatorlar, reyestrdagi eski so‘rovda esa shu ish topshirig‘iga biriktirilgan
 * ombor pozitsiyalari. Shuning uchun qatorlar yig‘indisi doim so‘rov
 * summasiga teng bo‘ladi.
 */
function linesOf(r: MaterialRequestEntry): WorkMaterialLine[] {
  return r.lines ?? materialsFor(r.workOrder);
}

const detail = ref<MaterialRequestEntry | null>(null);
const detailOpen = computed({
  get: () => detail.value !== null,
  set: (v: boolean) => {
    if (!v) detail.value = null;
  },
});

const detailLines = computed(() =>
  detail.value
    ? linesOf(detail.value).map((l) => ({
        ...l,
        id: l.code,
        total: l.qty * l.price,
      }))
    : [],
);
const detailTotal = computed(() =>
  detailLines.value.reduce((s, l) => s + l.total, 0),
);
const detailOrder = computed(() =>
  detail.value
    ? requests.value.find((r) => r.code === detail.value!.workOrder)
    : undefined,
);

function openDetail(row: Record<string, unknown>) {
  detail.value = list.value.find((r) => r.id === String(row.id)) ?? null;
}

/** SUBMITTED holatidagi so‘rov bo‘yicha qaror: tasdiqlash yoki rad etish */
function decide(status: "APPROVED" | "REJECTED") {
  const target = detail.value;
  if (!target || !canDecide.value || target.status !== "SUBMITTED") return;
  // Ro'yxat cheklangan bo'lsa ham amalning o'zi alohida tekshiriladi
  if (!scopedNames.value.has(target.buildingName)) return;
  const row = list.value.find((r) => r.id === target.id);
  if (row) row.status = status;
  detail.value = null;
}

const createOpen = ref(false);
const draftLines = ref<WorkMaterialLine[]>([]);
const pickItem = ref(STOCK_ITEMS[0]!.id);
const pickQty = ref(1);
const pickOrder = ref(SERVICE_REQUESTS[1]!.code);
const reason = ref("");
const createError = ref("");

const workOrderOptions = computed(() =>
  requests.value.map((r) => ({
    value: r.code,
    label: `${r.code} · ${r.title}`,
  })),
);

const itemOptions = STOCK_ITEMS.map((i) => ({
  value: i.id,
  label: `${i.name} (${i.code})`,
}));

const draftTotal = computed(() =>
  draftLines.value.reduce((s, l) => s + l.qty * l.price, 0),
);

function addLine() {
  const item = STOCK_ITEMS.find((i) => i.id === pickItem.value);
  const qty = Number(pickQty.value);
  if (!item || !qty || qty < 1) {
    createError.value = t("wo.errPickItem");
    return;
  }
  const exists = draftLines.value.find((l) => l.code === item.code);
  if (exists) exists.qty += qty;
  else
    draftLines.value.push({
      code: item.code,
      name: item.name,
      unit: item.unit,
      price: item.price,
      qty,
    });
  pickQty.value = 1;
  createError.value = "";
}

function removeLine(code: string) {
  draftLines.value = draftLines.value.filter((l) => l.code !== code);
}

function resetDraft() {
  draftLines.value = [];
  pickQty.value = 1;
  pickItem.value = STOCK_ITEMS[0]!.id;
  reason.value = "";
  createError.value = "";
}

function submitRequest() {
  if (!draftLines.value.length) {
    createError.value = t("wo.errNoLines");
    return;
  }
  if (!reason.value.trim()) {
    createError.value = t("wo.errNoReason");
    return;
  }
  const order = requests.value.find((r) => r.code === pickOrder.value);
  const seq =
    list.value.reduce((m, r) => Math.max(m, Number(r.code.slice(-4)) || 0), 0) +
    1;
  const numbered = String(seq).padStart(4, "0");
  list.value.unshift({
    id: `mr-${numbered}`,
    // Hujjat raqamining yili joriy sanadan olinadi
    code: `MT-${new Date().getFullYear()}-${numbered}`,
    workOrder: pickOrder.value,
    requester: auth.user?.fullName ?? field("executor"),
    items: draftLines.value.length,
    amount: draftTotal.value,
    status: "SUBMITTED",
    // So‘rov bugun tuziladi, ish topshirig‘ining sanasi bilan almashtirilmaydi
    createdAt: todayIso(),
    buildingName: order?.buildingName ?? "Green Business Center",
    reason: reason.value.trim(),
    lines: draftLines.value.map((l) => ({ ...l })),
  });
  tab.value = "all";
  createOpen.value = false;
  resetDraft();
}
</script>

<template>
  <AppTopbar
    :title="moduleTitle('materials')"
    :subtitle="t('wo.materialsCaption')"
  >
    <template #actions>
      <UiButton
        v-if="canOpen('/warehouse')"
        variant="secondary"
        size="sm"
        to="/warehouse"
      >
        <UiIcon name="box" :size="16" />
        {{ t("wo.stockBalances") }}
      </UiButton>
      <UiButton size="sm" @click="createOpen = true">
        <UiIcon name="plus" :size="16" />
        {{ t("wo.newMaterialRequest") }}
      </UiButton>
    </template>
  </AppTopbar>

  <main class="scroll-slim flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
    <section class="grid gap-4 sm:grid-cols-3">
      <UiKpi
        :label="t('kpi.shownRequests')"
        :value="num(filtered.length)"
        icon="clipboard"
        tone="brand"
      />
      <UiKpi
        :label="t('kpi.selectedAmount')"
        :value="money(totalAmount)"
        icon="wallet"
        tone="violet"
      />
      <UiKpi
        :label="t('kpi.awaitingApproval')"
        :value="num(list.filter((r) => r.status === 'SUBMITTED').length)"
        icon="clock"
        tone="warn"
        class="cursor-pointer"
        @click="tab = 'SUBMITTED'"
      />
    </section>

    <UiCard
      :title="t('wo.requestsRegistry')"
      :subtitle="t('common.recordCount', { n: rows.length })"
      flush
      :padded="false"
    >
      <template #actions>
        <UiInput
          v-model="query"
          :placeholder="t('wo.materialsSearchPlaceholder')"
          class="w-64"
        >
          <template #prefix>
            <UiIcon name="search" :size="18" />
          </template>
        </UiInput>
      </template>

      <div class="border-t border-ink-100 px-5 pt-4">
        <UiTabs v-model="tab" :tabs="tabs" variant="line" />
      </div>

      <UiTable
        :columns="columns"
        :rows="rows"
        :empty="t('empty.noMatchingRequests')"
        @row-click="openDetail"
      >
        <template #cell-code="{ row }">
          <span class="tabular text-[13px] font-bold text-ink-900">{{
            row.code
          }}</span>
        </template>

        <template #cell-workOrder="{ row }">
          <span class="tabular text-[13px] font-semibold text-brand-600">{{
            row.workOrder
          }}</span>
        </template>

        <template #cell-items="{ row }">{{
          t("common.countPcs", { n: row.items })
        }}</template>

        <template #cell-amount="{ row }">
          <span class="font-bold text-ink-900">{{ money(row.amount) }}</span>
        </template>

        <template #cell-status="{ row }">
          <UiStatus kind="material" :value="row.status" size="sm" />
        </template>

        <template #cell-createdAt="{ row }">
          <span class="tabular">{{ dateShort(row.createdAt) }}</span>
        </template>
      </UiTable>

      <div
        class="flex items-center justify-between border-t border-ink-200 bg-surface-sunken px-5 py-3.5"
      >
        <span class="text-[13px] text-ink-600">
          {{ t("wo.rowClickHint") }}
        </span>
        <span class="tabular text-[14px] font-bold text-ink-900">{{
          money(totalAmount)
        }}</span>
      </div>
    </UiCard>
  </main>

  <UiModal
    v-model="detailOpen"
    :title="
      detail ? t('wo.detailTitle', { code: detail.code }) : t('wo.request')
    "
    :subtitle="
      detail ? `${detail.workOrder} · ${detail.buildingName}` : undefined
    "
    size="lg"
  >
    <div v-if="detail" class="space-y-4">
      <div class="flex flex-wrap items-center gap-3">
        <UiStatus kind="material" :value="detail.status" />
        <span class="text-[13px] text-ink-500">
          {{ t("wo.requestedBy") }}
          <b class="text-ink-800">{{ detail.requester }}</b>
        </span>
        <span class="tabular text-[13px] text-ink-500">{{
          dateShort(detail.createdAt)
        }}</span>
      </div>

      <div
        v-if="detail.reason"
        class="rounded-field bg-surface-sunken px-4 py-3"
      >
        <p class="text-[12px] text-ink-500">{{ field("basis") }}</p>
        <p class="mt-1 text-[14px] leading-relaxed text-ink-800">
          {{ detail.reason }}
        </p>
      </div>

      <UiTable :columns="detailColumns" :rows="detailLines">
        <template #cell-price="{ row }">{{ money(row.price) }}</template>
        <template #cell-total="{ row }">
          <span class="font-bold text-ink-900">{{ money(row.total) }}</span>
        </template>
      </UiTable>

      <div
        class="flex items-center justify-between rounded-field bg-surface-sunken px-4 py-3"
      >
        <span class="text-[13px] font-semibold text-ink-700">{{
          t("common.total")
        }}</span>
        <span class="tabular text-[16px] font-bold text-ink-900">{{
          money(detailTotal)
        }}</span>
      </div>
    </div>

    <template #footer>
      <UiButton variant="ghost" @click="detail = null">{{
        t("common.close")
      }}</UiButton>
      <UiButton
        v-if="detailOrder && canOpen('/service-requests')"
        variant="secondary"
        :to="`/service-requests/${detailOrder.id}`"
      >
        {{ t("wo.orderCard") }}
        <UiIcon name="chevronRight" :size="16" />
      </UiButton>
      <template v-if="canDecide && detail?.status === 'SUBMITTED'">
        <UiButton variant="secondary" @click="decide('REJECTED')">
          <UiIcon name="x" :size="16" />
          {{ t("common.reject") }}
        </UiButton>
        <UiButton variant="success" @click="decide('APPROVED')">
          <UiIcon name="check" :size="16" />
          {{ t("common.confirm") }}
        </UiButton>
      </template>
      <UiButton v-else-if="canOpen('/warehouse')" to="/warehouse">
        <UiIcon name="box" :size="16" />
        {{ t("wo.viewInWarehouse") }}
      </UiButton>
    </template>
  </UiModal>

  <UiModal
    v-model="createOpen"
    :title="t('wo.newMaterialRequest')"
    :subtitle="t('wo.newRequestSubtitle')"
    size="lg"
  >
    <div class="space-y-4">
      <UiField :label="field('workOrder')" required>
        <UiSelect v-model="pickOrder" :options="workOrderOptions" />
      </UiField>

      <div
        class="grid gap-3 rounded-field bg-surface-sunken p-4 sm:grid-cols-[1fr_120px_auto]"
      >
        <UiField :label="field('positions')">
          <UiSelect v-model="pickItem" :options="itemOptions" />
        </UiField>
        <UiField :label="field('quantity')">
          <UiInput v-model="pickQty" type="number" />
        </UiField>
        <div class="flex items-end">
          <UiButton variant="secondary" block @click="addLine">
            <UiIcon name="plus" :size="16" />
            {{ t("common.add") }}
          </UiButton>
        </div>
      </div>

      <div
        v-if="draftLines.length"
        class="overflow-hidden rounded-field ring-1 ring-ink-200"
      >
        <ul class="divide-y divide-ink-100">
          <li
            v-for="l in draftLines"
            :key="l.code"
            class="flex items-center gap-3 px-4 py-3"
          >
            <span class="min-w-0 flex-1">
              <span
                class="block truncate text-[14px] font-semibold text-ink-900"
                >{{ l.name }}</span
              >
              <span class="tabular block text-[12px] text-ink-500">
                {{ l.qty }} {{ l.unit }} × {{ money(l.price) }}
              </span>
            </span>
            <span class="tabular shrink-0 text-[14px] font-bold text-ink-900">
              {{ money(l.qty * l.price) }}
            </span>
            <button
              type="button"
              class="shrink-0 rounded-lg p-2 text-ink-400 transition-colors hover:bg-danger-50 hover:text-danger-600"
              :aria-label="t('wo.removeLineAria')"
              @click="removeLine(l.code)"
            >
              <UiIcon name="trash" :size="16" />
            </button>
          </li>
        </ul>
        <div
          class="flex items-center justify-between bg-surface-sunken px-4 py-3"
        >
          <span class="text-[13px] font-semibold text-ink-700">
            {{ t("wo.totalPositions", { n: draftLines.length }) }}
          </span>
          <span class="tabular text-[16px] font-bold text-ink-900">{{
            money(draftTotal)
          }}</span>
        </div>
      </div>

      <p
        v-else
        class="rounded-field border border-dashed border-ink-300 px-4 py-6 text-center text-[13px] text-ink-500"
      >
        {{ t("empty.noPositions") }}
      </p>

      <UiField :label="field('basis')" required :error="createError">
        <textarea
          v-model="reason"
          rows="3"
          :placeholder="t('wo.reasonPlaceholder')"
          class="scroll-slim w-full rounded-field bg-white px-3.5 py-2.5 text-sm text-ink-800 ring-1 ring-inset ring-ink-200 transition-colors placeholder:text-ink-400 hover:ring-ink-300 focus:ring-2 focus:ring-brand-500"
        />
      </UiField>
    </div>

    <template #footer>
      <UiButton variant="ghost" @click="((createOpen = false), resetDraft())">
        {{ t("common.cancel") }}
      </UiButton>
      <UiButton @click="submitRequest">
        <UiIcon name="send" :size="16" />
        {{ t("wo.submitRequest") }}
      </UiButton>
    </template>
  </UiModal>
</template>
