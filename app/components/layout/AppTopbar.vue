<script setup lang="ts">
import { ROLE_TONE_CLASSES } from '~/constants/roles'
import { NOTIFICATIONS, type AppNotification } from '~/data/operations'

defineProps<{
  title?: string
  subtitle?: string
  breadcrumb?: Array<{ label: string; to?: string }>
}>()

const auth = useAuthStore()
const route = useRoute()
const { t, roleLabel } = useAppLabels()

// --- Ko‘rsatkichlar: valyuta kursi va ob-havo ------------------------------

const { rates, usd, weather, load } = useHeaderData()
const fetched = useState('header-fetched', () => false)

onMounted(() => {
  if (fetched.value) return
  fetched.value = true
  load()
})

const WEATHER_TONE: Record<string, string> = {
  sun: 'text-warn-500',
  cloudSun: 'text-warn-500',
  cloud: 'text-ink-400',
  fog: 'text-ink-400',
  drizzle: 'text-brand-400',
  rain: 'text-brand-500',
  snow: 'text-brand-300',
  storm: 'text-info-500',
}

const weatherTone = computed(() => WEATHER_TONE[weather.value.icon] ?? 'text-ink-400')

const CURRENCY_KEY: Record<string, string> = {
  USD: 'shell.currencyUSD',
  EUR: 'shell.currencyEUR',
  RUB: 'shell.currencyRUB',
}

const ORDER = ['USD', 'EUR', 'RUB']

const rateList = computed(() =>
  rates.value
    .filter((r) => ORDER.includes(r.code))
    .slice()
    .sort((a, b) => ORDER.indexOf(a.code) - ORDER.indexOf(b.code)),
)

/** Ming xonalar orasida bo‘shliq, kasr qismi nuqta bilan */
function money(value: number, digits = 2) {
  const [int = '0', frac] = Math.abs(value).toFixed(digits).split('.')
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return `${value < 0 ? '-' : ''}${grouped}${frac ? `.${frac}` : ''}`
}

function signedDiff(value: number) {
  return `${value > 0 ? '+' : ''}${money(value)}`
}

/**
 * Oq fonda o‘qiladigan ranglar: ok-700 4.76:1, danger-600 4.77:1,
 * ink-500 4.76:1. ok-600 (3.17:1) matn uchun yetarli emas edi.
 */
function diffTone(value: number) {
  return value > 0 ? 'text-ok-700' : value < 0 ? 'text-danger-600' : 'text-ink-500'
}

function diffIcon(value: number) {
  return value > 0 ? 'arrowUp' : value < 0 ? 'arrowDown' : 'minus'
}

// --- Ochiladigan panellar --------------------------------------------------

type Panel = 'rate' | 'bell' | 'profile'

const panel = ref<Panel | null>(null)
const cluster = ref<HTMLElement | null>(null)

onClickOutside(cluster, () => (panel.value = null))
onKeyStroke('Escape', () => (panel.value = null))
watch(() => route.fullPath, () => (panel.value = null))

function toggle(name: Panel) {
  panel.value = panel.value === name ? null : name
}

function closeRate() {
  if (panel.value === 'rate') panel.value = null
}

// --- Bildirishnomalar ------------------------------------------------------

const notifications = useState<AppNotification[]>('header-notifications', () =>
  NOTIFICATIONS.map((n) => ({ ...n })),
)

/**
 * Moliyaviy xabarlar boshqa ijarachining nomi va hisob-fakturasini o‘z ichiga
 * oladi, shuning uchun ular faqat billing moduli ochiq bo‘lgan rollarga
 * (SUPER_HEAD va ACCOUNTANT) ko‘rsatiladi; TENANT_OWNER, BUILDING_MANAGER,
 * FACILITY, WAREHOUSE_OPERATOR va CONTENT_OPERATOR ularni ko‘rmaydi.
 */
const CATEGORY_MODULE: Partial<Record<AppNotification['category'], string>> = {
  'To‘lovlar': '/billing',
}

const visible = computed(() =>
  notifications.value.filter((n) => {
    const module = CATEGORY_MODULE[n.category]
    if (!module) return true
    return auth.canRoute(module)
  }),
)

const unread = computed(() => visible.value.filter((n) => !n.read).length)
const recent = computed(() => visible.value.slice(0, 5))

const NOTIFICATION_TONE: Record<string, string> = {
  'To‘lovlar': 'bg-warn-50 text-warn-600',
  Arizalar: 'bg-info-50 text-info-600',
  Servis: 'bg-ok-50 text-ok-600',
  Hujjatlar: 'bg-brand-50 text-brand-600',
  Tizim: 'bg-ink-100 text-ink-600',
}

function markAllRead() {
  const shown = new Set(visible.value.map((n) => n.id))
  notifications.value = notifications.value.map((n) =>
    shown.has(n.id) ? { ...n, read: true } : n,
  )
}

function openNotification(item: AppNotification) {
  notifications.value = notifications.value.map((n) =>
    n.id === item.id ? { ...n, read: true } : n,
  )
  panel.value = null
}

// --- Profil ----------------------------------------------------------------

const initials = computed(() =>
  (auth.user?.fullName ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase(),
)

const settingsTo = computed(() =>
  auth.canRoute('/settings/users') ? '/settings/users' : '/profile',
)

function signOut() {
  panel.value = null
  auth.signOut()
  navigateTo('/login')
}
</script>

<template>
  <!-- Fon shaffof emas: ochiladigan panellar sarlavha chegarasidan tashqariga
       chiqadi va orqa fon filtri ularni xiralashtirib yuborardi. -->
  <header class="sticky top-0 z-20 border-b border-ink-200 bg-surface">
    <div
      class="flex flex-wrap items-center gap-x-4 gap-y-2.5 px-4 py-3 lg:h-[72px] lg:flex-nowrap lg:px-6 lg:py-0"
    >
      <!-- Sahifa sarlavhasi -->
      <div class="min-w-0 flex-1 basis-full lg:basis-auto lg:min-w-[180px]">
        <nav v-if="breadcrumb?.length" class="mb-0.5 flex flex-wrap items-center gap-1.5 text-[12px]">
          <template v-for="(c, i) in breadcrumb" :key="i">
            <NuxtLink
              v-if="c.to"
              :to="c.to"
              class="text-ink-500 transition-colors hover:text-brand-600"
            >
              {{ c.label }}
            </NuxtLink>
            <span v-else class="text-ink-500">{{ c.label }}</span>
            <UiIcon
              v-if="i < breadcrumb.length - 1"
              name="chevronRight"
              :size="12"
              class="text-ink-300"
            />
          </template>
        </nav>

        <h1 v-if="title" class="truncate text-[22px] font-bold text-ink-900">{{ title }}</h1>
        <p v-if="subtitle" class="truncate text-[13px] text-ink-500">{{ subtitle }}</p>
      </div>

      <!-- O‘ng blok -->
      <div
        ref="cluster"
        class="relative flex min-w-0 flex-wrap items-center justify-end gap-2 lg:flex-nowrap"
      >
        <template v-if="$slots.actions">
          <div class="flex min-w-0 flex-wrap items-center justify-end gap-2 lg:flex-nowrap">
            <slot name="actions" />
          </div>
          <span class="hidden h-6 w-px shrink-0 bg-ink-200 sm:block" aria-hidden="true" />
        </template>

        <!-- Ob-havo -->
        <div class="hidden shrink-0 items-center gap-2 pr-0.5 sm:flex">
          <span class="sr-only">{{ t('shell.weatherOf', { city: weather.city }) }}</span>
          <UiIcon :name="weather.icon" :size="19" :class="weatherTone" />
          <span class="tabular text-[14px] font-semibold text-ink-800">
            {{ weather.tempC }}°
          </span>
          <span class="text-[13px] leading-tight text-ink-500 max-xl:sr-only">
            {{ weather.label }}
            <span class="block text-[11px]" aria-hidden="true">{{ weather.city }}</span>
          </span>
        </div>

        <!-- Markaziy bank kursi -->
        <div
          v-if="usd"
          class="relative hidden shrink-0 md:block"
          @mouseenter="panel = 'rate'"
          @mouseleave="closeRate"
        >
          <button
            type="button"
            class="flex h-10 items-center gap-2 rounded-field px-2.5 transition-colors hover:bg-ink-100"
            :class="panel === 'rate' ? 'bg-ink-100' : ''"
            aria-haspopup="dialog"
            :aria-expanded="panel === 'rate'"
            @click="toggle('rate')"
          >
            <span class="sr-only">{{ t('shell.ratesLabel') }}</span>
            <span class="hidden text-[11px] font-semibold uppercase tracking-wide text-ink-500 xl:block">
              1 USD
            </span>
            <span class="tabular text-[14px] font-semibold text-ink-800">
              {{ money(usd.rate) }}
            </span>
            <span class="flex items-center gap-0.5 text-[12px] font-semibold" :class="diffTone(usd.diff)">
              <UiIcon :name="diffIcon(usd.diff)" :size="12" />
              <span class="tabular">{{ signedDiff(usd.diff) }}</span>
            </span>
          </button>

          <Transition
            enter-active-class="transition duration-150 ease-out"
            enter-from-class="opacity-0 -translate-y-1"
            leave-active-class="transition duration-100 ease-in"
            leave-to-class="opacity-0"
          >
            <div
              v-if="panel === 'rate'"
              role="dialog"
              :aria-label="t('shell.ratesDialog')"
              class="absolute right-0 z-30 mt-2 w-[300px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-panel bg-surface shadow-pop ring-1 ring-ink-200"
            >
              <div class="flex items-center justify-between gap-3 border-b border-ink-100 px-4 py-3">
                <p class="text-[13px] font-semibold text-ink-900">{{ t('shell.ratesTitle') }}</p>
                <p class="tabular text-[12px] text-ink-500">{{ usd.date }}</p>
              </div>

              <ul class="divide-y divide-ink-100">
                <li
                  v-for="r in rateList"
                  :key="r.code"
                  class="flex items-center gap-3 px-4 py-2.5"
                >
                  <span
                    class="grid size-8 shrink-0 place-items-center rounded-[8px] bg-brand-50 text-[11px] font-bold text-brand-700"
                  >
                    {{ r.code }}
                  </span>
                  <span class="min-w-0 flex-1 truncate text-[13px] text-ink-600">
                    {{ CURRENCY_KEY[r.code] ? t(CURRENCY_KEY[r.code]!) : r.label }}
                  </span>
                  <span class="shrink-0 text-right">
                    <span class="tabular block text-[13px] font-semibold text-ink-900">
                      {{ money(r.rate) }}
                    </span>
                    <span
                      class="flex items-center justify-end gap-0.5 text-[11px] font-semibold"
                      :class="diffTone(r.diff)"
                    >
                      <UiIcon :name="diffIcon(r.diff)" :size="11" />
                      <span class="tabular">{{ signedDiff(r.diff) }}</span>
                    </span>
                  </span>
                </li>
              </ul>

              <p class="bg-surface-sunken px-4 py-2.5 text-[12px] leading-snug text-ink-500">
                {{ t('shell.ratesSource') }}
              </p>
            </div>
          </Transition>
        </div>

        <!-- Til -->
        <LocaleSwitch class="shrink-0" />

        <!-- Bildirishnomalar. Telefon kengligida panel butun blokka
             biriktiriladi: aks holda u ekran chetidan chiqib ketardi. -->
        <div class="static shrink-0 sm:relative">
          <button
            type="button"
            class="relative grid size-10 place-items-center rounded-field text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-800"
            :class="panel === 'bell' ? 'bg-ink-100 text-ink-800' : ''"
            :aria-label="
              unread ? t('shell.notificationsAria', { count: unread }) : t('common.notifications')
            "
            aria-haspopup="menu"
            :aria-expanded="panel === 'bell'"
            @click="toggle('bell')"
          >
            <UiIcon name="bell" :size="20" />
            <span
              v-if="unread"
              class="tabular absolute right-1 top-1 grid h-[17px] min-w-[17px] place-items-center rounded-full bg-danger-500 px-1 text-[11px] font-bold text-white ring-2 ring-surface"
            >
              {{ unread }}
            </span>
          </button>

          <Transition
            enter-active-class="transition duration-150 ease-out"
            enter-from-class="opacity-0 -translate-y-1"
            leave-active-class="transition duration-100 ease-in"
            leave-to-class="opacity-0"
          >
            <div
              v-if="panel === 'bell'"
              class="absolute right-0 top-full z-30 mt-2 w-[336px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-panel bg-surface shadow-pop ring-1 ring-ink-200"
            >
              <div class="flex items-center justify-between gap-3 border-b border-ink-100 px-4 py-3">
                <p class="text-[14px] font-semibold text-ink-900">
                  {{ t('common.notifications') }}
                </p>
                <span
                  v-if="unread"
                  class="tabular rounded-pill bg-danger-50 px-2 py-0.5 text-[11px] font-bold text-danger-700"
                >
                  {{ t('shell.notificationsNew', { count: unread }) }}
                </span>
                <span v-else class="text-[12px] text-ink-500">
                  {{ t('shell.notificationsNone') }}
                </span>
              </div>

              <ul v-if="recent.length" class="scroll-slim max-h-[320px] divide-y divide-ink-100 overflow-y-auto">
                <li v-for="n in recent" :key="n.id">
                  <NuxtLink
                    to="/notifications"
                    class="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-ink-50"
                    @click="openNotification(n)"
                  >
                    <span
                      class="grid size-9 shrink-0 place-items-center rounded-[10px]"
                      :class="NOTIFICATION_TONE[n.category] ?? 'bg-ink-100 text-ink-600'"
                    >
                      <UiIcon :name="n.icon" :size="17" />
                    </span>
                    <span class="min-w-0 flex-1">
                      <span
                        class="block truncate text-[13px]"
                        :class="n.read ? 'font-medium text-ink-700' : 'font-bold text-ink-900'"
                      >
                        {{ n.title }}
                      </span>
                      <span class="mt-0.5 block truncate text-[12px] text-ink-500">
                        {{ n.category }} · {{ n.at }}
                      </span>
                    </span>
                    <span
                      v-if="!n.read"
                      class="mt-1.5 size-2 shrink-0 rounded-full bg-brand-500"
                      aria-hidden="true"
                    />
                  </NuxtLink>
                </li>
              </ul>

              <div v-else class="px-4 py-10 text-center">
                <span class="mx-auto grid size-11 place-items-center rounded-full bg-ink-100 text-ink-400">
                  <UiIcon name="bell" :size="20" />
                </span>
                <p class="mt-2.5 text-[13px] text-ink-500">
                  {{ t('shell.notificationsEmpty') }}
                </p>
              </div>

              <div class="flex items-center justify-between gap-2 border-t border-ink-100 px-2 py-2">
                <button
                  type="button"
                  class="flex h-10 items-center rounded-[8px] px-2.5 text-[12px] font-semibold text-ink-600 transition-colors hover:bg-ink-100 hover:text-ink-900 disabled:cursor-not-allowed disabled:opacity-40"
                  :disabled="!unread"
                  @click="markAllRead"
                >
                  {{ t('shell.notificationsMarkAll') }}
                </button>
                <NuxtLink
                  to="/notifications"
                  class="flex h-10 items-center gap-1 rounded-[8px] px-2.5 text-[12px] font-semibold text-brand-600 transition-colors hover:bg-brand-50"
                  @click="panel = null"
                >
                  {{ t('shell.notificationsAll') }}
                  <UiIcon name="chevronRight" :size="13" />
                </NuxtLink>
              </div>
            </div>
          </Transition>
        </div>

        <!-- Profil -->
        <div class="relative shrink-0">
          <button
            type="button"
            class="flex h-10 items-center gap-1.5 rounded-field pl-0.5 pr-1 transition-colors hover:bg-ink-100"
            :class="panel === 'profile' ? 'bg-ink-100' : ''"
            :aria-label="t('shell.profileMenuAria', { name: auth.user?.fullName ?? '' })"
            aria-haspopup="menu"
            :aria-expanded="panel === 'profile'"
            @click="toggle('profile')"
          >
            <UiAvatar
              :user-id="auth.user?.id"
              :full-name="auth.user?.fullName ?? ''"
              :role="auth.role"
              size="sm"
            />
            <UiIcon
              name="chevronDown"
              :size="14"
              class="hidden text-ink-400 transition-transform duration-150 sm:block"
              :class="panel === 'profile' ? 'rotate-180' : ''"
            />
          </button>

          <Transition
            enter-active-class="transition duration-150 ease-out"
            enter-from-class="opacity-0 -translate-y-1"
            leave-active-class="transition duration-100 ease-in"
            leave-to-class="opacity-0"
          >
            <div
              v-if="panel === 'profile'"
              role="menu"
              class="absolute right-0 top-full z-30 mt-2 w-[272px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-panel bg-surface shadow-pop ring-1 ring-ink-200"
            >
              <div class="flex items-start gap-3 border-b border-ink-100 px-4 py-3.5">
                <UiAvatar
                  :user-id="auth.user?.id"
                  :full-name="auth.user?.fullName ?? ''"
                  :role="auth.role"
                  size="md"
                  ring
                />
                <div class="min-w-0 flex-1">
                  <p class="truncate text-[14px] font-semibold text-ink-900">
                    {{ auth.user?.fullName }}
                  </p>
                  <p class="truncate text-[12px] text-ink-500">{{ auth.user?.position }}</p>
                  <span
                    v-if="auth.roleMeta"
                    class="mt-1.5 inline-flex rounded-pill px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ring-1 ring-inset"
                    :class="ROLE_TONE_CLASSES[auth.roleMeta.tone]"
                  >
                    {{ roleLabel(auth.role) }}
                  </span>
                </div>
              </div>

              <div class="p-1.5">
                <NuxtLink
                  to="/profile"
                  role="menuitem"
                  class="flex h-10 items-center gap-2.5 rounded-[8px] px-2.5 text-[13px] font-medium text-ink-700 transition-colors hover:bg-ink-100"
                  @click="panel = null"
                >
                  <UiIcon name="user" :size="18" class="text-ink-500" />
                  {{ t('shell.myProfile') }}
                </NuxtLink>
                <NuxtLink
                  :to="settingsTo"
                  role="menuitem"
                  class="flex h-10 items-center gap-2.5 rounded-[8px] px-2.5 text-[13px] font-medium text-ink-700 transition-colors hover:bg-ink-100"
                  @click="panel = null"
                >
                  <UiIcon name="gear" :size="18" class="text-ink-500" />
                  {{ t('common.settings') }}
                </NuxtLink>
              </div>

              <div class="border-t border-ink-100 p-1.5">
                <button
                  type="button"
                  role="menuitem"
                  class="flex h-10 w-full items-center gap-2.5 rounded-[8px] px-2.5 text-left text-[13px] font-semibold text-danger-600 transition-colors hover:bg-danger-50"
                  @click="signOut"
                >
                  <UiIcon name="logout" :size="18" />
                  {{ t('common.signOut') }}
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </div>
  </header>
</template>
