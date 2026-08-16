<script setup lang="ts">
import AppTopbar from '~/components/layout/AppTopbar.vue'
import { BUILDINGS } from '~/data/buildings'
import { AGING, INVOICES } from '~/data/business'
import { dateShort, num, percent, sum, sumShort } from '~/utils/format'

const BUCKET_KEYS = ['0-30', '31-60', '61-90', '90+']

const debtors = INVOICES.filter((i) => i.total - i.paid > 0).map((i) => ({
  id: i.id,
  tenant: i.tenant,
  buildingName: i.buildingName,
  unitCode: i.unitCode,
  code: i.code,
  dueAt: i.dueAt,
  balance: i.total - i.paid,
  agingBucket: i.agingBucket ?? '0-30',
  status: i.status,
}))

const debtTotal = debtors.reduce((s, d) => s + d.balance, 0)

const buckets = AGING.map((a, i) => {
  const key = BUCKET_KEYS[i] ?? '0-30'
  const amount = debtors.filter((d) => d.agingBucket === key).reduce((s, d) => s + d.balance, 0)
  return {
    key,
    bucket: a.bucket,
    share: debtTotal ? (amount / debtTotal) * 100 : 0,
    amount,
    tone: a.tone,
    icon: i < 2 ? 'clock' : 'warning',
  }
})

const search = ref('')
const building = ref('all')
const bucket = ref('all')
const banner = ref('')

const buildingOptions = [
  { value: 'all', label: 'Barcha obyektlar' },
  ...BUILDINGS.map((b) => ({ value: b.name, label: b.name })),
]

const bucketOptions = [
  { value: 'all', label: 'Barcha muddatlar' },
  ...buckets.map((b) => ({ value: b.key, label: b.bucket })),
]

const filtered = computed(() =>
  debtors.filter((d) => {
    const q = search.value.trim().toLowerCase()
    const byQuery =
      !q || `${d.tenant} ${d.code} ${d.buildingName} ${d.unitCode}`.toLowerCase().includes(q)
    const byBuilding = building.value === 'all' || d.buildingName === building.value
    const byBucket = bucket.value === 'all' || d.agingBucket === bucket.value
    return byQuery && byBuilding && byBucket
  }),
)

const columns = [
  { key: 'tenant', label: 'Tashkilot' },
  { key: 'place', label: 'Obyekt / Unit' },
  { key: 'code', label: 'Hujjat' },
  { key: 'dueAt', label: 'Muddati' },
  { key: 'balance', label: 'Qoldiq', align: 'right' as const, numeric: true },
  { key: 'aging', label: 'Aging' },
  { key: 'status', label: 'Status' },
]

const rows = computed(() =>
  filtered.value.map((d) => ({
    id: d.id,
    tenant: d.tenant,
    place: `${d.buildingName} · ${d.unitCode}`,
    code: d.code,
    dueAt: d.dueAt,
    balance: d.balance,
    aging: d.agingBucket,
    status: d.status,
  })),
)

const filteredTotal = computed(() => filtered.value.reduce((s, d) => s + d.balance, 0))

function bucketMeta(key: string) {
  return buckets.find((b) => b.key === key) ?? buckets[0]!
}

function toggleBucket(key: string) {
  bucket.value = bucket.value === key ? 'all' : key
}

function resetFilters() {
  search.value = ''
  building.value = 'all'
  bucket.value = 'all'
}

const historyOpen = ref(false)
const historyTenant = ref('')

const history = computed(() => INVOICES.filter((i) => i.tenant === historyTenant.value))
const historyDebt = computed(() => history.value.reduce((s, i) => s + (i.total - i.paid), 0))

function openHistory(row: Record<string, unknown>) {
  historyTenant.value = String(row.tenant)
  historyOpen.value = true
}

const exportOpen = ref(false)

function runExport(format: 'PDF' | 'XLSX') {
  banner.value = `Qarzdorlik reyestri ${format} formatida shakllantirildi, ${num(filtered.value.length)} ta yozuv, ${sum(filteredTotal.value)}.`
  exportOpen.value = false
}

const agingSlices = buckets.map((b) => ({ label: b.bucket, value: b.amount, tone: b.tone }))
</script>

<template>
  <AppTopbar
    title="Qarzdorlik tahlili"
    subtitle="Muddati o‘tgan to‘lovlar va aging kesimidagi nazorat"
    :breadcrumb="[{ label: 'Billing' }, { label: 'Qarzdorlik tahlili' }]"
  >
    <template #actions>
      <UiButton variant="secondary" size="sm" to="/billing/payments">
        <UiIcon name="check" :size="16" />
        To‘lovlarni tasdiqlash
      </UiButton>
      <UiButton size="sm" @click="exportOpen = true">
        <UiIcon name="download" :size="16" />
        Eksport
      </UiButton>
    </template>
  </AppTopbar>

  <main class="scroll-slim flex-1 space-y-5 overflow-y-auto p-6">
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
      <button
        v-for="b in buckets"
        :key="b.key"
        type="button"
        class="block rounded-card text-left transition-shadow"
        :class="bucket === b.key ? 'ring-2 ring-brand-400 ring-offset-2 ring-offset-canvas' : ''"
        @click="toggleBucket(b.key)"
      >
        <UiKpi
          :label="`${b.bucket} qarzdorlik`"
          :value="sumShort(b.amount)"
          :unit="percent(b.share)"
          :icon="b.icon"
          :tone="b.tone"
        />
      </button>
    </section>

    <section class="grid gap-5 xl:grid-cols-3">
      <UiCard
        class="xl:col-span-2"
        title="Qarzdor tashkilotlar"
        subtitle="Muddati o‘tgan hisob-fakturalar bo‘yicha qoldiqlar"
        flush
        :padded="false"
      >
        <div class="flex flex-wrap items-center gap-3 px-5 pb-4">
          <UiInput
            v-model="search"
            placeholder="Tashkilot yoki hujjat bo‘yicha qidirish"
            class="min-w-[220px] flex-1"
          >
            <template #prefix>
              <UiIcon name="search" :size="18" />
            </template>
          </UiInput>
          <UiSelect v-model="building" :options="buildingOptions" class="w-full sm:w-56" />
          <UiSelect v-model="bucket" :options="bucketOptions" class="w-full sm:w-44" />
          <UiButton variant="ghost" @click="resetFilters">
            <UiIcon name="refresh" :size="16" />
            Tozalash
          </UiButton>
        </div>

        <UiTable
          :columns="columns"
          :rows="rows"
          empty="Tanlangan shartlarga mos qarzdorlik topilmadi"
          @row-click="openHistory"
        >
          <template #cell-tenant="{ row }">
            <span class="font-semibold text-ink-900">{{ row.tenant }}</span>
          </template>
          <template #cell-place="{ row }">
            <span class="text-[13px] text-ink-600">{{ row.place }}</span>
          </template>
          <template #cell-code="{ row }">
            <span class="font-semibold text-brand-600">{{ row.code }}</span>
          </template>
          <template #cell-dueAt="{ row }">{{ dateShort(String(row.dueAt)) }}</template>
          <template #cell-balance="{ row }">
            <span class="text-danger-600">{{ sum(Number(row.balance)) }}</span>
          </template>
          <template #cell-aging="{ row }">
            <span
              class="inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs font-semibold ring-1 ring-inset"
              :class="{
                'bg-ok-50 text-ok-700 ring-ok-100': bucketMeta(String(row.aging)).tone === 'ok',
                'bg-brand-50 text-brand-700 ring-brand-200':
                  bucketMeta(String(row.aging)).tone === 'brand',
                'bg-warn-50 text-warn-700 ring-warn-100':
                  bucketMeta(String(row.aging)).tone === 'warn',
                'bg-danger-50 text-danger-700 ring-danger-100':
                  bucketMeta(String(row.aging)).tone === 'danger',
              }"
            >
              {{ bucketMeta(String(row.aging)).bucket }}
            </span>
          </template>
          <template #cell-status="{ row }">
            <UiStatus kind="invoice" :value="String(row.status)" size="sm" />
          </template>
        </UiTable>

        <div
          class="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 px-5 py-3.5"
        >
          <p class="text-[13px] text-ink-500">
            Jami: <b class="text-ink-800">{{ rows.length }} ta</b> qarzdor
          </p>
          <p class="text-[13px] text-ink-500">
            Umumiy qoldiq: <b class="tabular text-danger-600">{{ sum(filteredTotal) }}</b>
          </p>
        </div>
      </UiCard>

      <div class="space-y-5">
        <UiCard title="Aging taqsimoti" subtitle="Muddat guruhlari bo‘yicha ulush">
          <UiDonut
            :slices="agingSlices"
            :center-value="sumShort(debtTotal)"
            center-label="jami qarzdorlik"
            :size="170"
          />
          <ul class="mt-4 divide-y divide-ink-100 border-t border-ink-100">
            <li v-for="b in buckets" :key="b.key" class="py-2">
              <button
                type="button"
                class="flex w-full items-center gap-3 text-left"
                @click="toggleBucket(b.key)"
              >
                <span class="min-w-0 flex-1 text-[13px] text-ink-600">{{ b.bucket }}</span>
                <span class="tabular text-[13px] font-semibold text-ink-700">
                  {{ percent(b.share) }}
                </span>
                <span class="tabular w-32 text-right text-[13px] font-bold text-ink-900">
                  {{ sum(b.amount) }}
                </span>
              </button>
            </li>
          </ul>
        </UiCard>

        <UiCard title="Eng katta qarzdorlar" subtitle="Qoldiq bo‘yicha yuqori uchlik" flush :padded="false">
          <ul class="divide-y divide-ink-100 border-t border-ink-100">
            <li
              v-for="d in [...debtors].sort((a, b) => b.balance - a.balance).slice(0, 3)"
              :key="d.id"
              class="px-5 py-3.5"
            >
              <button
                type="button"
                class="flex w-full items-center gap-3 text-left"
                @click="openHistory({ tenant: d.tenant })"
              >
                <span class="grid size-10 shrink-0 place-items-center rounded-[10px] bg-danger-50 text-danger-600">
                  <UiIcon name="warning" :size="18" />
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-[13.5px] font-semibold text-ink-900">
                    {{ d.tenant }}
                  </span>
                  <span class="block truncate text-[12px] text-ink-500">
                    {{ d.buildingName }} · {{ bucketMeta(d.agingBucket).bucket }}
                  </span>
                </span>
                <span class="tabular shrink-0 text-[13.5px] font-bold text-danger-600">
                  {{ sumShort(d.balance) }}
                </span>
              </button>
            </li>
          </ul>
        </UiCard>
      </div>
    </section>

    <UiModal
      v-model="historyOpen"
      size="lg"
      :title="historyTenant"
      subtitle="Tashkilot bo‘yicha hisob-faktura tarixi"
    >
      <div class="flex flex-wrap items-center gap-3">
        <span class="rounded-field bg-surface-sunken px-3 py-2 text-[13px] text-ink-600">
          Hujjatlar: <b class="tabular text-ink-900">{{ num(history.length) }} ta</b>
        </span>
        <span class="rounded-field bg-danger-50 px-3 py-2 text-[13px] text-danger-700">
          Joriy qarzdorlik: <b class="tabular">{{ sum(historyDebt) }}</b>
        </span>
      </div>

      <ul class="mt-5 divide-y divide-ink-100 border-t border-ink-100">
        <li v-for="h in history" :key="h.id" class="flex items-center gap-4 py-3.5">
          <span class="min-w-0 flex-1">
            <span class="block text-[13.5px] font-semibold text-ink-900">{{ h.code }}</span>
            <span class="block text-[12px] text-ink-500">
              {{ h.period }} · muddati {{ dateShort(h.dueAt) }}
            </span>
          </span>
          <span class="shrink-0 text-right">
            <span class="tabular block text-[13.5px] font-bold text-ink-900">{{ sum(h.total) }}</span>
            <span class="tabular block text-[12px] text-ok-600">
              to‘langan {{ sum(h.paid) }}
            </span>
          </span>
          <UiStatus kind="invoice" :value="h.status" size="sm" />
        </li>
      </ul>

      <template #footer>
        <UiButton variant="ghost" @click="historyOpen = false">Yopish</UiButton>
        <UiButton to="/billing/payments">
          <UiIcon name="wallet" :size="16" />
          To‘lovlarni tasdiqlash
        </UiButton>
      </template>
    </UiModal>

    <UiModal
      v-model="exportOpen"
      size="sm"
      title="Eksport"
      subtitle="Joriy filtrga mos qarzdorlik reyestri yuklab olinadi"
    >
      <div class="space-y-3">
        <button
          type="button"
          class="flex w-full items-center gap-3 rounded-field p-3.5 text-left ring-1 ring-ink-200 transition-colors hover:bg-brand-50/60 hover:ring-brand-300"
          @click="runExport('PDF')"
        >
          <span class="grid size-10 shrink-0 place-items-center rounded-[10px] bg-danger-50 text-danger-600">
            <UiIcon name="doc" :size="18" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block text-[13.5px] font-semibold text-ink-900">PDF hujjat</span>
            <span class="block text-[12px] text-ink-500">Chop etish uchun tayyor ko‘rinish</span>
          </span>
          <UiIcon name="chevronRight" :size="16" class="text-ink-400" />
        </button>

        <button
          type="button"
          class="flex w-full items-center gap-3 rounded-field p-3.5 text-left ring-1 ring-ink-200 transition-colors hover:bg-brand-50/60 hover:ring-brand-300"
          @click="runExport('XLSX')"
        >
          <span class="grid size-10 shrink-0 place-items-center rounded-[10px] bg-ok-50 text-ok-600">
            <UiIcon name="layers" :size="18" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block text-[13.5px] font-semibold text-ink-900">XLSX jadval</span>
            <span class="block text-[12px] text-ink-500">Qo‘shimcha hisob-kitob uchun</span>
          </span>
          <UiIcon name="chevronRight" :size="16" class="text-ink-400" />
        </button>
      </div>

      <template #footer>
        <UiButton variant="ghost" @click="exportOpen = false">Bekor qilish</UiButton>
      </template>
    </UiModal>
  </main>
</template>
