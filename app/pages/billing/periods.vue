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
import { num, percent, sum, sumShort, todayIso } from '~/utils/format'

const { field, moduleCaption, moduleTitle, sectionLabel } = useAppLabels()

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
  { value: 'all', label: 'Barchasi', count: periods.value.length },
  { value: 'open', label: 'Ochiq', count: periods.value.filter((p) => !p.closed).length },
  { value: 'closed', label: 'Yopilgan', count: periods.value.filter((p) => p.closed).length },
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
  { key: 'contracts', label: 'Shartnomalar soni', align: 'right' as const, numeric: true },
  { key: 'invoices', label: 'Hisob-faktura soni', align: 'right' as const, numeric: true },
  { key: 'total', label: 'Jami summa', align: 'right' as const, numeric: true },
  { key: 'state', label: field('status', 'Holat') },
  { key: 'actions', label: 'Amallar', align: 'right' as const },
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
const chartLabels = computed(() => chartPeriods.value.map((p) => p.label.split(' ')[0] ?? p.label))
const chartSeries = computed(() => [
  {
    label: 'Hisoblangan summa',
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
      ? `${p.label} davri uchun ${num(created.length)} ta hisob-faktura shakllantirildi, jami ${sum(amount)}.`
      : `${p.label} davrida yangi hujjat yaratilmadi: barcha faol shartnomalar bo‘yicha hisob-faktura allaqachon mavjud.`
  } else {
    if (!closedKeys.value.includes(p.key)) closedKeys.value = [...closedKeys.value, p.key]
    banner.value = `${p.label} davri yopildi. Ushbu davrga yangi hisob-faktura qo‘shilmaydi.`
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

const yearOptions = [0, 1].map((offset) => {
  const year = Number(CURRENT_KEY.slice(0, 4)) + offset
  return { value: String(year), label: `${year}-yil` }
})

const monthOptions = MONTHS.map((m) => ({ value: m, label: m }))

const newKey = computed(() => keyOfLabel(`${newMonth.value} ${newYear.value}`))
const duplicate = computed(() => periodKeys.value.includes(newKey.value))

function createPeriod() {
  if (duplicate.value || !newKey.value) return
  extraKeys.value = [...extraKeys.value, newKey.value]
  banner.value = `${labelOfKey(newKey.value)} hisob davri ochildi.`
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
        Hisob-fakturalar
      </UiButton>
      <UiButton size="sm" @click="createOpen = true">
        <UiIcon name="plus" :size="16" />
        Yangi davr
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
      <UiKpi
        label="Jami davrlar"
        :value="num(periods.length)"
        unit="ta"
        icon="calendar"
        tone="brand"
      />
      <UiKpi label="Ochiq davrlar" :value="num(openCount)" unit="ta" icon="clock" tone="warn" />
      <UiKpi label="Yopilgan davrlar" :value="num(closedCount)" unit="ta" icon="check" tone="ok" />
      <UiKpi
        label="Hisoblangan summa"
        :value="sumShort(totalCharged)"
        icon="wallet"
        tone="violet"
      />
    </section>

    <UiCard
      title="Hisob davrlari reyestri"
      subtitle="Davr bo‘yicha shartnomalar, hisob-fakturalar va holat"
      flush
      :padded="false"
    >
      <div class="flex flex-wrap items-center justify-between gap-3 px-5 pb-4">
        <UiTabs v-model="stateFilter" :tabs="stateTabs" />
        <p class="text-[13px] text-ink-500">
          Shakllantirilgan hisob-fakturalar:
          <b class="tabular text-ink-800">{{ num(generatedCount) }} ta</b>
        </p>
      </div>

      <UiTable
        :columns="columns"
        :rows="rows"
        empty="Ushbu holatdagi davr topilmadi"
        @row-click="openDetail"
      >
        <template #cell-label="{ row }">
          <span class="font-semibold text-ink-900">{{ row.label }}</span>
        </template>
        <template #cell-contracts="{ row }">{{ num(Number(row.contracts)) }} ta</template>
        <template #cell-invoices="{ row }">
          <span :class="Number(row.invoices) ? 'text-ink-900' : 'text-ink-400'">
            {{ num(Number(row.invoices)) }} ta
          </span>
        </template>
        <template #cell-total="{ row }">{{ sum(Number(row.total)) }}</template>
        <template #cell-state="{ row }">
          <span
            class="inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs font-semibold ring-1 ring-inset"
            :class="row.closed ? TONE_BADGE.neutral : TONE_BADGE.ok"
          >
            <UiIcon :name="row.closed ? 'lock' : 'check'" :size="12" />
            {{ row.closed ? 'Yopilgan' : 'Ochiq' }}
          </span>
        </template>
        <template #cell-actions="{ row }">
          <span class="inline-flex items-center justify-end gap-2">
            <UiButton
              variant="secondary"
              size="sm"
              :disabled="Boolean(row.closed)"
              @click.stop="askGenerate(String(row.key))"
            >
              <UiIcon name="refresh" :size="15" />
              Hisob-faktura shakllantirish
            </UiButton>
            <UiButton
              variant="subtle"
              size="sm"
              :disabled="Boolean(row.closed)"
              @click.stop="askClose(String(row.key))"
            >
              <UiIcon name="lock" :size="15" />
              Davrni yopish
            </UiButton>
          </span>
        </template>
      </UiTable>

      <div class="border-t border-ink-100 px-5 py-3.5">
        <p class="text-[13px] text-ink-500">
          Jami: <b class="text-ink-800">{{ rows.length }} ta</b> davr · umumiy summa
          <b class="tabular text-ink-800">{{ sum(totalCharged) }}</b>
        </p>
      </div>
    </UiCard>

    <UiCard title="Davrlar bo‘yicha hisoblangan summa" subtitle="Oylar kesimida, mln so‘m">
      <UiBars
        :labels="chartLabels"
        :series="chartSeries"
        :height="200"
        unit="qiymatlar mln so‘mda"
      />
    </UiCard>

    <UiModal
      v-model="confirmOpen"
      size="sm"
      :title="confirmMode === 'generate' ? 'Hisob-faktura shakllantirish' : 'Davrni yopish'"
      :subtitle="target ? `${target.label} hisob davri` : ''"
    >
      <div v-if="target" class="space-y-4">
        <p class="text-[14px] leading-relaxed text-ink-700">
          <template v-if="confirmMode === 'generate'">
            Ushbu davrda amalda bo‘lgan <b>{{ num(target.contracts) }} ta</b> faol ijara shartnomasi
            bo‘yicha hujjat tekshiriladi. Hisob-fakturasi yo‘q
            <b>{{ num(target.pending) }} ta</b> shartnomaga ijara haqi va tarif jadvali asosida yangi
            hisob-faktura yaratiladi.
          </template>
          <template v-else>
            Davr yopilgandan so‘ng unga yangi hisob-faktura qo‘shib bo‘lmaydi, summalar
            hisobotlarga yakuniy sifatida uzatiladi.
          </template>
        </p>

        <dl class="divide-y divide-ink-100 rounded-field bg-surface-sunken px-4">
          <div class="flex items-baseline justify-between gap-4 py-2.5">
            <dt class="text-[13px] text-ink-500">Faol shartnomalar</dt>
            <dd class="tabular text-[14px] font-semibold text-ink-900">
              {{ num(target.contracts) }} ta
            </dd>
          </div>
          <div class="flex items-baseline justify-between gap-4 py-2.5">
            <dt class="text-[13px] text-ink-500">Joriy hisob-faktura soni</dt>
            <dd class="tabular text-[14px] font-semibold text-ink-900">
              {{ num(target.invoices) }} ta
            </dd>
          </div>
          <div
            v-if="confirmMode === 'generate'"
            class="flex items-baseline justify-between gap-4 py-2.5"
          >
            <dt class="text-[13px] text-ink-500">Shakllantiriladi</dt>
            <dd
              class="tabular text-[14px] font-semibold"
              :class="target.pending ? 'text-brand-600' : 'text-ink-400'"
            >
              {{ num(target.pending) }} ta
            </dd>
          </div>
          <div class="flex items-baseline justify-between gap-4 py-2.5">
            <dt class="text-[13px] text-ink-500">Joriy summa</dt>
            <dd class="tabular text-[14px] font-semibold text-ink-900">{{ sum(target.total) }}</dd>
          </div>
        </dl>
      </div>

      <template #footer>
        <UiButton variant="ghost" @click="confirmOpen = false">Bekor qilish</UiButton>
        <UiButton
          :variant="confirmMode === 'generate' ? 'primary' : 'danger'"
          :disabled="confirmMode === 'generate' && !target?.pending"
          @click="applyConfirm"
        >
          <UiIcon name="check" :size="16" />
          {{ confirmMode === 'generate' ? 'Generatsiya qilish' : 'Davrni yopish' }}
        </UiButton>
      </template>
    </UiModal>

    <UiModal
      v-model="detailOpen"
      :title="detail ? detail.label : 'Hisob davri'"
      subtitle="Davr ko‘rsatkichlari"
    >
      <div v-if="detail" class="space-y-5">
        <div class="flex items-center gap-3">
          <span
            class="inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs font-semibold ring-1 ring-inset"
            :class="detail.closed ? TONE_BADGE.neutral : TONE_BADGE.ok"
          >
            <UiIcon :name="detail.closed ? 'lock' : 'check'" :size="12" />
            {{ detail.closed ? 'Yopilgan' : 'Ochiq' }}
          </span>
          <span class="text-[13px] text-ink-500">
            Bajarilish:
            {{ percent(detail.contracts ? (detail.invoices / detail.contracts) * 100 : 0) }}
          </span>
        </div>

        <dl class="grid gap-4 sm:grid-cols-3">
          <div class="rounded-field bg-surface-sunken p-3.5">
            <dt class="text-[12px] text-ink-500">Faol shartnomalar</dt>
            <dd class="tabular mt-1 text-[16px] font-bold text-ink-900">
              {{ num(detail.contracts) }} ta
            </dd>
          </div>
          <div class="rounded-field bg-surface-sunken p-3.5">
            <dt class="text-[12px] text-ink-500">Hisob-fakturalar</dt>
            <dd class="tabular mt-1 text-[16px] font-bold text-ink-900">
              {{ num(detail.invoices) }} ta
            </dd>
          </div>
          <div class="rounded-field bg-surface-sunken p-3.5">
            <dt class="text-[12px] text-ink-500">Jami summa</dt>
            <dd class="tabular mt-1 text-[16px] font-bold text-ink-900">{{ sum(detail.total) }}</dd>
          </div>
        </dl>
      </div>

      <template #footer>
        <UiButton variant="ghost" @click="detailOpen = false">Yopish</UiButton>
        <UiButton :to="`/billing/invoices?period=${detail ? detail.label : ''}`">
          <UiIcon name="doc" :size="16" />
          Hisob-fakturalarni ko‘rish
        </UiButton>
      </template>
    </UiModal>

    <UiModal
      v-model="createOpen"
      size="sm"
      title="Yangi hisob davri"
      subtitle="Yil va oyni tanlang, davr ochiq holatda yaratiladi"
    >
      <div class="grid gap-4 sm:grid-cols-2">
        <UiField label="Yil" required>
          <UiSelect v-model="newYear" :options="yearOptions" />
        </UiField>
        <UiField
          label="Oy"
          required
          :error="duplicate ? 'Bu davr allaqachon ochilgan' : undefined"
        >
          <UiSelect v-model="newMonth" :options="monthOptions" />
        </UiField>
      </div>

      <template #footer>
        <UiButton variant="ghost" @click="createOpen = false">Bekor qilish</UiButton>
        <UiButton :disabled="duplicate" @click="createPeriod">
          <UiIcon name="plus" :size="16" />
          Davrni ochish
        </UiButton>
      </template>
    </UiModal>
  </main>
</template>
