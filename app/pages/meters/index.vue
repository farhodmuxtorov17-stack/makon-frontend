<script setup lang="ts">
import { BUILDINGS } from "~/data/buildings";
import { tariffLinesFor } from "~/data/business";
import {
  METERS,
  buildUtilitySummary,
  daysToVerification,
  isVerificationOverdue,
  isVerificationSoon,
  meterStateLabel,
  type Meter,
} from "~/data/operations";
import { dateShort, isoOf, num } from "~/utils/format";

const auth = useAuthStore();

const { t } = useI18n();
const { money, field, moduleTitle, tr, measureLabel } = useAppLabels();

/** Hisoblagich turi reyestrda o‘zbekcha saqlanadi, nomi lug‘atdan olinadi */
const TYPE_KEY: Record<string, string> = {
  Elektr: "meterType.electricity",
  Suv: "meterType.water",
  Gaz: "meterType.gas",
  Issiqlik: "meterType.heating",
};

/** Kommunal karta yorlig‘i reyestrdan keladi */
const UTILITY_KEY: Record<string, string> = {
  "Elektr energiyasi": "meterType.electricPower",
  Suv: "meterType.water",
  Gaz: "meterType.gas",
  Issiqlik: "meterType.heating",
};

/** Jadvaldagi holat yozuvi ham reyestr matnidan lug‘atga bog‘lanadi */
const STATE_KEY: Record<string, string> = {
  "Qiyoslash muddati o‘tgan": "svc.meterStateOverdue",
  Faol: "svc.meterStateActive",
  "Ta’mirda": "svc.meterStateRepair",
};

/** Hisoblagich holati tanlangan tilda */
function stateName(meter: Meter) {
  const label = meterStateLabel(meter);
  return tr(STATE_KEY[label], label);
}

/**
 * Ko'rsatkichni joyida o'lchagan odam kiritadi: texnik xizmat xodimi va bino
 * rahbari. Super rahbar sahifani ko'radi, lekin o'zi raqam yozmaydi, aks holda
 * hisob-fakturaga kim kiritgani noaniq bo'lib qoladi.
 */
const canEnter = computed(() => auth.can("meter.read"));

/** Hisoblagichlar faqat biriktirilgan obyektlar bo‘yicha ko‘rinadi */
const scopedNames = new Set(
  BUILDINGS.filter((b) => auth.inScope(b.id)).map((b) => b.name),
);

interface Reading {
  at: string;
  value: number;
  consumption: number;
  /** Erkin matn: foydalanuvchi yozgan izoh */
  note: string;
  /** Tayyor izoh lug‘at kaliti orqali beriladi */
  noteKey?: string;
}

const meters = ref<Meter[]>(
  METERS.filter((m) => scopedNames.has(m.buildingName)).map((m) => ({ ...m })),
);

const STEPS = [0.88, 1.06, 0.95, 1.12, 1];

function decimalsOf(m: Meter) {
  return Number.isInteger(m.lastReading) && Number.isInteger(m.previousReading)
    ? 0
    : 1;
}

function roundTo(value: number, decimals: number) {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

function monthsBack(iso: string, back: number) {
  const d = new Date(`${iso}T00:00:00`);
  d.setMonth(d.getMonth() - back);
  return isoOf(d);
}

function seedReadings(m: Meter): Reading[] {
  const dec = decimalsOf(m);
  const delta = m.lastReading - m.previousReading;
  const values: number[] = [m.lastReading];
  for (let i = STEPS.length - 1; i >= 0; i--) {
    values.unshift(roundTo(values[0]! - roundTo(delta * STEPS[i]!, dec), dec));
  }
  return values.map((value, i) => ({
    at: monthsBack(m.readAt, values.length - 1 - i),
    value,
    consumption: i === 0 ? 0 : roundTo(value - values[i - 1]!, dec),
    note: "",
    noteKey:
      i === values.length - 1 ? "svc.readingLastCheck" : "svc.readingMonthly",
  }));
}

const readings = ref<Record<string, Reading[]>>(
  Object.fromEntries(METERS.map((m) => [m.id, seedReadings(m)])),
);

const query = ref("");
const fBuilding = ref("all");
const fType = ref("all");

const buildingOptions = computed(() => [
  { value: "all", label: t("filter.allBuildings") },
  ...[...new Set(meters.value.map((m) => m.buildingName))].map((b) => ({
    value: b,
    label: b,
  })),
]);

const typeOptions = computed(() => [
  { value: "all", label: t("filter.allTypes") },
  ...[...new Set(meters.value.map((m) => m.type))].map((type) => ({
    value: type,
    label: tr(TYPE_KEY[type], type),
  })),
]);

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();
  return meters.value.filter((m) => {
    if (fBuilding.value !== "all" && m.buildingName !== fBuilding.value)
      return false;
    if (fType.value !== "all" && m.type !== fType.value) return false;
    if (
      q &&
      ![m.code, m.serial, m.location, m.buildingName].some((v) =>
        v.toLowerCase().includes(q),
      )
    )
      return false;
    return true;
  });
});

/**
 * Jadval qatori holatni ham o‘zi bilan olib yuradi: qiyoslash muddati
 * o‘tgan hisoblagich oddiy «Ta’mirda» emas, alohida ajralib turadi.
 */
const rows = computed(() =>
  filtered.value.map((m) => ({
    ...m,
    usage: roundTo(m.lastReading - m.previousReading, decimalsOf(m)),
    state: stateName(m),
    overdue: isVerificationOverdue(m),
    soon: isVerificationSoon(m),
    daysLeft: daysToVerification(m),
  })),
);

/** Holat nishonchasi: muddat o‘tgani ta’mir holatidan ustun turadi */
function stateBadge(row: {
  overdue: boolean;
  status: Meter["status"];
}): string {
  if (row.overdue) return "bg-danger-50 text-danger-700 ring-danger-100";
  return row.status === "ACTIVE"
    ? "bg-ok-50 text-ok-700 ring-ok-100"
    : "bg-warn-50 text-warn-700 ring-warn-100";
}

const dirty = computed(
  () =>
    !!query.value.trim() || fBuilding.value !== "all" || fType.value !== "all",
);

function resetFilters() {
  query.value = "";
  fBuilding.value = "all";
  fType.value = "all";
}

const columns = computed(() => [
  { key: "code", label: field("code"), width: "148px" },
  { key: "type", label: field("type") },
  { key: "serial", label: field("serial") },
  { key: "buildingName", label: field("building") },
  { key: "location", label: field("location") },
  {
    key: "lastReading",
    label: field("lastReading"),
    align: "right" as const,
    numeric: true,
  },
  {
    key: "usage",
    label: field("consumption"),
    align: "right" as const,
    numeric: true,
  },
  { key: "verifyAt", label: field("verifiedAt") },
  { key: "status", label: field("status") },
]);

const TYPE_TONE: Record<string, string> = {
  Elektr: "bg-warn-50 text-warn-700 ring-warn-100",
  Suv: "bg-brand-50 text-brand-700 ring-brand-200",
  Gaz: "bg-info-50 text-info-700 ring-info-100",
  Issiqlik: "bg-danger-50 text-danger-700 ring-danger-100",
};

/**
 * Kommunal kartalar ekrandagi ro‘yxatdan hisoblanadi: ko‘rsatkich kiritilsa
 * karta ham, jadval qatori ham bir vaqtda yangilanadi.
 */
const utilityCards = computed(() => buildUtilitySummary(meters.value));

const UTILITY_TONE: Record<string, "warn" | "brand" | "violet" | "danger"> = {
  "Elektr energiyasi": "warn",
  Suv: "brand",
  Gaz: "violet",
  Issiqlik: "danger",
};

/** Karta bosilganda jadval shu tur bo‘yicha filtrlanadi */
const TYPE_BY_LABEL: Record<string, Meter["type"]> = {
  "Elektr energiyasi": "Elektr",
  Suv: "Suv",
  Gaz: "Gaz",
  Issiqlik: "Issiqlik",
};

/**
 * Ko‘rsatkich bo‘yicha hisob-faktura qatori. Miqdor ham, summa ham
 * billing tarif jadvalidan olinadi, shuning uchun hisoblagich ekranidagi
 * sarf va hisob-fakturadagi kommunal qator bitta raqamni beradi.
 */
function tariffLineOf(m: Meter) {
  return (
    tariffLinesFor([m], m.buildingName, 0).find((l) => l.meter === m.code) ??
    null
  );
}

const detail = ref<Meter | null>(null);
const detailOpen = computed({
  get: () => detail.value !== null,
  set: (v: boolean) => {
    if (!v) detail.value = null;
  },
});

const detailReadings = computed(() =>
  detail.value ? (readings.value[detail.value.id] ?? []) : [],
);
const chartLabels = computed(() =>
  detailReadings.value.map((r) => dateShort(r.at)),
);
const chartSeries = computed(() => [
  {
    label: field("consumption"),
    tone: "brand" as const,
    values: detailReadings.value.map((r) => r.consumption),
    fill: true,
  },
]);

function openMeter(row: Record<string, unknown>) {
  detail.value = meters.value.find((m) => m.id === String(row.id)) ?? null;
}

const entryOpen = ref(false);
const entryMeter = ref(METERS[0]!.id);
const entryDate = ref(METERS[0]!.readAt);
const entryValue = ref<string | number>(METERS[0]!.lastReading);
const entryNote = ref("");

/** Ko‘rsatkich suratlari: haqiqiy fayllar */
const entryPhotos = ref<Array<{ file: File; url: string }>>([]);
const entryInput = ref<HTMLInputElement | null>(null);
const PHOTO_LIMIT = 3;

function pickEntryPhotos() {
  entryInput.value?.click();
}

function onEntryPhotos(event: Event) {
  const target = event.target as HTMLInputElement;
  const picked = Array.from(target.files ?? []);
  target.value = "";
  for (const file of picked) {
    if (entryPhotos.value.length >= PHOTO_LIMIT) break;
    entryPhotos.value.push({ file, url: URL.createObjectURL(file) });
  }
}

function removeEntryPhoto(index: number) {
  const gone = entryPhotos.value.splice(index, 1)[0];
  if (gone) URL.revokeObjectURL(gone.url);
}

function clearEntryPhotos() {
  for (const p of entryPhotos.value) URL.revokeObjectURL(p.url);
  entryPhotos.value = [];
}

onBeforeUnmount(clearEntryPhotos);

const activeMeter = computed(
  () => meters.value.find((m) => m.id === entryMeter.value) ?? null,
);

watch(entryMeter, () => {
  const m = activeMeter.value;
  if (m) {
    entryValue.value = m.lastReading;
    entryDate.value = m.readAt;
  }
});

const entryValueError = computed(() => {
  const m = activeMeter.value;
  if (!m) return t("svc.errPickMeter");
  const value = Number(entryValue.value);
  if (!entryValue.value && entryValue.value !== 0)
    return t("svc.errEnterValue");
  if (Number.isNaN(value)) return t("svc.errValueNumber");
  if (value < m.lastReading)
    return t("svc.errValueTooLow", {
      value: `${num(m.lastReading, decimalsOf(m))} ${m.unit}`,
    });
  return "";
});

/** Sana xatosi o‘z maydonida chiqadi, aks holda to‘g‘ri to‘ldirilgan qiymat qizil bo‘lib qolardi */
const entryDateError = computed(() =>
  entryDate.value ? "" : t("svc.errEnterDate"),
);

const entryError = computed(() => entryValueError.value || entryDateError.value);

const entryUsage = computed(() => {
  const m = activeMeter.value;
  if (!m || entryError.value) return 0;
  return roundTo(Number(entryValue.value) - m.lastReading, decimalsOf(m));
});

/** Kiritilayotgan ko‘rsatkich bo‘yicha hisob-fakturaga tushadigan qator */
const entryTariffLine = computed(() => {
  const m = activeMeter.value;
  if (!m || entryError.value) return null;
  return tariffLineOf({
    ...m,
    previousReading: m.lastReading,
    lastReading: roundTo(Number(entryValue.value), decimalsOf(m)),
  });
});

function saveReading() {
  const m = activeMeter.value;
  if (!m || entryError.value) return;
  const dec = decimalsOf(m);
  const value = roundTo(Number(entryValue.value), dec);
  readings.value[m.id] = [
    ...(readings.value[m.id] ?? []),
    {
      at: entryDate.value,
      value,
      consumption: roundTo(value - m.lastReading, dec),
      note:
        (entryNote.value.trim() || t("svc.manualReading")) +
        (entryPhotos.value.length > 0
          ? ` ${t("svc.photosAttached", { files: entryPhotos.value.map((p) => p.file.name).join(", ") })}`
          : ""),
    },
  ];
  m.previousReading = m.lastReading;
  m.lastReading = value;
  m.readAt = entryDate.value;

  /*
   * Ko‘rsatkich reyestrdagi yozuvga ham yoziladi: billing davri kommunal
   * qatorni aynan shu sarfdan hisoblaydi, aks holda kiritilgan qiymat
   * hisob-fakturaga hech qachon tushmasdi.
   */
  const source = METERS.find((x) => x.id === m.id);
  if (source) {
    source.previousReading = m.previousReading;
    source.lastReading = m.lastReading;
    source.readAt = m.readAt;
  }

  entryNote.value = "";
  clearEntryPhotos();
  entryOpen.value = false;
}
</script>

<template>
  <AppTopbar :title="t('svc.metersTitle')" :subtitle="t('svc.metersCaption')">
    <template #actions>
      <UiButton variant="secondary" size="sm" to="/service-requests">
        <UiIcon name="wrench" :size="16" />
        {{ moduleTitle("serviceRequests") }}
      </UiButton>
      <UiButton v-if="canEnter" size="sm" @click="entryOpen = true">
        <UiIcon name="plus" :size="16" />
        {{ t("svc.enterReading") }}
      </UiButton>
    </template>
  </AppTopbar>

  <main class="scroll-slim flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
    <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <UiKpi
        v-for="u in utilityCards"
        :key="u.label"
        :label="tr(UTILITY_KEY[u.label], u.label)"
        :value="u.value"
        :unit="measureLabel(u.unit)"
        :delta="u.delta"
        :icon="u.icon"
        :tone="UTILITY_TONE[u.label] ?? 'brand'"
        class="cursor-pointer"
        @click="fType = TYPE_BY_LABEL[u.label] ?? 'all'"
      />
    </section>

    <UiCard
      :title="moduleTitle('meters')"
      :subtitle="t('svc.meterCount', { n: rows.length })"
      flush
      :padded="false"
    >
      <template #actions>
        <UiButton
          v-if="canEnter"
          variant="secondary"
          size="sm"
          @click="entryOpen = true"
        >
          <UiIcon name="edit" :size="16" />
          {{ t("svc.enterReading") }}
        </UiButton>
      </template>

      <div
        class="grid gap-3 border-t border-ink-100 bg-surface-sunken px-5 py-4 lg:grid-cols-4"
      >
        <UiInput
          v-model="query"
          :placeholder="t('svc.meterSearchPlaceholder')"
          class="lg:col-span-2"
        >
          <template #prefix>
            <UiIcon name="search" :size="18" />
          </template>
        </UiInput>
        <UiSelect v-model="fBuilding" :options="buildingOptions" />
        <div class="flex items-center gap-2">
          <UiSelect v-model="fType" :options="typeOptions" class="flex-1" />
          <UiButton
            v-if="dirty"
            variant="ghost"
            size="sm"
            @click="resetFilters"
          >
            <UiIcon name="refresh" :size="16" />
            {{ t("common.reset") }}
          </UiButton>
        </div>
      </div>

      <UiTable
        :columns="columns"
        :rows="rows"
        :empty="t('empty.noMatchingMeters')"
        @row-click="openMeter"
      >
        <template #cell-code="{ row }">
          <span class="tabular text-[13px] font-bold text-ink-900">{{
            row.code
          }}</span>
        </template>

        <template #cell-type="{ row }">
          <span
            class="inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs font-semibold ring-1 ring-inset"
            :class="TYPE_TONE[row.type]"
          >
            <UiIcon name="meter" :size="14" />
            {{ tr(TYPE_KEY[row.type], row.type) }}
          </span>
        </template>

        <template #cell-serial="{ row }">
          <span class="tabular text-[13px]">{{ row.serial }}</span>
        </template>

        <template #cell-lastReading="{ row }">
          {{ num(row.lastReading, Number.isInteger(row.lastReading) ? 0 : 1) }}
          <span class="text-[12px] font-normal text-ink-500">{{
            row.unit
          }}</span>
        </template>

        <template #cell-usage="{ row }">
          <span class="font-bold text-brand-600">
            +{{ num(row.usage, Number.isInteger(row.usage) ? 0 : 1) }}
          </span>
        </template>

        <template #cell-verifyAt="{ row }">
          <span
            class="tabular block"
            :class="row.overdue ? 'font-bold text-danger-700' : ''"
          >
            {{ dateShort(row.verifyAt) }}
          </span>
          <span
            v-if="row.overdue"
            class="block text-[12px] font-semibold text-danger-600"
          >
            {{ t("svc.daysLate", { n: -row.daysLeft }) }}
          </span>
          <span v-else-if="row.soon" class="block text-[12px] text-warn-600">
            {{ t("svc.daysLeft", { n: row.daysLeft }) }}
          </span>
        </template>

        <template #cell-status="{ row }">
          <span
            class="inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs font-semibold ring-1 ring-inset"
            :class="stateBadge(row)"
          >
            <svg
              class="size-3 shrink-0"
              viewBox="0 0 12 12"
              fill="none"
              aria-hidden="true"
            >
              <path
                v-if="row.overdue"
                d="M6 1.2 11.4 10.8H.6z"
                fill="currentColor"
              />
              <path
                v-else-if="row.status === 'ACTIVE'"
                d="M2.6 6.3 5 8.7l4.4-5"
                stroke="currentColor"
                stroke-width="1.9"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <g v-else stroke="currentColor" stroke-width="1.6">
                <circle cx="6" cy="6" r="4.2" />
                <path d="M6 3.6V6l1.9 1.2" stroke-linecap="round" />
              </g>
            </svg>
            {{ row.state }}
          </span>
        </template>
      </UiTable>

      <div
        class="border-t border-ink-200 bg-surface-sunken px-5 py-3.5 text-[13px] text-ink-600"
      >
        {{ t("svc.rowClickHint") }}
      </div>
    </UiCard>
  </main>

  <UiModal
    v-model="detailOpen"
    :title="
      detail ? t('svc.readingHistoryOf', { code: detail.code }) : field('meter')
    "
    :subtitle="
      detail ? `${detail.buildingName} · ${detail.location}` : undefined
    "
    size="lg"
  >
    <div v-if="detail" class="space-y-5">
      <div class="flex flex-wrap items-center gap-3">
        <span
          class="inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs font-semibold ring-1 ring-inset"
          :class="
            stateBadge({
              overdue: isVerificationOverdue(detail),
              status: detail.status,
            })
          "
        >
          {{ stateName(detail) }}
        </span>
        <span
          class="inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs font-semibold ring-1 ring-inset"
          :class="TYPE_TONE[detail.type]"
        >
          <UiIcon name="meter" :size="14" />
          {{ tr(TYPE_KEY[detail.type], detail.type) }}
        </span>
        <span class="tabular text-[13px] text-ink-500">
          {{ t("svc.serialInline", { value: detail.serial }) }}
        </span>
      </div>

      <div class="grid gap-4 sm:grid-cols-3">
        <div class="rounded-field bg-surface-sunken p-4">
          <p class="text-[12px] text-ink-500">{{ field("lastReading") }}</p>
          <p class="tabular mt-1 text-[18px] font-bold text-ink-900">
            {{ num(detail.lastReading, decimalsOf(detail)) }}
            <span class="text-[13px] font-medium text-ink-500">{{
              measureLabel(detail.unit)
            }}</span>
          </p>
        </div>
        <div class="rounded-field bg-surface-sunken p-4">
          <p class="text-[12px] text-ink-500">{{ t("svc.lastConsumption") }}</p>
          <p class="tabular mt-1 text-[18px] font-bold text-brand-600">
            {{
              num(
                detail.lastReading - detail.previousReading,
                decimalsOf(detail),
              )
            }}
            <span class="text-[13px] font-medium text-ink-500">{{
              measureLabel(detail.unit)
            }}</span>
          </p>
        </div>
        <div class="rounded-field bg-surface-sunken p-4">
          <p class="text-[12px] text-ink-500">
            {{ t("svc.nextVerification") }}
          </p>
          <p
            class="tabular mt-1 text-[18px] font-bold"
            :class="
              isVerificationOverdue(detail) ? 'text-danger-700' : 'text-ink-900'
            "
          >
            {{ dateShort(detail.verifyAt) }}
          </p>
          <p
            v-if="isVerificationOverdue(detail)"
            class="mt-1 text-[12px] font-semibold text-danger-600"
          >
            {{
              t("svc.verificationExpired", { n: -daysToVerification(detail) })
            }}
          </p>
        </div>
      </div>

      <div
        v-if="tariffLineOf(detail)"
        class="rounded-field bg-brand-50 px-4 py-3.5 ring-1 ring-inset ring-brand-100"
      >
        <p class="text-[13px] font-semibold text-brand-700">
          {{ t("svc.invoiceUtilityLine") }}
        </p>
        <p class="tabular mt-1 text-[14px] text-ink-800">
          {{ tariffLineOf(detail)!.service }} ·
          {{ num(tariffLineOf(detail)!.qty, decimalsOf(detail)) }}
          {{ measureLabel(tariffLineOf(detail)!.unit) }} ×
          {{ money(tariffLineOf(detail)!.tariff) }} =
          <b class="text-ink-900">{{ money(tariffLineOf(detail)!.sum) }}</b>
        </p>
      </div>

      <div>
        <h3 class="text-[13px] font-semibold text-ink-700">
          {{ t("svc.consumptionDynamics") }}
        </h3>
        <div class="mt-3">
          <UiLine :labels="chartLabels" :series="chartSeries" :height="180" />
        </div>
      </div>

      <div>
        <h3 class="text-[13px] font-semibold text-ink-700">
          {{ t("svc.readingHistory") }}
        </h3>
        <div class="mt-3 overflow-hidden rounded-field ring-1 ring-ink-200">
          <UiTable
            :columns="[
              { key: 'at', label: field('date') },
              {
                key: 'value',
                label: field('reading'),
                align: 'right',
                numeric: true,
              },
              {
                key: 'consumption',
                label: field('consumption'),
                align: 'right',
                numeric: true,
              },
              { key: 'note', label: t('common.note') },
            ]"
            :rows="
              [...detailReadings].reverse().map((r) => ({ ...r, id: r.at }))
            "
          >
            <template #cell-at="{ row }">
              <span class="tabular">{{ dateShort(row.at) }}</span>
            </template>
            <template #cell-value="{ row }">
              {{ num(row.value, decimalsOf(detail)) }}
              {{ measureLabel(detail.unit) }}
            </template>
            <template #cell-consumption="{ row }">
              <span
                :class="
                  row.consumption > 0
                    ? 'font-bold text-brand-600'
                    : 'text-ink-400'
                "
              >
                {{ row.consumption > 0 ? "+" : ""
                }}{{ num(row.consumption, decimalsOf(detail)) }}
              </span>
            </template>
            <template #cell-note="{ row }">
              {{ row.noteKey ? t(String(row.noteKey)) : row.note }}
            </template>
          </UiTable>
        </div>
      </div>
    </div>

    <template #footer>
      <UiButton variant="ghost" @click="detail = null">{{
        t("common.close")
      }}</UiButton>
      <UiButton
        v-if="canEnter"
        @click="
          ((entryMeter = detail?.id ?? entryMeter),
          (detail = null),
          (entryOpen = true))
        "
      >
        <UiIcon name="plus" :size="16" />
        {{ t("svc.enterReading") }}
      </UiButton>
    </template>
  </UiModal>

  <UiModal
    v-model="entryOpen"
    :title="t('svc.enterReading')"
    :subtitle="t('svc.enterReadingHint')"
  >
    <div class="space-y-4">
      <UiField :label="field('meter')" required>
        <UiSelect
          v-model="entryMeter"
          :options="
            meters.map((m) => ({
              value: m.id,
              label: `${m.code} · ${m.buildingName}`,
            }))
          "
        />
      </UiField>

      <div class="grid gap-4 sm:grid-cols-2">
        <UiField :label="field('date')" required :error="entryDateError">
          <UiInput
            v-model="entryDate"
            type="date"
            :invalid="!!entryDateError"
          />
        </UiField>

        <UiField
          :label="field('current')"
          required
          :error="entryValueError"
          :hint="
            activeMeter
              ? t('svc.previousReadingValue', {
                  value: `${num(activeMeter.lastReading, decimalsOf(activeMeter))} ${activeMeter.unit}`,
                })
              : undefined
          "
        >
          <UiInput
            v-model="entryValue"
            type="number"
            :invalid="!!entryValueError"
            :valid="!entryValueError"
          />
        </UiField>
      </div>

      <div
        v-if="!entryError && activeMeter"
        class="space-y-2 rounded-field bg-brand-50 px-4 py-3"
      >
        <div class="flex items-center justify-between">
          <span class="text-[13px] font-medium text-brand-700">
            {{ t("svc.calculatedConsumption") }}
          </span>
          <span class="tabular text-[16px] font-bold text-brand-700">
            +{{ num(entryUsage, decimalsOf(activeMeter)) }}
            {{ measureLabel(activeMeter.unit) }}
          </span>
        </div>
        <p v-if="entryTariffLine" class="text-[13px] text-ink-700">
          {{ t("svc.invoiceLineNote", { service: entryTariffLine.service }) }}
          {{ num(entryTariffLine.qty, decimalsOf(activeMeter)) }}
          {{ measureLabel(entryTariffLine.unit) }} × {{ money(entryTariffLine.tariff) }} =
          <b class="text-ink-900">{{ money(entryTariffLine.sum) }}</b>
        </p>
        <p v-else class="text-[13px] text-ink-600">
          {{ t("svc.noTariffNote") }}
        </p>
      </div>

      <UiField :label="t('common.note')">
        <textarea
          v-model="entryNote"
          rows="2"
          :placeholder="t('svc.notePlaceholder')"
          class="scroll-slim w-full rounded-field bg-white px-3.5 py-2.5 text-sm text-ink-800 ring-1 ring-inset ring-ink-200 transition-colors placeholder:text-ink-400 hover:ring-ink-300 focus:ring-2 focus:ring-brand-500"
        />
      </UiField>

      <UiField :label="t('svc.meterPhoto')" :hint="t('svc.meterPhotoHint')">
        <div class="flex flex-wrap gap-3">
          <div
            v-for="(p, i) in entryPhotos"
            :key="`${p.file.name}-${i}`"
            class="relative size-24 overflow-hidden rounded-field ring-1 ring-ink-200"
          >
            <img
              :src="p.url"
              :alt="p.file.name"
              class="size-full object-cover"
            />
            <button
              type="button"
              class="absolute right-1 top-1 grid size-8 place-items-center rounded-full bg-ink-900/60 text-white transition-colors hover:bg-danger-600 md:size-6"
              :aria-label="t('svc.removeShot', { name: p.file.name })"
              @click="removeEntryPhoto(i)"
            >
              <UiIcon name="x" :size="14" />
            </button>
          </div>

          <input
            ref="entryInput"
            type="file"
            accept="image/*"
            multiple
            class="sr-only"
            :aria-label="t('svc.meterPhotos')"
            @change="onEntryPhotos"
          />

          <button
            v-if="entryPhotos.length < PHOTO_LIMIT"
            type="button"
            class="grid size-24 place-items-center rounded-field border-2 border-dashed border-ink-300 bg-ink-50 text-ink-500 transition-colors hover:border-brand-400 hover:bg-brand-50 hover:text-brand-600"
            :aria-label="t('svc.addMeterPhoto')"
            @click="pickEntryPhotos"
          >
            <svg
              viewBox="0 0 32 32"
              class="size-8"
              fill="none"
              aria-hidden="true"
            >
              <rect
                x="3"
                y="7"
                width="26"
                height="18"
                rx="3"
                stroke="currentColor"
                stroke-width="1.8"
              />
              <circle
                cx="16"
                cy="16"
                r="4.6"
                stroke="currentColor"
                stroke-width="1.8"
              />
              <path
                d="M16 12.6v6.8M12.6 16h6.8"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linecap="round"
              />
            </svg>
          </button>
        </div>
      </UiField>
    </div>

    <template #footer>
      <UiButton variant="ghost" @click="entryOpen = false">{{
        t("common.cancel")
      }}</UiButton>
      <UiButton :disabled="!!entryError" variant="success" @click="saveReading">
        <UiIcon name="check" :size="16" />
        {{ t("common.save") }}
      </UiButton>
    </template>
  </UiModal>
</template>
