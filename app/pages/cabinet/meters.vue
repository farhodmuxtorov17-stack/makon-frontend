<script setup lang="ts">
import { buildingById } from '~/data/buildings'
import { dateShort, num, todayIso } from '~/utils/format'

const { t } = useI18n()
const { field } = useAppLabels()

/** Hisoblagichlar bosh sahifa bilan bitta umumiy manbadan olinadi */
const { meters, myUnit, typeLabel, locationOf, consumption, monthLabel, monthName } =
  useCabinetMeters()

const myBuilding = computed(() =>
  myUnit.value ? (buildingById(myUnit.value.buildingId) ?? null) : null,
)

const TONE_CLASS: Record<string, string> = {
  brand: 'bg-brand-50 text-brand-600',
  warn: 'bg-warn-50 text-warn-600',
  danger: 'bg-danger-50 text-danger-600',
}

const selectedId = ref('cm-suv')
const selected = computed(
  () => meters.value.find((m) => m.id === selectedId.value) ?? meters.value[0] ?? null,
)

const chartLabels = computed(() => (selected.value ? selected.value.labels.map(monthLabel) : []))

const chartSeries = computed(() =>
  selected.value
    ? [
        {
          label: t('cab.consumptionSeries', {
            type: typeLabel(selected.value.type),
            unit: selected.value.unit,
          }),
          tone: selected.value.tone,
          values: selected.value.history,
          fill: true,
        },
      ]
    : [],
)

const columns = computed(() => [
  { key: 'code', label: field('meter') },
  { key: 'type', label: field('type') },
  { key: 'location', label: field('location') },
  { key: 'previousReading', label: t('common.previous'), align: 'right' as const, numeric: true },
  { key: 'lastReading', label: t('common.current'), align: 'right' as const, numeric: true },
  { key: 'consumption', label: field('consumption'), align: 'right' as const, numeric: true },
  { key: 'readAt', label: field('readAt'), align: 'right' as const },
  { key: 'actions', label: field('actions'), align: 'right' as const },
])

const rows = computed(() =>
  meters.value.map((m) => ({
    id: m.id,
    code: m.code,
    type: typeLabel(m.type),
    location: locationOf(m),
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
/** Maydon raqamli, shuning uchun qiymat son bo‘lib ham kelishi mumkin */
const entryValue = ref<string | number>('')
const entryError = ref('')
const savedMessage = ref('')

const entryMeter = computed(
  () => meters.value.find((m) => m.id === entryMeterId.value) ?? meters.value[0] ?? null,
)

const meterOptions = computed(() =>
  meters.value.map((m) => ({ value: m.id, label: `${typeLabel(m.type)}, ${m.code}` })),
)

function openEntry(id: string) {
  entryMeterId.value = id
  entryValue.value = ''
  entryError.value = ''
  entryOpen.value = true
}

function saveReading() {
  const m = entryMeter.value
  if (!m) return
  // Raqamli maydon qiymatni son ko‘rinishida qaytaradi, matn deb hisoblansa
  // saqlash uzilib qolardi: shuning uchun avval matnga keltiriladi
  const entered = String(entryValue.value).trim()
  const value = Number(entered)
  if (!entered || Number.isNaN(value)) {
    entryError.value = t('cab.readingRequired')
    return
  }
  if (value < m.lastReading) {
    entryError.value = t('cab.readingTooSmall', {
      value: `${num(m.lastReading, 2)} ${m.unit}`,
    })
    return
  }
  entryError.value = ''
  const used = Math.round((value - m.lastReading) * 100) / 100
  m.previousReading = m.lastReading
  m.lastReading = value
  m.readAt = todayIso()
  // Boshlang‘ich ro‘yxat oxirgi 5 oyni qamraydi, keyingi yozuv keyingi oy nomini oladi
  m.labels = [...m.labels, monthName(m.labels.length - 4)]
  m.history = [...m.history, used]
  selectedId.value = m.id
  savedMessage.value = t('cab.readingSaved', {
    type: typeLabel(m.type),
    value: `${num(value, 2)} ${m.unit}`,
  })
  entryOpen.value = false
}
</script>

<template>
  <AppTopbar
    :title="t('nav.meters')"
    :subtitle="
      myUnit && myBuilding
        ? t('cab.metersOfUnit', { building: myBuilding.name, code: myUnit.code })
        : t('cab.metersOfUnitShort')
    "
    :breadcrumb="[{ label: t('cab.title'), to: '/cabinet' }, { label: t('nav.meters') }]"
  >
    <template #actions>
      <UiButton variant="secondary" size="sm" to="/cabinet/invoices">
        <UiIcon name="wallet" :size="16" />
        {{ t('nav.invoices') }}
      </UiButton>
      <UiButton v-if="myUnit" size="sm" @click="openEntry(selectedId)">
        <UiIcon name="plus" :size="16" />
        {{ t('cab.enterReading') }}
      </UiButton>
    </template>
  </AppTopbar>

  <main class="scroll-slim flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
    <UiCard v-if="!myUnit" flush>
      <UiEmpty
        icon="meter"
        :title="t('empty.noMeterAssigned')"
        :description="t('cab.noMetersDesc')"
        :action-label="t('cab.applyForRent')"
        action-to="/cabinet/apply"
      />
    </UiCard>

    <template v-else-if="selected">
      <div
        v-if="savedMessage"
        class="flex items-center gap-3 rounded-card bg-ok-50 px-5 py-3.5 ring-1 ring-ok-100"
      >
        <span class="grid size-9 shrink-0 place-items-center rounded-[10px] bg-ok-500 text-white">
          <UiIcon name="check" :size="18" />
        </span>
        <p class="min-w-0 flex-1 text-[14px] text-ok-700">{{ savedMessage }}</p>
        <button
          type="button"
          class="rounded-lg p-1.5 text-ok-700 transition-colors hover:bg-ok-100"
          :aria-label="t('common.closeMessage')"
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

          <p class="mt-3 text-[13px] text-ink-500">{{ typeLabel(m.type) }} ({{ m.unit }})</p>
          <p class="tabular mt-1 text-[22px] font-bold leading-none text-ink-900">
            {{ num(m.lastReading, 2) }}
          </p>
          <p class="tabular mt-1.5 text-[12px] text-ink-500">
            {{ t('cab.previousValue', { value: `${num(m.previousReading, 2)} ${m.unit}` }) }}
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
          :title="t('cab.consumptionDynamics', { type: typeLabel(selected.type) })"
          :subtitle="t('cab.byMonthsUnit', { code: selected.code, unit: selected.unit })"
        >
          <template #actions>
            <UiButton variant="secondary" size="sm" @click="openEntry(selected.id)">
              <UiIcon name="edit" :size="15" />
              {{ t('cab.enterReading') }}
            </UiButton>
          </template>
          <UiLine :labels="chartLabels" :series="chartSeries" :height="224" />
        </UiCard>

        <UiCard
          :title="t('cab.meterOfType', { type: typeLabel(selected.type) })"
          :subtitle="t('cab.passportData')"
        >
          <dl class="divide-y divide-ink-100">
            <div class="flex items-center justify-between py-2.5">
              <dt class="text-[13px] text-ink-500">{{ field('meterNo') }}</dt>
              <dd class="tabular text-[13px] font-semibold text-ink-900">{{ selected.code }}</dd>
            </div>
            <div class="flex items-center justify-between py-2.5">
              <dt class="text-[13px] text-ink-500">{{ field('factoryNo') }}</dt>
              <dd class="tabular text-[13px] font-semibold text-ink-900">{{ selected.serial }}</dd>
            </div>
            <div class="flex items-center justify-between py-2.5">
              <dt class="text-[13px] text-ink-500">{{ field('location') }}</dt>
              <dd class="text-[13px] font-semibold text-ink-900">{{ locationOf(selected) }}</dd>
            </div>
            <div class="flex items-center justify-between py-2.5">
              <dt class="text-[13px] text-ink-500">{{ field('currentConsumption') }}</dt>
              <dd class="tabular text-[13px] font-bold text-brand-600">
                {{ num(consumption(selected), 2) }} {{ selected.unit }}
              </dd>
            </div>
            <div class="flex items-center justify-between py-2.5">
              <dt class="text-[13px] text-ink-500">{{ field('nextVerification') }}</dt>
              <dd class="tabular text-[13px] font-semibold text-ink-900">
                {{ dateShort(selected.verifyAt) }}
              </dd>
            </div>
            <div class="flex items-center justify-between py-2.5">
              <dt class="text-[13px] text-ink-500">{{ field('status') }}</dt>
              <dd>
                <span
                  class="inline-flex items-center gap-1.5 rounded-pill bg-ok-50 px-2.5 py-1 text-[11px] font-semibold text-ok-700 ring-1 ring-inset ring-ok-100"
                >
                  <UiIcon name="check" :size="12" />
                  {{ t('common.active') }}
                </span>
              </dd>
            </div>
          </dl>
        </UiCard>
      </section>

      <UiCard :title="t('cab.allMeters')" :subtitle="t('cab.metersTableCaption')" flush>
        <UiTable :columns="columns" :rows="rows" @row-click="(row) => (selectedId = String(row.id))">
          <template #cell-code="{ row }">
            <span class="tabular text-[14px] font-semibold text-ink-900">{{ row.code }}</span>
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
                class="grid size-11 place-items-center rounded-field text-brand-600 transition-colors hover:bg-brand-50 md:size-9"
                :aria-label="t('cab.enterReadingAria', { code: row.code })"
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
          {{ t('cab.metersInfoLong') }}
        </p>
      </div>
    </template>
  </main>

  <UiModal
    v-model="entryOpen"
    :title="t('cab.enterReading')"
    :subtitle="entryMeter ? `${typeLabel(entryMeter.type)} · ${entryMeter.code}` : ''"
    size="sm"
  >
    <div v-if="entryMeter" class="space-y-4">
      <UiField :label="field('meter')" required>
        <UiSelect v-model="entryMeterId" :options="meterOptions" />
      </UiField>

      <div class="grid gap-3 sm:grid-cols-2">
        <div class="rounded-field bg-surface-sunken p-3.5 ring-1 ring-ink-200">
          <p class="text-[12px] text-ink-500">{{ t('cab.lastRecorded') }}</p>
          <p class="tabular mt-1 text-[16px] font-bold text-ink-900">
            {{ num(entryMeter.lastReading, 2) }} {{ entryMeter.unit }}
          </p>
          <p class="tabular mt-0.5 text-[12px] text-ink-500">{{ dateShort(entryMeter.readAt) }}</p>
        </div>
        <div class="rounded-field bg-surface-sunken p-3.5 ring-1 ring-ink-200">
          <p class="text-[12px] text-ink-500">{{ t('cab.previousPeriod') }}</p>
          <p class="tabular mt-1 text-[16px] font-bold text-ink-900">
            {{ num(entryMeter.previousReading, 2) }} {{ entryMeter.unit }}
          </p>
          <p class="tabular mt-0.5 text-[12px] text-ink-500">
            {{
              t('cab.consumptionIs', {
                value: `${num(consumption(entryMeter), 2)} ${entryMeter.unit}`,
              })
            }}
          </p>
        </div>
      </div>

      <UiField
        :label="field('newReading')"
        required
        :error="entryError"
        :hint="
          t('cab.readingMinHint', {
            value: `${num(entryMeter.lastReading, 2)} ${entryMeter.unit}`,
          })
        "
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
      <UiButton variant="ghost" @click="entryOpen = false">{{ t('common.cancel') }}</UiButton>
      <UiButton @click="saveReading">
        <UiIcon name="check" :size="16" />
        {{ t('common.save') }}
      </UiButton>
    </template>
  </UiModal>
</template>
