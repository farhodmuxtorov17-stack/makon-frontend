import { SETTINGS_CHILDREN } from "~/constants/navigation";
import { ROLE_META } from "~/constants/roles";
import {
  DIDOX_KEY,
  PERIODICITY_KEY,
  PRIORITY_KEY,
  STATUS_REGISTRY,
  type StatusKind,
} from "~/constants/statuses";
import { useAuthStore } from "~/stores/auth";
import type { Role } from "~/types/rbac";
import { num } from "~/utils/format";

/** `UiTable` ustuni: nom tarjima kalitidan yoki tayyor matndan olinadi */
export interface LabelColumnDef {
  key: string;
  /** `field.*` guruhidagi qisqa nom, masalan `status` */
  field?: string;
  /** To‘liq tarjima kaliti, masalan `nav.contracts` */
  labelKey?: string;
  /** Lug‘atda kalit topilmasa ko‘rsatiladigan matn */
  label?: string;
  align?: "left" | "right" | "center";
  width?: string;
  numeric?: boolean;
}

export interface LabelColumn {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
  width?: string;
  numeric?: boolean;
}

export interface LabelOption {
  value: string;
  label: string;
}

/**
 * BINO TURI va MAYDON MAQSADI ma’lumotda o‘zbekcha qiymat sifatida saqlanadi
 * (`app/data/buildings.ts`, `app/data/units.ts`). Qiymatning o‘zi kalit
 * vazifasini bajaradi, filtr va solishtirish shu bo‘yicha ishlaydi, shuning
 * uchun u o‘zgarmaydi. Bu yerda faqat ko‘rinadigan nomning tarjima kaliti
 * beriladi.
 */
const BUILDING_TYPE_SLUG: Record<string, string> = {
  "Biznes markaz": "biznesMarkaz",
  "Ofis binosi": "ofisBinosi",
  "Ombor / logistika": "omborLogistika",
  "Savdo markaz": "savdoMarkaz",
  "Turar joy": "turarJoy",
};

const UNIT_USAGE_SLUG: Record<string, string> = {
  Ofis: "office",
  Savdo: "retail",
  Ombor: "warehouse",
  "Turar joy": "residential",
  "Texnik zona": "technical",
};

/** Ro‘yxatda yo‘q qiymat uchun zaxira slug: «Yangi tur» → `yangiTur` */
function slugOf(value: string): string {
  const words = value
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(/\s+/);
  return words
    .map((w, i) => {
      const lower = w.toLowerCase();
      return i === 0 ? lower : lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join("");
}

/**
 * Registrlardagi (rol, status, navigatsiya) nomlarni tanlangan tilda beradi.
 * Kalit topilmasa registrdagi o‘zbekcha nom qaytadi, shuning uchun hali
 * tarjima qilinmagan ekranlar ham to‘g‘ri ishlaydi.
 *
 * Ekranlar uchun qoida: ko‘rinadigan har bir matn shu yerdagi yordamchilar
 * orqali olinsin. Ustun sarlavhasi `columns()`, status `statusLabel()`,
 * modul nomi `moduleTitle()`. Shunda bitta ustun uchun «Status / Holat /
 * Holati» kabi uch xil nom ham, rus tili tanlanganda o‘zbekcha qolib
 * ketadigan ekran ham qolmaydi: lug‘at bitta, u ham `i18n/locales/*.json`.
 */
export function useAppLabels() {
  const { t, te, locale } = useI18n();

  /** Kalit lug‘atda bo‘lsa tarjima, aks holda tayyor matn */
  function tr(key: string | undefined, fallback: string) {
    return key && te(key) ? t(key) : fallback;
  }

  function roleLabel(role: Role | null | undefined) {
    if (!role) return "";
    return tr(`role.${role}.label`, ROLE_META[role].label);
  }

  function roleCaption(role: Role | null | undefined) {
    if (!role) return "";
    return tr(`role.${role}.caption`, ROLE_META[role].caption);
  }

  function statusLabel(kind: StatusKind, value: string) {
    const fallback = STATUS_REGISTRY[kind][value]?.label ?? value;
    return tr(`status.${kind}.${value}`, fallback);
  }

  /**
   * Filtr va tanlov ro‘yxatlari uchun status variantlari. Ekran endi
   * `Object.entries(UNIT_STATUS).map(...)` yozmaydi, aks holda filtrdagi nom
   * nishonchadagi nomdan ajralib qoladi va til almashtirilganda filtr
   * o‘zbekcha qolib ketadi.
   */
  function statusOptions(kind: StatusKind, values?: string[]): LabelOption[] {
    const keys = values ?? Object.keys(STATUS_REGISTRY[kind]);
    return keys.map((value) => ({ value, label: statusLabel(kind, value) }));
  }

  /** `field.*` lug‘atidan ustun yoki maydon sarlavhasi */
  function field(name: string, fallback = "") {
    return tr(`field.${name}`, fallback || name);
  }

  /** Ustunlar ro‘yxatini bir yo‘la tarjima qilib beradi */
  function columns(defs: LabelColumnDef[]): LabelColumn[] {
    return defs.map((d) => ({
      key: d.key,
      label: d.field
        ? field(d.field, d.label ?? d.key)
        : tr(d.labelKey, d.label ?? d.key),
      align: d.align,
      width: d.width,
      numeric: d.numeric,
    }));
  }

  /**
   * Modul nomi: yon menyudagi yozuv va sahifa sarlavhasi bitta kalitdan
   * o‘qiladi, shuning uchun ular hech qachon ajralib ketmaydi.
   */
  function moduleTitle(name: string, fallback = "") {
    return tr(`nav.${name}`, fallback || name);
  }

  /** Sahifa sarlavhasi ostidagi tavsif */
  function moduleCaption(name: string, fallback = "") {
    return tr(`caption.${name}`, fallback);
  }

  /** Breadcrumb bo‘lim nomi: «Billing» kabi tarjimasiz atamalar o‘rniga */
  function sectionLabel(name: string, fallback = "") {
    return tr(`section.${name}`, fallback || name);
  }

  /**
   * Ish topshiriqlari moduli ikki rolda ikki xil ataladi: pudratchi faqat
   * o‘ziga biriktirilganini ko‘radi («Mening ishlarim»), bino rahbari esa
   * butun ro‘yxatni («Ish topshiriqlari»). Sarlavha shu yerda rolga
   * bog‘lanadi, sahifada shart yozilmaydi.
   */
  function workOrdersTitle(role?: Role | null) {
    const actual = role ?? useAuthStore().role;
    return actual === "FACILITY"
      ? moduleTitle("myWorkOrders")
      : moduleTitle("workOrders");
  }

  function workOrdersCaption(role?: Role | null) {
    const actual = role ?? useAuthStore().role;
    return actual === "FACILITY"
      ? moduleCaption("myWorkOrders")
      : moduleCaption("workOrders");
  }

  /** Sozlamalar bo‘limining ichki menyusi: olti sahifada bitta ro‘yxat */
  function settingsNav(): Array<{ label: string; to: string }> {
    return SETTINGS_CHILDREN.map((c) => ({
      label: tr(c.key, c.label),
      to: c.to,
    }));
  }

  /**
   * Ma’lumotda o‘zbekcha qiymat sifatida saqlanadigan ro‘yxatlar. Qiymatning
   * o‘zi o‘zgarmaydi (filtr va solishtirish ishlashda qoladi), faqat
   * ko‘rinadigan nom tarjima qilinadi.
   */
  function priorityLabel(value: string) {
    return tr(PRIORITY_KEY[value], value);
  }

  function periodicityLabel(value: string) {
    return tr(PERIODICITY_KEY[value], value);
  }

  function didoxLabel(value: string) {
    return tr(DIDOX_KEY[value], value);
  }

  /** «Biznes markaz» → `buildingType.biznesMarkaz` */
  function buildingTypeLabel(type: string) {
    if (!type) return "";
    return tr(`buildingType.${BUILDING_TYPE_SLUG[type] ?? slugOf(type)}`, type);
  }

  /** Filtr va tanlov ro‘yxatlari: qiymat o‘zbekcha qoladi, yorliq tarjima qilinadi */
  function buildingTypeOptions(values?: string[]): LabelOption[] {
    const keys = values ?? Object.keys(BUILDING_TYPE_SLUG);
    return keys.map((value) => ({ value, label: buildingTypeLabel(value) }));
  }

  /**
   * «Texnik zona» → `unitUsage.technical`. Kalitlar `unitUsage` guruhida
   * ilgaridan bor edi (content sahifalari ularni ishlatardi), shuning uchun
   * lug‘atda ikkinchi nusxa yaratilmadi.
   */
  function unitUsageLabel(usage: string) {
    if (!usage) return "";
    return tr(`unitUsage.${UNIT_USAGE_SLUG[usage] ?? slugOf(usage)}`, usage);
  }

  function unitUsageOptions(values?: string[]): LabelOption[] {
    const keys = values ?? Object.keys(UNIT_USAGE_SLUG);
    return keys.map((value) => ({ value, label: unitUsageLabel(value) }));
  }

  /**
   * Pul summasi tanlangan tilda: «12 540 000 so‘m» / «12 540 000 сум».
   * `app/utils/format.ts` dagi `sum()` sof funksiya, u tilni bilmaydi va
   * hujjat generatsiyasida (docx, csv) ishlatilishda qoladi. Ekranda
   * ko‘rinadigan summa shu variantdan olinadi.
   */
  function money(value: number) {
    return `${num(value)} ${t("unitOf.currency")}`;
  }

  /**
   * O‘lchov birligi va bino klassi ham ma’lumotda o‘zbekcha yozilgan.
   * Reyestrdagi qiymat kalit bo‘lib qoladi, ekranda tarjimasi chiqadi:
   * «kVt-soat» rus tilida «кВт·ч», «A klass» esa «класс A».
   */
  const UNIT_KEY: Record<string, string> = {
    "kVt-soat": "measure.kwh",
    "ming m³": "measure.thousandM3",
    Gkal: "measure.gcal",
    dona: "measure.piece",
    litr: "measure.litre",
    metr: "measure.metre",
    qop: "measure.sack",
    ballon: "measure.cylinder",
    tuba: "measure.tube",
    "to‘plam": "measure.set",
  };

  function measureLabel(unit: string) {
    const key = UNIT_KEY[unit];
    return key ? t(key) : unit;
  }

  /**
   * Unit taklif turi ma’lumotda «Ijara» yoki «Sotuv» deb saqlanadi.
   * Ekranda tarjimasi ko‘rsatiladi, reyestrdagi qiymat esa o‘zgarmaydi.
   */
  function offerLabel(value: string) {
    if (value === "Sotuv") return t("landing.offerSale");
    if (value === "Ijara") return t("landing.offerRent");
    return value;
  }

  function buildingClassLabel(value: string) {
    const letter = value.replace(/\s*klass\s*/i, "").trim();
    return letter ? t("field.classOf", { letter }) : value;
  }

  /**
   * Ariza turi ham ma’lumotda o‘zbekcha saqlanadi: «Ijaraga olish» yoki
   * «Sotib olish». Ekranda tarjimasi ko‘rsatiladi.
   */
  function requestTypeLabel(value: string) {
    if (value === "Sotib olish") return t("landing.offerSale");
    if (value === "Ijaraga olish") return t("common.requestTypeLease");
    return value;
  }

  /**
   * Narx birligi: «so‘m / oy» va «so‘m / m²».
   *
   * Bu qiymat ham ma’lumotda o‘zbekcha saqlanadi va solishtirishda kalit
   * bo‘lib ishlatiladi, shuning uchun reyestrda o‘zgarmaydi. Ekranda esa
   * tarjima ko‘rsatiladi: rus tilida «сум / мес» sarlavhasi ostida
   * «so‘m / oy» turishi mumkin emas edi.
   */
  function priceUnitLabel(unit: string) {
    if (unit.includes("m²")) return t("priceUnit.perSqm");
    if (unit.includes("oy")) return t("priceUnit.perMonth");
    return unit;
  }

  /** Katta summani qisqartiradi: «12.54 mlrd so‘m» / «12.54 млрд сум» */
  function moneyShort(value: number) {
    const abs = Math.abs(value);
    if (abs >= 1_000_000_000) {
      return `${num(value / 1_000_000_000, 2)} ${t("unitOf.billion")} ${t("unitOf.currency")}`;
    }
    if (abs >= 1_000_000) {
      return `${num(value / 1_000_000, 1)} ${t("unitOf.million")} ${t("unitOf.currency")}`;
    }
    return money(value);
  }

  /** O‘lchov birligi: `sqm`, `pcs`, `currency`, `thousand`, `million`… */
  function unitOf(name: string, fallback = "") {
    return tr(`unitOf.${name}`, fallback);
  }

  /** «5-qavat» / «5 этаж» */
  function floorLabel(floor: number | string) {
    return t("unitOf.floorNo", { floor: String(floor) });
  }

  /** Oy nomi: sarlavha shakli («Avgust» / «Август») */
  function monthName(month: number) {
    return tr(`month.${month}`, String(month));
  }

  /** Oy nomi: sana ichidagi shakl («avgust» / «августа») */
  function monthOfName(month: number) {
    return tr(`monthOf.${month}`, String(month));
  }

  function isoParts(iso: string): [string, string, string] | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
    return m ? [m[1]!, m[2]!, m[3]!] : null;
  }

  /**
   * «2025-05-18» → «18-may, 2025» yoki «18 мая 2025 г.».
   * `app/utils/format.ts` dagi `dateLong` sof funksiya, u tilni bilmaydi,
   * shuning uchun sana ko‘rinadigan joyda ekranlar shu variantni ishlatadi.
   */
  function dateLong(iso: string) {
    const p = isoParts(iso);
    if (!p) return iso;
    return t("dateFormat.long", {
      day: String(Number(p[2])),
      month: monthOfName(Number(p[1])),
      year: p[0],
    });
  }

  /** «2026-08-18» → «Avgust 2026» / «Август 2026» (hisob davri yorlig‘i) */
  function monthTitle(iso: string) {
    const p = isoParts(iso);
    if (!p) return iso;
    return t("dateFormat.monthTitle", {
      month: monthName(Number(p[1])),
      year: p[0],
    });
  }

  return {
    t,
    te,
    locale,
    tr,
    roleLabel,
    roleCaption,
    statusLabel,
    statusOptions,
    field,
    columns,
    moduleTitle,
    moduleCaption,
    sectionLabel,
    workOrdersTitle,
    workOrdersCaption,
    settingsNav,
    priorityLabel,
    periodicityLabel,
    didoxLabel,
    buildingTypeLabel,
    buildingTypeOptions,
    unitUsageLabel,
    unitUsageOptions,
    money,
    moneyShort,
    priceUnitLabel,
    requestTypeLabel,
    measureLabel,
    buildingClassLabel,
    offerLabel,
    unitOf,
    floorLabel,
    monthName,
    monthOfName,
    dateLong,
    monthTitle,
  };
}
