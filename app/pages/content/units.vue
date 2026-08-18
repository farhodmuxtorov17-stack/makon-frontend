<script setup lang="ts">
import { BUILDINGS } from '~/data/buildings'
import { UNITS, type Unit } from '~/data/units'
import { UNIT_STATUS } from '~/constants/statuses'
import { area, num, percent } from '~/utils/format'

type UnitRow = {
  id: string
  code: string
  buildingId: string
  buildingName: string
  floor: number
  floorName: string
  area: number
  usage: string
  status: string
  hasPlan: boolean
  pct: number
  missing: string
}

const auth = useAuthStore()
const route = useRoute()

const canEdit = computed(() => auth.can('unit.editContent'))
const scoped = computed(() => BUILDINGS.filter((b) => auth.inScope(b.id)))

const USAGE_OPTIONS = [
  { value: 'Ofis', label: 'Ofis' },
  { value: 'Savdo', label: 'Savdo' },
  { value: 'Ombor', label: 'Ombor' },
  { value: 'Turar joy', label: 'Turar joy' },
  { value: 'Texnik zona', label: 'Texnik zona' },
]

const OFFER_OPTIONS = [
  { value: 'Ijara', label: 'Ijara' },
  { value: 'Sotuv', label: 'Sotuv' },
  { value: 'Ikkalasi', label: 'Ikkalasi' },
]

const STATUS_KEYS = ['DRAFT', 'VACANT', 'RESERVED', 'RENTED', 'SOLD', 'MAINTENANCE', 'HIDDEN']
const STATUS_OPTIONS = STATUS_KEYS.map((value) => ({
  value,
  label: UNIT_STATUS[value]?.label ?? value,
}))

const EQUIPMENT_LIBRARY = [
  'Konditsioner',
  'Yong‘in datchigi',
  'Internet chiqishi',
  'Serverxona',
  'Alohida sanuzel',
  'Oshxona',
  'Yuk platformasi',
]

const CHECKS: Array<{ key: string; label: string; ok: (u: Unit) => boolean }> = [
  { key: 'code', label: 'Unit kodi', ok: (u) => Boolean(u.code.trim()) },
  { key: 'rooms', label: 'Xonalar soni', ok: (u) => u.rooms > 0 },
  { key: 'area', label: 'Maydoni', ok: (u) => u.area > 0 },
  { key: 'usage', label: 'Foydalanish turi', ok: (u) => Boolean(u.usage) },
  { key: 'offer', label: 'Taklif turi', ok: (u) => Boolean(u.offer) },
  { key: 'status', label: 'Holati', ok: (u) => Boolean(u.status) && u.status !== 'DRAFT' },
  { key: 'equipment', label: 'Jihozlar ro‘yxati', ok: (u) => u.equipment.length > 0 },
  { key: 'polygon', label: '2D poligon', ok: (u) => u.polygon.length >= 3 },
]

/**
 * Sahifa umumiy unit reyestrini tahrirlaydi, nusxasini emas: saqlangan
 * atribut obyekt kartasida, katalogda, qavat rejasida va 3D ko‘rinishda
 * darhol o‘zgaradi va sahifa almashganda ham saqlanib qoladi.
 */
const units = computed(() => UNITS.filter((u) => auth.inScope(u.buildingId)))

function floorName(value: number) {
  return value === 0 ? 'Yer osti · texnik' : `${value}-qavat`
}

function passedChecks(u: Unit) {
  return CHECKS.filter((c) => c.ok(u))
}

function completeness(u: Unit) {
  return Math.round((passedChecks(u).length / CHECKS.length) * 100)
}

function buildingName(id: string) {
  return BUILDINGS.find((b) => b.id === id)?.name ?? id
}

const initialBuilding = String(route.query.building ?? '')
const initialFloor = String(route.query.floor ?? '')

const query = ref('')
const fBuilding = ref(
  scoped.value.some((b) => b.id === initialBuilding) ? initialBuilding : 'all',
)
const fFloor = ref(
  units.value.some((u) => String(u.floor) === initialFloor) ? initialFloor : 'all',
)
const fState = ref('all')

const selectedIds = ref<string[]>([])
const panelId = ref('')
const bulkOpen = ref(false)
const bulkStatus = ref('VACANT')
const notice = ref('')
const formError = ref('')
const equipInput = ref('')

const rows = computed<UnitRow[]>(() =>
  units.value.map((u) => {
    const missing = CHECKS.filter((c) => !c.ok(u)).map((c) => c.label)
    return {
      id: u.id,
      code: u.code,
      buildingId: u.buildingId,
      buildingName: buildingName(u.buildingId),
      floor: u.floor,
      floorName: floorName(u.floor),
      area: u.area,
      usage: u.usage,
      status: u.status,
      hasPlan: u.polygon.length >= 3,
      pct: completeness(u),
      missing: missing.join(', '),
    }
  }),
)

const buildingOptions = computed(() => [
  { value: 'all', label: 'Barcha binolar' },
  ...scoped.value.map((b) => ({ value: b.id, label: b.name })),
])

const floorOptions = computed(() => {
  const list = units.value.filter(
    (u) => fBuilding.value === 'all' || u.buildingId === fBuilding.value,
  )
  const levels = Array.from(new Set(list.map((u) => u.floor))).sort((a, b) => b - a)
  return [
    { value: 'all', label: 'Barcha qavatlar' },
    ...levels.map((l) => ({ value: String(l), label: floorName(l) })),
  ]
})

const stateOptions = computed(() => {
  const done = rows.value.filter((r) => r.pct === 100).length
  return [
    { value: 'all', label: `Barchasi (${rows.value.length})` },
    { value: 'done', label: `To‘liq (${done})` },
    { value: 'incomplete', label: `To‘liq emas (${rows.value.length - done})` },
  ]
})

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()

  return rows.value.filter((r) => {
    if (fBuilding.value !== 'all' && r.buildingId !== fBuilding.value) return false
    if (fFloor.value !== 'all' && String(r.floor) !== fFloor.value) return false
    if (fState.value === 'done' && r.pct !== 100) return false
    if (fState.value === 'incomplete' && r.pct === 100) return false
    if (q) {
      const haystack = `${r.code} ${r.buildingName} ${r.floorName} ${r.usage}`.toLowerCase()
      if (!haystack.includes(q)) return false
    }
    return true
  })
})

watch([fBuilding, fFloor, fState, query], () => {
  const visible = new Set(filtered.value.map((r) => r.id))
  selectedIds.value = selectedIds.value.filter((id) => visible.has(id))
})

watch(fBuilding, () => {
  if (!floorOptions.value.some((o) => o.value === fFloor.value)) fFloor.value = 'all'
})

const kpi = computed(() => {
  const list = rows.value
  const withPlan = list.filter((r) => r.hasPlan).length
  const full = list.filter((r) => r.pct === 100).length
  const avg = list.length ? Math.round(list.reduce((s, r) => s + r.pct, 0) / list.length) : 0
  return { total: list.length, withPlan, full, avg }
})

const dirty = computed(
  () =>
    Boolean(query.value.trim()) ||
    fBuilding.value !== 'all' ||
    fFloor.value !== 'all' ||
    fState.value !== 'all',
)

const allVisibleSelected = computed(
  () => filtered.value.length > 0 && filtered.value.every((r) => selectedIds.value.includes(r.id)),
)

const columns = computed(() => {
  const base = [
    { key: 'code', label: 'Kodi', width: '110px' },
    { key: 'buildingName', label: 'Bino', width: '210px' },
    { key: 'floorName', label: 'Qavat', width: '140px' },
    { key: 'area', label: 'Maydoni', align: 'right' as const, numeric: true, width: '130px' },
    { key: 'usage', label: 'Foydalanish', width: '140px' },
    { key: 'status', label: 'Holati', width: '150px' },
    { key: 'hasPlan', label: 'Poligon', width: '120px' },
    { key: 'pct', label: 'Atribut to‘liqligi', width: '200px' },
  ]
  return canEdit.value
    ? [{ key: 'sel', label: 'Tanlov', align: 'center' as const, width: '72px' }, ...base]
    : base
})

const panelUnit = computed(() => units.value.find((u) => u.id === panelId.value))

const form = reactive({
  code: '',
  rooms: '',
  area: '',
  usage: '',
  offer: '',
  status: '',
})

const equipment = ref<string[]>([])

function fillForm() {
  const u = panelUnit.value
  formError.value = ''
  equipInput.value = ''
  if (!u) return
  Object.assign(form, {
    code: u.code,
    rooms: String(u.rooms),
    area: String(u.area),
    usage: u.usage,
    offer: u.offer,
    status: u.status,
  })
  equipment.value = [...u.equipment]
}

function openUnit(id: string) {
  panelId.value = id
  fillForm()
}

function openPanel(row: UnitRow) {
  openUnit(row.id)
}

function closePanel() {
  panelId.value = ''
}

onKeyStroke('Escape', () => {
  if (panelId.value) panelId.value = ''
})

const panelShapes = computed(() => {
  const u = panelUnit.value
  if (!u) return []
  return units.value
    .filter((x) => x.buildingId === u.buildingId && x.floor === u.floor)
    .map((x) => ({
      id: x.id,
      code: x.code,
      active: x.id === u.id,
      points: x.polygon
        .map((p) => `${((p[0] ?? 0) * 100).toFixed(2)},${((p[1] ?? 0) * 100).toFixed(2)}`)
        .join(' '),
    }))
})

const panelChecks = computed(() => {
  const u = panelUnit.value
  if (!u) return []
  return CHECKS.map((c) => ({ key: c.key, label: c.label, done: c.ok(u) }))
})

function toggleSelect(id: string) {
  selectedIds.value = selectedIds.value.includes(id)
    ? selectedIds.value.filter((x) => x !== id)
    : [...selectedIds.value, id]
}

function toggleAllVisible() {
  if (allVisibleSelected.value) {
    const visible = new Set(filtered.value.map((r) => r.id))
    selectedIds.value = selectedIds.value.filter((id) => !visible.has(id))
    return
  }
  const merged = new Set(selectedIds.value)
  filtered.value.forEach((r) => merged.add(r.id))
  selectedIds.value = Array.from(merged)
}

function addEquipment(value?: string) {
  const name = (value ?? equipInput.value).trim()
  if (!name || equipment.value.includes(name)) {
    equipInput.value = ''
    return
  }
  equipment.value = [...equipment.value, name]
  equipInput.value = ''
}

function removeEquipment(name: string) {
  equipment.value = equipment.value.filter((e) => e !== name)
}

function saveUnit() {
  const u = panelUnit.value
  if (!canEdit.value || !u) return

  const code = form.code.trim()
  const areaValue = Number(form.area)
  const roomsValue = Number(form.rooms)

  if (!code) {
    formError.value = 'Unit kodi kiritilishi shart'
    return
  }
  if (!Number.isFinite(areaValue) || areaValue <= 0) {
    formError.value = 'Maydon musbat son bo‘lishi kerak'
    return
  }

  // Qiymatlar tanlov ro‘yxatlaridan keladi, shuning uchun tur aniqlashtiriladi
  u.code = code
  u.rooms = Number.isFinite(roomsValue) ? Math.max(0, Math.round(roomsValue)) : 0
  u.area = Math.round(areaValue * 100) / 100
  u.usage = form.usage as Unit['usage']
  u.offer = form.offer as Unit['offer']
  u.status = (form.status || 'DRAFT') as Unit['status']
  u.equipment = [...equipment.value]

  formError.value = ''
  notice.value = `«${u.code}» uniti yangilandi, atribut to‘liqligi ${percent(completeness(u))}.`
}

function applyBulk() {
  if (!canEdit.value) return
  const label = UNIT_STATUS[bulkStatus.value]?.label ?? bulkStatus.value
  const count = selectedIds.value.length
  units.value.forEach((u) => {
    if (selectedIds.value.includes(u.id)) u.status = bulkStatus.value as Unit['status']
  })
  notice.value = `${count} ta unit «${label}» holatiga o‘tkazildi.`
  selectedIds.value = []
  bulkOpen.value = false
}

function resetFilters() {
  query.value = ''
  fBuilding.value = 'all'
  fFloor.value = 'all'
  fState.value = 'all'
}

function toneOf(pct: number) {
  if (pct === 100) return 'bg-ok-500'
  if (pct >= 60) return 'bg-warn-500'
  return 'bg-danger-500'
}
</script>

<template>
  <AppTopbar
    title="Unit atributlari"
    subtitle="Unitlar bo‘yicha atribut va status ma’lumotlarini to‘ldirish"
    :breadcrumb="[{ label: 'Kontent navbati', to: '/content' }, { label: 'Unit atributlari' }]"
  >
    <template #actions>
      <UiButton variant="secondary" size="sm" to="/content/floors">
        <UiIcon name="layers" :size="16" />
        Qavat rejalari
      </UiButton>
      <UiButton
        v-if="canEdit"
        size="sm"
        :disabled="!selectedIds.length"
        @click="bulkOpen = true"
      >
        <UiIcon name="check" :size="16" />
        Tanlanganlarni belgilash
        <span v-if="selectedIds.length" class="tabular">({{ selectedIds.length }})</span>
      </UiButton>
    </template>
  </AppTopbar>

  <main class="scroll-slim flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
    <div
      v-if="notice"
      class="flex items-start gap-3 rounded-card bg-ok-50 px-4 py-3.5 ring-1 ring-inset ring-ok-100"
    >
      <UiIcon name="check" :size="18" class="mt-0.5 shrink-0 text-ok-600" />
      <p class="min-w-0 flex-1 text-[13px] font-medium text-ok-700">{{ notice }}</p>
      <button
        type="button"
        class="shrink-0 rounded-[8px] p-1 text-ok-600 transition-colors hover:bg-ok-100"
        aria-label="Xabarnomani yopish"
        @click="notice = ''"
      >
        <UiIcon name="x" :size="15" />
      </button>
    </div>

    <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <UiKpi label="Ko‘rish sohasidagi unitlar" :value="num(kpi.total)" unit="ta" icon="box" tone="brand" />
      <UiKpi label="Poligonga bog‘langan" :value="num(kpi.withPlan)" unit="ta" icon="layers" tone="violet" />
      <UiKpi label="Atributi to‘liq" :value="num(kpi.full)" unit="ta" icon="check" tone="ok" />
      <UiKpi label="O‘rtacha to‘liqlik" :value="percent(kpi.avg)" icon="chart" tone="warn" />
    </section>

    <UiCard
      title="Unitlar jadvali"
      subtitle="Qatorni bosing: yon panelda atributlar tahrirlanadi"
      flush
      :padded="false"
    >
      <template #actions>
        <span class="tabular hidden text-[12px] text-ink-500 sm:inline">
          {{ filtered.length }} / {{ kpi.total }}
        </span>
      </template>

      <div class="flex flex-wrap items-center gap-3 px-4 pb-4 lg:px-5">
        <UiInput v-model="query" placeholder="Qidiruv (kod, bino, qavat)" class="min-w-[190px] flex-1">
          <template #prefix>
            <UiIcon name="search" :size="17" />
          </template>
        </UiInput>

        <UiSelect v-model="fBuilding" :options="buildingOptions" class="w-full sm:w-52" />
        <UiSelect v-model="fFloor" :options="floorOptions" class="w-full sm:w-44" />
        <UiSelect v-model="fState" :options="stateOptions" class="w-full sm:w-48" />

        <UiButton variant="ghost" :disabled="!dirty" @click="resetFilters">
          <UiIcon name="refresh" :size="15" />
          Tozalash
        </UiButton>
      </div>

      <div
        v-if="canEdit"
        class="flex flex-wrap items-center gap-3 border-t border-ink-100 bg-surface-sunken px-4 py-3 lg:px-5"
      >
        <UiButton variant="secondary" size="sm" :disabled="!filtered.length" @click="toggleAllVisible">
          <UiIcon :name="allVisibleSelected ? 'x' : 'check'" :size="15" />
          {{ allVisibleSelected ? 'Tanlovni bekor qilish' : 'Ko‘rinayotganlarni tanlash' }}
        </UiButton>
        <span class="text-[12.5px] text-ink-500">
          Tanlangan: <b class="tabular text-ink-800">{{ selectedIds.length }}</b> ta unit
        </span>
        <UiButton
          v-if="selectedIds.length"
          size="sm"
          class="ml-auto"
          @click="bulkOpen = true"
        >
          <UiIcon name="check" :size="15" />
          Holatni belgilash
        </UiButton>
      </div>

      <UiTable
        :columns="columns"
        :rows="filtered"
        empty="Filtr shartlariga mos unit topilmadi"
        @row-click="openPanel"
      >
        <template #cell-sel="{ row }">
          <span class="inline-flex p-1" @click.stop>
            <input
              type="checkbox"
              class="size-4 cursor-pointer accent-brand-500"
              :checked="selectedIds.includes(row.id)"
              :aria-label="`${row.code} unitini tanlash`"
              @change="toggleSelect(row.id)"
            />
          </span>
        </template>

        <template #cell-code="{ row }">
          <span class="tabular text-[13px] font-bold text-brand-600">{{ row.code }}</span>
        </template>

        <template #cell-buildingName="{ row }">
          <span class="block truncate text-[13px] font-semibold text-ink-800">
            {{ row.buildingName }}
          </span>
        </template>

        <template #cell-floorName="{ row }">
          <span class="text-[13px] text-ink-600">{{ row.floorName }}</span>
        </template>

        <template #cell-area="{ row }">
          <span class="tabular" :class="row.area > 0 ? 'text-ink-900' : 'text-ink-400'">
            {{ row.area > 0 ? area(row.area) : 'Kiritilmagan' }}
          </span>
        </template>

        <template #cell-usage="{ row }">
          <span v-if="row.usage" class="text-[13px] text-ink-700">{{ row.usage }}</span>
          <span v-else class="text-[13px] text-ink-400">Kiritilmagan</span>
        </template>

        <template #cell-status="{ row }">
          <UiStatus kind="unit" :value="row.status" size="sm" />
        </template>

        <template #cell-hasPlan="{ row }">
          <span
            class="inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-[12px] font-semibold ring-1 ring-inset"
            :class="
              row.hasPlan
                ? 'bg-ok-50 text-ok-700 ring-ok-100'
                : 'bg-warn-50 text-warn-700 ring-warn-100'
            "
          >
            <UiIcon :name="row.hasPlan ? 'check' : 'clock'" :size="13" />
            {{ row.hasPlan ? 'Bor' : 'Yo‘q' }}
          </span>
        </template>

        <template #cell-pct="{ row }">
          <span
            class="flex items-center gap-2.5"
            :title="
              row.missing ? `To‘ldirilishi kerak: ${row.missing}` : 'Barcha atributlar kiritilgan'
            "
          >
            <span class="block h-1.5 w-24 shrink-0 overflow-hidden rounded-pill bg-ink-100">
              <span
                class="block h-full rounded-pill"
                :class="toneOf(row.pct)"
                :style="{ width: `${row.pct}%` }"
              />
            </span>
            <span class="tabular text-[12.5px] font-bold text-ink-800">{{ percent(row.pct) }}</span>
          </span>
        </template>
      </UiTable>

      <div
        class="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 px-4 py-4 lg:px-5"
      >
        <p class="text-[13px] text-ink-500">
          Ko‘rsatilmoqda: <b class="text-ink-800">{{ filtered.length }}</b> ta unit ·
          <span class="tabular text-ok-600">{{ kpi.full }}</span> to‘liq ·
          <span class="tabular text-warn-600">{{ kpi.total - kpi.full }}</span> to‘ldirilishi kerak
        </p>
        <UiButton variant="secondary" size="sm" to="/content">
          <UiIcon name="clipboard" :size="15" />
          Kontent navbati
        </UiButton>
      </div>
    </UiCard>

    <UiModal
      v-model="bulkOpen"
      title="Tanlangan unitlarni belgilash"
      :subtitle="`${selectedIds.length} ta unit tanlandi`"
    >
      <UiField label="Yangi holat" hint="Tanlangan barcha unitlarga bir xil holat beriladi">
        <UiSelect v-model="bulkStatus" :options="STATUS_OPTIONS" />
      </UiField>

      <div class="mt-4">
        <p class="mb-2 text-[13px] font-semibold text-ink-700">Tanlangan unitlar</p>
        <div class="flex flex-wrap gap-1.5">
          <span
            v-for="id in selectedIds"
            :key="id"
            class="tabular rounded-pill bg-ink-100 px-2.5 py-1 text-[12px] font-semibold text-ink-700"
          >
            {{ units.find((u) => u.id === id)?.code }}
          </span>
        </div>
      </div>

      <template #footer>
        <UiButton variant="ghost" @click="bulkOpen = false">Bekor qilish</UiButton>
        <UiButton :disabled="!selectedIds.length" @click="applyBulk">
          <UiIcon name="check" :size="16" />
          Belgilash
        </UiButton>
      </template>
    </UiModal>

    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-150 ease-out"
        enter-from-class="opacity-0"
        leave-active-class="transition duration-100 ease-in"
        leave-to-class="opacity-0"
      >
        <div
          v-if="panelUnit"
          class="fixed inset-0 z-50 bg-ink-900/40 backdrop-blur-[2px]"
          @click.self="closePanel"
        >
          <Transition
            appear
            enter-active-class="transition duration-200 ease-out"
            enter-from-class="translate-x-6 opacity-0"
          >
            <aside
              class="absolute inset-y-0 right-0 flex w-full max-w-[440px] flex-col bg-surface shadow-pop"
              role="dialog"
              aria-modal="true"
              :aria-label="`Unit ${panelUnit.code} atributlari`"
            >
              <header class="flex items-start justify-between gap-4 border-b border-ink-200 px-5 py-4">
                <div class="min-w-0">
                  <h2 class="truncate text-[17px] font-bold text-ink-900">
                    Unit {{ panelUnit.code }}
                  </h2>
                  <p class="truncate text-[12.5px] text-ink-500">
                    {{ buildingName(panelUnit.buildingId) }} · {{ floorName(panelUnit.floor) }}
                  </p>
                </div>
                <button
                  type="button"
                  class="-mr-1 rounded-lg p-2 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
                  aria-label="Yon panelni yopish"
                  @click="closePanel"
                >
                  <UiIcon name="x" :size="18" />
                </button>
              </header>

              <div class="scroll-slim flex-1 space-y-5 overflow-y-auto px-5 py-5">
                <div class="rounded-field bg-surface-sunken p-3 ring-1 ring-inset ring-ink-100">
                  <svg viewBox="0 0 100 100" class="h-[150px] w-full" role="img" aria-label="Qavatdagi joylashuv">
                    <rect
                      x="1.5"
                      y="3"
                      width="97"
                      height="94"
                      rx="1.2"
                      fill="#FFFFFF"
                      stroke="#E2E8F2"
                      stroke-width="0.7"
                    />
                    <polygon
                      v-for="s in panelShapes"
                      :key="s.id"
                      class="cursor-pointer"
                      :points="s.points"
                      :fill="s.active ? '#0256F7' : '#EEF2F8'"
                      :fill-opacity="s.active ? 0.35 : 1"
                      :stroke="s.active ? '#0256F7' : '#CBD4E3'"
                      :stroke-width="s.active ? 1.4 : 0.5"
                      @click="openUnit(s.id)"
                    >
                      <title>{{ s.code }}</title>
                    </polygon>
                  </svg>
                  <p class="mt-2 text-center text-[12px] text-ink-500">
                    Rejadagi boshqa shaklni bosib, tez o‘tishingiz mumkin
                  </p>
                </div>

                <div>
                  <p class="mb-2 text-[13px] font-semibold text-ink-700">Atribut to‘liqligi</p>
                  <ul class="grid gap-1.5 sm:grid-cols-2">
                    <li
                      v-for="c in panelChecks"
                      :key="c.key"
                      class="flex items-center gap-2 rounded-field px-2.5 py-1.5 text-[12.5px] ring-1 ring-inset"
                      :class="
                        c.done
                          ? 'bg-ok-50/70 text-ok-700 ring-ok-100'
                          : 'bg-danger-50/70 text-danger-700 ring-danger-100'
                      "
                    >
                      <UiIcon :name="c.done ? 'check' : 'x'" :size="14" />
                      {{ c.label }}
                    </li>
                  </ul>
                </div>

                <template v-if="canEdit">
                  <div class="grid gap-3.5 sm:grid-cols-2">
                    <UiField label="Unit kodi" required>
                      <UiInput v-model="form.code" placeholder="Masalan 704" />
                    </UiField>
                    <UiField label="Xonalar soni">
                      <UiInput v-model="form.rooms" type="number" min="0" placeholder="0" />
                    </UiField>
                    <UiField label="Maydoni, m²" required>
                      <UiInput v-model="form.area" type="number" min="0" step="0.1" placeholder="0.00" />
                    </UiField>
                    <UiField label="Holati">
                      <UiSelect v-model="form.status" :options="STATUS_OPTIONS" />
                    </UiField>
                    <UiField label="Foydalanish turi">
                      <UiSelect v-model="form.usage" :options="USAGE_OPTIONS" placeholder="Tanlanmagan" />
                    </UiField>
                    <UiField label="Taklif turi">
                      <UiSelect v-model="form.offer" :options="OFFER_OPTIONS" placeholder="Tanlanmagan" />
                    </UiField>
                  </div>

                  <div>
                    <p class="mb-2 text-[13px] font-semibold text-ink-700">Jihozlar</p>
                    <div v-if="equipment.length" class="flex flex-wrap gap-1.5">
                      <span
                        v-for="e in equipment"
                        :key="e"
                        class="inline-flex items-center gap-1 rounded-pill bg-ink-100 py-1 pl-2.5 pr-1 text-[12px] font-medium text-ink-700"
                      >
                        {{ e }}
                        <button
                          type="button"
                          class="relative grid size-5 place-items-center rounded-full text-ink-500 transition-colors after:absolute after:-inset-3 after:content-[''] hover:bg-ink-300 hover:text-ink-900 md:after:hidden"
                          :aria-label="`${e} jihozini olib tashlash`"
                          @click="removeEquipment(e)"
                        >
                          <UiIcon name="x" :size="12" />
                        </button>
                      </span>
                    </div>
                    <p v-else class="text-[12.5px] text-ink-400">Jihozlar kiritilmagan</p>

                    <div class="mt-2.5 flex gap-2">
                      <UiInput
                        v-model="equipInput"
                        placeholder="Jihoz nomi"
                        class="min-w-0 flex-1"
                        @keydown.enter.prevent="addEquipment()"
                      />
                      <UiButton variant="secondary" @click="addEquipment()">
                        <UiIcon name="plus" :size="15" />
                        Qo‘shish
                      </UiButton>
                    </div>

                    <div class="mt-2.5 flex flex-wrap gap-1.5">
                      <button
                        v-for="e in EQUIPMENT_LIBRARY.filter((x) => !equipment.includes(x))"
                        :key="e"
                        type="button"
                        class="rounded-pill px-2.5 py-1 text-[12px] font-medium text-ink-600 ring-1 ring-inset ring-ink-200 transition-colors hover:bg-brand-50 hover:text-brand-600"
                        @click="addEquipment(e)"
                      >
                        + {{ e }}
                      </button>
                    </div>
                  </div>

                  <p v-if="formError" class="text-[12.5px] font-medium text-danger-600">
                    {{ formError }}
                  </p>
                </template>

                <div v-else class="flex items-start gap-2.5 rounded-field bg-ink-50 px-3.5 py-3 text-[12.5px] text-ink-600 ring-1 ring-inset ring-ink-200">
                  <UiIcon name="lock" :size="16" class="mt-0.5 shrink-0 text-ink-400" />
                  <span>Atributlarni tahrirlash huquqi berilmagan, ma’lumot faqat ko‘rish uchun.</span>
                </div>

                <NuxtLink
                  :to="`/content/floors?building=${panelUnit.buildingId}&floor=${panelUnit.floor}`"
                  class="flex items-center gap-2 rounded-field px-3.5 py-3 text-[13px] font-semibold text-brand-600 ring-1 ring-inset ring-brand-200 transition-colors hover:bg-brand-50"
                >
                  <UiIcon name="layers" :size="16" />
                  Qavat rejasida ochish
                  <UiIcon name="chevronRight" :size="15" class="ml-auto" />
                </NuxtLink>
              </div>

              <footer
                v-if="canEdit"
                class="flex items-center justify-end gap-3 border-t border-ink-200 bg-surface-sunken px-5 py-4"
              >
                <UiButton variant="ghost" @click="fillForm">
                  <UiIcon name="refresh" :size="15" />
                  Tiklash
                </UiButton>
                <UiButton @click="saveUnit">
                  <UiIcon name="check" :size="16" />
                  Saqlash
                </UiButton>
              </footer>
            </aside>
          </Transition>
        </div>
      </Transition>
    </Teleport>
  </main>
</template>
