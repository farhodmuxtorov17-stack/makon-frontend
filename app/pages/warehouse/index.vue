<script setup lang="ts">
import {
  MATERIAL_REQUESTS,
  SERVICE_REQUESTS,
  STOCK_CATEGORIES,
  STOCK_ITEMS,
  WAREHOUSE_SUMMARY,
  type StockItem,
} from '~/data/operations'
import { dateShort, num, sum, sumShort } from '~/utils/format'

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

const items = ref<StockItem[]>(STOCK_ITEMS.map((i) => ({ ...i })))

const warehouses = computed(() => [...new Set(items.value.map((i) => i.warehouse))])

const query = ref('')
const fCategory = ref('all')
const fWarehouse = ref('all')

const categoryOptions = computed(() => [
  { value: 'all', label: 'Barcha kategoriya' },
  ...STOCK_CATEGORIES.map((c) => ({ value: c.label, label: c.label })),
])

const warehouseOptions = computed(() => [
  { value: 'all', label: 'Barcha omborlar' },
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
      label: 'Yetarli',
      badge: 'bg-ok-50 text-ok-700 ring-ok-100',
      mark: 'text-ok-500',
      shape: 'check',
    }
  if (qty >= minQty)
    return {
      key: 'warn',
      label: 'O‘rta',
      badge: 'bg-warn-50 text-warn-700 ring-warn-100',
      mark: 'text-warn-500',
      shape: 'bar',
    }
  return {
    key: 'danger',
    label: 'Kam',
    badge: 'bg-danger-50 text-danger-700 ring-danger-100',
    mark: 'text-danger-500',
    shape: 'triangle',
  }
}

const columns = [
  { key: 'code', label: 'Kodi', width: '116px' },
  { key: 'name', label: 'Nomi' },
  { key: 'category', label: 'Kategoriya' },
  { key: 'unit', label: 'O‘lchov birligi' },
  { key: 'qty', label: 'Mavjud miqdor', align: 'right' as const, numeric: true },
  { key: 'minQty', label: 'Minimal zaxira', align: 'right' as const, numeric: true },
  { key: 'level', label: 'Zaxira darajasi' },
  { key: 'warehouse', label: 'Ombor' },
]

const extraIn = ref(0)
const extraOut = ref(0)

const summary = computed(() => [
  {
    key: 'in',
    label: 'Kirim',
    value: num(WAREHOUSE_SUMMARY.inbound + extraIn.value),
    unit: 'birlik',
    icon: 'arrowUp',
    tone: 'ok',
  },
  {
    key: 'out',
    label: 'Chiqim',
    value: num(WAREHOUSE_SUMMARY.outbound + extraOut.value),
    unit: 'birlik',
    icon: 'arrowDown',
    tone: 'danger',
  },
  {
    key: 'balance',
    label: 'Qoldiq',
    value: num(WAREHOUSE_SUMMARY.balance + extraIn.value - extraOut.value),
    unit: 'birlik',
    icon: 'box',
    tone: 'brand',
  },
])

const acts = ref<IssueAct[]>(
  MATERIAL_REQUESTS.filter((r) => r.status === 'ISSUED' || r.status === 'APPROVED').map((r) => {
    const picks = STOCK_ITEMS.slice(0, Math.max(r.items, 1))
    return {
      id: r.id,
      code: r.code.replace('MT-', 'BD-'),
      recipient: r.requester,
      request: r.workOrder,
      warehouse: picks[0]?.warehouse ?? 'Markaziy ombor',
      positions: picks.length,
      at: r.createdAt,
      status: r.status === 'ISSUED' ? 'ISSUED' : 'APPROVED',
      lines: picks.map((p, i) => ({ name: p.name, unit: p.unit, qty: (i + 1) * 2 })),
    }
  }),
)

const actColumns = [
  { key: 'code', label: 'Raqam', width: '150px' },
  { key: 'recipient', label: 'Kimga berildi' },
  { key: 'request', label: 'Qaysi ariza bo‘yicha' },
  { key: 'warehouse', label: 'Ombor' },
  { key: 'positions', label: 'Pozitsiya', align: 'right' as const, numeric: true },
  { key: 'at', label: 'Sana' },
  { key: 'status', label: 'Holati' },
  { key: 'print', label: 'Amal', align: 'right' as const },
]

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

const receiveOpen = ref(false)
const receiveItem = ref(STOCK_ITEMS[0]!.id)
const receiveQty = ref(10)
const receiveWarehouse = ref(STOCK_ITEMS[0]!.warehouse)
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
    receiveError.value = 'Pozitsiyani tanlang va miqdorni to‘g‘ri kiriting'
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
const issueWarehouse = ref(STOCK_ITEMS[0]!.warehouse)
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
    issueError.value = 'Kamida bitta pozitsiya uchun miqdor kiriting'
    return
  }
  const over = issueLines.value.find((l) => l.qty > l.item.qty)
  if (over) {
    issueError.value = `«${over.item.name}» bo‘yicha omborda faqat ${over.item.qty} ${over.item.unit} mavjud`
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
  acts.value.unshift({
    id: `bd-${numbered}`,
    code: `BD-2025-${numbered}`,
    recipient: issueRecipient.value,
    request: issueRequest.value,
    warehouse: issueWarehouse.value,
    positions: lines.length,
    at: (SERVICE_REQUESTS[0]?.createdAt ?? '2025-05-18').slice(0, 10),
    status: 'ISSUED',
    lines,
  })
  issueOpen.value = false
  resetIssue()
}
</script>

<template>
  <AppTopbar
    title="Ombor va jihozlar"
    subtitle="Material va jihozlarni qabul qilish, saqlash va berish"
  >
    <template #actions>
      <UiButton variant="secondary" size="sm" @click="receiveOpen = true">
        <UiIcon name="download" :size="16" />
        Yangi qabul
      </UiButton>
      <UiButton size="sm" @click="issueOpen = true">
        <UiIcon name="send" :size="16" />
        Berish dalolatnomasi
      </UiButton>
    </template>
  </AppTopbar>

  <main class="scroll-slim flex-1 space-y-5 overflow-y-auto p-6">
    <section class="grid gap-5 xl:grid-cols-3">
      <UiCard
        class="xl:col-span-2"
        title="Jihoz va material kategoriyalari"
        subtitle="Kategoriya ustiga bosilsa jadval shu bo‘yicha filtrlanadi"
      >
        <template #actions>
          <UiButton variant="ghost" size="sm" @click="fCategory = 'all'">Barchasi</UiButton>
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
            <span class="mt-2.5 block truncate text-[12.5px] font-semibold text-ink-900">
              {{ c.label }}
            </span>
            <span class="tabular mt-0.5 block text-[11.5px] text-ink-500">{{ c.count }} nom</span>
          </button>
        </div>
      </UiCard>

      <UiCard title="Ombor harakati (bugun)" subtitle="Kirim, chiqim va joriy qoldiq">
        <div class="grid grid-cols-3 gap-3">
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
            <span class="tabular mt-1 block text-[20px] font-bold leading-none text-ink-900">
              {{ s.value }}
            </span>
            <span class="mt-1 block text-[11.5px] text-ink-500">{{ s.unit }}</span>
          </div>
        </div>

        <dl class="mt-4 space-y-3 border-t border-ink-100 pt-4">
          <div class="flex items-baseline justify-between gap-3">
            <dt class="text-[12.5px] text-ink-500">Jami omborlar</dt>
            <dd class="tabular text-[13.5px] font-bold text-ink-900">
              {{ warehouses.length }} ta
            </dd>
          </div>
          <div class="flex items-baseline justify-between gap-3">
            <dt class="text-[12.5px] text-ink-500">Jami pozitsiyalar</dt>
            <dd class="tabular text-[13.5px] font-bold text-ink-900">
              {{ num(WAREHOUSE_SUMMARY.positions) }} nom
            </dd>
          </div>
          <div class="flex items-baseline justify-between gap-3">
            <dt class="text-[12.5px] text-ink-500">Jami qoldiq qiymati</dt>
            <dd class="tabular text-[13.5px] font-bold text-ink-900">
              {{ sumShort(WAREHOUSE_SUMMARY.totalValue) }}
            </dd>
          </div>
        </dl>
      </UiCard>
    </section>

    <UiCard
      title="Mavjud material va jihozlar"
      :subtitle="`${rows.length} ta pozitsiya ko‘rsatilmoqda`"
      flush
      :padded="false"
    >
      <template #actions>
        <UiButton variant="secondary" size="sm" @click="receiveOpen = true">
          <UiIcon name="plus" :size="16" />
          Yangi qabul
        </UiButton>
      </template>

      <div class="grid gap-3 border-t border-ink-100 bg-surface-sunken px-5 py-4 lg:grid-cols-4">
        <UiInput v-model="query" placeholder="Kod yoki nom bo‘yicha qidirish" class="lg:col-span-2">
          <template #prefix>
            <UiIcon name="search" :size="18" />
          </template>
        </UiInput>
        <UiSelect v-model="fCategory" :options="categoryOptions" />
        <div class="flex items-center gap-2">
          <UiSelect v-model="fWarehouse" :options="warehouseOptions" class="flex-1" />
          <UiButton v-if="dirty" variant="ghost" size="sm" @click="resetFilters">
            <UiIcon name="refresh" :size="16" />
            Tozalash
          </UiButton>
        </div>
      </div>

      <UiTable :columns="columns" :rows="rows" empty="Tanlangan shartga mos pozitsiya topilmadi">
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
      title="Berish dalolatnomalari"
      :subtitle="`${acts.length} ta hujjat`"
      flush
      :padded="false"
    >
      <template #actions>
        <UiButton size="sm" @click="issueOpen = true">
          <UiIcon name="plus" :size="16" />
          Yangi dalolatnoma
        </UiButton>
      </template>

      <UiTable
        :columns="actColumns"
        :rows="actRows"
        empty="Dalolatnoma mavjud emas"
        @row-click="openAct"
      >
        <template #cell-code="{ row }">
          <span class="tabular text-[13px] font-bold text-ink-900">{{ row.code }}</span>
        </template>

        <template #cell-request="{ row }">
          <span class="tabular text-[13px] font-semibold text-brand-600">{{ row.request }}</span>
        </template>

        <template #cell-positions="{ row }">{{ row.positions }} ta</template>

        <template #cell-at="{ row }">
          <span class="tabular">{{ dateShort(row.at) }}</span>
        </template>

        <template #cell-status="{ row }">
          <UiStatus kind="material" :value="row.status" size="sm" />
        </template>

        <template #cell-print="{ row }">
          <UiButton variant="ghost" size="sm" @click.stop="openAct(row)">
            <UiIcon name="print" :size="16" />
            Chop etish
          </UiButton>
        </template>
      </UiTable>
    </UiCard>
  </main>

  <UiModal
    v-model="receiveOpen"
    title="Yangi qabul"
    subtitle="Omborga kirim qilingan material yoki jihozni qayd eting"
  >
    <div class="space-y-4">
      <UiField label="Ombor" required hint="Kirim tanlangan ombor qoldig‘iga qo‘shiladi">
        <UiSelect
          v-model="receiveWarehouse"
          :options="warehouses.map((w) => ({ value: w, label: w }))"
        />
      </UiField>

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

      <UiField label="Izoh" :error="receiveError" hint="Yetkazib beruvchi yoki hujjat raqami">
        <textarea
          v-model="receiveNote"
          rows="3"
          placeholder="Kirim asosini yozing"
          class="scroll-slim w-full rounded-field bg-white px-3.5 py-2.5 text-sm text-ink-800 ring-1 ring-inset ring-ink-200 transition-colors placeholder:text-ink-400 hover:ring-ink-300 focus:ring-2 focus:ring-brand-500"
        />
      </UiField>
    </div>

    <template #footer>
      <UiButton variant="ghost" @click="receiveOpen = false">Bekor qilish</UiButton>
      <UiButton variant="success" @click="saveReceive">
        <UiIcon name="check" :size="16" />
        Qabulni saqlash
      </UiButton>
    </template>
  </UiModal>

  <UiModal
    v-model="issueOpen"
    title="Berish dalolatnomasi"
    subtitle="Material va jihozlarni ariza bo‘yicha rasmiylashtirib bering"
    size="xl"
  >
    <div class="space-y-4">
      <div class="grid gap-4 lg:grid-cols-3">
        <UiField label="Kimga beriladi" required>
          <UiSelect v-model="issueRecipient" :options="recipientOptions" />
        </UiField>
        <UiField label="Qaysi ariza bo‘yicha" required>
          <UiSelect v-model="issueRequest" :options="requestOptions" />
        </UiField>
        <UiField label="Ombor" required>
          <UiSelect
            v-model="issueWarehouse"
            :options="warehouses.map((w) => ({ value: w, label: w }))"
          />
        </UiField>
      </div>

      <div class="overflow-hidden rounded-field ring-1 ring-ink-200">
        <div class="flex items-center justify-between border-b border-ink-200 bg-surface-sunken px-4 py-3">
          <span class="text-[13px] font-semibold text-ink-700">Jihoz va materiallarni tanlash</span>
          <span class="tabular text-[12.5px] text-ink-500">
            {{ issuePool.length }} ta pozitsiya mavjud
          </span>
        </div>

        <ul class="scroll-slim max-h-72 divide-y divide-ink-100 overflow-y-auto">
          <li v-for="i in issuePool" :key="i.id" class="flex items-center gap-3 px-4 py-3">
            <span class="grid size-9 shrink-0 place-items-center rounded-[10px] bg-ink-100 text-ink-600">
              <UiIcon name="cube" :size="17" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-[13.5px] font-semibold text-ink-900">{{ i.name }}</span>
              <span class="tabular block text-[12px] text-ink-500">
                {{ i.code }} · mavjud {{ num(i.qty) }} {{ i.unit }}
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
            Bu omborda pozitsiya yo‘q
          </li>
        </ul>

        <div class="flex items-center justify-between border-t border-ink-200 bg-surface-sunken px-4 py-3">
          <span class="text-[13px] font-semibold text-ink-700">
            Tanlandi: {{ issueLines.length }} ta pozitsiya · {{ num(issueUnits) }} birlik
          </span>
          <span class="tabular text-[14px] font-bold text-ink-900">{{ sum(issueTotal) }}</span>
        </div>
      </div>

      <UiField label="Izoh" :error="issueError">
        <textarea
          v-model="issueNote"
          rows="2"
          placeholder="Izoh kiriting"
          class="scroll-slim w-full rounded-field bg-white px-3.5 py-2.5 text-sm text-ink-800 ring-1 ring-inset ring-ink-200 transition-colors placeholder:text-ink-400 hover:ring-ink-300 focus:ring-2 focus:ring-brand-500"
        />
      </UiField>
    </div>

    <template #footer>
      <UiButton variant="ghost" @click="((issueOpen = false), resetIssue())">Bekor qilish</UiButton>
      <UiButton @click="saveIssue">
        <UiIcon name="check" :size="16" />
        Dalolatnomani rasmiylashtirish
      </UiButton>
    </template>
  </UiModal>

  <UiModal
    v-model="printOpen"
    :title="`Dalolatnoma ${printAct?.code ?? ''}`"
    subtitle="Chop etishdan oldingi ko‘rinish"
    size="lg"
  >
    <div v-if="printAct" class="rounded-field bg-white p-6 ring-1 ring-ink-200">
      <div class="flex items-start justify-between gap-4 border-b border-ink-200 pb-4">
        <div>
          <p class="text-[17px] font-bold text-ink-900">Jihoz va material berish dalolatnomasi</p>
          <p class="tabular mt-1 text-[13px] text-ink-500">
            {{ printAct.code }} · {{ dateShort(printAct.at) }}
          </p>
        </div>
        <AppLogo size="sm" />
      </div>

      <dl class="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
        <div class="flex justify-between gap-3 border-b border-ink-100 pb-2">
          <dt class="text-[12.5px] text-ink-500">Kimga berildi</dt>
          <dd class="text-[13px] font-semibold text-ink-900">{{ printAct.recipient }}</dd>
        </div>
        <div class="flex justify-between gap-3 border-b border-ink-100 pb-2">
          <dt class="text-[12.5px] text-ink-500">Qaysi ariza bo‘yicha</dt>
          <dd class="tabular text-[13px] font-semibold text-ink-900">{{ printAct.request }}</dd>
        </div>
        <div class="flex justify-between gap-3 border-b border-ink-100 pb-2">
          <dt class="text-[12.5px] text-ink-500">Ombor</dt>
          <dd class="text-[13px] font-semibold text-ink-900">{{ printAct.warehouse }}</dd>
        </div>
        <div class="flex justify-between gap-3 border-b border-ink-100 pb-2">
          <dt class="text-[12.5px] text-ink-500">Omborchi</dt>
          <dd class="text-[13px] font-semibold text-ink-900">
            {{ auth.user?.fullName ?? 'Ombor mas’uli' }}
          </dd>
        </div>
      </dl>

      <table class="mt-5 w-full border-collapse text-sm">
        <thead>
          <tr class="border-b border-ink-200 bg-surface-sunken">
            <th class="px-3 py-2 text-left text-[11.5px] font-semibold uppercase tracking-wide text-ink-500">
              №
            </th>
            <th class="px-3 py-2 text-left text-[11.5px] font-semibold uppercase tracking-wide text-ink-500">
              Nomi
            </th>
            <th class="px-3 py-2 text-left text-[11.5px] font-semibold uppercase tracking-wide text-ink-500">
              O‘lchov birligi
            </th>
            <th class="px-3 py-2 text-right text-[11.5px] font-semibold uppercase tracking-wide text-ink-500">
              Miqdor
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
          <p class="text-[12px] text-ink-500">Berdi (omborchi)</p>
          <p class="mt-6 border-t border-ink-300 pt-1.5 text-[12.5px] text-ink-600">
            {{ auth.user?.fullName ?? 'Ombor mas’uli' }}
          </p>
        </div>
        <div>
          <p class="text-[12px] text-ink-500">Oldi</p>
          <p class="mt-6 border-t border-ink-300 pt-1.5 text-[12.5px] text-ink-600">
            {{ printAct.recipient }}
          </p>
        </div>
      </div>
    </div>

    <template #footer>
      <UiButton variant="ghost" @click="printAct = null">Yopish</UiButton>
      <UiButton @click="sendToPrinter">
        <UiIcon name="print" :size="16" />
        Chop etish
      </UiButton>
    </template>
  </UiModal>
</template>
