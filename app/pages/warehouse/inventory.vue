<script setup lang="ts">
import { STOCK_ITEMS, type StockItem } from '~/data/operations'
import { dateShort, num, sum, sumShort } from '~/utils/format'

interface ActLine {
  itemId: string
  code: string
  name: string
  unit: string
  price: number
  expected: number
  counted: number
}

interface InventoryAct {
  id: string
  code: string
  name: string
  warehouse: string
  date: string
  owner: string
  positions: number
  matched: number
  surplusQty: number
  shortageQty: number
  valueDiff: number
  lines: ActLine[]
}

interface Session {
  code: string
  name: string
  warehouse: string
  date: string
  owner: string
}

const auth = useAuthStore()

const CURRENT_DAY = '2025-05-18'
const canWrite = computed(() => auth.can('warehouse.issue'))

/** Ombor mudiriga faqat biriktirilgan ombor ko‘rinadi */
const stock = ref<StockItem[]>(
  STOCK_ITEMS.filter((i) => auth.inWarehouseScope(i.warehouse)).map((i) => ({ ...i })),
)
const warehouses = computed(() => [...new Set(stock.value.map((i) => i.warehouse))])

const OWNERS = [
  { value: 'Anvar Qodirov', label: 'Anvar Qodirov · ombor mudiri' },
  { value: 'Jasur Toshmatov', label: 'Jasur Toshmatov · xo‘jalik bo‘limi' },
  { value: 'Sardor Yo‘ldoshev', label: 'Sardor Yo‘ldoshev · obyekt rahbari' },
]

function lineOf(itemId: string, counted: number): ActLine {
  const item = STOCK_ITEMS.find((i) => i.id === itemId) ?? STOCK_ITEMS[0]!
  return {
    itemId: item.id,
    code: item.code,
    name: item.name,
    unit: item.unit,
    price: item.price,
    expected: item.qty,
    counted,
  }
}

function summarize(lines: ActLine[]) {
  let matched = 0
  let surplusQty = 0
  let shortageQty = 0
  let valueDiff = 0
  for (const l of lines) {
    const diff = l.counted - l.expected
    if (diff === 0) matched++
    else if (diff > 0) surplusQty += diff
    else shortageQty += -diff
    valueDiff += diff * l.price
  }
  return { matched, surplusQty, shortageQty, valueDiff }
}

function buildAct(
  id: string,
  code: string,
  name: string,
  warehouse: string,
  date: string,
  owner: string,
  lines: ActLine[],
): InventoryAct {
  const s = summarize(lines)
  return {
    id,
    code,
    name,
    warehouse,
    date,
    owner,
    positions: lines.length,
    matched: s.matched,
    surplusQty: s.surplusQty,
    shortageQty: s.shortageQty,
    valueDiff: s.valueDiff,
    lines,
  }
}

const acts = ref<InventoryAct[]>([
  buildAct(
    'inv-0031',
    'INV-2025-0031',
    'Aprel oyi yakuniy sanog‘i',
    'Markaziy ombor',
    '2025-04-30',
    'Anvar Qodirov',
    [
      lineOf('w-01', 28),
      lineOf('w-02', 54),
      lineOf('w-03', 120),
      lineOf('w-06', 14),
      lineOf('w-08', 18),
    ],
  ),
  buildAct(
    'inv-0030',
    'INV-2025-0030',
    'Green BC ombori choraklik sanog‘i',
    'Green BC ombori',
    '2025-04-12',
    'Jasur Toshmatov',
    [lineOf('w-04', 356), lineOf('w-05', 80)],
  ),
  buildAct(
    'inv-0029',
    'INV-2025-0029',
    'Qurilish materiallari nazorat sanog‘i',
    'Industrial Park ombori',
    '2025-03-28',
    'Anvar Qodirov',
    [lineOf('w-07', 205)],
  ),
].filter((a) => auth.inWarehouseScope(a.warehouse)))

const session = ref<Session | null>(null)
const counted = ref<Record<string, string | number>>({})
const notes = ref<Record<string, string>>({})
const resultBanner = ref<InventoryAct | null>(null)

const startOpen = ref(false)
const startName = ref('')
const startWarehouse = ref(stock.value[0]?.warehouse ?? STOCK_ITEMS[0]!.warehouse)
const startDate = ref(CURRENT_DAY)
const startOwner = ref(OWNERS[0]!.value)
const startError = ref('')

function nextCode() {
  const seq = acts.value.reduce((mx, a) => Math.max(mx, Number(a.code.slice(-4)) || 0), 0) + 1
  return `INV-2025-${String(seq).padStart(4, '0')}`
}

function openStart() {
  startName.value = `${startWarehouse.value} joriy sanog‘i`
  startError.value = ''
  startOpen.value = true
}

function beginSession() {
  if (!startName.value.trim()) {
    startError.value = 'Inventarizatsiya nomini kiriting'
    return
  }
  counted.value = {}
  notes.value = {}
  resultBanner.value = null
  session.value = {
    code: nextCode(),
    name: startName.value.trim(),
    warehouse: startWarehouse.value,
    date: startDate.value,
    owner: startOwner.value,
  }
  startOpen.value = false
  startError.value = ''
}

const sessionItems = computed(() =>
  session.value ? stock.value.filter((i) => i.warehouse === session.value!.warehouse) : [],
)

const countRows = computed(() => sessionItems.value.map((i) => ({ ...i })))

function rawCount(id: string) {
  return String(counted.value[id] ?? '').trim()
}

function isCounted(id: string) {
  const raw = rawCount(id)
  return raw !== '' && Number.isFinite(Number(raw))
}

function countedQty(id: string) {
  return isCounted(id) ? Number(rawCount(id)) : 0
}

function diffOf(item: { id: string; qty: number }) {
  return isCounted(item.id) ? countedQty(item.id) - item.qty : 0
}

interface DiffView {
  label: string
  text: string
  badge: string
  mark: 'up' | 'down' | 'equal' | 'none'
}

function diffView(item: { id: string; qty: number }): DiffView {
  if (!isCounted(item.id))
    return {
      label: '-',
      text: 'Sanalmagan',
      badge: 'bg-ink-100 text-ink-600 ring-ink-200',
      mark: 'none',
    }
  const d = diffOf(item)
  if (d === 0)
    return {
      label: '0',
      text: 'Mos keldi',
      badge: 'bg-ok-50 text-ok-700 ring-ok-100',
      mark: 'equal',
    }
  if (d > 0)
    return {
      label: `+${num(d)}`,
      text: 'Ortiqcha',
      badge: 'bg-info-50 text-info-700 ring-info-100',
      mark: 'up',
    }
  return {
    label: `−${num(-d)}`,
    text: 'Kamomad',
    badge: 'bg-danger-50 text-danger-700 ring-danger-100',
    mark: 'down',
  }
}

const countedCount = computed(() => sessionItems.value.filter((i) => isCounted(i.id)).length)

const surplusQty = computed(() =>
  sessionItems.value.reduce((s, i) => (diffOf(i) > 0 ? s + diffOf(i) : s), 0),
)

const shortageQty = computed(() =>
  sessionItems.value.reduce((s, i) => (diffOf(i) < 0 ? s - diffOf(i) : s), 0),
)

const valueDiff = computed(() =>
  sessionItems.value.reduce((s, i) => s + diffOf(i) * i.price, 0),
)

const discrepancies = computed(() =>
  sessionItems.value
    .filter((i) => isCounted(i.id) && diffOf(i) !== 0)
    .map((i) => ({
      id: i.id,
      code: i.code,
      name: i.name,
      unit: i.unit,
      expected: i.qty,
      fact: countedQty(i.id),
      diff: diffOf(i),
      value: diffOf(i) * i.price,
      note: notes.value[i.id] ?? '',
    })),
)

const progress = computed(() =>
  sessionItems.value.length
    ? Math.round((countedCount.value / sessionItems.value.length) * 100)
    : 0,
)

function fillFromStock() {
  for (const i of sessionItems.value) counted.value[i.id] = i.qty
}

function clearCounts() {
  counted.value = {}
  notes.value = {}
}

function cancelSession() {
  session.value = null
  counted.value = {}
  notes.value = {}
  cancelOpen.value = false
}

const cancelOpen = ref(false)
const finishOpen = ref(false)

const countColumns = [
  { key: 'name', label: 'Pozitsiya' },
  { key: 'qty', label: 'Hisobdagi miqdor', align: 'right' as const, numeric: true },
  { key: 'fact', label: 'Sanaldi', align: 'right' as const, width: '150px' },
  { key: 'diff', label: 'Farq', width: '190px' },
  { key: 'note', label: 'Izoh', width: '230px' },
]

const historyColumns = [
  { key: 'code', label: 'Akt raqami', width: '150px' },
  { key: 'name', label: 'Nomi' },
  { key: 'warehouse', label: 'Ombor' },
  { key: 'date', label: 'Sana', width: '110px' },
  { key: 'owner', label: 'Mas’ul' },
  { key: 'positions', label: 'Pozitsiya', align: 'right' as const, numeric: true },
  { key: 'valueDiff', label: 'Farq qiymati', align: 'right' as const, numeric: true },
]

const historyRows = computed(() => acts.value.map((a) => ({ ...a })))

const act = ref<InventoryAct | null>(null)
const actOpen = computed({
  get: () => act.value !== null,
  set: (v: boolean) => {
    if (!v) act.value = null
  },
})

function openAct(row: Record<string, unknown>) {
  act.value = acts.value.find((a) => a.id === String(row.id)) ?? null
}

function finishSession() {
  if (!session.value) return
  const lines: ActLine[] = sessionItems.value.map((i) => ({
    itemId: i.id,
    code: i.code,
    name: i.name,
    unit: i.unit,
    price: i.price,
    expected: i.qty,
    counted: isCounted(i.id) ? countedQty(i.id) : i.qty,
  }))
  const created = buildAct(
    `inv-${session.value.code.slice(-4)}`,
    session.value.code,
    session.value.name,
    session.value.warehouse,
    session.value.date,
    session.value.owner,
    lines,
  )
  for (const l of lines) {
    const target = stock.value.find((i) => i.id === l.itemId)
    if (target) target.qty = l.counted
  }
  acts.value.unshift(created)
  session.value = null
  counted.value = {}
  notes.value = {}
  finishOpen.value = false
  resultBanner.value = created
  act.value = created
}

const actLineRows = computed(() =>
  act.value
    ? act.value.lines.map((l) => ({
        ...l,
        id: l.itemId,
        diff: l.counted - l.expected,
        value: (l.counted - l.expected) * l.price,
      }))
    : [],
)
</script>

<template>
  <AppTopbar
    title="Inventarizatsiya"
    subtitle="Ombor qoldiqlarini sanash, farqlarni qayd etish va akt rasmiylashtirish"
    :breadcrumb="[{ label: 'Ombor', to: '/warehouse' }, { label: 'Inventarizatsiya' }]"
  >
    <template #actions>
      <UiButton variant="secondary" size="sm" to="/warehouse/movements">
        <UiIcon name="layers" :size="16" />
        Kirim va chiqim
      </UiButton>
      <UiButton v-if="canWrite && !session" size="sm" @click="openStart">
        <UiIcon name="plus" :size="16" />
        Yangi inventarizatsiya
      </UiButton>
      <UiButton v-else-if="canWrite" variant="ghost" size="sm" @click="cancelOpen = true">
        <UiIcon name="x" :size="16" />
        Sanoqni bekor qilish
      </UiButton>
    </template>
  </AppTopbar>

  <main class="scroll-slim flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
    <div
      v-if="resultBanner"
      class="flex flex-wrap items-center gap-3 rounded-card px-4 py-3.5 text-[13px] ring-1"
      :class="
        resultBanner.valueDiff === 0
          ? 'bg-ok-50 text-ok-700 ring-ok-100'
          : 'bg-warn-50 text-warn-700 ring-warn-100'
      "
    >
      <UiIcon :name="resultBanner.valueDiff === 0 ? 'check' : 'warning'" :size="17" class="shrink-0" />
      <span class="min-w-0 flex-1">
        <b>{{ resultBanner.code }}</b> akti rasmiylashtirildi:
        {{ resultBanner.positions }} ta pozitsiya sanaldi,
        {{ resultBanner.positions - resultBanner.matched }} tasida farq aniqlandi. Umumiy farq
        qiymati: {{ sum(resultBanner.valueDiff) }}.
      </span>
      <UiButton size="sm" variant="secondary" @click="act = resultBanner">Aktni ochish</UiButton>
    </div>

    <template v-if="session">
      <section class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
        <UiCard
          :title="session.name"
          :subtitle="`${session.code} · ${session.warehouse} · ${dateShort(session.date)}`"
        >
          <template #actions>
            <span
              class="inline-flex items-center gap-1.5 rounded-pill bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 ring-1 ring-inset ring-brand-200"
            >
              <UiIcon name="clock" :size="13" />
              Sanoq davom etmoqda
            </span>
          </template>

          <dl class="grid gap-4 sm:grid-cols-3">
            <div class="rounded-field p-3.5 ring-1 ring-ink-200">
              <dt class="text-[12px] text-ink-500">Mas’ul shaxs</dt>
              <dd class="mt-1 text-[14px] font-semibold text-ink-900">{{ session.owner }}</dd>
            </div>
            <div class="rounded-field p-3.5 ring-1 ring-ink-200">
              <dt class="text-[12px] text-ink-500">Ombor</dt>
              <dd class="mt-1 text-[14px] font-semibold text-ink-900">{{ session.warehouse }}</dd>
            </div>
            <div class="rounded-field p-3.5 ring-1 ring-ink-200">
              <dt class="text-[12px] text-ink-500">Sanoq sanasi</dt>
              <dd class="tabular mt-1 text-[14px] font-semibold text-ink-900">
                {{ dateShort(session.date) }}
              </dd>
            </div>
          </dl>

          <div class="mt-4">
            <div class="flex items-center justify-between gap-3 text-[13px]">
              <span class="text-ink-500">Sanoq bajarilishi</span>
              <span class="tabular font-semibold text-ink-900">
                {{ countedCount }} / {{ sessionItems.length }} pozitsiya
              </span>
            </div>
            <div class="mt-2 h-2 overflow-hidden rounded-pill bg-ink-100">
              <div
                class="h-full rounded-pill bg-brand-500 transition-all"
                :style="{ width: `${progress}%` }"
              />
            </div>
          </div>
        </UiCard>

        <UiCard title="Joriy natija" subtitle="Sanoq davomida jonli hisoblanadi">
          <dl class="space-y-3">
            <div class="flex items-baseline justify-between gap-3 border-b border-ink-100 pb-3">
              <dt class="text-[13px] text-ink-500">Sanalgan pozitsiyalar</dt>
              <dd class="tabular text-[14px] font-bold text-ink-900">
                {{ countedCount }} / {{ sessionItems.length }}
              </dd>
            </div>
            <div class="flex items-baseline justify-between gap-3 border-b border-ink-100 pb-3">
              <dt class="flex items-center gap-1.5 text-[13px] text-ink-500">
                <UiIcon name="arrowUp" :size="13" class="text-info-600" />
                Ortiqcha
              </dt>
              <dd class="tabular text-[14px] font-bold text-info-700">
                {{ num(surplusQty) }} birlik
              </dd>
            </div>
            <div class="flex items-baseline justify-between gap-3 border-b border-ink-100 pb-3">
              <dt class="flex items-center gap-1.5 text-[13px] text-ink-500">
                <UiIcon name="arrowDown" :size="13" class="text-danger-600" />
                Kamomad
              </dt>
              <dd class="tabular text-[14px] font-bold text-danger-700">
                {{ num(shortageQty) }} birlik
              </dd>
            </div>
            <div class="flex items-baseline justify-between gap-3">
              <dt class="text-[13px] text-ink-500">Umumiy farq qiymati</dt>
              <dd
                class="tabular text-[16px] font-bold"
                :class="
                  valueDiff > 0 ? 'text-info-700' : valueDiff < 0 ? 'text-danger-700' : 'text-ink-900'
                "
              >
                {{ valueDiff > 0 ? '+' : '' }}{{ sum(valueDiff) }}
              </dd>
            </div>
          </dl>

          <p class="mt-3 rounded-field bg-surface-sunken px-3 py-2.5 text-[12px] text-ink-600">
            Farqlar soni: <b class="text-ink-900">{{ discrepancies.length }}</b> ta pozitsiya
          </p>

          <div class="mt-4 grid gap-2.5">
            <UiButton
              variant="success"
              block
              :disabled="!countedCount"
              @click="finishOpen = true"
            >
              <UiIcon name="check" :size="16" />
              Yakunlash
            </UiButton>
            <UiButton variant="secondary" size="sm" block @click="fillFromStock">
              <UiIcon name="download" :size="15" />
              Hisobdan to‘ldirish
            </UiButton>
            <UiButton variant="ghost" size="sm" block @click="clearCounts">
              <UiIcon name="refresh" :size="15" />
              Tozalash
            </UiButton>
          </div>
        </UiCard>
      </section>

      <UiCard
        title="Sanoq varaqasi"
        :subtitle="`${sessionItems.length} ta pozitsiya · ${session.warehouse}`"
        flush
        :padded="false"
      >
        <UiTable
          :columns="countColumns"
          :rows="countRows"
          empty="Bu omborda sanaladigan pozitsiya yo‘q"
        >
          <template #cell-name="{ row }">
            <span class="block font-semibold text-ink-900">{{ row.name }}</span>
            <span class="tabular block text-[12px] text-ink-500">
              {{ row.code }} · {{ row.category }}
            </span>
          </template>

          <template #cell-qty="{ row }">
            {{ num(row.qty) }}
            <span class="ml-1 text-[12px] font-normal text-ink-500">{{ row.unit }}</span>
          </template>

          <template #cell-fact="{ row }">
            <UiInput
              v-model="counted[row.id]"
              type="number"
              :readonly="!canWrite"
              :placeholder="String(row.qty)"
              :aria-label="`${row.name} bo‘yicha sanalgan miqdor`"
              class="w-32"
            />
          </template>

          <template #cell-diff="{ row }">
            <span
              class="inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs font-semibold ring-1 ring-inset"
              :class="diffView(row).badge"
            >
              <svg class="size-3 shrink-0" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path
                  v-if="diffView(row).mark === 'up'"
                  d="M6 1.6 10.4 8H1.6z"
                  fill="currentColor"
                />
                <path
                  v-else-if="diffView(row).mark === 'down'"
                  d="M6 10.4 1.6 4h8.8z"
                  fill="currentColor"
                />
                <path
                  v-else-if="diffView(row).mark === 'equal'"
                  d="M2.6 6.3 5 8.7l4.4-5"
                  stroke="currentColor"
                  stroke-width="1.9"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <circle v-else cx="6" cy="6" r="3.4" stroke="currentColor" stroke-width="1.6" />
              </svg>
              <span class="tabular">{{ diffView(row).label }}</span>
              <span>{{ diffView(row).text }}</span>
            </span>
          </template>

          <template #cell-note="{ row }">
            <UiInput
              v-model="notes[row.id]"
              placeholder="Farq sababi"
              :readonly="!canWrite"
              :aria-label="`${row.name} bo‘yicha izoh`"
              class="w-full min-w-[180px]"
            />
          </template>
        </UiTable>

        <div
          class="flex flex-wrap items-center justify-between gap-2 border-t border-ink-200 bg-surface-sunken px-5 py-3.5"
        >
          <span class="text-[13px] text-ink-600">
            Sanalgan miqdorni kiritganingizda farq avtomatik hisoblanadi
          </span>
          <span class="tabular text-[14px] font-bold text-ink-900">
            {{ discrepancies.length }} ta farq · {{ sumShort(valueDiff) }}
          </span>
        </div>
      </UiCard>
    </template>

    <UiCard
      v-else
      title="Faol inventarizatsiya yo‘q"
      subtitle="Sanoqni boshlash uchun yangi inventarizatsiya seansini oching"
    >
      <div class="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <span class="grid size-14 shrink-0 place-items-center rounded-panel bg-brand-50 text-brand-600">
          <UiIcon name="clipboard" :size="26" />
        </span>
        <p class="min-w-0 flex-1 text-[14px] leading-relaxed text-ink-600">
          Seans ochilgach sahifa sanoq rejimiga o‘tadi: tanlangan ombordagi har bir pozitsiya
          bo‘yicha hisobdagi miqdor va sanalgan miqdor solishtiriladi, farqlar jonli hisoblanadi va
          yakunda akt rasmiylashtiriladi.
        </p>
        <UiButton v-if="canWrite" class="shrink-0" @click="openStart">
          <UiIcon name="plus" :size="16" />
          Yangi inventarizatsiya
        </UiButton>
        <span
          v-else
          class="shrink-0 rounded-pill bg-ink-100 px-3 py-1.5 text-[13px] font-semibold text-ink-600 ring-1 ring-inset ring-ink-200"
        >
          Sanoqni faqat omborchi boshlaydi
        </span>
      </div>
    </UiCard>

    <UiCard
      title="Inventarizatsiya tarixi"
      :subtitle="`${acts.length} ta yakunlangan sanoq`"
      flush
      :padded="false"
    >
      <UiTable
        :columns="historyColumns"
        :rows="historyRows"
        empty="Yakunlangan inventarizatsiya yo‘q"
        @row-click="openAct"
      >
        <template #cell-code="{ row }">
          <span class="tabular text-[13px] font-bold text-ink-900">{{ row.code }}</span>
        </template>

        <template #cell-name="{ row }">
          <span class="font-semibold text-ink-900">{{ row.name }}</span>
        </template>

        <template #cell-date="{ row }">
          <span class="tabular">{{ dateShort(row.date) }}</span>
        </template>

        <template #cell-positions="{ row }">{{ row.positions }} ta</template>

        <template #cell-valueDiff="{ row }">
          <span
            class="font-bold"
            :class="
              row.valueDiff > 0
                ? 'text-info-700'
                : row.valueDiff < 0
                  ? 'text-danger-700'
                  : 'text-ok-700'
            "
          >
            {{ row.valueDiff > 0 ? '+' : '' }}{{ sum(row.valueDiff) }}
          </span>
        </template>
      </UiTable>

      <div class="border-t border-ink-200 bg-surface-sunken px-5 py-3.5 text-[13px] text-ink-600">
        Qator ustiga bosilsa inventarizatsiya akti ochiladi
      </div>
    </UiCard>
  </main>

  <UiModal
    v-model="startOpen"
    title="Yangi inventarizatsiya"
    subtitle="Seans ochilgach sahifa sanoq rejimiga o‘tadi"
  >
    <div class="space-y-4">
      <UiField label="Inventarizatsiya nomi" required :error="startError">
        <UiInput v-model="startName" placeholder="Masalan, may oyi oraliq sanog‘i" />
      </UiField>

      <div class="grid gap-4 sm:grid-cols-2">
        <UiField label="Ombor" required>
          <UiSelect
            v-model="startWarehouse"
            :options="warehouses.map((w) => ({ value: w, label: w }))"
          />
        </UiField>
        <UiField label="Sanoq sanasi" required>
          <UiInput v-model="startDate" type="date" />
        </UiField>
      </div>

      <UiField label="Mas’ul shaxs" required>
        <UiSelect v-model="startOwner" :options="OWNERS" />
      </UiField>

      <p class="rounded-field bg-surface-sunken px-3.5 py-3 text-[13px] text-ink-600">
        Tanlangan omborda
        <b class="text-ink-900">
          {{ stock.filter((i) => i.warehouse === startWarehouse).length }} ta
        </b>
        pozitsiya sanaladi.
      </p>
    </div>

    <template #footer>
      <UiButton variant="ghost" @click="startOpen = false">Bekor qilish</UiButton>
      <UiButton @click="beginSession">
        <UiIcon name="check" :size="16" />
        Sanoqni boshlash
      </UiButton>
    </template>
  </UiModal>

  <UiModal
    v-model="finishOpen"
    title="Inventarizatsiyani yakunlash"
    subtitle="Aniqlangan farqlar akt asosida hisobga olinadi"
    size="lg"
  >
    <div class="space-y-4">
      <p
        v-if="countedCount < sessionItems.length"
        class="flex items-start gap-2 rounded-field bg-warn-50 px-3.5 py-3 text-[13px] text-warn-700"
      >
        <UiIcon name="warning" :size="16" class="mt-0.5 shrink-0" />
        {{ sessionItems.length - countedCount }} ta pozitsiya sanalmadi, ular hisobdagi miqdor
        bilan aktga kiritiladi.
      </p>

      <div v-if="discrepancies.length" class="overflow-hidden rounded-field ring-1 ring-ink-200">
        <div class="border-b border-ink-200 bg-surface-sunken px-4 py-3">
          <span class="text-[13px] font-semibold text-ink-700">
            Aniqlangan farqlar: {{ discrepancies.length }} ta pozitsiya
          </span>
        </div>
        <ul class="scroll-slim max-h-64 divide-y divide-ink-100 overflow-y-auto">
          <li v-for="d in discrepancies" :key="d.id" class="flex items-center gap-3 px-4 py-3">
            <span class="min-w-0 flex-1">
              <span class="block truncate text-[14px] font-semibold text-ink-900">{{ d.name }}</span>
              <span class="tabular block text-[12px] text-ink-500">
                {{ d.code }} · hisobda {{ num(d.expected) }} {{ d.unit }} · sanaldi
                {{ num(d.fact) }} {{ d.unit }}
              </span>
              <span v-if="d.note" class="block truncate text-[12px] text-ink-600">{{ d.note }}</span>
            </span>
            <span
              class="shrink-0 rounded-pill px-2.5 py-1 text-[12px] font-semibold ring-1 ring-inset"
              :class="
                d.diff > 0
                  ? 'bg-info-50 text-info-700 ring-info-100'
                  : 'bg-danger-50 text-danger-700 ring-danger-100'
              "
            >
              {{ d.diff > 0 ? `+${num(d.diff)} ortiqcha` : `−${num(-d.diff)} kamomad` }}
            </span>
            <span class="tabular shrink-0 text-[13px] font-bold text-ink-900">
              {{ sumShort(d.value) }}
            </span>
          </li>
        </ul>
      </div>

      <p
        v-else
        class="flex items-start gap-2 rounded-field bg-ok-50 px-3.5 py-3 text-[13px] text-ok-700"
      >
        <UiIcon name="check" :size="16" class="mt-0.5 shrink-0" />
        Farq aniqlanmadi: sanalgan miqdorlar hisobdagi qoldiqqa to‘liq mos keldi.
      </p>

      <div class="flex flex-wrap items-center justify-between gap-2 rounded-field bg-surface-sunken px-4 py-3">
        <span class="text-[13px] font-semibold text-ink-700">Umumiy farq qiymati</span>
        <span class="tabular text-[16px] font-bold text-ink-900">
          {{ valueDiff > 0 ? '+' : '' }}{{ sum(valueDiff) }}
        </span>
      </div>
    </div>

    <template #footer>
      <UiButton variant="ghost" @click="finishOpen = false">Bekor qilish</UiButton>
      <UiButton variant="success" @click="finishSession">
        <UiIcon name="check" :size="16" />
        Aktni rasmiylashtirish
      </UiButton>
    </template>
  </UiModal>

  <UiModal
    v-model="cancelOpen"
    title="Sanoqni bekor qilish"
    subtitle="Kiritilgan sanoq natijalari saqlanmaydi"
    size="sm"
  >
    <p class="text-[14px] leading-relaxed text-ink-700">
      Joriy seans yopiladi va kiritilgan barcha miqdorlar o‘chiriladi. Ombor qoldig‘i
      o‘zgarishsiz qoladi.
    </p>
    <template #footer>
      <UiButton variant="ghost" @click="cancelOpen = false">Davom ettirish</UiButton>
      <UiButton variant="danger" @click="cancelSession">Bekor qilish</UiButton>
    </template>
  </UiModal>

  <UiModal
    v-model="actOpen"
    :title="`Inventarizatsiya akti ${act?.code ?? ''}`"
    :subtitle="act ? `${act.name} · ${act.warehouse}` : undefined"
    size="xl"
  >
    <div v-if="act" class="space-y-4">
      <div class="rounded-field bg-white p-5 ring-1 ring-ink-200 sm:p-6">
        <div class="flex flex-wrap items-start justify-between gap-4 border-b border-ink-200 pb-4">
          <div class="min-w-0">
            <p class="text-[18px] font-bold text-ink-900">Inventarizatsiya akti</p>
            <p class="tabular mt-1 text-[13px] text-ink-500">
              {{ act.code }} · {{ dateShort(act.date) }}
            </p>
          </div>
          <AppLogo size="sm" />
        </div>

        <dl class="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <div class="flex justify-between gap-3 border-b border-ink-100 pb-2">
            <dt class="text-[13px] text-ink-500">Ombor</dt>
            <dd class="text-right text-[13px] font-semibold text-ink-900">{{ act.warehouse }}</dd>
          </div>
          <div class="flex justify-between gap-3 border-b border-ink-100 pb-2">
            <dt class="text-[13px] text-ink-500">Mas’ul shaxs</dt>
            <dd class="text-right text-[13px] font-semibold text-ink-900">{{ act.owner }}</dd>
          </div>
          <div class="flex justify-between gap-3 border-b border-ink-100 pb-2">
            <dt class="text-[13px] text-ink-500">Sanalgan pozitsiyalar</dt>
            <dd class="tabular text-right text-[13px] font-semibold text-ink-900">
              {{ act.positions }} ta
            </dd>
          </div>
          <div class="flex justify-between gap-3 border-b border-ink-100 pb-2">
            <dt class="text-[13px] text-ink-500">Farq aniqlangan pozitsiyalar</dt>
            <dd class="tabular text-right text-[13px] font-semibold text-ink-900">
              {{ act.positions - act.matched }} ta
            </dd>
          </div>
        </dl>

        <div class="scroll-slim mt-5 overflow-x-auto">
          <table class="w-full min-w-max border-collapse text-sm">
            <thead>
              <tr class="border-b border-ink-200 bg-surface-sunken">
                <th class="px-3 py-2 text-left text-[12px] font-semibold uppercase tracking-wide text-ink-500">
                  №
                </th>
                <th class="px-3 py-2 text-left text-[12px] font-semibold uppercase tracking-wide text-ink-500">
                  Nomi
                </th>
                <th class="px-3 py-2 text-right text-[12px] font-semibold uppercase tracking-wide text-ink-500">
                  Hisobda
                </th>
                <th class="px-3 py-2 text-right text-[12px] font-semibold uppercase tracking-wide text-ink-500">
                  Sanaldi
                </th>
                <th class="px-3 py-2 text-right text-[12px] font-semibold uppercase tracking-wide text-ink-500">
                  Farq
                </th>
                <th class="px-3 py-2 text-right text-[12px] font-semibold uppercase tracking-wide text-ink-500">
                  Farq qiymati
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(l, i) in actLineRows" :key="l.itemId" class="border-b border-ink-100">
                <td class="tabular px-3 py-2.5 text-ink-500">{{ i + 1 }}</td>
                <td class="px-3 py-2.5 text-ink-700">
                  <span class="block font-semibold text-ink-900">{{ l.name }}</span>
                  <span class="tabular block text-[12px] text-ink-500">{{ l.code }}</span>
                </td>
                <td class="tabular px-3 py-2.5 text-right text-ink-700">
                  {{ num(l.expected) }} {{ l.unit }}
                </td>
                <td class="tabular px-3 py-2.5 text-right font-semibold text-ink-900">
                  {{ num(l.counted) }} {{ l.unit }}
                </td>
                <td
                  class="tabular px-3 py-2.5 text-right font-semibold"
                  :class="
                    l.diff > 0 ? 'text-info-700' : l.diff < 0 ? 'text-danger-700' : 'text-ok-700'
                  "
                >
                  {{ l.diff > 0 ? '+' : '' }}{{ num(l.diff) }}
                  <span class="ml-1 text-[12px] font-medium">
                    {{ l.diff > 0 ? 'ortiqcha' : l.diff < 0 ? 'kamomad' : 'mos' }}
                  </span>
                </td>
                <td class="tabular px-3 py-2.5 text-right font-bold text-ink-900">
                  {{ sum(l.value) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="mt-4 grid gap-3 sm:grid-cols-3">
          <div class="rounded-field p-3.5 ring-1 ring-ink-200">
            <p class="text-[12px] text-ink-500">Ortiqcha</p>
            <p class="tabular mt-1 text-[16px] font-bold text-info-700">
              {{ num(act.surplusQty) }} birlik
            </p>
          </div>
          <div class="rounded-field p-3.5 ring-1 ring-ink-200">
            <p class="text-[12px] text-ink-500">Kamomad</p>
            <p class="tabular mt-1 text-[16px] font-bold text-danger-700">
              {{ num(act.shortageQty) }} birlik
            </p>
          </div>
          <div class="rounded-field p-3.5 ring-1 ring-ink-200">
            <p class="text-[12px] text-ink-500">Umumiy farq qiymati</p>
            <p class="tabular mt-1 text-[16px] font-bold text-ink-900">
              {{ act.valueDiff > 0 ? '+' : '' }}{{ sum(act.valueDiff) }}
            </p>
          </div>
        </div>

        <div class="mt-6 grid gap-6 sm:grid-cols-2">
          <div>
            <p class="text-[12px] text-ink-500">Sanoqni o‘tkazdi</p>
            <p class="mt-6 border-t border-ink-300 pt-1.5 text-[13px] text-ink-600">
              {{ act.owner }}
            </p>
          </div>
          <div>
            <p class="text-[12px] text-ink-500">Tasdiqladi</p>
            <p class="mt-6 border-t border-ink-300 pt-1.5 text-[13px] text-ink-600">
              {{ auth.user?.fullName ?? 'Ombor mas’uli' }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <UiButton variant="ghost" @click="act = null">Yopish</UiButton>
      <UiButton variant="secondary" to="/warehouse">
        <UiIcon name="box" :size="16" />
        Ombor qoldig‘i
      </UiButton>
    </template>
  </UiModal>
</template>
