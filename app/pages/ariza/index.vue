<script setup lang="ts">
import { buildingById } from '~/data/buildings'
import { UNITS, unitById } from '~/data/units'
import { formatStir, organizationByStir, stirDigits } from '~/data/organizations'
import { area, num, sum } from '~/utils/format'

definePageMeta({ layout: 'public', public: true })

const route = useRoute()
const lease = useLeaseStore()

lease.seed()

const CODE_LENGTH = 6
const RESEND_SECONDS = 60
const EXPECTED = '123456'

/** Uch bosqich: forma, telefon tasdig‘i, natija */
const step = ref('form')

const vacantUnits = computed(() => UNITS.filter((u) => u.status === 'VACANT'))

const unitOptions = computed(() =>
  vacantUnits.value.map((u) => ({
    value: u.id,
    label: `${buildingById(u.buildingId)?.name ?? ''} · Unit ${u.code} · ${num(u.area, 1)} m²`,
  })),
)

const PERSON_TYPES = [
  { value: 'individual', label: 'Jismoniy shaxs', caption: 'O‘z nomingizdan' },
  { value: 'company', label: 'Yuridik shaxs', caption: 'Tashkilot nomidan' },
]

const TERM_OPTIONS = [
  { value: '12', label: '12 oy' },
  { value: '24', label: '24 oy' },
  { value: '36', label: '36 oy' },
  { value: '60', label: '60 oy' },
]

const form = reactive({
  unitId: '',
  personType: 'individual',
  fullName: '',
  phone: '',
  email: '',
  orgName: '',
  stir: '',
  price: '',
  startDate: '',
  term: '24',
  note: '',
})

const submitted = ref(false)
const pending = ref(false)

const isCompany = computed(() => form.personType === 'company')

const unit = computed(() => (form.unitId ? unitById(form.unitId) : undefined))
const building = computed(() => (unit.value ? buildingById(unit.value.buildingId) : undefined))

/** Boshlanish sanasi standarti, keyingi oyning birinchi kuni */
function firstOfNextMonth() {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() + 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

onMounted(() => {
  const requested = String(route.query.unit ?? '')
  const found = vacantUnits.value.find((u) => u.id === requested)
  form.unitId = found?.id ?? ''
  form.startDate = firstOfNextMonth()
  if (found) form.price = String(found.price)
})

watch(
  () => form.unitId,
  (id) => {
    const u = vacantUnits.value.find((x) => x.id === id)
    if (u) form.price = String(u.price)
  },
)

// --- Telefon niqobi --------------------------------------------------------

function formatPhone(d: string): string {
  if (!d) return ''
  let out = `+998 (${d.slice(0, 2)}`
  if (d.length >= 2) out += ')'
  if (d.length > 2) out += ` ${d.slice(2, 5)}`
  if (d.length > 5) out += ` ${d.slice(5, 7)}`
  if (d.length > 7) out += ` ${d.slice(7, 9)}`
  return out
}

const phoneFormatted = computed(() => formatPhone(form.phone))
const phoneValid = computed(() => /^[3-9]\d{8}$/.test(form.phone))

function onPhoneInput(event: Event) {
  const el = event.target as HTMLInputElement
  let raw = el.value.replace(/\D/g, '')
  if (raw.startsWith('998')) raw = raw.slice(3)
  form.phone = raw.slice(0, 9)
  el.value = phoneFormatted.value
}

// --- STIR bo‘yicha qidiruv -------------------------------------------------

const stirLabel = computed(() => formatStir(form.stir))
const foundOrg = computed(() => (form.stir.length === 9 ? organizationByStir(form.stir) : undefined))
const stirNotFound = computed(() => form.stir.length === 9 && !foundOrg.value)

function onStirInput(event: Event) {
  const el = event.target as HTMLInputElement
  form.stir = stirDigits(el.value)
  el.value = stirLabel.value
}

// Reyestrda topilgan tashkilot nomi formaga o‘tadi, qolgan rekvizitlar
// kartochkada ko‘rinadi va ariza bilan birga yuboriladi.
watch(foundOrg, (org) => {
  if (org) form.orgName = org.name
})

// --- Tekshirish ------------------------------------------------------------

const errors = computed(() => {
  const e: Record<string, string> = {}
  if (!form.unitId) e.unitId = 'Bo‘sh unitni tanlang'
  if (form.fullName.trim().length < 3) e.fullName = 'Ism va familiyani to‘liq kiriting'
  if (!phoneValid.value) e.phone = 'Telefon raqami to‘liq emas'
  if (!/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(form.email.trim())) e.email = 'E-pochta manzili xato'
  if (isCompany.value && form.orgName.trim().length < 3) e.orgName = 'Tashkilot nomini kiriting'
  if (isCompany.value && form.stir.length !== 9) e.stir = 'STIR to‘qqiz xonali bo‘lishi kerak'
  if (!(Number(form.price) > 0)) e.price = 'Taklif narxini kiriting'
  if (!form.startDate) e.startDate = 'Boshlanish sanasini tanlang'
  return e
})

function errorOf(field: string) {
  return submitted.value ? (errors.value[field] ?? '') : ''
}

const price = computed(() => Number(form.price) || 0)
const term = computed(() => Number(form.term) || 12)
const estimate = computed(() => price.value * term.value)

// --- Telefon tasdig‘i ------------------------------------------------------

const boxes = ref<HTMLElement | null>(null)
const cells = ref<string[]>(Array.from({ length: CODE_LENGTH }, () => ''))
const wrong = ref(false)
const resent = ref(false)
const secondsLeft = ref(RESEND_SECONDS)

const code = computed(() => cells.value.join(''))

let ticker: ReturnType<typeof setInterval> | null = null
let timer: ReturnType<typeof setTimeout> | null = null

function startCountdown() {
  if (ticker) clearInterval(ticker)
  secondsLeft.value = RESEND_SECONDS
  ticker = setInterval(() => {
    secondsLeft.value -= 1
    if (secondsLeft.value <= 0 && ticker) {
      secondsLeft.value = 0
      clearInterval(ticker)
      ticker = null
    }
  }, 1000)
}

const countdownLabel = computed(() => `00:${String(secondsLeft.value).padStart(2, '0')}`)

onBeforeUnmount(() => {
  if (ticker) clearInterval(ticker)
  if (timer) clearTimeout(timer)
})

function inputAt(index: number): HTMLInputElement | null {
  const list = boxes.value?.querySelectorAll('input')
  return (list?.[index] as HTMLInputElement | undefined) ?? null
}

function focusAt(index: number) {
  const el = inputAt(Math.max(0, Math.min(CODE_LENGTH - 1, index)))
  el?.focus()
  el?.select()
}

function clearCells(refocus = true) {
  cells.value = Array.from({ length: CODE_LENGTH }, () => '')
  if (refocus) nextTick(() => focusAt(0))
}

function onCellFocus(event: FocusEvent) {
  ;(event.target as HTMLInputElement).select()
}

function onCellInput(event: Event, index: number) {
  const el = event.target as HTMLInputElement
  const digits = el.value.replace(/\D/g, '')
  wrong.value = false

  if (!digits) {
    cells.value[index] = ''
    el.value = ''
    return
  }

  const next = [...cells.value]
  for (let i = 0; i < digits.length && index + i < CODE_LENGTH; i++) {
    next[index + i] = digits[i] as string
  }
  cells.value = next

  focusAt(Math.min(index + digits.length, CODE_LENGTH - 1))
  if (next.join('').length === CODE_LENGTH) nextTick(confirmCode)
}

function onCellKeydown(event: KeyboardEvent, index: number) {
  if (event.key === 'Backspace') {
    if (cells.value[index]) {
      cells.value[index] = ''
      return
    }
    event.preventDefault()
    if (index > 0) {
      cells.value[index - 1] = ''
      focusAt(index - 1)
    }
    return
  }

  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    focusAt(index - 1)
    return
  }

  if (event.key === 'ArrowRight') {
    event.preventDefault()
    focusAt(index + 1)
  }
}

function onCellPaste(event: ClipboardEvent, index: number) {
  const text = event.clipboardData?.getData('text') ?? ''
  const digits = text.replace(/\D/g, '')
  if (!digits) return

  event.preventDefault()
  wrong.value = false

  const next = [...cells.value]
  for (let i = 0; i < digits.length && index + i < CODE_LENGTH; i++) {
    next[index + i] = digits[i] as string
  }
  cells.value = next

  focusAt(Math.min(index + digits.length, CODE_LENGTH - 1))
  if (next.join('').length === CODE_LENGTH) nextTick(confirmCode)
}

function resend() {
  if (secondsLeft.value > 0) return
  wrong.value = false
  clearCells()
  startCountdown()
  resent.value = true
}

// --- Yuborish --------------------------------------------------------------

/** Forma to‘g‘ri to‘ldirilgan bo‘lsa, raqamga bir martalik kod yuboriladi */
function requestCode() {
  submitted.value = true
  if (Object.keys(errors.value).length > 0 || pending.value) return

  pending.value = true
  timer = setTimeout(() => {
    pending.value = false
    step.value = 'verify'
    resent.value = false
    clearCells(false)
    startCountdown()
    nextTick(() => focusAt(0))
  }, 460)
}

const createdCode = ref('')

function confirmCode() {
  if (pending.value) return
  if (code.value.length !== CODE_LENGTH) {
    wrong.value = true
    return
  }

  const entered = code.value
  pending.value = true
  resent.value = false

  timer = setTimeout(() => {
    pending.value = false
    if (entered !== EXPECTED) {
      wrong.value = true
      clearCells()
      return
    }

    const org = foundOrg.value
    const created = lease.createCase({
      unitId: form.unitId,
      org: {
        name: isCompany.value ? form.orgName.trim() : form.fullName.trim(),
        tin: isCompany.value ? stirLabel.value : '',
        director: isCompany.value ? (org?.director ?? form.fullName.trim()) : form.fullName.trim(),
        phone: phoneFormatted.value,
        email: form.email.trim(),
        address: isCompany.value ? (org?.address ?? '') : '',
      },
      offerPrice: price.value,
      startDate: form.startDate,
      term: term.value,
      note: form.note.trim(),
      type: 'Ijaraga olish',
      guest: true,
      contactName: form.fullName.trim(),
    })

    if (!created) {
      wrong.value = true
      clearCells()
      return
    }

    createdCode.value = created.code
    step.value = 'done'
  }, 480)
}

const trackPath = computed(() => `/ariza/${createdCode.value}`)
const lastFour = computed(() => form.phone.slice(-4))
</script>

<template>
  <div class="mx-auto w-full max-w-[1100px] px-4 py-8 lg:px-8 lg:py-12">
    <nav class="flex flex-wrap items-center gap-1.5 text-[12.5px] text-ink-500" aria-label="Yo‘l">
      <NuxtLink to="/" class="rounded-[6px] hover:text-brand-600">Bosh sahifa</NuxtLink>
      <span aria-hidden="true">/</span>
      <NuxtLink to="/catalog" class="rounded-[6px] hover:text-brand-600">Katalog</NuxtLink>
      <span aria-hidden="true">/</span>
      <span class="font-semibold text-ink-700">Ariza</span>
    </nav>

    <!-- Yakuniy holat -->
    <template v-if="step === 'done'">
      <div class="mx-auto mt-8 max-w-[640px]">
        <div class="rounded-card bg-surface p-6 shadow-card ring-1 ring-ink-200/60 sm:p-8">
          <span
            class="grid size-14 place-items-center rounded-[16px] bg-ok-50 text-ok-600"
            aria-hidden="true"
          >
            <UiIcon name="check" :size="28" />
          </span>

          <h1 class="mt-5 font-display text-[24px] font-extrabold leading-tight text-ink-900">
            Arizangiz qabul qilindi
          </h1>
          <p class="mt-2 text-[13.5px] leading-relaxed text-ink-600">
            Telefon raqamingiz tasdiqlandi. Ariza bino rahbariga tushdi, operator siz bilan
            bog‘lanadi.
          </p>

          <div
            class="mt-5 rounded-card bg-brand-50 p-4 text-center ring-1 ring-inset ring-brand-100"
          >
            <p class="text-[11.5px] font-semibold uppercase tracking-wide text-brand-700">
              Ariza raqami
            </p>
            <p class="tabular mt-1 text-[24px] font-extrabold tracking-wide text-brand-700">
              {{ createdCode }}
            </p>
          </div>

          <p class="mt-4 text-[13px] leading-relaxed text-ink-600">
            Ariza holatini kuzatish uchun ariza raqami va telefon raqamingizning oxirgi to‘rt
            raqami kerak bo‘ladi.
          </p>

          <div class="mt-5 flex flex-wrap gap-2.5">
            <UiButton :to="trackPath" size="lg">
              <UiIcon name="search" :size="17" />
              Arizani kuzatish
            </UiButton>
            <UiButton to="/catalog" variant="secondary" size="lg">
              Katalogga qaytish
            </UiButton>
          </div>

          <div
            class="mt-5 flex items-start gap-3 rounded-field bg-surface-sunken p-3.5 ring-1 ring-inset ring-ink-200"
          >
            <UiIcon name="info" :size="17" class="mt-px shrink-0 text-ink-400" />
            <span class="min-w-0">
              <span class="block text-[12.5px] leading-relaxed text-ink-600">
                Havolani saqlab qo‘ying:
                <span class="font-semibold text-ink-900">{{ trackPath }}</span>
              </span>
              <span class="mt-1.5 block text-[12.5px] leading-relaxed text-ink-600">
                Operator bog‘langanda sizga kabinet ochish taklif qilinadi, shundan so‘ng barcha
                hujjatlar shaxsiy kabinetingizda bo‘ladi.
              </span>
            </span>
          </div>
        </div>
      </div>
    </template>

    <!-- Telefon tasdig‘i -->
    <template v-else-if="step === 'verify'">
      <div class="mx-auto mt-8 max-w-[520px]">
        <div class="rounded-card bg-surface p-6 shadow-card ring-1 ring-ink-200/60 sm:p-8">
          <p class="text-[11px] font-semibold uppercase tracking-wide text-brand-600">
            2-qadam / 2: Telefon tasdig‘i
          </p>
          <h1 class="mt-2 font-display text-[24px] font-extrabold leading-tight text-ink-900">
            Raqamingizni tasdiqlang
          </h1>
          <p class="mt-2 text-[13.5px] leading-relaxed text-ink-600">
            Olti xonali kod
            <span class="tabular font-semibold text-ink-900">{{ phoneFormatted }}</span>
            raqamiga bog‘langan Telegram akkauntiga yuborildi. Ariza faqat shu qadamdan keyin
            ro‘yxatga olinadi.
          </p>

          <form class="mt-6" novalidate @submit.prevent="confirmCode">
            <fieldset>
              <legend class="mb-2 text-[13px] font-semibold text-ink-700">Tasdiqlash kodi</legend>
              <div ref="boxes" class="grid grid-cols-6 gap-1.5 sm:gap-2">
                <input
                  v-for="(cell, i) in cells"
                  :id="`ariza-code-${i}`"
                  :key="i"
                  :value="cell"
                  type="text"
                  inputmode="numeric"
                  maxlength="1"
                  :autocomplete="i === 0 ? 'one-time-code' : 'off'"
                  :aria-label="`Kodning ${i + 1}-belgisi`"
                  :aria-invalid="wrong || undefined"
                  class="tabular h-14 w-full rounded-field bg-white text-center text-xl font-bold text-ink-900 ring-1 ring-inset transition-colors focus:ring-2 focus:ring-brand-500"
                  :class="
                    wrong ? 'ring-danger-400' : cell ? 'ring-brand-300' : 'ring-ink-200 hover:ring-ink-300'
                  "
                  @focus="onCellFocus"
                  @input="onCellInput($event, i)"
                  @keydown="onCellKeydown($event, i)"
                  @paste="onCellPaste($event, i)"
                />
              </div>
            </fieldset>

            <p
              v-if="wrong"
              role="alert"
              class="mt-3 flex items-center gap-2 text-[12.5px] font-medium text-danger-600"
            >
              <UiIcon name="warning" :size="16" class="shrink-0" />
              Kod noto‘g‘ri yoki to‘liq emas. Qaytadan kiriting.
            </p>
            <p
              v-else-if="resent"
              role="status"
              class="mt-3 flex items-center gap-2 text-[12.5px] font-medium text-ok-600"
            >
              <UiIcon name="check" :size="16" class="shrink-0" />
              Yangi kod yuborildi.
            </p>

            <UiButton type="submit" size="lg" block class="mt-5" :disabled="pending">
              {{ pending ? 'Tekshirilmoqda…' : 'Tasdiqlash va yuborish' }}
            </UiButton>
          </form>

          <div
            class="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-field bg-surface-sunken p-3.5 ring-1 ring-inset ring-ink-200"
          >
            <p class="text-[12.5px] text-ink-600">
              <template v-if="secondsLeft > 0">
                Yangi kodni
                <span class="tabular font-semibold text-ink-900">{{ countdownLabel }}</span>
                dan so‘ng so‘rash mumkin
              </template>
              <template v-else>Kod kelmadimi?</template>
            </p>
            <UiButton variant="secondary" size="sm" :disabled="secondsLeft > 0" @click="resend">
              <UiIcon name="refresh" :size="16" />
              Qayta yuborish
            </UiButton>
          </div>

          <button
            type="button"
            class="mt-5 inline-flex items-center gap-1.5 rounded-[8px] py-2 text-[13px] font-semibold text-brand-600 transition-colors hover:text-brand-700"
            @click="step = 'form'"
          >
            <UiIcon name="chevronLeft" :size="16" />
            Ariza ma’lumotlariga qaytish
          </button>
        </div>
      </div>
    </template>

    <!-- Ariza formasi -->
    <template v-else>
      <header class="mt-5">
        <p class="text-[11px] font-semibold uppercase tracking-wide text-brand-600">
          1-qadam / 2: Ariza ma’lumotlari
        </p>
        <h1 class="mt-2 font-display text-[26px] font-extrabold leading-tight text-ink-900 sm:text-[30px]">
          Ariza yuborish
        </h1>
        <p class="mt-2 max-w-[70ch] text-[13.5px] leading-relaxed text-ink-600">
          Ro‘yxatdan o‘tish shart emas. Ma’lumotlarni to‘ldiring, telefon raqamingizni tasdiqlang
          va ariza bino rahbariga tushadi.
        </p>
      </header>

      <div class="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div class="min-w-0 space-y-5">
          <UiCard title="Aloqa ma’lumotlari" subtitle="Operator shu ma’lumotlar orqali bog‘lanadi" icon="user">
            <form class="space-y-4" novalidate @submit.prevent="requestCode">
              <div>
                <p class="mb-1.5 text-[13px] font-semibold text-ink-700">Shaxs turi</p>
                <div
                  role="radiogroup"
                  aria-label="Shaxs turi"
                  class="grid grid-cols-2 gap-1 rounded-field bg-ink-100 p-1"
                >
                  <button
                    v-for="p in PERSON_TYPES"
                    :key="p.value"
                    type="button"
                    role="radio"
                    :aria-checked="form.personType === p.value"
                    class="min-h-[44px] rounded-[8px] px-3 py-2 text-center transition-colors"
                    :class="form.personType === p.value ? 'bg-white shadow-card' : 'hover:bg-white/60'"
                    @click="form.personType = p.value"
                  >
                    <span
                      class="block text-[13.5px] font-semibold"
                      :class="form.personType === p.value ? 'text-brand-600' : 'text-ink-600'"
                    >
                      {{ p.label }}
                    </span>
                    <span class="block text-[11.5px] text-ink-500">{{ p.caption }}</span>
                  </button>
                </div>
              </div>

              <UiField label="Ism va familiya" required for="ariza-name" :error="errorOf('fullName')">
                <UiInput
                  id="ariza-name"
                  v-model="form.fullName"
                  name="name"
                  autocomplete="name"
                  placeholder="Ism va familiyangiz"
                  :invalid="Boolean(errorOf('fullName'))"
                />
              </UiField>

              <div class="grid gap-4 sm:grid-cols-2">
                <UiField label="Telefon raqami" required for="ariza-phone" :error="errorOf('phone')">
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
                        errorOf('phone') ? 'ring-danger-400' : 'ring-ink-200 hover:ring-ink-300'
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

                <UiField label="E-pochta" required for="ariza-email" :error="errorOf('email')">
                  <UiInput
                    id="ariza-email"
                    v-model="form.email"
                    type="email"
                    name="email"
                    autocomplete="email"
                    placeholder="ism@kompaniya.uz"
                    :invalid="Boolean(errorOf('email'))"
                  />
                </UiField>
              </div>

              <!-- Yuridik shaxs rekvizitlari -->
              <template v-if="isCompany">
                <UiField
                  label="STIR"
                  required
                  for="ariza-stir"
                  :error="errorOf('stir')"
                  hint="To‘qqiz xonali raqam: reyestrda topilsa, rekvizitlar o‘zi to‘ldiriladi"
                >
                  <div class="relative">
                    <input
                      id="ariza-stir"
                      type="text"
                      inputmode="numeric"
                      name="stir"
                      placeholder="000 000 000"
                      :value="stirLabel"
                      :aria-invalid="Boolean(errorOf('stir')) || undefined"
                      class="tabular h-11 w-full rounded-field bg-white px-3.5 text-sm text-ink-800 ring-1 ring-inset transition-colors placeholder:text-ink-400 focus:ring-2 focus:ring-brand-500"
                      :class="
                        errorOf('stir') ? 'ring-danger-400' : 'ring-ink-200 hover:ring-ink-300'
                      "
                      @input="onStirInput"
                    />
                  </div>
                </UiField>

                <div
                  v-if="foundOrg"
                  class="rounded-field bg-ok-50 p-3.5 ring-1 ring-inset ring-ok-100"
                >
                  <p class="flex items-center gap-2 text-[12.5px] font-semibold text-ok-700">
                    <UiIcon name="check" :size="15" class="shrink-0" />
                    Tashkilot reyestrda topildi
                  </p>
                  <dl class="mt-2.5 grid gap-2 sm:grid-cols-2">
                    <div>
                      <dt class="text-[11.5px] text-ink-500">Nomi</dt>
                      <dd class="text-[12.5px] font-semibold text-ink-900">{{ foundOrg.name }}</dd>
                    </div>
                    <div>
                      <dt class="text-[11.5px] text-ink-500">Rahbar</dt>
                      <dd class="text-[12.5px] font-semibold text-ink-900">
                        {{ foundOrg.director }}
                      </dd>
                    </div>
                    <div class="sm:col-span-2">
                      <dt class="text-[11.5px] text-ink-500">Yuridik manzil</dt>
                      <dd class="text-[12.5px] font-semibold text-ink-900">
                        {{ foundOrg.address }}
                      </dd>
                    </div>
                  </dl>
                </div>

                <p
                  v-else-if="stirNotFound"
                  class="flex items-start gap-2 rounded-field bg-warn-50 p-3.5 text-[12.5px] leading-relaxed text-ink-700 ring-1 ring-inset ring-warn-100"
                >
                  <UiIcon name="info" :size="15" class="mt-px shrink-0 text-warn-600" />
                  Bu STIR reyestrda topilmadi. Tashkilot nomini qo‘lda kiriting, qolgan
                  rekvizitlarni operator bog‘langanda aniqlaydi.
                </p>

                <UiField
                  label="Tashkilot nomi"
                  required
                  for="ariza-org"
                  :error="errorOf('orgName')"
                >
                  <UiInput
                    id="ariza-org"
                    v-model="form.orgName"
                    name="organization"
                    autocomplete="organization"
                    placeholder="Tashkilot nomi"
                    :invalid="Boolean(errorOf('orgName'))"
                  />
                </UiField>
              </template>
            </form>
          </UiCard>

          <UiCard title="So‘rov shartlari" subtitle="Yakuniy shartlar ko‘rikdan keyin kelishiladi" icon="clipboard">
            <form class="space-y-4" novalidate @submit.prevent="requestCode">
              <UiField label="Bo‘sh unit" required :error="errorOf('unitId')">
                <UiSelect
                  v-model="form.unitId"
                  :options="unitOptions"
                  placeholder="Maydonni tanlang"
                  :invalid="Boolean(errorOf('unitId'))"
                />
              </UiField>

              <div class="grid gap-4 sm:grid-cols-2">
                <UiField label="Taklif narxi" required :error="errorOf('price')" hint="Oylik summa, so‘m">
                  <UiInput
                    v-model="form.price"
                    type="number"
                    min="0"
                    placeholder="0"
                    :invalid="Boolean(errorOf('price'))"
                  >
                    <template #suffix><span class="text-[12px]">so‘m</span></template>
                  </UiInput>
                </UiField>
                <UiField label="Muddat" required>
                  <UiSelect v-model="form.term" :options="TERM_OPTIONS" />
                </UiField>
              </div>

              <UiField label="Boshlanish sanasi" required :error="errorOf('startDate')">
                <UiInput
                  v-model="form.startDate"
                  type="date"
                  :invalid="Boolean(errorOf('startDate'))"
                />
              </UiField>

              <UiField label="Izoh" hint="Talab, shart yoki savollaringizni yozing">
                <textarea
                  v-model="form.note"
                  rows="4"
                  class="w-full rounded-field bg-white px-3.5 py-2.5 text-sm text-ink-800 ring-1 ring-inset ring-ink-200 transition-colors placeholder:text-ink-400 hover:ring-ink-300 focus:ring-2 focus:ring-brand-500"
                  placeholder="Masalan: maydonni bosqichma-bosqich egallash rejalashtirilgan"
                />
              </UiField>

              <div
                class="flex items-start gap-3 rounded-field bg-brand-50 p-3.5 ring-1 ring-inset ring-brand-100"
              >
                <UiIcon name="shield" :size="18" class="mt-px shrink-0 text-brand-600" />
                <p class="text-[12.5px] leading-relaxed text-ink-700">
                  Keyingi qadamda telefon raqamingizga bir martalik kod yuboriladi. Bu yagona
                  majburiy tasdiq: aloqa raqami haqiqiy bo‘lishi kerak.
                </p>
              </div>

              <div class="flex flex-wrap items-center justify-end gap-3 border-t border-ink-100 pt-4">
                <UiButton variant="ghost" to="/catalog">Bekor qilish</UiButton>
                <UiButton type="submit" size="lg" :disabled="pending">
                  <UiIcon name="send" :size="16" />
                  {{ pending ? 'Kod yuborilmoqda…' : 'Davom etish' }}
                </UiButton>
              </div>
            </form>
          </UiCard>
        </div>

        <!-- Tanlangan maydon -->
        <div class="min-w-0 space-y-5">
          <UiCard
            v-if="unit && building"
            title="Tanlangan maydon"
            icon="building"
            tone="teal"
            flush
            :padded="false"
          >
            <UiPhoto
              :name="building.photo"
              :alt="`${building.name} binosi`"
              ratio="aspect-[16/10]"
              rounded="rounded-none"
              sizes="(max-width: 1279px) 100vw, 340px"
            />
            <div class="p-5">
              <p class="text-[15px] font-extrabold leading-snug text-ink-900">
                {{ building.name }}
              </p>
              <p class="mt-1 text-[12.5px] text-ink-500">
                {{ building.city }}, {{ building.district }}, {{ building.street }}
              </p>

              <dl class="mt-4 grid grid-cols-2 gap-3">
                <div class="rounded-field bg-surface-sunken px-3 py-2.5 ring-1 ring-inset ring-ink-200">
                  <dt class="text-[11px] text-ink-500">Unit</dt>
                  <dd class="tabular text-[13px] font-bold text-ink-900">{{ unit.code }}</dd>
                </div>
                <div class="rounded-field bg-surface-sunken px-3 py-2.5 ring-1 ring-inset ring-ink-200">
                  <dt class="text-[11px] text-ink-500">Qavat</dt>
                  <dd class="tabular text-[13px] font-bold text-ink-900">{{ unit.floor }}</dd>
                </div>
                <div class="rounded-field bg-surface-sunken px-3 py-2.5 ring-1 ring-inset ring-ink-200">
                  <dt class="text-[11px] text-ink-500">Maydon</dt>
                  <dd class="tabular text-[13px] font-bold text-ink-900">{{ area(unit.area) }}</dd>
                </div>
                <div class="rounded-field bg-surface-sunken px-3 py-2.5 ring-1 ring-inset ring-ink-200">
                  <dt class="text-[11px] text-ink-500">Foydalanish</dt>
                  <dd class="text-[13px] font-bold text-ink-900">{{ unit.usage }}</dd>
                </div>
              </dl>

              <div
                class="mt-3 flex items-baseline justify-between gap-3 rounded-field bg-brand-50 px-3.5 py-3 ring-1 ring-inset ring-brand-100"
              >
                <span class="text-[12.5px] text-ink-600">E’lon narxi</span>
                <span class="tabular text-[14px] font-extrabold text-brand-700">
                  {{ num(unit.price) }} {{ unit.priceUnit }}
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
                Obyekt sahifasi
              </UiButton>
            </div>
          </UiCard>

          <UiCard v-if="price > 0" title="Dastlabki hisob" subtitle="Yakuniy shartlar ko‘rikdan keyin" icon="chart" tone="brand">
            <dl class="space-y-3">
              <div class="flex items-baseline justify-between gap-3">
                <dt class="text-[12.5px] text-ink-500">Taklif narxi (oylik)</dt>
                <dd class="tabular text-[13.5px] font-bold text-ink-900">{{ sum(price) }}</dd>
              </div>
              <div class="flex items-baseline justify-between gap-3">
                <dt class="text-[12.5px] text-ink-500">Muddat</dt>
                <dd class="tabular text-[13.5px] font-bold text-ink-900">{{ term }} oy</dd>
              </div>
              <div class="flex items-baseline justify-between gap-3 border-t border-ink-100 pt-3">
                <dt class="text-[12.5px] text-ink-500">Muddat bo‘yicha jami</dt>
                <dd class="tabular text-[15px] font-extrabold text-brand-700">{{ sum(estimate) }}</dd>
              </div>
            </dl>
          </UiCard>

          <UiCard title="Arizani kuzatish" icon="search" tone="neutral">
            <p class="text-[12.5px] leading-relaxed text-ink-600">
              Ariza yuborilgach sizga raqam beriladi. Holatni kuzatish uchun shu raqam va telefon
              raqamingizning oxirgi to‘rt raqami kifoya.
            </p>
            <p v-if="lastFour.length === 4" class="mt-2 text-[12.5px] text-ink-600">
              Hozirgi raqamingiz bo‘yicha oxirgi to‘rt raqam:
              <span class="tabular font-bold text-ink-900">{{ lastFour }}</span>
            </p>
          </UiCard>
        </div>
      </div>
    </template>
  </div>
</template>
