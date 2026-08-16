<script setup lang="ts">
import { BUILDINGS, buildingById, type Building } from '~/data/buildings'
import { UNITS, type Unit } from '~/data/units'
import { num, area } from '~/utils/format'

definePageMeta({ layout: 'public' })

interface Listing {
  unit: Unit
  building: Building
}

const CATEGORY_TYPES: Record<string, string[]> = {
  biznes: ['Biznes markaz', 'Ofis binosi'],
  savdo: ['Savdo markaz'],
  ombor: ['Ombor / logistika'],
  turar: ['Turar joy'],
}

const MAP_TONE: Record<string, 'brand' | 'ok' | 'warn' | 'info'> = {
  'Biznes markaz': 'brand',
  'Ofis binosi': 'brand',
  'Savdo markaz': 'info',
  'Ombor / logistika': 'warn',
  'Turar joy': 'ok',
}

const MAP_LEGEND = [
  { label: 'Biznes va ofis', class: 'bg-brand-500' },
  { label: 'Savdo', class: 'bg-info-500' },
  { label: 'Ombor', class: 'bg-warn-500' },
  { label: 'Turar joy', class: 'bg-ok-500' },
]

const route = useRoute()
const router = useRouter()

function initial(key: string) {
  const v = route.query[key]
  return typeof v === 'string' ? v : ''
}

const q = ref(initial('q'))
const type = ref(initial('type'))
const usage = ref(initial('usage'))
const place = ref(initial('place'))
const price = ref(initial('price'))
const size = ref(initial('size'))
const floor = ref(initial('floor'))
const offer = ref(initial('offer') || 'all')
const sort = ref(initial('sort') || 'price-asc')
const view = ref<'grid' | 'list'>(initial('view') === 'list' ? 'list' : 'grid')
const mode = ref<'list' | 'map'>(initial('mode') === 'map' ? 'map' : 'list')
const onlyFavourites = ref(initial('fav') === '1')
const objectId = ref(BUILDINGS.some((b) => b.id === initial('obyekt')) ? initial('obyekt') : '')

const TYPE_OPTIONS = [
  { value: '', label: 'Barchasi' },
  { value: 'biznes', label: 'Biznes markaz' },
  { value: 'savdo', label: 'Savdo markaz' },
  { value: 'ombor', label: 'Ombor / logistika' },
  { value: 'turar', label: 'Turar joy' },
]

const USAGE_OPTIONS = [
  { value: '', label: 'Barchasi' },
  { value: 'Ofis', label: 'Ofis' },
  { value: 'Savdo', label: 'Savdo' },
  { value: 'Ombor', label: 'Ombor' },
  { value: 'Turar joy', label: 'Turar joy' },
]

const PLACE_OPTIONS = [
  { value: '', label: 'Barchasi' },
  ...BUILDINGS.map((b) => ({
    value: `${b.city}|${b.district}`,
    label: `${b.city}, ${b.district}`,
  })),
]

const PRICE_OPTIONS = [
  { value: '', label: 'Barchasi' },
  { value: 'p1', label: '5 mln so‘mgacha' },
  { value: 'p2', label: '5 – 15 mln so‘m' },
  { value: 'p3', label: '15 – 50 mln so‘m' },
  { value: 'p4', label: '50 mln so‘mdan yuqori' },
]

const AREA_OPTIONS = [
  { value: '', label: 'Barchasi' },
  { value: 'a1', label: '100 m² gacha' },
  { value: 'a2', label: '100 – 300 m²' },
  { value: 'a3', label: '300 – 600 m²' },
  { value: 'a4', label: '600 m² dan katta' },
]

const FLOOR_OPTIONS = [
  { value: '', label: 'Barchasi' },
  { value: 'f1', label: '1-qavat' },
  { value: 'f2', label: '2 – 5-qavat' },
  { value: 'f3', label: '6 – 10-qavat' },
  { value: 'f4', label: '10-qavatdan yuqori' },
]

const OFFER_TABS = [
  { value: 'all', label: 'Barcha' },
  { value: 'rent', label: 'Ijaraga' },
  { value: 'buy', label: 'Sotib olish' },
]

const SORT_OPTIONS = [
  { value: 'price-asc', label: 'Narx: arzondan qimmatga' },
  { value: 'price-desc', label: 'Narx: qimmatdan arzonga' },
  { value: 'area-desc', label: 'Maydon: kattadan kichikka' },
  { value: 'area-asc', label: 'Maydon: kichikdan kattaga' },
]

const all = computed<Listing[]>(() =>
  UNITS.filter((u) => u.status === 'VACANT')
    .map((u) => ({ unit: u, building: buildingById(u.buildingId)! }))
    .filter((l) => !!l.building),
)

const favourites = ref<string[]>([])
const compare = ref<string[]>([])
const compareOpen = ref(false)

function toggleFavourite(id: string) {
  favourites.value = favourites.value.includes(id)
    ? favourites.value.filter((f) => f !== id)
    : [...favourites.value, id]
}

function toggleCompare(id: string) {
  compare.value = compare.value.includes(id)
    ? compare.value.filter((f) => f !== id)
    : [...compare.value, id]
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
  const p = u.price / 1_000_000
  if (price.value === 'p1') return p < 5
  if (price.value === 'p2') return p >= 5 && p < 15
  if (price.value === 'p3') return p >= 15 && p < 50
  if (price.value === 'p4') return p >= 50
  return true
}

function matchArea(u: Unit) {
  if (size.value === 'a1') return u.area < 100
  if (size.value === 'a2') return u.area >= 100 && u.area < 300
  if (size.value === 'a3') return u.area >= 300 && u.area < 600
  if (size.value === 'a4') return u.area >= 600
  return true
}

function matchFloor(u: Unit) {
  if (floor.value === 'f1') return u.floor === 1
  if (floor.value === 'f2') return u.floor >= 2 && u.floor <= 5
  if (floor.value === 'f3') return u.floor >= 6 && u.floor <= 10
  if (floor.value === 'f4') return u.floor > 10
  return true
}

function matchOffer(u: Unit) {
  if (offer.value === 'rent') return u.offer === 'Ijara' || u.offer === 'Ikkalasi'
  if (offer.value === 'buy') return u.offer === 'Sotuv' || u.offer === 'Ikkalasi'
  return true
}

/** Obyekt filtri xarita nuqtalarini yo‘qotmasligi uchun undan oldin hisoblanadi */
const matched = computed(() =>
  all.value.filter((l) => {
    if (!matchText(l)) return false
    if (type.value && !(CATEGORY_TYPES[type.value] ?? []).includes(l.building.type)) return false
    if (usage.value && l.unit.usage !== usage.value) return false
    if (place.value && `${l.building.city}|${l.building.district}` !== place.value) return false
    if (!matchPrice(l.unit)) return false
    if (!matchArea(l.unit)) return false
    if (!matchFloor(l.unit)) return false
    if (!matchOffer(l.unit)) return false
    if (onlyFavourites.value && !favourites.value.includes(l.unit.id)) return false
    return true
  }),
)

const results = computed(() => {
  const list = matched.value.filter((l) => !objectId.value || l.building.id === objectId.value)
  const sorted = [...list]
  if (sort.value === 'price-asc') sorted.sort((a, b) => a.unit.price - b.unit.price)
  if (sort.value === 'price-desc') sorted.sort((a, b) => b.unit.price - a.unit.price)
  if (sort.value === 'area-desc') sorted.sort((a, b) => b.unit.area - a.unit.area)
  if (sort.value === 'area-asc') sorted.sort((a, b) => a.unit.area - b.unit.area)
  return sorted
})

const mapMarkers = computed(() =>
  BUILDINGS.map((b) => {
    const items = matched.value.filter((l) => l.building.id === b.id)
    return { building: b, items }
  })
    .filter((g) => g.items.length > 0)
    .map((g) => ({
      id: g.building.id,
      lat: g.building.lat,
      lon: g.building.lon,
      label: g.building.name,
      caption: `${g.building.district} · ${g.building.type}`,
      value: g.items.length,
      valueLabel: 'ta bo‘sh joy',
      to: `/catalog/${g.building.slug}`,
      tone: MAP_TONE[g.building.type] ?? 'brand',
    })),
)

const mapStats = computed(() => [
  { label: 'Obyektlar', value: String(mapMarkers.value.length) },
  { label: 'Bo‘sh joylar', value: String(matched.value.length) },
])

const activeObject = computed(() => BUILDINGS.find((b) => b.id === objectId.value))

function pickObject(m: { id: string }) {
  objectId.value = objectId.value === m.id ? '' : m.id
}

const chips = computed(() => {
  const out: Array<{ key: string; label: string; clear: () => void }> = []
  const text = q.value.trim()
  if (text) out.push({ key: 'q', label: `Qidiruv: ${text}`, clear: () => (q.value = '') })
  if (type.value)
    out.push({
      key: 'type',
      label: TYPE_OPTIONS.find((o) => o.value === type.value)?.label ?? '',
      clear: () => (type.value = ''),
    })
  if (usage.value)
    out.push({ key: 'usage', label: `Maqsad: ${usage.value}`, clear: () => (usage.value = '') })
  if (place.value)
    out.push({
      key: 'place',
      label: PLACE_OPTIONS.find((o) => o.value === place.value)?.label ?? '',
      clear: () => (place.value = ''),
    })
  if (price.value)
    out.push({
      key: 'price',
      label: PRICE_OPTIONS.find((o) => o.value === price.value)?.label ?? '',
      clear: () => (price.value = ''),
    })
  if (size.value)
    out.push({
      key: 'size',
      label: AREA_OPTIONS.find((o) => o.value === size.value)?.label ?? '',
      clear: () => (size.value = ''),
    })
  if (floor.value)
    out.push({
      key: 'floor',
      label: FLOOR_OPTIONS.find((o) => o.value === floor.value)?.label ?? '',
      clear: () => (floor.value = ''),
    })
  if (offer.value !== 'all')
    out.push({
      key: 'offer',
      label: OFFER_TABS.find((o) => o.value === offer.value)?.label ?? '',
      clear: () => (offer.value = 'all'),
    })
  if (onlyFavourites.value)
    out.push({
      key: 'fav',
      label: 'Faqat sevimlilar',
      clear: () => (onlyFavourites.value = false),
    })
  if (activeObject.value)
    out.push({
      key: 'obyekt',
      label: `Obyekt: ${activeObject.value.name}`,
      clear: () => (objectId.value = ''),
    })
  return out
})

function resetFilters() {
  q.value = ''
  type.value = ''
  usage.value = ''
  place.value = ''
  price.value = ''
  size.value = ''
  floor.value = ''
  offer.value = 'all'
  onlyFavourites.value = false
  objectId.value = ''
}

watch(
  [q, type, usage, place, price, size, floor, offer, sort, view, mode, onlyFavourites, objectId],
  () => {
    const query: Record<string, string> = {}
    if (q.value.trim()) query.q = q.value.trim()
    if (type.value) query.type = type.value
    if (usage.value) query.usage = usage.value
    if (place.value) query.place = place.value
    if (price.value) query.price = price.value
    if (size.value) query.size = size.value
    if (floor.value) query.floor = floor.value
    if (offer.value !== 'all') query.offer = offer.value
    if (sort.value !== 'price-asc') query.sort = sort.value
    if (view.value !== 'grid') query.view = view.value
    if (mode.value !== 'list') query.mode = mode.value
    if (onlyFavourites.value) query.fav = '1'
    if (objectId.value) query.obyekt = objectId.value
    router.replace({ path: '/catalog', query })
  },
)

const MODE_TABS = computed(() => [
  { value: 'list', label: 'Ro‘yxat' },
  { value: 'map', label: 'Xarita', count: mapMarkers.value.length },
])

const compareItems = computed(() =>
  all.value.filter((l) => compare.value.includes(l.unit.id)).slice(0, 4),
)

const compareLink = computed(() => {
  const first = compareItems.value[0]
  return first ? `/catalog/${first.building.slug}?unit=${first.unit.id}` : '/catalog'
})

const COMPARE_ROWS: Array<{ label: string; get: (l: Listing) => string }> = [
  { label: 'Obyekt', get: (l) => l.building.name },
  { label: 'Joy turi', get: (l) => l.building.type },
  { label: 'Manzil', get: (l) => `${l.building.city}, ${l.building.district}` },
  { label: 'Unit', get: (l) => l.unit.code },
  { label: 'Maqsad', get: (l) => l.unit.usage },
  { label: 'Taklif', get: (l) => (l.unit.offer === 'Sotuv' ? 'Sotib olish' : 'Ijaraga') },
  { label: 'Umumiy maydon', get: (l) => area(l.unit.area) },
  { label: 'Qavat', get: (l) => `${l.unit.floor}-qavat` },
  { label: 'Xonalar', get: (l) => `${l.unit.rooms} ta` },
  { label: 'Narx', get: (l) => `${num(l.unit.price)} ${l.unit.priceUnit}` },
  { label: 'Bino klassi', get: (l) => l.building.buildingClass },
  { label: 'Qurilgan yil', get: (l) => String(l.building.buildYear) },
]
</script>

<template>
  <div class="mx-auto max-w-[1360px] px-4 py-6 lg:px-8 lg:py-8">
    <nav class="flex items-center gap-1.5 text-[12.5px]">
      <NuxtLink to="/" class="text-ink-500 transition-colors hover:text-brand-600">
        Bosh sahifa
      </NuxtLink>
      <UiIcon name="chevronRight" :size="12" class="text-ink-300" />
      <span class="text-ink-700">Katalog</span>
    </nav>

    <div class="mt-2 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold">Bo‘sh joylar katalogi</h1>
        <p class="mt-1 text-[13.5px] text-ink-500">
          Ofis, savdo, ombor va turar joy maydonlari — mavjud e’lonlar bo‘yicha tanlov
        </p>
      </div>
      <UiTabs v-model="offer" :tabs="OFFER_TABS" />
    </div>

    <div class="mt-5 grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside class="lg:sticky lg:top-[88px] lg:self-start">
        <UiCard title="Filtrlar" :subtitle="`${chips.length} ta filter faol`">
          <template #actions>
            <UiButton variant="ghost" size="sm" :disabled="!chips.length" @click="resetFilters">
              Tozalash
            </UiButton>
          </template>

          <div class="space-y-4">
            <UiField label="Qidiruv">
              <UiInput v-model="q" placeholder="Joy nomi, manzil yoki kalit so‘z">
                <template #prefix>
                  <UiIcon name="search" :size="18" />
                </template>
              </UiInput>
            </UiField>

            <UiField label="Joy turi">
              <UiSelect v-model="type" :options="TYPE_OPTIONS" size="sm" />
            </UiField>

            <UiField label="Maqsad">
              <UiSelect v-model="usage" :options="USAGE_OPTIONS" size="sm" />
            </UiField>

            <UiField label="Shahar / Tuman">
              <UiSelect v-model="place" :options="PLACE_OPTIONS" size="sm" />
            </UiField>

            <UiField label="Narx oralig‘i">
              <UiSelect v-model="price" :options="PRICE_OPTIONS" size="sm" />
            </UiField>

            <UiField label="Maydon (m²)">
              <UiSelect v-model="size" :options="AREA_OPTIONS" size="sm" />
            </UiField>

            <UiField label="Qavat">
              <UiSelect v-model="floor" :options="FLOOR_OPTIONS" size="sm" />
            </UiField>

            <button
              type="button"
              class="flex min-h-10 w-full items-center gap-2.5 rounded-field px-3 py-2.5 text-left text-[13px] font-semibold transition-colors duration-150"
              :class="
                onlyFavourites
                  ? 'bg-danger-50 text-danger-600 ring-1 ring-inset ring-danger-100'
                  : 'bg-ink-100 text-ink-700 hover:bg-ink-200'
              "
              :aria-pressed="onlyFavourites"
              @click="onlyFavourites = !onlyFavourites"
            >
              <svg
                class="size-[17px]"
                viewBox="0 0 24 24"
                :fill="onlyFavourites ? 'currentColor' : 'none'"
                stroke="currentColor"
                stroke-width="1.7"
                aria-hidden="true"
              >
                <path
                  d="M12 20.2 4.9 13.3a4.6 4.6 0 0 1 6.5-6.5l.6.6.6-.6a4.6 4.6 0 0 1 6.5 6.5z"
                  stroke-linejoin="round"
                />
              </svg>
              Faqat sevimlilar
              <span class="tabular ml-auto text-[12px]">{{ favourites.length }}</span>
            </button>
          </div>
        </UiCard>
      </aside>

      <div class="min-w-0">
        <div
          class="flex flex-wrap items-center justify-between gap-3 rounded-card bg-surface px-4 py-3 shadow-card ring-1 ring-ink-200/60"
        >
          <p class="text-[13.5px] text-ink-600">
            <span class="tabular font-bold text-ink-900">{{ results.length }}</span>
            ta bo‘sh joy topildi
          </p>

          <div class="flex flex-wrap items-center gap-2.5">
            <UiTabs v-model="mode" :tabs="MODE_TABS" />

            <UiSelect v-model="sort" :options="SORT_OPTIONS" size="sm" class="w-full sm:w-56" />

            <div class="flex gap-1 rounded-field bg-ink-100 p-1">
              <button
                type="button"
                class="grid size-8 place-items-center rounded-[7px] transition-colors duration-150"
                :class="view === 'grid' ? 'bg-white text-brand-600 shadow-card' : 'text-ink-500'"
                :aria-pressed="view === 'grid'"
                aria-label="Katak ko‘rinishi"
                @click="view = 'grid'"
              >
                <UiIcon name="dashboard" :size="17" />
              </button>
              <button
                type="button"
                class="grid size-8 place-items-center rounded-[7px] transition-colors duration-150"
                :class="view === 'list' ? 'bg-white text-brand-600 shadow-card' : 'text-ink-500'"
                :aria-pressed="view === 'list'"
                aria-label="Ro‘yxat ko‘rinishi"
                @click="view = 'list'"
              >
                <UiIcon name="layers" :size="17" />
              </button>
            </div>
          </div>
        </div>

        <div v-if="chips.length" class="mt-3 flex flex-wrap items-center gap-2">
          <span
            v-for="c in chips"
            :key="c.key"
            class="inline-flex items-center gap-1.5 rounded-pill bg-surface py-1.5 pl-3 pr-1.5 text-[12.5px] font-semibold text-ink-700 shadow-card ring-1 ring-ink-200/60"
          >
            {{ c.label }}
            <button
              type="button"
              class="grid size-5 place-items-center rounded-full bg-ink-100 text-ink-500 transition-colors duration-150 hover:bg-danger-50 hover:text-danger-600"
              :aria-label="`${c.label} filtrini olib tashlash`"
              @click="c.clear()"
            >
              <UiIcon name="x" :size="12" />
            </button>
          </span>
        </div>

        <section
          v-if="mode === 'map'"
          class="mt-4 rounded-card bg-surface p-3 shadow-card ring-1 ring-ink-200/60"
        >
          <UiMap
            v-if="mapMarkers.length"
            :markers="mapMarkers"
            :stats="mapStats"
            :legend="MAP_LEGEND"
            :show-coverage="false"
            :min-zoom="10"
            :max-zoom="12"
            height="440px"
            @marker-click="pickObject"
          />

          <div
            v-else
            class="grid place-items-center rounded-panel bg-surface-sunken px-6 py-16 text-center ring-1 ring-inset ring-ink-200"
          >
            <span class="grid size-14 place-items-center rounded-full bg-ink-100 text-ink-400">
              <UiIcon name="location" :size="26" />
            </span>
            <h2 class="mt-4 text-[16px] font-bold">Xaritada ko‘rsatiladigan obyekt qolmadi</h2>
            <p class="mx-auto mt-2 max-w-[46ch] text-[13.5px] leading-relaxed text-ink-600">
              Joriy filtrlar bo‘yicha birorta obyektda bo‘sh joy yo‘q. Shartlarni kengaytiring.
            </p>
            <UiButton class="mt-5" @click="resetFilters">
              <UiIcon name="refresh" :size="17" />
              Filtrlarni tozalash
            </UiButton>
          </div>

          <div class="mt-3 flex flex-wrap items-center justify-between gap-3 px-1.5 pb-1">
            <p class="text-[12.5px] text-ink-500">
              Xaritadagi nuqtani bosing — ro‘yxat shu obyekt bo‘yicha filtrlanadi.
            </p>
            <button
              v-if="activeObject"
              type="button"
              class="inline-flex min-h-9 items-center gap-1.5 rounded-field bg-brand-50 px-3 text-[12.5px] font-semibold text-brand-700 transition-colors duration-150 hover:bg-brand-100"
              @click="objectId = ''"
            >
              <UiIcon name="x" :size="14" />
              {{ activeObject.name }} filtrini olib tashlash
            </button>
          </div>
        </section>

        <div
          v-if="results.length"
          class="mt-4"
          :class="
            view === 'grid' ? 'grid gap-5 sm:grid-cols-2 2xl:grid-cols-3' : 'flex flex-col gap-5'
          "
        >
          <NuxtLink
            v-for="l in results"
            :key="l.unit.id"
            :to="`/catalog/${l.building.slug}?unit=${l.unit.id}`"
            class="group overflow-hidden rounded-card bg-surface shadow-card ring-1 ring-ink-200/60 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-pop"
            :class="view === 'grid' ? 'flex flex-col' : 'flex flex-col sm:flex-row'"
          >
            <div
              class="relative shrink-0"
              :class="view === 'grid' ? 'w-full' : 'w-full sm:w-[290px]'"
            >
              <UiPhoto
                :name="l.building.photo"
                :alt="`${l.building.name} — ${l.building.city}, ${l.building.district}`"
                rounded="rounded-none"
                :ratio="
                  view === 'grid'
                    ? 'aspect-[16/10]'
                    : 'aspect-[16/10] sm:aspect-auto sm:h-full sm:min-h-[200px]'
                "
                :sizes="
                  view === 'grid'
                    ? '(max-width: 640px) 100vw, (max-width: 1024px) 46vw, 340px'
                    : '(max-width: 640px) 100vw, 300px'
                "
              >
                <span
                  class="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink-900/80 via-ink-900/20 to-transparent"
                />

                <span
                  class="absolute left-3 top-3 rounded-pill px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white shadow-card"
                  :class="l.unit.offer === 'Sotuv' ? 'bg-teal-600' : 'bg-brand-600'"
                >
                  {{ l.unit.offer === 'Sotuv' ? 'Sotib olish' : 'Ijaraga' }}
                </span>

                <span
                  class="absolute bottom-3 left-3 text-[12px] font-semibold text-white/95 drop-shadow"
                >
                  {{ l.building.type }} · {{ l.building.buildingClass }}
                </span>

                <span class="absolute right-3 top-3 flex gap-2">
                  <button
                    type="button"
                    class="grid size-10 place-items-center rounded-full bg-white/92 shadow-card backdrop-blur-sm transition-colors duration-150"
                    :class="
                      favourites.includes(l.unit.id)
                        ? 'text-danger-500'
                        : 'text-ink-500 hover:text-danger-500'
                    "
                    :aria-pressed="favourites.includes(l.unit.id)"
                    aria-label="Sevimlilarga qo‘shish"
                    @click.prevent.stop="toggleFavourite(l.unit.id)"
                  >
                    <svg
                      class="size-[18px]"
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

                  <button
                    type="button"
                    class="grid size-10 place-items-center rounded-full shadow-card backdrop-blur-sm transition-colors duration-150"
                    :class="
                      compare.includes(l.unit.id)
                        ? 'bg-brand-600 text-white'
                        : 'bg-white/92 text-ink-500 hover:text-brand-600'
                    "
                    :aria-pressed="compare.includes(l.unit.id)"
                    aria-label="Solishtirishga qo‘shish"
                    @click.prevent.stop="toggleCompare(l.unit.id)"
                  >
                    <UiIcon name="chart" :size="17" />
                  </button>
                </span>
              </UiPhoto>
            </div>

            <div class="flex min-w-0 flex-1 flex-col gap-2 p-5">
              <div class="flex items-start justify-between gap-3">
                <h2 class="truncate text-[16px] font-bold text-ink-900 group-hover:text-brand-700">
                  {{ l.building.name }}
                </h2>
                <UiStatus kind="unit" :value="l.unit.status" size="sm" />
              </div>

              <p class="flex items-center gap-1.5 truncate text-[13px] text-ink-500">
                <UiIcon name="location" :size="14" class="shrink-0 text-ink-400" />
                {{ l.building.city }}, {{ l.building.district }}, {{ l.building.street }}
              </p>

              <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-600">
                <span class="inline-flex items-center gap-1.5">
                  <UiIcon name="layers" :size="14" class="text-ink-400" />
                  <span class="tabular">{{ area(l.unit.area) }}</span>
                </span>
                <span class="inline-flex items-center gap-1.5">
                  <UiIcon name="building" :size="14" class="text-ink-400" />
                  <span class="tabular">{{ l.unit.floor }}-qavat</span>
                </span>
                <span class="inline-flex items-center gap-1.5">
                  <UiIcon name="clipboard" :size="14" class="text-ink-400" />
                  {{ l.unit.usage }} · {{ l.unit.code }}
                </span>
              </div>

              <div
                v-if="view === 'list'"
                class="flex flex-wrap gap-2 border-t border-ink-100 pt-3 text-[12px]"
              >
                <span class="rounded-pill bg-surface-sunken px-2.5 py-1 font-medium text-ink-700">
                  {{ l.unit.rooms }} xonali
                </span>
                <span class="rounded-pill bg-surface-sunken px-2.5 py-1 font-medium text-ink-700">
                  {{ l.building.buildingClass }}
                </span>
                <span class="rounded-pill bg-surface-sunken px-2.5 py-1 font-medium text-ink-700">
                  {{ l.building.buildYear }}-yil
                </span>
                <span
                  v-for="e in l.unit.equipment.slice(0, 2)"
                  :key="e"
                  class="rounded-pill bg-surface-sunken px-2.5 py-1 font-medium text-ink-700"
                >
                  {{ e }}
                </span>
              </div>

              <div
                class="mt-auto flex items-end justify-between gap-3 border-t border-ink-100 pt-3"
              >
                <p class="min-w-0">
                  <span
                    class="tabular block text-[19px] font-extrabold leading-tight"
                    :class="l.unit.offer === 'Sotuv' ? 'text-teal-700' : 'text-brand-700'"
                  >
                    {{ num(l.unit.price) }}
                  </span>
                  <span class="block text-[12px] font-medium text-ink-500">
                    {{ l.unit.priceUnit }}
                  </span>
                </p>
                <span
                  class="inline-flex shrink-0 items-center gap-1.5 text-[13px] font-semibold text-brand-600"
                >
                  Batafsil
                  <UiIcon name="arrowRight" :size="15" />
                </span>
              </div>
            </div>
          </NuxtLink>
        </div>

        <div
          v-else
          class="mt-4 rounded-card bg-surface px-6 py-16 text-center shadow-card ring-1 ring-ink-200/60"
        >
          <span class="mx-auto grid size-14 place-items-center rounded-full bg-ink-100 text-ink-400">
            <UiIcon name="search" :size="26" />
          </span>
          <h2 class="mt-4 text-[17px] font-bold">Tanlangan shartlarga mos joy topilmadi</h2>
          <p class="mx-auto mt-2 max-w-[46ch] text-[13.5px] leading-relaxed text-ink-600">
            Filtrlarni kengaytiring yoki qidiruv so‘zini o‘zgartiring. Barcha bo‘sh joylarni
            ko‘rish uchun filtrlarni tozalang.
          </p>
          <div class="mt-5 flex flex-wrap justify-center gap-3">
            <UiButton @click="resetFilters">
              <UiIcon name="refresh" :size="17" />
              Filtrlarni tozalash
            </UiButton>
            <UiButton variant="secondary" to="/">Bosh sahifaga qaytish</UiButton>
          </div>
        </div>
      </div>
    </div>

    <div v-if="compare.length >= 2" class="fixed inset-x-0 bottom-5 z-30 px-4">
      <div
        class="mx-auto flex max-w-[1000px] flex-wrap items-center gap-3 rounded-panel bg-ink-900 px-5 py-3.5 shadow-pop"
      >
        <span class="text-[13px] font-semibold text-white">
          Solishtirish uchun tanlandi: {{ compare.length }}
        </span>

        <div class="flex flex-wrap gap-2">
          <span
            v-for="l in compareItems"
            :key="l.unit.id"
            class="inline-flex items-center gap-2 rounded-pill bg-white/10 py-1 pl-3 pr-1.5 text-[12px] font-medium text-white"
          >
            {{ l.building.name }} · {{ l.unit.code }}
            <button
              type="button"
              class="grid size-5 place-items-center rounded-full bg-white/15 transition-colors duration-150 hover:bg-white/30"
              :aria-label="`${l.building.name} ${l.unit.code} ni ro‘yxatdan olib tashlash`"
              @click="toggleCompare(l.unit.id)"
            >
              <UiIcon name="x" :size="12" />
            </button>
          </span>
        </div>

        <div class="ml-auto flex items-center gap-2.5">
          <button
            type="button"
            class="h-9 rounded-[8px] px-3.5 text-[13px] font-semibold text-white/80 transition-colors duration-150 hover:bg-white/10 hover:text-white"
            @click="compare = []"
          >
            Tozalash
          </button>
          <UiButton size="sm" @click="compareOpen = true">
            <UiIcon name="chart" :size="16" />
            Solishtirish
          </UiButton>
        </div>
      </div>
    </div>

    <UiModal
      v-model="compareOpen"
      title="Tanlangan joylarni solishtirish"
      subtitle="Asosiy parametrlar bo‘yicha yonma-yon taqqoslash"
      size="xl"
    >
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div v-for="l in compareItems" :key="`ph-${l.unit.id}`">
          <UiPhoto
            :name="l.building.photo"
            :alt="l.building.name"
            ratio="aspect-[16/10]"
            rounded="rounded-field"
            sizes="(max-width: 640px) 90vw, 240px"
          />
          <p class="mt-2 truncate text-[13px] font-semibold text-ink-800">
            {{ l.building.name }} · {{ l.unit.code }}
          </p>
        </div>
      </div>

      <div class="scroll-slim mt-5 overflow-x-auto">
        <table class="w-full min-w-[640px] border-collapse text-left">
          <thead>
            <tr>
              <th class="w-44 px-3 py-2.5 text-[12px] font-semibold uppercase text-ink-500">
                Parametr
              </th>
              <th
                v-for="l in compareItems"
                :key="l.unit.id"
                class="px-3 py-2.5 text-[13px] font-bold text-ink-900"
              >
                {{ l.building.name }} · Unit {{ l.unit.code }}
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-ink-100">
            <tr v-for="r in COMPARE_ROWS" :key="r.label">
              <th class="px-3 py-2.5 text-[13px] font-medium text-ink-500">{{ r.label }}</th>
              <td
                v-for="l in compareItems"
                :key="l.unit.id"
                class="px-3 py-2.5 text-[13px] font-medium text-ink-800"
              >
                {{ r.get(l) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <template #footer>
        <UiButton variant="secondary" @click="compareOpen = false">Yopish</UiButton>
        <UiButton :to="compareLink">Birinchisini ochish</UiButton>
      </template>
    </UiModal>
  </div>
</template>
