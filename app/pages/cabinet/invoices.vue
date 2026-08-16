<script setup lang="ts">
import { TARIFF_LINES } from '~/data/business'
import { unitById } from '~/data/units'
import { dateShort, num, sum } from '~/utils/format'

const auth = useAuthStore()
const lease = useLeaseStore()

lease.seed()

const organization = computed(() => auth.user?.organization ?? 'Urban Office MCHJ')

type CabinetInvoice = {
  id: string
  code: string
  unitId: string
  unitCode: string
  period: string
  issuedAt: string
  dueAt: string
  total: number
  paid: number
  status: string
}

const BASE_INVOICES: CabinetInvoice[] = [
  {
    id: 'i-0621',
    code: 'INV-2025-0621',
    unitId: 'u-501',
    unitCode: '501',
    period: 'May 2025',
    issuedAt: '2025-05-01',
    dueAt: '2025-05-23',
    total: 12540000,
    paid: 0,
    status: 'ISSUED',
  },
  {
    id: 'i-0605',
    code: 'INV-2025-0605',
    unitId: 'u-501',
    unitCode: '501',
    period: 'May 2025',
    issuedAt: '2025-05-01',
    dueAt: '2025-05-25',
    total: 25900000,
    paid: 12000000,
    status: 'PARTIALLY_PAID',
  },
  {
    id: 'i-0587',
    code: 'INV-2025-0587',
    unitId: 'u-502',
    unitCode: '502',
    period: 'May 2025',
    issuedAt: '2025-05-01',
    dueAt: '2025-05-10',
    total: 12540000,
    paid: 12540000,
    status: 'PAID',
  },
  {
    id: 'i-0512',
    code: 'INV-2025-0512',
    unitId: 'u-501',
    unitCode: '501',
    period: 'Aprel 2025',
    issuedAt: '2025-04-01',
    dueAt: '2025-04-23',
    total: 12540000,
    paid: 12540000,
    status: 'PAID',
  },
  {
    id: 'i-0498',
    code: 'INV-2025-0498',
    unitId: 'u-501',
    unitCode: '501',
    period: 'Aprel 2025',
    issuedAt: '2025-04-01',
    dueAt: '2025-04-25',
    total: 25900000,
    paid: 25900000,
    status: 'PAID',
  },
  {
    id: 'i-0480',
    code: 'INV-2025-0480',
    unitId: 'u-502',
    unitCode: '502',
    period: 'Aprel 2025',
    issuedAt: '2025-04-01',
    dueAt: '2025-04-10',
    total: 12540000,
    paid: 12540000,
    status: 'PAID',
  },
  {
    id: 'i-0403',
    code: 'INV-2025-0403',
    unitId: 'u-501',
    unitCode: '501',
    period: 'Mart 2025',
    issuedAt: '2025-03-01',
    dueAt: '2025-03-23',
    total: 12540000,
    paid: 12540000,
    status: 'PAID',
  },
  {
    id: 'i-0389',
    code: 'INV-2025-0389',
    unitId: 'u-501',
    unitCode: '501',
    period: 'Mart 2025',
    issuedAt: '2025-03-01',
    dueAt: '2025-03-25',
    total: 25900000,
    paid: 25900000,
    status: 'PAID',
  },
  {
    id: 'i-0294',
    code: 'INV-2025-0294',
    unitId: 'u-501',
    unitCode: '501',
    period: 'Fevral 2025',
    issuedAt: '2025-02-01',
    dueAt: '2025-02-23',
    total: 12540000,
    paid: 12540000,
    status: 'PAID',
  },
  {
    id: 'i-0186',
    code: 'INV-2025-0186',
    unitId: 'u-501',
    unitCode: '501',
    period: 'Yanvar 2025',
    issuedAt: '2025-01-01',
    dueAt: '2025-01-23',
    total: 12540000,
    paid: 12540000,
    status: 'PAID',
  },
]

/** Faollashtirilgan shartnomalar bo‘yicha shakllantirilgan hisob-fakturalar */
const MY_INVOICES = computed<CabinetInvoice[]>(() => [
  ...lease.activeCases
    .filter((c) => c.org.name === organization.value)
    .flatMap((c) => {
      const first = c.schedule.find((r) => r.kind === 'RENT')
      if (!first || !c.activation) return []
      return [
        {
          id: `i-${c.activation.invoiceCode.slice(-4)}`,
          code: c.activation.invoiceCode,
          unitId: c.unitId,
          unitCode: c.unitCode,
          period: first.label,
          issuedAt: c.activation.at.slice(0, 10),
          dueAt: first.dueAt,
          total: first.total,
          paid: 0,
          status: 'ISSUED',
        },
      ]
    }),
  ...BASE_INVOICES,
])

const CURRENT_PERIOD = 'May 2025'

const currentTotal = computed(() =>
  MY_INVOICES.value.filter((i) => i.period === CURRENT_PERIOD).reduce((a, i) => a + i.total, 0),
)
const currentPaid = computed(() =>
  MY_INVOICES.value.filter((i) => i.period === CURRENT_PERIOD).reduce((a, i) => a + i.paid, 0),
)
const overdueTotal = computed(() =>
  MY_INVOICES.value.filter((i) => i.status === 'OVERDUE').reduce((a, i) => a + (i.total - i.paid), 0),
)
const nextDue = computed(
  () =>
    MY_INVOICES.value.filter((i) => i.total > i.paid)
      .map((i) => i.dueAt)
      .sort()[0] ?? '—',
)

const status = ref('all')
const query = ref('')

const statusTabs = computed(() => [
  { value: 'all', label: 'Barchasi', count: MY_INVOICES.value.length },
  { value: 'PAID', label: 'To‘langan', count: MY_INVOICES.value.filter((i) => i.status === 'PAID').length },
  {
    value: 'PARTIALLY_PAID',
    label: 'Qisman to‘langan',
    count: MY_INVOICES.value.filter((i) => i.status === 'PARTIALLY_PAID').length,
  },
  {
    value: 'ISSUED',
    label: 'Tasdiqlangan',
    count: MY_INVOICES.value.filter((i) => i.status === 'ISSUED').length,
  },
  {
    value: 'OVERDUE',
    label: 'Kechikkan',
    count: MY_INVOICES.value.filter((i) => i.status === 'OVERDUE').length,
  },
])

const filtered = computed(() =>
  MY_INVOICES.value.filter((i) => {
    const byStatus = status.value === 'all' || i.status === status.value
    const q = query.value.trim().toLowerCase()
    const byQuery =
      !q ||
      i.code.toLowerCase().includes(q) ||
      i.period.toLowerCase().includes(q) ||
      i.unitCode.includes(q)
    return byStatus && byQuery
  }),
)

const columns = [
  { key: 'code', label: 'Hisob-faktura №' },
  { key: 'period', label: 'Davr' },
  { key: 'unitCode', label: 'Unit' },
  { key: 'issuedAt', label: 'Berilgan sana' },
  { key: 'dueAt', label: 'To‘lov muddati' },
  { key: 'total', label: 'Summa', align: 'right' as const, numeric: true },
  { key: 'paid', label: 'To‘langan', align: 'right' as const, numeric: true },
  { key: 'status', label: 'Holat', align: 'right' as const },
]

const detailOpen = ref(false)
const printOpen = ref(false)
const printSent = ref(false)
const selected = ref<CabinetInvoice | null>(null)

function openInvoice(row: Record<string, unknown>) {
  selected.value = MY_INVOICES.value.find((i) => i.id === row.id) ?? null
  detailOpen.value = true
}

const lines = computed(() => {
  const inv = selected.value
  if (!inv) return []
  const unitArea = unitById(inv.unitId)?.area ?? 200
  const ratio = unitArea / 200
  const utilities = TARIFF_LINES.map((l) => ({
    service: l.service,
    unit: l.unit,
    tariff: l.tariff,
    qty: Math.round(l.qty * ratio * 10) / 10,
    total: Math.round(l.tariff * l.qty * ratio),
  }))
  const utilitiesTotal = utilities.reduce((a, l) => a + l.total, 0)
  const rent = Math.max(inv.total - utilitiesTotal, 0)
  return [
    { service: 'Ijara to‘lovi', unit: 'oy', tariff: rent, qty: 1, total: rent },
    ...utilities,
  ]
})

const linesTotal = computed(() => lines.value.reduce((a, l) => a + l.total, 0))

function openPrint() {
  printSent.value = false
  printOpen.value = true
}
</script>

<template>
  <AppTopbar
    title="To‘lovlarim"
    subtitle="Hisob-fakturalar, to‘lov holati va to‘lovlar tarixi"
    :breadcrumb="[{ label: 'Kabinet', to: '/cabinet' }, { label: 'To‘lovlarim' }]"
  >
    <template #actions>
      <UiButton variant="secondary" size="sm" to="/cabinet/documents">
        <UiIcon name="doc" :size="16" />
        Hujjatlar
      </UiButton>
      <UiButton size="sm" to="/cabinet/meters">
        <UiIcon name="meter" :size="16" />
        Hisoblagichlar
      </UiButton>
    </template>
  </AppTopbar>

  <main class="scroll-slim flex-1 space-y-5 overflow-y-auto p-6">
    <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <UiKpi label="Joriy oy to‘lovi" :value="num(currentTotal)" unit="so‘m" icon="wallet" tone="brand" />
      <UiKpi label="To‘langan (joriy oy)" :value="num(currentPaid)" unit="so‘m" icon="check" tone="ok" />
      <UiKpi label="Qarzdorlik" :value="num(overdueTotal)" unit="so‘m" icon="warning" tone="danger" />
      <UiKpi
        label="Keyingi to‘lov sanasi"
        :value="nextDue === '—' ? '—' : dateShort(nextDue)"
        icon="calendar"
        tone="violet"
      />
    </section>

    <UiCard title="Hisob-fakturalar" subtitle="Qatorni bosing — tarkibi va chop etish shakli ochiladi" flush>
      <template #actions>
        <span class="rounded-pill bg-brand-50 px-2.5 py-1 text-[12px] font-bold text-brand-700">
          {{ filtered.length }} ta yozuv
        </span>
      </template>

      <div class="flex flex-wrap items-center gap-3 px-5 pb-4">
        <UiTabs v-model="status" :tabs="statusTabs" />
        <UiInput v-model="query" placeholder="Hisob-faktura yoki davr bo‘yicha qidirish" class="w-full sm:w-72">
          <template #prefix><UiIcon name="search" :size="16" /></template>
        </UiInput>
      </div>

      <UiTable
        :columns="columns"
        :rows="filtered"
        empty="Tanlangan filtr bo‘yicha hisob-faktura topilmadi"
        @row-click="openInvoice"
      >
        <template #cell-code="{ row }">
          <span class="text-[13.5px] font-semibold text-ink-900">{{ row.code }}</span>
        </template>
        <template #cell-unitCode="{ value }">Unit {{ value }}</template>
        <template #cell-issuedAt="{ value }">
          <span class="tabular">{{ dateShort(String(value)) }}</span>
        </template>
        <template #cell-dueAt="{ value }">
          <span class="tabular">{{ dateShort(String(value)) }}</span>
        </template>
        <template #cell-total="{ value }">{{ sum(Number(value)) }}</template>
        <template #cell-paid="{ value }">{{ sum(Number(value)) }}</template>
        <template #cell-status="{ row }">
          <UiStatus kind="invoice" :value="String(row.status)" size="sm" />
        </template>
      </UiTable>
    </UiCard>
  </main>

  <UiModal
    v-model="detailOpen"
    :title="selected?.code ?? 'Hisob-faktura'"
    :subtitle="selected ? `${selected.period} · Unit ${selected.unitCode}` : ''"
    size="lg"
  >
    <div v-if="selected" class="space-y-4">
      <div class="grid gap-3 sm:grid-cols-3">
        <div class="rounded-field p-3.5 ring-1 ring-ink-200">
          <p class="text-[12px] text-ink-500">Umumiy summa</p>
          <p class="tabular mt-1 text-[17px] font-bold text-ink-900">{{ num(selected.total) }} so‘m</p>
        </div>
        <div class="rounded-field p-3.5 ring-1 ring-ink-200">
          <p class="text-[12px] text-ink-500">To‘langan</p>
          <p class="tabular mt-1 text-[17px] font-bold text-ok-700">{{ num(selected.paid) }} so‘m</p>
        </div>
        <div class="rounded-field p-3.5 ring-1 ring-ink-200">
          <p class="text-[12px] text-ink-500">Qoldiq</p>
          <p class="tabular mt-1 text-[17px] font-bold text-ink-900">
            {{ num(selected.total - selected.paid) }} so‘m
          </p>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <UiStatus kind="invoice" :value="selected.status" />
        <span class="text-[12.5px] text-ink-500">
          Berilgan: {{ dateShort(selected.issuedAt) }} · Muddati: {{ dateShort(selected.dueAt) }}
        </span>
      </div>

      <div class="overflow-hidden rounded-field ring-1 ring-ink-200">
        <table class="w-full border-collapse text-sm">
          <thead>
            <tr class="border-b border-ink-200 bg-surface-sunken">
              <th class="px-4 py-2.5 text-left text-[12px] font-semibold uppercase tracking-wide text-ink-500">
                Xizmat
              </th>
              <th class="px-4 py-2.5 text-left text-[12px] font-semibold uppercase tracking-wide text-ink-500">
                O‘lchov
              </th>
              <th class="px-4 py-2.5 text-right text-[12px] font-semibold uppercase tracking-wide text-ink-500">
                Tarif
              </th>
              <th class="px-4 py-2.5 text-right text-[12px] font-semibold uppercase tracking-wide text-ink-500">
                Miqdor
              </th>
              <th class="px-4 py-2.5 text-right text-[12px] font-semibold uppercase tracking-wide text-ink-500">
                Summa
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="l in lines" :key="l.service" class="border-b border-ink-100 last:border-0">
              <td class="px-4 py-2.5 font-medium text-ink-900">{{ l.service }}</td>
              <td class="px-4 py-2.5 text-ink-600">{{ l.unit }}</td>
              <td class="tabular px-4 py-2.5 text-right text-ink-700">{{ num(l.tariff) }}</td>
              <td class="tabular px-4 py-2.5 text-right text-ink-700">{{ num(l.qty, 1) }}</td>
              <td class="tabular px-4 py-2.5 text-right font-semibold text-ink-900">{{ num(l.total) }}</td>
            </tr>
            <tr class="bg-surface-sunken">
              <td colspan="4" class="px-4 py-3 text-right text-[13px] font-semibold text-ink-700">
                Jami
              </td>
              <td class="tabular px-4 py-3 text-right text-[15px] font-bold text-ink-900">
                {{ num(linesTotal) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <template #footer>
      <UiButton variant="ghost" @click="detailOpen = false">Yopish</UiButton>
      <UiButton variant="secondary" @click="openPrint">
        <UiIcon name="download" :size="16" />
        PDF yuklab olish
      </UiButton>
    </template>
  </UiModal>

  <UiModal
    v-model="printOpen"
    title="Chop etish ko‘rinishi"
    :subtitle="selected ? `${selected.code} · ${selected.period}` : ''"
    size="lg"
  >
    <div v-if="selected" class="rounded-field bg-white p-6 ring-1 ring-ink-200">
      <div class="flex items-start justify-between gap-6 border-b border-ink-200 pb-4">
        <div>
          <span class="text-brand-600"><AppLogo size="sm" mono /></span>
          <p class="mt-2 text-[12px] text-ink-500">Makon Property Group</p>
          <p class="text-[12px] text-ink-500">Toshkent, Amir Temur ko‘chasi 88</p>
        </div>
        <div class="text-right">
          <p class="text-[15px] font-bold text-ink-900">Hisob-faktura</p>
          <p class="tabular text-[13px] font-semibold text-ink-700">{{ selected.code }}</p>
          <p class="tabular text-[12px] text-ink-500">Sana: {{ dateShort(selected.issuedAt) }}</p>
        </div>
      </div>

      <dl class="grid gap-3 border-b border-ink-200 py-4 sm:grid-cols-2">
        <div>
          <dt class="text-[11.5px] uppercase tracking-wide text-ink-500">To‘lovchi</dt>
          <dd class="text-[13.5px] font-semibold text-ink-900">{{ organization }}</dd>
        </div>
        <div>
          <dt class="text-[11.5px] uppercase tracking-wide text-ink-500">Obyekt</dt>
          <dd class="text-[13.5px] font-semibold text-ink-900">
            Green Business Center · Unit {{ selected.unitCode }}
          </dd>
        </div>
        <div>
          <dt class="text-[11.5px] uppercase tracking-wide text-ink-500">Hisob davri</dt>
          <dd class="text-[13.5px] font-semibold text-ink-900">{{ selected.period }}</dd>
        </div>
        <div>
          <dt class="text-[11.5px] uppercase tracking-wide text-ink-500">To‘lov muddati</dt>
          <dd class="tabular text-[13.5px] font-semibold text-ink-900">{{ dateShort(selected.dueAt) }}</dd>
        </div>
      </dl>

      <table class="mt-4 w-full border-collapse text-[13px]">
        <thead>
          <tr class="border-b border-ink-200">
            <th class="py-2 text-left font-semibold text-ink-600">Xizmat nomi</th>
            <th class="py-2 text-right font-semibold text-ink-600">Miqdor</th>
            <th class="py-2 text-right font-semibold text-ink-600">Summa</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="l in lines" :key="`p-${l.service}`" class="border-b border-ink-100">
            <td class="py-2 text-ink-800">{{ l.service }}</td>
            <td class="tabular py-2 text-right text-ink-700">{{ num(l.qty, 1) }} {{ l.unit }}</td>
            <td class="tabular py-2 text-right font-semibold text-ink-900">{{ num(l.total) }}</td>
          </tr>
        </tbody>
      </table>

      <div class="mt-4 flex items-center justify-end gap-6 border-t border-ink-200 pt-4">
        <span class="text-[13px] font-semibold text-ink-600">To‘lov uchun jami</span>
        <span class="tabular text-[18px] font-bold text-ink-900">{{ sum(linesTotal) }}</span>
      </div>

      <div class="mt-8 grid grid-cols-2 gap-6 text-[12px] text-ink-500">
        <div>
          <p class="border-b border-ink-300 pb-6">Ijaraga beruvchi</p>
          <p class="mt-1">Imzo va muhr</p>
        </div>
        <div>
          <p class="border-b border-ink-300 pb-6">Ijarachi</p>
          <p class="mt-1">Imzo va muhr</p>
        </div>
      </div>
    </div>

    <p v-if="printSent" class="mt-4 flex items-center gap-2 text-[13px] font-semibold text-ok-700">
      <UiIcon name="check" :size="16" />
      Hujjat chop etishga tayyorlandi.
    </p>

    <template #footer>
      <UiButton variant="ghost" @click="printOpen = false">Yopish</UiButton>
      <UiButton :disabled="printSent" @click="printSent = true">
        <UiIcon name="print" :size="16" />
        Chop etish
      </UiButton>
    </template>
  </UiModal>
</template>
