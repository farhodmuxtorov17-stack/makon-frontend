<script setup lang="ts">
import AppTopbar from '~/components/layout/AppTopbar.vue'
import { BUILDINGS } from '~/data/buildings'
import {
  CONTRACTS,
  INVOICES,
  TARIFF_LINES,
  agingKeyOf,
  agingLabel,
  agingOf,
  billingSummaryOf,
  paymentStatusOf,
  statusOf,
} from '~/data/business'
import {
  dateShort,
  isoShift,
  monthShift,
  monthTitle,
  num,
  percent,
  todayIso,
} from '~/utils/format'

const auth = useAuthStore()
const route = useRoute()
const { money, moneyShort, field, moduleCaption, moduleTitle, sectionLabel, statusLabel } =
  useAppLabels()
const { t } = useI18n()

/** Reyestrni ko‘rish huquqi hujjat yaratish yoki to‘lov qabul qilishga ruxsat bermaydi */
const canCreate = computed(() => auth.can('invoice.create'))
const canConfirm = computed(() => auth.can('payment.confirm'))

/**
 * To‘lov yozuvlari: usul, sana, hisob raqami va izoh shu ro‘yxatda saqlanadi
 * va hisob-faktura tarixida ko‘rinadi. To‘lovni tasdiqlash ekrani ham shu
 * manbaga yozadi, shuning uchun to‘lov qayerda qabul qilinganidan qat’i
 * nazar hujjat tarixi bitta bo‘ladi.
 */
interface PaymentRecord {
  id: string
  invoiceId: string
  invoiceCode: string
  tenant: string
  amount: number
  method: string
  methodLabel: string
  account: string
  purpose: string
  note: string
  paidAt: string
  actor: string
  kind: 'payment' | 'return'
}

const payments = useState<PaymentRecord[]>('billing-payments', () => [])

/** Yopilgan hisob davrlari davrlar ekranida belgilanadi */
const closedKeys = useState<string[]>('billing-closed-periods', () => [])

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

const CURRENT_KEY = todayIso().slice(0, 7)

/** «Avgust 2026» → «2026-08»: davrlar shu ko‘rinishda saralanadi */
function keyOfPeriod(label: string): string {
  const [month, year] = label.split(' ')
  const index = MONTHS.indexOf(month ?? '')
  return index < 0 || !year ? '' : `${year}-${String(index + 1).padStart(2, '0')}`
}

function isClosedPeriod(label: string): boolean {
  const key = keyOfPeriod(label)
  return !key || key < CURRENT_KEY || closedKeys.value.includes(key)
}

/**
 * Sahifa umumiy reyestrni o‘qiydi va to‘g‘ridan-to‘g‘ri unga yozadi: qabul
 * qilingan to‘lov qarzdorlik ekranida ham, sahifa almashganda ham saqlanadi.
 */
const summary = computed(() => billingSummaryOf(INVOICES))
const aging = computed(() => agingOf(INVOICES))
const paymentStatus = computed(() => paymentStatusOf(INVOICES))
const paidShare = computed(() =>
  summary.value.charged ? Math.round((summary.value.paidTotal / summary.value.charged) * 100) : 0,
)

const search = ref('')
const building = ref('all')
const status = ref('all')
const banner = ref('')

/** Davrlar ekranidan «hisob-fakturalarni ko‘rish» bilan kelingan davr */
const requestedPeriod = String(route.query.period ?? '')
const period = ref(
  requestedPeriod && INVOICES.some((i) => i.period === requestedPeriod) ? requestedPeriod : 'all',
)

const buildingOptions = computed(() => [
  { value: 'all', label: t('landing.allObjects') },
  ...BUILDINGS.map((b) => ({ value: b.name, label: b.name })),
])

/**
 * Filtr yorlig‘i nishoncha bilan bitta manbadan chiqadi: `statusLabel()`
 * lug‘atdan o‘qiydi, shuning uchun rus tilida filtr «Оплачен», nishoncha esa
 * «To‘langan» bo‘lib qolmaydi.
 */
const FILTER_STATUSES = ['PAID', 'PARTIALLY_PAID', 'OVERDUE', 'ISSUED', 'DRAFT']

const statusOptions = computed(() => [
  { value: 'all', label: t('filter.allStatuses') },
  ...FILTER_STATUSES.map((value) => ({ value, label: statusLabel('invoice', value) })),
])

/** Davrlar xronologik tartibda, eng yangisi birinchi */
const periodOptions = computed(() => [
  { value: 'all', label: t('filter.allPeriods') },
  ...Array.from(new Set(INVOICES.map((i) => i.period)))
    .sort((a, b) => (keyOfPeriod(a) < keyOfPeriod(b) ? 1 : -1))
    .map((p) => ({ value: p, label: p })),
])

const scoped = computed(() =>
  INVOICES.filter((i) => {
    const q = search.value.trim().toLowerCase()
    const byQuery =
      !q || `${i.code} ${i.tenant} ${i.buildingName} ${i.unitCode}`.toLowerCase().includes(q)
    const byBuilding = building.value === 'all' || i.buildingName === building.value
    const byPeriod = period.value === 'all' || i.period === period.value
    return byQuery && byBuilding && byPeriod
  }),
)

const filtered = computed(() =>
  scoped.value.filter((i) => status.value === 'all' || i.status === status.value),
)

function countOf(value: string) {
  return scoped.value.filter((i) => i.status === value).length
}

const statusTabs = computed(() => [
  { value: 'all', label: t('tab.all'), count: scoped.value.length },
  ...FILTER_STATUSES.map((value) => ({
    value,
    label: statusLabel('invoice', value),
    count: countOf(value),
  })),
])

const columns = computed(() => [
  { key: 'idx', label: '№', width: '56px', numeric: true, align: 'right' as const },
  { key: 'code', label: field('invoiceNo', 'Hisob-faktura raqami') },
  { key: 'tenant', label: field('tenant', 'Ijarachi') },
  { key: 'place', label: field('objectUnit', 'Obyekt / Unit') },
  { key: 'period', label: field('period', 'Davr') },
  { key: 'total', label: field('totalAmount', 'Jami summa'), align: 'right' as const, numeric: true },
  { key: 'paid', label: field('paid', 'To‘langan'), align: 'right' as const, numeric: true },
  { key: 'balance', label: field('balance', 'Qoldiq'), align: 'right' as const, numeric: true },
  { key: 'status', label: field('status', 'Holat') },
])

const rows = computed(() =>
  filtered.value.map((i, idx) => ({
    id: i.id,
    idx: idx + 1,
    code: i.code,
    tenant: i.tenant,
    place: `${i.buildingName} · ${i.unitCode}`,
    period: i.period,
    total: i.total,
    paid: i.paid,
    balance: i.total - i.paid,
    status: i.status,
  })),
)

const filteredTotal = computed(() => filtered.value.reduce((s, i) => s + i.total, 0))
const filteredBalance = computed(() => filtered.value.reduce((s, i) => s + (i.total - i.paid), 0))

function resetFilters() {
  search.value = ''
  building.value = 'all'
  status.value = 'all'
  period.value = 'all'
}

const detailOpen = ref(false)
const activeId = ref('')
const active = computed(() => INVOICES.find((i) => i.id === activeId.value) ?? null)

const payAmount = ref('')
const payDate = ref(todayIso())
const payMethod = ref('bank')
const payNote = ref('')

const methodOptions = computed(() => [
  { value: 'bank', label: t('bil.methodBank') },
  { value: 'card', label: t('bil.methodCard') },
  { value: 'cash', label: t('bil.methodCash') },
])

function openInvoice(row: Record<string, unknown>) {
  activeId.value = String(row.id)
  const inv = active.value
  payAmount.value = inv ? String(inv.total - inv.paid) : ''
  payMethod.value = 'bank'
  payNote.value = ''
  detailOpen.value = true
}

const payValue = computed(() => Number(payAmount.value) || 0)

/** Qoralamaga qaytarilgan yoki bekor qilingan hujjat bo‘yicha to‘lov qabul qilinmaydi */
const payable = computed(() => {
  const inv = active.value
  return !!inv && inv.status !== 'DRAFT' && inv.status !== 'CANCELLED' && inv.total - inv.paid > 0
})

const payValid = computed(() => {
  const inv = active.value
  return !!inv && payable.value && payValue.value > 0 && payValue.value <= inv.total - inv.paid
})

/** Hujjat bo‘yicha qabul qilingan to‘lovlar, eng yangisi birinchi */
const activePayments = computed(() =>
  payments.value.filter((p) => p.invoiceId === activeId.value),
)

/**
 * To‘lov qabul qilish: qoldiq va holat reyestr yozuviga yoziladi, to‘lov
 * tafsilotlari esa alohida yozuv bo‘lib hujjat tarixida qoladi. Holat qo‘lda
 * emas, `statusOf()` bilan aniqlanadi: qisman to‘langan hujjat muddati o‘tgan
 * bo‘lsa «Kechikkan» bo‘lib qoladi.
 */
function acceptPayment() {
  const inv = active.value
  if (!canConfirm.value || !inv || !payValid.value) return
  const amount = payValue.value
  inv.paid += amount
  inv.status = statusOf(inv)
  inv.agingBucket = agingKeyOf(inv)

  payments.value = [
    {
      id: `pay-${inv.id}-${payments.value.length + 1}`,
      invoiceId: inv.id,
      invoiceCode: inv.code,
      tenant: inv.tenant,
      amount,
      method: payMethod.value,
      methodLabel:
        methodOptions.value.find((m) => m.value === payMethod.value)?.label ?? payMethod.value,
      account: '',
      purpose: t('bil.paymentPurpose', { code: inv.code }),
      note: payNote.value.trim(),
      paidAt: payDate.value,
      actor: auth.user?.fullName ?? '',
      kind: 'payment',
    },
    ...payments.value,
  ]

  banner.value = t('bil.paymentAccepted', {
    code: inv.code,
    amount: money(amount),
    rest: money(inv.total - inv.paid),
  })
  detailOpen.value = false
}

const createOpen = ref(false)

/**
 * Hisob davri qo‘lda yozilmaydi: joriy oydan boshlab ochiq davrlar taklif
 * qilinadi. Yopilgan davr ro‘yxatga tushmaydi, chunki unga yangi hujjat
 * qo‘shib bo‘lmaydi.
 */
/**
 * Hisob-faktura qo'lda yozilmaydi.
 *
 * Ilgari bu forma bo'sh maydonlardan iborat edi: buxgalter ijarachi nomini,
 * unit kodini va summani qo'lda terardi. Tizim bu uchalasini biladi, qo'lda
 * kiritish esa reyestr bilan shartnoma grafigini bir-biridan uzib qo'yardi:
 * hujjat ro'yxatga tushar, lekin shartnoma grafigidagi davr «rejalashtirilgan»
 * bo'lib qolaverardi.
 *
 * Endi buxgalter faol shartnomani tanlaydi, tizim grafikdan navbatdagi davrni
 * oladi va hisob-fakturani o'sha davr uchun chiqaradi. Grafik ham, reyestr
 * ham bitta amaldan yangilanadi.
 */
const lease = useLeaseStore()

interface PendingRow {
  caseId: string
  code: string
  tenant: string
  buildingName: string
  unitCode: string
  periodId: string
  label: string
  total: number
  dueAt: string
  /** Qaysi manbadan: yangi ijara sikli yoki shartnomalar reyestri */
  manba: 'sikl' | 'reyestr'
}

/** Faol shartnomalarning chiqarilmagan navbatdagi davrlari */
/** Yopilmagan eng yaqin hisob davri */
const targetPeriod = computed(() => {
  const label = [0, 1, 2, 3]
    .map((offset) => monthTitle(monthShift(offset)))
    .find((l) => !isClosedPeriod(l))
  return label ?? monthTitle(monthShift(1))
})

/**
 * Chiqarilishi kerak bo'lgan davrlar ikki manbadan yig'iladi:
 *
 *   1. Yangi ijara sikli: ariza yopilganda tuzilgan to'lov grafigidagi
 *      «rejalashtirilgan» qatorlar;
 *   2. Reyestrdagi faol ijara shartnomalari: joriy davr uchun hali
 *      hisob-faktura berilmagan bo'lsa, shu ro'yxatga tushadi.
 *
 * Ikkalasida ham summa, ijarachi va unit tizimdan olinadi, buxgalter faqat
 * shartnomani tanlaydi.
 */
const pending = computed<PendingRow[]>(() => {
  const out: PendingRow[] = []

  for (const item of lease.cases) {
    if (item.status !== 'FAOL' || !item.unitId) continue
    const row = item.schedule.find((r) => r.status === 'PLANNED')
    if (!row) continue
    const building = BUILDINGS.find((b) => b.id === item.buildingId)
    if (building && !auth.inScope(building.id)) continue
    out.push({
      caseId: item.id,
      code: item.contract?.code ?? item.code,
      tenant: item.org.name,
      buildingName: building?.name ?? '',
      unitCode: item.unitCode,
      periodId: row.id,
      label: row.label,
      total: row.total,
      dueAt: row.dueAt,
      manba: 'sikl',
    })
  }

  const davr = targetPeriod.value
  const berilgan = new Set(
    INVOICES.filter((i) => i.period === davr).map((i) => `${i.tenant}|${i.unitCode}`),
  )
  for (const c of CONTRACTS) {
    if (c.status !== 'ACTIVE' || c.type !== 'Ijara') continue
    if (!auth.inScope(c.buildingId)) continue
    if (berilgan.has(`${c.tenant}|${c.unitCode}`)) continue
    out.push({
      caseId: `contract:${c.id}`,
      code: c.code,
      tenant: c.tenant,
      buildingName: c.buildingName,
      unitCode: c.unitCode,
      periodId: '',
      label: davr,
      /* Reyestrda yillik summa turadi, oylik hisob-faktura undan chiqadi */
      total: Math.round(c.amount / 12),
      dueAt: isoShift(10),
      manba: 'reyestr',
    })
  }

  return out.sort((a, b) => a.dueAt.localeCompare(b.dueAt)).slice(0, 60)
})

const pendingOptions = computed(() =>
  pending.value.map((p) => ({
    value: p.caseId,
    label: `${p.code} · ${p.tenant} · ${p.label}`,
  })),
)

const selectedCase = ref('')
const selected = computed(() => pending.value.find((p) => p.caseId === selectedCase.value) ?? null)

function openCreate() {
  if (!canCreate.value) return
  selectedCase.value = pending.value[0]?.caseId ?? ''
  createOpen.value = true
}

function createInvoice() {
  const row = selected.value
  if (!canCreate.value || !row) return

  if (row.manba === 'sikl') {
    const code = lease.issueInvoice(
      row.caseId,
      auth.user?.fullName ?? t('role.ACCOUNTANT.label'),
      auth.roleMeta?.label ?? t('role.ACCOUNTANT.label'),
      row.periodId,
    )
    if (!code) {
      banner.value = t('bil.periodAlreadyIssued')
      createOpen.value = false
      return
    }
    banner.value = t('bil.invoiceIssuedToCabinet', {
      code,
      period: row.label,
      tenant: row.tenant,
    })
  } else {
    const issuedAt = todayIso()
    const order = String(
      INVOICES.reduce((max, i) => {
        const n = Number(i.code.slice(-4))
        return Number.isFinite(n) ? Math.max(max, n) : max
      }, 0) + 1,
    ).padStart(4, '0')
    const code = `INV-${issuedAt.slice(0, 4)}-${order}`
    const seed = {
      id: `i-${order}`,
      code,
      tenant: row.tenant,
      buildingName: row.buildingName,
      unitCode: row.unitCode,
      period: row.label,
      issuedAt,
      dueAt: row.dueAt,
      total: row.total,
      paid: 0,
      status: 'ISSUED' as const,
    }
    INVOICES.unshift({ ...seed, status: statusOf(seed), agingBucket: agingKeyOf(seed) })
    banner.value = t('bil.invoiceIssuedFor', { code, period: row.label, tenant: row.tenant })
  }

  createOpen.value = false
  status.value = 'all'
}

const agingSlices = computed(() =>
  aging.value.map((a) => ({ label: a.bucket, value: a.amount, tone: a.tone })),
)
const agingTotal = computed(() => aging.value.reduce((s, a) => s + a.amount, 0))

const registrySubtitle = computed(() =>
  period.value === 'all'
    ? t('bil.registryAllPeriods')
    : t('bil.registryPeriod', { period: period.value }),
)

const contractId = ref(CONTRACTS[1]!.id)
const contractOptions = CONTRACTS.map((c) => ({ value: c.id, label: `${c.code}, ${c.tenant}` }))
const activeContract = computed(
  () => CONTRACTS.find((c) => c.id === contractId.value) ?? CONTRACTS[0]!,
)
const tariffTotal = TARIFF_LINES.reduce((s, t) => s + t.sum, 0)
</script>

<template>
  <AppTopbar
    :title="moduleTitle('invoices', 'Hisob-fakturalar')"
    :subtitle="moduleCaption('invoices', 'Davr bo‘yicha chiqarilgan hisob-fakturalar')"
    :breadcrumb="[
      { label: sectionLabel('billing', 'Hisob-kitob'), to: '/billing/invoices' },
      { label: moduleTitle('invoices', 'Hisob-fakturalar') },
    ]"
  >
    <template #actions>
      <UiButton variant="secondary" size="sm" to="/billing/debts">
        <UiIcon name="chart" :size="16" />
        {{ moduleTitle('debts', 'Qarzdorlik tahlili') }}
      </UiButton>
      <UiButton v-if="canCreate" size="sm" @click="openCreate">
        <UiIcon name="plus" :size="16" />
        {{ t('bil.newInvoice') }}
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
        :label="t('kpi.totalAccrued')"
        :value="moneyShort(summary.charged)"
        icon="doc"
        tone="brand"
      />
      <UiKpi
        :label="field('paid', 'To‘langan')"
        :value="moneyShort(summary.paidTotal)"
        icon="check"
        tone="ok"
        :gauge="paidShare"
      />
      <UiKpi
        :label="t('kpi.debt')"
        :value="moneyShort(summary.debtTotal)"
        icon="wallet"
        tone="warn"
      />
      <UiKpi :label="t('kpi.vat')" :value="moneyShort(summary.vat)" icon="meter" tone="violet" />
    </section>

    <UiCard
      :title="t('bil.invoiceRegistry')"
      :subtitle="registrySubtitle"
      flush
      :padded="false"
    >
      <div class="flex flex-wrap items-center gap-3 px-5 pb-4">
        <UiInput
          v-model="search"
          :placeholder="t('bil.searchInvoices')"
          class="min-w-[240px] flex-1"
        >
          <template #prefix>
            <UiIcon name="search" :size="18" />
          </template>
        </UiInput>
        <UiSelect v-model="building" :options="buildingOptions" class="w-full sm:w-56" />
        <UiSelect v-model="status" :options="statusOptions" class="w-full sm:w-48" />
        <UiSelect v-model="period" :options="periodOptions" class="w-full sm:w-44" />
        <UiButton variant="ghost" @click="resetFilters">
          <UiIcon name="refresh" :size="16" />
          {{ t('common.reset') }}
        </UiButton>
      </div>

      <div class="px-5 pb-4">
        <UiTabs v-model="status" :tabs="statusTabs" />
      </div>

      <UiTable
        :page-size="25"
        :columns="columns"
        :rows="rows"
        :empty="t('empty.noInvoicesMatch')"
        @row-click="openInvoice"
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
        <template #cell-total="{ row }">{{ money(Number(row.total)) }}</template>
        <template #cell-paid="{ row }">
          <span class="text-ok-600">{{ money(Number(row.paid)) }}</span>
        </template>
        <template #cell-balance="{ row }">
          <span :class="Number(row.balance) > 0 ? 'text-danger-600' : 'text-ink-400'">
            {{ money(Number(row.balance)) }}
          </span>
        </template>
        <template #cell-status="{ row }">
          <UiStatus kind="invoice" :value="String(row.status)" size="sm" />
        </template>
      </UiTable>

      <div
        class="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 px-5 py-3.5"
      >
        <p class="text-[13px] text-ink-500">
          {{ t('common.totalColon') }}
          <b class="text-ink-800">{{ t('common.countPcs', { n: rows.length }) }}</b>
          {{ t('bil.invoicesWord') }}
        </p>
        <p class="text-[13px] text-ink-500">
          {{ t('common.amountColon') }}
          <b class="tabular text-ink-800">{{ money(filteredTotal) }}</b>
          <span class="mx-2 text-ink-300">|</span>
          {{ t('common.balanceColon') }}
          <b class="tabular text-danger-600">{{ money(filteredBalance) }}</b>
        </p>
      </div>
    </UiCard>

    <section class="grid gap-5 xl:grid-cols-2">
      <UiCard
        :title="moduleTitle('debts', 'Qarzdorlik tahlili')"
        :subtitle="t('bil.agingDistribution')"
      >
        <UiDonut
          :slices="agingSlices"
          :center-value="moneyShort(agingTotal)"
          :center-label="t('bil.totalDebtLower')"
        />
        <ul class="mt-5 divide-y divide-ink-100 border-t border-ink-100">
          <li v-for="a in aging" :key="a.key" class="flex items-center gap-3 py-2.5">
            <span class="min-w-0 flex-1 text-[13px] text-ink-600">{{ a.bucket }}</span>
            <span class="tabular w-12 text-right text-[13px] font-semibold text-ink-700">
              {{ percent(a.share) }}
            </span>
            <span class="tabular w-40 text-right text-[13px] font-bold text-ink-900">
              {{ money(a.amount) }}
            </span>
          </li>
        </ul>
      </UiCard>

      <UiCard
        :title="t('bil.paymentStatusTitle')"
        :subtitle="t('bil.paymentStatusCaption')"
        flush
        :padded="false"
      >
        <ul class="divide-y divide-ink-100 border-t border-ink-100">
          <li v-for="p in paymentStatus" :key="p.status" class="px-5 py-3.5">
            <button
              type="button"
              class="flex w-full items-center gap-4 text-left"
              @click="status = p.status"
            >
              <span
                class="grid size-10 shrink-0 place-items-center rounded-[10px]"
                :class="{
                  'bg-ok-50 text-ok-600': p.tone === 'ok',
                  'bg-warn-50 text-warn-600': p.tone === 'warn',
                  'bg-brand-50 text-brand-600': p.tone === 'brand',
                  'bg-danger-50 text-danger-600': p.tone === 'danger',
                }"
              >
                <UiIcon name="wallet" :size="18" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block text-[14px] font-semibold text-ink-900">{{ p.label }}</span>
                <span class="tabular block text-[12px] text-ink-500">
                  {{ t('common.countPcs', { n: num(p.count) }) }} · {{ percent(p.share) }}
                </span>
              </span>
              <span class="tabular shrink-0 text-[14px] font-bold text-ink-900">
                {{ money(p.amount) }}
              </span>
            </button>
          </li>
        </ul>
        <div class="border-t border-ink-100 px-5 py-3.5">
          <p class="text-[13px] text-ink-500">{{ t('bil.clickRowToFilter') }}</p>
        </div>
      </UiCard>
    </section>

    <UiCard
      :title="t('bil.contractCharges')"
      :subtitle="t('bil.contractChargesCaption')"
      flush
      :padded="false"
    >
      <template #actions>
        <div class="flex items-center gap-3">
          <UiSelect v-model="contractId" :options="contractOptions" size="sm" class="w-72" />
          <UiStatus kind="contract" :value="activeContract.status" size="sm" />
        </div>
      </template>

      <div class="grid gap-3 border-y border-ink-100 bg-surface-sunken px-5 py-3.5 sm:grid-cols-3">
        <div>
          <p class="text-[12px] text-ink-500">{{ field('tenant', 'Ijarachi') }}</p>
          <p class="mt-0.5 text-[14px] font-semibold text-ink-900">{{ activeContract.tenant }}</p>
        </div>
        <div>
          <p class="text-[12px] text-ink-500">{{ field('objectUnit', 'Obyekt / Unit') }}</p>
          <p class="mt-0.5 text-[14px] font-semibold text-ink-900">
            {{ activeContract.buildingName }} · {{ activeContract.unitCode }}
          </p>
        </div>
        <div>
          <p class="text-[12px] text-ink-500">{{ field('paymentTerm', 'To‘lov shakli') }}</p>
          <p class="mt-0.5 text-[14px] font-semibold text-ink-900">
            {{ activeContract.paymentTerm }}
          </p>
        </div>
      </div>

      <UiTable
        :columns="[
          { key: 'service', label: field('serviceType', 'Xizmat turi') },
          { key: 'unit', label: field('unitOfMeasure', 'O‘lchov birligi') },
          { key: 'tariff', label: field('tariff', 'Tarif'), align: 'right', numeric: true },
          { key: 'qty', label: field('quantity', 'Miqdor'), align: 'right', numeric: true },
          { key: 'sum', label: field('amount', 'Summa'), align: 'right', numeric: true },
        ]"
        :rows="TARIFF_LINES.map((t) => ({ ...t, id: t.service }))"
      >
        <template #cell-service="{ row }">
          <span class="font-semibold text-ink-900">{{ row.service }}</span>
        </template>
        <template #cell-tariff="{ row }">{{ money(Number(row.tariff)) }}</template>
        <template #cell-qty="{ row }">{{ num(Number(row.qty)) }}</template>
        <template #cell-sum="{ row }">{{ money(Number(row.sum)) }}</template>
      </UiTable>

      <div
        class="flex items-center justify-between gap-4 border-t border-ink-200 bg-surface-sunken px-5 py-4"
      >
        <span class="text-[14px] font-bold text-ink-900">{{ t('common.total') }}</span>
        <span class="tabular text-[16px] font-bold text-ink-900">{{ money(tariffTotal) }}</span>
      </div>
    </UiCard>

    <UiModal
      v-model="detailOpen"
      size="lg"
      :title="active ? active.code : field('invoice', 'Hisob-faktura')"
      :subtitle="active ? `${active.tenant} · ${active.period}` : ''"
    >
      <div v-if="active" class="space-y-6">
        <div class="flex flex-wrap items-center gap-3">
          <UiStatus kind="invoice" :value="active.status" />
          <span class="text-[13px] text-ink-500">
            {{
              t('bil.issuedAndDue', {
                issued: dateShort(active.issuedAt),
                due: dateShort(active.dueAt),
              })
            }}
          </span>
        </div>

        <dl class="grid gap-4 sm:grid-cols-3">
          <div class="rounded-field bg-surface-sunken p-3.5">
            <dt class="text-[12px] text-ink-500">{{ field('totalAmount', 'Jami summa') }}</dt>
            <dd class="tabular mt-1 text-[16px] font-bold text-ink-900">{{ money(active.total) }}</dd>
          </div>
          <div class="rounded-field bg-surface-sunken p-3.5">
            <dt class="text-[12px] text-ink-500">{{ field('paid', 'To‘langan') }}</dt>
            <dd class="tabular mt-1 text-[16px] font-bold text-ok-600">{{ money(active.paid) }}</dd>
          </div>
          <div class="rounded-field bg-surface-sunken p-3.5">
            <dt class="text-[12px] text-ink-500">{{ field('balance', 'Qoldiq') }}</dt>
            <dd class="tabular mt-1 text-[16px] font-bold text-danger-600">
              {{ money(active.total - active.paid) }}
            </dd>
          </div>
        </dl>

        <dl class="grid gap-x-6 gap-y-3 border-t border-ink-100 pt-5 sm:grid-cols-2">
          <div class="flex items-baseline justify-between gap-4">
            <dt class="text-[13px] text-ink-500">{{ field('object', 'Obyekt') }}</dt>
            <dd class="text-[14px] font-semibold text-ink-900">{{ active.buildingName }}</dd>
          </div>
          <div class="flex items-baseline justify-between gap-4">
            <dt class="text-[13px] text-ink-500">{{ field('unit', 'Unit') }}</dt>
            <dd class="text-[14px] font-semibold text-ink-900">{{ active.unitCode }}</dd>
          </div>
          <div class="flex items-baseline justify-between gap-4">
            <dt class="text-[13px] text-ink-500">{{ field('period', 'Davr') }}</dt>
            <dd class="text-[14px] font-semibold text-ink-900">{{ active.period }}</dd>
          </div>
          <div class="flex items-baseline justify-between gap-4">
            <dt class="text-[13px] text-ink-500">{{ field('agingBucket', 'Muddat guruhi') }}</dt>
            <dd class="text-[14px] font-semibold text-ink-900">
              {{ agingLabel(active.agingBucket) }}
            </dd>
          </div>
        </dl>

        <section v-if="activePayments.length" class="border-t border-ink-100 pt-5">
          <p class="text-[14px] font-bold text-ink-900">{{ t('bil.paymentHistory') }}</p>
          <ul class="mt-3 divide-y divide-ink-100 rounded-field bg-surface-sunken px-4">
            <li v-for="p in activePayments" :key="p.id" class="flex items-start gap-4 py-3">
              <span
                class="grid size-9 shrink-0 place-items-center rounded-[10px]"
                :class="p.kind === 'payment' ? 'bg-ok-50 text-ok-600' : 'bg-danger-50 text-danger-600'"
              >
                <UiIcon :name="p.kind === 'payment' ? 'check' : 'refresh'" :size="17" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block text-[13px] font-semibold text-ink-900">
                  {{ dateShort(p.paidAt) }} · {{ p.methodLabel }}
                </span>
                <span class="block text-[12px] text-ink-500">
                  {{ p.purpose }}<template v-if="p.account"> · {{ p.account }}</template>
                  <template v-if="p.actor"> · {{ p.actor }}</template>
                </span>
                <span v-if="p.note" class="mt-0.5 block text-[12px] text-ink-600">{{ p.note }}</span>
              </span>
              <span
                class="tabular shrink-0 text-[14px] font-bold"
                :class="p.kind === 'payment' ? 'text-ok-600' : 'text-danger-600'"
              >
                {{ p.kind === 'payment' ? money(p.amount) : t('bil.returned') }}
              </span>
            </li>
          </ul>
        </section>

        <div v-if="canConfirm && payable" class="rounded-card bg-surface-sunken p-4 ring-1 ring-ink-200/70">
          <p class="text-[14px] font-bold text-ink-900">{{ t('bil.acceptPayment') }}</p>
          <div class="mt-4 grid gap-4 sm:grid-cols-2">
            <UiField :label="field('paymentAmount', 'To‘lov summasi')" required>
              <UiInput v-model="payAmount" type="number" placeholder="0" :invalid="!payValid" />
            </UiField>
            <UiField :label="field('paymentDate', 'To‘lov sanasi')" required>
              <UiInput v-model="payDate" type="date" />
            </UiField>
            <UiField :label="field('paymentMethod', 'To‘lov usuli')">
              <UiSelect v-model="payMethod" :options="methodOptions" />
            </UiField>
            <UiField :label="t('common.note')" :hint="t('bil.noteHint')">
              <UiInput v-model="payNote" :placeholder="t('bil.notePlaceholder')" />
            </UiField>
          </div>
          <p v-if="!payValid" class="mt-3 text-[12px] font-medium text-danger-600">
            {{ t('bil.amountRangeError') }}
          </p>
        </div>
      </div>

      <template #footer>
        <UiButton variant="ghost" @click="detailOpen = false">{{ t('common.close') }}</UiButton>
        <UiButton
          v-if="canConfirm && payable"
          variant="success"
          :disabled="!payValid"
          @click="acceptPayment"
        >
          <UiIcon name="check" :size="16" />
          {{ t('bil.acceptPayment') }}
        </UiButton>
      </template>
    </UiModal>

    <UiModal
      v-if="canCreate"
      v-model="createOpen"
      :title="t('bil.issueInvoice')"
      :subtitle="t('bil.issueInvoiceCaption')"
    >
      <p v-if="!pending.length" class="text-[14px] leading-relaxed text-ink-600">
        {{ t('bil.noPendingPeriods') }}
      </p>

      <template v-else>
        <UiField :label="field('contract', 'Shartnoma')" required>
          <UiSelect v-model="selectedCase" :options="pendingOptions" />
        </UiField>

        <dl v-if="selected" class="mt-4 rounded-field bg-surface-sunken px-4 py-3.5">
          <div class="flex items-baseline justify-between gap-3">
            <dt class="text-[13px] text-ink-500">{{ t('bil.objectAndUnit') }}</dt>
            <dd class="text-[13px] font-semibold text-ink-900">
              {{ selected.buildingName }} · {{ selected.unitCode }}
            </dd>
          </div>
          <div class="mt-2.5 flex items-baseline justify-between gap-3">
            <dt class="text-[13px] text-ink-500">{{ field('billingPeriod', 'Hisob davri') }}</dt>
            <dd class="text-[13px] font-semibold text-ink-900">{{ selected.label }}</dd>
          </div>
          <div class="mt-2.5 flex items-baseline justify-between gap-3">
            <dt class="text-[13px] text-ink-500">{{ field('dueDate', 'To‘lov muddati') }}</dt>
            <dd class="tabular text-[13px] font-semibold text-ink-900">
              {{ dateShort(selected.dueAt) }}
            </dd>
          </div>
          <div class="mt-3 flex items-baseline justify-between gap-3 border-t border-ink-100 pt-3">
            <dt class="text-[13px] font-semibold text-ink-700">
              {{ field('totalAmount', 'Jami summa') }}
            </dt>
            <dd class="tabular text-[16px] font-extrabold text-ink-900">
              {{ money(selected.total) }}
            </dd>
          </div>
        </dl>
      </template>

      <template #footer>
        <UiButton variant="ghost" @click="createOpen = false">{{ t('common.cancel') }}</UiButton>
        <UiButton :disabled="!selected" @click="createInvoice">
          <UiIcon name="check" :size="16" />
          {{ t('bil.issue') }}
        </UiButton>
      </template>
    </UiModal>
  </main>
</template>
