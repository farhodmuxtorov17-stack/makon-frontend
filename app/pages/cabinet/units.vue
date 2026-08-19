<script setup lang="ts">
import { buildingById } from '~/data/buildings'
import { UNITS, unitsOfFloor, type Unit } from '~/data/units'
import { CONTRACTS, INVOICES } from '~/data/business'
import { SERVICE_REQUESTS } from '~/data/operations'
import { area, dateShort, monthTitle, num, sum, todayIso } from '~/utils/format'

const auth = useAuthStore()
const lease = useLeaseStore()

lease.seed()

/** Kabinet faqat kirgan foydalanuvchining tashkiloti bilan ishlaydi */
const organization = computed(() => auth.user?.organization ?? '')

/**
 * Maydonlar reyestrdan, tashkilot nomi bo‘yicha olinadi. Shartnoma
 * faollashtirilganda unit shu tashkilot nomiga o‘tadi va ro‘yxatga
 * avtomatik qo‘shiladi.
 */
const myUnits = computed<Unit[]>(() =>
  UNITS.filter((u) => organization.value && u.tenant === organization.value),
)

/** Yagona hisob-faktura reyestri, ijarachi kesimida */
const MY_INVOICES = computed(() =>
  INVOICES.filter((i) => organization.value && i.tenant === organization.value),
)

/** «Unit 501» va «501» yozuvlari bir xil unitga ishora qiladi */
function unitCodeOf(value: string) {
  return String(value ?? '').replace(/^\s*Unit\s*/i, '').trim()
}

const view = ref('cards')
const viewTabs = [
  { value: 'cards', label: 'Kartalar' },
  { value: 'table', label: 'Jadval' },
]

const selectedId = ref('')
const selected = computed<Unit | null>(
  () => myUnits.value.find((u) => u.id === selectedId.value) ?? myUnits.value[0] ?? null,
)
const selectedBuilding = computed(() =>
  selected.value ? (buildingById(selected.value.buildingId) ?? null) : null,
)
const selectedFloorUnits = computed(() =>
  selected.value ? unitsOfFloor(selected.value.buildingId, selected.value.floor) : [],
)
const selectedContract = computed(() =>
  selected.value?.contractCode
    ? CONTRACTS.find(
        (c) => c.code === selected.value?.contractCode && c.tenant === organization.value,
      )
    : undefined,
)

/** Unit bo‘yicha oxirgi hisob-faktura */
const selectedInvoice = computed(() => {
  const u = selected.value
  if (!u) return undefined
  return [...MY_INVOICES.value]
    .filter((i) => unitCodeOf(i.unitCode) === u.code)
    .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))[0]
})

const selectedRequests = computed(() =>
  selected.value && selectedBuilding.value
    ? SERVICE_REQUESTS.filter(
        (r) =>
          r.unitCode === selected.value?.code &&
          r.buildingName === selectedBuilding.value?.name,
      )
    : [],
)

const totalArea = computed(() => myUnits.value.reduce((acc, u) => acc + u.area, 0))

/** Joriy davr: hujjat bo‘lgan oxirgi hisob davri */
const currentPeriod = computed(() => {
  const thisMonth = monthTitle(todayIso())
  if (MY_INVOICES.value.some((i) => i.period === thisMonth)) return thisMonth
  return (
    [...MY_INVOICES.value].sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))[0]?.period ??
    thisMonth
  )
})

const monthlyTotal = computed(() =>
  MY_INVOICES.value
    .filter((i) => i.period === currentPeriod.value)
    .reduce((acc, i) => acc + i.total, 0),
)

function select(id: string) {
  selectedId.value = id
}

const columns = [
  { key: 'code', label: 'Unit' },
  { key: 'building', label: 'Obyekt' },
  { key: 'floor', label: 'Qavat', align: 'right' as const, numeric: true },
  { key: 'rooms', label: 'Xonalar', align: 'right' as const, numeric: true },
  { key: 'area', label: 'Maydon', align: 'right' as const, numeric: true },
  { key: 'usage', label: 'Tayinlanishi' },
  { key: 'contractCode', label: 'Shartnoma' },
  { key: 'status', label: 'Holat', align: 'right' as const },
]

const rows = computed(() =>
  myUnits.value.map((u) => ({
    id: u.id,
    code: u.code,
    building: buildingById(u.buildingId)?.name ?? '-',
    floor: u.floor,
    rooms: u.rooms,
    area: u.area,
    usage: u.usage,
    contractCode: u.contractCode ?? '-',
    status: u.status,
  })),
)

function planPoints(polygon: number[][]) {
  return polygon.map((p) => `${(p[0]! * 100).toFixed(1)},${(p[1]! * 100).toFixed(1)}`).join(' ')
}

function center(u: Unit) {
  const xs = u.polygon.map((p) => p[0]!)
  const ys = u.polygon.map((p) => p[1]!)
  return {
    x: ((Math.min(...xs) + Math.max(...xs)) / 2) * 100,
    y: ((Math.min(...ys) + Math.max(...ys)) / 2) * 100 + 2,
  }
}

const planOpen = ref(false)
</script>

<template>
  <AppTopbar
    title="Mening unitlarim"
    subtitle="Tashkilotingiz nomiga rasmiylashtirilgan maydonlar"
    :breadcrumb="[{ label: 'Kabinet', to: '/cabinet' }, { label: 'Mening unitlarim' }]"
  >
    <template #actions>
      <UiButton variant="secondary" size="sm" to="/cabinet/documents">
        <UiIcon name="doc" :size="16" />
        Hujjatlar
      </UiButton>
      <UiButton size="sm" to="/cabinet/apply">
        <UiIcon name="plus" :size="16" />
        Yangi maydon so‘rash
      </UiButton>
    </template>
  </AppTopbar>

  <main class="scroll-slim flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
    <UiCard v-if="!myUnits.length" flush>
      <UiEmpty
        icon="building"
        title="Biriktirilgan maydon yo‘q"
        :description="`${organization || 'Tashkilotingiz'} nomiga rasmiylashtirilgan unit topilmadi. Bo‘sh maydonlar katalogidan tanlab, ijaraga olish arizasini yuboring.`"
        action-label="Ijaraga olish arizasi"
        action-to="/cabinet/apply"
      />
    </UiCard>

    <template v-else-if="selected && selectedBuilding">
    <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <UiKpi label="Unitlar soni" :value="String(myUnits.length)" unit="ta" icon="building" tone="brand" />
      <UiKpi label="Umumiy maydon" :value="num(totalArea, 2)" unit="m²" icon="layers" tone="ok" />
      <UiKpi
        :label="`Hisoblangan to‘lov (${currentPeriod})`"
        :value="num(monthlyTotal)"
        unit="so‘m"
        icon="wallet"
        tone="violet"
      />
      <UiKpi label="Tashkilot" :value="organization" icon="user" tone="warn" />
    </section>

    <section class="flex flex-wrap items-center justify-between gap-3">
      <UiTabs v-model="view" :tabs="viewTabs" />
      <p class="text-[13px] text-ink-500">
        Unitni tanlang: pastda to‘liq tafsilotlar ochiladi.
      </p>
    </section>

    <section v-if="view === 'cards'" class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <!--
        `h-full` va `flex-col`: setkadagi kartochkalar bir qatorda bir xil
        balandlikda turadi, pastdagi o‘lcham qatori esa `mt-auto` bilan
        hamma joyda bir xil chiziqqa yopishadi.
      -->
      <button
        v-for="u in myUnits"
        :key="u.id"
        type="button"
        class="flex h-full flex-col rounded-card bg-surface p-4 text-left shadow-card ring-1 transition-shadow duration-150 hover:shadow-panel"
        :class="u.id === selected?.id ? 'ring-2 ring-brand-500' : 'ring-ink-200/60'"
        :aria-pressed="u.id === selected?.id"
        @click="select(u.id)"
      >
        <!-- Katalogdagi bilan bir xil qoida: holat nishonchasi doim yuqori chapda -->
        <div class="flex items-center gap-2">
          <UiStatus kind="unit" :value="u.status" size="sm" />
        </div>

        <p class="tabular mt-2.5 text-[18px] font-bold leading-tight text-ink-900">
          Unit {{ u.code }}
        </p>
        <p class="mt-0.5 truncate text-[13px] text-ink-500">
          {{ buildingById(u.buildingId)?.name }}
        </p>

        <div class="mt-3 overflow-hidden rounded-field bg-surface-sunken p-2.5 ring-1 ring-ink-200">
          <svg viewBox="0 0 100 100" class="block h-24 w-full" role="img" aria-label="Qavat rejasi">
            <rect x="2" y="2" width="96" height="96" rx="4" fill="#ffffff" stroke="#cbd4e3" stroke-width="1.4" />
            <rect x="2" y="46" width="96" height="10" fill="#f1f5fb" />
            <polygon
              v-for="fu in unitsOfFloor(u.buildingId, u.floor)"
              :key="fu.id"
              :points="planPoints(fu.polygon)"
              :fill="fu.id === u.id ? '#0256f7' : '#e8edf6'"
              :stroke="fu.id === u.id ? '#0139b0' : '#cbd4e3'"
              stroke-width="1.2"
            />
            <text
              :x="center(u).x"
              :y="center(u).y"
              text-anchor="middle"
              font-size="8"
              font-weight="700"
              fill="#ffffff"
            >
              {{ u.code }}
            </text>
          </svg>
        </div>

        <!--
          Pastki qator: maydon yetakchi raqam, qavat va xonalar undan
          yengilroq ohangda yonida turadi.
        -->
        <div class="mt-auto flex items-end justify-between gap-3 border-t border-ink-100 pt-3">
          <span class="tabular text-[18px] font-extrabold leading-none text-ink-900">
            {{ area(u.area) }}
          </span>
          <span class="tabular text-[13px] text-ink-500">
            {{ u.floor }}-qavat · {{ u.rooms }} xona
          </span>
        </div>
      </button>
    </section>

    <UiCard v-else flush>
      <UiTable :columns="columns" :rows="rows" @row-click="(row) => select(String(row.id))">
        <template #cell-code="{ row }">
          <span class="text-[14px] font-semibold text-ink-900">Unit {{ row.code }}</span>
        </template>
        <template #cell-area="{ value }">{{ area(Number(value)) }}</template>
        <template #cell-floor="{ value }">{{ value }}-qavat</template>
        <template #cell-status="{ row }">
          <UiStatus kind="unit" :value="String(row.status)" size="sm" />
        </template>
      </UiTable>
    </UiCard>

    <UiCard
      :title="`Unit ${selected.code}, tafsilotlar`"
      :subtitle="`${selectedBuilding.name} · ${selectedBuilding.district}`"
    >
      <template #actions>
        <div class="flex items-center gap-2">
          <UiButton variant="ghost" size="sm" @click="planOpen = true">
            <UiIcon name="eye" :size="15" />
            Rejani kattalashtirish
          </UiButton>
          <UiButton variant="secondary" size="sm" to="/cabinet/meters">
            <UiIcon name="meter" :size="15" />
            Hisoblagichlar
          </UiButton>
        </div>
      </template>

      <div class="grid gap-5 xl:grid-cols-3">
        <div>
          <div class="rounded-field bg-surface-sunken p-4 ring-1 ring-ink-200">
            <svg viewBox="0 0 100 100" class="block h-52 w-full" role="img" aria-label="Tanlangan unit rejasi">
              <rect x="2" y="2" width="96" height="96" rx="4" fill="#ffffff" stroke="#cbd4e3" stroke-width="1.4" />
              <rect x="2" y="46" width="96" height="10" fill="#f1f5fb" />
              <polygon
                v-for="fu in selectedFloorUnits"
                :key="fu.id"
                :points="planPoints(fu.polygon)"
                :fill="fu.id === selected.id ? '#0256f7' : '#e8edf6'"
                :stroke="fu.id === selected.id ? '#0139b0' : '#cbd4e3'"
                stroke-width="1.2"
              />
              <text
                :x="center(selected).x"
                :y="center(selected).y"
                text-anchor="middle"
                font-size="7"
                font-weight="700"
                fill="#ffffff"
              >
                {{ selected.code }}
              </text>
            </svg>
            <p class="mt-2 text-center text-[12px] text-ink-500">
              {{ selectedBuilding.name }} · {{ selected.floor }}-qavat
            </p>
          </div>

          <div class="mt-4">
            <p class="mb-2 text-[13px] font-semibold text-ink-700">Jihozlanishi</p>
            <ul class="flex flex-wrap gap-2">
              <li
                v-for="e in selected.equipment"
                :key="e"
                class="rounded-pill bg-ink-100 px-2.5 py-1 text-[12px] font-medium text-ink-700"
              >
                {{ e }}
              </li>
            </ul>
          </div>
        </div>

        <div class="space-y-4">
          <div>
            <p class="mb-2 text-[13px] font-semibold text-ink-700">Texnik ko‘rsatkichlar</p>
            <dl class="divide-y divide-ink-100 rounded-field ring-1 ring-ink-200">
              <div class="flex items-center justify-between px-4 py-2.5">
                <dt class="text-[13px] text-ink-500">Umumiy maydon</dt>
                <dd class="tabular text-[13px] font-bold text-ink-900">{{ area(selected.area) }}</dd>
              </div>
              <div class="flex items-center justify-between px-4 py-2.5">
                <dt class="text-[13px] text-ink-500">Qavat</dt>
                <dd class="tabular text-[13px] font-bold text-ink-900">{{ selected.floor }}-qavat</dd>
              </div>
              <div class="flex items-center justify-between px-4 py-2.5">
                <dt class="text-[13px] text-ink-500">Xonalar soni</dt>
                <dd class="tabular text-[13px] font-bold text-ink-900">{{ selected.rooms }} ta</dd>
              </div>
              <div class="flex items-center justify-between px-4 py-2.5">
                <dt class="text-[13px] text-ink-500">Tayinlanishi</dt>
                <dd class="text-[13px] font-bold text-ink-900">{{ selected.usage }}</dd>
              </div>
              <div class="flex items-center justify-between px-4 py-2.5">
                <dt class="text-[13px] text-ink-500">Holat</dt>
                <dd><UiStatus kind="unit" :value="selected.status" size="sm" /></dd>
              </div>
            </dl>
          </div>

          <div>
            <p class="mb-2 text-[13px] font-semibold text-ink-700">Shartnoma</p>
            <div class="rounded-field p-4 ring-1 ring-ink-200">
              <div class="flex items-center justify-between gap-3">
                <span class="text-[14px] font-bold text-ink-900">
                  {{ selected.contractCode ?? 'Shartnoma biriktirilmagan' }}
                </span>
                <UiStatus
                  v-if="selectedContract"
                  kind="contract"
                  :value="selectedContract.status"
                  size="sm"
                />
              </div>
              <dl v-if="selectedContract" class="mt-3 space-y-1.5">
                <div class="flex items-center justify-between">
                  <dt class="text-[13px] text-ink-500">Muddat</dt>
                  <dd class="tabular text-[13px] font-semibold text-ink-800">
                    {{ dateShort(selectedContract.startsAt) }} · {{ dateShort(selectedContract.endsAt) }}
                  </dd>
                </div>
                <div class="flex items-center justify-between">
                  <dt class="text-[13px] text-ink-500">To‘lov shartlari</dt>
                  <dd class="text-[13px] font-semibold text-ink-800">
                    {{ selectedContract.paymentTerm }}
                  </dd>
                </div>
                <div class="flex items-center justify-between">
                  <dt class="text-[13px] text-ink-500">Oylik ijara to‘lovi</dt>
                  <dd class="tabular text-[13px] font-semibold text-ink-800">
                    {{ selected.priceUnit === 'so‘m / oy' ? sum(selected.price) : '-' }}
                  </dd>
                </div>
                <div class="flex items-center justify-between">
                  <dt class="text-[13px] text-ink-500">Shartnoma summasi</dt>
                  <dd class="tabular text-[13px] font-semibold text-ink-800">
                    {{ sum(selectedContract.amount) }}
                  </dd>
                </div>
              </dl>
              <p v-else class="mt-2 text-[13px] text-ink-500">
                Shartnoma nusxasi hujjatlar bo‘limida saqlanadi.
              </p>
              <UiButton variant="secondary" size="sm" class="mt-3" block to="/cabinet/documents">
                <UiIcon name="doc" :size="15" />
                Shartnoma nusxasini ochish
              </UiButton>
            </div>
          </div>
        </div>

        <div class="space-y-4">
          <div>
            <p class="mb-2 text-[13px] font-semibold text-ink-700">To‘lov holati</p>
            <div v-if="selectedInvoice" class="rounded-field p-4 ring-1 ring-ink-200">
              <div class="flex items-center justify-between gap-3">
                <span class="text-[14px] font-bold text-ink-900">{{ selectedInvoice.code }}</span>
                <UiStatus kind="invoice" :value="selectedInvoice.status" size="sm" />
              </div>
              <p class="tabular mt-2 text-[22px] font-bold leading-none text-ink-900">
                {{ num(selectedInvoice.total) }}
                <span class="text-[13px] font-medium text-ink-500">so‘m</span>
              </p>
              <div class="mt-3 space-y-1.5">
                <div class="flex items-center justify-between">
                  <span class="text-[13px] text-ink-500">To‘langan</span>
                  <span class="tabular text-[13px] font-semibold text-ok-700">
                    {{ sum(selectedInvoice.paid) }}
                  </span>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-[13px] text-ink-500">Qoldiq</span>
                  <span class="tabular text-[13px] font-semibold text-ink-900">
                    {{ sum(selectedInvoice.total - selectedInvoice.paid) }}
                  </span>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-[13px] text-ink-500">To‘lov muddati</span>
                  <span class="tabular text-[13px] font-semibold text-ink-900">
                    {{ dateShort(selectedInvoice.dueAt) }}
                  </span>
                </div>
              </div>
              <UiButton variant="secondary" size="sm" class="mt-3" block to="/cabinet/invoices">
                <UiIcon name="wallet" :size="15" />
                To‘lovlar tarixi
              </UiButton>
            </div>
            <p v-else class="rounded-field px-4 py-6 text-center text-[13px] text-ink-500 ring-1 ring-ink-200">
              Joriy davr uchun hisob-faktura shakllantirilmagan
            </p>
          </div>

          <div>
            <p class="mb-2 text-[13px] font-semibold text-ink-700">Servis tarixi</p>
            <ul v-if="selectedRequests.length" class="divide-y divide-ink-100 rounded-field ring-1 ring-ink-200">
              <li v-for="r in selectedRequests" :key="r.id" class="px-4 py-2.5">
                <div class="flex items-center justify-between gap-3">
                  <span class="min-w-0">
                    <span class="block truncate text-[13px] font-semibold text-ink-900">{{ r.title }}</span>
                    <span class="block truncate text-[12px] text-ink-500">{{ r.code }} · {{ r.createdAt }}</span>
                  </span>
                  <UiStatus kind="service" :value="r.status" size="sm" />
                </div>
              </li>
            </ul>
            <p v-else class="rounded-field px-4 py-6 text-center text-[13px] text-ink-500 ring-1 ring-ink-200">
              Bu unit bo‘yicha servis arizalari yo‘q
            </p>
          </div>
        </div>
      </div>
    </UiCard>
    </template>
  </main>

  <UiModal
    v-if="selected && selectedBuilding"
    v-model="planOpen"
    :title="`${selected.floor}-qavat rejasi`"
    :subtitle="`${selectedBuilding.name} · Unit ${selected.code} ajratib ko‘rsatilgan`"
    size="lg"
  >
    <svg viewBox="0 0 100 100" class="block h-[420px] w-full" role="img" aria-label="Kattalashtirilgan qavat rejasi">
      <rect x="2" y="2" width="96" height="96" rx="3" fill="#ffffff" stroke="#cbd4e3" stroke-width="0.8" />
      <rect x="2" y="46" width="96" height="10" fill="#f8fafd" />
      <polygon
        v-for="fu in selectedFloorUnits"
        :key="fu.id"
        :points="planPoints(fu.polygon)"
        :fill="fu.id === selected.id ? '#0256f7' : '#eef2f8'"
        :stroke="fu.id === selected.id ? '#0139b0' : '#cbd4e3'"
        stroke-width="0.6"
      />
      <text
        v-for="fu in selectedFloorUnits"
        :key="`t-${fu.id}`"
        :x="center(fu).x"
        :y="center(fu).y"
        text-anchor="middle"
        font-size="4"
        font-weight="700"
        :fill="fu.id === selected.id ? '#ffffff' : '#64748b'"
      >
        {{ fu.code }}
      </text>
    </svg>

    <template #footer>
      <UiButton variant="ghost" @click="planOpen = false">Yopish</UiButton>
    </template>
  </UiModal>
</template>
