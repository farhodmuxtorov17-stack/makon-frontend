<script setup lang="ts">
import { useStorage } from '@vueuse/core'
import { ROLE_META } from '~/constants/roles'
import {
  CERTIFICATES,
  LANDLORD_STIR,
  formatStir,
  organizationByStir,
  type Certificate,
} from '~/data/organizations'
import { CONTACT } from '~/constants/contacts'
import { dateShort } from '~/utils/format'
import type { Role } from '~/types/rbac'

definePageMeta({ layout: 'auth', public: true })

const auth = useAuthStore()
const route = useRoute()
const { t } = useI18n()
const { roleLabel } = useAppLabels()

/**
 * Namoyish hisoblari. Parol shu yerda ochiq turadi, chunki bu frontend
 * prototipi: haqiqiy tekshiruv backend tomonida bo‘ladi. Muhimi, parol
 * TEKSHIRILADI: ilgari uzunligi yetarli bo‘lgan istalgan matn bilan
 * kirish mumkin edi va login maydonidagi nom rolni belgilardi.
 */
const ACCOUNTS: Array<{ login: string; email: string; role: Role; password: string }> = [
  { login: 'a.karimov', email: 'a.karimov@makon.uz', role: 'SUPER_HEAD', password: 'Makon2026!' },
  { login: 's.yuldoshev', email: 's.yuldoshev@makon.uz', role: 'BUILDING_MANAGER', password: 'Makon2026!' },
  { login: 'n.rahimova', email: 'n.rahimova@makon.uz', role: 'ACCOUNTANT', password: 'Makon2026!' },
  { login: 'j.toshmatov', email: 'j.toshmatov@servispro.uz', role: 'FACILITY', password: 'Makon2026!' },
  { login: 'a.qodirov', email: 'a.qodirov@makon.uz', role: 'WAREHOUSE_OPERATOR', password: 'Makon2026!' },
  { login: 'm.yusupova', email: 'm.yusupova@makon.uz', role: 'CONTENT_OPERATOR', password: 'Makon2026!' },
  { login: 'd.ergashev', email: 'd.ergashev@urbanoffice.uz', role: 'TENANT_OWNER', password: 'Makon2026!' },
]

/** Kalit egasi xodim bo‘lsa, roli hisobga biriktirilgan holicha qoladi */
const STAFF_HOLDERS: Array<{ name: string; role: Role }> = [
  { name: 'Azizbek Karimov', role: 'SUPER_HEAD' },
  { name: 'Sardor Yo‘ldoshev', role: 'BUILDING_MANAGER' },
  { name: 'Nilufar Rahimova', role: 'ACCOUNTANT' },
]

const MIN_PASSWORD = 6

/** Kalit paroli sertifikat berilganda o‘rnatiladi, hech qayerda ko‘rsatilmaydi */
const KEY_PASSWORD = '123456'

/** Ikki kirish yo‘li: hisob paroli va kalit sertifikati */
const MODES = computed(() => [
  { value: 'password', label: t('login.modePassword') },
  { value: 'eri', label: t('login.modeCert') },
])

const mode = ref('password')

const savedLogin = useStorage<string>('makon.auth.login', '')

const loginName = ref(savedLogin.value)
const password = ref('')
const showPassword = ref(false)
const remember = ref(savedLogin.value.length > 0)

const loginTouched = ref(false)
const passwordTouched = ref(false)
const pending = ref(false)
const rejected = ref(false)
const resetOpen = ref(false)

const year = new Date().getFullYear()

const loginError = computed(() => {
  if (!loginTouched.value) return ''
  if (!loginName.value.trim()) return t('login.loginEmpty')
  if (loginName.value.trim().length < 3) return t('login.loginShort')
  return ''
})

const passwordError = computed(() => {
  if (!passwordTouched.value) return ''
  if (!password.value) return t('login.passwordEmpty')
  if (password.value.length < MIN_PASSWORD) {
    return t('login.passwordShort', { count: MIN_PASSWORD })
  }
  return ''
})

const loginValid = computed(() => loginName.value.trim().length >= 3)
const passwordValid = computed(() => password.value.length >= MIN_PASSWORD)

// --- Kalit sertifikati yo‘li ----------------------------------------------

/** Kalit qayerda saqlanadi: kompyuter xotirasi yoki tashqi kalit tashuvchi */
const STORES = computed(() => [
  { value: 'local', label: t('login.storeLocal') },
  { value: 'token', label: t('login.storeToken') },
])

const store = ref('local')
const reading = ref(false)
/** Kalit do‘koni o‘qilganmi: o‘qilmaguncha ro‘yxat ko‘rsatilmaydi */
const scanned = ref(false)
const found = ref<Certificate[]>([])
const selectedSerial = ref('')
const keyPassword = ref('')
const showKeyPassword = ref(false)
const keyPasswordTouched = ref(false)

type EriFailure = '' | 'expired' | 'unregistered' | 'password' | 'unselected'

const failure = ref<EriFailure>('')

const selected = computed(() => found.value.find((c) => c.serial === selectedSerial.value) ?? null)

const emptyStore = computed(() => scanned.value && found.value.length === 0)

/** Sertifikat kartasi uchun tashkilot ma’lumoti */
function orgOf(cert: Certificate) {
  return organizationByStir(cert.organizationStir)
}

function roleForCertificate(cert: Certificate): Role | null {
  const org = orgOf(cert)
  if (!org) return null
  if (org.stir === LANDLORD_STIR) {
    return STAFF_HOLDERS.find((s) => s.name === cert.holderName)?.role ?? null
  }
  return 'TENANT_OWNER'
}

const FAILURE_TEXT = computed<Record<string, { title: string; text: string }>>(() => ({
  unselected: { title: t('login.failUnselectedTitle'), text: t('login.failUnselectedText') },
  expired: { title: t('login.failExpiredTitle'), text: t('login.failExpiredText') },
  unregistered: { title: t('login.failUnregisteredTitle'), text: t('login.failUnregisteredText') },
  password: { title: t('login.failPasswordTitle'), text: t('login.failPasswordText') },
}))

const keyPasswordError = computed(() => {
  if (!keyPasswordTouched.value) return ''
  if (!keyPassword.value) return t('login.keyPasswordEmpty')
  if (keyPassword.value.length < MIN_PASSWORD) {
    return t('login.keyPasswordShort', { count: MIN_PASSWORD })
  }
  return ''
})

const heading = computed(() =>
  mode.value === 'password' ? t('login.headingPassword') : t('login.headingCert'),
)

// Kiritish boshlanishi bilan avvalgi rad javobi olib tashlanadi.
watch([loginName, password], () => {
  rejected.value = false
})

watch([selectedSerial, keyPassword], () => {
  failure.value = ''
})

watch(mode, () => {
  rejected.value = false
  failure.value = ''
})

// Manba almashtirilsa, oldingi o‘qish natijasi kuchini yo‘qotadi.
watch(store, () => {
  scanned.value = false
  found.value = []
  selectedSerial.value = ''
  failure.value = ''
})

let timer: ReturnType<typeof setTimeout> | null = null

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer)
})

const DEMO_PASSWORD = 'Makon2026!'

/** Kirish oynasida ko‘rsatiladigan namoyish hisoblari */
const DEMO_ACCOUNTS = computed(() =>
  ACCOUNTS.map((a) => ({ login: a.login, label: roleLabel(a.role) })),
)

/** Hisob tanlanganda maydonlar to‘ldiriladi */
function fillDemo(login: string) {
  loginName.value = login
  password.value = DEMO_PASSWORD
  loginTouched.value = false
  passwordTouched.value = false
  rejected.value = false
}

/** Login va parol juftligi mos kelsagina hisob qaytariladi */
function resolveAccount(value: string, secret: string) {
  const key = value.trim().toLowerCase()
  if (!key) return null
  const account = ACCOUNTS.find((a) => a.login === key || a.email === key)
  if (!account || account.password !== secret) return null
  return account
}

function goNext(fallback: string) {
  const next = route.query.next
  navigateTo(typeof next === 'string' && next.startsWith('/') ? next : fallback)
}

/** Kalit do‘konidagi sertifikatlar ro‘yxati o‘qiladi */
function scanStore() {
  if (reading.value) return
  reading.value = true
  failure.value = ''
  selectedSerial.value = ''

  timer = setTimeout(() => {
    reading.value = false
    scanned.value = true
    // Tashqi kalit tashuvchi ulanmagan bo‘lsa, do‘kon bo‘sh qaytadi.
    found.value = store.value === 'local' ? [...CERTIFICATES] : []
    const first = found.value.find((c) => c.status === 'ACTIVE')
    selectedSerial.value = first?.serial ?? ''
  }, 460)
}

function submitStaff() {
  loginTouched.value = true
  passwordTouched.value = true
  rejected.value = false
  if (!loginValid.value || !passwordValid.value) return

  const account = resolveAccount(loginName.value, password.value)
  pending.value = true

  timer = setTimeout(() => {
    pending.value = false
    if (!account) {
      rejected.value = true
      return
    }

    savedLogin.value = remember.value ? loginName.value.trim() : ''
    auth.signIn(account.role)
    goNext(ROLE_META[account.role].home)
  }, 420)
}

function submitEri() {
  keyPasswordTouched.value = true
  failure.value = ''

  const cert = selected.value
  if (!cert) {
    failure.value = 'unselected'
    return
  }
  if (keyPassword.value.length < MIN_PASSWORD) return

  pending.value = true

  timer = setTimeout(() => {
    pending.value = false

    if (cert.status === 'EXPIRED') {
      failure.value = 'expired'
      return
    }

    const role = roleForCertificate(cert)
    if (!role) {
      failure.value = 'unregistered'
      return
    }

    if (keyPassword.value !== KEY_PASSWORD) {
      failure.value = 'password'
      return
    }

    auth.signIn(role)

    // Ijarachi kabineti sertifikatdagi tashkilot nomiga ochiladi.
    const org = orgOf(cert)
    const account = auth.user
    if (role === 'TENANT_OWNER' && org && account) {
      account.fullName = cert.holderName
      account.organization = org.name
      account.position = org.type === 'Yakka tartibdagi tadbirkor' ? 'Tadbirkor' : 'Direktor'
      account.phone = org.phone
      account.email = org.email
      account.tin = formatStir(org.stir)
      account.address = org.address
    }

    keyPassword.value = ''
    goNext(ROLE_META[role].home)
  }, 480)
}

function submit() {
  if (pending.value) return
  if (mode.value === 'password') return submitStaff()
  return submitEri()
}
</script>

<template>
  <div class="grid min-h-dvh lg:grid-cols-2">
    <!-- Kirish ustuni -->
    <div class="flex min-h-dvh flex-col px-5 py-7 sm:px-8 lg:px-12 lg:py-9">
      <header class="flex items-center justify-between gap-4">
        <NuxtLink
          to="/"
          class="inline-flex min-h-[44px] items-center rounded-field"
          :aria-label="t('login.homeAria')"
        >
          <AppLogo />
        </NuxtLink>
        <LocaleSwitch />
      </header>

      <main class="flex flex-1 items-center py-10">
        <div class="mx-auto w-full max-w-[460px]">
          <p class="text-[11px] font-semibold uppercase tracking-wide text-brand-600">
            {{ t('login.eyebrow') }}
          </p>
          <h1 class="mt-2 font-display text-[28px] font-extrabold leading-tight">
            {{ t('login.title') }}
          </h1>
          <p class="mt-2 text-[14px] leading-relaxed text-ink-500">{{ heading }}</p>

          <UiTabs v-model="mode" :tabs="MODES" class="mt-5 [&_button]:min-h-[44px]" />

          <!-- Login va parol -->
          <template v-if="mode === 'password'">
            <div
              v-if="rejected"
              role="alert"
              class="mt-5 flex gap-3 rounded-field bg-danger-50 p-3.5 ring-1 ring-inset ring-danger-100"
            >
              <UiIcon name="warning" :size="18" class="mt-px shrink-0 text-danger-600" />
              <p class="text-[13px] leading-relaxed text-ink-700">
                <span class="font-semibold text-danger-700">{{ t('login.rejectedTitle') }}</span>
                {{ t('login.rejectedText') }}
              </p>
            </div>

            <form class="mt-6 space-y-4" novalidate @submit.prevent="submit">
              <UiField :label="t('login.loginLabel')" required for="login" :error="loginError">
                <UiInput
                  id="login"
                  v-model="loginName"
                  name="username"
                  autocomplete="username"
                  :placeholder="t('login.loginPlaceholder')"
                  :invalid="Boolean(loginError)"
                  :valid="loginValid && !loginError && !rejected"
                  @blur="loginTouched = true"
                />
              </UiField>

              <div>
                <div class="mb-1.5 flex items-center justify-between gap-3">
                  <label
                    for="password"
                    class="flex items-center gap-1 text-[13px] font-semibold text-ink-700"
                  >
                    {{ t('login.passwordLabel') }}
                    <span class="text-danger-500" aria-hidden="true">*</span>
                    <span class="sr-only">{{ t('common.required') }}</span>
                  </label>
                  <button
                    type="button"
                    class="-my-3.5 inline-flex min-h-[44px] items-center rounded-[6px] py-3.5 text-[13px] font-semibold text-brand-600 transition-colors hover:text-brand-700"
                    @click="resetOpen = true"
                  >
                    {{ t('login.forgotPassword') }}
                  </button>
                </div>

                <div class="relative">
                  <input
                    id="password"
                    v-model="password"
                    :type="showPassword ? 'text' : 'password'"
                    name="password"
                    autocomplete="current-password"
                    placeholder="••••••••"
                    :aria-invalid="Boolean(passwordError) || undefined"
                    class="h-11 w-full rounded-field bg-white pl-3.5 pr-12 text-sm text-ink-800 ring-1 ring-inset transition-colors placeholder:text-ink-400 focus:ring-2 focus:ring-brand-500"
                    :class="
                      passwordError ? 'ring-danger-400' : 'ring-ink-200 hover:ring-ink-300'
                    "
                    @blur="passwordTouched = true"
                  />
                  <button
                    type="button"
                    class="absolute inset-y-0 right-0.5 my-auto grid size-11 place-items-center rounded-[8px] text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
                    :aria-label="showPassword ? t('login.hidePassword') : t('login.showPassword')"
                    :aria-pressed="showPassword"
                    @click="showPassword = !showPassword"
                  >
                    <svg class="size-[18px]" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                      <path
                        d="M2.4 10S5.4 4.8 10 4.8 17.6 10 17.6 10 14.6 15.2 10 15.2 2.4 10 2.4 10z"
                        stroke="currentColor"
                        stroke-width="1.5"
                        stroke-linejoin="round"
                      />
                      <circle cx="10" cy="10" r="2.3" stroke="currentColor" stroke-width="1.5" />
                      <path
                        v-if="showPassword"
                        d="m4.2 15.8 11.6-11.6"
                        stroke="currentColor"
                        stroke-width="1.5"
                        stroke-linecap="round"
                      />
                    </svg>
                  </button>
                </div>

                <p v-if="passwordError" class="mt-1.5 text-[12px] font-medium text-danger-600">
                  {{ passwordError }}
                </p>
              </div>

              <label class="flex min-h-[44px] w-fit cursor-pointer items-center gap-2.5">
                <input
                  v-model="remember"
                  type="checkbox"
                  class="size-5 shrink-0 cursor-pointer rounded-[4px] accent-brand-500"
                />
                <span class="text-[13px] text-ink-600">{{ t('login.remember') }}</span>
              </label>

              <UiButton type="submit" size="lg" block :disabled="pending">
                <svg
                  v-if="pending"
                  class="size-4 animate-spin"
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle
                    cx="8"
                    cy="8"
                    r="6.4"
                    stroke="currentColor"
                    stroke-opacity=".35"
                    stroke-width="2"
                  />
                  <path
                    d="M14.4 8A6.4 6.4 0 0 0 8 1.6"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                  />
                </svg>
                {{ pending ? t('common.checking') : t('common.signIn') }}
              </UiButton>

              <!--
                Namoyish hisoblari. Prototipda backend yo‘q, shuning uchun
                kirish ma’lumotlari shu yerda ko‘rsatiladi; parol esa
                haqiqatan tekshiriladi.
              -->
              <div class="mt-5 rounded-field bg-surface-sunken p-3.5 ring-1 ring-inset ring-ink-200">
                <p class="text-[13px] font-semibold text-ink-700">{{ t('login.demoTitle') }}</p>
                <p class="mt-1 text-[12px] leading-relaxed text-ink-500">{{ t('login.demoText') }}</p>
                <!-- Butun qator bosiladi: nishon 44px, rol va login yonma-yon -->
                <div class="mt-3 grid gap-1.5 sm:grid-cols-2">
                  <button
                    v-for="a in DEMO_ACCOUNTS"
                    :key="a.login"
                    type="button"
                    class="flex min-h-[44px] flex-col justify-center rounded-[8px] bg-white px-3 py-1.5 text-left ring-1 ring-inset ring-ink-200 transition-colors hover:ring-brand-300 active:bg-brand-50"
                    @click="fillDemo(a.login)"
                  >
                    <span class="truncate text-[12px] font-semibold text-ink-800">
                      {{ a.label }}
                    </span>
                    <span class="tabular truncate text-[12px] text-ink-500">{{ a.login }}</span>
                  </button>
                </div>
                <p class="tabular mt-2.5 text-[12px] text-ink-600">
                  {{ t('login.demoPassword') }}
                  <span class="font-semibold text-ink-900">{{ DEMO_PASSWORD }}</span>
                </p>
              </div>
            </form>
          </template>

          <!-- Kalit sertifikati orqali -->
          <template v-else>
            <div class="mt-5 space-y-4">
              <UiField :label="t('login.storeLabel')" for="key-store">
                <UiSelect id="key-store" v-model="store" :options="STORES" />
              </UiField>

              <UiButton
                variant="secondary"
                size="lg"
                block
                :disabled="reading"
                @click="scanStore"
              >
                <svg
                  v-if="reading"
                  class="size-4 animate-spin"
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle
                    cx="8"
                    cy="8"
                    r="6.4"
                    stroke="currentColor"
                    stroke-opacity=".35"
                    stroke-width="2"
                  />
                  <path
                    d="M14.4 8A6.4 6.4 0 0 0 8 1.6"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                  />
                </svg>
                <UiIcon v-else name="key" :size="17" />
                {{ reading ? t('login.scanReading') : scanned ? t('login.scanAgain') : t('login.scan') }}
              </UiButton>

              <!-- Do‘kon bo‘sh -->
              <div
                v-if="emptyStore"
                role="alert"
                class="flex gap-3 rounded-field bg-warn-50 p-3.5 ring-1 ring-inset ring-warn-100"
              >
                <UiIcon name="warning" :size="18" class="mt-px shrink-0 text-warn-600" />
                <p class="text-[13px] leading-relaxed text-ink-700">
                  <span class="font-semibold text-warn-700">{{ t('login.emptyStoreTitle') }}</span>
                  {{ t('login.emptyStoreText') }}
                </p>
              </div>

              <!-- Sertifikatlar ro‘yxati -->
              <form
                v-else-if="scanned"
                class="space-y-4"
                novalidate
                @submit.prevent="submit"
              >
                <fieldset>
                  <legend class="mb-2 text-[13px] font-semibold text-ink-700">
                    {{ t('login.certListLegend') }}
                    <span class="font-normal text-ink-500">
                      {{ t('login.certCount', { count: found.length }) }}
                    </span>
                  </legend>

                  <div class="scroll-slim max-h-[320px] space-y-2 overflow-y-auto pr-0.5">
                    <button
                      v-for="c in found"
                      :key="c.serial"
                      type="button"
                      role="radio"
                      :aria-checked="selectedSerial === c.serial"
                      class="block w-full rounded-field p-3.5 text-left ring-1 ring-inset transition-colors"
                      :class="
                        selectedSerial === c.serial
                          ? 'bg-brand-50 ring-brand-300'
                          : 'bg-white ring-ink-200 hover:ring-ink-300'
                      "
                      @click="selectedSerial = c.serial"
                    >
                      <span class="flex items-start justify-between gap-3">
                        <span class="min-w-0">
                          <span class="block truncate text-[14px] font-bold text-ink-900">
                            {{ c.holderName }}
                          </span>
                          <span class="mt-0.5 block truncate text-[13px] text-ink-600">
                            {{ orgOf(c)?.name ?? t('login.certOrgMissing') }}
                          </span>
                        </span>
                        <span
                          class="shrink-0 rounded-pill px-2 py-0.5 text-[11px] font-bold"
                          :class="
                            c.status === 'ACTIVE'
                              ? 'bg-ok-50 text-ok-700'
                              : 'bg-danger-50 text-danger-700'
                          "
                        >
                          {{ c.status === 'ACTIVE' ? t('login.certActive') : t('login.certExpired') }}
                        </span>
                      </span>

                      <span class="mt-2.5 grid gap-1.5 sm:grid-cols-2">
                        <span class="flex items-baseline gap-1.5 text-[12px]">
                          <span class="shrink-0 text-ink-500">{{ t('login.certStir') }}</span>
                          <span class="tabular font-semibold text-ink-800">
                            {{ formatStir(c.organizationStir) }}
                          </span>
                        </span>
                        <span class="flex items-baseline gap-1.5 text-[12px]">
                          <span class="shrink-0 text-ink-500">{{ t('login.certSerial') }}</span>
                          <span class="tabular truncate font-semibold text-ink-800">
                            {{ c.serial }}
                          </span>
                        </span>
                        <span class="flex items-baseline gap-1.5 text-[12px] sm:col-span-2">
                          <span class="shrink-0 text-ink-500">{{ t('login.certValidity') }}</span>
                          <span class="tabular font-semibold text-ink-800">
                            {{
                              t('login.certValidityValue', {
                                from: dateShort(c.issuedAt),
                                to: dateShort(c.expiresAt),
                              })
                            }}
                          </span>
                        </span>
                      </span>
                    </button>
                  </div>
                </fieldset>

                <div>
                  <label
                    for="key-password"
                    class="mb-1.5 flex items-center gap-1 text-[13px] font-semibold text-ink-700"
                  >
                    {{ t('login.keyPasswordLabel') }}
                    <span class="text-danger-500" aria-hidden="true">*</span>
                    <span class="sr-only">{{ t('common.required') }}</span>
                  </label>

                  <div class="relative">
                    <input
                      id="key-password"
                      v-model="keyPassword"
                      :type="showKeyPassword ? 'text' : 'password'"
                      name="key-password"
                      autocomplete="off"
                      placeholder="••••••••"
                      :aria-invalid="Boolean(keyPasswordError) || undefined"
                      class="h-11 w-full rounded-field bg-white pl-3.5 pr-12 text-sm text-ink-800 ring-1 ring-inset transition-colors placeholder:text-ink-400 focus:ring-2 focus:ring-brand-500"
                      :class="
                        keyPasswordError ? 'ring-danger-400' : 'ring-ink-200 hover:ring-ink-300'
                      "
                      @blur="keyPasswordTouched = true"
                    />
                    <button
                      type="button"
                      class="absolute inset-y-0 right-0.5 my-auto grid size-11 place-items-center rounded-[8px] text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
                      :aria-label="showKeyPassword ? t('login.hidePassword') : t('login.showPassword')"
                      :aria-pressed="showKeyPassword"
                      @click="showKeyPassword = !showKeyPassword"
                    >
                      <svg class="size-[18px]" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                        <path
                          d="M2.4 10S5.4 4.8 10 4.8 17.6 10 17.6 10 14.6 15.2 10 15.2 2.4 10 2.4 10z"
                          stroke="currentColor"
                          stroke-width="1.5"
                          stroke-linejoin="round"
                        />
                        <circle cx="10" cy="10" r="2.3" stroke="currentColor" stroke-width="1.5" />
                        <path
                          v-if="showKeyPassword"
                          d="m4.2 15.8 11.6-11.6"
                          stroke="currentColor"
                          stroke-width="1.5"
                          stroke-linecap="round"
                        />
                      </svg>
                    </button>
                  </div>

                  <p v-if="keyPasswordError" class="mt-1.5 text-[12px] font-medium text-danger-600">
                    {{ keyPasswordError }}
                  </p>
                </div>

                <div
                  v-if="failure"
                  role="alert"
                  class="flex gap-3 rounded-field bg-danger-50 p-3.5 ring-1 ring-inset ring-danger-100"
                >
                  <UiIcon name="warning" :size="18" class="mt-px shrink-0 text-danger-600" />
                  <p class="text-[13px] leading-relaxed text-ink-700">
                    <span class="font-semibold text-danger-700">
                      {{ FAILURE_TEXT[failure]?.title }}
                    </span>
                    {{ FAILURE_TEXT[failure]?.text }}
                  </p>
                </div>

                <UiButton type="submit" size="lg" block :disabled="pending">
                  <svg
                    v-if="pending"
                    class="size-4 animate-spin"
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden="true"
                  >
                    <circle
                      cx="8"
                      cy="8"
                      r="6.4"
                      stroke="currentColor"
                      stroke-opacity=".35"
                      stroke-width="2"
                    />
                    <path
                      d="M14.4 8A6.4 6.4 0 0 0 8 1.6"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                    />
                  </svg>
                  {{ pending ? t('common.checking') : t('login.certSubmit') }}
                </UiButton>
              </form>

              <p
                v-else
                class="flex items-start gap-2 rounded-field bg-surface-sunken p-3.5 text-[13px] leading-relaxed text-ink-600 ring-1 ring-inset ring-ink-200"
              >
                <UiIcon name="info" :size="15" class="mt-px shrink-0 text-ink-400" />
                {{ t('login.certHint') }}
              </p>
            </div>
          </template>
        </div>
      </main>

      <footer class="text-[12px] text-ink-400">© {{ year }} MAKON</footer>
    </div>

    <!-- Fotosurat ustuni -->
    <aside class="relative hidden overflow-hidden bg-ink-900 lg:sticky lg:top-0 lg:block lg:h-dvh">
      <div class="absolute inset-0">
        <UiPhoto
          name="urban-office"
          :alt="t('login.asidePhotoAlt')"
          ratio="h-full"
          rounded="rounded-none"
          sizes="50vw"
          eager
        />
      </div>
      <div
        class="absolute inset-0 bg-gradient-to-t from-ink-900/92 via-ink-900/45 to-ink-900/10"
      />

      <div class="relative flex h-full flex-col justify-end gap-8 p-10 xl:p-14">
        <div class="max-w-[36ch]">
          <p class="text-[11px] font-semibold uppercase tracking-wide text-white/70">
            {{ t('login.asideEyebrow') }}
          </p>
          <h2 class="mt-3 font-display text-[28px] font-extrabold leading-tight text-white">
            {{ t('login.asideTitle') }}
          </h2>
          <p class="mt-3 text-[14px] leading-relaxed text-white/80">{{ t('login.asideText') }}</p>
        </div>

        <ul class="grid gap-3 border-t border-white/20 pt-7">
          <li
            v-for="f in [
              { icon: 'building', text: t('login.asidePoint1') },
              { icon: 'wallet', text: t('login.asidePoint2') },
              { icon: 'wrench', text: t('login.asidePoint3') },
            ]"
            :key="f.text"
            class="flex items-center gap-3"
          >
            <span
              class="grid size-9 shrink-0 place-items-center rounded-[10px] bg-white/15 text-white"
            >
              <UiIcon :name="f.icon" :size="18" />
            </span>
            <span class="text-[14px] text-white/85">{{ f.text }}</span>
          </li>
        </ul>
      </div>
    </aside>

    <!-- Parolni tiklash tartibi -->
    <UiModal
      v-model="resetOpen"
      :title="t('login.resetTitle')"
      :subtitle="t('login.resetSubtitle')"
    >
      <p class="text-[14px] leading-relaxed text-ink-700">{{ t('login.resetLead') }}</p>

      <ol class="mt-5 space-y-3.5">
        <li
          v-for="(s, i) in [
            { title: t('login.resetStep1Title'), text: t('login.resetStep1Text') },
            { title: t('login.resetStep2Title'), text: t('login.resetStep2Text') },
            { title: t('login.resetStep3Title'), text: t('login.resetStep3Text') },
          ]"
          :key="s.title"
          class="flex gap-3.5"
        >
          <span
            class="grid size-7 shrink-0 place-items-center rounded-full bg-brand-500 text-[12px] font-bold text-white"
          >
            {{ i + 1 }}
          </span>
          <span>
            <span class="block text-[14px] font-semibold text-ink-900">{{ s.title }}</span>
            <span class="block text-[13px] leading-relaxed text-ink-600">{{ s.text }}</span>
          </span>
        </li>
      </ol>

      <div
        class="mt-5 flex items-center gap-3.5 rounded-field bg-surface-sunken p-3.5 ring-1 ring-inset ring-ink-200"
      >
        <span
          class="grid size-10 shrink-0 place-items-center rounded-[10px] bg-brand-50 text-brand-600"
        >
          <UiIcon name="help" :size="19" />
        </span>
        <span class="min-w-0 flex-1">
          <span class="block text-[13px] font-semibold text-ink-900">
            {{ t('login.resetSupport') }}
          </span>
          <span class="block text-[12px] text-ink-500">{{ t('public.contactHours') }}</span>
        </span>
        <span class="tabular shrink-0 text-[13px] font-semibold text-brand-600">
          {{ CONTACT.phone }}
        </span>
      </div>

      <template #footer>
        <UiButton variant="secondary" @click="resetOpen = false">
          {{ t('login.resetUnderstood') }}
        </UiButton>
      </template>
    </UiModal>
  </div>
</template>
