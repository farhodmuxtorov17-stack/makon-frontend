<script setup lang="ts">
import { buildingById } from "~/data/buildings";
import { UNITS, unitById } from "~/data/units";
import {
  formatStir,
  organizationByStir,
  stirDigits,
} from "~/data/organizations";
import { area, num } from "~/utils/format";

definePageMeta({ layout: "public", public: true });

const route = useRoute();
const lease = useLeaseStore();
const { t } = useI18n();
const { unitUsageLabel, money, field, priceUnitLabel } = useAppLabels();

lease.seed();

/** Ikki bosqich: forma va natija */
const step = ref("form");

/*
 * Ariza faqat ijara bo'yicha yuboriladi.
 *
 * Sotuvdagi maydon bo'yicha oldi-sotdi shartnomasi tizim ichida tuzilmaydi:
 * ariza kartochkasida tasdiqlash tugmasi chiqmaydi va yozuv «Yangi ariza»
 * bosqichida abadiy qotib qolardi. Shuning uchun bunday unit mijozga
 * ko'rsatiladigan ro'yxatga umuman tushmaydi, u Operator bilan telefon
 * orqali rasmiylashtiriladi.
 */
const vacantUnits = computed(() =>
  UNITS.filter((u) => u.status === "VACANT" && u.offer !== "Sotuv"),
);

const unitOptions = computed(() =>
  vacantUnits.value.map((u) => ({
    value: u.id,
    label: t("apply.unitOption", {
      building: buildingById(u.buildingId)?.name ?? "",
      code: u.code,
      area: area(u.area),
    }),
  })),
);

const TERM_MONTHS = [12, 24, 36, 60];

const termOptions = computed(() =>
  TERM_MONTHS.map((count) => ({
    value: String(count),
    label: t("apply.termMonths", { count }),
  })),
);

const form = reactive({
  unitId: "",
  fullName: "",
  phone: "",
  email: "",
  orgName: "",
  stir: "",
  price: "",
  startDate: firstOfNextMonth(),
  term: "24",
  note: "",
});

const submitted = ref(false);
const pending = ref(false);

const unit = computed(() => (form.unitId ? unitById(form.unitId) : undefined));
const building = computed(() =>
  unit.value ? buildingById(unit.value.buildingId) : undefined,
);

/** Boshlanish sanasi standarti, keyingi oyning birinchi kuni */
function firstOfNextMonth() {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

onMounted(() => {
  const requested = String(route.query.unit ?? "");
  const found = vacantUnits.value.find((u) => u.id === requested);
  form.unitId = found?.id ?? "";
  form.startDate = firstOfNextMonth();
  if (found) form.price = String(monthlyPrice(found));
});

/**
 * Ayrim unitlar m² narxi bilan e’lon qilinadi, taklif narxi maydoni esa oylik
 * summani kutadi. Shuning uchun m² narxi unit maydoniga ko‘paytiriladi.
 */
function monthlyPrice(u: { price: number; area: number; priceUnit: string }) {
  return u.priceUnit === "so‘m / m²" ? Math.round(u.price * u.area) : u.price;
}

watch(
  () => form.unitId,
  (id) => {
    const u = vacantUnits.value.find((x) => x.id === id);
    if (u) form.price = String(monthlyPrice(u));
  },
);

// --- Telefon niqobi --------------------------------------------------------

function formatPhone(d: string): string {
  if (!d) return "";
  let out = `+998 (${d.slice(0, 2)}`;
  if (d.length >= 2) out += ")";
  if (d.length > 2) out += ` ${d.slice(2, 5)}`;
  if (d.length > 5) out += ` ${d.slice(5, 7)}`;
  if (d.length > 7) out += ` ${d.slice(7, 9)}`;
  return out;
}

const phoneFormatted = computed(() => formatPhone(form.phone));
const phoneValid = computed(() => /^[3-9]\d{8}$/.test(form.phone));

function onPhoneInput(event: Event) {
  const el = event.target as HTMLInputElement;
  let raw = el.value.replace(/\D/g, "");
  if (raw.startsWith("998")) raw = raw.slice(3);
  form.phone = raw.slice(0, 9);
  el.value = phoneFormatted.value;
}

// --- STIR bo‘yicha qidiruv -------------------------------------------------

const stirLabel = computed(() => formatStir(form.stir));
const foundOrg = computed(() =>
  form.stir.length === 9 ? organizationByStir(form.stir) : undefined,
);
const stirNotFound = computed(() => form.stir.length === 9 && !foundOrg.value);

function onStirInput(event: Event) {
  const el = event.target as HTMLInputElement;
  form.stir = stirDigits(el.value);
  el.value = stirLabel.value;
}

// Reyestrda topilgan tashkilot nomi formaga o‘tadi, qolgan rekvizitlar
// kartochkada ko‘rinadi va ariza bilan birga yuboriladi.
watch(foundOrg, (org) => {
  if (org) form.orgName = org.name;
});

// --- Tekshirish ------------------------------------------------------------

/*
 * Ariza beshta maydondan iborat: tashkilot nomi, mas'ul shaxs, telefon,
 * taklif narxi va muddat. Boshqasi majburiy emas.
 *
 * Ilgari e-pochta, STIR, unit va boshlanish sanasi ham majburiy edi. Ariza
 * ochiq forma: mijoz shu yerda hamma narsani bilishi shart emas, qolgan
 * ma'lumotni operator qo'ng'iroq paytida aniqlashtiradi.
 */
const errors = computed(() => {
  const e: Record<string, string> = {};
  if (form.orgName.trim().length < 3) e.orgName = t("apply.orgError");
  if (form.fullName.trim().length < 3) e.fullName = t("apply.nameError");
  if (!phoneValid.value) e.phone = t("apply.phoneError");
  if (!(Number(form.price) > 0)) e.price = t("apply.priceError");
  if (!(Number(form.term) > 0)) e.term = t("apply.termError");
  return e;
});

function errorOf(name: string) {
  return submitted.value ? (errors.value[name] ?? "") : "";
}

const price = computed(() => Number(form.price) || 0);
const term = computed(() => Number(form.term) || 12);
const estimate = computed(() => price.value * term.value);

// --- Telefon tasdig‘i ------------------------------------------------------

// --- Yuborish --------------------------------------------------------------

/** Xato maydonni ekranda topish uchun input identifikatorlari */
const FIELD_ANCHOR: Record<string, string> = {
  fullName: "ariza-name",
  phone: "ariza-phone",
  orgName: "ariza-org",
  unitId: "ariza-unit",
  price: "ariza-price",
};

const firstErrorLabel = computed(() => {
  const keys = Object.keys(errors.value);
  if (keys.length === 0) return "";
  const first = keys[0] as string;
  return errors.value[first] ?? "";
});

function focusFirstError() {
  const first = Object.keys(errors.value)[0];
  const id = first ? FIELD_ANCHOR[first] : undefined;
  if (!id) return;
  nextTick(() => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.focus();
  });
}

/*
 * Ariza to'g'ridan-to'g'ri yuboriladi.
 *
 * Ilgari bu yerda telefonga bir martalik kod yuborilib, olti xonali raqamni
 * kiritish qadami bor edi. Ariza ochiq forma: mijoz hisob ochmasdan, hech
 * qanday tasdiqlashsiz yuboradi va operator o'zi qo'ng'iroq qilib
 * aniqlashtiradi. Qo'shimcha qadam faqat arizani yuborishga to'sqinlik
 * qilardi.
 */
function submitApplication() {
  submitted.value = true;
  if (pending.value) return;
  if (Object.keys(errors.value).length > 0) {
    focusFirstError();
    return;
  }

  pending.value = true;
  const org = foundOrg.value;
  const created = lease.createCase({
    unitId: form.unitId,
    org: {
      name: form.orgName.trim(),
      tin: stirLabel.value,
      director: org?.director ?? form.fullName.trim(),
      phone: phoneFormatted.value,
      email: form.email.trim(),
      address: org?.address ?? "",
    },
    offerPrice: price.value,
    startDate: form.startDate,
    term: term.value,
    note: form.note.trim(),
    type: "Ijaraga olish",
    guest: true,
    contactName: form.fullName.trim(),
  });
  pending.value = false;

  if (!created) {
    sendError.value = true;
    return;
  }

  createdCode.value = created.code;
  step.value = "done";
}

const createdCode = ref("");
const sendError = ref(false);

const trackPath = computed(() => `/ariza/${createdCode.value}`);
const lastFour = computed(() => form.phone.slice(-4));
</script>

<template>
  <div class="mx-auto w-full max-w-[1100px] px-4 py-8 lg:px-8 lg:py-12">
    <nav
      class="flex flex-wrap items-center gap-1.5 text-[13px] text-ink-500"
      :aria-label="t('common.breadcrumb')"
    >
      <NuxtLink to="/" class="rounded-[6px] hover:text-brand-600">{{
        t("nav.cabinet")
      }}</NuxtLink>
      <span aria-hidden="true">/</span>
      <NuxtLink to="/catalog" class="rounded-[6px] hover:text-brand-600">
        {{ t("public.navCatalog") }}
      </NuxtLink>
      <span aria-hidden="true">/</span>
      <span class="font-semibold text-ink-700">{{
        t("field.application")
      }}</span>
    </nav>

    <!-- Yakuniy holat -->
    <template v-if="step === 'done'">
      <div class="mx-auto mt-8 max-w-[640px]">
        <div
          class="rounded-card bg-surface p-6 shadow-card ring-1 ring-ink-200/60 sm:p-8"
        >
          <span
            class="grid size-14 place-items-center rounded-[16px] bg-ok-50 text-ok-600"
            aria-hidden="true"
          >
            <UiIcon name="check" :size="28" />
          </span>

          <h1
            class="mt-5 font-display text-[22px] font-extrabold leading-tight text-ink-900"
          >
            {{ t("apply.doneHeading") }}
          </h1>
          <p class="mt-2 text-[14px] leading-relaxed text-ink-600">
            {{ t("apply.doneVerifiedLead") }}
          </p>

          <div
            class="mt-5 rounded-card bg-brand-50 p-4 text-center ring-1 ring-inset ring-brand-100"
          >
            <p
              class="text-[12px] font-semibold uppercase tracking-wide text-brand-700"
            >
              {{ t("apply.doneNumber") }}
            </p>
            <p
              class="tabular mt-1 text-[22px] font-extrabold tracking-wide text-brand-700"
            >
              {{ createdCode }}
            </p>
          </div>

          <p class="mt-4 text-[13px] leading-relaxed text-ink-600">
            {{ t("apply.doneTrackHint") }}
          </p>

          <div class="mt-5 flex flex-wrap gap-2.5">
            <UiButton :to="trackPath" size="lg">
              <UiIcon name="search" :size="17" />
              {{ t("apply.trackCta") }}
            </UiButton>
            <UiButton to="/catalog" variant="secondary" size="lg">
              {{ t("apply.backToCatalog") }}
            </UiButton>
          </div>

          <div
            class="mt-5 flex items-start gap-3 rounded-field bg-surface-sunken p-3.5 ring-1 ring-inset ring-ink-200"
          >
            <UiIcon
              name="info"
              :size="17"
              class="mt-px shrink-0 text-ink-400"
            />
            <span class="min-w-0">
              <span class="block text-[13px] leading-relaxed text-ink-600">
                {{ t("apply.saveLink") }}
                <span class="font-semibold text-ink-900">{{ trackPath }}</span>
              </span>
              <span
                class="mt-1.5 block text-[13px] leading-relaxed text-ink-600"
              >
                {{ t("apply.doneCabinetNote") }}
              </span>
            </span>
          </div>
        </div>
      </div>
    </template>

    <!-- Telefon tasdig‘i -->

    <!-- Ariza formasi -->
    <template v-else>
      <header class="mt-5">
        <p
          class="text-[11px] font-semibold uppercase tracking-wide text-brand-600"
        >
          {{ t("apply.step1Eyebrow") }}
        </p>
        <h1
          class="mt-2 font-display text-[28px] font-extrabold leading-tight text-ink-900 sm:text-[28px]"
        >
          {{ t("apply.cta") }}
        </h1>
        <p class="mt-2 max-w-[70ch] text-[14px] leading-relaxed text-ink-600">
          {{ t("apply.formLead") }}
        </p>
      </header>

      <div class="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div class="min-w-0 space-y-5">
          <UiCard
            :title="t('apply.contactSection')"
            :subtitle="t('apply.contactSectionHint')"
            icon="user"
          >
            <form
              class="space-y-4"
              novalidate
              @submit.prevent="submitApplication"
            >
              <p
                class="flex items-start gap-2 rounded-field bg-brand-50 px-3.5 py-2.5 text-[13px] leading-relaxed text-brand-700 ring-1 ring-inset ring-brand-200"
              >
                <UiIcon name="info" :size="15" class="mt-px shrink-0" />
                {{ t("apply.legalPersonNote") }}
              </p>

              <UiField
                :label="t('apply.nameLabel')"
                required
                for="ariza-name"
                :error="errorOf('fullName')"
              >
                <UiInput
                  id="ariza-name"
                  v-model="form.fullName"
                  name="name"
                  autocomplete="name"
                  :placeholder="t('apply.namePlaceholder')"
                  :invalid="Boolean(errorOf('fullName'))"
                />
              </UiField>

              <div class="grid gap-4 sm:grid-cols-2">
                <UiField
                  :label="t('apply.phoneLabel')"
                  required
                  for="ariza-phone"
                  :error="errorOf('phone')"
                >
                  <div class="relative">
                    <input
                      id="ariza-phone"
                      type="tel"
                      inputmode="numeric"
                      autocomplete="tel"
                      name="phone"
                      placeholder="+998 (--) --- -- --"
                      :value="phoneFormatted"
                      :aria-invalid="Boolean(errorOf('phone')) || undefined"
                      class="tabular h-11 w-full rounded-field bg-white pl-3.5 pr-10 text-sm text-ink-800 ring-1 ring-inset transition-colors placeholder:font-normal placeholder:text-ink-400 focus:ring-2 focus:ring-brand-500"
                      :class="
                        errorOf('phone')
                          ? 'ring-danger-400'
                          : 'ring-ink-200 hover:ring-ink-300'
                      "
                      @input="onPhoneInput"
                    />
                    <svg
                      v-if="phoneValid"
                      class="absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-ok-500"
                      viewBox="0 0 16 16"
                      fill="none"
                      aria-hidden="true"
                    >
                      <circle
                        cx="8"
                        cy="8"
                        r="7"
                        stroke="currentColor"
                        stroke-width="1.5"
                      />
                      <path
                        d="M5 8.2 7 10.2l4-4.4"
                        stroke="currentColor"
                        stroke-width="1.7"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                    </svg>
                  </div>
                </UiField>
              </div>

              <!-- Yuridik shaxs rekvizitlari -->

              <div
                v-if="foundOrg"
                class="rounded-field bg-ok-50 p-3.5 ring-1 ring-inset ring-ok-100"
              >
                <p
                  class="flex items-center gap-2 text-[13px] font-semibold text-ok-700"
                >
                  <UiIcon name="check" :size="15" class="shrink-0" />
                  {{ t("apply.orgFound") }}
                </p>
                <dl class="mt-2.5 grid gap-2 sm:grid-cols-2">
                  <div>
                    <dt class="text-[12px] text-ink-500">
                      {{ field("name") }}
                    </dt>
                    <dd class="text-[13px] font-semibold text-ink-900">
                      {{ foundOrg.name }}
                    </dd>
                  </div>
                  <div>
                    <dt class="text-[12px] text-ink-500">
                      {{ field("director") }}
                    </dt>
                    <dd class="text-[13px] font-semibold text-ink-900">
                      {{ foundOrg.director }}
                    </dd>
                  </div>
                  <div class="sm:col-span-2">
                    <dt class="text-[12px] text-ink-500">
                      {{ field("legalAddress") }}
                    </dt>
                    <dd class="text-[13px] font-semibold text-ink-900">
                      {{ foundOrg.address }}
                    </dd>
                  </div>
                </dl>
              </div>

              <p
                v-else-if="stirNotFound"
                class="flex items-start gap-2 rounded-field bg-warn-50 p-3.5 text-[13px] leading-relaxed text-ink-700 ring-1 ring-inset ring-warn-100"
              >
                <UiIcon
                  name="info"
                  :size="15"
                  class="mt-px shrink-0 text-warn-600"
                />
                {{ t("apply.orgNotFound") }}
              </p>

              <UiField
                :label="t('apply.orgLabel')"
                required
                for="ariza-org"
                :error="errorOf('orgName')"
              >
                <UiInput
                  id="ariza-org"
                  v-model="form.orgName"
                  name="organization"
                  autocomplete="organization"
                  :placeholder="t('apply.orgLabel')"
                  :invalid="Boolean(errorOf('orgName'))"
                />
              </UiField>
            </form>
          </UiCard>

          <UiCard
            :title="t('apply.termsSection')"
            :subtitle="t('apply.termsSectionHint')"
            icon="clipboard"
          >
            <form
              class="space-y-4"
              novalidate
              @submit.prevent="submitApplication"
            >
              <UiField
                :label="field('vacantUnit')"
                required
                for="ariza-unit"
                :error="errorOf('unitId')"
              >
                <UiSelect
                  id="ariza-unit"
                  v-model="form.unitId"
                  :options="unitOptions"
                  :placeholder="t('apply.unitPlaceholder')"
                  :invalid="Boolean(errorOf('unitId'))"
                />
              </UiField>

              <div class="grid gap-4 sm:grid-cols-2">
                <UiField
                  :label="field('offerPrice')"
                  required
                  for="ariza-price"
                  :error="errorOf('price')"
                  :hint="t('apply.priceHint')"
                >
                  <UiInput
                    id="ariza-price"
                    v-model="form.price"
                    type="number"
                    min="0"
                    placeholder="0"
                    :invalid="Boolean(errorOf('price'))"
                  >
                    <template #suffix
                      ><span class="text-[12px]">{{
                        t("unitOf.currency")
                      }}</span></template
                    >
                  </UiInput>
                </UiField>
                <UiField :label="field('deadline')" required>
                  <UiSelect v-model="form.term" :options="termOptions" />
                </UiField>
              </div>

              <UiField :label="t('common.note')" :hint="t('apply.noteHint')">
                <textarea
                  v-model="form.note"
                  rows="4"
                  class="w-full rounded-field bg-white px-3.5 py-2.5 text-sm text-ink-800 ring-1 ring-inset ring-ink-200 transition-colors placeholder:text-ink-400 hover:ring-ink-300 focus:ring-2 focus:ring-brand-500"
                  :placeholder="t('apply.notePlaceholder')"
                />
              </UiField>

              <p
                v-if="submitted && firstErrorLabel"
                role="alert"
                class="flex items-start gap-2 rounded-field bg-danger-50 p-3.5 text-[13px] leading-relaxed font-medium text-danger-700 ring-1 ring-inset ring-danger-100"
              >
                <UiIcon name="warning" :size="16" class="mt-px shrink-0" />
                <span class="min-w-0">
                  {{ t("apply.formIncomplete", { error: firstErrorLabel }) }}
                </span>
              </p>

              <p
                v-if="sendError"
                class="flex items-start gap-2 rounded-field bg-danger-50 px-3.5 py-2.5 text-[13px] text-danger-700 ring-1 ring-inset ring-danger-100"
              >
                <UiIcon name="warning" :size="15" class="mt-px shrink-0" />
                {{ t("apply.sendFailed") }}
              </p>

              <div
                class="flex flex-wrap items-center justify-end gap-3 border-t border-ink-100 pt-4"
              >
                <UiButton variant="ghost" to="/catalog">{{
                  t("common.cancel")
                }}</UiButton>
                <UiButton type="submit" size="lg" :disabled="pending">
                  <UiIcon name="send" :size="16" />
                  {{ pending ? t("apply.sending") : t("apply.submitCta") }}
                </UiButton>
              </div>
            </form>
          </UiCard>
        </div>

        <!-- Tanlangan maydon -->
        <div class="min-w-0 space-y-5">
          <UiCard
            v-if="unit && building"
            :title="t('apply.selectedUnit')"
            icon="building"
            tone="teal"
            flush
            :padded="false"
          >
            <UiPhoto
              :name="building.photo"
              :alt="t('apply.buildingAlt', { name: building.name })"
              ratio="aspect-[16/10]"
              rounded="rounded-none"
              sizes="(max-width: 1279px) 100vw, 340px"
            />
            <div class="p-5">
              <p class="text-[16px] font-extrabold leading-snug text-ink-900">
                {{ building.name }}
              </p>
              <p class="mt-1 text-[13px] text-ink-500">
                {{ building.city }}, {{ building.district }},
                {{ building.street }}
              </p>

              <dl class="mt-4 grid grid-cols-2 gap-3">
                <div
                  class="rounded-field bg-surface-sunken px-3 py-2.5 ring-1 ring-inset ring-ink-200"
                >
                  <dt class="text-[11px] text-ink-500">{{ field("unit") }}</dt>
                  <dd class="tabular text-[13px] font-bold text-ink-900">
                    {{ unit.code }}
                  </dd>
                </div>
                <div
                  class="rounded-field bg-surface-sunken px-3 py-2.5 ring-1 ring-inset ring-ink-200"
                >
                  <dt class="text-[11px] text-ink-500">{{ field("floor") }}</dt>
                  <dd class="tabular text-[13px] font-bold text-ink-900">
                    {{ unit.floor }}
                  </dd>
                </div>
                <div
                  class="rounded-field bg-surface-sunken px-3 py-2.5 ring-1 ring-inset ring-ink-200"
                >
                  <dt class="text-[11px] text-ink-500">{{ field("area") }}</dt>
                  <dd class="tabular text-[13px] font-bold text-ink-900">
                    {{ area(unit.area) }}
                  </dd>
                </div>
                <div
                  class="rounded-field bg-surface-sunken px-3 py-2.5 ring-1 ring-inset ring-ink-200"
                >
                  <dt class="text-[11px] text-ink-500">
                    {{ field("usageShort") }}
                  </dt>
                  <dd class="text-[13px] font-bold text-ink-900">
                    {{ unitUsageLabel(unit.usage) }}
                  </dd>
                </div>
              </dl>

              <div
                class="mt-3 flex items-baseline justify-between gap-3 rounded-field bg-brand-50 px-3.5 py-3 ring-1 ring-inset ring-brand-100"
              >
                <span class="text-[13px] text-ink-600">{{
                  t("apply.listedPrice")
                }}</span>
                <span class="tabular text-[14px] font-extrabold text-brand-700">
                  {{ num(unit.price) }} {{ priceUnitLabel(unit.priceUnit) }}
                </span>
              </div>

              <UiButton
                :to="`/catalog/${building.slug}?unit=${unit.id}`"
                variant="secondary"
                size="sm"
                block
                class="mt-3"
              >
                <UiIcon name="eye" :size="15" />
                {{ t("apply.objectPage") }}
              </UiButton>
            </div>
          </UiCard>

          <UiCard
            v-if="price > 0"
            :title="t('apply.estimateTitle')"
            :subtitle="t('apply.estimateHint')"
            icon="chart"
            tone="brand"
          >
            <dl class="space-y-3">
              <div class="flex items-baseline justify-between gap-3">
                <dt class="text-[13px] text-ink-500">
                  {{ t("apply.offerPriceMonthly") }}
                </dt>
                <dd class="tabular text-[14px] font-bold text-ink-900">
                  {{ money(price) }}
                </dd>
              </div>
              <div class="flex items-baseline justify-between gap-3">
                <dt class="text-[13px] text-ink-500">
                  {{ field("deadline") }}
                </dt>
                <dd class="tabular text-[14px] font-bold text-ink-900">
                  {{ t("apply.termMonths", { count: term }) }}
                </dd>
              </div>
              <div
                class="flex items-baseline justify-between gap-3 border-t border-ink-100 pt-3"
              >
                <dt class="text-[13px] text-ink-500">
                  {{ t("apply.totalForTerm") }}
                </dt>
                <dd class="tabular text-[16px] font-extrabold text-brand-700">
                  {{ money(estimate) }}
                </dd>
              </div>
            </dl>
          </UiCard>

          <UiCard :title="t('apply.trackCta')" icon="search" tone="neutral">
            <p class="text-[13px] leading-relaxed text-ink-600">
              {{ t("apply.trackLead") }}
            </p>
            <p
              v-if="lastFour.length === 4"
              class="mt-2 text-[13px] text-ink-600"
            >
              {{ t("apply.lastFourLabel") }}
              <span class="tabular font-bold text-ink-900">{{ lastFour }}</span>
            </p>
          </UiCard>
        </div>
      </div>
    </template>
  </div>
</template>
