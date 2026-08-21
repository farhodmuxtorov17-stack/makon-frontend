<script setup lang="ts">
import {
  MATERIAL_REQUESTS,
  SERVICE_REQUESTS,
  STOCK_ITEMS,
  type StockItem,
} from '~/data/operations'
import { dateShort, num } from '~/utils/format'

type MovementKind = 'IN' | 'OUT' | 'MOVE'

interface Movement {
  id: string
  doc: string
  date: string
  kind: MovementKind
  itemId: string
  itemCode: string
  itemName: string
  unit: string
  qty: number
  price: number
  warehouse: string
  target: string
  who: string
  party: string
  basis: string
  open: boolean
}

interface SeedMovement {
  doc: string
  date: string
  kind: MovementKind
  itemId: string
  qty: number
  warehouse: string
  target?: string
  who: string
  party: string
  basis: string
  open?: boolean
}

const auth = useAuthStore()

const { money, moneyShort, t, field, moduleTitle } = useAppLabels()

const CURRENT_DAY = '2025-05-18'
const PERIOD_START = '2025-05-01'
const OPERATOR = 'Anvar Qodirov'

/**
 * Ombor qoldig‘ining yagona manbasi: reyestr, harakatlar va
 * inventarizatsiya ekranlari shu ro‘yxatdan o‘qiydi, shuning uchun kirim
 * yoki chiqimdan keyin qoldiq uch ekranda ham bir xil bo‘ladi.
 */
const allStock = useState<StockItem[]>('stock-items', () =>
  STOCK_ITEMS.map((i) => ({ ...i })),
)

/** Ombor mudiriga faqat biriktirilgan ombor ko‘rinadi */
const stock = computed(() =>
  allStock.value.filter((i) => auth.inWarehouseScope(i.warehouse)),
)

const warehouses = computed(() => [...new Set(stock.value.map((i) => i.warehouse))])

const SEED_MOVEMENTS: SeedMovement[] = [
  {
    doc: 'KIR-2025-0148',
    date: '2025-05-18',
    kind: 'IN',
    itemId: 'w-05',
    qty: 60,
    warehouse: 'Green BC ombori',
    who: OPERATOR,
    party: '«Elektro Trade» MCHJ',
    basis: 'MT-2025-0098',
  },
  {
    doc: 'CHQ-2025-0231',
    date: '2025-05-18',
    kind: 'OUT',
    itemId: 'w-05',
    qty: 24,
    warehouse: 'Green BC ombori',
    who: OPERATOR,
    party: 'Jasur Toshmatov',
    basis: 'SR-2025-0708',
  },
  {
    doc: 'KIR-2025-0147',
    date: '2025-05-18',
    kind: 'IN',
    itemId: 'w-03',
    qty: 40,
    warehouse: 'Markaziy ombor',
    who: OPERATOR,
    party: '«Klimat Servis» MCHJ',
    basis: 'MT-2025-0096',
    open: true,
  },
  {
    doc: 'CHQ-2025-0230',
    date: '2025-05-18',
    kind: 'OUT',
    itemId: 'w-04',
    qty: 120,
    warehouse: 'Green BC ombori',
    who: OPERATOR,
    party: 'Jasur Toshmatov',
    basis: 'SR-2025-0708',
  },
  {
    doc: 'KCH-2025-0042',
    date: '2025-05-18',
    kind: 'MOVE',
    itemId: 'w-07',
    qty: 30,
    warehouse: 'Industrial Park ombori',
    target: 'Markaziy ombor',
    who: OPERATOR,
    party: 'Markaziy ombor',
    basis: 'SR-2025-0699',
  },
  {
    doc: 'CHQ-2025-0229',
    date: '2025-05-17',
    kind: 'OUT',
    itemId: 'w-06',
    qty: 3,
    warehouse: 'Markaziy ombor',
    who: OPERATOR,
    party: 'Jasur Toshmatov',
    basis: 'SR-2025-0703',
  },
  {
    doc: 'KIR-2025-0146',
    date: '2025-05-17',
    kind: 'IN',
    itemId: 'w-08',
    qty: 6,
    warehouse: 'Markaziy ombor',
    who: OPERATOR,
    party: '«Digital Net» MCHJ',
    basis: 'MT-2025-0094',
    open: true,
  },
  {
    doc: 'CHQ-2025-0228',
    date: '2025-05-16',
    kind: 'OUT',
    itemId: 'w-01',
    qty: 4,
    warehouse: 'Markaziy ombor',
    who: OPERATOR,
    party: 'Otabek Rahimov',
    basis: 'SR-2025-0690',
  },
  {
    doc: 'KIR-2025-0145',
    date: '2025-05-16',
    kind: 'IN',
    itemId: 'w-02',
    qty: 24,
    warehouse: 'Markaziy ombor',
    who: OPERATOR,
    party: '«Mebel Grand» MCHJ',
    basis: 'MT-2025-0097',
  },
  {
    doc: 'KCH-2025-0041',
    date: '2025-05-15',
    kind: 'MOVE',
    itemId: 'w-04',
    qty: 80,
    warehouse: 'Markaziy ombor',
    target: 'Green BC ombori',
    who: OPERATOR,
    party: 'Green BC ombori',
    basis: 'MT-2025-0098',
  },
  {
    doc: 'CHQ-2025-0227',
    date: '2025-05-15',
    kind: 'OUT',
    itemId: 'w-03',
    qty: 18,
    warehouse: 'Markaziy ombor',
    who: OPERATOR,
    party: 'Jasur Toshmatov',
    basis: 'SR-2025-0680',
  },
  {
    doc: 'KIR-2025-0144',
    date: '2025-05-14',
    kind: 'IN',
    itemId: 'w-07',
    qty: 120,
    warehouse: 'Industrial Park ombori',
    who: OPERATOR,
    party: '«Qurilish Baza» MCHJ',
    basis: 'MT-2025-0096',
  },
  {
    doc: 'CHQ-2025-0226',
    date: '2025-05-13',
    kind: 'OUT',
    itemId: 'w-07',
    qty: 45,
    warehouse: 'Industrial Park ombori',
    who: OPERATOR,
    party: 'Nigora Aripova',
    basis: 'SR-2025-0699',
  },
  {
    doc: 'KIR-2025-0143',
    date: '2025-05-12',
    kind: 'IN',
    itemId: 'w-01',
    qty: 12,
    warehouse: 'Markaziy ombor',
    who: OPERATOR,
    party: '«Mebel Grand» MCHJ',
    basis: 'MT-2025-0095',
  },
  {
    doc: 'CHQ-2025-0225',
    date: '2025-05-12',
    kind: 'OUT',
    itemId: 'w-02',
    qty: 16,
    warehouse: 'Markaziy ombor',
    who: OPERATOR,
    party: 'Sardor Yo‘ldoshev',
    basis: 'SR-2025-0684',
  },
  {
    doc: 'KIR-2025-0142',
    date: '2025-05-09',
    kind: 'IN',
    itemId: 'w-06',
    qty: 8,
    warehouse: 'Markaziy ombor',
    who: OPERATOR,
    party: '«Sanitex» MCHJ',
    basis: 'MT-2025-0095',
  },
]

function buildMovement(s: SeedMovement, index: number): Movement {
  const item = allStock.value.find((i) => i.id === s.itemId) ?? allStock.value[0]!
  return {
    id: `mv-${String(index + 1).padStart(3, '0')}`,
    doc: s.doc,
    date: s.date,
    kind: s.kind,
    itemId: item.id,
    itemCode: item.code,
    itemName: item.name,
    unit: item.unit,
    qty: s.qty,
    price: item.price,
    warehouse: s.warehouse,
    target: s.target ?? '',
    who: s.who,
    party: s.party,
    basis: s.basis,
    open: s.open ?? false,
  }
}

/** Harakatlar ham biriktirilgan ombor doirasida ko‘rinadi */
const movements = ref<Movement[]>(
  SEED_MOVEMENTS.map(buildMovement).filter(
    (m) => auth.inWarehouseScope(m.warehouse) || (!!m.target && auth.inWarehouseScope(m.target)),
  ),
)

const KIND_META = computed<
  Record<MovementKind, { label: string; icon: string; badge: string; mark: string }>
>(() => ({
  IN: {
    label: t('movement.in'),
    icon: 'arrowUp',
    badge: 'bg-ok-50 text-ok-700 ring-ok-100',
    mark: 'text-ok-600',
  },
  OUT: {
    label: t('movement.out'),
    icon: 'arrowDown',
    badge: 'bg-danger-50 text-danger-700 ring-danger-100',
    mark: 'text-danger-600',
  },
  MOVE: {
    label: t('movement.transfer'),
    icon: 'refresh',
    badge: 'bg-info-50 text-info-700 ring-info-100',
    mark: 'text-info-600',
  },
}))

function kindMeta(kind: string) {
  return KIND_META.value[kind as MovementKind] ?? KIND_META.value.MOVE
}

const from = ref(PERIOD_START)
const to = ref(CURRENT_DAY)
const fKind = ref('all')
const fWarehouse = ref('all')
const onlyOpen = ref(false)
const query = ref('')

const kindOptions = computed(() => [
  { value: 'all', label: t('filter.allTypes') },
  { value: 'IN', label: t('movement.in') },
  { value: 'OUT', label: t('movement.out') },
  { value: 'MOVE', label: t('movement.transfer') },
])

const warehouseOptions = computed(() => [
  { value: 'all', label: t('filter.allWarehouses') },
  ...warehouses.value.map((w) => ({ value: w, label: w })),
])

function setPeriod(days: number) {
  if (days === 0) {
    from.value = CURRENT_DAY
    to.value = CURRENT_DAY
    return
  }
  if (days < 0) {
    from.value = PERIOD_START
    to.value = CURRENT_DAY
    return
  }
  const start = new Date(`${CURRENT_DAY}T00:00:00Z`)
  start.setUTCDate(start.getUTCDate() - days + 1)
  from.value = start.toISOString().slice(0, 10)
  to.value = CURRENT_DAY
}

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  return movements.value.filter((m) => {
    if (from.value && m.date < from.value) return false
    if (to.value && m.date > to.value) return false
    if (fKind.value !== 'all' && m.kind !== fKind.value) return false
    if (fWarehouse.value !== 'all' && m.warehouse !== fWarehouse.value && m.target !== fWarehouse.value)
      return false
    if (onlyOpen.value && !m.open) return false
    if (
      q &&
      ![m.doc, m.itemName, m.itemCode, m.who, m.party, m.basis].some((v) =>
        v.toLowerCase().includes(q),
      )
    )
      return false
    return true
  })
})

const rows = computed(() => filtered.value.map((m) => ({ ...m })))

const dirty = computed(
  () =>
    from.value !== PERIOD_START ||
    to.value !== CURRENT_DAY ||
    fKind.value !== 'all' ||
    fWarehouse.value !== 'all' ||
    onlyOpen.value ||
    !!query.value.trim(),
)

function resetFilters() {
  from.value = PERIOD_START
  to.value = CURRENT_DAY
  fKind.value = 'all'
  fWarehouse.value = 'all'
  onlyOpen.value = false
  query.value = ''
}

const todayIn = computed(() =>
  movements.value.filter((m) => m.date === CURRENT_DAY && m.kind === 'IN').reduce((s, m) => s + m.qty, 0),
)
const todayOut = computed(() =>
  movements.value
    .filter((m) => m.date === CURRENT_DAY && m.kind === 'OUT')
    .reduce((s, m) => s + m.qty, 0),
)
const balance = computed(() => stock.value.reduce((s, i) => s + i.qty, 0))
const openDocs = computed(() => movements.value.filter((m) => m.open).length)

const periodValue = computed(() =>
  filtered.value.reduce((s, m) => s + m.qty * m.price, 0),
)

const columns = computed(() => [
  { key: 'date', label: field('date', 'Sana'), width: '108px' },
  { key: 'doc', label: field('documentNo', 'Hujjat raqami'), width: '150px' },
  { key: 'kind', label: field('type', 'Turi'), width: '132px' },
  { key: 'itemName', label: field('position', 'Pozitsiya') },
  { key: 'qty', label: field('quantity', 'Miqdor'), align: 'right' as const, numeric: true },
  { key: 'warehouse', label: field('warehouse', 'Ombor') },
  { key: 'who', label: field('who', 'Kim') },
  { key: 'basis', label: field('basis', 'Asos'), width: '150px' },
])

function nextDoc(prefix: string) {
  const seq = movements.value
    .filter((m) => m.doc.startsWith(prefix))
    .reduce((mx, m) => Math.max(mx, Number(m.doc.slice(-4)) || 0), 0)
  return `${prefix}-2025-${String(seq + 1).padStart(4, '0')}`
}

const detail = ref<Movement | null>(null)
const detailFresh = ref(false)

const detailOpen = computed({
  get: () => detail.value !== null,
  set: (v: boolean) => {
    if (!v) {
      detail.value = null
      detailFresh.value = false
    }
  },
})

function openDetail(row: Record<string, unknown>) {
  detail.value = movements.value.find((m) => m.id === String(row.id)) ?? null
  detailFresh.value = false
}

function closeDoc() {
  if (!detail.value) return
  const target = movements.value.find((m) => m.id === detail.value!.id)
  if (target) target.open = false
  detail.value = { ...detail.value, open: false }
}

function sendToPrinter() {
  if (import.meta.client) window.print()
}

const receiveOpen = ref(false)
const receiveWarehouse = ref(stock.value[0]?.warehouse ?? allStock.value[0]!.warehouse)
const receiveItem = ref(stock.value[0]?.id ?? allStock.value[0]!.id)
const receiveQty = ref(10)
const receiveParty = ref('')
const receiveDoc = ref('')
const receiveDate = ref(CURRENT_DAY)
const receiveError = ref('')

const receivePool = computed(() => stock.value.filter((i) => i.warehouse === receiveWarehouse.value))

watch(receiveWarehouse, () => {
  if (!receivePool.value.some((i) => i.id === receiveItem.value))
    receiveItem.value = receivePool.value[0]?.id ?? ''
})

function openReceive() {
  receiveDoc.value = nextDoc('KIR')
  receiveError.value = ''
  receiveOpen.value = true
}

function saveReceive() {
  const item = receivePool.value.find((i) => i.id === receiveItem.value)
  const qty = Number(receiveQty.value)
  if (!item) {
    receiveError.value = t('whs.selectPosition')
    return
  }
  if (!qty || qty < 1) {
    receiveError.value = t('whs.qtyMin')
    return
  }
  if (!receiveParty.value.trim()) {
    receiveError.value = t('whs.supplierRequired')
    return
  }
  if (!receiveDoc.value.trim()) {
    receiveError.value = t('whs.docNoRequired')
    return
  }
  item.qty += qty
  const created: Movement = {
    id: `mv-${Date.now().toString(36)}`,
    doc: receiveDoc.value.trim(),
    date: receiveDate.value,
    kind: 'IN',
    itemId: item.id,
    itemCode: item.code,
    itemName: item.name,
    unit: item.unit,
    qty,
    price: item.price,
    warehouse: item.warehouse,
    target: '',
    who: auth.user?.fullName ?? OPERATOR,
    party: receiveParty.value.trim(),
    basis: t('whs.supplierDoc'),
    open: true,
  }
  movements.value.unshift(created)
  receiveOpen.value = false
  receiveQty.value = 10
  receiveParty.value = ''
  receiveError.value = ''
  detail.value = created
  detailFresh.value = true
}

const issueOpen = ref(false)
const issueWarehouse = ref(stock.value[0]?.warehouse ?? allStock.value[0]!.warehouse)
const issueItem = ref(stock.value[0]?.id ?? allStock.value[0]!.id)
const issueQty = ref(5)
const issueRecipient = ref('')
const issueBasis = ref(SERVICE_REQUESTS[1]!.code)
const issueError = ref('')

const issuePool = computed(() => stock.value.filter((i) => i.warehouse === issueWarehouse.value))

watch(issueWarehouse, () => {
  if (!issuePool.value.some((i) => i.id === issueItem.value))
    issueItem.value = issuePool.value[0]?.id ?? ''
})

const recipientOptions = [
  ...new Set([
    ...SERVICE_REQUESTS.map((r) => r.assignee).filter((v): v is string => !!v),
    ...SERVICE_REQUESTS.map((r) => r.requester),
  ]),
].map((r) => ({ value: r, label: r }))
issueRecipient.value = recipientOptions[0]!.value

const basisOptions = computed(() => [
  ...SERVICE_REQUESTS.map((r) => ({ value: r.code, label: `${r.code} · ${r.title}` })),
  ...MATERIAL_REQUESTS.map((r) => ({
    value: r.code,
    label: `${r.code} · ${t('whs.materialRequestLower')}`,
  })),
])

const issueSelected = computed(() => issuePool.value.find((i) => i.id === issueItem.value) ?? null)

function openIssue() {
  issueError.value = ''
  issueOpen.value = true
}

function saveIssue() {
  const item = issueSelected.value
  const qty = Number(issueQty.value)
  if (!item) {
    issueError.value = t('whs.selectPosition')
    return
  }
  if (!qty || qty < 1) {
    issueError.value = t('whs.qtyMin')
    return
  }
  if (qty > item.qty) {
    issueError.value = t('whs.onlyAvailable', { qty: num(item.qty), unit: item.unit })
    return
  }
  item.qty -= qty
  const created: Movement = {
    id: `mv-${Date.now().toString(36)}`,
    doc: nextDoc('CHQ'),
    date: CURRENT_DAY,
    kind: 'OUT',
    itemId: item.id,
    itemCode: item.code,
    itemName: item.name,
    unit: item.unit,
    qty,
    price: item.price,
    warehouse: item.warehouse,
    target: '',
    who: auth.user?.fullName ?? OPERATOR,
    party: issueRecipient.value,
    basis: issueBasis.value,
    open: false,
  }
  movements.value.unshift(created)
  issueOpen.value = false
  issueQty.value = 5
  issueError.value = ''
  detail.value = created
  detailFresh.value = true
}
</script>

<template>
  <AppTopbar
    :title="moduleTitle('movements', 'Kirim va chiqim')"
    :subtitle="t('whs.mvCaption')"
    :breadcrumb="[
      { label: field('warehouse', 'Ombor'), to: '/warehouse' },
      { label: moduleTitle('movements', 'Kirim va chiqim') },
    ]"
  >
    <template #actions>
      <template v-if="auth.can('warehouse.issue')">
        <UiButton variant="secondary" size="sm" @click="openReceive">
          <UiIcon name="download" :size="16" />
          {{ t('whs.mvRecordIn') }}
        </UiButton>
        <UiButton size="sm" @click="openIssue">
          <UiIcon name="send" :size="16" />
          {{ t('whs.mvRecordOut') }}
        </UiButton>
      </template>
      <span
        v-else
        class="inline-flex items-center gap-1.5 rounded-pill bg-ink-100 px-3 py-1.5 text-[13px] font-semibold text-ink-600 ring-1 ring-inset ring-ink-200"
      >
        <UiIcon name="eye" :size="16" />
        {{ t('tour.warehouse.watch.title') }}
      </span>
    </template>
  </AppTopbar>

  <main class="scroll-slim flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
    <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <UiKpi
        :label="t('kpi.inToday')"
        :value="num(todayIn)"
        :unit="t('unitOf.piece')"
        icon="arrowUp"
        tone="ok"
        class="cursor-pointer"
        @click="((fKind = 'IN'), setPeriod(0))"
      />
      <UiKpi
        :label="t('kpi.outToday')"
        :value="num(todayOut)"
        :unit="t('unitOf.piece')"
        icon="arrowDown"
        tone="danger"
        class="cursor-pointer"
        @click="((fKind = 'OUT'), setPeriod(0))"
      />
      <UiKpi
        :label="t('kpi.currentBalance')"
        :value="num(balance)"
        :unit="t('unitOf.piece')"
        icon="box"
        tone="brand"
      />
      <UiKpi
        :label="t('kpi.openWaybills')"
        :value="num(openDocs)"
        :unit="t('whs.docWord')"
        icon="doc"
        tone="warn"
        class="cursor-pointer"
        @click="((onlyOpen = true), setPeriod(-1))"
      />
    </section>

    <UiCard
      :title="t('whs.mvJournal')"
      :subtitle="`${t('whs.recordCount', { n: rows.length })} · ${moneyShort(periodValue)}`"
      flush
      :padded="false"
    >
      <template #actions>
        <UiButton variant="ghost" size="sm" to="/warehouse">
          <UiIcon name="box" :size="16" />
          {{ t('kpi.stockBalance') }}
        </UiButton>
      </template>

      <div class="space-y-3 border-t border-ink-100 bg-surface-sunken px-5 py-4">
        <div class="grid gap-3 lg:grid-cols-4">
          <div class="grid gap-2 sm:grid-cols-2 lg:col-span-2">
            <UiField :label="t('whs.periodFrom')" for="mv-from">
              <UiInput id="mv-from" v-model="from" type="date" />
            </UiField>
            <UiField :label="t('whs.periodTo')" for="mv-to">
              <UiInput id="mv-to" v-model="to" type="date" />
            </UiField>
          </div>
          <UiField :label="t('whs.mvKind')">
            <UiSelect v-model="fKind" :options="kindOptions" />
          </UiField>
          <UiField :label="field('warehouse', 'Ombor')">
            <UiSelect v-model="fWarehouse" :options="warehouseOptions" />
          </UiField>
        </div>

        <div class="grid gap-3 lg:grid-cols-4">
          <UiInput
            v-model="query"
            :placeholder="t('whs.mvSearch')"
            class="lg:col-span-2"
          >
            <template #prefix>
              <UiIcon name="search" :size="18" />
            </template>
          </UiInput>

          <div class="flex flex-wrap items-center gap-2 lg:col-span-2">
            <button
              type="button"
              class="rounded-pill px-3 py-2 text-[13px] font-semibold ring-1 ring-inset transition-colors"
              :class="
                from === CURRENT_DAY && to === CURRENT_DAY
                  ? 'bg-brand-500 text-white ring-brand-500'
                  : 'bg-surface text-ink-600 ring-ink-200 hover:ring-brand-300'
              "
              @click="setPeriod(0)"
            >
              {{ t('filter.today') }}
            </button>
            <button
              type="button"
              class="rounded-pill bg-surface px-3 py-2 text-[13px] font-semibold text-ink-600 ring-1 ring-inset ring-ink-200 transition-colors hover:ring-brand-300"
              @click="setPeriod(7)"
            >
              {{ t('filter.week') }}
            </button>
            <button
              type="button"
              class="rounded-pill bg-surface px-3 py-2 text-[13px] font-semibold text-ink-600 ring-1 ring-inset ring-ink-200 transition-colors hover:ring-brand-300"
              @click="setPeriod(-1)"
            >
              {{ t('filter.allTime') }}
            </button>
            <button
              type="button"
              class="inline-flex items-center gap-1.5 rounded-pill px-3 py-2 text-[13px] font-semibold ring-1 ring-inset transition-colors"
              :class="
                onlyOpen
                  ? 'bg-warn-50 text-warn-700 ring-warn-100'
                  : 'bg-surface text-ink-600 ring-ink-200 hover:ring-brand-300'
              "
              :aria-pressed="onlyOpen"
              @click="onlyOpen = !onlyOpen"
            >
              <UiIcon name="doc" :size="14" />
              {{ t('filter.onlyOpen') }}
            </button>
            <UiButton v-if="dirty" variant="ghost" size="sm" @click="resetFilters">
              <UiIcon name="refresh" :size="16" />
              {{ t('common.reset') }}
            </UiButton>
          </div>
        </div>
      </div>

      <UiTable
        :columns="columns"
        :rows="rows"
        :empty="t('whs.mvEmpty')"
        @row-click="openDetail"
      >
        <template #cell-date="{ row }">
          <span class="tabular">{{ dateShort(row.date) }}</span>
        </template>

        <template #cell-doc="{ row }">
          <span class="flex items-center gap-1.5">
            <span class="tabular text-[13px] font-bold text-ink-900">{{ row.doc }}</span>
            <span
              v-if="row.open"
              class="rounded-pill bg-warn-50 px-1.5 py-0.5 text-[11px] font-bold text-warn-700 ring-1 ring-inset ring-warn-100"
            >
              {{ t('whs.openBadge') }}
            </span>
          </span>
        </template>

        <template #cell-kind="{ row }">
          <span
            class="inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs font-semibold ring-1 ring-inset"
            :class="kindMeta(row.kind).badge"
          >
            <UiIcon :name="kindMeta(row.kind).icon" :size="14" :class="kindMeta(row.kind).mark" />
            {{ kindMeta(row.kind).label }}
          </span>
        </template>

        <template #cell-itemName="{ row }">
          <span class="block font-semibold text-ink-900">{{ row.itemName }}</span>
          <span class="tabular block text-[12px] text-ink-500">{{ row.itemCode }}</span>
        </template>

        <template #cell-qty="{ row }">
          <span :class="row.kind === 'OUT' ? 'text-danger-700' : 'text-ink-900'">
            {{ row.kind === 'OUT' ? '−' : row.kind === 'IN' ? '+' : '' }}{{ num(row.qty) }}
          </span>
          <span class="ml-1 text-[12px] font-normal text-ink-500">{{ row.unit }}</span>
        </template>

        <template #cell-warehouse="{ row }">
          <span class="block text-[13px] text-ink-700">{{ row.warehouse }}</span>
          <span v-if="row.target" class="block text-[12px] text-info-600">→ {{ row.target }}</span>
        </template>

        <template #cell-basis="{ row }">
          <span class="tabular text-[13px] font-semibold text-brand-600">{{ row.basis }}</span>
        </template>
      </UiTable>

      <div
        class="flex flex-wrap items-center justify-between gap-2 border-t border-ink-200 bg-surface-sunken px-5 py-3.5"
      >
        <span class="text-[13px] text-ink-600">
          {{ t('whs.mvRowHint') }}
        </span>
        <span class="tabular text-[14px] font-bold text-ink-900">{{ money(periodValue) }}</span>
      </div>
    </UiCard>
  </main>

  <UiModal
    v-model="receiveOpen"
    :title="t('whs.mvRecordIn')"
    :subtitle="t('whs.mvRecordInCaption')"
  >
    <div class="space-y-4">
      <div class="grid gap-4 sm:grid-cols-2">
        <UiField :label="field('warehouse', 'Ombor')" required>
          <UiSelect
            v-model="receiveWarehouse"
            :options="warehouses.map((w) => ({ value: w, label: w }))"
          />
        </UiField>
        <UiField :label="field('documentNo', 'Hujjat raqami')" required :hint="t('whs.docNoAutoHint')">
          <UiInput v-model="receiveDoc" />
        </UiField>
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <UiField :label="field('position', 'Pozitsiya')" required>
          <UiSelect
            v-model="receiveItem"
            :options="receivePool.map((i) => ({ value: i.id, label: `${i.name} (${i.code})` }))"
          />
        </UiField>
        <UiField :label="field('quantity', 'Miqdor')" required>
          <UiInput v-model="receiveQty" type="number" />
        </UiField>
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <UiField :label="field('supplier', 'Yetkazib beruvchi')" required>
          <UiInput v-model="receiveParty" :placeholder="t('apply.orgLabel')" />
        </UiField>
        <UiField :label="field('date', 'Sana')" required>
          <UiInput v-model="receiveDate" type="date" />
        </UiField>
      </div>

      <p v-if="receiveError" class="text-[13px] font-medium text-danger-600">{{ receiveError }}</p>
    </div>

    <template #footer>
      <UiButton variant="ghost" @click="receiveOpen = false">{{ t('common.cancel') }}</UiButton>
      <UiButton variant="success" @click="saveReceive">
        <UiIcon name="check" :size="16" />
        {{ t('whs.mvSaveIn') }}
      </UiButton>
    </template>
  </UiModal>

  <UiModal
    v-model="issueOpen"
    :title="t('whs.mvRecordOut')"
    :subtitle="t('whs.mvRecordOutCaption')"
  >
    <div class="space-y-4">
      <div class="grid gap-4 sm:grid-cols-2">
        <UiField :label="field('warehouse', 'Ombor')" required>
          <UiSelect
            v-model="issueWarehouse"
            :options="warehouses.map((w) => ({ value: w, label: w }))"
          />
        </UiField>
        <UiField :label="field('position', 'Pozitsiya')" required>
          <UiSelect
            v-model="issueItem"
            :options="issuePool.map((i) => ({ value: i.id, label: `${i.name} (${i.code})` }))"
          />
        </UiField>
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <UiField
          :label="field('quantity', 'Miqdor')"
          required
          :hint="
            issueSelected
              ? t('whs.inStockHint', { qty: num(issueSelected.qty), unit: issueSelected.unit })
              : t('whs.noPositionSelected')
          "
        >
          <UiInput v-model="issueQty" type="number" />
        </UiField>
        <UiField :label="field('receiver', 'Oluvchi')" required>
          <UiSelect v-model="issueRecipient" :options="recipientOptions" />
        </UiField>
      </div>

      <UiField :label="field('basis', 'Asos')" required :hint="t('whs.basisHint')">
        <UiSelect v-model="issueBasis" :options="basisOptions" />
      </UiField>

      <p v-if="issueError" class="text-[13px] font-medium text-danger-600">{{ issueError }}</p>
    </div>

    <template #footer>
      <UiButton variant="ghost" @click="issueOpen = false">{{ t('common.cancel') }}</UiButton>
      <UiButton @click="saveIssue">
        <UiIcon name="check" :size="16" />
        {{ t('whs.mvSaveOut') }}
      </UiButton>
    </template>
  </UiModal>

  <UiModal
    v-model="detailOpen"
    :title="t('whs.waybillWithCode', { code: detail?.doc ?? '' })"
    :subtitle="detailFresh ? t('whs.waybillCreated') : t('whs.waybillFull')"
    size="lg"
  >
    <div v-if="detail" class="space-y-4">
      <p
        v-if="detailFresh"
        class="flex items-start gap-2 rounded-field bg-ok-50 px-3.5 py-3 text-[13px] text-ok-700"
      >
        <UiIcon name="check" :size="16" class="mt-0.5 shrink-0" />
        {{ t('whs.mvRecordedNote', { kind: kindMeta(detail.kind).label }) }}
      </p>

      <div class="rounded-field bg-white p-5 ring-1 ring-ink-200 sm:p-6">
        <div class="flex flex-wrap items-start justify-between gap-4 border-b border-ink-200 pb-4">
          <div class="min-w-0">
            <p class="text-[18px] font-bold text-ink-900">{{ t('whs.waybill') }}</p>
            <p class="tabular mt-1 text-[13px] text-ink-500">
              {{ detail.doc }} · {{ dateShort(detail.date) }}
            </p>
          </div>
          <div class="flex shrink-0 items-center gap-3">
            <span
              class="inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs font-semibold ring-1 ring-inset"
              :class="kindMeta(detail.kind).badge"
            >
              <UiIcon
                :name="kindMeta(detail.kind).icon"
                :size="14"
                :class="kindMeta(detail.kind).mark"
              />
              {{ kindMeta(detail.kind).label }}
            </span>
            <AppLogo size="sm" />
          </div>
        </div>

        <dl class="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <div class="flex justify-between gap-3 border-b border-ink-100 pb-2">
            <dt class="text-[13px] text-ink-500">{{ field('warehouse', 'Ombor') }}</dt>
            <dd class="text-right text-[13px] font-semibold text-ink-900">{{ detail.warehouse }}</dd>
          </div>
          <div class="flex justify-between gap-3 border-b border-ink-100 pb-2">
            <dt class="text-[13px] text-ink-500">
              {{
                detail.kind === 'IN'
                  ? field('supplier', 'Yetkazib beruvchi')
                  : detail.kind === 'OUT'
                    ? field('receiver', 'Oluvchi')
                    : t('whs.receivingWarehouse')
              }}
            </dt>
            <dd class="text-right text-[13px] font-semibold text-ink-900">
              {{ detail.kind === 'MOVE' ? detail.target || detail.party : detail.party }}
            </dd>
          </div>
          <div class="flex justify-between gap-3 border-b border-ink-100 pb-2">
            <dt class="text-[13px] text-ink-500">{{ field('basis', 'Asos') }}</dt>
            <dd class="tabular text-right text-[13px] font-semibold text-brand-600">
              {{ detail.basis }}
            </dd>
          </div>
          <div class="flex justify-between gap-3 border-b border-ink-100 pb-2">
            <dt class="text-[13px] text-ink-500">{{ t('whs.responsibleStorekeeper') }}</dt>
            <dd class="text-right text-[13px] font-semibold text-ink-900">{{ detail.who }}</dd>
          </div>
        </dl>

        <div class="scroll-slim mt-5 overflow-x-auto">
          <table class="w-full min-w-max border-collapse text-sm">
            <thead>
              <tr class="border-b border-ink-200 bg-surface-sunken">
                <th
                  class="px-3 py-2 text-left text-[12px] font-semibold uppercase tracking-wide text-ink-500"
                >
                  №
                </th>
                <th
                  class="px-3 py-2 text-left text-[12px] font-semibold uppercase tracking-wide text-ink-500"
                >
                  {{ field('name', 'Nomi') }}
                </th>
                <th
                  class="px-3 py-2 text-left text-[12px] font-semibold uppercase tracking-wide text-ink-500"
                >
                  {{ field('code', 'Kod') }}
                </th>
                <th
                  class="px-3 py-2 text-right text-[12px] font-semibold uppercase tracking-wide text-ink-500"
                >
                  {{ field('quantity', 'Miqdor') }}
                </th>
                <th
                  class="px-3 py-2 text-right text-[12px] font-semibold uppercase tracking-wide text-ink-500"
                >
                  {{ field('price', 'Narx') }}
                </th>
                <th
                  class="px-3 py-2 text-right text-[12px] font-semibold uppercase tracking-wide text-ink-500"
                >
                  {{ field('amount', 'Summa') }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr class="border-b border-ink-100">
                <td class="tabular px-3 py-2.5 text-ink-500">1</td>
                <td class="px-3 py-2.5 font-semibold text-ink-900">{{ detail.itemName }}</td>
                <td class="tabular px-3 py-2.5 text-ink-600">{{ detail.itemCode }}</td>
                <td class="tabular px-3 py-2.5 text-right font-semibold text-ink-900">
                  {{ num(detail.qty) }} {{ detail.unit }}
                </td>
                <td class="tabular px-3 py-2.5 text-right text-ink-700">{{ money(detail.price) }}</td>
                <td class="tabular px-3 py-2.5 text-right font-bold text-ink-900">
                  {{ money(detail.qty * detail.price) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div
          class="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-field bg-surface-sunken px-4 py-3"
        >
          <span class="text-[13px] font-semibold text-ink-700">{{ t('whs.totalValue') }}</span>
          <span class="tabular text-[16px] font-bold text-ink-900">
            {{ money(detail.qty * detail.price) }}
          </span>
        </div>

        <div class="mt-6 grid gap-6 sm:grid-cols-2">
          <div>
            <p class="text-[12px] text-ink-500">{{ t('whs.handedOver') }}</p>
            <p class="mt-6 border-t border-ink-300 pt-1.5 text-[13px] text-ink-600">
              {{ detail.kind === 'IN' ? detail.party : detail.who }}
            </p>
          </div>
          <div>
            <p class="text-[12px] text-ink-500">{{ t('whs.acceptedBy') }}</p>
            <p class="mt-6 border-t border-ink-300 pt-1.5 text-[13px] text-ink-600">
              {{ detail.kind === 'IN' ? detail.who : detail.party }}
            </p>
          </div>
        </div>
      </div>

      <p
        v-if="detail.open"
        class="flex items-start gap-2 rounded-field bg-warn-50 px-3.5 py-3 text-[13px] text-warn-700"
      >
        <UiIcon name="warning" :size="16" class="mt-0.5 shrink-0" />
        {{ t('whs.waybillOpenNote') }}
      </p>
    </div>

    <template #footer>
      <UiButton variant="ghost" @click="detailOpen = false">{{ t('tour.skip') }}</UiButton>
      <UiButton
        v-if="detail?.open && auth.can('warehouse.issue')"
        variant="success"
        @click="closeDoc"
      >
        <UiIcon name="check" :size="16" />
        {{ t('whs.closeWaybill') }}
      </UiButton>
      <UiButton @click="sendToPrinter">
        <UiIcon name="print" :size="16" />
        {{ t('common.print') }}
      </UiButton>
    </template>
  </UiModal>
</template>
