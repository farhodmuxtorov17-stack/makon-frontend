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
  sum,
  sumShort,
  todayIso,
} from '~/utils/format'

const auth = useAuthStore()
const route = useRoute()
const { field, moduleCaption, moduleTitle, sectionLabel, statusLabel } = useAppLabels()

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

const buildingOptions = [
  { value: 'all', label: 'Barcha obyektlar' },
  ...BUILDINGS.map((b) => ({ value: b.name, label: b.name })),
]

/**
 * Filtr yorlig‘i nishoncha bilan bitta manbadan chiqadi: `statusLabel()`
 * lug‘atdan o‘qiydi, shuning uchun rus tilida filtr «Оплачен», nishoncha esa
 * «To‘langan» bo‘lib qolmaydi.
 */
const FILTER_STATUSES = ['PAID', 'PARTIALLY_PAID', 'OVERDUE', 'ISSUED', 'DRAFT']

const statusOptions = computed(() => [
  { value: 'all', label: 'Barcha statuslar' },
  ...FILTER_STATUSES.map((value) => ({ value, label: statusLabel('invoice', value) })),
])

/** Davrlar xronologik tartibda, eng yangisi birinchi */
const periodOptions = computed(() => [
  { value: 'all', label: 'Barcha davrlar' },
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
  { value: 'all', label: 'Barchasi', count: scoped.value.length },
  ...FILTER_STATUSES.map((value) => ({
    value,
    label: statusLabel('invoice', value),
    count: countOf(value),
  })),
])

const columns = computed(() => [
  { key: 'idx', label: '№', width: '56px', numeric: true, align: 'right' as const },
  { key: 'code', label: 'Hisob-faktura raqami' },
  { key: 'tenant', label: field('tenant', 'Ijarachi') },
  { key: 'place', label: 'Obyekt / Unit' },
  { key: 'period', label: field('period', 'Davr') },
  { key: 'total', label: 'Jami summa', align: 'right' as const, numeric: true },
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

const methodOptions = [
  { value: 'bank', label: 'Bank o‘tkazmasi' },
  { value: 'card', label: 'Plastik karta' },
  { value: 'cash', label: 'Naqd pul' },
]

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
      methodLabel: methodOptions.find((m) => m.value === payMethod.value)?.label ?? payMethod.value,
      account: '',
      purpose: `IJARA TO‘LOVI, ${inv.code}`,
      note: payNote.value.trim(),
      paidAt: payDate.value,
      actor: auth.user?.fullName ?? '',
      kind: 'payment',
    },
    ...payments.value,
  ]

  banner.value = `${inv.code} bo‘yicha ${sum(amount)} to‘lov qabul qilindi, qoldiq ${sum(inv.total - inv.paid)}.`
  detailOpen.value = false
}

const createOpen = ref(false)

/**
 * Hisob davri qo‘lda yozilmaydi: joriy oydan boshlab ochiq davrlar taklif
 * qilinadi. Yopilgan davr ro‘yxatga tushmaydi, chunki unga yangi hujjat
 * qo‘shib bo‘lmaydi.
 */
const createPeriods = computed(() => {
  const open = [0, 1, 2, 3, 4, 5]
    .map((offset) => monthTitle(monthShift(offset)))
    .filter((label) => !isClosedPeriod(label))
    .slice(0, 3)
  const list = open.length ? open : [monthTitle(monthShift(1))]
  return list.map((label) => ({ value: label, label }))
})

const form = reactive({
  tenant: '',
  building: BUILDINGS[0]!.name,
  unitCode: '',
  period: createPeriods.value[0]!.value,
  total: '',
  dueAt: isoShift(10),
})

const createValid = computed(() => form.tenant.trim().length > 2 && Number(form.total) > 0)

function openCreate() {
  if (!canCreate.value) return
  form.tenant = ''
  form.building = BUILDINGS[0]!.name
  form.unitCode = ''
  form.period = createPeriods.value[0]!.value
  form.total = ''
  form.dueAt = isoShift(10)
  createOpen.value = true
}

/** Reyestrdagi eng katta tartib raqami: yangi hujjat shundan keyin davom etadi */
function lastSequence() {
  return INVOICES.reduce((max, i) => {
    const n = Number(i.code.slice(-4))
    return Number.isFinite(n) ? Math.max(max, n) : max
  }, 0)
}

function createInvoice() {
  if (!canCreate.value || !createValid.value || isClosedPeriod(form.period)) return
  const issuedAt = todayIso()
  const order = String(lastSequence() + 1).padStart(4, '0')
  const code = `INV-${issuedAt.slice(0, 4)}-${order}`
  /** Holat va muddat guruhi qo‘lda yozilmaydi: ikkalasi ham sanadan chiqadi */
  const seed = {
    id: `i-${order}`,
    code,
    tenant: form.tenant.trim(),
    buildingName: form.building,
    unitCode: form.unitCode.trim() || 'Unit -',
    period: form.period,
    issuedAt,
    dueAt: form.dueAt,
    total: Number(form.total),
    paid: 0,
    status: 'ISSUED' as const,
  }
  INVOICES.unshift({ ...seed, status: statusOf(seed), agingBucket: agingKeyOf(seed) })
  banner.value = `${code} hisob-fakturasi yaratildi va ro‘yxatga qo‘shildi.`
  createOpen.value = false
  status.value = 'all'
}

const agingSlices = computed(() =>
  aging.value.map((a) => ({ label: a.bucket, value: a.amount, tone: a.tone })),
)
const agingTotal = computed(() => aging.value.reduce((s, a) => s + a.amount, 0))

const registrySubtitle = computed(() =>
  period.value === 'all'
    ? 'Barcha davrlar bo‘yicha hisob-kitoblar'
    : `${period.value} davri bo‘yicha hisob-kitoblar`,
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
        Qarzdorlik tahlili
      </UiButton>
      <UiButton v-if="canCreate" size="sm" @click="openCreate">
        <UiIcon name="plus" :size="16" />
        Yangi hisob-faktura
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
        aria-label="Xabarni yopish"
        @click="banner = ''"
      >
        <UiIcon name="x" :size="16" />
      </button>
    </div>

    <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <UiKpi label="Jami hisoblangan" :value="sumShort(summary.charged)" icon="doc" tone="brand" />
      <UiKpi
        label="To‘langan"
        :value="sumShort(summary.paidTotal)"
        icon="check"
        tone="ok"
        :gauge="paidShare"
      />
      <UiKpi label="Qarzdorlik" :value="sumShort(summary.debtTotal)" icon="wallet" tone="warn" />
      <UiKpi label="QQS (12%)" :value="sumShort(summary.vat)" icon="meter" tone="violet" />
    </section>

    <UiCard
      title="Hisob-fakturalar reyestri"
      :subtitle="registrySubtitle"
      flush
      :padded="false"
    >
      <div class="flex flex-wrap items-center gap-3 px-5 pb-4">
        <UiInput
          v-model="search"
          placeholder="Raqam, ijarachi yoki unit bo‘yicha qidirish"
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
          Tozalash
        </UiButton>
      </div>

      <div class="px-5 pb-4">
        <UiTabs v-model="status" :tabs="statusTabs" />
      </div>

      <UiTable
        :columns="columns"
        :rows="rows"
        empty="Tanlangan shartlarga mos hisob-faktura topilmadi"
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
        <template #cell-total="{ row }">{{ sum(Number(row.total)) }}</template>
        <template #cell-paid="{ row }">
          <span class="text-ok-600">{{ sum(Number(row.paid)) }}</span>
        </template>
        <template #cell-balance="{ row }">
          <span :class="Number(row.balance) > 0 ? 'text-danger-600' : 'text-ink-400'">
            {{ sum(Number(row.balance)) }}
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
          Jami: <b class="text-ink-800">{{ rows.length }} ta</b> hisob-faktura
        </p>
        <p class="text-[13px] text-ink-500">
          Summa: <b class="tabular text-ink-800">{{ sum(filteredTotal) }}</b>
          <span class="mx-2 text-ink-300">|</span>
          Qoldiq: <b class="tabular text-danger-600">{{ sum(filteredBalance) }}</b>
        </p>
      </div>
    </UiCard>

    <section class="grid gap-5 xl:grid-cols-2">
      <UiCard title="Qarzdorlik tahlili" subtitle="Muddat guruhlari bo‘yicha taqsimot">
        <UiDonut
          :slices="agingSlices"
          :center-value="sumShort(agingTotal)"
          center-label="jami qarzdorlik"
        />
        <ul class="mt-5 divide-y divide-ink-100 border-t border-ink-100">
          <li v-for="a in aging" :key="a.key" class="flex items-center gap-3 py-2.5">
            <span class="min-w-0 flex-1 text-[13px] text-ink-600">{{ a.bucket }}</span>
            <span class="tabular w-12 text-right text-[13px] font-semibold text-ink-700">
              {{ percent(a.share) }}
            </span>
            <span class="tabular w-40 text-right text-[13px] font-bold text-ink-900">
              {{ sum(a.amount) }}
            </span>
          </li>
        </ul>
      </UiCard>

      <UiCard title="To‘lov statusi" subtitle="Hisob-fakturalar bo‘yicha holat" flush :padded="false">
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
                <span class="block text-[13.5px] font-semibold text-ink-900">{{ p.label }}</span>
                <span class="tabular block text-[12px] text-ink-500">
                  {{ num(p.count) }} ta · {{ percent(p.share) }}
                </span>
              </span>
              <span class="tabular shrink-0 text-[13.5px] font-bold text-ink-900">
                {{ sum(p.amount) }}
              </span>
            </button>
          </li>
        </ul>
        <div class="border-t border-ink-100 px-5 py-3.5">
          <p class="text-[12.5px] text-ink-500">
            Qatorni bosish orqali reyestr tanlangan status bo‘yicha filtrlanadi.
          </p>
        </div>
      </UiCard>
    </section>

    <UiCard
      title="Shartnoma asosida to‘lovlar"
      subtitle="Tarif jadvali bo‘yicha hisoblangan xizmatlar"
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
          <p class="text-[12px] text-ink-500">Ijarachi</p>
          <p class="mt-0.5 text-[13.5px] font-semibold text-ink-900">{{ activeContract.tenant }}</p>
        </div>
        <div>
          <p class="text-[12px] text-ink-500">Obyekt / Unit</p>
          <p class="mt-0.5 text-[13.5px] font-semibold text-ink-900">
            {{ activeContract.buildingName }} · {{ activeContract.unitCode }}
          </p>
        </div>
        <div>
          <p class="text-[12px] text-ink-500">To‘lov shakli</p>
          <p class="mt-0.5 text-[13.5px] font-semibold text-ink-900">
            {{ activeContract.paymentTerm }}
          </p>
        </div>
      </div>

      <UiTable
        :columns="[
          { key: 'service', label: 'Xizmat turi' },
          { key: 'unit', label: 'O‘lchov birligi' },
          { key: 'tariff', label: 'Tarif', align: 'right', numeric: true },
          { key: 'qty', label: 'Miqdor', align: 'right', numeric: true },
          { key: 'sum', label: 'Summa', align: 'right', numeric: true },
        ]"
        :rows="TARIFF_LINES.map((t) => ({ ...t, id: t.service }))"
      >
        <template #cell-service="{ row }">
          <span class="font-semibold text-ink-900">{{ row.service }}</span>
        </template>
        <template #cell-tariff="{ row }">{{ sum(Number(row.tariff)) }}</template>
        <template #cell-qty="{ row }">{{ num(Number(row.qty)) }}</template>
        <template #cell-sum="{ row }">{{ sum(Number(row.sum)) }}</template>
      </UiTable>

      <div
        class="flex items-center justify-between gap-4 border-t border-ink-200 bg-surface-sunken px-5 py-4"
      >
        <span class="text-[13.5px] font-bold text-ink-900">Jami</span>
        <span class="tabular text-[15px] font-bold text-ink-900">{{ sum(tariffTotal) }}</span>
      </div>
    </UiCard>

    <UiModal
      v-model="detailOpen"
      size="lg"
      :title="active ? active.code : 'Hisob-faktura'"
      :subtitle="active ? `${active.tenant} · ${active.period}` : ''"
    >
      <div v-if="active" class="space-y-6">
        <div class="flex flex-wrap items-center gap-3">
          <UiStatus kind="invoice" :value="active.status" />
          <span class="text-[13px] text-ink-500">
            Berilgan: {{ dateShort(active.issuedAt) }} · To‘lov muddati:
            {{ dateShort(active.dueAt) }}
          </span>
        </div>

        <dl class="grid gap-4 sm:grid-cols-3">
          <div class="rounded-field bg-surface-sunken p-3.5">
            <dt class="text-[12px] text-ink-500">Jami summa</dt>
            <dd class="tabular mt-1 text-[15px] font-bold text-ink-900">{{ sum(active.total) }}</dd>
          </div>
          <div class="rounded-field bg-surface-sunken p-3.5">
            <dt class="text-[12px] text-ink-500">To‘langan</dt>
            <dd class="tabular mt-1 text-[15px] font-bold text-ok-600">{{ sum(active.paid) }}</dd>
          </div>
          <div class="rounded-field bg-surface-sunken p-3.5">
            <dt class="text-[12px] text-ink-500">Qoldiq</dt>
            <dd class="tabular mt-1 text-[15px] font-bold text-danger-600">
              {{ sum(active.total - active.paid) }}
            </dd>
          </div>
        </dl>

        <dl class="grid gap-x-6 gap-y-3 border-t border-ink-100 pt-5 sm:grid-cols-2">
          <div class="flex items-baseline justify-between gap-4">
            <dt class="text-[13px] text-ink-500">Obyekt</dt>
            <dd class="text-[13.5px] font-semibold text-ink-900">{{ active.buildingName }}</dd>
          </div>
          <div class="flex items-baseline justify-between gap-4">
            <dt class="text-[13px] text-ink-500">Unit</dt>
            <dd class="text-[13.5px] font-semibold text-ink-900">{{ active.unitCode }}</dd>
          </div>
          <div class="flex items-baseline justify-between gap-4">
            <dt class="text-[13px] text-ink-500">Davr</dt>
            <dd class="text-[13.5px] font-semibold text-ink-900">{{ active.period }}</dd>
          </div>
          <div class="flex items-baseline justify-between gap-4">
            <dt class="text-[13px] text-ink-500">Qarzdorlik guruhi</dt>
            <dd class="text-[13.5px] font-semibold text-ink-900">
              {{ agingLabel(active.agingBucket) }}
            </dd>
          </div>
        </dl>

        <section v-if="activePayments.length" class="border-t border-ink-100 pt-5">
          <p class="text-[14px] font-bold text-ink-900">To‘lovlar tarixi</p>
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
                class="tabular shrink-0 text-[13.5px] font-bold"
                :class="p.kind === 'payment' ? 'text-ok-600' : 'text-danger-600'"
              >
                {{ p.kind === 'payment' ? sum(p.amount) : 'Qaytarildi' }}
              </span>
            </li>
          </ul>
        </section>

        <div v-if="canConfirm && payable" class="rounded-card bg-surface-sunken p-4 ring-1 ring-ink-200/70">
          <p class="text-[14px] font-bold text-ink-900">To‘lov qabul qilish</p>
          <div class="mt-4 grid gap-4 sm:grid-cols-2">
            <UiField label="To‘lov summasi" required>
              <UiInput v-model="payAmount" type="number" placeholder="0" :invalid="!payValid" />
            </UiField>
            <UiField label="To‘lov sanasi" required>
              <UiInput v-model="payDate" type="date" />
            </UiField>
            <UiField label="To‘lov usuli">
              <UiSelect v-model="payMethod" :options="methodOptions" />
            </UiField>
            <UiField label="Izoh" hint="Bank hujjati raqami yoki qisqa izoh">
              <UiInput v-model="payNote" placeholder="To‘lov topshiriqnomasi raqami" />
            </UiField>
          </div>
          <p v-if="!payValid" class="mt-3 text-[12px] font-medium text-danger-600">
            Summa 0 dan katta va qoldiqdan oshmasligi kerak.
          </p>
        </div>
      </div>

      <template #footer>
        <UiButton variant="ghost" @click="detailOpen = false">Yopish</UiButton>
        <UiButton
          v-if="canConfirm && payable"
          variant="success"
          :disabled="!payValid"
          @click="acceptPayment"
        >
          <UiIcon name="check" :size="16" />
          To‘lov qabul qilish
        </UiButton>
      </template>
    </UiModal>

    <UiModal
      v-if="canCreate"
      v-model="createOpen"
      title="Yangi hisob-faktura"
      subtitle="Shartnoma va tarif jadvali asosida hisob-faktura shakllantiriladi"
    >
      <div class="grid gap-4 sm:grid-cols-2">
        <UiField label="Ijarachi" required class="sm:col-span-2">
          <UiInput v-model="form.tenant" placeholder="Tashkilot nomi" />
        </UiField>
        <UiField label="Obyekt" required>
          <UiSelect
            v-model="form.building"
            :options="BUILDINGS.map((b) => ({ value: b.name, label: b.name }))"
          />
        </UiField>
        <UiField label="Unit">
          <UiInput v-model="form.unitCode" placeholder="Unit 502" />
        </UiField>
        <UiField label="Hisob davri" required>
          <UiSelect v-model="form.period" :options="createPeriods" />
        </UiField>
        <UiField label="To‘lov muddati" required>
          <UiInput v-model="form.dueAt" type="date" />
        </UiField>
        <UiField label="Jami summa" required hint="QQS bilan birga, so‘mda" class="sm:col-span-2">
          <UiInput v-model="form.total" type="number" placeholder="0" />
        </UiField>
      </div>

      <template #footer>
        <UiButton variant="ghost" @click="createOpen = false">Bekor qilish</UiButton>
        <UiButton :disabled="!createValid" @click="createInvoice">
          <UiIcon name="check" :size="16" />
          Yaratish
        </UiButton>
      </template>
    </UiModal>
  </main>
</template>
