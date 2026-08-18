<script setup lang="ts">
import { useStorage } from '@vueuse/core'
import { BUILDINGS, PORTFOLIO_TOTALS, buildingById, type Building } from '~/data/buildings'
import { vacantUnits, type Unit } from '~/data/units'
import { OCCUPANCY_BANDS } from '~/constants/statuses'
import { num, area, percent, dateLong } from '~/utils/format'

definePageMeta({ layout: 'public' })

const { t, te } = useI18n()

/** Kalit lug‘atda bo‘lmasa tayyor o‘zbekcha nom qaytadi, ekran bo‘sh qolmaydi */
function tr(key: string, fallback: string) {
  return te(key) ? t(key) : fallback
}

/** «5 ta» ko‘rinishidagi son: rus tilida sanoq so‘zi bo‘lmagani uchun tushib qoladi */
function counted(value: string | number) {
  return `${value} ${t('common.count')}`.trim()
}

interface Listing {
  unit: Unit
  building: Building
}

/**
 * Bino turi klassifikatori ma’lumotnomadagi BLD_TYPE yozuvlari bilan bir xil:
 * beshta tur, har biriga bitta kalit. Ilgari «Ofis binosi» jimgina «Biznes
 * markaz» ichiga qo‘shilardi va foydalanuvchi landingda bir nom, obyekt
 * pasportida boshqa nom ko‘rardi.
 */
const CATEGORY_TYPES: Record<string, string[]> = {
  biznes: ['Biznes markaz'],
  ofis: ['Ofis binosi'],
  savdo: ['Savdo markaz'],
  ombor: ['Ombor / logistika'],
  turar: ['Turar joy'],
}

const listings = computed<Listing[]>(() =>
  vacantUnits().map((u) => ({ unit: u, building: buildingById(u.buildingId)! })).filter(
    (l) => !!l.building,
  ),
)

/** Har bir obyektdan navbat bilan olinadi, bitta bino ro‘yxatni egallab qolmasin */
const featured = computed<Listing[]>(() => {
  const groups = new Map<string, Listing[]>()
  for (const l of listings.value) {
    const arr = groups.get(l.building.id)
    if (arr) arr.push(l)
    else groups.set(l.building.id, [l])
  }

  const queues = [...groups.values()]
  const out: Listing[] = []
  for (let i = 0; out.length < 6 && queues.some((g) => g.length > i); i++) {
    for (const g of queues) {
      const item = g[i]
      if (item && out.length < 6) out.push(item)
    }
  }
  return out
})
const vacantCount = computed(() => listings.value.length)
const vacantAreaTotal = computed(() => listings.value.reduce((s, l) => s + l.unit.area, 0))

const TRUST = computed(() => [
  { label: t('landing.trustObjects'), value: num(PORTFOLIO_TOTALS.buildings), unit: t('common.count') },
  { label: t('landing.trustGla'), value: num(PORTFOLIO_TOTALS.gla), unit: t('common.areaUnit') },
  {
    label: t('landing.trustTenants'),
    value: num(PORTFOLIO_TOTALS.occupiedUnits),
    unit: t('common.count'),
  },
  { label: t('landing.trustOccupancy'), value: percent(PORTFOLIO_TOTALS.occupancy), unit: '' },
])

const CATEGORY_META = [
  {
    key: 'biznes',
    labelKey: 'public.categoryBiznes',
    labelText: 'Biznes markazlar',
    captionKey: 'landing.categoryBiznesOnlyCaption',
    captionText: 'Ko‘p ijarachili biznes markazlardagi maydonlar',
    photo: 'green-business-center-3',
    icon: 'building',
  },
  {
    key: 'ofis',
    labelKey: 'public.categoryOfis',
    labelText: 'Ofis binolari',
    captionKey: 'landing.categoryOfisCaption',
    captionText: 'Alohida ofis binolaridagi maydonlar',
    photo: 'urban-office-3',
    icon: 'grid',
  },
  {
    key: 'savdo',
    labelKey: 'public.categorySavdo',
    labelText: 'Savdo markazlar',
    captionKey: 'landing.categorySavdoCaption',
    captionText: 'Savdo va xizmat ko‘rsatish maydonlari',
    photo: 'mega-mall-3',
    icon: 'box',
  },
  {
    key: 'ombor',
    labelKey: 'public.categoryOmbor',
    labelText: 'Ombor / logistika',
    captionKey: 'landing.categoryOmborCaption',
    captionText: 'Ombor va ishlab chiqarish bloklari',
    photo: 'industrial-park-2-3',
    icon: 'cube',
  },
  {
    key: 'turar',
    labelKey: 'public.categoryTurar',
    labelText: 'Turar joylar',
    captionKey: 'landing.categoryTurarCaption',
    captionText: 'Turar joy majmualaridagi kvartiralar',
    photo: 'harmony-residence',
    icon: 'layers',
  },
]

const categories = computed(() =>
  CATEGORY_META.map((c) => {
    const items = listings.value.filter((l) =>
      (CATEGORY_TYPES[c.key] ?? []).includes(l.building.type),
    )
    return {
      ...c,
      label: tr(c.labelKey, c.labelText),
      caption: tr(c.captionKey, c.captionText),
      count: items.length,
      area: items.reduce((s, l) => s + l.unit.area, 0),
    }
  }),
)

const tab = ref('all')
const TABS = computed(() => [
  { value: 'all', label: t('landing.tabAll') },
  { value: 'rent', label: t('landing.tabRent') },
  { value: 'buy', label: t('landing.tabBuy') },
])

const q = ref('')
const fType = ref('')
const fUsage = ref('')
const fPlace = ref('')
const fPrice = ref('')
const fArea = ref('')

/** Yorliqlar katalogdagi «Bino turi» ro‘yxati bilan so‘zma-so‘z bir xil */
const TYPE_OPTIONS = computed(() => [
  { value: '', label: t('common.all') },
  { value: 'biznes', label: tr('landing.typeBiznes', 'Biznes markaz') },
  { value: 'ofis', label: tr('landing.typeOfis', 'Ofis binosi') },
  { value: 'savdo', label: tr('landing.typeSavdo', 'Savdo markaz') },
  { value: 'ombor', label: tr('landing.typeOmbor', 'Ombor / logistika') },
  { value: 'turar', label: tr('landing.typeTurar', 'Turar joy') },
])

/**
 * Maqsad bino turidan boshqa o‘lchov, shuning uchun yorliqda «maydoni» bor:
 * «Ofis binosi» bino turi, «Ofis maydoni» esa unitning maqsadi.
 */
const USAGE_OPTIONS = computed(() => [
  { value: '', label: t('common.all') },
  { value: 'Ofis', label: tr('landing.usageOfficeArea', 'Ofis maydoni') },
  { value: 'Savdo', label: tr('landing.usageRetailArea', 'Savdo maydoni') },
  { value: 'Ombor', label: tr('landing.usageWarehouseArea', 'Ombor maydoni') },
  { value: 'Turar joy', label: tr('landing.usageResidentialArea', 'Turar joy maydoni') },
])

/** Bir tumanda bir nechta obyekt bo‘lishi mumkin, ro‘yxatda hudud bir marta chiqadi */
const PLACE_OPTIONS = computed(() => [
  { value: '', label: t('common.all') },
  ...[...new Set(BUILDINGS.map((b) => `${b.city}|${b.district}`))]
    .sort((a, b) => a.localeCompare(b))
    .map((value) => ({ value, label: value.replace('|', ', ') })),
])

const PRICE_OPTIONS = computed(() => [
  { value: '', label: t('common.all') },
  { value: 'p1', label: t('landing.price1') },
  { value: 'p2', label: t('landing.price2') },
  { value: 'p3', label: t('landing.price3') },
  { value: 'p4', label: t('landing.price4') },
])

const AREA_OPTIONS = computed(() => [
  { value: '', label: t('common.all') },
  { value: 'a1', label: t('landing.area1') },
  { value: 'a2', label: t('landing.area2') },
  { value: 'a3', label: t('landing.area3') },
  { value: 'a4', label: t('landing.area4') },
])

function searchQuery() {
  const query: Record<string, string> = {}
  if (q.value.trim()) query.q = q.value.trim()
  if (tab.value !== 'all') query.offer = tab.value
  if (fType.value) query.type = fType.value
  if (fUsage.value) query.usage = fUsage.value
  if (fPlace.value) query.place = fPlace.value
  if (fPrice.value) query.price = fPrice.value
  if (fArea.value) query.size = fArea.value
  return query
}

function goSearch() {
  navigateTo({ path: '/catalog', query: searchQuery() })
}

function goCategory(key: string) {
  fType.value = key
  goSearch()
}

const mapMarkers = computed(() =>
  BUILDINGS.map((b) => ({
    id: b.id,
    lat: b.lat,
    lon: b.lon,
    label: b.name,
    caption: `${b.district} · ${b.type}`,
    value: b.occupancy,
    valueLabel: t('landing.occupancyValueLabel'),
    to: `/catalog/${b.slug}`,
    tone:
      b.occupancy >= 90 ? ('ok' as const) : b.occupancy >= 84 ? ('brand' as const) : ('warn' as const),
  })),
)

const mapStats = computed(() => [
  { label: t('landing.mapStatObjects'), value: counted(num(PORTFOLIO_TOTALS.buildings)) },
  { label: t('landing.mapStatOccupancy'), value: percent(PORTFOLIO_TOTALS.occupancy) },
  {
    label: t('landing.mapStatArea'),
    value: `${num(Math.round(PORTFOLIO_TOTALS.gla / 1000))} ${t('landing.thousandArea')}`,
  },
  {
    label: t('landing.mapStatVacant'),
    value: `${num(Math.round(PORTFOLIO_TOTALS.vacantArea / 1000))} ${t('landing.thousandArea')}`,
  },
])

/** Chegara ham, yozuv ham `OCCUPANCY_BANDS` dan: uch ekranda bitta shkala */
const mapLegend = computed(() =>
  OCCUPANCY_BANDS.map((b) => ({ label: t(b.labelKey), class: b.class })),
)

const objects = computed(() => [...BUILDINGS].sort((a, b) => a.name.localeCompare(b.name)))

/** Kartalar bo‘limi portfelning eng yirik obyektlarini ko‘rsatadi, to‘liq ro‘yxat katalogda */
const featuredObjects = computed(() => [...BUILDINGS].sort((a, b) => b.gla - a.gla).slice(0, 8))

/** Sevimlilar sarlavhadagi nishoncha va katalog bilan bitta xotirada */
const favourites = useStorage<string[]>('makon.favourites', [])

function toggleFavourite(id: string) {
  favourites.value = favourites.value.includes(id)
    ? favourites.value.filter((f) => f !== id)
    : [...favourites.value, id]
}

const STEPS = [
  { step: '01', photo: 'iso-cutaway-office', titleKey: 'landing.step1Title', textKey: 'landing.step1Text' },
  { step: '02', photo: 'iso-floorplan-open', titleKey: 'landing.step2Title', textKey: 'landing.step2Text' },
  { step: '03', photo: 'iso-warehouse', titleKey: 'landing.step3Title', textKey: 'landing.step3Text' },
]

const SERVICES = [
  { icon: 'search', tone: 'bg-brand-50 text-brand-600', titleKey: 'landing.service1Title', textKey: 'landing.service1Text' },
  { icon: 'shield', tone: 'bg-ok-50 text-ok-600', titleKey: 'landing.service2Title', textKey: 'landing.service2Text' },
  { icon: 'contract', tone: 'bg-info-50 text-info-600', titleKey: 'landing.service3Title', textKey: 'landing.service3Text' },
  { icon: 'wrench', tone: 'bg-warn-50 text-warn-600', titleKey: 'landing.service4Title', textKey: 'landing.service4Text' },
  { icon: 'chart', tone: 'bg-brand-50 text-brand-600', titleKey: 'landing.service5Title', textKey: 'landing.service5Text' },
  { icon: 'doc', tone: 'bg-ok-50 text-ok-600', titleKey: 'landing.service6Title', textKey: 'landing.service6Text' },
]

const SYSTEM_POINTS = [
  { icon: 'refresh', titleKey: 'landing.point1Title', textKey: 'landing.point1Text' },
  { icon: 'filter', titleKey: 'landing.point2Title', textKey: 'landing.point2Text' },
  { icon: 'layers', titleKey: 'landing.point3Title', textKey: 'landing.point3Text' },
  { icon: 'cube', titleKey: 'landing.point4Title', textKey: 'landing.point4Text' },
]

const stats = computed(() => [
  { label: t('landing.statObjects'), value: num(PORTFOLIO_TOTALS.buildings), unit: t('common.count') },
  { label: t('landing.statGla'), value: num(PORTFOLIO_TOTALS.gla), unit: t('common.areaUnit') },
  { label: t('landing.statOccupancy'), value: percent(PORTFOLIO_TOTALS.occupancy), unit: '' },
  { label: t('landing.statVacantArea'), value: num(PORTFOLIO_TOTALS.vacantArea), unit: t('common.areaUnit') },
  { label: t('landing.statUnits'), value: num(PORTFOLIO_TOTALS.units), unit: t('common.count') },
  { label: t('landing.statVacantUnits'), value: num(PORTFOLIO_TOTALS.vacantUnits), unit: t('common.count') },
  { label: t('landing.statCatalogArea'), value: num(vacantAreaTotal.value), unit: t('common.areaUnit') },
  { label: t('landing.statCatalogUnits'), value: num(vacantCount.value), unit: t('common.count') },
])

const ARTICLES = [
  { id: 'a1', tagKey: 'landing.tagMarket', date: '2026-07-28', titleKey: 'landing.article1Title', textKey: 'landing.article1Text' },
  { id: 'a2', tagKey: 'landing.tagPlatform', date: '2026-06-14', titleKey: 'landing.article2Title', textKey: 'landing.article2Text' },
  { id: 'a3', tagKey: 'landing.tagMarket', date: '2026-05-30', titleKey: 'landing.article3Title', textKey: 'landing.article3Text' },
]

const articleOpen = ref(false)
const activeArticle = ref(ARTICLES[0]!)

function openArticle(a: (typeof ARTICLES)[number]) {
  activeArticle.value = a
  articleOpen.value = true
}
</script>

<template>
  <div>
    <!-- Hero -->
    <section class="relative isolate overflow-hidden bg-ink-900">
      <div class="absolute inset-0">
        <UiPhoto
          name="green-business-center-3"
          :alt="t('landing.heroPhotoAlt')"
          ratio="size-full"
          rounded="rounded-none"
          sizes="100vw"
          eager
        />
      </div>
      <div
        class="absolute inset-0 bg-gradient-to-t from-ink-900/95 via-ink-900/70 to-ink-900/45"
        aria-hidden="true"
      />
      <div
        class="absolute inset-0 bg-gradient-to-r from-ink-900/70 via-ink-900/20 to-transparent"
        aria-hidden="true"
      />

      <div class="relative mx-auto max-w-[1360px] px-4 pb-12 pt-12 lg:px-8 lg:pb-16 lg:pt-20">
        <span
          class="inline-flex items-center gap-2 rounded-pill bg-white/15 px-3.5 py-1.5 text-[12.5px] font-semibold text-white ring-1 ring-inset ring-white/25 backdrop-blur-sm"
        >
          <UiIcon name="refresh" :size="15" />
          {{ t('landing.heroBadge') }}
        </span>

        <h1
          class="mt-5 max-w-[18ch] text-[34px] font-extrabold leading-[1.08] text-white sm:text-[44px] lg:text-[54px]"
        >
          {{ t('landing.heroTitle') }}
          <span class="text-brand-400">{{ t('landing.heroTitleAccent') }}</span>
        </h1>

        <p class="mt-4 max-w-[58ch] text-[15px] leading-relaxed text-white/80 sm:text-[16px]">
          {{ t('landing.heroLead', { count: PORTFOLIO_TOTALS.buildings }) }}
        </p>

        <!-- Qidiruv paneli -->
        <div class="mt-8 rounded-panel bg-surface p-4 shadow-pop sm:p-5">
          <form @submit.prevent="goSearch">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <UiTabs v-model="tab" :tabs="TABS" />
              <NuxtLink
                to="/catalog"
                class="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-600 transition-colors duration-150 hover:text-brand-700"
              >
                {{ t('landing.advancedFilter') }}
                <UiIcon name="arrowRight" :size="15" />
              </NuxtLink>
            </div>

            <UiInput
              v-model="q"
              class="mt-3.5"
              :placeholder="t('landing.searchPlaceholder')"
              :aria-label="t('landing.searchAria')"
            >
              <template #prefix>
                <UiIcon name="search" :size="18" />
              </template>
            </UiInput>

            <div class="mt-3.5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <UiField :label="t('landing.fieldType')">
                <UiSelect v-model="fType" :options="TYPE_OPTIONS" size="sm" />
              </UiField>
              <UiField :label="t('landing.fieldUsage')">
                <UiSelect v-model="fUsage" :options="USAGE_OPTIONS" size="sm" />
              </UiField>
              <UiField :label="t('landing.fieldPlace')">
                <UiSelect v-model="fPlace" :options="PLACE_OPTIONS" size="sm" />
              </UiField>
              <UiField :label="t('landing.fieldArea')">
                <UiSelect v-model="fArea" :options="AREA_OPTIONS" size="sm" />
              </UiField>
              <UiField :label="t('landing.fieldPrice')">
                <UiSelect v-model="fPrice" :options="PRICE_OPTIONS" size="sm" />
              </UiField>
              <div class="flex items-end">
                <UiButton type="submit" size="sm" block>
                  <UiIcon name="search" :size="16" />
                  {{ t('common.search') }}
                </UiButton>
              </div>
            </div>

            <div
              class="mt-3.5 flex flex-wrap items-center gap-2 border-t border-ink-100 pt-3.5"
            >
              <span class="text-[11.5px] font-bold uppercase tracking-wide text-ink-500">
                {{ t('landing.quickPick') }}
              </span>
              <button
                v-for="c in categories"
                :key="`chip-${c.key}`"
                type="button"
                class="tabular rounded-pill bg-ink-100 px-3 py-1.5 text-[12.5px] font-semibold text-ink-700 transition-colors duration-150 hover:bg-brand-50 hover:text-brand-700 active:bg-brand-100"
                @click="goCategory(c.key)"
              >
                {{ c.label }} · {{ c.count }}
              </button>
              <NuxtLink
                to="/#xarita"
                class="ml-auto inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-[12.5px] font-semibold text-brand-600 transition-colors duration-150 hover:bg-brand-50"
              >
                <UiIcon name="location" :size="15" />
                {{ t('landing.showOnMap') }}
              </NuxtLink>
            </div>
          </form>
        </div>

        <!-- Ishonch qatori -->
        <dl class="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div
            v-for="item in TRUST"
            :key="item.label"
            class="rounded-field bg-white/10 px-4 py-3 ring-1 ring-inset ring-white/20 backdrop-blur-sm"
          >
            <dt class="text-[11px] font-semibold uppercase tracking-wide text-white/75">
              {{ item.label }}
            </dt>
            <dd class="tabular mt-1 text-[20px] font-bold text-white sm:text-[24px]">
              {{ item.value }}
              <span v-if="item.unit" class="text-[12px] font-medium text-white/75">
                {{ item.unit }}
              </span>
            </dd>
          </div>
        </dl>
      </div>
    </section>

    <!-- Kategoriyalar -->
    <section class="mx-auto max-w-[1360px] px-4 py-12 lg:px-8 lg:py-14">
      <div class="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p class="text-[11.5px] font-bold uppercase tracking-wide text-brand-600">
            {{ t('landing.categoriesEyebrow') }}
          </p>
          <h2 class="mt-2 text-[22px] font-bold sm:text-[26px]">
            {{ t('landing.categoriesTitle') }}
          </h2>
        </div>
        <NuxtLink
          to="/catalog"
          class="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-brand-600 transition-colors duration-150 hover:text-brand-700"
        >
          {{ t('landing.wholeCatalog') }}
          <UiIcon name="arrowRight" :size="16" />
        </NuxtLink>
      </div>

      <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <NuxtLink
          v-for="c in categories"
          :key="c.key"
          :to="`/catalog?type=${c.key}`"
          class="group relative block overflow-hidden rounded-panel shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-pop"
        >
          <UiPhoto
            :name="c.photo"
            :alt="c.label"
            ratio="aspect-[4/3]"
            rounded="rounded-none"
            sizes="(max-width: 640px) 100vw, 340px"
          />
          <div
            class="absolute inset-0 bg-gradient-to-t from-ink-900/95 via-ink-900/60 to-ink-900/10"
            aria-hidden="true"
          />
          <div class="absolute inset-x-0 bottom-0 p-4">
            <span
              class="grid size-10 place-items-center rounded-field bg-white/15 text-white ring-1 ring-inset ring-white/25 backdrop-blur-sm"
            >
              <UiIcon :name="c.icon" :size="20" />
            </span>
            <p class="mt-3 text-[16px] font-bold text-white">{{ c.label }}</p>
            <p class="mt-0.5 text-[12.5px] leading-snug text-white/85">{{ c.caption }}</p>
            <p class="tabular mt-2.5 flex items-center gap-2 text-[12.5px] font-semibold text-white">
              <span class="rounded-pill bg-white/15 px-2 py-0.5">
                {{ t('landing.listingCount', { count: c.count }) }}
              </span>
              <span class="text-white/75">{{ num(c.area) }} {{ t('common.areaUnit') }}</span>
            </p>
          </div>
        </NuxtLink>
      </div>
    </section>

    <!-- Tavsiya etilgan e’lonlar -->
    <section class="border-y border-ink-200 bg-surface">
      <div class="mx-auto max-w-[1360px] px-4 py-12 lg:px-8 lg:py-14">
        <div class="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p class="text-[11.5px] font-bold uppercase tracking-wide text-brand-600">
              {{ t('landing.listingsEyebrow') }}
            </p>
            <h2 class="mt-2 text-[22px] font-bold sm:text-[26px]">
              {{ t('landing.listingsTitle') }}
            </h2>
            <p class="mt-2 text-[13.5px] text-ink-500">{{ t('landing.listingsCaption') }}</p>
          </div>
          <NuxtLink
            to="/catalog"
            class="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-brand-600 transition-colors duration-150 hover:text-brand-700"
          >
            {{ t('landing.showAll', { count: vacantCount }) }}
            <UiIcon name="arrowRight" :size="16" />
          </NuxtLink>
        </div>

        <div class="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          <article
            v-for="l in featured"
            :key="l.unit.id"
            class="group flex flex-col overflow-hidden rounded-panel bg-surface shadow-card ring-1 ring-ink-200/70 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-pop"
          >
            <div class="relative">
              <NuxtLink
                :to="`/catalog/${l.building.slug}?unit=${l.unit.id}`"
                class="block"
                :aria-label="t('landing.unitAria', { building: l.building.name, code: l.unit.code })"
              >
                <UiPhoto
                  :name="l.building.photo"
                  :alt="t('landing.unitAria', { building: l.building.name, code: l.unit.code })"
                  ratio="aspect-[16/10]"
                  rounded="rounded-none"
                  sizes="(max-width: 640px) 100vw, 420px"
                />
                <div
                  class="absolute inset-0 bg-gradient-to-t from-ink-900/80 via-ink-900/15 to-transparent"
                  aria-hidden="true"
                />
                <div class="absolute inset-x-0 bottom-0 p-4">
                  <p class="truncate text-[15px] font-bold text-white">{{ l.building.name }}</p>
                  <p class="mt-0.5 flex items-center gap-1.5 truncate text-[12.5px] text-white/80">
                    <UiIcon name="location" :size="14" />
                    {{ l.building.city }}, {{ l.building.district }}
                  </p>
                </div>
              </NuxtLink>

              <span
                class="absolute left-3 top-3 rounded-pill px-2.5 py-1 text-[11px] font-bold text-white shadow-card"
                :class="l.unit.offer === 'Sotuv' ? 'bg-teal-500' : 'bg-brand-500'"
              >
                {{ l.unit.offer === 'Sotuv' ? t('landing.offerSale') : t('landing.offerRent') }}
              </span>

              <button
                type="button"
                class="absolute right-3 top-3 grid size-10 place-items-center rounded-full bg-white/90 shadow-card transition-colors duration-150 hover:bg-white"
                :class="
                  favourites.includes(l.unit.id)
                    ? 'text-danger-500'
                    : 'text-ink-400 hover:text-danger-500'
                "
                :aria-pressed="favourites.includes(l.unit.id)"
                :aria-label="
                  t('landing.favouriteAria', { building: l.building.name, code: l.unit.code })
                "
                @click="toggleFavourite(l.unit.id)"
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
            </div>

            <div class="flex flex-1 flex-col p-5">
              <div class="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] text-ink-600">
                <span class="inline-flex items-center gap-1.5">
                  <UiIcon name="layers" :size="15" class="text-ink-400" />
                  <span class="tabular">{{ area(l.unit.area) }}</span>
                </span>
                <span class="inline-flex items-center gap-1.5">
                  <UiIcon name="building" :size="15" class="text-ink-400" />
                  <span class="tabular">{{ t('landing.floorNo', { floor: l.unit.floor }) }}</span>
                </span>
                <span class="inline-flex items-center gap-1.5">
                  <UiIcon name="cube" :size="15" class="text-ink-400" />
                  {{ l.unit.usage }}
                </span>
              </div>

              <p class="mt-3 text-[12.5px] text-ink-500">
                {{
                  t('landing.unitSummary', {
                    code: l.unit.code,
                    rooms: l.unit.rooms,
                    class: l.building.buildingClass,
                  })
                }}
              </p>

              <div class="mt-auto flex items-end justify-between gap-3 pt-4">
                <p class="min-w-0">
                  <span
                    class="tabular block truncate text-[18px] font-extrabold"
                    :class="l.unit.offer === 'Sotuv' ? 'text-teal-600' : 'text-brand-600'"
                  >
                    {{ num(l.unit.price) }}
                  </span>
                  <span class="text-[12px] font-semibold text-ink-500">{{ l.unit.priceUnit }}</span>
                </p>
                <UiButton
                  variant="secondary"
                  size="sm"
                  :to="`/catalog/${l.building.slug}?unit=${l.unit.id}`"
                >
                  {{ t('common.details') }}
                  <UiIcon name="chevronRight" :size="16" />
                </UiButton>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>

    <!-- Xarita -->
    <section id="xarita" class="scroll-mt-24">
      <div class="mx-auto max-w-[1360px] px-4 py-12 lg:px-8 lg:py-14">
        <div class="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div class="max-w-[62ch]">
            <p class="text-[11.5px] font-bold uppercase tracking-wide text-brand-600">
              {{ t('landing.mapEyebrow') }}
            </p>
            <h2 class="mt-2 text-[22px] font-bold sm:text-[26px]">{{ t('landing.mapTitle') }}</h2>
            <p class="mt-2 text-[14px] leading-relaxed text-ink-600">
              {{ t('landing.mapLead', { count: PORTFOLIO_TOTALS.buildings }) }}
            </p>
          </div>
          <NuxtLink
            to="/catalog"
            class="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-brand-600 transition-colors duration-150 hover:text-brand-700"
          >
            {{ t('landing.mapPick') }}
            <UiIcon name="arrowRight" :size="16" />
          </NuxtLink>
        </div>

        <UiMap
          :markers="mapMarkers"
          :stats="mapStats"
          :legend="mapLegend"
          height="460px"
          :zoom="11"
          :min-zoom="11"
        />

        <ul class="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <li v-for="o in objects" :key="`m-${o.id}`">
            <NuxtLink
              :to="`/catalog/${o.slug}`"
              class="flex h-full items-center gap-3 rounded-card bg-surface p-3.5 shadow-card ring-1 ring-ink-200/70 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-pop"
            >
              <span
                class="grid size-9 shrink-0 place-items-center rounded-field"
                :class="
                  o.occupancy >= 90
                    ? 'bg-ok-50 text-ok-600'
                    : o.occupancy >= 84
                      ? 'bg-brand-50 text-brand-600'
                      : 'bg-warn-50 text-warn-600'
                "
              >
                <UiIcon name="location" :size="18" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-[13.5px] font-bold text-ink-900">
                  {{ o.name }}
                </span>
                <span class="tabular block truncate text-[12px] text-ink-500">
                  {{ o.district }} · {{ t('landing.occupancyOf', { percent: percent(o.occupancy) }) }}
                </span>
              </span>
            </NuxtLink>
          </li>
        </ul>
      </div>
    </section>

    <!-- Obyektlar -->
    <section id="obyektlar" class="scroll-mt-24 border-y border-ink-200 bg-surface">
      <div class="mx-auto max-w-[1360px] px-4 py-12 lg:px-8 lg:py-14">
        <div class="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div class="max-w-[62ch]">
            <p class="text-[11.5px] font-bold uppercase tracking-wide text-brand-600">
              {{ t('landing.objectsEyebrow') }}
            </p>
            <h2 class="mt-2 text-[22px] font-bold sm:text-[26px]">
              {{ t('landing.objectsTitle', { count: PORTFOLIO_TOTALS.buildings }) }}
            </h2>
            <p class="mt-2 text-[14px] leading-relaxed text-ink-600">
              {{ t('landing.objectsLead', { count: featuredObjects.length }) }}
            </p>
          </div>
          <NuxtLink
            to="/catalog"
            class="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-brand-600 transition-colors duration-150 hover:text-brand-700"
          >
            {{ t('landing.allObjects') }}
            <UiIcon name="arrowRight" :size="16" />
          </NuxtLink>
        </div>

        <div class="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          <article
            v-for="o in featuredObjects"
            :key="o.id"
            class="group flex flex-col overflow-hidden rounded-panel bg-surface shadow-card ring-1 ring-ink-200/70 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-pop"
          >
            <NuxtLink :to="`/catalog/${o.slug}`" class="relative block">
              <UiPhoto
                :name="o.photo"
                :alt="`${o.name}: ${o.type}`"
                ratio="aspect-[16/10]"
                rounded="rounded-none"
                sizes="(max-width: 640px) 100vw, 420px"
              />
              <div
                class="absolute inset-0 bg-gradient-to-t from-ink-900/85 via-ink-900/20 to-transparent"
                aria-hidden="true"
              />
              <span
                class="absolute left-3 top-3 rounded-pill bg-white/90 px-2.5 py-1 text-[11px] font-bold text-ink-700"
              >
                {{ o.type }}
              </span>
              <span
                class="tabular absolute right-3 top-3 rounded-pill bg-ink-900/70 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-sm"
              >
                {{ o.buildingClass }}
              </span>
              <div class="absolute inset-x-0 bottom-0 p-4">
                <p class="text-[16px] font-bold text-white">{{ o.name }}</p>
                <p class="mt-0.5 flex items-center gap-1.5 truncate text-[12.5px] text-white/80">
                  <UiIcon name="location" :size="14" />
                  {{ o.city }}, {{ o.district }}
                </p>
              </div>
            </NuxtLink>

            <div class="flex flex-1 flex-col p-5">
              <div class="flex items-center justify-between gap-3">
                <span class="text-[12.5px] font-semibold text-ink-600">
                  {{ t('landing.occupancy') }}
                </span>
                <span class="tabular text-[15px] font-bold text-ink-900">
                  {{ percent(o.occupancy) }}
                </span>
              </div>
              <div class="mt-2 h-1.5 overflow-hidden rounded-pill bg-ink-100">
                <div
                  class="h-full rounded-pill"
                  :class="
                    o.occupancy >= 90
                      ? 'bg-ok-500'
                      : o.occupancy >= 84
                        ? 'bg-brand-500'
                        : 'bg-warn-500'
                  "
                  :style="{ width: `${o.occupancy}%` }"
                />
              </div>

              <dl class="mt-4 grid grid-cols-3 gap-3 border-t border-ink-100 pt-4">
                <div>
                  <dt class="text-[12px] text-ink-500">{{ t('landing.floors') }}</dt>
                  <dd class="tabular text-[15px] font-bold text-ink-900">{{ o.floors }}</dd>
                </div>
                <div>
                  <dt class="text-[12px] text-ink-500">{{ t('landing.units') }}</dt>
                  <dd class="tabular text-[15px] font-bold text-ink-900">{{ o.units }}</dd>
                </div>
                <div>
                  <dt class="text-[12px] text-ink-500">{{ t('landing.vacantArea') }}</dt>
                  <dd class="tabular text-[15px] font-bold text-ok-600">{{ num(o.vacantArea) }}</dd>
                </div>
              </dl>

              <div class="mt-auto pt-4">
                <UiButton variant="secondary" size="sm" :to="`/catalog/${o.slug}`" block>
                  {{ t('landing.objectPassport') }}
                  <UiIcon name="chevronRight" :size="16" />
                </UiButton>
              </div>
            </div>
          </article>

          <article
            class="flex flex-col justify-between gap-5 rounded-panel bg-brand-500 p-6 shadow-brand"
          >
            <div>
              <span
                class="grid size-11 place-items-center rounded-field bg-white/15 text-white ring-1 ring-inset ring-white/25"
              >
                <UiIcon name="search" :size="22" />
              </span>
              <h3 class="mt-4 text-[18px] font-bold text-white">{{ t('landing.promoTitle') }}</h3>
              <p class="mt-2 text-[13.5px] leading-relaxed text-white/85">
                {{ t('landing.promoText', { units: vacantCount, area: num(vacantAreaTotal) }) }}
              </p>
            </div>
            <div class="flex flex-wrap gap-3">
              <UiButton variant="secondary" size="sm" to="/catalog">
                <UiIcon name="search" :size="16" />
                {{ t('landing.toCatalog') }}
              </UiButton>
              <UiButton variant="success" size="sm" to="/login">
                <UiIcon name="shield" :size="16" />
                {{ t('common.signIn') }}
              </UiButton>
            </div>
          </article>
        </div>
      </div>
    </section>

    <!-- Qanday ishlaydi -->
    <section class="mx-auto max-w-[1360px] px-4 py-12 lg:px-8 lg:py-14">
      <div class="mb-6 max-w-[62ch]">
        <p class="text-[11.5px] font-bold uppercase tracking-wide text-brand-600">
          {{ t('landing.stepsEyebrow') }}
        </p>
        <h2 class="mt-2 text-[22px] font-bold sm:text-[26px]">{{ t('landing.stepsTitle') }}</h2>
        <p class="mt-2 text-[14px] leading-relaxed text-ink-600">{{ t('landing.stepsLead') }}</p>
      </div>

      <ol class="grid gap-5 lg:grid-cols-3">
        <li
          v-for="s in STEPS"
          :key="s.step"
          class="flex flex-col rounded-panel bg-surface p-5 shadow-card ring-1 ring-ink-200/70"
        >
          <div class="rounded-card bg-surface-sunken p-3">
            <UiPhoto
              :name="s.photo"
              :alt="t(s.titleKey)"
              ratio="aspect-[16/10]"
              rounded="rounded-card"
              sizes="220px"
              contain
            />
          </div>
          <p class="tabular mt-4 text-[11.5px] font-bold uppercase tracking-wide text-brand-600">
            {{ t('landing.stepNo', { step: s.step }) }}
          </p>
          <h3 class="mt-1.5 text-[16px] font-bold">{{ t(s.titleKey) }}</h3>
          <p class="mt-2 text-[13.5px] leading-relaxed text-ink-600">{{ t(s.textKey) }}</p>
        </li>
      </ol>
    </section>

    <!-- Xizmatlar -->
    <section id="xizmatlar" class="scroll-mt-24 border-y border-ink-200 bg-surface">
      <div class="mx-auto max-w-[1360px] px-4 py-12 lg:px-8 lg:py-14">
        <div class="max-w-[62ch]">
          <p class="text-[11.5px] font-bold uppercase tracking-wide text-brand-600">
            {{ t('landing.servicesEyebrow') }}
          </p>
          <h2 class="mt-2 text-[22px] font-bold sm:text-[26px]">{{ t('landing.servicesTitle') }}</h2>
          <p class="mt-2 text-[14px] leading-relaxed text-ink-600">{{ t('landing.servicesLead') }}</p>
        </div>

        <div class="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <article
            v-for="s in SERVICES"
            :key="s.titleKey"
            class="rounded-panel bg-canvas p-5 ring-1 ring-ink-200/70"
          >
            <span class="grid size-11 place-items-center rounded-field" :class="s.tone">
              <UiIcon :name="s.icon" :size="22" />
            </span>
            <h3 class="mt-4 text-[15.5px] font-bold">{{ t(s.titleKey) }}</h3>
            <p class="mt-2 text-[13.5px] leading-relaxed text-ink-600">{{ t(s.textKey) }}</p>
          </article>
        </div>
      </div>
    </section>

    <!-- Tizim haqida -->
    <section id="tizim" class="scroll-mt-24">
      <div class="mx-auto max-w-[1360px] px-4 py-12 lg:px-8 lg:py-14">
        <div class="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,560px)]">
          <div>
            <p class="text-[11.5px] font-bold uppercase tracking-wide text-brand-600">
              {{ t('landing.systemEyebrow') }}
            </p>
            <h2 class="mt-2 text-[22px] font-bold sm:text-[26px]">{{ t('landing.systemTitle') }}</h2>
            <p class="mt-3 max-w-[58ch] text-[14px] leading-relaxed text-ink-600">
              {{ t('landing.systemLead') }}
            </p>

            <ul class="mt-6 space-y-4">
              <li v-for="p in SYSTEM_POINTS" :key="p.titleKey" class="flex gap-3.5">
                <span
                  class="grid size-10 shrink-0 place-items-center rounded-field bg-brand-50 text-brand-600"
                >
                  <UiIcon :name="p.icon" :size="20" />
                </span>
                <span>
                  <span class="block text-[14.5px] font-semibold text-ink-900">
                    {{ t(p.titleKey) }}
                  </span>
                  <span class="block text-[13px] leading-relaxed text-ink-600">
                    {{ t(p.textKey) }}
                  </span>
                </span>
              </li>
            </ul>

            <div class="mt-7 flex flex-wrap gap-3">
              <UiButton to="/catalog">
                <UiIcon name="search" :size="17" />
                {{ t('landing.toCatalog') }}
              </UiButton>
              <UiButton variant="secondary" to="/login">
                <UiIcon name="shield" :size="17" />
                {{ t('common.signIn') }}
              </UiButton>
            </div>
          </div>

          <div>
            <div class="grid grid-cols-2 gap-4">
              <UiPhoto
                name="interior-office"
                :alt="t('landing.photoInteriorAlt')"
                ratio="aspect-[4/3]"
                sizes="270px"
                class="shadow-card"
              />
              <UiPhoto
                name="green-business-center-2"
                :alt="t('landing.photoCourtyardAlt')"
                ratio="aspect-[4/3]"
                sizes="270px"
                class="shadow-card"
              />
            </div>

            <dl class="mt-5 grid gap-4 sm:grid-cols-2">
              <div
                v-for="s in stats"
                :key="s.label"
                class="rounded-card bg-surface p-4 shadow-card ring-1 ring-ink-200/60"
              >
                <dt class="text-[12.5px] text-ink-500">{{ s.label }}</dt>
                <dd class="tabular mt-1 text-[24px] font-extrabold leading-tight text-ink-900">
                  {{ s.value }}
                  <span v-if="s.unit" class="text-[12px] font-semibold text-ink-500">
                    {{ s.unit }}
                  </span>
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </section>

    <!-- Blog -->
    <section id="blog" class="scroll-mt-24 border-y border-ink-200 bg-surface">
      <div class="mx-auto max-w-[1360px] px-4 py-12 lg:px-8 lg:py-14">
        <div class="mb-6 max-w-[62ch]">
          <p class="text-[11.5px] font-bold uppercase tracking-wide text-brand-600">
            {{ t('landing.blogEyebrow') }}
          </p>
          <h2 class="mt-2 text-[22px] font-bold sm:text-[26px]">{{ t('landing.blogTitle') }}</h2>
        </div>

        <div class="grid gap-5 lg:grid-cols-3">
          <button
            v-for="a in ARTICLES"
            :key="a.id"
            type="button"
            class="group flex flex-col rounded-panel bg-canvas p-5 text-left ring-1 ring-ink-200/70 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-pop"
            @click="openArticle(a)"
          >
            <span class="flex items-center gap-3">
              <span
                class="rounded-pill bg-brand-50 px-2.5 py-1 text-[11.5px] font-bold text-brand-700"
              >
                {{ t(a.tagKey) }}
              </span>
              <span class="tabular text-[12.5px] text-ink-500">{{ dateLong(a.date) }}</span>
            </span>
            <span
              class="mt-3 text-[16px] font-bold leading-snug text-ink-900 group-hover:text-brand-700"
            >
              {{ t(a.titleKey) }}
            </span>
            <span class="mt-2 line-clamp-3 text-[13.5px] leading-relaxed text-ink-600">
              {{ t(a.textKey) }}
            </span>
            <span
              class="mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-600"
            >
              {{ t('landing.readFull') }}
              <UiIcon name="arrowRight" :size="15" />
            </span>
          </button>
        </div>
      </div>
    </section>

    <!-- Yakuniy chaqiriq -->
    <section class="mx-auto max-w-[1360px] px-4 py-12 lg:px-8 lg:py-16">
      <div class="relative isolate overflow-hidden rounded-panel bg-ink-900 shadow-panel">
        <div class="absolute inset-0">
          <UiPhoto
            name="urban-office-4"
            :alt="t('landing.ctaPhotoAlt')"
            ratio="size-full"
            rounded="rounded-none"
            sizes="(max-width: 1360px) 100vw, 1360px"
          />
        </div>
        <div
          class="absolute inset-0 bg-gradient-to-r from-ink-900/95 via-ink-900/80 to-ink-900/45"
          aria-hidden="true"
        />

        <div
          class="relative flex flex-wrap items-center justify-between gap-6 px-6 py-10 lg:px-10 lg:py-12"
        >
          <div class="max-w-[56ch]">
            <h2 class="text-[22px] font-bold text-white sm:text-[26px]">
              {{ t('landing.ctaTitle') }}
            </h2>
            <p class="mt-2 text-[14.5px] leading-relaxed text-white/85">{{ t('landing.ctaText') }}</p>
          </div>
          <div class="flex flex-wrap gap-3">
            <UiButton to="/catalog">
              <UiIcon name="search" :size="17" />
              {{ t('landing.ctaCatalog') }}
            </UiButton>
            <UiButton variant="success" to="/login">
              <UiIcon name="shield" :size="17" />
              {{ t('common.signIn') }}
            </UiButton>
          </div>
        </div>
      </div>
    </section>

    <UiModal
      v-model="articleOpen"
      :title="t(activeArticle.titleKey)"
      :subtitle="dateLong(activeArticle.date)"
    >
      <span class="rounded-pill bg-brand-50 px-2.5 py-1 text-[11.5px] font-bold text-brand-700">
        {{ t(activeArticle.tagKey) }}
      </span>
      <p class="mt-4 text-[14px] leading-relaxed text-ink-700">{{ t(activeArticle.textKey) }}</p>

      <template #footer>
        <UiButton variant="secondary" @click="articleOpen = false">{{ t('common.close') }}</UiButton>
        <UiButton to="/catalog">{{ t('landing.toCatalog') }}</UiButton>
      </template>
    </UiModal>
  </div>
</template>
