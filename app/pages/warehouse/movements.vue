<script setup lang="ts">
import {
  MATERIAL_REQUESTS,
  SERVICE_REQUESTS,
  STOCK_ITEMS,
  type StockItem,
} from '~/data/operations'
import { dateShort, num, sum, sumShort } from '~/utils/format'

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

const CURRENT_DAY = '2025-05-18'
const PERIOD_START = '2025-05-01'
const OPERATOR = 'Anvar Qodirov'

const stock = ref<StockItem[]>(STOCK_ITEMS.map((i) => ({ ...i })))

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
  const item = STOCK_ITEMS.find((i) => i.id === s.itemId) ?? STOCK_ITEMS[0]!
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

const movements = ref<Movement[]>(SEED_MOVEMENTS.map(buildMovement))

const KIND_META: Record<MovementKind, { label: string; icon: string; badge: string; mark: string }> =
  {
    IN: {
      label: 'Kirim',
      icon: 'arrowUp',
      badge: 'bg-ok-50 text-ok-700 ring-ok-100',
      mark: 'text-ok-600',
    },
    OUT: {
      label: 'Chiqim',
      icon: 'arrowDown',
      badge: 'bg-danger-50 text-danger-700 ring-danger-100',
      mark: 'text-danger-600',
    },
    MOVE: {
      label: 'Ko‘chirish',
      icon: 'refresh',
      badge: 'bg-info-50 text-info-700 ring-info-100',
      mark: 'text-info-600',
    },
  }

function kindMeta(kind: string) {
  return KIND_META[kind as MovementKind] ?? KIND_META.MOVE
}

const from = ref(PERIOD_START)
const to = ref(CURRENT_DAY)
const fKind = ref('all')
const fWarehouse = ref('all')
const onlyOpen = ref(false)
const query = ref('')

const kindOptions = [
  { value: 'all', label: 'Barcha turlar' },
  { value: 'IN', label: 'Kirim' },
  { value: 'OUT', label: 'Chiqim' },
  { value: 'MOVE', label: 'Ko‘chirish' },
]

const warehouseOptions = computed(() => [
  { value: 'all', label: 'Barcha omborlar' },
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

const columns = [
  { key: 'date', label: 'Sana', width: '108px' },
  { key: 'doc', label: 'Hujjat raqami', width: '150px' },
  { key: 'kind', label: 'Turi', width: '132px' },
  { key: 'itemName', label: 'Pozitsiya' },
  { key: 'qty', label: 'Miqdor', align: 'right' as const, numeric: true },
  { key: 'warehouse', label: 'Ombor' },
  { key: 'who', label: 'Kim' },
  { key: 'basis', label: 'Asos', width: '150px' },
]

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
const receiveWarehouse = ref(STOCK_ITEMS[0]!.warehouse)
const receiveItem = ref(STOCK_ITEMS[0]!.id)
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
    receiveError.value = 'Pozitsiyani tanlang'
    return
  }
  if (!qty || qty < 1) {
    receiveError.value = 'Miqdor 1 dan kam bo‘lmasligi kerak'
    return
  }
  if (!receiveParty.value.trim()) {
    receiveError.value = 'Yetkazib beruvchi nomini kiriting'
    return
  }
  if (!receiveDoc.value.trim()) {
    receiveError.value = 'Hujjat raqamini kiriting'
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
    basis: 'Yetkazib beruvchi hujjati',
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
const issueWarehouse = ref(STOCK_ITEMS[0]!.warehouse)
const issueItem = ref(STOCK_ITEMS[0]!.id)
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

const basisOptions = [
  ...SERVICE_REQUESTS.map((r) => ({ value: r.code, label: `${r.code} · ${r.title}` })),
  ...MATERIAL_REQUESTS.map((r) => ({ value: r.code, label: `${r.code} · material so‘rovi` })),
]

const issueSelected = computed(() => issuePool.value.find((i) => i.id === issueItem.value) ?? null)

function openIssue() {
  issueError.value = ''
  issueOpen.value = true
}

function saveIssue() {
  const item = issueSelected.value
  const qty = Number(issueQty.value)
  if (!item) {
    issueError.value = 'Pozitsiyani tanlang'
    return
  }
  if (!qty || qty < 1) {
    issueError.value = 'Miqdor 1 dan kam bo‘lmasligi kerak'
    return
  }
  if (qty > item.qty) {
    issueError.value = `Omborda faqat ${num(item.qty)} ${item.unit} mavjud`
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
    title="Kirim va chiqim"
    subtitle="Ombor harakati jurnali va elektron nakladnoylar"
    :breadcrumb="[{ label: 'Ombor', to: '/warehouse' }, { label: 'Kirim va chiqim' }]"
  >
    <template #actions>
      <template v-if="auth.can('warehouse.issue')">
        <UiButton variant="secondary" size="sm" @click="openReceive">
          <UiIcon name="download" :size="16" />
          Kirim qayd etish
        </UiButton>
        <UiButton size="sm" @click="openIssue">
          <UiIcon name="send" :size="16" />
          Chiqim qayd etish
        </UiButton>
      </template>
      <span
        v-else
        class="inline-flex items-center gap-1.5 rounded-pill bg-ink-100 px-3 py-1.5 text-[12.5px] font-semibold text-ink-600 ring-1 ring-inset ring-ink-200"
      >
        <UiIcon name="eye" :size="15" />
        Kuzatuv rejimi
      </span>
    </template>
  </AppTopbar>

  <main class="scroll-slim flex-1 space-y-5 overflow-y-auto p-6">
    <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <UiKpi
        label="Bugungi kirim"
        :value="num(todayIn)"
        unit="birlik"
        icon="arrowUp"
        tone="ok"
        class="cursor-pointer"
        @click="((fKind = 'IN'), setPeriod(0))"
      />
      <UiKpi
        label="Bugungi chiqim"
        :value="num(todayOut)"
        unit="birlik"
        icon="arrowDown"
        tone="danger"
        class="cursor-pointer"
        @click="((fKind = 'OUT'), setPeriod(0))"
      />
      <UiKpi label="Joriy qoldiq" :value="num(balance)" unit="birlik" icon="box" tone="brand" />
      <UiKpi
        label="Ochiq nakladnoylar"
        :value="num(openDocs)"
        unit="hujjat"
        icon="doc"
        tone="warn"
        class="cursor-pointer"
        @click="((onlyOpen = true), setPeriod(-1))"
      />
    </section>

    <UiCard
      title="Harakat jurnali"
      :subtitle="`${rows.length} ta yozuv · ${sumShort(periodValue)}`"
      flush
      :padded="false"
    >
      <template #actions>
        <UiButton variant="ghost" size="sm" to="/warehouse">
          <UiIcon name="box" :size="16" />
          Ombor qoldig‘i
        </UiButton>
      </template>

      <div class="space-y-3 border-t border-ink-100 bg-surface-sunken px-5 py-4">
        <div class="grid gap-3 lg:grid-cols-4">
          <div class="grid gap-2 sm:grid-cols-2 lg:col-span-2">
            <UiField label="Davr boshi" for="mv-from">
              <UiInput id="mv-from" v-model="from" type="date" />
            </UiField>
            <UiField label="Davr oxiri" for="mv-to">
              <UiInput id="mv-to" v-model="to" type="date" />
            </UiField>
          </div>
          <UiField label="Harakat turi">
            <UiSelect v-model="fKind" :options="kindOptions" />
          </UiField>
          <UiField label="Ombor">
            <UiSelect v-model="fWarehouse" :options="warehouseOptions" />
          </UiField>
        </div>

        <div class="grid gap-3 lg:grid-cols-4">
          <UiInput
            v-model="query"
            placeholder="Hujjat, pozitsiya yoki asos bo‘yicha qidirish"
            class="lg:col-span-2"
          >
            <template #prefix>
              <UiIcon name="search" :size="18" />
            </template>
          </UiInput>

          <div class="flex flex-wrap items-center gap-2 lg:col-span-2">
            <button
              type="button"
              class="rounded-pill px-3 py-2 text-[12.5px] font-semibold ring-1 ring-inset transition-colors"
              :class="
                from === CURRENT_DAY && to === CURRENT_DAY
                  ? 'bg-brand-500 text-white ring-brand-500'
                  : 'bg-surface text-ink-600 ring-ink-200 hover:ring-brand-300'
              "
              @click="setPeriod(0)"
            >
              Bugun
            </button>
            <button
              type="button"
              class="rounded-pill bg-surface px-3 py-2 text-[12.5px] font-semibold text-ink-600 ring-1 ring-inset ring-ink-200 transition-colors hover:ring-brand-300"
              @click="setPeriod(7)"
            >
              7 kun
            </button>
            <button
              type="button"
              class="rounded-pill bg-surface px-3 py-2 text-[12.5px] font-semibold text-ink-600 ring-1 ring-inset ring-ink-200 transition-colors hover:ring-brand-300"
              @click="setPeriod(-1)"
            >
              Butun davr
            </button>
            <button
              type="button"
              class="inline-flex items-center gap-1.5 rounded-pill px-3 py-2 text-[12.5px] font-semibold ring-1 ring-inset transition-colors"
              :class="
                onlyOpen
                  ? 'bg-warn-50 text-warn-700 ring-warn-100'
                  : 'bg-surface text-ink-600 ring-ink-200 hover:ring-brand-300'
              "
              :aria-pressed="onlyOpen"
              @click="onlyOpen = !onlyOpen"
            >
              <UiIcon name="doc" :size="14" />
              Faqat ochiq
            </button>
            <UiButton v-if="dirty" variant="ghost" size="sm" @click="resetFilters">
              <UiIcon name="refresh" :size="16" />
              Tozalash
            </UiButton>
          </div>
        </div>
      </div>

      <UiTable
        :columns="columns"
        :rows="rows"
        empty="Tanlangan davr va shartga mos harakat topilmadi"
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
              class="rounded-pill bg-warn-50 px-1.5 py-0.5 text-[10.5px] font-bold text-warn-700 ring-1 ring-inset ring-warn-100"
            >
              ochiq
            </span>
          </span>
        </template>

        <template #cell-kind="{ row }">
          <span
            class="inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs font-semibold ring-1 ring-inset"
            :class="kindMeta(row.kind).badge"
          >
            <UiIcon :name="kindMeta(row.kind).icon" :size="13" :class="kindMeta(row.kind).mark" />
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
          Qator ustiga bosilsa hujjatning elektron nakladnoyi ochiladi
        </span>
        <span class="tabular text-[14px] font-bold text-ink-900">{{ sum(periodValue) }}</span>
      </div>
    </UiCard>
  </main>

  <UiModal
    v-model="receiveOpen"
    title="Kirim qayd etish"
    subtitle="Omborga qabul qilingan material yoki jihozni hujjatlashtiring"
  >
    <div class="space-y-4">
      <div class="grid gap-4 sm:grid-cols-2">
        <UiField label="Ombor" required>
          <UiSelect
            v-model="receiveWarehouse"
            :options="warehouses.map((w) => ({ value: w, label: w }))"
          />
        </UiField>
        <UiField label="Hujjat raqami" required hint="Raqam avtomatik taklif etiladi">
          <UiInput v-model="receiveDoc" />
        </UiField>
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <UiField label="Pozitsiya" required>
          <UiSelect
            v-model="receiveItem"
            :options="receivePool.map((i) => ({ value: i.id, label: `${i.name} (${i.code})` }))"
          />
        </UiField>
        <UiField label="Miqdor" required>
          <UiInput v-model="receiveQty" type="number" />
        </UiField>
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <UiField label="Yetkazib beruvchi" required>
          <UiInput v-model="receiveParty" placeholder="Tashkilot nomi" />
        </UiField>
        <UiField label="Sana" required>
          <UiInput v-model="receiveDate" type="date" />
        </UiField>
      </div>

      <p v-if="receiveError" class="text-[12.5px] font-medium text-danger-600">{{ receiveError }}</p>
    </div>

    <template #footer>
      <UiButton variant="ghost" @click="receiveOpen = false">Bekor qilish</UiButton>
      <UiButton variant="success" @click="saveReceive">
        <UiIcon name="check" :size="16" />
        Kirimni qayd etish
      </UiButton>
    </template>
  </UiModal>

  <UiModal
    v-model="issueOpen"
    title="Chiqim qayd etish"
    subtitle="Chiqim qayd etilgach elektron nakladnoy shakllantiriladi"
  >
    <div class="space-y-4">
      <div class="grid gap-4 sm:grid-cols-2">
        <UiField label="Ombor" required>
          <UiSelect
            v-model="issueWarehouse"
            :options="warehouses.map((w) => ({ value: w, label: w }))"
          />
        </UiField>
        <UiField label="Pozitsiya" required>
          <UiSelect
            v-model="issueItem"
            :options="issuePool.map((i) => ({ value: i.id, label: `${i.name} (${i.code})` }))"
          />
        </UiField>
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <UiField
          label="Miqdor"
          required
          :hint="
            issueSelected
              ? `Omborda ${num(issueSelected.qty)} ${issueSelected.unit} mavjud`
              : 'Pozitsiya tanlanmagan'
          "
        >
          <UiInput v-model="issueQty" type="number" />
        </UiField>
        <UiField label="Oluvchi" required>
          <UiSelect v-model="issueRecipient" :options="recipientOptions" />
        </UiField>
      </div>

      <UiField label="Asos" required hint="Ish topshirig‘i yoki material so‘rovi kodi">
        <UiSelect v-model="issueBasis" :options="basisOptions" />
      </UiField>

      <p v-if="issueError" class="text-[12.5px] font-medium text-danger-600">{{ issueError }}</p>
    </div>

    <template #footer>
      <UiButton variant="ghost" @click="issueOpen = false">Bekor qilish</UiButton>
      <UiButton @click="saveIssue">
        <UiIcon name="check" :size="16" />
        Chiqimni qayd etish
      </UiButton>
    </template>
  </UiModal>

  <UiModal
    v-model="detailOpen"
    :title="`Elektron nakladnoy ${detail?.doc ?? ''}`"
    :subtitle="
      detailFresh ? 'Hujjat shakllantirildi va jurnalga yozildi' : 'Hujjatning to‘liq ko‘rinishi'
    "
    size="lg"
  >
    <div v-if="detail" class="space-y-4">
      <p
        v-if="detailFresh"
        class="flex items-start gap-2 rounded-field bg-ok-50 px-3.5 py-3 text-[12.5px] text-ok-700"
      >
        <UiIcon name="check" :size="16" class="mt-0.5 shrink-0" />
        {{ kindMeta(detail.kind).label }} qayd etildi, ombor qoldig‘i yangilandi.
      </p>

      <div class="rounded-field bg-white p-5 ring-1 ring-ink-200 sm:p-6">
        <div class="flex flex-wrap items-start justify-between gap-4 border-b border-ink-200 pb-4">
          <div class="min-w-0">
            <p class="text-[17px] font-bold text-ink-900">Elektron nakladnoy</p>
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
                :size="13"
                :class="kindMeta(detail.kind).mark"
              />
              {{ kindMeta(detail.kind).label }}
            </span>
            <AppLogo size="sm" />
          </div>
        </div>

        <dl class="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <div class="flex justify-between gap-3 border-b border-ink-100 pb-2">
            <dt class="text-[12.5px] text-ink-500">Ombor</dt>
            <dd class="text-right text-[13px] font-semibold text-ink-900">{{ detail.warehouse }}</dd>
          </div>
          <div class="flex justify-between gap-3 border-b border-ink-100 pb-2">
            <dt class="text-[12.5px] text-ink-500">
              {{
                detail.kind === 'IN'
                  ? 'Yetkazib beruvchi'
                  : detail.kind === 'OUT'
                    ? 'Oluvchi'
                    : 'Qabul qiluvchi ombor'
              }}
            </dt>
            <dd class="text-right text-[13px] font-semibold text-ink-900">
              {{ detail.kind === 'MOVE' ? detail.target || detail.party : detail.party }}
            </dd>
          </div>
          <div class="flex justify-between gap-3 border-b border-ink-100 pb-2">
            <dt class="text-[12.5px] text-ink-500">Asos</dt>
            <dd class="tabular text-right text-[13px] font-semibold text-brand-600">
              {{ detail.basis }}
            </dd>
          </div>
          <div class="flex justify-between gap-3 border-b border-ink-100 pb-2">
            <dt class="text-[12.5px] text-ink-500">Mas’ul omborchi</dt>
            <dd class="text-right text-[13px] font-semibold text-ink-900">{{ detail.who }}</dd>
          </div>
        </dl>

        <div class="scroll-slim mt-5 overflow-x-auto">
          <table class="w-full min-w-max border-collapse text-sm">
            <thead>
              <tr class="border-b border-ink-200 bg-surface-sunken">
                <th
                  class="px-3 py-2 text-left text-[11.5px] font-semibold uppercase tracking-wide text-ink-500"
                >
                  №
                </th>
                <th
                  class="px-3 py-2 text-left text-[11.5px] font-semibold uppercase tracking-wide text-ink-500"
                >
                  Nomi
                </th>
                <th
                  class="px-3 py-2 text-left text-[11.5px] font-semibold uppercase tracking-wide text-ink-500"
                >
                  Kodi
                </th>
                <th
                  class="px-3 py-2 text-right text-[11.5px] font-semibold uppercase tracking-wide text-ink-500"
                >
                  Miqdor
                </th>
                <th
                  class="px-3 py-2 text-right text-[11.5px] font-semibold uppercase tracking-wide text-ink-500"
                >
                  Narxi
                </th>
                <th
                  class="px-3 py-2 text-right text-[11.5px] font-semibold uppercase tracking-wide text-ink-500"
                >
                  Summa
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
                <td class="tabular px-3 py-2.5 text-right text-ink-700">{{ sum(detail.price) }}</td>
                <td class="tabular px-3 py-2.5 text-right font-bold text-ink-900">
                  {{ sum(detail.qty * detail.price) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div
          class="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-field bg-surface-sunken px-4 py-3"
        >
          <span class="text-[13px] font-semibold text-ink-700">Jami qiymat</span>
          <span class="tabular text-[15px] font-bold text-ink-900">
            {{ sum(detail.qty * detail.price) }}
          </span>
        </div>

        <div class="mt-6 grid gap-6 sm:grid-cols-2">
          <div>
            <p class="text-[12px] text-ink-500">Topshirdi</p>
            <p class="mt-6 border-t border-ink-300 pt-1.5 text-[12.5px] text-ink-600">
              {{ detail.kind === 'IN' ? detail.party : detail.who }}
            </p>
          </div>
          <div>
            <p class="text-[12px] text-ink-500">Qabul qildi</p>
            <p class="mt-6 border-t border-ink-300 pt-1.5 text-[12.5px] text-ink-600">
              {{ detail.kind === 'IN' ? detail.who : detail.party }}
            </p>
          </div>
        </div>
      </div>

      <p
        v-if="detail.open"
        class="flex items-start gap-2 rounded-field bg-warn-50 px-3.5 py-3 text-[12.5px] text-warn-700"
      >
        <UiIcon name="warning" :size="16" class="mt-0.5 shrink-0" />
        Nakladnoy ochiq: hujjat hali yopilmagan va ochiq hujjatlar hisobida turibdi.
      </p>
    </div>

    <template #footer>
      <UiButton variant="ghost" @click="detailOpen = false">Yopish</UiButton>
      <UiButton
        v-if="detail?.open && auth.can('warehouse.issue')"
        variant="success"
        @click="closeDoc"
      >
        <UiIcon name="check" :size="16" />
        Nakladnoyni yopish
      </UiButton>
      <UiButton @click="sendToPrinter">
        <UiIcon name="print" :size="16" />
        Chop etish
      </UiButton>
    </template>
  </UiModal>
</template>
