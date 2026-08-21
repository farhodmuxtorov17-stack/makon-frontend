<script setup lang="ts">
import { OCCUPANCY_BANDS } from '~/constants/statuses'
import {
  BUILDINGS,
  PORTFOLIO_TOTALS,
  TREND_SPANS,
  moneyScale,
  trendDelta,
  trendLabels,
  trendSpark,
  trendWindow,
} from '~/data/buildings'
import { INVOICES } from '~/data/business'
import type { LeaseStatus } from '~/stores/lease'
import { num, percent } from '~/utils/format'

const auth = useAuthStore()
const lease = useLeaseStore()
lease.seed()

const { t } = useI18n()
const { buildingTypeLabel, moneyShort, moduleTitle } = useAppLabels()

/** Pul o‘lchovi grafik yorlig‘ida ham tanlangan tilda yoziladi */
function moneyUnit(unit: string) {
  const scale = unit.startsWith('mlrd') ? t('unitOf.billion') : t('unitOf.million')
  return `${scale} ${t('unitOf.currency')}`
}

const scope = ref('all')

const scopes = computed(() => [
  { value: 'all', label: t('filter.allBuildings') },
  ...BUILDINGS.map((b) => ({ value: b.id, label: b.name })),
])

/** Davr oynasi ro‘yxati reyestrdagi qiymatlarni saqlaydi, nomi lug‘atdan */
const spanOptions = computed(() =>
  TREND_SPANS.map((s) => ({ value: s.value, label: t('svc.lastMonths', { n: s.value }) })),
)

const visible = computed(() =>
  scope.value === 'all' ? BUILDINGS : BUILDINGS.filter((b) => b.id === scope.value),
)

/**
 * Rahbar panelida obyektning uch o'lchamli ko'rinishi. Ilgari 3D faqat
 * obyekt kartochkasi ichida edi va rahbar uni umuman ko'rmasdi. Bu yerda
 * portfeldagi istalgan obyektni tanlab, uchastkani darhol ko'rish mumkin.
 */
const view3dId = ref(BUILDINGS[0]?.id ?? '')

const view3dOptions = computed(() =>
  visible.value.map((b) => ({ value: b.id, label: b.name })),
)

const view3dBuilding = computed(
  () => BUILDINGS.find((b) => b.id === view3dId.value) ?? visible.value[0] ?? BUILDINGS[0]!,
)

const view3dFloor = ref(1)
const view3dUnit = ref('')

// Doira boshqa obyektga o'tsa, 3D ham shunga ergashadi
watch(
  () => scope.value,
  () => {
    if (scope.value !== 'all') view3dId.value = scope.value
    else if (!visible.value.some((b) => b.id === view3dId.value)) {
      view3dId.value = visible.value[0]?.id ?? ''
    }
  },
)

const HIGHLIGHT_COUNT = 5

const highlighted = computed(() => {
  const list = [...visible.value]
  if (list.length <= HIGHLIGHT_COUNT) return list
  return list
    .sort((a, b) => a.occupancy - b.occupancy || b.debt - a.debt)
    .slice(0, HIGHLIGHT_COUNT)
})

const totals = computed(() => {
  if (scope.value === 'all') return PORTFOLIO_TOTALS
  const b = visible.value[0]!
  return {
    gla: b.gla,
    occupancy: b.occupancy,
    revenue: b.monthlyRevenue,
    vacantArea: b.vacantArea,
    sla: b.sla,
    buildings: 1,
    units: b.units,
    vacantUnits: b.vacantUnits,
    debt: b.debt,
  }
})

const occupiedArea = computed(() => totals.value.gla - totals.value.vacantArea)

const portfolioSlices = computed(() => [
  { label: t('kpi.occupiedArea'), value: occupiedArea.value, tone: 'brand' as const },
  { label: t('kpi.vacantArea'), value: totals.value.vacantArea, tone: 'ok' as const },
])

const serviceCount = computed(() => visible.value.reduce((s, b) => s + b.serviceRequests, 0))

/* --- Davr oynasi --- */

const span = ref('6')
const spanLength = computed(() => Number(span.value))

const dynamicsLabels = computed(() => trendLabels(spanLength.value))

const revenueSeries = computed(() => {
  const s = moneyScale(totals.value.revenue)
  return [
    {
      label: t('svc.seriesRevenue', { unit: moneyUnit(s.unit) }),
      tone: 'brand' as const,
      fill: true,
      values: trendWindow('revenue', spanLength.value).map(
        (f) => +((totals.value.revenue / s.div) * f).toFixed(s.digits),
      ),
    },
  ]
})

const debtSeries = computed(() => {
  const s = moneyScale(totals.value.debt)
  return [
    {
      label: t('svc.seriesDebt', { unit: moneyUnit(s.unit) }),
      tone: 'danger' as const,
      values: trendWindow('debt', spanLength.value).map(
        (f) => +((totals.value.debt / s.div) * f).toFixed(s.digits),
      ),
    },
  ]
})

/* --- Diqqat talab qiladigan holatlar --- */

const debtAlerts = computed(() =>
  INVOICES.filter(
    (i) =>
      (i.status === 'OVERDUE' || i.status === 'PARTIALLY_PAID') &&
      (scope.value === 'all' || i.buildingName === visible.value[0]?.name),
  )
    .map((i) => ({ ...i, outstanding: i.total - i.paid }))
    .sort((a, b) => b.outstanding - a.outstanding)
    .slice(0, 3),
)

const PENDING_LEASE: LeaseStatus[] = [
  'YANGI',
  'SHARTNOMA_TAYYOR',
  'DIDOX_YUBORILDI',
  'DIDOX_IMZOLANDI',
]

const pendingCases = computed(() =>
  lease.cases
    .filter(
      (c) =>
        PENDING_LEASE.includes(c.status) && (scope.value === 'all' || c.buildingId === scope.value),
    )
    .slice(0, 3),
)

/* --- Xarita --- */

const mapMarkers = computed(() =>
  visible.value.map((b) => ({
    id: b.id,
    lat: b.lat,
    lon: b.lon,
    label: b.name,
    caption: `${b.district} · ${buildingTypeLabel(b.type)}`,
    value: b.occupancy,
    valueLabel: t('landing.occupancyValueLabel'),
    to: `/objects/${b.id}`,
    tone: b.occupancy >= 90 ? ('ok' as const) : b.occupancy >= 84 ? ('brand' as const) : ('warn' as const),
  })),
)

const mapStats = computed(() => [
  { label: t('nav.objects'), value: String(visible.value.length) },
  { label: t('kpi.occupancy'), value: percent(totals.value.occupancy) },
  {
    label: t('kpi.totalArea'),
    value: t('svc.thousandSqm', { value: num(Math.round(totals.value.gla / 1000)) }),
  },
  {
    label: t('kpi.vacantArea'),
    value: t('svc.thousandSqm', { value: num(Math.round(totals.value.vacantArea / 1000)) }),
  },
])

// Shkala bitta manbadan: reyestr, xarita va landing bir xil chegara ko‘rsatadi
const mapLegend = computed(() =>
  OCCUPANCY_BANDS.map((b) => ({ label: t(b.labelKey), class: b.class })),
)

/* --- Jonli izoh ---
 * Rahbar birinchi kirganda panel o‘zini tanishtiradi: qaysi blok nima uchun
 * kerakligini, bosgandan keyin nima ochilishini va keyingi qadamni aytadi.
 * Bosqichlar ekrandagi haqiqiy bloklarga `data-tour` orqali bog‘langan.
 */
const TOUR_KEYS = ['scope', 'kpi', 'map', 'view3d', 'attention', 'queue'] as const

const tourSteps = computed(() =>
  TOUR_KEYS.map((key) => ({
    target: `[data-tour="exec-${key}"]`,
    title: t(`tour.executive.${key}.title`),
    body: t(`tour.executive.${key}.body`),
    after: t(`tour.executive.${key}.after`),
    next: t(`tour.executive.${key}.next`),
  })),
)

/** Xotira kaliti rol bilan birga: har bir rol o‘z izohini bir marta ko‘radi */
const tourId = computed(() => `executive:${auth.role ?? 'guest'}`)
</script>

<template>
  <AppTopbar :title="moduleTitle('dashboardExecutive')" :subtitle="t('svc.execCaption')">
    <template #actions>
      <UiSelect
        v-model="scope"
        :options="scopes"
        size="sm"
        class="w-52"
        data-tour="exec-scope"
        :aria-label="t('svc.scopeAria')"
      />
      <UiSelect
        v-model="span"
        :options="spanOptions"
        size="sm"
        class="w-40"
        :aria-label="t('svc.periodAria')"
      />
      <UiButton variant="secondary" size="sm" to="/reports">
        <UiIcon name="download" :size="16" />
        {{ t('common.export') }}
      </UiButton>
      <UiTour :id="tourId" :steps="tourSteps" />
    </template>
  </AppTopbar>

  <main class="scroll-slim flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
    <!-- KPI qatori -->
    <section data-tour="exec-kpi" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      <UiKpi
        :label="t('kpi.averageOccupancy')"
        :value="percent(totals.occupancy)"
        :delta="trendDelta('occupancy')"
        icon="building"
        tone="brand"
        :spark="trendSpark('occupancy', totals.occupancy)"
        to="/objects"
      />
      <UiKpi
        :label="t('kpi.vacantArea')"
        :value="num(totals.vacantArea)"
        unit="m²"
        :delta="trendDelta('vacantArea')"
        invert
        icon="layers"
        tone="ok"
        :spark="trendSpark('vacantArea', totals.vacantArea)"
        to="/objects"
      />
      <UiKpi
        :label="t('kpi.debt')"
        :value="moneyShort(totals.debt)"
        :delta="trendDelta('debt')"
        invert
        icon="warning"
        tone="danger"
        :spark="trendSpark('debt', totals.debt / 1_000_000)"
        to="/billing/debts"
      />
      <UiKpi
        :label="moduleTitle('serviceRequests')"
        :value="String(serviceCount)"
        :delta="trendDelta('service')"
        invert
        icon="wrench"
        tone="warn"
        :spark="trendSpark('service', serviceCount)"
        to="/service-requests"
      />
      <UiKpi
        :label="t('kpi.monthlyRentIncome')"
        :value="moneyShort(totals.revenue)"
        :delta="trendDelta('revenue')"
        icon="wallet"
        tone="violet"
        :spark="trendSpark('revenue', totals.revenue / 1_000_000_000)"
        to="/billing/invoices"
      />
    </section>

    <!-- Portfel ko‘rinishi -->
    <section class="grid gap-5 lg:grid-cols-2 xl:grid-cols-4">
      <UiCard
        class="lg:col-span-2"
        data-tour="exec-map"
        :title="t('tour.executive.map.title')"
        :subtitle="t('svc.mapCaption')"
      >
        <template #actions>
          <UiButton variant="ghost" size="sm" to="/objects">{{ t('common.registry') }}</UiButton>
        </template>

        <UiMap
          :markers="mapMarkers"
          :stats="mapStats"
          :legend="mapLegend"
          height="368px"
          :zoom="11"
        />
      </UiCard>

      <UiCard
        class="xl:col-span-2"
        data-tour="exec-view3d"
        :title="t('svc.view3dTitle')"
        :subtitle="t('svc.view3dCaption', { name: view3dBuilding.name })"
        flush
      >
        <template #actions>
          <UiSelect
            v-model="view3dId"
            :options="view3dOptions"
            size="sm"
            :aria-label="t('svc.view3dAria')"
            class="min-w-[190px]"
          />
          <UiButton variant="ghost" size="sm" :to="`/objects/${view3dBuilding.id}/3d`">
            {{ t('svc.fullScreen') }}
            <UiIcon name="chevronRight" :size="16" />
          </UiButton>
        </template>

        <div class="px-5 pb-5">
          <UiBuilding3D
            v-model:floor="view3dFloor"
            v-model:unit="view3dUnit"
            :building="view3dBuilding"
            :controls="false"
            height-class="h-[320px] sm:h-[380px]"
          />
        </div>
      </UiCard>

      <UiCard :title="t('svc.portfolioView')" :subtitle="t('svc.areaSplit')">
        <UiDonut
          :slices="portfolioSlices"
          :center-value="percent(totals.occupancy)"
          :center-label="t('svc.occupancyLevel')"
        />
        <dl class="mt-5 grid grid-cols-2 gap-3 border-t border-ink-100 pt-4 sm:grid-cols-3">
          <div>
            <dt class="text-[12px] text-ink-500">{{ t('svc.totalArea') }}</dt>
            <dd class="tabular mt-0.5 text-sm font-bold text-ink-900">
              {{ num(totals.gla) }} m²
            </dd>
          </div>
          <div>
            <dt class="text-[12px] text-ink-500">{{ t('svc.occupied') }}</dt>
            <dd class="tabular mt-0.5 text-sm font-bold text-brand-600">
              {{ num(occupiedArea) }} m²
            </dd>
          </div>
          <div>
            <dt class="text-[12px] text-ink-500">{{ t('status.unit.VACANT') }}</dt>
            <dd class="tabular mt-0.5 text-sm font-bold text-ok-600">
              {{ num(totals.vacantArea) }} m²
            </dd>
          </div>
        </dl>
      </UiCard>

      <UiCard
        :title="scope === 'all' ? t('svc.portfolioDynamics') : t('svc.objectDynamics')"
        :subtitle="t('svc.lastPointHint')"
      >
        <div>
          <div class="flex items-baseline justify-between gap-3">
            <p class="text-[13px] font-semibold text-ink-700">{{ t('svc.rentIncome') }}</p>
            <p class="tabular text-[14px] font-bold text-brand-600">
              {{ moneyShort(totals.revenue) }}
            </p>
          </div>
          <UiLine :labels="dynamicsLabels" :series="revenueSeries" :height="132" />
        </div>

        <div class="mt-5 border-t border-ink-100 pt-4">
          <div class="flex items-baseline justify-between gap-3">
            <p class="text-[13px] font-semibold text-ink-700">{{ t('kpi.debt') }}</p>
            <p class="tabular text-[14px] font-bold text-danger-600">
              {{ moneyShort(totals.debt) }}
            </p>
          </div>
          <UiLine :labels="dynamicsLabels" :series="debtSeries" :height="132" />
        </div>
      </UiCard>
    </section>

    <!-- Obyektlar taqqoslanishi -->
    <UiCard
      data-tour="exec-attention"
      :title="t('tour.executive.attention.title')"
      :subtitle="t('svc.attentionSubtitle', { shown: highlighted.length, total: visible.length })"
      flush
    >
      <template #actions>
        <UiButton variant="ghost" size="sm" to="/objects">
          {{ t('common.all') }}
          <UiIcon name="chevronRight" :size="16" />
        </UiButton>
      </template>

      <div class="grid gap-4 p-5 pt-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <NuxtLink
          v-for="b in highlighted"
          :key="b.id"
          :to="`/objects/${b.id}`"
          class="group rounded-field p-4 ring-1 ring-ink-200 transition-all hover:shadow-card hover:ring-brand-300"
        >
          <p class="truncate text-[14px] font-bold text-ink-900 group-hover:text-brand-600">
            {{ b.name }}
          </p>
          <p class="mt-0.5 truncate text-[12px] text-ink-500">{{ b.district }}</p>

          <div class="mt-3.5 space-y-2.5">
            <div>
              <div class="flex items-baseline justify-between">
                <span class="text-[12px] text-ink-500">{{ t('kpi.occupancy') }}</span>
                <span class="tabular text-[13px] font-bold text-ink-900">
                  {{ percent(b.occupancy) }}
                </span>
              </div>
              <div class="mt-1.5 h-1.5 overflow-hidden rounded-pill bg-ink-100">
                <div
                  class="h-full rounded-pill"
                  :class="
                    b.occupancy >= 90 ? 'bg-ok-500' : b.occupancy >= 84 ? 'bg-brand-500' : 'bg-warn-500'
                  "
                  :style="{ width: `${b.occupancy}%` }"
                />
              </div>
            </div>

            <div class="flex items-baseline justify-between">
              <span class="text-[12px] text-ink-500">{{ t('status.unit.VACANT') }}</span>
              <span class="tabular text-[13px] font-semibold text-ink-700">
                {{ percent(100 - b.occupancy) }}
              </span>
            </div>

            <div class="flex items-baseline justify-between">
              <span class="text-[12px] text-ink-500">{{ t('kpi.debt') }}</span>
              <span class="tabular text-[13px] font-semibold text-danger-600">
                {{ moneyShort(b.debt) }}
              </span>
            </div>
          </div>
        </NuxtLink>
      </div>
    </UiCard>

    <!-- Diqqat talab qiladigan holatlar -->
    <section data-tour="exec-queue" class="grid gap-5 lg:grid-cols-2">
      <UiCard :title="t('svc.debtAlerts')" :subtitle="t('svc.overduePayments')" flush>
        <template #actions>
          <UiButton variant="ghost" size="sm" to="/billing/debts">{{ t('common.all') }}</UiButton>
        </template>

        <p v-if="!debtAlerts.length" class="px-5 py-10 text-center text-[13px] text-ink-500">
          {{ t('svc.noOverdueInScope') }}
        </p>

        <ul v-else class="divide-y divide-ink-100">
          <li v-for="d in debtAlerts" :key="d.id" class="px-5 py-3.5">
            <NuxtLink to="/billing/debts" class="group flex items-center gap-4">
              <span
                class="grid size-10 shrink-0 place-items-center rounded-field bg-danger-50 text-danger-600"
              >
                <UiIcon name="warning" :size="18" />
              </span>
              <span class="min-w-0 flex-1">
                <span
                  class="block truncate text-[14px] font-semibold text-ink-900 group-hover:text-brand-600"
                >
                  {{ d.tenant }}
                </span>
                <span class="block truncate text-[12px] text-ink-500">
                  {{ d.buildingName }} · {{ d.code }}
                </span>
              </span>
              <span class="shrink-0 text-right">
                <span class="tabular block text-[14px] font-bold text-danger-600">
                  {{ moneyShort(d.outstanding) }}
                </span>
                <span class="block text-[12px] text-ink-500">
                  {{ d.agingBucket ? t('svc.daysCount', { n: d.agingBucket }) : t('svc.onTime') }}
                </span>
              </span>
              <UiIcon name="chevronRight" :size="16" class="shrink-0 text-ink-400" />
            </NuxtLink>
          </li>
        </ul>
      </UiCard>

      <UiCard
        :title="t('tour.building.queueWatch.title')"
        :subtitle="t('svc.decisionNeeded')"
        flush
      >
        <template #actions>
          <UiButton variant="ghost" size="sm" to="/applications">{{ t('common.all') }}</UiButton>
        </template>

        <p v-if="!pendingCases.length" class="px-5 py-10 text-center text-[13px] text-ink-500">
          {{ t('svc.noPendingInScope') }}
        </p>

        <ul v-else class="divide-y divide-ink-100">
          <li v-for="c in pendingCases" :key="c.id" class="px-5 py-3.5">
            <NuxtLink :to="`/applications/${c.id}`" class="group flex items-center gap-4">
              <span class="grid size-10 shrink-0 place-items-center rounded-field bg-warn-50 text-warn-600">
                <UiIcon name="clock" :size="18" />
              </span>
              <span class="min-w-0 flex-1">
                <span
                  class="block truncate text-[14px] font-semibold text-ink-900 group-hover:text-brand-600"
                >
                  {{ c.code }} · {{ c.unitCode }}
                </span>
                <span class="block truncate text-[12px] text-ink-500">
                  {{ c.org.name }} · {{ c.buildingName }}
                </span>
              </span>
              <UiStatus kind="lease" :value="c.status" size="sm" />
              <UiIcon name="chevronRight" :size="16" class="shrink-0 text-ink-400" />
            </NuxtLink>
          </li>
        </ul>
      </UiCard>
    </section>
  </main>
</template>
