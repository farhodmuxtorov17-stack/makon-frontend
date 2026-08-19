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

/**
 * Qavat ko‘rsatkichlari. Uch qiymat qoldirildi: umumiy, bo‘sh va band
 * maydon. Unit sanoqlari yonidagi bo‘sh unitlar ro‘yxatida ko‘rinib
 * turibdi, shuning uchun bu yerda takrorlanmaydi.
 */
const floorStats = computed(() => {
  const total = floorUnits.value.reduce((s, u) => s + u.area, 0)
  const vacant = floorVacant.value.reduce((s, u) => s + u.area, 0)
  return [
    { label: 'Umumiy maydon', value: `${num(total, 1)} m²`, tone: 'text-ink-900' },
    { label: 'Bo‘sh maydon', value: `${num(vacant, 1)} m²`, tone: 'text-ok-700' },
    { label: 'Band maydon', value: `${num(total - vacant, 1)} m²`, tone: 'text-brand-700' },
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
    underground: activeFloor.value < 0,
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

/**
 * Bino pasporti. Bo‘sh unitlar soni va bo‘sh maydon bu ro‘yxatdan olib
 * tashlandi: o‘sha raqamlar qavat bo‘limida va unit panelida allaqachon
 * turibdi, uchinchi takror sahifani og‘irlashtirardi.
 */
const infoRows = computed(() => {
  const b = building.value
  if (!b) return []
  return [
    { icon: 'building', label: 'Bino klassi', value: b.buildingClass },
    { icon: 'calendar', label: 'Qurilgan yil', value: `${b.buildYear}-yil` },
    { icon: 'layers', label: 'Umumiy maydon', value: `${num(b.gla)} m²` },
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
    { icon: 'clock', label: 'Xizmat ko‘rsatish darajasi', value: `${b.sla}%` },
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
    perLabel: monthly ? 'Bir m² uchun, oyiga' : 'Bir m² uchun',
    perValue: sum(Math.round(monthly ? u.price / u.area : u.price)),
    totalLabel: monthly ? 'Oylik to‘lov' : 'Umumiy narx',
    totalValue: sum(Math.round(monthly ? u.price : u.price * u.area)),
  }
})

/**
 * Unit panelidagi texnik raqamlar. Sahifada faqat shu yerda chiqadi,
 * shuning uchun bitta qiymat ikki joyda ikki xil yozilib qolmaydi.
 */
const unitFacts = computed(() => {
  const u = selected.value
  if (!u) return []
  const rows = [
    { label: 'Umumiy maydon', value: area(u.area) },
    { label: 'Qavat', value: `${u.floor}-qavat` },
    { label: 'Xonalar soni', value: `${u.rooms} ta` },
  ]
  if (u.usage) rows.push({ label: 'Tayinlanishi', value: u.usage })
  return rows
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
 * «Ariza yuborish»: bo‘sh unit uchun yagona harakat yo‘li. Tizimga kirmagan
 * foydalanuvchi ochiq ariza formasiga, ijarachi esa kabinetdagi ariza
 * formasiga yuboriladi. Ijarachi faqat yuridik shaxs bo‘lgani uchun boshqa
 * roldagi hisob tushuntirish oynasini ko‘radi.
 */
function goApply(unitId?: string) {
  const id = unitId ?? selected.value?.id
  if (!id) return
  if (!auth.isAuthenticated) return navigateTo(`/ariza?unit=${id}`)
  if (auth.role !== 'TENANT_OWNER') {
    offerOpen.value = true
    return
  }
  return navigateTo(`/cabinet/apply?unit=${id}`)
}
</script>

<template>
  <div class="mx-auto max-w-[1360px] px-4 py-6 lg:px-8 lg:py-8">
    <template v-if="building">
      <nav class="flex flex-wrap items-center gap-1.5 text-[13px]">
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
          <h1 class="text-2xl font-bold leading-tight">{{ building.name }}</h1>
          <p class="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] text-ink-500">
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
          <!--
            Kichik ekranda unit paneli sahifa oxirida qoladi, shuning uchun
            harakatga chaqiruv sarlavhada takrorlanadi. Keng ekranda panel
            yopishib turadi va tugma faqat o‘sha yerda bo‘ladi: bir vaqtning
            o‘zida ekranda bitta «Ariza yuborish» ko‘rinadi.
          -->
          <UiButton
            v-if="selected && selected.status === 'VACANT'"
            size="sm"
            class="xl:hidden"
            @click="goApply(selected.id)"
          >
            <UiIcon name="key" :size="16" />
            Ariza yuborish
          </UiButton>
        </div>
      </header>

      <div class="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
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
              <!-- Yozuv o‘qilishi uchun pastki chekkada yumshoq qorayish -->
              <span
                class="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-ink-900/70 to-transparent"
              />

              <span class="absolute bottom-4 left-4 text-[13px] font-semibold text-white">
                {{ activePhoto.label }}
              </span>

              <template v-if="photos.length > 1">
                <button
                  type="button"
                  class="absolute left-4 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink-700 shadow-pop transition-colors duration-150 hover:bg-white"
                  aria-label="Oldingi surat"
                  @click="stepPhoto(-1)"
                >
                  <UiIcon name="chevronLeft" :size="20" />
                </button>
                <button
                  type="button"
                  class="absolute right-4 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink-700 shadow-pop transition-colors duration-150 hover:bg-white"
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
                class="grid aspect-[4/3] place-items-center rounded-[10px] bg-ink-800 text-[13px] font-bold text-white transition-colors duration-150 hover:bg-ink-900"
                @click="openPhoto(mainView)"
              >
                Barchasi
              </button>
            </div>
          </section>

          <section class="rounded-card bg-surface p-5 shadow-card ring-1 ring-ink-200/60">
            <h2 class="text-[18px] font-bold">Obyekt pasporti</h2>
            <dl class="mt-4 grid gap-x-6 sm:grid-cols-2">
              <div
                v-for="r in infoRows"
                :key="r.label"
                class="flex items-center gap-3 border-b border-ink-100 py-3 last:border-0 sm:[&:nth-last-child(2)]:border-0"
              >
                <span
                  class="grid size-9 shrink-0 place-items-center rounded-[10px] bg-brand-50 text-brand-600"
                >
                  <UiIcon :name="r.icon" :size="17" />
                </span>
                <dt class="min-w-0 flex-1 text-[13px] text-ink-500">{{ r.label }}</dt>
                <dd class="tabular max-w-[52%] text-right text-[14px] font-semibold text-ink-900">
                  {{ r.value }}
                </dd>
              </div>
            </dl>
          </section>

          <section class="rounded-card bg-surface p-5 shadow-card ring-1 ring-ink-200/60">
            <h2 class="text-[18px] font-bold">Qulayliklar</h2>
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

          <!--
            Qavat rejasi va shu qavatdagi bo‘sh unitlar ro‘yxati bitta
            bo‘limga jamlandi. Avval ular sahifaning ikki chekkasida turardi
            va bir xil unitlarni ikki marta sanab chiqardi.
          -->
          <section class="rounded-card bg-surface p-5 shadow-card ring-1 ring-ink-200/60">
            <h2 class="text-[18px] font-bold">Qavat va bo‘sh maydonlar</h2>
            <p class="mt-1 text-[13px] text-ink-500">
              Qavatni tanlang, so‘ng rejadagi maydonni yoki ro‘yxatdagi unitni bosing.
            </p>

            <template v-if="floors.length">
              <div class="mt-4 flex items-center gap-2">
                <button
                  type="button"
                  class="grid size-11 shrink-0 place-items-center rounded-field text-ink-600 ring-1 ring-inset ring-ink-200 transition-colors duration-150 hover:bg-ink-100 disabled:cursor-not-allowed disabled:opacity-40 md:size-10"
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
                    class="tabular h-11 shrink-0 rounded-field px-4 text-[13px] font-semibold transition-colors duration-150 md:h-10"
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
                  class="grid size-11 shrink-0 place-items-center rounded-field text-ink-600 ring-1 ring-inset ring-ink-200 transition-colors duration-150 hover:bg-ink-100 disabled:cursor-not-allowed disabled:opacity-40 md:size-10"
                  :disabled="floors.indexOf(activeFloor) >= floors.length - 1"
                  aria-label="Keyingi qavat"
                  @click="stepFloor(1)"
                >
                  <UiIcon name="chevronRight" :size="17" />
                </button>
              </div>

              <div class="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,268px)]">
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
                      class="flex items-center gap-2 text-[13px] text-ink-600"
                    >
                      <span class="size-2.5 rounded-full" :style="{ backgroundColor: l.color }" />
                      {{ l.label }}
                    </li>
                  </ul>
                </div>

                <div class="min-w-0 space-y-4">
                  <dl class="rounded-card bg-surface-sunken p-4 ring-1 ring-inset ring-ink-200">
                    <div
                      v-for="s in floorStats"
                      :key="s.label"
                      class="flex items-center justify-between gap-3 py-1"
                    >
                      <dt class="text-[13px] text-ink-500">{{ s.label }}</dt>
                      <dd class="tabular text-[13px] font-bold" :class="s.tone">{{ s.value }}</dd>
                    </div>
                  </dl>

                  <div>
                    <p class="text-[13px] font-bold text-ink-900">
                      Bo‘sh unitlar
                      <span class="tabular font-semibold text-ink-500">
                        ({{ floorVacant.length }} ta)
                      </span>
                    </p>

                    <ul
                      v-if="floorVacant.length"
                      class="scroll-slim mt-2.5 max-h-[264px] space-y-2 overflow-y-auto pr-0.5"
                    >
                      <li v-for="u in floorVacant" :key="u.id">
                        <button
                          type="button"
                          class="flex min-h-11 w-full items-center gap-3 rounded-field px-3.5 py-2.5 text-left transition-colors duration-150"
                          :class="
                            selectedId === u.id
                              ? 'bg-brand-50 ring-2 ring-inset ring-brand-500'
                              : 'ring-1 ring-inset ring-ink-200 hover:bg-ink-50'
                          "
                          :aria-pressed="selectedId === u.id"
                          @click="selectedId = u.id"
                        >
                          <span
                            class="tabular shrink-0 rounded-[6px] bg-ink-100 px-1.5 text-[11px] font-bold leading-5 text-ink-700"
                          >
                            {{ u.code }}
                          </span>
                          <span class="tabular min-w-0 flex-1 text-[13px] font-bold text-ink-900">
                            {{ area(u.area) }}
                          </span>
                          <UiIcon name="chevronRight" :size="16" class="shrink-0 text-ink-400" />
                        </button>
                      </li>
                    </ul>

                    <p
                      v-else
                      class="mt-2.5 rounded-field bg-surface-sunken px-4 py-5 text-[13px] leading-relaxed text-ink-600 ring-1 ring-inset ring-ink-200"
                    >
                      Bu qavatda bo‘sh unit yo‘q. Yuqoridagi tugmalar bilan boshqa qavatga o‘ting.
                    </p>
                  </div>
                </div>
              </div>
            </template>

            <p v-else class="mt-4 text-[14px] text-ink-500">
              Ushbu obyekt bo‘yicha qavat rejalari hozircha katalogda ochiq emas. Bo‘sh maydonlar
              bo‘yicha ma’lumot olish uchun tizimga kiring.
            </p>
          </section>

          <section class="rounded-card bg-surface p-5 shadow-card ring-1 ring-ink-200/60">
            <h2 class="text-[18px] font-bold">Joylashuv</h2>
            <p class="mt-1 text-[13px] text-ink-500">
              {{ building.street }}, {{ building.district }}, {{ building.city }}
            </p>

            <div class="mt-4 overflow-hidden rounded-card ring-1 ring-inset ring-ink-200">
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

        <!--
          O‘ng ustun. Sahifadagi yagona unit paneli: avval bir xil raqamlar
          xulosa kartochkasida, unit kartochkasida va «Ko‘rish» oynasida uch
          marta takrorlanardi.
        -->
        <div class="min-w-0">
          <aside
            v-if="selected"
            class="scroll-slim rounded-card bg-surface p-5 shadow-card ring-1 ring-ink-200/60 xl:sticky xl:top-[88px] xl:max-h-[calc(100dvh-104px)] xl:overflow-y-auto"
          >
            <!-- Katalog kartochkasidagi bilan bir xil qoida: holat chapda, kod o‘ngda -->
            <div class="flex items-center justify-between gap-3">
              <UiStatus kind="unit" :value="selected.status" size="sm" />
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  class="relative grid size-9 place-items-center rounded-full transition-colors duration-150 after:absolute after:-inset-1.5 after:content-['']"
                  :class="
                    favourites.includes(selected.id)
                      ? 'text-danger-500'
                      : 'text-ink-400 hover:bg-ink-100 hover:text-danger-500'
                  "
                  :aria-pressed="favourites.includes(selected.id)"
                  :aria-label="`Unit ${selected.code} ni sevimlilarga qo‘shish`"
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
            </div>

            <h2 class="tabular mt-3 text-[18px] font-bold leading-tight">
              Unit {{ selected.code }}
            </h2>
            <p class="mt-1 text-[13px] text-ink-500">
              {{ building.name }} · {{ selected.floor }}-qavat
            </p>

            <template v-if="selected.status === 'VACANT' && priceInfo">
              <!-- Sahifadagi eng yirik raqam: kelishuv summasi -->
              <div class="mt-4">
                <p class="text-[12px] font-semibold uppercase tracking-wide text-ink-500">
                  {{ priceInfo.totalLabel }}
                </p>
                <p class="tabular mt-1 text-[28px] font-extrabold leading-none text-brand-700">
                  {{ priceInfo.totalValue }}
                </p>
                <p class="mt-1.5 text-[13px] text-ink-500">
                  {{ priceInfo.perLabel }}:
                  <span class="tabular font-semibold text-ink-700">{{ priceInfo.perValue }}</span>
                </p>
              </div>
            </template>

            <p
              v-else
              class="mt-4 rounded-field bg-surface-sunken px-4 py-3 text-[13px] leading-relaxed text-ink-600 ring-1 ring-inset ring-ink-200"
            >
              Bu maydon hozirda band. Ommaviy katalogda band unitlar bo‘yicha faqat mavjudlik
              holati ko‘rsatiladi, ijarachi va shartnoma ma’lumotlari ochilmaydi.
            </p>

            <dl class="mt-4 divide-y divide-ink-100 border-y border-ink-100">
              <div
                v-for="f in unitFacts"
                :key="f.label"
                class="flex items-center justify-between gap-3 py-2.5"
              >
                <dt class="text-[13px] text-ink-500">{{ f.label }}</dt>
                <dd class="tabular text-[14px] font-bold text-ink-900">{{ f.value }}</dd>
              </div>
            </dl>

            <template v-if="selected.equipment.length">
              <h3 class="mt-4 text-[13px] font-bold text-ink-900">Biriktirilgan jihozlar</h3>
              <ul class="mt-2 flex flex-wrap gap-1.5">
                <li
                  v-for="e in selected.equipment"
                  :key="e"
                  class="inline-flex items-center gap-1.5 rounded-pill bg-ok-50 py-1 pl-2 pr-2.5 text-[12px] font-medium text-ok-800"
                >
                  <UiIcon name="check" :size="12" class="shrink-0" />
                  {{ e }}
                </li>
              </ul>
            </template>

            <template v-if="selected.status === 'VACANT'">
              <UiButton block size="lg" class="mt-5" @click="goApply(selected.id)">
                <UiIcon name="key" :size="18" />
                Ariza yuborish
              </UiButton>
              <p class="mt-2 text-center text-[12px] leading-relaxed text-ink-500">
                Ariza tashkilot nomidan rasmiylashtiriladi va tizimda qayd etiladi.
              </p>
            </template>

            <UiButton
              v-else
              variant="secondary"
              block
              size="lg"
              class="mt-5"
              :disabled="!floorVacant.length"
              @click="selectedId = floorVacant[0]?.id ?? ''"
            >
              <UiIcon name="arrowRight" :size="18" />
              Shu qavatdagi bo‘sh maydon
            </UiButton>
          </aside>
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
                class="absolute left-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/92 text-ink-700 shadow-pop transition-colors duration-150 hover:bg-white"
                aria-label="Oldingi surat"
                @click="stepPhoto(-1)"
              >
                <UiIcon name="chevronLeft" :size="20" />
              </button>
              <button
                type="button"
                class="absolute right-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/92 text-ink-700 shadow-pop transition-colors duration-150 hover:bg-white"
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
          <p class="mr-auto text-[13px] text-ink-500">
            ← va → tugmalari suratni almashtiradi, Esc oynani yopadi
          </p>
          <UiButton variant="secondary" @click="lightboxOpen = false">Yopish</UiButton>
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
          <p class="text-[14px] leading-relaxed text-ink-700">
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
      <h1 class="mt-4 text-[18px] font-bold">Obyekt topilmadi</h1>
      <p class="mx-auto mt-2 max-w-[46ch] text-[14px] leading-relaxed text-ink-600">
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
