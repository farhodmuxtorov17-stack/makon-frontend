<script setup lang="ts">
import { APPLICATION_QUEUE } from '~/constants/navigation'
import { LEASE_STATUS } from '~/constants/statuses'
import { scheduleTotals, type LeaseCase, type LeaseStatus } from '~/stores/lease'
import { area, dateShort, sum, timeOf } from '~/utils/format'

const auth = useAuthStore()
const lease = useLeaseStore()

lease.seed()

/** Qaror huquqi bo‘lmagan rol navbatni faqat kuzatadi */
const canDecide = computed(() => auth.can('application.decide'))

/** «Mening vazifalarim» va yon menyudagi son bitta ro‘yxatdan o‘qiladi */
const myStatuses = computed<LeaseStatus[]>(() => {
  if (!canDecide.value || !auth.role) return []
  return APPLICATION_QUEUE[auth.role] ?? []
})

/**
 * Biriktirilgan binodan tashqaridagi ariza na ro‘yxatga, na sanoqqa kiradi.
 * Maydoni hali belgilanmagan ariza esa hech bir binoga tegishli emas: uni
 * operator qo‘ng‘iroqda aniqlaydi, shuning uchun u navbatda ko‘rinadi.
 */
const rows = computed(() =>
  lease.cases.filter((c) => !c.buildingId || auth.inScope(c.buildingId)),
)

const mineRows = computed(() => rows.value.filter((c) => myStatuses.value.includes(c.status)))

const scopeTab = ref(canDecide.value ? 'mine' : 'all')
const statusFilter = ref('all')
const buildingFilter = ref('')
const search = ref('')

const scopeTabs = computed(() => [
  ...(canDecide.value
    ? [{ value: 'mine', label: 'Mening vazifalarim', count: mineRows.value.length }]
    : []),
  { value: 'all', label: 'Barcha arizalar', count: rows.value.length },
])

const scoped = computed(() => (scopeTab.value === 'mine' ? mineRows.value : rows.value))

const PENDING: LeaseStatus[] = [
  'YANGI',
  'SHARTNOMA_TAYYOR',
  'DIDOX_YUBORILDI',
  'DIDOX_IMZOLANDI',
]

const statusChips = computed(() => [
  { value: 'all', label: 'Barchasi', count: scoped.value.length },
  {
    value: 'pending',
    label: 'Jarayonda',
    count: scoped.value.filter((c) => PENDING.includes(c.status)).length,
  },
  {
    value: 'closed',
    label: 'Yopilgan',
    count: scoped.value.filter((c) => c.status === 'FAOL').length,
  },
  {
    value: 'rejected',
    label: 'Rad etilgan',
    count: scoped.value.filter((c) => c.status === 'RAD_ETILDI').length,
  },
])

const buildingOptions = computed(() => [
  { value: '', label: 'Barcha obyektlar' },
  ...[...new Set(rows.value.map((c) => c.buildingName).filter(Boolean))].map((n) => ({
    value: n,
    label: n,
  })),
])

const filtered = computed(() =>
  scoped.value.filter((c) => {
    if (buildingFilter.value && c.buildingName !== buildingFilter.value) return false
    if (statusFilter.value === 'pending' && !PENDING.includes(c.status)) return false
    if (statusFilter.value === 'closed' && c.status !== 'FAOL') return false
    if (statusFilter.value === 'rejected' && c.status !== 'RAD_ETILDI') return false

    const q = search.value.trim().toLowerCase()
    if (!q) return true
    return [c.code, c.org.name, c.unitCode, c.buildingName].some((v) =>
      v.toLowerCase().includes(q),
    )
  }),
)

/** Bosqich shu rol qaroriga bog‘liqmi, navbatda ajratib ko‘rsatiladi */
function isMine(c: LeaseCase) {
  return myStatuses.value.includes(c.status)
}

/** Maydon hali kelishilmagan ariza */
function needsUnit(c: LeaseCase) {
  return !c.unitId
}

function amount(c: LeaseCase) {
  if (c.schedule.length) return sum(scheduleTotals(c.schedule).total)
  return `${sum(c.request.offerPrice)} / oy`
}

const NEXT_STEP: Record<string, string> = {
  YANGI: 'Operator bog‘lanadi, shartlarni kelishadi va arizani tasdiqlaydi',
  MAYDON: 'Operator qo‘ng‘iroq qilib maydonni kelishadi va belgilaydi',
  SHARTNOMA_TAYYOR: 'Operator shartnomani tahrirlaydi va Didox orqali yuboradi',
  DIDOX_YUBORILDI: 'Operator Didoxdagi holatni tekshiradi',
  DIDOX_IMZOLANDI: 'Imzolangan nusxa yuklanadi va ariza yopiladi',
  FAOL: 'Ariza yopilgan, shartnoma amalda',
  RAD_ETILDI: 'Sikl to‘xtatilgan',
}
</script>

<template>
  <AppTopbar
    title="Arizalar navbati"
    subtitle="Ijara sikli: arizadan yopilgan arizagacha"
  >
    <template #actions>
      <UiButton variant="secondary" size="sm" to="/contracts">
        <UiIcon name="contract" :size="16" />
        Shartnomalar
      </UiButton>
    </template>
  </AppTopbar>

  <main class="scroll-slim flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
    <p
      v-if="!canDecide"
      class="flex items-start gap-3 rounded-card bg-ink-50 px-4 py-3 text-[13px] leading-relaxed text-ink-600 ring-1 ring-inset ring-ink-200"
    >
      <UiIcon name="eye" :size="17" class="mt-0.5 shrink-0 text-ink-500" />
      <span>
        Kuzatuv rejimi: ariza bo‘yicha qaror operatorda, bu sahifada yozuvlar faqat
        kuzatiladi.
      </span>
    </p>

    <div class="flex flex-wrap items-center justify-between gap-3">
      <UiTabs v-model="scopeTab" :tabs="scopeTabs" />

      <div class="flex flex-wrap items-center gap-2.5">
        <UiInput v-model="search" placeholder="Ariza, tashkilot yoki unit" class="w-full sm:w-64">
          <template #prefix><UiIcon name="search" :size="17" /></template>
        </UiInput>
        <UiSelect v-model="buildingFilter" :options="buildingOptions" size="sm" class="w-full sm:w-48" />
      </div>
    </div>

    <div class="flex flex-wrap gap-2">
      <button
        v-for="c in statusChips"
        :key="c.value"
        type="button"
        class="inline-flex min-h-10 items-center gap-2 rounded-pill px-3.5 text-[13px] font-semibold ring-1 ring-inset transition-colors duration-150"
        :class="
          statusFilter === c.value
            ? 'bg-brand-500 text-white ring-brand-500'
            : 'bg-surface text-ink-600 ring-ink-200 hover:bg-ink-50'
        "
        :aria-pressed="statusFilter === c.value"
        @click="statusFilter = c.value"
      >
        {{ c.label }}
        <span
          class="tabular rounded-pill px-1.5 text-[11px] font-bold"
          :class="statusFilter === c.value ? 'bg-white/25' : 'bg-ink-100 text-ink-600'"
        >
          {{ c.count }}
        </span>
      </button>
    </div>

    <div v-if="filtered.length" class="grid gap-4 2xl:grid-cols-2">
      <UiCard v-for="c in filtered" :key="c.id">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <NuxtLink
                :to="`/applications/${c.id}`"
                class="rounded-[6px] text-[16px] font-bold text-ink-900 transition-colors hover:text-brand-600"
              >
                {{ c.code }}
              </NuxtLink>
              <span
                v-if="needsUnit(c) && c.status === 'YANGI'"
                class="inline-flex items-center gap-1 rounded-pill bg-warn-50 px-2 py-0.5 text-[11px] font-bold text-warn-700 ring-1 ring-inset ring-warn-100"
              >
                <UiIcon name="info" :size="12" />
                Maydon Operator bilan kelishiladi
              </span>
              <span
                v-if="isMine(c) && c.status !== 'FAOL' && c.status !== 'RAD_ETILDI'"
                class="inline-flex items-center gap-1 rounded-pill bg-danger-50 px-2 py-0.5 text-[11px] font-bold text-danger-600 ring-1 ring-inset ring-danger-100"
              >
                <span class="size-1.5 rounded-full bg-danger-500" aria-hidden="true" />
                Sizning qaroringiz
              </span>
            </div>
            <p class="mt-0.5 truncate text-[13px] text-ink-600">{{ c.org.name }}</p>
          </div>
          <UiStatus kind="lease" :value="c.status" />
        </div>

        <dl class="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          <div class="min-w-0">
            <dt class="text-[12px] text-ink-500">Obyekt</dt>
            <dd class="mt-0.5 truncate text-[13px] font-semibold text-ink-800">
              {{ needsUnit(c) ? 'Kelishilmagan' : c.buildingName }}
            </dd>
          </div>
          <div class="min-w-0">
            <dt class="text-[12px] text-ink-500">Unit</dt>
            <dd class="tabular mt-0.5 truncate text-[13px] font-semibold text-ink-800">
              {{ needsUnit(c) ? 'Belgilanmagan' : `${c.unitCode} · ${area(c.area)}` }}
            </dd>
          </div>
          <div class="min-w-0">
            <dt class="text-[12px] text-ink-500">Muddat</dt>
            <dd class="tabular mt-0.5 text-[13px] font-semibold text-ink-800">
              {{ c.request.term }} oy
            </dd>
          </div>
          <div class="min-w-0">
            <dt class="text-[12px] text-ink-500">Summa</dt>
            <dd class="tabular mt-0.5 truncate text-[13px] font-semibold text-ink-900">
              {{ amount(c) }}
            </dd>
          </div>
        </dl>

        <div class="mt-4">
          <LeaseFlow :status="c.status" />
        </div>

        <div class="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-4">
          <span class="min-w-0 text-[12px] text-ink-500">
            <span class="tabular">
              {{ dateShort(c.request.submittedAt) }} {{ timeOf(c.request.submittedAt) }}
            </span>
            · {{ (needsUnit(c) ? NEXT_STEP.MAYDON : NEXT_STEP[c.status]) ?? LEASE_STATUS[c.status]?.label }}
          </span>

          <UiButton
            :variant="isMine(c) ? 'primary' : 'secondary'"
            size="sm"
            :to="`/applications/${c.id}`"
          >
            <UiIcon :name="isMine(c) ? 'arrowRight' : 'eye'" :size="15" />
            {{ isMine(c) ? 'Ko‘rib chiqish' : 'Ko‘rish' }}
          </UiButton>
        </div>
      </UiCard>
    </div>

    <UiCard v-else>
      <UiEmpty
        icon="clipboard"
        title="Ariza topilmadi"
        :description="
          rows.length
            ? 'Tanlangan filtrlar bo‘yicha yozuv yo‘q. Shartlarni kengaytiring yoki barcha arizalarni oching.'
            : 'Sizga biriktirilgan obyektlar bo‘yicha ariza yozuvi yo‘q.'
        "
        :action-label="rows.length ? 'Barcha arizalar' : ''"
        @action="
          () => {
            scopeTab = 'all'
            statusFilter = 'all'
            buildingFilter = ''
            search = ''
          }
        "
      />
    </UiCard>
  </main>
</template>
