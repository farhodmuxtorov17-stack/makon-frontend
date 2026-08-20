<script setup lang="ts">
import { BUILDINGS } from '~/data/buildings'
import { UNITS, type Unit, type UnitOffer, type UnitUsage } from '~/data/units'
import { UNIT_STATUS_COLOR } from '~/constants/statuses'
import { area, percent } from '~/utils/format'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const {
  columns: labelColumns,
  field,
  floorLabel,
  statusOptions,
  unitUsageLabel,
  unitUsageOptions,
  tr,
  unitOf,
} = useAppLabels()

const canEdit = computed(() => auth.can('unit.editContent'))
const scoped = computed(() => BUILDINGS.filter((b) => auth.inScope(b.id)))

/**
 * Ranglar yagona registrdan. Ilgari bu ekranda o‘z jadvali bor edi va
 * qizil rang bu yerda «Ta’mirda», qolgan ekranlarda «Sotilgan» degani
 * bo‘lardi.
 */
const STATUS_FILL = UNIT_STATUS_COLOR

/**
 * Foydalanish turi, taklif turi va jihoz nomi ma’lumotda o‘zbekcha qiymat
 * sifatida saqlanadi. Qiymatning o‘zi o‘zgarmaydi (filtr va solishtirish
 * ishlashda qoladi), faqat ko‘rinadigan nom tarjima kalitiga bog‘lanadi.
 */
const OFFER_KEY: Record<string, string> = {
  Ijara: 'unitOffer.rent',
  Sotuv: 'unitOffer.sale',
  Ikkalasi: 'unitOffer.both',
}

const EQUIPMENT_KEY: Record<string, string> = {
  Konditsioner: 'equipment.airConditioner',
  'Markaziy konditsioner': 'equipment.centralAc',
  'Yong‘in datchigi': 'equipment.fireDetector',
  'Yong‘in signalizatsiyasi': 'equipment.fireAlarm',
  'Yong‘in gidranti': 'equipment.fireHydrant',
  'Yong‘in o‘chirish tizimi': 'equipment.fireSuppression',
  'Internet chiqishi': 'equipment.internetOutlet',
  'Optik internet': 'equipment.fiberInternet',
  Serverxona: 'equipment.serverRoom',
  'Alohida serverxona': 'equipment.serverRoomSeparate',
  'Alohida sanuzel': 'equipment.restroomSeparate',
  'Ikkita sanuzel': 'equipment.restroomTwo',
  Oshxona: 'equipment.kitchen',
  'Yuk platformasi': 'equipment.loadingDock',
  'Yuk lifti': 'equipment.freightElevator',
  'Yuk eshigi': 'equipment.freightDoor',
  Rampa: 'equipment.ramp',
  Kran: 'equipment.crane',
  'Kran yo‘nalishi': 'equipment.craneRunway',
  Balkon: 'equipment.balcony',
  'Elektr shchiti': 'equipment.electricalPanel',
  'Issiqlik punkti': 'equipment.heatingPoint',
  'Kirish domofoni': 'equipment.intercom',
  'Konferens zal': 'equipment.conferenceHall',
  'Ombor xonasi': 'equipment.storageRoom',
  'Suv nasosi': 'equipment.waterPump',
  Ventilyatsiya: 'equipment.ventilation',
  Videokuzatuv: 'equipment.cctv',
  Vitrina: 'equipment.showcase',
  'Vitrina yoritgichi': 'equipment.showcaseLighting',
}

function offerLabel(value: string) {
  return value ? tr(OFFER_KEY[value], value) : ''
}

function equipLabel(value: string) {
  return tr(EQUIPMENT_KEY[value], value)
}

const USAGE_OPTIONS = computed(() => unitUsageOptions())

const OFFER_OPTIONS = computed(() =>
  Object.keys(OFFER_KEY).map((value) => ({ value, label: offerLabel(value) })),
)

const STATUS_OPTIONS = computed(() =>
  statusOptions('unit', ['DRAFT', 'VACANT', 'RESERVED', 'RENTED', 'SOLD', 'MAINTENANCE', 'HIDDEN']),
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

function clone(u: Unit): Unit {
  return { ...u, equipment: [...u.equipment], polygon: u.polygon.map((p) => [...p]) }
}

/**
 * Reja umumiy unit reyestri ustida ishlaydi, nusxasi ustida emas: chizilgan
 * poligon va kiritilgan atribut obyekt sahifasida, katalogda va 3D
 * ko‘rinishda darhol paydo bo‘ladi hamda sahifa almashganda saqlanib qoladi.
 */
const units = computed(() => UNITS.filter((u) => auth.inScope(u.buildingId)))

function levelsOf(id: string) {
  const b = BUILDINGS.find((x) => x.id === id)
  if (!b) return []
  const list: number[] = []
  for (let f = b.floors; f >= 1; f -= 1) list.push(f)
  for (let k = 1; k <= b.undergroundFloors; k++) list.push(-k)
  return list
}

function floorName(value: number) {
  return value < 0 ? t('unitOf.basementNo', { floor: -value }) : floorLabel(value)
}

function attrsReady(u: Unit) {
  return Boolean(u.usage) && u.area > 0 && Boolean(u.status) && u.equipment.length > 0
}

function planReady(u: Unit) {
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
const history = ref<Unit[][]>([])

const building = computed(() => scoped.value.find((b) => b.id === buildingId.value))
const levels = computed(() => levelsOf(buildingId.value))

const floorUnits = computed(() =>
  units.value.filter((u) => u.buildingId === buildingId.value && u.floor === floor.value),
)

const selected = computed<Unit | undefined>(
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
      areaLabel: u.area > 0 ? area(u.area) : t('cnt.noAreaEntered'),
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

/** Reyestrda takrorlanmaydigan identifikator: yozuvlar sahifalar orasida saqlanadi */
function nextId() {
  seq.value += 1
  let id = `pl-${buildingId.value}-${floor.value}-${seq.value}`
  while (UNITS.some((u) => u.id === id)) {
    seq.value += 1
    id = `pl-${buildingId.value}-${floor.value}-${seq.value}`
  }
  return id
}

function rect(x: number, y: number, w: number, h: number): number[][] {
  return [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ]
}

/** Ikki to‘rtburchak kesishadimi (0–1 koordinatalarda) */
function overlaps(a: number[][], b: number[][]) {
  const box = (p: number[][]) => ({
    x1: Math.min(...p.map((q) => q[0] ?? 0)),
    x2: Math.max(...p.map((q) => q[0] ?? 0)),
    y1: Math.min(...p.map((q) => q[1] ?? 0)),
    y2: Math.max(...p.map((q) => q[1] ?? 0)),
  })
  const p = box(a)
  const q = box(b)
  return p.x1 < q.x2 - 0.001 && q.x1 < p.x2 - 0.001 && p.y1 < q.y2 - 0.001 && q.y1 < p.y2 - 0.001
}

/**
 * Yangi shakl uchun bo‘sh joy topadi. Ilgari shakl qat‘iy 4×3 to‘rga
 * qo‘yilardi va uchinchi bosishdayoq mavjud unit ustiga tushardi.
 */
function freeSpot(existing: number[][][]) {
  // Qavat to‘la rejalashtirilgan bo‘lsa kichikroq shakl ham sinab ko‘riladi
  for (const [w, h, step] of [
    [0.18, 0.22, 0.04],
    [0.12, 0.15, 0.03],
    [0.07, 0.09, 0.02],
  ] as const) {
    for (let y = 0.02; y + h <= 0.98; y += step) {
      for (let x = 0.02; x + w <= 0.98; x += step) {
        const candidate = rect(Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000, w, h)
        if (!existing.some((e) => overlaps(candidate, e))) return candidate
      }
    }
  }
  return null
}

function addPolygon() {
  if (!canEdit.value) return
  const spot = freeSpot(floorUnits.value.map((u) => u.polygon))
  if (!spot) {
    notice.value = t('cnt.noticeNoSpace')
    return
  }
  pushHistory()
  const unit: Unit = {
    id: nextId(),
    code: nextCode(),
    buildingId: buildingId.value,
    floor: floor.value,
    rooms: 0,
    area: 0,
    usage: '',
    offer: '',
    status: 'DRAFT',
    price: 0,
    priceUnit: 'so‘m / oy',
    equipment: [],
    polygon: spot,
  }
  UNITS.push(unit)
  selectedId.value = unit.id
  notice.value = t('cnt.noticePolygonAdded', { code: unit.code })
}

function copyPolygon() {
  const source = selected.value
  if (!canEdit.value || !source) return
  pushHistory()
  const shift = (v: number) => Math.min(0.95, Math.round((v + 0.04) * 1000) / 1000)
  const copy: Unit = {
    ...clone(source),
    id: nextId(),
    code: nextCode(),
    status: 'DRAFT',
    tenant: undefined,
    contractCode: undefined,
    polygon: source.polygon.map((p) => [shift(p[0] ?? 0), shift(p[1] ?? 0)]),
  }
  UNITS.push(copy)
  selectedId.value = copy.id
  notice.value = t('cnt.noticePolygonCopied', { source: source.code, copy: copy.code })
}

function removePolygon() {
  const target = selected.value
  if (!canEdit.value || !target) return
  pushHistory()
  const code = target.code
  const index = UNITS.findIndex((u) => u.id === target.id)
  if (index >= 0) UNITS.splice(index, 1)
  selectedId.value = ''
  notice.value = t('cnt.noticePolygonRemoved', { code })
}

/** Oldingi holatni umumiy reyestrga qaytaradi: qo‘shilgani olib tashlanadi, o‘chirilgani tiklanadi */
function undo() {
  const previous = history.value.pop()
  if (!previous) return
  const keep = new Set(previous.map((u) => u.id))
  for (let i = UNITS.length - 1; i >= 0; i -= 1) {
    const u = UNITS[i]!
    if (auth.inScope(u.buildingId) && !keep.has(u.id)) UNITS.splice(i, 1)
  }
  for (const snapshot of previous) {
    const live = UNITS.find((u) => u.id === snapshot.id)
    if (live) Object.assign(live, clone(snapshot))
    else UNITS.push(clone(snapshot))
  }
  selectedId.value = ''
  notice.value = t('cnt.noticeUndone')
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
  if (!canEdit.value || !target) return

  const code = form.code.trim()
  const areaValue = Number(form.area)
  const roomsValue = Number(form.rooms)

  if (!code) {
    formError.value = t('cnt.errCodeRequired')
    return
  }
  if (!Number.isFinite(areaValue) || areaValue <= 0) {
    formError.value = t('cnt.errAreaPositive')
    return
  }

  pushHistory()
  const nextFloor = Number(form.floor)
  target.code = code
  target.floor = Number.isFinite(nextFloor) ? nextFloor : target.floor
  target.rooms = Number.isFinite(roomsValue) ? Math.max(0, Math.round(roomsValue)) : 0
  target.area = Math.round(areaValue * 100) / 100
  // Qiymatlar tanlov ro‘yxatlaridan keladi, shuning uchun tur aniqlashtiriladi
  target.usage = form.usage as UnitUsage
  target.offer = form.offer as UnitOffer
  target.status = (form.status || 'DRAFT') as Unit['status']
  target.equipment = [...equipment.value]

  formError.value = ''
  notice.value =
    target.floor === floor.value
      ? t('cnt.noticeUnitSaved', { code: target.code })
      : t('cnt.noticeUnitMoved', { code: target.code, floor: floorName(target.floor) })
  selectedId.value = target.floor === floor.value ? target.id : ''
}

const columns = computed(() =>
  labelColumns([
    { key: 'code', field: 'code', label: 'Kodi', width: '110px' },
    {
      key: 'area',
      field: 'area',
      label: 'Maydoni',
      align: 'right',
      numeric: true,
      width: '130px',
    },
    { key: 'usage', field: 'usage', label: 'Foydalanish', width: '150px' },
    { key: 'status', field: 'status', label: 'Holat', width: '150px' },
    { key: 'plan', field: 'polygon', label: 'Poligon', width: '130px' },
    { key: 'attrs', field: 'attributes', label: 'Atributlar', width: '150px' },
  ]),
)

function selectRow(row: Unit) {
  selectedId.value = row.id
}
</script>

<template>
  <AppTopbar
    :title="t('nav.floors')"
    :subtitle="t('cnt.floorsCaption')"
    :breadcrumb="[{ label: t('nav.contentQueue'), to: '/content' }, { label: t('nav.floors') }]"
  >
    <template #actions>
      <UiButton variant="secondary" size="sm" to="/content">
        <UiIcon name="clipboard" :size="16" />
        {{ t('cnt.backToQueue') }}
      </UiButton>
      <UiButton
        variant="secondary"
        size="sm"
        :to="`/content/units?building=${buildingId}&floor=${floor}`"
      >
        <UiIcon name="layers" :size="16" />
        {{ t('nav.unitAttributes') }}
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
        :aria-label="t('common.closeNotice')"
        @click="notice = ''"
      >
        <UiIcon name="x" :size="15" />
      </button>
    </div>

    <section
      class="grid gap-5 lg:grid-cols-[236px_minmax(0,1fr)] xl:grid-cols-[236px_minmax(0,1fr)_344px]"
    >
      <div class="min-w-0">
        <UiCard :title="t('cnt.workspaceTitle')" :subtitle="t('cnt.workspaceCaption')">
          <UiSelect v-model="buildingId" :options="buildingOptions" class="w-full" />

          <p class="mt-4 text-[12px] font-semibold uppercase tracking-wide text-ink-500">
            {{ field('floors') }}
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
                <span class="block truncate text-[12px] text-ink-500">
                  {{ f.units ? t('cnt.unitCount', { count: f.units }) : t('empty.noUnitsEntered') }}
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
          :title="t('cnt.planTitle', { floor: floorName(floor) })"
          :subtitle="`${building?.name ?? t('cnt.noObjectSelected')} · ${t('cnt.unitCount', { count: stats.total })} · ${area(stats.areaSum)}`"
          flush
          :padded="false"
        >
          <div v-if="canEdit" class="flex flex-wrap items-center gap-2 px-4 pb-4 lg:px-5">
            <UiButton size="sm" @click="addPolygon">
              <UiIcon name="plus" :size="15" />
              {{ t('cnt.addPolygon') }}
            </UiButton>
            <UiButton variant="secondary" size="sm" :disabled="!selected" @click="copyPolygon">
              <UiIcon name="doc" :size="15" />
              {{ t('common.copy') }}
            </UiButton>
            <UiButton variant="danger" size="sm" :disabled="!selected" @click="removePolygon">
              <UiIcon name="trash" :size="15" />
              {{ t('common.remove') }}
            </UiButton>
            <UiButton
              variant="subtle"
              size="sm"
              :disabled="!history.length"
              @click="undo"
            >
              <UiIcon name="refresh" :size="15" />
              {{ t('common.undo') }}
              <span v-if="history.length" class="tabular">({{ history.length }})</span>
            </UiButton>
          </div>

          <div
            v-else
            class="mx-4 mb-4 flex items-start gap-2.5 rounded-field bg-ink-50 px-3.5 py-3 text-[13px] text-ink-600 ring-1 ring-inset ring-ink-200 lg:mx-5"
          >
            <UiIcon name="lock" :size="16" class="mt-0.5 shrink-0 text-ink-400" />
            <span>{{ t('cnt.noEditRight') }}</span>
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
                  :aria-label="t('common.zoomIn')"
                  :disabled="zoom >= 3"
                  @click="zoomIn"
                >
                  <UiIcon name="plus" :size="18" />
                </button>
                <button
                  type="button"
                  class="grid size-10 place-items-center rounded-[8px] text-ink-600 transition-colors hover:bg-brand-50 hover:text-brand-600 disabled:opacity-40"
                  :aria-label="t('common.zoomOut')"
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
                  :aria-label="t('cnt.fitPlan')"
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
                  :aria-label="t('cnt.resetView')"
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
                :aria-label="t('cnt.planTitle', { floor: floorName(floor) })"
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
                    {{ t('cnt.noPlanForFloor', { floor: floorName(floor) }) }}
                  </p>
                  <p class="mt-1 text-[13px] text-ink-500">
                    {{ t('cnt.noPlanHint') }}
                  </p>
                </div>
                <UiButton v-if="canEdit" size="sm" @click="addPolygon">
                  <UiIcon name="plus" :size="15" />
                  {{ t('cnt.addPolygon') }}
                </UiButton>
              </div>
            </div>

            <div class="mt-4 grid gap-3 sm:grid-cols-2">
              <div class="rounded-field p-3.5 ring-1 ring-inset ring-ink-200">
                <div class="flex items-center justify-between gap-3">
                  <span class="text-[13px] font-semibold text-ink-700">{{ t('cnt.polygonDrawn') }}</span>
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
                  {{ t('cnt.planReadiness', { value: percent(stats.planPct) }) }}
                </p>
              </div>

              <div class="rounded-field p-3.5 ring-1 ring-inset ring-ink-200">
                <div class="flex items-center justify-between gap-3">
                  <span class="text-[13px] font-semibold text-ink-700">{{ t('kpi.attributesComplete') }}</span>
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
                  {{ t('cnt.attrsCompleteness', { value: percent(stats.attrsPct) }) }}
                </p>
              </div>
            </div>
          </div>
        </UiCard>

        <UiCard
          :title="t('cnt.floorUnitsTitle')"
          :subtitle="t('cnt.floorUnitsCaption')"
          flush
          :padded="false"
        >
          <UiTable
            :columns="columns"
            :rows="floorUnits"
            :empty="t('empty.noUnitsOnFloor')"
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
                {{ row.area > 0 ? area(row.area) : t('common.notEntered') }}
              </span>
            </template>

            <template #cell-usage="{ row }">
              <span v-if="row.usage" class="text-[13px] text-ink-700">
                {{ unitUsageLabel(row.usage) }}
              </span>
              <span v-else class="text-[13px] text-ink-400">{{ t('common.notEntered') }}</span>
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
                {{ row.polygon.length >= 3 ? t('common.present') : t('common.no') }}
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
                {{
                  row.usage && row.area > 0 && row.equipment.length
                    ? t('tab.complete')
                    : t('tab.incomplete')
                }}
              </span>
            </template>
          </UiTable>
        </UiCard>
      </div>

      <div class="min-w-0 lg:col-span-2 xl:col-span-1">
        <UiCard
          v-if="selected"
          :title="t('cnt.unitTitle', { code: selected.code })"
          :subtitle="`${building?.name ?? ''} · ${floorName(floor)}`"
        >
          <template #actions>
            <UiStatus kind="unit" :value="selected.status" size="sm" />
          </template>

          <template v-if="canEdit">
            <div class="grid gap-3.5 sm:grid-cols-2">
              <UiField :label="field('unitCode')" required>
                <UiInput v-model="form.code" :placeholder="t('cnt.unitCodeExample')" />
              </UiField>
              <UiField :label="field('floor')">
                <UiSelect
                  v-model="form.floor"
                  :options="levels.map((l) => ({ value: String(l), label: floorName(l) }))"
                />
              </UiField>
              <UiField :label="field('rooms')">
                <UiInput v-model="form.rooms" type="number" min="0" placeholder="0" />
              </UiField>
              <UiField :label="`${field('area')}, ${unitOf('sqm', 'm²')}`" required>
                <UiInput v-model="form.area" type="number" min="0" step="0.1" placeholder="0.00" />
              </UiField>
              <UiField :label="field('usage')">
                <UiSelect
                  v-model="form.usage"
                  :options="USAGE_OPTIONS"
                  :placeholder="t('common.notSelected')"
                />
              </UiField>
              <UiField :label="field('offer')">
                <UiSelect
                  v-model="form.offer"
                  :options="OFFER_OPTIONS"
                  :placeholder="t('common.notSelected')"
                />
              </UiField>
              <UiField :label="field('status')" class="sm:col-span-2">
                <UiSelect v-model="form.status" :options="STATUS_OPTIONS" />
              </UiField>
            </div>

            <div class="mt-4">
              <p class="mb-2 text-[13px] font-semibold text-ink-700">{{ field('equipment') }}</p>
              <div v-if="equipment.length" class="flex flex-wrap gap-1.5">
                <span
                  v-for="e in equipment"
                  :key="e"
                  class="inline-flex items-center gap-1 rounded-pill bg-ink-100 py-1 pl-2.5 pr-1 text-[12px] font-medium text-ink-700"
                >
                  {{ equipLabel(e) }}
                  <button
                    type="button"
                    class="relative grid size-5 place-items-center rounded-full text-ink-500 transition-colors after:absolute after:-inset-3 after:content-[''] hover:bg-ink-300 hover:text-ink-900 md:after:hidden"
                    :aria-label="t('cnt.removeEquipmentAria', { name: equipLabel(e) })"
                    @click="removeEquipment(e)"
                  >
                    <UiIcon name="x" :size="12" />
                  </button>
                </span>
              </div>
              <p v-else class="text-[13px] text-ink-400">{{ t('empty.noEquipment') }}</p>

              <div class="mt-2.5 flex gap-2">
                <UiInput
                  v-model="equipInput"
                  :placeholder="t('cnt.equipmentPlaceholder')"
                  class="min-w-0 flex-1"
                  @keydown.enter.prevent="addEquipment()"
                />
                <UiButton variant="secondary" @click="addEquipment()">
                  <UiIcon name="plus" :size="15" />
                  {{ t('common.add') }}
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
                  + {{ equipLabel(e) }}
                </button>
              </div>
            </div>

            <p v-if="formError" class="mt-3 text-[13px] font-medium text-danger-600">
              {{ formError }}
            </p>

            <div class="mt-4 grid grid-cols-2 gap-3">
              <UiButton variant="ghost" @click="fillForm">
                <UiIcon name="refresh" :size="15" />
                {{ t('common.restore') }}
              </UiButton>
              <UiButton @click="saveUnit">
                <UiIcon name="check" :size="16" />
                {{ t('common.save') }}
              </UiButton>
            </div>
          </template>

          <template v-else>
            <dl class="divide-y divide-ink-100">
              <div class="flex items-center justify-between gap-4 py-2.5">
                <dt class="text-[13px] text-ink-500">{{ field('area') }}</dt>
                <dd class="tabular text-[13px] font-bold text-ink-900">{{ area(selected.area) }}</dd>
              </div>
              <div class="flex items-center justify-between gap-4 py-2.5">
                <dt class="text-[13px] text-ink-500">{{ field('rooms') }}</dt>
                <dd class="tabular text-[13px] font-semibold text-ink-900">{{ selected.rooms }}</dd>
              </div>
              <div class="flex items-center justify-between gap-4 py-2.5">
                <dt class="text-[13px] text-ink-500">{{ field('usage') }}</dt>
                <dd class="text-[13px] font-semibold text-ink-900">
                  {{ unitUsageLabel(selected.usage) || '-' }}
                </dd>
              </div>
              <div class="flex items-center justify-between gap-4 py-2.5">
                <dt class="text-[13px] text-ink-500">{{ field('offer') }}</dt>
                <dd class="text-[13px] font-semibold text-ink-900">
                  {{ offerLabel(selected.offer) || '-' }}
                </dd>
              </div>
              <div class="flex items-start justify-between gap-4 py-2.5">
                <dt class="text-[13px] text-ink-500">{{ field('equipment') }}</dt>
                <dd class="max-w-[60%] text-right text-[13px] font-semibold text-ink-900">
                  {{ selected.equipment.map(equipLabel).join(', ') || '-' }}
                </dd>
              </div>
            </dl>
          </template>
        </UiCard>

        <UiCard
          v-else
          :title="t('nav.unitAttributes')"
          :subtitle="t('cnt.selectPolygonCaption')"
        >
          <div class="flex flex-col items-center gap-3 py-10 text-center">
            <span class="grid size-12 place-items-center rounded-full bg-ink-100 text-ink-500">
              <UiIcon name="box" :size="22" />
            </span>
            <p class="text-[13px] text-ink-500">
              {{ t('cnt.noSelectedUnit') }}
            </p>
            <UiButton v-if="canEdit" variant="secondary" size="sm" @click="addPolygon">
              <UiIcon name="plus" :size="15" />
              {{ t('cnt.addPolygon') }}
            </UiButton>
          </div>
        </UiCard>
      </div>
    </section>
  </main>
</template>
