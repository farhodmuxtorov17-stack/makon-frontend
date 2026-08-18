<script setup lang="ts">
import { useStorage } from '@vueuse/core'
import { buildingBySlug } from '~/data/buildings'
import { unitsOfBuilding, type Unit } from '~/data/units'
import { UNIT_STATUS, UNIT_STATUS_COLOR } from '~/constants/statuses'
import { buildFloorPlan } from '~/utils/floorPlan'
import { num, sum, area } from '~/utils/format'

definePageMeta({ layout: 'public' })

/** Rang ham, nom ham status registridan: legenda va reja bir xil gapiradi */
const STATUS_COLOR = UNIT_STATUS_COLOR

const LEGEND = (['VACANT', 'RENTED', 'RESERVED', 'SOLD', 'MAINTENANCE'] as const).map((key) => ({
  label: UNIT_STATUS[key]!.label,
  color: STATUS_COLOR[key],
}))

const VIEW_LABELS = ['Bosh fasad', 'Yon ko‘rinish', 'Kirish va atrof', 'Umumiy ko‘rinish']

const route = useRoute()
const auth = useAuthStore()
const building = computed(() => buildingBySlug(String(route.params.slug)))
const units = computed(() => (building.value ? unitsOfBuilding(building.value.id) : []))
const floors = computed(() => [...new Set(units.value.map((u) => u.floor))].sort((a, b) => a - b))

const startUnit =
  units.value.find((u) => u.id === String(route.query.unit ?? '')) ??
  units.value.find((u) => u.status === 'VACANT') ??
  units.value[0]

const activeFloor = ref(startUnit?.floor ?? 0)
const selectedId = ref(startUnit?.id ?? '')

const mainView = ref(0)
const lightboxOpen = ref(false)
const offerOpen = ref(false)
const viewOpen = ref(false)
/** Sevimlilar sarlavhadagi nishoncha va katalog ro‘yxati bilan bitta xotirada */
const favourites = useStorage<string[]>('makon.favourites', [])

const photos = computed(() =>
  (building.value?.gallery ?? []).map((name, i) => ({
    name,
    label:
      name === 'interior-office'
        ? 'Ichki maydon'
        : (VIEW_LABELS[i] ?? `${i + 1}-ko‘rinish`),
  })),
)

const activePhoto = computed(() => photos.value[mainView.value] ?? photos.value[0])

const interiorPhoto = computed(() =>
  building.value?.gallery.includes('interior-office') ? 'interior-office' : (building.value?.photo ?? ''),
)

function stepPhoto(dir: number) {
  const n = photos.value.length
  if (n < 2) return
  mainView.value = (mainView.value + dir + n) % n
}

onKeyStroke('ArrowLeft', () => {
  if (lightboxOpen.value) stepPhoto(-1)
})

onKeyStroke('ArrowRight', () => {
  if (lightboxOpen.value) stepPhoto(1)
})

/**
 * Ommaviy katalog tayyor bo‘lmagan yozuvni ko‘rsatmaydi: qoralama,
 * yashirilgan va arxivlangan unitlar faqat ichki reyestrda qoladi.
 */
const PUBLIC_HIDDEN = ['DRAFT', 'HIDDEN', 'ARCHIVED']

const floorUnits = computed(() =>
  units.value.filter((u) => u.floor === activeFloor.value && !PUBLIC_HIDDEN.includes(u.status)),
)
const floorVacant = computed(() => floorUnits.value.filter((u) => u.status === 'VACANT'))
const selected = computed(() => units.value.find((u) => u.id === selectedId.value))

const floorStats = computed(() => {
  const total = floorUnits.value.reduce((s, u) => s + u.area, 0)
  const vacant = floorVacant.value.reduce((s, u) => s + u.area, 0)
  return [
    { label: 'Umumiy maydon', value: `${num(total, 1)} m²`, tone: 'text-ink-900' },
    { label: 'Bo‘sh maydon', value: `${num(vacant, 1)} m²`, tone: 'text-ok-600' },
    { label: 'Band maydon', value: `${num(total - vacant, 1)} m²`, tone: 'text-brand-600' },
    { label: 'Unitlar soni', value: `${floorUnits.value.length} ta`, tone: 'text-ink-900' },
    { label: 'Bo‘sh unitlar', value: `${floorVacant.value.length} ta`, tone: 'text-ok-600' },
  ]
})

function pickFloor(f: number) {
  activeFloor.value = f
  const first = units.value.find((u) => u.floor === f && u.status === 'VACANT')
  selectedId.value = first?.id ?? ''
}

function stepFloor(dir: number) {
  const i = floors.value.indexOf(activeFloor.value)
  const next = floors.value[i + dir]
  if (next !== undefined) pickFloor(next)
}

/**
 * Reja obyekt kartochkasidagi bilan bir xil nisbatda chizilishi kerak,
 * shuning uchun koordinatalar kvadratga emas, qavatning haqiqiy o‘lchamiga
 * (metrga) o‘tkaziladi.
 */
const plan = computed(() =>
  buildFloorPlan({
    units: floorUnits.value.map((u) => ({ id: u.id, code: u.code, area: u.area })),
    buildingType: building.value?.type ?? 'Biznes markaz',
    floor: activeFloor.value,
    underground: activeFloor.value === 0,
  }),
)

const planBox = computed(() => `0 0 ${plan.value.width.toFixed(2)} ${plan.value.height.toFixed(2)}`)

/** Chiziq va shrift o‘lchami qavat kattaligiga moslashadi */
const planScale = computed(() => Math.max(plan.value.width, plan.value.height) / 100)

function points(u: Unit) {
  const p = plan.value
  return u.polygon
    .map(([x, y]) => `${((x ?? 0) * p.width).toFixed(2)},${((y ?? 0) * p.height).toFixed(2)}`)
    .join(' ')
}

function centre(u: Unit) {
  const p = plan.value
  const xs = u.polygon.map((q) => q[0] ?? 0)
  const ys = u.polygon.map((q) => q[1] ?? 0)
  return {
    x: ((Math.min(...xs) + Math.max(...xs)) / 2) * p.width,
    y: ((Math.min(...ys) + Math.max(...ys)) / 2) * p.height,
  }
}

function amenityIcon(text: string) {
  const t = text.toLowerCase()
  if (t.includes('qo‘riqlash')) return 'shield'
  if (t.includes('internet')) return 'globe'
  if (t.includes('isitish') || t.includes('sovitish')) return 'meter'
  if (t.includes('lift') || t.includes('eskalator')) return 'layers'
  if (t.includes('yong‘in')) return 'warning'
  if (t.includes('parkovka') || t.includes('yo‘l')) return 'cube'
  if (t.includes('bolalar') || t.includes('konferens')) return 'users'
  if (t.includes('fitnes')) return 'sparkle'
  if (t.includes('kran') || t.includes('platforma')) return 'wrench'
  return 'check'
}

const infoRows = computed(() => {
  const b = building.value
  if (!b) return []
  return [
    { icon: 'building', label: 'Bino klassi', value: b.buildingClass },
    { icon: 'calendar', label: 'Qurilgan yil', value: `${b.buildYear}-yil` },
    { icon: 'layers', label: 'Umumiy maydon', value: `${num(b.gla)} m²` },
    { icon: 'box', label: 'Ijara uchun mavjud maydon', value: `${num(b.vacantArea)} m²` },
    {
      icon: 'dashboard',
      label: 'Qavatlar soni',
      value: b.undergroundFloors
        ? `${b.floors} qavat + ${b.undergroundFloors} yer osti`
        : `${b.floors} qavat`,
    },
    {
      icon: 'cube',
      label: 'Parkovka',
      value: b.undergroundFloors
        ? `Yer osti (${b.undergroundFloors} qavat) va yer usti`
        : 'Yer usti',
    },
    { icon: 'clipboard', label: 'Bo‘sh unitlar', value: `${b.vacantUnits} ta / ${b.units} ta` },
    { icon: 'clock', label: 'Xizmat ko‘rsatish darajasi', value: `${b.sla}%` },
  ]
})

const addressRows = computed(() => {
  const b = building.value
  if (!b) return []
  return [
    { icon: 'location', label: 'Manzil', value: b.street },
    { icon: 'building', label: 'Tuman', value: b.district },
    { icon: 'globe', label: 'Shahar', value: b.city },
    {
      icon: 'target',
      label: 'Koordinatalar',
      value: `${num(b.lat, 4)}° N, ${num(b.lon, 4)}° E`,
    },
  ]
})

const mapMarkers = computed(() => {
  const b = building.value
  if (!b) return []
  return [
    {
      id: b.id,
      lat: b.lat,
      lon: b.lon,
      label: b.name,
      caption: `${b.district} · ${b.street}`,
      tone: 'brand' as const,
    },
  ]
})

const mapStats = computed(() => {
  const b = building.value
  if (!b) return []
  return [
    { label: 'Bo‘sh unitlar', value: `${b.vacantUnits} ta` },
    { label: 'Bino klassi', value: b.buildingClass },
  ]
})

/** Loyihada saqlangan plitkalar 14-masshtabda faqat markaziy oynani qoplaydi */
const mapZoom = computed(() => {
  const b = building.value
  if (!b) return 12
  const inner = b.lon >= 69.19 && b.lon <= 69.4 && b.lat >= 41.25 && b.lat <= 41.38
  return inner ? 14 : 12
})

const priceInfo = computed(() => {
  const u = selected.value
  if (!u) return null
  const monthly = u.priceUnit === 'so‘m / oy'
  return {
    perLabel: monthly ? 'Narx (so‘m / m² / oy)' : 'Narx (so‘m / m²)',
    perValue: sum(Math.round(monthly ? u.price / u.area : u.price)),
    totalLabel: monthly ? 'Umumiy narx / oy' : 'Umumiy narx',
    totalValue: sum(Math.round(monthly ? u.price : u.price * u.area)),
  }
})

const readiness = computed(() => {
  const u = selected.value
  if (!u) return ''
  if (u.status === 'VACANT') return 'Foydalanishga tayyor'
  if (u.status === 'MAINTENANCE') return 'Ta’mirlash ishlari olib borilmoqda'
  if (u.status === 'RESERVED') return 'Rezervda, ariza ko‘rikda'
  return 'Band: hozircha mavjud emas'
})

const summary = computed(() => {
  const b = building.value
  if (!b) return null
  const u = selected.value
  if (u && u.status === 'VACANT' && priceInfo.value) {
    return {
      eyebrow: `Unit ${u.code} · ${u.usage}`,
      label: priceInfo.value.totalLabel,
      value: priceInfo.value.totalValue,
      tiles: [
        { label: 'Umumiy maydon', value: area(u.area) },
        { label: 'Qavat', value: `${u.floor}-qavat` },
      ],
    }
  }
  return {
    eyebrow: `${b.type} · ${b.buildingClass}`,
    label: 'Ijaraga tayyor maydon',
    value: `${num(b.vacantArea)} m²`,
    tiles: [
      { label: 'Bo‘sh unitlar', value: `${b.vacantUnits} ta` },
      { label: 'Qavatlar', value: `${b.floors} ta` },
    ],
  }
})

function toggleFavourite(id: string) {
  favourites.value = favourites.value.includes(id)
    ? favourites.value.filter((f) => f !== id)
    : [...favourites.value, id]
}

function openPhoto(i: number) {
  mainView.value = i
  lightboxOpen.value = true
}

/**
 * «Ariza yuborish»: bo‘sh unit uchun ariza yo‘li. Tizimga kirmagan
 * foydalanuvchi ochiq ariza formasiga, ijarachi esa kabinetdagi ariza
 * formasiga yuboriladi.
 */
function goApply(unitId?: string) {
  const id = unitId ?? selected.value?.id
  if (!id) return
  const next = `/cabinet/apply?unit=${id}`
  if (!auth.isAuthenticated) {
    viewOpen.value = false
    return navigateTo(`/ariza?unit=${id}`)
  }
  if (auth.role !== 'TENANT_OWNER') {
    offerOpen.value = true
    return
  }
  viewOpen.value = false
  return navigateTo(next)
}

function goToOffer() {
  viewOpen.value = false
  goApply()
}
</script>

<template>
  <div class="mx-auto max-w-[1360px] px-4 py-6 lg:px-8 lg:py-8">
    <template v-if="building">
      <nav class="flex flex-wrap items-center gap-1.5 text-[12.5px]">
        <NuxtLink to="/" class="text-ink-500 transition-colors hover:text-brand-600">
          Bosh sahifa
        </NuxtLink>
        <UiIcon name="chevronRight" :size="12" class="text-ink-300" />
        <NuxtLink to="/catalog" class="text-ink-500 transition-colors hover:text-brand-600">
          Katalog
        </NuxtLink>
        <UiIcon name="chevronRight" :size="12" class="text-ink-300" />
        <span class="text-ink-700">{{ building.name }}</span>
      </nav>

      <header class="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2.5">
            <h1 class="text-2xl font-bold leading-tight">{{ building.name }}</h1>
            <UiStatus kind="contract" :value="building.status" size="sm" />
          </div>
          <p class="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px] text-ink-500">
            <UiIcon name="location" :size="15" class="text-ink-400" />
            {{ building.city }}, {{ building.district }}, {{ building.street }}
            <span class="text-ink-300">·</span>
            {{ building.type }}
            <span class="text-ink-300">·</span>
            {{ building.buildingClass }}
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2.5">
          <UiButton variant="secondary" size="sm" to="/catalog">
            <UiIcon name="chevronLeft" :size="16" />
            Katalogga qaytish
          </UiButton>
          <UiButton
            v-if="selected && selected.status === 'VACANT'"
            size="sm"
            @click="goApply(selected.id)"
          >
            <UiIcon name="key" :size="16" />
            Ariza yuborish
          </UiButton>
        </div>
      </header>

      <div class="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_384px]">
        <div class="min-w-0 space-y-5">
          <section class="rounded-card bg-surface p-4 shadow-card ring-1 ring-ink-200/60 sm:p-5">
            <UiPhoto
              v-if="activePhoto"
              :name="activePhoto.name"
              :alt="`${building.name}: ${activePhoto.label}`"
              ratio="aspect-[16/9]"
              rounded="rounded-panel"
              sizes="(max-width: 1280px) 100vw, 840px"
              eager
            >
              <span
                class="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink-900/80 via-ink-900/10 to-ink-900/25"
              />

              <span
                class="absolute left-4 top-4 rounded-pill bg-white/95 px-3 py-1.5 text-[12px] font-bold text-ink-800 shadow-card"
              >
                {{ building.type }}
              </span>

              <button
                type="button"
                class="absolute right-4 top-4 inline-flex min-h-10 items-center gap-2 rounded-pill bg-white/95 px-3.5 text-[12.5px] font-bold text-ink-800 shadow-card transition-colors duration-150 hover:bg-white"
                @click="openPhoto(mainView)"
              >
                <UiIcon name="image" :size="16" />
                Galereya · {{ photos.length }}
              </button>

              <span class="absolute bottom-4 left-4 text-[13px] font-semibold text-white">
                {{ activePhoto.label }}
              </span>

              <template v-if="photos.length > 1">
                <button
                  type="button"
                  class="absolute left-4 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink-700 shadow-pop transition-transform duration-150 hover:scale-105"
                  aria-label="Oldingi surat"
                  @click="stepPhoto(-1)"
                >
                  <UiIcon name="chevronLeft" :size="20" />
                </button>
                <button
                  type="button"
                  class="absolute right-4 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink-700 shadow-pop transition-transform duration-150 hover:scale-105"
                  aria-label="Keyingi surat"
                  @click="stepPhoto(1)"
                >
                  <UiIcon name="chevronRight" :size="20" />
                </button>
              </template>
            </UiPhoto>

            <div v-if="photos.length > 1" class="mt-3 grid grid-cols-4 gap-2.5 sm:grid-cols-5">
              <button
                v-for="(p, i) in photos"
                :key="p.name"
                type="button"
                class="overflow-hidden rounded-[10px] ring-1 transition-all duration-150"
                :class="mainView === i ? 'ring-2 ring-brand-500' : 'ring-ink-200 hover:ring-brand-300'"
                :aria-label="p.label"
                :aria-pressed="mainView === i"
                @click="mainView = i"
              >
                <UiPhoto
                  :name="p.name"
                  :alt="p.label"
                  ratio="aspect-[4/3]"
                  rounded="rounded-none"
                  sizes="160px"
                />
              </button>

              <button
                type="button"
                class="grid aspect-[4/3] place-items-center rounded-[10px] bg-ink-800 text-[12.5px] font-bold text-white transition-colors duration-150 hover:bg-ink-900"
                @click="openPhoto(mainView)"
              >
                Barchasi
              </button>
            </div>
          </section>

          <section class="rounded-card bg-surface p-5 shadow-card ring-1 ring-ink-200/60">
            <h2 class="text-[17px] font-bold">Obyekt haqida</h2>
            <dl class="mt-4 grid gap-x-6 sm:grid-cols-2">
              <div
                v-for="r in infoRows"
                :key="r.label"
                class="flex items-center gap-3 border-b border-ink-100 py-3 last:border-0"
              >
                <span
                  class="grid size-9 shrink-0 place-items-center rounded-[10px] bg-brand-50 text-brand-600"
                >
                  <UiIcon :name="r.icon" :size="17" />
                </span>
                <dt class="min-w-0 flex-1 text-[13px] text-ink-500">{{ r.label }}</dt>
                <dd class="tabular max-w-[52%] text-right text-[13.5px] font-semibold text-ink-900">
                  {{ r.value }}
                </dd>
              </div>
            </dl>
          </section>

          <section class="rounded-card bg-surface p-5 shadow-card ring-1 ring-ink-200/60">
            <h2 class="text-[17px] font-bold">Qulayliklar</h2>
            <div class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div
                v-for="a in building.amenities"
                :key="a"
                class="flex items-center gap-3 rounded-field bg-surface-sunken px-3.5 py-3"
              >
                <span
                  class="grid size-10 shrink-0 place-items-center rounded-[11px] bg-brand-50 text-brand-600"
                >
                  <UiIcon :name="amenityIcon(a)" :size="19" />
                </span>
                <span class="text-[13px] font-semibold leading-snug text-ink-800">{{ a }}</span>
              </div>
            </div>
          </section>

          <section class="rounded-card bg-surface p-5 shadow-card ring-1 ring-ink-200/60">
            <h2 class="text-[17px] font-bold">Qavatlar bo‘yicha tanlash</h2>

            <template v-if="floors.length">
              <div class="mt-4 flex items-center gap-2">
                <button
                  type="button"
                  class="grid size-10 shrink-0 place-items-center rounded-field text-ink-600 ring-1 ring-inset ring-ink-200 transition-colors duration-150 hover:bg-ink-100 disabled:cursor-not-allowed disabled:opacity-40"
                  :disabled="floors.indexOf(activeFloor) <= 0"
                  aria-label="Oldingi qavat"
                  @click="stepFloor(-1)"
                >
                  <UiIcon name="chevronLeft" :size="17" />
                </button>

                <div class="scroll-slim flex flex-1 gap-2 overflow-x-auto">
                  <button
                    v-for="f in floors"
                    :key="f"
                    type="button"
                    class="tabular h-10 shrink-0 rounded-field px-4 text-[13px] font-semibold transition-colors duration-150"
                    :class="
                      activeFloor === f
                        ? 'bg-brand-500 text-white shadow-brand'
                        : 'text-ink-700 ring-1 ring-inset ring-ink-200 hover:bg-ink-100'
                    "
                    :aria-pressed="activeFloor === f"
                    @click="pickFloor(f)"
                  >
                    {{ f }}-qavat
                  </button>
                </div>

                <button
                  type="button"
                  class="grid size-10 shrink-0 place-items-center rounded-field text-ink-600 ring-1 ring-inset ring-ink-200 transition-colors duration-150 hover:bg-ink-100 disabled:cursor-not-allowed disabled:opacity-40"
                  :disabled="floors.indexOf(activeFloor) >= floors.length - 1"
                  aria-label="Keyingi qavat"
                  @click="stepFloor(1)"
                >
                  <UiIcon name="chevronRight" :size="17" />
                </button>
              </div>

              <div class="mt-5 grid gap-5 lg:grid-cols-[minmax(0,240px)_minmax(0,1fr)]">
                <div class="rounded-card bg-surface-sunken p-4 ring-1 ring-inset ring-ink-200">
                  <h3 class="text-[14px] font-bold">{{ activeFloor }}-qavat haqida</h3>
                  <ul class="mt-3 space-y-2.5">
                    <li
                      v-for="s in floorStats"
                      :key="s.label"
                      class="flex items-center justify-between gap-3"
                    >
                      <span class="text-[13px] text-ink-500">{{ s.label }}</span>
                      <span class="tabular text-[13px] font-bold" :class="s.tone">
                        {{ s.value }}
                      </span>
                    </li>
                  </ul>
                </div>

                <div class="min-w-0">
                  <div class="rounded-card bg-surface-sunken p-3 ring-1 ring-inset ring-ink-200">
                    <svg
                      :viewBox="planBox"
                      class="block w-full"
                      role="group"
                      :aria-label="`${activeFloor}-qavat rejasi, unitni tanlang`"
                    >
                      <rect
                        x="0"
                        y="0"
                        :width="plan.width"
                        :height="plan.height"
                        fill="#FFFFFF"
                        stroke="#354152"
                        :stroke-width="plan.wallOuter"
                      />
                      <rect
                        v-for="(c, i) in plan.corridors"
                        :key="`c-${i}`"
                        :x="c.x"
                        :y="c.y"
                        :width="c.w"
                        :height="c.h"
                        fill="#F1F5FB"
                      />
                      <rect
                        v-for="(c, i) in plan.core"
                        :key="`k-${i}`"
                        :x="c.rect.x"
                        :y="c.rect.y"
                        :width="c.rect.w"
                        :height="c.rect.h"
                        fill="#E3E9F2"
                        stroke="#8494AC"
                        :stroke-width="plan.wallInner"
                      />
                      <g
                        v-for="u in floorUnits"
                        :key="u.id"
                        role="button"
                        tabindex="0"
                        :aria-pressed="selectedId === u.id"
                        :aria-label="`Unit ${u.code}, ${UNIT_STATUS[u.status]?.label ?? u.status}, ${area(u.area)}`"
                        class="cursor-pointer outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500"
                        @click="selectedId = u.id"
                        @keydown.enter.prevent="selectedId = u.id"
                        @keydown.space.prevent="selectedId = u.id"
                      >
                        <polygon
                          :points="points(u)"
                          :fill="STATUS_COLOR[u.status] ?? '#94A2B8'"
                          :fill-opacity="selectedId === u.id ? 0.4 : 0.16"
                          :stroke="STATUS_COLOR[u.status] ?? '#94A2B8'"
                          :stroke-width="selectedId === u.id ? plan.wallInner * 3 : plan.wallInner * 1.6"
                          stroke-linejoin="round"
                        />
                        <text
                          :x="centre(u).x"
                          :y="centre(u).y - planScale * 0.4"
                          text-anchor="middle"
                          :font-size="planScale * 4.4"
                          font-weight="700"
                          fill="#131C2B"
                        >
                          {{ u.code }}
                        </text>
                        <text
                          :x="centre(u).x"
                          :y="centre(u).y + planScale * 4.6"
                          text-anchor="middle"
                          :font-size="planScale * 3.2"
                          :fill="STATUS_COLOR[u.status] ?? '#64748B'"
                        >
                          {{ UNIT_STATUS[u.status]?.label ?? u.status }}
                        </text>
                      </g>
                    </svg>
                  </div>

                  <ul class="mt-3 flex flex-wrap gap-x-5 gap-y-2">
                    <li
                      v-for="l in LEGEND"
                      :key="l.label"
                      class="flex items-center gap-2 text-[12.5px] text-ink-600"
                    >
                      <span class="size-2.5 rounded-full" :style="{ backgroundColor: l.color }" />
                      {{ l.label }}
                    </li>
                  </ul>
                </div>
              </div>
            </template>

            <p v-else class="mt-4 text-[13.5px] text-ink-500">
              Ushbu obyekt bo‘yicha qavat rejalari hozircha katalogda ochiq emas. Bo‘sh maydonlar
              bo‘yicha ma’lumot olish uchun tizimga kiring.
            </p>
          </section>

          <section class="rounded-card bg-surface p-5 shadow-card ring-1 ring-ink-200/60">
            <div class="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 class="text-[17px] font-bold">Joylashuv</h2>
                <p class="mt-1 text-[13px] text-ink-500">
                  {{ building.district }}, {{ building.city }} · {{ building.street }}
                </p>
              </div>
              <span
                class="rounded-pill bg-brand-50 px-3 py-1.5 text-[12px] font-semibold text-brand-700"
              >
                {{ building.district }}
              </span>
            </div>

            <div class="mt-4 grid gap-4 lg:grid-cols-[minmax(0,244px)_minmax(0,1fr)]">
              <ul class="space-y-2.5">
                <li
                  v-for="r in addressRows"
                  :key="r.label"
                  class="flex items-start gap-3 rounded-field bg-surface-sunken px-3.5 py-3"
                >
                  <span
                    class="grid size-8 shrink-0 place-items-center rounded-[9px] bg-white text-brand-600 ring-1 ring-ink-200"
                  >
                    <UiIcon :name="r.icon" :size="16" />
                  </span>
                  <span class="min-w-0">
                    <span class="block text-[11.5px] uppercase tracking-wide text-ink-500">
                      {{ r.label }}
                    </span>
                    <span class="tabular block text-[13px] font-semibold text-ink-900">
                      {{ r.value }}
                    </span>
                  </span>
                </li>
              </ul>

              <UiMap
                :markers="mapMarkers"
                :center="{ lat: building.lat, lon: building.lon }"
                :stats="mapStats"
                :zoom="mapZoom"
                :min-zoom="12"
                :max-zoom="mapZoom"
                :auto-fit="false"
                height="360px"
              />
            </div>
          </section>
        </div>

        <div class="min-w-0 space-y-5">
          <aside
            v-if="summary"
            class="rounded-card bg-surface p-5 shadow-card ring-1 ring-ink-200/60 xl:sticky xl:top-[88px] xl:z-10"
          >
            <p class="truncate text-[11.5px] font-semibold uppercase tracking-wide text-ink-500">
              {{ summary.eyebrow }}
            </p>
            <p class="mt-2 text-[12.5px] font-medium text-ink-500">{{ summary.label }}</p>
            <p class="tabular mt-0.5 text-[26px] font-extrabold leading-tight text-brand-700">
              {{ summary.value }}
            </p>

            <dl class="mt-4 grid grid-cols-2 gap-3">
              <div
                v-for="t in summary.tiles"
                :key="t.label"
                class="rounded-field bg-surface-sunken px-3.5 py-2.5"
              >
                <dt class="text-[11.5px] uppercase tracking-wide text-ink-500">{{ t.label }}</dt>
                <dd class="tabular mt-0.5 text-[15px] font-bold text-ink-900">{{ t.value }}</dd>
              </div>
            </dl>

            <UiButton
              v-if="selected && selected.status === 'VACANT'"
              block
              class="mt-4"
              @click="goApply(selected.id)"
            >
              <UiIcon name="key" :size="17" />
              Ariza yuborish
            </UiButton>
            <UiButton v-else variant="secondary" block class="mt-4" to="/catalog">
              <UiIcon name="search" :size="17" />
              Bo‘sh joylarni ko‘rish
            </UiButton>
          </aside>

          <section class="rounded-card bg-surface p-5 shadow-card ring-1 ring-ink-200/60">
            <h2 class="text-[15px] font-bold">Bo‘sh unitlar ({{ activeFloor }}-qavat)</h2>

            <ul v-if="floorVacant.length" class="mt-3 space-y-2.5">
              <li v-for="u in floorVacant" :key="u.id">
                <button
                  type="button"
                  class="flex w-full items-center gap-3 rounded-field px-4 py-3 text-left transition-colors duration-150"
                  :class="
                    selectedId === u.id
                      ? 'bg-brand-50 ring-2 ring-inset ring-brand-500'
                      : 'ring-1 ring-inset ring-ink-200 hover:bg-ink-50'
                  "
                  :aria-pressed="selectedId === u.id"
                  @click="selectedId = u.id"
                >
                  <span class="min-w-0 flex-1">
                    <span class="block text-[14px] font-bold text-ink-900">Unit {{ u.code }}</span>
                    <span class="block text-[12.5px] font-semibold text-ok-600">Bo‘sh</span>
                  </span>
                  <span class="shrink-0 text-right">
                    <span class="tabular block text-[14px] font-bold text-ink-900">
                      {{ area(u.area) }}
                    </span>
                    <span class="block text-[12px] text-ink-500">Umumiy maydon</span>
                  </span>
                  <UiIcon name="chevronRight" :size="17" class="shrink-0 text-ink-400" />
                </button>
              </li>
            </ul>

            <div
              v-else
              class="mt-3 rounded-field bg-surface-sunken px-4 py-6 text-center ring-1 ring-inset ring-ink-200"
            >
              <span class="mx-auto grid size-11 place-items-center rounded-full bg-ink-100 text-ink-400">
                <UiIcon name="clipboard" :size="20" />
              </span>
              <p class="mt-3 text-[13px] leading-relaxed text-ink-600">
                Ushbu qavatda hozircha bo‘sh unit yo‘q. Boshqa qavatni tanlang yoki katalogdagi
                barcha bo‘sh joylarni ko‘ring.
              </p>
            </div>

            <UiButton variant="secondary" size="sm" block class="mt-3" to="/catalog">
              <UiIcon name="search" :size="16" />
              Katalogdagi barcha bo‘sh joylar
            </UiButton>
          </section>

          <section
            v-if="selected && selected.status === 'VACANT' && priceInfo"
            class="rounded-card bg-surface p-5 shadow-card ring-1 ring-ink-200/60"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="flex items-center gap-2.5">
                <h2 class="text-[17px] font-bold">Unit {{ selected.code }}</h2>
                <UiStatus kind="unit" :value="selected.status" size="sm" />
              </div>
              <button
                type="button"
                class="grid size-10 shrink-0 place-items-center rounded-full ring-1 ring-inset transition-colors duration-150"
                :class="
                  favourites.includes(selected.id)
                    ? 'text-danger-500 ring-danger-100'
                    : 'text-ink-400 ring-ink-200 hover:text-danger-500'
                "
                :aria-pressed="favourites.includes(selected.id)"
                aria-label="Sevimlilarga qo‘shish"
                @click="toggleFavourite(selected.id)"
              >
                <svg
                  class="size-[18px]"
                  viewBox="0 0 24 24"
                  :fill="favourites.includes(selected.id) ? 'currentColor' : 'none'"
                  stroke="currentColor"
                  stroke-width="1.7"
                  aria-hidden="true"
                >
                  <path
                    d="M12 20.2 4.9 13.3a4.6 4.6 0 0 1 6.5-6.5l.6.6.6-.6a4.6 4.6 0 0 1 6.5 6.5z"
                    stroke-linejoin="round"
                  />
                </svg>
              </button>
            </div>

            <UiPhoto
              :name="interiorPhoto"
              :alt="`${building.name}: Unit ${selected.code} ichki ko‘rinishi`"
              ratio="aspect-[16/9]"
              rounded="rounded-field"
              sizes="(max-width: 1280px) 92vw, 340px"
              class="mt-4"
            />

            <ul class="mt-4 divide-y divide-ink-100">
              <li class="flex items-center justify-between gap-3 py-2.5">
                <span class="text-[13px] text-ink-500">Umumiy maydon</span>
                <span class="tabular text-[13.5px] font-bold text-ink-900">
                  {{ area(selected.area) }}
                </span>
              </li>
              <li class="flex items-center justify-between gap-3 py-2.5">
                <span class="text-[13px] text-ink-500">{{ priceInfo.perLabel }}</span>
                <span class="tabular text-[13.5px] font-bold text-ink-900">
                  {{ priceInfo.perValue }}
                </span>
              </li>
              <li class="flex items-center justify-between gap-3 py-2.5">
                <span class="text-[13px] text-ink-500">Xonalar soni</span>
                <span class="tabular text-[13.5px] font-bold text-ink-900">
                  {{ selected.rooms }} ta
                </span>
              </li>
              <li class="flex items-center justify-between gap-3 py-2.5">
                <span class="text-[13px] text-ink-500">Holati</span>
                <span class="rounded-pill bg-ok-50 px-2.5 py-1 text-[12px] font-semibold text-ok-700">
                  {{ readiness }}
                </span>
              </li>
            </ul>

            <div class="mt-3 rounded-field bg-brand-50 px-4 py-3 ring-1 ring-inset ring-brand-100">
              <p class="text-[12.5px] font-semibold text-ink-600">{{ priceInfo.totalLabel }}</p>
              <p class="tabular mt-0.5 text-[20px] font-extrabold text-brand-700">
                {{ priceInfo.totalValue }}
              </p>
            </div>

            <h3 class="mt-5 text-[13.5px] font-bold text-ink-900">Biriktirilgan jihozlar</h3>
            <ul class="mt-2.5 space-y-2">
              <li
                v-for="e in selected.equipment"
                :key="e"
                class="flex items-center gap-2.5 text-[13px] text-ink-700"
              >
                <span class="grid size-5 shrink-0 place-items-center rounded-full bg-ok-50 text-ok-600">
                  <UiIcon name="check" :size="13" />
                </span>
                {{ e }}
              </li>
            </ul>

            <div class="mt-5 grid grid-cols-2 gap-3">
              <UiButton variant="secondary" @click="viewOpen = true">
                <UiIcon name="eye" :size="17" />
                Ko‘rish
              </UiButton>
              <UiButton @click="goApply(selected.id)">
                <UiIcon name="key" :size="17" />
                Ariza yuborish
              </UiButton>
            </div>
          </section>

          <section
            v-else-if="selected"
            class="rounded-card bg-surface p-5 shadow-card ring-1 ring-ink-200/60"
          >
            <div class="flex items-center gap-2.5">
              <h2 class="text-[17px] font-bold">Unit {{ selected.code }}</h2>
              <UiStatus kind="unit" :value="selected.status" size="sm" />
            </div>

            <p class="mt-3 text-[13.5px] leading-relaxed text-ink-600">
              Bu joy hozirda band. Ommaviy katalogda band unitlar bo‘yicha faqat mavjudlik holati
              ko‘rsatiladi: ijarachi va shartnoma ma’lumotlari ochiq emas.
            </p>

            <ul class="mt-4 divide-y divide-ink-100">
              <li class="flex items-center justify-between gap-3 py-2.5">
                <span class="text-[13px] text-ink-500">Umumiy maydon</span>
                <span class="tabular text-[13.5px] font-bold text-ink-900">
                  {{ area(selected.area) }}
                </span>
              </li>
              <li class="flex items-center justify-between gap-3 py-2.5">
                <span class="text-[13px] text-ink-500">Qavat</span>
                <span class="tabular text-[13.5px] font-bold text-ink-900">
                  {{ selected.floor }}-qavat
                </span>
              </li>
              <li class="flex items-center justify-between gap-3 py-2.5">
                <span class="text-[13px] text-ink-500">Holati</span>
                <span class="text-[13px] font-semibold text-ink-700">{{ readiness }}</span>
              </li>
            </ul>

            <UiButton
              variant="secondary"
              block
              class="mt-4"
              :disabled="!floorVacant.length"
              @click="selectedId = floorVacant[0]?.id ?? ''"
            >
              <UiIcon name="arrowRight" :size="17" />
              Shu qavatdagi bo‘sh unitni ko‘rish
            </UiButton>
          </section>
        </div>
      </div>

      <UiModal
        v-model="lightboxOpen"
        :title="activePhoto?.label ?? 'Obyekt galereyasi'"
        :subtitle="`${building.name}, ${mainView + 1} / ${photos.length}`"
        size="xl"
      >
        <div v-if="activePhoto" class="relative">
          <UiPhoto
            :name="activePhoto.name"
            :alt="`${building.name}: ${activePhoto.label}`"
            ratio="aspect-[16/9]"
            rounded="rounded-panel"
            sizes="(max-width: 1024px) 92vw, 860px"
            eager
          >
            <template v-if="photos.length > 1">
              <button
                type="button"
                class="absolute left-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/92 text-ink-700 shadow-pop transition-transform duration-150 hover:scale-105"
                aria-label="Oldingi surat"
                @click="stepPhoto(-1)"
              >
                <UiIcon name="chevronLeft" :size="20" />
              </button>
              <button
                type="button"
                class="absolute right-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/92 text-ink-700 shadow-pop transition-transform duration-150 hover:scale-105"
                aria-label="Keyingi surat"
                @click="stepPhoto(1)"
              >
                <UiIcon name="chevronRight" :size="20" />
              </button>
            </template>
          </UiPhoto>
        </div>

        <div v-if="photos.length > 1" class="mt-4 grid grid-cols-4 gap-3 sm:grid-cols-6">
          <button
            v-for="(p, i) in photos"
            :key="`lb-${p.name}`"
            type="button"
            class="overflow-hidden rounded-[10px] ring-1 transition-all duration-150"
            :class="mainView === i ? 'ring-2 ring-brand-500' : 'ring-ink-200 hover:ring-brand-300'"
            :aria-label="p.label"
            :aria-pressed="mainView === i"
            @click="mainView = i"
          >
            <UiPhoto :name="p.name" :alt="p.label" ratio="aspect-[4/3]" rounded="rounded-none" sizes="160px" />
          </button>
        </div>

        <template #footer>
          <p class="mr-auto text-[12.5px] text-ink-500">
            ← va → tugmalari suratni almashtiradi, Esc oynani yopadi
          </p>
          <UiButton variant="secondary" @click="lightboxOpen = false">Yopish</UiButton>
        </template>
      </UiModal>

      <UiModal
        v-model="viewOpen"
        :title="selected ? `Unit ${selected.code}, batafsil ko‘rinish` : 'Unit ko‘rinishi'"
        :subtitle="building.name"
        size="lg"
      >
        <div v-if="selected && priceInfo">
          <UiPhoto
            :name="interiorPhoto"
            :alt="`${building.name}: Unit ${selected.code}`"
            ratio="aspect-[16/9]"
            rounded="rounded-card"
            sizes="(max-width: 1024px) 92vw, 700px"
          />

          <div class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div class="rounded-field bg-surface-sunken px-4 py-3">
              <p class="text-[12px] text-ink-500">Umumiy maydon</p>
              <p class="tabular mt-0.5 text-[15px] font-bold">{{ area(selected.area) }}</p>
            </div>
            <div class="rounded-field bg-surface-sunken px-4 py-3">
              <p class="text-[12px] text-ink-500">Qavat</p>
              <p class="tabular mt-0.5 text-[15px] font-bold">{{ selected.floor }}-qavat</p>
            </div>
            <div class="rounded-field bg-surface-sunken px-4 py-3">
              <p class="text-[12px] text-ink-500">Xonalar</p>
              <p class="tabular mt-0.5 text-[15px] font-bold">{{ selected.rooms }} ta</p>
            </div>
            <div class="rounded-field bg-surface-sunken px-4 py-3">
              <p class="text-[12px] text-ink-500">{{ priceInfo.totalLabel }}</p>
              <p class="tabular mt-0.5 text-[15px] font-bold text-brand-700">
                {{ priceInfo.totalValue }}
              </p>
            </div>
          </div>

          <p class="mt-4 text-[13.5px] leading-relaxed text-ink-600">
            {{ building.city }}, {{ building.district }}, {{ building.street }} · {{ building.buildingClass }}, {{ building.buildYear }}-yilda foydalanishga topshirilgan.
            Unit {{ selected.code }} {{ readiness.toLowerCase() }}.
          </p>
        </div>

        <template #footer>
          <UiButton variant="secondary" @click="viewOpen = false">Yopish</UiButton>
          <UiButton @click="goToOffer">
            <UiIcon name="key" :size="16" />
            Ariza yuborish
          </UiButton>
        </template>
      </UiModal>

      <UiModal
        v-model="offerOpen"
        title="Ariza ijarachi hisobidan yuboriladi"
        subtitle="Ariza rasmiy hujjat hisoblanadi va tizimda qayd etib boriladi"
        size="md"
      >
        <div class="flex gap-3 rounded-field bg-brand-50 p-4 ring-1 ring-inset ring-brand-100">
          <UiIcon name="shield" :size="20" class="mt-0.5 shrink-0 text-brand-600" />
          <p class="text-[13.5px] leading-relaxed text-ink-700">
            <span v-if="selected" class="font-semibold text-ink-900">
              {{ building.name }} · Unit {{ selected.code }}
            </span>
            <span v-else class="font-semibold text-ink-900">{{ building.name }}</span>
            <br />
            Joriy hisob ish maydoni roliga tegishli. Ijaraga olish arizasini tashkilot vakili
            o‘zining shaxsiy kabinetidan yuboradi, ariza avtomatik ravishda tanlangan unitga
            biriktiriladi.
          </p>
        </div>

        <ul class="mt-4 space-y-2.5">
          <li
            v-for="t in [
              'Tashkilot rekvizitlari profildan avtomatik to‘ldiriladi',
              'Bino rahbari kommersiya taklifini tuzadi, buxgalter moliyani tasdiqlaydi',
              'Shartnoma Didox orqali imzolanadi va kabinetda kuzatiladi',
            ]"
            :key="t"
            class="flex items-start gap-2.5 text-[13px] text-ink-700"
          >
            <span class="grid size-5 shrink-0 place-items-center rounded-full bg-ok-50 text-ok-600">
              <UiIcon name="check" :size="13" />
            </span>
            {{ t }}
          </li>
        </ul>

        <template #footer>
          <UiButton variant="secondary" @click="offerOpen = false">Tushunarli</UiButton>
        </template>
      </UiModal>
    </template>

    <div
      v-else
      class="rounded-card bg-surface px-6 py-20 text-center shadow-card ring-1 ring-ink-200/60"
    >
      <span class="mx-auto grid size-14 place-items-center rounded-full bg-ink-100 text-ink-400">
        <UiIcon name="building" :size="26" />
      </span>
      <h1 class="mt-4 text-[19px] font-bold">Obyekt topilmadi</h1>
      <p class="mx-auto mt-2 max-w-[46ch] text-[13.5px] leading-relaxed text-ink-600">
        So‘ralgan obyekt katalogdan olib tashlangan yoki havola noto‘g‘ri. Barcha mavjud obyektlar
        va bo‘sh joylarni katalogdan ko‘rishingiz mumkin.
      </p>
      <div class="mt-5 flex flex-wrap justify-center gap-3">
        <UiButton to="/catalog">
          <UiIcon name="search" :size="17" />
          Katalogga o‘tish
        </UiButton>
        <UiButton variant="secondary" to="/">Bosh sahifa</UiButton>
      </div>
    </div>
  </div>
</template>
