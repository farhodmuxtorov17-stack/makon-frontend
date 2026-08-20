<script setup lang="ts">
import { UNIT_STATUS } from "~/constants/statuses";
import { csvBlob, fileSlug, saveBlob } from "~/utils/docx";

const { t, locale } = useI18n();
const { field, columns: labelColumns, statusLabel } = useAppLabels();

/** Ekranga chiqadigan matn: lug‘at kaliti yoki tarjima qilinmaydigan qiymat */
interface Phrase {
  k?: string;
  p?: Record<string, unknown>;
  s?: string;
}

const say = (p: Phrase) => (p.k ? t(p.k, p.p ?? {}) : (p.s ?? ""));

const SETTINGS_TABS = computed(() => [
  { label: t("nav.settingsUsers"), to: "/settings/users", icon: "users" },
  { label: t("nav.settingsRoles"), to: "/settings/roles", icon: "shield" },
  {
    label: t("nav.settingsIntegrations"),
    to: "/settings/integrations",
    icon: "globe",
  },
  {
    label: t("nav.settingsReference"),
    to: "/settings/reference-data",
    icon: "layers",
  },
  { label: t("nav.settingsSystem"), to: "/settings/system", icon: "gear" },
  { label: t("nav.settingsAudit"), to: "/settings/audit", icon: "clipboard" },
]);
const CURRENT_TAB = "/settings/reference-data";

const CATEGORY_META: Record<string, { key: string; badge: string }> = {
  buildings: {
    key: "cfg.catBuildings",
    badge: "bg-ok-50 text-ok-700 ring-ok-100",
  },
  units: {
    key: "kpi.units",
    badge: "bg-brand-50 text-brand-700 ring-brand-200",
  },
  services: {
    key: "cfg.catServices",
    badge: "bg-info-50 text-info-700 ring-info-100",
  },
  tariffs: {
    key: "cfg.catTariffs",
    badge: "bg-teal-50 text-teal-700 ring-teal-200",
  },
  equipment: {
    key: "cfg.catEquipment",
    badge: "bg-warn-50 text-warn-700 ring-warn-100",
  },
  floors: {
    key: "field.floors",
    badge: "bg-ink-100 text-ink-700 ring-ink-200",
  },
  statuses: {
    key: "cfg.catStatuses",
    badge: "bg-danger-50 text-danger-700 ring-danger-100",
  },
};

/** Ro‘yxatda kutilmagan turkum uchrasa ham nishoncha ko‘rinishda qoladi */
const CATEGORY_FALLBACK = {
  key: "cfg.catNone",
  badge: "bg-ink-100 text-ink-700 ring-ink-200",
};

function categoryMeta(category: string) {
  const meta = CATEGORY_META[category] ?? CATEGORY_FALLBACK;
  return { label: t(meta.key), badge: meta.badge };
}

/**
 * Unit statuslari ma’lumotnomasi status registridan olinadi: kod sifatida
 * tizim ishlatadigan haqiqiy belgi ko‘rsatiladi, nomi esa boshqa ekranlar
 * bilan bir xil bo‘ladi.
 */
const UNIT_STATUS_RECORDS = Object.entries(UNIT_STATUS).map(([code, def]) => ({
  code,
  label: def.label,
  labelKey: `status.unit.${code}`,
}));

const GROUPS: Record<string, string[]> = {
  all: Object.keys(CATEGORY_META),
  building: ["buildings", "units"],
  service: ["services"],
  tariff: ["tariffs"],
  equipment: ["equipment"],
  floor: ["floors"],
  status: ["statuses"],
};

interface RefRecord {
  code: string;
  label: string;
  /** Ruscha nomi: ma’lumotnoma yozuvi tahrirlanadigan ma’lumot */
  labelRu?: string;
  /** Registrdan keladigan yozuv uchun lug‘at kaliti */
  labelKey?: string;
}

interface RefEntry {
  id: string;
  name: string;
  nameRu: string;
  nameEn: string;
  category: string;
  code: string;
  description: string;
  descriptionRu: string;
  status: "ACTIVE" | "ARCHIVED";
  updatedAt: Phrase;
  updatedBy: string;
  icon: string;
  records: RefRecord[];
}

/** Ro‘yxat va panel nomni tanlangan tilda ko‘rsatadi */
const entryName = (e: { name: string; nameRu?: string }) =>
  locale.value === "ru" && e.nameRu ? e.nameRu : e.name;

const entryDescription = (e: {
  description: string;
  descriptionRu?: string;
}) =>
  locale.value === "ru" && e.descriptionRu ? e.descriptionRu : e.description;

const recordLabel = (r: RefRecord) => {
  if (r.labelKey) return t(r.labelKey);
  return locale.value === "ru" && r.labelRu ? r.labelRu : r.label;
};

const entries = ref<RefEntry[]>([
  {
    id: "rd-01",
    name: "Binolar turlari",
    nameRu: "Типы зданий",
    nameEn: "Building Types",
    category: "buildings",
    code: "BLD_TYPE",
    description: "Turli xil bino turlarining klassifikatori",
    descriptionRu: "Классификатор типов зданий",
    status: "ACTIVE",
    updatedAt: { s: "18.05.2025 10:24" },
    updatedBy: "Jahongir Alimov",
    icon: "building",
    records: [
      { code: "BT-01", label: "Biznes markaz", labelRu: "Бизнес-центр" },
      { code: "BT-02", label: "Savdo markaz", labelRu: "Торговый центр" },
      {
        code: "BT-03",
        label: "Ombor / logistika",
        labelRu: "Склад / логистика",
      },
      { code: "BT-04", label: "Turar joy", labelRu: "Жилое здание" },
      { code: "BT-05", label: "Ofis binosi", labelRu: "Офисное здание" },
    ],
  },
  {
    id: "rd-02",
    name: "Bo‘sh unit toifalari",
    nameRu: "Категории свободных юнитов",
    nameEn: "Vacant Unit Categories",
    category: "units",
    code: "UNIT_CAT",
    description: "Bo‘sh unitlar toifalari va o‘lchov birliklari",
    descriptionRu: "Категории свободных помещений и единицы измерения",
    status: "ACTIVE",
    updatedAt: { s: "18.05.2025 09:41" },
    updatedBy: "Dilshod Karimov",
    icon: "cube",
    records: [
      { code: "UC-01", label: "Ofis maydoni", labelRu: "Офисная площадь" },
      { code: "UC-02", label: "Savdo maydoni", labelRu: "Торговая площадь" },
      { code: "UC-03", label: "Ombor maydoni", labelRu: "Складская площадь" },
      { code: "UC-04", label: "Turar joy", labelRu: "Жилое помещение" },
      { code: "UC-05", label: "Parking o‘rni", labelRu: "Парковочное место" },
    ],
  },
  {
    id: "rd-03",
    name: "Xizmat turlari",
    nameRu: "Типы услуг",
    nameEn: "Service Types",
    category: "services",
    code: "SRV_CAT",
    description: "Ko‘rsatiladigan xizmatlar klassifikatori",
    descriptionRu: "Классификатор оказываемых услуг",
    status: "ACTIVE",
    updatedAt: { s: "18.05.2025 09:12" },
    updatedBy: "Otabek Rahimov",
    icon: "wrench",
    records: [
      { code: "SC-01", label: "Elektr ta’minoti", labelRu: "Электроснабжение" },
      { code: "SC-02", label: "Suv ta’minoti", labelRu: "Водоснабжение" },
      {
        code: "SC-03",
        label: "Isitish va sovitish",
        labelRu: "Отопление и охлаждение",
      },
      { code: "SC-04", label: "Tozalash xizmati", labelRu: "Клининг" },
      { code: "SC-05", label: "Qo‘riqlash xizmati", labelRu: "Охрана" },
      { code: "SC-06", label: "Lift xizmati", labelRu: "Обслуживание лифтов" },
    ],
  },
  {
    id: "rd-04",
    name: "Tarif jadvallari",
    nameRu: "Тарифные таблицы",
    nameEn: "Tariff Tables",
    category: "tariffs",
    code: "TARIFF_TAB",
    description: "Tarif rejalari va narx jadvallari",
    descriptionRu: "Тарифные планы и таблицы цен",
    status: "ACTIVE",
    updatedAt: { s: "17.05.2025 18:30" },
    updatedBy: "Sevara Yusupova",
    icon: "wallet",
    records: [
      {
        code: "TR-01",
        label: "Elektr energiyasi (kVt-soat)",
        labelRu: "Электроэнергия (кВт-ч)",
      },
      {
        code: "TR-02",
        label: "Suv ta’minoti (m³)",
        labelRu: "Водоснабжение (м³)",
      },
      {
        code: "TR-03",
        label: "Issiqlik ta’minoti (Gkal)",
        labelRu: "Теплоснабжение (Гкал)",
      },
      {
        code: "TR-04",
        label: "Boshqaruv xizmati (m²)",
        labelRu: "Услуги управления (м²)",
      },
      {
        code: "TR-05",
        label: "Tozalash xizmati (m²)",
        labelRu: "Клининг (м²)",
      },
    ],
  },
  {
    id: "rd-05",
    name: "Uskuna turlari",
    nameRu: "Типы оборудования",
    nameEn: "Equipment Types",
    category: "equipment",
    code: "EQP_TYPE",
    description: "Bino uskunalari va texnikalar turlari",
    descriptionRu: "Типы оборудования и техники здания",
    status: "ACTIVE",
    updatedAt: { s: "17.05.2025 16:08" },
    updatedBy: "Sardor Yo‘ldoshev",
    icon: "box",
    records: [
      { code: "EQ-01", label: "Lift", labelRu: "Лифт" },
      { code: "EQ-02", label: "Eskalator", labelRu: "Эскалатор" },
      { code: "EQ-03", label: "Generator", labelRu: "Генератор" },
      {
        code: "EQ-04",
        label: "Yong‘in signalizatsiyasi",
        labelRu: "Пожарная сигнализация",
      },
      { code: "EQ-05", label: "Suv nasosi", labelRu: "Водяной насос" },
      {
        code: "EQ-06",
        label: "Videokuzatuv (CCTV)",
        labelRu: "Видеонаблюдение (CCTV)",
      },
      {
        code: "EQ-07",
        label: "Havo tozalash tizimi",
        labelRu: "Система очистки воздуха",
      },
    ],
  },
  {
    id: "rd-06",
    name: "Qavat belgilari",
    nameRu: "Обозначения этажей",
    nameEn: "Floor Labels",
    category: "floors",
    code: "FLR_LABEL",
    description: "Qavatlar nomi va belgilar klassifikatori",
    descriptionRu: "Классификатор названий и обозначений этажей",
    status: "ACTIVE",
    updatedAt: { s: "15.05.2025 11:02" },
    updatedBy: "Bobur Ismoilov",
    icon: "layers",
    records: [
      { code: "FL-B2", label: "Yerto‘la −2", labelRu: "Подвал −2" },
      { code: "FL-B1", label: "Yerto‘la −1", labelRu: "Подвал −1" },
      { code: "FL-00", label: "Zamin qavat", labelRu: "Цокольный этаж" },
      { code: "FL-01", label: "1-qavat", labelRu: "1 этаж" },
      { code: "FL-TP", label: "Tipovoy qavat", labelRu: "Типовой этаж" },
      { code: "FL-TX", label: "Texnik qavat", labelRu: "Технический этаж" },
    ],
  },
  {
    id: "rd-07",
    name: "Statuslar katalogi",
    nameRu: "Каталог статусов",
    nameEn: "Status Catalog",
    category: "statuses",
    code: "STATUS_CAT",
    description: "Tizimdagi statuslar va ularning holatlari",
    descriptionRu: "Статусы системы и их состояния",
    status: "ACTIVE",
    updatedAt: { s: "15.05.2025 10:22" },
    updatedBy: "Jahongir Alimov",
    icon: "clipboard",
    records: UNIT_STATUS_RECORDS,
  },
]);

const activeGroup = ref("all");
const search = ref("");
const statusFilter = ref("all");

const groupTabs = computed(() => [
  { value: "all", label: t("tab.all"), count: entries.value.length },
  {
    value: "building",
    label: t("cfg.tabBuildingsUnits"),
    count: countOf("building"),
  },
  { value: "service", label: t("cfg.catServices"), count: countOf("service") },
  {
    value: "tariff",
    label: t("cfg.tabTariffsPayments"),
    count: countOf("tariff"),
  },
  {
    value: "equipment",
    label: t("cfg.catEquipment"),
    count: countOf("equipment"),
  },
  { value: "floor", label: t("field.floors"), count: countOf("floor") },
  { value: "status", label: t("cfg.catStatuses"), count: countOf("status") },
]);

function countOf(group: string) {
  return entries.value.filter((e) => GROUPS[group]!.includes(e.category))
    .length;
}

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  return entries.value.filter((e) => {
    const inGroup = GROUPS[activeGroup.value]!.includes(e.category);
    const matchQ =
      !q ||
      entryName(e).toLowerCase().includes(q) ||
      e.code.toLowerCase().includes(q) ||
      entryDescription(e).toLowerCase().includes(q);
    const matchStatus =
      statusFilter.value === "all" || e.status === statusFilter.value;
    return inGroup && matchQ && matchStatus;
  });
});

const columns = computed(() =>
  labelColumns([
    { key: "name", field: "name" },
    { key: "category", field: "group" },
    { key: "code", field: "code" },
    { key: "description", field: "description" },
    { key: "status", field: "status" },
    { key: "updatedAt", field: "lastUpdate", align: "right" },
    { key: "actions", field: "actions", align: "right", width: "96px" },
  ]),
);

const stats = computed(() => {
  const activeEntries = entries.value.filter((e) => e.status === "ACTIVE");
  return {
    total: entries.value.length,
    activeRecords: activeEntries.reduce((s, e) => s + e.records.length, 0),
    archived: entries.value.filter((e) => e.status === "ARCHIVED").length,
  };
});

const addedCount = ref(9);
const changedCount = ref(14);

const activity = ref<
  Array<{ id: string; title: Phrase; who: string; when: Phrase; icon: string }>
>([
  {
    id: "af-01",
    title: { k: "cfg.actTariffUpdated" },
    who: "Jahongir Alimov",
    when: { k: "cfg.hoursAgo", p: { n: 2 } },
    icon: "wallet",
  },
  {
    id: "af-02",
    title: { k: "cfg.actServiceAdded" },
    who: "Otabek Rahimov",
    when: { k: "cfg.hoursAgo", p: { n: 5 } },
    icon: "wrench",
  },
  {
    id: "af-03",
    title: { k: "cfg.actUnitCatChanged" },
    who: "Dilshod Karimov",
    when: { k: "cfg.daysAgo", p: { n: 1 } },
    icon: "cube",
  },
  {
    id: "af-04",
    title: { k: "cfg.actStatusAdded" },
    who: "Sevara Yusupova",
    when: { k: "cfg.daysAgo", p: { n: 2 } },
    icon: "clipboard",
  },
]);

function logActivity(title: Phrase, icon: string) {
  activity.value.unshift({
    id: `af-${activity.value.length + 5}`,
    title,
    who: "Jahongir Alimov",
    when: { k: "common.justNow" },
    icon,
  });
  if (activity.value.length > 8) activity.value.pop();
}

const panelOpen = ref(false);

/** Boshqa dialoglar kabi Escape bilan yopiladi */
onKeyStroke("Escape", () => {
  if (panelOpen.value) panelOpen.value = false;
});

const panelTab = ref("general");
const panelTabs = computed(() => [
  { value: "general", label: t("cfg.tabGeneral") },
  { value: "records", label: t("cfg.tabRecords") },
]);

const draft = reactive({
  id: "",
  name: "",
  nameRu: "",
  nameEn: "",
  category: "buildings",
  code: "",
  description: "",
  descriptionRu: "",
  status: "ACTIVE" as "ACTIVE" | "ARCHIVED",
});

/**
 * Tavsif maydoni tanlangan tildagi matnni tahrirlaydi: rus tilida ochilgan
 * panelda o‘zbekcha matn qolib ketmaydi.
 */
const draftDescription = computed({
  get: () => (locale.value === "ru" ? draft.descriptionRu : draft.description),
  set: (value: string) => {
    if (locale.value === "ru") draft.descriptionRu = value;
    else draft.description = value;
  },
});

const draftRecords = ref<RefRecord[]>([]);

const categoryOptions = computed(() =>
  Object.entries(CATEGORY_META).map(([value, meta]) => ({
    value,
    label: t(meta.key),
  })),
);

const statusOptions = computed(() => [
  { value: "ACTIVE", label: t("common.active") },
  { value: "ARCHIVED", label: statusLabel("unit", "ARCHIVED") },
]);

const filterStatusOptions = computed(() => [
  { value: "all", label: t("filter.allStatuses") },
  ...statusOptions.value,
]);

function openPanel(row: Record<string, unknown>) {
  const e = entries.value.find((x) => x.id === row.id);
  if (!e) return;
  draft.id = e.id;
  draft.name = e.name;
  draft.nameRu = e.nameRu;
  draft.nameEn = e.nameEn;
  draft.category = e.category;
  draft.code = e.code;
  draft.description = e.description;
  draft.descriptionRu = e.descriptionRu;
  draft.status = e.status;
  draftRecords.value = e.records.map((r) => ({ ...r }));
  actionResult.value = "";
  panelTab.value = "general";
  panelOpen.value = true;
}

const draftValid = computed(
  () => draft.name.trim().length > 2 && draft.code.trim().length > 2,
);

const flash = ref("");

function savePanel() {
  if (!draftValid.value) return;
  const i = entries.value.findIndex((e) => e.id === draft.id);
  if (i === -1) return;
  entries.value[i] = {
    ...entries.value[i]!,
    name: draft.name.trim(),
    nameRu: draft.nameRu.trim(),
    nameEn: draft.nameEn.trim(),
    category: draft.category,
    code: draft.code.trim().toUpperCase(),
    description: draft.description.trim(),
    descriptionRu: draft.descriptionRu.trim(),
    status: draft.status,
    records: draftRecords.value.map((r) => ({ ...r })),
    updatedAt: { k: "common.justNow" },
    updatedBy: "Jahongir Alimov",
  };
  changedCount.value += 1;
  logActivity(
    { k: "cfg.actRefUpdated", p: { name: draft.name.trim() } },
    "edit",
  );
  flash.value = t("cfg.refSaved", { name: draft.name.trim() });
  panelOpen.value = false;
}

const archiveOpen = ref(false);

function confirmArchive() {
  draft.status = "ARCHIVED";
  const i = entries.value.findIndex((e) => e.id === draft.id);
  if (i !== -1) {
    entries.value[i] = {
      ...entries.value[i]!,
      status: "ARCHIVED",
      updatedAt: { k: "common.justNow" },
    };
  }
  logActivity({ k: "cfg.actRefArchived", p: { name: draft.name } }, "box");
  flash.value = t("cfg.refArchived", { name: draft.name });
  archiveOpen.value = false;
  panelOpen.value = false;
}

const recordOpen = ref(false);
const newRecord = reactive({ code: "", label: "" });
const recordTouched = ref(false);
const recordError = ref("");

function openRecordForm() {
  newRecord.code = "";
  newRecord.label = "";
  recordTouched.value = false;
  recordError.value = "";
  recordOpen.value = true;
}

function submitRecord() {
  recordTouched.value = true;
  recordError.value = "";
  if (!newRecord.code.trim() || !newRecord.label.trim()) return;
  const code = newRecord.code.trim().toUpperCase();
  if (draftRecords.value.some((r) => r.code === code)) {
    recordError.value = t("cfg.codeExists");
    return;
  }
  draftRecords.value.push({
    code,
    label: newRecord.label.trim(),
  });
  addedCount.value += 1;
  logActivity({ k: "cfg.actRecordAdded", p: { name: draft.name } }, "plus");
  recordOpen.value = false;
  panelTab.value = "records";
}

function removeRecord(code: string) {
  draftRecords.value = draftRecords.value.filter((r) => r.code !== code);
}

const actionOpen = ref(false);
const actionInfo = reactive({ key: "", title: "", text: "", confirmLabel: "" });

const QUICK_ACTIONS = computed(() => [
  {
    key: "template",
    label: t("cfg.downloadTemplate"),
    icon: "doc",
    tone: "text-teal-700 bg-teal-50",
  },
  {
    key: "export",
    label: t("cfg.exportCsv"),
    icon: "download",
    tone: "text-ok-700 bg-ok-50",
  },
]);

function openAction(key: string) {
  actionInfo.key = key;
  if (key === "template") {
    actionInfo.title = t("cfg.downloadTemplate");
    actionInfo.text = t("cfg.templateText", { code: draft.code });
    actionInfo.confirmLabel = t("common.download");
  } else if (key === "export") {
    actionInfo.title = t("common.export");
    actionInfo.text = t("cfg.exportText", {
      name: draft.name,
      n: draftRecords.value.length,
    });
    actionInfo.confirmLabel = t("common.exportAction");
  }
  actionOpen.value = true;
}

const actionResult = ref("");

/**
 * Eksport va shablon endi haqiqiy fayl beradi.
 *
 * Ilgari tugma «tayyorlandi» deb yozardi, lekin foydalanuvchi qo'lida hech
 * nima qolmasdi. Endi ma'lumotnoma yozuvlari jadval fayliga yig'iladi va
 * brauzer uni yuklab oladi; shablon esa o'sha ustunlar bilan bo'sh jadval.
 * Excel'dan import olib tashlandi: u serversiz haqiqiy ishlay olmaydi,
 * shuning uchun tizimda bo'lmagani ma'qul.
 */
function confirmAction() {
  const nom = fileSlug(draft.code || draft.name);
  const head: Array<string | number> = [field("code"), field("name")];
  if (actionInfo.key === "template") {
    saveBlob(csvBlob([head]), `${nom}-shablon.csv`);
    actionResult.value = t("cfg.templateDone");
  } else {
    const rows: Array<Array<string | number>> = [head];
    for (const r of draftRecords.value) rows.push([r.code, recordLabel(r)]);
    saveBlob(csvBlob(rows), `${nom}.csv`);
    actionResult.value = t("cfg.exportDone", { n: draftRecords.value.length });
  }
  logActivity(
    { k: "cfg.actQuick", p: { title: actionInfo.title, name: draft.name } },
    "refresh",
  );
  actionOpen.value = false;
}
</script>

<template>
  <AppTopbar
    :title="t('cfg.referenceTitle')"
    :subtitle="t('cfg.referenceCaption')"
    :breadcrumb="[
      { label: t('nav.settings'), to: '/settings/users' },
      { label: t('nav.settingsReference') },
    ]"
  >
    <template #actions>
      <UiButton variant="secondary" size="sm" to="/settings/audit">
        <UiIcon name="clipboard" :size="16" />
        {{ t("nav.settingsAudit") }}
      </UiButton>
    </template>
  </AppTopbar>

  <main class="scroll-slim flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
    <nav class="flex flex-wrap gap-2">
      <NuxtLink
        v-for="t in SETTINGS_TABS"
        :key="t.to"
        :to="t.to"
        class="inline-flex items-center gap-2 rounded-field px-4 py-2.5 text-[13px] font-semibold ring-1 ring-inset transition-colors"
        :class="
          t.to === CURRENT_TAB
            ? 'bg-brand-500 text-white ring-brand-500 shadow-brand'
            : 'bg-surface text-ink-600 ring-ink-200 hover:text-brand-600 hover:ring-brand-300'
        "
        :aria-current="t.to === CURRENT_TAB ? 'page' : undefined"
      >
        <UiIcon :name="t.icon" :size="16" />
        {{ t.label }}
      </NuxtLink>
    </nav>

    <div
      v-if="flash"
      class="flex items-start gap-2.5 rounded-card bg-ok-50 px-4 py-3 text-[13px] text-ok-700 ring-1 ring-ok-100"
    >
      <UiIcon name="check" :size="17" class="mt-0.5 shrink-0" />
      <span class="min-w-0 flex-1">{{ flash }}</span>
      <button
        type="button"
        class="shrink-0 rounded-[6px] p-1 transition-colors hover:bg-ok-100"
        :aria-label="t('common.dismiss')"
        @click="flash = ''"
      >
        <UiIcon name="x" :size="15" />
      </button>
    </div>

    <div class="scroll-slim -mx-1 overflow-x-auto px-1 pb-1">
      <UiTabs v-model="activeGroup" :tabs="groupTabs" />
    </div>

    <UiCard
      :title="t('cfg.refList')"
      :subtitle="
        t('cfg.shownOf', { shown: filtered.length, total: entries.length })
      "
      flush
    >
      <div class="grid gap-3 px-5 pb-4 sm:grid-cols-[minmax(0,1fr)_220px]">
        <UiInput v-model="search" :placeholder="t('cfg.refSearchPlaceholder')">
          <template #prefix><UiIcon name="search" :size="17" /></template>
        </UiInput>
        <UiSelect v-model="statusFilter" :options="filterStatusOptions" />
      </div>

      <UiTable
        :columns="columns"
        :rows="filtered"
        :empty="t('cfg.emptyRefs')"
        @row-click="openPanel"
      >
        <template #cell-name="{ row }">
          <span class="flex items-center gap-3">
            <span
              class="grid size-9 shrink-0 place-items-center rounded-[10px] bg-brand-50 text-brand-600"
            >
              <UiIcon :name="row.icon" :size="18" />
            </span>
            <span class="min-w-0">
              <span
                class="block truncate text-[14px] font-semibold text-ink-900"
              >
                {{ entryName(row) }}
              </span>
              <span class="tabular block text-[12px] text-ink-500">
                {{ t("cfg.recordCount", { n: row.records.length }) }}
              </span>
            </span>
          </span>
        </template>

        <template #cell-category="{ row }">
          <span
            class="inline-flex items-center rounded-pill px-2.5 py-1 text-xs font-semibold ring-1 ring-inset"
            :class="categoryMeta(row.category).badge"
          >
            {{ categoryMeta(row.category).label }}
          </span>
        </template>

        <template #cell-code="{ row }">
          <span
            class="tabular rounded-[6px] bg-ink-100 px-2 py-1 text-[12px] font-semibold text-ink-700"
          >
            {{ row.code }}
          </span>
        </template>

        <template #cell-description="{ row }">
          <span class="block max-w-[24rem] truncate text-[13px] text-ink-600">
            {{ entryDescription(row) }}
          </span>
        </template>

        <template #cell-status="{ row }">
          <span
            class="inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs font-semibold ring-1 ring-inset"
            :class="
              row.status === 'ACTIVE'
                ? 'bg-ok-50 text-ok-700 ring-ok-100'
                : 'bg-ink-100 text-ink-700 ring-ink-200'
            "
          >
            <svg class="size-3 shrink-0" viewBox="0 0 12 12" aria-hidden="true">
              <circle
                v-if="row.status === 'ACTIVE'"
                cx="6"
                cy="6"
                r="4"
                fill="currentColor"
              />
              <rect
                v-else
                x="2.4"
                y="2.4"
                width="7.2"
                height="7.2"
                rx="1.6"
                fill="currentColor"
              />
            </svg>
            {{
              row.status === "ACTIVE"
                ? t("common.active")
                : statusLabel("unit", "ARCHIVED")
            }}
          </span>
        </template>

        <template #cell-updatedAt="{ row }">
          <span class="tabular block text-[13px] text-ink-700">{{
            say(row.updatedAt)
          }}</span>
          <span class="block text-[12px] text-ink-500">{{
            row.updatedBy
          }}</span>
        </template>

        <template #cell-actions="{ row }">
          <button
            type="button"
            class="inline-flex items-center gap-1.5 rounded-[8px] px-2.5 py-1.5 text-[13px] font-semibold text-brand-600 transition-colors hover:bg-brand-50"
            @click.stop="openPanel(row)"
          >
            <UiIcon name="edit" :size="15" />
            {{ t("common.open") }}
          </button>
        </template>
      </UiTable>
    </UiCard>

    <section class="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <UiCard
        :title="t('cfg.quickStats')"
        :subtitle="t('cfg.quickStatsCaption')"
      >
        <dl class="grid gap-4 sm:grid-cols-3 xl:grid-cols-5">
          <div class="rounded-field p-4 ring-1 ring-ink-200">
            <dt class="text-[12px] text-ink-500">
              {{ t("cfg.statTotalRefs") }}
            </dt>
            <dd
              class="tabular mt-1.5 text-[22px] font-bold leading-none text-ink-900"
            >
              {{ stats.total }}
            </dd>
          </div>
          <div class="rounded-field p-4 ring-1 ring-ink-200">
            <dt class="text-[12px] text-ink-500">
              {{ t("cfg.statActiveRecords") }}
            </dt>
            <dd
              class="tabular mt-1.5 text-[22px] font-bold leading-none text-ok-600"
            >
              {{ stats.activeRecords }}
            </dd>
          </div>
          <div class="rounded-field p-4 ring-1 ring-ink-200">
            <dt class="text-[12px] text-ink-500">{{ t("cfg.statAdded") }}</dt>
            <dd
              class="tabular mt-1.5 text-[22px] font-bold leading-none text-brand-600"
            >
              {{ addedCount }}
            </dd>
          </div>
          <div class="rounded-field p-4 ring-1 ring-ink-200">
            <dt class="text-[12px] text-ink-500">{{ t("cfg.statChanged") }}</dt>
            <dd
              class="tabular mt-1.5 text-[22px] font-bold leading-none text-info-600"
            >
              {{ changedCount }}
            </dd>
          </div>
          <div class="rounded-field p-4 ring-1 ring-ink-200">
            <dt class="text-[12px] text-ink-500">
              {{ statusLabel("unit", "ARCHIVED") }}
            </dt>
            <dd
              class="tabular mt-1.5 text-[22px] font-bold leading-none text-ink-700"
            >
              {{ stats.archived }}
            </dd>
          </div>
        </dl>

        <p
          v-if="actionResult"
          class="mt-4 flex items-center gap-2 rounded-field bg-brand-50 px-3.5 py-2.5 text-[13px] text-brand-800"
        >
          <UiIcon name="info" :size="16" />
          {{ actionResult }}
        </p>
      </UiCard>

      <UiCard
        :title="t('cfg.recentActivity')"
        :subtitle="t('cfg.recentActivityCaption')"
        flush
      >
        <ul class="divide-y divide-ink-100">
          <li
            v-for="a in activity"
            :key="a.id"
            class="flex items-center gap-3.5 px-5 py-3"
          >
            <span
              class="grid size-9 shrink-0 place-items-center rounded-[10px] bg-brand-50 text-brand-600"
            >
              <UiIcon :name="a.icon" :size="17" />
            </span>
            <span class="min-w-0 flex-1">
              <span
                class="block truncate text-[13px] font-semibold text-ink-900"
              >
                {{ say(a.title) }}
              </span>
              <span class="block truncate text-[12px] text-ink-500">
                {{ a.who }} • {{ say(a.when) }}
              </span>
            </span>
          </li>
        </ul>
      </UiCard>
    </section>

    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-150 ease-out"
        enter-from-class="opacity-0"
        leave-active-class="transition duration-100 ease-in"
        leave-to-class="opacity-0"
      >
        <div
          v-if="panelOpen"
          class="fixed inset-0 z-50 flex justify-end bg-ink-900/40 backdrop-blur-[2px]"
          @click.self="panelOpen = false"
        >
          <aside
            class="flex h-full w-full max-w-lg flex-col bg-surface shadow-pop"
            role="dialog"
            aria-modal="true"
            :aria-label="t('cfg.editRef')"
          >
            <header
              class="flex items-start justify-between gap-4 border-b border-ink-200 px-6 py-5"
            >
              <div class="min-w-0">
                <h2 class="truncate text-lg font-bold text-ink-900">
                  {{ entryName(draft) }}
                </h2>
                <p class="tabular mt-0.5 text-[13px] text-ink-500">
                  {{ draft.code }}
                </p>
              </div>
              <button
                type="button"
                class="-mr-1 -mt-1 rounded-lg p-2 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
                :aria-label="t('common.close')"
                @click="panelOpen = false"
              >
                <UiIcon name="x" :size="18" />
              </button>
            </header>

            <div class="px-6 pt-4">
              <UiTabs v-model="panelTab" :tabs="panelTabs" variant="line" />
            </div>

            <div class="scroll-slim flex-1 space-y-5 overflow-y-auto px-6 py-5">
              <template v-if="panelTab === 'general'">
                <UiField
                  :label="field('name')"
                  required
                  :error="
                    draft.name.trim().length > 2
                      ? ''
                      : t('common.minCharsShort', { n: 3 })
                  "
                >
                  <UiInput v-model="draft.name" />
                </UiField>

                <div class="grid gap-4 sm:grid-cols-2">
                  <UiField
                    :label="field('code')"
                    required
                    :error="
                      draft.code.trim().length > 2
                        ? ''
                        : t('common.minCharsShort', { n: 3 })
                    "
                  >
                    <UiInput v-model="draft.code" />
                  </UiField>
                  <UiField :label="field('group')">
                    <UiSelect
                      v-model="draft.category"
                      :options="categoryOptions"
                    />
                  </UiField>
                </div>

                <UiField :label="field('status')">
                  <UiSelect v-model="draft.status" :options="statusOptions" />
                </UiField>

                <UiField :label="field('description')">
                  <textarea
                    v-model="draftDescription"
                    rows="3"
                    class="w-full rounded-field bg-white px-3.5 py-2.5 text-sm text-ink-800 ring-1 ring-inset ring-ink-200 transition-colors placeholder:text-ink-400 hover:ring-ink-300 focus:ring-2 focus:ring-brand-500"
                    :placeholder="t('cfg.refDescPlaceholder')"
                  />
                </UiField>

                <div>
                  <p class="mb-2.5 text-[13px] font-semibold text-ink-700">
                    {{ t("cfg.multilingualNames") }}
                  </p>
                  <div class="space-y-3">
                    <UiField :label="t('shell.localeUz')">
                      <UiInput v-model="draft.name" />
                    </UiField>
                    <UiField :label="t('shell.localeRu')">
                      <UiInput v-model="draft.nameRu" />
                    </UiField>
                    <UiField :label="t('cfg.langEn')">
                      <UiInput v-model="draft.nameEn" />
                    </UiField>
                  </div>
                </div>

                <div>
                  <p class="mb-2.5 text-[13px] font-semibold text-ink-700">
                    {{ t("cfg.quickActions") }}
                  </p>
                  <ul class="space-y-1.5">
                    <li>
                      <button
                        type="button"
                        class="flex w-full items-center gap-3 rounded-field px-3 py-2.5 text-left ring-1 ring-inset ring-ink-200 transition-colors hover:ring-brand-300"
                        @click="openRecordForm"
                      >
                        <span
                          class="grid size-8 shrink-0 place-items-center rounded-[8px] bg-brand-50 text-brand-600"
                        >
                          <UiIcon name="plus" :size="16" />
                        </span>
                        <span
                          class="flex-1 text-[13px] font-semibold text-ink-800"
                        >
                          {{ t("cfg.addRecord") }}
                        </span>
                        <UiIcon
                          name="chevronRight"
                          :size="16"
                          class="text-ink-400"
                        />
                      </button>
                    </li>
                    <li v-for="qa in QUICK_ACTIONS" :key="qa.key">
                      <button
                        type="button"
                        class="flex w-full items-center gap-3 rounded-field px-3 py-2.5 text-left ring-1 ring-inset ring-ink-200 transition-colors hover:ring-brand-300"
                        @click="openAction(qa.key)"
                      >
                        <span
                          class="grid size-8 shrink-0 place-items-center rounded-[8px]"
                          :class="qa.tone"
                        >
                          <UiIcon :name="qa.icon" :size="16" />
                        </span>
                        <span
                          class="flex-1 text-[13px] font-semibold text-ink-800"
                          >{{ qa.label }}</span
                        >
                        <UiIcon
                          name="chevronRight"
                          :size="16"
                          class="text-ink-400"
                        />
                      </button>
                    </li>
                  </ul>
                  <p
                    v-if="actionResult"
                    class="mt-2.5 flex items-start gap-2 rounded-field bg-brand-50 px-3.5 py-2.5 text-[13px] text-brand-800"
                  >
                    <UiIcon name="info" :size="16" class="mt-0.5 shrink-0" />
                    {{ actionResult }}
                  </p>
                </div>
              </template>

              <template v-else>
                <div class="flex items-center justify-between gap-3">
                  <p class="text-[13px] font-semibold text-ink-700">
                    {{ t("cfg.recordsCountLabel", { n: draftRecords.length }) }}
                  </p>
                  <UiButton
                    variant="secondary"
                    size="sm"
                    @click="openRecordForm"
                  >
                    <UiIcon name="plus" :size="15" />
                    {{ t("common.add") }}
                  </UiButton>
                </div>

                <ul
                  class="divide-y divide-ink-100 rounded-field ring-1 ring-ink-200"
                >
                  <li
                    v-if="!draftRecords.length"
                    class="px-4 py-8 text-center text-[13px] text-ink-500"
                  >
                    {{ t("cfg.noRecords") }}
                  </li>
                  <li
                    v-for="r in draftRecords"
                    :key="r.code"
                    class="flex items-center gap-3 px-4 py-2.5"
                  >
                    <span
                      class="tabular shrink-0 rounded-[6px] bg-ink-100 px-2 py-1 text-[12px] font-semibold text-ink-700"
                    >
                      {{ r.code }}
                    </span>
                    <span
                      class="min-w-0 flex-1 truncate text-[13px] text-ink-800"
                    >
                      {{ recordLabel(r) }}
                    </span>
                    <button
                      type="button"
                      class="shrink-0 rounded-[6px] p-1.5 text-ink-400 transition-colors hover:bg-danger-50 hover:text-danger-600"
                      :aria-label="
                        t('cfg.removeRecordAria', { label: recordLabel(r) })
                      "
                      @click="removeRecord(r.code)"
                    >
                      <UiIcon name="trash" :size="16" />
                    </button>
                  </li>
                </ul>

                <p class="text-[12px] leading-relaxed text-ink-500">
                  {{ t("cfg.saveNote") }}
                </p>
              </template>
            </div>

            <footer
              class="flex items-center justify-between gap-3 border-t border-ink-200 bg-surface-sunken px-6 py-4"
            >
              <UiButton variant="danger" size="sm" @click="archiveOpen = true">
                <UiIcon name="box" :size="16" />
                {{ t("cfg.archive") }}
              </UiButton>
              <span class="flex gap-3">
                <UiButton variant="ghost" @click="panelOpen = false">
                  {{ t("common.cancel") }}
                </UiButton>
                <UiButton :disabled="!draftValid" @click="savePanel">{{
                  t("common.save")
                }}</UiButton>
              </span>
            </footer>
          </aside>
        </div>
      </Transition>
    </Teleport>

    <UiModal v-model="recordOpen" :title="t('cfg.addRecord')" size="sm">
      <div class="space-y-4">
        <UiField
          :label="field('code')"
          required
          :error="
            recordError ||
            (recordTouched && !newRecord.code.trim()
              ? t('cfg.codeRequired')
              : '')
          "
        >
          <UiInput v-model="newRecord.code" :placeholder="t('cfg.egCode')" />
        </UiField>
        <UiField
          :label="field('name')"
          required
          :error="
            recordTouched && !newRecord.label.trim()
              ? t('cfg.nameRequired')
              : ''
          "
        >
          <UiInput
            v-model="newRecord.label"
            :placeholder="t('cfg.recordNamePlaceholder')"
          />
        </UiField>
      </div>
      <template #footer>
        <UiButton variant="ghost" @click="recordOpen = false">{{
          t("common.cancel")
        }}</UiButton>
        <UiButton @click="submitRecord">{{ t("common.add") }}</UiButton>
      </template>
    </UiModal>

    <UiModal v-model="actionOpen" :title="actionInfo.title" size="sm">
      <p class="text-[14px] leading-relaxed text-ink-700">
        {{ actionInfo.text }}
      </p>
      <template #footer>
        <UiButton variant="ghost" @click="actionOpen = false">{{
          t("common.cancel")
        }}</UiButton>
        <UiButton @click="confirmAction">{{
          actionInfo.confirmLabel
        }}</UiButton>
      </template>
    </UiModal>

    <UiModal
      v-model="archiveOpen"
      :title="t('cfg.archiveRef')"
      :subtitle="t('cfg.archiveRefCaption')"
      size="sm"
    >
      <p class="text-[14px] leading-relaxed text-ink-700">
        {{
          t("cfg.archiveRefText", { name: entryName(draft), code: draft.code })
        }}
      </p>
      <template #footer>
        <UiButton variant="ghost" @click="archiveOpen = false">{{
          t("common.cancel")
        }}</UiButton>
        <UiButton variant="danger" @click="confirmArchive">{{
          t("cfg.archive")
        }}</UiButton>
      </template>
    </UiModal>
  </main>
</template>
