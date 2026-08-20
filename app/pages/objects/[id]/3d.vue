<script setup lang="ts">
import { buildingById } from "~/data/buildings";
import { STRUCTURE_KIND, structuresOf } from "~/data/structures";
import { unitsOfBuilding, type Unit } from "~/data/units";
import { area, num, percent } from "~/utils/format";

type ViewMode = "occupancy" | "interior" | "wire";

interface MixSlice {
  key: string;
  label: string;
  color: string;
  count: number;
  share: number;
}

interface FloorRow {
  floor: number;
  name: string;
  short: string;
  underground: boolean;
  units: Unit[];
  total: number;
  vacantCount: number;
  totalArea: number;
  vacantArea: number;
  occupancy: number;
  vacantShare: number;
  label: string;
  mix: MixSlice[];
  planFloor: number;
}

/** Holat legendasi: tartib va ranglar buyurtmachi maketidan */
const CATEGORIES: Array<{ key: string; color: string }> = [
  { key: "vacant", color: "#16B99A" },
  { key: "rented", color: "#0256F7" },
  { key: "sold", color: "#F84448" },
  { key: "reserved", color: "#FAA53F" },
  { key: "other", color: "#8494AC" },
];

const CATEGORY_OF: Record<string, string> = {
  VACANT: "vacant",
  RENTED: "rented",
  SOLD: "sold",
  RESERVED: "reserved",
  MAINTENANCE: "other",
  DRAFT: "other",
};

/** Legenda nomi status registridan olinadi, «Texnik / Boshqa» esa yig‘ma guruh */
const CATEGORY_STATUS: Record<string, string> = {
  vacant: "VACANT",
  rented: "RENTED",
  sold: "SOLD",
  reserved: "RESERVED",
};

const route = useRoute();
const id = computed(() => String(route.params.id));
const auth = useAuthStore();
const { t } = useI18n();
const {
  buildingTypeLabel,
  unitUsageLabel,
  field,
  statusLabel,
  moduleTitle,
  tr,
  priceUnitLabel,
  offerLabel,
} = useAppLabels();
const { action: leadAction, label: leadLabel, staffHint } = useLeadAction();

function categoryLabel(key: string) {
  const status = CATEGORY_STATUS[key];
  return status ? statusLabel("unit", status) : t("obj.categoryOther");
}

/** Biriktirilmagan obyekt 3D navigator havolasi orqali ham ochilmaydi */
const building = computed(() => {
  const b = buildingById(id.value);
  return b && auth.inScope(b.id) ? b : undefined;
});

/** Ijarachi va narx ma’lumoti faqat ijara oqimida ishlaydigan rollarga ochiq */
const showFinance = computed(
  () =>
    auth.can("application.decide") ||
    auth.can("invoice.create") ||
    auth.can("contract.manage"),
);

// 0 hech qachon haqiqiy daraja emas (yer osti manfiy, yer usti 1 dan boshlanadi),
// shu sababli birinchi kuzatuvchi reja kiritilgan eng boy qavatni ochadi.
const selectedFloor = ref(0);

const selectedUnit = ref("");
/** Navigatorda tanlangan qurilma: ro‘yxat bilan bitta holatdan boshqariladi */
const selectedStructure = ref("");
const viewMode = ref<ViewMode>("occupancy");

/** Uchastka tarkibi: ijaraga beriladigan va xizmat qurilmalari alohida ko‘rinadi */
const siteStructures = computed(() =>
  (building.value ? structuresOf(building.value.id) : []).map((s) => {
    const meta = STRUCTURE_KIND[s.kind];
    return {
      id: s.id,
      name: s.name,
      kind: tr(`obj.structureKind.${s.kind}`, meta.label),
      leasable: meta.leasable,
      size: `${Math.round(s.width)} × ${Math.round(s.depth)} ${t("unitOf.metre")}`,
      note: s.gla
        ? area(s.gla)
        : s.parkingSpaces
          ? t("obj.placesOf", { n: s.parkingSpaces })
          : t("obj.floorsOf", { n: s.floors }),
    };
  }),
);
/**
 * Qavat tanlansa uning ichi darhol ochiladi: ilgari avval qavat ajratilar,
 * so'ng rejimni qo'lda "Interyer" ga o'tkazish kerak edi.
 */
function openFloor(floor: number) {
  selectedFloor.value = floor;
  viewMode.value = "interior";
}

const allUnits = computed(() =>
  building.value ? unitsOfBuilding(building.value.id) : [],
);

const floorRows = computed<FloorRow[]>(() => {
  const b = building.value;
  if (!b) return [];

  const numbers: number[] = [];
  for (let k = b.undergroundFloors; k >= 1; k--) numbers.push(-k);
  for (let f = 1; f <= b.floors; f++) numbers.push(f);

  return numbers.map((floor) => {
    const units = allUnits.value.filter((u) => u.floor === floor);
    const totalArea = units.reduce((s, u) => s + u.area, 0);
    const vacant = units.filter((u) => u.status === "VACANT");
    const vacantArea = vacant.reduce((s, u) => s + u.area, 0);

    const mix: MixSlice[] = CATEGORIES.map((c) => {
      const own = units.filter(
        (u) => (CATEGORY_OF[u.status] ?? "other") === c.key,
      );
      return {
        key: c.key,
        label: categoryLabel(c.key),
        color: c.color,
        count: own.length,
        share: units.length ? own.length / units.length : 0,
      };
    }).filter((m) => m.count > 0);

    let label = t("obj.noPlan");
    if (units.length) {
      if (!vacant.length) label = t("obj.fullyOccupied");
      else if (vacant.length === units.length) label = t("obj.fullyVacant");
      else label = t("obj.partlyVacant");
    }

    return {
      floor,
      name:
        floor < 0
          ? t("obj.undergroundFloorNo", { floor: -floor })
          : t("unitOf.floorNo", { floor }),
      short: String(floor),
      underground: floor < 0,
      units,
      total: units.length,
      vacantCount: vacant.length,
      totalArea,
      vacantArea,
      occupancy: totalArea
        ? Math.round(((totalArea - vacantArea) / totalArea) * 100)
        : 0,
      vacantShare: totalArea ? Math.round((vacantArea / totalArea) * 100) : 0,
      label,
      mix,
      planFloor: floor,
    };
  });
});

const floorsWithPlan = computed(() =>
  floorRows.value.filter((f) => f.total > 0),
);

const currentFloor = computed(
  () =>
    floorRows.value.find((f) => f.floor === selectedFloor.value) ??
    floorRows.value[0],
);

const currentUnit = computed<Unit | undefined>(() =>
  currentFloor.value?.units.find((u) => u.id === selectedUnit.value),
);

const legend = computed(() => {
  const totals = new Map<string, number>();
  for (const u of allUnits.value) {
    const key = CATEGORY_OF[u.status] ?? "other";
    totals.set(key, (totals.get(key) ?? 0) + 1);
  }
  return CATEGORIES.map((c) => ({
    ...c,
    label: categoryLabel(c.key),
    count: totals.get(c.key) ?? 0,
  }));
});

watch(
  floorRows,
  (rows) => {
    if (!rows.length) return;
    if (rows.some((r) => r.floor === selectedFloor.value)) return;
    const best = rows.reduce((a, b) => (b.total > a.total ? b : a), rows[0]!);
    selectedFloor.value = best.total
      ? best.floor
      : rows[rows.length - 1]!.floor;
    selectedUnit.value = "";
  },
  { immediate: true },
);

watch(selectedFloor, () => {
  if (!currentFloor.value?.units.some((u) => u.id === selectedUnit.value))
    selectedUnit.value = "";
});

const buildingStats = computed(() => {
  const b = building.value;
  if (!b) return null;
  return [
    {
      label: field("floors"),
      value: String(b.floors),
      note: b.undergroundFloors
        ? t("obj.undergroundPlus", { n: b.undergroundFloors })
        : t("obj.noUnderground"),
      icon: "layers",
      tone: "bg-brand-50 text-brand-600",
    },
    {
      label: field("units"),
      value: num(b.units),
      note: t("obj.vacantOf", { n: num(b.vacantUnits) }),
      icon: "box",
      tone: "bg-info-50 text-info-600",
    },
    {
      label: t("kpi.occupancy"),
      value: percent(b.occupancy),
      note: t("obj.occupiedUnitsOf", { n: num(b.occupiedUnits) }),
      icon: "chart",
      tone: "bg-ok-50 text-ok-600",
    },
    {
      label: t("obj.vacantSqm"),
      value: num(b.vacantArea),
      note: `GLA ${num(b.gla)} ${t("unitOf.sqm")}`,
      icon: "meter",
      tone: "bg-warn-50 text-warn-600",
    },
  ];
});

const planLink = computed(() => {
  const b = building.value;
  const f = currentFloor.value;
  if (!b || !f) return "/objects";
  const query = selectedUnit.value ? `?unit=${selectedUnit.value}` : "";
  return `/objects/${b.id}/floors/${f.planFloor}${query}`;
});

function contractLabel(unit: Unit) {
  if (unit.contractCode)
    return t("obj.contractOf", { code: unit.contractCode });
  if (unit.status === "RESERVED") return t("obj.contractReserved");
  if (unit.status === "MAINTENANCE") return t("obj.contractMaintenance");
  if (unit.status === "VACANT") return t("obj.contractNone");
  return t("obj.contractUnknown");
}

/**
 * Bo'sh unit bo'yicha harakat rolga qarab hal qilinadi.
 *
 * Xodim o'z obyektiga o'zi ariza yubormaydi. Operator esa qo'ng'iroq qilgan
 * mijoz nomidan arizani arizalar navbatida ochadi, shuning uchun u shu
 * modulga o'tkaziladi. Ilgari tugma bosilganda «ichki rol ariza yarata
 * olmaydi» degan oyna chiqar va boshqa hech qanday yo'l ko'rsatilmasdi.
 */
function goApply() {
  const unit = currentUnit.value;
  if (!unit || unit.status !== "VACANT") return;
  // Kirmagan mehmon hisob ochmasdan ariza qoldiradi
  if (!auth.isAuthenticated) return navigateTo(`/ariza?unit=${unit.id}`);
  if (auth.role === "TENANT_OWNER")
    return navigateTo(`/cabinet/apply?unit=${unit.id}`);
}
</script>

<template>
  <template v-if="!building">
    <AppTopbar
      :title="t('empty.noObjects')"
      :breadcrumb="[
        { label: moduleTitle('objects'), to: '/objects' },
        { label: t('obj.notFoundCrumb') },
      ]"
    />
    <main class="scroll-slim flex-1 overflow-y-auto p-4 sm:p-6">
      <UiCard>
        <div class="flex flex-col items-center gap-4 py-12 text-center">
          <span
            class="grid size-14 place-items-center rounded-full bg-warn-50 text-warn-600"
          >
            <UiIcon name="warning" :size="26" />
          </span>
          <p class="text-[16px] font-bold text-ink-900">
            {{ t("obj.missingShort") }}
          </p>
          <p class="max-w-sm text-[13px] leading-relaxed text-ink-500">
            {{ t("obj.missingHint") }}
          </p>
          <UiButton to="/objects">
            <UiIcon name="chevronLeft" :size="16" />
            {{ t("obj.title") }}
          </UiButton>
        </div>
      </UiCard>
    </main>
  </template>

  <template v-else>
    <AppTopbar
      :title="t('obj.nav3dTitle')"
      :subtitle="t('obj.nav3dCaption', { name: building.name })"
      :breadcrumb="[
        { label: moduleTitle('objects'), to: '/objects' },
        { label: building.name, to: `/objects/${building.id}` },
        { label: t('obj.navigator3d') },
      ]"
    >
      <template #actions>
        <UiButton variant="secondary" size="sm" :to="`/objects/${building.id}`">
          <UiIcon name="doc" :size="16" />
          {{ t("obj.passport") }}
        </UiButton>
        <UiButton size="sm" :to="planLink">
          <UiIcon name="layers" :size="16" />
          {{ t("obj.floorPlan") }}
        </UiButton>
      </template>
    </AppTopbar>

    <main class="scroll-slim flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
      <UiCard flush :padded="false">
        <div
          class="grid gap-5 p-5 sm:grid-cols-[minmax(0,240px)_minmax(0,1fr)]"
        >
          <UiPhoto
            :name="building.photo"
            :alt="building.name"
            ratio="aspect-[16/10]"
            sizes="(max-width: 640px) 100vw, 240px"
            eager
          >
            <span
              class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-900/80 via-ink-900/20 to-transparent px-3 py-2 text-[12px] font-semibold text-white"
            >
              {{ t("unitOf.yearNo", { year: building.buildYear }) }} ·
              {{ buildingTypeLabel(building.type) }}
            </span>
          </UiPhoto>

          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <h2
                class="min-w-0 truncate text-[22px] font-bold text-ink-900 sm:text-[22px]"
              >
                {{ building.name }}
              </h2>
              <span
                class="rounded-pill bg-brand-50 px-2.5 py-0.5 text-[12px] font-semibold text-brand-700 ring-1 ring-inset ring-brand-200"
              >
                {{ building.buildingClass }}
              </span>
            </div>
            <p
              class="mt-1.5 flex items-center gap-1.5 text-[13px] text-ink-500"
            >
              <UiIcon name="location" :size="15" class="shrink-0" />
              <span class="min-w-0 truncate">
                {{ building.city }}, {{ building.district }},
                {{ building.street }}
              </span>
            </p>

            <div
              v-if="buildingStats"
              class="mt-4 grid grid-cols-2 gap-2.5 xl:grid-cols-4"
            >
              <div
                v-for="k in buildingStats"
                :key="k.label"
                class="min-w-0 rounded-field bg-surface-sunken px-3 py-2.5 ring-1 ring-inset ring-ink-200/70"
              >
                <span class="flex items-start justify-between gap-2">
                  <span class="min-w-0">
                    <span
                      class="block truncate text-[11px] font-semibold uppercase tracking-wide text-ink-500"
                    >
                      {{ k.label }}
                    </span>
                    <span
                      class="tabular mt-1.5 block truncate text-[18px] font-bold leading-none text-ink-900"
                    >
                      {{ k.value }}
                    </span>
                  </span>
                  <span
                    class="grid size-7 shrink-0 place-items-center rounded-[8px]"
                    :class="k.tone"
                  >
                    <UiIcon :name="k.icon" :size="15" />
                  </span>
                </span>
                <p class="mt-2 truncate text-[12px] text-ink-500">
                  {{ k.note }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </UiCard>

      <!-- Qavat tanlash navigatorning o‘zidagi relsda: bitta boshqaruv,
           ikkita ro‘yxat emas -->
      <section class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_336px]">
        <UiCard
          :title="t('obj.volumeView')"
          :subtitle="
            t('obj.volumeCaption', {
              floors: building.undergroundFloors
                ? t('obj.floorsWithUnder', {
                    floors: building.floors,
                    under: building.undergroundFloors,
                  })
                : t('obj.floorsOf', { n: building.floors }),
              plans: floorsWithPlan.length,
            })
          "
          flush
          :padded="false"
        >
          <div class="px-4 pb-5 sm:px-5">
            <!--
              Sahnada yoki yon lentada qavat bosilsa, darhol o'sha qavatning
              ichi ochiladi. Ilgari qavat faqat ajratilardi va foydalanuvchi
              «Interyer» tugmasini alohida qidirishi kerak edi.
            -->
            <UiBuilding3D
              :floor="selectedFloor"
              @update:floor="openFloor"
              v-model:unit="selectedUnit"
              v-model:mode="viewMode"
              v-model:structure="selectedStructure"
              :building="building"
            />
          </div>
        </UiCard>

        <div class="min-w-0 space-y-5">
          <!-- Uchastka tarkibi: qurilma bosilsa navigatorda ham tanlanadi -->
          <UiCard
            v-if="siteStructures.length"
            :title="t('obj.siteComposition')"
            :subtitle="t('obj.structuresOf', { n: siteStructures.length })"
            flush
          >
            <ul class="space-y-1.5">
              <li v-for="st in siteStructures" :key="st.id">
                <button
                  type="button"
                  class="flex w-full items-center gap-2.5 rounded-field px-2.5 py-2 text-left ring-1 ring-inset transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                  :class="
                    st.id === selectedStructure
                      ? 'bg-brand-50 ring-brand-300'
                      : 'ring-ink-200 hover:bg-ink-50'
                  "
                  :aria-pressed="st.id === selectedStructure"
                  @click="selectedStructure = st.id"
                >
                  <span
                    class="size-2.5 shrink-0 rounded-full"
                    :class="st.leasable ? 'bg-brand-500' : 'bg-ink-300'"
                  />
                  <span class="min-w-0 flex-1">
                    <span
                      class="block truncate text-[13px] font-semibold text-ink-900"
                    >
                      {{ st.name }}
                    </span>
                    <span class="block truncate text-[12px] text-ink-500">
                      {{ st.kind }} · {{ st.size }}
                    </span>
                  </span>
                  <span
                    class="tabular shrink-0 text-[12px] font-semibold text-ink-600"
                  >
                    {{ st.note }}
                  </span>
                </button>
              </li>
            </ul>
          </UiCard>

          <UiCard class="hidden lg:block" :title="t('obj.statusLegend')" flush>
            <ul class="space-y-2">
              <li
                v-for="c in legend"
                :key="c.key"
                class="flex items-center gap-2.5 text-[13px] text-ink-700"
              >
                <span
                  class="size-3 shrink-0 rounded-full ring-1 ring-inset ring-ink-900/10"
                  :style="{ background: c.color }"
                />
                <span class="min-w-0 flex-1 truncate font-medium">{{
                  c.label
                }}</span>
                <span
                  class="tabular shrink-0 rounded-pill bg-ink-100 px-2 py-0.5 text-[12px] font-semibold text-ink-700"
                >
                  {{ c.count }}
                </span>
              </li>
            </ul>
          </UiCard>

          <UiCard v-if="currentFloor" :title="t('obj.selectedFloor')" flush>
            <div class="flex items-center justify-between gap-3">
              <p
                class="tabular min-w-0 truncate text-[22px] font-bold text-ink-900"
              >
                {{ currentFloor.name }}
              </p>
              <span
                class="shrink-0 rounded-pill px-2.5 py-1 text-[12px] font-semibold ring-1 ring-inset"
                :class="
                  currentFloor.total
                    ? 'bg-ok-50 text-ok-700 ring-ok-100'
                    : 'bg-ink-100 text-ink-600 ring-ink-200'
                "
              >
                {{
                  currentFloor.total
                    ? t("obj.vacantPct", { n: currentFloor.vacantShare })
                    : currentFloor.label
                }}
              </span>
            </div>

            <dl class="mt-4 divide-y divide-ink-100">
              <div class="flex items-center justify-between gap-4 py-2.5">
                <dt class="text-[13px] text-ink-500">
                  {{ field("totalArea") }}
                </dt>
                <dd class="tabular text-[13px] font-bold text-ink-900">
                  {{ currentFloor.total ? area(currentFloor.totalArea) : "-" }}
                </dd>
              </div>
              <div class="flex items-center justify-between gap-4 py-2.5">
                <dt class="text-[13px] text-ink-500">
                  {{ t("kpi.vacantArea") }}
                </dt>
                <dd class="tabular text-[13px] font-bold text-ok-600">
                  {{ currentFloor.total ? area(currentFloor.vacantArea) : "-" }}
                </dd>
              </div>
              <div class="flex items-center justify-between gap-4 py-2.5">
                <dt class="text-[13px] text-ink-500">
                  {{ t("kpi.unitCount") }}
                </dt>
                <dd class="tabular text-[13px] font-bold text-ink-900">
                  {{ currentFloor.total }} {{ t("unitOf.pcs") }}
                </dd>
              </div>
            </dl>

            <UiButton block class="mt-4" :to="planLink">
              <UiIcon name="send" :size="16" />
              {{ t("obj.goToFloor") }}
            </UiButton>
          </UiCard>

          <UiCard
            :title="
              currentFloor
                ? t('obj.floorUnitsTitle', { floor: currentFloor.name })
                : field('units')
            "
            :subtitle="
              currentFloor && currentFloor.total
                ? t('obj.pickUnitHint')
                : t('obj.noUnitsOnFloor')
            "
          >
            <div v-if="currentFloor && currentFloor.total" class="space-y-1.5">
              <button
                v-for="u in currentFloor.units"
                :key="u.id"
                type="button"
                class="flex w-full items-center gap-3 rounded-field px-3 py-2.5 text-left ring-1 ring-inset transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                :class="
                  u.id === selectedUnit
                    ? 'bg-brand-50 ring-brand-300'
                    : 'ring-ink-200 hover:bg-ink-50'
                "
                :aria-pressed="u.id === selectedUnit"
                @click="selectedUnit = u.id === selectedUnit ? '' : u.id"
              >
                <span class="min-w-0 flex-1">
                  <span
                    class="tabular block truncate text-[13px] font-bold text-ink-900"
                  >
                    {{ u.code }}
                  </span>
                  <span
                    class="tabular mt-0.5 block truncate text-[12px] text-ink-500"
                  >
                    {{ area(u.area) }} · {{ unitUsageLabel(u.usage) }} ·
                    {{ t("obj.roomsOf", { n: u.rooms }) }}
                  </span>
                </span>
                <UiStatus kind="unit" :value="u.status" size="sm" />
              </button>
            </div>

            <div
              v-else
              class="flex flex-col items-center gap-3 py-8 text-center"
            >
              <span
                class="grid size-12 place-items-center rounded-full bg-ink-100 text-ink-500"
              >
                <UiIcon name="box" :size="22" />
              </span>
              <p class="text-[13px] text-ink-500">
                {{ t("obj.noUnitsLevel") }}
              </p>
              <div
                v-if="floorsWithPlan.length"
                class="flex flex-wrap justify-center gap-1.5"
              >
                <button
                  v-for="f in floorsWithPlan"
                  :key="f.floor"
                  type="button"
                  class="rounded-pill bg-brand-50 px-3 py-1.5 text-[12px] font-semibold text-brand-700 transition-colors hover:bg-brand-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                  @click="openFloor(f.floor)"
                >
                  {{ f.name }} · {{ f.total }}
                </button>
              </div>
            </div>
          </UiCard>

          <UiCard
            v-if="currentUnit"
            :title="t('obj.unitOf', { code: currentUnit.code })"
            :subtitle="`${currentFloor?.name} · ${building.name}`"
            icon="box"
            tone="info"
          >
            <UiStatus kind="unit" :value="currentUnit.status" />

            <dl class="mt-4 divide-y divide-ink-100">
              <div class="flex items-start gap-4 py-2.5">
                <dt class="w-[112px] shrink-0 text-[13px] text-ink-500">
                  {{ field("area") }}
                </dt>
                <dd
                  class="tabular min-w-0 flex-1 text-[13px] font-bold text-ink-900"
                >
                  {{ area(currentUnit.area) }}
                </dd>
              </div>
              <div class="flex items-start gap-4 py-2.5">
                <dt class="w-[112px] shrink-0 text-[13px] text-ink-500">
                  {{ field("type") }}
                </dt>
                <dd
                  class="min-w-0 flex-1 text-[13px] font-semibold text-ink-900"
                >
                  {{ unitUsageLabel(currentUnit.usage) }} ·
                  {{ t("obj.roomsOf", { n: currentUnit.rooms }) }} ·
                  {{ offerLabel(currentUnit.offer) }}
                </dd>
              </div>
              <div v-if="showFinance" class="flex items-start gap-4 py-2.5">
                <dt class="w-[112px] shrink-0 text-[13px] text-ink-500">
                  {{ field("tenant") }}
                </dt>
                <dd
                  class="min-w-0 flex-1 text-[13px] font-semibold text-ink-900"
                >
                  {{ currentUnit.tenant ?? "-" }}
                </dd>
              </div>
              <div v-if="showFinance" class="flex items-start gap-4 py-2.5">
                <dt class="w-[112px] shrink-0 text-[13px] text-ink-500">
                  {{ field("price") }}
                </dt>
                <dd
                  class="tabular min-w-0 flex-1 text-[13px] font-bold text-brand-600"
                >
                  {{ num(currentUnit.price) }}
                  {{ priceUnitLabel(currentUnit.priceUnit) }}
                </dd>
              </div>
              <div v-if="showFinance" class="flex items-start gap-4 py-2.5">
                <dt class="w-[112px] shrink-0 text-[13px] text-ink-500">
                  {{ field("contract") }}
                </dt>
                <dd
                  class="min-w-0 flex-1 text-[13px] font-semibold text-ink-800"
                >
                  {{ contractLabel(currentUnit) }}
                </dd>
              </div>
            </dl>

            <div class="mt-4 flex flex-wrap gap-1.5">
              <span
                v-for="e in currentUnit.equipment"
                :key="e"
                class="rounded-pill bg-ink-100 px-2.5 py-1 text-[12px] font-medium text-ink-700"
              >
                {{ e }}
              </span>
            </div>

            <UiButton
              v-if="currentUnit.status === 'VACANT' && leadAction !== 'none'"
              block
              class="mt-4"
              @click="goApply"
            >
              <UiIcon name="send" :size="16" />
              {{ leadLabel }}
            </UiButton>
            <p
              v-else-if="currentUnit.status === 'VACANT' && staffHint"
              class="mt-4 text-[12px] leading-relaxed text-ink-500"
            >
              {{ staffHint }}
            </p>

            <UiButton
              block
              class="mt-2"
              :variant="
                currentUnit.status === 'VACANT' ? 'secondary' : 'primary'
              "
              :to="planLink"
            >
              <UiIcon name="arrowRight" :size="16" />
              {{ t("obj.openIn2d") }}
            </UiButton>
          </UiCard>

          <UiCard
            v-else
            :title="t('obj.unitCard')"
            :subtitle="t('obj.pickUnitDetail')"
          >
            <div class="flex flex-col items-center gap-3 py-8 text-center">
              <span
                class="grid size-12 place-items-center rounded-full bg-brand-50 text-brand-600"
              >
                <UiIcon name="cube" :size="22" />
              </span>
              <p class="text-[13px] text-ink-500">
                {{ t("obj.pickUnitText") }}
              </p>
            </div>
          </UiCard>
        </div>
      </section>
    </main>
  </template>
</template>
