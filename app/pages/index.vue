<script setup lang="ts">
import { BUILDINGS, PORTFOLIO_TOTALS, buildingById, type Building } from '~/data/buildings'
import { VACANT_UNITS, type Unit } from '~/data/units'
import { num, area, percent, dateLong } from '~/utils/format'

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

const listings = computed<Listing[]>(() =>
  VACANT_UNITS.map((u) => ({ unit: u, building: buildingById(u.buildingId)! })).filter(
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

const occupiedUnits = BUILDINGS.reduce((s, b) => s + b.occupiedUnits, 0)

const TRUST = [
  { label: 'Obyektlar', value: num(PORTFOLIO_TOTALS.buildings), unit: 'ta' },
  { label: 'Umumiy ijara maydoni', value: num(PORTFOLIO_TOTALS.gla), unit: 'm²' },
  { label: 'Ijarachilar', value: num(occupiedUnits), unit: 'ta' },
  { label: 'Bandlik', value: percent(PORTFOLIO_TOTALS.occupancy), unit: '' },
]

const CATEGORY_META = [
  {
    key: 'biznes',
    label: 'Biznes markazlar',
    caption: 'Ofis va biznes markazlaridagi maydonlar',
    photo: 'green-business-center-3',
    icon: 'building',
  },
  {
    key: 'savdo',
    label: 'Savdo markazlar',
    caption: 'Savdo va xizmat ko‘rsatish maydonlari',
    photo: 'mega-mall-3',
    icon: 'box',
  },
  {
    key: 'ombor',
    label: 'Ombor va logistika',
    caption: 'Saqlash va sanoat bloklari',
    photo: 'industrial-park-2-3',
    icon: 'cube',
  },
  {
    key: 'turar',
    label: 'Turar joy',
    caption: 'Rezidensiyalardagi turar joy birliklari',
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
      count: items.length,
      area: items.reduce((s, l) => s + l.unit.area, 0),
    }
  }),
)

const tab = ref('all')
const TABS = [
  { value: 'all', label: 'Barcha' },
  { value: 'rent', label: 'Ijaraga' },
  { value: 'buy', label: 'Sotib olish' },
]

const q = ref('')
const fType = ref('')
const fUsage = ref('')
const fPlace = ref('')
const fPrice = ref('')
const fArea = ref('')

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
    valueLabel: '% bandlik',
    to: `/catalog/${b.slug}`,
    tone:
      b.occupancy >= 90 ? ('ok' as const) : b.occupancy >= 84 ? ('brand' as const) : ('warn' as const),
  })),
)

const mapStats = computed(() => [
  { label: 'Obyektlar', value: `${num(PORTFOLIO_TOTALS.buildings)} ta` },
  { label: 'Bandlik', value: percent(PORTFOLIO_TOTALS.occupancy) },
  { label: 'Umumiy maydon', value: `${num(Math.round(PORTFOLIO_TOTALS.gla / 1000))} ming m²` },
  { label: 'Bo‘sh e’lonlar', value: `${num(vacantCount.value)} ta` },
])

const mapLegend = [
  { label: 'Bandlik 90% dan yuqori', class: 'bg-ok-500' },
  { label: '84 – 90%', class: 'bg-brand-500' },
  { label: '84% dan past', class: 'bg-warn-500' },
]

const objects = computed(() =>
  BUILDINGS.map((b) => {
    const own = listings.value.filter((l) => l.building.id === b.id)
    return {
      ...b,
      offers: own.length,
      vacant: own.reduce((s, l) => s + l.unit.area, 0),
    }
  }),
)

const favourites = ref<string[]>([])

function toggleFavourite(id: string) {
  favourites.value = favourites.value.includes(id)
    ? favourites.value.filter((f) => f !== id)
    : [...favourites.value, id]
}

const STEPS = [
  {
    step: '01',
    photo: 'iso-cutaway-office',
    title: 'Obyekt va qavatni tanlang',
    text: 'Katalogdan obyektni oching, qavatlar rejasidan bo‘sh bloklarni ko‘ring va joyni maydon, narx hamda qulayliklar bo‘yicha solishtiring.',
  },
  {
    step: '02',
    photo: 'iso-floorplan-open',
    title: 'Unit pasportini o‘rganing',
    text: 'Har bir unit uchun maydon, xonalar soni, jihozlar ro‘yxati, qavat va aniq narx ko‘rsatilgan. Yoqqan joylarni sevimlilarga saqlang.',
  },
  {
    step: '03',
    photo: 'iso-warehouse',
    title: 'Ariza yuboring va imzolang',
    text: 'Tanlangan joyga onlayn ariza yuboring. Kelishuv shartlari tasdiqlangach, shartnoma avtomatik shakllanadi va imzolashga yuboriladi.',
  },
]

const SERVICES = [
  {
    icon: 'search',
    tone: 'bg-brand-50 text-brand-600',
    title: 'Bo‘sh joy qidirish',
    text: 'Joy turi, maqsad, hudud, narx, maydon va qavat bo‘yicha aniq filtrlash. Yoqqan joylarni sevimlilarga saqlang va yonma-yon solishtiring.',
  },
  {
    icon: 'shield',
    tone: 'bg-ok-50 text-ok-600',
    title: 'Ariza va shartnoma',
    text: 'Tanlangan unitga onlayn ariza yuboring. Shartnoma qoralamasi avtomatik tuziladi va imzolangach tizimda saqlanadi, qog‘oz almashinuvi talab etilmaydi.',
  },
  {
    icon: 'contract',
    tone: 'bg-info-50 text-info-600',
    title: 'Shartnoma va hisob-kitob',
    text: 'Shartnoma shartlari, oylik hisob-fakturalar, to‘lov holati va qarzdorlik bo‘yicha ogohlantirishlar bitta oynada jamlanadi.',
  },
  {
    icon: 'wrench',
    tone: 'bg-warn-50 text-warn-600',
    title: 'Servis va texnik xizmat',
    text: 'Buzilish yoki xizmat so‘rovini yuboring, biriktirilgan usta va bajarilish bosqichini real vaqtda kuzating.',
  },
  {
    icon: 'chart',
    tone: 'bg-brand-50 text-brand-600',
    title: 'Hisobot va monitoring',
    text: 'Bandlik, bo‘sh maydon, tushum va kommunal sarflar bo‘yicha ko‘rsatkichlar obyekt va portfel kesimida.',
  },
  {
    icon: 'doc',
    tone: 'bg-ok-50 text-ok-600',
    title: 'Hujjatlar reyestri',
    text: 'Texnik pasport, ruxsatnoma va kadastr hujjatlari yagona reyestrda saqlanadi, muddati tugashi oldindan eslatiladi.',
  },
]

const SYSTEM_POINTS = [
  {
    icon: 'refresh',
    title: 'Real vaqt rejimida yangilanish',
    text: 'Unit bo‘shashi yoki bandlanishi bilan e’lon holati avtomatik o‘zgaradi.',
  },
  {
    icon: 'filter',
    title: 'Aqlli filter va moslashtirilgan qidiruv',
    text: 'Joy turi, narx, maydon, qavat va qulayliklar bo‘yicha kesim.',
  },
  {
    icon: 'layers',
    title: 'Sevimlilar va solishtirish',
    text: 'Bir nechta joyni tanlab, asosiy parametrlarni yonma-yon taqqoslang.',
  },
  {
    icon: 'cube',
    title: 'Tizim yadrosi bilan integratsiya',
    text: 'Ariza, shartnoma, billing va monitoring bitta ma’lumot bazasida ishlaydi.',
  },
]

const stats = computed(() => [
  { label: 'Obyektlar', value: num(PORTFOLIO_TOTALS.buildings), unit: 'ta' },
  { label: 'Umumiy ijara maydoni', value: num(PORTFOLIO_TOTALS.gla), unit: 'm²' },
  { label: 'Katalogdagi bo‘sh maydon', value: num(vacantAreaTotal.value), unit: 'm²' },
  { label: 'Bandlik', value: percent(PORTFOLIO_TOTALS.occupancy), unit: '' },
  { label: 'Unitlar', value: num(PORTFOLIO_TOTALS.units), unit: 'ta' },
  { label: 'Katalogdagi bo‘sh unitlar', value: num(vacantCount.value), unit: 'ta' },
])

const ARTICLES = [
  {
    id: 'a1',
    tag: 'Bozor tahlili',
    date: '2026-07-28',
    title: 'Toshkent ofis bozorida bandlik 87 foizga yetdi',
    text: 'Platformadagi besh obyekt bo‘yicha o‘rtacha bandlik 87 foizni tashkil etdi. A klass biznes markazlarda bo‘sh maydon ulushi eng past darajada qoldi, B klass ofislarda esa yangi ijarachilar hisobiga bandlik barqarorlashdi. Tahlil obyektlar bo‘yicha oylik yopilgan shartnomalar va bo‘shagan unitlar nisbatiga asoslangan.',
  },
  {
    id: 'a2',
    tag: 'Platforma',
    date: '2026-06-14',
    title: 'Ariza va shartnomalar to‘liq raqamli konturga o‘tdi',
    text: 'Bo‘sh joyga ariza yuborishdan tortib shartnoma rasmiylashtirishgacha bo‘lgan barcha bosqichlar tizimda kuzatiladi. Taklif shartlari kelishilgach shartnoma qoralamasi avtomatik shakllanadi, imzolangan hujjat esa reyestrda saqlanib, istalgan vaqtda yuklab olinadi.'
  },
  {
    id: 'a3',
    tag: 'Bozor tahlili',
    date: '2026-05-30',
    title: 'Ombor va logistika maydonlariga talab ortmoqda',
    text: 'Yirik yuk oqimlari va onlayn savdoning o‘sishi hisobiga shahar atrofidagi ombor maydonlariga so‘rov sezilarli ko‘paydi. Katta maydonli bloklar odatda birinchi so‘rovdanoq bron qilinmoqda, shu bois katalogda bo‘sh ombor bloklari uzoq turmaydi.',
  },
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
          alt="Green Business Center biznes markazi tashqi ko‘rinishi"
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
          Bo‘sh joylar bazasi real vaqt rejimida yangilanadi
        </span>

        <h1
          class="mt-5 max-w-[18ch] text-[34px] font-extrabold leading-[1.08] text-white sm:text-[44px] lg:text-[54px]"
        >
          Toshkentdagi bo‘sh maydonlar, <span class="text-brand-400">bitta ishonchli katalogda</span>
        </h1>

        <p class="mt-4 max-w-[58ch] text-[15px] leading-relaxed text-white/80 sm:text-[16px]">
          Ofis, do‘kon, ombor yoki turar joy, beshta boshqariladigan obyektning bo‘sh bloklari
          maydon, narx va qavat bo‘yicha ochiq ko‘rsatilgan. Joyni tanlang va to‘g‘ridan-to‘g‘ri
          ariza yuboring.
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
                Kengaytirilgan filtr
                <UiIcon name="arrowRight" :size="15" />
              </NuxtLink>
            </div>

            <UiInput
              v-model="q"
              class="mt-3.5"
              placeholder="Obyekt nomi, manzil yoki kalit so‘z"
              aria-label="Kalit so‘z bo‘yicha qidirish"
            >
              <template #prefix>
                <UiIcon name="search" :size="18" />
              </template>
            </UiInput>

            <div class="mt-3.5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <UiField label="Joy turi">
                <UiSelect v-model="fType" :options="TYPE_OPTIONS" size="sm" />
              </UiField>
              <UiField label="Maqsad">
                <UiSelect v-model="fUsage" :options="USAGE_OPTIONS" size="sm" />
              </UiField>
              <UiField label="Shahar / tuman">
                <UiSelect v-model="fPlace" :options="PLACE_OPTIONS" size="sm" />
              </UiField>
              <UiField label="Maydon oralig‘i">
                <UiSelect v-model="fArea" :options="AREA_OPTIONS" size="sm" />
              </UiField>
              <UiField label="Narx oralig‘i">
                <UiSelect v-model="fPrice" :options="PRICE_OPTIONS" size="sm" />
              </UiField>
              <div class="flex items-end">
                <UiButton type="submit" size="sm" block>
                  <UiIcon name="search" :size="16" />
                  Qidirish
                </UiButton>
              </div>
            </div>

            <div
              class="mt-3.5 flex flex-wrap items-center gap-2 border-t border-ink-100 pt-3.5"
            >
              <span class="text-[11.5px] font-bold uppercase tracking-wide text-ink-500">
                Tez tanlov
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
                Xaritada ko‘rish
              </NuxtLink>
            </div>
          </form>
        </div>

        <!-- Ishonch qatori -->
        <dl class="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div
            v-for="t in TRUST"
            :key="t.label"
            class="rounded-field bg-white/10 px-4 py-3 ring-1 ring-inset ring-white/20 backdrop-blur-sm"
          >
            <dt class="text-[11px] font-semibold uppercase tracking-wide text-white/75">
              {{ t.label }}
            </dt>
            <dd class="tabular mt-1 text-[20px] font-bold text-white sm:text-[24px]">
              {{ t.value }}
              <span v-if="t.unit" class="text-[12px] font-medium text-white/75">{{ t.unit }}</span>
            </dd>
          </div>
        </dl>
      </div>
    </section>

    <!-- Kategoriyalar -->
    <section class="mx-auto max-w-[1360px] px-4 py-12 lg:px-8 lg:py-14">
      <div class="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p class="text-[11.5px] font-bold uppercase tracking-wide text-brand-600">Kategoriyalar</p>
          <h2 class="mt-2 text-[22px] font-bold sm:text-[26px]">Qaysi turdagi joy kerak?</h2>
        </div>
        <NuxtLink
          to="/catalog"
          class="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-brand-600 transition-colors duration-150 hover:text-brand-700"
        >
          Butun katalog
          <UiIcon name="arrowRight" :size="16" />
        </NuxtLink>
      </div>

      <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
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
              <span class="rounded-pill bg-white/15 px-2 py-0.5">{{ c.count }} ta e’lon</span>
              <span class="text-white/75">{{ num(c.area) }} m²</span>
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
            <p class="text-[11.5px] font-bold uppercase tracking-wide text-brand-600">E’lonlar</p>
            <h2 class="mt-2 text-[22px] font-bold sm:text-[26px]">Tavsiya etilgan bo‘sh joylar</h2>
            <p class="mt-2 text-[13.5px] text-ink-500">
              Katalogda hozir mavjud, darhol ariza yuborish mumkin bo‘lgan unitlar
            </p>
          </div>
          <NuxtLink
            to="/catalog"
            class="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-brand-600 transition-colors duration-150 hover:text-brand-700"
          >
            Hammasini ko‘rish ({{ vacantCount }})
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
                :aria-label="`${l.building.name}, ${l.unit.code}-unit`"
              >
                <UiPhoto
                  :name="l.building.photo"
                  :alt="`${l.building.name}, ${l.unit.code}-unit`"
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
                {{ l.unit.offer === 'Sotuv' ? 'Sotib olish' : 'Ijaraga' }}
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
                :aria-label="`${l.building.name} ${l.unit.code}-unitni sevimlilarga qo‘shish`"
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
                  <span class="tabular">{{ l.unit.floor }}-qavat</span>
                </span>
                <span class="inline-flex items-center gap-1.5">
                  <UiIcon name="cube" :size="15" class="text-ink-400" />
                  {{ l.unit.usage }}
                </span>
              </div>

              <p class="mt-3 text-[12.5px] text-ink-500">
                {{ l.unit.code }}-unit · {{ l.unit.rooms }} xona · {{ l.building.buildingClass }}
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
                  Batafsil
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
            <p class="text-[11.5px] font-bold uppercase tracking-wide text-brand-600">Joylashuv</p>
            <h2 class="mt-2 text-[22px] font-bold sm:text-[26px]">Obyektlar xaritasi</h2>
            <p class="mt-2 text-[14px] leading-relaxed text-ink-600">
              Beshta obyektning haqiqiy joylashuvi. Nishonchani bosing, bandlik darajasi va
              obyektga o‘tish havolasi ochiladi.
            </p>
          </div>
          <NuxtLink
            to="/catalog"
            class="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-brand-600 transition-colors duration-150 hover:text-brand-700"
          >
            Katalogdan tanlash
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
                  {{ o.district }} · {{ percent(o.occupancy) }} bandlik
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
        <div class="mb-5 max-w-[62ch]">
          <p class="text-[11.5px] font-bold uppercase tracking-wide text-brand-600">Obyektlar</p>
          <h2 class="mt-2 text-[22px] font-bold sm:text-[26px]">Platformadagi beshta obyekt</h2>
          <p class="mt-2 text-[14px] leading-relaxed text-ink-600">
            Har bir obyekt bo‘yicha qavatlar rejasi, bo‘sh unitlar, jihozlar va qulayliklar ro‘yxati
            ochiq ko‘rinishda taqdim etilgan.
          </p>
        </div>

        <div class="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          <article
            v-for="o in objects"
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
                <span class="text-[12.5px] font-semibold text-ink-600">Bandlik</span>
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
                  <dt class="text-[12px] text-ink-500">Qavat</dt>
                  <dd class="tabular text-[15px] font-bold text-ink-900">{{ o.floors }}</dd>
                </div>
                <div>
                  <dt class="text-[12px] text-ink-500">E’lon</dt>
                  <dd class="tabular text-[15px] font-bold text-ink-900">{{ o.offers }}</dd>
                </div>
                <div>
                  <dt class="text-[12px] text-ink-500">Bo‘sh m²</dt>
                  <dd class="tabular text-[15px] font-bold text-ok-600">{{ num(o.vacant) }}</dd>
                </div>
              </dl>

              <div class="mt-auto pt-4">
                <UiButton variant="secondary" size="sm" :to="`/catalog/${o.slug}`" block>
                  Obyekt pasporti
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
              <h3 class="mt-4 text-[18px] font-bold text-white">
                Barcha bo‘sh bloklarni bir joyda ko‘ring
              </h3>
              <p class="mt-2 text-[13.5px] leading-relaxed text-white/85">
                Katalogda hozir {{ vacantCount }} ta bo‘sh unit va jami
                {{ num(vacantAreaTotal) }} m² maydon mavjud. Filtrlar orqali kerakli o‘lchamdagi
                joyni bir necha soniyada toping.
              </p>
            </div>
            <div class="flex flex-wrap gap-3">
              <UiButton variant="secondary" size="sm" to="/catalog">
                <UiIcon name="search" :size="16" />
                Katalogga o‘tish
              </UiButton>
              <UiButton variant="success" size="sm" to="/login">
                <UiIcon name="shield" :size="16" />
                Tizimga kirish
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
          Qanday ishlaydi
        </p>
        <h2 class="mt-2 text-[22px] font-bold sm:text-[26px]">Uch bosqichda mos joyni toping</h2>
        <p class="mt-2 text-[14px] leading-relaxed text-ink-600">
          Qidiruvdan shartnomagacha bo‘lgan yo‘l bitta tizim ichida kechadi, hujjatni qayta
          to‘ldirish yoki ma’lumotni takroran kiritish talab etilmaydi.
        </p>
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
              :alt="s.title"
              ratio="aspect-[16/10]"
              rounded="rounded-card"
              sizes="220px"
              contain
            />
          </div>
          <p class="tabular mt-4 text-[11.5px] font-bold uppercase tracking-wide text-brand-600">
            {{ s.step }}-bosqich
          </p>
          <h3 class="mt-1.5 text-[16px] font-bold">{{ s.title }}</h3>
          <p class="mt-2 text-[13.5px] leading-relaxed text-ink-600">{{ s.text }}</p>
        </li>
      </ol>
    </section>

    <!-- Xizmatlar -->
    <section id="xizmatlar" class="scroll-mt-24 border-y border-ink-200 bg-surface">
      <div class="mx-auto max-w-[1360px] px-4 py-12 lg:px-8 lg:py-14">
        <div class="max-w-[62ch]">
          <p class="text-[11.5px] font-bold uppercase tracking-wide text-brand-600">Xizmatlar</p>
          <h2 class="mt-2 text-[22px] font-bold sm:text-[26px]">
            Joy tanlashdan shartnoma va servisgacha, bitta oqimda
          </h2>
          <p class="mt-2 text-[14px] leading-relaxed text-ink-600">
            Platforma ijarachi va mulk egasi o‘rtasidagi barcha bosqichlarni qamrab oladi: e’lon,
            ariza, imzo, hisob-kitob va texnik xizmat.
          </p>
        </div>

        <div class="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <article
            v-for="s in SERVICES"
            :key="s.title"
            class="rounded-panel bg-canvas p-5 ring-1 ring-ink-200/70"
          >
            <span class="grid size-11 place-items-center rounded-field" :class="s.tone">
              <UiIcon :name="s.icon" :size="22" />
            </span>
            <h3 class="mt-4 text-[15.5px] font-bold">{{ s.title }}</h3>
            <p class="mt-2 text-[13.5px] leading-relaxed text-ink-600">{{ s.text }}</p>
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
              Tizim haqida
            </p>
            <h2 class="mt-2 text-[22px] font-bold sm:text-[26px]">
              Ko‘chmas mulk boshqaruvining yagona raqamli yadrosi
            </h2>
            <p class="mt-3 max-w-[58ch] text-[14px] leading-relaxed text-ink-600">
              MAKON obyekt, unit, ariza, shartnoma, hisob-kitob va servis jarayonlarini bitta
              ma’lumot bazasida birlashtiradi. Ommaviy katalogda faqat bo‘sh joylar va ularning
              mavjudligi ko‘rsatiladi: band unitlar bo‘yicha ijarachi va moliyaviy ma’lumotlar
              ochiq emas.
            </p>

            <ul class="mt-6 space-y-4">
              <li v-for="p in SYSTEM_POINTS" :key="p.title" class="flex gap-3.5">
                <span
                  class="grid size-10 shrink-0 place-items-center rounded-field bg-brand-50 text-brand-600"
                >
                  <UiIcon :name="p.icon" :size="20" />
                </span>
                <span>
                  <span class="block text-[14.5px] font-semibold text-ink-900">{{ p.title }}</span>
                  <span class="block text-[13px] leading-relaxed text-ink-600">{{ p.text }}</span>
                </span>
              </li>
            </ul>

            <div class="mt-7 flex flex-wrap gap-3">
              <UiButton to="/catalog">
                <UiIcon name="search" :size="17" />
                Katalogga o‘tish
              </UiButton>
              <UiButton variant="secondary" to="/login">
                <UiIcon name="shield" :size="17" />
                Tizimga kirish
              </UiButton>
            </div>
          </div>

          <div>
            <div class="grid grid-cols-2 gap-4">
              <UiPhoto
                name="interior-office"
                alt="Biznes markazdagi ofis interyeri"
                ratio="aspect-[4/3]"
                sizes="270px"
                class="shadow-card"
              />
              <UiPhoto
                name="green-business-center-2"
                alt="Green Business Center binosining ichki hovlisi"
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
          <p class="text-[11.5px] font-bold uppercase tracking-wide text-brand-600">Blog</p>
          <h2 class="mt-2 text-[22px] font-bold sm:text-[26px]">Bozor va platforma yangiliklari</h2>
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
                {{ a.tag }}
              </span>
              <span class="tabular text-[12.5px] text-ink-500">{{ dateLong(a.date) }}</span>
            </span>
            <span
              class="mt-3 text-[16px] font-bold leading-snug text-ink-900 group-hover:text-brand-700"
            >
              {{ a.title }}
            </span>
            <span class="mt-2 line-clamp-3 text-[13.5px] leading-relaxed text-ink-600">
              {{ a.text }}
            </span>
            <span
              class="mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-600"
            >
              To‘liq o‘qish
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
            alt="Urban Office ofis binosi"
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
              Mos joyni tanladingizmi?
            </h2>
            <p class="mt-2 text-[14.5px] leading-relaxed text-white/85">
              Katalogdan bo‘sh unitni tanlang va ariza yuboring. Ariza yuborish uchun tizimga
              tizimga kirish talab etiladi.
            </p>
          </div>
          <div class="flex flex-wrap gap-3">
            <UiButton to="/catalog">
              <UiIcon name="search" :size="17" />
              Bo‘sh joylar katalogi
            </UiButton>
            <UiButton variant="success" to="/login">
              <UiIcon name="shield" :size="17" />
              Tizimga kirish
            </UiButton>
          </div>
        </div>
      </div>
    </section>

    <UiModal
      v-model="articleOpen"
      :title="activeArticle.title"
      :subtitle="dateLong(activeArticle.date)"
    >
      <span class="rounded-pill bg-brand-50 px-2.5 py-1 text-[11.5px] font-bold text-brand-700">
        {{ activeArticle.tag }}
      </span>
      <p class="mt-4 text-[14px] leading-relaxed text-ink-700">{{ activeArticle.text }}</p>

      <template #footer>
        <UiButton variant="secondary" @click="articleOpen = false">Yopish</UiButton>
        <UiButton to="/catalog">Katalogga o‘tish</UiButton>
      </template>
    </UiModal>
  </div>
</template>
