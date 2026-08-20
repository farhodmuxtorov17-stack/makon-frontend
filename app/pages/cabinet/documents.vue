<script setup lang="ts">
import { buildingById } from "~/data/buildings";
import {
  CONTRACTS,
  INVOICES,
  type Contract,
  type Invoice,
} from "~/data/business";
import { UNITS, type Unit } from "~/data/units";
import {
  formatStir,
  LANDLORD_STIR,
  ORGANIZATIONS,
  organizationByStir,
} from "~/data/organizations";
import {
  csvBlob,
  docxBlob,
  fileSize,
  fileSlug,
  saveBlob,
  type DocxLine,
} from "~/utils/docx";
import { area, dateShort, monthTitle, num, sum } from "~/utils/format";

const auth = useAuthStore();
const lease = useLeaseStore();
const { t } = useI18n();
const { field, statusLabel, monthName } = useAppLabels();

lease.seed();

/** Hisob davri ma’lumotda «Avgust 2026» ko‘rinishida saqlanadi */
const UZ_MONTHS = [
  "Yanvar",
  "Fevral",
  "Mart",
  "Aprel",
  "May",
  "Iyun",
  "Iyul",
  "Avgust",
  "Sentabr",
  "Oktabr",
  "Noyabr",
  "Dekabr",
];

/** «Avgust 2026» → tanlangan tildagi davr nomi */
function periodLabel(label: string) {
  const [month, year] = String(label ?? "").split(" ");
  const index = UZ_MONTHS.indexOf(month ?? "");
  if (index < 0 || !year) return label;
  return t("dateFormat.monthTitle", { month: monthName(index + 1), year });
}

/**
 * Ma’lumotda o‘zbekcha qiymat sifatida saqlanadigan ro‘yxatlar: qiymat
 * o‘zgarmaydi (filtr ishlashda qoladi), faqat ko‘rinadigan nom tarjima qilinadi.
 */
const PAYMENT_TERM_KEY: Record<string, string> = {
  "Bir martalik to‘lov": "paymentTerm.oneTime",
  "Choraklik to‘lov": "paymentTerm.quarterly",
  "Oylik oldindan to‘lov": "paymentTerm.monthlyAdvance",
};

const METER_TYPE_KEY: Record<string, string> = {
  Suv: "meterType.water",
  Elektr: "meterType.electricity",
  Issiqlik: "meterType.heating",
};

const METER_PLACE_KEY: Record<string, string> = {
  "sanuzel tuguni": "meterPlace.water",
  "kirish shchiti": "meterPlace.electricity",
  "issiqlik tuguni": "meterPlace.heating",
};

const CATEGORY_KEY: Record<string, string> = {
  Shartnoma: "field.contract",
  Dalolatnoma: "cab.catAct",
  "Hisob-faktura": "field.invoice",
  Qoidalar: "cab.catRules",
};

function labelOf(map: Record<string, string>, value: string) {
  const key = map[value];
  return key ? t(key) : value;
}

const paymentTermLabel = (value: string) => labelOf(PAYMENT_TERM_KEY, value);
const meterTypeLabel = (value: string) => labelOf(METER_TYPE_KEY, value);
const meterPlaceLabel = (value: string) => labelOf(METER_PLACE_KEY, value);
const categoryLabel = (value: string) => labelOf(CATEGORY_KEY, value);

/** Kabinet faqat kirgan foydalanuvchining tashkiloti bilan ishlaydi */
const organization = computed(() => auth.user?.organization ?? "");

const myUnits = computed(() =>
  UNITS.filter((u) => organization.value && u.tenant === organization.value),
);

const myContracts = computed(() =>
  CONTRACTS.filter(
    (c) => organization.value && c.tenant === organization.value,
  ),
);

const myInvoices = computed(() =>
  INVOICES.filter((i) => organization.value && i.tenant === organization.value),
);

/** «Unit 501» va «501» yozuvlari bir xil unitga ishora qiladi */
function unitCodeOf(value: string) {
  return String(value ?? "")
    .replace(/^\s*Unit\s*/i, "")
    .trim();
}

function unitOf(code: string, buildingId?: string): Unit | undefined {
  const clean = unitCodeOf(code);
  return UNITS.find(
    (u) => u.code === clean && (!buildingId || u.buildingId === buildingId),
  );
}

function buildingNameOf(buildingId: string, fallback: string) {
  return buildingById(buildingId)?.name ?? fallback;
}

// ---------------------------------------------------------------------------
// Tomonlar rekvizitlari

interface PartyRequisites {
  name: string;
  stir: string;
  address: string;
  director: string;
  bank: string;
  account: string;
}

const landlord = computed<PartyRequisites>(() => {
  const o = organizationByStir(LANDLORD_STIR);
  return {
    name: o?.name ?? "",
    stir: formatStir(o?.stir ?? LANDLORD_STIR),
    address: o?.address ?? "",
    director: o?.director ?? "",
    bank: o?.bank ?? "",
    account: o?.account ?? "",
  };
});

const tenantParty = computed<PartyRequisites>(() => {
  const o =
    organizationByStir(auth.user?.tin ?? "") ??
    ORGANIZATIONS.find((x) => x.name === organization.value);
  return {
    name: o?.name ?? organization.value,
    stir: formatStir(o?.stir ?? auth.user?.tin ?? ""),
    address: o?.address ?? auth.user?.address ?? "",
    director: o?.director ?? auth.user?.fullName ?? "",
    bank: o?.bank ?? "",
    account: o?.account ?? "",
  };
});

function partyRows(p: PartyRequisites) {
  return [
    { label: field("name"), value: p.name },
    { label: "STIR", value: p.stir },
    { label: field("legalAddress"), value: p.address },
    { label: field("bank"), value: p.bank },
    { label: field("account"), value: p.account },
    { label: field("director"), value: p.director },
  ].filter((r) => r.value);
}

function partyLines(title: string, p: PartyRequisites): DocxLine[] {
  return [
    { text: title, style: "heading" },
    ...partyRows(p).map((r) => ({ text: `${r.label}: ${r.value}` })),
  ];
}

// ---------------------------------------------------------------------------
// Hisoblagichlar

/**
 * Maydon topshirilgan kuni qayd etilgan boshlang‘ich ko‘rsatkichlar.
 * Dalolatnoma o‘sha kungi holatni qayd etadi, shuning uchun keyingi o‘qishlar
 * bu qiymatlarni o‘zgartirmaydi: joriy ko‘rsatkichlar «Hisoblagichlar»
 * bo‘limida turadi va shu qiymatlardan boshlab hisoblanadi.
 */
const HANDOVER_METERS = [
  {
    type: "Suv",
    code: "MTR-SV-0014",
    serial: "SV-442716",
    unit: "m³",
    place: "sanuzel tuguni",
    reading: 90.7,
  },
  {
    type: "Elektr",
    code: "MTR-EL-0032",
    serial: "EL-884733",
    unit: "kVt-soat",
    place: "kirish shchiti",
    reading: 1022.6,
  },
  {
    type: "Issiqlik",
    code: "MTR-IS-0009",
    serial: "IS-770418",
    unit: "Gkal",
    place: "issiqlik tuguni",
    reading: 27.4,
  },
];

// ---------------------------------------------------------------------------
// Hujjatlar reyestri: shartnoma, hisob-faktura va unit ma’lumotidan yig‘iladi

type DocCategory = "Shartnoma" | "Dalolatnoma" | "Hisob-faktura" | "Qoidalar";
type DocFormat = "DOCX" | "CSV";

interface CabinetDocument {
  id: string;
  name: string;
  /** Fayl nomi uchun barqaror lotin qismi: tarjima bilan o‘zgarmaydi */
  slug: string;
  code: string;
  category: DocCategory;
  /** Hujjat tarkibini quruvchi shakl */
  kind:
    | "contract"
    | "schedule"
    | "handover"
    | "equipment"
    | "meters"
    | "invoice"
    | "requisites"
    | "rules"
    | "fire";
  unitCode: string;
  format: DocFormat;
  at: string;
  summary: string;
  contractCode?: string;
  invoiceCode?: string;
  unitId?: string;
  buildingName?: string;
}

const VAT_RATE = 12;

function vatOf(total: number) {
  return Math.round(total - total / (1 + VAT_RATE / 100));
}

function addMonthsIso(iso: string, months: number) {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function monthsBetween(startIso: string, endIso: string) {
  const s = new Date(`${startIso}T00:00:00`);
  const e = new Date(`${endIso}T00:00:00`);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 12;
  const diff =
    (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
  return Math.max(1, Math.round(diff));
}

/** Shartnoma bo‘yicha oylik ijara to‘lovi: unit narxi shartnoma stavkasidir */
function monthlyRentOf(c: Contract) {
  const u = unitOf(c.unitCode, c.buildingId);
  if (u && u.priceUnit === "so‘m / oy") return u.price;
  return Math.round(c.amount / monthsBetween(c.startsAt, c.endsAt));
}

const DOCUMENTS = computed<CabinetDocument[]>(() => {
  const out: CabinetDocument[] = [];

  for (const c of myContracts.value) {
    const code = c.code.replace(/^MKON/, "");
    const unitCode = unitCodeOf(c.unitCode);
    const u = unitOf(c.unitCode, c.buildingId);
    const building = buildingNameOf(c.buildingId, c.buildingName);
    const base = {
      unitCode,
      unitId: u?.id,
      buildingName: building,
      contractCode: c.code,
    };

    out.push(
      {
        ...base,
        id: `${c.id}-contract`,
        name: t("cab.docLease"),
        slug: "ijara-shartnomasi",
        code: c.code,
        category: "Shartnoma",
        kind: "contract",
        format: "DOCX",
        at: c.startsAt,
        summary: t("cab.sumContract", {
          building,
          unit: unitCode,
          from: dateShort(c.startsAt),
          to: dateShort(c.endsAt),
        }),
      },
      {
        ...base,
        id: `${c.id}-schedule`,
        name: t("cab.docSchedule"),
        slug: "to-lov-jadvali",
        code: c.code,
        category: "Shartnoma",
        kind: "schedule",
        format: "CSV",
        at: c.startsAt,
        summary: t("cab.sumSchedule", {
          term: paymentTermLabel(c.paymentTerm).toLowerCase(),
        }),
      },
      {
        ...base,
        id: `${c.id}-handover`,
        name: t("cab.docHandover"),
        slug: "qabul-topshirish-akti",
        code: `DLT${code}`,
        category: "Dalolatnoma",
        kind: "handover",
        format: "DOCX",
        at: c.startsAt,
        summary: t("cab.sumHandover", { unit: unitCode }),
      },
      {
        ...base,
        id: `${c.id}-equipment`,
        name: t("cab.docEquipment"),
        slug: "jihozlar-royxati-dalolatnomasi",
        code: `JIH${code}`,
        category: "Dalolatnoma",
        kind: "equipment",
        format: "DOCX",
        at: c.startsAt,
        summary: t("cab.sumEquipment", { unit: unitCode }),
      },
      {
        ...base,
        id: `${c.id}-meters`,
        name: t("cab.docMeters"),
        slug: "hisoblagich-korsatkichlari-dalolatnomasi",
        code: `HSB${code}`,
        category: "Dalolatnoma",
        kind: "meters",
        format: "DOCX",
        at: c.startsAt,
        summary: t("cab.sumMeters"),
      },
    );
  }

  for (const i of myInvoices.value) {
    const u = unitOf(i.unitCode);
    out.push({
      id: `${i.id}-invoice`,
      name: t("field.invoice"),
      slug: "hisob-faktura",
      code: i.code,
      category: "Hisob-faktura",
      kind: "invoice",
      unitCode: unitCodeOf(i.unitCode),
      unitId: u?.id,
      buildingName: i.buildingName,
      invoiceCode: i.code,
      format: "DOCX",
      at: i.issuedAt,
      summary: t("cab.sumInvoice", {
        period: periodLabel(i.period),
        building: i.buildingName,
        unit: i.unitCode,
      }),
    });
  }

  if (out.length) {
    const building = myUnits.value[0]
      ? buildingNameOf(myUnits.value[0].buildingId, "")
      : myContracts.value[0]
        ? buildingNameOf(
            myContracts.value[0].buildingId,
            myContracts.value[0].buildingName,
          )
        : "";

    out.push(
      {
        id: "gen-requisites",
        name: t("cab.docRequisites"),
        slug: "to-lov-rekvizitlari",
        code: "REK-2025-0044",
        category: "Qoidalar",
        kind: "requisites",
        unitCode: "Umumiy",
        buildingName: building,
        format: "DOCX",
        at: "2026-04-17",
        summary: t("cab.sumRequisites"),
      },
      {
        id: "gen-rules",
        name: t("cab.docRules"),
        slug: "bino-ichki-tartib-qoidalari",
        code: "QDL-2025-0007",
        category: "Qoidalar",
        kind: "rules",
        unitCode: "Umumiy",
        buildingName: building,
        format: "DOCX",
        at: "2026-04-17",
        summary: t("cab.sumRules"),
      },
      {
        id: "gen-fire",
        name: t("cab.docFire"),
        slug: "yong-in-xavfsizligi-yo-riqnomasi",
        code: "QDL-2025-0011",
        category: "Qoidalar",
        kind: "fire",
        unitCode: "Umumiy",
        buildingName: building,
        format: "DOCX",
        at: "2026-04-17",
        summary: t("cab.sumFire"),
      },
    );
  }

  return out;
});

const CATEGORY_TONE: Record<string, string> = {
  Shartnoma: "bg-brand-50 text-brand-600",
  Dalolatnoma: "bg-info-50 text-info-600",
  "Hisob-faktura": "bg-ok-50 text-ok-600",
  Qoidalar: "bg-warn-50 text-warn-600",
};

const category = ref("all");
const format = ref("all");
const query = ref("");

const categoryTabs = computed(() => {
  const count = (key: DocCategory) =>
    DOCUMENTS.value.filter((d) => d.category === key).length;
  return [
    { value: "all", label: t("tab.all"), count: DOCUMENTS.value.length },
    {
      value: "Shartnoma",
      label: categoryLabel("Shartnoma"),
      count: count("Shartnoma"),
    },
    {
      value: "Dalolatnoma",
      label: categoryLabel("Dalolatnoma"),
      count: count("Dalolatnoma"),
    },
    {
      value: "Hisob-faktura",
      label: categoryLabel("Hisob-faktura"),
      count: count("Hisob-faktura"),
    },
    {
      value: "Qoidalar",
      label: categoryLabel("Qoidalar"),
      count: count("Qoidalar"),
    },
  ];
});

/** Filtrda faqat haqiqatan yaratiladigan formatlar ko‘rinadi */
const formatOptions = computed(() => [
  { value: "all", label: t("filter.allFormats") },
  ...[...new Set(DOCUMENTS.value.map((d) => d.format))].map((f) => ({
    value: f,
    label: f,
  })),
]);

// ---------------------------------------------------------------------------
// Hujjat matni: har bir kategoriya uchun alohida shakl

function contractOf(d: CabinetDocument) {
  return CONTRACTS.find((c) => c.code === d.contractCode);
}

function invoiceOf(d: CabinetDocument): Invoice | undefined {
  return INVOICES.find((i) => i.code === d.invoiceCode);
}

function unitOfDoc(d: CabinetDocument) {
  return d.unitId ? UNITS.find((u) => u.id === d.unitId) : undefined;
}

function headerLines(d: CabinetDocument): DocxLine[] {
  return [
    { text: landlord.value.name, style: "subtitle" },
    { text: d.name, style: "title" },
    { text: `${d.code} · ${dateShort(d.at)}`, style: "subtitle" },
  ];
}

function signatureLines(): DocxLine[] {
  return [
    {
      text: t("cab.docSignLandlord", { name: landlord.value.director }),
      style: "small",
    },
    {
      text: t("cab.docSignTenant", { name: tenantParty.value.director }),
      style: "small",
    },
  ];
}

function objectLines(d: CabinetDocument): DocxLine[] {
  const u = unitOfDoc(d);
  const rows: DocxLine[] = [
    { text: t("cab.leaseObject"), style: "heading" },
    { text: t("cab.docObject", { value: d.buildingName ?? "-" }) },
    { text: t("cab.docUnit", { value: d.unitCode }) },
  ];
  if (u) {
    rows.push(
      { text: t("cab.docArea", { value: area(u.area) }) },
      { text: t("cab.docFloorRooms", { floor: u.floor, rooms: u.rooms }) },
      { text: t("cab.docPurpose", { value: u.usage || "-" }) },
    );
  }
  return rows;
}

/** Shartnoma bo‘yicha to‘lov davrlari: faol sikl grafigi yoki shartnoma shartlari */
function scheduleRows(c: Contract) {
  const item = lease.cases.find((x) => x.contract?.code === c.code);
  if (item && item.schedule.length) {
    return item.schedule.map((r, index) => ({
      no: index + 1,
      label: r.label,
      dueAt: r.dueAt,
      rent: r.rent,
      service: r.service,
      total: r.total,
    }));
  }

  const months = monthsBetween(c.startsAt, c.endsAt);
  const monthly = monthlyRentOf(c);
  return Array.from({ length: months }, (_, index) => {
    const dueAt = addMonthsIso(c.startsAt, index);
    return {
      no: index + 1,
      label: monthTitle(dueAt),
      dueAt,
      rent: monthly,
      service: 0,
      total: monthly,
    };
  });
}

function documentRows(d: CabinetDocument): Array<Array<string | number>> {
  const c = contractOf(d);
  if (!c) return [[t("cab.dataNotFound")]];
  const rows = scheduleRows(c);
  const head: Array<Array<string | number>> = [
    [t("cab.csvScheduleTitle", { code: c.code })],
    [
      t("cab.csvLandlord", {
        name: landlord.value.name,
        stir: landlord.value.stir,
      }),
    ],
    [
      t("cab.csvTenant", {
        name: tenantParty.value.name,
        stir: tenantParty.value.stir,
      }),
    ],
    [
      t("cab.docObject", {
        value: `${d.buildingName ?? "-"} · Unit ${d.unitCode}`,
      }),
    ],
    [],
    [
      "№",
      field("period"),
      t("cab.csvPayDate"),
      t("cab.csvRent"),
      t("cab.csvService"),
      t("cab.csvVat", { rate: VAT_RATE }),
      t("cab.csvTotal"),
    ],
  ];
  for (const r of rows) {
    head.push([
      r.no,
      periodLabel(r.label),
      dateShort(r.dueAt),
      r.rent,
      r.service,
      vatOf(r.total),
      r.total,
    ]);
  }
  const total = rows.reduce((a, r) => a + r.total, 0);
  head.push([], [t("common.total"), "", "", "", "", vatOf(total), total]);
  return head;
}

function documentLines(d: CabinetDocument): DocxLine[] {
  const lines: DocxLine[] = headerLines(d);
  const c = contractOf(d);
  const u = unitOfDoc(d);

  if (d.kind === "contract" && c) {
    const months = monthsBetween(c.startsAt, c.endsAt);
    const monthly = monthlyRentOf(c);
    lines.push(
      ...partyLines(field("landlord"), landlord.value),
      ...partyLines(field("tenant"), tenantParty.value),
      ...objectLines(d),
      { text: t("cab.contractTerms"), style: "heading" },
      { text: t("cab.docContractNo", { value: c.code }) },
      {
        text: t("cab.docValidity", {
          from: dateShort(c.startsAt),
          to: dateShort(c.endsAt),
          months,
        }),
      },
      {
        text: t("cab.docMonthlyRent", {
          value: sum(monthly),
          rate: VAT_RATE,
          vat: sum(vatOf(monthly)),
        }),
      },
      { text: t("cab.docTermTotal", { value: sum(monthly * months) }) },
      {
        text: t("cab.docPaymentForm", {
          value: paymentTermLabel(c.paymentTerm),
        }),
      },
      {
        text: t("cab.docContractStatus", {
          value: statusLabel("contract", c.status),
        }),
      },
      { text: t("cab.partyObligations"), style: "heading" },
      { text: t("cab.obligationLandlord") },
      { text: t("cab.obligationTenant") },
    );
  } else if (d.kind === "handover") {
    lines.push(
      { text: t("cab.parties"), style: "heading" },
      {
        text: t("cab.docHandedBy", {
          name: landlord.value.name,
          director: landlord.value.director,
        }),
      },
      {
        text: t("cab.docReceivedBy", {
          name: tenantParty.value.name,
          director: tenantParty.value.director,
        }),
      },
      { text: t("cab.docHandoverDate", { value: dateShort(d.at) }) },
      ...(c ? [{ text: t("cab.docContract", { value: c.code }) }] : []),
      ...objectLines(d),
      { text: t("cab.handoverItems"), style: "heading" },
      { text: t("cab.handoverItem1", { area: u ? area(u.area) : "-" }) },
      { text: t("cab.handoverItem2") },
      { text: t("cab.handoverItem3") },
      { text: t("cab.handoverItem4") },
      { text: t("cab.conclusion"), style: "heading" },
      { text: t("cab.handoverConclusion") },
    );
  } else if (d.kind === "equipment") {
    lines.push(
      { text: t("cab.parties"), style: "heading" },
      {
        text: t("cab.docHandedBy", {
          name: landlord.value.name,
          director: landlord.value.director,
        }),
      },
      {
        text: t("cab.docReceivedBy", {
          name: tenantParty.value.name,
          director: tenantParty.value.director,
        }),
      },
      { text: t("cab.docHandoverDate", { value: dateShort(d.at) }) },
      ...objectLines(d),
      { text: t("cab.equipmentList"), style: "heading" },
    );
    const equipment = u?.equipment ?? [];
    if (equipment.length) {
      equipment.forEach((e, index) => {
        lines.push({
          text: t("cab.equipmentItem", { no: index + 1, name: e }),
        });
      });
    } else {
      lines.push({ text: t("cab.noEquipment") });
    }
    lines.push(
      { text: t("cab.conclusion"), style: "heading" },
      { text: t("cab.equipmentConclusion") },
    );
  } else if (d.kind === "meters") {
    lines.push(
      { text: t("cab.parties"), style: "heading" },
      {
        text: t("cab.docHandedBy", {
          name: landlord.value.name,
          director: landlord.value.director,
        }),
      },
      {
        text: t("cab.docReceivedBy", {
          name: tenantParty.value.name,
          director: tenantParty.value.director,
        }),
      },
      { text: t("cab.docRecordedDate", { value: dateShort(d.at) }) },
      ...objectLines(d),
      { text: t("cab.initialReadings"), style: "heading" },
    );
    HANDOVER_METERS.forEach((m, index) => {
      lines.push({
        text: t("cab.meterDocLine", {
          no: index + 1,
          type: meterTypeLabel(m.type),
          code: m.code,
          serial: m.serial,
          location: t("cab.meterLocation", {
            unit: d.unitCode,
            place: meterPlaceLabel(m.place),
          }),
          reading: `${num(m.reading, 2)} ${m.unit}`,
        }),
      });
    });
    lines.push(
      { text: t("cab.conclusion"), style: "heading" },
      { text: t("cab.metersConclusion") },
    );
  } else if (d.kind === "invoice") {
    const inv = invoiceOf(d);
    if (inv) {
      // Hisob-faktura shartnomasi: unit kodi va ijarachi bo‘yicha topiladi
      const invContract =
        c ??
        myContracts.value.find(
          (x) =>
            unitCodeOf(x.unitCode) === unitCodeOf(inv.unitCode) &&
            x.status === "ACTIVE",
        );
      const monthly = invContract ? monthlyRentOf(invContract) : inv.total;
      const rent = Math.min(monthly || inv.total, inv.total);
      const rest = inv.total - rent;
      lines.push(
        ...partyLines(t("cab.supplierLandlord"), landlord.value),
        ...partyLines(t("cab.buyerTenant"), tenantParty.value),
        { text: t("cab.invoiceInfo"), style: "heading" },
        {
          text: t("cab.docObject", {
            value: `${inv.buildingName} · ${inv.unitCode}`,
          }),
        },
        { text: t("cab.docBillingPeriod", { value: periodLabel(inv.period) }) },
        { text: t("cab.docIssuedAt", { value: dateShort(inv.issuedAt) }) },
        { text: t("cab.docDueAt", { value: dateShort(inv.dueAt) }) },
        ...(invContract
          ? [
              {
                text: t("cab.docContract", {
                  value: `${invContract.code} · ${dateShort(invContract.startsAt)}`,
                }),
              },
              {
                text: t("cab.docPaymentForm", {
                  value: paymentTermLabel(invContract.paymentTerm),
                }),
              },
            ]
          : []),
        { text: t("cab.services"), style: "heading" },
        {
          text: t("cab.docServiceLine", {
            no: 1,
            service: t("cab.rentPayment"),
            qty: 1,
            unit: t("unitOf.month"),
            tariff: sum(rent),
            rate: VAT_RATE,
            vat: sum(vatOf(rent)),
            total: sum(rent),
          }),
        },
      );
      if (rest > 0) {
        lines.push({
          text: t("cab.docServiceLine", {
            no: 2,
            service: t("cab.serviceAndManagement"),
            qty: 1,
            unit: t("unitOf.month"),
            tariff: sum(rest),
            rate: VAT_RATE,
            vat: sum(vatOf(rest)),
            total: sum(rest),
          }),
        });
      }
      lines.push(
        { text: t("cab.summary"), style: "heading" },
        {
          text: t("cab.docNetTotal", {
            value: sum(inv.total - vatOf(inv.total)),
          }),
        },
        {
          text: t("cab.docVat", {
            rate: VAT_RATE,
            value: sum(vatOf(inv.total)),
          }),
        },
        { text: t("cab.docTotalPayment", { value: sum(inv.total) }) },
        { text: t("cab.docPaid", { value: sum(inv.paid) }) },
        {
          text: t("cab.docBalance", {
            value: sum(Math.max(inv.total - inv.paid, 0)),
          }),
        },
      );
    }
  } else if (d.kind === "requisites") {
    lines.push(
      ...partyLines(t("cab.landlordRequisites"), landlord.value),
      ...partyLines(t("cab.payerRequisites"), tenantParty.value),
      { text: t("cab.paymentOrderRules"), style: "heading" },
      {
        text: t("cab.payRule1", {
          name: landlord.value.name,
          stir: landlord.value.stir,
        }),
      },
      {
        text: t("cab.payRule2", {
          account: landlord.value.account,
          bank: landlord.value.bank,
        }),
      },
      {
        text: t("cab.payRule3", {
          code: myInvoices.value[0]?.code ?? "INV-YYYY-NNNN",
        }),
      },
      { text: t("cab.payRule4", { rate: VAT_RATE }) },
      { text: t("cab.payRule5") },
    );
    if (myContracts.value.length) {
      lines.push({ text: t("cab.activeContracts"), style: "heading" });
      myContracts.value.forEach((x, index) => {
        lines.push({
          text: t("cab.contractLine", {
            no: index + 1,
            code: x.code,
            unit: unitCodeOf(x.unitCode),
            term: paymentTermLabel(x.paymentTerm),
          }),
        });
      });
    }
  } else if (d.kind === "rules") {
    lines.push(
      { text: t("cab.generalRules"), style: "heading" },
      { text: t("cab.docObject", { value: d.buildingName ?? "-" }) },
      { text: t("cab.rule1") },
      { text: t("cab.rule2") },
      { text: t("cab.rule3") },
      { text: t("cab.rule4") },
      { text: t("cab.rule5") },
      { text: t("cab.rule6") },
      { text: t("cab.liability"), style: "heading" },
      { text: t("cab.rulesLiability") },
    );
  } else if (d.kind === "fire") {
    lines.push(
      { text: t("cab.requirements"), style: "heading" },
      { text: t("cab.docObject", { value: d.buildingName ?? "-" }) },
      { text: t("cab.fire1") },
      { text: t("cab.fire2") },
      { text: t("cab.fire3") },
      { text: t("cab.fire4") },
      { text: t("cab.fire5") },
      { text: t("cab.responsibility"), style: "heading" },
      { text: t("cab.fireResponsibility") },
    );
  }

  lines.push(
    { text: t("cab.contentSection"), style: "heading" },
    { text: d.summary },
  );

  if (d.kind !== "requisites" && d.kind !== "rules" && d.kind !== "fire") {
    lines.push(...signatureLines());
  }

  return lines;
}

/** Yuklab olinadigan faylning haqiqiy o‘zi: hajmi ham shundan olinadi */
function blobOf(d: CabinetDocument) {
  return d.format === "CSV"
    ? csvBlob(documentRows(d))
    : docxBlob(documentLines(d));
}

/** Fayl nomi hujjat nomini ham, kodini ham o‘z ichiga oladi: nusxalar bosib ketmaydi */
function fileNameOf(d: CabinetDocument) {
  return `${fileSlug(d.slug)}-${d.code}.${d.format.toLowerCase()}`;
}

const filtered = computed(() =>
  DOCUMENTS.value.filter((d) => {
    const byCategory =
      category.value === "all" || d.category === category.value;
    const byFormat = format.value === "all" || d.format === format.value;
    const q = query.value.trim().toLowerCase();
    const byQuery =
      !q ||
      d.name.toLowerCase().includes(q) ||
      d.code.toLowerCase().includes(q) ||
      d.summary.toLowerCase().includes(q);
    return byCategory && byFormat && byQuery;
  }),
);

/** Jadval qatorlari: hajm haqiqiy fayl baytlaridan hisoblanadi */
const rows = computed(() =>
  filtered.value.map((d) => ({ ...d, size: fileSize(blobOf(d).size) })),
);

const columns = computed(() => [
  { key: "name", label: field("documentName") },
  { key: "category", label: field("category") },
  { key: "unitCode", label: field("unit") },
  { key: "format", label: field("format") },
  { key: "size", label: field("size"), align: "right" as const },
  { key: "at", label: field("date"), align: "right" as const },
  { key: "actions", label: field("actions"), align: "right" as const },
]);

const previewOpen = ref(false);
const downloadOpen = ref(false);
const selected = ref<CabinetDocument | null>(null);
const savedFile = ref("");

function openPreview(d: CabinetDocument | undefined) {
  if (!d) return;
  selected.value = d;
  previewOpen.value = true;
}

function openDownload(d: CabinetDocument | undefined) {
  if (!d) return;
  selected.value = d;
  savedFile.value = "";
  downloadOpen.value = true;
}

function docById(id: unknown) {
  return DOCUMENTS.value.find((d) => d.id === id);
}

/** Ko‘rish oynasidagi hujjat matni: yuklab olinadigan fayl bilan bir xil manba */
const previewLines = computed(() =>
  selected.value && selected.value.format === "DOCX"
    ? documentLines(selected.value)
    : [],
);

const previewTable = computed(() =>
  selected.value && selected.value.format === "CSV"
    ? documentRows(selected.value)
    : [],
);

const outputFile = computed(() => {
  const d = selected.value;
  if (!d) return null;
  return {
    name: fileNameOf(d),
    size: fileSize(blobOf(d).size),
    format: d.format,
  };
});

function downloadDocument() {
  const d = selected.value;
  if (!d) return;
  const fileName = fileNameOf(d);
  saveBlob(blobOf(d), fileName);
  savedFile.value = fileName;
}

/** Kabinet bosh sahifasidan kelgan havola tegishli hujjatni ochadi */
const route = useRoute();

onMounted(() => {
  const code = String(route.query.hujjat ?? "");
  if (!code) return;
  openPreview(DOCUMENTS.value.find((d) => d.code === code));
});
</script>

<template>
  <AppTopbar
    :title="t('nav.myDocuments')"
    :subtitle="t('cab.documentsCaption')"
    :breadcrumb="[
      { label: t('cab.title'), to: '/cabinet' },
      { label: t('nav.myDocuments') },
    ]"
  >
    <template #actions>
      <UiButton variant="secondary" size="sm" to="/cabinet/invoices">
        <UiIcon name="wallet" :size="16" />
        {{ t("nav.myInvoices") }}
      </UiButton>
      <UiButton size="sm" to="/cabinet/units">
        <UiIcon name="building" :size="16" />
        {{ t("nav.myUnits") }}
      </UiButton>
    </template>
  </AppTopbar>

  <main class="scroll-slim flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
    <section
      v-if="DOCUMENTS.length"
      class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      <button
        v-for="c in categoryTabs.slice(1)"
        :key="c.value"
        type="button"
        class="rounded-card bg-surface p-4 text-left shadow-card ring-1 transition-all hover:shadow-panel"
        :class="
          category === c.value
            ? 'ring-2 ring-brand-500'
            : 'ring-ink-200/60 hover:ring-brand-300'
        "
        @click="category = category === c.value ? 'all' : c.value"
      >
        <div class="flex items-start justify-between gap-3">
          <span
            class="grid size-10 place-items-center rounded-[10px]"
            :class="CATEGORY_TONE[c.value]"
          >
            <UiIcon name="doc" :size="19" />
          </span>
          <span
            class="tabular text-[22px] font-bold leading-none text-ink-900"
            >{{ c.count }}</span
          >
        </div>
        <p class="mt-3 text-[14px] font-semibold text-ink-900">{{ c.label }}</p>
        <p class="mt-0.5 text-[12px] text-ink-500">
          {{ t("cab.filterByCategory") }}
        </p>
      </button>
    </section>

    <UiCard
      :title="t('cab.documentsList')"
      :subtitle="
        t('cab.documentsSubtitle', {
          org: organization || t('field.organization'),
          n: filtered.length,
        })
      "
      flush
    >
      <UiEmpty
        v-if="!DOCUMENTS.length"
        icon="doc"
        :title="t('empty.noDocumentsFound')"
        :description="t('cab.noDocumentsDesc')"
        :action-label="t('cab.applyForRent')"
        action-to="/cabinet/apply"
      />

      <template v-else>
        <div class="flex flex-wrap items-center gap-3 px-5 pb-4">
          <UiTabs v-model="category" :tabs="categoryTabs" />
          <UiSelect
            v-model="format"
            :options="formatOptions"
            size="sm"
            class="w-44"
          />
          <UiInput
            v-model="query"
            :placeholder="t('cab.docSearchPlaceholder')"
            class="w-full sm:w-80"
          >
            <template #prefix><UiIcon name="search" :size="16" /></template>
          </UiInput>
        </div>

        <UiTable
          :page-size="10"
          :columns="columns"
          :rows="rows"
          :empty="t('empty.noDocumentsForFilter')"
          @row-click="(row) => openPreview(docById(row.id))"
        >
          <template #cell-name="{ row }">
            <span class="flex items-center gap-3">
              <span
                class="grid size-9 shrink-0 place-items-center rounded-[10px]"
                :class="CATEGORY_TONE[String(row.category)]"
              >
                <UiIcon name="doc" :size="17" />
              </span>
              <span class="min-w-0">
                <span
                  class="block truncate text-[14px] font-semibold text-ink-900"
                  >{{ row.name }}</span
                >
                <span class="tabular block truncate text-[12px] text-ink-500">{{
                  row.code
                }}</span>
              </span>
            </span>
          </template>
          <template #cell-category="{ value }">
            <span
              class="rounded-pill bg-ink-100 px-2.5 py-1 text-[12px] font-semibold text-ink-700"
            >
              {{ categoryLabel(String(value)) }}
            </span>
          </template>
          <template #cell-unitCode="{ value }">
            <span class="text-[13px]">
              {{ value === "Umumiy" ? t("common.general") : `Unit ${value}` }}
            </span>
          </template>
          <template #cell-format="{ value }">
            <span class="tabular text-[13px] font-semibold text-ink-700">{{
              value
            }}</span>
          </template>
          <template #cell-at="{ value }">
            <span class="tabular text-[13px]">{{
              dateShort(String(value))
            }}</span>
          </template>
          <template #cell-actions="{ row }">
            <span class="flex items-center justify-end gap-1.5">
              <button
                type="button"
                class="grid size-11 place-items-center rounded-field text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-800 md:size-9"
                :aria-label="t('cab.viewAria', { name: row.name })"
                @click.stop="openPreview(docById(row.id))"
              >
                <UiIcon name="eye" :size="17" />
              </button>
              <button
                type="button"
                class="grid size-11 place-items-center rounded-field text-brand-600 transition-colors hover:bg-brand-50 md:size-9"
                :aria-label="t('cab.downloadAria', { name: row.name })"
                @click.stop="openDownload(docById(row.id))"
              >
                <UiIcon name="download" :size="17" />
              </button>
            </span>
          </template>
        </UiTable>
      </template>
    </UiCard>
  </main>

  <UiModal
    v-model="previewOpen"
    :title="selected?.name ?? field('document')"
    :subtitle="
      selected
        ? `${selected.code} · ${selected.format} · ${outputFile?.size ?? ''}`
        : ''
    "
    size="lg"
  >
    <div v-if="selected" class="space-y-4">
      <div class="rounded-field bg-white p-6 ring-1 ring-ink-200">
        <div
          class="flex flex-wrap items-start justify-between gap-6 border-b border-ink-200 pb-4"
        >
          <div class="min-w-0">
            <span class="text-brand-600"><AppLogo size="sm" mono /></span>
            <p class="mt-2 text-[12px] text-ink-500">{{ landlord.name }}</p>
            <p class="text-[12px] text-ink-500">{{ landlord.address }}</p>
          </div>
          <div class="text-right">
            <p class="text-[16px] font-bold text-ink-900">
              {{ selected.name }}
            </p>
            <p class="tabular text-[13px] font-semibold text-ink-600">
              {{ selected.code }}
            </p>
            <p class="tabular text-[12px] text-ink-500">
              {{ dateShort(selected.at) }}
            </p>
          </div>
        </div>

        <div v-if="previewLines.length" class="pt-4">
          <template v-for="(l, i) in previewLines" :key="`pl-${i}`">
            <p
              v-if="l.style === 'heading'"
              class="mt-4 text-[13px] font-bold uppercase tracking-wide text-ink-700 first:mt-0"
            >
              {{ l.text }}
            </p>
            <p
              v-else-if="l.style === 'title' || l.style === 'subtitle'"
              class="hidden"
            >
              {{ l.text }}
            </p>
            <p
              v-else
              class="mt-1 text-[13px] leading-relaxed"
              :class="l.style === 'small' ? 'text-ink-500' : 'text-ink-700'"
            >
              {{ l.text }}
            </p>
          </template>
        </div>

        <div
          v-else-if="previewTable.length"
          class="scroll-slim overflow-x-auto pt-4"
        >
          <table class="w-full min-w-max border-collapse text-[13px]">
            <tbody>
              <tr
                v-for="(r, i) in previewTable"
                :key="`pt-${i}`"
                class="border-b border-ink-100 last:border-0"
              >
                <td
                  v-for="(cell, j) in r"
                  :key="`pt-${i}-${j}`"
                  class="px-2 py-1.5"
                  :class="[
                    j === 0 ? 'text-ink-800' : 'text-ink-600',
                    typeof cell === 'number'
                      ? 'tabular text-right'
                      : 'text-left',
                  ]"
                >
                  {{ typeof cell === "number" ? num(cell) : cell }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <template #footer>
      <UiButton variant="ghost" @click="previewOpen = false">{{
        t("common.close")
      }}</UiButton>
      <UiButton
        variant="secondary"
        @click="
          () => {
            previewOpen = false;
            if (selected) openDownload(selected);
          }
        "
      >
        <UiIcon name="download" :size="16" />
        {{ t("common.download") }}
      </UiButton>
    </template>
  </UiModal>

  <UiModal
    v-model="downloadOpen"
    :title="t('cab.downloadDocument')"
    :subtitle="selected ? selected.name : ''"
    size="sm"
  >
    <div v-if="selected" class="space-y-4">
      <div
        class="flex items-center gap-3.5 rounded-field bg-surface-sunken p-4 ring-1 ring-ink-200"
      >
        <span
          class="grid size-12 shrink-0 place-items-center rounded-field"
          :class="CATEGORY_TONE[selected.category]"
        >
          <UiIcon name="doc" :size="24" />
        </span>
        <span class="min-w-0">
          <span class="block truncate text-[14px] font-semibold text-ink-900">
            {{ outputFile?.name }}
          </span>
          <span class="block text-[12px] text-ink-500">
            {{ outputFile?.format }} · {{ outputFile?.size }} ·
            {{ dateShort(selected.at) }}
          </span>
        </span>
      </div>

      <p v-if="!savedFile" class="text-[13px] text-ink-600">
        {{ selected.format === "CSV" ? t("cab.csvHint") : t("cab.docxHint") }}
      </p>
      <p
        v-else
        class="flex items-start gap-2 text-[13px] font-semibold text-ok-700"
      >
        <UiIcon name="check" :size="16" class="mt-px shrink-0" />
        <span class="min-w-0">{{
          t("cab.fileSaved", { name: savedFile })
        }}</span>
      </p>
    </div>

    <template #footer>
      <UiButton variant="ghost" @click="downloadOpen = false">{{
        t("common.close")
      }}</UiButton>
      <UiButton @click="downloadDocument">
        <UiIcon name="download" :size="16" />
        {{ t("common.download") }}
      </UiButton>
    </template>
  </UiModal>
</template>
