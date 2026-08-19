<script setup lang="ts">
import { num } from '~/utils/format'

/**
 * Ariza oynasi. Ochilish holati butun ommaviy maketda bitta joyda saqlanadi
 * (`makon.apply.open`), shuning uchun oyna sarlavhadagi tugmadan ham, sahifa
 * ichidagi chaqiriqdan ham ochiladi va hujjatda bir nusxada turadi.
 *
 * Ijarachi faqat yuridik shaxs bo‘ladi, shuning uchun shaxs turi so‘ralmaydi.
 * Besh maydon: byudjet, muddat, tashkilot, mas’ul shaxs, telefon.
 */
const open = useState<boolean>('makon.apply.open', () => false)
const requestedUnit = useState<string>('makon.apply.unit', () => '')

const { t } = useI18n()
const lease = useLeaseStore()

lease.seed()

/** Muddat ro‘yxati, oylarda */
const TERMS = [6, 12, 24, 36, 60]

const TERM_OPTIONS = computed(() =>
  TERMS.map((m) => ({ value: String(m), label: t('apply.termMonths', { count: m }) })),
)

const amount = ref('')
const term = ref('12')
const org = ref('')
const person = ref('')
const phone = ref('')

const submitted = ref(false)
const pending = ref(false)
const createdCode = ref('')
const failed = ref(false)

let timer: ReturnType<typeof setTimeout> | null = null

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer)
})

// --- Summa: kiritish paytida uch xonalik guruhlarga ajratiladi -------------

const amountValue = computed(() => Number(amount.value.replace(/\D/g, '')) || 0)

watch(amount, (value) => {
  const digits = value.replace(/\D/g, '').slice(0, 12)
  const next = digits ? num(Number(digits)) : ''
  if (next !== value) amount.value = next
})

// --- Telefon niqobi: +998 (XX) XXX XX XX ----------------------------------

function digitsOf(value: string) {
  let raw = value.replace(/\D/g, '')
  if (raw.startsWith('998')) raw = raw.slice(3)
  return raw.slice(0, 9)
}

function formatPhone(d: string): string {
  if (!d) return ''
  let out = `+998 (${d.slice(0, 2)}`
  if (d.length >= 2) out += ')'
  if (d.length > 2) out += ` ${d.slice(2, 5)}`
  if (d.length > 5) out += ` ${d.slice(5, 7)}`
  if (d.length > 7) out += ` ${d.slice(7, 9)}`
  return out
}

watch(phone, (value) => {
  const next = formatPhone(digitsOf(value))
  if (next !== value) phone.value = next
})

const phoneValid = computed(() => /^[3-9]\d{8}$/.test(digitsOf(phone.value)))

// --- Tekshirish ------------------------------------------------------------

const errors = computed(() => {
  const e: Record<string, string> = {}
  if (amountValue.value <= 0) e.amount = t('apply.amountError')
  if (org.value.trim().length < 3) e.org = t('apply.orgError')
  if (person.value.trim().length < 3) e.person = t('apply.personError')
  if (!phoneValid.value) e.phone = t('apply.phoneError')
  return e
})

/** Xato yozuvi faqat yuborishga urinilgandan keyin ko‘rinadi */
function errorOf(field: string) {
  return submitted.value ? (errors.value[field] ?? '') : ''
}

// --- Do‘konga yozish -------------------------------------------------------

/*
 * Forma maydon tanlashni so‘ramaydi, shuning uchun ariza maydonsiz ochiladi.
 * Maydonni operator qo‘ng‘iroq paytida mijoz bilan kelishib belgilaydi.
 * Katalog kartasidan ochilgan bo‘lsa, mijoz qaysi maydonni ko‘rgani ariza
 * bilan birga uzatiladi va operator ekranida shu maydon taklif bo‘lib turadi.
 */

const termValue = computed(() => Number(term.value) || 12)
const orgName = computed(() => org.value.trim())

function submit() {
  submitted.value = true
  failed.value = false
  if (pending.value) return
  if (Object.keys(errors.value).length > 0) return

  pending.value = true

  timer = setTimeout(() => {
    pending.value = false

    const contact = person.value.trim()
    const created = lease.createCase({
      unitId: requestedUnit.value || null,
      org: {
        name: orgName.value,
        tin: '',
        director: contact,
        phone: phone.value,
        email: '',
        address: '',
      },
      offerPrice: amountValue.value,
      term: termValue.value,
      note: `Ochiq forma: byudjet ${num(amountValue.value)} so‘m/oy, muddat ${termValue.value} oy.${
        requestedUnit.value ? '' : ' Maydon operator bilan kelishiladi.'
      }`,
      type: 'Ijaraga olish',
      guest: true,
      contactName: contact,
    })

    if (!created) {
      failed.value = true
      return
    }

    createdCode.value = created.code
  }, 420)
}

/** Oyna yopilgach forma boshlang‘ich holatiga qaytadi */
watch(open, (isOpen) => {
  if (isOpen) return
  if (timer) clearTimeout(timer)
  amount.value = ''
  term.value = '12'
  org.value = ''
  person.value = ''
  phone.value = ''
  submitted.value = false
  pending.value = false
  failed.value = false
  createdCode.value = ''
  requestedUnit.value = ''
})
</script>

<template>
  <UiModal
    v-model="open"
    size="md"
    :title="createdCode ? t('apply.doneTitle') : t('apply.title')"
    :subtitle="createdCode ? '' : t('apply.subtitle')"
  >
    <!-- Natija: ariza raqami ekrandagi asosiy element -->
    <div v-if="createdCode">
      <div
        class="flex flex-col items-center rounded-panel bg-surface-sunken px-6 py-8 text-center ring-1 ring-inset ring-ink-200"
      >
        <span class="grid size-12 place-items-center rounded-full bg-ok-50 text-ok-700">
          <UiIcon name="check" :size="26" />
        </span>
        <p class="mt-4 text-[11.5px] font-bold uppercase tracking-[0.08em] text-ink-500">
          {{ t('apply.doneNumber') }}
        </p>
        <p
          class="tabular mt-1.5 text-[30px] font-extrabold leading-none tracking-[-0.01em] text-brand-600"
        >
          {{ createdCode }}
        </p>
        <p class="mt-4 max-w-[42ch] text-[13.5px] leading-relaxed text-ink-600">
          {{ t('apply.doneLead') }}
        </p>
      </div>

      <dl class="mt-5 space-y-3">
        <div class="flex gap-3">
          <dt class="shrink-0 pt-px text-ink-400">
            <UiIcon name="contract" :size="17" />
          </dt>
          <dd class="text-[13.5px] leading-relaxed text-ink-700">
            {{
              t('apply.doneSummary', {
                org: orgName,
                term: termValue,
                amount: num(amountValue),
              })
            }}
          </dd>
        </div>
        <div class="flex gap-3">
          <dt class="shrink-0 pt-px text-ink-400">
            <UiIcon name="phone" :size="17" />
          </dt>
          <dd class="text-[13.5px] leading-relaxed text-ink-700">
            {{ t('apply.doneNext', { phone: phone }) }}
          </dd>
        </div>
      </dl>
    </div>

    <!-- Forma -->
    <form v-else id="apply-form" novalidate @submit.prevent="submit">
      <div
        v-if="failed"
        role="alert"
        class="mb-5 flex gap-3 rounded-field bg-danger-50 p-3.5 ring-1 ring-inset ring-danger-100"
      >
        <UiIcon name="warning" :size="18" class="mt-px shrink-0 text-danger-600" />
        <p class="text-[13px] leading-relaxed text-ink-700">
          <span class="font-semibold text-danger-700">{{ t('apply.failTitle') }}</span>
          {{ t('apply.failText') }}
        </p>
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <UiField
          :label="t('apply.amountLabel')"
          required
          for="apply-amount"
          :error="errorOf('amount')"
          :hint="t('apply.amountUnit')"
        >
          <UiInput
            id="apply-amount"
            v-model="amount"
            inputmode="numeric"
            autocomplete="off"
            :placeholder="t('apply.amountPlaceholder')"
            :invalid="Boolean(errorOf('amount'))"
            class="tabular"
          />
        </UiField>

        <UiField :label="t('apply.termLabel')" required for="apply-term">
          <UiSelect id="apply-term" v-model="term" :options="TERM_OPTIONS" />
        </UiField>

        <UiField
          class="sm:col-span-2"
          :label="t('apply.orgLabel')"
          required
          for="apply-org"
          :error="errorOf('org')"
        >
          <UiInput
            id="apply-org"
            v-model="org"
            autocomplete="organization"
            :placeholder="t('apply.orgPlaceholder')"
            :invalid="Boolean(errorOf('org'))"
          />
        </UiField>

        <UiField
          :label="t('apply.personLabel')"
          required
          for="apply-person"
          :error="errorOf('person')"
        >
          <UiInput
            id="apply-person"
            v-model="person"
            autocomplete="name"
            :placeholder="t('apply.personPlaceholder')"
            :invalid="Boolean(errorOf('person'))"
          />
        </UiField>

        <UiField
          :label="t('apply.phoneLabel')"
          required
          for="apply-phone"
          :error="errorOf('phone')"
        >
          <UiInput
            id="apply-phone"
            v-model="phone"
            type="tel"
            inputmode="tel"
            autocomplete="tel"
            placeholder="+998 (__) ___ __ __"
            :invalid="Boolean(errorOf('phone'))"
            class="tabular"
          />
        </UiField>
      </div>

      <p
        class="mt-5 flex items-start gap-2.5 rounded-field bg-surface-sunken p-3.5 text-[12.5px] leading-relaxed text-ink-600 ring-1 ring-inset ring-ink-200"
      >
        <UiIcon name="info" :size="15" class="mt-px shrink-0 text-ink-400" />
        {{ t('apply.legalNote') }}
      </p>
    </form>

    <template #footer>
      <template v-if="createdCode">
        <UiButton variant="secondary" @click="open = false">{{ t('common.close') }}</UiButton>
        <UiButton :to="`/ariza/${createdCode}`" @click="open = false">
          {{ t('apply.doneTrack') }}
          <UiIcon name="arrowRight" :size="16" />
        </UiButton>
      </template>
      <template v-else>
        <UiButton variant="ghost" @click="open = false">{{ t('common.cancel') }}</UiButton>
        <UiButton type="submit" form="apply-form" :disabled="pending">
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
          {{ pending ? t('common.checking') : t('apply.submit') }}
        </UiButton>
      </template>
    </template>
  </UiModal>
</template>
