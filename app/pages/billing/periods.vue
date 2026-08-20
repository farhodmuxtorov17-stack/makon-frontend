<script setup lang="ts">
import AppTopbar from '~/components/layout/AppTopbar.vue'
import {
  CONTRACTS,
  INVOICES,
  agingKeyOf,
  billingSummaryOf,
  statusOf,
  tariffLinesFor,
  type Contract,
  type Invoice,
} from '~/data/business'
import { METERS } from '~/data/operations'
import { UNITS, type Unit } from '~/data/units'
import { TONE_BADGE } from '~/constants/statuses'
import { num, percent, todayIso } from '~/utils/format'

/**
 * Hisob-faktura chiqarish va davrni yopish moliyaviy amal. Bo'limni ko'rish
 * huquqi buni bermaydi: super rahbar sahifani ochadi, lekin amalni buxgalter
 * bajaradi. Ilgari tugmalar hammaga ko'rinardi va bosilganda hech nima
 * bo'lmasdi.
 */
const auth = useAuthStore()
const canIssue = computed(() => auth.can('invoice.create'))

const { money, moneyShort, field, moduleCaption, moduleTitle, monthName, sectionLabel } =
  useAppLabels()
const { t } = useI18n()

const MONTHS = [
  'Yanvar',
  'Fevral',
  'Mart',
  'Aprel',
  'May',
  'Iyun',
  'Iyul',
  'Avgust',
  'Sentabr',
  'Oktabr',
  'Noyabr',
  'Dekabr',
]

/**
 * Davr kaliti «2026-08» ko‘rinishida: shu ko‘rinishda u ham xronologik
 * saralanadi, ham hisob-faktura sanalari bilan to‘g‘ridan-to‘g‘ri
 * solishtiriladi. Ekranda ko‘rinadigan yorliq esa «Avgust 2026»: aynan shu
 * matn hisob-faktura yozuvidagi `period` maydonida turadi.
 */
function labelOfKey(key: string): string {
  const [year, month] = key.split('-')
  return `${MONTHS[Number(month) - 1] ?? month} ${year}`
}

function keyOfLabel(label: string): string {
  const [month, year] = label.split(' ')
  const index = MONTHS.indexOf(month ?? '')
  return index < 0 || !year ? '' : `${year}-${String(index + 1).padStart(2, '0')}`
}

function startOfKey(key: string): string {
  return `${key}-01`
}

function endOfKey(key: string): string {
  const [year, month] = key.split('-').map(Number)
  const last = new Date(year!, month!, 0).getDate()
  return `${key}-${String(last).padStart(2, '0')}`
}

function shiftKey(key: string, months: number): string {
  const [year, month] = key.split('-').map(Number)
  const d = new Date(year!, month! - 1 + months, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** `from` dan `to` gacha bo‘lgan barcha oylar, ikkalasi ham ro‘yxatga kiradi */
function rangeKeys(from: string, to: string): string[] {
  const keys: string[] = []
  let cursor = from
  while (cursor <= to && keys.length < 240) {
    keys.push(cursor)
    cursor = shiftKey(cursor, 1)
  }
  return keys
}

const TODAY = todayIso()
const CURRENT_KEY = TODAY.slice(0, 7)

/**
 * Qo‘lda ochilgan davrlar va qo‘lda yopilgani sahifadan chiqilganda ham
 * saqlanadi: hisob-faktura ekrani ham shu ro‘yxatni o‘qiydi va yopilgan
 * davrga yangi hujjat qo‘shishni taklif qilmaydi.
 */
const extraKeys = useState<string[]>('billing-extra-periods', () => [])
const closedKeys = useState<string[]>('billing-closed-periods', () => [])

/** O‘tgan oylar yakunlangan hisoblanadi, joriy davr esa qo‘lda yopiladi */
function isClosed(key: string): boolean {
  return key < CURRENT_KEY || closedKeys.value.includes(key)
}

const banner = ref('')
const stateFilter = ref('all')

const periodKeys = computed(() => {
  const keys = new Set<string>()
  for (const i of INVOICES) {
    const key = keyOfLabel(i.period)
    if (key) keys.add(key)
  }
  const earliest = [...keys].sort()[0]
  for (const key of rangeKeys(earliest && earliest < CURRENT_KEY ? earliest : CURRENT_KEY, CURRENT_KEY)) {
    keys.add(key)
  }
  for (const key of extraKeys.value) keys.add(key)
  return [...keys].sort()
})

const bounds = computed(
  () => new Map(periodKeys.value.map((key) => [key, [startOfKey(key), endOfKey(key)] as const])),
)

/**
 * Davr bo‘yicha hisob-faktura chiqariladigan shartnomalar: faqat faol ijara
 * shartnomalari, ya’ni davr ichida amalda bo‘lganlari. Sotuv shartnomasi bir
 * martalik to‘lov bo‘lgani uchun oylik hisob-fakturaga tushmaydi.
 */
const billableByKey = computed(() => {
  const map = new Map<string, Contract[]>()
  for (const key of periodKeys.value) map.set(key, [])
  for (const c of CONTRACTS) {
    if (c.status !== 'ACTIVE' || c.type !== 'Ijara') continue
    for (const [key, [from, to]] of bounds.value) {
      if (c.startsAt > to) continue
      if (c.endsAt !== '-' && c.endsAt < from) continue
      map.get(key)!.push(c)
    }
  }
  return map
})

/** Reyestrdagi hujjatlar aynan o‘z davri bo‘yicha guruhlanadi */
const invoicesByKey = computed(() => {
  const map = new Map<string, Invoice[]>()
  for (const key of periodKeys.value) map.set(key, [])
  for (const i of INVOICES) map.get(keyOfLabel(i.period))?.push(i)
  return map
})

interface PeriodRow {
  id: string
  key: string
  label: string
  contracts: number
  invoices: number
  pending: number
  total: number
  closed: boolean
}

/**
 * Davr ko‘rsatkichlari o‘ylab topilgan koeffitsientdan emas, reyestrdan
 * hisoblanadi: jami summaga faqat shu davr hujjatlari kiradi.
 */
const periods = computed<PeriodRow[]>(() =>
  periodKeys.value.map((key) => {
    const list = invoicesByKey.value.get(key) ?? []
    const contracts = billableByKey.value.get(key) ?? []
    const covered = new Set(list.map((i) => i.contractCode))
    return {
      id: `p-${key}`,
      key,
      label: labelOfKey(key),
      contracts: contracts.length,
      invoices: list.length,
      pending: contracts.filter((c) => !covered.has(c.code)).length,
      total: billingSummaryOf(list).charged,
      closed: isClosed(key),
    }
  }),
)

const stateTabs = computed(() => [
  { value: 'all', label: t('tab.all'), count: periods.value.length },
  { value: 'open', label: t('tab.open'), count: periods.value.filter((p) => !p.closed).length },
  { value: 'closed', label: t('tab.closed'), count: periods.value.filter((p) => p.closed).length },
])

/** Jadvalda eng yangi davr yuqorida turadi */
const filtered = computed(() =>
  [...periods.value]
    .reverse()
    .filter((p) =>
      stateFilter.value === 'all' ? true : stateFilter.value === 'open' ? !p.closed : p.closed,
    ),
)

const columns = computed(() => [
  { key: 'label', label: field('period', 'Davr') },
  {
    key: 'contracts',
    label: field('contractCount', 'Shartnomalar soni'),
    align: 'right' as const,
    numeric: true,
  },
  {
    key: 'invoices',
    label: field('invoiceCount', 'Hisob-faktura soni'),
    align: 'right' as const,
    numeric: true,
  },
  { key: 'total', label: field('totalAmount', 'Jami summa'), align: 'right' as const, numeric: true },
  { key: 'state', label: field('status', 'Holat') },
  { key: 'actions', label: field('actions', 'Amallar'), align: 'right' as const },
])

const rows = computed(() =>
  filtered.value.map((p) => ({
    id: p.id,
    key: p.key,
    label: p.label,
    contracts: p.contracts,
    invoices: p.invoices,
    total: p.total,
    closed: p.closed,
  })),
)

const totalCharged = computed(() => periods.value.reduce((s, p) => s + p.total, 0))
const openCount = computed(() => periods.value.filter((p) => !p.closed).length)
const closedCount = computed(() => periods.value.filter((p) => p.closed).length)
const generatedCount = computed(() => periods.value.reduce((s, p) => s + p.invoices, 0))

/** Diagrammada oxirgi 12 davr: undan uzunda ustunlar o‘qilmay qoladi */
const chartPeriods = computed(() => periods.value.slice(-12))
const chartLabels = computed(() =>
  chartPeriods.value.map((p) => monthName(Number(p.key.slice(5)))),
)
const chartSeries = computed(() => [
  {
    label: t('bil.chargedAmount'),
    tone: 'brand' as const,
    values: chartPeriods.value.map((p) => Math.round(p.total / 1_000_000)),
  },
])

// --- Hisob-faktura shakllantirish ------------------------------------------

/** Shartnoma kodi bo‘yicha unit: maydon va bino hisob-fakturaga shundan tushadi */
const unitByContract = computed(() => {
  const map = new Map<string, Unit>()
  for (const u of UNITS) if (u.contractCode) map.set(u.contractCode, u)
  return map
})

/** Binodagi umumiy maydon: hisoblagich sarfi shu ulushda taqsimlanadi */
const areaByBuilding = computed(() => {
  const map = new Map<string, number>()
  for (const u of UNITS) map.set(u.buildingId, (map.get(u.buildingId) ?? 0) + u.area)
  return map
})

/**
 * Hisob-faktura summasi: oylik ijara haqi va kommunal qatorlar. Kommunal
 * qatorlarni `tariffLinesFor()` hisoblagich ko‘rsatkichidan hisoblaydi, lekin
 * hisoblagich butun binoni o‘lchaydi, shuning uchun uning sarfi unit
 * maydonining binodagi ulushiga qarab bo‘linadi. Maydonga bog‘liq xizmatlar
 * (boshqaruv, tozalash) esa to‘g‘ridan-to‘g‘ri unit maydoniga tegishli.
 */
function invoiceTotalOf(contract: Contract): number {
  const rent = Math.round(contract.amount / 12)
  const unit = unitByContract.value.get(contract.code)
  if (!unit) return rent
  const buildingArea = areaByBuilding.value.get(unit.buildingId) ?? unit.area
  const share = buildingArea > 0 ? unit.area / buildingArea : 0
  const services = tariffLinesFor(METERS, contract.buildingName, unit.area).reduce(
    (s, line) => s + (line.meter ? Math.round(line.tariff * line.qty * share) : line.sum),
    0,
  )
  return rent + services
}

/** Reyestrdagi eng katta tartib raqami: yangi hujjatlar shundan davom etadi */
function lastSequence(): number {
  return INVOICES.reduce((max, i) => {
    const n = Number(i.code.slice(-4))
    return Number.isFinite(n) ? Math.max(max, n) : max
  }, 0)
}

/**
 * Davr bo‘yicha hisob-faktura shakllantirish: davrda amalda bo‘lgan har bir
 * faol shartnomaga bittadan hujjat yaratiladi. Allaqachon hujjati bor
 * shartnoma o‘tkazib yuboriladi, shuning uchun amalni takrorlash nusxa
 * yaratmaydi.
 */
function generate(key: string): Invoice[] {
  const label = labelOfKey(key)
  const covered = new Set((invoicesByKey.value.get(key) ?? []).map((i) => i.contractCode))
  const issuedAt = startOfKey(key)
  const dueAt = `${key}-25`
  let seq = lastSequence()
  const created: Invoice[] = []

  for (const contract of billableByKey.value.get(key) ?? []) {
    if (covered.has(contract.code)) continue
    seq += 1
    const order = String(seq).padStart(4, '0')
    const seed = {
      id: `i-${order}`,
      code: `INV-${key.slice(0, 4)}-${order}`,
      contractCode: contract.code,
      tenant: contract.tenant,
      buildingName: contract.buildingName,
      unitCode: contract.unitCode,
      period: label,
      issuedAt,
      dueAt,
      total: invoiceTotalOf(contract),
      paid: 0,
      status: 'ISSUED' as const,
    }
    created.push({ ...seed, status: statusOf(seed), agingBucket: agingKeyOf(seed) })
  }

  if (created.length) INVOICES.unshift(...created)
  return created
}

const confirmOpen = ref(false)
const confirmMode = ref<'generate' | 'close'>('generate')
const targetKey = ref('')

const target = computed(() => periods.value.find((p) => p.key === targetKey.value) ?? null)

function askGenerate(key: string) {
  targetKey.value = key
  confirmMode.value = 'generate'
  confirmOpen.value = true
}

function askClose(key: string) {
  targetKey.value = key
  confirmMode.value = 'close'
  confirmOpen.value = true
}

function applyConfirm() {
  const p = target.value
  if (!p || p.closed) return

  if (confirmMode.value === 'generate') {
    const created = generate(p.key)
    const amount = created.reduce((s, i) => s + i.total, 0)
    banner.value = created.length
      ? t('bil.generatedBanner', {
          period: p.label,
          n: num(created.length),
          amount: money(amount),
        })
      : t('bil.nothingGeneratedBanner', { period: p.label })
  } else {
    if (!closedKeys.value.includes(p.key)) closedKeys.value = [...closedKeys.value, p.key]
    banner.value = t('bil.periodClosedBanner', { period: p.label })
  }

  confirmOpen.value = false
}

const detailOpen = ref(false)
const detailKey = ref('')
const detail = computed(() => periods.value.find((p) => p.key === detailKey.value) ?? null)

function openDetail(row: Record<string, unknown>) {
  detailKey.value = String(row.key)
  detailOpen.value = true
}

// --- Yangi davr ------------------------------------------------------------

const createOpen = ref(false)
const nextKey = shiftKey(CURRENT_KEY, 1)
const newYear = ref(nextKey.slice(0, 4))
const newMonth = ref(MONTHS[Number(nextKey.slice(5)) - 1] ?? MONTHS[0]!)

const yearOptions = computed(() =>
  [0, 1].map((offset) => {
    const year = Number(CURRENT_KEY.slice(0, 4)) + offset
    return { value: String(year), label: t('bil.yearLabel', { year: String(year) }) }
  }),
)

const monthOptions = computed(() =>
  MONTHS.map((m, i) => ({ value: m, label: monthName(i + 1) })),
)

const newKey = computed(() => keyOfLabel(`${newMonth.value} ${newYear.value}`))
const duplicate = computed(() => periodKeys.value.includes(newKey.value))

function createPeriod() {
  if (duplicate.value || !newKey.value) return
  extraKeys.value = [...extraKeys.value, newKey.value]
  banner.value = t('bil.periodOpenedBanner', { period: labelOfKey(newKey.value) })
  createOpen.value = false
}
</script>

<template>
  <AppTopbar
    :title="moduleTitle('periods', 'Hisob-kitob davrlari')"
    :subtitle="moduleCaption('periods', 'Hisob-kitob davrlarini ochish va yopish')"
    :breadcrumb="[
      { label: sectionLabel('billing', 'Hisob-kitob'), to: '/billing/invoices' },
      { label: moduleTitle('periods', 'Hisob-kitob davrlari') },
    ]"
  >
    <template #actions>
      <UiButton variant="secondary" size="sm" to="/billing/invoices">
        <UiIcon name="doc" :size="16" />
        {{ moduleTitle('invoices', 'Hisob-fakturalar') }}
      </UiButton>
      <UiButton v-if="canIssue" size="sm" @click="createOpen = true">
        <UiIcon name="plus" :size="16" />
        {{ t('bil.newPeriod') }}
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
        :aria-label="t('common.dismissMessage')"
        @click="banner = ''"
      >
        <UiIcon name="x" :size="16" />
      </button>
    </div>

    <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <UiKpi
        :label="t('kpi.totalPeriods')"
        :value="num(periods.length)"
        :unit="t('common.count')"
        icon="calendar"
        tone="brand"
      />
      <UiKpi
        :label="t('kpi.openPeriods')"
        :value="num(openCount)"
        :unit="t('common.count')"
        icon="clock"
        tone="warn"
      />
      <UiKpi
        :label="t('kpi.closedPeriods')"
        :value="num(closedCount)"
        :unit="t('common.count')"
        icon="check"
        tone="ok"
      />
      <UiKpi
        :label="t('bil.chargedAmount')"
        :value="moneyShort(totalCharged)"
        icon="wallet"
        tone="violet"
      />
    </section>

    <UiCard
      :title="t('bil.periodsRegistry')"
      :subtitle="t('bil.periodsRegistryCaption')"
      flush
      :padded="false"
    >
      <div class="flex flex-wrap items-center justify-between gap-3 px-5 pb-4">
        <UiTabs v-model="stateFilter" :tabs="stateTabs" />
        <p class="text-[13px] text-ink-500">
          {{ t('bil.generatedInvoices') }}
          <b class="tabular text-ink-800">
            {{ t('common.countPcs', { n: num(generatedCount) }) }}
          </b>
        </p>
      </div>

      <UiTable
        :columns="columns"
        :rows="rows"
        :empty="t('empty.noPeriods')"
        @row-click="openDetail"
      >
        <template #cell-label="{ row }">
          <span class="font-semibold text-ink-900">{{ row.label }}</span>
        </template>
        <template #cell-contracts="{ row }">
          {{ t('common.countPcs', { n: num(Number(row.contracts)) }) }}
        </template>
        <template #cell-invoices="{ row }">
          <span :class="Number(row.invoices) ? 'text-ink-900' : 'text-ink-400'">
            {{ t('common.countPcs', { n: num(Number(row.invoices)) }) }}
          </span>
        </template>
        <template #cell-total="{ row }">{{ money(Number(row.total)) }}</template>
        <template #cell-state="{ row }">
          <span
            class="inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs font-semibold ring-1 ring-inset"
            :class="row.closed ? TONE_BADGE.neutral : TONE_BADGE.ok"
          >
            <UiIcon :name="row.closed ? 'lock' : 'check'" :size="12" />
            {{ row.closed ? t('bil.stateClosed') : t('bil.stateOpen') }}
          </span>
        </template>
        <template #cell-actions="{ row }">
          <span v-if="!canIssue" class="text-[12px] text-ink-500">{{ t('bil.viewOnly') }}</span>
          <span v-else class="inline-flex items-center justify-end gap-2">
            <UiButton
              variant="secondary"
              size="sm"
              :disabled="Boolean(row.closed)"
              @click.stop="askGenerate(String(row.key))"
            >
              <UiIcon name="refresh" :size="15" />
              {{ t('bil.generateInvoices') }}
            </UiButton>
            <UiButton
              variant="subtle"
              size="sm"
              :disabled="Boolean(row.closed)"
              @click.stop="askClose(String(row.key))"
            >
              <UiIcon name="lock" :size="15" />
              {{ t('bil.closePeriod') }}
            </UiButton>
          </span>
        </template>
      </UiTable>

      <div class="border-t border-ink-100 px-5 py-3.5">
        <p class="text-[13px] text-ink-500">
          {{ t('common.totalColon') }}
          <b class="text-ink-800">{{ t('common.countPcs', { n: rows.length }) }}</b>
          {{ t('bil.periodsWord') }} · {{ t('bil.overallSum') }}
          <b class="tabular text-ink-800">{{ money(totalCharged) }}</b>
        </p>
      </div>
    </UiCard>

    <UiCard :title="t('bil.chargedByPeriod')" :subtitle="t('bil.chargedByPeriodCaption')">
      <UiBars
        :labels="chartLabels"
        :series="chartSeries"
        :height="200"
        :unit="t('bil.valuesInMln')"
      />
    </UiCard>

    <UiModal
      v-model="confirmOpen"
      size="sm"
      :title="confirmMode === 'generate' ? t('bil.generateInvoices') : t('bil.closePeriod')"
      :subtitle="target ? t('bil.periodSubtitle', { period: target.label }) : ''"
    >
      <div v-if="target" class="space-y-4">
        <p class="text-[14px] leading-relaxed text-ink-700">
          <template v-if="confirmMode === 'generate'">
            {{ t('bil.generateHint1') }}
            <b>{{ t('common.countPcs', { n: num(target.contracts) }) }}</b>
            {{ t('bil.generateHint2') }}
            <b>{{ t('common.countPcs', { n: num(target.pending) }) }}</b>
            {{ t('bil.generateHint3') }}
          </template>
          <template v-else>
            {{ t('bil.closePeriodHint') }}
          </template>
        </p>

        <dl class="divide-y divide-ink-100 rounded-field bg-surface-sunken px-4">
          <div class="flex items-baseline justify-between gap-4 py-2.5">
            <dt class="text-[13px] text-ink-500">{{ t('kpi.activeContracts') }}</dt>
            <dd class="tabular text-[14px] font-semibold text-ink-900">
              {{ t('common.countPcs', { n: num(target.contracts) }) }}
            </dd>
          </div>
          <div class="flex items-baseline justify-between gap-4 py-2.5">
            <dt class="text-[13px] text-ink-500">{{ t('bil.currentInvoiceCount') }}</dt>
            <dd class="tabular text-[14px] font-semibold text-ink-900">
              {{ t('common.countPcs', { n: num(target.invoices) }) }}
            </dd>
          </div>
          <div
            v-if="confirmMode === 'generate'"
            class="flex items-baseline justify-between gap-4 py-2.5"
          >
            <dt class="text-[13px] text-ink-500">{{ t('bil.willGenerate') }}</dt>
            <dd
              class="tabular text-[14px] font-semibold"
              :class="target.pending ? 'text-brand-600' : 'text-ink-400'"
            >
              {{ t('common.countPcs', { n: num(target.pending) }) }}
            </dd>
          </div>
          <div class="flex items-baseline justify-between gap-4 py-2.5">
            <dt class="text-[13px] text-ink-500">{{ t('bil.currentAmount') }}</dt>
            <dd class="tabular text-[14px] font-semibold text-ink-900">{{ money(target.total) }}</dd>
          </div>
        </dl>
      </div>

      <template #footer>
        <UiButton variant="ghost" @click="confirmOpen = false">{{ t('common.cancel') }}</UiButton>
        <UiButton
          :variant="confirmMode === 'generate' ? 'primary' : 'danger'"
          :disabled="confirmMode === 'generate' && !target?.pending"
          @click="applyConfirm"
        >
          <UiIcon name="check" :size="16" />
          {{ confirmMode === 'generate' ? t('bil.generate') : t('bil.closePeriod') }}
        </UiButton>
      </template>
    </UiModal>

    <UiModal
      v-model="detailOpen"
      :title="detail ? detail.label : field('billingPeriod', 'Hisob davri')"
      :subtitle="t('bil.periodMetrics')"
    >
      <div v-if="detail" class="space-y-5">
        <div class="flex items-center gap-3">
          <span
            class="inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs font-semibold ring-1 ring-inset"
            :class="detail.closed ? TONE_BADGE.neutral : TONE_BADGE.ok"
          >
            <UiIcon :name="detail.closed ? 'lock' : 'check'" :size="12" />
            {{ detail.closed ? t('bil.stateClosed') : t('bil.stateOpen') }}
          </span>
          <span class="text-[13px] text-ink-500">
            {{ t('bil.completion') }}
            {{ percent(detail.contracts ? (detail.invoices / detail.contracts) * 100 : 0) }}
          </span>
        </div>

        <dl class="grid gap-4 sm:grid-cols-3">
          <div class="rounded-field bg-surface-sunken p-3.5">
            <dt class="text-[12px] text-ink-500">{{ t('kpi.activeContracts') }}</dt>
            <dd class="tabular mt-1 text-[16px] font-bold text-ink-900">
              {{ t('common.countPcs', { n: num(detail.contracts) }) }}
            </dd>
          </div>
          <div class="rounded-field bg-surface-sunken p-3.5">
            <dt class="text-[12px] text-ink-500">
              {{ moduleTitle('invoices', 'Hisob-fakturalar') }}
            </dt>
            <dd class="tabular mt-1 text-[16px] font-bold text-ink-900">
              {{ t('common.countPcs', { n: num(detail.invoices) }) }}
            </dd>
          </div>
          <div class="rounded-field bg-surface-sunken p-3.5">
            <dt class="text-[12px] text-ink-500">{{ field('totalAmount', 'Jami summa') }}</dt>
            <dd class="tabular mt-1 text-[16px] font-bold text-ink-900">{{ money(detail.total) }}</dd>
          </div>
        </dl>
      </div>

      <template #footer>
        <UiButton variant="ghost" @click="detailOpen = false">{{ t('common.close') }}</UiButton>
        <UiButton :to="`/billing/invoices?period=${detail ? detail.label : ''}`">
          <UiIcon name="doc" :size="16" />
          {{ t('bil.viewInvoices') }}
        </UiButton>
      </template>
    </UiModal>

    <UiModal
      v-model="createOpen"
      size="sm"
      :title="t('bil.newBillingPeriod')"
      :subtitle="t('bil.newPeriodCaption')"
    >
      <div class="grid gap-4 sm:grid-cols-2">
        <UiField :label="t('filter.year')" required>
          <UiSelect v-model="newYear" :options="yearOptions" />
        </UiField>
        <UiField
          :label="t('filter.month')"
          required
          :error="duplicate ? t('bil.periodExists') : undefined"
        >
          <UiSelect v-model="newMonth" :options="monthOptions" />
        </UiField>
      </div>

      <template #footer>
        <UiButton variant="ghost" @click="createOpen = false">{{ t('common.cancel') }}</UiButton>
        <UiButton :disabled="duplicate" @click="createPeriod">
          <UiIcon name="plus" :size="16" />
          {{ t('bil.openPeriod') }}
        </UiButton>
      </template>
    </UiModal>
  </main>
</template>
