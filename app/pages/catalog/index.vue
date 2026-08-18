<script setup lang="ts">
import { useStorage } from '@vueuse/core'
import { BUILDINGS, buildingById, type Building } from '~/data/buildings'
import { UNITS, type Unit } from '~/data/units'
import { num, area } from '~/utils/format'

definePageMeta({ layout: 'public', fullscreen: true })

interface Listing {
  unit: Unit
  building: Building
}

/**
 * Mulk turlari. Kalitlar bosh sahifadagi qidiruv yuboradigan `type` qiymatlari
 * bilan bir xil, shuning uchun hero qidiruvidan kelgan havola shu yerda ochiladi.
 */
const CATEGORIES: Array<{ value: string; label: string; match: (l: Listing) => boolean }> = [
  {
    value: 'biznes',
    label: 'Ofis',
    match: (l) => l.building.type === 'Biznes markaz' || l.building.type === 'Ofis binosi',
  },
  { value: 'savdo', label: 'Savdo markazi', match: (l) => l.building.type === 'Savdo markaz' },
  {
    value: 'ombor',
    label: 'Ombor / logistika',
    match: (l) => l.building.type === 'Ombor / logistika',
  },
  { value: 'turar', label: 'Turar joy', match: (l) => l.building.type === 'Turar joy' },
]

/**
 * Maqsad — mulk turidan ALOHIDA o‘lchov: biznes markazda ham ombor xonasi,
 * savdo markazida ham ofis bo‘lishi mumkin. Ilgari bosh sahifadagi «Maqsad»
 * tanlovi mulk turiga aylantirib yuborilardi, natijada «Ombor» tanlanganda
 * boshqa binolarning rasmlari chiqardi.
 */
const USAGE_OPTIONS = ['Ofis', 'Savdo', 'Ombor', 'Turar joy']

const usageSelectOptions = [
  { value: '', label: 'Barcha maqsadlar' },
  ...USAGE_OPTIONS.map((v) => ({ value: v, label: v })),
]

/** Bosh sahifa yuboradigan narx oralig‘i kalitlari, so‘m */
const PRICE_BUCKETS: Record<string, [string, string]> = {
  p1: ['', '5000000'],
  p2: ['5000000', '15000000'],
  p3: ['15000000', '50000000'],
  p4: ['50000000', ''],
}

/** Bosh sahifa yuboradigan maydon oralig‘i kalitlari, m² */
const AREA_BUCKETS: Record<string, [string, string]> = {
  a1: ['', '100'],
  a2: ['100', '300'],
  a3: ['300', '600'],
  a4: ['600', ''],
}

const MAP_TONE: Record<string, 'brand' | 'ok' | 'warn' | 'info'> = {
  'Biznes markaz': 'brand',
  'Ofis binosi': 'brand',
  'Savdo markaz': 'info',
  'Ombor / logistika': 'warn',
  'Turar joy': 'ok',
}

const MAP_LEGEND = [
  { label: 'Ofis', class: 'bg-brand-500' },
  { label: 'Savdo', class: 'bg-info-500' },
  { label: 'Ombor / logistika', class: 'bg-warn-500' },
  { label: 'Turar joy', class: 'bg-ok-500' },
]

const SORT_OPTIONS = [
  { value: 'top', label: 'Mashhurlik bo‘yicha' },
  { value: 'price-asc', label: 'Narx: o‘sish bo‘yicha' },
  { value: 'price-desc', label: 'Narx: kamayish bo‘yicha' },
  { value: 'area-desc', label: 'Maydon: kattadan kichikka' },
  { value: 'new', label: 'Yangilik bo‘yicha' },
]

const DISTANCE_OPTIONS = [
  { value: '', label: 'Cheklovsiz' },
  { value: '5', label: '5 km gacha' },
  { value: '10', label: '10 km gacha' },
  { value: '20', label: '20 km gacha' },
  { value: '30', label: '30 km gacha' },
]

const OFFER_TABS = [
  { value: 'all', label: 'Barchasi' },
  { value: 'rent', label: 'Ijaraga' },
  { value: 'buy', label: 'Sotuv' },
]

const OFFER_SUMMARY: Record<string, string> = {
  all: 'Ijara va sotuv takliflari',
  rent: 'Ijara, oylik to‘lov',
  buy: 'Sotuv, m² narxi',
}

const route = useRoute()
const router = useRouter()

function initial(key: string) {
  const v = route.query[key]
  return typeof v === 'string' ? v : ''
}

function initialTypes(): string[] {
  const out: string[] = []
  for (const raw of initial('type').split(',')) {
    const key = raw.trim()
    if (key && CATEGORIES.some((c) => c.value === key) && !out.includes(key)) out.push(key)
  }
  return out
}

const priceBucket = PRICE_BUCKETS[initial('price')] ?? ['', '']
const areaBucket = AREA_BUCKETS[initial('size')] ?? ['', '']

const q = ref(initial('q'))
const selectedTypes = ref<string[]>(initialTypes())
const place = ref(initial('place'))
// Raqamli maydon `<input type="number">` bo‘lgani uchun bo‘sh bo‘lmaganda son
// qaytaradi, shuning uchun turi matn va sondan iborat
const priceMin = ref<string | number>(initial('pmin') || priceBucket[0] || '')
const priceMax = ref<string | number>(initial('pmax') || priceBucket[1] || '')
const areaMin = ref<string | number>(initial('amin') || areaBucket[0] || '')
const areaMax = ref<string | number>(initial('amax') || areaBucket[1] || '')
const distance = ref(DISTANCE_OPTIONS.some((o) => o.value === initial('dist')) ? initial('dist') : '')
const offer = ref(OFFER_TABS.some((o) => o.value === initial('offer')) ? initial('offer') : 'all')
const sort = ref(SORT_OPTIONS.some((o) => o.value === initial('sort')) ? initial('sort') : 'top')
const mode = ref(initial('mode') === 'map' ? 'map' : 'list')
const usage = ref(USAGE_OPTIONS.includes(initial('usage')) ? initial('usage') : '')
const onlyFavourites = ref(initial('fav') === '1')
const objectId = ref(BUILDINGS.some((b) => b.id === initial('obyekt')) ? initial('obyekt') : '')

const favourites = useStorage<string[]>('makon.favourites', [])

function toggleFavourite(id: string) {
  favourites.value = favourites.value.includes(id)
    ? favourites.value.filter((f) => f !== id)
    : [...favourites.value, id]
}

const all = computed<Listing[]>(() =>
  UNITS.filter((u) => u.status === 'VACANT')
    .map((u) => ({ unit: u, building: buildingById(u.buildingId) }))
    .filter((l): l is Listing => !!l.building),
)

/** Toshkent markazi, masofa shu nuqtadan o‘lchanadi */
const CENTER = { lat: 41.3111, lon: 69.2797 }
const RAD = Math.PI / 180

/** Ikki nuqta orasidagi yer sferasi bo‘ylab masofa, km */
function distanceKm(lat: number, lon: number) {
  const dLat = (lat - CENTER.lat) * RAD
  const dLon = (lon - CENTER.lon) * RAD
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(CENTER.lat * RAD) * Math.cos(lat * RAD) * Math.sin(dLon / 2) ** 2
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)))
}

/** Bo‘sh yoki noto‘g‘ri qiymat cheklov qo‘ymaydi, `null` qaytadi */
function numberOf(value: string | number) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const n = Number(value)
  return value.trim() !== '' && Number.isFinite(n) ? n : null
}

function matchText(l: Listing) {
  const s = q.value.trim().toLowerCase()
  if (!s) return true
  return [
    l.building.name,
    l.building.city,
    l.building.district,
    l.building.street,
    l.building.type,
    l.unit.code,
    l.unit.usage,
  ]
    .join(' ')
    .toLowerCase()
    .includes(s)
}

function matchPrice(u: Unit) {
  const lo = numberOf(priceMin.value)
  const hi = numberOf(priceMax.value)
  if (lo !== null && u.price < lo) return false
  if (hi !== null && u.price > hi) return false
  return true
}

function matchArea(u: Unit) {
  const lo = numberOf(areaMin.value)
  const hi = numberOf(areaMax.value)
  if (lo !== null && u.area < lo) return false
  if (hi !== null && u.area > hi) return false
  return true
}

function matchOffer(u: Unit) {
  if (offer.value === 'rent') return u.offer === 'Ijara' || u.offer === 'Ikkalasi'
  if (offer.value === 'buy') return u.offer === 'Sotuv' || u.offer === 'Ikkalasi'
  return true
}

function matchDistance(b: Building) {
  const limit = numberOf(distance.value)
  return limit === null || distanceKm(b.lat, b.lon) <= limit
}

/** Mulk turi belgilaridan tashqari barcha shartlar, nishoncha sanoqlari uchun */
const base = computed(() =>
  all.value.filter((l) => {
    if (!matchText(l)) return false
    if (place.value && `${l.building.city}|${l.building.district}` !== place.value) return false
    if (!matchPrice(l.unit)) return false
    if (!matchArea(l.unit)) return false
    if (!matchOffer(l.unit)) return false
    if (!matchDistance(l.building)) return false
    if (usage.value && l.unit.usage !== usage.value) return false
    if (onlyFavourites.value && !favourites.value.includes(l.unit.id)) return false
    return true
  }),
)

const typeOptions = computed(() =>
  CATEGORIES.map((c) => ({
    value: c.value,
    label: c.label,
    count: base.value.filter((l) => c.match(l)).length,
  })),
)

/** Obyekt tanlovi xarita nuqtalarini yo‘qotmasligi uchun undan oldin hisoblanadi */
const matched = computed(() =>
  base.value.filter(
    (l) =>
      selectedTypes.value.length === 0 ||
      CATEGORIES.some((c) => selectedTypes.value.includes(c.value) && c.match(l)),
  ),
)

const results = computed(() => {
  const list = matched.value.filter((l) => !objectId.value || l.building.id === objectId.value)
  const sorted = [...list]
  if (sort.value === 'price-asc') sorted.sort((a, b) => a.unit.price - b.unit.price)
  else if (sort.value === 'price-desc') sorted.sort((a, b) => b.unit.price - a.unit.price)
  else if (sort.value === 'area-desc') sorted.sort((a, b) => b.unit.area - a.unit.area)
  else if (sort.value === 'new')
    sorted.sort(
      (a, b) => b.building.buildYear - a.building.buildYear || b.unit.floor - a.unit.floor,
    )
  else
    sorted.sort(
      (a, b) => b.building.occupancy - a.building.occupancy || a.unit.price - b.unit.price,
    )
  return sorted
})

const mapMarkers = computed(() =>
  BUILDINGS.map((b) => ({ building: b, items: matched.value.filter((l) => l.building.id === b.id) }))
    .filter((g) => g.items.length > 0)
    .map((g) => ({
      id: g.building.id,
      lat: g.building.lat,
      lon: g.building.lon,
      label: g.building.name,
      caption: `${g.building.district} · ${g.building.type}`,
      value: g.items.length,
      valueLabel: 'ta variant',
      tone: MAP_TONE[g.building.type] ?? 'brand',
    })),
)

const mapStats = computed(() => [
  { label: 'Obyektlar', value: String(mapMarkers.value.length) },
  { label: 'Variantlar', value: String(matched.value.length) },
])

const activeObject = computed(() => BUILDINGS.find((b) => b.id === objectId.value))

function categoryLabel(l: Listing) {
  return CATEGORIES.find((c) => c.match(l))?.label ?? l.building.type
}

const summary = computed(() => {
  const names = CATEGORIES.filter((c) => selectedTypes.value.includes(c.value)).map((c) => c.label)
  const cats = names.length ? names.join(', ') : 'barcha mulk turlari'
  return `${OFFER_SUMMARY[offer.value] ?? OFFER_SUMMARY.all} · ${cats}`
})

const chips = computed(() => {
  const out: Array<{ key: string; label: string }> = []
  if (place.value) out.push({ key: 'place', label: place.value.replace('|', ', ') })
  if (usage.value) out.push({ key: 'usage', label: `Maqsad: ${usage.value}` })
  if (onlyFavourites.value) out.push({ key: 'fav', label: 'Faqat sevimlilar' })
  if (activeObject.value) out.push({ key: 'obyekt', label: activeObject.value.name })
  return out
})

function clearChip(key: string) {
  if (key === 'place') place.value = ''
  if (key === 'usage') usage.value = ''
  if (key === 'fav') onlyFavourites.value = false
  if (key === 'obyekt') objectId.value = ''
}

const activeCount = computed(() => {
  let n = 0
  if (q.value.trim()) n++
  if (selectedTypes.value.length) n++
  if (priceMin.value !== '' || priceMax.value !== '') n++
  if (areaMin.value !== '' || areaMax.value !== '') n++
  if (distance.value) n++
  if (place.value) n++
  if (usage.value) n++
  if (offer.value !== 'all') n++
  if (onlyFavourites.value) n++
  if (objectId.value) n++
  return n
})

function resetFilters() {
  q.value = ''
  selectedTypes.value = []
  place.value = ''
  priceMin.value = ''
  priceMax.value = ''
  areaMin.value = ''
  areaMax.value = ''
  distance.value = ''
  usage.value = ''
  offer.value = 'all'
  onlyFavourites.value = false
  objectId.value = ''
}

const hoverId = ref<string | null>(null)
const listEl = ref<HTMLElement | null>(null)

function scrollTo(el: HTMLElement | null | undefined) {
  el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
}

function pickObject(m: { id: string }) {
  objectId.value = objectId.value === m.id ? '' : m.id
  mode.value = 'list'
  nextTick(() => scrollTo(listEl.value?.querySelector<HTMLElement>(`[data-building="${m.id}"]`)))
}

function onCardClick(event: MouseEvent) {
  scrollTo(event.currentTarget as HTMLElement | null)
}

const filtersOpen = ref(false)

onKeyStroke('Escape', () => {
  if (filtersOpen.value) filtersOpen.value = false
})

watch(filtersOpen, (open) => {
  document.body.style.overflow = open ? 'hidden' : ''
})

onBeforeUnmount(() => {
  document.body.style.overflow = ''
})

watch(
  [
    q,
    selectedTypes,
    place,
    priceMin,
    priceMax,
    areaMin,
    areaMax,
    distance,
    offer,
    sort,
    mode,
    onlyFavourites,
    objectId,
  ],
  () => {
    const query: Record<string, string> = {}
    if (q.value.trim()) query.q = q.value.trim()
    if (selectedTypes.value.length) query.type = selectedTypes.value.join(',')
    if (place.value) query.place = place.value
    if (priceMin.value !== '') query.pmin = String(priceMin.value)
    if (priceMax.value !== '') query.pmax = String(priceMax.value)
    if (areaMin.value !== '') query.amin = String(areaMin.value)
    if (areaMax.value !== '') query.amax = String(areaMax.value)
    if (distance.value) query.dist = distance.value
    if (offer.value !== 'all') query.offer = offer.value
    if (sort.value !== 'top') query.sort = sort.value
    if (mode.value !== 'list') query.mode = mode.value
    if (onlyFavourites.value) query.fav = '1'
    if (objectId.value) query.obyekt = objectId.value
    router.replace({ path: '/catalog', query })
  },
  { deep: true },
)
</script>

<template>
  <div class="lg:flex lg:h-[calc(100dvh_-_77px)]">
    <!-- Chap ustun: filtrlar -->
    <aside
      class="hidden border-r border-ink-200 bg-surface xl:flex xl:h-full xl:w-[232px] xl:shrink-0 xl:flex-col"
    >
      <div class="scroll-slim min-h-0 flex-1 overflow-y-auto px-4 py-5">
        <CatalogFilters
          v-model:q="q"
          v-model:sort="sort"
          v-model:price-min="priceMin"
          v-model:price-max="priceMax"
          v-model:selected="selectedTypes"
          v-model:area-min="areaMin"
          v-model:area-max="areaMax"
          v-model:distance="distance"
          v-model:usage="usage"
          heading="Toshkent shahri"
          :summary="summary"
          :chips="chips"
          :types="typeOptions"
          :sort-options="SORT_OPTIONS"
          :distance-options="DISTANCE_OPTIONS"
          :usage-options="usageSelectOptions"
          :active-count="activeCount"
          @reset="resetFilters"
          @clear-chip="clearChip"
        />
      </div>
    </aside>

    <!-- O‘rta ustun: natijalar -->
    <div class="flex min-w-0 flex-1 flex-col lg:h-full lg:min-h-0">
      <div
        class="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-ink-200 bg-surface px-4 py-3 lg:px-5"
      >
        <p class="text-[13.5px] text-ink-600">
          <span class="tabular font-bold text-ink-900">{{ results.length }}</span>
          ta mavjud variant
        </p>

        <div class="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            class="inline-flex min-h-11 items-center gap-1.5 rounded-field px-3 text-[12.5px] font-semibold text-ink-700 ring-1 ring-inset ring-ink-200 transition-colors duration-150 hover:bg-ink-100 md:min-h-9 xl:hidden"
            @click="filtersOpen = true"
          >
            <UiIcon name="filter" :size="16" />
            Filtrlar
            <span
              v-if="activeCount"
              class="tabular rounded-pill bg-brand-500 px-1.5 text-[11px] font-bold leading-4 text-white"
            >
              {{ activeCount }}
            </span>
          </button>

          <div role="tablist" class="inline-flex gap-1 rounded-field bg-ink-100 p-1 lg:hidden">
            <button
              v-for="t in [
                { value: 'list', label: 'Ro‘yxat' },
                { value: 'map', label: 'Xarita' },
              ]"
              :key="t.value"
              type="button"
              role="tab"
              :aria-selected="mode === t.value"
              class="inline-flex min-h-11 items-center rounded-[8px] px-3 text-[12.5px] font-semibold transition-colors duration-150 md:min-h-9"
              :class="
                mode === t.value ? 'bg-white text-brand-600 shadow-card' : 'text-ink-600 hover:text-ink-800'
              "
              @click="mode = t.value"
            >
              {{ t.label }}
            </button>
          </div>

          <div role="tablist" class="inline-flex gap-1 rounded-field bg-ink-100 p-1">
            <button
              v-for="t in OFFER_TABS"
              :key="t.value"
              type="button"
              role="tab"
              :aria-selected="offer === t.value"
              class="inline-flex min-h-11 items-center rounded-[8px] px-3 text-[12.5px] font-semibold transition-colors duration-150 md:min-h-9"
              :class="
                offer === t.value
                  ? 'bg-white text-brand-600 shadow-card'
                  : 'text-ink-600 hover:text-ink-800'
              "
              @click="offer = t.value"
            >
              {{ t.label }}
            </button>
          </div>
        </div>

        <!-- Chap ustun yopiq kengliklarda faol shartlar shu yerda ko‘rinadi -->
        <div v-if="chips.length" class="flex basis-full flex-wrap gap-1.5 xl:hidden">
          <span
            v-for="c in chips"
            :key="c.key"
            class="inline-flex max-w-full items-center gap-1 rounded-pill bg-brand-50 py-1 pl-2.5 pr-1 text-[11.5px] font-semibold text-brand-700"
          >
            <span class="truncate">{{ c.label }}</span>
            <button
              type="button"
              class="relative grid size-6 shrink-0 place-items-center rounded-full text-brand-600 transition-colors duration-150 after:absolute after:-inset-[10px] after:content-[''] hover:bg-brand-100 hover:text-brand-800 md:after:hidden"
              :aria-label="`${c.label} shartini olib tashlash`"
              @click="clearChip(c.key)"
            >
              <UiIcon name="x" :size="12" />
            </button>
          </span>
        </div>
      </div>

      <div
        ref="listEl"
        class="scroll-slim min-h-0 flex-1 space-y-3 px-4 py-4 lg:overflow-y-auto lg:px-5"
        :class="mode === 'map' ? 'max-lg:hidden' : ''"
      >
        <NuxtLink
          v-for="l in results"
          :key="l.unit.id"
          :data-building="l.building.id"
          :to="`/catalog/${l.building.slug}?unit=${l.unit.id}`"
          class="group flex flex-col overflow-hidden rounded-card bg-surface shadow-card ring-1 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-pop md:flex-row"
          :class="hoverId === l.building.id ? 'ring-brand-400' : 'ring-ink-200/70'"
          @mouseenter="hoverId = l.building.id"
          @mouseleave="hoverId = null"
          @focusin="hoverId = l.building.id"
          @click="onCardClick"
        >
          <div class="relative flex w-full shrink-0 md:w-[150px]">
            <UiPhoto
              :name="l.building.photo"
              :alt="`${l.building.name}, ${l.building.city}, ${l.building.district}`"
              rounded="rounded-none"
              ratio="aspect-[16/10] w-full md:aspect-auto"
              sizes="(max-width: 767px) 100vw, 200px"
            >
              <span
                class="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink-900/75 via-ink-900/10 to-transparent"
              />

              <button
                type="button"
                class="absolute right-2 top-2 grid size-11 place-items-center rounded-full bg-white/92 shadow-card backdrop-blur-sm transition-colors duration-150 md:size-8"
                :class="
                  favourites.includes(l.unit.id)
                    ? 'text-danger-500'
                    : 'text-ink-500 hover:text-danger-500'
                "
                :aria-pressed="favourites.includes(l.unit.id)"
                :aria-label="`${l.building.name} ${l.unit.code} ni sevimlilarga qo‘shish`"
                @click.prevent.stop="toggleFavourite(l.unit.id)"
              >
                <svg
                  class="size-[17px]"
                  viewBox="0 0 24 24"
                  :fill="favourites.includes(l.unit.id) ? 'currentColor' : 'none'"
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

              <span
                class="absolute bottom-2 left-2 rounded-pill bg-white/92 px-2 py-0.5 text-[10.5px] font-bold text-ink-800 shadow-card"
              >
                {{ categoryLabel(l) }}
              </span>
            </UiPhoto>
          </div>

          <div class="flex min-w-0 flex-1 flex-col gap-2 p-4">
            <div class="flex items-start justify-between gap-2">
              <h2 class="truncate text-[15.5px] font-bold text-ink-900 group-hover:text-brand-700">
                {{ l.building.name }}
              </h2>
              <span
                class="shrink-0 rounded-pill bg-ink-100 px-2 py-0.5 text-[11px] font-semibold text-ink-600"
              >
                {{ l.unit.code }}
              </span>
            </div>

            <p class="flex items-center gap-1.5 text-[12.5px] text-ink-500">
              <UiIcon name="location" :size="14" class="shrink-0 text-ink-400" />
              <span class="truncate">
                {{ l.building.city }}, {{ l.building.district }}, {{ l.building.street }}
              </span>
            </p>

            <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-ink-600">
              <span class="inline-flex items-center gap-1.5">
                <UiIcon name="layers" :size="14" class="text-ink-400" />
                <span class="tabular">{{ area(l.unit.area) }}</span>
              </span>
              <span class="inline-flex items-center gap-1.5">
                <UiIcon name="building" :size="14" class="text-ink-400" />
                {{ categoryLabel(l) }}
              </span>
              <span class="inline-flex items-center gap-1.5">
                <UiIcon name="grid" :size="14" class="text-ink-400" />
                <span class="tabular">{{ l.unit.floor }}-qavat</span>
              </span>
            </div>

            <ul class="flex flex-wrap items-center gap-x-3 gap-y-1">
              <li
                v-for="e in l.unit.equipment.slice(0, 3)"
                :key="e"
                class="inline-flex items-center gap-1 text-[11.5px] text-ink-500"
              >
                <UiIcon name="check" :size="12" class="shrink-0 text-ok-600" />
                {{ e }}
              </li>
            </ul>

            <div
              class="mt-auto flex flex-wrap items-end justify-between gap-2 border-t border-ink-100 pt-2.5"
            >
              <p class="min-w-0">
                <span
                  class="tabular text-[19px] font-extrabold leading-tight"
                  :class="l.unit.offer === 'Sotuv' ? 'text-teal-700' : 'text-brand-700'"
                >
                  {{ num(l.unit.price) }}
                </span>
                <span class="ml-1 text-[11.5px] font-medium text-ink-500">
                  {{ l.unit.priceUnit }}
                </span>
              </p>

              <span
                class="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-field bg-brand-50 px-3 text-[12.5px] font-semibold text-brand-700 transition-colors duration-150 group-hover:bg-brand-500 group-hover:text-white"
              >
                Batafsil
                <UiIcon name="arrowRight" :size="14" />
              </span>
            </div>
          </div>
        </NuxtLink>

        <div v-if="!results.length" class="rounded-card bg-surface shadow-card ring-1 ring-ink-200/70">
          <UiEmpty
            icon="search"
            title="Tanlangan shartlarga mos variant topilmadi"
            description="Narx, maydon yoki masofa chegaralarini kengaytiring. Barcha bo‘sh joylarni ko‘rish uchun filtrlarni tozalang."
            action-label="Filtrlarni tozalash"
            @action="resetFilters"
          />
        </div>
      </div>
    </div>

    <!-- O‘ng ustun: xarita -->
    <aside
      class="h-[70dvh] border-ink-200 lg:h-full lg:w-[46%] lg:shrink-0 lg:border-l"
      :class="mode === 'map' ? 'block' : 'hidden lg:block'"
    >
      <UiMap
        v-if="mapMarkers.length"
        :markers="mapMarkers"
        :stats="mapStats"
        :legend="MAP_LEGEND"
        :show-coverage="false"
        :min-zoom="10"
        :max-zoom="14"
        :highlight="hoverId"
        height="100%"
        @marker-click="pickObject"
        @marker-hover="hoverId = $event"
      />

      <div v-else class="grid h-full place-items-center bg-surface-sunken px-6">
        <UiEmpty
          icon="location"
          title="Xaritada ko‘rsatiladigan obyekt qolmadi"
          description="Joriy shartlar bo‘yicha birorta obyektda bo‘sh joy yo‘q. Chegaralarni kengaytiring."
          action-label="Filtrlarni tozalash"
          @action="resetFilters"
        />
      </div>
    </aside>

    <!-- Tor ekranlar uchun filtr paneli -->
    <Transition
      enter-active-class="transition-opacity duration-200 ease-out"
      enter-from-class="opacity-0"
      leave-active-class="pointer-events-none transition-opacity duration-150 ease-in"
      leave-to-class="opacity-0"
    >
      <div v-if="filtersOpen" class="fixed inset-0 z-50 xl:hidden">
        <div
          class="absolute inset-0 bg-ink-900/50 backdrop-blur-[2px]"
          @click="filtersOpen = false"
        />

        <Transition
          appear
          enter-active-class="transition-transform duration-200 ease-out"
          enter-from-class="translate-y-full md:-translate-x-full md:translate-y-0"
          enter-to-class="translate-y-0 md:translate-x-0"
          leave-active-class="transition-transform duration-150 ease-in"
          leave-from-class="translate-y-0 md:translate-x-0"
          leave-to-class="translate-y-full md:-translate-x-full md:translate-y-0"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Filtrlar"
            class="scroll-slim absolute inset-x-0 bottom-0 max-h-[86dvh] overflow-y-auto rounded-t-panel bg-surface shadow-pop md:inset-y-0 md:left-0 md:right-auto md:max-h-none md:w-[320px] md:rounded-none"
          >
            <div
              class="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-ink-200 bg-surface px-4 py-3"
            >
              <p class="text-[15px] font-bold text-ink-900">Filtrlar</p>
              <button
                type="button"
                class="grid size-11 place-items-center rounded-field text-ink-500 transition-colors duration-150 hover:bg-ink-100 hover:text-ink-900"
                aria-label="Filtrlarni yopish"
                @click="filtersOpen = false"
              >
                <UiIcon name="x" :size="20" />
              </button>
            </div>

            <div class="px-4 py-5">
              <CatalogFilters
                v-model:q="q"
                v-model:sort="sort"
                v-model:price-min="priceMin"
                v-model:price-max="priceMax"
                v-model:selected="selectedTypes"
                v-model:area-min="areaMin"
                v-model:area-max="areaMax"
                v-model:distance="distance"
          v-model:usage="usage"
                heading="Toshkent shahri"
                :summary="summary"
                :chips="chips"
                :types="typeOptions"
                :sort-options="SORT_OPTIONS"
                :distance-options="DISTANCE_OPTIONS"
          :usage-options="usageSelectOptions"
                :active-count="activeCount"
                @reset="resetFilters"
                @clear-chip="clearChip"
              />
            </div>

            <div class="sticky bottom-0 border-t border-ink-200 bg-surface px-4 py-3">
              <UiButton block @click="filtersOpen = false">
                {{ results.length }} ta variantni ko‘rish
              </UiButton>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </div>
</template>
