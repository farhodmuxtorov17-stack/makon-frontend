<script setup lang="ts">
import { buildingById } from '~/data/buildings'
import { UNITS, unitsOfFloor, type Unit } from '~/data/units'
import { CONTRACTS, INVOICES, type Invoice } from '~/data/business'
import { SERVICE_REQUESTS, type ServiceRequest } from '~/data/operations'
import { fileSize } from '~/utils/docx'
import { area, dateShort, num, todayIso } from '~/utils/format'

const auth = useAuthStore()
const lease = useLeaseStore()
const { t } = useI18n()
const { unitUsageLabel, money, field, priorityLabel, dateLong, monthTitle } = useAppLabels()

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

const invoiceColumns = computed(() => [
  { key: 'issuedAt', label: field('date') },
  { key: 'code', label: field('invoiceNo') },
  { key: 'period', label: field('period') },
  { key: 'total', label: field('amount'), align: 'right' as const, numeric: true },
  { key: 'status', label: field('status'), align: 'right' as const },
])

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

/**
 * Kategoriya ma’lumotda o‘zbekcha qiymat sifatida saqlanadi: qiymat
 * o‘zgarmaydi, faqat ko‘rinadigan nom lug‘atdan olinadi.
 */
const CATEGORY_KEY: Record<string, string> = {
  Santexnika: 'serviceCategory.plumbing',
  Elektr: 'serviceCategory.electric',
  Konditsioner: 'serviceCategory.hvac',
  Qurilish: 'serviceCategory.construction',
  Tozalash: 'serviceCategory.cleaning',
  Boshqa: 'serviceCategory.other',
}

function categoryLabel(value: string) {
  const key = CATEGORY_KEY[value]
  return key ? t(key) : value
}

const categoryOptions = computed(() =>
  Object.keys(CATEGORY_KEY).map((value) => ({ value, label: categoryLabel(value) })),
)

const priorityOptions = computed(() =>
  ['Past', 'O‘rtacha', 'Yuqori'].map((value) => ({ value, label: priorityLabel(value) })),
)

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
    formError.value = t('cab.requestTitleError')
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
    description: form.description.trim() || t('cab.noExtraNote'),
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
  requestNotice.value = t('cab.requestConfirmed', { code: r.code })
}

function returnRequest() {
  const r = selectedRequest.value
  if (!r || r.status !== 'TENANT_CONFIRMATION') return
  r.status = 'RETURNED'
  r.progress = Math.min(r.progress, 80)
  requestNotice.value = t('cab.requestReturnedNotice', { code: r.code })
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
      name: t('cab.docLease'),
      code: contract.code,
      at: contract.startsAt,
      summary: t('cab.docLeaseSummary', {
        unit: myUnit.value?.code ?? '',
        from: dateShort(contract.startsAt),
        to: dateShort(contract.endsAt),
      }),
    })
  }

  if (invoice) {
    out.push({
      id: 'd-invoice',
      name: t('field.invoice'),
      code: invoice.code,
      at: invoice.issuedAt,
      summary: t('cab.docInvoiceSummary', { period: invoice.period, total: money(invoice.total) }),
    })
  }

  if (out.length) {
    out.push(
      {
        id: 'd-requisites',
        name: t('cab.docRequisites'),
        code: 'REK-2025-0044',
        at: '2026-04-17',
        summary: t('cab.docRequisitesShort'),
      },
      {
        id: 'd-rules',
        name: t('cab.docRules'),
        code: 'QDL-2025-0007',
        at: '2026-04-17',
        summary: t('cab.docRulesShort'),
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

const meters = computed(() => [
  { id: 'mt-suv', label: t('meterType.water'), unit: 'm³', icon: 'meter', tone: 'brand', last: 125.4, previous: 118.2 },
  { id: 'mt-elektr', label: t('meterType.electricity'), unit: 'kVt-soat', icon: 'sparkle', tone: 'warn', last: 1245.6, previous: 1198.3 },
  { id: 'mt-issiqlik', label: t('meterType.heating'), unit: 'Gkal', icon: 'refresh', tone: 'danger', last: 63.2, previous: 58.1 },
])

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

/* --- Jonli izoh ---
 * Ijarachi tizimga kamdan-kam kiradi, shuning uchun izoh kabinetni ish
 * tartibida boshdan oxirigacha ko‘rsatadi: maydon, to‘lov, servis arizasi,
 * hujjatlar va hisoblagichlar. Har bir qadamda amaldan keyingi natija
 * aytiladi, shunda nimani kutish kerakligi noaniq qolmaydi.
 */
const TOUR_KEYS = ['unit', 'invoice', 'request', 'requests', 'docs', 'meters'] as const

const tourSteps = computed(() =>
  TOUR_KEYS.map((key) => ({
    target: `[data-tour="cab-${key}"]`,
    title: t(`tour.cabinet.${key}.title`),
    body: t(`tour.cabinet.${key}.body`),
    after: t(`tour.cabinet.${key}.after`),
    next: t(`tour.cabinet.${key}.next`),
  })),
)

const tourId = computed(() => `cabinet:${auth.role ?? 'guest'}`)
</script>

<template>
  <AppTopbar
    :title="firstName ? t('cab.welcome', { name: firstName }) : t('cab.title')"
    :subtitle="t('cab.todayIs', { date: dateLong(TODAY) })"
  >
    <template #actions>
      <UiButton variant="secondary" size="sm" to="/cabinet/invoices">
        <UiIcon name="wallet" :size="16" />
        {{ t('nav.myInvoices') }}
      </UiButton>
      <UiButton
        size="sm"
        :disabled="!myUnit"
        data-tour="cab-request"
        @click="newRequestOpen = true"
      >
        <UiIcon name="plus" :size="16" />
        {{ t('cab.newServiceRequest') }}
      </UiButton>
      <UiTour v-if="myUnit" :id="tourId" :steps="tourSteps" />
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
      <p class="min-w-0 flex-1 text-[14px] text-ok-700">
        <b>{{ createdCode }}</b> {{ t('cab.requestCreatedNotice') }}
      </p>
      <button
        type="button"
        class="rounded-lg p-1.5 text-ok-700 transition-colors hover:bg-ok-100"
        :aria-label="t('common.closeMessage')"
        @click="createdCode = ''"
      >
        <UiIcon name="x" :size="16" />
      </button>
    </div>

    <UiCard v-if="!myUnit" flush>
      <UiEmpty
        icon="building"
        :title="t('cab.noUnitTitle')"
        :description="t('cab.noUnitDesc', { org: organization || t('cab.yourOrganization') })"
        :action-label="t('cab.applyForRent')"
        action-to="/cabinet/apply"
      />
    </UiCard>

    <template v-else>
      <section class="grid gap-5 xl:grid-cols-2">
        <UiCard data-tour="cab-unit" :title="t('nav.myUnits')" :subtitle="t('cab.mainRentedUnit')">
          <template #actions>
            <UiButton variant="ghost" size="sm" to="/cabinet/units">
              {{ t('common.all') }}
              <UiIcon name="chevronRight" :size="15" />
            </UiButton>
          </template>

          <div class="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
            <UiPhoto
              name="interior-office"
              :alt="t('cab.unitInteriorAlt', { code: myUnit.code })"
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
                <span class="block text-[12px] text-white/85">{{ unitUsageLabel(myUnit.usage) }}</span>
              </span>
            </UiPhoto>

            <div class="flex flex-col">
              <div class="rounded-field bg-surface-sunken p-3 ring-1 ring-ink-200">
                <svg viewBox="0 0 100 100" class="block h-32 w-full" role="img" :aria-label="t('cab.floorPlan')">
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
                <p class="mt-2 text-center text-[12px] text-ink-500">
                  {{ t('cab.floorPlanTitle', { floor: myUnit.floor }) }}
                </p>
              </div>

              <div class="mt-3.5 flex items-center gap-2.5">
                <h4 class="text-[18px] font-bold text-ink-900">Unit {{ myUnit.code }}</h4>
                <UiStatus kind="unit" :value="myUnit.status" size="sm" />
              </div>
              <p class="mt-1 text-[13px] text-ink-600">{{ myUnit.tenant ?? organization }}</p>
              <p class="text-[13px] text-ink-500">
                {{ myBuilding?.name }} ·
                {{ t('cab.floorRooms', { floor: myUnit.floor, rooms: myUnit.rooms }) }}
              </p>

              <dl class="mt-3 divide-y divide-ink-100 border-t border-ink-100">
                <div class="flex items-center justify-between py-2">
                  <dt class="text-[13px] text-ink-500">{{ field('totalArea') }}</dt>
                  <dd class="tabular text-[13px] font-bold text-ink-900">{{ area(myUnit.area) }}</dd>
                </div>
                <div class="flex items-center justify-between py-2">
                  <dt class="text-[13px] text-ink-500">{{ field('contract') }}</dt>
                  <dd class="tabular text-[13px] font-bold text-ink-900">
                    {{ myContract?.code ?? t('common.notAssigned') }}
                  </dd>
                </div>
                <div class="flex items-center justify-between py-2">
                  <dt class="text-[13px] text-ink-500">{{ t('cab.leaseStart') }}</dt>
                  <dd class="tabular text-[13px] font-bold text-ink-900">
                    {{ myContract ? dateShort(myContract.startsAt) : '-' }}
                  </dd>
                </div>
                <div class="flex items-center justify-between py-2">
                  <dt class="text-[13px] text-ink-500">{{ t('cab.leaseEnd') }}</dt>
                  <dd class="tabular text-[13px] font-bold text-ink-900">
                    {{ myContract ? dateShort(myContract.endsAt) : '-' }}
                  </dd>
                </div>
                <div class="flex items-center justify-between py-2">
                  <dt class="text-[13px] text-ink-500">{{ t('cab.contractStatus') }}</dt>
                  <dd>
                    <UiStatus v-if="myContract" kind="contract" :value="myContract.status" size="sm" />
                    <span v-else class="text-[13px] text-ink-500">-</span>
                  </dd>
                </div>
              </dl>

              <UiButton variant="secondary" size="sm" class="mt-3.5" block to="/cabinet/units">
                {{ t('cab.unitDetails') }}
                <UiIcon name="chevronRight" :size="15" />
              </UiButton>
            </div>
          </div>
        </UiCard>

        <UiCard
          data-tour="cab-invoice"
          :title="t('tour.cabinet.invoice.title')"
          :subtitle="t('cab.currentPeriodBilling')"
          flush
        >
          <template #actions>
            <UiButton variant="ghost" size="sm" to="/cabinet/invoices">
              {{ t('common.viewAll') }}
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
                {{ t('cab.noOverdueDebt') }}
                <span class="block font-normal text-ok-600">
                  {{
                    nextDueAt
                      ? t('cab.nextDueAt', { date: dateShort(nextDueAt) })
                      : t('cab.noUnpaidInvoices')
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
                {{ t('cab.overdueInvoicesCount', { n: overdueCount }) }}
                <span class="block font-normal text-danger-600">
                  {{ t('cab.overdueAmount', { amount: money(overdueTotal) }) }}
                </span>
              </p>
            </div>

            <div class="grid gap-3 sm:grid-cols-2">
              <div class="rounded-field p-4 ring-1 ring-ink-200">
                <p class="text-[13px] text-ink-500">
                  {{
                    currentInvoice
                      ? t('cab.periodBill', { period: currentInvoice.period })
                      : t('cab.currentPeriodBill')
                  }}
                </p>
                <p class="tabular mt-1.5 text-[22px] font-bold leading-none text-ink-900">
                  {{ num(currentInvoice?.total ?? 0) }}
                  <span class="text-[13px] font-medium text-ink-500">{{ t('unitOf.currency') }}</span>
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
                      ? t('cab.dueAtIs', { date: dateShort(currentInvoice.dueAt) })
                      : t('cab.noDocForPeriod', { period: currentPeriodTitle })
                  }}
                </p>
              </div>

              <div class="rounded-field p-4 ring-1 ring-ink-200">
                <p class="text-[13px] text-ink-500">{{ t('cab.debtAmount') }}</p>
                <p class="tabular mt-1.5 text-[22px] font-bold leading-none text-ink-900">
                  {{ num(debtTotal) }}
                  <span class="text-[13px] font-medium text-ink-500">{{ t('unitOf.currency') }}</span>
                </p>
                <div class="mt-2.5">
                  <span
                    v-if="debtTotal === 0"
                    class="inline-flex items-center gap-1.5 rounded-pill bg-ok-50 px-2 py-0.5 text-[11px] font-semibold text-ok-700 ring-1 ring-inset ring-ok-100"
                  >
                    <UiIcon name="check" :size="12" />
                    {{ t('empty.noDebt') }}
                  </span>
                  <span
                    v-else
                    class="inline-flex items-center gap-1.5 rounded-pill bg-warn-50 px-2 py-0.5 text-[11px] font-semibold text-warn-700 ring-1 ring-inset ring-warn-100"
                  >
                    <UiIcon name="wallet" :size="12" />
                    {{ t('cab.unpaidBalance') }}
                  </span>
                </div>
                <p class="mt-2 text-[12px] text-ink-500">
                  {{ t('cab.overdueInvoicesLine', { n: overdueCount }) }}
                </p>
              </div>
            </div>

            <div>
              <p class="mb-2 text-[13px] font-semibold text-ink-700">{{ t('cab.recentInvoices') }}</p>
              <div class="overflow-hidden rounded-field ring-1 ring-ink-200">
                <UiTable
                  :columns="invoiceColumns"
                  :rows="MY_INVOICES"
                  :empty="t('empty.noInvoicesIssued')"
                  :to="() => '/cabinet/invoices'"
                >
                  <template #cell-issuedAt="{ value }">
                    <span class="tabular text-[13px]">{{ dateShort(String(value)) }}</span>
                  </template>
                  <template #cell-code="{ row }">
                    <span class="text-[13px] font-semibold text-ink-900">{{ row.code }}</span>
                  </template>
                  <template #cell-total="{ value }">
                    {{ money(Number(value)) }}
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
        <UiCard
          data-tour="cab-requests"
          :title="t('cab.myActiveRequests')"
          :subtitle="t('cab.myRequestsCaption')"
          flush
        >
          <template #actions>
            <span class="rounded-pill bg-brand-50 px-2.5 py-1 text-[12px] font-bold text-brand-700">
              {{ requests.length }} {{ t('unitOf.pcs') }}
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
                  <span class="block truncate text-[14px] font-semibold text-ink-900">
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
              {{ t('empty.noOpenRequests') }}
            </li>
          </ul>

          <div class="flex flex-wrap gap-3 p-5 pt-4">
            <UiButton class="min-w-[196px] flex-1" @click="newRequestOpen = true">
              <UiIcon name="plus" :size="17" />
              {{ t('cab.newServiceRequest') }}
            </UiButton>
            <button
              type="button"
              class="flex h-11 min-w-[168px] flex-1 items-center gap-2.5 rounded-field border border-dashed border-ink-300 px-3.5 text-left transition-colors hover:border-brand-400 hover:bg-brand-50"
              @click="startRequestWithPhoto"
            >
              <UiIcon name="image" :size="18" class="shrink-0 text-ink-400" />
              <span class="min-w-0">
                <span class="block truncate text-[13px] font-semibold leading-tight text-ink-800">
                  {{ t('cab.addPhoto') }}
                </span>
                <span class="block truncate text-[11px] leading-tight text-ink-500">
                  {{ t('cab.photoHint') }}
                </span>
              </span>
            </button>
          </div>
        </UiCard>

        <UiCard data-tour="cab-docs" :title="t('nav.myDocuments')" :subtitle="t('cab.docsCaption')" flush>
          <template #actions>
            <UiButton variant="ghost" size="sm" to="/cabinet/documents">
              {{ t('common.all') }}
              <UiIcon name="chevronRight" :size="15" />
            </UiButton>
          </template>

          <ul class="divide-y divide-ink-100">
            <li v-for="d in documents" :key="d.id" class="flex items-center gap-3.5 px-5 py-3.5">
              <span class="grid size-10 shrink-0 place-items-center rounded-[10px] bg-danger-50 text-danger-600">
                <UiIcon name="doc" :size="18" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-[14px] font-semibold text-ink-900">{{ d.name }}</span>
                <span class="tabular block truncate text-[12px] text-ink-500">
                  {{ d.code }} · {{ dateShort(d.at) }}
                </span>
              </span>
              <NuxtLink
                :to="`/cabinet/documents?hujjat=${d.code}`"
                class="grid size-11 shrink-0 place-items-center rounded-field text-brand-600 transition-colors hover:bg-brand-50 md:size-9"
                :aria-label="t('cab.openInDocsAria', { name: d.name })"
              >
                <UiIcon name="download" :size="18" />
              </NuxtLink>
            </li>
            <li v-if="!documents.length" class="px-5 py-10 text-center text-[13px] text-ink-500">
              {{ t('empty.noDocumentsIssued') }}
            </li>
          </ul>
        </UiCard>

        <UiCard
          data-tour="cab-meters"
          :title="t('tour.cabinet.meters.title')"
          :subtitle="t('cab.lastReadings')"
          flush
        >
          <template #actions>
            <UiButton variant="ghost" size="sm" to="/cabinet/meters">
              {{ t('common.all') }}
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
                <span class="tabular block text-[16px] font-bold text-ink-900">
                  {{ num(m.last, 2) }} {{ m.unit }}
                </span>
                <span class="tabular block text-[12px] text-ink-500">
                  {{ t('cab.previousValue', { value: `${num(m.previous, 2)} ${m.unit}` }) }}
                </span>
              </span>
              <span class="shrink-0 text-right">
                <span class="tabular block text-[13px] font-bold text-brand-600">
                  +{{ num(m.last - m.previous, 2) }}
                </span>
                <span class="tabular block text-[12px] text-ink-500">
                  {{ dateShort(MONTH_LAST_READ) }}
                </span>
              </span>
            </NuxtLink>
          </div>

          <div class="mx-5 mb-5 flex items-start gap-2.5 rounded-field bg-brand-50 px-3.5 py-3">
            <UiIcon name="info" :size="16" class="mt-0.5 shrink-0 text-brand-600" />
            <p class="text-[12px] leading-snug text-brand-700">
              {{ t('cab.metersInfoShort') }}
            </p>
          </div>
        </UiCard>
      </section>
    </template>
  </main>

  <UiModal
    v-model="requestOpen"
    :title="selectedRequest?.title ?? t('field.serviceRequest')"
    :subtitle="selectedRequest ? `${selectedRequest.code} · ${selectedRequest.buildingName}` : ''"
  >
    <div v-if="selectedRequest" class="space-y-4">
      <div class="flex flex-wrap items-center gap-2.5">
        <UiStatus kind="service" :value="selectedRequest.status" />
        <span class="rounded-pill bg-ink-100 px-2.5 py-1 text-[12px] font-semibold text-ink-700">
          {{ categoryLabel(selectedRequest.category) }}
        </span>
        <span class="rounded-pill bg-warn-50 px-2.5 py-1 text-[12px] font-semibold text-warn-700">
          {{ t('cab.priorityIs', { value: priorityLabel(selectedRequest.priority) }) }}
        </span>
      </div>

      <p
        v-if="requestNotice"
        class="flex items-start gap-2 rounded-field bg-ok-50 px-3.5 py-2.5 text-[13px] font-semibold text-ok-700 ring-1 ring-ok-100"
      >
        <UiIcon name="check" :size="16" class="mt-px shrink-0" />
        <span class="min-w-0">{{ requestNotice }}</span>
      </p>

      <p class="text-[14px] leading-relaxed text-ink-700">{{ selectedRequest.description }}</p>

      <dl class="divide-y divide-ink-100 rounded-field ring-1 ring-ink-200">
        <div class="flex items-center justify-between px-4 py-2.5">
          <dt class="text-[13px] text-ink-500">{{ field('unit') }}</dt>
          <dd class="text-[13px] font-semibold text-ink-900">{{ selectedRequest.unitCode }}</dd>
        </div>
        <div class="flex items-center justify-between px-4 py-2.5">
          <dt class="text-[13px] text-ink-500">{{ field('createdAt') }}</dt>
          <dd class="tabular text-[13px] font-semibold text-ink-900">{{ selectedRequest.createdAt }}</dd>
        </div>
        <div class="flex items-center justify-between px-4 py-2.5">
          <dt class="text-[13px] text-ink-500">{{ field('completionDue') }}</dt>
          <dd class="tabular text-[13px] font-semibold text-ink-900">
            {{ dateShort(selectedRequest.dueAt) }}
          </dd>
        </div>
        <div class="flex items-center justify-between px-4 py-2.5">
          <dt class="text-[13px] text-ink-500">{{ field('assignee') }}</dt>
          <dd class="text-[13px] font-semibold text-ink-900">
            {{ selectedRequest.assignee ?? t('cab.noAssignee') }}
          </dd>
        </div>
      </dl>

      <div v-if="selectedRequest.attachments?.length">
        <p class="mb-1.5 text-[13px] text-ink-500">{{ t('cab.attachedPhotos') }}</p>
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
          <span class="text-[13px] text-ink-500">{{ field('progress') }}</span>
          <span class="tabular text-[13px] font-bold text-ink-900">{{ selectedRequest.progress }}%</span>
        </div>
        <div class="h-2 overflow-hidden rounded-pill bg-ink-100">
          <div class="h-full rounded-pill bg-brand-500" :style="{ width: `${selectedRequest.progress}%` }" />
        </div>
      </div>

      <p
        v-if="canDecideRequest"
        class="flex items-start gap-2 rounded-field bg-info-50 px-3.5 py-2.5 text-[13px] leading-snug text-info-700"
      >
        <UiIcon name="info" :size="15" class="mt-px shrink-0" />
        <span class="min-w-0">{{ t('cab.confirmWorkHint') }}</span>
      </p>
    </div>

    <template #footer>
      <UiButton variant="ghost" @click="requestOpen = false">{{ t('common.close') }}</UiButton>
      <template v-if="canDecideRequest">
        <UiButton variant="secondary" @click="returnRequest">
          <UiIcon name="refresh" :size="16" />
          {{ t('common.return') }}
        </UiButton>
        <UiButton @click="confirmRequest">
          <UiIcon name="check" :size="16" />
          {{ t('common.confirm') }}
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
        {{ t('cab.newServiceRequest') }}
      </UiButton>
    </template>
  </UiModal>

  <UiModal
    v-model="newRequestOpen"
    :title="t('cab.newServiceRequest')"
    :subtitle="myBuilding && myUnit ? `${myBuilding.name} · Unit ${myUnit.code}` : ''"
  >
    <div class="space-y-4">
      <UiField :label="field('requestSubject')" required :error="formError">
        <UiInput
          v-model="form.title"
          :placeholder="t('cab.requestTitlePlaceholder')"
          :invalid="!!formError"
        />
      </UiField>

      <div class="grid gap-4 sm:grid-cols-2">
        <UiField :label="field('category')" required>
          <UiSelect v-model="form.category" :options="categoryOptions" />
        </UiField>
        <UiField :label="field('priority')" required>
          <UiSelect v-model="form.priority" :options="priorityOptions" />
        </UiField>
      </div>

      <UiField :label="field('detailedNote')" :hint="t('cab.describeProblemHint')">
        <textarea
          v-model="form.description"
          rows="4"
          :placeholder="t('common.additionalInfo')"
          class="w-full rounded-field bg-white px-3.5 py-2.5 text-sm text-ink-800 ring-1 ring-inset ring-ink-200 transition-colors placeholder:text-ink-400 hover:ring-ink-300 focus:ring-2 focus:ring-brand-500"
        />
      </UiField>

      <UiField :label="t('cab.addPhoto')" :hint="t('cab.photoHint')">
        <div class="space-y-2">
          <ul v-if="attachments.length" class="space-y-1.5">
            <li
              v-for="(a, i) in attachments"
              :key="`${a.name}-${i}`"
              class="flex items-center gap-2.5 rounded-field px-3 py-2 ring-1 ring-ink-200"
            >
              <UiIcon name="image" :size="16" class="shrink-0 text-brand-600" />
              <span class="min-w-0 flex-1 truncate text-[13px] text-ink-700">
                {{ a.name }}
                <span class="tabular text-ink-500">· {{ fileSize(a.size) }}</span>
              </span>
              <button
                type="button"
                class="grid size-11 shrink-0 place-items-center rounded-lg text-ink-400 transition-colors hover:bg-danger-50 hover:text-danger-600 md:size-9"
                :aria-label="t('cab.removeAttachmentAria', { name: a.name })"
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
            :aria-label="t('cab.photoFilesAria')"
            @change="onFiles"
          />
          <button
            type="button"
            class="flex w-full items-center gap-2.5 rounded-field border border-dashed border-ink-300 px-4 py-2.5 text-left transition-colors hover:border-brand-400 hover:bg-brand-50"
            @click="pickAttachments"
          >
            <UiIcon name="image" :size="18" class="shrink-0 text-ink-400" />
            <span class="min-w-0">
              <span class="block text-[13px] font-semibold text-ink-800">{{ t('cab.attachPhoto') }}</span>
              <span class="block text-[12px] text-ink-500">
                {{ t('cab.attachedCount', { n: attachments.length }) }}
              </span>
            </span>
          </button>
        </div>
      </UiField>
    </div>

    <template #footer>
      <UiButton variant="ghost" @click="newRequestOpen = false">{{ t('common.cancel') }}</UiButton>
      <UiButton @click="submitRequest">
        <UiIcon name="send" :size="16" />
        {{ t('apply.submit') }}
      </UiButton>
    </template>
  </UiModal>
</template>
