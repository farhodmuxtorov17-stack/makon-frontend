<script setup lang="ts">
import { BUILDINGS, buildingById } from '~/data/buildings'
import { unitsOfBuilding } from '~/data/units'
import { APPLICATIONS, CONTRACTS, INVOICES } from '~/data/business'
import { SERVICE_REQUESTS } from '~/data/operations'
import { num, percent, sum, sumShort, dateShort, timeOf } from '~/utils/format'

const auth = useAuthStore()

const scopedBuildings = computed(() =>
  auth.scope.length ? BUILDINGS.filter((b) => auth.scope.includes(b.id)) : BUILDINGS,
)

const selected = ref(scopedBuildings.value[0]?.id ?? 'b-01')
const building = computed(() => buildingById(selected.value)!)

const buildingOptions = computed(() =>
  scopedBuildings.value.map((b) => ({ value: b.id, label: b.name })),
)

const period = ref('may-2025')
const periods = [
  { value: 'may-2025', label: 'May 2025' },
  { value: 'apr-2025', label: 'Aprel 2025' },
  { value: 'q2-2025', label: '2-chorak 2025' },
]

/** Qavatlar kesimidagi bandlik, unit ma’lumotlaridan hisoblanadi */
const floorOccupancy = computed(() => {
  const units = unitsOfBuilding(selected.value)
  const floors = [...new Set(units.map((u) => u.floor))].sort((a, b) => b - a)
  return floors.map((floor) => {
    const onFloor = units.filter((u) => u.floor === floor)
    const taken = onFloor.filter((u) => u.status === 'RENTED' || u.status === 'SOLD').length
    return {
      floor,
      total: onFloor.length,
      taken,
      share: onFloor.length ? Math.round((taken / onFloor.length) * 100) : 0,
    }
  })
})

const buildingApplications = computed(() =>
  APPLICATIONS.filter((a) => a.buildingName === building.value.name).slice(0, 4),
)

const buildingServices = computed(() =>
  SERVICE_REQUESTS.filter((s) => s.buildingName === building.value.name),
)

const openServices = computed(
  () => buildingServices.value.filter((s) => !['CLOSED', 'COMPLETED'].includes(s.status)).length,
)

const overdueInvoices = computed(
  () => INVOICES.filter((i) => i.buildingName === building.value.name && i.status === 'OVERDUE').length,
)

const pendingApprovals = computed(
  () =>
    APPLICATIONS.filter(
      (a) =>
        a.buildingName === building.value.name &&
        ['SUBMITTED', 'BUILDING_REVIEW', 'FINANCE_REVIEW'].includes(a.status),
    ).length,
)

/** Hisobot sanasi: ma’lumotlar mos keladigan davr */
const REPORT_DATE = new Date('2025-05-23')

const endingSoon = computed(
  () =>
    CONTRACTS.filter(
      (c) =>
        c.buildingName === building.value.name &&
        c.status === 'ACTIVE' &&
        c.endsAt !== '-' &&
        (new Date(c.endsAt).getTime() - REPORT_DATE.getTime()) / 86_400_000 <= 365,
    ).length,
)

const debtAlerts = computed(() =>
  INVOICES.filter(
    (i) =>
      i.buildingName === building.value.name &&
      (i.status === 'OVERDUE' || i.status === 'PARTIALLY_PAID'),
  ),
)

const pendingApprovalRows = computed(() =>
  APPLICATIONS.filter(
    (a) =>
      a.buildingName === building.value.name &&
      ['SUBMITTED', 'BUILDING_REVIEW', 'FINANCE_REVIEW'].includes(a.status),
  ),
)

const problems = computed(() => [
  {
    label: 'Kechikkan to‘lovlar',
    count: overdueInvoices.value,
    tone: 'danger' as const,
    icon: 'warning',
    to: '/billing/debts',
  },
  {
    label: 'Ochiq servis arizalari',
    count: openServices.value,
    tone: 'warn' as const,
    icon: 'wrench',
    to: '/service-requests',
  },
  {
    label: 'Tasdiqlash kutilmoqda',
    count: pendingApprovals.value,
    tone: 'brand' as const,
    icon: 'clock',
    to: '/applications',
  },
  {
    label: 'Shartnoma yakuni yaqin',
    count: endingSoon.value,
    tone: 'violet' as const,
    icon: 'contract',
    to: '/contracts',
  },
])

const PROBLEM_TONE = {
  danger: 'bg-danger-50 text-danger-600',
  warn: 'bg-warn-50 text-warn-600',
  brand: 'bg-brand-50 text-brand-600',
  violet: 'bg-info-50 text-info-600',
}

/** Har bir davr uchun oldingi nuqtalar koeffitsienti, oxirgisi joriy qiymat */
const PERIOD_TREND: Record<string, { labels: string[]; factors: number[] }> = {
  'may-2025': {
    labels: ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May'],
    factors: [0.871, 0.895, 0.93, 0.968, 1],
  },
  'apr-2025': {
    labels: ['Dekabr', 'Yanvar', 'Fevral', 'Mart', 'Aprel'],
    factors: [0.842, 0.871, 0.895, 0.93, 0.968],
  },
  'q2-2025': {
    labels: ['Aprel', 'May', 'Iyun'],
    factors: [0.968, 1, 1.03],
  },
}

const revenueLabels = computed(() => PERIOD_TREND[period.value]!.labels)

const revenueSeries = computed(() => {
  const current = building.value.monthlyRevenue / 1_000_000
  return [
    {
      label: 'Ijara tushumi, mln so‘m',
      tone: 'brand' as const,
      fill: true,
      values: PERIOD_TREND[period.value]!.factors.map((f) => Math.round(current * f)),
    },
  ]
})
</script>

<template>
  <AppTopbar title="Boshqaruv paneli" :subtitle="building.name">
    <template #actions>
      <UiSelect v-model="selected" :options="buildingOptions" size="sm" class="w-56" />
      <UiSelect v-model="period" :options="periods" size="sm" class="w-40" />
      <UiButton variant="secondary" size="sm" :to="`/objects/${building.id}/3d`">
        <UiIcon name="cube" :size="16" />
        3D ko‘rinish
      </UiButton>
    </template>
  </AppTopbar>

  <main class="scroll-slim flex-1 space-y-5 overflow-y-auto p-6">
    <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <UiKpi
        label="Bandlik"
        :value="percent(building.occupancy)"
        :delta="3.1"
        icon="building"
        tone="brand"
        :spark="[86, 88, 89, 91, building.occupancy]"
        :to="`/objects/${building.id}`"
      />
      <UiKpi
        label="Bo‘sh maydon"
        :value="num(building.vacantArea)"
        unit="m²"
        :delta="-1.4"
        invert
        icon="layers"
        tone="ok"
        :spark="[10800, 10400, 10100, 9800, building.vacantArea]"
        :to="`/objects/${building.id}`"
      />
      <UiKpi
        label="Oylik tushum"
        :value="sumShort(building.monthlyRevenue)"
        :delta="9.2"
        icon="wallet"
        tone="violet"
        :spark="[2980, 3060, 3180, 3310, Math.round(building.monthlyRevenue / 1_000_000)]"
        to="/billing/invoices"
      />
      <UiKpi
        label="Qarzdorlik"
        :value="sumShort(building.debt)"
        :delta="4.8"
        invert
        icon="warning"
        tone="danger"
        :spark="[14.2, 15.1, 16.4, 17.3, +(building.debt / 1_000_000).toFixed(1)]"
        to="/billing/debts"
      />
      <UiKpi
        label="Ochiq servis arizalari"
        :value="String(openServices)"
        :delta="-12"
        invert
        icon="wrench"
        tone="warn"
        :spark="[9, 8, 7, 6, openServices]"
        to="/service-requests"
      />
    </section>

    <section class="grid gap-5 xl:grid-cols-3">
      <!-- Bugungi muammolar -->
      <UiCard title="Diqqat talab qiladi" subtitle="Bugungi holat" flush>
        <ul class="divide-y divide-ink-100">
          <li v-for="p in problems" :key="p.label">
            <NuxtLink
              :to="p.to"
              class="group flex items-center gap-3.5 px-5 py-3.5 transition-colors hover:bg-brand-50/40"
            >
              <span
                class="grid size-10 shrink-0 place-items-center rounded-[10px]"
                :class="PROBLEM_TONE[p.tone]"
              >
                <UiIcon :name="p.icon" :size="18" />
              </span>
              <span class="min-w-0 flex-1 truncate text-[13.5px] font-medium text-ink-700 group-hover:text-brand-700">
                {{ p.label }}
              </span>
              <span class="tabular shrink-0 text-lg font-bold text-ink-900">{{ p.count }}</span>
              <UiIcon name="chevronRight" :size="16" class="shrink-0 text-ink-400" />
            </NuxtLink>
          </li>
        </ul>
      </UiCard>

      <!-- Qavatlar bo‘yicha bandlik -->
      <UiCard title="Qavatlar bo‘yicha bandlik" subtitle="Band unitlar ulushi">
        <p v-if="!floorOccupancy.length" class="py-8 text-center text-[13px] text-ink-500">
          Bu obyekt bo‘yicha unit ma’lumoti hali kiritilmagan
        </p>

        <ul v-else class="space-y-3">
          <li v-for="f in floorOccupancy" :key="f.floor">
            <NuxtLink
              :to="`/objects/${building.id}/floors/${f.floor}`"
              class="group block rounded-field px-2 py-1.5 transition-colors hover:bg-brand-50/50"
            >
              <div class="flex items-baseline justify-between gap-3">
                <span class="text-[13px] font-semibold text-ink-700 group-hover:text-brand-700">
                  {{ f.floor }}-qavat
                </span>
                <span class="tabular text-[12.5px] text-ink-500">
                  {{ f.taken }} / {{ f.total }} unit
                </span>
                <span class="tabular text-[13px] font-bold text-ink-900">
                  {{ percent(f.share) }}
                </span>
              </div>
              <div class="mt-1.5 h-2 overflow-hidden rounded-pill bg-ink-100">
                <div
                  class="h-full rounded-pill transition-all"
                  :class="f.share >= 80 ? 'bg-ok-500' : f.share >= 50 ? 'bg-brand-500' : 'bg-warn-500'"
                  :style="{ width: `${f.share}%` }"
                />
              </div>
            </NuxtLink>
          </li>
        </ul>
      </UiCard>

      <!-- Tushum dinamikasi -->
      <UiCard title="Tushum dinamikasi" subtitle="Oylar kesimida">
        <UiLine :labels="revenueLabels" :series="revenueSeries" :height="188" />
      </UiCard>
    </section>

    <!-- So‘nggi servis arizalari -->
    <UiCard title="So‘nggi arizalar" subtitle="Servis arizalari" flush>
      <template #actions>
        <UiButton variant="ghost" size="sm" to="/service-requests">Barchasi</UiButton>
      </template>

      <p v-if="!buildingServices.length" class="px-5 py-10 text-center text-[13px] text-ink-500">
        Ushbu obyekt bo‘yicha servis arizasi yo‘q
      </p>

      <ul v-else class="divide-y divide-ink-100">
        <li v-for="s in buildingServices.slice(0, 4)" :key="s.id">
          <NuxtLink
            :to="`/service-requests/${s.id}`"
            class="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-brand-50/40"
          >
            <span
              class="grid size-10 shrink-0 place-items-center rounded-[10px] bg-warn-50 text-warn-600"
            >
              <UiIcon name="wrench" :size="18" />
            </span>
            <span class="min-w-0 flex-1">
              <span
                class="block truncate text-[13.5px] font-semibold text-ink-900 group-hover:text-brand-600"
              >
                {{ s.title }}
              </span>
              <span class="block truncate text-[12px] text-ink-500">
                {{ s.unitCode }} · {{ dateShort(s.createdAt) }} {{ timeOf(s.createdAt) }}
              </span>
            </span>
            <UiStatus kind="service" :value="s.status" size="sm" />
          </NuxtLink>
        </li>
      </ul>
    </UiCard>

    <!-- So‘nggi ijara arizalari -->
    <UiCard title="So‘nggi ijara arizalari" subtitle="Ushbu obyekt bo‘yicha" flush>
      <template #actions>
        <UiButton variant="ghost" size="sm" to="/applications">Barchasi</UiButton>
      </template>

      <UiTable
        :columns="[
          { key: 'code', label: 'Ariza raqami' },
          { key: 'tenant', label: 'Tashkilot' },
          { key: 'unitCode', label: 'Unit' },
          { key: 'area', label: 'Maydon', align: 'right', numeric: true },
          { key: 'type', label: 'Turi' },
          { key: 'stage', label: 'Bosqich' },
          { key: 'status', label: 'Status' },
          { key: 'submittedAt', label: 'Yuborilgan' },
        ]"
        :rows="buildingApplications"
        :to="(row) => `/applications/${row.id}`"
        empty="Ushbu obyekt bo‘yicha ariza yo‘q"
      >
        <template #cell-code="{ row }">
          <span class="font-semibold text-ink-900">{{ row.code }}</span>
        </template>
        <template #cell-area="{ value }">{{ num(Number(value), 2) }} m²</template>
        <template #cell-status="{ value }">
          <UiStatus kind="application" :value="String(value)" size="sm" />
        </template>
        <template #cell-submittedAt="{ value }">
          <span class="text-ink-500">{{ dateShort(String(value)) }}</span>
        </template>
      </UiTable>
    </UiCard>

    <!-- Diqqat talab qiladigan holatlar -->
    <section class="grid gap-5 lg:grid-cols-2">
      <UiCard title="Qarzdorlik ogohlantirishlari" subtitle="Muddati o‘tgan to‘lovlar" flush>
        <template #actions>
          <UiButton variant="ghost" size="sm" to="/billing/debts">Barchasi</UiButton>
        </template>

        <p v-if="!debtAlerts.length" class="px-5 py-10 text-center text-[13px] text-ink-500">
          Ushbu obyekt bo‘yicha qarzdorlik yo‘q
        </p>

        <ul v-else class="divide-y divide-ink-100">
          <li v-for="i in debtAlerts" :key="i.id" class="px-5 py-3.5">
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
                  {{ i.tenant }}
                </span>
                <span class="block truncate text-[12px] text-ink-500">
                  {{ i.code }} · {{ i.unitCode }}
                </span>
              </span>
              <span class="shrink-0 text-right">
                <span class="tabular block text-[13.5px] font-bold text-danger-600">
                  {{ sumShort(i.total - i.paid) }}
                </span>
                <span class="block text-[12px] text-ink-500">
                  {{ i.agingBucket ? `${i.agingBucket} kun` : 'muddatida' }}
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

        <p
          v-if="!pendingApprovalRows.length"
          class="px-5 py-10 text-center text-[13px] text-ink-500"
        >
          Tasdiqlash kutayotgan ariza yo‘q
        </p>

        <ul v-else class="divide-y divide-ink-100">
          <li v-for="a in pendingApprovalRows" :key="a.id" class="px-5 py-3.5">
            <NuxtLink :to="`/applications/${a.id}`" class="group flex items-center gap-4">
              <span
                class="grid size-10 shrink-0 place-items-center rounded-[10px] bg-warn-50 text-warn-600"
              >
                <UiIcon name="clock" :size="18" />
              </span>
              <span class="min-w-0 flex-1">
                <span
                  class="block truncate text-[13.5px] font-semibold text-ink-900 group-hover:text-brand-600"
                >
                  {{ a.type }} · {{ a.unitCode }}
                </span>
                <span class="block truncate text-[12px] text-ink-500">
                  {{ a.tenant }} · {{ num(a.area, 2) }} m²
                </span>
              </span>
              <span class="shrink-0 text-right">
                <span class="tabular block text-[13px] font-semibold text-ink-900">
                  {{ sum(a.price) }}
                </span>
                <span class="block text-[12px] text-ink-500">{{ dateShort(a.submittedAt) }}</span>
              </span>
              <UiIcon name="chevronRight" :size="16" class="shrink-0 text-ink-400" />
            </NuxtLink>
          </li>
        </ul>
      </UiCard>
    </section>
  </main>
</template>
