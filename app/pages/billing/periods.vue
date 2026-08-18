<script setup lang="ts">
import AppTopbar from '~/components/layout/AppTopbar.vue'
import { billingSummaryOf } from '~/data/business'
import { TONE_BADGE } from '~/constants/statuses'
import { num, percent, sum, sumShort } from '~/utils/format'

interface Period {
  id: string
  year: number
  month: string
  contracts: number
  invoices: number
  total: number
  closed: boolean
}

const periods = ref<Period[]>([
  { id: 'p-2025-01', year: 2025, month: 'Yanvar', contracts: 118, invoices: 118, total: 118400000, closed: true },
  { id: 'p-2025-02', year: 2025, month: 'Fevral', contracts: 121, invoices: 121, total: 121750000, closed: true },
  { id: 'p-2025-03', year: 2025, month: 'Mart', contracts: 124, invoices: 124, total: 124900000, closed: true },
  { id: 'p-2025-04', year: 2025, month: 'Aprel', contracts: 126, invoices: 126, total: 126300000, closed: true },
  { id: 'p-2025-05', year: 2025, month: 'May', contracts: 128, invoices: 128, total: billingSummaryOf().charged, closed: false },
  { id: 'p-2025-06', year: 2025, month: 'Iyun', contracts: 129, invoices: 0, total: 0, closed: false },
])

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

const banner = ref('')
const stateFilter = ref('all')

const stateTabs = computed(() => [
  { value: 'all', label: 'Barchasi', count: periods.value.length },
  { value: 'open', label: 'Ochiq', count: periods.value.filter((p) => !p.closed).length },
  { value: 'closed', label: 'Yopilgan', count: periods.value.filter((p) => p.closed).length },
])

const filtered = computed(() =>
  periods.value.filter((p) =>
    stateFilter.value === 'all' ? true : stateFilter.value === 'open' ? !p.closed : p.closed,
  ),
)

const columns = [
  { key: 'label', label: 'Davr' },
  { key: 'contracts', label: 'Shartnomalar soni', align: 'right' as const, numeric: true },
  { key: 'invoices', label: 'Hisob-faktura soni', align: 'right' as const, numeric: true },
  { key: 'total', label: 'Jami summa', align: 'right' as const, numeric: true },
  { key: 'state', label: 'Holat' },
  { key: 'actions', label: 'Amallar', align: 'right' as const },
]

const rows = computed(() =>
  filtered.value.map((p) => ({
    id: p.id,
    label: `${p.month} ${p.year}`,
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

const chartLabels = computed(() => periods.value.map((p) => p.month))
const chartSeries = computed(() => [
  {
    label: 'Hisoblangan summa',
    tone: 'brand' as const,
    values: periods.value.map((p) => Math.round(p.total / 1_000_000)),
  },
])

const confirmOpen = ref(false)
const confirmMode = ref<'generate' | 'close'>('generate')
const targetId = ref('')

const target = computed(() => periods.value.find((p) => p.id === targetId.value) ?? null)

function askGenerate(id: string) {
  targetId.value = id
  confirmMode.value = 'generate'
  confirmOpen.value = true
}

function askClose(id: string) {
  targetId.value = id
  confirmMode.value = 'close'
  confirmOpen.value = true
}

function applyConfirm() {
  const p = target.value
  if (!p) return
  if (confirmMode.value === 'generate') {
    p.invoices = p.contracts
    p.total = Math.round(p.contracts * 1_002_000)
    banner.value = `${p.month} ${p.year} davri uchun ${num(p.invoices)} ta hisob-faktura shakllantirildi, jami ${sum(p.total)}.`
  } else {
    p.closed = true
    banner.value = `${p.month} ${p.year} davri yopildi. Yangi hisob-fakturalar ushbu davrga qo‘shilmaydi.`
  }
  confirmOpen.value = false
}

const detailOpen = ref(false)
const detailId = ref('')
const detail = computed(() => periods.value.find((p) => p.id === detailId.value) ?? null)

function openDetail(row: Record<string, unknown>) {
  detailId.value = String(row.id)
  detailOpen.value = true
}

const createOpen = ref(false)
const newYear = ref('2025')
const newMonth = ref('Iyul')

const yearOptions = [
  { value: '2025', label: '2025-yil' },
  { value: '2026', label: '2026-yil' },
]

const monthOptions = MONTHS.map((m) => ({ value: m, label: m }))

const duplicate = computed(() =>
  periods.value.some((p) => p.year === Number(newYear.value) && p.month === newMonth.value),
)

function createPeriod() {
  if (duplicate.value) return
  const index = MONTHS.indexOf(newMonth.value) + 1
  periods.value.push({
    id: `p-${newYear.value}-${String(index).padStart(2, '0')}`,
    year: Number(newYear.value),
    month: newMonth.value,
    contracts: 129,
    invoices: 0,
    total: 0,
    closed: false,
  })
  periods.value.sort((a, b) =>
    a.year === b.year ? MONTHS.indexOf(a.month) - MONTHS.indexOf(b.month) : a.year - b.year,
  )
  banner.value = `${newMonth.value} ${newYear.value} hisob davri ochildi.`
  createOpen.value = false
}
</script>

<template>
  <AppTopbar
    title="Hisob-kitob davrlari"
    subtitle="Hisob-kitob davrlari va hisob-faktura shakllantirish"
    :breadcrumb="[{ label: 'Billing' }, { label: 'Hisob-kitob davrlari' }]"
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
              @click.stop="askGenerate(String(row.id))"
            >
              <UiIcon name="refresh" :size="15" />
              Hisob-faktura shakllantirish
            </UiButton>
            <UiButton
              variant="subtle"
              size="sm"
              :disabled="Boolean(row.closed)"
              @click.stop="askClose(String(row.id))"
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
      :subtitle="target ? `${target.month} ${target.year} hisob davri` : ''"
    >
      <div v-if="target" class="space-y-4">
        <p class="text-[13.5px] leading-relaxed text-ink-700">
          <template v-if="confirmMode === 'generate'">
            Ushbu davrdagi <b>{{ num(target.contracts) }} ta</b> faol shartnoma bo‘yicha
            hisob-fakturalar shakllantiriladi va tarif jadvali asosida summalar hisoblanadi.
          </template>
          <template v-else>
            Davr yopilgandan so‘ng unga yangi hisob-faktura qo‘shib bo‘lmaydi, summalar
            hisobotlarga yakuniy sifatida uzatiladi.
          </template>
        </p>

        <dl class="divide-y divide-ink-100 rounded-field bg-surface-sunken px-4">
          <div class="flex items-baseline justify-between gap-4 py-2.5">
            <dt class="text-[13px] text-ink-500">Shartnomalar</dt>
            <dd class="tabular text-[13.5px] font-semibold text-ink-900">
              {{ num(target.contracts) }} ta
            </dd>
          </div>
          <div class="flex items-baseline justify-between gap-4 py-2.5">
            <dt class="text-[13px] text-ink-500">Joriy hisob-faktura soni</dt>
            <dd class="tabular text-[13.5px] font-semibold text-ink-900">
              {{ num(target.invoices) }} ta
            </dd>
          </div>
          <div class="flex items-baseline justify-between gap-4 py-2.5">
            <dt class="text-[13px] text-ink-500">Joriy summa</dt>
            <dd class="tabular text-[13.5px] font-semibold text-ink-900">{{ sum(target.total) }}</dd>
          </div>
        </dl>
      </div>

      <template #footer>
        <UiButton variant="ghost" @click="confirmOpen = false">Bekor qilish</UiButton>
        <UiButton :variant="confirmMode === 'generate' ? 'primary' : 'danger'" @click="applyConfirm">
          <UiIcon name="check" :size="16" />
          {{ confirmMode === 'generate' ? 'Generatsiya qilish' : 'Davrni yopish' }}
        </UiButton>
      </template>
    </UiModal>

    <UiModal
      v-model="detailOpen"
      :title="detail ? `${detail.month} ${detail.year}` : 'Hisob davri'"
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
            Bajarilish: {{ percent(detail.contracts ? (detail.invoices / detail.contracts) * 100 : 0) }}
          </span>
        </div>

        <dl class="grid gap-4 sm:grid-cols-3">
          <div class="rounded-field bg-surface-sunken p-3.5">
            <dt class="text-[12px] text-ink-500">Shartnomalar</dt>
            <dd class="tabular mt-1 text-[15px] font-bold text-ink-900">
              {{ num(detail.contracts) }} ta
            </dd>
          </div>
          <div class="rounded-field bg-surface-sunken p-3.5">
            <dt class="text-[12px] text-ink-500">Hisob-fakturalar</dt>
            <dd class="tabular mt-1 text-[15px] font-bold text-ink-900">
              {{ num(detail.invoices) }} ta
            </dd>
          </div>
          <div class="rounded-field bg-surface-sunken p-3.5">
            <dt class="text-[12px] text-ink-500">Jami summa</dt>
            <dd class="tabular mt-1 text-[15px] font-bold text-ink-900">{{ sum(detail.total) }}</dd>
          </div>
        </dl>
      </div>

      <template #footer>
        <UiButton variant="ghost" @click="detailOpen = false">Yopish</UiButton>
        <UiButton to="/billing/invoices">
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
