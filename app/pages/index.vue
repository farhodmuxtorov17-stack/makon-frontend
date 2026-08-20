<script setup lang="ts">
import { useStorage } from "@vueuse/core";
import {
  BUILDINGS,
  PORTFOLIO_TOTALS,
  buildingById,
  type Building,
} from "~/data/buildings";
import { vacantUnits, type Unit } from "~/data/units";
import { OCCUPANCY_BANDS } from "~/constants/statuses";
import { num, area, percent } from "~/utils/format";

const {
  buildingTypeLabel,
  unitUsageLabel,
  priceUnitLabel,
  buildingClassLabel,
} = useAppLabels();

definePageMeta({ layout: "public" });

const { t } = useI18n();

/**
 * Xarita bosilgandan keyin ochiladi. Sabab ikkita: birinchi ekranda u
 * diqqatni tortib oladi va foydalanuvchi qidiruvdan chalg'iydi; ikkinchidan
 * plitkalar yuklanishi sahifa ochilishini sekinlashtiradi. Bosilmaguncha
 * o'rnida yengil taklif turadi.
 */
const mapOpen = ref(false);

interface Listing {
  unit: Unit;
  building: Building;
}

/**
 * Bino turi klassifikatori ma’lumotnomadagi BLD_TYPE yozuvlari bilan bir xil:
 * beshta tur, har biriga bitta kalit. Landingdagi nom bilan obyekt
 * pasportidagi nom har doim mos tushadi.
 */
const CATEGORY_TYPES: Record<string, string[]> = {
  biznes: ["Biznes markaz"],
  ofis: ["Ofis binosi"],
  savdo: ["Savdo markaz"],
  ombor: ["Ombor / logistika"],
  turar: ["Turar joy"],
};

const listings = computed<Listing[]>(() =>
  vacantUnits()
    .map((u) => ({ unit: u, building: buildingById(u.buildingId)! }))
    .filter((l) => !!l.building),
);

/** Har bir obyektdan navbat bilan olinadi, bitta bino ro‘yxatni egallab qolmasin */
const featured = computed<Listing[]>(() => {
  const groups = new Map<string, Listing[]>();
  for (const l of listings.value) {
    const arr = groups.get(l.building.id);
    if (arr) arr.push(l);
    else groups.set(l.building.id, [l]);
  }

  const queues = [...groups.values()];
  const out: Listing[] = [];
  for (let i = 0; out.length < 6 && queues.some((g) => g.length > i); i++) {
    for (const g of queues) {
      const item = g[i];
      if (item && out.length < 6) out.push(item);
    }
  }
  return out;
});

const vacantCount = computed(() => listings.value.length);
const vacantAreaTotal = computed(() =>
  listings.value.reduce((s, l) => s + l.unit.area, 0),
);

// --- Qidiruv ---------------------------------------------------------------

const q = ref("");
const fType = ref("");

/** Yorliqlar katalogdagi «Bino turi» ro‘yxati bilan so‘zma-so‘z bir xil */
const TYPE_OPTIONS = computed(() => [
  { value: "", label: t("common.all") },
  { value: "biznes", label: t("landing.typeBiznes") },
  { value: "ofis", label: t("landing.typeOfis") },
  { value: "savdo", label: t("landing.typeSavdo") },
  { value: "ombor", label: t("landing.typeOmbor") },
  { value: "turar", label: t("landing.typeTurar") },
]);

/** Tez tanlov: har bir tur va undagi bo‘sh maydonlar soni */
const CATEGORY_LABELS: Record<string, string> = {
  biznes: "landing.typeBiznes",
  ofis: "landing.typeOfis",
  savdo: "landing.typeSavdo",
  ombor: "landing.typeOmbor",
  turar: "landing.typeTurar",
};

const categories = computed(() =>
  Object.entries(CATEGORY_TYPES).map(([key, types]) => ({
    key,
    label: t(CATEGORY_LABELS[key] ?? ""),
    count: listings.value.filter((l) => types.includes(l.building.type)).length,
  })),
);

function goSearch() {
  const query: Record<string, string> = {};
  if (q.value.trim()) query.q = q.value.trim();
  if (fType.value) query.type = fType.value;
  navigateTo({ path: "/catalog", query });
}

function goCategory(key: string) {
  navigateTo({ path: "/catalog", query: { type: key } });
}

// --- Sarlavha ostidagi uchta ko‘rsatkich -----------------------------------

const HERO_STATS = computed(() => [
  {
    label: t("landing.statObjects"),
    value: num(PORTFOLIO_TOTALS.buildings),
    unit: "",
  },
  {
    label: t("landing.statVacantUnits"),
    value: num(vacantCount.value),
    unit: "",
  },
  {
    label: t("landing.statVacantArea"),
    value: num(vacantAreaTotal.value),
    unit: t("common.areaUnit"),
  },
]);

// --- Xarita ----------------------------------------------------------------

const mapMarkers = computed(() =>
  BUILDINGS.map((b) => ({
    id: b.id,
    lat: b.lat,
    lon: b.lon,
    label: b.name,
    caption: `${b.district} · ${buildingTypeLabel(b.type)}`,
    value: b.occupancy,
    valueLabel: t("landing.occupancyValueLabel"),
    to: `/catalog/${b.slug}`,
    tone:
      b.occupancy >= 90
        ? ("ok" as const)
        : b.occupancy >= 84
          ? ("brand" as const)
          : ("warn" as const),
  })),
);

const mapStats = computed(() => [
  {
    label: t("landing.mapStatObjects"),
    value: num(PORTFOLIO_TOTALS.buildings),
  },
  {
    label: t("landing.mapStatOccupancy"),
    value: percent(PORTFOLIO_TOTALS.occupancy),
  },
  {
    label: t("landing.mapStatVacant"),
    value: `${num(Math.round(PORTFOLIO_TOTALS.vacantArea / 1000))} ${t("landing.thousandArea")}`,
  },
]);

/** Chegara ham, yozuv ham `OCCUPANCY_BANDS` dan: uch ekranda bitta shkala */
const mapLegend = computed(() =>
  OCCUPANCY_BANDS.map((b) => ({ label: t(b.labelKey), class: b.class })),
);

// --- Sevimlilar ------------------------------------------------------------

/** Sevimlilar sarlavhadagi nishoncha va katalog bilan bitta xotirada */
const favourites = useStorage<string[]>("makon.favourites", []);

function toggleFavourite(id: string) {
  favourites.value = favourites.value.includes(id)
    ? favourites.value.filter((f) => f !== id)
    : [...favourites.value, id];
}

// --- Ariza -----------------------------------------------------------------

/** Ariza oynasi maketda bir nusxada turadi, sahifa uni faqat ochadi */
const applyOpen = useState<boolean>("makon.apply.open", () => false);
const applyUnit = useState<string>("makon.apply.unit", () => "");

function openApply() {
  applyUnit.value = "";
  applyOpen.value = true;
}

const STEPS = [
  { step: "01", titleKey: "landing.step1Title", textKey: "landing.step1Text" },
  { step: "02", titleKey: "landing.step2Title", textKey: "landing.step2Text" },
  { step: "03", titleKey: "landing.step3Title", textKey: "landing.step3Text" },
];
</script>

<template>
  <div>
    <!-- 1. Birinchi ekran: nima taklif qilinadi va nima qilish kerak -->
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
        class="absolute inset-0 bg-gradient-to-t from-ink-900/95 via-ink-900/75 to-ink-900/55"
        aria-hidden="true"
      />
      <div
        class="absolute inset-0 bg-gradient-to-r from-ink-900/80 via-ink-900/30 to-transparent"
        aria-hidden="true"
      />

      <div
        class="relative mx-auto max-w-[1200px] px-4 pb-16 pt-14 lg:px-8 lg:pb-24 lg:pt-24"
      >
        <p
          class="flex items-center gap-2.5 text-[12px] font-bold uppercase tracking-[0.09em] text-white/70"
        >
          <span
            class="size-1.5 shrink-0 rounded-full bg-brand-400"
            aria-hidden="true"
          />
          {{
            t("landing.heroEyebrow", {
              objects: PORTFOLIO_TOTALS.buildings,
              units: vacantCount,
            })
          }}
        </p>

        <h1
          class="mt-5 max-w-[15ch] text-[36px] font-extrabold leading-[1.04] tracking-[-0.025em] text-white sm:text-[48px] lg:text-[60px]"
        >
          {{ t("landing.heroTitle") }}
          <span class="text-brand-400">{{ t("landing.heroTitleAccent") }}</span>
        </h1>

        <p
          class="mt-6 max-w-[56ch] text-[16px] leading-relaxed text-white/75 sm:text-[16px]"
        >
          {{ t("landing.heroLead") }}
        </p>

        <!-- Qidiruv: bitta so‘z, bitta tur, bitta tugma -->
        <form
          class="mt-9 max-w-[840px] rounded-panel bg-surface p-3 shadow-pop sm:p-3.5"
          @submit.prevent="goSearch"
        >
          <div class="grid gap-2.5 sm:grid-cols-[minmax(0,1fr)_190px_auto]">
            <UiInput
              v-model="q"
              :placeholder="t('landing.searchPlaceholder')"
              :aria-label="t('landing.searchAria')"
            >
              <template #prefix>
                <UiIcon name="search" :size="18" />
              </template>
            </UiInput>
            <UiSelect
              v-model="fType"
              :options="TYPE_OPTIONS"
              :aria-label="t('landing.fieldType')"
            />
            <UiButton type="submit" class="sm:px-7">
              {{ t("common.search") }}
            </UiButton>
          </div>
        </form>

        <div class="mt-5 flex max-w-[840px] flex-wrap items-center gap-2">
          <span
            class="text-[12px] font-bold uppercase tracking-[0.09em] text-white/60"
          >
            {{ t("landing.quickPick") }}
          </span>
          <button
            v-for="c in categories"
            :key="c.key"
            type="button"
            class="tabular inline-flex min-h-[44px] items-center gap-1.5 rounded-pill bg-white/10 px-4 text-[13px] font-semibold text-white ring-1 ring-inset ring-white/20 transition-colors duration-150 hover:bg-white/20 active:bg-white/25"
            @click="goCategory(c.key)"
          >
            {{ c.label }}
            <span class="text-white/60">{{ c.count }}</span>
          </button>
        </div>

        <dl
          class="mt-12 grid max-w-[840px] grid-cols-3 gap-6 border-t border-white/15 pt-7"
        >
          <div v-for="s in HERO_STATS" :key="s.label">
            <dd
              class="tabular text-[28px] font-extrabold leading-none text-white sm:text-[36px]"
            >
              {{ s.value }}
              <span
                v-if="s.unit"
                class="text-[13px] font-semibold text-white/60"
              >
                {{ s.unit }}
              </span>
            </dd>
            <dt class="mt-2 text-[12px] font-medium leading-snug text-white/60">
              {{ s.label }}
            </dt>
          </div>
        </dl>
      </div>
    </section>

    <!-- 2. Hozir bo‘sh maydonlar -->
    <section class="bg-surface">
      <div class="mx-auto max-w-[1200px] px-4 py-16 lg:px-8 lg:py-24">
        <div class="flex flex-wrap items-end justify-between gap-4">
          <div class="max-w-[52ch]">
            <h2 class="text-[28px] font-bold tracking-[-0.02em] lg:text-[36px]">
              {{ t("landing.listingsTitle") }}
            </h2>
            <p class="mt-2.5 text-[14px] leading-relaxed text-ink-600">
              {{ t("landing.listingsLead") }}
            </p>
          </div>
          <NuxtLink
            to="/catalog"
            class="inline-flex min-h-[44px] items-center gap-1.5 text-[14px] font-semibold text-brand-600 transition-colors duration-150 hover:text-brand-700"
          >
            {{ t("landing.listingsAll", { count: vacantCount }) }}
            <UiIcon name="arrowRight" :size="16" />
          </NuxtLink>
        </div>

        <div class="mt-9 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <article
            v-for="l in featured"
            :key="l.unit.id"
            class="flex flex-col overflow-hidden rounded-panel bg-surface shadow-card ring-1 ring-ink-200/70 transition-shadow duration-200 hover:shadow-pop"
          >
            <div class="relative">
              <NuxtLink
                :to="`/catalog/${l.building.slug}?unit=${l.unit.id}`"
                class="block"
                :aria-label="
                  t('landing.unitAria', {
                    building: l.building.name,
                    code: l.unit.code,
                  })
                "
              >
                <UiPhoto
                  :name="l.building.photo"
                  :alt="
                    t('landing.unitAria', {
                      building: l.building.name,
                      code: l.unit.code,
                    })
                  "
                  ratio="aspect-[16/10]"
                  rounded="rounded-none"
                  sizes="(max-width: 640px) 100vw, 380px"
                />
                <div
                  class="absolute inset-0 bg-gradient-to-t from-ink-900/85 via-ink-900/15 to-transparent"
                  aria-hidden="true"
                />
                <div class="absolute inset-x-0 bottom-0 p-4">
                  <p class="truncate text-[16px] font-bold text-white">
                    {{ l.building.name }}
                  </p>
                  <p
                    class="mt-0.5 flex items-center gap-1.5 truncate text-[13px] text-white/75"
                  >
                    <UiIcon name="location" :size="14" />
                    {{ l.building.city }}, {{ l.building.district }}
                  </p>
                </div>
              </NuxtLink>

              <span
                class="absolute left-3 top-3 rounded-pill px-2.5 py-1 text-[11px] font-bold text-white"
                :class="
                  l.unit.offer === 'Sotuv' ? 'bg-teal-700' : 'bg-brand-500'
                "
              >
                {{
                  l.unit.offer === "Sotuv"
                    ? t("landing.offerSale")
                    : t("landing.offerRent")
                }}
              </span>

              <button
                type="button"
                class="absolute right-2.5 top-2.5 grid size-11 place-items-center rounded-full bg-white/90 transition-colors duration-150 hover:bg-white"
                :class="
                  favourites.includes(l.unit.id)
                    ? 'text-danger-500'
                    : 'text-ink-400 hover:text-danger-500'
                "
                :aria-pressed="favourites.includes(l.unit.id)"
                :aria-label="
                  t('landing.favouriteAria', {
                    building: l.building.name,
                    code: l.unit.code,
                  })
                "
                @click="toggleFavourite(l.unit.id)"
              >
                <svg
                  class="size-[18px]"
                  viewBox="0 0 24 24"
                  :fill="
                    favourites.includes(l.unit.id) ? 'currentColor' : 'none'
                  "
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
              <p
                class="tabular text-[22px] font-extrabold leading-none tracking-[-0.01em] text-ink-900"
              >
                {{ num(l.unit.price) }}
                <span class="text-[13px] font-semibold text-ink-500">{{
                  priceUnitLabel(l.unit.priceUnit)
                }}</span>
              </p>
              <p class="mt-2 text-[13px] text-ink-500">
                {{
                  t("landing.unitSummary", {
                    code: l.unit.code,
                    rooms: l.unit.rooms,
                    class: buildingClassLabel(l.building.buildingClass),
                  })
                }}
              </p>

              <div
                class="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-ink-100 pt-4 text-[13px] text-ink-600"
              >
                <span class="inline-flex items-center gap-1.5">
                  <UiIcon name="layers" :size="15" class="text-ink-400" />
                  <span class="tabular">{{ area(l.unit.area) }}</span>
                </span>
                <span class="inline-flex items-center gap-1.5">
                  <UiIcon name="building" :size="15" class="text-ink-400" />
                  <span class="tabular">{{
                    t("landing.floorNo", { floor: l.unit.floor })
                  }}</span>
                </span>
                <span class="inline-flex items-center gap-1.5">
                  <UiIcon name="cube" :size="15" class="text-ink-400" />
                  {{ unitUsageLabel(l.unit.usage) }}
                </span>
              </div>

              <div class="mt-auto pt-5">
                <UiButton
                  variant="secondary"
                  block
                  :to="`/catalog/${l.building.slug}?unit=${l.unit.id}`"
                >
                  {{ t("common.details") }}
                  <UiIcon name="chevronRight" :size="16" />
                </UiButton>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>

    <!-- 3. Obyektlar qayerda joylashgan -->
    <section id="obyektlar" class="scroll-mt-20 border-t border-ink-200/80">
      <div class="mx-auto max-w-[1200px] px-4 py-16 lg:px-8 lg:py-24">
        <div class="flex flex-wrap items-end justify-between gap-4">
          <div class="max-w-[56ch]">
            <h2 class="text-[28px] font-bold tracking-[-0.02em] lg:text-[36px]">
              {{ t("landing.mapTitle") }}
            </h2>
            <p class="mt-2.5 text-[14px] leading-relaxed text-ink-600">
              {{ t("landing.mapLead", { count: PORTFOLIO_TOTALS.buildings }) }}
            </p>
          </div>
          <NuxtLink
            to="/catalog"
            class="inline-flex min-h-[44px] items-center gap-1.5 text-[14px] font-semibold text-brand-600 transition-colors duration-150 hover:text-brand-700"
          >
            {{ t("landing.allObjects") }}
            <UiIcon name="arrowRight" :size="16" />
          </NuxtLink>
        </div>

        <div class="mt-9">
          <UiMap
            v-if="mapOpen"
            :markers="mapMarkers"
            :stats="mapStats"
            :legend="mapLegend"
            height="480px"
            :zoom="11"
            :min-zoom="11"
          />

          <button
            v-else
            type="button"
            class="group flex w-full flex-col items-center justify-center gap-3 rounded-panel bg-surface-sunken px-6 py-14 ring-1 ring-inset ring-ink-200 transition-colors duration-150 hover:bg-brand-50/60 hover:ring-brand-300"
            @click="mapOpen = true"
          >
            <span
              class="grid size-12 place-items-center rounded-full bg-white text-brand-600 shadow-card ring-1 ring-ink-200 transition-colors duration-150 group-hover:ring-brand-300"
            >
              <UiIcon name="map" :size="22" />
            </span>
            <span class="text-[16px] font-bold text-ink-900">{{
              t("landing.mapOpen")
            }}</span>
            <span class="max-w-[46ch] text-[13px] leading-relaxed text-ink-500">
              {{
                t("landing.mapOpenHint", { count: PORTFOLIO_TOTALS.buildings })
              }}
            </span>
          </button>
        </div>
      </div>
    </section>

    <!-- 4. Ariza yuborilgandan keyin nima bo‘ladi -->
    <section class="border-y border-ink-200/80 bg-surface">
      <div class="mx-auto max-w-[1200px] px-4 py-16 lg:px-8 lg:py-24">
        <div class="max-w-[52ch]">
          <h2 class="text-[28px] font-bold tracking-[-0.02em] lg:text-[36px]">
            {{ t("landing.stepsTitle") }}
          </h2>
          <p class="mt-2.5 text-[14px] leading-relaxed text-ink-600">
            {{ t("landing.stepsLead") }}
          </p>
        </div>

        <ol class="mt-10 grid gap-x-10 gap-y-9 lg:grid-cols-3">
          <li
            v-for="s in STEPS"
            :key="s.step"
            class="border-t-2 border-brand-500 pt-5"
          >
            <p
              class="tabular text-[12px] font-bold uppercase tracking-[0.09em] text-brand-600"
            >
              {{ t("landing.stepNo", { step: s.step }) }}
            </p>
            <h3 class="mt-2.5 text-[18px] font-bold">{{ t(s.titleKey) }}</h3>
            <p
              class="mt-2 max-w-[44ch] text-[14px] leading-relaxed text-ink-600"
            >
              {{ t(s.textKey) }}
            </p>
          </li>
        </ol>
      </div>
    </section>

    <!-- 5. Yakuniy chaqiriq: ariza oynasi -->
    <section class="mx-auto max-w-[1200px] px-4 py-16 lg:px-8 lg:py-20">
      <div
        class="relative isolate overflow-hidden rounded-panel bg-ink-900 shadow-panel"
      >
        <div class="absolute inset-0">
          <UiPhoto
            name="urban-office-4"
            :alt="t('landing.ctaPhotoAlt')"
            ratio="size-full"
            rounded="rounded-none"
            sizes="(max-width: 1200px) 100vw, 1200px"
          />
        </div>
        <div
          class="absolute inset-0 bg-gradient-to-r from-ink-900/95 via-ink-900/85 to-ink-900/50"
          aria-hidden="true"
        />

        <div
          class="relative flex flex-wrap items-center justify-between gap-7 px-6 py-11 lg:px-12 lg:py-14"
        >
          <div class="max-w-[50ch]">
            <h2
              class="text-[28px] font-bold tracking-[-0.02em] text-white lg:text-[36px]"
            >
              {{ t("landing.ctaTitle") }}
            </h2>
            <p class="mt-3 text-[14px] leading-relaxed text-white/80">
              {{ t("landing.ctaText") }}
            </p>
          </div>
          <div class="flex flex-wrap gap-3">
            <UiButton size="lg" @click="openApply">
              <UiIcon name="send" :size="18" />
              {{ t("apply.cta") }}
            </UiButton>
            <UiButton variant="secondary" size="lg" to="/catalog">
              {{ t("landing.ctaCatalog") }}
            </UiButton>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
