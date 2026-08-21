<script setup lang="ts">
const { title: notifTitle, body: notifBody } = useNotificationText();
import {
  NOTIFICATION_CATEGORIES,
  type AppNotification,
} from "~/data/operations";
import { ROLE_META } from "~/constants/roles";

const auth = useAuthStore();
const { t } = useI18n();

/** Header qo‘ng‘irog‘i bilan bitta umumiy ro‘yxat */
const { items, markRead, markAllRead } = useNotifications();

function pick(...candidates: string[]) {
  const role = auth.role;
  if (!role) return candidates[0]!;
  return candidates.find((c) => auth.canRoute(c)) ?? ROLE_META[role].home;
}

interface DetailRow {
  label: string;
  value: string;
  tone?: "danger" | "warn" | "ok";
}

interface DetailAction {
  label: string;
  icon: string;
  to: string;
  primary?: boolean;
}

const DETAILS = computed<
  Record<string, { rows: DetailRow[]; actions: DetailAction[] }>
>(() => ({
  "n-01": {
    rows: [
      { label: t("field.invoice"), value: "INV-2025-0621" },
      {
        label: t("field.amount"),
        value: t("unitOf.currencyValue", { value: "12 540 000" }),
      },
      {
        label: t("field.due"),
        value: `23.05.2025 (${t("usr.daysLeft", { count: 3 })})`,
        tone: "warn",
      },
      { label: t("field.object"), value: "Green Business Center" },
      { label: t("field.paymentMethod"), value: t("usr.bankTransfer") },
    ],
    actions: [
      {
        label: t("usr.actPay"),
        icon: "wallet",
        to: pick("/cabinet/invoices", "/billing/invoices"),
        primary: true,
      },
      {
        label: t("usr.actViewInvoice"),
        icon: "doc",
        to: pick("/cabinet/invoices", "/billing/invoices"),
      },
    ],
  },
  "n-02": {
    rows: [
      { label: t("field.applicationNo"), value: "SR-2025-0703" },
      { label: t("field.object"), value: "Mega Mall" },
      { label: t("field.unit"), value: "204" },
      { label: t("usr.responsibleStaff"), value: "Jasur Toshmatov" },
      { label: t("field.completionRate"), value: "100%", tone: "ok" },
    ],
    actions: [
      {
        label: t("usr.actViewRequest"),
        icon: "wrench",
        to: pick("/cabinet", "/service-requests"),
        primary: true,
      },
      {
        label: t("usr.actOpenDocs"),
        icon: "doc",
        to: pick("/cabinet/documents", "/contracts"),
      },
    ],
  },
  "n-03": {
    rows: [
      { label: t("field.unit"), value: "706" },
      { label: t("field.object"), value: "Green Business Center" },
      {
        label: t("field.area"),
        value: t("unitOf.sqmValue", { value: "61.30" }),
      },
      {
        label: t("field.price"),
        value: `${t("unitOf.currencyValue", { value: "11 200 000" })} / ${t("unitOf.month")}`,
      },
      { label: t("field.status"), value: t("status.unit.VACANT"), tone: "ok" },
    ],
    actions: [
      {
        label: t("apply.cta"),
        icon: "clipboard",
        to: pick("/cabinet/applications", "/applications"),
        primary: true,
      },
      {
        label: t("usr.actViewObject"),
        icon: "building",
        to: pick("/cabinet/units", "/objects"),
      },
    ],
  },
  "n-04": {
    rows: [
      { label: t("field.contract"), value: "MKON-2025-0155" },
      { label: t("field.tenant"), value: "Global Logistics & Trans" },
      { label: t("field.object"), value: "Harmony Residence" },
      { label: t("field.unit"), value: "A-502" },
      { label: t("usr.approvalStatus"), value: t("usr.pending"), tone: "warn" },
    ],
    actions: [
      {
        label: t("usr.actOpenContract"),
        icon: "contract",
        to: pick("/cabinet/documents", "/contracts"),
        primary: true,
      },
      {
        label: t("usr.actDocArchive"),
        icon: "doc",
        to: pick("/cabinet/documents", "/contracts"),
      },
    ],
  },
  "n-05": {
    rows: [
      { label: t("field.invoice"), value: "INV-2025-0584" },
      { label: t("field.tenant"), value: "Dream Retail" },
      {
        label: t("field.amount"),
        value: t("unitOf.currencyValue", { value: "7 890 000" }),
      },
      {
        label: t("field.delay"),
        value: `61 ${t("unitOf.day")}`,
        tone: "danger",
      },
      { label: t("field.object"), value: "Mega Mall" },
    ],
    actions: [
      {
        label: t("usr.actViewDebt"),
        icon: "chart",
        to: pick("/cabinet/invoices", "/billing/debts"),
        primary: true,
      },
      {
        label: t("usr.actOpenInvoice"),
        icon: "wallet",
        to: pick("/cabinet/invoices", "/billing/invoices"),
      },
    ],
  },
  "n-06": {
    rows: [
      { label: t("field.device"), value: "Chrome · Windows 11" },
      { label: t("field.region"), value: t("usr.locTashkent") },
      { label: t("usr.loginTime"), value: "19.05.2025, 21:14" },
      { label: t("usr.sessionStatus"), value: t("common.active"), tone: "ok" },
    ],
    actions: [
      {
        label: t("usr.actSecuritySettings"),
        icon: "shield",
        to: "/profile",
        primary: true,
      },
      { label: t("usr.actViewSessions"), icon: "key", to: "/profile" },
    ],
  },
}));

const CATEGORY_TONE: Record<string, string> = {
  "To‘lovlar": "bg-warn-50 text-warn-600",
  Arizalar: "bg-info-50 text-info-600",
  Servis: "bg-ok-50 text-ok-600",
  Hujjatlar: "bg-brand-50 text-brand-600",
  Tizim: "bg-ink-100 text-ink-600",
};

const CATEGORY_TAG: Record<string, string> = {
  "To‘lovlar": "bg-warn-50 text-warn-700",
  Arizalar: "bg-info-50 text-info-700",
  Servis: "bg-ok-50 text-ok-700",
  Hujjatlar: "bg-brand-50 text-brand-700",
  Tizim: "bg-ink-100 text-ink-700",
};

const CATEGORY_ICON: Record<string, string> = {
  Barchasi: "bell",
  "To‘lovlar": "wallet",
  Arizalar: "clipboard",
  Servis: "wrench",
  Hujjatlar: "doc",
  Tizim: "gear",
};

/**
 * Kategoriya nomi ma’lumotda o‘zbekcha saqlanadi: qiymat filtrlash uchun
 * o‘zgarmaydi, ekranga esa tanlangan tildagi nomi chiqadi.
 */
const CATEGORY_LABEL: Record<string, string> = {
  Barchasi: "common.all",
  "To‘lovlar": "navShort.payments",
  Arizalar: "nav.applications",
  Servis: "section.service",
  Hujjatlar: "navShort.documents",
  Tizim: "usr.catSystem",
};

function categoryLabel(label: string) {
  const key = CATEGORY_LABEL[label];
  return key ? t(key) : label;
}

const category = ref("Barchasi");
const query = ref("");
const readFilter = ref("all");

const readOptions = computed(() => [
  { value: "all", label: t("common.all") },
  { value: "unread", label: t("tab.unread") },
  { value: "read", label: t("tab.read") },
]);

const categories = computed(() =>
  NOTIFICATION_CATEGORIES.map((c) => ({
    label: c.label,
    count:
      c.label === "Barchasi"
        ? items.value.length
        : items.value.filter((n) => n.category === c.label).length,
    unread:
      c.label === "Barchasi"
        ? items.value.filter((n) => !n.read).length
        : items.value.filter((n) => n.category === c.label && !n.read).length,
  })),
);

const tabs = computed(() =>
  categories.value.map((c) => ({
    value: c.label,
    label: categoryLabel(c.label),
    count: c.count,
  })),
);

const unreadTotal = computed(() => items.value.filter((n) => !n.read).length);

const filtered = computed(() =>
  items.value.filter((n) => {
    const byCategory =
      category.value === "Barchasi" || n.category === category.value;
    const byRead =
      readFilter.value === "all" ||
      (readFilter.value === "unread" ? !n.read : n.read);
    const q = query.value.trim().toLowerCase();
    const byQuery =
      !q ||
      notifTitle(n).toLowerCase().includes(q) ||
      notifBody(n).toLowerCase().includes(q);
    return byCategory && byRead && byQuery;
  }),
);

/*
 * Ochiladigan yozuv havoladagi `?id=` dan olinadi: qo'ng'iroqdan aynan
 * bosilgan bildirishnoma ochiladi. Identifikator berilmasa yoki topilmasa,
 * ro'yxatdagi birinchisi ochiladi.
 */
const route = useRoute();

const selectedId = ref<string>(
  (() => {
    const asked = String(route.query.id ?? "");
    if (asked && items.value.some((n) => n.id === asked)) return asked;
    return items.value[0]?.id ?? "";
  })(),
);

watch(
  () => route.query.id,
  (value) => {
    const asked = String(value ?? "");
    if (asked && items.value.some((n) => n.id === asked)) {
      selectedId.value = asked;
      markRead(asked);
    }
  },
);
const selected = computed(
  () => items.value.find((n) => n.id === selectedId.value) ?? null,
);
const selectedDetail = computed(() =>
  selected.value ? (DETAILS.value[selected.value.id] ?? null) : null,
);

function select(n: AppNotification) {
  selectedId.value = n.id;
  markRead(n.id);
}

const channels = computed(() => [
  {
    id: "in-app",
    label: t("usr.notifyInApp"),
    caption: t("usr.channelInAppCaption"),
    icon: "bell",
    tone: "bg-brand-50 text-brand-600",
    active: true,
  },
  {
    id: "sms",
    label: "SMS",
    caption: t("usr.channelNotConnected"),
    icon: "send",
    tone: "bg-ink-100 text-ink-500",
    active: false,
  },
  {
    id: "email",
    label: t("common.email"),
    caption: t("usr.channelNotConnected"),
    icon: "doc",
    tone: "bg-ink-100 text-ink-500",
    active: false,
  },
  {
    id: "telegram",
    label: "Telegram",
    caption: t("usr.channelNotConnected"),
    icon: "globe",
    tone: "bg-ink-100 text-ink-500",
    active: false,
  },
]);
</script>

<template>
  <AppTopbar
    :title="t('usr.notifCenter')"
    :subtitle="t('usr.notifCenterCaption', { count: unreadTotal })"
  >
    <template #actions>
      <UiButton
        variant="secondary"
        size="sm"
        :disabled="!unreadTotal"
        @click="markAllRead"
      >
        <UiIcon name="check" :size="16" />
        {{ t("common.markAllRead") }}
      </UiButton>
      <UiButton size="sm" to="/profile">
        <UiIcon name="gear" :size="16" />
        {{ t("nav.settings") }}
      </UiButton>
    </template>
  </AppTopbar>

  <main class="scroll-slim flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
    <section class="grid gap-5 xl:grid-cols-[260px_minmax(0,1fr)_360px]">
      <UiCard flush>
        <div class="flex items-start gap-3 px-5 pt-5">
          <span
            class="grid size-11 shrink-0 place-items-center rounded-field bg-brand-500 text-white"
          >
            <UiIcon name="bell" :size="20" />
          </span>
          <div class="min-w-0">
            <h3 class="text-[16px] font-semibold text-ink-900">
              {{ t("common.notifications") }}
            </h3>
            <p class="mt-0.5 text-[13px] leading-snug text-ink-500">
              {{ t("usr.notifLead") }}
            </p>
          </div>
        </div>

        <ul class="mt-4 space-y-1 px-3">
          <li v-for="c in categories" :key="c.label">
            <button
              type="button"
              class="flex w-full items-center gap-3 rounded-field px-3 py-2.5 text-left transition-colors"
              :class="
                category === c.label
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900'
              "
              @click="category = c.label"
            >
              <UiIcon :name="CATEGORY_ICON[c.label] ?? 'bell'" :size="18" />
              <span class="flex-1 truncate text-[14px] font-semibold">{{
                categoryLabel(c.label)
              }}</span>
              <span
                class="tabular grid min-w-6 place-items-center rounded-pill px-1.5 py-0.5 text-[11px] font-bold"
                :class="
                  category === c.label
                    ? 'bg-white text-brand-700'
                    : 'bg-ink-100 text-ink-600'
                "
              >
                {{ c.count }}
              </span>
            </button>
          </li>
        </ul>

        <div class="mt-4 border-t border-ink-100 p-3">
          <NuxtLink
            to="/profile"
            class="flex items-center gap-3 rounded-field px-3 py-2.5 text-ink-600 transition-colors hover:bg-ink-100 hover:text-ink-900"
          >
            <UiIcon name="gear" :size="18" />
            <span class="min-w-0 flex-1">
              <span class="block text-[14px] font-semibold">{{
                t("nav.settings")
              }}</span>
              <span class="block truncate text-[12px] text-ink-500">
                {{ t("usr.notifSettingsLink") }}
              </span>
            </span>
            <UiIcon name="chevronRight" :size="16" class="text-ink-400" />
          </NuxtLink>
        </div>
      </UiCard>

      <UiCard flush>
        <div class="space-y-3 px-5 pt-5">
          <UiTabs v-model="category" :tabs="tabs" variant="line" />
          <div class="flex flex-wrap items-center gap-3">
            <UiInput
              v-model="query"
              :placeholder="t('usr.searchMessages')"
              class="min-w-56 flex-1"
            >
              <template #prefix><UiIcon name="search" :size="16" /></template>
            </UiInput>
            <UiSelect
              v-model="readFilter"
              :options="readOptions"
              class="w-44"
            />
          </div>
        </div>

        <ul class="mt-2 divide-y divide-ink-100">
          <li v-for="n in filtered" :key="n.id">
            <button
              type="button"
              class="flex w-full items-start gap-3.5 px-5 py-4 text-left transition-colors"
              :class="
                selectedId === n.id
                  ? 'bg-brand-50/70'
                  : n.read
                    ? 'hover:bg-ink-50'
                    : 'hover:bg-brand-50/40'
              "
              @click="select(n)"
            >
              <span
                class="grid size-10 shrink-0 place-items-center rounded-field"
                :class="CATEGORY_TONE[n.category]"
              >
                <UiIcon :name="n.icon" :size="18" />
              </span>

              <span class="min-w-0 flex-1">
                <span class="flex items-center gap-2">
                  <span
                    class="truncate text-[14px]"
                    :class="
                      n.read
                        ? 'font-medium text-ink-700'
                        : 'font-bold text-ink-900'
                    "
                  >
                    {{ notifTitle(n) }}
                  </span>
                </span>
                <span class="mt-0.5 block truncate text-[13px] text-ink-500">{{
                  notifBody(n)
                }}</span>
              </span>

              <span class="flex shrink-0 flex-col items-end gap-1.5">
                <span
                  class="rounded-pill px-2 py-0.5 text-[11px] font-semibold"
                  :class="CATEGORY_TAG[n.category]"
                >
                  {{ categoryLabel(n.category) }}
                </span>
                <span class="flex items-center gap-2">
                  <span class="tabular text-[12px] text-ink-500">{{
                    n.at
                  }}</span>
                  <span
                    class="size-2 rounded-full"
                    :class="n.read ? 'bg-ink-300' : 'bg-brand-500'"
                    :aria-label="n.read ? t('tab.read') : t('tab.unread')"
                  />
                </span>
              </span>
            </button>
          </li>

          <li
            v-if="!filtered.length"
            class="px-5 py-16 text-center text-[14px] text-ink-500"
          >
            {{ t("usr.noMessages") }}
          </li>
        </ul>

        <div
          class="flex items-center justify-between border-t border-ink-100 px-5 py-3.5"
        >
          <p class="text-[13px] text-ink-500">
            {{ t("common.total") }}:
            <b class="text-ink-800">{{ filtered.length }}</b>
            {{ t("usr.notifCountUnit") }}
          </p>
          <UiButton
            variant="ghost"
            size="sm"
            :disabled="!unreadTotal"
            @click="markAllRead"
          >
            {{ t("common.markAllRead") }}
          </UiButton>
        </div>
      </UiCard>

      <UiCard flush>
        <div v-if="selected" class="px-5 pt-5">
          <div class="flex items-start gap-3.5">
            <span
              class="grid size-12 shrink-0 place-items-center rounded-field"
              :class="CATEGORY_TONE[selected.category]"
            >
              <UiIcon :name="selected.icon" :size="20" />
            </span>
            <div class="min-w-0 flex-1">
              <h3 class="text-[16px] font-bold text-ink-900">
                {{ notifTitle(selected) }}
              </h3>
              <p class="mt-0.5 text-[13px] text-ink-500">
                {{ categoryLabel(selected.category) }} · {{ selected.at }}
              </p>
            </div>
            <span
              v-if="!selected.read"
              class="rounded-pill bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-700"
            >
              {{ t("common.new") }}
            </span>
          </div>

          <p class="mt-4 text-[14px] leading-relaxed text-ink-700">
            {{ notifBody(selected) }}
          </p>

          <div v-if="selectedDetail" class="mt-4">
            <p class="mb-2 text-[13px] font-semibold text-ink-700">
              {{ t("usr.details") }}
            </p>
            <dl
              class="divide-y divide-ink-100 rounded-field ring-1 ring-ink-200"
            >
              <div
                v-for="r in selectedDetail.rows"
                :key="r.label"
                class="flex items-center justify-between gap-3 px-4 py-2.5"
              >
                <dt class="text-[13px] text-ink-500">{{ r.label }}</dt>
                <dd
                  class="tabular text-right text-[13px] font-semibold"
                  :class="
                    r.tone === 'danger'
                      ? 'text-danger-600'
                      : r.tone === 'warn'
                        ? 'text-warn-700'
                        : r.tone === 'ok'
                          ? 'text-ok-700'
                          : 'text-ink-900'
                  "
                >
                  {{ r.value }}
                </dd>
              </div>
            </dl>
          </div>

          <div v-if="selectedDetail" class="mt-4 pb-5">
            <p class="mb-2 text-[13px] font-semibold text-ink-700">
              {{ t("usr.recommendedActions") }}
            </p>
            <div class="space-y-2">
              <UiButton
                v-for="a in selectedDetail.actions"
                :key="a.label"
                :variant="a.primary ? 'primary' : 'secondary'"
                size="sm"
                block
                :to="a.to"
              >
                <UiIcon :name="a.icon" :size="16" />
                {{ a.label }}
              </UiButton>
            </div>
          </div>
        </div>

        <p v-else class="px-5 py-20 text-center text-[14px] text-ink-500">
          {{ t("usr.selectNotification") }}
        </p>
      </UiCard>
    </section>

    <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <NuxtLink
        v-for="c in channels"
        :key="c.id"
        to="/profile"
        class="flex items-center gap-3.5 rounded-card bg-surface p-4 shadow-card ring-1 ring-ink-200/60 transition-all hover:shadow-panel hover:ring-brand-300"
      >
        <span
          class="grid size-11 shrink-0 place-items-center rounded-field"
          :class="c.tone"
        >
          <UiIcon :name="c.icon" :size="20" />
        </span>
        <span class="min-w-0 flex-1">
          <span class="block truncate text-[14px] font-semibold text-ink-900">{{
            c.label
          }}</span>
          <span class="block truncate text-[12px] text-ink-500">{{
            c.caption
          }}</span>
        </span>
        <span
          class="shrink-0 rounded-pill px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset"
          :class="
            c.active
              ? 'bg-ok-50 text-ok-700 ring-ok-100'
              : 'bg-ink-100 text-ink-600 ring-ink-200'
          "
        >
          {{ c.active ? t("common.active") : t("connection.disconnected") }}
        </span>
      </NuxtLink>
    </section>

    <div class="flex items-start gap-3 rounded-card bg-brand-50 px-5 py-4">
      <UiIcon name="info" :size="18" class="mt-0.5 shrink-0 text-brand-600" />
      <p class="text-[13px] leading-snug text-brand-700">
        {{ t("usr.channelsNoteLong") }}
      </p>
    </div>
  </main>
</template>
