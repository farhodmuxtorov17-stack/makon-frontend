<script setup lang="ts">
import { buildingById } from '~/data/buildings'
import { UNITS, unitsOfFloor, type Unit } from '~/data/units'
import { CONTRACTS, INVOICES, type Invoice } from '~/data/business'
import { SERVICE_REQUESTS, type ServiceRequest } from '~/data/operations'
import { fileSize } from '~/utils/docx'
import { area, dateLong, dateShort, monthTitle, num, sum, todayIso } from '~/utils/format'

const auth = useAuthStore()
const lease = useLeaseStore()

lease.seed()

/** Sana haqiqiy soatdan olinadi, qotib qolgan qiymat emas */
function toIso(d: Date) {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + days)
  return toIso(d)
}

const TODAY = todayIso()

const firstName = computed(() => (auth.user?.fullName ?? '').split(' ')[0] ?? '')
const fullName = computed(() => auth.user?.fullName ?? '')

/** Kabinet faqat kirgan foydalanuvchining tashkiloti bilan ishlaydi */
const organization = computed(() => auth.user?.organization ?? '')

/**
 * Maydonlar, shartnoma va hisob-fakturalar reyestrdan shu tashkilot bo‘yicha
 * olinadi. Begona tashkilotning yozuvi kabinetga tushmaydi.
 */
const myUnits = computed<Unit[]>(() =>
  UNITS.filter((u) => organization.value && u.tenant === organization.value),
)

const myUnit = computed<Unit | null>(() => myUnits.value[0] ?? null)
const myBuilding = computed(() =>
  myUnit.value ? (buildingById(myUnit.value.buildingId) ?? null) : null,
)
const floorUnits = computed(() =>
  myUnit.value ? unitsOfFloor(myUnit.value.buildingId, myUnit.value.floor) : [],
)

const myContract = computed(() =>
  myUnit.value?.contractCode
    ? CONTRACTS.find(
        (c) => c.code === myUnit.value?.contractCode && c.tenant === organization.value,
      )
    : undefined,
)

const MY_INVOICES = computed(() =>
  [...INVOICES.filter((i) => organization.value && i.tenant === organization.value)].sort((a, b) =>
    b.issuedAt.localeCompare(a.issuedAt),
  ),
)

/** Ochiq hujjat bo‘lsa o‘sha, aks holda oxirgi berilgan hisob-faktura */
const currentInvoice = computed<Invoice | null>(
  () => MY_INVOICES.value.find((i) => i.total > i.paid) ?? MY_INVOICES.value[0] ?? null,
)

/** Muddati o‘tgan hujjat: qoldig‘i bor va to‘lov sanasi bugundan oldin */
function isOverdue(i: Invoice) {
  return i.total > i.paid && i.dueAt < TODAY
}

/** Qarzdorlik = Σ max(0, jami − to‘langan), buxgalteriyadagi formula bilan bir xil */
const debtTotal = computed(() =>
  MY_INVOICES.value.reduce((acc, i) => acc + Math.max(0, i.total - i.paid), 0),
)
const overdueCount = computed(() => MY_INVOICES.value.filter(isOverdue).length)
const overdueTotal = computed(() =>
  MY_INVOICES.value.filter(isOverdue).reduce((acc, i) => acc + (i.total - i.paid), 0),
)

/** Keyingi to‘lov muddati: to‘lanmagan hujjatlarning eng yaqin sanasi */
const nextDueAt = computed(
  () =>
    MY_INVOICES.value
      .filter((i) => i.total > i.paid)
      .map((i) => i.dueAt)
      .sort()[0] ?? '',
)

const invoiceColumns = [
  { key: 'issuedAt', label: 'Sana' },
  { key: 'code', label: 'Hisob-faktura raqami' },
  { key: 'period', label: 'Davr' },
  { key: 'total', label: 'Summa', align: 'right' as const, numeric: true },
  { key: 'status', label: 'Holat', align: 'right' as const },
]

// ---------------------------------------------------------------------------
// Servis arizalari: operator va ijrochi ekranlari bilan bitta ro‘yxat

type CabinetRequest = ServiceRequest & { attachments?: string[] }

const allRequests = useState<ServiceRequest[]>('service-requests', () =>
  SERVICE_REQUESTS.map((r) => ({ ...r })),
)

const myUnitCodes = computed(() => myUnits.value.map((u) => u.code))

/** Faqat shu tashkilot yuborgan yoki uning maydoniga tegishli arizalar */
const requests = computed<CabinetRequest[]>(() =>
  allRequests.value.filter(
    (r) =>
      (organization.value && r.requester === organization.value) ||
      (fullName.value && r.requester === fullName.value) ||
      (myBuilding.value !== null &&
        r.buildingName === myBuilding.value.name &&
        myUnitCodes.value.includes(r.unitCode)),
  ),
)

const selectedRequest = ref<CabinetRequest | null>(null)
const requestOpen = ref(false)
const newRequestOpen = ref(false)
const createdCode = ref('')
const requestNotice = ref('')
const attachments = ref<File[]>([])

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
  requestNotice.value = ''
  requestOpen.value = true
}

const fileInput = ref<HTMLInputElement | null>(null)

function pickAttachments() {
  fileInput.value?.click()
}

/** Ro‘yxatdagi qisqa yo‘l: ariza oynasini ochadi va fayl tanlashni boshlaydi */
function startRequestWithPhoto() {
  newRequestOpen.value = true
  nextTick(() => pickAttachments())
}

function onFiles(event: Event) {
  const target = event.target as HTMLInputElement
  const picked = Array.from(target.files ?? [])
  target.value = ''
  if (picked.length === 0) return
  attachments.value = [...attachments.value, ...picked]
}

function removeAttachment(index: number) {
  attachments.value.splice(index, 1)
}

/** Yangi yozuv raqami umumiy ro‘yxatdagi eng katta raqamdan keyin keladi */
function nextRequestNumber() {
  return (
    allRequests.value.reduce((max, r) => {
      const m = /(\d+)\s*$/.exec(r.code)
      return Math.max(max, m ? Number(m[1]) : 0)
    }, 0) + 1
  )
}

function submitRequest() {
  if (form.title.trim().length < 4) {
    formError.value = 'Ariza mavzusini kamida 4 ta belgidan iborat qilib yozing'
    return
  }
  formError.value = ''

  const number = nextRequestNumber()
  // Kod prefiksidagi yil yozuv yaratilgan yildan olinadi
  const code = `SR-${new Date().getFullYear()}-${String(number).padStart(4, '0')}`
  const created: CabinetRequest = {
    id: `s-${String(number).padStart(4, '0')}`,
    code,
    title: form.title.trim(),
    category: form.category as ServiceRequest['category'],
    buildingName: myBuilding.value?.name ?? '',
    unitCode: myUnit.value?.code ?? '',
    requester: organization.value,
    priority: form.priority as ServiceRequest['priority'],
    status: 'NEW',
    assignee: null,
    createdAt: `${TODAY} ${new Date().toTimeString().slice(0, 5)}`,
    dueAt: addDays(TODAY, 7),
    slaBreached: false,
    description: form.description.trim() || 'Qo‘shimcha izoh ko‘rsatilmagan.',
    progress: 0,
    attachments: attachments.value.map((a) => a.name),
  }

  // Umumiy navbat: operator va ijrochi ekranlari shu ro‘yxatdan o‘qiydi
  allRequests.value = [created, ...allRequests.value]

  createdCode.value = code
  form.title = ''
  form.description = ''
  attachments.value = []
  newRequestOpen.value = false
}

/** Ijarachi bajarilgan ishni o‘zi tasdiqlaydi yoki qaytaradi */
const canDecideRequest = computed(
  () => selectedRequest.value?.status === 'TENANT_CONFIRMATION',
)

function confirmRequest() {
  const r = selectedRequest.value
  if (!r || r.status !== 'TENANT_CONFIRMATION') return
  r.status = 'CLOSED'
  r.progress = 100
  requestNotice.value = `${r.code} bo‘yicha ish qabul qilindi, ariza yopildi.`
}

function returnRequest() {
  const r = selectedRequest.value
  if (!r || r.status !== 'TENANT_CONFIRMATION') return
  r.status = 'RETURNED'
  r.progress = Math.min(r.progress, 80)
  requestNotice.value = `${r.code} qayta ishlashga qaytarildi, bino xizmati xabardor qilindi.`
}

// ---------------------------------------------------------------------------
// Hujjatlar: nusxa «Hujjatlarim» bo‘limida yagona shakl bo‘yicha yig‘iladi

interface CabinetDocLink {
  id: string
  name: string
  code: string
  at: string
  summary: string
}

const documents = computed<CabinetDocLink[]>(() => {
  const out: CabinetDocLink[] = []
  const contract = myContract.value
  const invoice = MY_INVOICES.value[0]

  if (contract) {
    out.push({
      id: 'd-contract',
      name: 'Ijara shartnomasi',
      code: contract.code,
      at: contract.startsAt,
      summary: `Unit ${myUnit.value?.code ?? ''} bo‘yicha ijara shartnomasi, ${dateShort(contract.startsAt)} · ${dateShort(contract.endsAt)}.`,
    })
  }

  if (invoice) {
    out.push({
      id: 'd-invoice',
      name: 'Hisob-faktura',
      code: invoice.code,
      at: invoice.issuedAt,
      summary: `${invoice.period} davri uchun hisob-faktura, jami ${sum(invoice.total)}.`,
    })
  }

  if (out.length) {
    out.push(
      {
        id: 'd-requisites',
        name: 'To‘lov rekvizitlari',
        code: 'REK-2025-0044',
        at: '2026-04-17',
        summary: 'Bank rekvizitlari va to‘lov topshiriqnomasini to‘ldirish tartibi.',
      },
      {
        id: 'd-rules',
        name: 'Bino ichki tartib-qoidalari',
        code: 'QDL-2025-0007',
        at: '2026-04-17',
        summary: 'Ish vaqti, kirish tartibi va umumiy zonalardan foydalanish qoidalari.',
      },
    )
  }

  return out
})

// ---------------------------------------------------------------------------
// Hisoblagichlar: qisqa ko‘rinish, to‘liq ro‘yxat «Hisoblagichlar» bo‘limida

const MONTH_LAST_READ = (() => {
  const d = new Date()
  if (d.getDate() < 18) d.setMonth(d.getMonth() - 1)
  d.setDate(18)
  return toIso(d)
})()

const meters = [
  { id: 'mt-suv', label: 'Suv', unit: 'm³', icon: 'meter', tone: 'brand', last: 125.4, previous: 118.2 },
  { id: 'mt-elektr', label: 'Elektr', unit: 'kVt-soat', icon: 'sparkle', tone: 'warn', last: 1245.6, previous: 1198.3 },
  { id: 'mt-issiqlik', label: 'Issiqlik', unit: 'Gkal', icon: 'refresh', tone: 'danger', last: 63.2, previous: 58.1 },
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
  const u = myUnit.value
  if (!u) return { x: 50, y: 50 }
  const xs = u.polygon.map((p) => p[0]!)
  const ys = u.polygon.map((p) => p[1]!)
  return {
    x: ((Math.min(...xs) + Math.max(...xs)) / 2) * 100,
    y: ((Math.min(...ys) + Math.max(...ys)) / 2) * 100 + 2,
  }
})

const currentPeriodTitle = computed(() => monthTitle(TODAY))
</script>

<template>
  <AppTopbar
    :title="firstName ? `Xush kelibsiz, ${firstName}` : 'Kabinet'"
    :subtitle="`Bugun ${dateLong(TODAY)}`"
  >
    <template #actions>
      <UiButton variant="secondary" size="sm" to="/cabinet/invoices">
        <UiIcon name="wallet" :size="16" />
        To‘lovlarim
      </UiButton>
      <UiButton size="sm" :disabled="!myUnit" @click="newRequestOpen = true">
        <UiIcon name="plus" :size="16" />
        Yangi servis arizasi
      </UiButton>
    </template>
  </AppTopbar>

  <main class="scroll-slim flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
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

    <UiCard v-if="!myUnit" flush>
      <UiEmpty
        icon="building"
        title="Maydon biriktirilmagan"
        :description="`${organization || 'Tashkilotingiz'} nomiga rasmiylashtirilgan unit topilmadi. Bo‘sh maydonlar katalogidan tanlab, ijaraga olish arizasini yuboring: shartnoma faollashgach kabinet to‘liq ishga tushadi.`"
        action-label="Ijaraga olish arizasi"
        action-to="/cabinet/apply"
      />
    </UiCard>

    <template v-else>
      <section class="grid gap-5 xl:grid-cols-2">
        <UiCard title="Mening unitlarim" subtitle="Ijaraga olingan asosiy maydon">
          <template #actions>
            <UiButton variant="ghost" size="sm" to="/cabinet/units">
              Barchasi
              <UiIcon name="chevronRight" :size="15" />
            </UiButton>
          </template>

          <div class="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
            <UiPhoto
              name="interior-office"
              :alt="`Unit ${myUnit.code} ichki ko‘rinishi`"
              ratio="aspect-[16/10]"
              rounded="rounded-field"
              sizes="(max-width: 640px) 100vw, 340px"
            >
              <span
                class="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink-900/65 via-ink-900/10 to-transparent"
              />
              <span class="absolute bottom-3 left-3.5 right-3.5">
                <span class="block text-[14px] font-semibold text-white drop-shadow">
                  Unit {{ myUnit.code }}
                </span>
                <span class="block text-[12px] text-white/85">{{ myUnit.usage }}</span>
              </span>
            </UiPhoto>

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
                {{ myBuilding?.name }} · {{ myUnit.floor }}-qavat, {{ myUnit.rooms }} xona
              </p>

              <dl class="mt-3 divide-y divide-ink-100 border-t border-ink-100">
                <div class="flex items-center justify-between py-2">
                  <dt class="text-[12.5px] text-ink-500">Umumiy maydon</dt>
                  <dd class="tabular text-[13px] font-bold text-ink-900">{{ area(myUnit.area) }}</dd>
                </div>
                <div class="flex items-center justify-between py-2">
                  <dt class="text-[12.5px] text-ink-500">Shartnoma</dt>
                  <dd class="tabular text-[13px] font-bold text-ink-900">
                    {{ myContract?.code ?? 'Biriktirilmagan' }}
                  </dd>
                </div>
                <div class="flex items-center justify-between py-2">
                  <dt class="text-[12.5px] text-ink-500">Ijara boshlangan sana</dt>
                  <dd class="tabular text-[13px] font-bold text-ink-900">
                    {{ myContract ? dateShort(myContract.startsAt) : '-' }}
                  </dd>
                </div>
                <div class="flex items-center justify-between py-2">
                  <dt class="text-[12.5px] text-ink-500">Shartnoma yakunlanish sanasi</dt>
                  <dd class="tabular text-[13px] font-bold text-ink-900">
                    {{ myContract ? dateShort(myContract.endsAt) : '-' }}
                  </dd>
                </div>
                <div class="flex items-center justify-between py-2">
                  <dt class="text-[12.5px] text-ink-500">Shartnoma holati</dt>
                  <dd>
                    <UiStatus v-if="myContract" kind="contract" :value="myContract.status" size="sm" />
                    <span v-else class="text-[13px] text-ink-500">-</span>
                  </dd>
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
            <div
              v-if="overdueCount === 0"
              class="flex items-center gap-3 rounded-field bg-ok-50 px-4 py-3 ring-1 ring-ok-100"
            >
              <span class="grid size-9 shrink-0 place-items-center rounded-[10px] bg-ok-500 text-white">
                <UiIcon name="check" :size="18" />
              </span>
              <p class="min-w-0 flex-1 text-[13px] font-semibold text-ok-700">
                Muddati o‘tgan qarzdorlik yo‘q
                <span class="block font-normal text-ok-600">
                  {{
                    nextDueAt
                      ? `Keyingi to‘lov muddati: ${dateShort(nextDueAt)}`
                      : 'To‘lanmagan hisob-faktura yo‘q'
                  }}
                </span>
              </p>
            </div>
            <div
              v-else
              class="flex items-center gap-3 rounded-field bg-danger-50 px-4 py-3 ring-1 ring-danger-100"
            >
              <span class="grid size-9 shrink-0 place-items-center rounded-[10px] bg-danger-500 text-white">
                <UiIcon name="warning" :size="18" />
              </span>
              <p class="min-w-0 flex-1 text-[13px] font-semibold text-danger-700">
                Muddati o‘tgan {{ overdueCount }} ta hisob-faktura
                <span class="block font-normal text-danger-600">
                  Kechikkan summa: {{ sum(overdueTotal) }}
                </span>
              </p>
            </div>

            <div class="grid gap-3 sm:grid-cols-2">
              <div class="rounded-field p-4 ring-1 ring-ink-200">
                <p class="text-[12.5px] text-ink-500">
                  {{ currentInvoice ? `${currentInvoice.period} davri hisobi` : 'Joriy davr hisobi' }}
                </p>
                <p class="tabular mt-1.5 text-[22px] font-bold leading-none text-ink-900">
                  {{ num(currentInvoice?.total ?? 0) }}
                  <span class="text-[13px] font-medium text-ink-500">so‘m</span>
                </p>
                <div class="mt-2.5">
                  <UiStatus
                    v-if="currentInvoice"
                    kind="invoice"
                    :value="isOverdue(currentInvoice) ? 'OVERDUE' : currentInvoice.status"
                    size="sm"
                  />
                </div>
                <p class="mt-2 text-[12px] text-ink-500">
                  {{
                    currentInvoice
                      ? `To‘lov muddati: ${dateShort(currentInvoice.dueAt)}`
                      : `${currentPeriodTitle} davri uchun hujjat shakllantirilmagan`
                  }}
                </p>
              </div>

              <div class="rounded-field p-4 ring-1 ring-ink-200">
                <p class="text-[12.5px] text-ink-500">Qarzdorlik summasi</p>
                <p class="tabular mt-1.5 text-[22px] font-bold leading-none text-ink-900">
                  {{ num(debtTotal) }}
                  <span class="text-[13px] font-medium text-ink-500">so‘m</span>
                </p>
                <div class="mt-2.5">
                  <span
                    v-if="debtTotal === 0"
                    class="inline-flex items-center gap-1.5 rounded-pill bg-ok-50 px-2 py-0.5 text-[11px] font-semibold text-ok-700 ring-1 ring-inset ring-ok-100"
                  >
                    <UiIcon name="check" :size="12" />
                    Qarzdorlik yo‘q
                  </span>
                  <span
                    v-else
                    class="inline-flex items-center gap-1.5 rounded-pill bg-warn-50 px-2 py-0.5 text-[11px] font-semibold text-warn-700 ring-1 ring-inset ring-warn-100"
                  >
                    <UiIcon name="wallet" :size="12" />
                    To‘lanmagan qoldiq
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
                  empty="Hisob-faktura shakllantirilmagan"
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
                    <UiStatus
                      kind="invoice"
                      :value="isOverdue(row) ? 'OVERDUE' : String(row.status)"
                      size="sm"
                    />
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
              Yangi servis arizasi
            </UiButton>
            <button
              type="button"
              class="flex h-11 min-w-[168px] flex-1 items-center gap-2.5 rounded-field border border-dashed border-ink-300 px-3.5 text-left transition-colors hover:border-brand-400 hover:bg-brand-50"
              @click="startRequestWithPhoto"
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
                <span class="tabular block truncate text-[12px] text-ink-500">
                  {{ d.code }} · {{ dateShort(d.at) }}
                </span>
              </span>
              <NuxtLink
                :to="`/cabinet/documents?hujjat=${d.code}`"
                class="grid size-11 shrink-0 place-items-center rounded-field text-brand-600 transition-colors hover:bg-brand-50 md:size-9"
                :aria-label="`${d.name}: hujjatlar bo‘limida ochish`"
              >
                <UiIcon name="download" :size="18" />
              </NuxtLink>
            </li>
            <li v-if="!documents.length" class="px-5 py-10 text-center text-[13px] text-ink-500">
              Hujjat shakllantirilmagan
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
                <span class="tabular block text-[11.5px] text-ink-500">
                  {{ dateShort(MONTH_LAST_READ) }}
                </span>
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
    </template>
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
          Ustuvorlik: {{ selectedRequest.priority }}
        </span>
      </div>

      <p
        v-if="requestNotice"
        class="flex items-start gap-2 rounded-field bg-ok-50 px-3.5 py-2.5 text-[13px] font-semibold text-ok-700 ring-1 ring-ok-100"
      >
        <UiIcon name="check" :size="16" class="mt-px shrink-0" />
        <span class="min-w-0">{{ requestNotice }}</span>
      </p>

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

      <p
        v-if="canDecideRequest"
        class="flex items-start gap-2 rounded-field bg-info-50 px-3.5 py-2.5 text-[12.5px] leading-snug text-info-700"
      >
        <UiIcon name="info" :size="15" class="mt-px shrink-0" />
        <span class="min-w-0">
          Ish bajarildi va sizning tasdig‘ingizni kutmoqda. Natijani qabul qiling yoki kamchilik
          bo‘lsa qayta ishlashga qaytaring.
        </span>
      </p>
    </div>

    <template #footer>
      <UiButton variant="ghost" @click="requestOpen = false">Yopish</UiButton>
      <template v-if="canDecideRequest">
        <UiButton variant="secondary" @click="returnRequest">
          <UiIcon name="refresh" :size="16" />
          Qaytarish
        </UiButton>
        <UiButton @click="confirmRequest">
          <UiIcon name="check" :size="16" />
          Tasdiqlash
        </UiButton>
      </template>
      <UiButton
        v-else
        variant="secondary"
        @click="
          () => {
            requestOpen = false
            newRequestOpen = true
          }
        "
      >
        <UiIcon name="plus" :size="16" />
        Yangi servis arizasi
      </UiButton>
    </template>
  </UiModal>

  <UiModal
    v-model="newRequestOpen"
    title="Yangi servis arizasi"
    :subtitle="myBuilding && myUnit ? `${myBuilding.name} · Unit ${myUnit.code}` : ''"
  >
    <div class="space-y-4">
      <UiField label="Ariza mavzusi" required :error="formError">
        <UiInput v-model="form.title" placeholder="Masalan: sanuzelda suv oqmoqda" :invalid="!!formError" />
      </UiField>

      <div class="grid gap-4 sm:grid-cols-2">
        <UiField label="Kategoriya" required>
          <UiSelect v-model="form.category" :options="categoryOptions" />
        </UiField>
        <UiField label="Ustuvorlik" required>
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
              :key="`${a.name}-${i}`"
              class="flex items-center gap-2.5 rounded-field px-3 py-2 ring-1 ring-ink-200"
            >
              <UiIcon name="image" :size="16" class="shrink-0 text-brand-600" />
              <span class="min-w-0 flex-1 truncate text-[12.5px] text-ink-700">
                {{ a.name }}
                <span class="tabular text-ink-500">· {{ fileSize(a.size) }}</span>
              </span>
              <button
                type="button"
                class="grid size-11 shrink-0 place-items-center rounded-lg text-ink-400 transition-colors hover:bg-danger-50 hover:text-danger-600 md:size-9"
                :aria-label="`${a.name}: biriktirmani olib tashlash`"
                @click="removeAttachment(i)"
              >
                <UiIcon name="x" :size="14" />
              </button>
            </li>
          </ul>
          <input
            ref="fileInput"
            type="file"
            accept="image/*"
            multiple
            class="sr-only"
            aria-label="Rasm fayllari"
            @change="onFiles"
          />
          <button
            type="button"
            class="flex w-full items-center gap-2.5 rounded-field border border-dashed border-ink-300 px-4 py-2.5 text-left transition-colors hover:border-brand-400 hover:bg-brand-50"
            @click="pickAttachments"
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
</template>
