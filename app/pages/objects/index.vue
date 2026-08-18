<script setup lang="ts">
import { OCCUPANCY_BANDS } from '~/constants/statuses'
import { BUILDINGS, type Building } from '~/data/buildings'
import { dateShort, num, percent, sum, todayIso } from '~/utils/format'
import { csvBlob, docxBlob, saveBlob } from '~/utils/docx'

const auth = useAuthStore()

/** Ro‘yxat, filtr variantlari, jamlar va eksport faqat biriktirilgan obyektlardan */
const scoped = computed(() => BUILDINGS.filter((b) => auth.inScope(b.id)))

/** Reyestrga yangi obyekt qo‘shish tizim ma’muriyati huquqiga bog‘liq */
const canCreate = computed(() => auth.can('system.administer'))

const search = ref('')
const typeFilter = ref('')
const statusFilter = ref('')
const cityFilter = ref('')
const districtFilter = ref('')
const classFilter = ref('')
const occupancyFilter = ref('')
const sortBy = ref('name')
const moreOpen = ref(false)
const page = ref(1)
const perPage = ref('10')
const notice = ref('')

const exportOpen = ref(false)
const exportFormat = ref('xlsx')
const exportScope = ref('filtered')

const createOpen = ref(false)
const createTouched = ref(false)

const uniq = (values: string[]) => Array.from(new Set(values))

const typeOptions = computed(() =>
  uniq(scoped.value.map((b) => b.type)).map((v) => ({ value: v, label: v })),
)
const cityOptions = computed(() =>
  uniq(scoped.value.map((b) => b.city)).map((v) => ({ value: v, label: v })),
)
const districtOptions = computed(() =>
  uniq(scoped.value.map((b) => b.district))
    .sort((a, b) => a.localeCompare(b))
    .map((v) => ({ value: v, label: v })),
)
const classOptions = computed(() =>
  uniq(scoped.value.map((b) => b.buildingClass)).map((v) => ({ value: v, label: v })),
)

const statusOptions = [
  { value: 'ACTIVE', label: 'Faol' },
  { value: 'ARCHIVED', label: 'Arxivlangan' },
]

const occupancyOptions = [
  { value: 'high', label: OCCUPANCY_BANDS[0]!.label },
  { value: 'mid', label: OCCUPANCY_BANDS[1]!.label },
  { value: 'low', label: OCCUPANCY_BANDS[2]!.label },
]

const sortOptions = [
  { value: 'name', label: 'Nomi (A–Z)' },
  { value: 'occupancy', label: 'Bandlik bo‘yicha' },
  { value: 'units', label: 'Unitlar soni bo‘yicha' },
  { value: 'vacant', label: 'Bo‘sh unitlar bo‘yicha' },
]

const perPageOptions = [
  { value: '10', label: '10' },
  { value: '25', label: '25' },
  { value: '50', label: '50' },
]

const exportFormats = [
  { value: 'csv', label: 'CSV jadval', hint: 'Excel va tashqi tizimlar uchun', icon: 'chart' },
  { value: 'docx', label: 'Word hujjat', hint: 'Chop etishga tayyor ko‘rinish', icon: 'doc' },
]

const createForm = reactive({
  name: '',
  type: '',
  city: '',
  district: '',
  street: '',
  buildingClass: '',
  floors: '',
  units: '',
  gla: '',
  manager: '',
  phone: '',
})

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()

  const list = scoped.value.filter((b) => {
    if (q) {
      const haystack = `${b.code} ${b.name} ${b.city} ${b.district} ${b.street} ${b.type}`.toLowerCase()
      if (!haystack.includes(q)) return false
    }
    if (typeFilter.value && b.type !== typeFilter.value) return false
    if (statusFilter.value && b.status !== statusFilter.value) return false
    if (cityFilter.value && b.city !== cityFilter.value) return false
    if (districtFilter.value && b.district !== districtFilter.value) return false
    if (classFilter.value && b.buildingClass !== classFilter.value) return false
    if (occupancyFilter.value === 'high' && b.occupancy < 90) return false
    if (occupancyFilter.value === 'mid' && (b.occupancy < 84 || b.occupancy > 89)) return false
    if (occupancyFilter.value === 'low' && b.occupancy >= 84) return false
    return true
  })

  return [...list].sort((a, b) => {
    if (sortBy.value === 'occupancy') return b.occupancy - a.occupancy
    if (sortBy.value === 'units') return b.units - a.units
    if (sortBy.value === 'vacant') return b.vacantUnits - a.vacantUnits
    return a.name.localeCompare(b.name)
  })
})

const totals = computed(() => ({
  units: filtered.value.reduce((s, b) => s + b.units, 0),
  occupied: filtered.value.reduce((s, b) => s + b.occupiedUnits, 0),
  vacant: filtered.value.reduce((s, b) => s + b.vacantUnits, 0),
}))

const perPageNum = computed(() => Number(perPage.value))
const pageCount = computed(() => Math.max(1, Math.ceil(filtered.value.length / perPageNum.value)))

const rows = computed(() => {
  const start = (page.value - 1) * perPageNum.value
  return filtered.value.slice(start, start + perPageNum.value).map((b) => ({
    id: b.id,
    code: b.code,
    name: b.name,
    photo: b.photo,
    meta: `${b.buildingClass} · ${b.buildYear}-yil`,
    address: `${b.city}, ${b.district}, ${b.street}`,
    type: b.type,
    floors: b.floors,
    units: b.units,
    occupiedUnits: b.occupiedUnits,
    vacantUnits: b.vacantUnits,
    status: b.status,
  }))
})

const rangeLabel = computed(() => {
  if (!filtered.value.length) return '0'
  const start = (page.value - 1) * perPageNum.value + 1
  const end = Math.min(page.value * perPageNum.value, filtered.value.length)
  return `${start}–${end}`
})

const activeFilters = computed(
  () =>
    [
      search.value,
      typeFilter.value,
      statusFilter.value,
      cityFilter.value,
      districtFilter.value,
      classFilter.value,
      occupancyFilter.value,
    ].filter(Boolean).length,
)

watch(
  [
    search,
    typeFilter,
    statusFilter,
    cityFilter,
    districtFilter,
    classFilter,
    occupancyFilter,
    perPage,
  ],
  () => {
    page.value = 1
  },
)

watch(pageCount, (count) => {
  if (page.value > count) page.value = count
})

const columns = [
  { key: 'code', label: 'ID', width: '116px' },
  { key: 'name', label: 'Bino nomi', width: '260px' },
  { key: 'address', label: 'Manzil' },
  { key: 'type', label: 'Turi' },
  { key: 'floors', label: 'Qavatlar', align: 'right' as const, numeric: true },
  { key: 'units', label: 'Unitlar', align: 'right' as const, numeric: true },
  { key: 'occupiedUnits', label: 'Band unitlar', align: 'right' as const, numeric: true },
  { key: 'vacantUnits', label: 'Bo‘sh unitlar', align: 'right' as const, numeric: true },
  { key: 'status', label: 'Holat', align: 'center' as const, width: '120px' },
]

function objectPath(row: Record<string, unknown>) {
  return `/objects/${row.id}`
}

function resetFilters() {
  search.value = ''
  typeFilter.value = ''
  statusFilter.value = ''
  cityFilter.value = ''
  districtFilter.value = ''
  classFilter.value = ''
  occupancyFilter.value = ''
  page.value = 1
}

function goToPage(target: number) {
  page.value = Math.min(Math.max(target, 1), pageCount.value)
}

/** Reyestr haqiqiy fayl bo‘lib saqlanadi, ustunlar jadvaldagidek */
function submitExport() {
  const rows = exportScope.value === 'filtered' ? filtered.value : scoped.value
  const name = `obyektlar-reyestri-${todayIso()}.${exportFormat.value}`

  if (exportFormat.value === 'csv') {
    saveBlob(
      csvBlob([
        ['ID', 'Bino nomi', 'Manzil', 'Turi', 'Qavatlar', 'Unitlar', 'Band', 'Bo‘sh', 'Bandlik, %', 'GLA, m²', 'Oylik tushum, so‘m'],
        ...rows.map((b) => [
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
        ]),
      ]),
      name,
    )
  } else {
    saveBlob(
      docxBlob([
        { text: 'Obyektlar reyestri', style: 'title' },
        { text: `${rows.length} ta obyekt · ${dateShort(todayIso())}`, style: 'subtitle' },
        ...rows.map((b) => ({
          text: `${b.code} · ${b.name} · ${b.city}, ${b.district}, ${b.street} · ${b.type} · ${b.floors} qavat · ${b.units} unit (band ${b.occupiedUnits}, bo‘sh ${b.vacantUnits}) · bandlik ${percent(b.occupancy)} · oylik tushum ${sum(b.monthlyRevenue)}`,
          style: 'body' as const,
        })),
      ]),
      name,
    )
  }

  notice.value = `${name} yuklab olindi, ${num(rows.length)} ta obyekt.`
  exportOpen.value = false
}

const toNum = (value: string) => Math.max(0, Math.round(Number(value) || 0))

/** Yangi yozuv uchun keyingi bo‘sh identifikator va reyestr raqami */
function nextIdentity() {
  const last = BUILDINGS.reduce((max, b) => Math.max(max, Number(b.id.replace(/[^0-9]/g, '')) || 0), 0)
  const next = last + 1
  return {
    id: `b-${String(next).padStart(2, '0')}`,
    code: `BIN-${String(next).padStart(4, '0')}`,
    order: next,
  }
}

function slugOf(name: string, order: number) {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || `obyekt-${order}`
  return BUILDINGS.some((b) => b.slug === base) ? `${base}-${order}` : base
}

function submitCreate() {
  if (!canCreate.value) return
  createTouched.value = true
  if (!createForm.name.trim() || !createForm.type || !createForm.city) return

  const { id, code, order } = nextIdentity()
  const name = createForm.name.trim()
  const units = toNum(createForm.units)
  const gla = toNum(createForm.gla)

  const created: Building = {
    id,
    code,
    name,
    slug: slugOf(name, order),
    type: createForm.type as Building['type'],
    city: createForm.city,
    district: createForm.district.trim(),
    street: createForm.street.trim(),
    buildYear: new Date().getFullYear(),
    buildingClass: createForm.buildingClass || 'B klass',
    floors: toNum(createForm.floors),
    undergroundFloors: 0,
    units,
    occupiedUnits: 0,
    vacantUnits: units,
    gla,
    vacantArea: gla,
    occupancy: 0,
    monthlyRevenue: 0,
    debt: 0,
    sla: 100,
    serviceRequests: 0,
    lat: 41.3111,
    lon: 69.2797,
    photo: '',
    gallery: [],
    manager: createForm.manager.trim(),
    managerPhone: createForm.phone.trim(),
    status: 'ACTIVE',
    amenities: [],
    equipment: [],
  }

  BUILDINGS.unshift(created)

  notice.value = `«${name}» obyekti reyestrga qo‘shildi, ID: ${code}.`
  createOpen.value = false
  createTouched.value = false
  Object.assign(createForm, {
    name: '',
    type: '',
    city: '',
    district: '',
    street: '',
    buildingClass: '',
    floors: '',
    units: '',
    gla: '',
    manager: '',
    phone: '',
  })
}
</script>

<template>
  <AppTopbar
    title="Obyektlar reyestri"
    subtitle="Bino, blok, qavat va unitlar bo‘yicha yagona ma’lumotlar bazasi"
  >
    <template #actions>
      <UiButton variant="secondary" size="sm" @click="exportOpen = true">
        <UiIcon name="download" :size="16" />
        Eksport
      </UiButton>
      <UiButton v-if="canCreate" size="sm" @click="createOpen = true">
        <UiIcon name="plus" :size="16" />
        Yangi obyekt
      </UiButton>
      <span
        v-else
        class="inline-flex items-center gap-2 rounded-pill bg-ink-100 px-3 py-1.5 text-[12px] font-semibold text-ink-600"
      >
        <UiIcon name="eye" :size="15" />
        Faqat ko‘rish huquqi
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
        aria-label="Xabarnomani yopish"
        @click="notice = ''"
      >
        <UiIcon name="x" :size="15" />
      </button>
    </div>

    <UiCard
      title="Obyektlar bazasi"
      subtitle="Qidiruv, filtr va bino pasportiga tezkor o‘tish"
      flush
      :padded="false"
    >
      <template #actions>
        <div class="flex items-center gap-2">
          <span class="hidden text-[12px] text-ink-500 sm:inline">Saralash</span>
          <UiSelect v-model="sortBy" :options="sortOptions" size="sm" class="w-48" />
        </div>
      </template>

      <div class="flex flex-wrap items-center gap-3 px-5 pb-4">
        <UiInput
          v-model="search"
          placeholder="Qidiruv (nomi, manzil, ID...)"
          class="min-w-[240px] flex-1"
        >
          <template #prefix>
            <UiIcon name="search" :size="17" />
          </template>
        </UiInput>

        <UiSelect v-model="typeFilter" :options="typeOptions" placeholder="Turi" class="w-44" />
        <UiSelect
          v-model="statusFilter"
          :options="statusOptions"
          placeholder="Holati"
          class="w-40"
        />
        <UiSelect v-model="cityFilter" :options="cityOptions" placeholder="Shahar" class="w-48" />

        <UiButton variant="secondary" @click="moreOpen = !moreOpen">
          <UiIcon name="filter" :size="16" />
          Ko‘proq filter
          <UiIcon name="chevronDown" :size="14" :class="moreOpen ? '' : '-rotate-90'" />
        </UiButton>
      </div>

      <div
        v-if="moreOpen"
        class="flex flex-wrap items-end gap-3 border-t border-ink-100 bg-surface-sunken px-5 py-4"
      >
        <UiField label="Tuman" class="w-56">
          <UiSelect
            v-model="districtFilter"
            :options="districtOptions"
            placeholder="Barchasi"
            size="sm"
          />
        </UiField>
        <UiField label="Bino klassi" class="w-44">
          <UiSelect
            v-model="classFilter"
            :options="classOptions"
            placeholder="Barchasi"
            size="sm"
          />
        </UiField>
        <UiField label="Bandlik darajasi" class="w-48">
          <UiSelect
            v-model="occupancyFilter"
            :options="occupancyOptions"
            placeholder="Barchasi"
            size="sm"
          />
        </UiField>
        <UiButton variant="ghost" size="sm" :disabled="!activeFilters" @click="resetFilters">
          <UiIcon name="refresh" :size="15" />
          Filtrlarni tozalash
        </UiButton>
        <span v-if="activeFilters" class="text-[12px] text-ink-500">
          Faol filtrlar: {{ activeFilters }} ta
        </span>
      </div>

      <UiTable
        :columns="columns"
        :rows="rows"
        :to="objectPath"
        :empty="
          scoped.length
            ? 'Filtr shartlariga mos obyekt topilmadi'
            : 'Sizga biriktirilgan obyekt yo‘q'
        "
      >
        <template #cell-code="{ row }">
          <span class="tabular text-[13px] font-semibold text-ink-700">{{ row.code }}</span>
        </template>

        <template #cell-name="{ row }">
          <span class="flex items-center gap-3">
            <UiPhoto
              :name="String(row.photo)"
              :alt="String(row.name)"
              ratio="aspect-square"
              rounded="rounded-[9px]"
              sizes="56px"
              class="size-11 shrink-0"
            />
            <span class="min-w-0">
              <span class="block truncate text-[13.5px] font-semibold text-brand-600">
                {{ row.name }}
              </span>
              <span class="block truncate text-[12px] text-ink-500">{{ row.meta }}</span>
            </span>
          </span>
        </template>

        <template #cell-address="{ row }">
          <span class="block max-w-[280px] text-[13px] leading-snug text-ink-600">
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
          <span class="tabular font-semibold text-ok-600">{{ row.occupiedUnits }}</span>
        </template>

        <template #cell-vacantUnits="{ row }">
          <span class="tabular font-semibold text-warn-600">{{ row.vacantUnits }}</span>
        </template>

        <template #cell-status="{ row }">
          <UiStatus
            :kind="row.status === 'ACTIVE' ? 'contract' : 'unit'"
            :value="row.status === 'ACTIVE' ? 'ACTIVE' : 'ARCHIVED'"
            size="sm"
          />
        </template>
      </UiTable>

      <div
        class="flex flex-wrap items-center justify-between gap-4 border-t border-ink-100 px-5 py-4"
      >
        <p class="text-[13px] text-ink-500">
          Jami:
          <b class="text-ink-800">{{ filtered.length }}</b> ta obyekt ·
          <span class="tabular">{{ num(totals.units) }}</span> unit ·
          <span class="tabular text-ok-600">{{ num(totals.occupied) }}</span> band ·
          <span class="tabular text-warn-600">{{ num(totals.vacant) }}</span> bo‘sh
          <span class="text-ink-400">, ko‘rsatilmoqda {{ rangeLabel }}</span>
        </p>

        <div class="flex items-center gap-4">
          <div class="flex items-center gap-1.5">
            <button
              type="button"
              class="grid size-11 place-items-center rounded-[8px] text-ink-500 ring-1 ring-inset ring-ink-200 transition-colors hover:bg-ink-100 hover:text-ink-800 disabled:cursor-not-allowed disabled:opacity-40 md:size-9"
              aria-label="Oldingi sahifa"
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
              aria-label="Keyingi sahifa"
              :disabled="page >= pageCount"
              @click="goToPage(page + 1)"
            >
              <UiIcon name="chevronRight" :size="16" />
            </button>
          </div>

          <div class="flex items-center gap-2">
            <span class="text-[12px] text-ink-500">Sahifada</span>
            <UiSelect v-model="perPage" :options="perPageOptions" size="sm" class="w-20" />
          </div>
        </div>
      </div>
    </UiCard>

    <UiCard title="Ierarxik tuzilma" subtitle="Bino → Blok → Qavat → Unit bo‘yicha tuzilma saqlanadi">
      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div
          v-for="(step, i) in [
            { title: 'Bino', text: 'Obyekt pasporti, qavatlar va umumiy ko‘rsatkichlar', icon: 'building' },
            { title: 'Blok', text: 'Bino ichidagi bloklar va ularning maydonlari', icon: 'layers' },
            { title: 'Qavat', text: '3D navigator va qavat sketch-rejasi', icon: 'cube' },
            { title: 'Unit', text: 'Unit kartasi, holati, ijarachi va shartnomasi', icon: 'box' },
          ]"
          :key="step.title"
          class="rounded-field p-4 ring-1 ring-ink-200"
        >
          <div class="flex items-center gap-2.5">
            <span class="grid size-9 place-items-center rounded-[9px] bg-brand-50 text-brand-600">
              <UiIcon :name="step.icon" :size="18" />
            </span>
            <span class="text-[13.5px] font-bold text-ink-900">{{ step.title }}</span>
            <span class="tabular ml-auto text-[12px] font-semibold text-ink-400">
              0{{ i + 1 }}
            </span>
          </div>
          <p class="mt-2.5 text-[12.5px] leading-snug text-ink-500">{{ step.text }}</p>
        </div>
      </div>
    </UiCard>

    <UiModal
      v-model="exportOpen"
      title="Reyestrni eksport qilish"
      subtitle="Format va qamrovni tanlang"
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
            class="grid size-10 shrink-0 place-items-center rounded-[10px]"
            :class="exportFormat === f.value ? 'bg-brand-500 text-white' : 'bg-ink-100 text-ink-500'"
          >
            <UiIcon :name="f.icon" :size="18" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block text-[13.5px] font-semibold text-ink-900">{{ f.label }}</span>
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
        <p class="mb-2 text-[13px] font-semibold text-ink-700">Qamrov</p>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="s in [
              { value: 'filtered', label: `Filtrlangan yozuvlar (${filtered.length})` },
              { value: 'all', label: `Barcha obyektlar (${scoped.length})` },
            ]"
            :key="s.value"
            type="button"
            class="rounded-pill px-3.5 py-1.5 text-[12.5px] font-semibold ring-1 ring-inset transition-colors"
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
        <UiButton variant="ghost" @click="exportOpen = false">Bekor qilish</UiButton>
        <UiButton @click="submitExport">
          <UiIcon name="download" :size="16" />
          Yuklab olish
        </UiButton>
      </template>
    </UiModal>

    <UiModal
      v-if="canCreate"
      v-model="createOpen"
      title="Yangi obyekt"
      subtitle="Obyekt pasporti uchun asosiy ma’lumotlarni kiriting"
      size="lg"
    >
      <div class="grid gap-4 sm:grid-cols-2">
        <UiField
          label="Bino nomi"
          required
          class="sm:col-span-2"
          :error="createTouched && !createForm.name.trim() ? 'Bino nomini kiriting' : ''"
        >
          <UiInput
            v-model="createForm.name"
            placeholder="Obyekt nomi"
            :invalid="createTouched && !createForm.name.trim()"
          />
        </UiField>

        <UiField
          label="Turi"
          required
          :error="createTouched && !createForm.type ? 'Obyekt turini tanlang' : ''"
        >
          <UiSelect
            v-model="createForm.type"
            :options="typeOptions"
            placeholder="Tanlang"
            :invalid="createTouched && !createForm.type"
          />
        </UiField>

        <UiField
          label="Shahar / viloyat"
          required
          :error="createTouched && !createForm.city ? 'Shaharni tanlang' : ''"
        >
          <UiSelect
            v-model="createForm.city"
            :options="cityOptions"
            placeholder="Tanlang"
            :invalid="createTouched && !createForm.city"
          />
        </UiField>

        <UiField label="Tuman">
          <UiInput v-model="createForm.district" placeholder="Tuman nomi" />
        </UiField>

        <UiField label="Ko‘cha va uy raqami">
          <UiInput v-model="createForm.street" placeholder="Ko‘cha, uy" />
        </UiField>

        <UiField label="Bino klassi">
          <UiSelect
            v-model="createForm.buildingClass"
            :options="classOptions"
            placeholder="Tanlang"
          />
        </UiField>

        <UiField label="Qavatlar soni">
          <UiInput v-model="createForm.floors" type="number" placeholder="0" />
        </UiField>

        <UiField label="Unitlar soni">
          <UiInput v-model="createForm.units" type="number" placeholder="0" />
        </UiField>

        <UiField label="Umumiy maydon" hint="Ijaraga beriladigan maydon, m²">
          <UiInput v-model="createForm.gla" type="number" placeholder="0">
            <template #suffix>
              <span class="text-[12px]">m²</span>
            </template>
          </UiInput>
        </UiField>

        <UiField label="Mas’ul rahbar">
          <UiInput v-model="createForm.manager" placeholder="F.I.Sh." />
        </UiField>

        <UiField label="Telefon">
          <UiInput v-model="createForm.phone" placeholder="+998 90 000 00 00" />
        </UiField>
      </div>

      <template #footer>
        <UiButton variant="ghost" @click="createOpen = false">Bekor qilish</UiButton>
        <UiButton @click="submitCreate">
          <UiIcon name="check" :size="16" />
          Saqlash
        </UiButton>
      </template>
    </UiModal>
  </main>
</template>
