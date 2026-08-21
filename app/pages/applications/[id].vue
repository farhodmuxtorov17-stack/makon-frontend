<script setup lang="ts">
import {
  buildSchedule,
  serviceTotalOf,
  type LeaseOffer,
  type Periodicity,
  type SignedDocument,
} from "~/stores/lease";
import { unitById, vacantUnits } from "~/data/units";
import { buildingById } from "~/data/buildings";
import { area, dateShort, num, timeOf } from "~/utils/format";

const route = useRoute();
const auth = useAuthStore();
const lease = useLeaseStore();

const { t } = useI18n();
const {
  unitUsageLabel,
  money,
  didoxLabel,
  field,
  floorLabel,
  moduleTitle,
  periodicityLabel,
  roleLabel: roleName,
  unitOf,
  requestTypeLabel,
} = useAppLabels();

lease.seed();

/**
 * Biriktirilgan binodan tashqaridagi ariza to‘g‘ridan-to‘g‘ri havola bilan ham
 * ochilmaydi: yozuv topilmagan holatga tushadi va barcha amal tugmalari yopiladi.
 */
const item = computed(() => {
  const c = lease.byId(String(route.params.id));
  if (!c) return null;
  /* Maydoni belgilanmagan ariza hech bir binoga tegishli emas: uni operator ochadi */
  return !c.buildingId || auth.inScope(c.buildingId) ? c : null;
});
const unit = computed(() =>
  item.value?.unitId ? unitById(item.value.unitId) : undefined,
);

/** Maydon hali kelishilmagan: operator qo‘ng‘iroqdan keyin belgilaydi */
const needsUnit = computed(() => Boolean(item.value) && !item.value!.unitId);

/** Soha tekshiruvi: maydonsiz ariza barcha mas’ul xodimlarga ochiq */
const inScope = computed(
  () =>
    Boolean(item.value) &&
    (!item.value!.buildingId || auth.inScope(item.value!.buildingId)),
);

const actorName = computed(() => auth.user?.fullName ?? "-");
/** Audit jurnalidagi rol nomi joriy foydalanuvchidan olinadi */
const roleLabel = computed(() =>
  auth.role ? roleName(auth.role) : t("common.staff"),
);

/**
 * Arizani oxirigacha olib boradigan rol. Ilgari bu tekshiruv store ichida
 * edi va bitta binoga bog‘langan, shuning uchun boshqa binolarning arizasi
 * hech kimga yetib bormasdi.
 */
const canManage = computed(
  () => auth.can("application.decide") || auth.can("system.administer"),
);

/**
 * Sotuv so‘rovi ijara oqimiga kirmaydi: oldi-sotdi shartnomasi tizim orqali
 * tuzilmaydi, shuning uchun bunday yozuvda faqat bog‘lanish va rad etish bor.
 */
const isPurchase = computed(() => item.value?.request.type === "Sotib olish");

// --- Kelishilgan shartlar formasi -----------------------------------------

const form = reactive({
  monthlyRent: 0,
  deposit: 0,
  servicePerSqm: 0,
  periodicity: "Oylik" as Periodicity,
  adjustmentReason: "",
});

/** Davriylik nomlari registrdan olinadi, qiymatning o‘zi o‘zgarmaydi */
const PERIODICITY_OPTIONS = computed(() =>
  (["Oylik", "Choraklik", "Yillik"] as Periodicity[]).map((value) => ({
    value,
    label: periodicityLabel(value),
  })),
);

watch(
  item,
  (c) => {
    if (!c) return;
    if (c.offer) {
      form.monthlyRent = c.offer.monthlyRent;
      form.deposit = c.offer.deposit;
      form.servicePerSqm = c.offer.servicePerSqm;
      form.periodicity = c.offer.periodicity;
      form.adjustmentReason = c.offer.adjustmentReason;
      return;
    }
    const base = c.request.offerPrice || unit.value?.price || 0;
    form.monthlyRent = base;
    form.deposit = base * 2;
    form.servicePerSqm = 18000;
    form.periodicity = "Oylik";
    form.adjustmentReason = "";
  },
  { immediate: true },
);

const draftOffer = computed<LeaseOffer>(() => ({
  monthlyRent: Number(form.monthlyRent) || 0,
  deposit: Number(form.deposit) || 0,
  servicePerSqm: Number(form.servicePerSqm) || 0,
  periodicity: form.periodicity,
  adjustmentReason: form.adjustmentReason.trim(),
}));

/** Kirish qiymatlari o‘zgarishi bilan grafik qayta hisoblanadi */
const previewSchedule = computed(() =>
  item.value
    ? buildSchedule(draftOffer.value, item.value.request, item.value.area)
    : [],
);

const serviceTotal = computed(() =>
  item.value ? serviceTotalOf(draftOffer.value, item.value.area) : 0,
);

// --- Rolga bog‘liq amallar -------------------------------------------------

/**
 * Shartnoma bosqichlari aniq rolga emas, amal huquqiga va biriktirilgan
 * binoga bog‘lanadi. Ilgari tekshiruv bitta rolga bog‘langani uchun o‘sha
 * rolning binosidan tashqaridagi ariza shartnoma bosqichida abadiy qolib
 * ketardi: endi `contract.manage` huquqi bor har bir rol o‘z doirasidagi
 * arizani oxirigacha olib boradi.
 */
const canSign = computed(
  () => Boolean(item.value) && auth.can("contract.manage") && inScope.value,
);

/**
 * Yagona tasdiq: operator telefon orqali kelishgan shartlarni kiritadi va
 * arizani tasdiqlaydi. Tugma bosilgan zahoti shartnoma tuziladi, oraliq
 * moliya tasdig‘i yo‘q.
 */
const canApprove = computed(
  () =>
    item.value?.status === "YANGI" &&
    !needsUnit.value &&
    !isPurchase.value &&
    auth.can("application.decide") &&
    inScope.value,
);

/** Maydonni belgilash huquqi arizani yuritish huquqidan kelib chiqadi */
const canAssignUnit = computed(
  () =>
    needsUnit.value &&
    item.value?.status === "YANGI" &&
    auth.can("application.decide"),
);

/** Shartnoma matni Didoxga yuborilgunicha tahrirlanadi */
const canEditContract = computed(
  () =>
    item.value?.status === "SHARTNOMA_TAYYOR" &&
    Boolean(item.value.contract) &&
    canSign.value,
);

const canSendDidox = computed(
  () => item.value?.status === "SHARTNOMA_TAYYOR" && canSign.value,
);

/*
 * Imzolangan hujjatni yuklash Didox'ga yuborilgan zahoti ochiladi: operator
 * imzoni Didox'ning o'zida ko'radi va faylni shu yerga qo'yadi.
 */
const canUpload = computed(
  () =>
    (item.value?.status === "DIDOX_YUBORILDI" ||
      item.value?.status === "DIDOX_IMZOLANDI") &&
    canSign.value,
);

/** Ariza yopiladi: imzolangan nusxa yuklangandan keyin */
const canClose = computed(
  () =>
    item.value?.status === "DIDOX_IMZOLANDI" &&
    Boolean(item.value?.signedDocument) &&
    canSign.value,
);

/** Rad etish har bir jonli bosqichda ochiq: sikl hech qayerda qotib qolmaydi */
const canDecide = computed(
  () =>
    Boolean(item.value) &&
    !["FAOL", "RAD_ETILDI"].includes(item.value?.status ?? "") &&
    (auth.can("application.decide") || canSign.value),
);

/** Birinchi bosqichda qaytariladigan oldingi bosqich yo‘q */
const canRework = computed(
  () => canDecide.value && item.value?.status !== "YANGI",
);

/** Qaror huquqi yo‘q rol uchun tugma o‘rniga aniq belgi ko‘rsatiladi */
const readOnly = computed(
  () =>
    !auth.can("application.decide") &&
    !canSign.value &&
    !["FAOL", "RAD_ETILDI"].includes(item.value?.status ?? ""),
);

/** Obyektlar moduli hamma rolga ochiq emas, havola shunga qarab ko‘rsatiladi */
const canOpenObjects = computed(() => auth.canRoute("/objects"));

const editing = computed(() => canApprove.value);

// --- Maydonni belgilash ----------------------------------------------------

const unitChoice = ref("");

/** Bo‘sh maydonlar, byudjetga yaqinligi bo‘yicha tartiblangan */
const unitOptions = computed(() => {
  const budget = item.value?.request.offerPrice ?? 0;
  const monthly = (u: { price: number; area: number; priceUnit: string }) =>
    u.priceUnit === "so‘m / m²" ? Math.round(u.price * u.area) : u.price;
  return vacantUnits()
    .filter((u) => u.offer !== "Sotuv" && auth.inScope(u.buildingId))
    .slice()
    .sort(
      (a, b) => Math.abs(monthly(a) - budget) - Math.abs(monthly(b) - budget),
    )
    .map((u) => ({
      value: u.id,
      label: [
        buildingById(u.buildingId)?.name ?? "",
        `${field("unit", "Unit")} ${u.code}`,
        `${num(u.area, 2)} ${unitOf("sqm", "m²")}`,
        t("unitOf.perMonth", { value: money(monthly(u)) }),
      ].join(" · "),
    }));
});

function assignUnit() {
  if (!item.value || !unitChoice.value) return;
  lease.assignUnit(
    item.value.id,
    actorName.value,
    roleLabel.value,
    unitChoice.value,
  );
  say(
    t("app2.unitAssigned", {
      building: item.value.buildingName,
      code: item.value.unitCode,
    }),
  );
  unitChoice.value = "";
}

const shownSchedule = computed(() =>
  editing.value ? previewSchedule.value : (item.value?.schedule ?? []),
);

const formInvalid = computed(() => draftOffer.value.monthlyRent <= 0);

/** Didox bosqichi ko‘rinadigan holatlar */
const didoxStage = computed(() =>
  ["DIDOX_YUBORILDI", "DIDOX_IMZOLANDI", "FAOL"].includes(
    item.value?.status ?? "",
  ),
);

const closeBlockers = computed(() => {
  const c = item.value;
  if (!c) return [];
  const list: string[] = [];
  if (c.didox?.state !== "Imzolangan") {
    list.push(t("app2.blockerDidox", { state: didoxLabel("Imzolangan") }));
  }
  if (!c.signedDocument) list.push(t("app2.blockerDocument"));
  if (!canSign.value) list.push(t("app2.blockerRight"));
  return list;
});

// --- Amallar ---------------------------------------------------------------

const contractOpen = ref(false);
const contractEditOpen = ref(false);
const rejectOpen = ref(false);
const reworkOpen = ref(false);
const reason = ref("");
const notice = ref("");
/** Xabar ohangi: tekshiruv natijasi o‘zgarishsiz bo‘lsa yashil emas, kulrang */
const noticeTone = ref<"ok" | "info">("ok");

function say(text: string, tone: "ok" | "info" = "ok") {
  notice.value = text;
  noticeTone.value = tone;
}

function approve() {
  if (!item.value || formInvalid.value) return;
  lease.approveApplication(
    item.value.id,
    actorName.value,
    roleLabel.value,
    draftOffer.value,
  );
  const code = item.value.contract?.code;
  say(code ? t("app2.approvedWithContract", { code }) : t("app2.approved"));
}

function sendDidox() {
  if (!item.value) return;
  lease.sendToDidox(item.value.id, actorName.value, roleLabel.value);
  say(t("app2.sentToDidox", { doc: item.value.didox?.docNumber ?? "-" }));
}

/**
 * Tekshiruv natijasi qanday bo‘lsa, shunday aytiladi. Ilgari holat
 * o‘zgarmagan taqdirda ham «yangilandi» deb yozilar edi.
 */

function onUpload(file: Omit<SignedDocument, "uploadedAt" | "uploadedBy">) {
  if (!item.value) return;
  lease.attachSignedDocument(
    item.value.id,
    actorName.value,
    roleLabel.value,
    file,
  );
  say(t("app2.fileUploaded", { file: file.fileName }));
}

function onRemoveUpload() {
  if (!item.value) return;
  lease.removeSignedDocument(item.value.id, actorName.value, roleLabel.value);
  notice.value = "";
}

function closeCase() {
  if (!item.value || !canClose.value) return;
  lease.closeCase(item.value.id, actorName.value, roleLabel.value);
  say(t("app2.caseClosed", { login: item.value.access?.login ?? "-" }));
}

function confirmReject() {
  if (!item.value || !reason.value.trim()) return;
  lease.reject(
    item.value.id,
    actorName.value,
    roleLabel.value,
    reason.value.trim(),
  );
  rejectOpen.value = false;
  reason.value = "";
}

function confirmRework() {
  if (!item.value || !reason.value.trim()) return;
  lease.returnForRework(
    item.value.id,
    actorName.value,
    roleLabel.value,
    reason.value.trim(),
  );
  reworkOpen.value = false;
  reason.value = "";
}

function markContacted() {
  if (!item.value) return;
  lease.markContacted(item.value.id, actorName.value, roleLabel.value);
}

// --- Shartnomani tizim ichida tahrirlash -----------------------------------

const clauseDraft = ref<Array<{ title: string; text: string }>>([]);

function openContractEditor() {
  clauseDraft.value = (item.value?.contract?.clauses ?? []).map((c) => ({
    ...c,
  }));
  contractEditOpen.value = true;
}

function addClause() {
  clauseDraft.value.push({ title: "", text: "" });
}

function removeClause(index: number) {
  clauseDraft.value.splice(index, 1);
}

const clauseDraftValid = computed(() =>
  clauseDraft.value.every((c) => c.title.trim() && c.text.trim()),
);

function saveContract() {
  if (!item.value || !clauseDraftValid.value) return;
  lease.editContract(
    item.value.id,
    actorName.value,
    roleLabel.value,
    clauseDraft.value,
  );
  contractEditOpen.value = false;
  say(
    t("app2.contractUpdated", {
      code: item.value.contract?.code ?? field("contract", "Shartnoma"),
    }),
  );
}

// --- Kabinet kaliti --------------------------------------------------------

const copied = ref("");

async function copyValue(label: string, value: string) {
  try {
    await navigator.clipboard.writeText(value);
    copied.value = label;
    setTimeout(() => (copied.value = ""), 2200);
  } catch {
    copied.value = "";
  }
}

/** Kabinet kaliti qatorlari: nom lug‘atdan, qiymat arizadan */
const accessRows = computed(() => {
  const access = item.value?.access;
  if (!access) return [];
  return [
    { key: "login", label: field("login", "Login"), value: access.login },
    {
      key: "password",
      label: t("login.passwordLabel"),
      value: access.password,
    },
  ];
});

/* --- Jonli izoh ---
 * Kartochkada bir vaqtda faqat bitta amal ochiq bo‘ladi, shuning uchun izoh
 * ham shu bosqichga moslashadi: qadamlar ro‘yxatiga aynan hozir mumkin
 * bo‘lgan amal va undan keyin nima o‘zgarishi qo‘shiladi. Kuzatuvchi rol
 * qaror tugmalari o‘rniga kuzatuv izohini oladi.
 */
const tourStage = computed(() => {
  if (canAssignUnit.value) return "assign";
  if (canApprove.value) return "approve";
  if (canEditContract.value || canSendDidox.value) return "didox";
  if (canUpload.value || canClose.value) return "close";
  if (readOnly.value) return "watch";
  return "read";
});

const tourSteps = computed(() => {
  const plan: Array<[string, string]> = [
    ["flow", "case-flow"],
    ["data", "case-data"],
  ];
  if (canAssignUnit.value) plan.push(["assign", "case-unit"]);
  if (editing.value) plan.push(["terms", "case-terms"]);
  if (canApprove.value) plan.push(["approve", "case-actions"]);
  if (canEditContract.value || canSendDidox.value) {
    plan.push(["didox", "case-actions"]);
  }
  if (canUpload.value || canClose.value) plan.push(["close", "case-close"]);
  if (readOnly.value) plan.push(["watch", "case-actions"]);
  plan.push(["audit", "case-audit"]);

  return plan.map(([key, target]) => ({
    target: `[data-tour="${target}"]`,
    title: t(`tour.application.${key}.title`),
    body: t(`tour.application.${key}.body`),
    after: t(`tour.application.${key}.after`),
    next: t(`tour.application.${key}.next`),
  }));
});

/**
 * Xotira kaliti rol va bosqichdan tuziladi: operator birinchi marta Didox
 * bosqichiga yetganda izoh yana ochiladi, chunki u yerda mutlaqo boshqa
 * amal bajariladi. Bir xil bosqich ikkinchi marta bezovta qilmaydi.
 */
const tourId = computed(
  () => `application:${auth.role ?? "guest"}:${tourStage.value}`,
);
</script>

<template>
  <AppTopbar
    :title="item?.code ?? t('empty.noApplicationsFound')"
    :subtitle="
      item
        ? item.unitId
          ? `${item.org.name} · ${item.buildingName} · ${field('unit', 'Unit')} ${item.unitCode}`
          : `${item.org.name} · ${t('app2.unitPendingShort')}`
        : undefined
    "
    :breadcrumb="[
      { label: moduleTitle('applications', 'Arizalar'), to: '/applications' },
      { label: item?.code ?? '-' },
    ]"
  >
    <template #actions>
      <UiButton variant="secondary" size="sm" to="/applications">
        <UiIcon name="chevronLeft" :size="16" />
        {{ t("app2.backToQueue") }}
      </UiButton>
      <UiTour v-if="item" :id="tourId" :steps="tourSteps" />
    </template>
  </AppTopbar>

  <main
    v-if="item"
    class="scroll-slim flex-1 space-y-5 overflow-y-auto p-4 sm:p-6"
  >
    <div
      v-if="notice"
      class="flex items-start gap-3 rounded-card px-4 py-3.5 ring-1 ring-inset"
      :class="
        noticeTone === 'ok' ? 'bg-ok-50 ring-ok-100' : 'bg-ink-50 ring-ink-200'
      "
      role="status"
    >
      <UiIcon
        :name="noticeTone === 'ok' ? 'check' : 'info'"
        :size="18"
        class="mt-0.5 shrink-0"
        :class="noticeTone === 'ok' ? 'text-ok-600' : 'text-ink-500'"
      />
      <p
        class="min-w-0 flex-1 text-[13px] font-medium"
        :class="noticeTone === 'ok' ? 'text-ok-700' : 'text-ink-700'"
      >
        {{ notice }}
      </p>
      <button
        type="button"
        class="shrink-0 rounded-[8px] p-1.5 transition-colors"
        :class="
          noticeTone === 'ok'
            ? 'text-ok-600 hover:bg-ok-100'
            : 'text-ink-500 hover:bg-ink-100'
        "
        :aria-label="t('common.closeNotice')"
        @click="notice = ''"
      >
        <UiIcon name="x" :size="16" />
      </button>
    </div>

    <!-- Holat va bosqichlar -->
    <UiCard data-tour="case-flow">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex flex-wrap items-center gap-2.5">
          <UiStatus kind="lease" :value="item.status" />
          <span
            class="rounded-pill bg-ink-100 px-2.5 py-1 text-[12px] font-semibold text-ink-700"
          >
            {{ requestTypeLabel(item.request.type) }}
          </span>
          <span
            v-if="item.contract"
            class="rounded-pill bg-brand-50 px-2.5 py-1 text-[12px] font-semibold text-brand-700"
          >
            {{ item.contract.code }}
          </span>
        </div>

        <div data-tour="case-actions" class="flex flex-wrap gap-2">
          <UiButton
            v-if="item.contract"
            variant="secondary"
            size="sm"
            @click="contractOpen = true"
          >
            <UiIcon name="doc" :size="16" />
            {{ t("app2.viewContract") }}
          </UiButton>

          <UiButton
            v-if="canEditContract"
            variant="secondary"
            size="sm"
            @click="openContractEditor"
          >
            <UiIcon name="edit" :size="16" />
            {{ t("app2.editContract") }}
          </UiButton>

          <UiButton v-if="canSendDidox" size="sm" @click="sendDidox">
            <UiIcon name="send" :size="16" />
            {{ t("app2.sendDidox") }}
          </UiButton>

          <UiButton
            v-if="canApprove"
            variant="success"
            size="sm"
            :disabled="formInvalid"
            @click="approve"
          >
            <UiIcon name="check" :size="16" />
            {{ t("common.confirm") }}
          </UiButton>

          <UiButton
            v-if="canRework"
            variant="secondary"
            size="sm"
            @click="reworkOpen = true"
          >
            <UiIcon name="refresh" :size="16" />
            {{ t("app2.sendRework") }}
          </UiButton>

          <UiButton
            v-if="canDecide"
            variant="danger"
            size="sm"
            @click="rejectOpen = true"
          >
            <UiIcon name="x" :size="16" />
            {{ t("common.reject") }}
          </UiButton>

          <span
            v-if="readOnly"
            class="inline-flex items-center gap-2 rounded-pill bg-ink-100 px-3 py-1.5 text-[12px] font-semibold text-ink-600"
          >
            <UiIcon name="eye" :size="16" />
            {{ t("app2.watchOnly") }}
          </span>
        </div>
      </div>

      <div class="mt-5">
        <LeaseFlow :status="item.status" />
      </div>

      <p
        v-if="needsUnit && item.status === 'YANGI'"
        class="mt-4 flex items-start gap-2 rounded-field bg-warn-50 px-3.5 py-2.5 text-[13px] leading-relaxed text-warn-700 ring-1 ring-inset ring-warn-100"
      >
        <UiIcon name="info" :size="16" class="mt-px shrink-0" />
        <span>{{ t("app2.unitPendingHint") }}</span>
      </p>

      <!--
        Sotuv so'rovi: tasdiqlash tugmasi ataylab chiqmaydi, chunki oldi-sotdi
        shartnomasi tizim ichida tuzilmaydi. Sabab yozilmasa, xodim uchun bu
        shunchaki yo'qolgan tugma bo'lib ko'rinadi.
      -->
      <p
        v-if="isPurchase && item.status === 'YANGI'"
        class="mt-4 flex items-start gap-2 rounded-field bg-info-50 px-3.5 py-2.5 text-[13px] leading-relaxed text-info-700 ring-1 ring-inset ring-info-100"
      >
        <UiIcon name="info" :size="16" class="mt-px shrink-0" />
        <span>{{ t("app2.purchaseHint") }}</span>
      </p>

      <p
        v-if="item.status === 'RAD_ETILDI' && item.rejectReason"
        class="mt-4 flex items-start gap-2 rounded-field bg-danger-50 px-3.5 py-2.5 text-[13px] leading-relaxed text-danger-700 ring-1 ring-inset ring-danger-100"
      >
        <UiIcon name="warning" :size="16" class="mt-px shrink-0" />
        {{ t("app2.rejectReasonPrefix", { reason: item.rejectReason }) }}
      </p>
    </UiCard>

    <!-- Ariza yopilgandagi o‘zgarishlar -->
    <LeaseActivation
      v-if="item.activation"
      :at="item.activation.at"
      :changes="item.activation.changes"
    />

    <div class="grid gap-5 xl:grid-cols-3">
      <div class="space-y-5 xl:col-span-2">
        <!-- Ariza va bog‘lanish -->
        <UiCard
          data-tour="case-data"
          :title="t('tour.application.data.title')"
          :subtitle="t('app2.dataSubtitle')"
          icon="clipboard"
        >
          <dl class="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <div>
              <dt class="text-[12px] text-ink-500">
                {{ field("organization", "Tashkilot") }}
              </dt>
              <dd class="mt-0.5 text-sm font-semibold text-ink-900">
                {{ item.org.name }}
              </dd>
            </div>
            <div>
              <dt class="text-[12px] text-ink-500">STIR</dt>
              <!--
                Ochiq ariza formasi beshta maydondan iborat: STIR, e-pochta va
                yuridik manzil unda so'ralmaydi. Operator ularni telefon
                suhbatida aniqlaydi, shuning uchun bo'sh joy o'rniga shu haqda
                yoziladi.
              -->
              <dd
                class="mt-0.5 text-sm font-semibold"
                :class="item.org.tin ? 'tabular text-ink-900' : 'text-ink-400'"
              >
                {{ item.org.tin || t("app2.clarifyByOperator") }}
              </dd>
            </div>
            <div>
              <dt class="text-[12px] text-ink-500">
                {{ t("app2.offerPriceLabel") }}
              </dt>
              <dd class="tabular mt-0.5 text-sm font-semibold text-ink-900">
                {{ money(item.request.offerPrice) }}
              </dd>
            </div>
            <div>
              <dt class="text-[12px] text-ink-500">
                {{ field("deadline", "Muddat") }}
              </dt>
              <dd class="tabular mt-0.5 text-sm font-semibold text-ink-900">
                {{
                  t("app2.termFrom", {
                    count: item.request.term,
                    date: dateShort(item.request.startDate),
                  })
                }}
              </dd>
            </div>
            <div>
              <dt class="text-[12px] text-ink-500">
                {{ field("submittedAt", "Yuborilgan sana") }}
              </dt>
              <dd class="tabular mt-0.5 text-sm font-semibold text-ink-900">
                {{ dateShort(item.request.submittedAt) }}
                {{ timeOf(item.request.submittedAt) }}
              </dd>
            </div>
            <div>
              <dt class="text-[12px] text-ink-500">
                {{ t("app2.legalAddress") }}
              </dt>
              <dd
                class="mt-0.5 text-sm font-semibold"
                :class="item.org.address ? 'text-ink-900' : 'text-ink-400'"
              >
                {{ item.org.address || t("app2.clarifyByOperator") }}
              </dd>
            </div>
            <div v-if="item.request.note" class="sm:col-span-2">
              <dt class="text-[12px] text-ink-500">{{ t("common.note") }}</dt>
              <dd
                class="mt-1 rounded-field bg-surface-sunken p-3.5 text-[13px] leading-relaxed text-ink-700"
              >
                {{ item.request.note }}
              </dd>
            </div>
          </dl>

          <!-- Bog‘lanish bloki -->
          <div
            class="mt-5 rounded-field bg-surface-sunken p-4 ring-1 ring-inset ring-ink-200"
          >
            <div class="flex flex-wrap items-center justify-between gap-3">
              <p
                class="text-[12px] font-semibold uppercase tracking-wide text-ink-500"
              >
                {{ t("app2.contact") }}
              </p>
              <span
                v-if="item.contactedAt"
                class="inline-flex items-center gap-1.5 rounded-pill bg-ok-50 px-2.5 py-1 text-[12px] font-semibold text-ok-700 ring-1 ring-inset ring-ok-100"
              >
                <UiIcon name="check" :size="12" />
                {{ t("app2.contacted") }} · {{ dateShort(item.contactedAt) }}
                {{ timeOf(item.contactedAt) }}
              </span>
            </div>

            <div class="mt-3 grid gap-3 sm:grid-cols-3">
              <div class="flex items-center gap-2.5">
                <span
                  class="grid size-9 shrink-0 place-items-center rounded-field bg-white text-brand-600 ring-1 ring-ink-200"
                >
                  <UiIcon name="user" :size="16" />
                </span>
                <span class="min-w-0">
                  <span class="block text-[12px] text-ink-500">{{
                    t("app2.representative")
                  }}</span>
                  <span
                    class="block truncate text-[13px] font-semibold text-ink-900"
                  >
                    {{ item.org.director }}
                  </span>
                </span>
              </div>
              <a
                :href="`tel:${item.org.phone.replace(/\s/g, '')}`"
                class="flex items-center gap-2.5 rounded-field transition-colors duration-150 hover:bg-white"
              >
                <span
                  class="grid size-9 shrink-0 place-items-center rounded-field bg-white text-brand-600 ring-1 ring-ink-200"
                >
                  <UiIcon name="phone" :size="16" />
                </span>
                <span class="min-w-0">
                  <span class="block text-[12px] text-ink-500">{{
                    t("common.phone")
                  }}</span>
                  <span
                    class="tabular block truncate text-[13px] font-semibold text-brand-700"
                  >
                    {{ item.org.phone }}
                  </span>
                </span>
              </a>
              <!-- E-pochta bo'lmasa havola emas, oddiy yozuv -->
              <component
                :is="item.org.email ? 'a' : 'div'"
                :href="item.org.email ? `mailto:${item.org.email}` : undefined"
                class="flex items-center gap-2.5 rounded-field transition-colors duration-150 hover:bg-white"
              >
                <span
                  class="grid size-9 shrink-0 place-items-center rounded-field bg-white text-brand-600 ring-1 ring-ink-200"
                >
                  <UiIcon name="send" :size="16" />
                </span>
                <span class="min-w-0">
                  <span class="block text-[12px] text-ink-500">{{
                    t("common.email")
                  }}</span>
                  <span
                    class="block truncate text-[13px] font-semibold"
                    :class="item.org.email ? 'text-brand-700' : 'text-ink-400'"
                  >
                    {{ item.org.email || t("app2.clarifyByOperator") }}
                  </span>
                </span>
              </component>
            </div>

            <UiButton
              v-if="!item.contactedAt && canManage"
              variant="secondary"
              size="sm"
              class="mt-3"
              @click="markContacted"
            >
              <UiIcon name="check" :size="16" />
              {{ t("app2.markContacted") }}
            </UiButton>
          </div>

          <!-- Hisobsiz yuborilgan ariza -->
          <div
            v-if="item.guest"
            class="mt-4 rounded-field bg-warn-50 p-4 ring-1 ring-inset ring-warn-100"
          >
            <p
              class="flex items-start gap-2 text-[13px] font-semibold text-warn-700"
            >
              <UiIcon name="info" :size="16" class="mt-px shrink-0" />
              {{ t("app2.guestTitle") }}
            </p>
            <p class="mt-1.5 text-[13px] leading-relaxed text-ink-600">
              {{ t("app2.guestPerson", { name: item.contactName }) }}
            </p>

            <p class="mt-2.5 text-[12px] leading-relaxed text-ink-600">
              {{ t("app2.guestCabinet") }}
            </p>
          </div>
        </UiCard>

        <!-- Kelishilgan shartlar -->
        <UiCard
          data-tour="case-terms"
          :title="t('tour.application.terms.title')"
          :subtitle="
            editing ? t('app2.termsEditSubtitle') : t('app2.termsSubtitle')
          "
          icon="wallet"
          tone="teal"
        >
          <div v-if="editing" class="grid gap-4 sm:grid-cols-2">
            <UiField
              :label="t('app2.monthlyRentLabel')"
              required
              :hint="t('apply.amountUnit')"
            >
              <UiInput
                v-model="form.monthlyRent"
                type="number"
                min="0"
                :invalid="formInvalid"
              >
                <template #suffix>
                  <span class="text-[12px]">{{
                    unitOf("currency", "so‘m")
                  }}</span>
                </template>
              </UiInput>
            </UiField>
            <UiField
              :label="t('app2.depositLabel')"
              :hint="t('app2.depositHint')"
            >
              <UiInput v-model="form.deposit" type="number" min="0">
                <template #suffix>
                  <span class="text-[12px]">{{
                    unitOf("currency", "so‘m")
                  }}</span>
                </template>
              </UiInput>
            </UiField>
            <UiField
              :label="t('app2.serviceFeeLabel')"
              :hint="
                t('app2.serviceFeeHint', {
                  area: num(item.area, 2),
                  total: money(serviceTotal),
                })
              "
            >
              <UiInput v-model="form.servicePerSqm" type="number" min="0">
                <template #suffix>
                  <span class="text-[12px]">{{
                    unitOf("currencyPerSqm", "so‘m/m²")
                  }}</span>
                </template>
              </UiInput>
            </UiField>
            <UiField :label="t('app2.periodicityLabel')" required>
              <UiSelect
                v-model="form.periodicity"
                :options="PERIODICITY_OPTIONS"
              />
            </UiField>

            <UiField
              :label="t('app2.adjustmentLabel')"
              class="sm:col-span-2"
              :hint="t('app2.adjustmentHint')"
            >
              <UiInput
                v-model="form.adjustmentReason"
                :placeholder="t('app2.adjustmentPlaceholder')"
              />
            </UiField>
          </div>

          <LeaseTotals v-else :item="item" />

          <div v-if="editing" class="mt-5 border-t border-ink-100 pt-5">
            <LeaseTotals
              :item="{ ...item, offer: draftOffer, schedule: previewSchedule }"
            />
          </div>
        </UiCard>

        <!-- To‘lov grafigi -->
        <UiCard
          :title="t('app2.scheduleTitle')"
          :subtitle="t('app2.scheduleSubtitle')"
          icon="calendar"
          tone="brand"
        >
          <LeaseSchedule :rows="shownSchedule" />
        </UiCard>

        <!-- Didox -->
        <UiCard
          v-if="didoxStage"
          :title="t('app2.didoxTitle')"
          :subtitle="t('app2.didoxSubtitle')"
          icon="external"
          tone="info"
        >
          <LeaseDidox :item="item" />
        </UiCard>

        <!--
          Imzolangan hujjatni yuklash va arizani yopish.

          Blok Didox'ga yuborilgan zahoti ochiladi: operator imzoni Didox'ning
          o'zida ko'radi, faylni yuklab olib shu yerga qo'yadi. Fayl yuklanishi
          arizani «Imzolandi» bosqichiga o'tkazadi.
        -->
        <UiCard
          v-if="
            item.status === 'DIDOX_YUBORILDI' ||
            item.status === 'DIDOX_IMZOLANDI' ||
            item.status === 'FAOL'
          "
          data-tour="case-close"
          :title="t('app2.signedTitle')"
          :subtitle="t('app2.signedSubtitle')"
          icon="shield"
          tone="ok"
        >
          <LeaseSignedUpload
            :document="item.signedDocument"
            :readonly="!canUpload"
            @upload="onUpload"
            @remove="onRemoveUpload"
          />

          <div v-if="item.status !== 'FAOL'" class="mt-4">
            <UiButton :disabled="!canClose" @click="closeCase">
              <UiIcon name="check" :size="16" />
              {{ t("app2.closeCase") }}
            </UiButton>
            <p class="mt-2 text-[13px] leading-relaxed text-ink-500">
              {{ t("app2.closeHint") }}
            </p>

            <p
              v-if="closeBlockers.length"
              class="mt-2.5 flex items-start gap-2 rounded-field bg-warn-50 px-3.5 py-2.5 text-[13px] leading-relaxed text-warn-700 ring-1 ring-inset ring-warn-100"
            >
              <UiIcon name="warning" :size="16" class="mt-px shrink-0" />
              <span>
                {{ t("app2.closeBlockers") }}
                <b>{{ closeBlockers.join("; ") }}</b>
              </span>
            </p>
          </div>
        </UiCard>

        <!-- Ijarachi kabineti uchun kalit -->
        <UiCard
          v-if="item.access"
          :title="t('app2.accessTitle')"
          :subtitle="t('app2.accessSubtitle')"
          icon="user"
          tone="brand"
        >
          <div class="grid gap-3 sm:grid-cols-2">
            <div
              v-for="row in accessRows"
              :key="row.key"
              class="rounded-field bg-surface-sunken p-4 ring-1 ring-inset ring-ink-200"
            >
              <p
                class="text-[12px] font-semibold uppercase tracking-wide text-ink-500"
              >
                {{ row.label }}
              </p>
              <div class="mt-1.5 flex items-center gap-2">
                <code
                  class="tabular min-w-0 flex-1 truncate rounded-[8px] bg-white px-2.5 py-1.5 text-[14px] font-bold text-ink-900 ring-1 ring-inset ring-ink-200"
                >
                  {{ row.value }}
                </code>
                <button
                  type="button"
                  class="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-field px-2.5 text-[12px] font-semibold text-brand-600 transition-colors duration-150 hover:bg-white"
                  :aria-label="t('app2.copyAria', { label: row.label })"
                  @click="copyValue(row.key, row.value)"
                >
                  <UiIcon
                    :name="copied === row.key ? 'check' : 'clipboard'"
                    :size="14"
                  />
                  {{
                    copied === row.key
                      ? t("common.copied")
                      : t("common.copyAction")
                  }}
                </button>
              </div>
            </div>
          </div>

          <p
            class="mt-3.5 flex items-start gap-2 rounded-field bg-brand-50 px-3.5 py-2.5 text-[13px] leading-relaxed text-brand-700 ring-1 ring-inset ring-brand-200"
          >
            <UiIcon name="info" :size="16" class="mt-px shrink-0" />
            <span>
              {{
                t("app2.accessIssued", {
                  date: dateShort(item.access.issuedAt),
                  time: timeOf(item.access.issuedAt),
                })
              }}
            </span>
          </p>
        </UiCard>

        <!-- Audit -->
        <UiCard
          data-tour="case-audit"
          :title="moduleTitle('settingsAudit', 'Audit jurnali')"
          :subtitle="t('app2.auditSubtitle')"
          icon="clipboard"
          tone="neutral"
        >
          <LeaseAudit :entries="item.audit" />
        </UiCard>
      </div>

      <!-- Unit paneli -->
      <div class="min-w-0">
        <UiCard
          data-tour="case-unit"
          class="xl:sticky xl:top-[88px]"
          :title="needsUnit ? t('app2.unitNotChosen') : t('app2.unitRequested')"
          :subtitle="
            needsUnit ? t('app2.unitPanelSubtitle') : item.buildingName
          "
          icon="building"
        >
          <template v-if="needsUnit">
            <p
              class="flex items-start gap-2 rounded-field bg-warn-50 px-3.5 py-2.5 text-[13px] leading-relaxed text-warn-700 ring-1 ring-inset ring-warn-100"
            >
              <UiIcon name="info" :size="16" class="mt-px shrink-0" />
              {{ t("app2.unitPanelHint") }}
            </p>

            <dl class="mt-4 space-y-3">
              <div class="flex items-baseline justify-between gap-3">
                <dt class="text-[13px] text-ink-500">{{ t("app2.budget") }}</dt>
                <dd class="tabular text-[13px] font-semibold text-ink-900">
                  {{
                    t("unitOf.perMonth", {
                      value: money(item.request.offerPrice),
                    })
                  }}
                </dd>
              </div>
              <div class="flex items-baseline justify-between gap-3">
                <dt class="text-[13px] text-ink-500">
                  {{ field("deadline", "Muddat") }}
                </dt>
                <dd class="tabular text-[13px] font-semibold text-ink-900">
                  {{ t("apply.termMonths", { count: item.request.term }) }}
                </dd>
              </div>
            </dl>

            <template v-if="canAssignUnit">
              <UiField
                :label="t('app2.agreedUnitLabel')"
                class="mt-4"
                :hint="t('app2.agreedUnitHint')"
              >
                <UiSelect
                  v-model="unitChoice"
                  :options="[
                    { value: '', label: t('app2.chooseUnit') },
                    ...unitOptions,
                  ]"
                />
              </UiField>

              <UiButton
                block
                class="mt-3"
                :disabled="!unitChoice"
                @click="assignUnit"
              >
                <UiIcon name="check" :size="16" />
                {{ t("app2.assignUnit") }}
              </UiButton>
            </template>

            <p
              v-else
              class="mt-4 flex items-center justify-center gap-2 rounded-field bg-ink-100 px-3 py-2.5 text-[13px] font-semibold text-ink-600"
            >
              <UiIcon name="eye" :size="16" />
              {{ t("app2.assignByOperator") }}
            </p>
          </template>

          <template v-else>
            <dl class="space-y-3">
              <div class="flex items-baseline justify-between gap-3">
                <dt class="text-[13px] text-ink-500">
                  {{ field("unitCode", "Unit raqami") }}
                </dt>
                <dd class="text-[13px] font-semibold text-ink-900">
                  {{ item.unitCode }}
                </dd>
              </div>
              <div class="flex items-baseline justify-between gap-3">
                <dt class="text-[13px] text-ink-500">
                  {{ field("area", "Maydon") }}
                </dt>
                <dd class="tabular text-[13px] font-semibold text-ink-900">
                  {{ area(item.area) }}
                </dd>
              </div>
              <div class="flex items-baseline justify-between gap-3">
                <dt class="text-[13px] text-ink-500">
                  {{ field("floor", "Qavat") }}
                </dt>
                <dd class="text-[13px] font-semibold text-ink-900">
                  {{ floorLabel(item.floor) }}
                </dd>
              </div>
              <div class="flex items-baseline justify-between gap-3">
                <dt class="text-[13px] text-ink-500">
                  {{ field("usage", "Foydalanish turi") }}
                </dt>
                <dd class="text-[13px] font-semibold text-ink-900">
                  {{ unitUsageLabel(item.usage) }}
                </dd>
              </div>
              <div
                v-if="unit"
                class="flex items-baseline justify-between gap-3"
              >
                <dt class="text-[13px] text-ink-500">
                  {{ t("app2.currentStatus") }}
                </dt>
                <dd><UiStatus kind="unit" :value="unit.status" size="sm" /></dd>
              </div>
              <div class="flex items-start justify-between gap-3">
                <dt class="shrink-0 text-[13px] text-ink-500">
                  {{ field("address", "Manzil") }}
                </dt>
                <dd
                  class="min-w-0 text-right text-[13px] font-medium text-ink-700"
                >
                  {{ item.buildingAddress }}
                </dd>
              </div>
            </dl>

            <div
              v-if="unit?.equipment.length"
              class="mt-4 border-t border-ink-100 pt-4"
            >
              <p
                class="mb-2 text-[12px] font-semibold uppercase tracking-wide text-ink-500"
              >
                {{ t("app2.equipment") }}
              </p>
              <ul class="space-y-1.5">
                <li
                  v-for="e in unit.equipment"
                  :key="e"
                  class="flex items-center gap-2 text-[13px] text-ink-700"
                >
                  <UiIcon
                    name="check"
                    :size="14"
                    class="shrink-0 text-ok-500"
                  />
                  {{ e }}
                </li>
              </ul>
            </div>

            <UiButton
              v-if="canOpenObjects"
              variant="secondary"
              size="sm"
              block
              class="mt-4"
              :to="`/objects/${item.buildingId}/floors/${item.floor}?unit=${item.unitId}`"
            >
              <UiIcon name="layers" :size="16" />
              {{ t("app2.viewOnPlan") }}
            </UiButton>
          </template>
        </UiCard>
      </div>
    </div>

    <LeaseContractModal v-model="contractOpen" :item="item" />

    <!-- Shartnomani tizim ichida tahrirlash -->
    <UiModal
      v-model="contractEditOpen"
      size="lg"
      :title="t('app2.editContract')"
      :subtitle="
        item.contract ? `${item.contract.code} · ${item.org.name}` : item.code
      "
    >
      <p class="text-[13px] leading-relaxed text-ink-600">
        {{ t("app2.contractEditHint") }}
      </p>

      <div class="mt-4 space-y-4">
        <div
          v-for="(c, i) in clauseDraft"
          :key="i"
          class="rounded-field bg-surface-sunken p-4 ring-1 ring-inset ring-ink-200"
        >
          <div class="flex items-center justify-between gap-3">
            <span
              class="text-[12px] font-semibold uppercase tracking-wide text-ink-500"
            >
              {{ t("app2.clauseNo", { n: i + 1 }) }}
            </span>
            <button
              type="button"
              class="grid size-9 place-items-center rounded-field text-ink-500 transition-colors duration-150 hover:bg-white hover:text-danger-600"
              :aria-label="t('app2.clauseRemoveAria', { n: i + 1 })"
              @click="removeClause(i)"
            >
              <UiIcon name="trash" :size="16" />
            </button>
          </div>
          <UiField :label="t('app2.clauseTitleLabel')" required class="mt-2">
            <UiInput
              v-model="c.title"
              :placeholder="t('app2.clauseTitlePlaceholder')"
            />
          </UiField>
          <UiField :label="t('app2.clauseTextLabel')" required class="mt-3">
            <textarea
              v-model="c.text"
              rows="3"
              class="w-full rounded-field bg-white px-3.5 py-2.5 text-sm text-ink-800 ring-1 ring-inset ring-ink-200 transition-colors placeholder:text-ink-400 focus:ring-2 focus:ring-brand-500"
              :placeholder="t('app2.clauseTextPlaceholder')"
            />
          </UiField>
        </div>
      </div>

      <UiButton variant="secondary" size="sm" class="mt-4" @click="addClause">
        <UiIcon name="plus" :size="16" />
        {{ t("app2.addClause") }}
      </UiButton>

      <template #footer>
        <UiButton variant="ghost" @click="contractEditOpen = false">
          {{ t("common.cancel") }}
        </UiButton>
        <UiButton
          :disabled="!clauseDraftValid || !clauseDraft.length"
          @click="saveContract"
        >
          <UiIcon name="check" :size="16" />
          {{ t("common.save") }}
        </UiButton>
      </template>
    </UiModal>

    <!-- Rad etish -->
    <UiModal
      v-model="rejectOpen"
      :title="t('app2.rejectTitle')"
      :subtitle="item.code"
    >
      <UiField
        :label="t('app2.rejectReasonLabel')"
        required
        :hint="t('app2.rejectReasonHint')"
      >
        <textarea
          v-model="reason"
          rows="4"
          class="w-full rounded-field bg-white px-3.5 py-2.5 text-sm text-ink-800 ring-1 ring-inset ring-ink-200 transition-colors placeholder:text-ink-400 focus:ring-2 focus:ring-brand-500"
          :placeholder="t('app2.reasonPlaceholder')"
        />
      </UiField>
      <template #footer>
        <UiButton variant="ghost" @click="rejectOpen = false">{{
          t("common.cancel")
        }}</UiButton>
        <UiButton
          variant="danger"
          :disabled="!reason.trim()"
          @click="confirmReject"
        >
          {{ t("common.reject") }}
        </UiButton>
      </template>
    </UiModal>

    <!-- Qayta ishlashga yuborish -->
    <UiModal
      v-model="reworkOpen"
      :title="t('app2.sendRework')"
      :subtitle="item.code"
    >
      <UiField
        :label="t('common.reason')"
        required
        :hint="t('app2.reworkHint')"
      >
        <textarea
          v-model="reason"
          rows="4"
          class="w-full rounded-field bg-white px-3.5 py-2.5 text-sm text-ink-800 ring-1 ring-inset ring-ink-200 transition-colors placeholder:text-ink-400 focus:ring-2 focus:ring-brand-500"
          :placeholder="t('app2.reworkPlaceholder')"
        />
      </UiField>
      <template #footer>
        <UiButton variant="ghost" @click="reworkOpen = false">{{
          t("common.cancel")
        }}</UiButton>
        <UiButton :disabled="!reason.trim()" @click="confirmRework">
          {{ t("common.return") }}
        </UiButton>
      </template>
    </UiModal>
  </main>

  <main v-else class="flex flex-1 items-center justify-center p-6">
    <UiCard>
      <UiEmpty
        icon="clipboard"
        :title="t('app2.notFoundTitle')"
        :description="t('app2.notFoundText')"
        :action-label="t('app2.backToQueueAction')"
        action-to="/applications"
      />
    </UiCard>
  </main>
</template>
