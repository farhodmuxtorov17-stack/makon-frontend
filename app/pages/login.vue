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
import { dateShort } from '~/utils/format'
import type { Role } from '~/types/rbac'

definePageMeta({ layout: 'auth', public: true })

const auth = useAuthStore()
const route = useRoute()

/**
 * Xodim hisoblarini super rahbar yaratadi va rolni hisobga biriktiradi, * shuning uchun kirish oynasida rol tanlanmaydi.
 */
const ACCOUNTS: Array<{ login: string; email: string; role: Role }> = [
  { login: 'a.karimov', email: 'a.karimov@makon.uz', role: 'SUPER_HEAD' },
  { login: 's.yuldoshev', email: 's.yuldoshev@makon.uz', role: 'BUILDING_MANAGER' },
  { login: 'n.rahimova', email: 'n.rahimova@makon.uz', role: 'ACCOUNTANT' },
  { login: 'j.toshmatov', email: 'j.toshmatov@servispro.uz', role: 'FACILITY' },
  { login: 'a.qodirov', email: 'a.qodirov@makon.uz', role: 'WAREHOUSE_OPERATOR' },
  { login: 'm.yusupova', email: 'm.yusupova@makon.uz', role: 'CONTENT_OPERATOR' },
  { login: 'd.ergashev', email: 'd.ergashev@urbanoffice.uz', role: 'TENANT_OWNER' },
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
const MODES = [
  { value: 'password', label: 'Login va parol' },
  { value: 'eri', label: 'ERI orqali' },
]

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
  if (!loginName.value.trim()) return 'Login kiritilmagan'
  if (loginName.value.trim().length < 3) return 'Login juda qisqa'
  return ''
})

const passwordError = computed(() => {
  if (!passwordTouched.value) return ''
  if (!password.value) return 'Parol kiritilmagan'
  if (password.value.length < MIN_PASSWORD) return `Parol kamida ${MIN_PASSWORD} ta belgidan iborat`
  return ''
})

const loginValid = computed(() => loginName.value.trim().length >= 3)
const passwordValid = computed(() => password.value.length >= MIN_PASSWORD)

// --- Kalit sertifikati yo‘li ----------------------------------------------

/** Kalit qayerda saqlanadi: kompyuter xotirasi yoki tashqi kalit tashuvchi */
const STORES = [
  { value: 'local', label: 'Kompyuter xotirasi' },
  { value: 'token', label: 'Tashqi kalit tashuvchi' },
]

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

const FAILURE_TEXT: Record<string, { title: string; text: string }> = {
  unselected: {
    title: 'Sertifikat tanlanmagan.',
    text: 'Ro‘yxatdan kirish uchun foydalanadigan kalitni belgilang.',
  },
  expired: {
    title: 'Sertifikat muddati tugagan.',
    text: 'Kalitni yangilab, so‘ng qaytadan urinib ko‘ring.',
  },
  unregistered: {
    title: 'Sertifikat tizimda ro‘yxatdan o‘tmagan.',
    text: 'Kalit egasining tashkiloti reyestrda topilmadi. Tashkilotni ro‘yxatdan o‘tkazing.',
  },
  password: {
    title: 'Kalit paroli noto‘g‘ri.',
    text: 'Parol kalit berilganda o‘rnatilgan. Tekshirib qaytadan kiriting.',
  },
}

const keyPasswordError = computed(() => {
  if (!keyPasswordTouched.value) return ''
  if (!keyPassword.value) return 'Kalit paroli kiritilmagan'
  if (keyPassword.value.length < MIN_PASSWORD) {
    return `Kalit paroli kamida ${MIN_PASSWORD} ta belgidan iborat`
  }
  return ''
})

const heading = computed(() =>
  mode.value === 'password'
    ? 'Login va parolni kiriting, tizim rolingizga mos ish maydonini ochadi.'
    : 'Kalit do‘konini o‘qing, sertifikatni tanlang va kalit parolini kiriting.',
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

function resolveRole(value: string): Role | null {
  const key = value.trim().toLowerCase()
  if (!key) return null
  return ACCOUNTS.find((a) => a.login === key || a.email === key)?.role ?? null
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

  const role = resolveRole(loginName.value)
  pending.value = true

  timer = setTimeout(() => {
    pending.value = false
    if (!role) {
      rejected.value = true
      return
    }

    savedLogin.value = remember.value ? loginName.value.trim() : ''
    auth.signIn(role)
    goNext(ROLE_META[role].home)
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
        <NuxtLink to="/" class="rounded-field" aria-label="Bosh sahifaga o‘tish">
          <AppLogo />
        </NuxtLink>
        <LocaleSwitch />
      </header>

      <main class="flex flex-1 items-center py-10">
        <div class="mx-auto w-full max-w-[460px]">
          <p class="text-[11px] font-semibold uppercase tracking-wide text-brand-600">
            Ish maydoniga kirish
          </p>
          <h1 class="mt-2 font-display text-[26px] font-extrabold leading-tight">
            Profilingizga kiring
          </h1>
          <p class="mt-2 text-[13.5px] leading-relaxed text-ink-500">{{ heading }}</p>

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
                <span class="font-semibold text-danger-700">Login yoki parol noto‘g‘ri.</span>
                Ma’lumotlarni tekshirib qaytadan urinib ko‘ring.
              </p>
            </div>

            <form class="mt-6 space-y-4" novalidate @submit.prevent="submit">
              <UiField label="Login" required for="login" :error="loginError">
                <UiInput
                  id="login"
                  v-model="loginName"
                  name="username"
                  autocomplete="username"
                  placeholder="ism.familiya"
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
                    Parol
                    <span class="text-danger-500" aria-hidden="true">*</span>
                    <span class="sr-only">majburiy maydon</span>
                  </label>
                  <button
                    type="button"
                    class="rounded-[6px] text-[12.5px] font-semibold text-brand-600 transition-colors hover:text-brand-700"
                    @click="resetOpen = true"
                  >
                    Parolni unutdingizmi?
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
                    class="absolute inset-y-0 right-1 my-auto grid size-10 place-items-center rounded-[8px] text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
                    :aria-label="showPassword ? 'Parolni yashirish' : 'Parolni ko‘rsatish'"
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

              <label class="flex w-fit cursor-pointer items-center gap-2.5 py-1">
                <input
                  v-model="remember"
                  type="checkbox"
                  class="size-4 shrink-0 cursor-pointer rounded-[4px] accent-brand-500"
                />
                <span class="text-[13px] text-ink-600">Meni eslab qol</span>
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
                {{ pending ? 'Tekshirilmoqda…' : 'Tizimga kirish' }}
              </UiButton>
            </form>
          </template>

          <!-- Kalit sertifikati orqali -->
          <template v-else>
            <div class="mt-5 space-y-4">
              <UiField label="Kalit manbasi" for="key-store">
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
                {{
                  reading
                    ? 'Kalit do‘koni o‘qilmoqda…'
                    : scanned
                      ? 'Ro‘yxatni yangilash'
                      : 'Sertifikatlarni o‘qish'
                }}
              </UiButton>

              <!-- Do‘kon bo‘sh -->
              <div
                v-if="emptyStore"
                role="alert"
                class="flex gap-3 rounded-field bg-warn-50 p-3.5 ring-1 ring-inset ring-warn-100"
              >
                <UiIcon name="warning" :size="18" class="mt-px shrink-0 text-warn-600" />
                <p class="text-[13px] leading-relaxed text-ink-700">
                  <span class="font-semibold text-warn-700">
                    Kalit do‘konida sertifikat topilmadi.
                  </span>
                  Kalit tashuvchi ulanganini tekshiring yoki kalit saqlanadigan boshqa manbani
                  tanlang.
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
                    Kalit sertifikatlari
                    <span class="font-normal text-ink-500">({{ found.length }} ta)</span>
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
                          <span class="block truncate text-[13.5px] font-bold text-ink-900">
                            {{ c.holderName }}
                          </span>
                          <span class="mt-0.5 block truncate text-[12.5px] text-ink-600">
                            {{ orgOf(c)?.name ?? 'Tashkilot reyestrda topilmadi' }}
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
                          {{ c.status === 'ACTIVE' ? 'Amalda' : 'Muddati tugagan' }}
                        </span>
                      </span>

                      <span class="mt-2.5 grid gap-1.5 sm:grid-cols-2">
                        <span class="flex items-baseline gap-1.5 text-[12px]">
                          <span class="shrink-0 text-ink-500">STIR:</span>
                          <span class="tabular font-semibold text-ink-800">
                            {{ formatStir(c.organizationStir) }}
                          </span>
                        </span>
                        <span class="flex items-baseline gap-1.5 text-[12px]">
                          <span class="shrink-0 text-ink-500">Raqami:</span>
                          <span class="tabular truncate font-semibold text-ink-800">
                            {{ c.serial }}
                          </span>
                        </span>
                        <span class="flex items-baseline gap-1.5 text-[12px] sm:col-span-2">
                          <span class="shrink-0 text-ink-500">Amal qilish muddati:</span>
                          <span class="tabular font-semibold text-ink-800">
                            {{ dateShort(c.issuedAt) }} dan {{ dateShort(c.expiresAt) }} gacha
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
                    Kalit paroli
                    <span class="text-danger-500" aria-hidden="true">*</span>
                    <span class="sr-only">majburiy maydon</span>
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
                      class="absolute inset-y-0 right-1 my-auto grid size-10 place-items-center rounded-[8px] text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
                      :aria-label="showKeyPassword ? 'Parolni yashirish' : 'Parolni ko‘rsatish'"
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
                  {{ pending ? 'Tekshirilmoqda…' : 'Sertifikat bilan kirish' }}
                </UiButton>
              </form>

              <p
                v-else
                class="flex items-start gap-2 rounded-field bg-surface-sunken p-3.5 text-[12.5px] leading-relaxed text-ink-600 ring-1 ring-inset ring-ink-200"
              >
                <UiIcon name="info" :size="15" class="mt-px shrink-0 text-ink-400" />
                Kalit do‘koni o‘qilgach, unda saqlangan sertifikatlar ro‘yxati chiqadi. Kalit
                paroli faqat kirish uchun ishlatiladi va saqlanmaydi.
              </p>
            </div>
          </template>

          <!-- Ijarachilar uchun yo‘l -->
          <div
            class="mt-7 flex flex-wrap items-center justify-between gap-3 rounded-panel bg-surface-sunken p-4 ring-1 ring-inset ring-ink-200"
          >
            <div class="flex min-w-0 items-center gap-3">
              <span
                class="grid size-10 shrink-0 place-items-center rounded-[12px] bg-brand-50 text-brand-600"
              >
                <UiIcon name="user" :size="20" />
              </span>
              <div class="min-w-0">
                <p class="text-[13.5px] font-semibold text-ink-900">Ijarachimisiz?</p>
                <p class="text-[12.5px] text-ink-500">Hisobni o‘zingiz ochasiz</p>
              </div>
            </div>
            <UiButton to="/register" variant="secondary" size="sm">
              Ro‘yxatdan o‘ting
              <UiIcon name="arrowRight" :size="16" />
            </UiButton>
          </div>

          <div
            class="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-panel bg-surface-sunken p-4 ring-1 ring-inset ring-ink-200"
          >
            <div class="flex min-w-0 items-center gap-3">
              <span
                class="grid size-10 shrink-0 place-items-center rounded-[12px] bg-ok-50 text-ok-600"
              >
                <UiIcon name="send" :size="20" />
              </span>
              <div class="min-w-0">
                <p class="text-[13.5px] font-semibold text-ink-900">Ariza yubormoqchimisiz?</p>
                <p class="text-[12.5px] text-ink-500">Hisob ochmasdan ham yuborish mumkin</p>
              </div>
            </div>
            <UiButton to="/ariza" variant="secondary" size="sm">
              Ariza yuborish
              <UiIcon name="arrowRight" :size="16" />
            </UiButton>
          </div>
        </div>
      </main>

      <footer class="text-[12px] text-ink-400">© {{ year }} MAKON</footer>
    </div>

    <!-- Fotosurat ustuni -->
    <aside class="relative hidden overflow-hidden bg-ink-900 lg:sticky lg:top-0 lg:block lg:h-dvh">
      <div class="absolute inset-0">
        <UiPhoto
          name="urban-office"
          alt="Toshkentdagi zamonaviy ofis binosi"
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
            Boshqaruv platformasi
          </p>
          <h2 class="mt-3 font-display text-[28px] font-extrabold leading-tight text-white">
            Butun portfel bitta oynada
          </h2>
          <p class="mt-3 text-[14px] leading-relaxed text-white/80">
            Bandlik, shartnoma, hisob-kitob va texnik xizmat, har bir obyekt bo‘yicha yagona
            manzil.
          </p>
        </div>

        <ul class="grid gap-3 border-t border-white/20 pt-7">
          <li
            v-for="f in [
              { icon: 'building', text: 'Obyekt, qavat va unitlar yagona reyestrda' },
              { icon: 'wallet', text: 'Hisob-kitob va qarzdorlik doimiy nazoratda' },
              { icon: 'wrench', text: 'Servis arizasi topshiriqqa aylanadi va yopiladi' },
            ]"
            :key="f.text"
            class="flex items-center gap-3"
          >
            <span
              class="grid size-9 shrink-0 place-items-center rounded-[10px] bg-white/15 text-white"
            >
              <UiIcon :name="f.icon" :size="18" />
            </span>
            <span class="text-[13.5px] text-white/85">{{ f.text }}</span>
          </li>
        </ul>
      </div>
    </aside>

    <!-- Parolni tiklash tartibi -->
    <UiModal
      v-model="resetOpen"
      title="Parolni tiklash"
      subtitle="Xodim hisoblari markazlashgan tartibda boshqariladi"
    >
      <p class="text-[13.5px] leading-relaxed text-ink-700">
        Hisoblarni super rahbar yaratadi va parolni ham faqat u tiklaydi. Kirish imkoni
        yo‘qolgan bo‘lsa, quyidagi tartibda murojaat qiling.
      </p>

      <ol class="mt-5 space-y-3.5">
        <li
          v-for="(s, i) in [
            {
              title: 'Super rahbarga murojaat qiling',
              text: 'Familiya, lavozim va login nomingizni ayting.',
            },
            {
              title: 'Shaxsingiz tasdiqlanadi',
              text: 'Hisob egasi tashkilot ro‘yxati bo‘yicha solishtiriladi.',
            },
            {
              title: 'Vaqtinchalik parol beriladi',
              text: 'Birinchi kirishdan so‘ng uni almashtirasiz.',
            },
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
            <span class="block text-[13.5px] font-semibold text-ink-900">{{ s.title }}</span>
            <span class="block text-[12.5px] leading-relaxed text-ink-600">{{ s.text }}</span>
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
          <span class="block text-[13px] font-semibold text-ink-900">Ichki qo‘llab-quvvatlash</span>
          <span class="block text-[12px] text-ink-500">Dushanba–juma, 09:00–18:00</span>
        </span>
        <span class="tabular shrink-0 text-[13px] font-semibold text-brand-600">+998 78 150 00 00</span>
      </div>

      <template #footer>
        <UiButton variant="secondary" @click="resetOpen = false">Tushunarli</UiButton>
      </template>
    </UiModal>
  </div>
</template>
