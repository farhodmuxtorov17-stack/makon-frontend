<script setup lang="ts">
import AppTopbar from '~/components/layout/AppTopbar.vue'
import {
  INVOICES,
  agingKeyOf,
  agingOf,
  billingSummaryOf,
  settledInvoices,
  statusOf,
} from '~/data/business'
import { LANDLORD_STIR, organizationByStir } from '~/data/organizations'
import { dateShort, monthTitle, num, percent, sum, sumShort, todayIso } from '~/utils/format'

const auth = useAuthStore()
const { field, moduleCaption, moduleTitle, sectionLabel, statusLabel } = useAppLabels()

/** To‘lovni tasdiqlash yozuv amali: sahifani ko‘rish huquqi buni bermaydi */
const canConfirm = computed(() => auth.can('payment.confirm'))

/**
 * Navbat umumiy reyestrdan hisoblanadi. Tasdiqlangan to‘lov hisob-faktura
 * yozuviga tushadi, shuning uchun u navbatdan chiqadi va qarzdorlik
 * ekranida ham darhol ko‘rinadi.
 */
const queue = computed(() =>
  INVOICES.filter((i) => i.status === 'PARTIALLY_PAID' || i.status === 'ISSUED'),
)

/**
 * To‘lov yozuvi: usul, sana, hisob raqami, maqsad va izoh shu yerda saqlanadi
 * va hisob-faktura tarixida ko‘rinadi. Hisob-fakturalar ekrani ham shu
 * ro‘yxatga yozadi, ya’ni bitta jarayonning qoidasi bitta.
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

const summary = computed(() => billingSummaryOf(INVOICES))
const aging = computed(() => agingOf(INVOICES))
const paidShare = computed(() =>
  summary.value.charged ? Math.round((summary.value.paidTotal / summary.value.charged) * 100) : 0,
)

const search = ref('')
const statusFilter = ref('all')
const selectedId = ref('')
const banner = ref('')
const bannerTone = ref<'ok' | 'danger'>('ok')

const payMethod = ref('bank')
/** Ijaraga beruvchining hisob raqami tashkilotlar reyestridan olinadi */
const account = ref(organizationByStir(LANDLORD_STIR)?.account ?? '')
const purpose = ref('')
const note = ref('')
const payDate = ref(todayIso())
const payAmount = ref('')

const methodOptions = [
  { value: 'bank', label: 'Bank o‘tkazmasi' },
  { value: 'card', label: 'Plastik karta' },
  { value: 'cash', label: 'Naqd pul' },
]

const filtered = computed(() =>
  queue.value.filter((i) => {
    const q = search.value.trim().toLowerCase()
    const byQuery =
      !q || `${i.code} ${i.tenant} ${i.buildingName} ${i.unitCode}`.toLowerCase().includes(q)
    const byStatus = statusFilter.value === 'all' || i.status === statusFilter.value
    return byQuery && byStatus
  }),
)

const statusTabs = computed(() => [
  { value: 'all', label: 'Barchasi', count: queue.value.length },
  {
    value: 'PARTIALLY_PAID',
    label: statusLabel('invoice', 'PARTIALLY_PAID'),
    count: queue.value.filter((i) => i.status === 'PARTIALLY_PAID').length,
  },
  {
    value: 'ISSUED',
    label: statusLabel('invoice', 'ISSUED'),
    count: queue.value.filter((i) => i.status === 'ISSUED').length,
  },
])

const columns = computed(() => [
  { key: 'pick', label: '', width: '44px' },
  { key: 'idx', label: '№', width: '52px', align: 'right' as const, numeric: true },
  { key: 'code', label: 'Hisob-faktura raqami' },
  { key: 'tenant', label: 'Mijoz' },
  { key: 'place', label: 'Obyekt / Unit' },
  { key: 'dueAt', label: 'To‘lov muddati' },
  { key: 'total', label: 'Jami summa', align: 'right' as const, numeric: true },
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
    dueAt: i.dueAt,
    total: i.total,
    balance: i.total - i.paid,
    status: i.status,
  })),
)

const selected = computed(() => queue.value.find((i) => i.id === selectedId.value) ?? null)
const balance = computed(() => (selected.value ? selected.value.total - selected.value.paid : 0))

function selectRow(row: Record<string, unknown>) {
  selectedId.value = String(row.id)
  const inv = selected.value
  purpose.value = inv ? `IJARA TO‘LOVI, ${inv.code}` : ''
  note.value = ''
  payMethod.value = 'bank'
  payDate.value = todayIso()
  payAmount.value = inv ? String(inv.total - inv.paid) : ''
}

const queueTotal = computed(() => queue.value.reduce((s, i) => s + (i.total - i.paid), 0))

const payValue = computed(() => Number(payAmount.value) || 0)

/** Qisman to‘lov ham qabul qilinadi: summa qoldiqdan oshmasligi kifoya */
const payValid = computed(
  () => Boolean(selected.value) && payValue.value > 0 && payValue.value <= balance.value,
)

/** Hujjat izohsiz qaytarilmaydi: ijarachiga sabab ko‘rsatilishi kerak */
const returnValid = computed(() => Boolean(selected.value) && note.value.trim().length > 2)

/** Tanlangan hujjat bo‘yicha oldingi to‘lovlar */
const selectedHistory = computed(() =>
  payments.value.filter((p) => p.invoiceId === selectedId.value),
)

function recordOf(kind: 'payment' | 'return', invoiceId: string, code: string, tenant: string, amount: number): PaymentRecord {
  return {
    id: `pay-${invoiceId}-${payments.value.length + 1}`,
    invoiceId,
    invoiceCode: code,
    tenant,
    amount,
    method: payMethod.value,
    methodLabel: methodOptions.find((m) => m.value === payMethod.value)?.label ?? payMethod.value,
    account: account.value.trim(),
    purpose: purpose.value.trim(),
    note: note.value.trim(),
    paidAt: payDate.value,
    actor: auth.user?.fullName ?? '',
    kind,
  }
}

/**
 * To‘lovni tasdiqlash yoki hujjatni qaytarish. Tasdiqlashda kiritilgan summa
 * hisob-faktura qoldig‘iga tushadi (to‘liq yoki qisman), holat esa qo‘lda
 * emas, `statusOf()` bilan aniqlanadi. Qaytarishda hujjat qoralamaga o‘tadi,
 * lekin bu yakuniy holat emas: «Qaytarilgan hujjatlar» ro‘yxatidan uni
 * qaytadan chiqarish mumkin.
 */
function resolve(action: 'confirm' | 'return') {
  const inv = selected.value
  if (!canConfirm.value || !inv) return
  if (action === 'confirm' ? !payValid.value : !returnValid.value) return

  const amount = action === 'confirm' ? payValue.value : inv.total - inv.paid
  payments.value = [recordOf(action === 'confirm' ? 'payment' : 'return', inv.id, inv.code, inv.tenant, amount), ...payments.value]

  if (action === 'confirm') {
    // To‘lov hisob-faktura yozuviga tushadi: qoldiq shu summaga kamayadi
    inv.paid += amount
    inv.status = statusOf(inv)
    inv.agingBucket = agingKeyOf(inv)
  } else {
    // Hujjat tuzatish uchun ijarachiga qaytariladi va qoralamaga o‘tadi
    inv.status = 'DRAFT'
  }

  const rest = inv.total - inv.paid
  selectedId.value = ''
  bannerTone.value = action === 'confirm' ? 'ok' : 'danger'
  banner.value =
    action === 'confirm'
      ? rest > 0
        ? `${inv.code} bo‘yicha ${sum(amount)} to‘lov tasdiqlandi, qoldiq ${sum(rest)}.`
        : `${inv.code} bo‘yicha ${sum(amount)} to‘lov tasdiqlandi, hujjat to‘liq yopildi.`
      : `${inv.code} hujjati izoh bilan ijarachiga qaytarildi va qoralamaga o‘tdi.`
}

/** Qaytarilgan hujjatlar: qoralamada qolib ketmasin */
const returned = computed(() => INVOICES.filter((i) => i.status === 'DRAFT'))

function reissue(id: string) {
  const inv = INVOICES.find((i) => i.id === id)
  if (!canConfirm.value || !inv) return
  inv.status = statusOf({ ...inv, status: 'ISSUED' })
  inv.agingBucket = agingKeyOf(inv)
  bannerTone.value = 'ok'
  banner.value = `${inv.code} qayta chiqarildi va tasdiqlash navbatiga qaytdi.`
}

// --- Hisob-kitob dinamikasi ------------------------------------------------

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

/** «Avgust 2026» → «2026-08» */
function keyOfPeriod(label: string): string {
  const [month, year] = label.split(' ')
  const index = MONTHS.indexOf(month ?? '')
  return index < 0 || !year ? '' : `${year}-${String(index + 1).padStart(2, '0')}`
}

/**
 * Diagramma qattiq yozilgan oylardan emas, reyestrdan quriladi: oxirgi olti
 * hisob davri bo‘yicha hisoblangan va to‘langan summa. Shu sababli u
 * to‘lov tasdiqlangan zahoti yangilanadi va sana bilan ziddiyatga tushmaydi.
 */
const cashPeriods = computed(() => {
  const map = new Map<string, { charged: number; paid: number }>()
  for (const i of settledInvoices(INVOICES)) {
    const key = keyOfPeriod(i.period)
    if (!key) continue
    const row = map.get(key) ?? { charged: 0, paid: 0 }
    row.charged += i.total
    row.paid += i.paid
    map.set(key, row)
  }
  return [...map.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).slice(-6)
})

const cashLabels = computed(() =>
  cashPeriods.value.map(([key]) => MONTHS[Number(key.slice(5)) - 1] ?? key),
)

function mln(value: number) {
  return Math.round((value / 1_000_000) * 10) / 10
}

const cashSeries = computed(() => [
  {
    label: 'Hisoblangan, mln so‘m',
    tone: 'brand' as const,
    values: cashPeriods.value.map(([, v]) => mln(v.charged)),
    fill: true,
  },
  {
    label: 'To‘langan, mln so‘m',
    tone: 'ok' as const,
    values: cashPeriods.value.map(([, v]) => mln(v.paid)),
    fill: true,
  },
])

const cashSubtitle = computed(
  () => `${monthTitle(todayIso())} · oxirgi olti hisob davri kesimida`,
)

const agingSlices = computed(() =>
  aging.value.map((a) => ({ label: a.bucket, value: a.amount, tone: a.tone })),
)
const agingTotal = computed(() => aging.value.reduce((s, a) => s + a.amount, 0))
</script>

<template>
  <AppTopbar
    :title="moduleTitle('paymentsApprove', 'To‘lovlarni tasdiqlash')"
    :subtitle="moduleCaption('paymentsApprove', 'Tasdiqlashni kutayotgan to‘lovlar')"
    :breadcrumb="[
      { label: sectionLabel('billing', 'Hisob-kitob'), to: '/billing/invoices' },
      { label: moduleTitle('paymentsApprove', 'To‘lovlarni tasdiqlash') },
    ]"
  >
    <template #actions>
      <UiButton variant="secondary" size="sm" to="/billing/invoices">
        <UiIcon name="doc" :size="16" />
        Hisob-fakturalar
      </UiButton>
      <UiButton variant="secondary" size="sm" to="/billing/debts">
        <UiIcon name="chart" :size="16" />
        Qarzdorlik
      </UiButton>
    </template>
  </AppTopbar>

  <main class="scroll-slim flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
    <div
      v-if="banner"
      class="flex items-center gap-3 rounded-card px-4 py-3 ring-1"
      :class="
        bannerTone === 'ok' ? 'bg-ok-50 ring-ok-100' : 'bg-danger-50 ring-danger-100'
      "
    >
      <UiIcon
        :name="bannerTone === 'ok' ? 'check' : 'refresh'"
        :size="18"
        :class="bannerTone === 'ok' ? 'text-ok-600' : 'text-danger-600'"
      />
      <p
        class="min-w-0 flex-1 text-[13px] font-medium"
        :class="bannerTone === 'ok' ? 'text-ok-700' : 'text-danger-700'"
      >
        {{ banner }}
      </p>
      <button
        type="button"
        class="rounded-lg p-1 transition-colors"
        :class="
          bannerTone === 'ok'
            ? 'text-ok-700 hover:bg-ok-100'
            : 'text-danger-700 hover:bg-danger-100'
        "
        aria-label="Xabarni yopish"
        @click="banner = ''"
      >
        <UiIcon name="x" :size="16" />
      </button>
    </div>

    <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <UiKpi label="Hisoblangan" :value="sumShort(summary.charged)" icon="doc" tone="brand" />
      <UiKpi
        label="To‘langan"
        :value="sumShort(summary.paidTotal)"
        icon="check"
        tone="ok"
        :gauge="paidShare"
      />
      <UiKpi label="Qarzdorlik" :value="sumShort(summary.debtTotal)" icon="wallet" tone="warn" />
      <UiKpi
        label="Kechikkan to‘lovlar"
        :value="sumShort(summary.overdueTotal)"
        icon="clock"
        tone="danger"
      />
    </section>

    <section class="grid gap-5 xl:grid-cols-3">
      <div class="min-w-0 space-y-5 xl:col-span-2">
        <UiCard
          title="Tasdiqlash kutilayotgan to‘lovlar"
          :subtitle="`Navbatda ${queue.length} ta hujjat · qoldiq ${sum(queueTotal)}`"
          flush
          :padded="false"
        >
          <div class="flex flex-wrap items-center gap-3 px-5 pb-4">
            <UiInput
              v-model="search"
              placeholder="Hisob-faktura raqami yoki mijoz bo‘yicha qidirish"
              class="min-w-[220px] flex-1"
            >
              <template #prefix>
                <UiIcon name="search" :size="18" />
              </template>
            </UiInput>
            <UiTabs v-model="statusFilter" :tabs="statusTabs" />
          </div>

          <UiTable
            :columns="columns"
            :rows="rows"
            empty="Tasdiqlash kutayotgan to‘lov qolmadi"
            @row-click="selectRow"
          >
            <template #cell-pick="{ row }">
              <span
                class="grid size-5 place-items-center rounded-[6px] ring-1 transition-colors"
                :class="
                  selectedId === row.id
                    ? 'bg-brand-500 text-white ring-brand-500'
                    : 'bg-white text-transparent ring-ink-300'
                "
              >
                <UiIcon name="check" :size="13" />
              </span>
            </template>
            <template #cell-code="{ row }">
              <span class="font-semibold text-brand-600">{{ row.code }}</span>
            </template>
            <template #cell-tenant="{ row }">
              <span class="font-semibold text-ink-900">{{ row.tenant }}</span>
            </template>
            <template #cell-place="{ row }">
              <span class="text-[13px] text-ink-600">{{ row.place }}</span>
            </template>
            <template #cell-dueAt="{ row }">{{ dateShort(String(row.dueAt)) }}</template>
            <template #cell-total="{ row }">{{ sum(Number(row.total)) }}</template>
            <template #cell-balance="{ row }">
              <span class="text-danger-600">{{ sum(Number(row.balance)) }}</span>
            </template>
            <template #cell-status="{ row }">
              <UiStatus kind="invoice" :value="String(row.status)" size="sm" />
            </template>
          </UiTable>

          <div class="border-t border-ink-100 px-5 py-3.5">
            <p class="text-[13px] text-ink-500">
              Jami: <b class="text-ink-800">{{ rows.length }} ta</b> hujjat. Tasdiqlash uchun
              qatorni tanlang.
            </p>
          </div>
        </UiCard>

        <UiCard
          v-if="returned.length"
          title="Qaytarilgan hujjatlar"
          subtitle="Qoralamaga tushgan hisob-fakturalar: tuzatilgach qayta chiqariladi"
          flush
          :padded="false"
        >
          <ul class="divide-y divide-ink-100 border-t border-ink-100">
            <li v-for="r in returned" :key="r.id" class="flex flex-wrap items-center gap-3 px-5 py-3.5">
              <span class="grid size-9 shrink-0 place-items-center rounded-[10px] bg-ink-100 text-ink-600">
                <UiIcon name="doc" :size="17" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-[13px] font-semibold text-ink-900">
                  {{ r.code }} · {{ r.tenant }}
                </span>
                <span class="block truncate text-[12px] text-ink-500">
                  {{ r.buildingName }} · {{ r.unitCode }} · {{ sum(r.total - r.paid) }}
                </span>
              </span>
              <UiStatus kind="invoice" :value="r.status" size="sm" />
              <UiButton v-if="canConfirm" variant="secondary" size="sm" @click="reissue(r.id)">
                <UiIcon name="refresh" :size="15" />
                Navbatga qaytarish
              </UiButton>
            </li>
          </ul>
        </UiCard>

        <section class="grid gap-5 lg:grid-cols-2">
          <UiCard title="Hisob-kitob dinamikasi" :subtitle="cashSubtitle">
            <UiLine :labels="cashLabels" :series="cashSeries" :height="200" unit="mln so‘m" />
          </UiCard>

          <UiCard title="Qarzdorlik tahlili" subtitle="Muddat guruhlari bo‘yicha taqsimot">
            <UiDonut
              :slices="agingSlices"
              :center-value="sumShort(agingTotal)"
              center-label="jami qarzdorlik"
              :size="160"
            />
            <ul class="mt-4 space-y-2 border-t border-ink-100 pt-3">
              <li
                v-for="a in aging"
                :key="a.bucket"
                class="flex items-center justify-between gap-3 text-[13px]"
              >
                <span class="text-ink-600">{{ a.bucket }}</span>
                <span class="tabular font-semibold text-ink-900">{{ sum(a.amount) }}</span>
              </li>
            </ul>
          </UiCard>
        </section>
      </div>

      <div class="min-w-0 space-y-5">
        <UiCard title="To‘lovni tasdiqlash" subtitle="Tanlangan to‘lov bo‘yicha ma’lumotlar">
          <div v-if="!selected" class="py-10 text-center">
            <span class="mx-auto grid size-12 place-items-center rounded-full bg-ink-100 text-ink-400">
              <UiIcon name="wallet" :size="22" />
            </span>
            <p class="mt-3 text-[13.5px] font-semibold text-ink-800">To‘lov tanlanmagan</p>
            <p class="mt-1 text-[12.5px] text-ink-500">
              Chapdagi ro‘yxatdan hujjatni tanlang, tafsilotlar shu yerda ochiladi.
            </p>
          </div>

          <div v-else class="space-y-4">
            <div class="flex items-center justify-between gap-3">
              <span class="text-[13px] text-ink-500">Tanlangan to‘lov</span>
              <UiStatus kind="invoice" :value="selected.status" size="sm" />
            </div>

            <dl class="divide-y divide-ink-100 border-y border-ink-100">
              <div class="flex items-baseline justify-between gap-4 py-2.5">
                <dt class="text-[13px] text-ink-500">Hisob-faktura raqami</dt>
                <dd class="text-[13.5px] font-semibold text-ink-900">{{ selected.code }}</dd>
              </div>
              <div class="flex items-baseline justify-between gap-4 py-2.5">
                <dt class="text-[13px] text-ink-500">Mijoz</dt>
                <dd class="text-[13.5px] font-semibold text-ink-900">{{ selected.tenant }}</dd>
              </div>
              <div class="flex items-baseline justify-between gap-4 py-2.5">
                <dt class="text-[13px] text-ink-500">Obyekt</dt>
                <dd class="text-right text-[13.5px] font-semibold text-ink-900">
                  {{ selected.buildingName }} · {{ selected.unitCode }}
                </dd>
              </div>
              <div class="flex items-baseline justify-between gap-4 py-2.5">
                <dt class="text-[13px] text-ink-500">Jami summa</dt>
                <dd class="tabular text-[13.5px] font-bold text-ink-900">
                  {{ sum(selected.total) }}
                </dd>
              </div>
              <div class="flex items-baseline justify-between gap-4 py-2.5">
                <dt class="text-[13px] text-ink-500">Qoldiq</dt>
                <dd class="tabular text-[13.5px] font-bold text-danger-600">
                  {{ sum(balance) }}
                </dd>
              </div>
            </dl>

            <template v-if="canConfirm">
              <UiField
                label="To‘lov summasi"
                required
                hint="Qisman to‘lov ham qabul qilinadi: summa qoldiqdan oshmasin"
              >
                <UiInput v-model="payAmount" type="number" placeholder="0" :invalid="!payValid" />
              </UiField>
              <UiField label="To‘lov sanasi">
                <UiInput v-model="payDate" type="date" />
              </UiField>
              <UiField label="To‘lov usuli">
                <UiSelect v-model="payMethod" :options="methodOptions" />
              </UiField>
              <UiField label="Hisob raqami">
                <UiInput v-model="account" />
              </UiField>
              <UiField label="Maqsad">
                <UiInput v-model="purpose" placeholder="To‘lov maqsadi" />
              </UiField>
              <UiField label="Izoh" hint="Hujjatni qaytarish uchun izoh majburiy">
                <textarea
                  v-model="note"
                  rows="3"
                  maxlength="500"
                  placeholder="Qaytarish sababi yoki qo‘shimcha izoh"
                  class="scroll-slim w-full rounded-field bg-white px-3.5 py-2.5 text-sm text-ink-800 ring-1 ring-inset ring-ink-200 transition-colors placeholder:text-ink-400 hover:ring-ink-300 focus:ring-2 focus:ring-brand-500"
                />
                <p class="tabular mt-1 text-right text-[11.5px] text-ink-400">
                  {{ note.length }}/500
                </p>
              </UiField>

              <p v-if="!payValid" class="text-[12px] font-medium text-danger-600">
                To‘lov summasi 0 dan katta va {{ sum(balance) }} dan oshmasligi kerak.
              </p>

              <div class="grid grid-cols-2 gap-3 pt-1">
                <UiButton variant="success" block :disabled="!payValid" @click="resolve('confirm')">
                  <UiIcon name="check" :size="16" />
                  Tasdiqlash
                </UiButton>
                <UiButton variant="danger" block :disabled="!returnValid" @click="resolve('return')">
                  <UiIcon name="refresh" :size="16" />
                  Qaytarish
                </UiButton>
              </div>

              <div v-if="selectedHistory.length" class="border-t border-ink-100 pt-3">
                <p class="text-[12.5px] font-semibold text-ink-800">Ushbu hujjat bo‘yicha amallar</p>
                <ul class="mt-2 space-y-1.5">
                  <li
                    v-for="h in selectedHistory"
                    :key="h.id"
                    class="flex items-baseline justify-between gap-3 text-[12px]"
                  >
                    <span class="min-w-0 flex-1 truncate text-ink-500">
                      {{ dateShort(h.paidAt) }} · {{ h.methodLabel }}
                    </span>
                    <span
                      class="tabular shrink-0 font-semibold"
                      :class="h.kind === 'payment' ? 'text-ok-700' : 'text-danger-600'"
                    >
                      {{ h.kind === 'payment' ? sum(h.amount) : 'Qaytarildi' }}
                    </span>
                  </li>
                </ul>
              </div>
            </template>

            <p v-else class="rounded-field bg-surface-sunken px-3.5 py-3 text-[12.5px] text-ink-500">
              To‘lovni tasdiqlash huquqi buxgalter rolida beriladi. Ushbu rolda hujjat faqat
              kuzatiladi.
            </p>
          </div>
        </UiCard>

        <UiCard title="So‘nggi amallar" subtitle="Ko‘rib chiqilgan hujjatlar va to‘lov tafsilotlari" flush :padded="false">
          <p v-if="!payments.length" class="px-5 py-6 text-[13px] text-ink-500">
            Hozircha ko‘rib chiqilgan hujjat yo‘q.
          </p>
          <ul v-else class="divide-y divide-ink-100 border-t border-ink-100">
            <li v-for="p in payments.slice(0, 8)" :key="p.id" class="flex items-start gap-3 px-5 py-3">
              <span
                class="grid size-9 shrink-0 place-items-center rounded-[10px]"
                :class="p.kind === 'payment' ? 'bg-ok-50 text-ok-600' : 'bg-danger-50 text-danger-600'"
              >
                <UiIcon :name="p.kind === 'payment' ? 'check' : 'refresh'" :size="17" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-[13px] font-semibold text-ink-900">
                  {{ p.invoiceCode }}
                </span>
                <span class="block truncate text-[12px] text-ink-500">
                  {{ p.tenant }} · {{ dateShort(p.paidAt) }} · {{ p.methodLabel }}
                </span>
                <span v-if="p.note" class="block truncate text-[12px] text-ink-600">
                  {{ p.note }}
                </span>
              </span>
              <span
                class="tabular shrink-0 text-[13px] font-bold"
                :class="p.kind === 'payment' ? 'text-ink-900' : 'text-danger-600'"
              >
                {{ p.kind === 'payment' ? sumShort(p.amount) : 'Qaytarildi' }}
              </span>
            </li>
          </ul>
        </UiCard>

        <UiCard title="To‘lov holati" subtitle="Umumiy bajarilish darajasi">
          <div class="flex items-baseline justify-between">
            <span class="text-[13px] text-ink-500">To‘langan ulush</span>
            <span class="tabular text-[15px] font-bold text-ink-900">
              {{ percent(paidShare) }}
            </span>
          </div>
          <div class="mt-2 h-2 overflow-hidden rounded-pill bg-ink-100">
            <div
              class="h-full rounded-pill bg-ok-500"
              :style="{ width: `${paidShare}%` }"
            />
          </div>
          <dl class="mt-4 grid grid-cols-2 gap-3 border-t border-ink-100 pt-4">
            <div>
              <dt class="text-[12px] text-ink-500">Hujjatlar navbati</dt>
              <dd class="tabular mt-0.5 text-sm font-bold text-ink-900">
                {{ num(queue.length) }} ta
              </dd>
            </div>
            <div>
              <dt class="text-[12px] text-ink-500">Navbatdagi qoldiq</dt>
              <dd class="tabular mt-0.5 text-sm font-bold text-danger-600">
                {{ sumShort(queueTotal) }}
              </dd>
            </div>
          </dl>
        </UiCard>
      </div>
    </section>
  </main>
</template>
