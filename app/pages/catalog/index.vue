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
 * BINO TURI lug‘ati. Yorliq ma’lumotnomadagi BLD_TYPE yozuvi bilan aynan bir
 * xil, shuning uchun bitta bino landingda bir nom, katalogda boshqa nom bilan
 * chiqmaydi. Kalitlar bosh sahifa va pastki menyu yuboradigan `type`
 * qiymatlari, xarita rangi ham shu yerdan olinadi.
 */
const BUILDING_TYPES: Array<{
  value: string
  type: Building['type']
  tone: 'brand' | 'ok' | 'warn' | 'danger' | 'info'
  dot: string
}> = [
  { value: 'biznes', type: 'Biznes markaz', tone: 'brand', dot: 'bg-brand-500' },
  { value: 'ofis', type: 'Ofis binosi', tone: 'info', dot: 'bg-info-500' },
  { value: 'savdo', type: 'Savdo markaz', tone: 'danger', dot: 'bg-danger-500' },
  { value: 'ombor', type: 'Ombor / logistika', tone: 'warn', dot: 'bg-warn-500' },
  { value: 'turar', type: 'Turar joy', tone: 'ok', dot: 'bg-ok-500' },
]

/**
 * MAYDON MAQSADI bino turidan butunlay boshqa o‘lchov: biznes markazda ham
 * ombor xonasi, savdo markazida ham ofis bo‘lishi mumkin. Yorliqlarda
 * «maydoni» so‘zi bor, chunki yon panelda «Ofis binosi» bino turi sifatida
 * ham turadi va bitta ekranda «Ofis» ikki ma’noni bildirmasligi kerak.
 */
const USAGE_OPTIONS = [
  { value: 'Ofis', label: 'Ofis maydoni' },
  { value: 'Savdo', label: 'Savdo maydoni' },
  { value: 'Ombor', label: 'Ombor maydoni' },
  { value: 'Turar joy', label: 'Turar joy maydoni' },
]

const usageSelectOptions = [
  { value: '', label: 'Barcha maqsadlar' },
  ...USAGE_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
]

/** Unit maqsadining to‘liq yorlig‘i, bino turi bilan chalkashmasligi uchun */
function usageLabel(value: string) {
  return USAGE_OPTIONS.find((o) => o.value === value)?.label ?? value
}

/** Sotuv unitlari so‘m/m² da, ijara unitlari so‘m/oy da narxlanadi */
const SALE_UNIT = 'so‘m / m²'

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

/** Xarita nuqtasi ham, legenda ham bitta lug‘atdan quriladi */
const MAP_TONE = Object.fromEntries(
  BUILDING_TYPES.map((c) => [c.type, c.tone]),
) as Record<string, 'brand' | 'ok' | 'warn' | 'danger' | 'info'>

const MAP_LEGEND = BUILDING_TYPES.map((c) => ({ label: c.type, class: c.dot }))

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

const CATALOG_PATH = '/catalog'

const q = ref('')
const selectedTypes = ref<string[]>([])
const place = ref('')
// Raqamli maydon `<input type="number">` bo‘lgani uchun bo‘sh bo‘lmaganda son
// qaytaradi, shuning uchun turi matn va sondan iborat
const rentMin = ref<string | number>('')
const rentMax = ref<string | number>('')
const saleMin = ref<string | number>('')
const saleMax = ref<string | number>('')
const areaMin = ref<string | number>('')
const areaMax = ref<string | number>('')
const distance = ref('')
const offer = ref('all')
const sort = ref('top')
const mode = ref('list')
const usage = ref('')
const onlyFavourites = ref(false)
const objectId = ref('')

/** Narx oralig‘i qaysi shkalada ko‘rsatilishi taklif turiga bog‘liq */
const showRentPrice = computed(() => offer.value !== 'buy')
const showSalePrice = computed(() => offer.value !== 'rent')

/**
 * URL dagi shartlarni filtr holatiga ko‘chiradi. Katalogning o‘zida turib
 * havola bosilganda ham (pastki menyudagi tur havolalari, «Sevimli e’lonlar»)
 * shu funksiya ishlaydi, shuning uchun ro‘yxat boshqa sahifadan kelgandagi
 * kabi yangilanadi.
 */
function applyQuery(query: typeof route.query) {
  const get = (key: string) => {
    const v = query[key]
    return typeof v === 'string' ? v : ''
  }

  q.value = get('q')

  const types: string[] = []
  for (const raw of get('type').split(',')) {
    const key = raw.trim()
    if (key && BUILDING_TYPES.some((c) => c.value === key) && !types.includes(key)) types.push(key)
  }
  selectedTypes.value = types

  place.value = get('place')
  distance.value = DISTANCE_OPTIONS.some((o) => o.value === get('dist')) ? get('dist') : ''
  offer.value = OFFER_TABS.some((o) => o.value === get('offer')) ? get('offer') : 'all'
  sort.value = SORT_OPTIONS.some((o) => o.value === get('sort')) ? get('sort') : 'top'
  mode.value = get('mode') === 'map' ? 'map' : 'list'
  usage.value = USAGE_OPTIONS.some((o) => o.value === get('usage')) ? get('usage') : ''
  onlyFavourites.value = get('fav') === '1'
  objectId.value = BUILDINGS.some((b) => b.id === get('obyekt')) ? get('obyekt') : ''

  const areaBucket = AREA_BUCKETS[get('size')] ?? ['', '']
  areaMin.value = get('amin') || areaBucket[0] || ''
  areaMax.value = get('amax') || areaBucket[1] || ''

  // Bosh sahifadagi narx oralig‘i tanlangan taklif turining shkalasiga
  // tushadi: «Sotuv» tabida so‘m/m², qolganida so‘m/oy. Ko‘rinmaydigan shkala
  // tozalanadi, aks holda yashirin shart natijani jimgina qisqartirib turadi.
  const bucket = PRICE_BUCKETS[get('price')] ?? ['', '']
  const rentBucket = offer.value === 'buy' ? ['', ''] : bucket
  const saleBucket = offer.value === 'buy' ? bucket : ['', '']
  rentMin.value = showRentPrice.value ? get('pmin') || rentBucket[0] || '' : ''
  rentMax.value = showRentPrice.value ? get('pmax') || rentBucket[1] || '' : ''
  saleMin.value = showSalePrice.value ? get('smin') || saleBucket[0] || '' : ''
  saleMax.value = showSalePrice.value ? get('smax') || saleBucket[1] || '' : ''
}

applyQuery(route.query)

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

/**
 * Ijara so‘m/oy da, sotuv esa so‘m/m² da narxlangan. Har bir unit faqat o‘z
 * shkalasidagi oraliq bilan solishtiriladi, aks holda 78 m² lik kvartira
 * (990 mln so‘m) oylik ijara oralig‘iga tushib qolardi.
 */
function matchPrice(u: Unit) {
  const sale = u.priceUnit === SALE_UNIT
  const rentSet = numberOf(rentMin.value) !== null || numberOf(rentMax.value) !== null
  const saleSet = numberOf(saleMin.value) !== null || numberOf(saleMax.value) !== null
  if (!rentSet && !saleSet) return true
  // Narx oralig‘i belgilangan shkaladagi e’lonlargina qoladi: «Ijara narxi»
  // yozib qo‘yilganda so‘m/m² dagi sotuv e’lonlari ro‘yxatga qo‘shilmaydi.
  if (sale && !saleSet) return false
  if (!sale && !rentSet) return false
  const lo = numberOf(sale ? saleMin.value : rentMin.value)
  const hi = numberOf(sale ? saleMax.value : rentMax.value)
  if (lo !== null && u.price < lo) return false
  if (hi !== null && u.price > hi) return false
  return true
}

/** Narx bo‘yicha saralashda ikki shkala aralashmaydi: avval ijara, keyin sotuv */
function priceRank(l: Listing) {
  return l.unit.priceUnit === SALE_UNIT ? 1 : 0
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
  BUILDING_TYPES.map((c) => ({
    value: c.value,
    label: c.type,
    count: base.value.filter((l) => l.building.type === c.type).length,
  })),
)

/** Tanlangan kalitlarga mos bino turlari */
const selectedBuildingTypes = computed(
  () =>
    new Set(
      BUILDING_TYPES.filter((c) => selectedTypes.value.includes(c.value)).map((c) => c.type),
    ),
)

/** Obyekt tanlovi xarita nuqtalarini yo‘qotmasligi uchun undan oldin hisoblanadi */
const matched = computed(() =>
  base.value.filter(
    (l) =>
      selectedBuildingTypes.value.size === 0 || selectedBuildingTypes.value.has(l.building.type),
  ),
)

const results = computed(() => {
  const list = matched.value.filter((l) => !objectId.value || l.building.id === objectId.value)
  const sorted = [...list]
  if (sort.value === 'price-asc')
    sorted.sort((a, b) => priceRank(a) - priceRank(b) || a.unit.price - b.unit.price)
  else if (sort.value === 'price-desc')
    sorted.sort((a, b) => priceRank(a) - priceRank(b) || b.unit.price - a.unit.price)
  else if (sort.value === 'area-desc') sorted.sort((a, b) => b.unit.area - a.unit.area)
  else if (sort.value === 'new')
    sorted.sort(
      (a, b) => b.building.buildYear - a.building.buildYear || b.unit.floor - a.unit.floor,
    )
  else
    sorted.sort(
      (a, b) =>
        b.building.occupancy - a.building.occupancy ||
        priceRank(a) - priceRank(b) ||
        a.unit.price - b.unit.price,
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

const summary = computed(() => {
  const names = BUILDING_TYPES.filter((c) => selectedTypes.value.includes(c.value)).map(
    (c) => c.type,
  )
  const cats = names.length ? names.join(', ') : 'barcha bino turlari'
  return `${OFFER_SUMMARY[offer.value] ?? OFFER_SUMMARY.all} · ${cats}`
})

/** Narx oralig‘ini o‘qiladigan yozuvga aylantiradi: «5 – 15 mln», «15 mln gacha» */
function rangeLabel(min: string | number, max: string | number) {
  const lo = numberOf(min)
  const hi = numberOf(max)
  const mln = (v: number) => `${num(Math.round((v / 1000000) * 10) / 10)} mln`
  if (lo !== null && hi !== null) return `${mln(lo)} – ${mln(hi)}`
  if (lo !== null) return `${mln(lo)} dan yuqori`
  if (hi !== null) return `${mln(hi)} gacha`
  return ''
}

const chips = computed(() => {
  const out: Array<{ key: string; label: string }> = []
  if (place.value) out.push({ key: 'place', label: place.value.replace('|', ', ') })
  if (usage.value) out.push({ key: 'usage', label: `Maqsad: ${usageLabel(usage.value)}` })
  const rent = rangeLabel(rentMin.value, rentMax.value)
  if (rent) out.push({ key: 'rent-price', label: `Ijara: ${rent} so‘m / oy` })
  const sale = rangeLabel(saleMin.value, saleMax.value)
  if (sale) out.push({ key: 'sale-price', label: `Sotuv: ${sale} so‘m / m²` })
  if (onlyFavourites.value) out.push({ key: 'fav', label: 'Faqat sevimlilar' })
  if (activeObject.value) out.push({ key: 'obyekt', label: activeObject.value.name })
  return out
})

function clearChip(key: string) {
  if (key === 'place') place.value = ''
  if (key === 'usage') usage.value = ''
  if (key === 'rent-price') {
    rentMin.value = ''
    rentMax.value = ''
  }
  if (key === 'sale-price') {
    saleMin.value = ''
    saleMax.value = ''
  }
  if (key === 'fav') onlyFavourites.value = false
  if (key === 'obyekt') objectId.value = ''
}

const activeCount = computed(() => {
  let n = 0
  if (q.value.trim()) n++
  if (selectedTypes.value.length) n++
  if (rentMin.value !== '' || rentMax.value !== '') n++
  if (saleMin.value !== '' || saleMax.value !== '') n++
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
  rentMin.value = ''
  rentMax.value = ''
  saleMin.value = ''
  saleMax.value = ''
  areaMin.value = ''
  areaMax.value = ''
  distance.value = ''
  usage.value = ''
  offer.value = 'all'
  onlyFavourites.value = false
  objectId.value = ''
}

/** Taklif turi almashganda ko‘rinmay qolgan shkaladagi oraliq ham tozalanadi */
watch(offer, (value) => {
  if (value === 'buy') {
    rentMin.value = ''
    rentMax.value = ''
  }
  if (value === 'rent') {
    saleMin.value = ''
    saleMax.value = ''
  }
})

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

/** Filtr holatidan URL shartlarini yig‘adi */
function buildQuery() {
  const query: Record<string, string> = {}
  if (q.value.trim()) query.q = q.value.trim()
  if (selectedTypes.value.length) query.type = selectedTypes.value.join(',')
  if (place.value) query.place = place.value
  if (rentMin.value !== '') query.pmin = String(rentMin.value)
  if (rentMax.value !== '') query.pmax = String(rentMax.value)
  if (saleMin.value !== '') query.smin = String(saleMin.value)
  if (saleMax.value !== '') query.smax = String(saleMax.value)
  if (areaMin.value !== '') query.amin = String(areaMin.value)
  if (areaMax.value !== '') query.amax = String(areaMax.value)
  if (distance.value) query.dist = distance.value
  if (usage.value) query.usage = usage.value
  if (offer.value !== 'all') query.offer = offer.value
  if (sort.value !== 'top') query.sort = sort.value
  if (mode.value !== 'list') query.mode = mode.value
  if (onlyFavourites.value) query.fav = '1'
  if (objectId.value) query.obyekt = objectId.value
  return query
}

/**
 * Ikki tomonlama bog‘lanishda sikl bo‘lmasligi uchun taqqoslash kaliti:
 * URL va holat bir xil bo‘lsa, hech biri ikkinchisini qayta yozmaydi.
 */
function queryKey(query: Record<string, unknown>) {
  return Object.keys(query)
    .filter((k) => query[k] !== undefined && query[k] !== null && query[k] !== '')
    .sort()
    .map((k) => `${k}=${String(query[k])}`)
    .join('&')
}

watch(
  [
    q,
    selectedTypes,
    place,
    rentMin,
    rentMax,
    saleMin,
    saleMax,
    areaMin,
    areaMax,
    distance,
    usage,
    offer,
    sort,
    mode,
    onlyFavourites,
    objectId,
  ],
  () => {
    // Obyekt sahifasiga o‘tayotganda katalog URL i qayta yozilib ketmasin
    if (route.path !== CATALOG_PATH) return
    const query = buildQuery()
    if (queryKey(query) === queryKey(route.query)) return
    router.replace({ path: CATALOG_PATH, query })
  },
  { deep: true },
)

/**
 * Katalogda turib bosilgan havola (pastki menyudagi bino turlari, «Sevimli
 * e’lonlar», bosh sahifadagi qidiruv) sahifani qayta yaratmaydi, faqat URL ni
 * almashtiradi. Shu sababli shartlar URL dan qaytadan o‘qiladi.
 */
watch(
  () => route.query,
  (query) => {
    if (route.path !== CATALOG_PATH) return
    if (queryKey(buildQuery()) === queryKey(query)) return
    applyQuery(query)
  },
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
          v-model:rent-min="rentMin"
          v-model:rent-max="rentMax"
          v-model:sale-min="saleMin"
          v-model:sale-max="saleMax"
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
          :show-rent-price="showRentPrice"
          :show-sale-price="showSalePrice"
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
                {{ l.building.type }}
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
              <span v-if="l.unit.usage" class="inline-flex items-center gap-1.5">
                <UiIcon name="building" :size="14" class="text-ink-400" />
                {{ usageLabel(l.unit.usage) }}
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
                v-model:rent-min="rentMin"
                v-model:rent-max="rentMax"
                v-model:sale-min="saleMin"
                v-model:sale-max="saleMax"
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
                :show-rent-price="showRentPrice"
                :show-sale-price="showSalePrice"
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
