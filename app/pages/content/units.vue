<script setup lang="ts">
import { BUILDINGS } from "~/data/buildings";
import { UNITS, type Unit } from "~/data/units";
import { area, num, percent } from "~/utils/format";

type UnitRow = {
  id: string;
  code: string;
  buildingId: string;
  buildingName: string;
  floor: number;
  floorName: string;
  area: number;
  usage: string;
  status: string;
  hasPlan: boolean;
  pct: number;
  missing: string;
};

const auth = useAuthStore();
const route = useRoute();
const { t } = useI18n();
const {
  columns: labelColumns,
  field,
  floorLabel,
  statusLabel,
  statusOptions,
  unitUsageLabel,
  unitUsageOptions,
  tr,
  unitOf,
} = useAppLabels();

const canEdit = computed(() => auth.can("unit.editContent"));
const scoped = computed(() => BUILDINGS.filter((b) => auth.inScope(b.id)));

/**
 * Foydalanish turi, taklif turi va jihoz nomi ma’lumotda o‘zbekcha qiymat
 * sifatida saqlanadi. Qiymatning o‘zi o‘zgarmaydi (filtr va solishtirish
 * ishlashda qoladi), faqat ko‘rinadigan nom tarjima kalitiga bog‘lanadi.
 */
const OFFER_KEY: Record<string, string> = {
  Ijara: "unitOffer.rent",
  Sotuv: "unitOffer.sale",
  Ikkalasi: "unitOffer.both",
};

const EQUIPMENT_KEY: Record<string, string> = {
  Konditsioner: "equipment.airConditioner",
  "Markaziy konditsioner": "equipment.centralAc",
  "Yong‘in datchigi": "equipment.fireDetector",
  "Yong‘in signalizatsiyasi": "equipment.fireAlarm",
  "Yong‘in gidranti": "equipment.fireHydrant",
  "Yong‘in o‘chirish tizimi": "equipment.fireSuppression",
  "Internet chiqishi": "equipment.internetOutlet",
  "Optik internet": "equipment.fiberInternet",
  Serverxona: "equipment.serverRoom",
  "Alohida serverxona": "equipment.serverRoomSeparate",
  "Alohida sanuzel": "equipment.restroomSeparate",
  "Ikkita sanuzel": "equipment.restroomTwo",
  Oshxona: "equipment.kitchen",
  "Yuk platformasi": "equipment.loadingDock",
  "Yuk lifti": "equipment.freightElevator",
  "Yuk eshigi": "equipment.freightDoor",
  Rampa: "equipment.ramp",
  Kran: "equipment.crane",
  "Kran yo‘nalishi": "equipment.craneRunway",
  Balkon: "equipment.balcony",
  "Elektr shchiti": "equipment.electricalPanel",
  "Issiqlik punkti": "equipment.heatingPoint",
  "Kirish domofoni": "equipment.intercom",
  "Konferens zal": "equipment.conferenceHall",
  "Ombor xonasi": "equipment.storageRoom",
  "Suv nasosi": "equipment.waterPump",
  Ventilyatsiya: "equipment.ventilation",
  Videokuzatuv: "equipment.cctv",
  Vitrina: "equipment.showcase",
  "Vitrina yoritgichi": "equipment.showcaseLighting",
};

function offerLabel(value: string) {
  return value ? tr(OFFER_KEY[value], value) : "";
}

function equipLabel(value: string) {
  return tr(EQUIPMENT_KEY[value], value);
}

const USAGE_OPTIONS = computed(() => unitUsageOptions());

const OFFER_OPTIONS = computed(() =>
  Object.keys(OFFER_KEY).map((value) => ({ value, label: offerLabel(value) })),
);

const STATUS_KEYS = [
  "DRAFT",
  "VACANT",
  "RESERVED",
  "RENTED",
  "SOLD",
  "MAINTENANCE",
  "HIDDEN",
];
const STATUS_OPTIONS = computed(() => statusOptions("unit", STATUS_KEYS));

const EQUIPMENT_LIBRARY = [
  "Konditsioner",
  "Yong‘in datchigi",
  "Internet chiqishi",
  "Serverxona",
  "Alohida sanuzel",
  "Oshxona",
  "Yuk platformasi",
];

const CHECKS: Array<{
  key: string;
  labelKey: string;
  ok: (u: Unit) => boolean;
}> = [
  {
    key: "code",
    labelKey: "field.unitCode",
    ok: (u) => Boolean(u.code.trim()),
  },
  { key: "rooms", labelKey: "field.rooms", ok: (u) => u.rooms > 0 },
  { key: "area", labelKey: "field.area", ok: (u) => u.area > 0 },
  { key: "usage", labelKey: "field.usage", ok: (u) => Boolean(u.usage) },
  { key: "offer", labelKey: "field.offer", ok: (u) => Boolean(u.offer) },
  {
    key: "status",
    labelKey: "field.status",
    ok: (u) => Boolean(u.status) && u.status !== "DRAFT",
  },
  {
    key: "equipment",
    labelKey: "field.equipmentList",
    ok: (u) => u.equipment.length > 0,
  },
  {
    key: "polygon",
    labelKey: "field.polygon2d",
    ok: (u) => u.polygon.length >= 3,
  },
];

/**
 * Sahifa umumiy unit reyestrini tahrirlaydi, nusxasini emas: saqlangan
 * atribut obyekt kartasida, katalogda, qavat rejasida va 3D ko‘rinishda
 * darhol o‘zgaradi va sahifa almashganda ham saqlanib qoladi.
 */
const units = computed(() => UNITS.filter((u) => auth.inScope(u.buildingId)));

function floorName(value: number) {
  return value === 0 ? t("unitOf.basementTechnical") : floorLabel(value);
}

function passedChecks(u: Unit) {
  return CHECKS.filter((c) => c.ok(u));
}

function completeness(u: Unit) {
  return Math.round((passedChecks(u).length / CHECKS.length) * 100);
}

function buildingName(id: string) {
  return BUILDINGS.find((b) => b.id === id)?.name ?? id;
}

const initialBuilding = String(route.query.building ?? "");
const initialFloor = String(route.query.floor ?? "");

const query = ref("");
const fBuilding = ref(
  scoped.value.some((b) => b.id === initialBuilding) ? initialBuilding : "all",
);
const fFloor = ref(
  units.value.some((u) => String(u.floor) === initialFloor)
    ? initialFloor
    : "all",
);
const fState = ref("all");

const selectedIds = ref<string[]>([]);
const panelId = ref("");
const bulkOpen = ref(false);
const bulkStatus = ref("VACANT");
const notice = ref("");
const formError = ref("");
const equipInput = ref("");

const rows = computed<UnitRow[]>(() =>
  units.value.map((u) => {
    const missing = CHECKS.filter((c) => !c.ok(u)).map((c) => t(c.labelKey));
    return {
      id: u.id,
      code: u.code,
      buildingId: u.buildingId,
      buildingName: buildingName(u.buildingId),
      floor: u.floor,
      floorName: floorName(u.floor),
      area: u.area,
      usage: u.usage,
      status: u.status,
      hasPlan: u.polygon.length >= 3,
      pct: completeness(u),
      missing: missing.join(", "),
    };
  }),
);

const buildingOptions = computed(() => [
  { value: "all", label: t("filter.allBuildings") },
  ...scoped.value.map((b) => ({ value: b.id, label: b.name })),
]);

const floorOptions = computed(() => {
  const list = units.value.filter(
    (u) => fBuilding.value === "all" || u.buildingId === fBuilding.value,
  );
  const levels = Array.from(new Set(list.map((u) => u.floor))).sort(
    (a, b) => b - a,
  );
  return [
    { value: "all", label: t("filter.allFloors") },
    ...levels.map((l) => ({ value: String(l), label: floorName(l) })),
  ];
});

const stateOptions = computed(() => {
  const done = rows.value.filter((r) => r.pct === 100).length;
  return [
    {
      value: "all",
      label: t("tab.withCount", {
        label: t("tab.all"),
        count: rows.value.length,
      }),
    },
    {
      value: "done",
      label: t("tab.withCount", { label: t("tab.complete"), count: done }),
    },
    {
      value: "incomplete",
      label: t("tab.withCount", {
        label: t("tab.incomplete"),
        count: rows.value.length - done,
      }),
    },
  ];
});

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();

  return rows.value.filter((r) => {
    if (fBuilding.value !== "all" && r.buildingId !== fBuilding.value)
      return false;
    if (fFloor.value !== "all" && String(r.floor) !== fFloor.value)
      return false;
    if (fState.value === "done" && r.pct !== 100) return false;
    if (fState.value === "incomplete" && r.pct === 100) return false;
    if (q) {
      const haystack =
        `${r.code} ${r.buildingName} ${r.floorName} ${r.usage}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
});

watch([fBuilding, fFloor, fState, query], () => {
  const visible = new Set(filtered.value.map((r) => r.id));
  selectedIds.value = selectedIds.value.filter((id) => visible.has(id));
});

watch(fBuilding, () => {
  if (!floorOptions.value.some((o) => o.value === fFloor.value))
    fFloor.value = "all";
});

const kpi = computed(() => {
  const list = rows.value;
  const withPlan = list.filter((r) => r.hasPlan).length;
  const full = list.filter((r) => r.pct === 100).length;
  const avg = list.length
    ? Math.round(list.reduce((s, r) => s + r.pct, 0) / list.length)
    : 0;
  return { total: list.length, withPlan, full, avg };
});

const dirty = computed(
  () =>
    Boolean(query.value.trim()) ||
    fBuilding.value !== "all" ||
    fFloor.value !== "all" ||
    fState.value !== "all",
);

const allVisibleSelected = computed(
  () =>
    filtered.value.length > 0 &&
    filtered.value.every((r) => selectedIds.value.includes(r.id)),
);

const columns = computed(() => {
  const base = labelColumns([
    { key: "code", field: "code", label: "Kodi", width: "110px" },
    { key: "buildingName", field: "building", label: "Bino", width: "210px" },
    { key: "floorName", field: "floor", label: "Qavat", width: "140px" },
    {
      key: "area",
      field: "area",
      label: "Maydoni",
      align: "right",
      numeric: true,
      width: "130px",
    },
    { key: "usage", field: "usage", label: "Foydalanish", width: "140px" },
    { key: "status", field: "status", label: "Holat", width: "150px" },
    { key: "hasPlan", field: "polygon", label: "Poligon", width: "120px" },
    {
      key: "pct",
      field: "attributeCompleteness",
      label: "Atribut to‘liqligi",
      width: "200px",
    },
  ]);
  const select = labelColumns([
    {
      key: "sel",
      field: "selection",
      label: "Tanlov",
      align: "center",
      width: "72px",
    },
  ]);
  return canEdit.value ? [...select, ...base] : base;
});

const panelUnit = computed(() =>
  units.value.find((u) => u.id === panelId.value),
);

const form = reactive({
  code: "",
  rooms: "",
  area: "",
  usage: "",
  offer: "",
  status: "",
});

const equipment = ref<string[]>([]);

function fillForm() {
  const u = panelUnit.value;
  formError.value = "";
  equipInput.value = "";
  if (!u) return;
  Object.assign(form, {
    code: u.code,
    rooms: String(u.rooms),
    area: String(u.area),
    usage: u.usage,
    offer: u.offer,
    status: u.status,
  });
  equipment.value = [...u.equipment];
}

function openUnit(id: string) {
  panelId.value = id;
  fillForm();
}

function openPanel(row: UnitRow) {
  openUnit(row.id);
}

function closePanel() {
  panelId.value = "";
}

onKeyStroke("Escape", () => {
  if (panelId.value) panelId.value = "";
});

const panelShapes = computed(() => {
  const u = panelUnit.value;
  if (!u) return [];
  return units.value
    .filter((x) => x.buildingId === u.buildingId && x.floor === u.floor)
    .map((x) => ({
      id: x.id,
      code: x.code,
      active: x.id === u.id,
      points: x.polygon
        .map(
          (p) =>
            `${((p[0] ?? 0) * 100).toFixed(2)},${((p[1] ?? 0) * 100).toFixed(2)}`,
        )
        .join(" "),
    }));
});

const panelChecks = computed(() => {
  const u = panelUnit.value;
  if (!u) return [];
  return CHECKS.map((c) => ({
    key: c.key,
    label: t(c.labelKey),
    done: c.ok(u),
  }));
});

function toggleSelect(id: string) {
  selectedIds.value = selectedIds.value.includes(id)
    ? selectedIds.value.filter((x) => x !== id)
    : [...selectedIds.value, id];
}

function toggleAllVisible() {
  if (allVisibleSelected.value) {
    const visible = new Set(filtered.value.map((r) => r.id));
    selectedIds.value = selectedIds.value.filter((id) => !visible.has(id));
    return;
  }
  const merged = new Set(selectedIds.value);
  filtered.value.forEach((r) => merged.add(r.id));
  selectedIds.value = Array.from(merged);
}

function addEquipment(value?: string) {
  const name = (value ?? equipInput.value).trim();
  if (!name || equipment.value.includes(name)) {
    equipInput.value = "";
    return;
  }
  equipment.value = [...equipment.value, name];
  equipInput.value = "";
}

function removeEquipment(name: string) {
  equipment.value = equipment.value.filter((e) => e !== name);
}

function saveUnit() {
  const u = panelUnit.value;
  if (!canEdit.value || !u) return;

  const code = form.code.trim();
  const areaValue = Number(form.area);
  const roomsValue = Number(form.rooms);

  if (!code) {
    formError.value = t("cnt.errCodeRequired");
    return;
  }
  if (!Number.isFinite(areaValue) || areaValue <= 0) {
    formError.value = t("cnt.errAreaPositive");
    return;
  }

  // Qiymatlar tanlov ro‘yxatlaridan keladi, shuning uchun tur aniqlashtiriladi
  u.code = code;
  u.rooms = Number.isFinite(roomsValue)
    ? Math.max(0, Math.round(roomsValue))
    : 0;
  u.area = Math.round(areaValue * 100) / 100;
  u.usage = form.usage as Unit["usage"];
  u.offer = form.offer as Unit["offer"];
  u.status = (form.status || "DRAFT") as Unit["status"];
  u.equipment = [...equipment.value];

  formError.value = "";
  notice.value = t("cnt.noticeUnitUpdated", {
    code: u.code,
    pct: percent(completeness(u)),
  });
}

function applyBulk() {
  if (!canEdit.value) return;
  const label = statusLabel("unit", bulkStatus.value);
  const count = selectedIds.value.length;
  units.value.forEach((u) => {
    if (selectedIds.value.includes(u.id))
      u.status = bulkStatus.value as Unit["status"];
  });
  notice.value = t("cnt.noticeBulkApplied", { count, status: label });
  selectedIds.value = [];
  bulkOpen.value = false;
}

function resetFilters() {
  query.value = "";
  fBuilding.value = "all";
  fFloor.value = "all";
  fState.value = "all";
}

function toneOf(pct: number) {
  if (pct === 100) return "bg-ok-500";
  if (pct >= 60) return "bg-warn-500";
  return "bg-danger-500";
}
</script>

<template>
  <AppTopbar
    :title="t('nav.unitAttributes')"
    :subtitle="t('cnt.unitAttributesCaption')"
    :breadcrumb="[
      { label: t('nav.contentQueue'), to: '/content' },
      { label: t('nav.unitAttributes') },
    ]"
  >
    <template #actions>
      <UiButton variant="secondary" size="sm" to="/content/floors">
        <UiIcon name="layers" :size="16" />
        {{ t("nav.floors") }}
      </UiButton>
      <UiButton
        v-if="canEdit"
        size="sm"
        :disabled="!selectedIds.length"
        @click="bulkOpen = true"
      >
        <UiIcon name="check" :size="16" />
        {{ t("cnt.markSelected") }}
        <span v-if="selectedIds.length" class="tabular"
          >({{ selectedIds.length }})</span
        >
      </UiButton>
    </template>
  </AppTopbar>

  <main class="scroll-slim flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
    <div
      v-if="notice"
      class="flex items-start gap-3 rounded-card bg-ok-50 px-4 py-3.5 ring-1 ring-inset ring-ok-100"
    >
      <UiIcon name="check" :size="18" class="mt-0.5 shrink-0 text-ok-600" />
      <p class="min-w-0 flex-1 text-[13px] font-medium text-ok-700">
        {{ notice }}
      </p>
      <button
        type="button"
        class="shrink-0 rounded-[8px] p-1 text-ok-600 transition-colors hover:bg-ok-100"
        :aria-label="t('common.closeNotice')"
        @click="notice = ''"
      >
        <UiIcon name="x" :size="15" />
      </button>
    </div>

    <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <UiKpi
        :label="t('kpi.unitsInScope')"
        :value="num(kpi.total)"
        :unit="unitOf('pcs', 'ta')"
        icon="box"
        tone="brand"
      />
      <UiKpi
        :label="t('kpi.linkedToPolygon')"
        :value="num(kpi.withPlan)"
        :unit="unitOf('pcs', 'ta')"
        icon="layers"
        tone="violet"
      />
      <UiKpi
        :label="t('kpi.attributesComplete')"
        :value="num(kpi.full)"
        :unit="unitOf('pcs', 'ta')"
        icon="check"
        tone="ok"
      />
      <UiKpi
        :label="t('kpi.averageCompleteness')"
        :value="percent(kpi.avg)"
        icon="chart"
        tone="warn"
      />
    </section>

    <UiCard
      :title="t('cnt.unitsTableTitle')"
      :subtitle="t('cnt.unitsTableCaption')"
      flush
      :padded="false"
    >
      <template #actions>
        <span class="tabular hidden text-[12px] text-ink-500 sm:inline">
          {{ filtered.length }} / {{ kpi.total }}
        </span>
      </template>

      <div class="flex flex-wrap items-center gap-3 px-4 pb-4 lg:px-5">
        <UiInput
          v-model="query"
          :placeholder="t('cnt.searchUnits')"
          class="min-w-[190px] flex-1"
        >
          <template #prefix>
            <UiIcon name="search" :size="17" />
          </template>
        </UiInput>

        <UiSelect
          v-model="fBuilding"
          :options="buildingOptions"
          class="w-full sm:w-52"
        />
        <UiSelect
          v-model="fFloor"
          :options="floorOptions"
          class="w-full sm:w-44"
        />
        <UiSelect
          v-model="fState"
          :options="stateOptions"
          class="w-full sm:w-48"
        />

        <UiButton variant="ghost" :disabled="!dirty" @click="resetFilters">
          <UiIcon name="refresh" :size="15" />
          {{ t("common.reset") }}
        </UiButton>
      </div>

      <div
        v-if="canEdit"
        class="flex flex-wrap items-center gap-3 border-t border-ink-100 bg-surface-sunken px-4 py-3 lg:px-5"
      >
        <UiButton
          variant="secondary"
          size="sm"
          :disabled="!filtered.length"
          @click="toggleAllVisible"
        >
          <UiIcon :name="allVisibleSelected ? 'x' : 'check'" :size="15" />
          {{
            allVisibleSelected
              ? t("common.deselect")
              : t("common.selectVisible")
          }}
        </UiButton>
        <span class="text-[13px] text-ink-500">
          {{ t("cnt.selectedLabel") }}
          <b class="tabular text-ink-800">{{ selectedIds.length }}</b>
          {{ t("cnt.unitsSuffix") }}
        </span>
        <UiButton
          v-if="selectedIds.length"
          size="sm"
          class="ml-auto"
          @click="bulkOpen = true"
        >
          <UiIcon name="check" :size="15" />
          {{ t("cnt.markStatus") }}
        </UiButton>
      </div>

      <UiTable
        :page-size="12"
        :columns="columns"
        :rows="filtered"
        :empty="t('empty.noMatchingUnits')"
        @row-click="openPanel"
      >
        <template #cell-sel="{ row }">
          <span class="inline-flex p-1" @click.stop>
            <input
              type="checkbox"
              class="size-4 cursor-pointer accent-brand-500"
              :checked="selectedIds.includes(row.id)"
              :aria-label="t('cnt.selectUnitAria', { code: row.code })"
              @change="toggleSelect(row.id)"
            />
          </span>
        </template>

        <template #cell-code="{ row }">
          <span class="tabular text-[13px] font-bold text-brand-600">{{
            row.code
          }}</span>
        </template>

        <template #cell-buildingName="{ row }">
          <span class="block truncate text-[13px] font-semibold text-ink-800">
            {{ row.buildingName }}
          </span>
        </template>

        <template #cell-floorName="{ row }">
          <span class="text-[13px] text-ink-600">{{ row.floorName }}</span>
        </template>

        <template #cell-area="{ row }">
          <span
            class="tabular"
            :class="row.area > 0 ? 'text-ink-900' : 'text-ink-400'"
          >
            {{ row.area > 0 ? area(row.area) : t("common.notEntered") }}
          </span>
        </template>

        <template #cell-usage="{ row }">
          <span v-if="row.usage" class="text-[13px] text-ink-700">{{
            unitUsageLabel(row.usage)
          }}</span>
          <span v-else class="text-[13px] text-ink-400">{{
            t("common.notEntered")
          }}</span>
        </template>

        <template #cell-status="{ row }">
          <UiStatus kind="unit" :value="row.status" size="sm" />
        </template>

        <template #cell-hasPlan="{ row }">
          <span
            class="inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-[12px] font-semibold ring-1 ring-inset"
            :class="
              row.hasPlan
                ? 'bg-ok-50 text-ok-700 ring-ok-100'
                : 'bg-warn-50 text-warn-700 ring-warn-100'
            "
          >
            <UiIcon :name="row.hasPlan ? 'check' : 'clock'" :size="13" />
            {{ row.hasPlan ? t("common.present") : t("common.no") }}
          </span>
        </template>

        <template #cell-pct="{ row }">
          <span
            class="flex items-center gap-2.5"
            :title="
              row.missing
                ? t('cnt.missingHint', { list: row.missing })
                : t('cnt.allAttrsFilled')
            "
          >
            <span
              class="block h-1.5 w-24 shrink-0 overflow-hidden rounded-pill bg-ink-100"
            >
              <span
                class="block h-full rounded-pill"
                :class="toneOf(row.pct)"
                :style="{ width: `${row.pct}%` }"
              />
            </span>
            <span class="tabular text-[13px] font-bold text-ink-800">{{
              percent(row.pct)
            }}</span>
          </span>
        </template>
      </UiTable>

      <div
        class="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 px-4 py-4 lg:px-5"
      >
        <p class="text-[13px] text-ink-500">
          {{ t("cnt.shownLabel") }}
          <b class="text-ink-800">{{ filtered.length }}</b>
          {{ t("cnt.unitsSuffix") }} ·
          <span class="tabular text-ok-600">{{ kpi.full }}</span>
          {{ t("cnt.completeSuffix") }} ·
          <span class="tabular text-warn-600">{{ kpi.total - kpi.full }}</span>
          {{ t("cnt.toFillSuffix") }}
        </p>
        <UiButton variant="secondary" size="sm" to="/content">
          <UiIcon name="clipboard" :size="15" />
          {{ t("nav.contentQueue") }}
        </UiButton>
      </div>
    </UiCard>

    <UiModal
      v-model="bulkOpen"
      :title="t('cnt.bulkTitle')"
      :subtitle="t('cnt.bulkSubtitle', { count: selectedIds.length })"
    >
      <UiField :label="field('newStatus')" :hint="t('cnt.bulkHint')">
        <UiSelect v-model="bulkStatus" :options="STATUS_OPTIONS" />
      </UiField>

      <div class="mt-4">
        <p class="mb-2 text-[13px] font-semibold text-ink-700">
          {{ t("cnt.selectedUnits") }}
        </p>
        <div class="flex flex-wrap gap-1.5">
          <span
            v-for="id in selectedIds"
            :key="id"
            class="tabular rounded-pill bg-ink-100 px-2.5 py-1 text-[12px] font-semibold text-ink-700"
          >
            {{ units.find((u) => u.id === id)?.code }}
          </span>
        </div>
      </div>

      <template #footer>
        <UiButton variant="ghost" @click="bulkOpen = false">{{
          t("common.cancel")
        }}</UiButton>
        <UiButton :disabled="!selectedIds.length" @click="applyBulk">
          <UiIcon name="check" :size="16" />
          {{ t("common.mark") }}
        </UiButton>
      </template>
    </UiModal>

    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-150 ease-out"
        enter-from-class="opacity-0"
        leave-active-class="transition duration-100 ease-in"
        leave-to-class="opacity-0"
      >
        <div
          v-if="panelUnit"
          class="fixed inset-0 z-50 bg-ink-900/40 backdrop-blur-[2px]"
          @click.self="closePanel"
        >
          <Transition
            appear
            enter-active-class="transition duration-200 ease-out"
            enter-from-class="translate-x-6 opacity-0"
          >
            <aside
              class="absolute inset-y-0 right-0 flex w-full max-w-[440px] flex-col bg-surface shadow-pop"
              role="dialog"
              aria-modal="true"
              :aria-label="t('cnt.panelAria', { code: panelUnit.code })"
            >
              <header
                class="flex items-start justify-between gap-4 border-b border-ink-200 px-5 py-4"
              >
                <div class="min-w-0">
                  <h2 class="truncate text-[18px] font-bold text-ink-900">
                    {{ t("cnt.unitTitle", { code: panelUnit.code }) }}
                  </h2>
                  <p class="truncate text-[13px] text-ink-500">
                    {{ buildingName(panelUnit.buildingId) }} ·
                    {{ floorName(panelUnit.floor) }}
                  </p>
                </div>
                <button
                  type="button"
                  class="-mr-1 rounded-lg p-2 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
                  :aria-label="t('cnt.closePanel')"
                  @click="closePanel"
                >
                  <UiIcon name="x" :size="18" />
                </button>
              </header>

              <div
                class="scroll-slim flex-1 space-y-5 overflow-y-auto px-5 py-5"
              >
                <div
                  class="rounded-field bg-surface-sunken p-3 ring-1 ring-inset ring-ink-100"
                >
                  <svg
                    viewBox="0 0 100 100"
                    class="h-[150px] w-full"
                    role="img"
                    :aria-label="t('cnt.floorLocation')"
                  >
                    <rect
                      x="1.5"
                      y="3"
                      width="97"
                      height="94"
                      rx="1.2"
                      fill="#FFFFFF"
                      stroke="#E2E8F2"
                      stroke-width="0.7"
                    />
                    <polygon
                      v-for="s in panelShapes"
                      :key="s.id"
                      class="cursor-pointer"
                      :points="s.points"
                      :fill="s.active ? '#0256F7' : '#EEF2F8'"
                      :fill-opacity="s.active ? 0.35 : 1"
                      :stroke="s.active ? '#0256F7' : '#CBD4E3'"
                      :stroke-width="s.active ? 1.4 : 0.5"
                      @click="openUnit(s.id)"
                    >
                      <title>{{ s.code }}</title>
                    </polygon>
                  </svg>
                  <p class="mt-2 text-center text-[12px] text-ink-500">
                    {{ t("cnt.planHint") }}
                  </p>
                </div>

                <div>
                  <p class="mb-2 text-[13px] font-semibold text-ink-700">
                    {{ field("attributeCompleteness") }}
                  </p>
                  <ul class="grid gap-1.5 sm:grid-cols-2">
                    <li
                      v-for="c in panelChecks"
                      :key="c.key"
                      class="flex items-center gap-2 rounded-field px-2.5 py-1.5 text-[13px] ring-1 ring-inset"
                      :class="
                        c.done
                          ? 'bg-ok-50/70 text-ok-700 ring-ok-100'
                          : 'bg-danger-50/70 text-danger-700 ring-danger-100'
                      "
                    >
                      <UiIcon :name="c.done ? 'check' : 'x'" :size="14" />
                      {{ c.label }}
                    </li>
                  </ul>
                </div>

                <template v-if="canEdit">
                  <div class="grid gap-3.5 sm:grid-cols-2">
                    <UiField :label="field('unitCode')" required>
                      <UiInput
                        v-model="form.code"
                        :placeholder="t('cnt.unitCodeExample')"
                      />
                    </UiField>
                    <UiField :label="field('rooms')">
                      <UiInput
                        v-model="form.rooms"
                        type="number"
                        min="0"
                        placeholder="0"
                      />
                    </UiField>
                    <UiField
                      :label="`${field('area')}, ${unitOf('sqm', 'm²')}`"
                      required
                    >
                      <UiInput
                        v-model="form.area"
                        type="number"
                        min="0"
                        step="0.1"
                        placeholder="0.00"
                      />
                    </UiField>
                    <UiField :label="field('status')">
                      <UiSelect
                        v-model="form.status"
                        :options="STATUS_OPTIONS"
                      />
                    </UiField>
                    <UiField :label="field('usage')">
                      <UiSelect
                        v-model="form.usage"
                        :options="USAGE_OPTIONS"
                        :placeholder="t('common.notSelected')"
                      />
                    </UiField>
                    <UiField :label="field('offer')">
                      <UiSelect
                        v-model="form.offer"
                        :options="OFFER_OPTIONS"
                        :placeholder="t('common.notSelected')"
                      />
                    </UiField>
                  </div>

                  <div>
                    <p class="mb-2 text-[13px] font-semibold text-ink-700">
                      {{ field("equipment") }}
                    </p>
                    <div v-if="equipment.length" class="flex flex-wrap gap-1.5">
                      <span
                        v-for="e in equipment"
                        :key="e"
                        class="inline-flex items-center gap-1 rounded-pill bg-ink-100 py-1 pl-2.5 pr-1 text-[12px] font-medium text-ink-700"
                      >
                        {{ equipLabel(e) }}
                        <button
                          type="button"
                          class="relative grid size-5 place-items-center rounded-full text-ink-500 transition-colors after:absolute after:-inset-3 after:content-[''] hover:bg-ink-300 hover:text-ink-900 md:after:hidden"
                          :aria-label="
                            t('cnt.removeEquipmentAria', {
                              name: equipLabel(e),
                            })
                          "
                          @click="removeEquipment(e)"
                        >
                          <UiIcon name="x" :size="12" />
                        </button>
                      </span>
                    </div>
                    <p v-else class="text-[13px] text-ink-400">
                      {{ t("empty.noEquipment") }}
                    </p>

                    <div class="mt-2.5 flex gap-2">
                      <UiInput
                        v-model="equipInput"
                        :placeholder="t('cnt.equipmentPlaceholder')"
                        class="min-w-0 flex-1"
                        @keydown.enter.prevent="addEquipment()"
                      />
                      <UiButton variant="secondary" @click="addEquipment()">
                        <UiIcon name="plus" :size="15" />
                        {{ t("common.add") }}
                      </UiButton>
                    </div>

                    <div class="mt-2.5 flex flex-wrap gap-1.5">
                      <button
                        v-for="e in EQUIPMENT_LIBRARY.filter(
                          (x) => !equipment.includes(x),
                        )"
                        :key="e"
                        type="button"
                        class="rounded-pill px-2.5 py-1 text-[12px] font-medium text-ink-600 ring-1 ring-inset ring-ink-200 transition-colors hover:bg-brand-50 hover:text-brand-600"
                        @click="addEquipment(e)"
                      >
                        + {{ equipLabel(e) }}
                      </button>
                    </div>
                  </div>

                  <p
                    v-if="formError"
                    class="text-[13px] font-medium text-danger-600"
                  >
                    {{ formError }}
                  </p>
                </template>

                <div
                  v-else
                  class="flex items-start gap-2.5 rounded-field bg-ink-50 px-3.5 py-3 text-[13px] text-ink-600 ring-1 ring-inset ring-ink-200"
                >
                  <UiIcon
                    name="lock"
                    :size="16"
                    class="mt-0.5 shrink-0 text-ink-400"
                  />
                  <span>{{ t("cnt.noEditRightAttrs") }}</span>
                </div>

                <NuxtLink
                  :to="`/content/floors?building=${panelUnit.buildingId}&floor=${panelUnit.floor}`"
                  class="flex items-center gap-2 rounded-field px-3.5 py-3 text-[13px] font-semibold text-brand-600 ring-1 ring-inset ring-brand-200 transition-colors hover:bg-brand-50"
                >
                  <UiIcon name="layers" :size="16" />
                  {{ t("cnt.openInFloorPlan") }}
                  <UiIcon name="chevronRight" :size="15" class="ml-auto" />
                </NuxtLink>
              </div>

              <footer
                v-if="canEdit"
                class="flex items-center justify-end gap-3 border-t border-ink-200 bg-surface-sunken px-5 py-4"
              >
                <UiButton variant="ghost" @click="fillForm">
                  <UiIcon name="refresh" :size="15" />
                  {{ t("common.restore") }}
                </UiButton>
                <UiButton @click="saveUnit">
                  <UiIcon name="check" :size="16" />
                  {{ t("common.save") }}
                </UiButton>
              </footer>
            </aside>
          </Transition>
        </div>
      </Transition>
    </Teleport>
  </main>
</template>
