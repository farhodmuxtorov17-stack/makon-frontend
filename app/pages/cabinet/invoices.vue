<script setup lang="ts">
import { billingSummaryOf, CONTRACTS, INVOICES, type Invoice } from '~/data/business'
import { buildingById } from '~/data/buildings'
import { UNITS, type Unit } from '~/data/units'
import {
  formatStir,
  LANDLORD_STIR,
  ORGANIZATIONS,
  organizationByStir,
} from '~/data/organizations'
import { docxBlob, fileSlug, saveBlob, type DocxLine } from '~/utils/docx'
import { dateShort, monthTitle, num, sum, todayIso } from '~/utils/format'

const auth = useAuthStore()
const lease = useLeaseStore()
const { t } = useI18n()
const { money, field, statusLabel, monthName } = useAppLabels()

lease.seed()

/** Hisob davri ma’lumotda «Avgust 2026» ko‘rinishida saqlanadi */
const UZ_MONTHS = [
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

/** «Avgust 2026» → tanlangan tildagi davr nomi */
function periodLabel(label: string) {
  const [month, year] = String(label ?? '').split(' ')
  const index = UZ_MONTHS.indexOf(month ?? '')
  if (index < 0 || !year) return label
  return t('dateFormat.monthTitle', { month: monthName(index + 1), year })
}

/** To‘lov shakli ma’lumotda o‘zbekcha qiymat sifatida saqlanadi */
const PAYMENT_TERM_KEY: Record<string, string> = {
  'Bir martalik to‘lov': 'paymentTerm.oneTime',
  'Choraklik to‘lov': 'paymentTerm.quarterly',
  'Oylik oldindan to‘lov': 'paymentTerm.monthlyAdvance',
}

function paymentTermLabel(value: string) {
  const key = PAYMENT_TERM_KEY[value]
  return key ? t(key) : value
}

/** Kabinet faqat kirgan foydalanuvchining tashkiloti bilan ishlaydi */
const organization = computed(() => auth.user?.organization ?? '')

/**
 * Yagona hisob-faktura reyestri: buxgalteriya qaysi hujjatlarni ko‘rsa,
 * ijarachi ham aynan shularni ko‘radi, faqat o‘z tashkiloti kesimida.
 */
const MY_INVOICES = computed(() =>
  INVOICES.filter((i) => organization.value && i.tenant === organization.value),
)

/** «Unit 501» va «501» yozuvlari bir xil unitga ishora qiladi */
function unitCodeOf(value: string) {
  return String(value ?? '').replace(/^\s*Unit\s*/i, '').trim()
}

function unitOfInvoice(inv: Invoice): Unit | undefined {
  const code = unitCodeOf(inv.unitCode)
  return UNITS.find(
    (u) => u.code === code && buildingById(u.buildingId)?.name === inv.buildingName,
  )
}

/** Obyekt nomi unit → bino bog‘lanishidan olinadi, qattiq yozilmaydi */
function buildingNameOf(inv: Invoice) {
  const u = unitOfInvoice(inv)
  return (u ? buildingById(u.buildingId)?.name : undefined) ?? inv.buildingName
}

/** Hisob-faktura tegishli shartnoma: unit kodi va ijarachi bo‘yicha */
function contractOfInvoice(inv: Invoice) {
  const code = unitCodeOf(inv.unitCode)
  return CONTRACTS.find(
    (c) => c.tenant === inv.tenant && unitCodeOf(c.unitCode) === code && c.status === 'ACTIVE',
  )
}

/**
 * Faollashtirilgan ijara siklining to‘lov grafigi. Hisob-faktura qatorlari
 * aynan shu grafikdan olinadi, shuning uchun hujjatdagi summa shartnomadagi
 * summadan farq qilmaydi.
 */
function scheduleRowOf(inv: Invoice) {
  const item = lease.cases.find((c) => c.activation?.invoiceCode === inv.code)
  if (!item) return null
  return (
    item.schedule.find((r) => r.kind === 'RENT' && r.label === inv.period) ??
    item.schedule.find((r) => r.kind === 'RENT') ??
    null
  )
}

// ---------------------------------------------------------------------------
// Jamlar: formula buxgalteriya ekranlari bilan bir xil (billingSummaryOf)

/** Joriy hisob davri, unda hujjat bo‘lmasa oxirgi berilgan davr */
const currentPeriod = computed(() => {
  const thisMonth = monthTitle(todayIso())
  if (MY_INVOICES.value.some((i) => i.period === thisMonth)) return thisMonth
  return (
    [...MY_INVOICES.value].sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))[0]?.period ??
    thisMonth
  )
})

const periodSummary = computed(() =>
  billingSummaryOf(MY_INVOICES.value.filter((i) => i.period === currentPeriod.value)),
)

/** Qarzdorlik = Σ max(0, jami − to‘langan), reyestrdagi debtTotal bilan bir xil */
const summary = computed(() => billingSummaryOf(MY_INVOICES.value))

/** Muddati o‘tgan hujjat: qoldig‘i bor va to‘lov sanasi o‘tib ketgan */
function isOverdue(i: Invoice) {
  return i.total > i.paid && i.dueAt < todayIso()
}

const overdueCount = computed(() => MY_INVOICES.value.filter(isOverdue).length)

const nextDue = computed(
  () =>
    MY_INVOICES.value
      .filter((i) => i.total > i.paid)
      .map((i) => i.dueAt)
      .sort()[0] ?? '-',
)

const status = ref('all')
const query = ref('')

const statusTabs = computed(() => [
  { value: 'all', label: t('tab.all'), count: MY_INVOICES.value.length },
  {
    value: 'PAID',
    label: statusLabel('invoice', 'PAID'),
    count: MY_INVOICES.value.filter((i) => i.status === 'PAID').length,
  },
  {
    value: 'PARTIALLY_PAID',
    label: statusLabel('invoice', 'PARTIALLY_PAID'),
    count: MY_INVOICES.value.filter((i) => i.status === 'PARTIALLY_PAID').length,
  },
  {
    value: 'ISSUED',
    label: statusLabel('invoice', 'ISSUED'),
    count: MY_INVOICES.value.filter((i) => i.status === 'ISSUED').length,
  },
  {
    value: 'OVERDUE',
    label: statusLabel('invoice', 'OVERDUE'),
    count: overdueCount.value,
  },
])

const filtered = computed(() =>
  MY_INVOICES.value.filter((i) => {
    const byStatus =
      status.value === 'all' ||
      (status.value === 'OVERDUE' ? isOverdue(i) : i.status === status.value)
    const q = query.value.trim().toLowerCase()
    const byQuery =
      !q ||
      i.code.toLowerCase().includes(q) ||
      i.period.toLowerCase().includes(q) ||
      i.unitCode.toLowerCase().includes(q)
    return byStatus && byQuery
  }),
)

const columns = computed(() => [
  { key: 'code', label: field('invoiceNo') },
  { key: 'period', label: field('period') },
  { key: 'unitCode', label: field('unit') },
  { key: 'issuedAt', label: field('issuedAt') },
  { key: 'dueAt', label: field('dueDate') },
  { key: 'total', label: field('amount'), align: 'right' as const, numeric: true },
  { key: 'paid', label: field('paid'), align: 'right' as const, numeric: true },
  { key: 'status', label: field('status'), align: 'right' as const },
])

// ---------------------------------------------------------------------------
// Tomonlar rekvizitlari: rasmiy hujjatning majburiy qismi

interface PartyRequisites {
  name: string
  stir: string
  address: string
  director: string
  bank: string
  account: string
}

/** Ijaraga beruvchi, tashkilotlar reyestridan */
const landlord = computed<PartyRequisites>(() => {
  const o = organizationByStir(LANDLORD_STIR)
  return {
    name: o?.name ?? '',
    stir: formatStir(o?.stir ?? LANDLORD_STIR),
    address: o?.address ?? '',
    director: o?.director ?? '',
    bank: o?.bank ?? '',
    account: o?.account ?? '',
  }
})

/** Xaridor: kirgan foydalanuvchining tashkiloti */
const buyer = computed<PartyRequisites>(() => {
  const o =
    organizationByStir(auth.user?.tin ?? '') ??
    ORGANIZATIONS.find((x) => x.name === organization.value)
  return {
    name: o?.name ?? organization.value,
    stir: formatStir(o?.stir ?? auth.user?.tin ?? ''),
    address: o?.address ?? auth.user?.address ?? '',
    director: o?.director ?? auth.user?.fullName ?? '',
    bank: o?.bank ?? '',
    account: o?.account ?? '',
  }
})

function partyRows(p: PartyRequisites) {
  return [
    { label: field('name'), value: p.name },
    { label: 'STIR', value: p.stir },
    { label: field('legalAddress'), value: p.address },
    { label: field('bank'), value: p.bank },
    { label: field('account'), value: p.account },
    { label: field('director'), value: p.director },
  ].filter((r) => r.value)
}

function partyLines(title: string, p: PartyRequisites): DocxLine[] {
  return [
    { text: title, style: 'heading' },
    ...partyRows(p).map((r) => ({ text: `${r.label}: ${r.value}` })),
  ]
}

// ---------------------------------------------------------------------------
// Hisob-faktura tarkibi

/** Summaga kiritilgan qo‘shilgan qiymat solig‘i stavkasi, foiz */
const VAT_RATE = 12

/** QQS summaga kiritilgan, shuning uchun ajratib olinadi (business.ts bilan bir xil) */
function vatOf(total: number) {
  return Math.round(total - total / (1 + VAT_RATE / 100))
}

interface InvoiceLine {
  service: string
  unit: string
  qty: number
  tariff: number
  total: number
}

/** Miqdor butun bo‘lsa kasr qismi ko‘rsatilmaydi: «1 oy», «1.5 oy» */
function qty(value: number) {
  return num(value, Number.isInteger(value) ? 0 : 1)
}

const detailOpen = ref(false)
const printOpen = ref(false)
const savedFile = ref('')
const selected = ref<Invoice | null>(null)

function openInvoice(inv: Invoice) {
  selected.value = MY_INVOICES.value.find((i) => i.id === inv.id) ?? null
  savedFile.value = ''
  detailOpen.value = true
}

/**
 * Xizmat qatorlari shartnoma grafigidan olinadi. Grafik bo‘lmasa, unitning
 * shartnomaviy oylik ijara narxi ajratiladi va qolgani servis to‘lovi bo‘ladi.
 * Kommunal qatorlar bu yerda hisoblanmaydi: hisoblagich ko‘rsatkichi
 * hisob-fakturaga hali bog‘lanmagan.
 */
function linesOf(inv: Invoice): InvoiceLine[] {
  const row = scheduleRowOf(inv)
  if (row) {
    const months = Math.max(1, row.months)
    const out: InvoiceLine[] = [
      {
        service: t('cab.rentPayment'),
        unit: t('unitOf.month'),
        qty: months,
        tariff: Math.round(row.rent / months),
        total: row.rent,
      },
    ]
    if (row.service > 0) {
      out.push({
        service: t('cab.servicePayment'),
        unit: t('unitOf.month'),
        qty: months,
        tariff: Math.round(row.service / months),
        total: row.service,
      })
    }
    return out
  }

  const u = unitOfInvoice(inv)
  const monthlyRent = u && u.priceUnit === 'so‘m / oy' ? u.price : 0
  const rent = Math.min(monthlyRent || inv.total, inv.total)
  const out: InvoiceLine[] = [
    { service: t('cab.rentPayment'), unit: t('unitOf.month'), qty: 1, tariff: rent, total: rent },
  ]
  const rest = inv.total - rent
  if (rest > 0) {
    out.push({
      service: t('cab.serviceAndManagement'),
      unit: t('unitOf.month'),
      qty: 1,
      tariff: rest,
      total: rest,
    })
  }
  return out
}

const lines = computed<InvoiceLine[]>(() => (selected.value ? linesOf(selected.value) : []))
const linesTotal = computed(() => lines.value.reduce((a, l) => a + l.total, 0))
const linesVat = computed(() => vatOf(linesTotal.value))
const linesNet = computed(() => linesTotal.value - linesVat.value)

const selectedBuilding = computed(() =>
  selected.value ? buildingNameOf(selected.value) : '',
)
const selectedContract = computed(() =>
  selected.value ? contractOfInvoice(selected.value) : undefined,
)

function openPrint() {
  printOpen.value = true
}

/** Chop etish oynasidagi hujjatni brauzer chop etish oynasiga beradi */
function printInvoice() {
  if (import.meta.client) window.print()
}

/** Hisob-faktura matni Word hujjati sifatida yig‘iladi */
function invoiceLines(inv: Invoice): DocxLine[] {
  const rows = linesOf(inv)
  const total = rows.reduce((a, l) => a + l.total, 0)
  const vat = vatOf(total)
  const contract = contractOfInvoice(inv)

  const out: DocxLine[] = [
    { text: landlord.value.name, style: 'subtitle' },
    { text: t('field.invoice'), style: 'title' },
    { text: `${inv.code} · ${dateShort(inv.issuedAt)}`, style: 'subtitle' },
    ...partyLines(t('cab.supplierLandlord'), landlord.value),
    ...partyLines(t('cab.buyerTenant'), buyer.value),
    { text: t('cab.invoiceInfo'), style: 'heading' },
    {
      text: t('cab.docObject', {
        value: `${buildingNameOf(inv)} · Unit ${unitCodeOf(inv.unitCode)}`,
      }),
    },
    { text: t('cab.docBillingPeriod', { value: periodLabel(inv.period) }) },
    { text: t('cab.docIssuedAt', { value: dateShort(inv.issuedAt) }) },
    { text: t('cab.docDueAt', { value: dateShort(inv.dueAt) }) },
  ]

  if (contract) {
    out.push(
      {
        text: t('cab.docContract', {
          value: `${contract.code} · ${dateShort(contract.startsAt)}`,
        }),
      },
      { text: t('cab.docPaymentForm', { value: paymentTermLabel(contract.paymentTerm) }) },
    )
  }

  out.push({ text: t('cab.services'), style: 'heading' })
  rows.forEach((l, index) => {
    out.push({
      text: t('cab.docServiceLine', {
        no: index + 1,
        service: l.service,
        qty: qty(l.qty),
        unit: l.unit,
        tariff: sum(l.tariff),
        rate: VAT_RATE,
        vat: sum(vatOf(l.total)),
        total: sum(l.total),
      }),
    })
  })

  out.push(
    { text: t('cab.summary'), style: 'heading' },
    { text: t('cab.docNetTotal', { value: sum(total - vat) }) },
    { text: t('cab.docVat', { rate: VAT_RATE, value: sum(vat) }) },
    { text: t('cab.docTotalPayment', { value: sum(total) }) },
    { text: t('cab.docPaid', { value: sum(inv.paid) }) },
    { text: t('cab.docBalance', { value: sum(Math.max(inv.total - inv.paid, 0)) }) },
    { text: t('cab.docSignLandlord', { name: landlord.value.director }), style: 'small' },
    { text: t('cab.docSignTenant', { name: buyer.value.director }), style: 'small' },
  )

  return out
}

/** Fayl nomi hujjat turini ham, raqamini ham o‘z ichiga oladi */
function invoiceFileName(inv: Invoice) {
  return `${fileSlug('Hisob-faktura')}-${inv.code}.docx`
}

function downloadInvoice() {
  const inv = selected.value
  if (!inv) return
  const fileName = invoiceFileName(inv)
  saveBlob(docxBlob(invoiceLines(inv)), fileName)
  savedFile.value = fileName
}
</script>

<template>
  <AppTopbar
    :title="t('nav.myInvoices')"
    :subtitle="t('cab.invoicesCaption')"
    :breadcrumb="[{ label: t('cab.title'), to: '/cabinet' }, { label: t('nav.myInvoices') }]"
  >
    <template #actions>
      <UiButton variant="secondary" size="sm" to="/cabinet/documents">
        <UiIcon name="doc" :size="16" />
        {{ t('common.documents') }}
      </UiButton>
      <UiButton size="sm" to="/cabinet/meters">
        <UiIcon name="meter" :size="16" />
        {{ t('nav.meters') }}
      </UiButton>
    </template>
  </AppTopbar>

  <main class="scroll-slim flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
    <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <UiKpi
        :label="t('cab.periodBill', { period: periodLabel(currentPeriod) })"
        :value="num(periodSummary.charged)"
        :unit="t('unitOf.currency')"
        icon="wallet"
        tone="brand"
      />
      <UiKpi
        :label="t('cab.paidInPeriod', { period: periodLabel(currentPeriod) })"
        :value="num(periodSummary.paidTotal)"
        :unit="t('unitOf.currency')"
        icon="check"
        tone="ok"
      />
      <UiKpi
        :label="t('kpi.debt')"
        :value="num(summary.debtTotal)"
        :unit="t('unitOf.currency')"
        icon="warning"
        :tone="summary.debtTotal > 0 ? 'danger' : 'ok'"
      />
      <UiKpi
        :label="t('kpi.nextPaymentDate')"
        :value="nextDue === '-' ? '-' : dateShort(nextDue)"
        icon="calendar"
        tone="violet"
      />
    </section>

    <UiCard :title="t('nav.invoices')" :subtitle="t('cab.invoicesTableCaption')" flush>
      <template #actions>
        <span class="rounded-pill bg-brand-50 px-2.5 py-1 text-[12px] font-bold text-brand-700">
          {{ t('cab.recordCount', { n: filtered.length }) }}
        </span>
      </template>

      <UiEmpty
        v-if="!MY_INVOICES.length"
        icon="wallet"
        :title="t('empty.noInvoicesIssued')"
        :description="t('cab.noInvoicesDesc', { org: organization || t('cab.yourOrganization') })"
        :action-label="t('nav.myDocuments')"
        action-to="/cabinet/documents"
      />

      <template v-else>
        <div class="flex flex-wrap items-center gap-3 px-5 pb-4">
          <UiTabs v-model="status" :tabs="statusTabs" />
          <UiInput
            v-model="query"
            :placeholder="t('cab.invoiceSearchPlaceholder')"
            class="w-full sm:w-72"
          >
            <template #prefix><UiIcon name="search" :size="16" /></template>
          </UiInput>
        </div>

        <UiTable
          :columns="columns"
          :rows="filtered"
          :empty="t('empty.noInvoicesForFilter')"
          @row-click="openInvoice"
        >
          <template #cell-code="{ row }">
            <span class="text-[14px] font-semibold text-ink-900">{{ row.code }}</span>
          </template>
          <template #cell-period="{ value }">{{ periodLabel(String(value)) }}</template>
          <template #cell-unitCode="{ value }">{{ value }}</template>
          <template #cell-issuedAt="{ value }">
            <span class="tabular">{{ dateShort(String(value)) }}</span>
          </template>
          <template #cell-dueAt="{ value }">
            <span class="tabular">{{ dateShort(String(value)) }}</span>
          </template>
          <template #cell-total="{ value }">{{ money(Number(value)) }}</template>
          <template #cell-paid="{ value }">{{ money(Number(value)) }}</template>
          <template #cell-status="{ row }">
            <UiStatus kind="invoice" :value="isOverdue(row) ? 'OVERDUE' : String(row.status)" size="sm" />
          </template>
        </UiTable>
      </template>
    </UiCard>
  </main>

  <UiModal
    v-model="detailOpen"
    :title="selected?.code ?? t('field.invoice')"
    :subtitle="selected ? `${periodLabel(selected.period)} · ${selected.unitCode}` : ''"
    size="lg"
  >
    <div v-if="selected" class="space-y-4">
      <div class="grid gap-3 sm:grid-cols-3">
        <div class="rounded-field p-3.5 ring-1 ring-ink-200">
          <p class="text-[12px] text-ink-500">{{ field('totalSum') }}</p>
          <p class="tabular mt-1 text-[18px] font-bold text-ink-900">
            {{ num(selected.total) }} {{ t('unitOf.currency') }}
          </p>
        </div>
        <div class="rounded-field p-3.5 ring-1 ring-ink-200">
          <p class="text-[12px] text-ink-500">{{ field('paid') }}</p>
          <p class="tabular mt-1 text-[18px] font-bold text-ok-700">
            {{ num(selected.paid) }} {{ t('unitOf.currency') }}
          </p>
        </div>
        <div class="rounded-field p-3.5 ring-1 ring-ink-200">
          <p class="text-[12px] text-ink-500">{{ field('balance') }}</p>
          <p class="tabular mt-1 text-[18px] font-bold text-ink-900">
            {{ num(selected.total - selected.paid) }} {{ t('unitOf.currency') }}
          </p>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <UiStatus kind="invoice" :value="isOverdue(selected) ? 'OVERDUE' : selected.status" />
        <span class="text-[13px] text-ink-500">
          {{
            t('cab.issuedAndDue', {
              issued: dateShort(selected.issuedAt),
              due: dateShort(selected.dueAt),
            })
          }}
        </span>
      </div>

      <div class="grid gap-3 sm:grid-cols-2">
        <div class="rounded-field bg-surface-sunken p-4 ring-1 ring-ink-200">
          <p class="text-[12px] font-semibold uppercase tracking-wide text-ink-500">
            {{ field('supplier') }}
          </p>
          <dl class="mt-2 space-y-1">
            <div v-for="r in partyRows(landlord)" :key="`l-${r.label}`" class="flex gap-2">
              <dt class="w-28 shrink-0 text-[12px] text-ink-500">{{ r.label }}</dt>
              <dd class="min-w-0 flex-1 text-[13px] font-semibold text-ink-900">{{ r.value }}</dd>
            </div>
          </dl>
        </div>
        <div class="rounded-field bg-surface-sunken p-4 ring-1 ring-ink-200">
          <p class="text-[12px] font-semibold uppercase tracking-wide text-ink-500">
            {{ field('buyer') }}
          </p>
          <dl class="mt-2 space-y-1">
            <div v-for="r in partyRows(buyer)" :key="`b-${r.label}`" class="flex gap-2">
              <dt class="w-28 shrink-0 text-[12px] text-ink-500">{{ r.label }}</dt>
              <dd class="min-w-0 flex-1 text-[13px] font-semibold text-ink-900">{{ r.value }}</dd>
            </div>
          </dl>
        </div>
      </div>

      <dl class="grid gap-3 rounded-field p-4 ring-1 ring-ink-200 sm:grid-cols-3">
        <div>
          <dt class="text-[12px] uppercase tracking-wide text-ink-500">{{ field('object') }}</dt>
          <dd class="text-[13px] font-semibold text-ink-900">
            {{ selectedBuilding }} · {{ selected.unitCode }}
          </dd>
        </div>
        <div>
          <dt class="text-[12px] uppercase tracking-wide text-ink-500">
            {{ field('billingPeriod') }}
          </dt>
          <dd class="text-[13px] font-semibold text-ink-900">{{ periodLabel(selected.period) }}</dd>
        </div>
        <div>
          <dt class="text-[12px] uppercase tracking-wide text-ink-500">{{ field('contract') }}</dt>
          <dd class="text-[13px] font-semibold text-ink-900">
            {{ selectedContract?.code ?? t('common.notAssigned') }}
          </dd>
        </div>
      </dl>

      <div class="overflow-x-auto rounded-field ring-1 ring-ink-200">
        <table class="w-full min-w-max border-collapse text-sm">
          <thead>
            <tr class="border-b border-ink-200 bg-surface-sunken">
              <th class="px-4 py-2.5 text-left text-[12px] font-semibold uppercase tracking-wide text-ink-500">
                {{ field('service') }}
              </th>
              <th class="px-4 py-2.5 text-left text-[12px] font-semibold uppercase tracking-wide text-ink-500">
                {{ field('measure') }}
              </th>
              <th class="px-4 py-2.5 text-right text-[12px] font-semibold uppercase tracking-wide text-ink-500">
                {{ field('tariff') }}
              </th>
              <th class="px-4 py-2.5 text-right text-[12px] font-semibold uppercase tracking-wide text-ink-500">
                {{ field('quantity') }}
              </th>
              <th class="px-4 py-2.5 text-right text-[12px] font-semibold uppercase tracking-wide text-ink-500">
                {{ t('cab.vatPercent', { rate: VAT_RATE }) }}
              </th>
              <th class="px-4 py-2.5 text-right text-[12px] font-semibold uppercase tracking-wide text-ink-500">
                {{ field('amount') }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="l in lines" :key="l.service" class="border-b border-ink-100">
              <td class="px-4 py-2.5 font-medium text-ink-900">{{ l.service }}</td>
              <td class="px-4 py-2.5 text-ink-600">{{ l.unit }}</td>
              <td class="tabular px-4 py-2.5 text-right text-ink-700">{{ num(l.tariff) }}</td>
              <td class="tabular px-4 py-2.5 text-right text-ink-700">{{ qty(l.qty) }}</td>
              <td class="tabular px-4 py-2.5 text-right text-ink-700">{{ num(vatOf(l.total)) }}</td>
              <td class="tabular px-4 py-2.5 text-right font-semibold text-ink-900">{{ num(l.total) }}</td>
            </tr>
            <tr class="border-b border-ink-100">
              <td colspan="5" class="px-4 py-2 text-right text-[13px] text-ink-600">
                {{ t('cab.netTotal') }}
              </td>
              <td class="tabular px-4 py-2 text-right text-[13px] font-semibold text-ink-800">
                {{ num(linesNet) }}
              </td>
            </tr>
            <tr class="border-b border-ink-100">
              <td colspan="5" class="px-4 py-2 text-right text-[13px] text-ink-600">
                {{ t('cab.vatPercent', { rate: VAT_RATE }) }}
              </td>
              <td class="tabular px-4 py-2 text-right text-[13px] font-semibold text-ink-800">
                {{ num(linesVat) }}
              </td>
            </tr>
            <tr class="bg-surface-sunken">
              <td colspan="5" class="px-4 py-3 text-right text-[13px] font-semibold text-ink-700">
                {{ t('cab.totalPayment') }}
              </td>
              <td class="tabular px-4 py-3 text-right text-[16px] font-bold text-ink-900">
                {{ num(linesTotal) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <p v-if="savedFile" class="mt-4 flex items-start gap-2 text-[13px] font-semibold text-ok-700">
      <UiIcon name="check" :size="16" class="mt-px shrink-0" />
      <span class="min-w-0">{{ t('cab.fileSaved', { name: savedFile }) }}</span>
    </p>

    <template #footer>
      <UiButton variant="ghost" @click="detailOpen = false">{{ t('common.close') }}</UiButton>
      <UiButton variant="secondary" @click="downloadInvoice">
        <UiIcon name="download" :size="16" />
        {{ t('common.download') }}
      </UiButton>
      <UiButton variant="secondary" @click="openPrint">
        <UiIcon name="print" :size="16" />
        {{ t('cab.printPreview') }}
      </UiButton>
    </template>
  </UiModal>

  <UiModal
    v-model="printOpen"
    :title="t('cab.printPreview')"
    :subtitle="selected ? `${selected.code} · ${periodLabel(selected.period)}` : ''"
    size="lg"
  >
    <div v-if="selected" class="rounded-field bg-white p-6 ring-1 ring-ink-200">
      <div class="flex flex-wrap items-start justify-between gap-6 border-b border-ink-200 pb-4">
        <div class="min-w-0">
          <span class="text-brand-600"><AppLogo size="sm" mono /></span>
          <p class="mt-2 text-[12px] text-ink-500">{{ landlord.name }}</p>
          <p class="text-[12px] text-ink-500">{{ landlord.address }}</p>
        </div>
        <div class="text-right">
          <p class="text-[16px] font-bold text-ink-900">{{ t('field.invoice') }}</p>
          <p class="tabular text-[13px] font-semibold text-ink-700">{{ selected.code }}</p>
          <p class="tabular text-[12px] text-ink-500">
            {{ t('cab.dateIs', { date: dateShort(selected.issuedAt) }) }}
          </p>
        </div>
      </div>

      <div class="grid gap-4 border-b border-ink-200 py-4 sm:grid-cols-2">
        <div>
          <p class="text-[12px] uppercase tracking-wide text-ink-500">{{ field('supplier') }}</p>
          <dl class="mt-1.5 space-y-0.5">
            <div v-for="r in partyRows(landlord)" :key="`pl-${r.label}`" class="flex gap-2">
              <dt class="w-28 shrink-0 text-[12px] text-ink-500">{{ r.label }}</dt>
              <dd class="min-w-0 flex-1 text-[13px] font-semibold text-ink-900">{{ r.value }}</dd>
            </div>
          </dl>
        </div>
        <div>
          <p class="text-[12px] uppercase tracking-wide text-ink-500">{{ field('buyer') }}</p>
          <dl class="mt-1.5 space-y-0.5">
            <div v-for="r in partyRows(buyer)" :key="`pb-${r.label}`" class="flex gap-2">
              <dt class="w-28 shrink-0 text-[12px] text-ink-500">{{ r.label }}</dt>
              <dd class="min-w-0 flex-1 text-[13px] font-semibold text-ink-900">{{ r.value }}</dd>
            </div>
          </dl>
        </div>
      </div>

      <dl class="grid gap-3 border-b border-ink-200 py-4 sm:grid-cols-3">
        <div>
          <dt class="text-[12px] uppercase tracking-wide text-ink-500">{{ field('object') }}</dt>
          <dd class="text-[13px] font-semibold text-ink-900">
            {{ selectedBuilding }} · {{ selected.unitCode }}
          </dd>
        </div>
        <div>
          <dt class="text-[12px] uppercase tracking-wide text-ink-500">
            {{ field('billingPeriod') }}
          </dt>
          <dd class="text-[13px] font-semibold text-ink-900">{{ periodLabel(selected.period) }}</dd>
        </div>
        <div>
          <dt class="text-[12px] uppercase tracking-wide text-ink-500">{{ field('dueDate') }}</dt>
          <dd class="tabular text-[13px] font-semibold text-ink-900">{{ dateShort(selected.dueAt) }}</dd>
        </div>
      </dl>

      <table class="mt-4 w-full border-collapse text-[13px]">
        <thead>
          <tr class="border-b border-ink-200">
            <th class="py-2 text-left font-semibold text-ink-600">{{ field('serviceName') }}</th>
            <th class="py-2 text-right font-semibold text-ink-600">{{ field('quantity') }}</th>
            <th class="py-2 text-right font-semibold text-ink-600">
              {{ t('cab.vatPercent', { rate: VAT_RATE }) }}
            </th>
            <th class="py-2 text-right font-semibold text-ink-600">{{ field('amount') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="l in lines" :key="`p-${l.service}`" class="border-b border-ink-100">
            <td class="py-2 text-ink-800">{{ l.service }}</td>
            <td class="tabular py-2 text-right text-ink-700">{{ qty(l.qty) }} {{ l.unit }}</td>
            <td class="tabular py-2 text-right text-ink-700">{{ num(vatOf(l.total)) }}</td>
            <td class="tabular py-2 text-right font-semibold text-ink-900">{{ num(l.total) }}</td>
          </tr>
        </tbody>
      </table>

      <dl class="mt-4 space-y-1.5 border-t border-ink-200 pt-4">
        <div class="flex items-center justify-end gap-6">
          <dt class="text-[13px] text-ink-600">{{ t('cab.netTotal') }}</dt>
          <dd class="tabular w-40 text-right text-[13px] font-semibold text-ink-800">
            {{ money(linesNet) }}
          </dd>
        </div>
        <div class="flex items-center justify-end gap-6">
          <dt class="text-[13px] text-ink-600">{{ t('cab.vatPercent', { rate: VAT_RATE }) }}</dt>
          <dd class="tabular w-40 text-right text-[13px] font-semibold text-ink-800">
            {{ money(linesVat) }}
          </dd>
        </div>
        <div class="flex items-center justify-end gap-6">
          <dt class="text-[13px] font-semibold text-ink-700">{{ t('cab.grandTotalDue') }}</dt>
          <dd class="tabular w-40 text-right text-[18px] font-bold text-ink-900">
            {{ money(linesTotal) }}
          </dd>
        </div>
      </dl>

      <div class="mt-8 grid grid-cols-2 gap-6 text-[12px] text-ink-500">
        <div>
          <p class="border-b border-ink-300 pb-6">{{ field('landlord') }}</p>
          <p class="mt-1">{{ landlord.director }} · {{ t('cab.signAndSeal') }}</p>
        </div>
        <div>
          <p class="border-b border-ink-300 pb-6">{{ field('tenant') }}</p>
          <p class="mt-1">{{ buyer.director }} · {{ t('cab.signAndSeal') }}</p>
        </div>
      </div>
    </div>

    <template #footer>
      <UiButton variant="ghost" @click="printOpen = false">{{ t('common.close') }}</UiButton>
      <UiButton variant="secondary" @click="downloadInvoice">
        <UiIcon name="download" :size="16" />
        {{ t('common.download') }}
      </UiButton>
      <UiButton @click="printInvoice">
        <UiIcon name="print" :size="16" />
        {{ t('common.print') }}
      </UiButton>
    </template>
  </UiModal>
</template>
