<script setup lang="ts">
import {
  MATERIAL_REQUESTS,
  SERVICE_REQUESTS,
  STOCK_CATEGORIES,
  STOCK_ITEMS,
  buildWarehouseSummary,
  issueLinesFor,
  materialsFor,
  stockByCode,
  type MaterialRequest,
  type StockItem,
  type WorkMaterialLine,
} from '~/data/operations'
import { docxBlob, saveBlob, type DocxLine } from '~/utils/docx'
import { dateShort, num, todayIso } from '~/utils/format'

/** Material so‘rovi reyestrdagi yozuvga asos va haqiqiy pozitsiyalarni qo‘shadi */
interface MaterialRequestEntry extends MaterialRequest {
  reason?: string
  lines?: WorkMaterialLine[]
  /** Ombordan berilgan sana: dalolatnoma sanasi shu maydondan olinadi */
  issuedAt?: string
}

interface IssueAct {
  id: string
  code: string
  recipient: string
  request: string
  warehouse: string
  positions: number
  at: string
  status: 'APPROVED' | 'ISSUED'
  lines: Array<{ name: string; unit: string; qty: number }>
}

const auth = useAuthStore()

const { money, moneyShort, t, field, moduleTitle } = useAppLabels()

/**
 * Ombor qoldig‘ining yagona manbasi: reyestr, harakatlar va
 * inventarizatsiya ekranlari shu ro‘yxatdan o‘qiydi, shuning uchun kirim
 * yoki chiqimdan keyin qoldiq uch ekranda ham bir xil bo‘ladi.
 */
const allStock = useState<StockItem[]>('stock-items', () =>
  STOCK_ITEMS.map((i) => ({ ...i })),
)

/** Ombor mudiriga faqat biriktirilgan ombor ko‘rinadi */
const items = computed(() =>
  allStock.value.filter((i) => auth.inWarehouseScope(i.warehouse)),
)

const warehouses = computed(() => [...new Set(items.value.map((i) => i.warehouse))])

const query = ref('')
const fCategory = ref('all')
const fWarehouse = ref('all')

const categoryOptions = computed(() => [
  { value: 'all', label: t('filter.allCategories') },
  ...STOCK_CATEGORIES.map((c) => ({ value: c.label, label: c.label })),
])

const warehouseOptions = computed(() => [
  { value: 'all', label: t('filter.allWarehouses') },
  ...warehouses.value.map((w) => ({ value: w, label: w })),
])

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  return items.value.filter((i) => {
    if (fCategory.value !== 'all' && i.category !== fCategory.value) return false
    if (fWarehouse.value !== 'all' && i.warehouse !== fWarehouse.value) return false
    if (q && ![i.code, i.name, i.category, i.warehouse].some((v) => v.toLowerCase().includes(q)))
      return false
    return true
  })
})

const rows = computed(() => filtered.value.map((i) => ({ ...i })))

function toggleCategory(label: string) {
  fCategory.value = fCategory.value === label ? 'all' : label
}

const dirty = computed(
  () => !!query.value.trim() || fCategory.value !== 'all' || fWarehouse.value !== 'all',
)

function resetFilters() {
  query.value = ''
  fCategory.value = 'all'
  fWarehouse.value = 'all'
}

interface LevelDef {
  key: string
  label: string
  badge: string
  mark: string
  shape: 'check' | 'bar' | 'triangle'
}

function levelOf(qty: number, minQty: number): LevelDef {
  if (qty >= minQty * 2)
    return {
      key: 'ok',
      label: t('whs.levelOk'),
      badge: 'bg-ok-50 text-ok-700 ring-ok-100',
      mark: 'text-ok-500',
      shape: 'check',
    }
  if (qty >= minQty)
    return {
      key: 'warn',
      label: t('whs.levelMid'),
      badge: 'bg-warn-50 text-warn-700 ring-warn-100',
      mark: 'text-warn-500',
      shape: 'bar',
    }
  return {
    key: 'danger',
    label: t('whs.levelLow'),
    badge: 'bg-danger-50 text-danger-700 ring-danger-100',
    mark: 'text-danger-500',
    shape: 'triangle',
  }
}

const columns = computed(() => [
  { key: 'code', label: field('code', 'Kod'), width: '116px' },
  { key: 'name', label: field('name', 'Nomi') },
  { key: 'category', label: field('category', 'Kategoriya') },
  { key: 'unit', label: field('unitOfMeasure', 'O‘lchov birligi') },
  { key: 'qty', label: field('available', 'Mavjud miqdor'), align: 'right' as const, numeric: true },
  { key: 'minQty', label: field('minStock', 'Minimal zaxira'), align: 'right' as const, numeric: true },
  { key: 'level', label: field('stockLevel', 'Zaxira darajasi') },
  { key: 'warehouse', label: field('warehouse', 'Ombor') },
])

const extraIn = ref(0)
const extraOut = ref(0)

/**
 * Jamlanma ham rol doirasidagi ro‘yxatdan hisoblanadi: kartadagi son
 * jadvaldagi qatorlarga mos keladi. Qoldiq bevosita `items` dan sanaladi,
 * shuning uchun qabul va berish amali kartada darhol aks etadi.
 */
const scopedSummary = computed(() =>
  buildWarehouseSummary(items.value, materialRequests.value),
)

const summary = computed(() => [
  {
    key: 'in',
    label: t('movement.in'),
    value: num(scopedSummary.value.inbound + extraIn.value),
    unit: t('unitOf.piece'),
    icon: 'arrowUp',
    tone: 'ok',
  },
  {
    key: 'out',
    label: t('movement.out'),
    value: num(scopedSummary.value.outbound + extraOut.value),
    unit: t('unitOf.piece'),
    icon: 'arrowDown',
    tone: 'danger',
  },
  {
    key: 'balance',
    label: t('field.balance'),
    value: num(scopedSummary.value.balance),
    unit: t('unitOf.piece'),
    icon: 'box',
    tone: 'brand',
  },
])

/** Berish amali faqat ombor mas’ulida */
const canIssue = computed(() => auth.can('warehouse.issue'))

/** Material so‘rovlari reyestri: ariza va material sahifasi bilan umumiy */
const materialRequests = useState<MaterialRequestEntry[]>('material-requests', () =>
  MATERIAL_REQUESTS.map((r) => ({ ...r })),
)

/** So‘rovning to‘liq qatorlari: ombor kodi bilan, qoldiqni kamaytirish uchun */
function requestLines(r: MaterialRequestEntry): WorkMaterialLine[] {
  return r.lines ?? materialsFor(r.workOrder)
}

/** Dalolatnoma qatorlari: so‘rovning haqiqiy pozitsiyalari va miqdorlari */
function actLinesOf(r: MaterialRequestEntry) {
  return r.lines
    ? r.lines.map((l) => ({ name: l.name, unit: l.unit, qty: l.qty }))
    : issueLinesFor(r.workOrder)
}

/** Dalolatnoma qaysi omborga tegishli: doiradagi birinchi pozitsiyaning ombori */
function warehouseOfRequest(r: MaterialRequestEntry): string {
  for (const line of requestLines(r)) {
    const item = stockByCode(line.code)
    if (item && auth.inWarehouseScope(item.warehouse)) return item.warehouse
  }
  return items.value[0]?.warehouse ?? 'Markaziy ombor'
}

function actOfRequest(r: MaterialRequestEntry): IssueAct {
  const lines = actLinesOf(r)
  return {
    id: r.id,
    code: r.code.replace('MT-', 'BD-'),
    recipient: r.requester,
    request: r.workOrder,
    warehouse: warehouseOfRequest(r),
    positions: lines.length,
    at: r.issuedAt ?? r.createdAt,
    status: r.status === 'ISSUED' ? 'ISSUED' : 'APPROVED',
    lines,
  }
}

/** Qo‘lda tuzilgan dalolatnomalar: material so‘roviga bog‘lanmagan */
const manualActs = ref<IssueAct[]>([])

const acts = computed<IssueAct[]>(() => [
  ...manualActs.value,
  ...materialRequests.value
    .filter((r) => r.status === 'ISSUED' || r.status === 'APPROVED')
    .map(actOfRequest),
])

/** Berishni kutayotgan so‘rovlar: nishoncha bilan bir xil shart */
const pendingIssue = computed(() =>
  materialRequests.value.filter((r) => r.status === 'APPROVED'),
)

const handoverError = ref('')

/**
 * Tasdiqlangan so‘rov bo‘yicha material berish: ombor qoldig‘i kamayadi va
 * so‘rov ISSUED holatiga o‘tadi, dalolatnoma shu qatorlardan quriladi.
 */
function handoverRequest(r: MaterialRequestEntry) {
  if (!canIssue.value || r.status !== 'APPROVED') return
  const lines = requestLines(r)
  const short = lines.find((l) => {
    const target = items.value.find((i) => i.code === l.code)
    return !target || target.qty < l.qty
  })
  if (short) {
    const target = items.value.find((i) => i.code === short.code)
    handoverError.value = target
      ? t('whs.shortInStock', { name: short.name, qty: target.qty, unit: target.unit })
      : t('whs.notInYourWarehouse', { name: short.name })
    return
  }
  for (const l of lines) {
    const target = items.value.find((i) => i.code === l.code)
    if (target) target.qty -= l.qty
  }
  // Chiqim jamlanmasi ISSUED so‘rovlardan hisoblanadi, qo‘shimcha qo‘shilmaydi
  const row = materialRequests.value.find((x) => x.id === r.id)
  if (row) {
    row.status = 'ISSUED'
    row.issuedAt = todayIso()
  }
  handoverError.value = ''
}

const actColumns = computed(() => [
  { key: 'code', label: field('number', 'Raqam'), width: '150px' },
  { key: 'recipient', label: field('issuedTo', 'Kimga berildi') },
  { key: 'request', label: field('basisRequest', 'Qaysi ariza bo‘yicha') },
  { key: 'warehouse', label: field('warehouse', 'Ombor') },
  { key: 'positions', label: field('positions', 'Pozitsiya'), align: 'right' as const, numeric: true },
  { key: 'at', label: field('date', 'Sana') },
  { key: 'status', label: field('status', 'Holat') },
  { key: 'print', label: field('action', 'Amal'), align: 'right' as const },
])

const actRows = computed(() => acts.value.map((a) => ({ ...a })))

const printAct = ref<IssueAct | null>(null)
const printOpen = computed({
  get: () => printAct.value !== null,
  set: (v: boolean) => {
    if (!v) printAct.value = null
  },
})

function openAct(row: Record<string, unknown>) {
  printAct.value = acts.value.find((a) => a.id === String(row.id)) ?? null
}

function sendToPrinter() {
  if (import.meta.client) window.print()
}

/** Berish dalolatnomasi Word hujjati sifatida */
function actDocLines(a: IssueAct): DocxLine[] {
  return [
    { text: 'Makon Property Group', style: 'subtitle' },
    { text: t('whs.issueActTitle'), style: 'title' },
    { text: `${a.code} · ${dateShort(a.at)}`, style: 'subtitle' },
    { text: t('field.document'), style: 'heading' },
    { text: `${t('field.issuedTo')}: ${a.recipient}` },
    { text: `${t('field.basisRequest')}: ${a.request}` },
    { text: `${t('field.warehouse')}: ${a.warehouse}` },
    { text: `${t('role.WAREHOUSE_OPERATOR.label')}: ${auth.user?.fullName ?? t('whs.warehouseManager')}` },
    { text: t('whs.positionsSection'), style: 'heading' },
    ...a.lines.map((l, i) => ({ text: `${i + 1}. ${l.name}: ${l.qty} ${l.unit}` })),
    { text: t('whs.signatures'), style: 'heading' },
    { text: `${t('whs.issuedBy')}: ${auth.user?.fullName ?? t('whs.warehouseManager')}`, style: 'small' as const },
    { text: `${t('whs.receivedBy')}: ${a.recipient}`, style: 'small' as const },
  ]
}

function downloadAct() {
  const a = printAct.value
  if (!a) return
  saveBlob(docxBlob(actDocLines(a)), `${a.code}-dalolatnoma.docx`)
}

const receiveOpen = ref(false)
const receiveItem = ref(items.value[0]?.id ?? allStock.value[0]!.id)
const receiveQty = ref(10)
const receiveWarehouse = ref(items.value[0]?.warehouse ?? allStock.value[0]!.warehouse)
const receiveNote = ref('')
const receiveError = ref('')

const receivePool = computed(() => items.value.filter((i) => i.warehouse === receiveWarehouse.value))

watch(receiveWarehouse, () => {
  if (!receivePool.value.some((i) => i.id === receiveItem.value))
    receiveItem.value = receivePool.value[0]?.id ?? ''
})

function saveReceive() {
  const target = receivePool.value.find((i) => i.id === receiveItem.value)
  const qty = Number(receiveQty.value)
  if (!target || !qty || qty < 1) {
    receiveError.value = t('whs.selectItemAndQty')
    return
  }
  target.qty += qty
  extraIn.value += qty
  receiveQty.value = 10
  receiveNote.value = ''
  receiveError.value = ''
  receiveOpen.value = false
}

const issueOpen = ref(false)
const issueRecipient = ref('')
const issueRequest = ref(SERVICE_REQUESTS[1]!.code)
const issueWarehouse = ref(items.value[0]?.warehouse ?? allStock.value[0]!.warehouse)
const issueNote = ref('')
const issueError = ref('')
const issueQty = ref<Record<string, number>>({})

const recipientOptions = [...new Set(SERVICE_REQUESTS.map((r) => r.requester))].map((r) => ({
  value: r,
  label: r,
}))
issueRecipient.value = recipientOptions[0]!.value

const requestOptions = SERVICE_REQUESTS.map((r) => ({
  value: r.code,
  label: `${r.code} · ${r.title}`,
}))

const issuePool = computed(() => items.value.filter((i) => i.warehouse === issueWarehouse.value))

const issueLines = computed(() =>
  issuePool.value
    .filter((i) => (issueQty.value[i.id] ?? 0) > 0)
    .map((i) => ({ item: i, qty: Number(issueQty.value[i.id]) })),
)

const issueTotal = computed(() => issueLines.value.reduce((s, l) => s + l.qty * l.item.price, 0))
const issueUnits = computed(() => issueLines.value.reduce((s, l) => s + l.qty, 0))

function resetIssue() {
  issueQty.value = {}
  issueNote.value = ''
  issueError.value = ''
}

function saveIssue() {
  if (!issueLines.value.length) {
    issueError.value = t('whs.enterAtLeastOneQty')
    return
  }
  const over = issueLines.value.find((l) => l.qty > l.item.qty)
  if (over) {
    issueError.value = t('whs.shortInStock', { name: over.item.name, qty: over.item.qty, unit: over.item.unit })
    return
  }
  const seq = acts.value.reduce((m, a) => Math.max(m, Number(a.code.slice(-4)) || 0), 0) + 1
  const numbered = String(seq).padStart(4, '0')
  const lines = issueLines.value.map((l) => ({ name: l.item.name, unit: l.item.unit, qty: l.qty }))
  issueLines.value.forEach((l) => {
    const target = items.value.find((i) => i.id === l.item.id)
    if (target) target.qty -= l.qty
  })
  extraOut.value += issueUnits.value
  manualActs.value.unshift({
    id: `bd-${numbered}`,
    // Hujjat raqamining yili joriy sanadan olinadi
    code: `BD-${new Date().getFullYear()}-${numbered}`,
    recipient: issueRecipient.value,
    request: issueRequest.value,
    warehouse: issueWarehouse.value,
    positions: lines.length,
    at: todayIso(),
    status: 'ISSUED',
    lines,
  })
  issueOpen.value = false
  resetIssue()
}

/* --- Jonli izoh ---
 * Omborchi uchun izoh kunlik tartibni takrorlaydi: qoldiqni ko‘rish, kirimni
 * qabul qilish, so‘rov bo‘yicha material berish va dalolatnoma bilan
 * rasmiylashtirish. Berish huquqi yo‘q rol kuzatuv izohini oladi.
 */
function tourStep(key: string, target?: string) {
  return {
    target,
    title: t(`tour.warehouse.${key}.title`),
    body: t(`tour.warehouse.${key}.body`),
    after: t(`tour.warehouse.${key}.after`),
    next: t(`tour.warehouse.${key}.next`),
  }
}

const tourSteps = computed(() => {
  if (!canIssue.value) {
    // Kuzatuvchi uchun birinchi qadam markazda: rejim nima ekanini aytadi
    return [
      tourStep('watch'),
      tourStep('stock', '[data-tour="wh-stock"]'),
      tourStep('movement', '[data-tour="wh-movement"]'),
      tourStep('acts', '[data-tour="wh-acts"]'),
    ]
  }

  const steps = [
    tourStep('stock', '[data-tour="wh-stock"]'),
    tourStep('movement', '[data-tour="wh-movement"]'),
    tourStep('receive', '[data-tour="wh-receive"]'),
  ]
  if (pendingIssue.value.length) steps.push(tourStep('requests', '[data-tour="wh-requests"]'))
  steps.push(tourStep('issue', '[data-tour="wh-issue"]'))
  steps.push(tourStep('acts', '[data-tour="wh-acts"]'))
  return steps
})

/** Xotira kaliti rol bilan birga: har bir rol o‘z izohini bir marta ko‘radi */
const tourId = computed(() => `warehouse:${auth.role ?? 'guest'}`)
</script>

<template>
  <AppTopbar
    :title="moduleTitle('warehouse', 'Ombor va jihozlar')"
    :subtitle="t('whs.stockCaption')"
  >
    <template #actions>
      <UiButton variant="secondary" size="sm" data-tour="wh-receive" @click="receiveOpen = true">
        <UiIcon name="download" :size="16" />
        {{ t('whs.newReceipt') }}
      </UiButton>
      <UiButton size="sm" data-tour="wh-issue" @click="issueOpen = true">
        <UiIcon name="send" :size="16" />
        {{ t('whs.issueAct') }}
      </UiButton>
      <UiTour :id="tourId" :steps="tourSteps" />
    </template>
  </AppTopbar>

  <main class="scroll-slim flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
    <!-- Modul chegarasi: bu yerda javondagi material, ijara omborlari boshqa bo‘limda -->
    <div
      class="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-card bg-ink-100 px-4 py-2 ring-1 ring-inset ring-ink-200"
    >
      <UiIcon name="info" :size="18" class="shrink-0 text-ink-500" />
      <p class="min-w-[240px] flex-1 py-1 text-[13px] leading-relaxed text-ink-700">
        {{ t('whs.stockScopeNote') }}
      </p>
      <NuxtLink
        to="/warehouse/blocks"
        class="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-field px-3 text-[13px] font-semibold text-brand-600 transition-colors hover:bg-ink-200"
      >
        {{ t('whs.blocksTitle') }}
        <UiIcon name="chevronRight" :size="15" />
      </NuxtLink>
    </div>

    <section class="grid gap-5 xl:grid-cols-3">
      <UiCard
        class="xl:col-span-2"
        data-tour="wh-stock"
        :title="t('whs.categoriesTitle')"
        :subtitle="t('whs.categoriesCaption')"
      >
        <template #actions>
          <UiButton variant="ghost" size="sm" @click="fCategory = 'all'">{{ t('tab.all') }}</UiButton>
        </template>

        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <button
            v-for="c in STOCK_CATEGORIES"
            :key="c.label"
            type="button"
            class="rounded-field p-3.5 text-center ring-1 transition-all hover:shadow-card"
            :class="
              fCategory === c.label
                ? 'bg-brand-50 ring-2 ring-brand-400'
                : 'bg-surface ring-ink-200 hover:ring-brand-300'
            "
            :aria-pressed="fCategory === c.label"
            @click="toggleCategory(c.label)"
          >
            <span
              class="mx-auto grid size-11 place-items-center rounded-[12px]"
              :class="fCategory === c.label ? 'bg-brand-500 text-white' : 'bg-ink-100 text-ink-600'"
            >
              <UiIcon :name="c.icon" :size="21" />
            </span>
            <span class="mt-2.5 block truncate text-[13px] font-semibold text-ink-900">
              {{ c.label }}
            </span>
            <span class="tabular mt-0.5 block text-[12px] text-ink-500">{{ t('whs.nameCount', { n: c.count }) }}</span>
          </button>
        </div>
      </UiCard>

      <UiCard
        data-tour="wh-movement"
        :title="t('whs.movementToday')"
        :subtitle="t('whs.movementTodayCaption')"
      >
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div
            v-for="s in summary"
            :key="s.key"
            class="rounded-field p-3 ring-1 ring-ink-200"
          >
            <span class="flex items-center gap-1.5 text-[12px] text-ink-500">
              <UiIcon
                :name="s.icon"
                :size="14"
                :class="{
                  'text-ok-600': s.tone === 'ok',
                  'text-danger-600': s.tone === 'danger',
                  'text-brand-600': s.tone === 'brand',
                }"
              />
              {{ s.label }}
            </span>
            <span class="tabular mt-1 block text-[22px] font-bold leading-none text-ink-900">
              {{ s.value }}
            </span>
            <span class="mt-1 block text-[12px] text-ink-500">{{ s.unit }}</span>
          </div>
        </div>

        <dl class="mt-4 space-y-3 border-t border-ink-100 pt-4">
          <div class="flex items-baseline justify-between gap-3">
            <dt class="text-[13px] text-ink-500">{{ t('whs.assignedWarehouses') }}</dt>
            <dd class="tabular text-[14px] font-bold text-ink-900">
              {{ warehouses.length }} {{ t('unitOf.pcs') }}
            </dd>
          </div>
          <div class="flex items-baseline justify-between gap-3">
            <dt class="text-[13px] text-ink-500">{{ t('whs.totalPositions') }}</dt>
            <dd class="tabular text-[14px] font-bold text-ink-900">
              {{ t('whs.nameCount', { n: num(scopedSummary.positions) }) }}
            </dd>
          </div>
          <div class="flex items-baseline justify-between gap-3">
            <dt class="text-[13px] text-ink-500">{{ t('whs.totalStockValue') }}</dt>
            <dd class="tabular text-[14px] font-bold text-ink-900">
              {{ moneyShort(scopedSummary.totalValue) }}
            </dd>
          </div>
        </dl>
      </UiCard>
    </section>

    <UiCard
      :title="t('whs.stockListTitle')"
      :subtitle="t('whs.positionsShown', { n: rows.length })"
      flush
      :padded="false"
    >
      <template #actions>
        <UiButton variant="secondary" size="sm" @click="receiveOpen = true">
          <UiIcon name="plus" :size="16" />
          {{ t('whs.newReceipt') }}
        </UiButton>
      </template>

      <div class="grid gap-3 border-t border-ink-100 bg-surface-sunken px-5 py-4 lg:grid-cols-4">
        <UiInput v-model="query" :placeholder="t('whs.searchCodeOrName')" class="lg:col-span-2">
          <template #prefix>
            <UiIcon name="search" :size="18" />
          </template>
        </UiInput>
        <UiSelect v-model="fCategory" :options="categoryOptions" />
        <div class="flex items-center gap-2">
          <UiSelect v-model="fWarehouse" :options="warehouseOptions" class="flex-1" />
          <UiButton v-if="dirty" variant="ghost" size="sm" @click="resetFilters">
            <UiIcon name="refresh" :size="16" />
            {{ t('common.reset') }}
          </UiButton>
        </div>
      </div>

      <UiTable :columns="columns" :rows="rows" :empty="t('whs.emptyPositions')">
        <template #cell-code="{ row }">
          <span class="tabular text-[13px] font-bold text-ink-900">{{ row.code }}</span>
        </template>

        <template #cell-name="{ row }">
          <span class="font-semibold text-ink-900">{{ row.name }}</span>
        </template>

        <template #cell-qty="{ row }">{{ num(row.qty) }}</template>
        <template #cell-minQty="{ row }">{{ num(row.minQty) }}</template>

        <template #cell-level="{ row }">
          <span
            class="inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs font-semibold ring-1 ring-inset"
            :class="levelOf(row.qty, row.minQty).badge"
          >
            <svg
              class="size-3 shrink-0"
              :class="levelOf(row.qty, row.minQty).mark"
              viewBox="0 0 12 12"
              fill="none"
              aria-hidden="true"
            >
              <path
                v-if="levelOf(row.qty, row.minQty).shape === 'check'"
                d="M2.6 6.3 5 8.7l4.4-5"
                stroke="currentColor"
                stroke-width="1.9"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <rect
                v-else-if="levelOf(row.qty, row.minQty).shape === 'bar'"
                x="1.8"
                y="4.6"
                width="8.4"
                height="2.8"
                rx="1.4"
                fill="currentColor"
              />
              <path v-else d="M6 1.2 11.4 10.8H.6z" fill="currentColor" />
            </svg>
            {{ levelOf(row.qty, row.minQty).label }}
          </span>
        </template>
      </UiTable>
    </UiCard>

    <UiCard
      v-if="pendingIssue.length"
      data-tour="wh-requests"
      :title="t('whs.pendingIssueTitle')"
      :subtitle="t('whs.approvedRequestCount', { n: pendingIssue.length })"
    >
      <p
        v-if="handoverError"
        class="mb-3 rounded-field bg-danger-50 px-4 py-2.5 text-[13px] font-medium text-danger-700 ring-1 ring-inset ring-danger-100"
        role="status"
      >
        {{ handoverError }}
      </p>

      <ul class="divide-y divide-ink-100">
        <li
          v-for="r in pendingIssue"
          :key="r.id"
          class="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0"
        >
          <span class="min-w-0 flex-1">
            <span class="tabular block text-[14px] font-bold text-ink-900">{{ r.code }}</span>
            <span class="block truncate text-[13px] text-ink-500">
              {{ r.workOrder }} · {{ r.requester }} · {{ t('whs.positionCount', { n: r.items }) }}
            </span>
          </span>
          <span class="tabular shrink-0 text-[14px] font-bold text-ink-900">
            {{ money(r.amount) }}
          </span>
          <UiButton v-if="canIssue" size="sm" variant="success" @click="handoverRequest(r)">
            <UiIcon name="send" :size="16" />
            {{ t('whs.issue') }}
          </UiButton>
          <span v-else class="shrink-0 text-[13px] text-ink-500">{{ t('whs.noIssueRight') }}</span>
        </li>
      </ul>
    </UiCard>

    <UiCard
      data-tour="wh-acts"
      :title="t('whs.issueActsTitle')"
      :subtitle="t('whs.documentCount', { n: acts.length })"
      flush
      :padded="false"
    >
      <template #actions>
        <UiButton size="sm" @click="issueOpen = true">
          <UiIcon name="plus" :size="16" />
          {{ t('whs.newAct') }}
        </UiButton>
      </template>

      <UiTable
        :columns="actColumns"
        :rows="actRows"
        :empty="t('whs.emptyActs')"
        @row-click="openAct"
      >
        <template #cell-code="{ row }">
          <span class="tabular text-[13px] font-bold text-ink-900">{{ row.code }}</span>
        </template>

        <template #cell-request="{ row }">
          <span class="tabular text-[13px] font-semibold text-brand-600">{{ row.request }}</span>
        </template>

        <template #cell-positions="{ row }">{{ row.positions }} {{ t('unitOf.pcs') }}</template>

        <template #cell-at="{ row }">
          <span class="tabular">{{ dateShort(row.at) }}</span>
        </template>

        <template #cell-status="{ row }">
          <UiStatus kind="material" :value="row.status" size="sm" />
        </template>

        <template #cell-print="{ row }">
          <UiButton variant="ghost" size="sm" @click.stop="openAct(row)">
            <UiIcon name="print" :size="16" />
            {{ t('common.print') }}
          </UiButton>
        </template>
      </UiTable>
    </UiCard>
  </main>

  <UiModal
    v-model="receiveOpen"
    :title="t('whs.newReceipt')"
    :subtitle="t('whs.newReceiptCaption')"
  >
    <div class="space-y-4">
      <UiField :label="field('warehouse', 'Ombor')" required :hint="t('whs.receiveWarehouseHint')">
        <UiSelect
          v-model="receiveWarehouse"
          :options="warehouses.map((w) => ({ value: w, label: w }))"
        />
      </UiField>

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

      <UiField :label="t('common.note')" :error="receiveError" :hint="t('whs.receiveNoteHint')">
        <textarea
          v-model="receiveNote"
          rows="3"
          :placeholder="t('whs.receiveNotePlaceholder')"
          class="scroll-slim w-full rounded-field bg-white px-3.5 py-2.5 text-sm text-ink-800 ring-1 ring-inset ring-ink-200 transition-colors placeholder:text-ink-400 hover:ring-ink-300 focus:ring-2 focus:ring-brand-500"
        />
      </UiField>
    </div>

    <template #footer>
      <UiButton variant="ghost" @click="receiveOpen = false">{{ t('common.cancel') }}</UiButton>
      <UiButton variant="success" @click="saveReceive">
        <UiIcon name="check" :size="16" />
        {{ t('whs.saveReceipt') }}
      </UiButton>
    </template>
  </UiModal>

  <UiModal
    v-model="issueOpen"
    :title="t('whs.issueAct')"
    :subtitle="t('whs.issueActCaption')"
    size="xl"
  >
    <div class="space-y-4">
      <div class="grid gap-4 lg:grid-cols-3">
        <UiField :label="t('whs.issueTo')" required>
          <UiSelect v-model="issueRecipient" :options="recipientOptions" />
        </UiField>
        <UiField :label="field('basisRequest', 'Qaysi ariza bo‘yicha')" required>
          <UiSelect v-model="issueRequest" :options="requestOptions" />
        </UiField>
        <UiField :label="field('warehouse', 'Ombor')" required>
          <UiSelect
            v-model="issueWarehouse"
            :options="warehouses.map((w) => ({ value: w, label: w }))"
          />
        </UiField>
      </div>

      <div class="overflow-hidden rounded-field ring-1 ring-ink-200">
        <div class="flex items-center justify-between border-b border-ink-200 bg-surface-sunken px-4 py-3">
          <span class="text-[13px] font-semibold text-ink-700">{{ t('whs.selectItems') }}</span>
          <span class="tabular text-[13px] text-ink-500">
            {{ t('whs.positionsAvailable', { n: issuePool.length }) }}
          </span>
        </div>

        <ul class="scroll-slim max-h-72 divide-y divide-ink-100 overflow-y-auto">
          <li v-for="i in issuePool" :key="i.id" class="flex items-center gap-3 px-4 py-3">
            <span class="grid size-9 shrink-0 place-items-center rounded-[10px] bg-ink-100 text-ink-600">
              <UiIcon name="cube" :size="17" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-[14px] font-semibold text-ink-900">{{ i.name }}</span>
              <span class="tabular block text-[12px] text-ink-500">
                {{ i.code }} · {{ t('whs.availableQty', { qty: num(i.qty), unit: i.unit }) }}
              </span>
            </span>
            <span
              class="inline-flex shrink-0 items-center gap-1.5 rounded-pill px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset"
              :class="levelOf(i.qty, i.minQty).badge"
            >
              {{ levelOf(i.qty, i.minQty).label }}
            </span>
            <UiInput v-model="issueQty[i.id]" type="number" class="w-24 shrink-0" />
          </li>

          <li v-if="!issuePool.length" class="px-4 py-8 text-center text-[13px] text-ink-500">
            {{ t('whs.emptyWarehousePositions') }}
          </li>
        </ul>

        <div class="flex items-center justify-between border-t border-ink-200 bg-surface-sunken px-4 py-3">
          <span class="text-[13px] font-semibold text-ink-700">
            {{ t('whs.selectedSummary', { n: issueLines.length, u: num(issueUnits) }) }}
          </span>
          <span class="tabular text-[14px] font-bold text-ink-900">{{ money(issueTotal) }}</span>
        </div>
      </div>

      <UiField :label="t('common.note')" :error="issueError">
        <textarea
          v-model="issueNote"
          rows="2"
          :placeholder="t('whs.notePlaceholder')"
          class="scroll-slim w-full rounded-field bg-white px-3.5 py-2.5 text-sm text-ink-800 ring-1 ring-inset ring-ink-200 transition-colors placeholder:text-ink-400 hover:ring-ink-300 focus:ring-2 focus:ring-brand-500"
        />
      </UiField>
    </div>

    <template #footer>
      <UiButton variant="ghost" @click="((issueOpen = false), resetIssue())">{{ t('common.cancel') }}</UiButton>
      <UiButton @click="saveIssue">
        <UiIcon name="check" :size="16" />
        {{ t('whs.formalizeAct') }}
      </UiButton>
    </template>
  </UiModal>

  <UiModal
    v-model="printOpen"
    :title="t('whs.actTitleWithCode', { code: printAct?.code ?? '' })"
    :subtitle="t('whs.printPreview')"
    size="lg"
  >
    <div v-if="printAct" class="rounded-field bg-white p-6 ring-1 ring-ink-200">
      <div class="flex items-start justify-between gap-4 border-b border-ink-200 pb-4">
        <div>
          <p class="text-[18px] font-bold text-ink-900">{{ t('whs.issueActTitle') }}</p>
          <p class="tabular mt-1 text-[13px] text-ink-500">
            {{ printAct.code }} · {{ dateShort(printAct.at) }}
          </p>
        </div>
        <AppLogo size="sm" />
      </div>

      <dl class="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
        <div class="flex justify-between gap-3 border-b border-ink-100 pb-2">
          <dt class="text-[13px] text-ink-500">{{ field('issuedTo', 'Kimga berildi') }}</dt>
          <dd class="text-[13px] font-semibold text-ink-900">{{ printAct.recipient }}</dd>
        </div>
        <div class="flex justify-between gap-3 border-b border-ink-100 pb-2">
          <dt class="text-[13px] text-ink-500">{{ field('basisRequest', 'Qaysi ariza bo‘yicha') }}</dt>
          <dd class="tabular text-[13px] font-semibold text-ink-900">{{ printAct.request }}</dd>
        </div>
        <div class="flex justify-between gap-3 border-b border-ink-100 pb-2">
          <dt class="text-[13px] text-ink-500">{{ field('warehouse', 'Ombor') }}</dt>
          <dd class="text-[13px] font-semibold text-ink-900">{{ printAct.warehouse }}</dd>
        </div>
        <div class="flex justify-between gap-3 border-b border-ink-100 pb-2">
          <dt class="text-[13px] text-ink-500">{{ t('role.WAREHOUSE_OPERATOR.label') }}</dt>
          <dd class="text-[13px] font-semibold text-ink-900">
            {{ auth.user?.fullName ?? t('whs.warehouseManager') }}
          </dd>
        </div>
      </dl>

      <table class="mt-5 w-full border-collapse text-sm">
        <thead>
          <tr class="border-b border-ink-200 bg-surface-sunken">
            <th class="px-3 py-2 text-left text-[12px] font-semibold uppercase tracking-wide text-ink-500">
              №
            </th>
            <th class="px-3 py-2 text-left text-[12px] font-semibold uppercase tracking-wide text-ink-500">
              {{ field('name', 'Nomi') }}
            </th>
            <th class="px-3 py-2 text-left text-[12px] font-semibold uppercase tracking-wide text-ink-500">
              {{ field('unitOfMeasure', 'O‘lchov birligi') }}
            </th>
            <th class="px-3 py-2 text-right text-[12px] font-semibold uppercase tracking-wide text-ink-500">
              {{ field('quantity', 'Miqdor') }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(l, i) in printAct.lines" :key="l.name" class="border-b border-ink-100">
            <td class="tabular px-3 py-2.5 text-ink-500">{{ i + 1 }}</td>
            <td class="px-3 py-2.5 text-ink-700">{{ l.name }}</td>
            <td class="px-3 py-2.5 text-ink-700">{{ l.unit }}</td>
            <td class="tabular px-3 py-2.5 text-right font-semibold text-ink-900">{{ l.qty }}</td>
          </tr>
        </tbody>
      </table>

      <div class="mt-6 grid gap-6 sm:grid-cols-2">
        <div>
          <p class="text-[12px] text-ink-500">{{ t('whs.issuedByStorekeeper') }}</p>
          <p class="mt-6 border-t border-ink-300 pt-1.5 text-[13px] text-ink-600">
            {{ auth.user?.fullName ?? t('whs.warehouseManager') }}
          </p>
        </div>
        <div>
          <p class="text-[12px] text-ink-500">{{ t('whs.receivedBy') }}</p>
          <p class="mt-6 border-t border-ink-300 pt-1.5 text-[13px] text-ink-600">
            {{ printAct.recipient }}
          </p>
        </div>
      </div>
    </div>

    <template #footer>
      <UiButton variant="ghost" @click="printAct = null">{{ t('tour.skip') }}</UiButton>
      <UiButton variant="secondary" :disabled="!printAct" @click="downloadAct">
        <UiIcon name="download" :size="16" />
        {{ t('common.download') }}
      </UiButton>
      <UiButton @click="sendToPrinter">
        <UiIcon name="print" :size="16" />
        {{ t('common.print') }}
      </UiButton>
    </template>
  </UiModal>
</template>

<style>
/**
 * Chop etishda faqat ochiq dalolatnoma qog‘ozga tushadi: yon menyu, topbar
 * va orqadagi jadvallar bosilmaydi. Qoida global, chunki oyna `body` ga
 * ko‘chiriladi va sahifa qatlamidan tashqarida turadi.
 */
@media print {
  body * {
    visibility: hidden;
  }

  [role='dialog'],
  [role='dialog'] * {
    visibility: visible;
  }

  [role='dialog'] {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    max-height: none;
    overflow: visible;
    background: #fff;
    box-shadow: none;
  }

  [role='dialog'] > div {
    overflow: visible !important;
  }

  [role='dialog'] > header,
  [role='dialog'] > footer {
    display: none !important;
  }
}
</style>
