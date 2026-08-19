<script setup lang="ts">
import {
  CERTIFICATES,
  LANDLORD_STIR,
  formatStir,
  organizationByStir,
  phoneDigitsOf,
  type Certificate,
} from '~/data/organizations'
import { dateShort } from '~/utils/format'

definePageMeta({ layout: 'auth', public: true })

const PATHS = [
  { value: 'phone', label: 'Telefon orqali' },
  { value: 'eri', label: 'ERI orqali' },
]

const path = ref('phone')

const phoneDigits = ref('')
const touched = ref(false)
const pending = ref(false)

const year = new Date().getFullYear()

/** `90` + `1234567` → `+998 (90) 123 45 67` */
function formatPhone(d: string): string {
  if (!d) return ''
  let out = `+998 (${d.slice(0, 2)}`
  if (d.length >= 2) out += ')'
  if (d.length > 2) out += ` ${d.slice(2, 5)}`
  if (d.length > 5) out += ` ${d.slice(5, 7)}`
  if (d.length > 7) out += ` ${d.slice(7, 9)}`
  return out
}

const formatted = computed(() => formatPhone(phoneDigits.value))
const isValid = computed(() => /^[3-9]\d{8}$/.test(phoneDigits.value))

const error = computed(() => {
  if (!touched.value) return ''
  if (!phoneDigits.value) return 'Telefon raqamini kiriting'
  if (!isValid.value) return 'Raqam to‘liq emas: operator kodi va yetti xonali raqam kerak'
  return ''
})

function onInput(event: Event) {
  const el = event.target as HTMLInputElement
  let raw = el.value.replace(/\D/g, '')
  if (raw.startsWith('998')) raw = raw.slice(3)
  phoneDigits.value = raw.slice(0, 9)
  // Qiymat o‘zgarmasa Vue maydonni yangilamaydi, niqobni qo‘lda qo‘llaymiz.
  el.value = formatted.value
}

let timer: ReturnType<typeof setTimeout> | null = null

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer)
})

function submit() {
  touched.value = true
  if (!isValid.value || pending.value) return

  pending.value = true
  timer = setTimeout(() => {
    pending.value = false
    navigateTo({ path: '/auth/verify', query: { phone: phoneDigits.value } })
  }, 480)
}

// --- Kalit sertifikati yo‘li ----------------------------------------------

const reading = ref(false)
const scanned = ref(false)
const found = ref<Certificate[]>([])
const selectedSerial = ref('')
const confirmed = ref(false)
const eriPending = ref(false)

const issue = ref('')

const ISSUE_TEXT: Record<string, { title: string; text: string }> = {
  unselected: {
    title: 'Sertifikat tanlanmagan.',
    text: 'Qayd yaratish uchun kalitni ro‘yxatdan belgilang.',
  },
  expired: {
    title: 'Sertifikat muddati tugagan.',
    text: 'Amaldagi kalit bilan qaytadan urinib ko‘ring.',
  },
  unregistered: {
    title: 'Sertifikat tizimda ro‘yxatdan o‘tmagan.',
    text: 'Kalitdagi tashkilot reyestrda topilmadi. Ma’lumotlarni qo‘lda kiritish uchun telefon orqali davom eting.',
  },
  staff: {
    title: 'Bu kalit xodim hisobiga tegishli.',
    text: 'Xodim hisobiga kirish sahifasi orqali kiriladi, yangi qayd ochilmaydi.',
  },
}

const selected = computed(() => found.value.find((c) => c.serial === selectedSerial.value) ?? null)
const selectedOrg = computed(() =>
  selected.value ? organizationByStir(selected.value.organizationStir) : undefined,
)

const emptyStore = computed(() => scanned.value && found.value.length === 0)

function orgOf(cert: Certificate) {
  return organizationByStir(cert.organizationStir)
}

// Tasdiqlangan kartadan ro‘yxatga «Boshqa kalit» tugmasi orqali qaytiladi,
// shuning uchun bu yerda faqat xabar tozalanadi.
watch(selectedSerial, () => {
  issue.value = ''
})

watch(path, () => {
  issue.value = ''
})

function scanStore() {
  if (reading.value) return
  reading.value = true
  issue.value = ''
  confirmed.value = false

  timer = setTimeout(() => {
    reading.value = false
    scanned.value = true
    found.value = [...CERTIFICATES]
    selectedSerial.value = found.value.find((c) => c.status === 'ACTIVE')?.serial ?? ''
  }, 460)
}

/** Tanlangan kalit tekshiriladi va tashkilot kartasi ochiladi */
function confirmCertificate() {
  const cert = selected.value
  if (!cert) {
    issue.value = 'unselected'
    return
  }
  if (cert.status === 'EXPIRED') {
    issue.value = 'expired'
    return
  }
  const org = orgOf(cert)
  if (!org) {
    issue.value = 'unregistered'
    return
  }
  if (org.stir === LANDLORD_STIR) {
    issue.value = 'staff'
    return
  }
  issue.value = ''
  confirmed.value = true
}

/** Tashkilot tasdiqlandi, telefon raqamiga bir martalik kod yuboriladi */
function continueWithCertificate() {
  const cert = selected.value
  const org = selectedOrg.value
  if (!cert || !org || eriPending.value) return

  eriPending.value = true
  timer = setTimeout(() => {
    eriPending.value = false
    navigateTo({
      path: '/auth/verify',
      query: { phone: phoneDigitsOf(org.phone), eri: cert.serial },
    })
  }, 480)
}

const stepCaption = computed(() =>
  path.value === 'phone' ? '1-qadam / 3: Telefon raqami' : '1-qadam / 3: Sertifikat va tashkilot',
)
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
                    n === 1
                      ? 'bg-brand-500 text-white ring-brand-500'
                      : 'bg-surface text-ink-400 ring-ink-200'
                  "
                >
                  {{ n }}
                </span>
                <span v-if="n < 3" class="h-0.5 flex-1 rounded-full bg-ink-200" />
              </template>
            </div>
            <p class="mt-3 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
              {{ stepCaption }}
            </p>
          </div>

          <h1 class="mt-5 font-display text-[28px] font-extrabold leading-tight">
            Ro‘yxatdan o‘tish
          </h1>
          <p class="mt-2 text-[14px] leading-relaxed text-ink-500">
            <template v-if="path === 'phone'">
              Raqamingizni kiriting: bir martalik kod shu raqamga bog‘langan Telegram akkauntiga
              yuboriladi.
            </template>
            <template v-else>
              Kalit sertifikatini tanlang, tashkilot ma’lumotlari sertifikatdan olinadi.
            </template>
          </p>

          <UiTabs v-model="path" :tabs="PATHS" class="mt-5 [&_button]:min-h-[44px]" />

          <!-- Telefon orqali -->
          <form v-if="path === 'phone'" class="mt-6" novalidate @submit.prevent="submit">
            <UiField label="Telefon raqami" required for="phone" :error="error">
              <div class="relative">
                <input
                  id="phone"
                  type="tel"
                  inputmode="numeric"
                  autocomplete="tel"
                  name="phone"
                  placeholder="+998 (--) --- -- --"
                  :value="formatted"
                  :aria-invalid="Boolean(error) || undefined"
                  class="tabular h-11 w-full rounded-field bg-white pl-3.5 pr-10 text-sm text-ink-800 ring-1 ring-inset transition-colors placeholder:text-ink-400 placeholder:font-normal focus:ring-2 focus:ring-brand-500"
                  :class="error ? 'ring-danger-400' : 'ring-ink-200 hover:ring-ink-300'"
                  @input="onInput"
                  @blur="touched = true"
                />
                <svg
                  v-if="isValid"
                  class="absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-ok-500"
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.5" />
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

            <div
              class="mt-4 flex gap-3 rounded-field bg-brand-50 p-3.5 ring-1 ring-inset ring-brand-100"
            >
              <UiIcon name="send" :size="18" class="mt-px shrink-0 text-brand-600" />
              <p class="text-[13px] leading-relaxed text-ink-700">
                Kod SMS orqali emas, aynan shu raqamga bog‘langan
                <span class="font-semibold text-ink-900">Telegram</span> akkauntiga xabar sifatida
                keladi. Kod besh daqiqa amal qiladi.
              </p>
            </div>

            <UiButton type="submit" size="lg" block class="mt-5" :disabled="pending">
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
              {{ pending ? 'Yuborilmoqda…' : 'Kodni yuborish' }}
            </UiButton>
          </form>

          <!-- Kalit sertifikati orqali -->
          <div v-else class="mt-6 space-y-4">
            <UiButton variant="secondary" size="lg" block :disabled="reading" @click="scanStore">
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

            <div
              v-if="emptyStore"
              role="alert"
              class="flex gap-3 rounded-field bg-warn-50 p-3.5 ring-1 ring-inset ring-warn-100"
            >
              <UiIcon name="warning" :size="18" class="mt-px shrink-0 text-warn-600" />
              <p class="text-[13px] leading-relaxed text-ink-700">
                <span class="font-semibold text-warn-700">Kalit do‘koni bo‘sh.</span>
                Kalit tashuvchini ulang yoki telefon orqali ro‘yxatdan o‘ting.
              </p>
            </div>

            <!-- Tasdiqlangan tashkilot kartasi -->
            <template v-else-if="confirmed && selected && selectedOrg">
              <p
                class="flex items-center gap-2 rounded-field bg-ok-50 p-3.5 text-[13px] font-semibold text-ok-700 ring-1 ring-inset ring-ok-100"
              >
                <UiIcon name="check" :size="16" class="shrink-0" />
                Sertifikat amalda, tashkilot reyestrda topildi
              </p>

              <div class="rounded-card bg-surface p-4 ring-1 ring-inset ring-ink-200">
                <p class="text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                  Tashkilot ma’lumotlari
                </p>
                <p class="mt-1.5 text-[16px] font-extrabold leading-snug text-ink-900">
                  {{ selectedOrg.name }}
                </p>

                <dl class="mt-3.5 space-y-2.5">
                  <div
                    v-for="r in [
                      { label: 'STIR', value: formatStir(selectedOrg.stir), icon: 'clipboard' },
                      { label: 'Rahbar', value: selectedOrg.director, icon: 'user' },
                      { label: 'Yuridik manzil', value: selectedOrg.address, icon: 'location' },
                      { label: 'Telefon', value: selectedOrg.phone, icon: 'phone' },
                    ]"
                    :key="r.label"
                  >
                    <!--
                      `dl` ichidagi `div` faqat `dt` va `dd` ni saqlashi mumkin,
                      shuning uchun ikonka `dt` tarkibida turadi. `pl-11` ikonka
                      kengligi (32px) va oraliq (12px) yig‘indisiga teng, demak
                      qiymat yorliq ostida aynan bir chiziqda qoladi.
                    -->
                    <dt
                      class="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wide text-ink-500"
                    >
                      <span
                        class="grid size-8 shrink-0 place-items-center rounded-[9px] bg-surface-sunken text-brand-600 ring-1 ring-ink-200"
                      >
                        <UiIcon :name="r.icon" :size="15" />
                      </span>
                      {{ r.label }}
                    </dt>
                    <dd
                      class="tabular mt-0.5 break-words pl-11 text-[13px] font-semibold text-ink-900"
                    >
                      {{ r.value }}
                    </dd>
                  </div>
                </dl>

                <p class="mt-3.5 flex items-start gap-2 text-[12px] leading-relaxed text-ink-500">
                  <UiIcon name="info" :size="14" class="mt-px shrink-0" />
                  Ma’lumotlar kalit sertifikatidan olindi. Xato bo‘lsa, telefon orqali ro‘yxatdan
                  o‘tib qo‘lda to‘ldiring.
                </p>
              </div>

              <div
                class="flex gap-3 rounded-field bg-brand-50 p-3.5 ring-1 ring-inset ring-brand-100"
              >
                <UiIcon name="send" :size="18" class="mt-px shrink-0 text-brand-600" />
                <p class="text-[13px] leading-relaxed text-ink-700">
                  Tasdiqlagach, bir martalik kod
                  <span class="tabular font-semibold text-ink-900">{{ selectedOrg.phone }}</span>
                  raqamiga bog‘langan Telegram akkauntiga yuboriladi.
                </p>
              </div>

              <div class="flex flex-wrap gap-2.5">
                <UiButton variant="secondary" size="lg" @click="confirmed = false">
                  <UiIcon name="chevronLeft" :size="16" />
                  Boshqa kalit
                </UiButton>
                <UiButton
                  size="lg"
                  class="flex-1"
                  :disabled="eriPending"
                  @click="continueWithCertificate"
                >
                  <svg
                    v-if="eriPending"
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
                  {{ eriPending ? 'Kod yuborilmoqda…' : 'Tasdiqlash va davom etish' }}
                </UiButton>
              </div>
            </template>

            <!-- Sertifikat tanlash -->
            <template v-else-if="scanned">
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
                        <span class="block truncate text-[14px] font-bold text-ink-900">
                          {{ c.holderName }}
                        </span>
                        <span class="mt-0.5 block truncate text-[13px] text-ink-600">
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

              <div
                v-if="issue"
                role="alert"
                class="flex gap-3 rounded-field bg-danger-50 p-3.5 ring-1 ring-inset ring-danger-100"
              >
                <UiIcon name="warning" :size="18" class="mt-px shrink-0 text-danger-600" />
                <p class="text-[13px] leading-relaxed text-ink-700">
                  <span class="font-semibold text-danger-700">{{ ISSUE_TEXT[issue]?.title }}</span>
                  {{ ISSUE_TEXT[issue]?.text }}
                </p>
              </div>

              <UiButton size="lg" block @click="confirmCertificate">
                Tashkilot ma’lumotlarini ko‘rish
                <UiIcon name="arrowRight" :size="16" />
              </UiButton>
            </template>

            <p
              v-else
              class="flex items-start gap-2 rounded-field bg-surface-sunken p-3.5 text-[13px] leading-relaxed text-ink-600 ring-1 ring-inset ring-ink-200"
            >
              <UiIcon name="info" :size="15" class="mt-px shrink-0 text-ink-400" />
              Kalit do‘konini o‘qing: tashkilot nomi, STIR, rahbar va manzil sertifikatdan
              to‘ldiriladi, siz faqat tasdiqlaysiz.
            </p>
          </div>

          <p class="mt-7 text-center text-[13px] text-ink-500">
            Hisobingiz bormi?
            <NuxtLink to="/login" class="font-semibold text-brand-600 hover:text-brand-700">
              Tizimga kiring
            </NuxtLink>
          </p>
        </div>
      </main>

      <footer class="text-[12px] text-ink-400">© {{ year }} MAKON</footer>
    </div>

    <aside class="relative hidden overflow-hidden bg-ink-900 lg:sticky lg:top-0 lg:block lg:h-dvh">
      <div class="absolute inset-0">
        <UiPhoto
          name="green-business-center"
          alt="Green Business Center biznes markazi binosi"
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
            Ijarachi kabineti
          </p>
          <h2 class="mt-3 font-display text-[28px] font-extrabold leading-tight text-white">
            Bo‘sh maydonni o‘zingiz tanlang
          </h2>
          <p class="mt-3 text-[14px] leading-relaxed text-white/80">
            Katalogdan unit tanlang, arizani yuboring va shartnomadan to‘lovgacha bo‘lgan yo‘lni
            kabinetda kuzating.
          </p>
        </div>

        <ul class="grid gap-3 border-t border-white/20 pt-7">
          <li
            v-for="f in [
              { icon: 'building', text: 'Unit va qavat rejalari to‘liq ochiq' },
              { icon: 'contract', text: 'Shartnoma va hujjatlar bitta joyda' },
              { icon: 'meter', text: 'Hisoblagich ko‘rsatkichini o‘zingiz kiritasiz' },
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
  </div>
</template>
