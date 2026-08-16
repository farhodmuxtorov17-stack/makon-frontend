<script setup lang="ts">
import { BUILDINGS, PORTFOLIO_TOTALS } from '~/data/buildings'
import { num, percent, sumShort } from '~/utils/format'

const period = ref('may-2025')
const scope = ref('all')

const periods = [
  { value: 'may-2025', label: 'May 2025' },
  { value: 'apr-2025', label: 'Aprel 2025' },
  { value: 'q2-2025', label: '2-chorak 2025' },
  { value: 'y-2025', label: '2025-yil' },
]

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

/** Tanlangan obyektning portfeldagi ulushi — grafik shunga moslashadi */
const scopeShare = computed(() => totals.value.revenue / PORTFOLIO_TOTALS.revenue)

const PERIOD_DATA: Record<string, { labels: string[]; revenue: number[]; debt: number[] }> = {
  'may-2025': {
    labels: ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May'],
    revenue: [10.9, 11.4, 11.8, 12.1, 12.54],
    debt: [1.62, 1.48, 1.39, 1.31, 1.25],
  },
  'apr-2025': {
    labels: ['Dekabr', 'Yanvar', 'Fevral', 'Mart', 'Aprel'],
    revenue: [10.4, 10.9, 11.4, 11.8, 12.1],
    debt: [1.71, 1.62, 1.48, 1.39, 1.31],
  },
  'q2-2025': {
    labels: ['Aprel', 'May', 'Iyun'],
    revenue: [12.1, 12.54, 12.9],
    debt: [1.31, 1.25, 1.18],
  },
  'y-2025': {
    labels: ['1-chorak', '2-chorak', '3-chorak', '4-chorak'],
    revenue: [34.1, 37.5, 39.2, 41.0],
    debt: [4.49, 3.74, 3.42, 3.15],
  },
}

const dynamicsLabels = computed(() => PERIOD_DATA[period.value]!.labels)

const dynamicsSeries = computed(() => {
  const d = PERIOD_DATA[period.value]!
  const k = scopeShare.value
  return [
    {
      label: 'Ijara tushumi, mlrd so‘m',
      tone: 'brand' as const,
      values: d.revenue.map((v) => +(v * k).toFixed(2)),
    },
    {
      label: 'Qarzdorlik, mlrd so‘m',
      tone: 'danger' as const,
      values: d.debt.map((v) => +(v * k).toFixed(2)),
    },
  ]
})

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

const mapLegend = [
  { label: '90% dan yuqori', class: 'bg-ok-500' },
  { label: '84–90%', class: 'bg-brand-500' },
  { label: '84% dan past', class: 'bg-warn-500' },
]
</script>

<template>
  <AppTopbar title="Boshqaruv paneli" subtitle="Portfel bo‘yicha strategik ko‘rinish">
    <template #actions>
      <UiSelect v-model="scope" :options="scopes" size="sm" class="w-52" />
      <UiSelect v-model="period" :options="periods" size="sm" class="w-40" />
      <UiButton variant="secondary" size="sm" to="/reports">
        <UiIcon name="download" :size="16" />
        Eksport
      </UiButton>
    </template>
  </AppTopbar>

  <main class="scroll-slim flex-1 space-y-5 overflow-y-auto p-6">
    <!-- KPI qatori -->
    <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <UiKpi
        label="Bandlik (o‘rtacha)"
        :value="percent(totals.occupancy)"
        :delta="4.2"
        icon="building"
        tone="brand"
        :spark="[81, 83, 84, 86, 87]"
        to="/objects"
      />
      <UiKpi
        label="Bo‘sh maydon (vacancy)"
        :value="num(totals.vacantArea)"
        unit="m²"
        :delta="-4.6"
        invert
        icon="layers"
        tone="ok"
        :spark="[62, 60, 58, 57, 55]"
        to="/objects"
      />
      <UiKpi
        label="Qarzdorlik"
        :value="sumShort(totals.debt)"
        :delta="6.3"
        invert
        icon="warning"
        tone="danger"
        :spark="[102, 108, 115, 120, 125]"
        to="/billing/debts"
      />
      <UiKpi
        label="Servis arizalari"
        :value="String(serviceCount)"
        :delta="-8"
        invert
        icon="wrench"
        tone="warn"
        :spark="[
          Math.round(serviceCount * 1.19),
          Math.round(serviceCount * 1.14),
          Math.round(serviceCount * 1.09),
          Math.round(serviceCount * 1.05),
          serviceCount,
        ]"
        to="/service-requests"
      />
      <UiKpi
        label="Ijara tushumi (oylik)"
        :value="sumShort(totals.revenue)"
        :delta="12.5"
        icon="wallet"
        tone="violet"
        :spark="[10.9, 11.4, 11.8, 12.1, 12.54]"
        to="/billing/invoices"
      />
    </section>

    <!-- Portfel ko‘rinishi -->
    <section class="grid gap-5 xl:grid-cols-4">
      <UiCard
        class="xl:col-span-2"
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
        class="xl:col-span-2"
        :title="scope === 'all' ? 'Portfel dinamikasi' : 'Obyekt dinamikasi'"
        subtitle="Davrlar kesimida tushum va qarzdorlik"
      >
        <UiLine :labels="dynamicsLabels" :series="dynamicsSeries" :height="216" />
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

      <div class="grid gap-4 p-5 pt-1 sm:grid-cols-2 xl:grid-cols-5">
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
        <ul class="divide-y divide-ink-100">
          <li
            v-for="d in [
              { tenant: 'Dream Retail', building: 'Mega Mall', amount: 7890000, days: 61 },
              { tenant: 'FinTech Services', building: 'Green Business Center', amount: 6480000, days: 97 },
              { tenant: 'Global Logistics & Trans', building: 'Harmony Residence', amount: 5145000, days: 38 },
            ]"
            :key="d.tenant"
            class="px-5 py-3.5"
          >
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
                <span class="block truncate text-[12px] text-ink-500">{{ d.building }}</span>
              </span>
              <span class="shrink-0 text-right">
                <span class="tabular block text-[13.5px] font-bold text-danger-600">
                  {{ sumShort(d.amount) }}
                </span>
                <span class="block text-[12px] text-ink-500">{{ d.days }} kun</span>
              </span>
              <UiIcon name="chevronRight" :size="16" class="shrink-0 text-ink-400" />
            </NuxtLink>
          </li>
        </ul>
      </UiCard>

      <UiCard title="Tasdiqlash kutilmoqda" subtitle="Qaror talab qiladigan yozuvlar" flush>
        <template #actions>
          <UiButton variant="ghost" size="sm" to="/applications">Barchasi</UiButton>
        </template>
        <ul class="divide-y divide-ink-100">
          <li
            v-for="a in [
              { title: 'Yangi ijara shartnomasi', org: 'Makon Solutions MCHJ', to: '/applications/a-0156' },
              { title: 'Sotuv shartnomasi loyihasi', org: 'Mega Invest Group', to: '/contracts/c-0156' },
              { title: 'Material so‘rovi MT-2025-0096', org: 'Servis Pro MCHJ', to: '/warehouse' },
            ]"
            :key="a.title"
            class="px-5 py-3.5"
          >
            <NuxtLink :to="a.to" class="flex items-center gap-4 group">
              <span class="grid size-10 shrink-0 place-items-center rounded-[10px] bg-warn-50 text-warn-600">
                <UiIcon name="clock" :size="18" />
              </span>
              <span class="min-w-0 flex-1">
                <span
                  class="block truncate text-[13.5px] font-semibold text-ink-900 group-hover:text-brand-600"
                >
                  {{ a.title }}
                </span>
                <span class="block truncate text-[12px] text-ink-500">{{ a.org }}</span>
              </span>
              <UiIcon name="chevronRight" :size="16" class="shrink-0 text-ink-400" />
            </NuxtLink>
          </li>
        </ul>
      </UiCard>
    </section>
  </main>
</template>
