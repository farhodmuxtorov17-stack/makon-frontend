<script setup lang="ts">
import { BUILDINGS, PORTFOLIO_TOTALS, trendDelta, trendSpark } from '~/data/buildings'
import { agingOf } from '~/data/business'
import { csvBlob, docxBlob, fileSlug, saveBlob } from '~/utils/docx'
import { num, percent, sumShort, dateShort, todayIso, monthShift } from '~/utils/format'

const auth = useAuthStore()

/** Hisobot faqat foydalanuvchining ko‘rish sohasidagi obyektlarni qamraydi */
const scopedBuildings = computed(() => BUILDINGS.filter((b) => auth.inScope(b.id)))

const MONTHS = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyun', 'Iyul', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek']

// Hisobot davri bugun tugaydi: kelajakdagi oy uchun hisobot bo‘lmaydi
const DEFAULT_FROM = monthShift(-5)
const DEFAULT_TO = todayIso()

const TYPE_OPTIONS = computed(() => [
  { value: 'all', label: 'Barcha bino turlari' },
  ...[...new Set(scopedBuildings.value.map((b) => b.type))].map((t) => ({ value: t, label: t })),
])

const draftFrom = ref(DEFAULT_FROM)
const draftTo = ref(DEFAULT_TO)
const draftType = ref('all')
const draftBuildings = ref<string[]>([])

const fromDate = ref(DEFAULT_FROM)
const toDate = ref(DEFAULT_TO)
const typeFilter = ref('all')
const buildingFilter = ref<string[]>([])

/** Ko‘rish sohasi o‘zgarsa tanlov ham shu sohaga qisqaradi */
watch(
  scopedBuildings,
  (list) => {
    const ids = list.map((b) => b.id)
    const keep = (current: string[]) => {
      const next = current.filter((id) => ids.includes(id))
      return next.length ? next : ids
    }
    draftBuildings.value = keep(draftBuildings.value)
    buildingFilter.value = keep(buildingFilter.value)

    const types = new Set(list.map((b) => b.type as string))
    if (draftType.value !== 'all' && !types.has(draftType.value)) draftType.value = 'all'
    if (typeFilter.value !== 'all' && !types.has(typeFilter.value)) typeFilter.value = 'all'
  },
  { immediate: true },
)

const objMenuRoot = ref<HTMLElement | null>(null)
const objMenuOpen = ref(false)
onClickOutside(objMenuRoot, () => (objMenuOpen.value = false))

const rangeInvalid = computed(() => new Date(draftTo.value) < new Date(draftFrom.value))

const filterChanged = computed(
  () =>
    draftFrom.value !== fromDate.value ||
    draftTo.value !== toDate.value ||
    draftType.value !== typeFilter.value ||
    draftBuildings.value.slice().sort().join() !== buildingFilter.value.slice().sort().join(),
)

const draftLabel = computed(() => {
  if (!draftBuildings.value.length) return 'Obyekt tanlanmagan'
  if (draftBuildings.value.length === scopedBuildings.value.length) return 'Barcha obyektlar'
  if (draftBuildings.value.length === 1)
    return scopedBuildings.value.find((b) => b.id === draftBuildings.value[0])?.name ?? 'Obyekt'
  return `${draftBuildings.value.length} ta obyekt tanlandi`
})

function applyFilters() {
  if (rangeInvalid.value) return
  fromDate.value = draftFrom.value
  toDate.value = draftTo.value
  typeFilter.value = draftType.value
  buildingFilter.value = [...draftBuildings.value]
  objMenuOpen.value = false
}

function resetFilters() {
  draftFrom.value = DEFAULT_FROM
  draftTo.value = DEFAULT_TO
  draftType.value = 'all'
  draftBuildings.value = scopedBuildings.value.map((b) => b.id)
  applyFilters()
}

function toggleAllBuildings() {
  draftBuildings.value =
    draftBuildings.value.length === scopedBuildings.value.length
      ? []
      : scopedBuildings.value.map((b) => b.id)
}

const mode = ref('portfolio')
const modeTabs = [
  { value: 'portfolio', label: 'Portfel' },
  { value: 'single', label: 'Bitta obyekt' },
]

const filtered = computed(() =>
  scopedBuildings.value.filter(
    (b) =>
      buildingFilter.value.includes(b.id) &&
      (typeFilter.value === 'all' || b.type === typeFilter.value),
  ),
)

const singleId = ref(scopedBuildings.value[0]?.id ?? BUILDINGS[0]!.id)

watch(
  filtered,
  (list) => {
    if (!list.some((b) => b.id === singleId.value)) singleId.value = list[0]?.id ?? singleId.value
  },
  { immediate: true },
)

const singleOptions = computed(() =>
  (filtered.value.length ? filtered.value : scopedBuildings.value).map((b) => ({
    value: b.id,
    label: b.name,
  })),
)

const singleBuilding = computed(
  () =>
    filtered.value.find((b) => b.id === singleId.value) ??
    filtered.value[0] ??
    scopedBuildings.value.find((b) => b.id === singleId.value) ??
    BUILDINGS.find((b) => b.id === singleId.value)!,
)

const active = computed(() =>
  mode.value === 'single' ? (filtered.value.length ? [singleBuilding.value] : []) : filtered.value,
)

const totals = computed(() => {
  const list = active.value
  const gla = list.reduce((s, b) => s + b.gla, 0)
  const vacantArea = list.reduce((s, b) => s + b.vacantArea, 0)
  const revenue = list.reduce((s, b) => s + b.monthlyRevenue, 0)
  const debt = list.reduce((s, b) => s + b.debt, 0)
  return {
    count: list.length,
    gla,
    vacantArea,
    revenue,
    debt,
    occupied: gla - vacantArea,
    occupancy: gla ? Math.round(((gla - vacantArea) / gla) * 100) : 0,
    sla: gla ? Math.round(list.reduce((s, b) => s + b.sla * b.gla, 0) / gla) : 0,
  }
})

const periodLabel = computed(() => `${dateShort(fromDate.value)} – ${dateShort(toDate.value)}`)

const scopeLabel = computed(() => {
  if (mode.value === 'single') return singleBuilding.value?.name ?? 'Obyekt tanlanmagan'
  if (!totals.value.count) return 'Obyekt tanlanmagan'
  if (totals.value.count === scopedBuildings.value.length)
    return `Barcha obyektlar (${totals.value.count}/${scopedBuildings.value.length})`
  return `${totals.value.count} ta obyekt`
})

const months = computed(() => {
  const f = new Date(fromDate.value)
  const t = new Date(toDate.value)
  if (Number.isNaN(f.getTime()) || Number.isNaN(t.getTime()) || t < f) return MONTHS.slice(0, 6)
  const out: string[] = []
  const cur = new Date(f.getFullYear(), f.getMonth(), 1)
  const multiYear = f.getFullYear() !== t.getFullYear()
  while (cur <= t && out.length < 12) {
    out.push(
      multiYear
        ? `${MONTHS[cur.getMonth()]} ${String(cur.getFullYear()).slice(2)}`
        : MONTHS[cur.getMonth()]!,
    )
    cur.setMonth(cur.getMonth() + 1)
  }
  return out.length ? out : MONTHS.slice(0, 6)
})

function ramp(base: number, start: number, end: number, digits = 2) {
  const n = months.value.length
  return Array.from({ length: n }, (_, i) =>
    Number((base * (start + ((end - start) * i) / Math.max(n - 1, 1))).toFixed(digits)),
  )
}

const occupancySeries = computed(() => [
  { label: 'Band maydon (m²)', tone: 'ok' as const, values: ramp(totals.value.occupied, 0.965, 1, 0) },
  { label: 'Bo‘sh maydon (m²)', tone: 'violet' as const, values: ramp(totals.value.vacantArea, 1.14, 1, 0) },
])

const revenueSeries = computed(() => [
  {
    label: 'Ijara tushumi, mlrd so‘m',
    tone: 'brand' as const,
    values: ramp(totals.value.revenue / 1_000_000_000, 0.87, 1),
  },
])

// Muddat guruhlari hisob-fakturalar registridan har safar qayta hisoblanadi:
// to‘lov qabul qilinganda hisobot ham darhol yangilanadi.
const debtSeries = computed(() =>
  agingOf().map((a) => ({
    label: a.bucket,
    tone: a.tone,
    values: ramp((totals.value.debt * a.share) / 100 / 1_000_000, 1.12, 1, 1),
  })),
)

const slaSlices = computed(() => {
  const done = totals.value.sla
  const partial = Math.round((100 - done) * 0.7)
  return [
    { label: 'Bajarildi', value: done, tone: 'ok' as const },
    { label: 'Qisman bajarildi', value: partial, tone: 'warn' as const },
    { label: 'Bajarilmadi', value: Math.max(100 - done - partial, 0), tone: 'danger' as const },
  ]
})

/** Kommunal sarf portfel bo‘yicha baza va tanlovning GLA ulushi bilan hisoblanadi */
const utilityBase = computed(() => {
  const share = PORTFOLIO_TOTALS.gla ? totals.value.gla / PORTFOLIO_TOTALS.gla : 0
  return [
    { label: 'Elektr', unit: 'kVt-soat', value: Math.round(125430 * share), tone: 'brand' as const, curve: [1, 0.96, 0.92, 0.95, 1.03, 1.08] },
    { label: 'Suv', unit: 'm³', value: Math.round(8760 * share), tone: 'ok' as const, curve: [1, 1.02, 1.05, 1.09, 1.14, 1.18] },
    { label: 'Isitish', unit: 'Gkal', value: Math.round(12340 * share), tone: 'warn' as const, curve: [1, 0.94, 0.78, 0.52, 0.34, 0.3] },
  ]
})

const utilitySeries = computed(() =>
  utilityBase.value.map((u) => ({
    label: `${u.label} (${u.unit}, indeks)`,
    tone: u.tone,
    values: months.value.map((_, i) =>
      Number((100 * (u.curve[i % u.curve.length] ?? 1)).toFixed(1)),
    ),
  })),
)

const compareSeries = computed(() => {
  const collection = totals.value.revenue
    ? Math.max(100 - (totals.value.debt / totals.value.revenue) * 100, 0)
    : 0
  return [
    { label: 'Bandlik (%)', tone: 'brand' as const, values: ramp(totals.value.occupancy, 0.96, 1, 1) },
    { label: 'Servis SLA (%)', tone: 'ok' as const, values: ramp(totals.value.sla, 0.98, 1, 1) },
    { label: 'To‘lovlar yig‘ilishi (%)', tone: 'violet' as const, values: ramp(collection, 0.985, 1, 1) },
  ]
})

const tableColumns = [
  { key: 'name', label: 'Obyekt' },
  { key: 'gla', label: 'GLA (m²)', align: 'right' as const, numeric: true },
  { key: 'occupancy', label: 'Bandlik', align: 'right' as const, numeric: true },
  { key: 'revenue', label: 'Ijara tushumi', align: 'right' as const, numeric: true },
  { key: 'vacantArea', label: 'Bo‘sh maydon (m²)', align: 'right' as const, numeric: true },
  { key: 'sla', label: 'SLA', align: 'right' as const, numeric: true },
]

const tableRows = computed(() => {
  const rows = active.value.map((b) => ({
    id: b.id,
    name: b.name,
    district: `${b.city}, ${b.district}`,
    gla: b.gla,
    occupancy: b.occupancy,
    revenue: b.monthlyRevenue,
    vacantArea: b.vacantArea,
    sla: b.sla,
    total: false,
  }))
  if (!rows.length) return rows
  const t = totals.value
  return [
    ...rows,
    {
      id: 'summary',
      name: mode.value === 'single' ? 'Obyekt bo‘yicha jami' : 'Jami / O‘rtacha',
      district: `${t.count} ta obyekt • ${periodLabel.value}`,
      gla: t.gla,
      occupancy: t.occupancy,
      revenue: t.revenue,
      vacantArea: t.vacantArea,
      sla: t.sla,
      total: true,
    },
  ]
})

function onRowClick(row: Record<string, unknown>) {
  if (row.total) {
    mode.value = 'portfolio'
    return
  }
  singleId.value = String(row.id)
  mode.value = 'single'
}

const QUICK_REPORTS = [
  { id: 'qr-01', title: 'Portfel KPI hisoboti', caption: 'Asosiy ko‘rsatkichlar va dinamika', icon: 'chart' },
  { id: 'qr-02', title: 'Ijara tushumi hisoboti', caption: 'Oylar kesimida tushum taqsimoti', icon: 'wallet' },
  { id: 'qr-03', title: 'Qarzdorlik detallashtirilgan', caption: 'Kunlar kesimida qarzdorlik', icon: 'warning' },
  { id: 'qr-04', title: 'Servis SLA detali', caption: 'Arizalar bajarilishi va muddatlar', icon: 'wrench' },
  { id: 'qr-05', title: 'Kommunal sarf hisoboti', caption: 'Elektr, suv va isitish sarfi', icon: 'meter' },
]

const EXPORT_FORMATS = ['DOCX', 'CSV']

const exportOpen = ref(false)
const exportTitle = ref('')
const exportFormat = ref('DOCX')
const lastExport = ref<{
  title: string
  format: string
  period: string
  scope: string
  fileName: string
} | null>(null)

function openExport(title: string, format: string) {
  exportTitle.value = title
  exportFormat.value = format
  exportOpen.value = true
}

/** Faylga ekrandagi jadvalning aynan o‘zi tushadi */
function exportTable(): Array<Array<string | number>> {
  return [
    ['Obyekt', 'Joylashuv', 'GLA, m²', 'Bandlik, %', 'Ijara tushumi, so‘m', 'Bo‘sh maydon, m²', 'SLA, %'],
    ...tableRows.value.map((r) => [r.name, r.district, r.gla, r.occupancy, r.revenue, r.vacantArea, r.sla]),
  ]
}

function exportDocument() {
  const t = totals.value
  return docxBlob([
    { text: exportTitle.value, style: 'title' },
    { text: `${scopeLabel.value} • ${periodLabel.value}`, style: 'subtitle' },
    { text: 'Asosiy ko‘rsatkichlar', style: 'heading' },
    { text: `Jami GLA: ${num(t.gla)} m²` },
    { text: `Bandlik darajasi: ${percent(t.occupancy)}` },
    { text: `Bo‘sh maydon: ${num(t.vacantArea)} m²` },
    { text: `Jami ijara tushumi: ${sumShort(t.revenue)}` },
    { text: `Qarzdorlik: ${sumShort(t.debt)}` },
    { text: `Servis SLA bajarilishi: ${percent(t.sla)}` },
    { text: 'Obyektlar kesimi', style: 'heading' },
    ...active.value.map((b) => ({
      text:
        `${b.name} (${b.city}, ${b.district}). GLA ${num(b.gla)} m², bandlik ${percent(b.occupancy)}, ` +
        `ijara tushumi ${sumShort(b.monthlyRevenue)}, bo‘sh maydon ${num(b.vacantArea)} m², SLA ${percent(b.sla)}.`,
    })),
    {
      text: `Hisobot ${t.count} ta obyekt bo‘yicha, ${periodLabel.value} davri uchun tayyorlandi.`,
      style: 'small',
    },
  ])
}

function confirmExport() {
  const csv = exportFormat.value === 'CSV'
  const fileName = `${fileSlug(exportTitle.value)}-${fromDate.value}-${toDate.value}.${csv ? 'csv' : 'docx'}`

  saveBlob(csv ? csvBlob(exportTable()) : exportDocument(), fileName)

  lastExport.value = {
    title: exportTitle.value,
    format: exportFormat.value,
    period: periodLabel.value,
    scope: scopeLabel.value,
    fileName,
  }
  exportOpen.value = false
}
</script>

<template>
  <AppTopbar
    title="Hisobotlar va analitika markazi"
    subtitle="Ma’lumotlarga asoslangan qarorlar va chuqur tahlillar"
    :breadcrumb="[{ label: 'Bosh sahifa', to: '/' }, { label: 'Hisobotlar' }]"
  >
    <template #actions>
      <UiButton size="sm" @click="openExport('Umumiy analitik hisobot', 'DOCX')">
        <UiIcon name="download" :size="16" />
        Eksport qilish
      </UiButton>
    </template>
  </AppTopbar>

  <main class="scroll-slim flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
    <UiCard title="Hisobot filtrlari" :subtitle="`Joriy tanlov: ${scopeLabel} • ${periodLabel}`">
      <div class="grid gap-4 lg:grid-cols-[repeat(3,minmax(0,1fr))_auto]">
        <UiField label="Sana oralig‘i" :error="rangeInvalid ? 'Tugash sanasi boshlanish sanasidan oldin' : ''">
          <div class="flex items-center gap-2">
            <UiInput v-model="draftFrom" type="date" :invalid="rangeInvalid" />
            <span class="text-ink-400">-</span>
            <UiInput v-model="draftTo" type="date" :invalid="rangeInvalid" />
          </div>
        </UiField>

        <UiField
          label="Obyektlar"
          :hint="`${draftBuildings.length} / ${scopedBuildings.length} ta belgilandi`"
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
                <UiIcon name="check" :size="15" />
                {{
                  draftBuildings.length === scopedBuildings.length
                    ? 'Belgilashni bekor qilish'
                    : 'Barchasini belgilash'
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
                  <span class="block truncate text-[13px] font-medium text-ink-800">{{ b.name }}</span>
                  <span class="block truncate text-[11.5px] text-ink-500">{{ b.type }}</span>
                </span>
              </label>
            </div>
          </div>
        </UiField>

        <UiField label="Bino turi">
          <UiSelect v-model="draftType" :options="TYPE_OPTIONS" />
        </UiField>

        <div class="flex items-end gap-2.5">
          <UiButton :disabled="rangeInvalid" @click="applyFilters">
            <UiIcon name="filter" :size="16" />
            Filtrlarni qo‘llash
          </UiButton>
          <UiButton variant="ghost" @click="resetFilters">Tozalash</UiButton>
        </div>
      </div>

      <p v-if="filterChanged" class="mt-3 flex items-center gap-2 text-[12.5px] font-medium text-warn-700">
        <UiIcon name="info" :size="15" />
        Filtrlar o‘zgartirildi: natijalarni yangilash uchun «Filtrlarni qo‘llash» tugmasini bosing.
      </p>
    </UiCard>

    <section class="flex flex-wrap items-center gap-4">
      <div class="flex items-center gap-3">
        <span class="text-[13px] font-semibold text-ink-700">Ko‘rinish rejimi:</span>
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
        class="flex min-w-0 flex-1 items-center gap-2 rounded-field bg-brand-50 px-3.5 py-2.5 text-[12.5px] text-brand-800"
      >
        <UiIcon name="info" :size="16" class="text-brand-600" />
        <span v-if="mode === 'portfolio'">
          Portfel rejimi: {{ scopeLabel }} bo‘yicha jamlangan ko‘rsatkichlar ko‘rsatilmoqda.
        </span>
        <span v-else>
          Bitta obyekt rejimi: faqat «{{ singleBuilding?.name }}» ma’lumotlari ko‘rsatilmoqda.
        </span>
      </p>
    </section>

    <div
      v-if="!totals.count"
      class="flex items-center gap-3 rounded-card bg-surface p-5 text-[13.5px] text-ink-600 shadow-card ring-1 ring-ink-200/60"
    >
      <UiIcon name="warning" :size="20" class="text-warn-500" />
      Tanlangan filtrlarga mos obyekt topilmadi. Filtrlarni kengaytiring yoki «Tozalash» tugmasini bosing.
    </div>

    <section v-else class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      <UiKpi
        label="Jami GLA"
        :value="num(totals.gla)"
        unit="m²"
        :delta="trendDelta('gla')"
        icon="building"
        tone="brand"
        :spark="trendSpark('gla', totals.gla / 1000)"
      />
      <UiKpi
        label="Bandlik darajasi"
        :value="percent(totals.occupancy)"
        :delta="trendDelta('occupancy')"
        icon="layers"
        tone="ok"
        :spark="trendSpark('occupancy', totals.occupancy)"
      />
      <UiKpi
        label="Bo‘sh maydon"
        :value="num(totals.vacantArea)"
        unit="m²"
        :delta="trendDelta('vacantArea')"
        invert
        icon="cube"
        tone="violet"
        :spark="trendSpark('vacantArea', totals.vacantArea / 1000)"
      />
      <UiKpi
        label="Jami ijara tushumi"
        :value="sumShort(totals.revenue)"
        :delta="trendDelta('revenue')"
        icon="wallet"
        tone="brand"
        :spark="trendSpark('revenue', totals.revenue / 1_000_000_000)"
      />
      <UiKpi
        label="Qarzdorlik"
        :value="sumShort(totals.debt)"
        :delta="trendDelta('debt')"
        invert
        icon="warning"
        tone="danger"
        :spark="trendSpark('debt', totals.debt / 1_000_000)"
      />
      <UiKpi
        label="Servis SLA bajarilishi"
        :value="percent(totals.sla)"
        :delta="trendDelta('sla')"
        icon="wrench"
        tone="ok"
        :spark="trendSpark('sla', totals.sla)"
      />
    </section>

    <UiCard
      title="Obyektlar kesimidagi hisobot"
      :subtitle="`${periodLabel} • qatorni bosib bitta obyekt rejimiga o‘ting`"
      flush
    >
      <template #actions>
        <UiButton variant="secondary" size="sm" @click="openExport('Obyektlar kesimidagi hisobot', 'CSV')">
          <UiIcon name="download" :size="15" />
          CSV
        </UiButton>
      </template>

      <UiTable
        :columns="tableColumns"
        :rows="tableRows"
        empty="Filtrga mos obyekt yo‘q"
        @row-click="onRowClick"
      >
        <template #cell-name="{ row }">
          <span class="block text-[13.5px]" :class="row.total ? 'font-bold text-ink-900' : 'font-semibold text-ink-900'">
            {{ row.name }}
          </span>
          <span class="block text-[12px] text-ink-500">{{ row.district }}</span>
        </template>

        <template #cell-gla="{ row }">
          <span :class="row.total ? 'font-bold text-ink-900' : ''">{{ num(row.gla) }}</span>
        </template>

        <template #cell-occupancy="{ row }">
          <span
            class="inline-flex items-center gap-1.5"
            :class="row.total ? 'font-bold text-ink-900' : ''"
          >
            <span
              class="size-2 rounded-full"
              :class="row.occupancy >= 90 ? 'bg-ok-500' : row.occupancy >= 84 ? 'bg-brand-500' : 'bg-warn-500'"
            />
            {{ percent(row.occupancy) }}
          </span>
        </template>

        <template #cell-revenue="{ row }">
          <span :class="row.total ? 'font-bold text-ink-900' : ''">{{ sumShort(row.revenue) }}</span>
        </template>

        <template #cell-vacantArea="{ row }">
          <span :class="row.total ? 'font-bold text-ink-900' : ''">{{ num(row.vacantArea) }}</span>
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

    <section class="grid gap-5 xl:grid-cols-2">
      <UiCard title="Bandlik va vacancy tahlili" subtitle="Band va bo‘sh maydon, m²">
        <UiBars :labels="months" :series="occupancySeries" stacked :height="220" unit="m²" />
      </UiCard>

      <UiCard title="Ijara tushumi dinamikasi" subtitle="Oylar kesimida, mlrd so‘m">
        <UiBars :labels="months" :series="revenueSeries" :height="220" unit="mlrd so‘m" />
      </UiCard>

      <UiCard title="Qarzdorlik tahlili" subtitle="Kunlar kesimida taqsimot, mln so‘m">
        <UiBars :labels="months" :series="debtSeries" stacked :height="220" unit="mln so‘m" />
      </UiCard>

      <UiCard title="Servis SLA" subtitle="Arizalar bajarilishi bo‘yicha ulush">
        <UiDonut
          :slices="slaSlices"
          :center-value="percent(totals.sla)"
          center-label="SLA bajarilishi"
          :size="176"
        />
      </UiCard>

      <UiCard title="Kommunal sarf tahlili" subtitle="Resurslar bo‘yicha sarf indeksi (birinchi oy = 100)">
        <UiLine :labels="months" :series="utilitySeries" :height="212" />
        <dl class="mt-4 grid grid-cols-2 gap-3 border-t border-ink-100 pt-4 sm:grid-cols-3">
          <div v-for="u in utilityBase" :key="u.label">
            <dt class="text-[12px] text-ink-500">{{ u.label }} ({{ u.unit }})</dt>
            <dd class="tabular mt-0.5 text-sm font-bold text-ink-900">{{ num(u.value) }}</dd>
          </div>
        </dl>
      </UiCard>

      <UiCard title="Asosiy ko‘rsatkichlar taqqoslamasi" subtitle="Bandlik, SLA va to‘lovlar yig‘ilishi, %">
        <UiLine :labels="months" :series="compareSeries" :height="212" />
      </UiCard>
    </section>

    <UiCard title="Tezkor hisobotlar" subtitle="Tayyor shablonlar bo‘yicha yuklab olish" flush>
      <p
        v-if="lastExport"
        class="mx-5 mb-3 flex items-start gap-2 rounded-field bg-ok-50 px-3.5 py-2.5 text-[12.5px] text-ok-700"
      >
        <UiIcon name="check" :size="16" class="mt-0.5 shrink-0" />
        <span>
          «{{ lastExport.title }}» ({{ lastExport.scope }}, {{ lastExport.period }})
          <span class="tabular font-semibold">{{ lastExport.fileName }}</span> nomi bilan yuklab olindi.
        </span>
      </p>

      <ul class="divide-y divide-ink-100">
        <li v-for="r in QUICK_REPORTS" :key="r.id" class="flex items-center gap-4 px-5 py-3.5">
          <span class="grid size-10 shrink-0 place-items-center rounded-[10px] bg-brand-50 text-brand-600">
            <UiIcon :name="r.icon" :size="18" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block truncate text-[13.5px] font-semibold text-ink-900">{{ r.title }}</span>
            <span class="block truncate text-[12px] text-ink-500">{{ r.caption }}</span>
          </span>
          <span class="flex shrink-0 gap-2">
            <UiButton variant="secondary" size="sm" @click="openExport(r.title, 'DOCX')">DOCX</UiButton>
            <UiButton variant="subtle" size="sm" @click="openExport(r.title, 'CSV')">CSV</UiButton>
          </span>
        </li>
      </ul>
    </UiCard>

    <UiModal
      v-model="exportOpen"
      title="Hisobotni eksport qilish"
      subtitle="Yuklab olishdan oldin hisobot parametrlarini tasdiqlang"
      size="sm"
    >
      <dl class="space-y-3 text-[13.5px]">
        <div class="flex items-start justify-between gap-4">
          <dt class="text-ink-500">Hisobot</dt>
          <dd class="text-right font-semibold text-ink-900">{{ exportTitle }}</dd>
        </div>
        <div class="flex items-start justify-between gap-4">
          <dt class="text-ink-500">Davr</dt>
          <dd class="tabular text-right font-semibold text-ink-900">{{ periodLabel }}</dd>
        </div>
        <div class="flex items-start justify-between gap-4">
          <dt class="text-ink-500">Qamrov</dt>
          <dd class="text-right font-semibold text-ink-900">{{ scopeLabel }}</dd>
        </div>
      </dl>

      <div class="mt-5">
        <p class="mb-2 text-[13px] font-semibold text-ink-700">Format</p>
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
            <UiIcon :name="exportFormat === f ? 'check' : 'doc'" :size="15" />
            {{ f }}
          </button>
        </div>
      </div>

      <template #footer>
        <UiButton variant="ghost" @click="exportOpen = false">Bekor qilish</UiButton>
        <UiButton @click="confirmExport">
          <UiIcon name="download" :size="16" />
          Yuklab olish
        </UiButton>
      </template>
    </UiModal>
  </main>
</template>
