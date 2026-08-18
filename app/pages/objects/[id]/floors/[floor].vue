<script setup lang="ts">
import { buildingById } from '~/data/buildings'
import { unitsOfFloor, type Unit } from '~/data/units'
import { UNIT_STATUS, UNIT_STATUS_COLOR } from '~/constants/statuses'
import { area, num, percent } from '~/utils/format'
import { buildFloorPlan } from '~/utils/floorPlan'

const route = useRoute()
const auth = useAuthStore()

const id = computed(() => String(route.params.id))
const floorNo = computed(() => Number(route.params.floor))
/** Biriktirilmagan obyekt qavat rejasi havolasi orqali ham ochilmaydi */
const building = computed(() => {
  const b = buildingById(id.value)
  return b && auth.inScope(b.id) ? b : undefined
})

/** Ijarachi va narx ma’lumoti faqat ijara oqimida ishlaydigan rollarga ochiq */
const showFinance = computed(
  () => auth.can('application.decide') || auth.can('invoice.create') || auth.can('contract.sign'),
)

/** Arizalar moduli hamma rolga ochiq emas, havola shunga qarab ko‘rsatiladi */
const canOpenApplications = computed(() =>
  auth.canRoute('/applications'),
)
const units = computed(() => (building.value ? unitsOfFloor(building.value.id, floorNo.value) : []))

const selectedId = ref(String(route.query.unit ?? ''))
const zoom = ref(1)
const fitMode = ref(false)
const activeStatuses = ref<string[]>([])
const viewOpen = ref(false)
const applyOpen = ref(false)

/**
 * Reja ranglari umumiy jadvaldan olinadi. Ilgari bu sahifada o‘z jadvali
 * bor edi va «Sotilgan» binafsha, «Ta’mirda» qizil chiqardi — katalogda esa
 * «Sotilgan» qizil. Bitta rang ikki ekranda ikki xil statusni bildirardi.
 */
const STATUS_FILL = UNIT_STATUS_COLOR

const LEGEND = ['VACANT', 'RESERVED', 'RENTED', 'SOLD', 'MAINTENANCE']

/**
 * Polygon nuqtasi ikkita normallashtirilgan koordinatadan iborat. Ma’lumotda
 * koordinata yetishmasa nuqta reja chegarasiga (0) qo‘yiladi.
 */
function pointOf(point: number[]): [number, number] {
  const [x, y] = point
  return [typeof x === 'number' ? x : 0, typeof y === 'number' ? y : 0]
}

const selected = computed<Unit | undefined>(
  () => units.value.find((u) => u.id === selectedId.value) ?? units.value[0],
)

watch(
  () => `${id.value}:${floorNo.value}`,
  () => {
    selectedId.value = ''
    zoom.value = 1
    fitMode.value = false
    activeStatuses.value = []
  },
)

/**
 * Yer osti qavatlari manfiy raqam bilan belgilanadi (-1, -2). Ilgari 2D da
 * ular bitta «0» ga yig‘ilardi, 3D da esa -1 va -2 alohida ko‘rinardi va
 * ikkalasi ham bitta sahifaga olib borardi.
 */
function floorName(floor: number) {
  return floor < 0 ? `${-floor}-yer osti qavati` : `${floor}-qavat`
}

const floorTitle = computed(() => floorName(floorNo.value))

const floorOptions = computed(() => {
  const b = building.value
  if (!b) return []
  const levels = Array.from({ length: b.floors }, (_, i) => b.floors - i)
  for (let k = 1; k <= b.undergroundFloors; k++) levels.push(-k)

  return levels.map((floor) => {
    const count = unitsOfFloor(b.id, floor).length
    const name = floorName(floor)
    // Reja kiritilmagan qavat yashirilmaydi, lekin ochiq aytiladi
    return {
      value: String(floor),
      label: count ? `${name} · ${count} unit` : `${name} · reja kiritilmagan`,
    }
  })
})

const floorValue = computed({
  get: () => String(floorNo.value),
  set: (value: string) => {
    navigateTo(`/objects/${id.value}/floors/${value}`)
  },
})

const floorsWithPlan = computed(() => {
  const b = building.value
  if (!b) return []
  const levels = [
    ...Array.from({ length: b.undergroundFloors }, (_, i) => -(i + 1)),
    ...Array.from({ length: b.floors }, (_, i) => i + 1),
  ]
  return levels
    .map((floor) => ({ floor, count: unitsOfFloor(b.id, floor).length }))
    .filter((f) => f.count > 0)
})

/**
 * Qavatning arxitektura qatlami: tashqi devor, koridor, xizmat yadrosi,
 * eshiklar va fasad derazalari. Geometriya unitlarning haqiqiy maydonidan
 * hisoblanadi, shuning uchun reja metrda va masshtabda bo‘ladi.
 */
const plan = computed(() =>
  buildFloorPlan({
    units: units.value.map((u) => ({ id: u.id, code: u.code, area: u.area })),
    buildingType: building.value?.type ?? 'Biznes markaz',
    floor: floorNo.value,
    underground: floorNo.value === 0,
  }),
)

/** Eshik burilishi: yoy va eshik qanoti */
function doorPath(d: (typeof plan.value.units)[number]['door']) {
  const w = d.width
  const sign = d.facing === 'down' || d.facing === 'right' ? 1 : -1
  if (d.facing === 'down' || d.facing === 'up') {
    const x2 = d.x + w * d.hinge
    return {
      leaf: `M ${d.x} ${d.y} L ${d.x} ${d.y + w * sign}`,
      arc: `M ${d.x} ${d.y + w * sign} A ${w} ${w} 0 0 ${d.hinge * sign > 0 ? 0 : 1} ${x2} ${d.y}`,
      gap: `M ${d.x} ${d.y} L ${x2} ${d.y}`,
    }
  }
  const y2 = d.y + w * d.hinge
  return {
    leaf: `M ${d.x} ${d.y} L ${d.x + w * sign} ${d.y}`,
    arc: `M ${d.x + w * sign} ${d.y} A ${w} ${w} 0 0 ${d.hinge * sign > 0 ? 1 : 0} ${d.x} ${y2}`,
    gap: `M ${d.x} ${d.y} L ${d.x} ${y2}`,
  }
}

const shapes = computed(() => {
  const p = plan.value
  const doors = new Map(p.units.map((u) => [u.id, u.door]))
  return units.value.map((u) => {
    // Saqlangan shakl 0–1 da, reja esa metrda: kontent operatori chizgan
    // o‘zgarish ham shu yerda ko‘rinadi
    const points = u.polygon.map((point) => {
      const [x, y] = pointOf(point)
      return [x * p.width, y * p.height] as [number, number]
    })
    const door = doors.get(u.id)
    return {
      id: u.id,
      code: u.code,
      status: u.status,
      areaLabel: area(u.area),
      fill: STATUS_FILL[u.status] ?? '#CBD4E3',
      points: points.map((q) => `${q[0].toFixed(2)},${q[1].toFixed(2)}`).join(' '),
      cx: points.reduce((s, q) => s + q[0], 0) / points.length,
      cy: points.reduce((s, q) => s + q[1], 0) / points.length,
      door: door ? doorPath(door) : null,
    }
  })
})


/** Chizmadagi harfli o‘qlar */
const AXIS_LETTERS = ['A', 'B', 'V', 'G', 'D', 'E', 'J', 'Z', 'I', 'K', 'L', 'M', 'N', 'O', 'P']

/** Har bir bo‘lim (o‘qlar orasidagi masofa) uchun o‘lcham yozuvi */
const bayLabels = computed(() => {
  const p = plan.value
  const mk = (list: number[]) =>
    list.slice(1).map((v, i) => ({
      at: (v + list[i]!) / 2,
      text: (v - list[i]!).toFixed(1),
    }))
  return { x: mk(p.axes.xs), y: mk(p.axes.ys) }
})

/**
 * Masshtab chizg‘ichi: qavat kengligiga qarab yumaloq o‘lcham tanlanadi,
 * shunda chizmadan masofani ko‘z bilan ham baholash mumkin.
 */
const scaleBar = computed(() => {
  const target = plan.value.width / 5
  const step = [1, 2, 5, 10, 20, 50].find((v) => v >= target) ?? 50
  return { metres: step, label: `${step} m` }
})

/** Reja ostidagi o‘lcham zanjiri: qavatning tashqi eni va bo‘yi */
const planLabel = computed(() => {
  const p = plan.value
  return {
    width: `${p.width.toFixed(1)} m`,
    height: `${p.height.toFixed(1)} m`,
    gross: `${num(Math.round(p.grossArea))} m²`,
    efficiency: `${Math.round(p.efficiency * 100)}%`,
  }
})

/** Tanlangan unitning reja shakli, modal ichidagi belgini joylash uchun */
const selectedShape = computed(() => {
  const unit = selected.value
  if (!unit) return null
  return shapes.value.find((s) => s.id === unit.id) ?? null
})

/** Faqat unitlar ko‘rinadigan chegara, metrda */
const bounds = computed(() => {
  const p = plan.value
  const points = units.value.flatMap((u) => u.polygon)
  if (!points.length) return { x: 0, y: 0, w: p.width, h: p.height }
  const xs = points.map((q) => q[0]! * p.width)
  const ys = points.map((q) => q[1]! * p.height)
  const pad = Math.max(p.width, p.height) * 0.04
  const minX = Math.min(...xs) - pad
  const maxX = Math.max(...xs) + pad
  const minY = Math.min(...ys) - pad
  const maxY = Math.max(...ys) + pad
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
})

/** O‘lcham chizig‘i va shimol ko‘rsatkichi uchun reja atrofida joy qoldiriladi */
const margin = computed(() => Math.max(plan.value.width, plan.value.height) * 0.09)

const viewBox = computed(() => {
  const p = plan.value
  const m = margin.value
  const base = fitMode.value
    ? bounds.value
    : { x: -m, y: -m, w: p.width + m * 2, h: p.height + m * 2 }
  const w = base.w / zoom.value
  const h = base.h / zoom.value
  const cx = base.x + base.w / 2
  const cy = base.y + base.h / 2
  return `${(cx - w / 2).toFixed(2)} ${(cy - h / 2).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)}`
})

/** Chiziq qalinligi va shrift kattaligi qavat o‘lchamiga moslashadi */
const scale = computed(() => Math.max(plan.value.width, plan.value.height) / 100)

const stats = computed(() => {
  const total = units.value.reduce((s, u) => s + u.area, 0)
  const vacant = units.value
    .filter((u) => u.status === 'VACANT')
    .reduce((s, u) => s + u.area, 0)
  return {
    total,
    vacant,
    occupied: total - vacant,
    occupancy: total ? Math.round(((total - vacant) / total) * 100) : 0,
  }
})

function legendCount(status: string) {
  return units.value.filter((u) => u.status === status).length
}

function isDimmed(status: string) {
  return activeStatuses.value.length > 0 && !activeStatuses.value.includes(status)
}

function toggleStatus(status: string) {
  const next = new Set(activeStatuses.value)
  next.has(status) ? next.delete(status) : next.add(status)
  activeStatuses.value = Array.from(next)
}

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

function resetPlan() {
  fitMode.value = false
  zoom.value = 1
  activeStatuses.value = []
  selectedId.value = units.value[0]?.id ?? ''
}

function contractLabel(unit: Unit) {
  if (unit.contractCode) return `Shartnoma imzolangan · ${unit.contractCode}`
  if (unit.status === 'RESERVED') return 'Rezervda, shartnoma tayyorlanmoqda'
  if (unit.status === 'MAINTENANCE') return 'Ta’mir ishlari tugagunicha to‘xtatilgan'
  if (unit.status === 'VACANT') return 'Shartnoma rasmiylashtirilmagan'
  return 'Shartnoma ma’lumotlari kiritilmagan'
}

/** Ariza oynasi sarlavhasida narx faqat moliya huquqi bilan ko‘rinadi */
const applySubtitle = computed(() => {
  const u = selected.value
  if (!u) return ''
  const base = `${area(u.area)} · ${u.usage}`
  return showFinance.value ? `${base} · ${num(u.price)} ${u.priceUnit}` : base
})

/**
 * Bo‘sh unit uchun ijara sikli. Tizimga kirmagan foydalanuvchi ochiq ariza
 * formasiga, ijarachi kabinetdagi ariza formasiga yo‘naltiriladi; ish maydoni
 * rollari uchun ariza qaysi kabinetdan yuborilishi tushuntiriladi.
 */
function goApply() {
  const unit = selected.value
  if (!unit || unit.status !== 'VACANT') return
  const next = `/cabinet/apply?unit=${unit.id}`
  if (!auth.isAuthenticated) {
    viewOpen.value = false
    return navigateTo(`/ariza?unit=${unit.id}`)
  }
  if (auth.role !== 'TENANT_OWNER') {
    applyOpen.value = true
    return
  }
  viewOpen.value = false
  return navigateTo(next)
}
</script>

<template>
  <template v-if="!building">
    <AppTopbar
      title="Obyekt topilmadi"
      :breadcrumb="[{ label: 'Obyektlar', to: '/objects' }, { label: 'Topilmadi' }]"
    />
    <main class="scroll-slim flex-1 overflow-y-auto p-4 sm:p-6">
      <UiCard>
        <div class="flex flex-col items-center gap-4 py-12 text-center">
          <span class="grid size-14 place-items-center rounded-full bg-warn-50 text-warn-600">
            <UiIcon name="warning" :size="26" />
          </span>
          <p class="text-[15px] font-bold text-ink-900">Obyekt mavjud emas</p>
          <p class="max-w-sm text-[13px] leading-relaxed text-ink-500">
            Havola eskirgan yoki obyekt sizga biriktirilmagan bo‘lishi mumkin.
          </p>
          <UiButton to="/objects">
            <UiIcon name="chevronLeft" :size="16" />
            Obyektlar reyestri
          </UiButton>
        </div>
      </UiCard>
    </main>
  </template>

  <template v-else>
    <AppTopbar
      :title="`${floorTitle} rejasi`"
      :subtitle="`${building.name} · xona va unitlar bo‘yicha chuqur ko‘rish`"
      :breadcrumb="[
        { label: 'Obyektlar', to: '/objects' },
        { label: building.name, to: `/objects/${building.id}` },
        { label: floorTitle },
      ]"
    >
      <template #actions>
        <UiButton variant="secondary" size="sm" :to="`/objects/${building.id}/3d`">
          <UiIcon name="cube" :size="16" />
          3D navigator
        </UiButton>
        <UiButton variant="secondary" size="sm" :to="`/objects/${building.id}`">
          <UiIcon name="doc" :size="16" />
          Bino pasporti
        </UiButton>
      </template>
    </AppTopbar>

    <main class="scroll-slim flex-1 space-y-5 overflow-y-auto p-4 sm:p-4 sm:p-6">
      <section class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_368px]">
        <div class="min-w-0 space-y-5">
          <UiCard
            :title="`${floorTitle} rejasi`"
            :subtitle="`${units.length} ta unit · ${area(stats.total)} umumiy maydon`"
            flush
            :padded="false"
          >
            <template #actions>
              <div class="flex items-center gap-2">
                <UiIcon name="layers" :size="16" class="text-brand-500" />
                <UiSelect v-model="floorValue" :options="floorOptions" size="sm" class="w-52" />
              </div>
            </template>

            <div class="px-5 pb-5">
              <div
                class="relative overflow-hidden rounded-panel bg-surface-sunken ring-1 ring-inset ring-ink-100"
              >
                <div
                  class="absolute left-4 top-4 z-10 flex flex-col gap-1 rounded-field bg-surface/90 p-1.5 shadow-card ring-1 ring-ink-200/70"
                >
                  <button
                    type="button"
                    class="grid size-11 md:size-9 place-items-center rounded-[8px] text-ink-600 transition-colors hover:bg-brand-50 hover:text-brand-600 disabled:opacity-40"
                    aria-label="Yaqinlashtirish"
                    :disabled="zoom >= 3"
                    @click="zoomIn"
                  >
                    <UiIcon name="plus" :size="18" />
                  </button>
                  <button
                    type="button"
                    class="grid size-11 md:size-9 place-items-center rounded-[8px] text-ink-600 transition-colors hover:bg-brand-50 hover:text-brand-600 disabled:opacity-40"
                    aria-label="Uzoqlashtirish"
                    :disabled="zoom <= 0.5"
                    @click="zoomOut"
                  >
                    <svg class="size-[18px]" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                      <path
                        d="M4.5 10h11"
                        stroke="currentColor"
                        stroke-width="1.8"
                        stroke-linecap="round"
                      />
                    </svg>
                  </button>
                  <button
                    type="button"
                    class="grid size-11 md:size-9 place-items-center rounded-[8px] transition-colors hover:bg-brand-50 hover:text-brand-600"
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
                    class="grid size-11 md:size-9 place-items-center rounded-[8px] text-ink-600 transition-colors hover:bg-brand-50 hover:text-brand-600"
                    aria-label="Qayta tiklash"
                    @click="resetPlan"
                  >
                    <UiIcon name="refresh" :size="17" />
                  </button>
                </div>

                <span
                  class="tabular absolute right-4 top-4 z-10 rounded-pill bg-surface/90 px-3 py-1 text-[12px] font-semibold text-ink-600 shadow-card"
                >
                  {{ Math.round(zoom * 100) }}%
                </span>

                <svg
                  v-if="shapes.length"
                  :viewBox="viewBox"
                  class="h-[440px] w-full"
                  role="img"
                  :aria-label="`${floorTitle} rejasi, ${planLabel.width} × ${planLabel.height}`"
                >
                  <defs>
                    <pattern
                      id="core-hatch"
                      :width="scale * 1.1"
                      :height="scale * 1.1"
                      patternUnits="userSpaceOnUse"
                      patternTransform="rotate(45)"
                    >
                      <line
                        x1="0"
                        y1="0"
                        x2="0"
                        :y2="scale * 1.1"
                        stroke="#94A2B8"
                        :stroke-width="scale * 0.22"
                      />
                    </pattern>
                  </defs>

                  <!-- Qavat plitasi -->
                  <rect x="0" y="0" :width="plan.width" :height="plan.height" fill="#FFFFFF" />

                  <!-- Koridor: chizmada och kulrang tekislik -->
                  <rect
                    v-for="(c, i) in plan.corridors"
                    :key="`c-${i}`"
                    :x="c.x"
                    :y="c.y"
                    :width="c.w"
                    :height="c.h"
                    fill="#EDF1F7"
                  />
                  <text
                    v-if="plan.corridors[0] && plan.corridors[0].w > scale * 14"
                    :x="plan.corridors[0].x + plan.corridors[0].w / 2"
                    :y="plan.corridors[0].y + plan.corridors[0].h / 2 + scale * 0.55"
                    text-anchor="middle"
                    :font-size="scale * 1.5"
                    fill="#8494AC"
                    letter-spacing="0.3"
                  >
                    KORIDOR
                  </text>

                  <!-- Xizmat yadrosi shtrixlanadi -->
                  <g v-for="(c, i) in plan.core" :key="`k-${i}`">
                    <rect
                      :x="c.rect.x"
                      :y="c.rect.y"
                      :width="c.rect.w"
                      :height="c.rect.h"
                      fill="#F4F6FA"
                    />
                    <rect
                      :x="c.rect.x"
                      :y="c.rect.y"
                      :width="c.rect.w"
                      :height="c.rect.h"
                      fill="url(#core-hatch)"
                    />
                    <text
                      :x="c.rect.x + c.rect.w / 2"
                      :y="c.rect.y + c.rect.h / 2 + scale * 0.5"
                      text-anchor="middle"
                      :font-size="scale * 1.45"
                      fill="#354152"
                      font-weight="600"
                    >
                      {{ c.label }}
                    </text>
                  </g>

                  <!-- Unit maydonlari: holat rangi yengil bo‘yoq sifatida -->
                  <g
                    v-for="s in shapes"
                    :key="s.id"
                    class="cursor-pointer"
                    :opacity="isDimmed(s.status) ? 0.25 : 1"
                    @click="selectedId = s.id"
                  >
                    <title>{{ s.code }} · {{ s.areaLabel }}</title>
                    <polygon
                      :points="s.points"
                      :fill="s.fill"
                      :fill-opacity="selected?.id === s.id ? 0.3 : 0.13"
                    />
                    <polygon
                      v-if="selected?.id === s.id"
                      :points="s.points"
                      fill="none"
                      stroke="#0256F7"
                      :stroke-width="scale * 0.42"
                    />
                  </g>

                  <!-- Devor tanasi: qalinligi bor va to‘ldirib chiziladi -->
                  <rect
                    v-for="(w, i) in plan.walls"
                    :key="`wall-${i}`"
                    :x="w.x"
                    :y="w.y"
                    :width="w.w"
                    :height="w.h"
                    fill="#1F2A3A"
                  />

                  <!-- Deraza: devordagi bo‘shliq va uch ingichka chiziq -->
                  <g v-for="(o, i) in plan.openings" :key="`op-${i}`">
                    <rect :x="o.x" :y="o.y" :width="o.w" :height="o.h" fill="#FFFFFF" />
                    <template v-if="o.w > o.h">
                      <line
                        v-for="k in 3"
                        :key="k"
                        :x1="o.x"
                        :y1="o.y + (o.h * (k - 1)) / 2"
                        :x2="o.x + o.w"
                        :y2="o.y + (o.h * (k - 1)) / 2"
                        stroke="#54617A"
                        :stroke-width="scale * 0.1"
                      />
                    </template>
                    <template v-else>
                      <line
                        v-for="k in 3"
                        :key="k"
                        :x1="o.x + (o.w * (k - 1)) / 2"
                        :y1="o.y"
                        :x2="o.x + (o.w * (k - 1)) / 2"
                        :y2="o.y + o.h"
                        stroke="#54617A"
                        :stroke-width="scale * 0.1"
                      />
                    </template>
                  </g>

                  <!-- Eshik: devordagi tirqish, qanot va burilish yoyi -->
                  <g v-for="s in shapes" :key="`d-${s.id}`">
                    <template v-if="s.door">
                      <path :d="s.door.gap" stroke="#FFFFFF" :stroke-width="plan.wallInner * 2.6" />
                      <path
                        :d="s.door.arc"
                        fill="none"
                        stroke="#8494AC"
                        :stroke-width="scale * 0.12"
                      />
                      <path :d="s.door.leaf" stroke="#354152" :stroke-width="scale * 0.2" />
                    </template>
                  </g>

                  <!-- Unit raqami va maydoni -->
                  <g
                    v-for="s in shapes"
                    :key="`t-${s.id}`"
                    class="pointer-events-none"
                    :opacity="isDimmed(s.status) ? 0.3 : 1"
                  >
                    <text
                      :x="s.cx"
                      :y="s.cy"
                      text-anchor="middle"
                      :font-size="scale * 2.6"
                      font-weight="700"
                      fill="#131C2B"
                    >
                      {{ s.code }}
                    </text>
                    <line
                      :x1="s.cx - scale * 2.2"
                      :y1="s.cy + scale * 0.9"
                      :x2="s.cx + scale * 2.2"
                      :y2="s.cy + scale * 0.9"
                      stroke="#8494AC"
                      :stroke-width="scale * 0.08"
                    />
                    <text
                      :x="s.cx"
                      :y="s.cy + scale * 2.9"
                      text-anchor="middle"
                      :font-size="scale * 1.75"
                      fill="#54617A"
                    >
                      {{ s.areaLabel }}
                    </text>
                  </g>

                  <!-- Koordinata o‘qlari: raqamli va harfli -->
                  <g stroke="#C7D0DE" :stroke-width="scale * 0.07" stroke-dasharray="1.2 0.8">
                    <line
                      v-for="(x, i) in plan.axes.xs"
                      :key="`ax-${i}`"
                      :x1="x"
                      :y1="-margin * 0.42"
                      :x2="x"
                      :y2="plan.height"
                    />
                    <line
                      v-for="(y, i) in plan.axes.ys"
                      :key="`ay-${i}`"
                      :x1="-margin * 0.42"
                      :y1="y"
                      :x2="plan.width"
                      :y2="y"
                    />
                  </g>
                  <g v-for="(x, i) in plan.axes.xs" :key="`axb-${i}`">
                    <circle
                      :cx="x"
                      :cy="-margin * 0.42"
                      :r="scale * 1.5"
                      fill="#FFFFFF"
                      stroke="#8494AC"
                      :stroke-width="scale * 0.1"
                    />
                    <text
                      :x="x"
                      :y="-margin * 0.42 + scale * 0.55"
                      text-anchor="middle"
                      :font-size="scale * 1.5"
                      fill="#354152"
                      font-weight="600"
                    >
                      {{ i + 1 }}
                    </text>
                  </g>
                  <g v-for="(y, i) in plan.axes.ys" :key="`ayb-${i}`">
                    <circle
                      :cx="-margin * 0.42"
                      :cy="y"
                      :r="scale * 1.5"
                      fill="#FFFFFF"
                      stroke="#8494AC"
                      :stroke-width="scale * 0.1"
                    />
                    <text
                      :x="-margin * 0.42"
                      :y="y + scale * 0.55"
                      text-anchor="middle"
                      :font-size="scale * 1.5"
                      fill="#354152"
                      font-weight="600"
                    >
                      {{ AXIS_LETTERS[i] ?? i + 1 }}
                    </text>
                  </g>

                  <!-- O‘lcham zanjiri: bo‘limlar va umumiy o‘lcham -->
                  <g stroke="#54617A" :stroke-width="scale * 0.09" fill="none">
                    <line
                      :x1="0"
                      :y1="plan.height + margin * 0.34"
                      :x2="plan.width"
                      :y2="plan.height + margin * 0.34"
                    />
                    <line
                      v-for="(x, i) in plan.axes.xs"
                      :key="`tk-${i}`"
                      :x1="x - scale * 0.5"
                      :y1="plan.height + margin * 0.34 + scale * 0.5"
                      :x2="x + scale * 0.5"
                      :y2="plan.height + margin * 0.34 - scale * 0.5"
                    />
                    <line
                      :x1="plan.width + margin * 0.34"
                      :y1="0"
                      :x2="plan.width + margin * 0.34"
                      :y2="plan.height"
                    />
                    <line
                      v-for="(y, i) in plan.axes.ys"
                      :key="`tky-${i}`"
                      :x1="plan.width + margin * 0.34 - scale * 0.5"
                      :y1="y + scale * 0.5"
                      :x2="plan.width + margin * 0.34 + scale * 0.5"
                      :y2="y - scale * 0.5"
                    />
                  </g>
                  <text
                    v-for="(seg, i) in bayLabels.x"
                    :key="`dx-${i}`"
                    :x="seg.at"
                    :y="plan.height + margin * 0.34 - scale * 1"
                    text-anchor="middle"
                    :font-size="scale * 1.35"
                    fill="#54617A"
                  >
                    {{ seg.text }}
                  </text>
                  <text
                    :x="plan.width / 2"
                    :y="plan.height + margin * 0.78"
                    text-anchor="middle"
                    :font-size="scale * 1.9"
                    font-weight="600"
                    fill="#354152"
                  >
                    {{ planLabel.width }}
                  </text>
                  <text
                    :x="plan.width + margin * 0.72"
                    :y="plan.height / 2"
                    text-anchor="middle"
                    :font-size="scale * 1.9"
                    font-weight="600"
                    fill="#354152"
                    :transform="`rotate(-90 ${plan.width + margin * 0.72} ${plan.height / 2})`"
                  >
                    {{ planLabel.height }}
                  </text>

                  <!-- Shimol ko‘rsatkichi va masshtab chizg‘ichi -->
                  <g :transform="`translate(${plan.width - scale * 4} ${-margin * 0.5})`">
                    <circle
                      cx="0"
                      cy="0"
                      :r="scale * 2.3"
                      fill="#FFFFFF"
                      stroke="#8494AC"
                      :stroke-width="scale * 0.1"
                    />
                    <path
                      :d="`M 0 ${-scale * 2.3} L ${scale * 0.8} ${scale * 0.6} L 0 ${scale * 0.15} L ${-scale * 0.8} ${scale * 0.6} Z`"
                      fill="#1F2A3A"
                    />
                    <text
                      x="0"
                      :y="-scale * 3"
                      text-anchor="middle"
                      :font-size="scale * 1.4"
                      fill="#54617A"
                      font-weight="700"
                    >
                      SH
                    </text>
                  </g>
                  <g :transform="`translate(0 ${plan.height + margin * 0.92})`">
                    <rect
                      x="0"
                      :y="-scale * 0.5"
                      :width="scaleBar.metres / 2"
                      :height="scale * 0.5"
                      fill="#1F2A3A"
                    />
                    <rect
                      :x="scaleBar.metres / 2"
                      :y="-scale * 0.5"
                      :width="scaleBar.metres / 2"
                      :height="scale * 0.5"
                      fill="#FFFFFF"
                      stroke="#1F2A3A"
                      :stroke-width="scale * 0.07"
                    />
                    <text
                      :x="scaleBar.metres"
                      :y="-scale * 1.2"
                      text-anchor="end"
                      :font-size="scale * 1.3"
                      fill="#54617A"
                    >
                      {{ scaleBar.label }}
                    </text>
                  </g>
                </svg>

                <div v-else class="flex flex-col items-center gap-4 px-6 py-24 text-center">
                  <span class="grid size-14 place-items-center rounded-full bg-ink-100 text-ink-500">
                    <UiIcon name="layers" :size="24" />
                  </span>
                  <div>
                    <p class="text-[14px] font-bold text-ink-900">
                      Ushbu qavat bo‘yicha reja kiritilmagan
                    </p>
                    <p class="mt-1 text-[13px] text-ink-500">
                      Rejasi mavjud qavatlardan birini tanlang.
                    </p>
                  </div>
                  <div v-if="floorsWithPlan.length" class="flex flex-wrap justify-center gap-2">
                    <UiButton
                      v-for="f in floorsWithPlan"
                      :key="f.floor"
                      variant="secondary"
                      size="sm"
                      :to="`/objects/${building.id}/floors/${f.floor}`"
                    >
                      {{ f.floor }}-qavat · {{ f.count }} unit
                    </UiButton>
                  </div>
                </div>
              </div>

              <div class="mt-4 flex flex-wrap items-center gap-2">
                <button
                  v-for="l in LEGEND"
                  :key="l"
                  type="button"
                  class="inline-flex items-center gap-2 rounded-pill px-3 py-1.5 text-[12px] font-semibold ring-1 ring-inset transition-colors"
                  :class="
                    activeStatuses.includes(l)
                      ? 'bg-ink-900 text-white ring-ink-900'
                      : 'text-ink-600 ring-ink-200 hover:bg-ink-100'
                  "
                  @click="toggleStatus(l)"
                >
                  <span class="size-2.5 rounded-full" :style="{ background: STATUS_FILL[l] }" />
                  {{ UNIT_STATUS[l]?.label }}
                  <span class="tabular opacity-70">{{ legendCount(l) }}</span>
                </button>

                <span v-if="activeStatuses.length" class="text-[12px] text-ink-500">
                  Rejada faqat tanlangan holatlar ajratib ko‘rsatilmoqda
                </span>
              </div>
            </div>
          </UiCard>

          <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <UiKpi label="Umumiy maydon" :value="num(stats.total, 2)" unit="m²" icon="layers" tone="brand" />
            <UiKpi label="Band maydon" :value="num(stats.occupied, 2)" unit="m²" icon="check" tone="ok" />
            <UiKpi label="Bo‘sh maydon" :value="num(stats.vacant, 2)" unit="m²" icon="box" tone="warn" />
            <UiKpi label="Qavat bandligi" :value="percent(stats.occupancy)" icon="chart" tone="violet" />
          </section>
        </div>

        <div class="min-w-0 xl:sticky xl:top-[88px] xl:self-start">
          <UiCard
            v-if="selected"
            :title="`Unit ${selected.code}`"
            :subtitle="`${building.name} · ${floorTitle}`"
          >
            <UiStatus kind="unit" :value="selected.status" />

            <dl class="mt-4 divide-y divide-ink-100">
              <div class="flex items-start gap-4 py-2.5">
                <dt class="flex w-[128px] shrink-0 items-center gap-2 text-[12.5px] text-ink-500">
                  <UiIcon name="layers" :size="15" />
                  Maydoni
                </dt>
                <dd class="tabular min-w-0 flex-1 text-[13px] font-bold text-ink-900">
                  {{ area(selected.area) }}
                </dd>
              </div>
              <div class="flex items-start gap-4 py-2.5">
                <dt class="flex w-[128px] shrink-0 items-center gap-2 text-[12.5px] text-ink-500">
                  <UiIcon name="box" :size="15" />
                  Turi
                </dt>
                <dd class="min-w-0 flex-1 text-[13px] font-semibold text-ink-900">
                  {{ selected.usage }} · {{ selected.rooms }} xona
                </dd>
              </div>
              <div v-if="showFinance" class="flex items-start gap-4 py-2.5">
                <dt class="flex w-[128px] shrink-0 items-center gap-2 text-[12.5px] text-ink-500">
                  <UiIcon name="user" :size="15" />
                  Ijarachi / Xaridor
                </dt>
                <dd class="min-w-0 flex-1 text-[13px] font-semibold text-ink-900">
                  {{ selected.tenant ?? '-' }}
                </dd>
              </div>
              <div v-if="showFinance" class="flex items-start gap-4 py-2.5">
                <dt class="flex w-[128px] shrink-0 items-center gap-2 text-[12.5px] text-ink-500">
                  <UiIcon name="wallet" :size="15" />
                  Narxi
                </dt>
                <dd class="tabular min-w-0 flex-1 text-[13px] font-bold text-brand-600">
                  {{ num(selected.price) }} {{ selected.priceUnit }}
                </dd>
              </div>
              <div class="flex items-start gap-4 py-2.5">
                <dt class="flex w-[128px] shrink-0 items-center gap-2 text-[12.5px] text-ink-500">
                  <UiIcon name="wrench" :size="15" />
                  Jihozlar
                </dt>
                <dd class="min-w-0 flex-1">
                  <span class="flex flex-wrap gap-1.5">
                    <span
                      v-for="e in selected.equipment"
                      :key="e"
                      class="rounded-pill bg-ink-100 px-2.5 py-0.5 text-[11.5px] font-medium text-ink-700"
                    >
                      {{ e }}
                    </span>
                  </span>
                </dd>
              </div>
              <div v-if="showFinance" class="flex items-start gap-4 py-2.5">
                <dt class="flex w-[128px] shrink-0 items-center gap-2 text-[12.5px] text-ink-500">
                  <UiIcon name="clipboard" :size="15" />
                  Shartnoma holati
                </dt>
                <dd
                  class="min-w-0 flex-1 text-[13px] font-semibold"
                  :class="selected.contractCode ? 'text-ok-600' : 'text-ink-700'"
                >
                  {{ contractLabel(selected) }}
                </dd>
              </div>
              <div class="flex items-start gap-4 py-2.5">
                <dt class="flex w-[128px] shrink-0 items-center gap-2 text-[12.5px] text-ink-500">
                  <UiIcon name="doc" :size="15" />
                  Taklif turi
                </dt>
                <dd class="min-w-0 flex-1 text-[13px] font-semibold text-ink-900">
                  {{ selected.offer }}
                </dd>
              </div>
            </dl>

            <div class="mt-5 grid gap-3" :class="selected.status === 'VACANT' ? 'grid-cols-2' : ''">
              <UiButton variant="secondary" @click="viewOpen = true">
                <UiIcon name="eye" :size="16" />
                Ko‘rish
              </UiButton>
              <UiButton v-if="selected.status === 'VACANT'" @click="goApply">
                <UiIcon name="key" :size="16" />
                Ariza yuborish
              </UiButton>
            </div>

            <div v-if="units.length > 1" class="mt-5 border-t border-ink-100 pt-4">
              <p class="mb-2 text-[12px] font-semibold text-ink-500">Qavatdagi unitlar</p>
              <div class="flex flex-wrap gap-1.5">
                <button
                  v-for="u in units"
                  :key="u.id"
                  type="button"
                  class="tabular rounded-[8px] px-2.5 py-1.5 text-[12px] font-semibold ring-1 ring-inset transition-colors"
                  :class="
                    selected.id === u.id
                      ? 'bg-brand-500 text-white ring-brand-500'
                      : 'text-ink-600 ring-ink-200 hover:bg-ink-100'
                  "
                  @click="selectedId = u.id"
                >
                  {{ u.code }}
                </button>
              </div>
            </div>
          </UiCard>

          <UiCard v-else title="Unit kartasi" subtitle="Ma’lumot uchun unit tanlang">
            <div class="flex flex-col items-center gap-3 py-10 text-center">
              <span class="grid size-12 place-items-center rounded-full bg-ink-100 text-ink-500">
                <UiIcon name="box" :size="22" />
              </span>
              <p class="text-[13px] text-ink-500">
                Ushbu qavatda unit yozuvlari yo‘q. Boshqa qavatni tanlang.
              </p>
            </div>
          </UiCard>
        </div>
      </section>

      <UiModal
        v-if="selected"
        v-model="viewOpen"
        :title="`Unit ${selected.code}, batafsil`"
        :subtitle="`${building.name} · ${floorTitle}`"
        size="lg"
      >
        <div class="grid gap-5 sm:grid-cols-2">
          <div class="rounded-field bg-surface-sunken p-3 ring-1 ring-inset ring-ink-100">
            <svg viewBox="0 0 100 100" class="h-[210px] w-full" role="img" aria-label="Joylashuv">
              <rect x="1.5" y="3" width="97" height="94" rx="1.2" fill="#FFFFFF" stroke="#E2E8F2" stroke-width="0.7" />
              <polygon
                v-for="s in shapes"
                :key="s.id"
                :points="s.points"
                :fill="s.id === selected.id ? s.fill : '#EEF2F8'"
                :fill-opacity="s.id === selected.id ? 0.5 : 1"
                :stroke="s.id === selected.id ? '#0256F7' : '#CBD4E3'"
                :stroke-width="s.id === selected.id ? 1.4 : 0.5"
              />
              <text
                :x="selectedShape?.cx ?? 50"
                :y="(selectedShape?.cy ?? 50) + 1"
                text-anchor="middle"
                font-size="4"
                font-weight="700"
                fill="#131C2B"
              >
                {{ selected.code }}
              </text>
            </svg>
            <p class="mt-2 text-center text-[12px] text-ink-500">
              Joylashuv: {{ floorTitle }}, {{ building.name }}
            </p>
          </div>

          <dl class="divide-y divide-ink-100">
            <div class="flex items-center justify-between gap-4 py-2.5">
              <dt class="text-[12.5px] text-ink-500">Holati</dt>
              <dd><UiStatus kind="unit" :value="selected.status" size="sm" /></dd>
            </div>
            <div class="flex items-center justify-between gap-4 py-2.5">
              <dt class="text-[12.5px] text-ink-500">Maydoni</dt>
              <dd class="tabular text-[13px] font-bold text-ink-900">{{ area(selected.area) }}</dd>
            </div>
            <div class="flex items-center justify-between gap-4 py-2.5">
              <dt class="text-[12.5px] text-ink-500">Xonalar</dt>
              <dd class="tabular text-[13px] font-semibold text-ink-900">{{ selected.rooms }}</dd>
            </div>
            <div class="flex items-center justify-between gap-4 py-2.5">
              <dt class="text-[12.5px] text-ink-500">Turi</dt>
              <dd class="text-[13px] font-semibold text-ink-900">{{ selected.usage }}</dd>
            </div>
            <div class="flex items-center justify-between gap-4 py-2.5">
              <dt class="text-[12.5px] text-ink-500">Taklif</dt>
              <dd class="text-[13px] font-semibold text-ink-900">{{ selected.offer }}</dd>
            </div>
            <div v-if="showFinance" class="flex items-center justify-between gap-4 py-2.5">
              <dt class="text-[12.5px] text-ink-500">Narxi</dt>
              <dd class="tabular text-[13px] font-bold text-brand-600">
                {{ num(selected.price) }} {{ selected.priceUnit }}
              </dd>
            </div>
            <div v-if="showFinance" class="flex items-center justify-between gap-4 py-2.5">
              <dt class="text-[12.5px] text-ink-500">Ijarachi / Xaridor</dt>
              <dd class="text-[13px] font-semibold text-ink-900">{{ selected.tenant ?? '-' }}</dd>
            </div>
            <div v-if="showFinance" class="flex items-start justify-between gap-4 py-2.5">
              <dt class="text-[12.5px] text-ink-500">Shartnoma</dt>
              <dd class="max-w-[60%] text-right text-[13px] font-semibold text-ink-900">
                {{ contractLabel(selected) }}
              </dd>
            </div>
          </dl>
        </div>

        <div class="mt-5 border-t border-ink-100 pt-4">
          <p class="mb-2 text-[13px] font-semibold text-ink-700">Jihozlar</p>
          <div class="flex flex-wrap gap-2">
            <span
              v-for="e in selected.equipment"
              :key="e"
              class="inline-flex items-center gap-2 rounded-pill bg-ok-50 px-3 py-1.5 text-[12.5px] font-medium text-ok-700 ring-1 ring-inset ring-ok-100"
            >
              <UiIcon name="check" :size="14" />
              {{ e }}
            </span>
          </div>
        </div>

        <template #footer>
          <UiButton variant="ghost" @click="viewOpen = false">Yopish</UiButton>
          <UiButton v-if="selected.status === 'VACANT'" @click="goApply">
            <UiIcon name="key" :size="16" />
            Ariza yuborish
          </UiButton>
        </template>
      </UiModal>

      <UiModal
        v-if="selected"
        v-model="applyOpen"
        :title="`Ariza yuborish: Unit ${selected.code}`"
        :subtitle="applySubtitle"
      >
        <div class="flex gap-3 rounded-field bg-brand-50 p-4 ring-1 ring-inset ring-brand-100">
          <UiIcon name="info" :size="20" class="mt-0.5 shrink-0 text-brand-600" />
          <p class="text-[13.5px] leading-relaxed text-ink-700">
            Ijaraga olish arizasini tashkilot vakili o‘zining shaxsiy kabinetidan yuboradi.
            Ariza kelib tushishi bilan u sizning arizalar navbatingizda paydo bo‘ladi va
            kommersiya taklifini shu yerda tuzasiz.
          </p>
        </div>

        <ol class="mt-4 space-y-3">
          <li
            v-for="(s, i) in [
              'Ijarachi katalogdan unitni tanlab ariza yuboradi',
              'Bino rahbari kommersiya taklifi va to‘lov grafigini tasdiqlaydi',
              'Buxgalter moliyaviy shartlarni tasdiqlaydi, tizim qoralama tuzadi',
              'Didox orqali ikki tomon imzolaydi va shartnoma aktivlashtiriladi',
            ]"
            :key="s"
            class="flex gap-3"
          >
            <span
              class="tabular grid size-6 shrink-0 place-items-center rounded-full bg-brand-500 text-[11px] font-bold text-white"
            >
              {{ i + 1 }}
            </span>
            <span class="text-[13px] leading-relaxed text-ink-700">{{ s }}</span>
          </li>
        </ol>

        <template #footer>
          <UiButton variant="ghost" @click="applyOpen = false">Yopish</UiButton>
          <UiButton v-if="canOpenApplications" variant="secondary" to="/applications">
            <UiIcon name="clipboard" :size="16" />
            Arizalar navbati
          </UiButton>
        </template>
      </UiModal>
    </main>
  </template>
</template>
