<script setup lang="ts">
import { CONTACT } from '~/constants/contacts'
import { area, dateShort, timeOf } from '~/utils/format'

definePageMeta({ layout: 'public', public: true })

const route = useRoute()
const lease = useLeaseStore()
const { t } = useI18n()
const { money, field, statusLabel: statusName } = useAppLabels()

lease.seed()

const code = computed(() => String(route.params.code ?? '').toUpperCase())
const item = computed(() => lease.byCode(code.value))

const digits = ref('')
const submitted = ref(false)
const opened = ref(false)
const pending = ref(false)

/** Telefon raqamining oxirgi to‘rt raqami */
const expected = computed(() => {
  const raw = (item.value?.org.phone ?? '').replace(/\D/g, '')
  return raw.slice(-4)
})

const mismatch = ref(false)

function onDigitsInput(event: Event) {
  const el = event.target as HTMLInputElement
  digits.value = el.value.replace(/\D/g, '').slice(0, 4)
  el.value = digits.value
  mismatch.value = false
}

let timer: ReturnType<typeof setTimeout> | null = null

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer)
})

function unlock() {
  submitted.value = true
  mismatch.value = false
  if (digits.value.length !== 4 || pending.value) return

  pending.value = true
  timer = setTimeout(() => {
    pending.value = false
    if (digits.value !== expected.value) {
      mismatch.value = true
      return
    }
    opened.value = true
  }, 420)
}

/** Har bir bosqich uchun ijarachiga tushunarli izoh */
const STAGE_HINT_KEY: Record<string, string> = {
  YANGI: 'apply.stageHint.YANGI',
  SHARTNOMA_TAYYOR: 'apply.stageHint.SHARTNOMA_TAYYOR',
  DIDOX_YUBORILDI: 'apply.stageHint.DIDOX_YUBORILDI',
  DIDOX_IMZOLANDI: 'apply.stageHint.DIDOX_IMZOLANDI',
  FAOL: 'apply.stageHint.FAOL',
  RAD_ETILDI: 'apply.stageHint.RAD_ETILDI',
}

const stageHint = computed(() => {
  const key = item.value ? STAGE_HINT_KEY[item.value.status] : undefined
  return key ? t(key) : ''
})

const statusLabel = computed(() => (item.value ? statusName('lease', item.value.status) : ''))

/**
 * So‘rov turi bazada o‘zbekcha qiymat sifatida saqlanadi, shuning uchun
 * ekranda ko‘rinadigan nom tarjima kaliti orqali olinadi.
 */
const REQUEST_TYPE_KEY: Record<string, string> = {
  'Ijaraga olish': 'common.requestTypeLease',
  'Sotib olish': 'landing.offerSale',
}

const requestTypeLabel = computed(() => {
  const value = item.value?.request.type ?? ''
  const key = REQUEST_TYPE_KEY[value]
  return key ? t(key) : value
})

const unitLine = computed(() => {
  const it = item.value
  if (!it) return ''
  return it.unitId
    ? t('apply.unitLine', { building: it.buildingName, code: it.unitCode, floor: it.floor })
    : t('apply.unitTbd')
})

const lastFourError = computed(() => {
  if (mismatch.value) return t('apply.lastFourMismatch')
  if (submitted.value && digits.value.length !== 4) return t('apply.lastFourRequired')
  return ''
})

const CONTACTS = computed(() => [
  { icon: 'phone', label: t('section.lease'), value: CONTACT.phone, href: CONTACT.phoneHref },
  { icon: 'send', label: t('common.email'), value: CONTACT.email, href: CONTACT.emailHref },
  { icon: 'clock', label: t('common.workHours'), value: CONTACT.hours, href: '' },
])
</script>

<template>
  <div class="mx-auto w-full max-w-[900px] px-4 py-8 lg:px-8 lg:py-12">
    <nav
      class="flex flex-wrap items-center gap-1.5 text-[13px] text-ink-500"
      :aria-label="t('common.breadcrumb')"
    >
      <NuxtLink to="/" class="rounded-[6px] hover:text-brand-600">{{ t('nav.cabinet') }}</NuxtLink>
      <span aria-hidden="true">/</span>
      <NuxtLink to="/ariza" class="rounded-[6px] hover:text-brand-600">
        {{ t('field.application') }}
      </NuxtLink>
      <span aria-hidden="true">/</span>
      <span class="tabular font-semibold text-ink-700">{{ code }}</span>
    </nav>

    <!-- Ariza topilmadi -->
    <div v-if="!item" class="mt-8">
      <UiCard>
        <div class="py-6 text-center">
          <span
            class="mx-auto grid size-14 place-items-center rounded-[16px] bg-danger-50 text-danger-600"
            aria-hidden="true"
          >
            <UiIcon name="warning" :size="26" />
          </span>
          <h1 class="mt-4 font-display text-[22px] font-extrabold text-ink-900">
            {{ t('apply.notFoundTitle') }}
          </h1>
          <i18n-t
            keypath="apply.notFoundText"
            tag="p"
            scope="global"
            class="mx-auto mt-2 max-w-[52ch] text-[14px] leading-relaxed text-ink-600"
          >
            <template #code>
              <span class="tabular font-semibold text-ink-900">{{ code }}</span>
            </template>
          </i18n-t>
          <div class="mt-5 flex flex-wrap justify-center gap-2.5">
            <UiButton to="/ariza">{{ t('apply.newApplication') }}</UiButton>
            <UiButton to="/catalog" variant="secondary">{{ t('public.navCatalog') }}</UiButton>
          </div>
        </div>
      </UiCard>
    </div>

    <!-- Telefon raqami bilan ochish -->
    <div v-else-if="!opened" class="mx-auto mt-8 max-w-[520px]">
      <UiCard>
        <span
          class="grid size-12 place-items-center rounded-[14px] bg-brand-50 text-brand-600"
          aria-hidden="true"
        >
          <UiIcon name="lock" :size="24" />
        </span>

        <h1 class="mt-4 font-display text-[22px] font-extrabold leading-tight text-ink-900">
          {{ t('tour.applications.openWatch.title') }}
        </h1>
        <i18n-t
          keypath="apply.unlockLead"
          tag="p"
          scope="global"
          class="mt-2 text-[14px] leading-relaxed text-ink-600"
        >
          <template #code>
            <span class="tabular font-semibold text-ink-900">{{ code }}</span>
          </template>
        </i18n-t>

        <form class="mt-5 space-y-4" novalidate @submit.prevent="unlock">
          <UiField
            :label="t('apply.lastFourField')"
            required
            for="last-four"
            :error="lastFourError"
          >
            <input
              id="last-four"
              type="text"
              inputmode="numeric"
              maxlength="4"
              autocomplete="off"
              placeholder="0000"
              :value="digits"
              :aria-invalid="mismatch || undefined"
              class="tabular h-12 w-full rounded-field bg-white px-3.5 text-center text-lg font-bold tracking-[0.3em] text-ink-900 ring-1 ring-inset transition-colors placeholder:font-normal placeholder:tracking-normal placeholder:text-ink-400 focus:ring-2 focus:ring-brand-500"
              :class="mismatch ? 'ring-danger-400' : 'ring-ink-200 hover:ring-ink-300'"
              @input="onDigitsInput"
            />
          </UiField>

          <UiButton type="submit" size="lg" block :loading="pending">
            {{ pending ? t('common.checking') : t('tour.applications.openWatch.title') }}
          </UiButton>
        </form>

        <p class="mt-4 flex items-start gap-2 text-[12px] leading-relaxed text-ink-500">
          <UiIcon name="shield" :size="14" class="mt-px shrink-0" />
          {{ t('apply.unlockPrivacy') }}
        </p>
      </UiCard>
    </div>

    <!-- Ariza holati -->
    <div v-else class="mt-6 space-y-5">
      <header>
        <p class="text-[11px] font-semibold uppercase tracking-wide text-brand-600">
          {{ t('apply.statusEyebrow') }}
        </p>
        <h1 class="tabular mt-2 font-display text-[28px] font-extrabold leading-tight text-ink-900">
          {{ item.code }}
        </h1>
        <p class="mt-1.5 text-[14px] text-ink-600">
          {{ unitLine }}
        </p>
      </header>

      <UiCard>
        <div class="flex flex-wrap items-center gap-2.5">
          <UiStatus kind="lease" :value="item.status" />
          <span class="rounded-pill bg-ink-100 px-2.5 py-1 text-[12px] font-semibold text-ink-700">
            {{ requestTypeLabel }}
          </span>
          <span class="tabular text-[13px] text-ink-500">
            {{ t('apply.submittedLabel') }} {{ dateShort(item.request.submittedAt) }}
            {{ timeOf(item.request.submittedAt) }}
          </span>
        </div>

        <div class="mt-5">
          <LeaseFlow :status="item.status" />
        </div>

        <p
          v-if="stageHint"
          class="mt-4 flex items-start gap-2 rounded-field bg-surface-sunken px-3.5 py-2.5 text-[13px] leading-relaxed text-ink-700 ring-1 ring-inset ring-ink-200"
        >
          <UiIcon name="info" :size="15" class="mt-px shrink-0 text-brand-600" />
          <span>
            <span class="font-semibold text-ink-900">{{ statusLabel }}.</span>
            {{ stageHint }}
          </span>
        </p>

        <p
          v-if="item.status === 'RAD_ETILDI' && item.rejectReason"
          class="mt-3 flex items-start gap-2 rounded-field bg-danger-50 px-3.5 py-2.5 text-[13px] leading-relaxed text-danger-700 ring-1 ring-inset ring-danger-100"
        >
          <UiIcon name="warning" :size="15" class="mt-px shrink-0" />
          {{ t('apply.rejectReasonLabel') }} {{ item.rejectReason }}
        </p>

        <p
          v-if="item.contactedAt"
          class="mt-3 flex items-center gap-2 text-[13px] font-medium text-ok-700"
        >
          <UiIcon name="check" :size="15" class="shrink-0" />
          {{ t('apply.contactedLabel') }} {{ dateShort(item.contactedAt) }}
          {{ timeOf(item.contactedAt) }}
        </p>
      </UiCard>

      <!--
        Kabinet o‘z-o‘zidan ochilmaydi. Login shartnoma imzolangandan keyin
        tizimda beriladi, parolni operator telefon orqali yetkazadi: ochiq
        sahifada parol ko‘rsatilmaydi.
      -->
      <UiCard v-if="item.access" tone="brand" icon="key" :title="t('apply.cabinetOpenedTitle')">
        <p class="text-[13px] leading-relaxed text-ink-700">
          {{ t('apply.cabinetOpenedText') }}
        </p>
        <dl class="mt-4 rounded-[12px] border border-brand-200 bg-white px-4 py-3">
          <div class="flex items-baseline justify-between gap-3">
            <dt class="text-[13px] text-ink-500">{{ field('login') }}</dt>
            <dd class="tabular text-[14px] font-bold text-ink-900">{{ item.access.login }}</dd>
          </div>
          <div class="mt-2 flex items-baseline justify-between gap-3">
            <dt class="text-[13px] text-ink-500">{{ t('login.passwordLabel') }}</dt>
            <dd class="text-[13px] font-medium text-ink-600">{{ t('apply.passwordByPhone') }}</dd>
          </div>
        </dl>
        <UiButton to="/login" size="lg" class="mt-4">
          <UiIcon name="key" :size="16" />
          {{ t('apply.enterCabinet') }}
        </UiButton>
      </UiCard>

      <div class="grid gap-5 lg:grid-cols-2">
        <UiCard :title="t('apply.yourTermsTitle')" icon="clipboard">
          <dl class="space-y-3">
            <div class="flex items-baseline justify-between gap-3">
              <dt class="text-[13px] text-ink-500">{{ t('apply.offerPriceMonthly') }}</dt>
              <dd class="tabular text-[14px] font-bold text-ink-900">
                {{ money(item.request.offerPrice) }}
              </dd>
            </div>
            <div class="flex items-baseline justify-between gap-3">
              <dt class="text-[13px] text-ink-500">{{ field('deadline') }}</dt>
              <dd class="tabular text-[14px] font-bold text-ink-900">
                {{ t('apply.termMonths', { count: item.request.term }) }}
              </dd>
            </div>
            <div class="flex items-baseline justify-between gap-3">
              <dt class="text-[13px] text-ink-500">{{ field('startDate') }}</dt>
              <dd class="tabular text-[14px] font-bold text-ink-900">
                {{ dateShort(item.request.startDate) }}
              </dd>
            </div>
            <div class="flex items-baseline justify-between gap-3">
              <dt class="text-[13px] text-ink-500">{{ field('area') }}</dt>
              <dd class="tabular text-[14px] font-bold text-ink-900">
                {{ item.unitId ? area(item.area) : t('apply.tbd') }}
              </dd>
            </div>
            <div v-if="item.request.note" class="border-t border-ink-100 pt-3">
              <dt class="text-[13px] text-ink-500">{{ t('apply.yourNote') }}</dt>
              <dd class="mt-1.5 rounded-field bg-surface-sunken p-3 text-[13px] leading-relaxed text-ink-700">
                {{ item.request.note }}
              </dd>
            </div>
          </dl>
        </UiCard>

        <UiCard :title="t('apply.contactTitle')" icon="headset" tone="teal">
          <ul class="space-y-2.5">
            <li v-for="c in CONTACTS" :key="c.label">
              <component
                :is="c.href ? 'a' : 'div'"
                :href="c.href || undefined"
                class="flex items-center gap-3 rounded-field px-1 py-1.5 transition-colors"
                :class="c.href ? 'hover:bg-surface-sunken' : ''"
              >
                <span
                  class="grid size-9 shrink-0 place-items-center rounded-[10px] bg-surface-sunken text-brand-600 ring-1 ring-ink-200"
                >
                  <UiIcon :name="c.icon" :size="16" />
                </span>
                <span class="min-w-0">
                  <span class="block text-[12px] text-ink-500">{{ c.label }}</span>
                  <span class="block break-words text-[13px] font-semibold text-ink-900">
                    {{ c.value }}
                  </span>
                </span>
              </component>
            </li>
          </ul>

          <p class="mt-3 text-[12px] leading-relaxed text-ink-500">
            {{ t('apply.mentionCode') }} {{ item.code }}.
          </p>
        </UiCard>
      </div>

      <div class="flex flex-wrap gap-2.5">
        <UiButton to="/catalog" variant="secondary">
          <UiIcon name="search" :size="16" />
          {{ t('apply.viewOtherUnits') }}
        </UiButton>
        <UiButton variant="ghost" @click="opened = false">
          <UiIcon name="lock" :size="16" />
          {{ t('apply.hideData') }}
        </UiButton>
      </div>
    </div>
  </div>
</template>
