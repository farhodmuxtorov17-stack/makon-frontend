<script setup lang="ts">
import { METERS, UTILITY_SUMMARY, type Meter } from '~/data/operations'
import { dateShort, num } from '~/utils/format'

interface Reading {
  at: string
  value: number
  consumption: number
  note: string
}

const meters = ref<Meter[]>(METERS.map((m) => ({ ...m })))

const STEPS = [0.88, 1.06, 0.95, 1.12, 1]

function decimalsOf(m: Meter) {
  return Number.isInteger(m.lastReading) && Number.isInteger(m.previousReading) ? 0 : 1
}

function roundTo(value: number, decimals: number) {
  const f = 10 ** decimals
  return Math.round(value * f) / f
}

function monthsBack(iso: string, back: number) {
  const d = new Date(`${iso}T00:00:00`)
  d.setMonth(d.getMonth() - back)
  return d.toISOString().slice(0, 10)
}

function seedReadings(m: Meter): Reading[] {
  const dec = decimalsOf(m)
  const delta = m.lastReading - m.previousReading
  const values: number[] = [m.lastReading]
  for (let i = STEPS.length - 1; i >= 0; i--) {
    values.unshift(roundTo(values[0]! - roundTo(delta * STEPS[i]!, dec), dec))
  }
  return values.map((value, i) => ({
    at: monthsBack(m.readAt, values.length - 1 - i),
    value,
    consumption: i === 0 ? 0 : roundTo(value - values[i - 1]!, dec),
    note: i === values.length - 1 ? 'Oxirgi qiyoslash' : 'Oylik ko‘rsatkich',
  }))
}

const readings = ref<Record<string, Reading[]>>(
  Object.fromEntries(METERS.map((m) => [m.id, seedReadings(m)])),
)

const query = ref('')
const fBuilding = ref('all')
const fType = ref('all')

const buildingOptions = computed(() => [
  { value: 'all', label: 'Barcha binolar' },
  ...[...new Set(meters.value.map((m) => m.buildingName))].map((b) => ({ value: b, label: b })),
])

const typeOptions = computed(() => [
  { value: 'all', label: 'Barcha turlar' },
  ...[...new Set(meters.value.map((m) => m.type))].map((t) => ({ value: t, label: t })),
])

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  return meters.value.filter((m) => {
    if (fBuilding.value !== 'all' && m.buildingName !== fBuilding.value) return false
    if (fType.value !== 'all' && m.type !== fType.value) return false
    if (q && ![m.code, m.serial, m.location, m.buildingName].some((v) => v.toLowerCase().includes(q)))
      return false
    return true
  })
})

const rows = computed(() =>
  filtered.value.map((m) => ({ ...m, usage: roundTo(m.lastReading - m.previousReading, decimalsOf(m)) })),
)

const dirty = computed(
  () => !!query.value.trim() || fBuilding.value !== 'all' || fType.value !== 'all',
)

function resetFilters() {
  query.value = ''
  fBuilding.value = 'all'
  fType.value = 'all'
}

const columns = [
  { key: 'code', label: 'Kodi', width: '148px' },
  { key: 'type', label: 'Turi' },
  { key: 'serial', label: 'Seriya' },
  { key: 'buildingName', label: 'Bino' },
  { key: 'location', label: 'Joylashuv' },
  { key: 'lastReading', label: 'Oxirgi ko‘rsatkich', align: 'right' as const, numeric: true },
  { key: 'usage', label: 'Sarf', align: 'right' as const, numeric: true },
  { key: 'verifyAt', label: 'Qiyoslash sanasi' },
  { key: 'status', label: 'Holat' },
]

const TYPE_TONE: Record<string, string> = {
  Elektr: 'bg-warn-50 text-warn-700 ring-warn-100',
  Suv: 'bg-brand-50 text-brand-700 ring-brand-200',
  Gaz: 'bg-info-50 text-info-700 ring-info-100',
  Issiqlik: 'bg-danger-50 text-danger-700 ring-danger-100',
}

function statusKind(status: string): 'contract' | 'unit' {
  return status === 'ACTIVE' ? 'contract' : 'unit'
}

const UTILITY_TONE = ['warn', 'brand', 'violet', 'danger'] as const

const detail = ref<Meter | null>(null)
const detailOpen = computed({
  get: () => detail.value !== null,
  set: (v: boolean) => {
    if (!v) detail.value = null
  },
})

const detailReadings = computed(() => (detail.value ? (readings.value[detail.value.id] ?? []) : []))
const chartLabels = computed(() => detailReadings.value.map((r) => dateShort(r.at)))
const chartSeries = computed(() => [
  {
    label: 'Sarf',
    tone: 'brand' as const,
    values: detailReadings.value.map((r) => r.consumption),
    fill: true,
  },
])

function openMeter(row: Record<string, unknown>) {
  detail.value = meters.value.find((m) => m.id === String(row.id)) ?? null
}

const entryOpen = ref(false)
const entryMeter = ref(METERS[0]!.id)
const entryDate = ref(METERS[0]!.readAt)
const entryValue = ref<string | number>(METERS[0]!.lastReading)
const entryNote = ref('')
const entryShots = ref(0)

const activeMeter = computed(() => meters.value.find((m) => m.id === entryMeter.value) ?? null)

watch(entryMeter, () => {
  const m = activeMeter.value
  if (m) {
    entryValue.value = m.lastReading
    entryDate.value = m.readAt
  }
})

const entryError = computed(() => {
  const m = activeMeter.value
  if (!m) return 'Hisoblagichni tanlang'
  const value = Number(entryValue.value)
  if (!entryValue.value && entryValue.value !== 0) return 'Joriy qiymatni kiriting'
  if (Number.isNaN(value)) return 'Qiymat raqam bo‘lishi kerak'
  if (value < m.lastReading)
    return `Joriy qiymat oxirgi ko‘rsatkichdan (${num(m.lastReading, decimalsOf(m))} ${m.unit}) kam bo‘lmasligi kerak`
  if (!entryDate.value) return 'Sanani kiriting'
  return ''
})

const entryUsage = computed(() => {
  const m = activeMeter.value
  if (!m || entryError.value) return 0
  return roundTo(Number(entryValue.value) - m.lastReading, decimalsOf(m))
})

function saveReading() {
  const m = activeMeter.value
  if (!m || entryError.value) return
  const dec = decimalsOf(m)
  const value = roundTo(Number(entryValue.value), dec)
  readings.value[m.id] = [
    ...(readings.value[m.id] ?? []),
    {
      at: entryDate.value,
      value,
      consumption: roundTo(value - m.lastReading, dec),
      note: entryNote.value.trim() || 'Qo‘lda kiritilgan ko‘rsatkich',
    },
  ]
  m.previousReading = m.lastReading
  m.lastReading = value
  m.readAt = entryDate.value
  entryNote.value = ''
  entryShots.value = 0
  entryOpen.value = false
}
</script>

<template>
  <AppTopbar
    title="Hisoblagichlar reyestri"
    subtitle="Ko‘rsatkichlarni qayd etish, sarf tahlili va qiyoslash muddatlari"
  >
    <template #actions>
      <UiButton variant="secondary" size="sm" to="/service-requests">
        <UiIcon name="wrench" :size="16" />
        Servis arizalari
      </UiButton>
      <UiButton size="sm" @click="entryOpen = true">
        <UiIcon name="plus" :size="16" />
        Ko‘rsatkich kiritish
      </UiButton>
    </template>
  </AppTopbar>

  <main class="scroll-slim flex-1 space-y-5 overflow-y-auto p-6">
    <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <UiKpi
        v-for="(u, i) in UTILITY_SUMMARY"
        :key="u.label"
        :label="u.label"
        :value="u.value"
        :unit="u.unit"
        :delta="u.delta"
        :icon="u.icon"
        :tone="UTILITY_TONE[i]"
        class="cursor-pointer"
        @click="fType = u.label === 'Elektr energiyasi' ? 'Elektr' : u.label"
      />
    </section>

    <UiCard
      title="Hisoblagichlar"
      :subtitle="`${rows.length} ta hisoblagich ko‘rsatilmoqda`"
      flush
      :padded="false"
    >
      <template #actions>
        <UiButton variant="secondary" size="sm" @click="entryOpen = true">
          <UiIcon name="edit" :size="16" />
          Ko‘rsatkich kiritish
        </UiButton>
      </template>

      <div class="grid gap-3 border-t border-ink-100 bg-surface-sunken px-5 py-4 lg:grid-cols-4">
        <UiInput v-model="query" placeholder="Kod, seriya yoki joylashuv" class="lg:col-span-2">
          <template #prefix>
            <UiIcon name="search" :size="18" />
          </template>
        </UiInput>
        <UiSelect v-model="fBuilding" :options="buildingOptions" />
        <div class="flex items-center gap-2">
          <UiSelect v-model="fType" :options="typeOptions" class="flex-1" />
          <UiButton v-if="dirty" variant="ghost" size="sm" @click="resetFilters">
            <UiIcon name="refresh" :size="16" />
            Tozalash
          </UiButton>
        </div>
      </div>

      <UiTable
        :columns="columns"
        :rows="rows"
        empty="Tanlangan shartga mos hisoblagich topilmadi"
        @row-click="openMeter"
      >
        <template #cell-code="{ row }">
          <span class="tabular text-[13px] font-bold text-ink-900">{{ row.code }}</span>
        </template>

        <template #cell-type="{ row }">
          <span
            class="inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs font-semibold ring-1 ring-inset"
            :class="TYPE_TONE[row.type]"
          >
            <UiIcon name="meter" :size="13" />
            {{ row.type }}
          </span>
        </template>

        <template #cell-serial="{ row }">
          <span class="tabular text-[13px]">{{ row.serial }}</span>
        </template>

        <template #cell-lastReading="{ row }">
          {{ num(row.lastReading, Number.isInteger(row.lastReading) ? 0 : 1) }}
          <span class="text-[12px] font-normal text-ink-500">{{ row.unit }}</span>
        </template>

        <template #cell-usage="{ row }">
          <span class="font-bold text-brand-600">
            +{{ num(row.usage, Number.isInteger(row.usage) ? 0 : 1) }}
          </span>
        </template>

        <template #cell-verifyAt="{ row }">
          <span class="tabular">{{ dateShort(row.verifyAt) }}</span>
        </template>

        <template #cell-status="{ row }">
          <UiStatus :kind="statusKind(row.status)" :value="row.status" size="sm" />
        </template>
      </UiTable>

      <div class="border-t border-ink-200 bg-surface-sunken px-5 py-3.5 text-[13px] text-ink-600">
        Qator ustiga bosilsa ko‘rsatkichlar tarixi va sarf grafigi ochiladi
      </div>
    </UiCard>
  </main>

  <UiModal
    v-model="detailOpen"
    :title="detail ? `${detail.code} · ko‘rsatkichlar tarixi` : 'Hisoblagich'"
    :subtitle="detail ? `${detail.buildingName} · ${detail.location}` : undefined"
    size="lg"
  >
    <div v-if="detail" class="space-y-5">
      <div class="flex flex-wrap items-center gap-3">
        <UiStatus :kind="statusKind(detail.status)" :value="detail.status" />
        <span
          class="inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs font-semibold ring-1 ring-inset"
          :class="TYPE_TONE[detail.type]"
        >
          <UiIcon name="meter" :size="13" />
          {{ detail.type }}
        </span>
        <span class="tabular text-[13px] text-ink-500">Seriya: {{ detail.serial }}</span>
      </div>

      <div class="grid gap-4 sm:grid-cols-3">
        <div class="rounded-field bg-surface-sunken p-4">
          <p class="text-[12px] text-ink-500">Oxirgi ko‘rsatkich</p>
          <p class="tabular mt-1 text-[19px] font-bold text-ink-900">
            {{ num(detail.lastReading, decimalsOf(detail)) }}
            <span class="text-[12.5px] font-medium text-ink-500">{{ detail.unit }}</span>
          </p>
        </div>
        <div class="rounded-field bg-surface-sunken p-4">
          <p class="text-[12px] text-ink-500">Oxirgi sarf</p>
          <p class="tabular mt-1 text-[19px] font-bold text-brand-600">
            {{ num(detail.lastReading - detail.previousReading, decimalsOf(detail)) }}
            <span class="text-[12.5px] font-medium text-ink-500">{{ detail.unit }}</span>
          </p>
        </div>
        <div class="rounded-field bg-surface-sunken p-4">
          <p class="text-[12px] text-ink-500">Navbatdagi qiyoslash</p>
          <p class="tabular mt-1 text-[19px] font-bold text-ink-900">
            {{ dateShort(detail.verifyAt) }}
          </p>
        </div>
      </div>

      <div>
        <h3 class="text-[13px] font-semibold text-ink-700">Sarf dinamikasi</h3>
        <div class="mt-3">
          <UiLine :labels="chartLabels" :series="chartSeries" :height="180" />
        </div>
      </div>

      <div>
        <h3 class="text-[13px] font-semibold text-ink-700">Ko‘rsatkichlar tarixi</h3>
        <div class="mt-3 overflow-hidden rounded-field ring-1 ring-ink-200">
          <UiTable
            :columns="[
              { key: 'at', label: 'Sana' },
              { key: 'value', label: 'Ko‘rsatkich', align: 'right', numeric: true },
              { key: 'consumption', label: 'Sarf', align: 'right', numeric: true },
              { key: 'note', label: 'Izoh' },
            ]"
            :rows="[...detailReadings].reverse().map((r) => ({ ...r, id: r.at }))"
          >
            <template #cell-at="{ row }">
              <span class="tabular">{{ dateShort(row.at) }}</span>
            </template>
            <template #cell-value="{ row }">
              {{ num(row.value, decimalsOf(detail)) }} {{ detail.unit }}
            </template>
            <template #cell-consumption="{ row }">
              <span :class="row.consumption > 0 ? 'font-bold text-brand-600' : 'text-ink-400'">
                {{ row.consumption > 0 ? '+' : '' }}{{ num(row.consumption, decimalsOf(detail)) }}
              </span>
            </template>
          </UiTable>
        </div>
      </div>
    </div>

    <template #footer>
      <UiButton variant="ghost" @click="detail = null">Yopish</UiButton>
      <UiButton
        @click="
          ((entryMeter = detail?.id ?? entryMeter), (detail = null), (entryOpen = true))
        "
      >
        <UiIcon name="plus" :size="16" />
        Ko‘rsatkich kiritish
      </UiButton>
    </template>
  </UiModal>

  <UiModal
    v-model="entryOpen"
    title="Ko‘rsatkich kiritish"
    subtitle="Qo‘lda kiritilgan ko‘rsatkich monitoringda darhol aks etadi"
  >
    <div class="space-y-4">
      <UiField label="Hisoblagich" required>
        <UiSelect
          v-model="entryMeter"
          :options="meters.map((m) => ({ value: m.id, label: `${m.code} · ${m.buildingName}` }))"
        />
      </UiField>

      <div class="grid gap-4 sm:grid-cols-2">
        <UiField label="Sana" required>
          <UiInput v-model="entryDate" type="date" />
        </UiField>

        <UiField
          label="Joriy qiymat"
          required
          :error="entryError"
          :hint="
            activeMeter
              ? `Oldingi ko‘rsatkich: ${num(activeMeter.lastReading, decimalsOf(activeMeter))} ${activeMeter.unit}`
              : undefined
          "
        >
          <UiInput
            v-model="entryValue"
            type="number"
            :invalid="!!entryError"
            :valid="!entryError"
          />
        </UiField>
      </div>

      <div
        v-if="!entryError && activeMeter"
        class="flex items-center justify-between rounded-field bg-brand-50 px-4 py-3"
      >
        <span class="text-[13px] font-medium text-brand-700">Hisoblangan sarf</span>
        <span class="tabular text-[15px] font-bold text-brand-700">
          +{{ num(entryUsage, decimalsOf(activeMeter)) }} {{ activeMeter.unit }}
        </span>
      </div>

      <UiField label="Izoh">
        <textarea
          v-model="entryNote"
          rows="2"
          placeholder="Masalan: asosiy suv tuguni"
          class="scroll-slim w-full rounded-field bg-white px-3.5 py-2.5 text-sm text-ink-800 ring-1 ring-inset ring-ink-200 transition-colors placeholder:text-ink-400 hover:ring-ink-300 focus:ring-2 focus:ring-brand-500"
        />
      </UiField>

      <UiField label="Hisoblagich surati" hint="Ko‘rsatkich sifatini tasdiqlash uchun surat biriktiring">
        <div class="flex flex-wrap gap-3">
          <div
            v-for="n in entryShots"
            :key="n"
            class="relative size-24 overflow-hidden rounded-field ring-1 ring-ink-200"
          >
            <svg viewBox="0 0 96 96" class="size-full" aria-hidden="true">
              <rect width="96" height="96" fill="#eef2f8" />
              <rect x="18" y="30" width="60" height="36" rx="6" fill="#c7d9fe" />
              <rect x="26" y="40" width="44" height="16" rx="3" fill="#ffffff" />
              <circle cx="48" cy="22" r="6" fill="#a1bffd" />
            </svg>
            <button
              type="button"
              class="absolute right-1 top-1 grid size-8 place-items-center rounded-full bg-ink-900/60 md:size-6 text-white transition-colors hover:bg-danger-600"
              aria-label="Suratni olib tashlash"
              @click="entryShots = entryShots - 1"
            >
              <UiIcon name="x" :size="13" />
            </button>
          </div>

          <button
            v-if="entryShots < 3"
            type="button"
            class="grid size-24 place-items-center rounded-field border-2 border-dashed border-ink-300 bg-ink-50 text-ink-500 transition-colors hover:border-brand-400 hover:bg-brand-50 hover:text-brand-600"
            aria-label="Hisoblagich surati qo‘shish"
            @click="entryShots = entryShots + 1"
          >
            <svg viewBox="0 0 32 32" class="size-8" fill="none" aria-hidden="true">
              <rect x="3" y="7" width="26" height="18" rx="3" stroke="currentColor" stroke-width="1.8" />
              <circle cx="16" cy="16" r="4.6" stroke="currentColor" stroke-width="1.8" />
              <path
                d="M16 12.6v6.8M12.6 16h6.8"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linecap="round"
              />
            </svg>
          </button>
        </div>
      </UiField>
    </div>

    <template #footer>
      <UiButton variant="ghost" @click="entryOpen = false">Bekor qilish</UiButton>
      <UiButton :disabled="!!entryError" variant="success" @click="saveReading">
        <UiIcon name="check" :size="16" />
        Saqlash
      </UiButton>
    </template>
  </UiModal>
</template>
