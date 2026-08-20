<script setup lang="ts">
import AppTopbar from '~/components/layout/AppTopbar.vue'
import { BUILDINGS } from '~/data/buildings'
import { CONTRACTS, type Contract } from '~/data/business'

import { dateShort, monthShift, num, todayIso } from '~/utils/format'

const auth = useAuthStore()
const { money, moneyShort,
  t,
  columns: labelColumns,
  sectionLabel,
  statusOptions: statusChoices,
  unitOf,
} = useAppLabels()

/** Reyestr faqat foydalanuvchi biriktirilgan obyektlar bilan cheklanadi */
const scopedBuildings = computed(() => BUILDINGS.filter((b) => auth.inScope(b.id)))

const contracts = ref<Contract[]>(
  CONTRACTS.filter((c) => auth.inScope(c.buildingId)).map((c) => ({ ...c })),
)

const search = ref('')
const type = ref('all')
const status = ref('all')
const building = ref('all')
const stage = ref('all')
const banner = ref('')

function isApproved(c: Contract) {
  return c.timeline.some((s) => s.label === 'Imzolandi' && s.done)
}

const STAGE_MATCH: Record<string, (c: Contract) => boolean> = {
  created: (c) => c.status === 'DRAFT',
  agreed: (c) => c.status === 'REVIEW',
  signed: (c) => isApproved(c),
  active: (c) => c.status === 'ACTIVE',
}

/**
 * Shartnoma turi ma’lumotda o‘zbekcha qiymat sifatida saqlanadi. Qiymat
 * o‘zgarmaydi (filtr va solishtirish ishlashda qoladi), faqat ko‘rinadigan
 * nom tanlangan tilga bog‘lanadi.
 */
const TYPE_KEY: Record<string, string> = {
  Ijara: 'ctr.typeRent',
  Sotuv: 'ctr.typeSale',
}

function typeLabel(value: string) {
  const key = TYPE_KEY[value]
  return key ? t(key) : value
}

const typeOptions = computed(() => [
  { value: 'all', label: t('ctr.typeFilter') },
  { value: 'Ijara', label: t('ctr.typeRent') },
  { value: 'Sotuv', label: t('ctr.typeSale') },
])

const statusOptions = computed(() => [
  { value: 'all', label: t('filter.allStatuses') },
  ...statusChoices('contract', Array.from(new Set(contracts.value.map((c) => c.status)))),
])

const buildingOptions = computed(() => [
  { value: 'all', label: t('filter.allBuildings') },
  ...scopedBuildings.value.map((b) => ({ value: b.name, label: b.name })),
])

const filtered = computed(() =>
  contracts.value.filter((c) => {
    const q = search.value.trim().toLowerCase()
    const byQuery =
      !q || `${c.code} ${c.tenant} ${c.buildingName} ${c.unitCode}`.toLowerCase().includes(q)
    const byType = type.value === 'all' || c.type === type.value
    const byStatus = status.value === 'all' || c.status === status.value
    const byBuilding = building.value === 'all' || c.buildingName === building.value
    const byStage = stage.value === 'all' || (STAGE_MATCH[stage.value]?.(c) ?? true)
    return byQuery && byType && byStatus && byBuilding && byStage
  }),
)

const columns = computed(() =>
  labelColumns([
    { key: 'code', labelKey: 'ctr.contractNo', label: 'Shartnoma №' },
    { key: 'type', field: 'type', label: 'Turi' },
    { key: 'tenant', field: 'legalTenant', label: 'Yuridik shaxs / Ijarachi' },
    { key: 'place', labelKey: 'ctr.objectUnit', label: 'Obyekt + Unit' },
    { key: 'startsAt', field: 'start', label: 'Boshlanish' },
    { key: 'endsAt', field: 'end', label: 'Tugash' },
    { key: 'amount', labelKey: 'ctr.amount', label: 'Miqdor', align: 'right', numeric: true },
    { key: 'status', field: 'status', label: 'Status' },
    { key: 'approval', field: 'approval', label: 'Tasdiqlash' },
  ]),
)

const rows = computed(() =>
  filtered.value.map((c) => {
    const approval = c.timeline.find((s) => s.label === 'Imzolandi')
    return {
      id: c.id,
      code: c.code,
      type: typeLabel(c.type),
      tenant: c.tenant,
      place: `${c.buildingName} · ${c.unitCode}`,
      startsAt: c.startsAt,
      endsAt: c.endsAt,
      amount: c.amount,
      status: c.status,
      approval: approval?.done ? approval.actor : '',
      approvalDate: approval?.done ? approval.date : '',
    }
  }),
)

function contractLink(row: Record<string, unknown>) {
  return `/contracts/${row.id}`
}

const totalValue = computed(() => filtered.value.reduce((s, c) => s + c.amount, 0))
const activeCount = computed(() => contracts.value.filter((c) => c.status === 'ACTIVE').length)
const reviewCount = computed(() =>
  contracts.value.filter((c) => c.status === 'REVIEW' || c.status === 'DRAFT').length,
)
const signedCount = computed(() => contracts.value.filter(isApproved).length)

function resetFilters() {
  search.value = ''
  type.value = 'all'
  status.value = 'all'
  building.value = 'all'
  stage.value = 'all'
}

const steps = computed(() =>
  [
    {
      key: 'created',
      label: t('ctr.step.created'),
      caption: t('ctr.stepCaption.created'),
      icon: 'clipboard',
    },
    {
      key: 'agreed',
      label: t('ctr.step.agreed'),
      caption: t('ctr.stepCaption.agreed'),
      icon: 'users',
    },
    {
      key: 'signed',
      label: t('ctr.step.signed'),
      caption: t('ctr.stepCaption.signed'),
      icon: 'edit',
    },
    {
      key: 'active',
      label: t('ctr.step.active'),
      caption: t('ctr.stepCaption.active'),
      icon: 'check',
    },
  ].map((s) => ({
    ...s,
    count: contracts.value.filter((c) => STAGE_MATCH[s.key]?.(c) ?? false).length,
  })),
)

function applyStep(key: string) {
  stage.value = stage.value === key ? 'all' : key
  status.value = 'all'
}

/*
 * Shartnoma qo'lda yaratilmaydi.
 *
 * Jarayon bitta: ijarachi ariza yuboradi, Operator bog'lanib shartlarni
 * kelishadi va tasdiqlaydi, shundan keyin tizim shartnomani o'zi tayyorlaydi
 * va Didox orqali imzoga yuboradi. Reyestrda qo'lda shartnoma ochish shu
 * zanjirni chetlab o'tar, natijada arizasiz, imzosiz va kabinetsiz shartnoma
 * paydo bo'lardi. Shuning uchun bu yerda yaratish emas, arizaga o'tish bor.
 */
</script>

<template>
  <AppTopbar
    :title="t('ctr.registryTitle')"
    :subtitle="t('ctr.registryCaption')"
    :breadcrumb="[{ label: sectionLabel('contracts') }]"
  >
    <template #actions>
      <UiButton variant="secondary" size="sm" to="/billing/invoices">
        <UiIcon name="wallet" :size="16" />
        {{ sectionLabel('billing') }}
      </UiButton>
      <UiButton size="sm" to="/applications">
        <UiIcon name="clipboard" :size="16" />
        {{ t('ctr.viaApplications') }}
      </UiButton>
    </template>
  </AppTopbar>

  <main class="scroll-slim flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
    <div
      v-if="banner"
      class="flex items-center gap-3 rounded-card bg-ok-50 px-4 py-3 ring-1 ring-ok-100"
    >
      <UiIcon name="check" :size="18" class="text-ok-600" />
      <p class="min-w-0 flex-1 text-[13px] font-medium text-ok-700">{{ banner }}</p>
      <button
        type="button"
        class="rounded-lg p-1 text-ok-700 transition-colors hover:bg-ok-100"
        :aria-label="t('common.closeMessage')"
        @click="banner = ''"
      >
        <UiIcon name="x" :size="16" />
      </button>
    </div>

    <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <UiKpi
        :label="t('kpi.totalContracts')"
        :value="num(contracts.length)"
        :unit="unitOf('pcs')"
        icon="contract"
        tone="brand"
      />
      <UiKpi
        :label="t('kpi.activeContracts')"
        :value="num(activeCount)"
        :unit="unitOf('pcs')"
        icon="check"
        tone="ok"
      />
      <UiKpi
        :label="t('kpi.inAgreement')"
        :value="num(reviewCount)"
        :unit="unitOf('pcs')"
        icon="clock"
        tone="warn"
      />
      <UiKpi
        :label="t('kpi.approvedContracts')"
        :value="num(signedCount)"
        :unit="unitOf('pcs')"
        icon="shield"
        tone="violet"
      />
    </section>

    <UiCard
      :title="t('ctr.registryTitle')"
      :subtitle="t('ctr.registryTotal', { value: moneyShort(totalValue) })"
      flush
      :padded="false"
    >
      <div class="flex flex-wrap items-center gap-3 px-5 pb-4">
        <UiInput
          v-model="search"
          :placeholder="t('ctr.searchPlaceholder')"
          class="min-w-[240px] flex-1"
        >
          <template #prefix>
            <UiIcon name="search" :size="18" />
          </template>
        </UiInput>
        <UiSelect v-model="type" :options="typeOptions" class="w-full sm:w-44" />
        <UiSelect v-model="status" :options="statusOptions" class="w-full sm:w-48" />
        <UiSelect v-model="building" :options="buildingOptions" class="w-full sm:w-56" />
        <UiButton variant="ghost" @click="resetFilters">
          <UiIcon name="refresh" :size="16" />
          {{ t('common.reset') }}
        </UiButton>
      </div>

      <UiTable
        :page-size="25"
        :columns="columns"
        :rows="rows"
        :to="contractLink"
        :empty="t('empty.noMatchingContracts')"
      >
        <template #cell-code="{ row }">
          <span class="font-semibold text-brand-600">{{ row.code }}</span>
        </template>
        <template #cell-tenant="{ row }">
          <span class="font-semibold text-ink-900">{{ row.tenant }}</span>
        </template>
        <template #cell-place="{ row }">
          <span class="text-[13px] text-ink-600">{{ row.place }}</span>
        </template>
        <template #cell-startsAt="{ row }">{{ dateShort(String(row.startsAt)) }}</template>
        <template #cell-endsAt="{ row }">{{ dateShort(String(row.endsAt)) }}</template>
        <template #cell-amount="{ row }">{{ money(Number(row.amount)) }}</template>
        <template #cell-status="{ row }">
          <UiStatus kind="contract" :value="String(row.status)" size="sm" />
        </template>
        <template #cell-approval="{ row }">
          <template v-if="row.approval">
            <span class="block text-[13px] font-semibold text-ink-900">{{ row.approval }}</span>
            <span class="tabular block text-[12px] text-ink-500">
              {{ dateShort(String(row.approvalDate)) }}
            </span>
          </template>
          <span v-else class="text-[13px] text-ink-500">{{ t('ctr.approvalPending') }}</span>
        </template>
      </UiTable>

      <div
        class="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 px-5 py-3.5"
      >
        <p class="text-[13px] text-ink-500">
          {{ t('common.total') }}:
          <b class="text-ink-800">{{ t('ctr.contractsCount', { n: rows.length }) }}</b>
          {{ t('ctr.contractsWord') }}
        </p>
        <p class="text-[13px] text-ink-500">
          {{ t('ctr.value') }}: <b class="tabular text-ink-800">{{ money(totalValue) }}</b>
        </p>
      </div>
    </UiCard>

    <UiCard :title="t('ctr.stagesTitle')" :subtitle="t('ctr.stagesCaption')">
      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div v-for="(s, i) in steps" :key="s.key" class="flex items-center gap-3">
          <button
            type="button"
            class="flex min-w-0 flex-1 items-center gap-3 rounded-field p-3 text-left ring-1 transition-colors"
            :class="
              stage === s.key
                ? 'bg-brand-50/70 ring-brand-300'
                : 'ring-ink-200 hover:bg-brand-50/40 hover:ring-brand-200'
            "
            :aria-pressed="stage === s.key"
            @click="applyStep(s.key)"
          >
            <span class="grid size-10 shrink-0 place-items-center rounded-full bg-ok-50 text-ok-600">
              <UiIcon :name="s.icon" :size="18" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-[14px] font-bold text-ink-900">{{ s.label }}</span>
              <span class="block truncate text-[12px] text-ink-500">{{ s.caption }}</span>
            </span>
            <span class="tabular shrink-0 text-[13px] font-bold text-ink-700">{{ s.count }}</span>
          </button>
          <UiIcon
            v-if="i < steps.length - 1"
            name="arrowRight"
            :size="18"
            class="hidden shrink-0 text-ink-300 xl:block"
          />
        </div>
      </div>
    </UiCard>

  </main>
</template>
