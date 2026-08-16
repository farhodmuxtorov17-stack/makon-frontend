<script setup lang="ts">
import { buildingById } from '~/data/buildings'
import { unitsOfFloor, type Unit } from '~/data/units'
import { UNIT_STATUS } from '~/constants/statuses'
import { area, num, percent } from '~/utils/format'

const route = useRoute()
const auth = useAuthStore()

const id = computed(() => String(route.params.id))
const floorNo = computed(() => Number(route.params.floor))
const building = computed(() => buildingById(id.value))
const units = computed(() => (building.value ? unitsOfFloor(building.value.id, floorNo.value) : []))

const selectedId = ref(String(route.query.unit ?? ''))
const zoom = ref(1)
const fitMode = ref(false)
const activeStatuses = ref<string[]>([])
const viewOpen = ref(false)
const applyOpen = ref(false)

const STATUS_FILL: Record<string, string> = {
  VACANT: '#16B99A',
  RESERVED: '#FAA53F',
  RENTED: '#0256F7',
  SOLD: '#916CEC',
  MAINTENANCE: '#F84448',
  DRAFT: '#CBD4E3',
}

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

const floorTitle = computed(() =>
  floorNo.value === 0 ? 'Yer osti · texnik qavat' : `${floorNo.value}-qavat`,
)

const floorOptions = computed(() => {
  const b = building.value
  if (!b) return []
  const levels = Array.from({ length: b.floors }, (_, i) => b.floors - i)
  if (b.undergroundFloors) levels.push(0)

  return levels.map((floor) => {
    const count = unitsOfFloor(b.id, floor).length
    const name = floor === 0 ? 'Yer osti · texnik' : `${floor}-qavat`
    return { value: String(floor), label: count ? `${name} · ${count} unit` : name }
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
  return Array.from({ length: b.floors + 1 }, (_, i) => i)
    .map((floor) => ({ floor, count: unitsOfFloor(b.id, floor).length }))
    .filter((f) => f.count > 0)
})

const shapes = computed(() =>
  units.value.map((u) => {
    const points = u.polygon.map((point) => {
      const [x, y] = pointOf(point)
      return [x * 100, y * 100] as [number, number]
    })
    return {
      id: u.id,
      code: u.code,
      status: u.status,
      areaLabel: area(u.area),
      fill: STATUS_FILL[u.status] ?? '#CBD4E3',
      points: points.map((p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' '),
      cx: points.reduce((s, p) => s + p[0], 0) / points.length,
      cy: points.reduce((s, p) => s + p[1], 0) / points.length,
    }
  }),
)

/** Tanlangan unitning reja shakli, modal ichidagi belgini joylash uchun */
const selectedShape = computed(() => {
  const unit = selected.value
  if (!unit) return null
  return shapes.value.find((s) => s.id === unit.id) ?? null
})

const bounds = computed(() => {
  const points = units.value.flatMap((u) => u.polygon)
  if (!points.length) return { x: 0, y: 0, w: 100, h: 100 }
  const xs = points.map((p) => p[0]! * 100)
  const ys = points.map((p) => p[1]! * 100)
  const minX = Math.min(...xs) - 4
  const maxX = Math.max(...xs) + 4
  const minY = Math.min(...ys) - 4
  const maxY = Math.max(...ys) + 4
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
  if (unit.status === 'RESERVED') return 'Bron qilingan, shartnoma tayyorlanmoqda'
  if (unit.status === 'MAINTENANCE') return 'Ta’mir ishlari tugagunicha to‘xtatilgan'
  if (unit.status === 'VACANT') return 'Shartnoma rasmiylashtirilmagan'
  return 'Shartnoma ma’lumotlari kiritilmagan'
}

/**
 * Bo‘sh unit uchun ijara sikli. Tizimga kirmagan foydalanuvchi kirish
 * sahifasiga, ijarachi ariza formasiga yo‘naltiriladi; ish maydoni rollari
 * uchun ariza qaysi kabinetdan yuborilishi tushuntiriladi.
 */
function goApply() {
  const unit = selected.value
  if (!unit || unit.status !== 'VACANT') return
  const next = `/cabinet/apply?unit=${unit.id}`
  if (!auth.isAuthenticated) return navigateTo({ path: '/login', query: { next } })
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
    <main class="scroll-slim flex-1 overflow-y-auto p-6">
      <UiCard>
        <div class="flex flex-col items-center gap-4 py-12 text-center">
          <span class="grid size-14 place-items-center rounded-full bg-warn-50 text-warn-600">
            <UiIcon name="warning" :size="26" />
          </span>
          <p class="text-[15px] font-bold text-ink-900">Bunday obyekt reyestrda yo‘q</p>
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
      :title="`${floorTitle} sketch-rejasi`"
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

    <main class="scroll-slim flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
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
                    class="grid size-9 place-items-center rounded-[8px] text-ink-600 transition-colors hover:bg-brand-50 hover:text-brand-600 disabled:opacity-40"
                    aria-label="Yaqinlashtirish"
                    :disabled="zoom >= 3"
                    @click="zoomIn"
                  >
                    <UiIcon name="plus" :size="18" />
                  </button>
                  <button
                    type="button"
                    class="grid size-9 place-items-center rounded-[8px] text-ink-600 transition-colors hover:bg-brand-50 hover:text-brand-600 disabled:opacity-40"
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
                    class="grid size-9 place-items-center rounded-[8px] transition-colors hover:bg-brand-50 hover:text-brand-600"
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
                    class="grid size-9 place-items-center rounded-[8px] text-ink-600 transition-colors hover:bg-brand-50 hover:text-brand-600"
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
                  :aria-label="`${floorTitle} sketch-rejasi`"
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
                    :opacity="isDimmed(s.status) ? 0.22 : 1"
                    @click="selectedId = s.id"
                  >
                    <title>{{ s.code }} · {{ s.areaLabel }}</title>
                    <polygon
                      :points="s.points"
                      :fill="s.fill"
                      :fill-opacity="selected?.id === s.id ? 0.42 : 0.24"
                      :stroke="selected?.id === s.id ? '#0256F7' : s.fill"
                      :stroke-width="selected?.id === s.id ? 1.4 : 0.7"
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
                    <text
                      :x="s.cx"
                      :y="s.cy + 4.4"
                      text-anchor="middle"
                      font-size="2.5"
                      fill="#64748B"
                    >
                      {{ s.areaLabel }}
                    </text>
                  </g>
                </svg>

                <div v-else class="flex flex-col items-center gap-4 px-6 py-24 text-center">
                  <span class="grid size-14 place-items-center rounded-full bg-ink-100 text-ink-500">
                    <UiIcon name="layers" :size="24" />
                  </span>
                  <div>
                    <p class="text-[14px] font-bold text-ink-900">
                      Ushbu qavat bo‘yicha sketch-reja kiritilmagan
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
              <div class="flex items-start gap-4 py-2.5">
                <dt class="flex w-[128px] shrink-0 items-center gap-2 text-[12.5px] text-ink-500">
                  <UiIcon name="user" :size="15" />
                  Ijarachi / Xaridor
                </dt>
                <dd class="min-w-0 flex-1 text-[13px] font-semibold text-ink-900">
                  {{ selected.tenant ?? '-' }}
                </dd>
              </div>
              <div class="flex items-start gap-4 py-2.5">
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
              <div class="flex items-start gap-4 py-2.5">
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
            <div class="flex items-center justify-between gap-4 py-2.5">
              <dt class="text-[12.5px] text-ink-500">Narxi</dt>
              <dd class="tabular text-[13px] font-bold text-brand-600">
                {{ num(selected.price) }} {{ selected.priceUnit }}
              </dd>
            </div>
            <div class="flex items-center justify-between gap-4 py-2.5">
              <dt class="text-[12.5px] text-ink-500">Ijarachi / Xaridor</dt>
              <dd class="text-[13px] font-semibold text-ink-900">{{ selected.tenant ?? '-' }}</dd>
            </div>
            <div class="flex items-start justify-between gap-4 py-2.5">
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
        :subtitle="`${area(selected.area)} · ${selected.usage} · ${num(selected.price)} ${selected.priceUnit}`"
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
          <UiButton variant="secondary" to="/applications">
            <UiIcon name="clipboard" :size="16" />
            Arizalar navbati
          </UiButton>
        </template>
      </UiModal>
    </main>
  </template>
</template>
