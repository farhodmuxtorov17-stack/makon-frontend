<script setup lang="ts">
import { buildingById, type Building } from "~/data/buildings";
import { unitsOfBuilding, unitsOfFloor } from "~/data/units";
import { area, num, percent, sum, todayIso } from "~/utils/format";
import { docxBlob, fileSlug, saveBlob, type DocxLine } from "~/utils/docx";

const route = useRoute();
const auth = useAuthStore();
const { t } = useI18n();
const {
  buildingTypeLabel,
  unitUsageLabel,
  money,
  moneyShort,
  field,
  columns: labelColumns,
  moduleTitle,
  tr,
} = useAppLabels();

const id = computed(() => String(route.params.id));
const nested = computed(
  () => route.path.replace(/\/+$/, "") !== `/objects/${id.value}`,
);
/**
 * Yozuv ref’da saqlanadi: reyestr massivi reaktiv emas, shuning uchun tahrirdan
 * keyin sahifa shu yerdan yangilanadi. Biriktirilmagan obyekt to‘g‘ridan-to‘g‘ri
 * havola orqali ham ochilmaydi.
 */
const building = ref<Building | undefined>();

watchEffect(() => {
  const b = buildingById(id.value);
  building.value = b && auth.inScope(b.id) ? b : undefined;
});

/** Ijara va moliya ma’lumoti faqat shu oqimda ishlaydigan rollarga ochiq */
const showFinance = computed(
  () =>
    auth.can("application.decide") ||
    auth.can("invoice.create") ||
    auth.can("contract.manage"),
);

/** Pasportni tahrirlash: texnik ma’lumot yoki tizim ma’muriyati huquqi bilan */
const canEdit = computed(
  () => auth.can("unit.editTechnical") || auth.can("system.administer"),
);

const units = computed(() =>
  building.value ? unitsOfBuilding(building.value.id) : [],
);

const editOpen = ref(false);
const pdfOpen = ref(false);
const notice = ref("");
const pdfSections = ref<string[]>(["pasport", "qavatlar", "unitlar"]);

const editForm = reactive({
  name: "",
  street: "",
  district: "",
  buildingClass: "",
  manager: "",
  managerPhone: "",
});

/** Forma modal ochilganda to‘ldiriladi, aks holda kiritilgan qiymat ustidan yoziladi */
watch(editOpen, (open) => {
  const b = building.value;
  if (!open || !b) return;
  editForm.name = b.name;
  editForm.street = b.street;
  editForm.district = b.district;
  editForm.buildingClass = b.buildingClass;
  editForm.manager = b.manager;
  editForm.managerPhone = b.managerPhone;
});

interface SpecRow {
  label: string;
  value: string;
  tone?: "ok" | "warn";
  mono?: boolean;
}

const spec = computed<SpecRow[]>(() => {
  const b = building.value;
  if (!b) return [];
  return [
    { label: field("id"), value: b.code, mono: true },
    { label: field("name"), value: b.name },
    {
      label: field("address"),
      value: t("obj.cityAddress", {
        city: b.city,
        district: b.district,
        street: b.street,
      }),
    },
    { label: field("type"), value: buildingTypeLabel(b.type) },
    { label: field("buildingClass"), value: b.buildingClass },
    {
      label: field("buildYear"),
      value: t("unitOf.yearNo", { year: b.buildYear }),
    },
    { label: field("totalArea"), value: area(b.gla) },
    {
      label: field("floorCount"),
      value: b.undergroundFloors
        ? t("obj.floorsWithUnderground", {
            floors: b.floors,
            underground: b.undergroundFloors,
          })
        : String(b.floors),
    },
    { label: t("kpi.unitCount"), value: num(b.units) },
    {
      label: field("occupiedUnits"),
      value: `${num(b.occupiedUnits)} (${percent(b.occupancy)})`,
      tone: "ok",
    },
    {
      label: field("vacantUnits"),
      value: `${num(b.vacantUnits)} (${percent(100 - b.occupancy)})`,
      tone: "warn",
    },
    { label: field("equipment"), value: b.equipment.join(", ") },
  ];
});

const floors = computed(() => {
  const b = building.value;
  if (!b) return [];
  const list = Array.from({ length: b.floors }, (_, i) => b.floors - i);
  if (b.undergroundFloors) list.push(0);
  return list.map((floor) => {
    const floorUnits = unitsOfFloor(b.id, floor);
    return {
      floor,
      label:
        floor < 0
          ? t("obj.undergroundFloorNo", { floor: -floor })
          : t("unitOf.floorNo", { floor }),
      total: floorUnits.length,
      vacant: floorUnits.filter((u) => u.status === "VACANT").length,
      area: floorUnits.reduce((s, u) => s + u.area, 0),
    };
  });
});

/** Galereyada ko‘rsatilayotgan rakurs; obyekt almashsa asosiy rasmga qaytadi */
const picked = ref("");
watch(building, () => {
  picked.value = "";
});

const activePhoto = computed({
  get: () => picked.value || building.value?.photo || "",
  set: (v: string) => {
    picked.value = v;
  },
});

const locationMarkers = computed(() =>
  building.value
    ? [
        {
          id: building.value.id,
          lat: building.value.lat,
          lon: building.value.lon,
          label: building.value.name,
          caption: `${building.value.district} · ${buildingTypeLabel(building.value.type)}`,
          value: building.value.occupancy,
          valueLabel: t("landing.occupancyValueLabel"),
          tone: "brand" as const,
        },
      ]
    : [],
);

/** Ijarachi va narx ustunlari moliya huquqi bo‘lmaganda umuman chizilmaydi */
const unitColumns = computed(() =>
  labelColumns([
    { key: "code", field: "unit", width: "110px" },
    { key: "floor", field: "floor", align: "right", numeric: true },
    { key: "areaLabel", field: "area", align: "right", numeric: true },
    { key: "usage", field: "type" },
    { key: "offer", field: "offerShort" },
    ...(showFinance.value
      ? [
          { key: "tenant", field: "tenantBuyer" },
          {
            key: "priceLabel",
            field: "price",
            align: "right" as const,
            numeric: true,
          },
        ]
      : []),
    { key: "status", field: "status", align: "center", width: "140px" },
  ]),
);

const unitRows = computed(() =>
  units.value.map((u) => ({
    id: u.id,
    code: u.code,
    floor: u.floor,
    areaLabel: area(u.area),
    usage: unitUsageLabel(u.usage),
    offer: u.offer,
    tenant: showFinance.value ? (u.tenant ?? "-") : "",
    priceLabel: showFinance.value ? `${num(u.price)} ${u.priceUnit}` : "",
    status: u.status,
  })),
);

const unitSummary = computed(() => ({
  total: units.value.length,
  vacant: units.value.filter((u) => u.status === "VACANT").length,
  area: units.value.reduce((s, u) => s + u.area, 0),
}));

function unitPath(row: Record<string, unknown>) {
  return `/objects/${id.value}/floors/${row.floor}?unit=${row.id}`;
}

function togglePdfSection(key: string) {
  const next = new Set(pdfSections.value);
  next.has(key) ? next.delete(key) : next.add(key);
  pdfSections.value = Array.from(next);
}

function submitEdit() {
  const b = building.value;
  if (!canEdit.value || !b) return;

  const name = editForm.name.trim() || b.name;
  Object.assign(b, {
    name,
    street: editForm.street.trim(),
    district: editForm.district.trim(),
    buildingClass: editForm.buildingClass.trim() || b.buildingClass,
    manager: editForm.manager.trim(),
    managerPhone: editForm.managerPhone.trim(),
  });

  notice.value = t("obj.updatedNotice", { name });
  editOpen.value = false;
}

/**
 * Pasport haqiqiy Word hujjati bo‘lib saqlanadi: faqat belgilangan bo‘limlar
 * kiritiladi, moliyaviy bo‘lim esa shu rolga ko‘rinadigan bo‘lsagina.
 */
function submitPdf() {
  const b = building.value;
  if (!b) return;
  const picked = pdfSections.value;
  const lines: DocxLine[] = [
    { text: t("obj.passportDocTitle", { name: b.name }), style: "title" },
    {
      text: `${b.code} · ${t("obj.cityAddress", { city: b.city, district: b.district, street: b.street })}`,
      style: "subtitle",
    },
  ];

  if (picked.includes("pasport")) {
    lines.push({ text: t("obj.sectionMain"), style: "heading" });
    lines.push(
      ...spec.value.map((r) => ({
        text: `${r.label}: ${r.value}`,
        style: "body" as const,
      })),
    );
  }

  if (picked.includes("qavatlar")) {
    lines.push({ text: t("obj.floorList"), style: "heading" });
    lines.push(
      ...floors.value.map((f) => ({
        text: t("obj.floorLine", {
          floor: f.label,
          total: num(f.total),
          vacant: num(f.vacant),
          area: area(f.area),
        }),
        style: "body" as const,
      })),
    );
  }

  if (picked.includes("unitlar")) {
    lines.push({ text: t("obj.unitTable"), style: "heading" });
    lines.push(
      ...unitRows.value.map((u) => ({
        text: showFinance.value
          ? `${u.code} · ${u.areaLabel} · ${u.usage} · ${u.offer} · ${u.tenant} · ${u.priceLabel}`
          : `${u.code} · ${u.areaLabel} · ${u.usage} · ${u.offer}`,
        style: "body" as const,
      })),
    );
  }

  if (picked.includes("moliya") && showFinance.value) {
    lines.push({ text: t("obj.financeSection"), style: "heading" });
    lines.push(
      {
        text: t("obj.monthlyRevenueLine", { value: sum(b.monthlyRevenue) }),
        style: "body",
      },
      { text: t("obj.debtLine", { value: sum(b.debt) }), style: "body" },
      {
        text: t("obj.occupancyLine", { value: percent(b.occupancy) }),
        style: "body",
      },
      {
        text: t("obj.glaLine", {
          gla: area(b.gla),
          vacant: area(b.vacantArea),
        }),
        style: "body",
      },
    );
  }

  const name = `${fileSlug(b.name)}-pasport-${todayIso()}.docx`;
  saveBlob(docxBlob(lines), name);
  notice.value = t("obj.pdfDone", { file: name, n: picked.length });
  pdfOpen.value = false;
}
</script>

<template>
  <NuxtPage v-if="nested" />

  <template v-else-if="!building">
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
          <div>
            <p class="text-[16px] font-bold text-ink-900">
              {{ t("obj.missingTitle") }}
            </p>
            <p class="mt-1 text-[13px] text-ink-500">
              {{ t("obj.missingText") }}
            </p>
          </div>
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
      :title="building.name"
      :subtitle="`${buildingTypeLabel(building.type)} · ${building.city}, ${building.district}`"
      :breadcrumb="[
        { label: moduleTitle('objects'), to: '/objects' },
        { label: building.name },
      ]"
    >
      <template #actions>
        <UiButton
          v-if="canEdit"
          variant="secondary"
          size="sm"
          @click="editOpen = true"
        >
          <UiIcon name="edit" :size="16" />
          {{ t("common.edit") }}
        </UiButton>
        <span
          v-else
          class="inline-flex items-center gap-2 rounded-pill bg-ink-100 px-3 py-1.5 text-[12px] font-semibold text-ink-600"
        >
          <UiIcon name="eye" :size="15" />
          {{ t("common.readOnly") }}
        </span>
        <UiButton variant="secondary" size="sm" @click="pdfOpen = true">
          <UiIcon name="doc" :size="16" />
          {{ t("obj.passport") }}
        </UiButton>
        <UiButton size="sm" :to="`/objects/${building.id}/3d`">
          <UiIcon name="cube" :size="16" />
          {{ t("obj.view3d") }}
        </UiButton>
      </template>
    </AppTopbar>

    <main class="scroll-slim flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
      <div
        v-if="notice"
        class="flex items-start gap-3 rounded-card bg-ok-50 px-4 py-3.5 ring-1 ring-inset ring-ok-100"
      >
        <UiIcon name="check" :size="18" class="mt-0.5 shrink-0 text-ok-600" />
        <p class="flex-1 text-[13px] font-medium text-ok-700">{{ notice }}</p>
        <button
          type="button"
          class="shrink-0 rounded-[8px] p-1 text-ok-600 transition-colors hover:bg-ok-100"
          :aria-label="t('common.dismissNotice')"
          @click="notice = ''"
        >
          <UiIcon name="x" :size="15" />
        </button>
      </div>

      <section
        class="grid gap-4 sm:grid-cols-2"
        :class="showFinance ? 'xl:grid-cols-4' : 'xl:grid-cols-2'"
      >
        <UiKpi
          :label="t('kpi.occupancyRate')"
          :value="percent(building.occupancy)"
          icon="building"
          tone="brand"
          :spark="[
            building.occupancy - 6,
            building.occupancy - 4,
            building.occupancy - 2,
            building.occupancy - 1,
            building.occupancy,
          ]"
        />
        <UiKpi
          :label="t('kpi.vacantArea')"
          :value="num(building.vacantArea)"
          :unit="t('unitOf.sqm')"
          icon="layers"
          tone="ok"
        />
        <UiKpi
          v-if="showFinance"
          :label="t('kpi.monthlyRent')"
          :value="moneyShort(building.monthlyRevenue)"
          icon="wallet"
          tone="violet"
        />
        <UiKpi
          v-if="showFinance"
          :label="t('kpi.debt')"
          :value="moneyShort(building.debt)"
          icon="warning"
          tone="danger"
        />
      </section>

      <!--
        Obyekt ochilganda darhol hajmli ko‘rinish chiqadi: uchastkadagi barcha
        binolar shu yerda, qavat bosilsa o‘sha qavat rejasi ochiladi.
      -->
      <UiCard
        :title="t('obj.view3d')"
        :subtitle="building.name"
        flush
        :padded="false"
      >
        <template #actions>
          <UiButton
            variant="secondary"
            size="sm"
            :to="`/objects/${building.id}/3d`"
          >
            <UiIcon name="cube" :size="16" />
            {{ t("obj.navigator3d") }}
          </UiButton>
        </template>
        <div class="px-4 pb-5 sm:px-5">
          <UiBuilding3D
            :building="building"
            :controls="false"
            height-class="h-[340px] sm:h-[420px]"
          />
        </div>
      </UiCard>

      <section class="grid gap-5 xl:grid-cols-3">
        <UiCard :title="t('obj.passport')" :subtitle="t('obj.passportCaption')">
          <template #actions>
            <UiStatus
              :kind="building.status === 'ACTIVE' ? 'contract' : 'unit'"
              :value="building.status === 'ACTIVE' ? 'ACTIVE' : 'ARCHIVED'"
              size="sm"
            />
          </template>

          <!-- Haqiqiy fotogalereya -->
          <div class="space-y-2.5">
            <UiPhoto
              :name="activePhoto"
              :alt="building.name"
              ratio="aspect-[16/10]"
              rounded="rounded-field"
              sizes="(max-width: 1280px) 100vw, 420px"
              eager
            >
              <span
                class="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink-900/70 via-ink-900/10 to-transparent"
              />
              <span class="absolute bottom-3 left-3.5 right-3.5">
                <span
                  class="block text-[16px] font-semibold text-white drop-shadow"
                >
                  {{ building.name }}
                </span>
                <span class="block text-[12px] text-white/85">
                  {{ building.district }} · {{ building.buildingClass }}
                </span>
              </span>
            </UiPhoto>

            <div
              v-if="building.gallery.length > 1"
              class="grid grid-cols-4 gap-2"
            >
              <button
                v-for="g in building.gallery"
                :key="g"
                type="button"
                class="overflow-hidden rounded-[9px] ring-2 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                :class="
                  g === activePhoto
                    ? 'ring-brand-500'
                    : 'ring-transparent hover:ring-ink-300'
                "
                :aria-label="
                  t('obj.photoAngle', {
                    name: building.name,
                    n: building.gallery.indexOf(g) + 1,
                  })
                "
                :aria-pressed="g === activePhoto"
                @click="activePhoto = g"
              >
                <UiPhoto
                  :name="g"
                  :alt="building.name"
                  ratio="aspect-[4/3]"
                  rounded="rounded-none"
                  sizes="110px"
                />
              </button>
            </div>
          </div>

          <dl class="mt-4 divide-y divide-ink-100">
            <div v-for="row in spec" :key="row.label" class="flex gap-4 py-2.5">
              <dt class="w-[124px] shrink-0 text-[13px] text-ink-500">
                {{ row.label }}
              </dt>
              <dd
                class="min-w-0 flex-1 text-[13px] font-semibold"
                :class="[
                  row.tone === 'ok'
                    ? 'text-ok-600'
                    : row.tone === 'warn'
                      ? 'text-warn-600'
                      : 'text-ink-900',
                  row.mono ? 'tabular' : '',
                ]"
              >
                {{ row.value }}
              </dd>
            </div>

            <div class="flex items-center gap-4 py-3">
              <dt class="w-[124px] shrink-0 text-[13px] text-ink-500">
                {{ field("manager") }}
              </dt>
              <dd class="flex min-w-0 flex-1 items-center gap-2.5">
                <span
                  class="grid size-9 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-600"
                >
                  <UiIcon name="user" :size="17" />
                </span>
                <span class="min-w-0">
                  <span
                    class="block truncate text-[13px] font-semibold text-ink-900"
                  >
                    {{ building.manager }}
                  </span>
                  <span class="tabular block text-[12px] text-ink-500">
                    {{ building.managerPhone }}
                  </span>
                </span>
              </dd>
            </div>
          </dl>
        </UiCard>

        <div class="min-w-0 space-y-5 xl:col-span-2">
          <UiCard
            :title="field('floors')"
            :subtitle="t('obj.floorsCaption')"
            flush
            :padded="false"
          >
            <template #actions>
              <UiButton
                variant="ghost"
                size="sm"
                :to="`/objects/${building.id}/3d`"
              >
                {{ t("obj.navigator3d") }}
                <UiIcon name="chevronRight" :size="15" />
              </UiButton>
            </template>

            <div class="scroll-slim max-h-[268px] overflow-y-auto px-5 pb-5">
              <div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                <NuxtLink
                  v-for="f in floors"
                  :key="f.floor"
                  :to="`/objects/${building.id}/floors/${f.floor}`"
                  class="group flex items-center gap-3 rounded-field px-3 py-2.5 ring-1 ring-ink-200 transition-all hover:shadow-card hover:ring-brand-300"
                >
                  <span
                    class="tabular grid size-9 shrink-0 place-items-center rounded-[9px] text-[13px] font-bold"
                    :class="
                      f.total
                        ? 'bg-brand-50 text-brand-700'
                        : 'bg-ink-100 text-ink-500'
                    "
                  >
                    {{ f.floor < 0 ? `B${-f.floor}` : f.floor }}
                  </span>
                  <span class="min-w-0 flex-1">
                    <span
                      class="block truncate text-[13px] font-semibold text-ink-900 group-hover:text-brand-600"
                    >
                      {{ f.label }}
                    </span>
                    <span class="block truncate text-[12px] text-ink-500">
                      {{
                        f.total
                          ? t("obj.floorUnitsMeta", {
                              total: f.total,
                              vacant: f.vacant,
                            })
                          : t("obj.noPlan")
                      }}
                    </span>
                  </span>
                  <UiIcon
                    name="chevronRight"
                    :size="15"
                    class="shrink-0 text-ink-400"
                  />
                </NuxtLink>
              </div>
            </div>
          </UiCard>

          <UiCard
            :title="t('obj.objectUnits')"
            :subtitle="
              t('obj.unitsSummary', {
                total: unitSummary.total,
                vacant: unitSummary.vacant,
                area: area(unitSummary.area),
              })
            "
            flush
            :padded="false"
          >
            <!--
              Unitlar sahifama-sahifa ko'rsatiladi. Ilgari bino pasportida
              barcha 77 qator birdaniga chizilar va sahifa olti ekranga
              cho'zilardi.
            -->
            <UiTable
              :columns="unitColumns"
              :rows="unitRows"
              :to="unitPath"
              :page-size="10"
              :empty="t('obj.emptyUnits')"
            >
              <template #cell-code="{ row }">
                <span class="tabular text-[13px] font-bold text-ink-900">{{
                  row.code
                }}</span>
              </template>
              <template #cell-floor="{ row }">
                <span class="tabular">{{
                  t("unitOf.floorNo", { floor: row.floor })
                }}</span>
              </template>
              <template #cell-status="{ row }">
                <UiStatus kind="unit" :value="String(row.status)" size="sm" />
              </template>
            </UiTable>
          </UiCard>
        </div>
      </section>

      <UiModal
        v-if="canEdit"
        v-model="editOpen"
        :title="t('obj.editTitle')"
        :subtitle="building.code"
        size="lg"
      >
        <div class="grid gap-4 sm:grid-cols-2">
          <UiField :label="field('buildingName')" class="sm:col-span-2">
            <UiInput v-model="editForm.name" />
          </UiField>
          <UiField :label="field('district')">
            <UiInput v-model="editForm.district" />
          </UiField>
          <UiField :label="field('street')">
            <UiInput v-model="editForm.street" />
          </UiField>
          <UiField :label="field('buildingClass')">
            <UiInput v-model="editForm.buildingClass" />
          </UiField>
          <UiField :label="field('manager')">
            <UiInput v-model="editForm.manager" />
          </UiField>
          <UiField :label="t('common.phone')" class="sm:col-span-2">
            <UiInput v-model="editForm.managerPhone" />
          </UiField>
        </div>

        <template #footer>
          <UiButton variant="ghost" @click="editOpen = false">{{
            t("common.cancel")
          }}</UiButton>
          <UiButton @click="submitEdit">
            <UiIcon name="check" :size="16" />
            {{ t("common.save") }}
          </UiButton>
        </template>
      </UiModal>

      <UiModal
        v-model="pdfOpen"
        :title="t('obj.passport')"
        :subtitle="t('obj.pdfCaption')"
      >
        <div class="space-y-2.5">
          <button
            v-for="s in [
              {
                key: 'pasport',
                label: t('obj.passport'),
                hint: t('obj.pdfMainHint'),
              },
              {
                key: 'qavatlar',
                label: t('obj.floorList'),
                hint: t('obj.pdfFloorsHint'),
              },
              {
                key: 'unitlar',
                label: t('obj.unitTable'),
                hint: showFinance
                  ? t('obj.pdfUnitsHintFinance')
                  : t('obj.pdfUnitsHint'),
              },
              ...(showFinance
                ? [
                    {
                      key: 'moliya',
                      label: t('obj.financeSection'),
                      hint: t('obj.pdfFinanceHint'),
                    },
                  ]
                : []),
            ]"
            :key="s.key"
            type="button"
            class="flex w-full items-center gap-3 rounded-field px-4 py-3 text-left ring-1 ring-inset transition-colors"
            :class="
              pdfSections.includes(s.key)
                ? 'bg-brand-50 ring-brand-300'
                : 'ring-ink-200 hover:bg-ink-50'
            "
            @click="togglePdfSection(s.key)"
          >
            <span
              class="grid size-6 shrink-0 place-items-center rounded-[7px] ring-1 ring-inset"
              :class="
                pdfSections.includes(s.key)
                  ? 'bg-brand-500 text-white ring-brand-500'
                  : 'text-transparent ring-ink-300'
              "
            >
              <UiIcon name="check" :size="14" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block text-[14px] font-semibold text-ink-900">{{
                s.label
              }}</span>
              <span class="block text-[12px] text-ink-500">{{ s.hint }}</span>
            </span>
          </button>
        </div>

        <p class="mt-4 text-[13px] text-ink-500">
          {{
            t("obj.pdfSummary", {
              name: building.name,
              n: pdfSections.length,
              area: area(building.gla),
            })
          }}<template v-if="showFinance">{{
            t("obj.pdfSummaryRevenue", {
              value: money(building.monthlyRevenue),
            })
          }}</template
          >.
        </p>

        <template #footer>
          <UiButton variant="ghost" @click="pdfOpen = false">{{
            t("common.cancel")
          }}</UiButton>
          <UiButton :disabled="!pdfSections.length" @click="submitPdf">
            <UiIcon name="download" :size="16" />
            {{ t("common.download") }}
          </UiButton>
        </template>
      </UiModal>
    </main>
  </template>
</template>
