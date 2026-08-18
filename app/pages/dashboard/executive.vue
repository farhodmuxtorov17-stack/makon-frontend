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
import { num, percent, sumShort } from '~/utils/format'

const lease = useLeaseStore()
lease.seed()

const scope = ref('all')

const scopes = [
  { value: 'all', label: 'Barcha obyektlar' },
  ...BUILDINGS.map((b) => ({ value: b.id, label: b.name })),
]

const visible = computed(() =>
  scope.value === 'all' ? BUILDINGS : BUILDINGS.filter((b) => b.id === scope.value),
)

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
  { label: 'Band maydon', value: occupiedArea.value, tone: 'brand' as const },
  { label: 'Bo‘sh maydon', value: totals.value.vacantArea, tone: 'ok' as const },
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
      label: `Ijara tushumi, ${s.unit}`,
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
      label: `Qarzdorlik, ${s.unit}`,
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
  'OPERATSIYA_TASDIQLADI',
  'MOLIYA_TASDIQLADI',
  'QORALAMA_TAYYOR',
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
    caption: `${b.district} · ${b.type}`,
    value: b.occupancy,
    valueLabel: '% bandlik',
    to: `/objects/${b.id}`,
    tone: b.occupancy >= 90 ? ('ok' as const) : b.occupancy >= 84 ? ('brand' as const) : ('warn' as const),
  })),
)

const mapStats = computed(() => [
  { label: 'Obyektlar', value: String(visible.value.length) },
  { label: 'Bandlik', value: percent(totals.value.occupancy) },
  { label: 'Umumiy maydon', value: `${num(Math.round(totals.value.gla / 1000))} ming m²` },
  { label: 'Bo‘sh maydon', value: `${num(Math.round(totals.value.vacantArea / 1000))} ming m²` },
])

// Shkala bitta manbadan: reyestr, xarita va landing bir xil chegara ko‘rsatadi
const mapLegend = OCCUPANCY_BANDS.map((b) => ({ label: b.label, class: b.class }))
</script>

<template>
  <AppTopbar title="Boshqaruv paneli" subtitle="Portfel bo‘yicha strategik ko‘rinish">
    <template #actions>
      <UiSelect v-model="scope" :options="scopes" size="sm" class="w-52" />
      <UiSelect v-model="span" :options="TREND_SPANS" size="sm" class="w-40" />
      <UiButton variant="secondary" size="sm" to="/reports">
        <UiIcon name="download" :size="16" />
        Eksport
      </UiButton>
    </template>
  </AppTopbar>

  <main class="scroll-slim flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
    <!-- KPI qatori -->
    <section class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      <UiKpi
        label="Bandlik (o‘rtacha)"
        :value="percent(totals.occupancy)"
        :delta="trendDelta('occupancy')"
        icon="building"
        tone="brand"
        :spark="trendSpark('occupancy', totals.occupancy)"
        to="/objects"
      />
      <UiKpi
        label="Bo‘sh maydon (vacancy)"
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
        label="Qarzdorlik"
        :value="sumShort(totals.debt)"
        :delta="trendDelta('debt')"
        invert
        icon="warning"
        tone="danger"
        :spark="trendSpark('debt', totals.debt / 1_000_000)"
        to="/billing/debts"
      />
      <UiKpi
        label="Servis arizalari"
        :value="String(serviceCount)"
        :delta="trendDelta('service')"
        invert
        icon="wrench"
        tone="warn"
        :spark="trendSpark('service', serviceCount)"
        to="/service-requests"
      />
      <UiKpi
        label="Ijara tushumi (oylik)"
        :value="sumShort(totals.revenue)"
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
        title="Bandlik xaritasi"
        subtitle="Obyektlarning haqiqiy joylashuvi"
      >
        <template #actions>
          <UiButton variant="ghost" size="sm" to="/objects">Reyestr</UiButton>
        </template>

        <UiMap
          :markers="mapMarkers"
          :stats="mapStats"
          :legend="mapLegend"
          height="368px"
          :zoom="11"
        />
      </UiCard>

      <UiCard title="Portfel ko‘rinishi" subtitle="Maydon taqsimoti">
        <UiDonut
          :slices="portfolioSlices"
          :center-value="percent(totals.occupancy)"
          center-label="bandlik darajasi"
        />
        <dl class="mt-5 grid grid-cols-2 gap-3 border-t border-ink-100 pt-4 sm:grid-cols-3">
          <div>
            <dt class="text-[12px] text-ink-500">Jami maydon</dt>
            <dd class="tabular mt-0.5 text-sm font-bold text-ink-900">
              {{ num(totals.gla) }} m²
            </dd>
          </div>
          <div>
            <dt class="text-[12px] text-ink-500">Band</dt>
            <dd class="tabular mt-0.5 text-sm font-bold text-brand-600">
              {{ num(occupiedArea) }} m²
            </dd>
          </div>
          <div>
            <dt class="text-[12px] text-ink-500">Bo‘sh</dt>
            <dd class="tabular mt-0.5 text-sm font-bold text-ok-600">
              {{ num(totals.vacantArea) }} m²
            </dd>
          </div>
        </dl>
      </UiCard>

      <UiCard
        :title="scope === 'all' ? 'Portfel dinamikasi' : 'Obyekt dinamikasi'"
        subtitle="Oxirgi nuqta: KPI kartadagi joriy qiymat"
      >
        <div>
          <div class="flex items-baseline justify-between gap-3">
            <p class="text-[13px] font-semibold text-ink-700">Ijara tushumi</p>
            <p class="tabular text-[13.5px] font-bold text-brand-600">
              {{ sumShort(totals.revenue) }}
            </p>
          </div>
          <UiLine :labels="dynamicsLabels" :series="revenueSeries" :height="132" />
        </div>

        <div class="mt-5 border-t border-ink-100 pt-4">
          <div class="flex items-baseline justify-between gap-3">
            <p class="text-[13px] font-semibold text-ink-700">Qarzdorlik</p>
            <p class="tabular text-[13.5px] font-bold text-danger-600">
              {{ sumShort(totals.debt) }}
            </p>
          </div>
          <UiLine :labels="dynamicsLabels" :series="debtSeries" :height="132" />
        </div>
      </UiCard>
    </section>

    <!-- Obyektlar taqqoslanishi -->
    <UiCard title="Obyektlar taqqoslanishi" subtitle="Bandlik, tushum va qarzdorlik kesimida" flush>
      <template #actions>
        <UiButton variant="ghost" size="sm" to="/objects">
          Barchasi
          <UiIcon name="chevronRight" :size="15" />
        </UiButton>
      </template>

      <div class="grid gap-4 p-5 pt-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <NuxtLink
          v-for="b in visible"
          :key="b.id"
          :to="`/objects/${b.id}`"
          class="group rounded-field p-4 ring-1 ring-ink-200 transition-all hover:shadow-card hover:ring-brand-300"
        >
          <p class="truncate text-[13.5px] font-bold text-ink-900 group-hover:text-brand-600">
            {{ b.name }}
          </p>
          <p class="mt-0.5 truncate text-[12px] text-ink-500">{{ b.district }}</p>

          <div class="mt-3.5 space-y-2.5">
            <div>
              <div class="flex items-baseline justify-between">
                <span class="text-[12px] text-ink-500">Bandlik</span>
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
              <span class="text-[12px] text-ink-500">Bo‘sh</span>
              <span class="tabular text-[12.5px] font-semibold text-ink-700">
                {{ percent(100 - b.occupancy) }}
              </span>
            </div>

            <div class="flex items-baseline justify-between">
              <span class="text-[12px] text-ink-500">Qarzdorlik</span>
              <span class="tabular text-[12.5px] font-semibold text-danger-600">
                {{ sumShort(b.debt) }}
              </span>
            </div>
          </div>
        </NuxtLink>
      </div>
    </UiCard>

    <!-- Diqqat talab qiladigan holatlar -->
    <section class="grid gap-5 lg:grid-cols-2">
      <UiCard title="Qarzdorlik ogohlantirishlari" subtitle="Muddati o‘tgan to‘lovlar" flush>
        <template #actions>
          <UiButton variant="ghost" size="sm" to="/billing/debts">Barchasi</UiButton>
        </template>

        <p v-if="!debtAlerts.length" class="px-5 py-10 text-center text-[13px] text-ink-500">
          Tanlangan qamrov bo‘yicha muddati o‘tgan to‘lov yo‘q
        </p>

        <ul v-else class="divide-y divide-ink-100">
          <li v-for="d in debtAlerts" :key="d.id" class="px-5 py-3.5">
            <NuxtLink to="/billing/debts" class="group flex items-center gap-4">
              <span
                class="grid size-10 shrink-0 place-items-center rounded-[10px] bg-danger-50 text-danger-600"
              >
                <UiIcon name="warning" :size="18" />
              </span>
              <span class="min-w-0 flex-1">
                <span
                  class="block truncate text-[13.5px] font-semibold text-ink-900 group-hover:text-brand-600"
                >
                  {{ d.tenant }}
                </span>
                <span class="block truncate text-[12px] text-ink-500">
                  {{ d.buildingName }} · {{ d.code }}
                </span>
              </span>
              <span class="shrink-0 text-right">
                <span class="tabular block text-[13.5px] font-bold text-danger-600">
                  {{ sumShort(d.outstanding) }}
                </span>
                <span class="block text-[12px] text-ink-500">
                  {{ d.agingBucket ? `${d.agingBucket} kun` : 'muddatida' }}
                </span>
              </span>
              <UiIcon name="chevronRight" :size="16" class="shrink-0 text-ink-400" />
            </NuxtLink>
          </li>
        </ul>
      </UiCard>

      <UiCard title="Tasdiqlash kutilmoqda" subtitle="Qaror talab qiladigan arizalar" flush>
        <template #actions>
          <UiButton variant="ghost" size="sm" to="/applications">Barchasi</UiButton>
        </template>

        <p v-if="!pendingCases.length" class="px-5 py-10 text-center text-[13px] text-ink-500">
          Tanlangan qamrov bo‘yicha tasdiqlash kutayotgan ariza yo‘q
        </p>

        <ul v-else class="divide-y divide-ink-100">
          <li v-for="c in pendingCases" :key="c.id" class="px-5 py-3.5">
            <NuxtLink :to="`/applications/${c.id}`" class="group flex items-center gap-4">
              <span class="grid size-10 shrink-0 place-items-center rounded-[10px] bg-warn-50 text-warn-600">
                <UiIcon name="clock" :size="18" />
              </span>
              <span class="min-w-0 flex-1">
                <span
                  class="block truncate text-[13.5px] font-semibold text-ink-900 group-hover:text-brand-600"
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
