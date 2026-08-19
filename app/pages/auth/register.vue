<script setup lang="ts">
import {
  certificateBySerial,
  certificateOrganization,
  phoneDigitsOf,
  stirDigits as onlyDigits,
} from '~/data/organizations'

definePageMeta({ layout: 'auth', public: true })

const auth = useAuthStore()
const lease = useLeaseStore()
const route = useRoute()

lease.seed()

const MIN_PASSWORD = 8

type AccountKind = 'individual' | 'company'

const KINDS: Array<{ value: AccountKind; label: string; caption: string }> = [
  { value: 'individual', label: 'Jismoniy shaxs', caption: 'Shaxsiy hisob' },
  { value: 'company', label: 'Yuridik shaxs', caption: 'Tashkilot hisobi' },
]

const kind = ref<AccountKind>('individual')
const name = ref('')
const email = ref('')
const stirDigits = ref('')
const password = ref('')
const confirm = ref('')
const accepted = ref(false)
const showPassword = ref(false)
const showConfirm = ref(false)
const submitted = ref(false)
const pending = ref(false)
const termsOpen = ref(false)

const year = new Date().getFullYear()

/** Kalit sertifikati orqali kelingan yo‘l */
const certificate = computed(() => {
  const q = route.query.eri
  return typeof q === 'string' ? (certificateBySerial(q) ?? null) : null
})

const certificateOrg = computed(() =>
  certificate.value ? certificateOrganization(certificate.value) : undefined,
)

/**
 * Hisobsiz yuborilgan ariza asosida kabinet ochish. Operator taklif qilgan
 * bo‘lsagina ochiladi, ariza raqami havolada keladi.
 */
const guestCase = computed(() => {
  const q = route.query.ariza
  if (typeof q !== 'string' || !q) return null
  const item = lease.byCode(q)
  if (!item || !item.guest || !item.accountInvitedAt) return null
  return item
})

const phoneDigits = computed(() => {
  const q = route.query.phone
  if (typeof q === 'string' && /^\d{9}$/.test(q)) return q
  if (guestCase.value) return phoneDigitsOf(guestCase.value.org.phone)
  if (certificateOrg.value) return phoneDigitsOf(certificateOrg.value.phone)
  return ''
})

/** Rekvizitlar sertifikatdan yoki arizadan kelgan bo‘lsa, tahrirlanmaydi */
const locked = computed(() => Boolean(certificateOrg.value))

const phoneLabel = computed(() => {
  const d = phoneDigits.value
  if (!d) return ''
  return `+998 (${d.slice(0, 2)}) ${d.slice(2, 5)} ${d.slice(5, 7)} ${d.slice(7, 9)}`
})

const stirLabel = computed(() => {
  const d = stirDigits.value
  return [d.slice(0, 3), d.slice(3, 6), d.slice(6, 9)].filter(Boolean).join(' ')
})

const nameLabel = computed(() =>
  kind.value === 'company' ? 'Kompaniya nomi' : 'Ism va familiya',
)

const stepCaption = computed(() =>
  certificateOrg.value || guestCase.value
    ? '3-qadam / 3: Parol o‘rnatish'
    : '3-qadam / 3: Hisob ma’lumotlari',
)

const intro = computed(() => {
  if (certificateOrg.value) {
    return 'Rekvizitlar kalit sertifikatidan olindi, raqam tasdiqlandi. Endi parol o‘rnating.'
  }
  if (guestCase.value) {
    return 'Arizangiz asosida kabinet ochiladi. Ma’lumotlarni tekshiring va parol o‘rnating.'
  }
  return 'Raqam tasdiqlandi. Endi hisob turini tanlang va ma’lumotlarni kiriting.'
})

/** Parol mustahkamligi: uzunlik, belgi turlari va takrorlanish hisobga olinadi. */
const strength = computed(() => {
  const v = password.value
  if (!v) return 0

  let score = 0
  if (v.length >= MIN_PASSWORD) score += 1
  if (v.length >= 12) score += 1
  if (/[a-z]/.test(v) && /[A-Z]/.test(v)) score += 1
  if (/\d/.test(v)) score += 1
  if (/[^A-Za-z0-9]/.test(v)) score += 1
  if (/(.)\1{2,}/.test(v)) score -= 1
  if (/^[a-z]+$/i.test(v) || /^\d+$/.test(v)) score -= 1

  return Math.max(1, Math.min(4, score))
})

const STRENGTH_META = [
  { label: 'Juda zaif', text: 'text-danger-600', bar: 'bg-danger-500' },
  { label: 'Zaif', text: 'text-warn-700', bar: 'bg-warn-500' },
  { label: 'O‘rtacha', text: 'text-warn-700', bar: 'bg-warn-500' },
  { label: 'Yaxshi', text: 'text-teal-700', bar: 'bg-teal-500' },
  { label: 'Kuchli', text: 'text-ok-700', bar: 'bg-ok-500' },
]

const strengthMeta = computed(() => STRENGTH_META[strength.value] ?? STRENGTH_META[0]!)

const nameError = computed(() => {
  if (!submitted.value) return ''
  if (!name.value.trim()) return `${nameLabel.value} kiritilmagan`
  if (name.value.trim().length < 3) return 'Nom juda qisqa'
  return ''
})

const emailError = computed(() => {
  if (!submitted.value) return ''
  if (!email.value.trim()) return 'E-pochta kiritilmagan'
  if (!/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(email.value.trim())) return 'E-pochta manzili xato'
  return ''
})

const stirError = computed(() => {
  if (!submitted.value || kind.value !== 'company') return ''
  if (!stirDigits.value) return 'STIR kiritilmagan'
  if (stirDigits.value.length !== 9) return 'STIR to‘qqiz xonali bo‘lishi kerak'
  return ''
})

const passwordError = computed(() => {
  if (!submitted.value) return ''
  if (!password.value) return 'Parol kiritilmagan'
  if (password.value.length < MIN_PASSWORD) return `Parol kamida ${MIN_PASSWORD} ta belgidan iborat`
  return ''
})

const confirmError = computed(() => {
  if (!submitted.value) return ''
  if (!confirm.value) return 'Parolni takrorlang'
  if (confirm.value !== password.value) return 'Parollar mos kelmadi'
  return ''
})

const termsError = computed(() => (submitted.value && !accepted.value ? 'Shartlarni tasdiqlang' : ''))

const hasErrors = computed(() =>
  Boolean(
    nameError.value ||
      emailError.value ||
      stirError.value ||
      passwordError.value ||
      confirmError.value ||
      termsError.value,
  ),
)

function acceptTerms() {
  accepted.value = true
  termsOpen.value = false
}

function onStirInput(event: Event) {
  const el = event.target as HTMLInputElement
  stirDigits.value = el.value.replace(/\D/g, '').slice(0, 9)
  el.value = stirLabel.value
}

let timer: ReturnType<typeof setTimeout> | null = null

onMounted(() => {
  const org = certificateOrg.value
  const item = guestCase.value

  if (org) {
    // Rekvizitlar kalit sertifikatidan keladi, foydalanuvchi faqat parol qo‘yadi.
    kind.value = 'company'
    name.value = org.name
    email.value = org.email
    stirDigits.value = org.stir
  } else if (item) {
    const tin = onlyDigits(item.org.tin)
    kind.value = tin.length === 9 ? 'company' : 'individual'
    name.value = item.org.name
    email.value = item.org.email
    stirDigits.value = tin
  }

  if (!phoneDigits.value) navigateTo('/register')
})

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer)
})

function submit() {
  submitted.value = true
  if (hasErrors.value || pending.value) return

  pending.value = true
  timer = setTimeout(() => {
    pending.value = false

    const org = certificateOrg.value
    const item = guestCase.value

    auth.signIn('TENANT_OWNER')
    const account = auth.user
    if (account) {
      account.fullName = certificate.value?.holderName ?? item?.contactName ?? name.value.trim()
      account.organization =
        kind.value === 'company' ? name.value.trim() : (item?.org.name ?? 'Jismoniy shaxs')
      account.position = kind.value === 'company' ? 'Tashkilot rahbari' : 'Mulkdor'
      account.phone = phoneLabel.value
      account.email = email.value.trim()
      account.tin = stirLabel.value
      account.address = org?.address ?? item?.org.address ?? account.address
    }

    // Hisobsiz yuborilgan ariza endi kabinetga bog‘lanadi.
    if (item) lease.attachAccount(item.id, account?.fullName ?? item.contactName)

    navigateTo('/cabinet')
  }, 520)
}
</script>

<template>
  <div class="grid min-h-dvh lg:grid-cols-2">
    <div class="flex min-h-dvh flex-col px-5 py-7 sm:px-8 lg:px-12 lg:py-9">
      <header class="flex items-center justify-between gap-4">
        <NuxtLink to="/" class="rounded-field" aria-label="Bosh sahifaga o‘tish">
          <AppLogo />
        </NuxtLink>
        <LocaleSwitch />
      </header>

      <main class="flex flex-1 items-center py-10">
        <div class="mx-auto w-full max-w-[460px]">
          <!-- Bosqichlar -->
          <div>
            <div class="flex items-center gap-2" aria-hidden="true">
              <template v-for="n in 3" :key="n">
                <span
                  class="grid size-8 shrink-0 place-items-center rounded-full text-[12px] font-bold ring-1 ring-inset transition-colors"
                  :class="
                    n < 3
                      ? 'bg-brand-50 text-brand-600 ring-brand-200'
                      : 'bg-brand-500 text-white ring-brand-500'
                  "
                >
                  <UiIcon v-if="n < 3" name="check" :size="15" />
                  <template v-else>{{ n }}</template>
                </span>
                <span v-if="n < 3" class="h-0.5 flex-1 rounded-full bg-brand-500" />
              </template>
            </div>
            <p class="mt-3 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
              {{ stepCaption }}
            </p>
          </div>

          <h1 class="mt-5 font-display text-[28px] font-extrabold leading-tight">
            Hisobni to‘ldiring
          </h1>
          <p class="mt-2 text-[14px] leading-relaxed text-ink-500">{{ intro }}</p>

          <!-- Ariza asosida ochilayotgan kabinet -->
          <div
            v-if="guestCase"
            class="mt-4 flex items-start gap-3 rounded-field bg-brand-50 p-3.5 ring-1 ring-inset ring-brand-100"
          >
            <UiIcon name="clipboard" :size="18" class="mt-px shrink-0 text-brand-600" />
            <p class="text-[13px] leading-relaxed text-ink-700">
              <span class="font-semibold text-ink-900">{{ guestCase.code }}</span>
              arizasi kabinetga bog‘lanadi: {{ guestCase.buildingName }}, Unit
              {{ guestCase.unitCode }}.
            </p>
          </div>

          <form class="mt-6 space-y-4" novalidate @submit.prevent="submit">
            <!-- Hisob turi -->
            <div v-if="!locked">
              <p class="mb-1.5 text-[13px] font-semibold text-ink-700">Hisob turi</p>
              <div
                role="radiogroup"
                aria-label="Hisob turi"
                class="grid grid-cols-2 gap-1 rounded-field bg-ink-100 p-1"
              >
                <button
                  v-for="k in KINDS"
                  :key="k.value"
                  type="button"
                  role="radio"
                  :aria-checked="kind === k.value"
                  class="rounded-[8px] px-3 py-2 text-center transition-colors"
                  :class="
                    kind === k.value ? 'bg-white shadow-card' : 'hover:bg-white/60'
                  "
                  @click="kind = k.value"
                >
                  <span
                    class="block text-[14px] font-semibold"
                    :class="kind === k.value ? 'text-brand-600' : 'text-ink-600'"
                  >
                    {{ k.label }}
                  </span>
                  <span class="block text-[12px] text-ink-500">{{ k.caption }}</span>
                </button>
              </div>
            </div>

            <UiField
              :label="nameLabel"
              required
              for="name"
              :error="nameError"
              :hint="locked ? 'Kalit sertifikatidan olindi va o‘zgartirilmaydi' : ''"
            >
              <UiInput
                id="name"
                v-model="name"
                name="name"
                :autocomplete="kind === 'company' ? 'organization' : 'name'"
                :placeholder="kind === 'company' ? 'Urban Office MCHJ' : 'Dilshod Ergashev'"
                :invalid="Boolean(nameError)"
                :readonly="locked"
              >
                <template v-if="locked" #suffix>
                  <UiIcon name="lock" :size="16" />
                </template>
              </UiInput>
            </UiField>

            <UiField
              label="Telefon raqami"
              for="phone"
              hint="Raqam tasdiqlangan va o‘zgartirilmaydi"
            >
              <UiInput id="phone" :model-value="phoneLabel" name="tel" readonly class="tabular">
                <template #suffix>
                  <UiIcon name="check" :size="17" class="text-ok-500" />
                </template>
              </UiInput>
            </UiField>

            <UiField label="E-pochta" required for="email" :error="emailError">
              <UiInput
                id="email"
                v-model="email"
                type="email"
                name="email"
                autocomplete="email"
                placeholder="ism@kompaniya.uz"
                :invalid="Boolean(emailError)"
              />
            </UiField>

            <UiField
              v-if="kind === 'company'"
              label="STIR"
              required
              for="stir"
              :error="stirError"
              :hint="
                locked
                  ? 'Kalit sertifikatidan olindi va o‘zgartirilmaydi'
                  : 'To‘qqiz xonali soliq to‘lovchi identifikatsiya raqami'
              "
            >
              <div class="relative">
                <input
                  id="stir"
                  type="text"
                  inputmode="numeric"
                  name="stir"
                  placeholder="000 000 000"
                  :value="stirLabel"
                  :readonly="locked"
                  :aria-invalid="Boolean(stirError) || undefined"
                  class="tabular h-11 w-full rounded-field bg-white pl-3.5 pr-3.5 text-sm text-ink-800 ring-1 ring-inset transition-colors placeholder:text-ink-400 read-only:bg-ink-50 focus:ring-2 focus:ring-brand-500"
                  :class="stirError ? 'ring-danger-400' : 'ring-ink-200 hover:ring-ink-300'"
                  @input="onStirInput"
                />
              </div>
            </UiField>

            <!-- Parol -->
            <div>
              <label
                for="new-password"
                class="mb-1.5 flex items-center gap-1 text-[13px] font-semibold text-ink-700"
              >
                Parol
                <span class="text-danger-500" aria-hidden="true">*</span>
                <span class="sr-only">majburiy maydon</span>
              </label>
              <div class="relative">
                <input
                  id="new-password"
                  v-model="password"
                  :type="showPassword ? 'text' : 'password'"
                  name="new-password"
                  autocomplete="new-password"
                  placeholder="••••••••"
                  :aria-invalid="Boolean(passwordError) || undefined"
                  class="h-11 w-full rounded-field bg-white pl-3.5 pr-12 text-sm text-ink-800 ring-1 ring-inset transition-colors placeholder:text-ink-400 focus:ring-2 focus:ring-brand-500"
                  :class="passwordError ? 'ring-danger-400' : 'ring-ink-200 hover:ring-ink-300'"
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
                      d="M2.4 10S5.4 4.8 10 4.8 17.6 10 17.6 10s-3 5.2-7.6 5.2S2.4 10 2.4 10z"
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

              <!-- Mustahkamlik o‘lchagichi -->
              <div v-if="password" class="mt-2">
                <div class="flex items-center gap-1.5">
                  <span
                    v-for="s in 4"
                    :key="s"
                    class="h-1.5 flex-1 rounded-full transition-colors"
                    :class="s <= strength ? strengthMeta.bar : 'bg-ink-200'"
                  />
                </div>
                <p class="mt-1.5 flex items-center justify-between gap-3 text-[12px]">
                  <span class="font-semibold" :class="strengthMeta.text">
                    {{ strengthMeta.label }}
                  </span>
                  <span class="text-ink-500">
                    Katta harf, raqam va maxsus belgi mustahkamlikni oshiradi
                  </span>
                </p>
              </div>

              <p v-if="passwordError" class="mt-1.5 text-[12px] font-medium text-danger-600">
                {{ passwordError }}
              </p>
            </div>

            <!-- Parolni tasdiqlash -->
            <div>
              <label
                for="confirm-password"
                class="mb-1.5 flex items-center gap-1 text-[13px] font-semibold text-ink-700"
              >
                Parolni tasdiqlang
                <span class="text-danger-500" aria-hidden="true">*</span>
                <span class="sr-only">majburiy maydon</span>
              </label>
              <div class="relative">
                <input
                  id="confirm-password"
                  v-model="confirm"
                  :type="showConfirm ? 'text' : 'password'"
                  name="confirm-password"
                  autocomplete="new-password"
                  placeholder="••••••••"
                  :aria-invalid="Boolean(confirmError) || undefined"
                  class="h-11 w-full rounded-field bg-white pl-3.5 pr-12 text-sm text-ink-800 ring-1 ring-inset transition-colors placeholder:text-ink-400 focus:ring-2 focus:ring-brand-500"
                  :class="confirmError ? 'ring-danger-400' : 'ring-ink-200 hover:ring-ink-300'"
                />
                <button
                  type="button"
                  class="absolute inset-y-0 right-1 my-auto grid size-10 place-items-center rounded-[8px] text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
                  :aria-label="showConfirm ? 'Parolni yashirish' : 'Parolni ko‘rsatish'"
                  :aria-pressed="showConfirm"
                  @click="showConfirm = !showConfirm"
                >
                  <svg class="size-[18px]" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path
                      d="M2.4 10S5.4 4.8 10 4.8 17.6 10 17.6 10s-3 5.2-7.6 5.2S2.4 10 2.4 10z"
                      stroke="currentColor"
                      stroke-width="1.5"
                      stroke-linejoin="round"
                    />
                    <circle cx="10" cy="10" r="2.3" stroke="currentColor" stroke-width="1.5" />
                    <path
                      v-if="showConfirm"
                      d="m4.2 15.8 11.6-11.6"
                      stroke="currentColor"
                      stroke-width="1.5"
                      stroke-linecap="round"
                    />
                  </svg>
                </button>
              </div>

              <p v-if="confirmError" class="mt-1.5 text-[12px] font-medium text-danger-600">
                {{ confirmError }}
              </p>
            </div>

            <!-- Shartlar -->
            <div>
              <div class="flex items-start gap-2.5">
                <input
                  id="terms"
                  v-model="accepted"
                  type="checkbox"
                  class="mt-1 size-4 shrink-0 cursor-pointer rounded-[4px] accent-brand-500"
                />
                <p class="text-[13px] leading-relaxed text-ink-600">
                  <label for="terms" class="cursor-pointer">
                    Men xizmat shartlari va ma’lumotlarni qayta ishlash tartibiga roziman.
                  </label>
                  <button
                    type="button"
                    class="ml-1 font-semibold text-brand-600 underline-offset-2 hover:underline"
                    @click="termsOpen = true"
                  >
                    Shartlarni o‘qish
                  </button>
                </p>
              </div>
              <p v-if="termsError" class="mt-1.5 text-[12px] font-medium text-danger-600">
                {{ termsError }}
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
              {{ pending ? 'Hisob ochilmoqda…' : 'Hisobni ochish' }}
            </UiButton>
          </form>

          <p class="mt-6 text-center text-[13px] text-ink-500">
            Boshqa raqam bilan boshlamoqchimisiz?
            <NuxtLink to="/register" class="font-semibold text-brand-600 hover:text-brand-700">
              Ortga qaytish
            </NuxtLink>
          </p>
        </div>
      </main>

      <footer class="text-[12px] text-ink-400">© {{ year }} MAKON</footer>
    </div>

    <aside class="relative hidden overflow-hidden bg-ink-900 lg:sticky lg:top-0 lg:block lg:h-dvh">
      <div class="absolute inset-0">
        <UiPhoto
          name="mega-mall"
          alt="Savdo va biznes majmuasi binosi"
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
            Yakuniy qadam
          </p>
          <h2 class="mt-3 font-display text-[28px] font-extrabold leading-tight text-white">
            Kabinet darhol ochiladi
          </h2>
          <p class="mt-3 text-[14px] leading-relaxed text-white/80">
            Hisob ochilgan zahoti unitlaringiz, hisob-fakturalar va arizalar bo‘limi ishga
            tushadi.
          </p>
        </div>

        <ul class="grid gap-3 border-t border-white/20 pt-7">
          <li
            v-for="f in [
              { icon: 'doc', text: 'Shartnoma va dalolatnomalar arxivi' },
              { icon: 'wallet', text: 'Hisob-faktura va to‘lov holati' },
              { icon: 'clipboard', text: 'Servis arizasi va uning bajarilishi' },
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

    <!-- Xizmat shartlari -->
    <UiModal
      v-model="termsOpen"
      title="Xizmat shartlari"
      subtitle="Hisob ochish va ma’lumotlarni qayta ishlash tartibi"
      size="lg"
    >
      <ol class="space-y-4">
        <li
          v-for="(t, i) in [
            {
              title: 'Hisob va uning egasi',
              text: 'Hisob tasdiqlangan telefon raqamiga biriktiriladi. Raqamdan foydalanish huquqi yo‘qolsa, hisobni bloklash uchun murojaat qilish shart.',
            },
            {
              title: 'Ma’lumotlarning ishlatilishi',
              text: 'Kiritilgan nom, e-pochta, telefon va STIR faqat shartnoma rasmiylashtirish, hisob-kitob va xizmat ko‘rsatish uchun ishlatiladi.',
            },
            {
              title: 'Uchinchi tomonga uzatish',
              text: 'Ma’lumotlar reklama maqsadida uzatilmaydi. Qonun talab qilgan hollardagina vakolatli organga taqdim etiladi.',
            },
            {
              title: 'Javobgarlik',
              text: 'Parolni saqlash hisob egasi zimmasida. Begona kirish shubhasi bo‘lsa parolni darhol almashtirish tavsiya etiladi.',
            },
          ]"
          :key="t.title"
          class="flex gap-3.5"
        >
          <span
            class="grid size-7 shrink-0 place-items-center rounded-full bg-brand-500 text-[12px] font-bold text-white"
          >
            {{ i + 1 }}
          </span>
          <span>
            <span class="block text-[14px] font-semibold text-ink-900">{{ t.title }}</span>
            <span class="block text-[13px] leading-relaxed text-ink-600">{{ t.text }}</span>
          </span>
        </li>
      </ol>

      <template #footer>
        <UiButton variant="secondary" @click="termsOpen = false">Yopish</UiButton>
        <UiButton @click="acceptTerms">Roziman</UiButton>
      </template>
    </UiModal>
  </div>
</template>
