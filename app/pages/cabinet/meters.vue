<script setup lang="ts">
import { buildingById } from '~/data/buildings'
import { unitById } from '~/data/units'
import { dateShort, num } from '~/utils/format'

const myUnit = unitById('u-501')!
const myBuilding = buildingById(myUnit.buildingId)!

interface CabinetMeter {
  id: string
  code: string
  type: string
  serial: string
  unit: string
  icon: string
  tone: 'brand' | 'warn' | 'danger'
  location: string
  lastReading: number
  previousReading: number
  readAt: string
  verifyAt: string
  status: 'ACTIVE' | 'MAINTENANCE'
  labels: string[]
  history: number[]
}

const NEXT_MONTHS = ['Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr']

const meters = ref<CabinetMeter[]>([
  {
    id: 'cm-suv',
    code: 'MTR-SV-0014',
    type: 'Suv',
    serial: 'SV-442716',
    unit: 'm³',
    icon: 'meter',
    tone: 'brand',
    location: `${myUnit.code}-unit, sanuzel tuguni`,
    lastReading: 125.4,
    previousReading: 118.2,
    readAt: '2025-05-18',
    verifyAt: '2026-01-15',
    status: 'ACTIVE',
    labels: ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May'],
    history: [6.4, 6.9, 7.4, 6.8, 7.2],
  },
  {
    id: 'cm-elektr',
    code: 'MTR-EL-0032',
    type: 'Elektr',
    serial: 'EL-884733',
    unit: 'kVt-soat',
    icon: 'sparkle',
    tone: 'warn',
    location: `${myUnit.code}-unit, kirish shchiti`,
    lastReading: 1245.6,
    previousReading: 1198.3,
    readAt: '2025-05-18',
    verifyAt: '2026-03-01',
    status: 'ACTIVE',
    labels: ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May'],
    history: [41.2, 44.6, 46.1, 43.8, 47.3],
  },
  {
    id: 'cm-issiqlik',
    code: 'MTR-IS-0009',
    type: 'Issiqlik',
    serial: 'IS-770418',
    unit: 'Gkal',
    icon: 'refresh',
    tone: 'danger',
    location: `${myUnit.code}-unit, issiqlik tuguni`,
    lastReading: 63.2,
    previousReading: 58.1,
    readAt: '2025-05-18',
    verifyAt: '2026-02-10',
    status: 'ACTIVE',
    labels: ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May'],
    history: [9.8, 8.4, 6.9, 5.6, 5.1],
  },
])

const TONE_CLASS: Record<string, string> = {
  brand: 'bg-brand-50 text-brand-600',
  warn: 'bg-warn-50 text-warn-600',
  danger: 'bg-danger-50 text-danger-600',
}

const selectedId = ref('cm-suv')
const selected = computed(() => meters.value.find((m) => m.id === selectedId.value)!)

function consumption(m: CabinetMeter) {
  return Math.round((m.lastReading - m.previousReading) * 100) / 100
}

const chartSeries = computed(() => [
  {
    label: `${selected.value.type} sarfi, ${selected.value.unit}`,
    tone: selected.value.tone,
    values: selected.value.history,
    fill: true,
  },
])

const columns = [
  { key: 'code', label: 'Hisoblagich' },
  { key: 'type', label: 'Turi' },
  { key: 'location', label: 'Joylashuvi' },
  { key: 'previousReading', label: 'Oldingi', align: 'right' as const, numeric: true },
  { key: 'lastReading', label: 'Joriy', align: 'right' as const, numeric: true },
  { key: 'consumption', label: 'Sarf', align: 'right' as const, numeric: true },
  { key: 'readAt', label: 'O‘qilgan sana', align: 'right' as const },
  { key: 'actions', label: 'Amallar', align: 'right' as const },
]

const rows = computed(() =>
  meters.value.map((m) => ({
    id: m.id,
    code: m.code,
    type: m.type,
    location: m.location,
    previousReading: m.previousReading,
    lastReading: m.lastReading,
    consumption: consumption(m),
    readAt: m.readAt,
    unit: m.unit,
    status: m.status,
  })),
)

const entryOpen = ref(false)
const entryMeterId = ref('cm-suv')
const entryValue = ref('')
const entryError = ref('')
const savedMessage = ref('')

const entryMeter = computed(() => meters.value.find((m) => m.id === entryMeterId.value)!)

const meterOptions = computed(() =>
  meters.value.map((m) => ({ value: m.id, label: `${m.type}, ${m.code}` })),
)

function openEntry(id: string) {
  entryMeterId.value = id
  entryValue.value = ''
  entryError.value = ''
  entryOpen.value = true
}

function saveReading() {
  const m = entryMeter.value
  const value = Number(entryValue.value)
  if (!entryValue.value.trim() || Number.isNaN(value)) {
    entryError.value = 'Ko‘rsatkich qiymatini kiriting'
    return
  }
  if (value < m.lastReading) {
    entryError.value = `Yangi ko‘rsatkich oldingi qiymatdan (${num(m.lastReading, 2)} ${m.unit}) kichik bo‘lishi mumkin emas`
    return
  }
  entryError.value = ''
  const used = Math.round((value - m.lastReading) * 100) / 100
  m.previousReading = m.lastReading
  m.lastReading = value
  m.readAt = '2025-05-18'
  const nextLabel = NEXT_MONTHS[Math.max(m.labels.length - 5, 0)] ?? 'Keyingi davr'
  m.labels = [...m.labels, nextLabel]
  m.history = [...m.history, used]
  selectedId.value = m.id
  savedMessage.value = `${m.type} hisoblagichi bo‘yicha yangi ko‘rsatkich saqlandi: ${num(value, 2)} ${m.unit}`
  entryOpen.value = false
}
</script>

<template>
  <AppTopbar
    title="Hisoblagichlar"
    :subtitle="`${myBuilding.name} · Unit ${myUnit.code} bo‘yicha ko‘rsatkichlar`"
    :breadcrumb="[{ label: 'Kabinet', to: '/cabinet' }, { label: 'Hisoblagichlar' }]"
  >
    <template #actions>
      <UiButton variant="secondary" size="sm" to="/cabinet/invoices">
        <UiIcon name="wallet" :size="16" />
        Hisob-fakturalar
      </UiButton>
      <UiButton size="sm" @click="openEntry(selectedId)">
        <UiIcon name="plus" :size="16" />
        Ko‘rsatkich kiritish
      </UiButton>
    </template>
  </AppTopbar>

  <main class="scroll-slim flex-1 space-y-5 overflow-y-auto p-6">
    <div
      v-if="savedMessage"
      class="flex items-center gap-3 rounded-card bg-ok-50 px-5 py-3.5 ring-1 ring-ok-100"
    >
      <span class="grid size-9 shrink-0 place-items-center rounded-[10px] bg-ok-500 text-white">
        <UiIcon name="check" :size="18" />
      </span>
      <p class="min-w-0 flex-1 text-[13.5px] text-ok-700">{{ savedMessage }}</p>
      <button
        type="button"
        class="rounded-lg p-1.5 text-ok-700 transition-colors hover:bg-ok-100"
        aria-label="Xabarni yopish"
        @click="savedMessage = ''"
      >
        <UiIcon name="x" :size="16" />
      </button>
    </div>

    <section class="grid gap-4 md:grid-cols-3">
      <button
        v-for="m in meters"
        :key="m.id"
        type="button"
        class="rounded-card bg-surface p-4 text-left shadow-card ring-1 transition-all hover:shadow-panel"
        :class="m.id === selectedId ? 'ring-2 ring-brand-500' : 'ring-ink-200/60 hover:ring-brand-300'"
        @click="selectedId = m.id"
      >
        <div class="flex items-start justify-between gap-3">
          <span class="grid size-10 place-items-center rounded-[10px]" :class="TONE_CLASS[m.tone]">
            <UiIcon :name="m.icon" :size="19" />
          </span>
          <span class="tabular rounded-pill bg-ok-50 px-2.5 py-1 text-[12px] font-bold text-ok-700">
            +{{ num(consumption(m), 2) }} {{ m.unit }}
          </span>
        </div>

        <p class="mt-3 text-[12.5px] text-ink-500">{{ m.type }} ({{ m.unit }})</p>
        <p class="tabular mt-1 text-[24px] font-bold leading-none text-ink-900">
          {{ num(m.lastReading, 2) }}
        </p>
        <p class="tabular mt-1.5 text-[12px] text-ink-500">
          Oldingi: {{ num(m.previousReading, 2) }} {{ m.unit }}
        </p>

        <div class="mt-3 flex items-center justify-between border-t border-ink-100 pt-3">
          <span class="tabular text-[12px] text-ink-500">{{ m.code }}</span>
          <span class="tabular text-[12px] text-ink-500">{{ dateShort(m.readAt) }}</span>
        </div>
      </button>
    </section>

    <section class="grid gap-5 xl:grid-cols-3">
      <UiCard
        class="xl:col-span-2"
        :title="`${selected.type} sarfi dinamikasi`"
        :subtitle="`${selected.code} · oylar kesimida, ${selected.unit}`"
      >
        <template #actions>
          <UiButton variant="secondary" size="sm" @click="openEntry(selected.id)">
            <UiIcon name="edit" :size="15" />
            Ko‘rsatkich kiritish
          </UiButton>
        </template>
        <UiLine :labels="selected.labels" :series="chartSeries" :height="224" />
      </UiCard>

      <UiCard :title="`${selected.type} hisoblagichi`" subtitle="Pasport ma’lumotlari">
        <dl class="divide-y divide-ink-100">
          <div class="flex items-center justify-between py-2.5">
            <dt class="text-[12.5px] text-ink-500">Hisoblagich raqami</dt>
            <dd class="tabular text-[13px] font-semibold text-ink-900">{{ selected.code }}</dd>
          </div>
          <div class="flex items-center justify-between py-2.5">
            <dt class="text-[12.5px] text-ink-500">Zavod raqami</dt>
            <dd class="tabular text-[13px] font-semibold text-ink-900">{{ selected.serial }}</dd>
          </div>
          <div class="flex items-center justify-between py-2.5">
            <dt class="text-[12.5px] text-ink-500">Joylashuvi</dt>
            <dd class="text-[13px] font-semibold text-ink-900">{{ selected.location }}</dd>
          </div>
          <div class="flex items-center justify-between py-2.5">
            <dt class="text-[12.5px] text-ink-500">Joriy sarf</dt>
            <dd class="tabular text-[13px] font-bold text-brand-600">
              {{ num(consumption(selected), 2) }} {{ selected.unit }}
            </dd>
          </div>
          <div class="flex items-center justify-between py-2.5">
            <dt class="text-[12.5px] text-ink-500">Keyingi tekshiruv</dt>
            <dd class="tabular text-[13px] font-semibold text-ink-900">
              {{ dateShort(selected.verifyAt) }}
            </dd>
          </div>
          <div class="flex items-center justify-between py-2.5">
            <dt class="text-[12.5px] text-ink-500">Holat</dt>
            <dd>
              <span
                class="inline-flex items-center gap-1.5 rounded-pill bg-ok-50 px-2.5 py-1 text-[11px] font-semibold text-ok-700 ring-1 ring-inset ring-ok-100"
              >
                <UiIcon name="check" :size="12" />
                Faol
              </span>
            </dd>
          </div>
        </dl>
      </UiCard>
    </section>

    <UiCard title="Barcha hisoblagichlar" subtitle="Ko‘rsatkichlar va davr sarfi" flush>
      <UiTable :columns="columns" :rows="rows" @row-click="(row) => (selectedId = String(row.id))">
        <template #cell-code="{ row }">
          <span class="tabular text-[13.5px] font-semibold text-ink-900">{{ row.code }}</span>
        </template>
        <template #cell-previousReading="{ row }">
          {{ num(Number(row.previousReading), 2) }} {{ row.unit }}
        </template>
        <template #cell-lastReading="{ row }">
          {{ num(Number(row.lastReading), 2) }} {{ row.unit }}
        </template>
        <template #cell-consumption="{ row }">
          <span class="font-bold text-brand-600">
            +{{ num(Number(row.consumption), 2) }} {{ row.unit }}
          </span>
        </template>
        <template #cell-readAt="{ value }">
          <span class="tabular">{{ dateShort(String(value)) }}</span>
        </template>
        <template #cell-actions="{ row }">
          <span class="flex items-center justify-end">
            <button
              type="button"
              class="grid size-9 place-items-center rounded-field text-brand-600 transition-colors hover:bg-brand-50"
              :aria-label="`${row.code}, ko‘rsatkich kiritish`"
              @click.stop="openEntry(String(row.id))"
            >
              <UiIcon name="edit" :size="17" />
            </button>
          </span>
        </template>
      </UiTable>
    </UiCard>

    <div class="flex items-start gap-3 rounded-card bg-brand-50 px-5 py-4">
      <UiIcon name="info" :size="18" class="mt-0.5 shrink-0 text-brand-600" />
      <p class="text-[13px] leading-snug text-brand-700">
        Ko‘rsatkichlar har oyning 18-sanasida qayd etiladi. Kiritilgan qiymat bino xizmatining
        nazorat o‘lchovi bilan solishtiriladi va hisob-fakturada aks etadi.
      </p>
    </div>
  </main>

  <UiModal
    v-model="entryOpen"
    title="Ko‘rsatkich kiritish"
    :subtitle="`${entryMeter.type} · ${entryMeter.code}`"
    size="sm"
  >
    <div class="space-y-4">
      <UiField label="Hisoblagich" required>
        <UiSelect v-model="entryMeterId" :options="meterOptions" />
      </UiField>

      <div class="grid gap-3 sm:grid-cols-2">
        <div class="rounded-field bg-surface-sunken p-3.5 ring-1 ring-ink-200">
          <p class="text-[12px] text-ink-500">Oxirgi qayd etilgan</p>
          <p class="tabular mt-1 text-[16px] font-bold text-ink-900">
            {{ num(entryMeter.lastReading, 2) }} {{ entryMeter.unit }}
          </p>
          <p class="tabular mt-0.5 text-[11.5px] text-ink-500">{{ dateShort(entryMeter.readAt) }}</p>
        </div>
        <div class="rounded-field bg-surface-sunken p-3.5 ring-1 ring-ink-200">
          <p class="text-[12px] text-ink-500">Oldingi davr</p>
          <p class="tabular mt-1 text-[16px] font-bold text-ink-900">
            {{ num(entryMeter.previousReading, 2) }} {{ entryMeter.unit }}
          </p>
          <p class="tabular mt-0.5 text-[11.5px] text-ink-500">
            Sarf: {{ num(consumption(entryMeter), 2) }} {{ entryMeter.unit }}
          </p>
        </div>
      </div>

      <UiField
        label="Yangi ko‘rsatkich"
        required
        :error="entryError"
        :hint="`Qiymat ${num(entryMeter.lastReading, 2)} ${entryMeter.unit} dan kichik bo‘lmasligi kerak`"
      >
        <UiInput
          v-model="entryValue"
          type="number"
          :placeholder="num(entryMeter.lastReading, 2)"
          :invalid="!!entryError"
        >
          <template #suffix>
            <span class="text-[12px]">{{ entryMeter.unit }}</span>
          </template>
        </UiInput>
      </UiField>
    </div>

    <template #footer>
      <UiButton variant="ghost" @click="entryOpen = false">Bekor qilish</UiButton>
      <UiButton @click="saveReading">
        <UiIcon name="check" :size="16" />
        Saqlash
      </UiButton>
    </template>
  </UiModal>
</template>
