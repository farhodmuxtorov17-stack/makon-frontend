<script setup lang="ts">
import {
  BUILDINGS,
  TREND_SPANS,
  buildingById,
  moneyScale,
  trendDelta,
  trendLabels,
  trendSpark,
  trendWindow,
} from '~/data/buildings'
import { unitsOfBuilding } from '~/data/units'
import { CONTRACTS, INVOICES } from '~/data/business'
import { SERVICE_REQUESTS, type ServiceRequest } from '~/data/operations'
import { scheduleTotals, type LeaseStatus } from '~/stores/lease'
import { ROLE_META } from '~/constants/roles'
import { num, percent, sum, sumShort, dateShort, timeOf, todayIso } from '~/utils/format'

const auth = useAuthStore()
const lease = useLeaseStore()

lease.seed()

/**
 * Rolga ochiq bo‘lgan birinchi manzil. Bino rahbari billing modulini
 * ocholmaydi, shuning uchun moliyaviy kartalar unga ochiq ekranga yo‘naltiriladi.
 */
function pick(...candidates: string[]) {
  const role = auth.role
  if (!role) return candidates[0]!
  return candidates.find((c) => auth.canRoute(c)) ?? ROLE_META[role].home
}

const invoicesTarget = computed(() => pick('/billing/invoices', '/contracts'))
const debtsTarget = computed(() => pick('/billing/debts', '/reports'))

const scopedBuildings = computed(() =>
  auth.scope.length ? BUILDINGS.filter((b) => auth.scope.includes(b.id)) : BUILDINGS,
)

const selected = ref(scopedBuildings.value[0]?.id ?? 'b-01')
const building = computed(() => buildingById(selected.value)!)

const buildingOptions = computed(() =>
  scopedBuildings.value.map((b) => ({ value: b.id, label: b.name })),
)

const span = ref('6')
const spanLength = computed(() => Number(span.value))

/** Qavatlar kesimidagi bandlik, unit ma’lumotlaridan hisoblanadi */
const floorOccupancy = computed(() => {
  const units = unitsOfBuilding(selected.value)
  const floors = [...new Set(units.map((u) => u.floor))].sort((a, b) => b - a)
  return floors.map((floor) => {
    const onFloor = units.filter((u) => u.floor === floor)
    const occupied = onFloor.filter((u) => u.status === 'RENTED' || u.status === 'SOLD')
    // Ulush maydon bo'yicha: KPI kartasi ham shu ta'rifda hisoblanadi
    const area = onFloor.reduce((sum, u) => sum + u.area, 0)
    const takenArea = occupied.reduce((sum, u) => sum + u.area, 0)
    return {
      floor,
      total: onFloor.length,
      taken: occupied.length,
      share: area ? Math.round((takenArea / area) * 100) : 0,
    }
  })
})

/* --- Ijara arizalari: navbat bilan bitta reyestrdan o‘qiladi --- */

const PENDING_LEASE: LeaseStatus[] = [
  'YANGI',
  'SHARTNOMA_TAYYOR',
  'DIDOX_YUBORILDI',
  'DIDOX_IMZOLANDI',
]

const buildingCases = computed(() =>
  lease.cases
    .filter((c) => c.buildingId === selected.value)
    .slice()
    .sort((a, b) => b.request.submittedAt.localeCompare(a.request.submittedAt)),
)

const applicationRows = computed(() =>
  buildingCases.value.slice(0, 4).map((c) => ({
    id: c.id,
    code: c.code,
    tenant: c.org.name,
    unitCode: c.unitCode,
    area: c.area,
    type: c.request.type,
    status: c.status,
    submittedAt: c.request.submittedAt,
  })),
)

const pendingApprovalRows = computed(() =>
  buildingCases.value.filter((c) => PENDING_LEASE.includes(c.status)),
)

const pendingApprovals = computed(() => pendingApprovalRows.value.length)

/* --- Servis arizalari: ish topshiriqlari ekrani bilan bitta nusxa --- */

const services = useState<ServiceRequest[]>('service-requests', () =>
  SERVICE_REQUESTS.map((r) => ({ ...r })),
)

const buildingServices = computed(() =>
  services.value.filter((s) => s.buildingName === building.value.name),
)

const openServices = computed(
  () => buildingServices.value.filter((s) => !['CLOSED', 'COMPLETED'].includes(s.status)).length,
)

/* --- Moliyaviy holat --- */

const overdueInvoices = computed(
  () => INVOICES.filter((i) => i.buildingName === building.value.name && i.status === 'OVERDUE').length,
)

/** Hisobot sanasi: ko‘rsatkichlar shu kunga tegishli */
const REPORT_DATE = new Date(todayIso())

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

const problems = computed(() => [
  {
    label: 'Kechikkan to‘lovlar',
    count: overdueInvoices.value,
    tone: 'danger' as const,
    icon: 'warning',
    to: debtsTarget.value,
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

/* --- Tushum dinamikasi --- */

const revenueLabels = computed(() => trendLabels(spanLength.value))

const revenueSeries = computed(() => {
  const s = moneyScale(building.value.monthlyRevenue)
  return [
    {
      label: `Ijara tushumi, ${s.unit}`,
      tone: 'brand' as const,
      fill: true,
      values: trendWindow('revenue', spanLength.value).map(
        (f) => +((building.value.monthlyRevenue / s.div) * f).toFixed(s.digits),
      ),
    },
  ]
})
</script>

<template>
  <AppTopbar title="Boshqaruv paneli" :subtitle="building.name">
    <template #actions>
      <UiSelect v-model="selected" :options="buildingOptions" size="sm" class="w-56" />
      <UiSelect v-model="span" :options="TREND_SPANS" size="sm" class="w-40" />
      <UiButton variant="secondary" size="sm" :to="`/objects/${building.id}/3d`">
        <UiIcon name="cube" :size="16" />
        3D ko‘rinish
      </UiButton>
    </template>
  </AppTopbar>

  <main class="scroll-slim flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
    <section class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      <UiKpi
        label="Bandlik"
        :value="percent(building.occupancy)"
        :delta="trendDelta('occupancy')"
        icon="building"
        tone="brand"
        :spark="trendSpark('occupancy', building.occupancy)"
        :to="`/objects/${building.id}`"
      />
      <UiKpi
        label="Bo‘sh maydon"
        :value="num(building.vacantArea)"
        unit="m²"
        :delta="trendDelta('vacantArea')"
        invert
        icon="layers"
        tone="ok"
        :spark="trendSpark('vacantArea', building.vacantArea)"
        :to="`/objects/${building.id}`"
      />
      <UiKpi
        label="Oylik tushum"
        :value="sumShort(building.monthlyRevenue)"
        :delta="trendDelta('revenue')"
        icon="wallet"
        tone="violet"
        :spark="trendSpark('revenue', building.monthlyRevenue / 1_000_000)"
        :to="invoicesTarget"
      />
      <UiKpi
        label="Qarzdorlik"
        :value="sumShort(building.debt)"
        :delta="trendDelta('debt')"
        invert
        icon="warning"
        tone="danger"
        :spark="trendSpark('debt', building.debt / 1_000_000)"
        :to="debtsTarget"
      />
      <UiKpi
        label="Ochiq servis arizalari"
        :value="String(openServices)"
        :delta="trendDelta('service')"
        invert
        icon="wrench"
        tone="warn"
        :spark="trendSpark('service', openServices)"
        to="/service-requests"
      />
    </section>

    <section class="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
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
              <span class="min-w-0 flex-1 truncate text-[14px] font-medium text-ink-700 group-hover:text-brand-700">
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
                <span class="tabular text-[13px] text-ink-500">
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
      <UiCard title="Tushum dinamikasi" subtitle="Oxirgi nuqta: KPI kartadagi joriy qiymat">
        <div class="flex items-baseline justify-between gap-3">
          <p class="text-[13px] font-semibold text-ink-700">Oylik tushum</p>
          <p class="tabular text-[14px] font-bold text-brand-600">
            {{ sumShort(building.monthlyRevenue) }}
          </p>
        </div>
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
                class="block truncate text-[14px] font-semibold text-ink-900 group-hover:text-brand-600"
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
          { key: 'status', label: 'Status' },
          { key: 'submittedAt', label: 'Yuborilgan' },
        ]"
        :rows="applicationRows"
        :to="(row) => `/applications/${row.id}`"
        empty="Ushbu obyekt bo‘yicha ariza yo‘q"
      >
        <template #cell-code="{ row }">
          <span class="font-semibold text-ink-900">{{ row.code }}</span>
        </template>
        <template #cell-area="{ value }">{{ num(Number(value), 2) }} m²</template>
        <template #cell-status="{ value }">
          <UiStatus kind="lease" :value="String(value)" size="sm" />
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
          <UiButton variant="ghost" size="sm" :to="debtsTarget">Barchasi</UiButton>
        </template>

        <p v-if="!debtAlerts.length" class="px-5 py-10 text-center text-[13px] text-ink-500">
          Ushbu obyekt bo‘yicha qarzdorlik yo‘q
        </p>

        <ul v-else class="divide-y divide-ink-100">
          <li v-for="i in debtAlerts" :key="i.id" class="px-5 py-3.5">
            <NuxtLink :to="debtsTarget" class="group flex items-center gap-4">
              <span
                class="grid size-10 shrink-0 place-items-center rounded-[10px] bg-danger-50 text-danger-600"
              >
                <UiIcon name="warning" :size="18" />
              </span>
              <span class="min-w-0 flex-1">
                <span
                  class="block truncate text-[14px] font-semibold text-ink-900 group-hover:text-brand-600"
                >
                  {{ i.tenant }}
                </span>
                <span class="block truncate text-[12px] text-ink-500">
                  {{ i.code }} · {{ i.unitCode }}
                </span>
              </span>
              <span class="shrink-0 text-right">
                <span class="tabular block text-[14px] font-bold text-danger-600">
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
          <li v-for="c in pendingApprovalRows" :key="c.id" class="px-5 py-3.5">
            <NuxtLink :to="`/applications/${c.id}`" class="group flex items-center gap-4">
              <span
                class="grid size-10 shrink-0 place-items-center rounded-[10px] bg-warn-50 text-warn-600"
              >
                <UiIcon name="clock" :size="18" />
              </span>
              <span class="min-w-0 flex-1">
                <span
                  class="block truncate text-[14px] font-semibold text-ink-900 group-hover:text-brand-600"
                >
                  {{ c.code }} · {{ c.unitCode }}
                </span>
                <span class="block truncate text-[12px] text-ink-500">
                  {{ c.org.name }} · {{ num(c.area, 2) }} m²
                </span>
              </span>
              <span class="shrink-0 text-right">
                <span class="tabular block text-[13px] font-semibold text-ink-900">
                  {{
                    c.schedule.length
                      ? sum(scheduleTotals(c.schedule).total)
                      : `${sum(c.request.offerPrice)} / oy`
                  }}
                </span>
                <span class="block text-[12px] text-ink-500">
                  {{ dateShort(c.request.submittedAt) }}
                </span>
              </span>
              <UiStatus kind="lease" :value="c.status" size="sm" />
            </NuxtLink>
          </li>
        </ul>
      </UiCard>
    </section>
  </main>
</template>
