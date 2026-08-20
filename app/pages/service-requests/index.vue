<script setup lang="ts">
import { BUILDINGS } from '~/data/buildings'
import { SERVICE_STATUS } from '~/constants/statuses'
import {
  SERVICE_REQUESTS,
  UTILITY_SUMMARY,
  buildServiceKpi,
  type ServiceRequest,
} from '~/data/operations'
import type { Capability } from '~/types/rbac'
import { fileSize } from '~/utils/docx'
import { dateShort, num, todayIso } from '~/utils/format'

type ServiceStatus = ServiceRequest['status']

interface BoardColumn {
  key: string
  labelKey: string
  statuses: ServiceStatus[]
  dot: string
}

interface BoardLane extends BoardColumn {
  label: string
  items: ServiceRequest[]
}

const auth = useAuthStore()

const { t } = useI18n()
const { field, priorityLabel, statusLabel: statusName, moduleTitle, tr } = useAppLabels()

/** Kategoriya ma’lumotda o‘zbekcha saqlanadi, ko‘rinadigan nomi lug‘atdan olinadi */
const CATEGORY_KEY: Record<string, string> = {
  Santexnika: 'serviceCategory.plumbing',
  Elektr: 'serviceCategory.electric',
  Konditsioner: 'serviceCategory.hvac',
  Qurilish: 'serviceCategory.construction',
  Tozalash: 'serviceCategory.cleaning',
  Boshqa: 'serviceCategory.other',
}

/** Diagramma guruhlari reyestrda o‘zbekcha ataladi, nomi lug‘atdan olinadi */
const GROUP_KEY: Record<string, string> = {
  Yangi: 'status.service.NEW',
  Saralashda: 'svc.groupTriage',
  Jarayonda: 'status.service.IN_PROGRESS',
  Bajarilgan: 'status.service.COMPLETED',
  Yopilgan: 'status.service.CLOSED',
  Qaytarilgan: 'status.service.RETURNED',
}

/** Kommunal karta yorlig‘i ham hisoblagichlar reyestridan keladi */
const UTILITY_KEY: Record<string, string> = {
  'Elektr energiyasi': 'meterType.electricPower',
  Suv: 'meterType.water',
  Gaz: 'meterType.gas',
  Issiqlik: 'meterType.heating',
}

/** Foydalanuvchi biriktirilgan obyektlar. Ariza faqat shular bo‘yicha ko‘rinadi. */
const scopedBuildings = computed(() => BUILDINGS.filter((b) => auth.inScope(b.id)))
const scopedNames = computed(() => new Set(scopedBuildings.value.map((b) => b.name)))

const allRequests = useState<ServiceRequest[]>('service-requests', () =>
  SERVICE_REQUESTS.map((r) => ({ ...r })),
)

const requests = computed(() => allRequests.value.filter((r) => scopedNames.value.has(r.buildingName)))

/**
 * KPI va diagramma ekrandagi ro‘yxatdan hisoblanadi: karta bosilganda
 * jadvalda aynan o‘sha sondagi qator qoladi va rol doirasi buzilmaydi.
 */
const kpi = computed(() => buildServiceKpi(requests.value))

const view = ref('table')
const viewTabs = computed(() => [
  { value: 'table', label: t('view.table') },
  { value: 'kanban', label: t('view.kanban') },
])

const query = ref('')
const fBuilding = ref('all')
const fStatus = ref('all')
const fPriority = ref('all')
const fCategory = ref('all')
const fAssignee = ref('all')
const fSla = ref('all')

const buildingOptions = computed(() => [
  { value: 'all', label: t('filter.allBuildings') },
  ...scopedBuildings.value.map((b) => ({ value: b.name, label: b.name })),
])

const statusOptions = computed(() => [
  { value: 'all', label: t('filter.allStatuses') },
  ...Object.keys(SERVICE_STATUS)
    .filter((k) => requests.value.some((r) => r.status === k))
    .map((k) => ({ value: k, label: statusName('service', k) })),
])

const priorityOptions = computed(() => [
  { value: 'all', label: t('filter.allPriorities') },
  { value: 'Yuqori', label: priorityLabel('Yuqori') },
  { value: 'O‘rtacha', label: priorityLabel('O‘rtacha') },
  { value: 'Past', label: priorityLabel('Past') },
])

const categoryOptions = computed(() => [
  { value: 'all', label: t('filter.allCategories') },
  ...[...new Set(requests.value.map((r) => r.category))].map((c) => ({
    value: c,
    label: tr(CATEGORY_KEY[c], c),
  })),
])

const assigneeOptions = computed(() => [
  { value: 'all', label: t('filter.allExecutors') },
  { value: 'none', label: t('common.unassigned') },
  ...[...new Set(requests.value.map((r) => r.assignee).filter((a): a is string => !!a))].map(
    (a) => ({ value: a, label: a }),
  ),
])

const slaOptions = computed(() => [
  { value: 'all', label: t('filter.allSla') },
  { value: 'breached', label: t('svc.slaBreached') },
  { value: 'ok', label: t('svc.slaOnTime') },
])

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  return requests.value.filter((r) => {
    if (
      q &&
      ![r.code, r.title, r.requester, r.unitCode, r.buildingName].some((v) =>
        v.toLowerCase().includes(q),
      )
    )
      return false
    if (fBuilding.value !== 'all' && r.buildingName !== fBuilding.value) return false
    if (fStatus.value !== 'all' && r.status !== fStatus.value) return false
    if (fPriority.value !== 'all' && r.priority !== fPriority.value) return false
    if (fCategory.value !== 'all' && r.category !== fCategory.value) return false
    if (fAssignee.value === 'none' && r.assignee) return false
    if (fAssignee.value !== 'all' && fAssignee.value !== 'none' && r.assignee !== fAssignee.value)
      return false
    if (fSla.value === 'breached' && !r.slaBreached) return false
    if (fSla.value === 'ok' && r.slaBreached) return false
    return true
  })
})

const rows = computed(() => filtered.value.map((r) => ({ ...r })))

const dirty = computed(
  () =>
    !!query.value.trim() ||
    [fBuilding, fStatus, fPriority, fCategory, fAssignee, fSla].some((f) => f.value !== 'all'),
)

function resetFilters() {
  query.value = ''
  fBuilding.value = 'all'
  fStatus.value = 'all'
  fPriority.value = 'all'
  fCategory.value = 'all'
  fAssignee.value = 'all'
  fSla.value = 'all'
}

function focusStatus(value: string) {
  fStatus.value = value
  fSla.value = 'all'
}

const columns = computed(() => [
  { key: 'code', label: field('number'), width: '158px' },
  { key: 'title', label: field('title') },
  { key: 'place', label: field('objectUnit') },
  { key: 'requester', label: field('requester') },
  { key: 'category', label: field('category') },
  { key: 'priority', label: field('priority') },
  { key: 'sla', label: field('sla') },
  { key: 'assignee', label: field('executor') },
  { key: 'status', label: field('status') },
])

const PRIORITY_STYLE: Record<string, { text: string; shape: string }> = {
  Yuqori: { text: 'text-danger-600', shape: 'dot' },
  'O‘rtacha': { text: 'text-warn-600', shape: 'ring' },
  Past: { text: 'text-ink-500', shape: 'bar' },
}

const KANBAN: BoardColumn[] = [
  { key: 'new', labelKey: 'status.service.NEW', statuses: ['NEW', 'TRIAGE'], dot: 'bg-brand-500' },
  {
    key: 'progress',
    labelKey: 'status.service.IN_PROGRESS',
    statuses: ['ASSIGNED', 'INSPECTION', 'IN_PROGRESS', 'RETURNED'],
    dot: 'bg-warn-500',
  },
  {
    key: 'material',
    labelKey: 'status.service.MATERIAL_PENDING',
    statuses: ['MATERIAL_PENDING'],
    dot: 'bg-warn-600',
  },
  {
    key: 'confirm',
    labelKey: 'status.service.TENANT_CONFIRMATION',
    statuses: ['COMPLETED', 'TENANT_CONFIRMATION'],
    dot: 'bg-info-500',
  },
  { key: 'closed', labelKey: 'status.service.CLOSED', statuses: ['CLOSED'], dot: 'bg-ink-400' },
]

/** Biriktirish bosqichi rahbarga ham, ijrochiga ham ochiq */
const ASSIGN_OR_EXECUTE: Capability[] = ['workorder.assign', 'workorder.execute']
const EXECUTE_ONLY: Capability[] = ['workorder.execute']
/** Bajarilgan ishni ijrochining o‘zi yopmaydi: tasdiq murojaatchi tomonidan beriladi */
const CONFIRM_ONLY: Capability[] = ['workorder.assign']

interface StageMove {
  next: ServiceStatus
  labelKey: string
  progress: number
  /** Amalni bajarish uchun yetarli bo‘lgan huquqlar */
  capabilities: Capability[]
  /** Murojaatchi o‘z arizasini shu bosqichda o‘zi tasdiqlashi mumkin */
  byRequester?: boolean
}

/**
 * Bosqich o‘tishlari jadvali. Ariza kartasidagi amallar bilan bir xil:
 * kanbanda kartani sudrash ham shu tartibga va shu huquqlarga bo‘ysunadi,
 * shuning uchun bitta jarayon ikki xil qoida bilan ishlamaydi.
 */
const FLOW: Record<ServiceStatus, StageMove[]> = {
  NEW: [
    { next: 'ASSIGNED', labelKey: 'svc.actionAccept', progress: 10, capabilities: ASSIGN_OR_EXECUTE },
  ],
  TRIAGE: [
    { next: 'ASSIGNED', labelKey: 'svc.actionAccept', progress: 10, capabilities: ASSIGN_OR_EXECUTE },
  ],
  ASSIGNED: [
    { next: 'IN_PROGRESS', labelKey: 'svc.actionStart', progress: 35, capabilities: EXECUTE_ONLY },
  ],
  INSPECTION: [
    { next: 'IN_PROGRESS', labelKey: 'svc.actionStart', progress: 35, capabilities: EXECUTE_ONLY },
  ],
  RETURNED: [
    { next: 'IN_PROGRESS', labelKey: 'svc.actionStart', progress: 35, capabilities: EXECUTE_ONLY },
  ],
  IN_PROGRESS: [
    {
      next: 'MATERIAL_PENDING',
      labelKey: 'svc.actionMaterial',
      progress: 50,
      capabilities: EXECUTE_ONLY,
    },
    { next: 'COMPLETED', labelKey: 'svc.actionFinish', progress: 100, capabilities: EXECUTE_ONLY },
  ],
  MATERIAL_PENDING: [
    {
      next: 'IN_PROGRESS',
      labelKey: 'svc.actionResume',
      progress: 60,
      capabilities: EXECUTE_ONLY,
    },
  ],
  COMPLETED: [
    {
      next: 'TENANT_CONFIRMATION',
      labelKey: 'svc.actionSendConfirm',
      progress: 100,
      capabilities: EXECUTE_ONLY,
    },
  ],
  TENANT_CONFIRMATION: [
    {
      next: 'CLOSED',
      labelKey: 'svc.actionClose',
      progress: 100,
      capabilities: CONFIRM_ONLY,
      byRequester: true,
    },
  ],
  CLOSED: [],
}

function statusLabel(status: ServiceStatus): string {
  return statusName('service', status)
}

function movesOf(r: ServiceRequest): StageMove[] {
  return FLOW[r.status] ?? []
}

/** Amal shu foydalanuvchiga ochiqmi: huquq yoki murojaatchining o‘z tasdig‘i */
function allowedMove(r: ServiceRequest, move: StageMove): boolean {
  if (move.capabilities.some((c) => auth.can(c))) return true
  return move.byRequester === true && auth.user?.fullName === r.requester
}

/** Kamida bitta ruxsat etilgan keyingi bosqich bo‘lmasa, karta sudralmaydi */
function canDrag(r: ServiceRequest): boolean {
  return movesOf(r).some((m) => allowedMove(r, m))
}

function moveInto(r: ServiceRequest, column: BoardColumn): StageMove | undefined {
  return movesOf(r).find((m) => column.statuses.includes(m.next))
}

const board = computed<BoardLane[]>(() =>
  KANBAN.map((c) => ({
    ...c,
    label: t(c.labelKey),
    items: filtered.value.filter((r) => c.statuses.includes(r.status)),
  })),
)

const dragId = ref('')
const dragOver = ref('')
/** Rad etilgan ko‘chirishning sababi: foydalanuvchi nima uchun bo‘lmasligini ko‘radi */
const dropError = ref('')

function startDrag(r: ServiceRequest) {
  dragId.value = r.id
  dropError.value = ''
}

function dropTo(column: BoardLane) {
  const target = requests.value.find((r) => r.id === dragId.value)
  dragId.value = ''
  dragOver.value = ''
  if (!target) return
  if (column.statuses.includes(target.status)) return

  const move = moveInto(target, column)
  if (!move) {
    dropError.value = t('svc.dropSkipStage', {
      code: target.code,
      from: statusLabel(target.status),
      to: column.label,
    })
    return
  }
  if (!allowedMove(target, move)) {
    dropError.value = t('svc.dropNoRight', { code: target.code, action: t(move.labelKey) })
    return
  }

  target.status = move.next
  target.progress = Math.max(target.progress, move.progress)
  if (!target.assignee && auth.can('workorder.execute'))
    target.assignee = auth.user?.fullName ?? t('field.executor')
  dropError.value = ''
}

const donutSlices = computed(() =>
  kpi.value.breakdown.map((b) => ({
    label: tr(GROUP_KEY[b.label], b.label),
    value: b.count,
    tone: b.tone,
  })),
)
const donutTotal = computed(() => kpi.value.breakdown.reduce((s, b) => s + b.count, 0))

/** Dinamika oynasi: ro‘yxatdagi eng so‘nggi harakat kunidan orqaga sanaladi */
const DYNAMICS_DAYS = 7

const lastActivityDay = computed(() => {
  const last = requests.value.reduce((m, r) => {
    const day = (r.completedAt ?? r.createdAt).slice(0, 10)
    return day > m ? day : m
  }, '')
  return last || todayIso()
})

const dynamicsDays = computed(() =>
  Array.from({ length: DYNAMICS_DAYS }, (_, i) =>
    addDays(lastActivityDay.value, i - (DYNAMICS_DAYS - 1)),
  ),
)

const dynamicsLabels = computed(() => dynamicsDays.value.map((d) => `${d.slice(8)}.${d.slice(5, 7)}`))

const dynamicsSeries = computed(() => [
  {
    label: t('svc.seriesIncoming'),
    tone: 'brand' as const,
    values: dynamicsDays.value.map(
      (d) => requests.value.filter((r) => r.createdAt.slice(0, 10) === d).length,
    ),
    fill: true,
  },
  {
    label: t('status.service.COMPLETED'),
    tone: 'ok' as const,
    values: dynamicsDays.value.map(
      (d) => requests.value.filter((r) => (r.completedAt ?? '').slice(0, 10) === d).length,
    ),
  },
])

const UTILITY_TONE = ['brand', 'brand', 'warn', 'danger'] as const

const latestDay = computed(() =>
  requests.value.reduce((m, r) => (r.createdAt > m ? r.createdAt : m), '2025-05-18 08:40').slice(0, 10),
)

function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

const createOpen = ref(false)
const formError = ref('')
const form = reactive({
  category: 'Santexnika' as ServiceRequest['category'],
  building: scopedBuildings.value[0]?.name ?? BUILDINGS[0]!.name,
  unit: '',
  description: '',
  priority: 'O‘rtacha' as ServiceRequest['priority'],
})

/** Biriktirilgan rasmlar: haqiqiy fayllar va ularning ko‘rinishi */
const photos = ref<Array<{ file: File; url: string }>>([])
const photoInput = ref<HTMLInputElement | null>(null)
const PHOTO_LIMIT = 4

function pickPhotos() {
  photoInput.value?.click()
}

function onPhotos(event: Event) {
  const target = event.target as HTMLInputElement
  const picked = Array.from(target.files ?? [])
  target.value = ''
  for (const file of picked) {
    if (photos.value.length >= PHOTO_LIMIT) break
    photos.value.push({ file, url: URL.createObjectURL(file) })
  }
}

function removePhoto(index: number) {
  const gone = photos.value.splice(index, 1)[0]
  if (gone) URL.revokeObjectURL(gone.url)
}

function clearPhotos() {
  for (const p of photos.value) URL.revokeObjectURL(p.url)
  photos.value = []
}

onBeforeUnmount(clearPhotos)

function resetForm() {
  form.category = 'Santexnika'
  form.building = scopedBuildings.value[0]?.name ?? BUILDINGS[0]!.name
  form.unit = ''
  form.description = ''
  form.priority = 'O‘rtacha'
  clearPhotos()
  formError.value = ''
}

function submitRequest() {
  if (!form.unit.trim() || !form.description.trim()) {
    formError.value = t('svc.formRequired')
    return
  }
  const seq = allRequests.value.reduce((m, r) => Math.max(m, Number(r.code.slice(-4)) || 0), 0) + 1
  const numbered = String(seq).padStart(4, '0')
  const day = latestDay.value
  const attached = photos.value.map((p) => p.file.name)
  allRequests.value.unshift({
    id: `s-${numbered}`,
    code: `SR-2025-${numbered}`,
    title: form.description.trim().split('.')[0]!.slice(0, 58),
    category: form.category,
    buildingName: form.building,
    unitCode: form.unit.trim(),
    requester: auth.user?.fullName ?? t('field.tenant'),
    priority: form.priority,
    status: 'NEW',
    assignee: null,
    createdAt: `${day} 09:00`,
    dueAt: addDays(day, form.priority === 'Yuqori' ? 3 : 7),
    slaBreached: false,
    description:
      attached.length > 0
        ? `${form.description.trim()} ${t('svc.attachedFiles', { files: attached.join(', ') })}`
        : form.description.trim(),
    progress: 0,
  })
  resetFilters()
  createOpen.value = false
  resetForm()
}
</script>

<template>
  <AppTopbar
    :title="moduleTitle('serviceRequests')"
    :subtitle="t('svc.pageCaption')"
  >
    <template #actions>
      <UiButton variant="secondary" size="sm" to="/meters">
        <UiIcon name="meter" :size="16" />
        {{ moduleTitle('meters') }}
      </UiButton>
      <UiButton size="sm" @click="createOpen = true">
        <UiIcon name="plus" :size="16" />
        {{ t('svc.newRequest') }}
      </UiButton>
    </template>
  </AppTopbar>

  <main class="scroll-slim flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
    <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <UiKpi
        :label="t('kpi.newApplications')"
        :value="num(kpi.newCount)"
        icon="clipboard"
        tone="brand"
        class="cursor-pointer"
        @click="focusStatus('NEW')"
      />
      <UiKpi
        :label="t('status.service.IN_PROGRESS')"
        :value="num(kpi.inProgress)"
        icon="wrench"
        tone="warn"
        class="cursor-pointer"
        @click="focusStatus('IN_PROGRESS')"
      />
      <UiKpi
        :label="t('status.service.COMPLETED')"
        :value="num(kpi.completedToday)"
        icon="check"
        tone="ok"
        class="cursor-pointer"
        @click="focusStatus('COMPLETED')"
      />
      <UiKpi
        :label="t('kpi.avgResolution')"
        :value="String(kpi.avgHours)"
        :unit="t('unitOf.hour')"
        icon="clock"
        tone="violet"
      />
    </section>

    <UiCard
      :title="t('svc.queueTitle')"
      :subtitle="t('svc.queueSubtitle', { shown: rows.length, total: requests.length })"
      flush
      :padded="false"
    >
      <template #actions>
        <UiTabs v-model="view" :tabs="viewTabs" />
      </template>

      <div class="grid gap-3 border-t border-ink-100 bg-surface-sunken px-5 py-4 lg:grid-cols-2 xl:grid-cols-4">
        <UiInput
          v-model="query"
          :placeholder="t('svc.searchPlaceholder')"
          class="xl:col-span-2"
        >
          <template #prefix>
            <UiIcon name="search" :size="18" />
          </template>
        </UiInput>
        <UiSelect v-model="fBuilding" :options="buildingOptions" />
        <UiSelect v-model="fStatus" :options="statusOptions" />
        <UiSelect v-model="fPriority" :options="priorityOptions" />
        <UiSelect v-model="fCategory" :options="categoryOptions" />
        <UiSelect v-model="fAssignee" :options="assigneeOptions" />
        <div class="flex items-center gap-2">
          <UiSelect v-model="fSla" :options="slaOptions" class="flex-1" />
          <UiButton v-if="dirty" variant="ghost" size="sm" @click="resetFilters">
            <UiIcon name="refresh" :size="16" />
            {{ t('common.reset') }}
          </UiButton>
        </div>
      </div>

      <UiTable
        v-if="view === 'table'"
        :columns="columns"
        :rows="rows"
        :to="(row) => `/service-requests/${row.id}`"
        :empty="t('empty.noMatchingRequests')"
      >
        <template #cell-code="{ row }">
          <span class="flex items-center gap-2">
            <span
              class="size-1.5 shrink-0 rounded-full"
              :class="row.slaBreached ? 'bg-danger-500' : 'bg-ink-300'"
            />
            <span class="tabular text-[13px] font-bold text-ink-900">{{ row.code }}</span>
          </span>
        </template>

        <template #cell-title="{ row }">
          <span class="block max-w-[19rem] truncate font-semibold text-ink-900">
            {{ row.title }}
          </span>
        </template>

        <template #cell-place="{ row }">
          <span class="block text-[13px] text-ink-700">{{ row.buildingName }}</span>
          <span class="block text-[12px] text-ink-500">{{ row.unitCode }}</span>
        </template>

        <template #cell-priority="{ row }">
          <span
            class="inline-flex items-center gap-1.5 text-[13px] font-semibold"
            :class="PRIORITY_STYLE[row.priority]?.text"
          >
            <svg class="size-3 shrink-0" viewBox="0 0 12 12" aria-hidden="true">
              <circle
                v-if="PRIORITY_STYLE[row.priority]?.shape === 'dot'"
                cx="6"
                cy="6"
                r="4"
                fill="currentColor"
              />
              <circle
                v-else-if="PRIORITY_STYLE[row.priority]?.shape === 'ring'"
                cx="6"
                cy="6"
                r="3.6"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              />
              <rect v-else x="1.8" y="4.6" width="8.4" height="2.8" rx="1.4" fill="currentColor" />
            </svg>
            {{ priorityLabel(row.priority) }}
          </span>
        </template>

        <template #cell-sla="{ row }">
          <span
            v-if="row.slaBreached"
            class="inline-flex items-center gap-1.5 rounded-pill bg-danger-50 px-2.5 py-1 text-xs font-semibold text-danger-700 ring-1 ring-inset ring-danger-100"
          >
            <svg class="size-3 shrink-0 text-danger-500" viewBox="0 0 12 12" aria-hidden="true">
              <path d="M6 1.2 11.4 10.8H.6z" fill="currentColor" />
            </svg>
            {{ t('svc.slaBreached') }}
          </span>
          <span
            v-else
            class="inline-flex items-center gap-1.5 rounded-pill bg-ok-50 px-2.5 py-1 text-xs font-semibold text-ok-700 ring-1 ring-inset ring-ok-100"
          >
            <svg
              class="size-3 shrink-0 text-ok-500"
              viewBox="0 0 12 12"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M2.6 6.3 5 8.7l4.4-5"
                stroke="currentColor"
                stroke-width="1.9"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            {{ dateShort(row.dueAt) }}
          </span>
        </template>

        <template #cell-assignee="{ row }">
          <span v-if="row.assignee" class="text-[13px] text-ink-700">{{ row.assignee }}</span>
          <span v-else class="text-[13px] text-ink-400">{{ t('common.unassigned') }}</span>
        </template>

        <template #cell-status="{ row }">
          <UiStatus kind="service" :value="row.status" size="sm" />
        </template>
      </UiTable>

      <div v-else class="space-y-3 p-5">
        <p class="text-[13px] text-ink-500">
          {{ t('svc.kanbanHint') }}
        </p>

        <p
          v-if="dropError"
          class="rounded-field bg-danger-50 px-4 py-2.5 text-[13px] font-medium text-danger-700 ring-1 ring-inset ring-danger-100"
          role="status"
        >
          {{ dropError }}
        </p>

        <div class="scroll-slim grid gap-4 overflow-x-auto xl:grid-cols-[repeat(5,minmax(248px,1fr))]">
          <div
            v-for="col in board"
            :key="col.key"
            class="min-w-[248px] rounded-card bg-surface-sunken p-3 ring-1 transition-colors"
            :class="dragOver === col.key ? 'ring-2 ring-brand-400' : 'ring-ink-200/70'"
            @dragover.prevent="dragOver = col.key"
            @dragleave="dragOver = dragOver === col.key ? '' : dragOver"
            @drop.prevent="dropTo(col)"
          >
            <div class="mb-3 flex items-center gap-2 px-1">
              <span class="size-2 rounded-full" :class="col.dot" />
              <span class="flex-1 truncate text-[13px] font-bold text-ink-900">{{ col.label }}</span>
              <span class="tabular rounded-pill bg-white px-2 py-0.5 text-[12px] font-bold text-ink-600 ring-1 ring-ink-200">
                {{ col.items.length }}
              </span>
            </div>

            <div class="space-y-2.5">
              <div
                v-for="r in col.items"
                :key="r.id"
                role="button"
                tabindex="0"
                :draggable="canDrag(r)"
                :title="canDrag(r) ? undefined : t('svc.noStageAction')"
                class="rounded-field bg-surface p-3 shadow-card ring-1 ring-ink-200/70 transition-shadow hover:shadow-panel"
                :class="[
                  canDrag(r) ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
                  dragId === r.id ? 'opacity-50' : '',
                ]"
                @dragstart="startDrag(r)"
                @dragend="((dragId = ''), (dragOver = ''))"
                @click="navigateTo(`/service-requests/${r.id}`)"
                @keydown.enter="navigateTo(`/service-requests/${r.id}`)"
              >
                <div class="flex items-center justify-between gap-2">
                  <span class="tabular text-[12px] font-bold text-brand-600">{{ r.code }}</span>
                  <UiIcon name="dots" :size="14" class="text-ink-300" />
                </div>
                <p class="mt-1.5 text-[14px] font-semibold leading-snug text-ink-900">
                  {{ r.title }}
                </p>
                <p class="mt-1 truncate text-[12px] text-ink-500">
                  {{ r.buildingName }} · {{ r.unitCode }}
                </p>

                <div class="mt-2.5 flex flex-wrap items-center gap-2">
                  <UiStatus kind="service" :value="r.status" size="sm" />
                  <span
                    v-if="r.slaBreached"
                    class="inline-flex items-center gap-1 rounded-pill bg-danger-50 px-2 py-0.5 text-[11px] font-semibold text-danger-700 ring-1 ring-inset ring-danger-100"
                  >
                    <svg class="size-2.5 text-danger-500" viewBox="0 0 12 12" aria-hidden="true">
                      <path d="M6 1.2 11.4 10.8H.6z" fill="currentColor" />
                    </svg>
                    SLA
                  </span>
                </div>

                <div class="mt-2.5 h-1.5 overflow-hidden rounded-pill bg-ink-100">
                  <div
                    class="h-full rounded-pill"
                    :class="r.progress === 100 ? 'bg-ok-500' : 'bg-brand-500'"
                    :style="{ width: `${Math.max(r.progress, 3)}%` }"
                  />
                </div>
                <div class="mt-1.5 flex items-center justify-between text-[12px] text-ink-500">
                  <span>{{ r.assignee ?? t('common.unassigned') }}</span>
                  <span class="tabular">{{ dateShort(r.dueAt) }}</span>
                </div>
              </div>

              <p v-if="!col.items.length" class="px-1 py-6 text-center text-[13px] text-ink-400">
                {{ t('empty.noApplications') }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </UiCard>

    <section class="grid gap-5 xl:grid-cols-3">
      <UiCard :title="t('svc.statusBreakdown')" :subtitle="t('svc.statusBreakdownHint')">
        <UiDonut
          :slices="donutSlices"
          :center-value="num(donutTotal)"
          :center-label="t('svc.totalRequests')"
          :size="176"
        />
      </UiCard>

      <UiCard :title="t('svc.requestDynamics')" :subtitle="t('svc.requestDynamicsHint')">
        <UiLine :labels="dynamicsLabels" :series="dynamicsSeries" :height="196" />
      </UiCard>

      <UiCard :title="t('svc.meterReadings')" :subtitle="t('svc.meterReadingsHint')" flush :padded="false">
        <template #actions>
          <UiButton variant="ghost" size="sm" to="/meters">
            {{ t('common.registry') }}
            <UiIcon name="chevronRight" :size="15" />
          </UiButton>
        </template>

        <ul class="divide-y divide-ink-100 border-t border-ink-100">
          <li v-for="(u, i) in UTILITY_SUMMARY" :key="u.label">
            <NuxtLink to="/meters" class="group flex items-center gap-3.5 px-5 py-3.5">
              <span
                class="grid size-10 shrink-0 place-items-center rounded-[10px]"
                :class="{
                  'bg-brand-50 text-brand-600': UTILITY_TONE[i] === 'brand',
                  'bg-warn-50 text-warn-600': UTILITY_TONE[i] === 'warn',
                  'bg-danger-50 text-danger-600': UTILITY_TONE[i] === 'danger',
                }"
              >
                <UiIcon :name="u.icon" :size="18" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-[13px] text-ink-500">
                  {{ tr(UTILITY_KEY[u.label], u.label) }}
                </span>
                <span class="tabular block text-[16px] font-bold text-ink-900 group-hover:text-brand-600">
                  {{ u.value }}
                  <span class="text-[12px] font-medium text-ink-500">{{ u.unit }}</span>
                </span>
              </span>
              <span
                class="inline-flex shrink-0 items-center gap-1 rounded-pill px-2 py-0.5 text-[12px] font-semibold"
                :class="u.delta >= 0 ? 'bg-ok-50 text-ok-700' : 'bg-danger-50 text-danger-700'"
              >
                <UiIcon :name="u.delta >= 0 ? 'arrowUp' : 'arrowDown'" :size="12" />
                {{ u.delta > 0 ? '+' : '' }}{{ u.delta }}%
              </span>
            </NuxtLink>
          </li>
        </ul>
      </UiCard>
    </section>
  </main>

  <UiModal
    v-model="createOpen"
    :title="t('svc.newRequest')"
    :subtitle="t('svc.newRequestHint')"
    size="lg"
  >
    <div class="space-y-4">
      <div class="grid gap-4 sm:grid-cols-2">
        <UiField :label="field('category')" required>
          <UiSelect
            v-model="form.category"
            :options="[
              { value: 'Santexnika', label: t('serviceCategory.plumbing') },
              { value: 'Elektr', label: t('serviceCategory.electric') },
              { value: 'Konditsioner', label: t('serviceCategory.hvac') },
              { value: 'Qurilish', label: t('serviceCategory.construction') },
              { value: 'Tozalash', label: t('serviceCategory.cleaning') },
              { value: 'Boshqa', label: t('serviceCategory.other') },
            ]"
          />
        </UiField>

        <UiField :label="field('priority')" required>
          <UiSelect
            v-model="form.priority"
            :options="[
              { value: 'Yuqori', label: priorityLabel('Yuqori') },
              { value: 'O‘rtacha', label: priorityLabel('O‘rtacha') },
              { value: 'Past', label: priorityLabel('Past') },
            ]"
          />
        </UiField>

        <UiField :label="field('object')" required>
          <UiSelect
            v-model="form.building"
            :options="scopedBuildings.map((b) => ({ value: b.name, label: b.name }))"
          />
        </UiField>

        <UiField :label="field('location')" required :hint="t('svc.locationHint')">
          <UiInput v-model="form.unit" :placeholder="t('svc.locationPlaceholder')" />
        </UiField>
      </div>

      <UiField :label="t('svc.problemDescription')" required :error="formError">
        <textarea
          v-model="form.description"
          rows="4"
          :placeholder="t('svc.problemPlaceholder')"
          class="scroll-slim w-full rounded-field bg-white px-3.5 py-2.5 text-sm text-ink-800 ring-1 ring-inset ring-ink-200 transition-colors placeholder:text-ink-400 hover:ring-ink-300 focus:ring-2 focus:ring-brand-500"
        />
      </UiField>

      <UiField :label="t('svc.attachPhoto')" :hint="t('svc.attachPhotoHint')">
        <div class="flex flex-wrap gap-3">
          <div
            v-for="(p, i) in photos"
            :key="`${p.file.name}-${i}`"
            class="relative size-24 overflow-hidden rounded-field ring-1 ring-ink-200"
          >
            <img :src="p.url" :alt="p.file.name" class="size-full object-cover" />
            <button
              type="button"
              class="absolute right-1 top-1 grid size-8 place-items-center rounded-full bg-ink-900/60 text-white transition-colors hover:bg-danger-600 md:size-6"
              :aria-label="t('svc.removePhoto', { name: p.file.name })"
              @click="removePhoto(i)"
            >
              <UiIcon name="x" :size="13" />
            </button>
          </div>

          <input
            ref="photoInput"
            type="file"
            accept="image/*"
            multiple
            class="sr-only"
            :aria-label="t('svc.requestPhotos')"
            @change="onPhotos"
          />

          <button
            v-if="photos.length < PHOTO_LIMIT"
            type="button"
            class="grid size-24 place-items-center rounded-field border-2 border-dashed border-ink-300 bg-ink-50 text-ink-500 transition-colors hover:border-brand-400 hover:bg-brand-50 hover:text-brand-600"
            :aria-label="t('svc.addPhoto')"
            @click="pickPhotos"
          >
            <svg viewBox="0 0 32 32" class="size-8" fill="none" aria-hidden="true">
              <rect
                x="3"
                y="7"
                width="26"
                height="18"
                rx="3"
                stroke="currentColor"
                stroke-width="1.8"
              />
              <circle cx="16" cy="16" r="4.6" stroke="currentColor" stroke-width="1.8" />
              <path d="M16 12.6v6.8M12.6 16h6.8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
            </svg>
          </button>
        </div>
        <ul v-if="photos.length" class="mt-2 space-y-1">
          <li
            v-for="(p, i) in photos"
            :key="`n-${p.file.name}-${i}`"
            class="tabular truncate text-[12px] text-ink-500"
          >
            {{ p.file.name }} · {{ fileSize(p.file.size) }}
          </li>
        </ul>
        <p v-else class="mt-2 text-[12px] text-ink-500">{{ t('svc.noPhoto') }}</p>
      </UiField>
    </div>

    <template #footer>
      <UiButton variant="ghost" @click="((createOpen = false), resetForm())">
        {{ t('common.cancel') }}
      </UiButton>
      <UiButton @click="submitRequest">
        <UiIcon name="send" :size="16" />
        {{ t('svc.submitRequest') }}
      </UiButton>
    </template>
  </UiModal>
</template>
