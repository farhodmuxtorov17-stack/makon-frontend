<script setup lang="ts">
import { useStorage } from '@vueuse/core'
import { ROLE_META } from '~/constants/roles'
import type { Role } from '~/types/rbac'

definePageMeta({ layout: 'auth', public: true })

const auth = useAuthStore()
const route = useRoute()

/**
 * Xodim hisoblarini super rahbar yaratadi va rolni hisobga biriktiradi —
 * shuning uchun kirish oynasida rol tanlanmaydi.
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

const MIN_PASSWORD = 6

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

function resolveRole(value: string): Role | null {
  const key = value.trim().toLowerCase()
  if (!key) return null
  return ACCOUNTS.find((a) => a.login === key || a.email === key)?.role ?? null
}

// Kiritish boshlanishi bilan avvalgi rad javobi olib tashlanadi.
watch([loginName, password], () => {
  rejected.value = false
})

let timer: ReturnType<typeof setTimeout> | null = null

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer)
})

function submit() {
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

    const next = route.query.next
    navigateTo(typeof next === 'string' && next.startsWith('/') ? next : ROLE_META[role].home)
  }, 420)
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
        <div class="mx-auto w-full max-w-[420px]">
          <p class="text-[11px] font-semibold uppercase tracking-wide text-brand-600">
            Ish maydoniga kirish
          </p>
          <h1 class="mt-2 font-display text-[26px] font-extrabold leading-tight">
            Profilingizga kiring
          </h1>
          <p class="mt-2 text-[13.5px] leading-relaxed text-ink-500">
            Login va parolni kiriting — tizim rolingizga mos ish maydonini ochadi.
          </p>

          <!-- Noto‘g‘ri ma’lumot holati -->
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
            Bandlik, shartnoma, hisob-kitob va texnik xizmat — har bir obyekt bo‘yicha yagona
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
