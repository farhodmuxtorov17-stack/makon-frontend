<script setup lang="ts">
import { BUILDINGS } from "~/data/buildings";
import AppTopbar from "~/components/layout/AppTopbar.vue";
import { CONTRACTS, INVOICES, type Contract } from "~/data/business";
import { docxBlob, fileSize, saveBlob, type DocxLine } from "~/utils/docx";
import { dateShort, num, sum } from "~/utils/format";

const route = useRoute();
import { NuxtLink } from "#components";

const auth = useAuthStore();

/** Hisob-kitob bo‘limi bu rolga ochiqmi */
const canOpenBilling = computed(() => auth.canRoute("/billing/invoices"));
const registry = reactive(CONTRACTS);
const {
  money,
  t,
  dateLong,
  field,
  sectionLabel,
  moduleTitle,
  statusLabel,
  unitOf,
} = useAppLabels();

/**
 * Bino doirasi kartochkada ham tekshiriladi. Ilgari faqat ro'yxat
 * filtrlanardi va bino rahbari to'g'ridan-to'g'ri havola orqali boshqa
 * obyektning shartnoma shartlarini, ijarachisini va summasini o'qiy olardi.
 */
const contract = computed(() => {
  const found = registry.find((c) => c.id === String(route.params.id)) ?? null;
  if (!found) return null;
  const site = BUILDINGS.find((b) => b.name === found.buildingName);
  return site && !auth.inScope(site.id) ? null : found;
});

const banner = ref("");
const approveOpen = ref(false);
const actOpen = ref(false);
const documentOpen = ref(false);
const activeDocument = ref<{ name: string; size: string; type: string } | null>(
  null,
);

/**
 * Ma’lumotda o‘zbekcha qiymat sifatida saqlanadigan ro‘yxatlar: shartnoma
 * turi, bosqich nomi va to‘lov shakli. Qiymatning o‘zi o‘zgarmaydi (holat
 * mashinasi va solishtirish ishlashda qoladi), faqat ko‘rinadigan nom
 * tanlangan tilga bog‘lanadi.
 */
const TYPE_KEY: Record<string, string> = {
  Ijara: "ctr.typeRent",
  Sotuv: "ctr.typeSale",
};

/** «Ijara shartnomasi» / «Договор аренды»: sarlavhadagi qaratqich shakli */
const TYPE_OF_KEY: Record<string, string> = {
  Ijara: "ctr.typeRentOf",
  Sotuv: "ctr.typeSaleOf",
};

const STEP_KEY: Record<string, string> = {
  Yaratildi: "ctr.step.created",
  Kelishildi: "ctr.step.agreed",
  Imzolandi: "ctr.step.signed",
  Faollashdi: "ctr.step.active",
  "Muddati tugadi": "ctr.step.expired",
  Uzaytirildi: "ctr.step.extended",
};

const PAYMENT_KEY: Record<string, string> = {
  "Bir martalik to‘lov": "ctr.payOneTime",
  "Choraklik to‘lov": "ctr.payQuarterly",
  "Oylik oldindan to‘lov": "ctr.payMonthlyPrepaid",
};

function labelOf(map: Record<string, string>, value: string) {
  const key = map[value];
  return key ? t(key) : value;
}

const typeLabel = (value: string) => labelOf(TYPE_KEY, value);
const typeOfLabel = (value: string) => labelOf(TYPE_OF_KEY, value);
const stepLabel = (value: string) => labelOf(STEP_KEY, value);
const paymentLabel = (value: string) => labelOf(PAYMENT_KEY, value);

/**
 * Reyestrdagi shartnoma bosqichlari. Ijara oqimidan kelgan shartnoma bu yerga
 * allaqachon faol holatda tushadi; reyestrda qo‘lda ochilgan shartnoma esa shu
 * sahifadagi amallar bilan bosqichma-bosqich yuritiladi. Ilgari bu yerda faqat
 * kelishuv qaydi bor edi, shuning uchun yozuv «Qoralama» va «Kelishilmoqda»
 * holatidan hech qachon chiqmasdi.
 */
const agreementStep = computed(
  () => contract.value?.timeline.find((s) => s.label === "Kelishildi") ?? null,
);

const signedStep = computed(
  () => contract.value?.timeline.find((s) => s.label === "Imzolandi") ?? null,
);

const activeStep = computed(
  () => contract.value?.timeline.find((s) => s.label === "Faollashdi") ?? null,
);

const isAgreed = computed(() => agreementStep.value?.done === true);
const isSigned = computed(() => signedStep.value?.done === true);
const isActive = computed(() => activeStep.value?.done === true);

/** Shartnomani yuritish huquqi: rolga emas, amal huquqiga bog‘langan */
const canManage = computed(
  () =>
    Boolean(contract.value) &&
    auth.can("contract.manage") &&
    auth.inScope(contract.value!.buildingId),
);

const relatedInvoices = computed(() =>
  contract.value
    ? INVOICES.filter((i) => i.tenant === contract.value?.tenant)
    : [],
);

const relatedDebt = computed(() =>
  relatedInvoices.value.reduce((s, i) => s + (i.total - i.paid), 0),
);

const currentApprover = computed(
  () => auth.user?.fullName ?? "Jahongir Alimov",
);
const approveDate = computed(() => agreementStep.value?.date ?? "-");
const approver = computed(() =>
  isAgreed.value ? (agreementStep.value?.actor ?? "-") : currentApprover.value,
);

/** Kelishuv sanasi haqiqiy soatdan olinadi */
function todayIso() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function openDocument(doc: { name: string; size: string; type: string }) {
  activeDocument.value = doc;
  documentOpen.value = true;
}

/** Shartnoma rekvizitlaridan hujjat matni */
function contractHead(c: Contract, title: string): DocxLine[] {
  return [
    { text: "Makon Property Group", style: "subtitle" },
    { text: title, style: "title" },
    { text: `${c.code} · ${dateShort(c.startsAt)}`, style: "subtitle" },
    { text: t("ctr.docParties"), style: "heading" },
    { text: t("ctr.docLessor", { name: "Makon Property Group" }) },
    { text: t("ctr.docTenant", { name: c.tenant }) },
    { text: t("ctr.docObject", { value: `${c.buildingName}, ${c.unitCode}` }) },
    { text: t("ctr.docType", { value: typeLabel(c.type) }) },
  ];
}

function documentLines(c: Contract, name: string): DocxLine[] {
  return [
    ...contractHead(c, name),
    { text: t("ctr.docTerms"), style: "heading" },
    { text: t("ctr.docStart", { value: dateLong(c.startsAt) }) },
    {
      text: t("ctr.docEnd", {
        value: c.endsAt === "-" ? t("ctr.openEndedLower") : dateLong(c.endsAt),
      }),
    },
    { text: t("ctr.docAmount", { value: sum(c.amount) }) },
    { text: t("ctr.docPaymentTerm", { value: paymentLabel(c.paymentTerm) }) },
    { text: t("ctr.docSteps"), style: "heading" },
    ...c.timeline.map((s) => ({
      text: s.done
        ? t("ctr.docStepDone", {
            label: stepLabel(s.label),
            date: s.date === "-" ? t("ctr.docDateNotSet") : dateShort(s.date),
            actor: s.actor,
          })
        : t("ctr.docStepPending", { label: stepLabel(s.label) }),
    })),
    { text: t("ctr.docLessorSign"), style: "small" },
    { text: t("ctr.docTenantSign"), style: "small" },
  ];
}

/** MKON-2025-0158 → TSD-2025-0158 */
function actCode(c: Contract) {
  return `TSD-${c.code.replace(/^[A-Z]+-/, "")}`;
}

function actLines(c: Contract): DocxLine[] {
  return [
    ...contractHead(c, t("ctr.actTitle")),
    { text: t("ctr.docAgreementRecord"), style: "heading" },
    { text: t("ctr.docActNo", { value: actCode(c) }) },
    {
      text: t("ctr.docAgreementDate", {
        value:
          approveDate.value === "-"
            ? t("ctr.docNotSet")
            : dateLong(approveDate.value),
      }),
    },
    { text: t("ctr.docApprovedBy", { name: approver.value }) },
    { text: t("ctr.docAmount", { value: sum(c.amount) }) },
    {
      text: t("ctr.docCurrentStatus", {
        value: statusLabel("contract", c.status),
      }),
    },
    {
      text: t("ctr.docDidoxNote"),
    },
    { text: t("ctr.docLessorSign"), style: "small" },
    { text: t("ctr.docTenantSign"), style: "small" },
  ];
}

/** Brauzer saqlaydigan nusxa: nomi va haqiqiy hajmi */
const documentOutput = computed(() => {
  const c = contract.value;
  const d = activeDocument.value;
  if (!c || !d) return null;
  const base = d.name.replace(/\.[^.]+$/, "");
  const blob = docxBlob(documentLines(c, base));
  return { name: `${base}.docx`, size: fileSize(blob.size) };
});

function downloadDocument() {
  const c = contract.value;
  const d = activeDocument.value;
  if (!c || !d) return;
  const base = d.name.replace(/\.[^.]+$/, "");
  const fileName = `${base}.docx`;
  saveBlob(docxBlob(documentLines(c, base)), fileName);
  banner.value = t("ctr.fileSaved", { file: fileName });
  documentOpen.value = false;
}

function downloadAct() {
  const c = contract.value;
  if (!c) return;
  const fileName = `${actCode(c)}.docx`;
  saveBlob(docxBlob(actLines(c)), fileName);
  banner.value = t("ctr.fileSaved", { file: fileName });
  actOpen.value = false;
}

/** Bosqichni bajarilgan deb belgilaydi va mas’ul bilan sanani yozadi */
function completeStep(label: string) {
  const step = contract.value?.timeline.find((s) => s.label === label);
  if (!step || step.done) return;
  step.done = true;
  step.date = todayIso();
  step.actor = currentApprover.value;
}

/** Ichki kelishuv qaydi: shartnoma kelishuv bosqichiga o‘tadi */
function approveContract() {
  const c = contract.value;
  if (!c) return;
  const person = currentApprover.value;
  completeStep("Kelishildi");
  if (c.status === "DRAFT") c.status = "REVIEW";
  banner.value = t("ctr.bannerAgreed", { code: c.code, person });
  approveOpen.value = false;
}

/**
 * Imzolangan nusxa Didoxdan qaytgach shartnoma imzolangan deb belgilanadi.
 * Imzo tizim ichida qo‘yilmaydi, bu yerda faqat natija qayd etiladi.
 */
function markSigned() {
  const c = contract.value;
  if (!c || !isAgreed.value || isSigned.value) return;
  completeStep("Imzolandi");
  c.status = "SIGNED";
  banner.value = t("ctr.bannerSigned", { code: c.code });
}

/** Faollashtirish: shartnoma reyestrda amaldagi hujjatga aylanadi */
function activateContract() {
  const c = contract.value;
  if (!c || !isSigned.value || isActive.value) return;
  completeStep("Faollashdi");
  c.status = "ACTIVE";
  banner.value = t("ctr.bannerActivated", { code: c.code });
}

const DOC_TONE: Record<string, string> = {
  pdf: "bg-danger-50 text-danger-600",
  xlsx: "bg-ok-50 text-ok-600",
  docx: "bg-brand-50 text-brand-600",
};
</script>

<template>
  <AppTopbar
    :title="contract ? contract.code : t('ctr.notFound')"
    :subtitle="
      contract
        ? t('ctr.contractOfType', {
            type: typeOfLabel(contract.type),
            tenant: contract.tenant,
          })
        : ''
    "
    :breadcrumb="[
      { label: sectionLabel('contracts'), to: '/contracts' },
      { label: contract ? contract.code : t('ctr.notFoundShort') },
    ]"
  >
    <template #actions>
      <UiButton variant="secondary" size="sm" to="/contracts">
        <UiIcon name="chevronLeft" :size="16" />
        {{ t("ctr.backToRegistry") }}
      </UiButton>
      <UiButton
        v-if="contract && auth.canRoute('/billing/invoices')"
        variant="secondary"
        size="sm"
        to="/billing/invoices"
      >
        <UiIcon name="wallet" :size="16" />
        {{ moduleTitle("invoices") }}
      </UiButton>
    </template>
  </AppTopbar>

  <main class="scroll-slim flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
    <UiCard v-if="!contract" :title="t('ctr.notFound')">
      <p class="text-[14px] text-ink-600">
        {{ t("ctr.notFoundText") }}
      </p>
      <UiButton class="mt-4" to="/contracts">
        <UiIcon name="contract" :size="16" />
        {{ t("ctr.registryTitle") }}
      </UiButton>
    </UiCard>

    <template v-else>
      <div
        v-if="banner"
        class="flex items-center gap-3 rounded-card bg-ok-50 px-4 py-3 ring-1 ring-ok-100"
      >
        <UiIcon name="check" :size="18" class="text-ok-600" />
        <p class="min-w-0 flex-1 text-[13px] font-medium text-ok-700">
          {{ banner }}
        </p>
        <button
          type="button"
          class="rounded-lg p-1 text-ok-700 transition-colors hover:bg-ok-100"
          :aria-label="t('common.closeMessage')"
          @click="banner = ''"
        >
          <UiIcon name="x" :size="16" />
        </button>
      </div>

      <section class="grid gap-5 xl:grid-cols-3">
        <div class="min-w-0 space-y-5 xl:col-span-2">
          <UiCard
            :title="t('ctr.detailsTitle')"
            :subtitle="t('ctr.detailsCaption')"
          >
            <template #actions>
              <UiStatus kind="contract" :value="contract.status" />
            </template>

            <dl class="divide-y divide-ink-100">
              <div class="flex items-baseline justify-between gap-6 py-3">
                <dt class="text-[13px] text-ink-500">{{ field("type") }}</dt>
                <dd class="text-[14px] font-semibold text-ink-900">
                  {{ typeLabel(contract.type) }}
                </dd>
              </div>
              <div class="flex items-baseline justify-between gap-6 py-3">
                <dt class="text-[13px] text-ink-500">
                  {{ field("legalTenant") }}
                </dt>
                <dd class="text-[14px] font-semibold text-ink-900">
                  {{ contract.tenant }}
                </dd>
              </div>
              <div class="flex items-baseline justify-between gap-6 py-3">
                <dt class="text-[13px] text-ink-500">{{ field("object") }}</dt>
                <dd class="text-right text-[14px] font-semibold text-ink-900">
                  {{ contract.buildingName }}, {{ contract.unitCode }}
                </dd>
              </div>
              <div class="flex items-baseline justify-between gap-6 py-3">
                <dt class="text-[13px] text-ink-500">
                  {{ field("startDate") }}
                </dt>
                <dd class="text-[14px] font-semibold text-ink-900">
                  {{ dateLong(contract.startsAt) }}
                </dd>
              </div>
              <div class="flex items-baseline justify-between gap-6 py-3">
                <dt class="text-[13px] text-ink-500">{{ field("endDate") }}</dt>
                <dd class="text-[14px] font-semibold text-ink-900">
                  {{
                    contract.endsAt === "-"
                      ? t("ctr.openEnded")
                      : dateLong(contract.endsAt)
                  }}
                </dd>
              </div>
              <div class="flex items-baseline justify-between gap-6 py-3">
                <dt class="text-[13px] text-ink-500">
                  {{ t("ctr.contractAmount") }}
                </dt>
                <dd class="tabular text-[14px] font-bold text-ink-900">
                  {{ money(contract.amount) }}
                </dd>
              </div>
              <div class="flex items-baseline justify-between gap-6 py-3">
                <dt class="text-[13px] text-ink-500">
                  {{ field("paymentTerm") }}
                </dt>
                <dd class="text-[14px] font-semibold text-ink-900">
                  {{ paymentLabel(contract.paymentTerm) }}
                </dd>
              </div>
              <div class="flex items-baseline justify-between gap-6 py-3">
                <dt class="text-[13px] text-ink-500">
                  {{ t("ctr.approvedBy") }}
                </dt>
                <dd class="text-right text-[14px] font-semibold text-ink-900">
                  <template v-if="isAgreed">
                    {{ approver }}
                    <span
                      class="tabular block text-[12px] font-medium text-ink-500"
                    >
                      {{ dateShort(approveDate) }}
                    </span>
                  </template>
                  <span v-else class="text-[13px] font-medium text-ink-500">
                    {{ t("ctr.agreementPending") }}
                  </span>
                </dd>
              </div>
            </dl>
          </UiCard>

          <UiCard
            :title="t('ctr.documentsTitle')"
            :subtitle="
              t('ctr.filesAttached', { n: num(contract.documents.length) })
            "
            flush
            :padded="false"
          >
            <p
              v-if="!contract.documents.length"
              class="px-5 py-6 text-[13px] text-ink-500"
            >
              {{ t("empty.noAttachedDocuments") }}
            </p>
            <ul v-else class="divide-y divide-ink-100 border-t border-ink-100">
              <li
                v-for="d in contract.documents"
                :key="d.name"
                class="flex items-center gap-4 px-5 py-3.5"
              >
                <span
                  class="grid size-10 shrink-0 place-items-center rounded-[10px]"
                  :class="DOC_TONE[d.type] ?? 'bg-ink-100 text-ink-600'"
                >
                  <UiIcon name="doc" :size="18" />
                </span>
                <span class="min-w-0 flex-1">
                  <span
                    class="block truncate text-[14px] font-semibold text-ink-900"
                  >
                    {{ d.name }}
                  </span>
                  <span class="block text-[12px] text-ink-500">
                    {{ d.size }} · {{ d.type.toUpperCase() }}
                  </span>
                </span>
                <UiButton
                  variant="secondary"
                  size="sm"
                  @click="openDocument(d)"
                >
                  <UiIcon name="download" :size="15" />
                  {{ t("common.download") }}
                </UiButton>
              </li>
            </ul>
          </UiCard>

          <UiCard
            :title="t('ctr.processTitle')"
            :subtitle="t('ctr.processCaption')"
          >
            <ol class="space-y-0">
              <li
                v-for="(step, i) in contract.timeline"
                :key="step.label"
                class="flex gap-4"
                :class="i < contract.timeline.length - 1 ? 'pb-5' : ''"
              >
                <div class="flex flex-col items-center">
                  <span
                    class="grid size-9 shrink-0 place-items-center rounded-full ring-1"
                    :class="
                      step.done
                        ? 'bg-ok-50 text-ok-600 ring-ok-100'
                        : 'bg-ink-50 text-ink-400 ring-ink-200'
                    "
                  >
                    <UiIcon :name="step.done ? 'check' : 'clock'" :size="17" />
                  </span>
                  <span
                    v-if="i < contract.timeline.length - 1"
                    class="mt-1 w-px flex-1"
                    :class="step.done ? 'bg-ok-100' : 'bg-ink-200'"
                  />
                </div>
                <div class="min-w-0 flex-1 pt-1">
                  <p class="text-[14px] font-bold text-ink-900">
                    {{ stepLabel(step.label) }}
                  </p>
                  <p class="mt-0.5 text-[13px] text-ink-500">
                    {{
                      step.date === "-"
                        ? t("ctr.dateNotSet")
                        : dateLong(step.date)
                    }}
                    ·
                    {{ step.actor }}
                  </p>
                </div>
                <span
                  class="shrink-0 self-start rounded-pill px-2.5 py-1 text-[12px] font-semibold"
                  :class="
                    step.done
                      ? 'bg-ok-50 text-ok-700'
                      : 'bg-ink-100 text-ink-600'
                  "
                >
                  {{ step.done ? t("common.done") : t("common.pending") }}
                </span>
              </li>
            </ol>
          </UiCard>
        </div>

        <div class="min-w-0 space-y-5">
          <UiCard
            :title="t('ctr.manageTitle')"
            :subtitle="t('ctr.manageCaption')"
          >
            <div class="rounded-field bg-surface-sunken p-4">
              <div class="flex items-center justify-between gap-3">
                <span class="text-[13px] text-ink-500">{{
                  field("currentStatus")
                }}</span>
                <UiStatus kind="contract" :value="contract.status" size="sm" />
              </div>
              <p class="mt-2 text-[13px] leading-relaxed text-ink-600">
                {{
                  isAgreed
                    ? t("ctr.agreedNote", {
                        date: dateShort(approveDate),
                        person: approver,
                      })
                    : t("ctr.agreementWaitNote")
                }}
              </p>
              <p class="mt-2 text-[13px] leading-relaxed text-ink-600">
                {{ isSigned ? t("ctr.signedNote") : t("ctr.signWaitNote") }}
              </p>
              <p
                v-if="isActive"
                class="mt-2 text-[13px] leading-relaxed text-ok-700"
              >
                {{ t("ctr.activeNote") }}
              </p>
            </div>

            <template v-if="canManage">
              <UiButton
                v-if="!isAgreed"
                class="mt-4"
                size="lg"
                block
                @click="approveOpen = true"
              >
                <UiIcon name="check" :size="18" />
                {{ t("ctr.recordAgreement") }}
              </UiButton>

              <UiButton
                v-else-if="!isSigned"
                class="mt-4"
                size="lg"
                block
                @click="markSigned"
              >
                <UiIcon name="edit" :size="18" />
                {{ t("ctr.markSigned") }}
              </UiButton>

              <UiButton
                v-else-if="!isActive"
                class="mt-4"
                size="lg"
                variant="success"
                block
                @click="activateContract"
              >
                <UiIcon name="check" :size="18" />
                {{ t("ctr.activate") }}
              </UiButton>
            </template>

            <p
              v-else
              class="mt-4 flex items-center justify-center gap-2 rounded-field bg-ink-100 px-3 py-2.5 text-[13px] font-semibold text-ink-600"
            >
              <UiIcon name="eye" :size="15" />
              {{ t("ctr.readOnlyNote") }}
            </p>

            <UiButton
              v-if="isAgreed"
              class="mt-3"
              size="lg"
              variant="secondary"
              block
              @click="actOpen = true"
            >
              <UiIcon name="doc" :size="18" />
              {{ t("ctr.viewAct") }}
            </UiButton>
          </UiCard>

          <UiCard
            :title="t('ctr.financeTitle')"
            :subtitle="t('ctr.financeCaption')"
            flush
            :padded="false"
          >
            <div class="grid grid-cols-2 gap-3 px-5 pb-4">
              <div class="rounded-field bg-surface-sunken p-3">
                <p class="text-[12px] text-ink-500">
                  {{ t("navShort.documents") }}
                </p>
                <p class="tabular mt-0.5 text-sm font-bold text-ink-900">
                  {{ num(relatedInvoices.length) }} {{ unitOf("pcs") }}
                </p>
              </div>
              <div class="rounded-field bg-surface-sunken p-3">
                <p class="text-[12px] text-ink-500">{{ field("debt") }}</p>
                <p class="tabular mt-0.5 text-sm font-bold text-danger-600">
                  {{ money(relatedDebt) }}
                </p>
              </div>
            </div>

            <p
              v-if="!relatedInvoices.length"
              class="border-t border-ink-100 px-5 py-5 text-[13px] text-ink-500"
            >
              {{ t("ctr.noInvoicesForTenant") }}
            </p>
            <ul v-else class="divide-y divide-ink-100 border-t border-ink-100">
              <li v-for="i in relatedInvoices" :key="i.id" class="px-5 py-3">
                <!--
                  Qator faqat hisob-kitob bo'limi ochiq bo'lgan rolda havola
                  bo'ladi. Operator va bino rahbari shartnomani ko'radi, lekin
                  billingga kira olmaydi: ular uchun bu oddiy yozuv.
                -->
                <component
                  :is="canOpenBilling ? NuxtLink : 'div'"
                  :to="canOpenBilling ? '/billing/invoices' : undefined"
                  class="group flex items-center gap-3"
                >
                  <span class="min-w-0 flex-1">
                    <span
                      class="block truncate text-[13px] font-semibold text-ink-900 group-hover:text-brand-600"
                    >
                      {{ i.code }}
                    </span>
                    <span class="block text-[12px] text-ink-500">{{
                      i.period
                    }}</span>
                  </span>
                  <span
                    class="tabular shrink-0 text-[13px] font-bold text-ink-900"
                  >
                    {{ money(i.total) }}
                  </span>
                  <UiStatus kind="invoice" :value="i.status" size="sm" />
                </component>
              </li>
            </ul>
          </UiCard>
        </div>
      </section>

      <UiModal
        v-model="approveOpen"
        size="sm"
        :title="t('ctr.recordAgreement')"
        :subtitle="contract.code"
      >
        <p class="text-[14px] leading-relaxed text-ink-700">
          {{ t("ctr.approveModalText") }}
        </p>
        <dl
          class="mt-4 divide-y divide-ink-100 rounded-field bg-surface-sunken px-4"
        >
          <div class="flex items-baseline justify-between gap-4 py-2.5">
            <dt class="text-[13px] text-ink-500">{{ field("party") }}</dt>
            <dd class="text-[14px] font-semibold text-ink-900">
              {{ contract.tenant }}
            </dd>
          </div>
          <div class="flex items-baseline justify-between gap-4 py-2.5">
            <dt class="text-[13px] text-ink-500">
              {{ t("ctr.approvedByNow") }}
            </dt>
            <dd class="text-[14px] font-semibold text-ink-900">
              {{ currentApprover }}
            </dd>
          </div>
          <div class="flex items-baseline justify-between gap-4 py-2.5">
            <dt class="text-[13px] text-ink-500">
              {{ t("ctr.agreementDate") }}
            </dt>
            <dd class="tabular text-[14px] font-semibold text-ink-900">
              {{ dateShort(todayIso()) }}
            </dd>
          </div>
          <div class="flex items-baseline justify-between gap-4 py-2.5">
            <dt class="text-[13px] text-ink-500">{{ t("ctr.amount") }}</dt>
            <dd class="tabular text-[14px] font-semibold text-ink-900">
              {{ money(contract.amount) }}
            </dd>
          </div>
          <div class="flex items-baseline justify-between gap-4 py-2.5">
            <dt class="text-[13px] text-ink-500">{{ field("validity") }}</dt>
            <dd class="text-[14px] font-semibold text-ink-900">
              {{ dateShort(contract.startsAt) }} ·
              {{
                contract.endsAt === "-"
                  ? t("ctr.openEndedLower")
                  : dateShort(contract.endsAt)
              }}
            </dd>
          </div>
        </dl>

        <template #footer>
          <UiButton variant="ghost" @click="approveOpen = false">{{
            t("common.cancel")
          }}</UiButton>
          <UiButton variant="success" @click="approveContract">
            <UiIcon name="check" :size="16" />
            {{ t("ctr.recordAgreement") }}
          </UiButton>
        </template>
      </UiModal>

      <UiModal
        v-model="actOpen"
        size="sm"
        :title="t('ctr.actTitle')"
        :subtitle="contract.code"
      >
        <dl class="divide-y divide-ink-100">
          <div class="flex items-baseline justify-between gap-4 py-2.5">
            <dt class="text-[13px] text-ink-500">
              {{ t("ctr.agreementDate") }}
            </dt>
            <dd class="text-[14px] font-semibold text-ink-900">
              {{ dateLong(approveDate) }}
            </dd>
          </div>
          <div class="flex items-baseline justify-between gap-4 py-2.5">
            <dt class="text-[13px] text-ink-500">{{ t("ctr.approvedBy") }}</dt>
            <dd class="text-[14px] font-semibold text-ink-900">
              {{ approver }}
            </dd>
          </div>
          <div class="flex items-baseline justify-between gap-4 py-2.5">
            <dt class="text-[13px] text-ink-500">{{ field("party") }}</dt>
            <dd class="text-[14px] font-semibold text-ink-900">
              {{ contract.tenant }}
            </dd>
          </div>
          <div class="flex items-baseline justify-between gap-4 py-2.5">
            <dt class="text-[13px] text-ink-500">{{ field("actNo") }}</dt>
            <dd class="tabular text-[14px] font-semibold text-ink-900">
              {{ actCode(contract) }}
            </dd>
          </div>
          <div class="flex items-baseline justify-between gap-4 py-2.5">
            <dt class="text-[13px] text-ink-500">{{ field("status") }}</dt>
            <dd>
              <UiStatus kind="contract" :value="contract.status" size="sm" />
            </dd>
          </div>
        </dl>

        <template #footer>
          <UiButton variant="ghost" @click="actOpen = false">{{
            t("common.close")
          }}</UiButton>
          <UiButton @click="downloadAct">
            <UiIcon name="download" :size="16" />
            {{ t("common.download") }}
          </UiButton>
        </template>
      </UiModal>

      <UiModal
        v-model="documentOpen"
        size="sm"
        :title="t('ctr.downloadDocument')"
        :subtitle="activeDocument ? activeDocument.name : ''"
      >
        <div v-if="activeDocument" class="flex items-center gap-4">
          <span
            class="grid size-12 shrink-0 place-items-center rounded-field"
            :class="DOC_TONE[activeDocument.type] ?? 'bg-ink-100 text-ink-600'"
          >
            <UiIcon name="doc" :size="22" />
          </span>
          <div class="min-w-0">
            <p class="truncate text-[14px] font-bold text-ink-900">
              {{ documentOutput?.name }}
            </p>
            <p class="mt-0.5 text-[13px] text-ink-500">
              DOCX · {{ documentOutput?.size }} · {{ contract.code }}
            </p>
          </div>
        </div>

        <template #footer>
          <UiButton variant="ghost" @click="documentOpen = false">{{
            t("common.cancel")
          }}</UiButton>
          <UiButton @click="downloadDocument">
            <UiIcon name="download" :size="16" />
            {{ t("common.download") }}
          </UiButton>
        </template>
      </UiModal>
    </template>
  </main>
</template>
