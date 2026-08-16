<script setup lang="ts">
import { BUILDINGS } from '~/data/buildings'
import { UNITS } from '~/data/units'
import { UNIT_STATUS } from '~/constants/statuses'
import { area, percent } from '~/utils/format'

type PlanUnit = {
  id: string
  code: string
  buildingId: string
  floor: number
  rooms: number
  area: number
  usage: string
  offer: string
  status: string
  equipment: string[]
  polygon: number[][]
}

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const canEdit = computed(() => auth.can('unit.editContent'))
const scoped = computed(() => BUILDINGS.filter((b) => auth.inScope(b.id)))

const STATUS_FILL: Record<string, string> = {
  VACANT: '#16B99A',
  RESERVED: '#FAA53F',
  RENTED: '#0256F7',
  SOLD: '#916CEC',
  MAINTENANCE: '#F84448',
  HIDDEN: '#94A2B8',
  DRAFT: '#CBD4E3',
}

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

const STATUS_OPTIONS = ['DRAFT', 'VACANT', 'RESERVED', 'RENTED', 'SOLD', 'MAINTENANCE', 'HIDDEN'].map(
  (value) => ({ value, label: UNIT_STATUS[value]?.label ?? value }),
)

const EQUIPMENT_LIBRARY = [
  'Konditsioner',
  'Yong‘in datchigi',
  'Internet chiqishi',
  'Serverxona',
  'Alohida sanuzel',
  'Oshxona',
  'Yuk platformasi',
]

function toPlanUnit(u: (typeof UNITS)[number]): PlanUnit {
  return {
    id: u.id,
    code: u.code,
    buildingId: u.buildingId,
    floor: u.floor,
    rooms: u.rooms,
    area: u.area,
    usage: u.usage,
    offer: u.offer,
    status: u.status,
    equipment: [...u.equipment],
    polygon: u.polygon.map((p) => [...p]),
  }
}

function clone(u: PlanUnit): PlanUnit {
  return { ...u, equipment: [...u.equipment], polygon: u.polygon.map((p) => [...p]) }
}

const units = ref<PlanUnit[]>(UNITS.filter((u) => auth.inScope(u.buildingId)).map(toPlanUnit))

function levelsOf(id: string) {
  const b = BUILDINGS.find((x) => x.id === id)
  if (!b) return []
  const list: number[] = []
  for (let f = b.floors; f >= 1; f -= 1) list.push(f)
  if (b.undergroundFloors > 0) list.push(0)
  return list
}

function floorName(value: number) {
  return value === 0 ? 'Yer osti · texnik qavat' : `${value}-qavat`
}

function attrsReady(u: PlanUnit) {
  return Boolean(u.usage) && u.area > 0 && Boolean(u.status) && u.equipment.length > 0
}

function planReady(u: PlanUnit) {
  return u.polygon.length >= 3
}

function defaultFloor(id: string) {
  const floors = units.value.filter((u) => u.buildingId === id).map((u) => u.floor)
  if (floors.length) return Math.max(...floors)
  return levelsOf(id)[0] ?? 1
}

function initialBuilding() {
  const raw = String(route.query.building ?? '')
  return scoped.value.some((b) => b.id === raw) ? raw : (scoped.value[0]?.id ?? '')
}

const buildingId = ref(initialBuilding())

function initialFloor() {
  const raw = Number(route.query.floor)
  if (Number.isFinite(raw) && levelsOf(buildingId.value).includes(raw)) return raw
  return defaultFloor(buildingId.value)
}

const floor = ref(initialFloor())
const selectedId = ref('')
const zoom = ref(1)
const fitMode = ref(false)
const notice = ref('')
const formError = ref('')
const equipInput = ref('')
const seq = ref(0)
const history = ref<PlanUnit[][]>([])

const building = computed(() => scoped.value.find((b) => b.id === buildingId.value))
const levels = computed(() => levelsOf(buildingId.value))

const floorUnits = computed(() =>
  units.value.filter((u) => u.buildingId === buildingId.value && u.floor === floor.value),
)

const selected = computed<PlanUnit | undefined>(
  () => floorUnits.value.find((u) => u.id === selectedId.value) ?? floorUnits.value[0],
)

const form = reactive({
  code: '',
  floor: '',
  rooms: '',
  area: '',
  usage: '',
  offer: '',
  status: '',
})

const equipment = ref<string[]>([])

function fillForm() {
  const u = selected.value
  formError.value = ''
  equipInput.value = ''
  if (!u) {
    Object.assign(form, { code: '', floor: '', rooms: '', area: '', usage: '', offer: '', status: '' })
    equipment.value = []
    return
  }
  Object.assign(form, {
    code: u.code,
    floor: String(u.floor),
    rooms: String(u.rooms),
    area: String(u.area),
    usage: u.usage,
    offer: u.offer,
    status: u.status,
  })
  equipment.value = [...u.equipment]
}

watch(selected, fillForm, { immediate: true })

watch(buildingId, (id) => {
  if (!levelsOf(id).includes(floor.value)) floor.value = defaultFloor(id)
  selectedId.value = ''
  zoom.value = 1
  fitMode.value = false
})

watch(floor, () => {
  selectedId.value = ''
  zoom.value = 1
  fitMode.value = false
})

watch([buildingId, floor], ([id, value]) => {
  if (String(route.query.building ?? '') === id && Number(route.query.floor) === value) return
  router.replace({ query: { building: id, floor: String(value) } })
})

watch(
  () => route.query,
  (q) => {
    const id = String(q.building ?? '')
    if (id && id !== buildingId.value && scoped.value.some((b) => b.id === id)) buildingId.value = id
    const value = Number(q.floor)
    if (Number.isFinite(value) && value !== floor.value && levelsOf(buildingId.value).includes(value))
      floor.value = value
  },
)

const floorOptions = computed(() =>
  levels.value.map((value) => {
    const list = units.value.filter((u) => u.buildingId === buildingId.value && u.floor === value)
    const ready = list.length > 0 && list.every(planReady)
    return { value, label: floorName(value), units: list.length, ready }
  }),
)

const buildingOptions = computed(() => scoped.value.map((b) => ({ value: b.id, label: b.name })))

const stats = computed(() => {
  const list = floorUnits.value
  const withPlan = list.filter(planReady).length
  const withAttrs = list.filter(attrsReady).length
  return {
    total: list.length,
    withPlan,
    withAttrs,
    planPct: list.length ? Math.round((withPlan / list.length) * 100) : 0,
    attrsPct: list.length ? Math.round((withAttrs / list.length) * 100) : 0,
    areaSum: list.reduce((s, u) => s + u.area, 0),
  }
})

const shapes = computed(() =>
  floorUnits.value.map((u) => {
    const points = u.polygon.map((p) => [(p[0] ?? 0) * 100, (p[1] ?? 0) * 100] as [number, number])
    return {
      id: u.id,
      code: u.code,
      areaLabel: u.area > 0 ? area(u.area) : 'Maydon kiritilmagan',
      fill: STATUS_FILL[u.status] ?? '#CBD4E3',
      ready: attrsReady(u),
      points: points.map((p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' '),
      handles: points,
      cx: points.reduce((s, p) => s + p[0], 0) / (points.length || 1),
      cy: points.reduce((s, p) => s + p[1], 0) / (points.length || 1),
    }
  }),
)

const bounds = computed(() => {
  const points = floorUnits.value.flatMap((u) => u.polygon)
  if (!points.length) return { x: 0, y: 0, w: 100, h: 100 }
  const xs = points.map((p) => (p[0] ?? 0) * 100)
  const ys = points.map((p) => (p[1] ?? 0) * 100)
  const minX = Math.min(...xs) - 5
  const maxX = Math.max(...xs) + 5
  const minY = Math.min(...ys) - 5
  const maxY = Math.max(...ys) + 5
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
})

const viewBox = computed(() => {
  const base = fitMode.value ? bounds.value : { x: 0, y: 0, w: 100, h: 100 }
  const w = base.w / zoom.value
  const h = base.h / zoom.value
  const cx = base.x + base.w / 2
  const cy = base.y + base.h / 2
  return `${(cx - w / 2).toFixed(2)} ${(cy - h / 2).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)}`
})

function zoomIn() {
  zoom.value = Math.round(Math.min(3, zoom.value + 0.25) * 100) / 100
}

function zoomOut() {
  zoom.value = Math.round(Math.max(0.5, zoom.value - 0.25) * 100) / 100
}

function fitPlan() {
  fitMode.value = true
  zoom.value = 1
}

function resetView() {
  fitMode.value = false
  zoom.value = 1
}

function pushHistory() {
  history.value.push(units.value.map(clone))
  if (history.value.length > 20) history.value.shift()
}

function nextCode() {
  const prefix = floor.value === 0 ? 'B' : String(floor.value)
  let n = floorUnits.value.length + 1
  const taken = (code: string) =>
    units.value.some((u) => u.buildingId === buildingId.value && u.code === code)
  let code = `${prefix}${String(n).padStart(2, '0')}`
  while (taken(code)) {
    n += 1
    code = `${prefix}${String(n).padStart(2, '0')}`
  }
  return code
}

function rect(x: number, y: number, w: number, h: number): number[][] {
  return [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ]
}

function addPolygon() {
  const n = floorUnits.value.length
  const col = n % 4
  const row = Math.floor(n / 4) % 3
  pushHistory()
  seq.value += 1
  const unit: PlanUnit = {
    id: `pl-${buildingId.value}-${floor.value}-${seq.value}`,
    code: nextCode(),
    buildingId: buildingId.value,
    floor: floor.value,
    rooms: 0,
    area: 0,
    usage: '',
    offer: '',
    status: 'DRAFT',
    equipment: [],
    polygon: rect(0.06 + col * 0.23, 0.08 + row * 0.3, 0.18, 0.22),
  }
  units.value.push(unit)
  selectedId.value = unit.id
  notice.value = `Yangi poligon qo‘shildi — «${unit.code}». Atributlarni to‘ldiring.`
}

function copyPolygon() {
  const source = selected.value
  if (!source) return
  pushHistory()
  seq.value += 1
  const shift = (v: number) => Math.min(0.95, Math.round((v + 0.04) * 1000) / 1000)
  const copy: PlanUnit = {
    ...clone(source),
    id: `pl-${buildingId.value}-${floor.value}-${seq.value}`,
    code: nextCode(),
    status: 'DRAFT',
    polygon: source.polygon.map((p) => [shift(p[0] ?? 0), shift(p[1] ?? 0)]),
  }
  units.value.push(copy)
  selectedId.value = copy.id
  notice.value = `«${source.code}» poligoni «${copy.code}» sifatida nusxalandi.`
}

function removePolygon() {
  const target = selected.value
  if (!target) return
  pushHistory()
  const code = target.code
  units.value = units.value.filter((u) => u.id !== target.id)
  selectedId.value = ''
  notice.value = `«${code}» poligoni rejadan o‘chirildi.`
}

function undo() {
  const previous = history.value.pop()
  if (!previous) return
  units.value = previous
  selectedId.value = ''
  notice.value = 'Oxirgi o‘zgarish bekor qilindi.'
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
  const target = selected.value
  if (!target) return

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

  pushHistory()
  const nextFloor = Number(form.floor)
  target.code = code
  target.floor = Number.isFinite(nextFloor) ? nextFloor : target.floor
  target.rooms = Number.isFinite(roomsValue) ? Math.max(0, Math.round(roomsValue)) : 0
  target.area = Math.round(areaValue * 100) / 100
  target.usage = form.usage
  target.offer = form.offer
  target.status = form.status || 'DRAFT'
  target.equipment = [...equipment.value]

  formError.value = ''
  notice.value =
    target.floor === floor.value
      ? `«${target.code}» uniti atributlari saqlandi.`
      : `«${target.code}» uniti ${floorName(target.floor)} ga ko‘chirildi.`
  selectedId.value = target.floor === floor.value ? target.id : ''
}

const columns = [
  { key: 'code', label: 'Kodi', width: '110px' },
  { key: 'area', label: 'Maydoni', align: 'right' as const, numeric: true, width: '130px' },
  { key: 'usage', label: 'Foydalanish', width: '150px' },
  { key: 'status', label: 'Holati', width: '150px' },
  { key: 'plan', label: 'Poligon', width: '130px' },
  { key: 'attrs', label: 'Atributlar', width: '150px' },
]

function selectRow(row: PlanUnit) {
  selectedId.value = row.id
}
</script>

<template>
  <AppTopbar
    title="Qavat rejalari"
    subtitle="2D poligonlarni chizish va unitga bog‘lash"
    :breadcrumb="[{ label: 'Kontent navbati', to: '/content' }, { label: 'Qavat rejalari' }]"
  >
    <template #actions>
      <UiButton variant="secondary" size="sm" to="/content">
        <UiIcon name="clipboard" :size="16" />
        Navbatga qaytish
      </UiButton>
      <UiButton
        variant="secondary"
        size="sm"
        :to="`/content/units?building=${buildingId}&floor=${floor}`"
      >
        <UiIcon name="layers" :size="16" />
        Unit atributlari
      </UiButton>
    </template>
  </AppTopbar>

  <main class="scroll-slim flex-1 space-y-5 overflow-y-auto p-4 lg:p-6">
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

    <section
      class="grid gap-5 lg:grid-cols-[236px_minmax(0,1fr)] xl:grid-cols-[236px_minmax(0,1fr)_344px]"
    >
      <div class="min-w-0">
        <UiCard title="Obyekt va qavat" subtitle="Ish maydoni tanlovi">
          <UiSelect v-model="buildingId" :options="buildingOptions" class="w-full" />

          <p class="mt-4 text-[12px] font-semibold uppercase tracking-wide text-ink-500">
            Qavatlar
          </p>
          <div class="scroll-slim mt-2 max-h-[260px] space-y-1.5 overflow-y-auto pr-1 lg:max-h-[440px]">
            <button
              v-for="f in floorOptions"
              :key="f.value"
              type="button"
              class="flex w-full items-center gap-2.5 rounded-field px-3 py-2.5 text-left ring-1 ring-inset transition-colors"
              :class="
                f.value === floor
                  ? 'bg-brand-50 ring-brand-300'
                  : 'ring-ink-200 hover:bg-ink-50 hover:ring-ink-300'
              "
              :aria-pressed="f.value === floor"
              @click="floor = f.value"
            >
              <span
                class="size-2.5 shrink-0 rounded-full"
                :class="f.ready ? 'bg-ok-500' : 'bg-warn-500'"
              />
              <span class="min-w-0 flex-1">
                <span class="block truncate text-[13px] font-semibold text-ink-900">
                  {{ f.label }}
                </span>
                <span class="block truncate text-[11.5px] text-ink-500">
                  {{ f.units ? `${f.units} ta unit` : 'Unit kiritilmagan' }}
                </span>
              </span>
              <UiIcon
                v-if="f.value === floor"
                name="chevronRight"
                :size="15"
                class="shrink-0 text-brand-600"
              />
            </button>
          </div>
        </UiCard>
      </div>

      <div class="min-w-0 space-y-5">
        <UiCard
          :title="`${floorName(floor)} rejasi`"
          :subtitle="`${building?.name ?? 'Obyekt tanlanmagan'} · ${stats.total} ta unit · ${area(stats.areaSum)}`"
          flush
          :padded="false"
        >
          <div v-if="canEdit" class="flex flex-wrap items-center gap-2 px-4 pb-4 lg:px-5">
            <UiButton size="sm" @click="addPolygon">
              <UiIcon name="plus" :size="15" />
              Poligon qo‘shish
            </UiButton>
            <UiButton variant="secondary" size="sm" :disabled="!selected" @click="copyPolygon">
              <UiIcon name="doc" :size="15" />
              Nusxalash
            </UiButton>
            <UiButton variant="danger" size="sm" :disabled="!selected" @click="removePolygon">
              <UiIcon name="trash" :size="15" />
              O‘chirish
            </UiButton>
            <UiButton
              variant="subtle"
              size="sm"
              :disabled="!history.length"
              @click="undo"
            >
              <UiIcon name="refresh" :size="15" />
              Bekor qilish
              <span v-if="history.length" class="tabular">({{ history.length }})</span>
            </UiButton>
          </div>

          <div
            v-else
            class="mx-4 mb-4 flex items-start gap-2.5 rounded-field bg-ink-50 px-3.5 py-3 text-[12.5px] text-ink-600 ring-1 ring-inset ring-ink-200 lg:mx-5"
          >
            <UiIcon name="lock" :size="16" class="mt-0.5 shrink-0 text-ink-400" />
            <span>Sizda reja tahrirlash huquqi yo‘q — reja faqat ko‘rish uchun ochilgan.</span>
          </div>

          <div class="px-4 pb-5 lg:px-5">
            <div
              class="relative overflow-hidden rounded-panel bg-surface-sunken ring-1 ring-inset ring-ink-100"
            >
              <div
                class="absolute left-3 top-3 z-10 flex flex-col gap-1 rounded-field bg-surface/90 p-1.5 shadow-card ring-1 ring-ink-200/70"
              >
                <button
                  type="button"
                  class="grid size-10 place-items-center rounded-[8px] text-ink-600 transition-colors hover:bg-brand-50 hover:text-brand-600 disabled:opacity-40"
                  aria-label="Yaqinlashtirish"
                  :disabled="zoom >= 3"
                  @click="zoomIn"
                >
                  <UiIcon name="plus" :size="18" />
                </button>
                <button
                  type="button"
                  class="grid size-10 place-items-center rounded-[8px] text-ink-600 transition-colors hover:bg-brand-50 hover:text-brand-600 disabled:opacity-40"
                  aria-label="Uzoqlashtirish"
                  :disabled="zoom <= 0.5"
                  @click="zoomOut"
                >
                  <svg class="size-[18px]" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path d="M4.5 10h11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
                  </svg>
                </button>
                <button
                  type="button"
                  class="grid size-10 place-items-center rounded-[8px] transition-colors hover:bg-brand-50 hover:text-brand-600"
                  :class="fitMode ? 'text-brand-600' : 'text-ink-600'"
                  aria-label="Rejaga moslashtirish"
                  @click="fitPlan"
                >
                  <svg class="size-[18px]" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path
                      d="M3 7.5V4a1 1 0 0 1 1-1h3.5M17 7.5V4a1 1 0 0 0-1-1h-3.5M3 12.5V16a1 1 0 0 0 1 1h3.5M17 12.5V16a1 1 0 0 1-1 1h-3.5"
                      stroke="currentColor"
                      stroke-width="1.7"
                      stroke-linecap="round"
                    />
                  </svg>
                </button>
                <button
                  type="button"
                  class="grid size-10 place-items-center rounded-[8px] text-ink-600 transition-colors hover:bg-brand-50 hover:text-brand-600"
                  aria-label="Ko‘rinishni qayta tiklash"
                  @click="resetView"
                >
                  <UiIcon name="refresh" :size="17" />
                </button>
              </div>

              <span
                class="tabular absolute right-3 top-3 z-10 rounded-pill bg-surface/90 px-3 py-1 text-[12px] font-semibold text-ink-600 shadow-card"
              >
                {{ Math.round(zoom * 100) }}%
              </span>

              <svg
                v-if="shapes.length"
                :viewBox="viewBox"
                class="h-[300px] w-full sm:h-[420px]"
                role="img"
                :aria-label="`${floorName(floor)} rejasi`"
              >
                <rect
                  x="1.5"
                  y="3"
                  width="97"
                  height="94"
                  rx="1.2"
                  fill="#FFFFFF"
                  stroke="#354152"
                  stroke-width="0.7"
                />

                <g
                  v-for="s in shapes"
                  :key="s.id"
                  class="cursor-pointer"
                  @click="selectedId = s.id"
                >
                  <title>{{ s.code }} · {{ s.areaLabel }}</title>
                  <polygon
                    :points="s.points"
                    :fill="s.fill"
                    :fill-opacity="selected?.id === s.id ? 0.42 : 0.22"
                    :stroke="selected?.id === s.id ? '#0256F7' : s.fill"
                    :stroke-width="selected?.id === s.id ? 1.5 : 0.7"
                    :stroke-dasharray="s.ready ? undefined : '2 1.4'"
                  />
                  <text
                    :x="s.cx"
                    :y="s.cy"
                    text-anchor="middle"
                    font-size="3.6"
                    font-weight="700"
                    fill="#131C2B"
                  >
                    {{ s.code }}
                  </text>
                  <text :x="s.cx" :y="s.cy + 4.4" text-anchor="middle" font-size="2.4" fill="#64748B">
                    {{ s.areaLabel }}
                  </text>
                  <g v-if="selected?.id === s.id">
                    <rect
                      v-for="(h, i) in s.handles"
                      :key="i"
                      :x="h[0] - 0.9"
                      :y="h[1] - 0.9"
                      width="1.8"
                      height="1.8"
                      rx="0.4"
                      fill="#FFFFFF"
                      stroke="#0256F7"
                      stroke-width="0.6"
                    />
                  </g>
                </g>
              </svg>

              <div v-else class="flex flex-col items-center gap-4 px-6 py-16 text-center">
                <span class="grid size-14 place-items-center rounded-full bg-warn-50 text-warn-600">
                  <UiIcon name="layers" :size="24" />
                </span>
                <div>
                  <p class="text-[14px] font-bold text-ink-900">
                    {{ floorName(floor) }} bo‘yicha reja chizilmagan
                  </p>
                  <p class="mt-1 text-[13px] text-ink-500">
                    Birinchi poligonni qo‘shing va unit atributlarini kiriting.
                  </p>
                </div>
                <UiButton v-if="canEdit" size="sm" @click="addPolygon">
                  <UiIcon name="plus" :size="15" />
                  Poligon qo‘shish
                </UiButton>
              </div>
            </div>

            <div class="mt-4 grid gap-3 sm:grid-cols-2">
              <div class="rounded-field p-3.5 ring-1 ring-inset ring-ink-200">
                <div class="flex items-center justify-between gap-3">
                  <span class="text-[12.5px] font-semibold text-ink-700">Poligon chizilgan</span>
                  <span class="tabular text-[13px] font-bold text-brand-600">
                    {{ stats.withPlan }} / {{ stats.total }}
                  </span>
                </div>
                <span class="mt-2 block h-1.5 w-full overflow-hidden rounded-pill bg-ink-100">
                  <span
                    class="block h-full rounded-pill bg-brand-500"
                    :style="{ width: `${stats.planPct}%` }"
                  />
                </span>
                <p class="mt-1.5 text-[12px] text-ink-500">
                  Qavat rejasi tayyorligi: {{ percent(stats.planPct) }}
                </p>
              </div>

              <div class="rounded-field p-3.5 ring-1 ring-inset ring-ink-200">
                <div class="flex items-center justify-between gap-3">
                  <span class="text-[12.5px] font-semibold text-ink-700">Atributi to‘liq</span>
                  <span class="tabular text-[13px] font-bold text-ok-600">
                    {{ stats.withAttrs }} / {{ stats.total }}
                  </span>
                </div>
                <span class="mt-2 block h-1.5 w-full overflow-hidden rounded-pill bg-ink-100">
                  <span
                    class="block h-full rounded-pill bg-ok-500"
                    :style="{ width: `${stats.attrsPct}%` }"
                  />
                </span>
                <p class="mt-1.5 text-[12px] text-ink-500">
                  Atribut to‘liqligi: {{ percent(stats.attrsPct) }}
                </p>
              </div>
            </div>
          </div>
        </UiCard>

        <UiCard
          title="Qavatdagi unitlar"
          subtitle="Qatorni bosing — reja va shakl tanlanadi"
          flush
          :padded="false"
        >
          <UiTable
            :columns="columns"
            :rows="floorUnits"
            empty="Bu qavatda unit yozuvi yo‘q"
            @row-click="selectRow"
          >
            <template #cell-code="{ row }">
              <span
                class="tabular text-[13px] font-bold"
                :class="selected?.id === row.id ? 'text-brand-600' : 'text-ink-800'"
              >
                {{ row.code }}
              </span>
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

            <template #cell-plan="{ row }">
              <span
                class="inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-[12px] font-semibold ring-1 ring-inset"
                :class="
                  row.polygon.length >= 3
                    ? 'bg-ok-50 text-ok-700 ring-ok-100'
                    : 'bg-warn-50 text-warn-700 ring-warn-100'
                "
              >
                <UiIcon :name="row.polygon.length >= 3 ? 'check' : 'clock'" :size="13" />
                {{ row.polygon.length >= 3 ? 'Bor' : 'Yo‘q' }}
              </span>
            </template>

            <template #cell-attrs="{ row }">
              <span
                class="inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-[12px] font-semibold ring-1 ring-inset"
                :class="
                  row.usage && row.area > 0 && row.equipment.length
                    ? 'bg-ok-50 text-ok-700 ring-ok-100'
                    : 'bg-danger-50 text-danger-700 ring-danger-100'
                "
              >
                <UiIcon
                  :name="row.usage && row.area > 0 && row.equipment.length ? 'check' : 'warning'"
                  :size="13"
                />
                {{ row.usage && row.area > 0 && row.equipment.length ? 'To‘liq' : 'To‘liq emas' }}
              </span>
            </template>
          </UiTable>
        </UiCard>
      </div>

      <div class="min-w-0 lg:col-span-2 xl:col-span-1">
        <UiCard
          v-if="selected"
          :title="`Unit ${selected.code}`"
          :subtitle="`${building?.name ?? ''} · ${floorName(floor)}`"
        >
          <template #actions>
            <UiStatus kind="unit" :value="selected.status" size="sm" />
          </template>

          <template v-if="canEdit">
            <div class="grid gap-3.5 sm:grid-cols-2">
              <UiField label="Unit kodi" required>
                <UiInput v-model="form.code" placeholder="Masalan 704" />
              </UiField>
              <UiField label="Qavat">
                <UiSelect
                  v-model="form.floor"
                  :options="levels.map((l) => ({ value: String(l), label: floorName(l) }))"
                />
              </UiField>
              <UiField label="Xonalar soni">
                <UiInput v-model="form.rooms" type="number" min="0" placeholder="0" />
              </UiField>
              <UiField label="Maydoni, m²" required>
                <UiInput v-model="form.area" type="number" min="0" step="0.1" placeholder="0.00" />
              </UiField>
              <UiField label="Foydalanish turi">
                <UiSelect v-model="form.usage" :options="USAGE_OPTIONS" placeholder="Tanlanmagan" />
              </UiField>
              <UiField label="Taklif turi">
                <UiSelect v-model="form.offer" :options="OFFER_OPTIONS" placeholder="Tanlanmagan" />
              </UiField>
              <UiField label="Holati" class="sm:col-span-2">
                <UiSelect v-model="form.status" :options="STATUS_OPTIONS" />
              </UiField>
            </div>

            <div class="mt-4">
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
                    class="grid size-5 place-items-center rounded-full text-ink-500 transition-colors hover:bg-ink-300 hover:text-ink-900"
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

            <p v-if="formError" class="mt-3 text-[12.5px] font-medium text-danger-600">
              {{ formError }}
            </p>

            <div class="mt-4 grid grid-cols-2 gap-3">
              <UiButton variant="ghost" @click="fillForm">
                <UiIcon name="refresh" :size="15" />
                Tiklash
              </UiButton>
              <UiButton @click="saveUnit">
                <UiIcon name="check" :size="16" />
                Saqlash
              </UiButton>
            </div>
          </template>

          <template v-else>
            <dl class="divide-y divide-ink-100">
              <div class="flex items-center justify-between gap-4 py-2.5">
                <dt class="text-[12.5px] text-ink-500">Maydoni</dt>
                <dd class="tabular text-[13px] font-bold text-ink-900">{{ area(selected.area) }}</dd>
              </div>
              <div class="flex items-center justify-between gap-4 py-2.5">
                <dt class="text-[12.5px] text-ink-500">Xonalar</dt>
                <dd class="tabular text-[13px] font-semibold text-ink-900">{{ selected.rooms }}</dd>
              </div>
              <div class="flex items-center justify-between gap-4 py-2.5">
                <dt class="text-[12.5px] text-ink-500">Foydalanish turi</dt>
                <dd class="text-[13px] font-semibold text-ink-900">{{ selected.usage || '—' }}</dd>
              </div>
              <div class="flex items-center justify-between gap-4 py-2.5">
                <dt class="text-[12.5px] text-ink-500">Taklif turi</dt>
                <dd class="text-[13px] font-semibold text-ink-900">{{ selected.offer || '—' }}</dd>
              </div>
              <div class="flex items-start justify-between gap-4 py-2.5">
                <dt class="text-[12.5px] text-ink-500">Jihozlar</dt>
                <dd class="max-w-[60%] text-right text-[13px] font-semibold text-ink-900">
                  {{ selected.equipment.join(', ') || '—' }}
                </dd>
              </div>
            </dl>
          </template>
        </UiCard>

        <UiCard v-else title="Unit atributlari" subtitle="Tahrirlash uchun poligon tanlang">
          <div class="flex flex-col items-center gap-3 py-10 text-center">
            <span class="grid size-12 place-items-center rounded-full bg-ink-100 text-ink-500">
              <UiIcon name="box" :size="22" />
            </span>
            <p class="text-[13px] text-ink-500">
              Bu qavatda tanlangan unit yo‘q. Rejadagi shaklni bosing yoki yangi poligon qo‘shing.
            </p>
            <UiButton v-if="canEdit" variant="secondary" size="sm" @click="addPolygon">
              <UiIcon name="plus" :size="15" />
              Poligon qo‘shish
            </UiButton>
          </div>
        </UiCard>
      </div>
    </section>
  </main>
</template>
