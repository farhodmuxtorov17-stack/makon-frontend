<script setup lang="ts">
import AppTopbar from "~/components/layout/AppTopbar.vue";
import { BUILDINGS } from "~/data/buildings";
import {
  INVOICES,
  agingKeyOf,
  agingLabel,
  agingOf,
  settledInvoices,
} from "~/data/business";
import { dateShort, num, percent, sum, todayIso } from "~/utils/format";
import { csvBlob, docxBlob, saveBlob } from "~/utils/docx";

const {
  money,
  moneyShort,
  field,
  moduleCaption,
  moduleTitle,
  sectionLabel,
  periodLabel,
} = useAppLabels();
const { t } = useI18n();

/**
 * Qarzdorlar ro‘yxati umumiy hisob-faktura reyestridan hisoblanadi: to‘lov
 * qabul qilinishi bilan qator shu yerdan ham yo‘qoladi. Muddat guruhi
 * yozuvdagi qiymatdan emas, `agingKeyOf()` dan olinadi: shunda qator KPI
 * kartochkalari bilan bir xil guruhga tushadi.
 */
const debtors = computed(() =>
  settledInvoices(INVOICES)
    .filter((i) => i.total - i.paid > 0)
    .map((i) => ({
      id: i.id,
      tenant: i.tenant,
      buildingName: i.buildingName,
      unitCode: i.unitCode,
      code: i.code,
      dueAt: i.dueAt,
      balance: i.total - i.paid,
      agingBucket: agingKeyOf(i) ?? "0-30",
      status: i.status,
    })),
);

const debtTotal = computed(() =>
  debtors.value.reduce((s, d) => s + d.balance, 0),
);

const buckets = computed(() =>
  agingOf(INVOICES).map((a, i) => ({
    ...a,
    icon: i < 2 ? "clock" : "warning",
  })),
);

const search = ref("");
const building = ref("all");
const bucket = ref("all");
const banner = ref("");

const buildingOptions = computed(() => [
  { value: "all", label: t("landing.allObjects") },
  ...BUILDINGS.map((b) => ({ value: b.name, label: b.name })),
]);

const bucketOptions = computed(() => [
  { value: "all", label: t("filter.allAging") },
  ...buckets.value.map((b) => ({ value: b.key, label: b.bucket })),
]);

const filtered = computed(() =>
  debtors.value.filter((d) => {
    const q = search.value.trim().toLowerCase();
    const byQuery =
      !q ||
      `${d.tenant} ${d.code} ${d.buildingName} ${d.unitCode}`
        .toLowerCase()
        .includes(q);
    const byBuilding =
      building.value === "all" || d.buildingName === building.value;
    const byBucket = bucket.value === "all" || d.agingBucket === bucket.value;
    return byQuery && byBuilding && byBucket;
  }),
);

const columns = computed(() => [
  { key: "tenant", label: field("organization", "Tashkilot") },
  { key: "place", label: field("objectUnit", "Obyekt / Unit") },
  { key: "code", label: field("document", "Hujjat") },
  { key: "dueAt", label: field("deadline", "Muddati") },
  {
    key: "balance",
    label: field("balance", "Qoldiq"),
    align: "right" as const,
    numeric: true,
  },
  { key: "aging", label: field("agingBucket", "Muddat guruhi") },
  { key: "status", label: field("status", "Holat") },
]);

const rows = computed(() =>
  filtered.value.map((d) => ({
    id: d.id,
    tenant: d.tenant,
    place: `${d.buildingName} · ${d.unitCode}`,
    code: d.code,
    dueAt: d.dueAt,
    balance: d.balance,
    aging: d.agingBucket,
    status: d.status,
  })),
);

const filteredTotal = computed(() =>
  filtered.value.reduce((s, d) => s + d.balance, 0),
);

function bucketMeta(key: string) {
  return buckets.value.find((b) => b.key === key) ?? buckets.value[0]!;
}

function toggleBucket(key: string) {
  bucket.value = bucket.value === key ? "all" : key;
}

function resetFilters() {
  search.value = "";
  building.value = "all";
  bucket.value = "all";
}

const historyOpen = ref(false);
const historyTenant = ref("");

const history = computed(() =>
  INVOICES.filter((i) => i.tenant === historyTenant.value),
);
const historyDebt = computed(() =>
  history.value.reduce((s, i) => s + (i.total - i.paid), 0),
);

function openHistory(row: Record<string, unknown>) {
  historyTenant.value = String(row.tenant);
  historyOpen.value = true;
}

const exportOpen = ref(false);

/**
 * Reyestr haqiqiy fayl bo‘lib yuklanadi: joriy filtrga tushgan qatorlar
 * qanday ko‘rinsa, faylda ham shunday bo‘ladi.
 */
function runExport(format: "DOCX" | "CSV") {
  const scope =
    building.value === "all" ? t("landing.allObjects") : building.value;
  /** Faylga ichki kalit («0-30») emas, ekrandagi yorliq («0–30 kun») yoziladi */
  const period =
    bucket.value === "all"
      ? t("filter.allAging")
      : bucketMeta(bucket.value).bucket;
  const title = t("bil.debtRegistry");
  const name = `${t("bil.debtRegistryFile")}-${todayIso()}.${format.toLowerCase()}`;

  if (format === "DOCX") {
    saveBlob(
      docxBlob([
        { text: title, style: "title" },
        {
          text: `${scope} · ${period} · ${dateShort(todayIso())}`,
          style: "subtitle",
        },
        {
          text: t("bil.exportTotalLine", {
            n: num(filtered.value.length),
            amount: sum(filteredTotal.value),
          }),
          style: "heading",
        },
        ...filtered.value.map((d) => ({
          text: t("bil.exportRow", {
            tenant: d.tenant,
            building: d.buildingName,
            unit: d.unitCode,
            code: d.code,
            due: dateShort(d.dueAt),
            balance: sum(d.balance),
            aging: agingLabel(d.agingBucket),
          }),
          style: "body" as const,
        })),
      ]),
      name,
    );
  } else {
    saveBlob(
      csvBlob([
        [
          field("organization", "Tashkilot"),
          field("object", "Obyekt"),
          field("unit", "Unit"),
          field("document", "Hujjat"),
          field("dueDate", "To‘lov muddati"),
          t("bil.debtCurrencyColumn"),
          field("agingBucket", "Muddat guruhi"),
        ],
        ...filtered.value.map((d) => [
          d.tenant,
          d.buildingName,
          d.unitCode,
          d.code,
          dateShort(d.dueAt),
          d.balance,
          agingLabel(d.agingBucket),
        ]),
        [t("common.total"), "", "", "", "", filteredTotal.value, ""],
      ]),
      name,
    );
  }

  banner.value = t("bil.exportDownloaded", {
    name,
    n: num(filtered.value.length),
    amount: sum(filteredTotal.value),
  });
  exportOpen.value = false;
}

const agingSlices = computed(() =>
  buckets.value.map((b) => ({
    label: b.bucket,
    value: b.amount,
    tone: b.tone,
  })),
);
</script>

<template>
  <AppTopbar
    :title="moduleTitle('debts', 'Qarzdorlik tahlili')"
    :subtitle="
      moduleCaption('debts', 'Muddati o‘tgan to‘lovlar va qarzdorlik tahlili')
    "
    :breadcrumb="[
      {
        label: sectionLabel('billing', 'Hisob-kitob'),
        to: '/billing/invoices',
      },
      { label: moduleTitle('debts', 'Qarzdorlik tahlili') },
    ]"
  >
    <template #actions>
      <UiButton variant="secondary" size="sm" to="/billing/payments">
        <UiIcon name="check" :size="16" />
        {{ moduleTitle("paymentsApprove", "To‘lovlarni tasdiqlash") }}
      </UiButton>
      <UiButton size="sm" @click="exportOpen = true">
        <UiIcon name="download" :size="16" />
        {{ t("common.export") }}
      </UiButton>
    </template>
  </AppTopbar>

  <main class="scroll-slim flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
    <div
      v-if="banner"
      class="flex items-center gap-3 rounded-card bg-ok-50 px-4 py-3 ring-1 ring-ok-100"
    >
      <UiIcon name="check" :size="18" class="text-ok-600" />
      <p class="min-w-0 flex-1 text-[13px] font-medium text-ok-700">
        {{ banner }}
      </p>
      <button
        type="button"
        class="rounded-lg p-1 text-ok-700 transition-colors hover:bg-ok-100"
        :aria-label="t('common.dismissMessage')"
        @click="banner = ''"
      >
        <UiIcon name="x" :size="16" />
      </button>
    </div>

    <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <button
        v-for="b in buckets"
        :key="b.key"
        type="button"
        class="block rounded-card text-left transition-shadow"
        :class="
          bucket === b.key
            ? 'ring-2 ring-brand-400 ring-offset-2 ring-offset-canvas'
            : ''
        "
        @click="toggleBucket(b.key)"
      >
        <UiKpi
          :label="t('bil.bucketDebt', { bucket: b.bucket })"
          :value="moneyShort(b.amount)"
          :unit="percent(b.share)"
          :icon="b.icon"
          :tone="b.tone"
        />
      </button>
    </section>

    <section class="grid gap-5 xl:grid-cols-3">
      <UiCard
        class="xl:col-span-2"
        :title="t('bil.debtorOrgs')"
        :subtitle="t('bil.debtorOrgsCaption')"
        flush
        :padded="false"
      >
        <div class="flex flex-wrap items-center gap-3 px-5 pb-4">
          <UiInput
            v-model="search"
            :placeholder="t('bil.searchDebtors')"
            class="min-w-[220px] flex-1"
          >
            <template #prefix>
              <UiIcon name="search" :size="18" />
            </template>
          </UiInput>
          <UiSelect
            v-model="building"
            :options="buildingOptions"
            class="w-full sm:w-56"
          />
          <UiSelect
            v-model="bucket"
            :options="bucketOptions"
            class="w-full sm:w-44"
          />
          <UiButton variant="ghost" @click="resetFilters">
            <UiIcon name="refresh" :size="16" />
            {{ t("common.reset") }}
          </UiButton>
        </div>

        <UiTable
          :columns="columns"
          :rows="rows"
          :empty="t('empty.noDebtsMatch')"
          @row-click="openHistory"
        >
          <template #cell-tenant="{ row }">
            <span class="font-semibold text-ink-900">{{ row.tenant }}</span>
          </template>
          <template #cell-place="{ row }">
            <span class="text-[13px] text-ink-600">{{ row.place }}</span>
          </template>
          <template #cell-code="{ row }">
            <span class="font-semibold text-brand-600">{{ row.code }}</span>
          </template>
          <template #cell-dueAt="{ row }">{{
            dateShort(String(row.dueAt))
          }}</template>
          <template #cell-balance="{ row }">
            <span class="text-danger-600">{{
              money(Number(row.balance))
            }}</span>
          </template>
          <template #cell-aging="{ row }">
            <span
              class="inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs font-semibold ring-1 ring-inset"
              :class="{
                'bg-ok-50 text-ok-700 ring-ok-100':
                  bucketMeta(String(row.aging)).tone === 'ok',
                'bg-brand-50 text-brand-700 ring-brand-200':
                  bucketMeta(String(row.aging)).tone === 'brand',
                'bg-warn-50 text-warn-700 ring-warn-100':
                  bucketMeta(String(row.aging)).tone === 'warn',
                'bg-danger-50 text-danger-700 ring-danger-100':
                  bucketMeta(String(row.aging)).tone === 'danger',
              }"
            >
              {{ bucketMeta(String(row.aging)).bucket }}
            </span>
          </template>
          <template #cell-status="{ row }">
            <UiStatus kind="invoice" :value="String(row.status)" size="sm" />
          </template>
        </UiTable>

        <div
          class="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 px-5 py-3.5"
        >
          <p class="text-[13px] text-ink-500">
            {{ t("common.totalColon") }}
            <b class="text-ink-800">{{
              t("common.countPcs", { n: rows.length })
            }}</b>
            {{ t("bil.debtorsWord") }}
          </p>
          <p class="text-[13px] text-ink-500">
            {{ t("bil.totalBalanceColon") }}
            <b class="tabular text-danger-600">{{ money(filteredTotal) }}</b>
          </p>
        </div>
      </UiCard>

      <div class="space-y-5">
        <UiCard
          :title="t('bil.agingBreakdown')"
          :subtitle="t('bil.agingBreakdownCaption')"
        >
          <UiDonut
            :slices="agingSlices"
            :center-value="moneyShort(debtTotal)"
            :center-label="t('bil.totalDebtLower')"
            :size="170"
          />
          <ul class="mt-4 divide-y divide-ink-100 border-t border-ink-100">
            <li v-for="b in buckets" :key="b.key" class="py-2">
              <button
                type="button"
                class="flex w-full items-center gap-3 text-left"
                @click="toggleBucket(b.key)"
              >
                <span class="min-w-0 flex-1 text-[13px] text-ink-600">{{
                  b.bucket
                }}</span>
                <span class="tabular text-[13px] font-semibold text-ink-700">
                  {{ percent(b.share) }}
                </span>
                <span
                  class="tabular w-32 text-right text-[13px] font-bold text-ink-900"
                >
                  {{ money(b.amount) }}
                </span>
              </button>
            </li>
          </ul>
        </UiCard>

        <UiCard
          :title="t('bil.topDebtors')"
          :subtitle="t('bil.topDebtorsCaption')"
          flush
          :padded="false"
        >
          <ul class="divide-y divide-ink-100 border-t border-ink-100">
            <li
              v-for="d in [...debtors]
                .sort((a, b) => b.balance - a.balance)
                .slice(0, 3)"
              :key="d.id"
              class="px-5 py-3.5"
            >
              <button
                type="button"
                class="flex w-full items-center gap-3 text-left"
                @click="openHistory({ tenant: d.tenant })"
              >
                <span
                  class="grid size-10 shrink-0 place-items-center rounded-[10px] bg-danger-50 text-danger-600"
                >
                  <UiIcon name="warning" :size="18" />
                </span>
                <span class="min-w-0 flex-1">
                  <span
                    class="block truncate text-[14px] font-semibold text-ink-900"
                  >
                    {{ d.tenant }}
                  </span>
                  <span class="block truncate text-[12px] text-ink-500">
                    {{ d.buildingName }} ·
                    {{ bucketMeta(d.agingBucket).bucket }}
                  </span>
                </span>
                <span
                  class="tabular shrink-0 text-[14px] font-bold text-danger-600"
                >
                  {{ moneyShort(d.balance) }}
                </span>
              </button>
            </li>
          </ul>
        </UiCard>
      </div>
    </section>

    <UiModal
      v-model="historyOpen"
      size="lg"
      :title="historyTenant"
      :subtitle="t('bil.orgInvoiceHistory')"
    >
      <div class="flex flex-wrap items-center gap-3">
        <span
          class="rounded-field bg-surface-sunken px-3 py-2 text-[13px] text-ink-600"
        >
          {{ t("bil.docsColon") }}
          <b class="tabular text-ink-900">{{
            t("common.countPcs", { n: num(history.length) })
          }}</b>
        </span>
        <span
          class="rounded-field bg-danger-50 px-3 py-2 text-[13px] text-danger-700"
        >
          {{ t("bil.currentDebtColon") }}
          <b class="tabular">{{ money(historyDebt) }}</b>
        </span>
      </div>

      <ul class="mt-5 divide-y divide-ink-100 border-t border-ink-100">
        <li
          v-for="h in history"
          :key="h.id"
          class="flex items-center gap-4 py-3.5"
        >
          <span class="min-w-0 flex-1">
            <span class="block text-[14px] font-semibold text-ink-900">{{
              h.code
            }}</span>
            <span class="block text-[12px] text-ink-500">
              {{ periodLabel(h.period) }} ·
              {{ t("bil.dueLower", { date: dateShort(h.dueAt) }) }}
            </span>
          </span>
          <span class="shrink-0 text-right">
            <span class="tabular block text-[14px] font-bold text-ink-900">{{
              money(h.total)
            }}</span>
            <span class="tabular block text-[12px] text-ok-600">
              {{ t("bil.paidLower", { amount: money(h.paid) }) }}
            </span>
          </span>
          <UiStatus kind="invoice" :value="h.status" size="sm" />
        </li>
      </ul>

      <template #footer>
        <UiButton variant="ghost" @click="historyOpen = false">{{
          t("common.close")
        }}</UiButton>
        <UiButton to="/billing/payments">
          <UiIcon name="wallet" :size="16" />
          {{ moduleTitle("paymentsApprove", "To‘lovlarni tasdiqlash") }}
        </UiButton>
      </template>
    </UiModal>

    <UiModal
      v-model="exportOpen"
      size="sm"
      :title="t('common.export')"
      :subtitle="t('bil.exportCaption')"
    >
      <div class="space-y-3">
        <button
          type="button"
          class="flex w-full items-center gap-3 rounded-field p-3.5 text-left ring-1 ring-ink-200 transition-colors hover:bg-brand-50/60 hover:ring-brand-300"
          @click="runExport('DOCX')"
        >
          <span
            class="grid size-10 shrink-0 place-items-center rounded-[10px] bg-danger-50 text-danger-600"
          >
            <UiIcon name="doc" :size="18" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block text-[14px] font-semibold text-ink-900">{{
              t("bil.wordDoc")
            }}</span>
            <span class="block text-[12px] text-ink-500">{{
              t("bil.wordDocCaption")
            }}</span>
          </span>
          <UiIcon name="chevronRight" :size="16" class="text-ink-400" />
        </button>

        <button
          type="button"
          class="flex w-full items-center gap-3 rounded-field p-3.5 text-left ring-1 ring-ink-200 transition-colors hover:bg-brand-50/60 hover:ring-brand-300"
          @click="runExport('CSV')"
        >
          <span
            class="grid size-10 shrink-0 place-items-center rounded-[10px] bg-ok-50 text-ok-600"
          >
            <UiIcon name="layers" :size="18" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block text-[14px] font-semibold text-ink-900">{{
              t("bil.csvTable")
            }}</span>
            <span class="block text-[12px] text-ink-500">{{
              t("bil.csvTableCaption")
            }}</span>
          </span>
          <UiIcon name="chevronRight" :size="16" class="text-ink-400" />
        </button>
      </div>

      <template #footer>
        <UiButton variant="ghost" @click="exportOpen = false">{{
          t("common.cancel")
        }}</UiButton>
      </template>
    </UiModal>
  </main>
</template>
