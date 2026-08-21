<script setup lang="ts">
import {
  NAVIGATION,
  type NavChild,
  type NavItem,
} from "~/constants/navigation";

/**
 * Telefon ko‘rinishidagi asosiy navigatsiya. Yon panel o‘rniga pastki qatorda
 * rolning eng ko‘p ishlatiladigan bo‘limlari turadi, qolganlari «Yana»
 * varag‘ida ochiladi.
 */

const auth = useAuthStore();
const route = useRoute();
const { t, tr } = useAppLabels();

/** Pastki qator tor bo‘lgani uchun yorliqlar qisqartirilgan ko‘rinishda beriladi. */
const SHORT_KEYS: Record<string, string> = {
  "/dashboard/executive": "navShort.dashboard",
  "/dashboard/building": "navShort.dashboard",
  "/objects": "navShort.objects",
  "/contracts": "navShort.contracts",
  "/billing/invoices": "navShort.invoices",
  "/billing/payments": "navShort.payments",
  "/billing/debts": "navShort.debts",
  "/billing/periods": "navShort.periods",
  "/applications": "navShort.applications",
  "/service-requests": "navShort.service",
  "/facility/work-orders": "navShort.workOrders",
  "/facility/materials": "navShort.materials",
  "/meters": "navShort.meters",
  "/warehouse": "navShort.warehouse",
  "/warehouse/movements": "navShort.movements",
  "/warehouse/inventory": "navShort.inventory",
  "/content": "navShort.contentQueue",
  "/content/floors": "navShort.floors",
  "/content/units": "navShort.units",
  "/cabinet": "navShort.cabinet",
  "/cabinet/units": "navShort.myUnits",
  "/cabinet/invoices": "navShort.myInvoices",
  "/cabinet/applications": "navShort.myApplications",
  "/cabinet/documents": "navShort.documents",
  "/cabinet/meters": "navShort.meters",
  "/reports": "navShort.reports",
  "/settings/users": "navShort.settings",
  "/help": "navShort.help",
};

/** To‘liq yorliq: kalit berilmagan bo‘lsa registrdagi nom qoladi */
function navLabel(item: NavItem | NavChild) {
  return tr(item.key, item.label);
}

/** Qatorga sig‘adigan eng ko‘p element soni */
const MAX_TABS = 5;

/*
 * Telefon pastki menyusi ham huquq bo'yicha filtrlanadi. Ilgari u shunchaki
 * rol menyusini olardi va yopilgan bo'lim tugmasi ko'rinib turardi: bosilganda
 * foydalanuvchi o'z bosh sahifasiga uloqtirilardi.
 */
const items = computed<NavItem[]>(() =>
  (auth.role ? NAVIGATION[auth.role] : [])
    .flatMap((section) => section.items)
    .filter((item) => auth.canRoute(item.to)),
);

const primary = computed(() =>
  items.value.length <= MAX_TABS
    ? items.value
    : items.value.slice(0, MAX_TABS - 1),
);

const extra = computed(() =>
  items.value.length <= MAX_TABS ? [] : items.value.slice(MAX_TABS - 1),
);

function matches(to: string) {
  return route.path === to || route.path.startsWith(`${to}/`);
}

/**
 * Bir nechta yo‘l mos kelsa eng aniq (eng uzun) manzil tanlanadi, aks holda
 * «/cabinet» ichki sahifalarda ham faol ko‘rinib qoladi.
 */
const activeTo = computed(() => {
  const all = items.value.flatMap((i) => [
    i.to,
    ...(i.children?.map((c) => c.to) ?? []),
  ]);
  return all.filter(matches).sort((a, b) => b.length - a.length)[0] ?? "";
});

function isActive(item: NavItem) {
  return (
    item.to === activeTo.value ||
    (item.children?.some((c) => c.to === activeTo.value) ?? false)
  );
}

function shortLabel(item: NavItem) {
  const key = SHORT_KEYS[item.to];
  return key ? t(key) : navLabel(item);
}

const extraActive = computed(() => extra.value.some(isActive));

const extraBadge = computed(() => {
  const total = extra.value.reduce((sum, i) => sum + (i.badge ?? 0), 0);
  return total > 0 ? total : null;
});

const sheetOpen = ref(false);

watch(
  () => route.fullPath,
  () => (sheetOpen.value = false),
);
onKeyStroke("Escape", () => (sheetOpen.value = false));
</script>

<template>
  <nav
    v-if="items.length"
    class="fixed inset-x-0 bottom-0 z-40 border-t border-ink-200 bg-surface/95 backdrop-blur-md md:hidden"
    :aria-label="t('shell.primaryNav')"
  >
    <ul class="flex items-stretch pb-[env(safe-area-inset-bottom)]">
      <li v-for="item in primary" :key="item.to" class="min-w-0 flex-1">
        <NuxtLink
          :to="item.to"
          class="flex h-[58px] flex-col items-center justify-center gap-1 px-0.5 transition-colors"
          :class="isActive(item) ? 'text-brand-600' : 'text-ink-500'"
          :aria-current="isActive(item) ? 'page' : undefined"
        >
          <span
            class="relative grid h-7 w-12 place-items-center rounded-pill transition-colors"
            :class="isActive(item) ? 'bg-brand-50' : ''"
          >
            <UiIcon :name="item.icon" :size="20" />
            <span
              v-if="item.badge"
              class="tabular absolute -right-0.5 -top-1 grid min-w-4 place-items-center rounded-pill bg-danger-500 px-1 text-[11px] font-bold leading-4 text-white ring-2 ring-white"
            >
              {{ item.badge }}
            </span>
          </span>
          <span
            class="w-full truncate text-center text-[11px] font-semibold leading-none"
          >
            {{ shortLabel(item) }}
          </span>
        </NuxtLink>
      </li>

      <li v-if="extra.length" class="min-w-0 flex-1">
        <button
          type="button"
          class="flex h-[58px] w-full flex-col items-center justify-center gap-1 px-0.5 transition-colors"
          :class="extraActive ? 'text-brand-600' : 'text-ink-500'"
          :aria-expanded="sheetOpen"
          @click="sheetOpen = true"
        >
          <span
            class="relative grid h-7 w-12 place-items-center rounded-pill transition-colors"
            :class="extraActive ? 'bg-brand-50' : ''"
          >
            <UiIcon name="dots" :size="20" />
            <span
              v-if="extraBadge"
              class="tabular absolute -right-0.5 -top-1 grid min-w-4 place-items-center rounded-pill bg-danger-500 px-1 text-[11px] font-bold leading-4 text-white ring-2 ring-white"
            >
              {{ extraBadge }}
            </span>
          </span>
          <span
            class="w-full truncate text-center text-[11px] font-semibold leading-none"
          >
            {{ t("shell.moreTab") }}
          </span>
        </button>
      </li>
    </ul>
  </nav>

  <!-- Qolgan bo‘limlar varag‘i -->
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-150"
      enter-from-class="opacity-0"
      leave-active-class="transition-opacity duration-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="sheetOpen"
        class="fixed inset-0 z-50 bg-ink-900/40 backdrop-blur-[2px] md:hidden"
        @click.self="sheetOpen = false"
      >
        <Transition
          appear
          enter-active-class="transition-transform duration-200 ease-out"
          enter-from-class="translate-y-full"
        >
          <div
            role="dialog"
            aria-modal="true"
            :aria-label="t('shell.allSections')"
            class="absolute inset-x-0 bottom-0 flex max-h-[78dvh] flex-col rounded-t-panel bg-surface shadow-pop"
          >
            <header
              class="relative flex shrink-0 items-center justify-between gap-3 px-4 pb-2 pt-4"
            >
              <span
                class="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-pill bg-ink-200"
              />
              <h2 class="text-[16px] font-bold text-ink-900">
                {{ t("shell.allSections") }}
              </h2>
              <button
                type="button"
                class="-mr-2 grid size-11 place-items-center rounded-field text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-800"
                :aria-label="t('common.close')"
                @click="sheetOpen = false"
              >
                <UiIcon name="x" :size="20" />
              </button>
            </header>

            <div
              class="scroll-slim min-h-0 flex-1 overflow-y-auto px-3 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-1"
            >
              <ul class="space-y-1">
                <li v-for="item in extra" :key="item.to">
                  <NuxtLink
                    :to="item.to"
                    class="flex min-h-[52px] items-center gap-3 rounded-field px-3 py-2.5 text-[14px] font-semibold transition-colors"
                    :class="
                      isActive(item)
                        ? 'bg-brand-50 text-brand-700'
                        : 'text-ink-700 hover:bg-ink-100 hover:text-ink-900'
                    "
                  >
                    <span
                      class="grid size-9 shrink-0 place-items-center rounded-field"
                      :class="
                        isActive(item)
                          ? 'bg-brand-500 text-white'
                          : 'bg-ink-100 text-ink-600'
                      "
                    >
                      <UiIcon :name="item.icon" :size="20" />
                    </span>
                    <span class="min-w-0 flex-1 truncate">{{
                      navLabel(item)
                    }}</span>
                    <span
                      v-if="item.badge"
                      class="tabular grid min-w-5 shrink-0 place-items-center rounded-pill bg-danger-500 px-1.5 py-0.5 text-[11px] font-bold text-white"
                    >
                      {{ item.badge }}
                    </span>
                    <UiIcon
                      v-else
                      name="chevronRight"
                      :size="16"
                      class="shrink-0 text-ink-300"
                    />
                  </NuxtLink>

                  <ul v-if="item.children" class="mt-1 space-y-1 pl-[52px]">
                    <li v-for="child in item.children" :key="child.to">
                      <NuxtLink
                        :to="child.to"
                        class="flex min-h-[44px] items-center rounded-field px-3 py-2 text-[13px] font-medium transition-colors"
                        :class="
                          child.to === activeTo
                            ? 'bg-brand-50 font-semibold text-brand-700'
                            : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900'
                        "
                      >
                        {{ navLabel(child) }}
                      </NuxtLink>
                    </li>
                  </ul>
                </li>
              </ul>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
