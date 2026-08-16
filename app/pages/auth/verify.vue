<script setup lang="ts">
definePageMeta({ layout: 'auth', public: true })

const route = useRoute()

const CODE_LENGTH = 6
const RESEND_SECONDS = 60
const EXPECTED = '123456'

const phoneDigits = computed(() => {
  const q = route.query.phone
  return typeof q === 'string' && /^\d{9}$/.test(q) ? q : ''
})

const phoneLabel = computed(() => {
  const d = phoneDigits.value
  if (!d) return ''
  return `+998 (${d.slice(0, 2)}) ${d.slice(2, 5)} ${d.slice(5, 7)} ${d.slice(7, 9)}`
})

const boxes = ref<HTMLElement | null>(null)
const cells = ref<string[]>(Array.from({ length: CODE_LENGTH }, () => ''))
const wrong = ref(false)
const pending = ref(false)
const resent = ref(false)
const secondsLeft = ref(RESEND_SECONDS)

const year = new Date().getFullYear()
const code = computed(() => cells.value.join(''))
const complete = computed(() => code.value.length === CODE_LENGTH)

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

const countdownLabel = computed(() => {
  const s = secondsLeft.value
  return `00:${String(s).padStart(2, '0')}`
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

onMounted(() => {
  if (!phoneDigits.value) {
    navigateTo('/register')
    return
  }
  startCountdown()
  nextTick(() => focusAt(0))
})

onBeforeUnmount(() => {
  if (ticker) clearInterval(ticker)
  if (timer) clearTimeout(timer)
})

/** Katakka qaytilganda mavjud belgi ajratiladi — yangi raqam uni almashtiradi. */
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

  // Bir katakka bir nechta raqam tushsa — qolganlari keyingi kataklarga tarqaladi.
  const next = [...cells.value]
  for (let i = 0; i < digits.length && index + i < CODE_LENGTH; i++) {
    next[index + i] = digits[i] as string
  }
  cells.value = next

  // Fokus darhol ko‘chadi — tez yozilganda keyingi belgi to‘g‘ri katakka tushadi.
  focusAt(Math.min(index + digits.length, CODE_LENGTH - 1))
  if (next.join('').length === CODE_LENGTH) nextTick(submit)
}

function onKeydown(event: KeyboardEvent, index: number) {
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

function onPaste(event: ClipboardEvent, index: number) {
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
  if (next.join('').length === CODE_LENGTH) nextTick(submit)
}

function submit() {
  if (pending.value) return
  if (!complete.value) {
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
    navigateTo({ path: '/auth/register', query: { phone: phoneDigits.value } })
  }, 420)
}

function resend() {
  if (secondsLeft.value > 0) return
  wrong.value = false
  clearCells()
  startCountdown()
  resent.value = true
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
        <div class="mx-auto w-full max-w-[420px]">
          <!-- Bosqichlar -->
          <div>
            <div class="flex items-center gap-2" aria-hidden="true">
              <template v-for="n in 3" :key="n">
                <span
                  class="grid size-8 shrink-0 place-items-center rounded-full text-[12px] font-bold ring-1 ring-inset transition-colors"
                  :class="
                    n < 2
                      ? 'bg-brand-50 text-brand-600 ring-brand-200'
                      : n === 2
                        ? 'bg-brand-500 text-white ring-brand-500'
                        : 'bg-surface text-ink-400 ring-ink-200'
                  "
                >
                  <UiIcon v-if="n < 2" name="check" :size="15" />
                  <template v-else>{{ n }}</template>
                </span>
                <span
                  v-if="n < 3"
                  class="h-0.5 flex-1 rounded-full"
                  :class="n < 2 ? 'bg-brand-500' : 'bg-ink-200'"
                />
              </template>
            </div>
            <p class="mt-3 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
              2-qadam / 3 — Tasdiqlash kodi
            </p>
          </div>

          <h1 class="mt-5 font-display text-[26px] font-extrabold leading-tight">
            Kodni kiriting
          </h1>
          <p class="mt-2 text-[13.5px] leading-relaxed text-ink-500">
            Olti xonali kod
            <span class="tabular font-semibold text-ink-800">{{ phoneLabel }}</span>
            raqamiga bog‘langan Telegram akkauntiga yuborildi.
          </p>

          <form class="mt-6" novalidate @submit.prevent="submit">
            <fieldset>
              <legend class="mb-2 text-[13px] font-semibold text-ink-700">Tasdiqlash kodi</legend>
              <div ref="boxes" class="grid grid-cols-6 gap-2">
                <input
                  v-for="(cell, i) in cells"
                  :id="`code-${i}`"
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
                    wrong
                      ? 'ring-danger-400'
                      : cell
                        ? 'ring-brand-300'
                        : 'ring-ink-200 hover:ring-ink-300'
                  "
                  @focus="onCellFocus"
                  @input="onCellInput($event, i)"
                  @keydown="onKeydown($event, i)"
                  @paste="onPaste($event, i)"
                />
              </div>
            </fieldset>

            <p v-if="wrong" role="alert" class="mt-3 flex items-center gap-2 text-[12.5px] font-medium text-danger-600">
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
              {{ pending ? 'Tekshirilmoqda…' : 'Tasdiqlash' }}
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
            <UiButton
              variant="secondary"
              size="sm"
              :disabled="secondsLeft > 0"
              @click="resend"
            >
              <UiIcon name="refresh" :size="16" />
              Qayta yuborish
            </UiButton>
          </div>

          <p class="mt-6 text-center text-[13px] text-ink-500">
            Raqam noto‘g‘rimi?
            <NuxtLink to="/register" class="font-semibold text-brand-600 hover:text-brand-700">
              Raqamni o‘zgartirish
            </NuxtLink>
          </p>
        </div>
      </main>

      <footer class="text-[12px] text-ink-400">© {{ year }} MAKON</footer>
    </div>

    <aside class="relative hidden overflow-hidden bg-ink-900 lg:sticky lg:top-0 lg:block lg:h-dvh">
      <div class="absolute inset-0">
        <UiPhoto
          name="interior-office"
          alt="Biznes markaz ichki qabul zonasi"
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
            Xavfsizlik
          </p>
          <h2 class="mt-3 font-display text-[28px] font-extrabold leading-tight text-white">
            Kirish faqat sizning raqamingiz orqali
          </h2>
          <p class="mt-3 text-[14px] leading-relaxed text-white/80">
            Bir martalik kod hisobni raqamingizga bog‘laydi — hujjat va to‘lov ma’lumotlari
            begona qo‘lga o‘tmaydi.
          </p>
        </div>

        <ul class="grid gap-3 border-t border-white/20 pt-7">
          <li
            v-for="f in [
              { icon: 'shield', text: 'Kod besh daqiqadan so‘ng kuchini yo‘qotadi' },
              { icon: 'lock', text: 'Ulanish 256-bit shifrlash bilan himoyalanadi' },
              { icon: 'clipboard', text: 'Har bir kirish urinishi jurnalga yoziladi' },
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
  </div>
</template>
