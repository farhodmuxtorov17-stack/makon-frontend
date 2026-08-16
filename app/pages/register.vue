<script setup lang="ts">
definePageMeta({ layout: 'auth', public: true })

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
  // Qiymat o‘zgarmasa Vue maydonni yangilamaydi — niqobni qo‘lda qo‘llaymiz.
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
              1-qadam / 3 — Telefon raqami
            </p>
          </div>

          <h1 class="mt-5 font-display text-[26px] font-extrabold leading-tight">
            Ro‘yxatdan o‘tish
          </h1>
          <p class="mt-2 text-[13.5px] leading-relaxed text-ink-500">
            Raqamingizni kiriting — bir martalik kod shu raqamga bog‘langan Telegram akkauntiga
            yuboriladi.
          </p>

          <form class="mt-6" novalidate @submit.prevent="submit">
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
              <p class="text-[12.5px] leading-relaxed text-ink-700">
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
            <span class="text-[13.5px] text-white/85">{{ f.text }}</span>
          </li>
        </ul>
      </div>
    </aside>
  </div>
</template>
