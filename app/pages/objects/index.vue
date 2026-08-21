<script setup lang="ts">
import { OCCUPANCY_BANDS } from "~/constants/statuses";
import { BUILDINGS, type Building } from "~/data/buildings";
import { dateShort, num, percent, sum, todayIso } from "~/utils/format";
import { csvBlob, docxBlob, saveBlob } from "~/utils/docx";

const auth = useAuthStore();
const { t } = useI18n();
const {
  buildingTypeLabel,
  buildingClassLabel,
  field,
  columns: labelColumns,
  tr,
  addressLabel,
} = useAppLabels();

/** Ro‘yxat, filtr variantlari, jamlar va eksport faqat biriktirilgan obyektlardan */
const scoped = computed(() => BUILDINGS.filter((b) => auth.inScope(b.id)));

/** Reyestrga yangi obyekt qo‘shish tizim ma’muriyati huquqiga bog‘liq */
const canCreate = computed(() => auth.can("system.administer"));

const search = ref("");
const typeFilter = ref("");
const cityFilter = ref("");
const districtFilter = ref("");
const classFilter = ref("");
const occupancyFilter = ref("");
/** Uchastkada shu turdagi qurilma bor obyektlar: KPP, parkovka, kafe va hokazo */
const sortBy = ref("name");
const moreOpen = ref(false);
const page = ref(1);
const perPage = ref("10");
const notice = ref("");

const exportOpen = ref(false);
/*
 * Eksport formati ro'yxatdagi birinchi variantdan boshlanadi. Ilgari bu yerda
 * 'xlsx' turardi, lekin bunday variant ro'yxatda yo'q: oyna ochilganda hech
 * qaysi karta belgilanmagan bo'lardi va tanlanmay «Yuklab olish» bosilsa,
 * Word hujjati .xlsx nomi bilan saqlanardi. Excel bunday faylni ochmaydi.
 */
const exportFormat = ref<ExportFormat>("csv");
const exportScope = ref("filtered");

const createOpen = ref(false);
const createTouched = ref(false);

const uniq = (values: string[]) => Array.from(new Set(values));

const typeOptions = computed(() =>
  uniq(scoped.value.map((b) => b.type)).map((v) => ({
    value: v,
    label: buildingTypeLabel(v),
  })),
);
const cityOptions = computed(() =>
  uniq(scoped.value.map((b) => b.city)).map((v) => ({ value: v, label: v })),
);
const districtOptions = computed(() =>
  uniq(scoped.value.map((b) => b.district))
    .sort((a, b) => a.localeCompare(b))
    .map((v) => ({ value: v, label: v })),
);
const classOptions = computed(() =>
  uniq(scoped.value.map((b) => b.buildingClass)).map((v) => ({
    value: v,
    label: v,
  })),
);

const occupancyOptions = computed(() => [
  {
    value: "high",
    label: tr(OCCUPANCY_BANDS[0]!.labelKey, OCCUPANCY_BANDS[0]!.label),
  },
  {
    value: "mid",
    label: tr(OCCUPANCY_BANDS[1]!.labelKey, OCCUPANCY_BANDS[1]!.label),
  },
  {
    value: "low",
    label: tr(OCCUPANCY_BANDS[2]!.labelKey, OCCUPANCY_BANDS[2]!.label),
  },
]);

const sortOptions = computed(() => [
  { value: "name", label: t("sort.nameAsc") },
  { value: "occupancy", label: t("sort.occupancyDesc") },
  { value: "units", label: t("sort.unitsDesc") },
  { value: "vacant", label: t("sort.vacantUnitsDesc") },
]);

const perPageOptions = [
  { value: "10", label: "10" },
  { value: "25", label: "25" },
  { value: "50", label: "50" },
];

type ExportFormat = "csv" | "docx";

const exportFormats = computed<
  Array<{ value: ExportFormat; label: string; hint: string; icon: string }>
>(() => [
  {
    value: "csv",
    label: t("common.exportCsv"),
    hint: t("common.exportCsvHint"),
    icon: "chart",
  },
  {
    value: "docx",
    label: t("common.exportDocx"),
    hint: t("common.exportDocxHint"),
    icon: "doc",
  },
]);

const createForm = reactive({
  name: "",
  type: "",
  city: "",
  district: "",
  street: "",
  buildingClass: "",
  floors: "",
  units: "",
  gla: "",
  manager: "",
  phone: "",
});

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();

  const list = scoped.value.filter((b) => {
    if (q) {
      /*
       * Qidiruvda bino turi ikkala shaklda qatnashadi: ma’lumotdagi
       * o‘zbekcha qiymat va ekranda ko‘rinadigan tarjima. Aks holda rus
       * tilida «Бизнес» deb qidirilganda hech nima topilmasdi.
       */
      const haystack =
        `${b.code} ${b.name} ${b.city} ${b.district} ${b.street} ${b.type} ${buildingTypeLabel(b.type)}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (typeFilter.value && b.type !== typeFilter.value) return false;
    if (cityFilter.value && b.city !== cityFilter.value) return false;
    if (districtFilter.value && b.district !== districtFilter.value)
      return false;
    if (classFilter.value && b.buildingClass !== classFilter.value)
      return false;
    if (occupancyFilter.value === "high" && b.occupancy < 90) return false;
    if (
      occupancyFilter.value === "mid" &&
      (b.occupancy < 84 || b.occupancy > 89)
    )
      return false;
    if (occupancyFilter.value === "low" && b.occupancy >= 84) return false;
    if (false) {
      return false;
    }
    return true;
  });

  return [...list].sort((a, b) => {
    if (sortBy.value === "occupancy") return b.occupancy - a.occupancy;
    if (sortBy.value === "units") return b.units - a.units;
    if (sortBy.value === "vacant") return b.vacantUnits - a.vacantUnits;
    return a.name.localeCompare(b.name);
  });
});

const totals = computed(() => ({
  units: filtered.value.reduce((s, b) => s + b.units, 0),
  occupied: filtered.value.reduce((s, b) => s + b.occupiedUnits, 0),
  vacant: filtered.value.reduce((s, b) => s + b.vacantUnits, 0),
}));

const perPageNum = computed(() => Number(perPage.value));
const pageCount = computed(() =>
  Math.max(1, Math.ceil(filtered.value.length / perPageNum.value)),
);

const rows = computed(() => {
  const start = (page.value - 1) * perPageNum.value;
  return filtered.value.slice(start, start + perPageNum.value).map((b) => {
    return {
      id: b.id,
      code: b.code,
      name: b.name,
      photo: b.photo,
      meta: `${buildingClassLabel(b.buildingClass)} · ${t("unitOf.yearNo", { year: b.buildYear })}`,
      address: addressLabel(b),
      type: buildingTypeLabel(b.type),
      floors: b.floors,
      units: b.units,
      occupiedUnits: b.occupiedUnits,
      vacantUnits: b.vacantUnits,
      status: b.status,
    };
  });
});

const rangeLabel = computed(() => {
  if (!filtered.value.length) return "0";
  const start = (page.value - 1) * perPageNum.value + 1;
  const end = Math.min(page.value * perPageNum.value, filtered.value.length);
  return `${start}–${end}`;
});

const activeFilters = computed(
  () =>
    [
      search.value,
      typeFilter.value,
      cityFilter.value,
      districtFilter.value,
      classFilter.value,
      occupancyFilter.value,
    ].filter(Boolean).length,
);

watch(
  [
    search,
    typeFilter,
    cityFilter,
    districtFilter,
    classFilter,
    occupancyFilter,
    perPage,
  ],
  () => {
    page.value = 1;
  },
);

watch(pageCount, (count) => {
  if (page.value > count) page.value = count;
});

const columns = computed(() =>
  labelColumns([
    { key: "code", field: "id", width: "116px" },
    { key: "name", field: "buildingName", width: "260px" },
    { key: "address", field: "address" },
    { key: "type", field: "type" },
    { key: "floors", field: "floors", align: "right", numeric: true },
    { key: "units", field: "units", align: "right", numeric: true },
    {
      key: "occupiedUnits",
      field: "occupiedUnits",
      align: "right",
      numeric: true,
    },
    { key: "vacantUnits", field: "vacantUnits", align: "right", numeric: true },
  ]),
);

function objectPath(row: Record<string, unknown>) {
  return `/objects/${row.id}`;
}

function resetFilters() {
  search.value = "";
  typeFilter.value = "";
  cityFilter.value = "";
  districtFilter.value = "";
  classFilter.value = "";
  occupancyFilter.value = "";
  page.value = 1;
}

function goToPage(target: number) {
  page.value = Math.min(Math.max(target, 1), pageCount.value);
}

/** Reyestr haqiqiy fayl bo‘lib saqlanadi, ustunlar jadvaldagidek */
function submitExport() {
  const rows = exportScope.value === "filtered" ? filtered.value : scoped.value;
  const name = `obyektlar-reyestri-${todayIso()}.${exportFormat.value}`;

  if (exportFormat.value === "csv") {
    saveBlob(
      csvBlob([
        [
          field("id"),
          field("buildingName"),
          field("address"),
          field("type"),
          field("floors"),
          field("units"),
          t("common.occupied"),
          t("common.vacant"),
          t("obj.occupancyPct"),
          "GLA, m²",
          t("obj.monthlyRevenueSum"),
        ],
        ...rows.map((b) => {
          return [
            b.code,
            b.name,
            `${b.city}, ${b.district}, ${b.street}`,
            b.type,
            b.floors,
            b.units,
            b.occupiedUnits,
            b.vacantUnits,
            b.occupancy,
            b.gla,
            b.monthlyRevenue,
          ];
        }),
      ]),
      name,
    );
  } else {
    saveBlob(
      docxBlob([
        { text: t("obj.title"), style: "title" },
        {
          text: t("obj.countWithDate", {
            n: rows.length,
            date: dateShort(todayIso()),
          }),
          style: "subtitle",
        },
        ...rows.map((b) => ({
          text: t("obj.exportRow", {
            code: b.code,
            name: b.name,
            address: addressLabel(b),
            type: b.type,
            floors: b.floors,
            units: b.units,
            occupied: b.occupiedUnits,
            vacant: b.vacantUnits,
            occupancy: percent(b.occupancy),
            revenue: sum(b.monthlyRevenue),
          }),
          style: "body" as const,
        })),
      ]),
      name,
    );
  }

  notice.value = t("obj.exportDone", { file: name, n: num(rows.length) });
  exportOpen.value = false;
}

const toNum = (value: string) => Math.max(0, Math.round(Number(value) || 0));

/** Yangi yozuv uchun keyingi bo‘sh identifikator va reyestr raqami */
function nextIdentity() {
  const last = BUILDINGS.reduce(
    (max, b) => Math.max(max, Number(b.id.replace(/[^0-9]/g, "")) || 0),
    0,
  );
  const next = last + 1;
  return {
    id: `b-${String(next).padStart(2, "0")}`,
    code: `BIN-${String(next).padStart(4, "0")}`,
    order: next,
  };
}

function slugOf(name: string, order: number) {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || `obyekt-${order}`;
  return BUILDINGS.some((b) => b.slug === base) ? `${base}-${order}` : base;
}

function submitCreate() {
  if (!canCreate.value) return;
  createTouched.value = true;
  if (!createForm.name.trim() || !createForm.type || !createForm.city) return;

  const { id, code, order } = nextIdentity();
  const name = createForm.name.trim();
  const units = toNum(createForm.units);
  const gla = toNum(createForm.gla);

  const created: Building = {
    id,
    code,
    name,
    slug: slugOf(name, order),
    type: createForm.type as Building["type"],
    city: createForm.city,
    district: createForm.district.trim(),
    street: createForm.street.trim(),
    buildYear: new Date().getFullYear(),
    buildingClass: createForm.buildingClass || "B klass",
    floors: toNum(createForm.floors),
    undergroundFloors: 0,
    units,
    occupiedUnits: 0,
    vacantUnits: units,
    gla,
    vacantArea: gla,
    // Yangi obyektda hali shartnoma yo'q, shuning uchun egallangan maydon nol
    occupiedArea: 0,
    occupancy: 0,
    monthlyRevenue: 0,
    debt: 0,
    sla: 100,
    serviceRequests: 0,
    lat: 41.3111,
    lon: 69.2797,
    photo: "",
    gallery: [],
    manager: createForm.manager.trim(),
    managerPhone: createForm.phone.trim(),
    status: "ACTIVE",
    amenities: [],
    equipment: [],
  };

  BUILDINGS.unshift(created);

  notice.value = t("obj.createdNotice", { name, code });
  createOpen.value = false;
  createTouched.value = false;
  Object.assign(createForm, {
    name: "",
    type: "",
    city: "",
    district: "",
    street: "",
    buildingClass: "",
    floors: "",
    units: "",
    gla: "",
    manager: "",
    phone: "",
  });
}
</script>

<template>
  <AppTopbar :title="t('obj.title')" :subtitle="t('obj.caption')">
    <template #actions>
      <UiButton variant="secondary" size="sm" @click="exportOpen = true">
        <UiIcon name="download" :size="16" />
        {{ t("common.export") }}
      </UiButton>
      <UiButton v-if="canCreate" size="sm" @click="createOpen = true">
        <UiIcon name="plus" :size="16" />
        {{ t("obj.newObject") }}
      </UiButton>
      <span
        v-else
        class="inline-flex items-center gap-2 rounded-pill bg-ink-100 px-3 py-1.5 text-[12px] font-semibold text-ink-600"
      >
        <UiIcon name="eye" :size="16" />
        {{ t("common.readOnly") }}
      </span>
    </template>
  </AppTopbar>

  <main class="scroll-slim flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
    <div
      v-if="notice"
      class="flex items-start gap-3 rounded-card bg-ok-50 px-4 py-3.5 ring-1 ring-inset ring-ok-100"
    >
      <UiIcon name="check" :size="18" class="mt-0.5 shrink-0 text-ok-600" />
      <p class="flex-1 text-[13px] font-medium text-ok-700">{{ notice }}</p>
      <button
        type="button"
        class="shrink-0 rounded-[8px] p-1 text-ok-600 transition-colors hover:bg-ok-100"
        :aria-label="t('common.dismissNotice')"
        @click="notice = ''"
      >
        <UiIcon name="x" :size="16" />
      </button>
    </div>

    <UiCard
      :title="t('obj.baseTitle')"
      :subtitle="t('obj.baseCaption')"
      flush
      :padded="false"
    >
      <!--
        Saralash keng ekranda sarlavha yonida turadi. Tor ekranda esa u yerda
        sarlavhani siqib qo‘yadi, shuning uchun filtrlar qatoriga tushadi:
        bir vaqtning o‘zida faqat bittasi ko‘rinadi.
      -->
      <template #actions>
        <div class="hidden items-center gap-2 sm:flex">
          <span class="hidden text-[12px] text-ink-500 lg:inline">{{
            t("sort.label")
          }}</span>
          <UiSelect
            v-model="sortBy"
            :options="sortOptions"
            size="sm"
            :aria-label="t('sort.label')"
            class="w-48"
          />
        </div>
      </template>

      <div class="flex flex-wrap items-center gap-3 px-5 pb-4">
        <UiInput
          v-model="search"
          :placeholder="t('obj.searchPlaceholder')"
          class="min-w-[200px] flex-1"
        >
          <template #prefix>
            <UiIcon name="search" :size="16" />
          </template>
        </UiInput>

        <UiSelect
          v-model="typeFilter"
          :options="typeOptions"
          :placeholder="field('type')"
          class="w-44"
        />
        <UiSelect
          v-model="cityFilter"
          :options="cityOptions"
          :placeholder="field('city')"
          class="w-44"
        />

        <UiSelect
          v-model="sortBy"
          :options="sortOptions"
          :aria-label="t('sort.label')"
          class="w-48 sm:hidden"
        />

        <UiButton variant="secondary" @click="moreOpen = !moreOpen">
          <UiIcon name="filter" :size="16" />
          {{ t("filter.more") }}
          <UiIcon
            name="chevronDown"
            :size="14"
            :class="moreOpen ? '' : '-rotate-90'"
          />
        </UiButton>
      </div>

      <div
        v-if="moreOpen"
        class="flex flex-wrap items-end gap-3 border-t border-ink-100 bg-surface-sunken px-5 py-4"
      >
        <UiField :label="field('district')" class="w-56">
          <UiSelect
            v-model="districtFilter"
            :options="districtOptions"
            :placeholder="t('common.all')"
            size="sm"
          />
        </UiField>
        <UiField :label="field('buildingClass')" class="w-44">
          <UiSelect
            v-model="classFilter"
            :options="classOptions"
            :placeholder="t('common.all')"
            size="sm"
          />
        </UiField>
        <UiField :label="t('kpi.occupancyRate')" class="w-48">
          <UiSelect
            v-model="occupancyFilter"
            :options="occupancyOptions"
            :placeholder="t('common.all')"
            size="sm"
          />
        </UiField>
        <UiButton
          variant="ghost"
          size="sm"
          :disabled="!activeFilters"
          @click="resetFilters"
        >
          <UiIcon name="refresh" :size="16" />
          {{ t("filter.reset") }}
        </UiButton>
        <span v-if="activeFilters" class="text-[12px] text-ink-500">
          {{ t("filter.activeCount", { n: activeFilters }) }}
        </span>
      </div>

      <UiTable
        :columns="columns"
        :rows="rows"
        :to="objectPath"
        :empty="
          scoped.length ? t('obj.emptyFiltered') : t('empty.noObjectsAssigned')
        "
      >
        <template #cell-code="{ row }">
          <span class="tabular text-[13px] font-semibold text-ink-700">{{
            row.code
          }}</span>
        </template>

        <template #cell-name="{ row }">
          <span class="flex items-center gap-3">
            <UiPhoto
              :name="String(row.photo)"
              :alt="String(row.name)"
              ratio="aspect-square"
              rounded="rounded-field"
              sizes="56px"
              class="size-11 shrink-0"
            />
            <span class="min-w-0">
              <span
                class="block truncate text-[14px] font-semibold text-brand-600"
              >
                {{ row.name }}
              </span>
              <span class="block truncate text-[12px] text-ink-500">{{
                row.meta
              }}</span>
            </span>
          </span>
        </template>

        <template #cell-address="{ row }">
          <span
            class="block max-w-[280px] text-[13px] leading-snug text-ink-600"
          >
            {{ row.address }}
          </span>
        </template>

        <template #cell-type="{ row }">
          <span
            class="inline-flex rounded-pill bg-ink-100 px-2.5 py-1 text-[12px] font-medium text-ink-700"
          >
            {{ row.type }}
          </span>
        </template>

        <template #cell-occupiedUnits="{ row }">
          <span class="tabular font-semibold text-ok-600">{{
            row.occupiedUnits
          }}</span>
        </template>

        <template #cell-vacantUnits="{ row }">
          <span class="tabular font-semibold text-warn-600">{{
            row.vacantUnits
          }}</span>
        </template>
      </UiTable>

      <div
        class="flex flex-wrap items-center justify-between gap-4 border-t border-ink-100 px-5 py-4"
      >
        <p class="text-[13px] text-ink-500">
          {{ t("common.total") }}:
          <b class="text-ink-800">{{ filtered.length }}</b>
          {{ t("obj.unitObjects") }} ·
          <span class="tabular">{{ num(totals.units) }}</span>
          {{ t("obj.unitUnits") }} ·
          <span class="tabular text-ok-600">{{ num(totals.occupied) }}</span>
          {{ t("obj.unitOccupied") }} ·
          <span class="tabular text-warn-600">{{ num(totals.vacant) }}</span>
          {{ t("obj.unitVacant") }}
          <span class="text-ink-400">{{
            t("obj.showingRange", { range: rangeLabel })
          }}</span>
        </p>

        <div class="flex items-center gap-4">
          <div class="flex items-center gap-1.5">
            <button
              type="button"
              class="grid size-11 place-items-center rounded-[8px] text-ink-500 ring-1 ring-inset ring-ink-200 transition-colors hover:bg-ink-100 hover:text-ink-800 disabled:cursor-not-allowed disabled:opacity-40 md:size-9"
              :aria-label="t('common.prevPage')"
              :disabled="page <= 1"
              @click="goToPage(page - 1)"
            >
              <UiIcon name="chevronLeft" :size="16" />
            </button>

            <button
              v-for="p in pageCount"
              :key="p"
              type="button"
              class="grid size-11 place-items-center rounded-[8px] text-[13px] font-semibold transition-colors md:size-9"
              :class="
                p === page
                  ? 'bg-brand-500 text-white shadow-brand'
                  : 'text-ink-600 ring-1 ring-inset ring-ink-200 hover:bg-ink-100'
              "
              @click="goToPage(p)"
            >
              {{ p }}
            </button>

            <button
              type="button"
              class="grid size-11 place-items-center rounded-[8px] text-ink-500 ring-1 ring-inset ring-ink-200 transition-colors hover:bg-ink-100 hover:text-ink-800 disabled:cursor-not-allowed disabled:opacity-40 md:size-9"
              :aria-label="t('common.nextPage')"
              :disabled="page >= pageCount"
              @click="goToPage(page + 1)"
            >
              <UiIcon name="chevronRight" :size="16" />
            </button>
          </div>

          <div class="flex items-center gap-2">
            <span class="text-[12px] text-ink-500">{{
              t("common.perPage")
            }}</span>
            <UiSelect
              v-model="perPage"
              :options="perPageOptions"
              size="sm"
              class="w-20"
            />
          </div>
        </div>
      </div>
    </UiCard>

    <UiCard
      :title="t('obj.hierarchyTitle')"
      :subtitle="t('obj.hierarchyCaption')"
    >
      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div
          v-for="(step, i) in [
            {
              title: field('object'),
              text: t('obj.hierarchyObject'),
              icon: 'building',
            },
            {
              title: field('structure'),
              text: t('obj.hierarchyStructure'),
              icon: 'grid',
            },
            {
              title: field('floor'),
              text: t('obj.hierarchyFloor'),
              icon: 'cube',
            },
            { title: field('unit'), text: t('obj.hierarchyUnit'), icon: 'box' },
          ]"
          :key="step.title"
          class="rounded-field p-4 ring-1 ring-ink-200"
        >
          <div class="flex items-center gap-2.5">
            <span
              class="grid size-9 place-items-center rounded-field bg-brand-50 text-brand-600"
            >
              <UiIcon :name="step.icon" :size="18" />
            </span>
            <span class="text-[14px] font-bold text-ink-900">{{
              step.title
            }}</span>
            <span
              class="tabular ml-auto text-[12px] font-semibold text-ink-400"
            >
              0{{ i + 1 }}
            </span>
          </div>
          <p class="mt-2.5 text-[13px] leading-snug text-ink-500">
            {{ step.text }}
          </p>
        </div>
      </div>
    </UiCard>

    <UiModal
      v-model="exportOpen"
      :title="t('obj.exportTitle')"
      :subtitle="t('obj.exportCaption')"
    >
      <div class="space-y-2.5">
        <button
          v-for="f in exportFormats"
          :key="f.value"
          type="button"
          class="flex w-full items-center gap-3 rounded-field px-4 py-3 text-left ring-1 ring-inset transition-colors"
          :class="
            exportFormat === f.value
              ? 'bg-brand-50 ring-brand-300'
              : 'ring-ink-200 hover:bg-ink-50'
          "
          @click="exportFormat = f.value"
        >
          <span
            class="grid size-10 shrink-0 place-items-center rounded-field"
            :class="
              exportFormat === f.value
                ? 'bg-brand-500 text-white'
                : 'bg-ink-100 text-ink-500'
            "
          >
            <UiIcon :name="f.icon" :size="18" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block text-[14px] font-semibold text-ink-900">{{
              f.label
            }}</span>
            <span class="block text-[12px] text-ink-500">{{ f.hint }}</span>
          </span>
          <UiIcon
            v-if="exportFormat === f.value"
            name="check"
            :size="18"
            class="shrink-0 text-brand-600"
          />
        </button>
      </div>

      <div class="mt-5 border-t border-ink-100 pt-4">
        <p class="mb-2 text-[13px] font-semibold text-ink-700">
          {{ t("common.scope") }}
        </p>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="s in [
              {
                value: 'filtered',
                label: t('obj.scopeFiltered', { n: filtered.length }),
              },
              { value: 'all', label: t('obj.scopeAll', { n: scoped.length }) },
            ]"
            :key="s.value"
            type="button"
            class="rounded-pill px-3.5 py-1.5 text-[13px] font-semibold ring-1 ring-inset transition-colors"
            :class="
              exportScope === s.value
                ? 'bg-brand-500 text-white ring-brand-500'
                : 'text-ink-600 ring-ink-200 hover:bg-ink-100'
            "
            @click="exportScope = s.value"
          >
            {{ s.label }}
          </button>
        </div>
      </div>

      <template #footer>
        <UiButton variant="ghost" @click="exportOpen = false">{{
          t("common.cancel")
        }}</UiButton>
        <UiButton @click="submitExport">
          <UiIcon name="download" :size="16" />
          {{ t("common.download") }}
        </UiButton>
      </template>
    </UiModal>

    <UiModal
      v-if="canCreate"
      v-model="createOpen"
      :title="t('obj.newObject')"
      :subtitle="t('obj.newObjectCaption')"
      size="lg"
    >
      <div class="grid gap-4 sm:grid-cols-2">
        <UiField
          :label="field('buildingName')"
          required
          class="sm:col-span-2"
          :error="
            createTouched && !createForm.name.trim() ? t('obj.errName') : ''
          "
        >
          <UiInput
            v-model="createForm.name"
            :placeholder="t('obj.namePlaceholder')"
            :invalid="createTouched && !createForm.name.trim()"
          />
        </UiField>

        <UiField
          :label="field('type')"
          required
          :error="createTouched && !createForm.type ? t('obj.errType') : ''"
        >
          <UiSelect
            v-model="createForm.type"
            :options="typeOptions"
            :placeholder="t('common.select')"
            :invalid="createTouched && !createForm.type"
          />
        </UiField>

        <UiField
          :label="field('cityRegion')"
          required
          :error="createTouched && !createForm.city ? t('obj.errCity') : ''"
        >
          <UiSelect
            v-model="createForm.city"
            :options="cityOptions"
            :placeholder="t('common.select')"
            :invalid="createTouched && !createForm.city"
          />
        </UiField>

        <UiField :label="field('district')">
          <UiInput
            v-model="createForm.district"
            :placeholder="t('obj.districtPlaceholder')"
          />
        </UiField>

        <UiField :label="field('street')">
          <UiInput
            v-model="createForm.street"
            :placeholder="t('obj.streetPlaceholder')"
          />
        </UiField>

        <UiField :label="field('buildingClass')">
          <UiSelect
            v-model="createForm.buildingClass"
            :options="classOptions"
            :placeholder="t('common.select')"
          />
        </UiField>

        <UiField :label="field('floorCount')">
          <UiInput v-model="createForm.floors" type="number" placeholder="0" />
        </UiField>

        <UiField :label="t('kpi.unitCount')">
          <UiInput v-model="createForm.units" type="number" placeholder="0" />
        </UiField>

        <UiField :label="field('totalArea')" :hint="t('obj.glaHint')">
          <UiInput v-model="createForm.gla" type="number" placeholder="0">
            <template #suffix>
              <span class="text-[12px]">{{ t("unitOf.sqm") }}</span>
            </template>
          </UiInput>
        </UiField>

        <UiField :label="field('manager')">
          <UiInput
            v-model="createForm.manager"
            :placeholder="field('fullName')"
          />
        </UiField>

        <UiField :label="t('common.phone')">
          <UiInput v-model="createForm.phone" placeholder="+998 90 000 00 00" />
        </UiField>
      </div>

      <template #footer>
        <UiButton variant="ghost" @click="createOpen = false">{{
          t("common.cancel")
        }}</UiButton>
        <UiButton @click="submitCreate">
          <UiIcon name="check" :size="16" />
          {{ t("common.save") }}
        </UiButton>
      </template>
    </UiModal>
  </main>
</template>
