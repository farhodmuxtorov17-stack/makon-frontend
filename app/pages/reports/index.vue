<script setup lang="ts">
import {
  BUILDINGS,
  PORTFOLIO_TOTALS,
  trendDelta,
  trendSpark,
} from "~/data/buildings";
import { INVOICES, agingOf } from "~/data/business";
import { csvBlob, docxBlob, fileSlug, saveBlob } from "~/utils/docx";
import {
  num,
  percent,
  sumShort,
  dateShort,
  todayIso,
  monthShift,
} from "~/utils/format";

const { buildingTypeLabel, moneyShort, cityLabel, districtLabel } =
  useAppLabels();

const auth = useAuthStore();
const { t } = useI18n();

/** Hisobot faqat foydalanuvchining ko‘rish sohasidagi obyektlarni qamraydi */
const scopedBuildings = computed(() =>
  BUILDINGS.filter((b) => auth.inScope(b.id)),
);

/**
 * Hisobotlar bitta uzun ustunda joylashgani uchun sahifa balandligi to‘rt
 * ekrandan oshib ketardi va birinchi marta kirgan foydalanuvchi nimani
 * qidirayotganini yo‘qotardi. Endi bloklar mavzu bo‘yicha ajratilgan:
 * har bir bo‘lim bitta ekranga sig‘adi.
 */
const REPORT_TABS = computed(() => [
  {
    key: "umumiy",
    label: t("usr.repTabGeneral"),
    caption: t("usr.repTabGeneralCaption"),
  },
  {
    key: "moliya",
    label: t("usr.repTabFinance"),
    caption: t("usr.repTabFinanceCaption"),
  },
  {
    key: "bandlik",
    label: t("field.occupancy"),
    caption: t("usr.repTabOccupancyCaption"),
  },
  {
    key: "servis",
    label: t("section.service"),
    caption: t("usr.repTabServiceCaption"),
  },
  {
    key: "hujjat",
    label: t("navShort.documents"),
    caption: t("usr.repQuickCaption"),
  },
]);

const tab = ref("umumiy");
const activeTab = computed(
  () =>
    REPORT_TABS.value.find((r) => r.key === tab.value) ?? REPORT_TABS.value[0]!,
);

const MONTHS = computed(() => [
  t("monthShort.1"),
  t("monthShort.2"),
  t("monthShort.3"),
  t("monthShort.4"),
  t("monthShort.5"),
  t("monthShort.6"),
  t("monthShort.7"),
  t("monthShort.8"),
  t("monthShort.9"),
  t("monthShort.10"),
  t("monthShort.11"),
  t("monthShort.12"),
]);

// Hisobot davri bugun tugaydi: kelajakdagi oy uchun hisobot bo‘lmaydi
const DEFAULT_FROM = monthShift(-5);
const DEFAULT_TO = todayIso();

const TYPE_OPTIONS = computed(() => [
  { value: "all", label: t("usr.repAllBuildingTypes") },
  ...[...new Set(scopedBuildings.value.map((b) => b.type))].map((type) => ({
    value: type,
    label: buildingTypeLabel(type),
  })),
]);

const draftFrom = ref(DEFAULT_FROM);
const draftTo = ref(DEFAULT_TO);
const draftType = ref("all");
const draftBuildings = ref<string[]>([]);

const fromDate = ref(DEFAULT_FROM);
const toDate = ref(DEFAULT_TO);
const typeFilter = ref("all");
const buildingFilter = ref<string[]>([]);

/** Ko‘rish sohasi o‘zgarsa tanlov ham shu sohaga qisqaradi */
watch(
  scopedBuildings,
  (list) => {
    const ids = list.map((b) => b.id);
    const keep = (current: string[]) => {
      const next = current.filter((id) => ids.includes(id));
      return next.length ? next : ids;
    };
    draftBuildings.value = keep(draftBuildings.value);
    buildingFilter.value = keep(buildingFilter.value);

    const types = new Set(list.map((b) => b.type as string));
    if (draftType.value !== "all" && !types.has(draftType.value))
      draftType.value = "all";
    if (typeFilter.value !== "all" && !types.has(typeFilter.value))
      typeFilter.value = "all";
  },
  { immediate: true },
);

const objMenuRoot = ref<HTMLElement | null>(null);
const objMenuOpen = ref(false);
onClickOutside(objMenuRoot, () => (objMenuOpen.value = false));

const rangeInvalid = computed(
  () => new Date(draftTo.value) < new Date(draftFrom.value),
);

const filterChanged = computed(
  () =>
    draftFrom.value !== fromDate.value ||
    draftTo.value !== toDate.value ||
    draftType.value !== typeFilter.value ||
    draftBuildings.value.slice().sort().join() !==
      buildingFilter.value.slice().sort().join(),
);

const draftLabel = computed(() => {
  if (!draftBuildings.value.length) return t("usr.repNoObjectSelected");
  if (draftBuildings.value.length === scopedBuildings.value.length)
    return t("landing.allObjects");
  if (draftBuildings.value.length === 1)
    return (
      scopedBuildings.value.find((b) => b.id === draftBuildings.value[0])
        ?.name ?? t("field.object")
    );
  return t("usr.repObjectsSelected", { count: draftBuildings.value.length });
});

function applyFilters() {
  if (rangeInvalid.value) return;
  fromDate.value = draftFrom.value;
  toDate.value = draftTo.value;
  typeFilter.value = draftType.value;
  buildingFilter.value = [...draftBuildings.value];
  objMenuOpen.value = false;
}

function resetFilters() {
  draftFrom.value = DEFAULT_FROM;
  draftTo.value = DEFAULT_TO;
  draftType.value = "all";
  draftBuildings.value = scopedBuildings.value.map((b) => b.id);
  applyFilters();
}

function toggleAllBuildings() {
  draftBuildings.value =
    draftBuildings.value.length === scopedBuildings.value.length
      ? []
      : scopedBuildings.value.map((b) => b.id);
}

const mode = ref("portfolio");
const modeTabs = computed(() => [
  { value: "portfolio", label: t("usr.repModePortfolio") },
  { value: "single", label: t("usr.repModeSingle") },
]);

const filtered = computed(() =>
  scopedBuildings.value.filter(
    (b) =>
      buildingFilter.value.includes(b.id) &&
      (typeFilter.value === "all" || b.type === typeFilter.value),
  ),
);

const singleId = ref(scopedBuildings.value[0]?.id ?? BUILDINGS[0]!.id);

watch(
  filtered,
  (list) => {
    if (!list.some((b) => b.id === singleId.value))
      singleId.value = list[0]?.id ?? singleId.value;
  },
  { immediate: true },
);

const singleOptions = computed(() =>
  filtered.value.map((b) => ({
    value: b.id,
    label: b.name,
  })),
);

/** Faqat filtrga tushgan binolar ichidan: aks holda ro‘yxatdan chiqarilgan bino nomi chiqib qolardi */
const singleBuilding = computed(
  () => filtered.value.find((b) => b.id === singleId.value) ?? filtered.value[0],
);

const active = computed(() =>
  mode.value === "single"
    ? filtered.value.length
      ? [singleBuilding.value!]
      : []
    : filtered.value,
);

/**
 * Davr filtri haqiqatan ishlaydi.
 *
 * Ilgari sana oralig'i faqat sarlavha va fayl nomiga tushardi: 2024-yil
 * yanvar tanlansa ham ekranda o'sha 37.58 mlrd turaverardi, ya'ni kompaniya
 * mavjud bo'lmagan davr uchun tushum ko'rsatilardi.
 *
 * Endi hisob-fakturadan chiqadigan ko'rsatkichlar tanlangan oraliqdagi
 * hujjatlar bo'yicha hisoblanadi. Bandlik va maydon esa vaqt qatori emas,
 * ular joriy holat, shuning uchun ular davr bilan o'zgarmaydi va ekranda
 * shunday deb belgilanadi.
 */
const periodInvoices = computed(() => {
  const names = new Set(active.value.map((b) => b.name));
  return INVOICES.filter(
    (inv) =>
      names.has(inv.buildingName) &&
      inv.issuedAt >= fromDate.value &&
      inv.issuedAt <= toDate.value,
  );
});

/** Maydon yig'indilarida suzuvchi nuqta qoldig'i ko'rinmasin */
const round1 = (value: number) => Math.round(value * 10) / 10;

const totals = computed(() => {
  const list = active.value;
  const gla = list.reduce((s, b) => s + b.gla, 0);
  const occupiedArea = list.reduce((s, b) => s + b.occupiedArea, 0);

  const period = periodInvoices.value;
  const billed = period.reduce((s, inv) => s + inv.total, 0);
  const paid = period.reduce((s, inv) => s + inv.paid, 0);

  return {
    count: list.length,
    gla: round1(gla),
    /*
     * Band bo'lmagan maydon: GLA dan shartnoma bo'yicha egallangani ayirilgani.
     * Ilgari bu yerda faqat «bo'sh» statusidagi unitlar sanalardi, rezerv,
     * ta'mir va e'lon qilinmagan unitlar esa na bandga, na bo'shga tushardi:
     * ekranda 133 489 m² GLA turgani holda band va bo'sh maydon yig'indisi
     * 106 482 m² chiqardi. Endi o'lchov GLA ning to'ldiruvchisi, shuning
     * uchun band va band bo'lmagan maydon yig'indisi doim GLA ga teng va
     * bandlik foizi ham shu ikki raqamdan kelib chiqadi.
     */
    unoccupied: round1(gla - occupiedArea),
    /*
     * «Band bo'lmagan» ichida ikki xil maydon bor va ularni ajratmaslik
     * ekranlar orasida ziddiyat tug'diradi: boshqaruv panelida «bo'sh
     * maydon 23 299 m²» turadi, bu yerda esa «band bo'lmagan 50 305 m²»
     * chiqardi. Farq rezerv, ta'mir va e'lon qilinmagan unitlar edi, lekin
     * ular hech qaysi ekranda ko'rsatilmasdi. Endi uchala qiymat ham
     * alohida turadi va yig'indisi GLA ga teng bo'ladi.
     */
    vacant: round1(list.reduce((s, b) => s + b.vacantArea, 0)),
    reserved: round1(
      gla - occupiedArea - list.reduce((s, b) => s + b.vacantArea, 0),
    ),
    /*
     * Oylik ijara tushumi: reyestrdagi ijaradagi unitlarning oylik narxi.
     * Jadval qatorlari ham, jam qatori ham aynan shu manbadan o'qiydi.
     */
    rentRoll: list.reduce((s, b) => s + b.monthlyRevenue, 0),
    // Davr bo'yicha chiqarilgan summa; hujjat bo'lmasa nol ko'rsatiladi
    billed,
    debt: billed - paid,
    invoices: period.length,
    collection: billed ? Math.round((paid / billed) * 100) : 0,
    occupied: round1(occupiedArea),
    occupancy: gla ? Math.round((occupiedArea / gla) * 100) : 0,
    sla: gla
      ? Math.round(list.reduce((s, b) => s + b.sla * b.gla, 0) / gla)
      : 0,
  };
});

const periodLabel = computed(
  () => `${dateShort(fromDate.value)} – ${dateShort(toDate.value)}`,
);

const scopeLabel = computed(() => {
  if (!totals.value.count) return t("usr.repNoObjectSelected");
  if (mode.value === "single")
    return singleBuilding.value?.name ?? t("usr.repNoObjectSelected");
  if (totals.value.count === scopedBuildings.value.length)
    return t("usr.repAllObjectsCount", {
      current: totals.value.count,
      total: scopedBuildings.value.length,
    });
  return t("usr.repObjectCount", { count: totals.value.count });
});

/** Grafik o‘qidagi o‘lchov birligi ham tanlangan tilda yoziladi */
const billionUnit = computed(
  () => `${t("unitOf.billion")} ${t("unitOf.currency")}`,
);
const millionUnit = computed(
  () => `${t("unitOf.million")} ${t("unitOf.currency")}`,
);

const months = computed(() => {
  const f = new Date(fromDate.value);
  const to = new Date(toDate.value);
  if (Number.isNaN(f.getTime()) || Number.isNaN(to.getTime()) || to < f)
    return MONTHS.value.slice(0, 6);
  const out: string[] = [];
  const cur = new Date(f.getFullYear(), f.getMonth(), 1);
  const multiYear = f.getFullYear() !== to.getFullYear();
  while (cur <= to && out.length < 12) {
    out.push(
      multiYear
        ? `${MONTHS.value[cur.getMonth()]} ${String(cur.getFullYear()).slice(2)}`
        : MONTHS.value[cur.getMonth()]!,
    );
    cur.setMonth(cur.getMonth() + 1);
  }
  return out.length ? out : MONTHS.value.slice(0, 6);
});

function ramp(base: number, start: number, end: number, digits = 2) {
  const n = months.value.length;
  return Array.from({ length: n }, (_, i) =>
    Number(
      (base * (start + ((end - start) * i) / Math.max(n - 1, 1))).toFixed(
        digits,
      ),
    ),
  );
}

/*
 * Ustunlar GLA gacha to'ldiriladi: band bo'lmagan maydon har oyda band
 * maydonning to'ldiruvchisi sifatida olinadi, shuning uchun taxlangan
 * ustun balandligi har oyda aynan «Jami GLA» ni beradi.
 */
const occupancySeries = computed(() => {
  const occupied = ramp(totals.value.occupied, 0.965, 1, 0);
  return [
    {
      label: t("usr.repOccupiedAreaSeries"),
      tone: "ok" as const,
      values: occupied,
    },
    {
      label: t("usr.repVacantAreaSeries"),
      tone: "violet" as const,
      values: occupied.map((v) => round1(totals.value.gla - v)),
    },
  ];
});

/*
 * Grafik hisob-fakturalardan chiqadi va tanlangan davrga bog'liq, shuning
 * uchun sarlavhasi ham «hisoblangan summa» deb yoziladi. O'lchov birligi
 * mln so'm: registrdagi summalar mlrd shkalasida nol bo'lib ko'rinardi.
 */
const revenueSeries = computed(() => [
  {
    label: t("usr.repRevenueSeries"),
    tone: "brand" as const,
    values: ramp(totals.value.billed / 1_000_000, 0.87, 1, 1),
  },
]);

// Muddat guruhlari hisob-fakturalar registridan har safar qayta hisoblanadi:
// to‘lov qabul qilinganda hisobot ham darhol yangilanadi.
const debtSeries = computed(() =>
  agingOf().map((a) => ({
    label: a.bucket,
    tone: a.tone,
    values: ramp((totals.value.debt * a.share) / 100 / 1_000_000, 1.12, 1, 1),
  })),
);

const slaSlices = computed(() => {
  const done = totals.value.sla;
  const partial = Math.round((100 - done) * 0.7);
  return [
    { label: t("usr.repSlaDone"), value: done, tone: "ok" as const },
    { label: t("usr.repSlaPartial"), value: partial, tone: "warn" as const },
    {
      label: t("usr.repSlaFailed"),
      value: Math.max(100 - done - partial, 0),
      tone: "danger" as const,
    },
  ];
});

/** Kommunal sarf portfel bo‘yicha baza va tanlovning GLA ulushi bilan hisoblanadi */
const utilityBase = computed(() => {
  const share = PORTFOLIO_TOTALS.gla
    ? totals.value.gla / PORTFOLIO_TOTALS.gla
    : 0;
  return [
    {
      label: t("meterType.electricity"),
      unit: t("unitOf.kwh"),
      value: Math.round(125430 * share),
      tone: "brand" as const,
      curve: [1, 0.96, 0.92, 0.95, 1.03, 1.08],
    },
    {
      label: t("meterType.water"),
      unit: t("unitOf.cbm"),
      value: Math.round(8760 * share),
      tone: "ok" as const,
      curve: [1, 1.02, 1.05, 1.09, 1.14, 1.18],
    },
    {
      label: t("usr.repHeating"),
      unit: t("unitOf.gcal"),
      value: Math.round(12340 * share),
      tone: "warn" as const,
      curve: [1, 0.94, 0.78, 0.52, 0.34, 0.3],
    },
  ];
});

const utilitySeries = computed(() =>
  utilityBase.value.map((u) => ({
    label: t("usr.repUtilitySeries", { label: u.label, unit: u.unit }),
    tone: u.tone,
    values: months.value.map((_, i) =>
      Number((100 * (u.curve[i % u.curve.length] ?? 1)).toFixed(1)),
    ),
  })),
);

const compareSeries = computed(() => {
  const collection = totals.value.billed
    ? Math.max(100 - (totals.value.debt / totals.value.billed) * 100, 0)
    : 0;
  return [
    {
      label: t("usr.repOccupancyPct"),
      tone: "brand" as const,
      values: ramp(totals.value.occupancy, 0.96, 1, 1),
    },
    {
      label: t("usr.repSlaPct"),
      tone: "ok" as const,
      values: ramp(totals.value.sla, 0.98, 1, 1),
    },
    {
      label: t("usr.repCollectionPct"),
      tone: "violet" as const,
      values: ramp(collection, 0.985, 1, 1),
    },
  ];
});

const tableColumns = computed(() => [
  { key: "name", label: t("field.object") },
  {
    key: "gla",
    label: t("usr.repGlaCol"),
    align: "right" as const,
    numeric: true,
  },
  {
    key: "occupancy",
    label: t("field.occupancy"),
    align: "right" as const,
    numeric: true,
  },
  {
    key: "revenue",
    label: t("usr.repRevenue"),
    align: "right" as const,
    numeric: true,
  },
  {
    key: "unoccupied",
    label: t("usr.repVacantAreaSeries"),
    align: "right" as const,
    numeric: true,
  },
  { key: "sla", label: t("field.sla"), align: "right" as const, numeric: true },
]);

/*
 * Jadvalning har bir ustuni bitta o'lchovda yuritiladi: qator qanday manbadan
 * o'qisa, jam qatori ham o'sha manbadan o'qiydi.
 *
 * Ilgari «Ijara tushumi» ustunida ikki xil o'lchov aralashib ketgan edi:
 * qatorlar obyektning oylik tushumini ko'rsatardi, jam qatori esa tanlangan
 * davr hisob-fakturalaridan hisoblanardi. Registrda hozircha ikkita
 * obyektning hujjati bor, shuning uchun jam 187.8 mln bo'lib chiqar va
 * qatorlarning deyarli har biridan kichik turardi.
 *
 * Endi ustun reyestrdan olinadigan oylik ijara tushumini ko'rsatadi: bu
 * ko'rsatkich har bir obyekt uchun to'liq, obyekt kartochkasidagi raqam
 * bilan bir xil va jam aniq qatorlar yig'indisiga teng. Davrga bog'liq
 * hisob-faktura ko'rsatkichlari KPI qatorida alohida turadi.
 */
const tableRows = computed(() => {
  const rows = active.value.map((b) => ({
    id: b.id,
    name: b.name,
    district: `${cityLabel(b.city)}, ${districtLabel(b.district)}`,
    gla: b.gla,
    occupancy: b.occupancy,
    revenue: b.monthlyRevenue,
    unoccupied: round1(b.gla - b.occupiedArea),
    sla: b.sla,
    total: false,
  }));
  if (!rows.length) return rows;
  const sum = totals.value;
  return [
    ...rows,
    {
      id: "summary",
      name:
        mode.value === "single"
          ? t("usr.repObjectTotal")
          : t("usr.repTotalAverage"),
      district: t("usr.repObjectCount", { count: sum.count }),
      gla: sum.gla,
      occupancy: sum.occupancy,
      revenue: sum.rentRoll,
      unoccupied: sum.unoccupied,
      sla: sum.sla,
      total: true,
    },
  ];
});

function onRowClick(row: Record<string, unknown>) {
  if (row.total) {
    mode.value = "portfolio";
    return;
  }
  singleId.value = String(row.id);
  mode.value = "single";
}

const QUICK_REPORTS = computed(() => [
  {
    id: "qr-01",
    title: t("usr.repQuickKpi"),
    caption: t("usr.repQuickKpiCaption"),
    icon: "chart",
  },
  {
    id: "qr-02",
    title: t("usr.repQuickRevenue"),
    caption: t("usr.repQuickRevenueCaption"),
    icon: "wallet",
  },
  {
    id: "qr-03",
    title: t("usr.repQuickDebt"),
    caption: t("usr.repQuickDebtCaption"),
    icon: "warning",
  },
  {
    id: "qr-04",
    title: t("usr.repQuickSla"),
    caption: t("usr.repQuickSlaCaption"),
    icon: "wrench",
  },
  {
    id: "qr-05",
    title: t("usr.repQuickUtility"),
    caption: t("usr.repQuickUtilityCaption"),
    icon: "meter",
  },
]);

const EXPORT_FORMATS = ["DOCX", "CSV"];

const exportOpen = ref(false);
const exportTitle = ref("");
const exportFormat = ref("DOCX");
const lastExport = ref<{
  title: string;
  format: string;
  period: string;
  scope: string;
  fileName: string;
} | null>(null);

function openExport(title: string, format: string) {
  exportTitle.value = title;
  exportFormat.value = format;
  exportOpen.value = true;
}

/** Faylga ekrandagi jadvalning aynan o‘zi tushadi */
function exportTable(): Array<Array<string | number>> {
  return [
    [
      t("field.object"),
      t("usr.repLocationCol"),
      t("usr.repGlaUnit"),
      t("usr.repOccupancyUnit"),
      t("usr.repRevenueUnit"),
      t("usr.repVacantUnit"),
      t("usr.repSlaUnit"),
    ],
    ...tableRows.value.map((r) => [
      r.name,
      r.district,
      r.gla,
      r.occupancy,
      r.revenue,
      r.unoccupied,
      r.sla,
    ]),
  ];
}

function exportDocument() {
  const sum = totals.value;
  return docxBlob([
    { text: exportTitle.value, style: "title" },
    { text: `${scopeLabel.value} • ${periodLabel.value}`, style: "subtitle" },
    { text: t("usr.repKeyMetrics"), style: "heading" },
    { text: t("usr.repDocGla", { value: num(sum.gla) }) },
    { text: t("usr.repDocOccupancy", { value: percent(sum.occupancy) }) },
    { text: t("usr.repDocVacant", { value: num(sum.unoccupied) }) },
    // Obyektlar ro'yxatidagi tushum qatorlari shu jamga yig'iladi
    { text: t("usr.repDocRevenue", { value: sumShort(sum.rentRoll) }) },
    { text: t("usr.repDocBilled", { value: sumShort(sum.billed) }) },
    { text: t("usr.repDocDebt", { value: sumShort(sum.debt) }) },
    { text: t("usr.repDocSla", { value: percent(sum.sla) }) },
    { text: t("usr.repObjectBreakdown"), style: "heading" },
    ...active.value.map((b) => ({
      text: t("usr.repDocBuildingLine", {
        name: b.name,
        location: `${cityLabel(b.city)}, ${districtLabel(b.district)}`,
        gla: num(b.gla),
        occupancy: percent(b.occupancy),
        revenue: sumShort(b.monthlyRevenue),
        vacant: num(b.vacantArea),
        sla: percent(b.sla),
      }),
    })),
    {
      text: t("usr.repDocFooter", {
        count: sum.count,
        period: periodLabel.value,
      }),
      style: "small",
    },
  ]);
}

function confirmExport() {
  const csv = exportFormat.value === "CSV";
  const fileName = `${fileSlug(exportTitle.value)}-${fromDate.value}-${toDate.value}.${csv ? "csv" : "docx"}`;

  saveBlob(csv ? csvBlob(exportTable()) : exportDocument(), fileName);

  lastExport.value = {
    title: exportTitle.value,
    format: exportFormat.value,
    period: periodLabel.value,
    scope: scopeLabel.value,
    fileName,
  };
  exportOpen.value = false;
}
</script>

<template>
  <AppTopbar
    :title="t('usr.repTitle')"
    :subtitle="t('usr.repCaption')"
    :breadcrumb="[
      { label: t('nav.cabinet'), to: '/' },
      { label: t('nav.reports') },
    ]"
  >
    <template #actions>
      <UiButton
        size="sm"
        @click="openExport(t('usr.repGeneralAnalytics'), 'DOCX')"
      >
        <UiIcon name="download" :size="16" />
        {{ t("common.exportAction") }}
      </UiButton>
    </template>
  </AppTopbar>

  <main class="scroll-slim flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
    <UiCard
      :title="t('usr.repFilters')"
      :subtitle="
        t('usr.repCurrentSelection', { scope: scopeLabel, period: periodLabel })
      "
    >
      <div class="grid gap-4 lg:grid-cols-[repeat(3,minmax(0,1fr))_auto]">
        <UiField
          :label="t('field.dateRange')"
          :error="rangeInvalid ? t('usr.repRangeInvalid') : ''"
        >
          <div class="flex items-center gap-2">
            <UiInput v-model="draftFrom" type="date" :invalid="rangeInvalid" />
            <span class="text-ink-400">-</span>
            <UiInput v-model="draftTo" type="date" :invalid="rangeInvalid" />
          </div>
        </UiField>

        <UiField
          :label="t('nav.objects')"
          :hint="
            t('usr.repSelectedCount', {
              selected: draftBuildings.length,
              total: scopedBuildings.length,
            })
          "
        >
          <div ref="objMenuRoot" class="relative">
            <button
              type="button"
              class="flex h-11 w-full items-center justify-between gap-2 rounded-field bg-white pl-3.5 pr-3 text-left text-sm text-ink-800 ring-1 ring-inset ring-ink-200 transition-colors hover:ring-ink-300"
              :aria-expanded="objMenuOpen"
              @click="objMenuOpen = !objMenuOpen"
            >
              <span class="truncate">{{ draftLabel }}</span>
              <UiIcon name="chevronDown" :size="16" class="text-ink-400" />
            </button>

            <div
              v-if="objMenuOpen"
              class="absolute left-0 right-0 z-30 mt-2 rounded-field bg-surface p-2 shadow-pop ring-1 ring-ink-200"
            >
              <button
                type="button"
                class="mb-1 flex w-full items-center gap-2 rounded-[8px] px-2.5 py-2 text-[13px] font-semibold text-brand-600 transition-colors hover:bg-brand-50"
                @click="toggleAllBuildings"
              >
                <UiIcon name="check" :size="16" />
                {{
                  draftBuildings.length === scopedBuildings.length
                    ? t("usr.repUnselectAll")
                    : t("usr.repSelectAll")
                }}
              </button>
              <label
                v-for="b in scopedBuildings"
                :key="b.id"
                class="flex cursor-pointer items-center gap-2.5 rounded-[8px] px-2.5 py-2 transition-colors hover:bg-ink-50"
              >
                <input
                  v-model="draftBuildings"
                  type="checkbox"
                  :value="b.id"
                  class="size-4 shrink-0 accent-brand-500"
                />
                <span class="min-w-0 flex-1">
                  <span
                    class="block truncate text-[13px] font-medium text-ink-800"
                    >{{ b.name }}</span
                  >
                  <span class="block truncate text-[12px] text-ink-500">{{
                    buildingTypeLabel(b.type)
                  }}</span>
                </span>
              </label>
            </div>
          </div>
        </UiField>

        <UiField :label="t('field.buildingType')">
          <UiSelect v-model="draftType" :options="TYPE_OPTIONS" />
        </UiField>

        <div class="flex items-end gap-2.5">
          <UiButton :disabled="rangeInvalid" @click="applyFilters">
            <UiIcon name="filter" :size="16" />
            {{ t("common.applyFilters") }}
          </UiButton>
          <UiButton variant="ghost" @click="resetFilters">{{
            t("common.reset")
          }}</UiButton>
        </div>
      </div>

      <p
        v-if="filterChanged"
        class="mt-3 flex items-center gap-2 text-[13px] font-medium text-warn-700"
      >
        <UiIcon name="info" :size="16" />
        {{ t("usr.repFiltersChanged", { action: t("common.applyFilters") }) }}
      </p>
    </UiCard>

    <section class="flex flex-wrap items-center gap-4">
      <div class="flex items-center gap-3">
        <span class="text-[13px] font-semibold text-ink-700">{{
          t("usr.repViewMode")
        }}</span>
        <UiTabs v-model="mode" :tabs="modeTabs" />
      </div>

      <UiSelect
        v-if="mode === 'single'"
        v-model="singleId"
        :options="singleOptions"
        size="sm"
        class="w-60"
      />

      <p
        v-if="totals.count"
        class="flex flex-1 basis-64 items-center gap-2 rounded-field bg-brand-50 px-3.5 py-2.5 text-[13px] text-brand-800"
      >
        <UiIcon name="info" :size="16" class="text-brand-600" />
        <span v-if="mode === 'portfolio'">
          {{ t("usr.repPortfolioMode", { scope: scopeLabel }) }}
        </span>
        <span v-else>
          {{ t("usr.repSingleMode", { name: singleBuilding?.name }) }}
        </span>
      </p>
    </section>

    <div
      v-if="!totals.count"
      class="flex items-center gap-3 rounded-card bg-surface p-5 text-[14px] text-ink-600 shadow-card ring-1 ring-ink-200/60"
    >
      <UiIcon name="warning" :size="20" class="text-warn-500" />
      {{ t("usr.repNoMatch", { action: t("common.reset") }) }}
    </div>

    <section
      v-else
      class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6"
    >
      <UiKpi
        :label="t('kpi.glaTotal')"
        :value="num(totals.gla)"
        :unit="t('unitOf.sqm')"
        :delta="trendDelta('gla')"
        icon="building"
        tone="brand"
        :spark="trendSpark('gla', totals.gla / 1000)"
      />
      <UiKpi
        :label="t('kpi.occupancyRate')"
        :value="percent(totals.occupancy)"
        :delta="trendDelta('occupancy')"
        icon="layers"
        tone="ok"
        :spark="trendSpark('occupancy', totals.occupancy)"
      />
      <!-- Bo'sh maydon boshqaruv panelidagi bilan bir xil raqamni beradi -->
      <UiKpi
        :label="t('usr.repVacantKpi')"
        :value="num(totals.vacant)"
        :unit="t('unitOf.sqm')"
        :delta="trendDelta('vacantArea')"
        invert
        icon="cube"
        tone="violet"
        :spark="trendSpark('vacantArea', totals.vacant / 1000)"
      />
      <UiKpi
        :label="t('usr.repBilledKpi')"
        :value="moneyShort(totals.billed)"
        :delta="trendDelta('revenue')"
        icon="wallet"
        tone="brand"
        :spark="trendSpark('revenue', totals.billed / 1_000_000)"
      />
      <UiKpi
        :label="t('kpi.debt')"
        :value="moneyShort(totals.debt)"
        :delta="trendDelta('debt')"
        invert
        icon="warning"
        tone="danger"
        :spark="trendSpark('debt', totals.debt / 1_000_000)"
      />
      <UiKpi
        :label="t('kpi.slaCompliance')"
        :value="percent(totals.sla)"
        :delta="trendDelta('sla')"
        icon="wrench"
        tone="ok"
        :spark="trendSpark('sla', totals.sla)"
      />
    </section>

    <nav class="flex flex-wrap gap-2" :aria-label="t('usr.repSections')">
      <button
        v-for="rt in REPORT_TABS"
        :key="rt.key"
        type="button"
        class="h-11 rounded-field px-4 text-[13px] font-semibold ring-1 ring-inset transition-colors md:h-9"
        :class="
          tab === rt.key
            ? 'bg-brand-500 text-white ring-brand-500'
            : 'bg-white text-ink-600 ring-ink-200 hover:ring-ink-300'
        "
        :aria-pressed="tab === rt.key"
        @click="tab = rt.key"
      >
        {{ rt.label }}
      </button>
      <p class="ml-auto self-center text-[12px] text-ink-500">
        {{ activeTab.caption }}
      </p>
    </nav>

    <UiCard
      v-show="tab === 'umumiy'"
      :title="t('usr.repByObjects')"
      :subtitle="t('usr.repByObjectsCaption')"
      flush
    >
      <template #actions>
        <UiButton
          variant="secondary"
          size="sm"
          @click="openExport(t('usr.repByObjects'), 'CSV')"
        >
          <UiIcon name="download" :size="16" />
          CSV
        </UiButton>
      </template>

      <UiTable
        :page-size="12"
        :columns="tableColumns"
        :rows="tableRows"
        :empty="t('empty.noObjectsForFilter')"
        @row-click="onRowClick"
      >
        <template #cell-name="{ row }">
          <span
            class="block text-[14px]"
            :class="
              row.total
                ? 'font-bold text-ink-900'
                : 'font-semibold text-ink-900'
            "
          >
            {{ row.name }}
          </span>
          <span class="block text-[12px] text-ink-500">{{ row.district }}</span>
        </template>

        <template #cell-gla="{ row }">
          <span :class="row.total ? 'font-bold text-ink-900' : ''">{{
            num(row.gla)
          }}</span>
        </template>

        <template #cell-occupancy="{ row }">
          <span
            class="inline-flex items-center gap-1.5"
            :class="row.total ? 'font-bold text-ink-900' : ''"
          >
            <span
              class="size-2 rounded-full"
              :class="
                row.occupancy >= 90
                  ? 'bg-ok-500'
                  : row.occupancy >= 84
                    ? 'bg-brand-500'
                    : 'bg-warn-500'
              "
            />
            {{ percent(row.occupancy) }}
          </span>
        </template>

        <template #cell-revenue="{ row }">
          <span :class="row.total ? 'font-bold text-ink-900' : ''">{{
            moneyShort(row.revenue)
          }}</span>
        </template>

        <template #cell-unoccupied="{ row }">
          <span :class="row.total ? 'font-bold text-ink-900' : ''">{{
            num(row.unoccupied)
          }}</span>
        </template>

        <template #cell-sla="{ row }">
          <span
            class="inline-flex items-center gap-1.5"
            :class="row.total ? 'font-bold text-ink-900' : ''"
          >
            <span :class="row.sla >= 96 ? 'text-ok-600' : 'text-warn-600'">
              <UiIcon :name="row.sla >= 96 ? 'check' : 'clock'" :size="14" />
            </span>
            {{ percent(row.sla) }}
          </span>
        </template>
      </UiTable>
    </UiCard>

    <section v-show="tab === 'bandlik'" class="grid gap-5 xl:grid-cols-2">
      <UiCard
        :title="t('reports.vacancyTitle')"
        :subtitle="t('reports.vacancyCaption')"
      >
        <UiBars
          :labels="months"
          :series="occupancySeries"
          stacked
          :height="220"
          :unit="t('unitOf.sqm')"
        />
      </UiCard>

      <UiCard
        :title="t('usr.repCompareTitle')"
        :subtitle="t('usr.repCompareCaption')"
      >
        <UiLine :labels="months" :series="compareSeries" :height="212" />
      </UiCard>
    </section>

    <section v-show="tab === 'moliya'" class="grid gap-5 xl:grid-cols-2">
      <UiCard
        :title="t('usr.repRevenueTitle')"
        :subtitle="t('usr.repRevenueCaption')"
      >
        <UiBars
          :labels="months"
          :series="revenueSeries"
          :height="220"
          :unit="millionUnit"
        />
      </UiCard>

      <UiCard :title="t('nav.debts')" :subtitle="t('usr.repDebtCaption')">
        <UiBars
          :labels="months"
          :series="debtSeries"
          stacked
          :height="220"
          :unit="millionUnit"
        />
      </UiCard>
    </section>

    <section v-show="tab === 'servis'" class="grid gap-5 xl:grid-cols-2">
      <UiCard :title="t('usr.repSlaTitle')" :subtitle="t('usr.repSlaCaption')">
        <UiDonut
          :slices="slaSlices"
          :center-value="percent(totals.sla)"
          :center-label="t('usr.repSlaCenter')"
          :size="176"
        />
      </UiCard>

      <UiCard
        :title="t('usr.repUtilityTitle')"
        :subtitle="t('usr.repUtilityCaption')"
      >
        <UiLine :labels="months" :series="utilitySeries" :height="212" />
        <dl
          class="mt-4 grid grid-cols-2 gap-3 border-t border-ink-100 pt-4 sm:grid-cols-3"
        >
          <div v-for="u in utilityBase" :key="u.label">
            <dt class="text-[12px] text-ink-500">
              {{ u.label }} ({{ u.unit }})
            </dt>
            <dd class="tabular mt-0.5 text-sm font-bold text-ink-900">
              {{ num(u.value) }}
            </dd>
          </div>
        </dl>
      </UiCard>
    </section>

    <UiCard
      v-show="tab === 'hujjat'"
      :title="t('usr.repQuickTitle')"
      :subtitle="t('usr.repQuickCaption')"
      flush
    >
      <p
        v-if="lastExport"
        class="mx-5 mb-3 flex items-start gap-2 rounded-field bg-ok-50 px-3.5 py-2.5 text-[13px] text-ok-700"
      >
        <UiIcon name="check" :size="16" class="mt-0.5 shrink-0" />
        <span>
          {{
            t("usr.repExportedPrefix", {
              title: lastExport.title,
              scope: lastExport.scope,
              period: lastExport.period,
            })
          }}
          <span class="tabular font-semibold">{{ lastExport.fileName }}</span>
          {{ t("usr.repExportedSuffix") }}
        </span>
      </p>

      <ul class="divide-y divide-ink-100">
        <li
          v-for="r in QUICK_REPORTS"
          :key="r.id"
          class="flex items-center gap-4 px-5 py-3.5"
        >
          <span
            class="grid size-10 shrink-0 place-items-center rounded-field bg-brand-50 text-brand-600"
          >
            <UiIcon :name="r.icon" :size="18" />
          </span>
          <span class="min-w-0 flex-1">
            <span
              class="block truncate text-[14px] font-semibold text-ink-900"
              >{{ r.title }}</span
            >
            <span class="block truncate text-[12px] text-ink-500">{{
              r.caption
            }}</span>
          </span>
          <span class="flex shrink-0 gap-2">
            <UiButton
              variant="secondary"
              size="sm"
              @click="openExport(r.title, 'DOCX')"
              >DOCX</UiButton
            >
            <UiButton
              variant="subtle"
              size="sm"
              @click="openExport(r.title, 'CSV')"
              >CSV</UiButton
            >
          </span>
        </li>
      </ul>
    </UiCard>

    <UiModal
      v-model="exportOpen"
      :title="t('usr.repExportTitle')"
      :subtitle="t('usr.repExportCaption')"
      size="sm"
    >
      <dl class="space-y-3 text-[14px]">
        <div class="flex items-start justify-between gap-4">
          <dt class="text-ink-500">{{ t("field.report") }}</dt>
          <dd class="text-right font-semibold text-ink-900">
            {{ exportTitle }}
          </dd>
        </div>
        <div class="flex items-start justify-between gap-4">
          <dt class="text-ink-500">{{ t("field.period") }}</dt>
          <dd class="tabular text-right font-semibold text-ink-900">
            {{ periodLabel }}
          </dd>
        </div>
        <div class="flex items-start justify-between gap-4">
          <dt class="text-ink-500">{{ t("field.coverage") }}</dt>
          <dd class="text-right font-semibold text-ink-900">
            {{ scopeLabel }}
          </dd>
        </div>
      </dl>

      <div class="mt-5">
        <p class="mb-2 text-[13px] font-semibold text-ink-700">
          {{ t("field.format") }}
        </p>
        <div class="flex gap-2">
          <button
            v-for="f in EXPORT_FORMATS"
            :key="f"
            type="button"
            class="inline-flex items-center gap-2 rounded-field px-4 py-2.5 text-[13px] font-semibold ring-1 ring-inset transition-colors"
            :class="
              exportFormat === f
                ? 'bg-brand-50 text-brand-700 ring-brand-300'
                : 'bg-white text-ink-600 ring-ink-200 hover:ring-ink-300'
            "
            @click="exportFormat = f"
          >
            <UiIcon :name="exportFormat === f ? 'check' : 'doc'" :size="16" />
            {{ f }}
          </button>
        </div>
      </div>

      <template #footer>
        <UiButton variant="ghost" @click="exportOpen = false">{{
          t("common.cancel")
        }}</UiButton>
        <UiButton @click="confirmExport">
          <UiIcon name="download" :size="16" />
          {{ t("common.download") }}
        </UiButton>
      </template>
    </UiModal>
  </main>
</template>
