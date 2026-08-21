<script setup lang="ts">
import { buildingById } from '~/data/buildings'
import { UNITS, unitById } from '~/data/units'
import { area, num } from '~/utils/format'

const auth = useAuthStore()
const lease = useLeaseStore()
const route = useRoute()
const { t } = useI18n()
const { unitUsageLabel, money, field, floorLabel, priceUnitLabel } = useAppLabels()

lease.seed()

/*
 * Ariza faqat ijara bo'yicha yuboriladi.
 *
 * Sotuvdagi maydon bo'yicha oldi-sotdi shartnomasi tizim ichida tuzilmaydi:
 * ariza kartochkasida tasdiqlash tugmasi chiqmaydi va yozuv «Yangi ariza»
 * bosqichida abadiy qotib qolardi. Shuning uchun bunday unit mijozga
 * ko'rsatiladigan ro'yxatga umuman tushmaydi, u Operator bilan telefon
 * orqali rasmiylashtiriladi.
 */
const vacantUnits = computed(() =>
  UNITS.filter((u) => u.status === 'VACANT' && u.offer !== 'Sotuv'),
)

const unitOptions = computed(() =>
  vacantUnits.value.map((u) => ({
    value: u.id,
    label: `${buildingById(u.buildingId)?.name ?? ''} · Unit ${u.code} · ${area(u.area)}`,
  })),
)

/**
 * Kabinetdan faqat ijara arizasi yuboriladi: sotuv oqimi (bir martalik to‘lov,
 * SOLD holati va sotuv shartnomasi) tizimda hali mavjud emas, shuning uchun
 * formada ham taklif qilinmaydi.
 */
const REQUEST_TYPE = 'Ijaraga olish' as const

const form = reactive({
  unitId: '',
  price: '',
  startDate: '',
  term: '24',
  note: '',
})

const errors = reactive({ unitId: '', price: '', startDate: '' })

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
  if (found) form.price = String(monthlyPrice(found))
})

/**
 * Ayrim unitlar m² narxi bilan e’lon qilinadi, taklif narxi maydoni esa oylik
 * summani kutadi. Shuning uchun m² narxi unit maydoniga ko‘paytiriladi.
 */
function monthlyPrice(u: { price: number; area: number; priceUnit: string }) {
  return u.priceUnit === 'so‘m / m²' ? Math.round(u.price * u.area) : u.price
}

watch(
  () => form.unitId,
  (id) => {
    const u = vacantUnits.value.find((x) => x.id === id)
    if (u) form.price = String(monthlyPrice(u))
  },
)

const organization = computed(() => ({
  name: auth.user?.organization ?? '',
  tin: auth.user?.tin ?? '',
  director: auth.user?.fullName ?? '',
  phone: auth.user?.phone ?? '',
  email: auth.user?.email ?? '',
  address: auth.user?.address ?? '',
}))

const orgRows = computed(() => [
  { label: t('apply.orgLabel'), value: organization.value.name, icon: 'building' },
  { label: 'STIR', value: organization.value.tin, icon: 'clipboard' },
  { label: t('cab.representative'), value: organization.value.director, icon: 'user' },
  { label: t('common.phone'), value: organization.value.phone, icon: 'phone' },
  { label: t('common.email'), value: organization.value.email, icon: 'send' },
  { label: field('legalAddress'), value: organization.value.address, icon: 'location' },
])

const TERM_OPTIONS = computed(() =>
  ['12', '24', '36', '60'].map((value) => ({
    value,
    label: t('apply.termMonths', { count: value }),
  })),
)

const term = computed(() => Number(form.term) || 12)
const price = computed(() => Number(form.price) || 0)
const estimate = computed(() => price.value * term.value)

const pending = ref(false)

function submit() {
  errors.unitId = form.unitId ? '' : t('cab.selectVacantUnitError')
  errors.price = price.value > 0 ? '' : t('cab.offerPriceError')
  errors.startDate = form.startDate ? '' : t('cab.startDateError')
  if (errors.unitId || errors.price || errors.startDate) return

  pending.value = true
  const created = lease.createCase({
    unitId: form.unitId,
    org: { ...organization.value },
    offerPrice: price.value,
    startDate: form.startDate,
    term: term.value,
    note: form.note.trim(),
    type: REQUEST_TYPE,
  })
  pending.value = false

  if (created) navigateTo(`/cabinet/applications?yangi=${created.id}`)
}
</script>

<template>
  <AppTopbar
    :title="t('cab.applyForRent')"
    :subtitle="t('cab.applyCaption')"
    :breadcrumb="[
      { label: t('cab.title'), to: '/cabinet' },
      { label: t('nav.myApplications'), to: '/cabinet/applications' },
      { label: t('cab.newApplication') },
    ]"
  >
    <template #actions>
      <UiButton variant="secondary" size="sm" to="/cabinet/applications">
        <UiIcon name="chevronLeft" :size="16" />
        {{ t('common.back') }}
      </UiButton>
    </template>
  </AppTopbar>

  <main class="scroll-slim flex-1 overflow-y-auto p-4 sm:p-6">
    <div class="mx-auto grid max-w-[1000px] gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div class="min-w-0 space-y-5">
        <UiCard
          :title="t('tour.application.data.title')"
          :subtitle="t('cab.applyTermsCaption')"
          icon="clipboard"
        >
          <form class="space-y-4" novalidate @submit.prevent="submit">
            <UiField :label="field('vacantUnit')" required :error="errors.unitId">
              <UiSelect
                v-model="form.unitId"
                :options="unitOptions"
                :placeholder="t('cab.selectUnitPlaceholder')"
                :invalid="!!errors.unitId"
              />
            </UiField>

            <div
              v-if="unit && building"
              class="flex flex-wrap items-center justify-between gap-3 rounded-field bg-surface-sunken px-4 py-3 ring-1 ring-inset ring-ink-200"
            >
              <span class="min-w-0 text-[13px] text-ink-600">
                {{ building.name }} · {{ unitUsageLabel(unit.usage) }} · {{ floorLabel(unit.floor) }} ·
                {{ t('cab.roomsCount', { n: unit.rooms }) }} · {{ area(unit.area) }}
              </span>
              <span class="tabular shrink-0 text-[13px] font-bold text-brand-700">
                {{ num(unit.price) }} {{ priceUnitLabel(unit.priceUnit) }}
              </span>
            </div>

            <div class="grid gap-4 sm:grid-cols-2">
              <UiField
                :label="field('offerPrice')"
                required
                :error="errors.price"
                :hint="t('cab.monthlyAmountHint')"
              >
                <UiInput
                  v-model="form.price"
                  type="number"
                  min="0"
                  placeholder="0"
                  :invalid="!!errors.price"
                >
                  <template #suffix>
                    <span class="text-[12px]">{{ t('unitOf.currency') }}</span>
                  </template>
                </UiInput>
              </UiField>
              <UiField :label="field('deadline')" required>
                <UiSelect v-model="form.term" :options="TERM_OPTIONS" />
              </UiField>
            </div>

            <UiField :label="field('startDate')" required :error="errors.startDate">
              <UiInput v-model="form.startDate" type="date" :invalid="!!errors.startDate" />
            </UiField>

            <UiField :label="field('additionalNote')" :hint="t('cab.applyNoteHint')">
              <textarea
                v-model="form.note"
                rows="4"
                class="w-full rounded-field bg-white px-3.5 py-2.5 text-sm text-ink-800 ring-1 ring-inset ring-ink-200 transition-colors placeholder:text-ink-400 hover:ring-ink-300 focus:ring-2 focus:ring-brand-500"
                :placeholder="t('cab.applyNotePlaceholder')"
              />
            </UiField>

            <div class="flex flex-wrap items-center justify-end gap-3 border-t border-ink-100 pt-4">
              <UiButton variant="ghost" to="/cabinet/applications">
                {{ t('common.cancel') }}
              </UiButton>
              <UiButton type="submit" :disabled="pending">
                <UiIcon name="send" :size="16" />
                {{ t('apply.submit') }}
              </UiButton>
            </div>
          </form>
        </UiCard>
      </div>

      <div class="min-w-0 space-y-5">
        <UiCard
          :title="t('cab.orgDataTitle')"
          :subtitle="t('cab.orgDataCaption')"
          icon="shield"
          tone="teal"
        >
          <template #actions>
            <UiButton variant="ghost" size="sm" to="/profile">
              <UiIcon name="edit" :size="16" />
              {{ t('cab.editInProfile') }}
            </UiButton>
          </template>

          <dl class="space-y-2.5">
            <div
              v-for="r in orgRows"
              :key="r.label"
              class="rounded-field bg-surface-sunken px-3.5 py-2.5 ring-1 ring-inset ring-ink-200"
            >
              <!-- Ikonka `dt` ichida: `dl > div` faqat `dt`/`dd` ni saqlaydi -->
              <dt
                class="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wide text-ink-500"
              >
                <span
                  class="grid size-8 shrink-0 place-items-center rounded-field bg-white text-brand-600 ring-1 ring-ink-200"
                >
                  <UiIcon :name="r.icon" :size="16" />
                </span>
                {{ r.label }}
              </dt>
              <dd class="tabular mt-0.5 break-words pl-11 text-[13px] font-semibold text-ink-900">
                {{ r.value || '-' }}
              </dd>
            </div>
          </dl>

          <p class="mt-3 flex items-start gap-2 text-[12px] leading-relaxed text-ink-500">
            <UiIcon name="lock" :size="14" class="mt-px shrink-0" />
            {{ t('cab.readOnlyFieldsHint') }}
          </p>
        </UiCard>

        <UiCard
          v-if="price > 0"
          :title="t('cab.preliminaryCalc')"
          :subtitle="t('cab.finalTermsAfterReview')"
          icon="chart"
          tone="brand"
        >
          <dl class="space-y-3">
            <div class="flex items-baseline justify-between gap-3">
              <dt class="text-[13px] text-ink-500">{{ field('applicationType') }}</dt>
              <dd class="text-[14px] font-bold text-ink-900">
                {{ t('common.requestTypeLease') }}
              </dd>
            </div>
            <div class="flex items-baseline justify-between gap-3">
              <dt class="text-[13px] text-ink-500">{{ field('offerPriceMonthly') }}</dt>
              <dd class="tabular text-[14px] font-bold text-ink-900">{{ money(price) }}</dd>
            </div>
            <div class="flex items-baseline justify-between gap-3">
              <dt class="text-[13px] text-ink-500">{{ field('deadline') }}</dt>
              <dd class="tabular text-[14px] font-bold text-ink-900">
                {{ t('apply.termMonths', { count: term }) }}
              </dd>
            </div>
            <div class="flex items-baseline justify-between gap-3 border-t border-ink-100 pt-3">
              <dt class="text-[13px] text-ink-500">{{ t('cab.totalForTerm') }}</dt>
              <dd class="tabular text-[16px] font-extrabold text-brand-700">{{ money(estimate) }}</dd>
            </div>
          </dl>
        </UiCard>
      </div>
    </div>
  </main>
</template>
