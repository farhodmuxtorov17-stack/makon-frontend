<script setup lang="ts">
import { buildingById } from '~/data/buildings'
import { unitById, unitsOfFloor } from '~/data/units'
import { CONTRACTS } from '~/data/business'
import { SERVICE_REQUESTS, type ServiceRequest } from '~/data/operations'
import { area, dateLong, dateShort, num, sum } from '~/utils/format'

const auth = useAuthStore()

const TODAY = '2025-05-18'

const myUnits = [unitById('u-501')!, unitById('u-502')!]
const myUnit = myUnits[0]!
const myBuilding = buildingById(myUnit.buildingId)!
const myContract = CONTRACTS.find((c) => c.code === myUnit.contractCode)!
const floorUnits = unitsOfFloor(myUnit.buildingId, myUnit.floor)

const firstName = computed(() => (auth.user?.fullName ?? 'Dilshod Ergashev').split(' ')[0])
const fullName = computed(() => auth.user?.fullName ?? 'Dilshod Ergashev')
const organization = computed(() => auth.user?.organization ?? 'Urban Office MCHJ')

const MY_INVOICES = [
  {
    id: 'i-0605',
    code: 'INV-2025-0605',
    unitCode: '501',
    period: 'May 2025',
    issuedAt: '2025-05-01',
    dueAt: '2025-05-25',
    total: 25900000,
    paid: 12000000,
    status: 'PARTIALLY_PAID',
  },
  {
    id: 'i-0587',
    code: 'INV-2025-0587',
    unitCode: '502',
    period: 'May 2025',
    issuedAt: '2025-05-01',
    dueAt: '2025-05-10',
    total: 12540000,
    paid: 12540000,
    status: 'PAID',
  },
  {
    id: 'i-0498',
    code: 'INV-2025-0498',
    unitCode: '501',
    period: 'Aprel 2025',
    issuedAt: '2025-04-01',
    dueAt: '2025-04-25',
    total: 25900000,
    paid: 25900000,
    status: 'PAID',
  },
]

const currentInvoice = MY_INVOICES[0]!
const overdueTotal = MY_INVOICES.filter((i) => i.status === 'OVERDUE').reduce(
  (acc, i) => acc + (i.total - i.paid),
  0,
)
const overdueCount = MY_INVOICES.filter((i) => i.status === 'OVERDUE').length
const nextDueAt = currentInvoice.dueAt

const invoiceColumns = [
  { key: 'issuedAt', label: 'Sana' },
  { key: 'code', label: 'Hisob-faktura №' },
  { key: 'period', label: 'Davr' },
  { key: 'total', label: 'Summa', align: 'right' as const, numeric: true },
  { key: 'status', label: 'Holat', align: 'right' as const },
]

type CabinetRequest = ServiceRequest & { attachments?: string[] }

const myUnitCodes = myUnits.map((u) => u.code)

const requests = ref<CabinetRequest[]>(
  SERVICE_REQUESTS.filter(
    (r) =>
      r.buildingName === myBuilding.name &&
      (myUnitCodes.includes(r.unitCode) ||
        r.requester === organization.value ||
        r.requester === fullName.value),
  ).map((r) => ({ ...r })),
)

const selectedRequest = ref<CabinetRequest | null>(null)
const requestOpen = ref(false)
const newRequestOpen = ref(false)
const createdCode = ref('')
const attachments = ref<string[]>([])

const form = reactive({
  title: '',
  category: 'Santexnika',
  priority: 'O‘rtacha',
  description: '',
})
const formError = ref('')

const categoryOptions = [
  { value: 'Santexnika', label: 'Santexnika' },
  { value: 'Elektr', label: 'Elektr' },
  { value: 'Konditsioner', label: 'Konditsioner' },
  { value: 'Qurilish', label: 'Qurilish' },
  { value: 'Tozalash', label: 'Tozalash' },
  { value: 'Boshqa', label: 'Boshqa' },
]

const priorityOptions = [
  { value: 'Past', label: 'Past' },
  { value: 'O‘rtacha', label: 'O‘rtacha' },
  { value: 'Yuqori', label: 'Yuqori' },
]

const CATEGORY_ICON: Record<string, string> = {
  Santexnika: 'meter',
  Elektr: 'sparkle',
  Konditsioner: 'refresh',
  Qurilish: 'layers',
  Tozalash: 'box',
  Boshqa: 'wrench',
}

function openRequest(r: CabinetRequest) {
  selectedRequest.value = r
  requestOpen.value = true
}

function addAttachment() {
  attachments.value.push(`Unit-${myUnit.code}-rasm-${attachments.value.length + 1}.jpg`)
  newRequestOpen.value = true
}

function removeAttachment(index: number) {
  attachments.value.splice(index, 1)
}

function submitRequest() {
  if (form.title.trim().length < 4) {
    formError.value = 'Ariza mavzusini kamida 4 ta belgidan iborat qilib yozing'
    return
  }
  formError.value = ''
  const nextNumber = 713 + requests.value.length
  const code = `SR-2025-0${nextNumber}`
  requests.value.unshift({
    id: `s-0${nextNumber}`,
    code,
    title: form.title.trim(),
    category: form.category as ServiceRequest['category'],
    buildingName: myBuilding.name,
    unitCode: myUnit.code,
    requester: organization.value,
    priority: form.priority as ServiceRequest['priority'],
    status: 'NEW',
    assignee: null,
    createdAt: `${TODAY} 09:00`,
    dueAt: '2025-05-25',
    slaBreached: false,
    description: form.description.trim() || 'Qo‘shimcha izoh ko‘rsatilmagan.',
    progress: 0,
    attachments: [...attachments.value],
  })
  createdCode.value = code
  form.title = ''
  form.description = ''
  attachments.value = []
  newRequestOpen.value = false
}

const documents = [
  { id: 'd-1', name: 'Ijara shartnomasi', code: myContract.code, size: '2.1 MB', at: '2025-04-02' },
  { id: 'd-2', name: 'Hisob-faktura', code: currentInvoice.code, size: '208 KB', at: '2025-05-01' },
  { id: 'd-3', name: 'To‘lov rekvizitlari', code: 'REK-2025-0044', size: '320 KB', at: '2025-01-15' },
  { id: 'd-4', name: 'Bino ichki tartib-qoidalari', code: 'QDL-2025-0007', size: '640 KB', at: '2025-01-15' },
]

const docOpen = ref(false)
const selectedDoc = ref<(typeof documents)[number] | null>(null)
const docReady = ref(false)

function openDoc(d: (typeof documents)[number]) {
  selectedDoc.value = d
  docReady.value = false
  docOpen.value = true
}

const meters = [
  {
    id: 'mt-suv',
    label: 'Suv',
    unit: 'm³',
    icon: 'meter',
    tone: 'brand',
    last: 125.4,
    previous: 118.2,
    readAt: '2025-05-18',
  },
  {
    id: 'mt-elektr',
    label: 'Elektr',
    unit: 'kVt-soat',
    icon: 'sparkle',
    tone: 'warn',
    last: 1245.6,
    previous: 1198.3,
    readAt: '2025-05-18',
  },
  {
    id: 'mt-issiqlik',
    label: 'Issiqlik',
    unit: 'Gkal',
    icon: 'refresh',
    tone: 'danger',
    last: 63.2,
    previous: 58.1,
    readAt: '2025-05-18',
  },
]

const METER_TONE: Record<string, string> = {
  brand: 'bg-brand-50 text-brand-600',
  warn: 'bg-warn-50 text-warn-600',
  danger: 'bg-danger-50 text-danger-600',
}

function planPoints(polygon: number[][]) {
  return polygon.map((p) => `${(p[0]! * 100).toFixed(1)},${(p[1]! * 100).toFixed(1)}`).join(' ')
}

const myPlanCenter = computed(() => {
  const xs = myUnit.polygon.map((p) => p[0]!)
  const ys = myUnit.polygon.map((p) => p[1]!)
  return {
    x: ((Math.min(...xs) + Math.max(...xs)) / 2) * 100,
    y: ((Math.min(...ys) + Math.max(...ys)) / 2) * 100 + 2,
  }
})
</script>

<template>
  <AppTopbar :title="`Xush kelibsiz, ${firstName}`" :subtitle="`Bugun ${dateLong(TODAY)}`">
    <template #actions>
      <UiButton variant="secondary" size="sm" to="/cabinet/invoices">
        <UiIcon name="wallet" :size="16" />
        To‘lovlarim
      </UiButton>
      <UiButton size="sm" @click="newRequestOpen = true">
        <UiIcon name="plus" :size="16" />
        Yangi ariza
      </UiButton>
    </template>
  </AppTopbar>

  <main class="scroll-slim flex-1 space-y-5 overflow-y-auto p-6">
    <div
      v-if="createdCode"
      class="flex items-center gap-3 rounded-card bg-ok-50 px-5 py-3.5 ring-1 ring-ok-100"
    >
      <span class="grid size-9 shrink-0 place-items-center rounded-[10px] bg-ok-500 text-white">
        <UiIcon name="check" :size="18" />
      </span>
      <p class="min-w-0 flex-1 text-[13.5px] text-ok-700">
        <b>{{ createdCode }}</b> raqamli servis arizangiz qabul qilindi va bino xizmatiga yuborildi.
      </p>
      <button
        type="button"
        class="rounded-lg p-1.5 text-ok-700 transition-colors hover:bg-ok-100"
        aria-label="Xabarni yopish"
        @click="createdCode = ''"
      >
        <UiIcon name="x" :size="16" />
      </button>
    </div>

    <section class="grid gap-5 xl:grid-cols-2">
      <UiCard title="Mening unitim" subtitle="Ijaraga olingan asosiy maydon">
        <template #actions>
          <UiButton variant="ghost" size="sm" to="/cabinet/units">
            Barchasi
            <UiIcon name="chevronRight" :size="15" />
          </UiButton>
        </template>

        <div class="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
          <div class="overflow-hidden rounded-field bg-surface-sunken ring-1 ring-ink-200">
            <svg
              viewBox="0 0 320 210"
              preserveAspectRatio="xMidYMid slice"
              class="block h-full min-h-[200px] w-full"
              role="img"
              aria-label="Unit ichki ko‘rinishi"
            >
              <defs>
                <clipPath id="cabRoomClip">
                  <rect width="320" height="210" rx="12" />
                </clipPath>
                <linearGradient id="cabWall" x1="0" y1="0" x2="0" y2="1">
                  <stop stop-color="#f8fafd" />
                  <stop offset="1" stop-color="#eef2f8" />
                </linearGradient>
                <linearGradient id="cabSky" x1="0" y1="0" x2="0" y2="1">
                  <stop stop-color="#e0eaff" />
                  <stop offset="1" stop-color="#d3f4ea" />
                </linearGradient>
              </defs>

              <g clip-path="url(#cabRoomClip)">
                <rect width="320" height="210" fill="url(#cabWall)" />
                <rect y="152" width="320" height="58" fill="#e5ebf5" />
                <path d="M0 152h320" stroke="#cbd4e3" stroke-width="1.6" />
                <ellipse cx="146" cy="182" rx="112" ry="18" fill="#dfe7f4" />

                <rect x="26" y="28" width="118" height="94" rx="6" fill="url(#cabSky)" stroke="#cbd4e3" stroke-width="2" />
                <path d="M85 28v94M26 75h118" stroke="#cbd4e3" stroke-width="1.6" />
                <path d="M36 108c14-22 26-14 34-26 9-13 22-6 30 4 6 8 14 10 22 6v30H36z" fill="#c7d9fe" opacity=".7" />

                <path d="M196 16v26" stroke="#94a2b8" stroke-width="2" stroke-linecap="round" />
                <path d="M180 42h32l-7 15h-18z" fill="#0256f7" />
                <circle cx="196" cy="62" r="3" fill="#faa53f" />

                <rect x="234" y="40" width="52" height="38" rx="4" fill="#ffffff" stroke="#cbd4e3" stroke-width="2" />
                <path d="M239 72l12-15 8 9 7-7 15 13z" fill="#a1bffd" />

                <rect x="34" y="118" width="112" height="26" rx="8" fill="#c7d9fe" />
                <rect x="26" y="134" width="128" height="24" rx="9" fill="#a1bffd" />
                <rect x="22" y="128" width="13" height="32" rx="6" fill="#739afa" />
                <rect x="145" y="128" width="13" height="32" rx="6" fill="#739afa" />
                <rect x="46" y="122" width="26" height="18" rx="5" fill="#eef4ff" />
                <rect x="108" y="122" width="26" height="18" rx="5" fill="#eef4ff" />

                <rect x="176" y="142" width="76" height="7" rx="3.5" fill="#94a2b8" />
                <path d="M184 149v14M244 149v14" stroke="#94a2b8" stroke-width="3" stroke-linecap="round" />
                <rect x="196" y="132" width="34" height="10" rx="3" fill="#16b99a" />

                <path d="M272 154h30l-4 26h-22z" fill="#faa53f" />
                <path d="M287 154c-12-4-18-14-16-26 12 1 19 9 20 20 3-11 11-18 22-18 1 13-8 23-22 24z" fill="#16b99a" />
              </g>
            </svg>
          </div>

          <div class="flex flex-col">
            <div class="rounded-field bg-surface-sunken p-3 ring-1 ring-ink-200">
              <svg viewBox="0 0 100 100" class="block h-32 w-full" role="img" aria-label="Qavat rejasi">
                <rect x="2" y="2" width="96" height="96" rx="4" fill="#ffffff" stroke="#cbd4e3" stroke-width="1.4" />
                <rect x="2" y="44" width="96" height="12" fill="#f1f5fb" />
                <polygon
                  v-for="u in floorUnits"
                  :key="u.id"
                  :points="planPoints(u.polygon)"
                  :fill="u.id === myUnit.id ? '#0256f7' : '#e8edf6'"
                  :stroke="u.id === myUnit.id ? '#0139b0' : '#cbd4e3'"
                  stroke-width="1.2"
                />
                <text
                  :x="myPlanCenter.x"
                  :y="myPlanCenter.y"
                  text-anchor="middle"
                  font-size="8"
                  font-weight="700"
                  fill="#ffffff"
                >
                  {{ myUnit.code }}
                </text>
              </svg>
              <p class="mt-2 text-center text-[11.5px] text-ink-500">
                {{ myUnit.floor }}-qavat rejasi
              </p>
            </div>

            <div class="mt-3.5 flex items-center gap-2.5">
              <h4 class="text-[19px] font-bold text-ink-900">Unit {{ myUnit.code }}</h4>
              <UiStatus kind="unit" :value="myUnit.status" size="sm" />
            </div>
            <p class="mt-1 text-[13px] text-ink-600">{{ myUnit.tenant ?? organization }}</p>
            <p class="text-[12.5px] text-ink-500">
              {{ myBuilding.name }} · {{ myUnit.floor }}-qavat, {{ myUnit.rooms }} xona
            </p>

            <dl class="mt-3 divide-y divide-ink-100 border-t border-ink-100">
              <div class="flex items-center justify-between py-2">
                <dt class="text-[12.5px] text-ink-500">Umumiy maydon</dt>
                <dd class="tabular text-[13px] font-bold text-ink-900">{{ area(myUnit.area) }}</dd>
              </div>
              <div class="flex items-center justify-between py-2">
                <dt class="text-[12.5px] text-ink-500">Ijara boshlangan sana</dt>
                <dd class="tabular text-[13px] font-bold text-ink-900">
                  {{ dateShort(myContract.startsAt) }}
                </dd>
              </div>
              <div class="flex items-center justify-between py-2">
                <dt class="text-[12.5px] text-ink-500">Shartnoma yakunlanish sanasi</dt>
                <dd class="tabular text-[13px] font-bold text-ink-900">
                  {{ dateShort(myContract.endsAt) }}
                </dd>
              </div>
              <div class="flex items-center justify-between py-2">
                <dt class="text-[12.5px] text-ink-500">Shartnoma holati</dt>
                <dd><UiStatus kind="contract" :value="myContract.status" size="sm" /></dd>
              </div>
            </dl>

            <UiButton variant="secondary" size="sm" class="mt-3.5" block to="/cabinet/units">
              Unit tafsiloti
              <UiIcon name="chevronRight" :size="15" />
            </UiButton>
          </div>
        </div>
      </UiCard>

      <UiCard title="To‘lov holati" subtitle="Joriy davr bo‘yicha hisob-kitob" flush>
        <template #actions>
          <UiButton variant="ghost" size="sm" to="/cabinet/invoices">
            Barchasini ko‘rish
            <UiIcon name="chevronRight" :size="15" />
          </UiButton>
        </template>

        <div class="space-y-4 px-5 pb-5">
          <div class="flex items-center gap-3 rounded-field bg-ok-50 px-4 py-3 ring-1 ring-ok-100">
            <span class="grid size-9 shrink-0 place-items-center rounded-[10px] bg-ok-500 text-white">
              <UiIcon name="check" :size="18" />
            </span>
            <p class="min-w-0 flex-1 text-[13px] font-semibold text-ok-700">
              Muddati o‘tgan qarzdorlik yo‘q
              <span class="block font-normal text-ok-600">
                Keyingi to‘lov muddati — {{ dateShort(nextDueAt) }}
              </span>
            </p>
          </div>

          <div class="grid gap-3 sm:grid-cols-2">
            <div class="rounded-field p-4 ring-1 ring-ink-200">
              <p class="text-[12.5px] text-ink-500">Joriy oy ijara to‘lovi</p>
              <p class="tabular mt-1.5 text-[22px] font-bold leading-none text-ink-900">
                {{ num(currentInvoice.total) }}
                <span class="text-[13px] font-medium text-ink-500">so‘m</span>
              </p>
              <div class="mt-2.5">
                <UiStatus kind="invoice" :value="currentInvoice.status" size="sm" />
              </div>
              <p class="mt-2 text-[12px] text-ink-500">
                To‘lov muddati: {{ dateShort(currentInvoice.dueAt) }}
              </p>
            </div>

            <div class="rounded-field p-4 ring-1 ring-ink-200">
              <p class="text-[12.5px] text-ink-500">Qarzdorlik summasi</p>
              <p class="tabular mt-1.5 text-[22px] font-bold leading-none text-ink-900">
                {{ num(overdueTotal) }}
                <span class="text-[13px] font-medium text-ink-500">so‘m</span>
              </p>
              <div class="mt-2.5">
                <span
                  class="inline-flex items-center gap-1.5 rounded-pill bg-ok-50 px-2 py-0.5 text-[11px] font-semibold text-ok-700 ring-1 ring-inset ring-ok-100"
                >
                  <UiIcon name="check" :size="12" />
                  Qarzdorlik yo‘q
                </span>
              </div>
              <p class="mt-2 text-[12px] text-ink-500">
                Muddati o‘tgan hisob-fakturalar: {{ overdueCount }} ta
              </p>
            </div>
          </div>

          <div>
            <p class="mb-2 text-[13px] font-semibold text-ink-700">So‘nggi hisob-fakturalar</p>
            <div class="overflow-hidden rounded-field ring-1 ring-ink-200">
              <UiTable
                :columns="invoiceColumns"
                :rows="MY_INVOICES"
                :to="() => '/cabinet/invoices'"
              >
                <template #cell-issuedAt="{ value }">
                  <span class="tabular text-[13px]">{{ dateShort(String(value)) }}</span>
                </template>
                <template #cell-code="{ row }">
                  <span class="text-[13px] font-semibold text-ink-900">{{ row.code }}</span>
                </template>
                <template #cell-total="{ value }">
                  {{ sum(Number(value)) }}
                </template>
                <template #cell-status="{ row }">
                  <UiStatus kind="invoice" :value="String(row.status)" size="sm" />
                </template>
              </UiTable>
            </div>
          </div>
        </div>
      </UiCard>
    </section>

    <section class="grid gap-5 xl:grid-cols-3">
      <UiCard title="Faol servis arizalarim" subtitle="Tashkilotingiz yuborgan murojaatlar" flush>
        <template #actions>
          <span class="rounded-pill bg-brand-50 px-2.5 py-1 text-[12px] font-bold text-brand-700">
            {{ requests.length }} ta
          </span>
        </template>

        <ul class="divide-y divide-ink-100">
          <li v-for="r in requests" :key="r.id">
            <button
              type="button"
              class="flex w-full items-center gap-3.5 px-5 py-3.5 text-left transition-colors hover:bg-brand-50/50"
              @click="openRequest(r)"
            >
              <span class="grid size-10 shrink-0 place-items-center rounded-[10px] bg-brand-50 text-brand-600">
                <UiIcon :name="CATEGORY_ICON[r.category] ?? 'wrench'" :size="18" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-[13.5px] font-semibold text-ink-900">
                  {{ r.title }}
                </span>
                <span class="block truncate text-[12px] text-ink-500">
                  {{ r.code }} · {{ r.createdAt }}
                </span>
              </span>
              <UiStatus kind="service" :value="r.status" size="sm" />
              <UiIcon name="chevronRight" :size="16" class="shrink-0 text-ink-400" />
            </button>
          </li>
          <li v-if="!requests.length" class="px-5 py-10 text-center text-[13px] text-ink-500">
            Ochiq servis arizasi yo‘q
          </li>
        </ul>

        <div class="flex flex-wrap gap-3 p-5 pt-4">
          <UiButton class="min-w-[196px] flex-1" @click="newRequestOpen = true">
            <UiIcon name="plus" :size="17" />
            Yangi ariza yaratish
          </UiButton>
          <button
            type="button"
            class="flex h-11 min-w-[168px] flex-1 items-center gap-2.5 rounded-field border border-dashed border-ink-300 px-3.5 text-left transition-colors hover:border-brand-400 hover:bg-brand-50"
            @click="addAttachment"
          >
            <UiIcon name="image" :size="18" class="shrink-0 text-ink-400" />
            <span class="min-w-0">
              <span class="block truncate text-[12.5px] font-semibold leading-tight text-ink-800">
                Rasm qo‘shish
              </span>
              <span class="block truncate text-[11px] leading-tight text-ink-500">
                JPG, PNG (max 10MB)
              </span>
            </span>
          </button>
        </div>
      </UiCard>

      <UiCard title="Hujjatlarim" subtitle="Shartnoma va rasmiy hujjatlar" flush>
        <template #actions>
          <UiButton variant="ghost" size="sm" to="/cabinet/documents">
            Barchasi
            <UiIcon name="chevronRight" :size="15" />
          </UiButton>
        </template>

        <ul class="divide-y divide-ink-100">
          <li v-for="d in documents" :key="d.id" class="flex items-center gap-3.5 px-5 py-3.5">
            <span class="grid size-10 shrink-0 place-items-center rounded-[10px] bg-danger-50 text-danger-600">
              <UiIcon name="doc" :size="18" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-[13.5px] font-semibold text-ink-900">{{ d.name }}</span>
              <span class="block truncate text-[12px] text-ink-500">
                PDF · {{ d.size }} · {{ dateShort(d.at) }}
              </span>
            </span>
            <button
              type="button"
              class="grid size-9 shrink-0 place-items-center rounded-field text-brand-600 transition-colors hover:bg-brand-50"
              :aria-label="`${d.name} — yuklab olish`"
              @click="openDoc(d)"
            >
              <UiIcon name="download" :size="18" />
            </button>
          </li>
        </ul>
      </UiCard>

      <UiCard title="Hisoblagich ko‘rsatkichlari" subtitle="Oxirgi olingan qiymatlar" flush>
        <template #actions>
          <UiButton variant="ghost" size="sm" to="/cabinet/meters">
            Barchasi
            <UiIcon name="chevronRight" :size="15" />
          </UiButton>
        </template>

        <div class="space-y-3 px-5 pb-4">
          <NuxtLink
            v-for="m in meters"
            :key="m.id"
            to="/cabinet/meters"
            class="flex items-center gap-3.5 rounded-field p-3.5 ring-1 ring-ink-200 transition-all hover:shadow-card hover:ring-brand-300"
          >
            <span class="grid size-10 shrink-0 place-items-center rounded-[10px]" :class="METER_TONE[m.tone]">
              <UiIcon :name="m.icon" :size="18" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block text-[12px] text-ink-500">{{ m.label }} ({{ m.unit }})</span>
              <span class="tabular block text-[15px] font-bold text-ink-900">
                {{ num(m.last, 2) }} {{ m.unit }}
              </span>
              <span class="tabular block text-[12px] text-ink-500">
                Oldingi: {{ num(m.previous, 2) }} {{ m.unit }}
              </span>
            </span>
            <span class="shrink-0 text-right">
              <span class="tabular block text-[13px] font-bold text-brand-600">
                +{{ num(m.last - m.previous, 2) }}
              </span>
              <span class="tabular block text-[11.5px] text-ink-500">{{ dateShort(m.readAt) }}</span>
            </span>
          </NuxtLink>
        </div>

        <div class="mx-5 mb-5 flex items-start gap-2.5 rounded-field bg-brand-50 px-3.5 py-3">
          <UiIcon name="info" :size="16" class="mt-0.5 shrink-0 text-brand-600" />
          <p class="text-[12px] leading-snug text-brand-700">
            Ko‘rsatkichlar har oyning 18-sanasida yangilanadi. Qiymatni o‘zingiz ham kiritishingiz
            mumkin.
          </p>
        </div>
      </UiCard>
    </section>
  </main>

  <UiModal
    v-model="requestOpen"
    :title="selectedRequest?.title ?? 'Servis arizasi'"
    :subtitle="selectedRequest ? `${selectedRequest.code} · ${selectedRequest.buildingName}` : ''"
  >
    <div v-if="selectedRequest" class="space-y-4">
      <div class="flex flex-wrap items-center gap-2.5">
        <UiStatus kind="service" :value="selectedRequest.status" />
        <span class="rounded-pill bg-ink-100 px-2.5 py-1 text-[12px] font-semibold text-ink-700">
          {{ selectedRequest.category }}
        </span>
        <span class="rounded-pill bg-warn-50 px-2.5 py-1 text-[12px] font-semibold text-warn-700">
          Prioritet: {{ selectedRequest.priority }}
        </span>
      </div>

      <p class="text-[13.5px] leading-relaxed text-ink-700">{{ selectedRequest.description }}</p>

      <dl class="divide-y divide-ink-100 rounded-field ring-1 ring-ink-200">
        <div class="flex items-center justify-between px-4 py-2.5">
          <dt class="text-[12.5px] text-ink-500">Unit</dt>
          <dd class="text-[13px] font-semibold text-ink-900">{{ selectedRequest.unitCode }}</dd>
        </div>
        <div class="flex items-center justify-between px-4 py-2.5">
          <dt class="text-[12.5px] text-ink-500">Yaratilgan</dt>
          <dd class="tabular text-[13px] font-semibold text-ink-900">{{ selectedRequest.createdAt }}</dd>
        </div>
        <div class="flex items-center justify-between px-4 py-2.5">
          <dt class="text-[12.5px] text-ink-500">Bajarilish muddati</dt>
          <dd class="tabular text-[13px] font-semibold text-ink-900">
            {{ dateShort(selectedRequest.dueAt) }}
          </dd>
        </div>
        <div class="flex items-center justify-between px-4 py-2.5">
          <dt class="text-[12.5px] text-ink-500">Mas’ul xodim</dt>
          <dd class="text-[13px] font-semibold text-ink-900">
            {{ selectedRequest.assignee ?? 'Biriktirilmagan' }}
          </dd>
        </div>
      </dl>

      <div v-if="selectedRequest.attachments?.length">
        <p class="mb-1.5 text-[12.5px] text-ink-500">Biriktirilgan rasmlar</p>
        <ul class="flex flex-wrap gap-2">
          <li
            v-for="a in selectedRequest.attachments"
            :key="a"
            class="inline-flex items-center gap-1.5 rounded-pill bg-ink-100 px-2.5 py-1 text-[12px] font-medium text-ink-700"
          >
            <UiIcon name="image" :size="13" />
            {{ a }}
          </li>
        </ul>
      </div>

      <div>
        <div class="mb-1.5 flex items-center justify-between">
          <span class="text-[12.5px] text-ink-500">Bajarilish darajasi</span>
          <span class="tabular text-[13px] font-bold text-ink-900">{{ selectedRequest.progress }}%</span>
        </div>
        <div class="h-2 overflow-hidden rounded-pill bg-ink-100">
          <div class="h-full rounded-pill bg-brand-500" :style="{ width: `${selectedRequest.progress}%` }" />
        </div>
      </div>
    </div>

    <template #footer>
      <UiButton variant="ghost" @click="requestOpen = false">Yopish</UiButton>
      <UiButton
        variant="secondary"
        @click="
          () => {
            requestOpen = false
            newRequestOpen = true
          }
        "
      >
        <UiIcon name="plus" :size="16" />
        Yangi ariza
      </UiButton>
    </template>
  </UiModal>

  <UiModal
    v-model="newRequestOpen"
    title="Yangi servis arizasi"
    :subtitle="`${myBuilding.name} · Unit ${myUnit.code}`"
  >
    <div class="space-y-4">
      <UiField label="Ariza mavzusi" required :error="formError">
        <UiInput v-model="form.title" placeholder="Masalan: sanuzelda suv oqmoqda" :invalid="!!formError" />
      </UiField>

      <div class="grid gap-4 sm:grid-cols-2">
        <UiField label="Kategoriya" required>
          <UiSelect v-model="form.category" :options="categoryOptions" />
        </UiField>
        <UiField label="Prioritet" required>
          <UiSelect v-model="form.priority" :options="priorityOptions" />
        </UiField>
      </div>

      <UiField label="Batafsil izoh" hint="Muammoni imkon qadar aniq tasvirlab bering">
        <textarea
          v-model="form.description"
          rows="4"
          placeholder="Qo‘shimcha ma’lumot"
          class="w-full rounded-field bg-white px-3.5 py-2.5 text-sm text-ink-800 ring-1 ring-inset ring-ink-200 transition-colors placeholder:text-ink-400 hover:ring-ink-300 focus:ring-2 focus:ring-brand-500"
        />
      </UiField>

      <UiField label="Rasm qo‘shish" hint="JPG, PNG (max 10MB)">
        <div class="space-y-2">
          <ul v-if="attachments.length" class="space-y-1.5">
            <li
              v-for="(a, i) in attachments"
              :key="a"
              class="flex items-center gap-2.5 rounded-field px-3 py-2 ring-1 ring-ink-200"
            >
              <UiIcon name="image" :size="16" class="shrink-0 text-brand-600" />
              <span class="min-w-0 flex-1 truncate text-[12.5px] text-ink-700">{{ a }}</span>
              <button
                type="button"
                class="grid size-7 shrink-0 place-items-center rounded-lg text-ink-400 transition-colors hover:bg-danger-50 hover:text-danger-600"
                :aria-label="`${a} — biriktirmani olib tashlash`"
                @click="removeAttachment(i)"
              >
                <UiIcon name="x" :size="14" />
              </button>
            </li>
          </ul>
          <button
            type="button"
            class="flex w-full items-center gap-2.5 rounded-field border border-dashed border-ink-300 px-4 py-2.5 text-left transition-colors hover:border-brand-400 hover:bg-brand-50"
            @click="addAttachment"
          >
            <UiIcon name="image" :size="18" class="shrink-0 text-ink-400" />
            <span class="min-w-0">
              <span class="block text-[13px] font-semibold text-ink-800">Rasm biriktirish</span>
              <span class="block text-[11.5px] text-ink-500">
                Biriktirilgan: {{ attachments.length }} ta
              </span>
            </span>
          </button>
        </div>
      </UiField>
    </div>

    <template #footer>
      <UiButton variant="ghost" @click="newRequestOpen = false">Bekor qilish</UiButton>
      <UiButton @click="submitRequest">
        <UiIcon name="send" :size="16" />
        Arizani yuborish
      </UiButton>
    </template>
  </UiModal>

  <UiModal
    v-model="docOpen"
    :title="selectedDoc?.name ?? 'Hujjat'"
    :subtitle="selectedDoc ? `${selectedDoc.code} · PDF · ${selectedDoc.size}` : ''"
    size="sm"
  >
    <div v-if="selectedDoc" class="space-y-4">
      <div class="flex items-center gap-3.5 rounded-field bg-surface-sunken p-4 ring-1 ring-ink-200">
        <span class="grid size-12 shrink-0 place-items-center rounded-field bg-danger-50 text-danger-600">
          <UiIcon name="doc" :size="24" />
        </span>
        <span class="min-w-0">
          <span class="block truncate text-[13.5px] font-semibold text-ink-900">
            {{ selectedDoc.name }}.pdf
          </span>
          <span class="block text-[12px] text-ink-500">
            Yuklangan sana: {{ dateShort(selectedDoc.at) }}
          </span>
        </span>
      </div>

      <p v-if="!docReady" class="text-[13px] text-ink-600">
        Hujjat nusxasi tayyorlanadi va brauzeringiz orqali saqlanadi.
      </p>
      <p v-else class="flex items-center gap-2 text-[13px] font-semibold text-ok-700">
        <UiIcon name="check" :size="16" />
        Hujjat yuklab olishga tayyor.
      </p>
    </div>

    <template #footer>
      <UiButton variant="ghost" @click="docOpen = false">Yopish</UiButton>
      <UiButton :disabled="docReady" @click="docReady = true">
        <UiIcon name="download" :size="16" />
        Yuklab olish
      </UiButton>
    </template>
  </UiModal>
</template>
