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
  label: string
  statuses: ServiceStatus[]
  dot: string
}

const auth = useAuthStore()

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
const viewTabs = [
  { value: 'table', label: 'Jadval' },
  { value: 'kanban', label: 'Kanban' },
]

const query = ref('')
const fBuilding = ref('all')
const fStatus = ref('all')
const fPriority = ref('all')
const fCategory = ref('all')
const fAssignee = ref('all')
const fSla = ref('all')

const buildingOptions = computed(() => [
  { value: 'all', label: 'Barcha obyektlar' },
  ...scopedBuildings.value.map((b) => ({ value: b.name, label: b.name })),
])

const statusOptions = computed(() => [
  { value: 'all', label: 'Barcha statuslar' },
  ...Object.keys(SERVICE_STATUS)
    .filter((k) => requests.value.some((r) => r.status === k))
    .map((k) => ({ value: k, label: SERVICE_STATUS[k]!.label })),
])

const priorityOptions = [
  { value: 'all', label: 'Barcha ustuvorliklar' },
  { value: 'Yuqori', label: 'Yuqori' },
  { value: 'O‘rtacha', label: 'O‘rtacha' },
  { value: 'Past', label: 'Past' },
]

const categoryOptions = computed(() => [
  { value: 'all', label: 'Barcha kategoriyalar' },
  ...[...new Set(requests.value.map((r) => r.category))].map((c) => ({ value: c, label: c })),
])

const assigneeOptions = computed(() => [
  { value: 'all', label: 'Barcha ijrochilar' },
  { value: 'none', label: 'Biriktirilmagan' },
  ...[...new Set(requests.value.map((r) => r.assignee).filter((a): a is string => !!a))].map(
    (a) => ({ value: a, label: a }),
  ),
])

const slaOptions = [
  { value: 'all', label: 'Barcha SLA holatlari' },
  { value: 'breached', label: 'SLA buzilgan' },
  { value: 'ok', label: 'Muddatida' },
]

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

const columns = [
  { key: 'code', label: 'Raqam', width: '158px' },
  { key: 'title', label: 'Sarlavha' },
  { key: 'place', label: 'Obyekt / Unit' },
  { key: 'requester', label: 'Murojaatchi' },
  { key: 'category', label: 'Kategoriya' },
  { key: 'priority', label: 'Ustuvorlik' },
  { key: 'sla', label: 'SLA' },
  { key: 'assignee', label: 'Ijrochi' },
  { key: 'status', label: 'Status' },
]

const PRIORITY_STYLE: Record<string, { text: string; shape: string }> = {
  Yuqori: { text: 'text-danger-600', shape: 'dot' },
  'O‘rtacha': { text: 'text-warn-600', shape: 'ring' },
  Past: { text: 'text-ink-500', shape: 'bar' },
}

const KANBAN: BoardColumn[] = [
  { key: 'new', label: 'Yangi', statuses: ['NEW', 'TRIAGE'], dot: 'bg-brand-500' },
  {
    key: 'progress',
    label: 'Jarayonda',
    statuses: ['ASSIGNED', 'INSPECTION', 'IN_PROGRESS', 'RETURNED'],
    dot: 'bg-warn-500',
  },
  {
    key: 'material',
    label: 'Material kutilmoqda',
    statuses: ['MATERIAL_PENDING'],
    dot: 'bg-warn-600',
  },
  {
    key: 'confirm',
    label: 'Tasdiqlashda',
    statuses: ['COMPLETED', 'TENANT_CONFIRMATION'],
    dot: 'bg-info-500',
  },
  { key: 'closed', label: 'Yopilgan', statuses: ['CLOSED'], dot: 'bg-ink-400' },
]

/** Biriktirish bosqichi rahbarga ham, ijrochiga ham ochiq */
const ASSIGN_OR_EXECUTE: Capability[] = ['workorder.assign', 'workorder.execute']
const EXECUTE_ONLY: Capability[] = ['workorder.execute']
/** Bajarilgan ishni ijrochining o‘zi yopmaydi: tasdiq murojaatchi tomonidan beriladi */
const CONFIRM_ONLY: Capability[] = ['workorder.assign']

interface StageMove {
  next: ServiceStatus
  label: string
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
  NEW: [{ next: 'ASSIGNED', label: 'Qabul qilish', progress: 10, capabilities: ASSIGN_OR_EXECUTE }],
  TRIAGE: [
    { next: 'ASSIGNED', label: 'Qabul qilish', progress: 10, capabilities: ASSIGN_OR_EXECUTE },
  ],
  ASSIGNED: [
    { next: 'IN_PROGRESS', label: 'Ishni boshlash', progress: 35, capabilities: EXECUTE_ONLY },
  ],
  INSPECTION: [
    { next: 'IN_PROGRESS', label: 'Ishni boshlash', progress: 35, capabilities: EXECUTE_ONLY },
  ],
  RETURNED: [
    { next: 'IN_PROGRESS', label: 'Ishni boshlash', progress: 35, capabilities: EXECUTE_ONLY },
  ],
  IN_PROGRESS: [
    {
      next: 'MATERIAL_PENDING',
      label: 'Material so‘rash',
      progress: 50,
      capabilities: EXECUTE_ONLY,
    },
    { next: 'COMPLETED', label: 'Yakunlash', progress: 100, capabilities: EXECUTE_ONLY },
  ],
  MATERIAL_PENDING: [
    { next: 'IN_PROGRESS', label: 'Ishni davom ettirish', progress: 60, capabilities: EXECUTE_ONLY },
  ],
  COMPLETED: [
    {
      next: 'TENANT_CONFIRMATION',
      label: 'Tasdiqlashga yuborish',
      progress: 100,
      capabilities: EXECUTE_ONLY,
    },
  ],
  TENANT_CONFIRMATION: [
    {
      next: 'CLOSED',
      label: 'Arizani yopish',
      progress: 100,
      capabilities: CONFIRM_ONLY,
      byRequester: true,
    },
  ],
  CLOSED: [],
}

function statusLabel(status: ServiceStatus): string {
  return SERVICE_STATUS[status]?.label ?? status
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

const board = computed(() =>
  KANBAN.map((c) => ({ ...c, items: filtered.value.filter((r) => c.statuses.includes(r.status)) })),
)

const dragId = ref('')
const dragOver = ref('')
/** Rad etilgan ko‘chirishning sababi: foydalanuvchi nima uchun bo‘lmasligini ko‘radi */
const dropError = ref('')

function startDrag(r: ServiceRequest) {
  dragId.value = r.id
  dropError.value = ''
}

function dropTo(column: BoardColumn) {
  const target = requests.value.find((r) => r.id === dragId.value)
  dragId.value = ''
  dragOver.value = ''
  if (!target) return
  if (column.statuses.includes(target.status)) return

  const move = moveInto(target, column)
  if (!move) {
    dropError.value = `${target.code}: «${statusLabel(target.status)}» bosqichidan «${column.label}» ustuniga o‘tib bo‘lmaydi, oraliq bosqichlar chetlab o‘tiladi.`
    return
  }
  if (!allowedMove(target, move)) {
    dropError.value = `${target.code}: «${move.label}» amali sizning rolingizda mavjud emas.`
    return
  }

  target.status = move.next
  target.progress = Math.max(target.progress, move.progress)
  if (!target.assignee && auth.can('workorder.execute'))
    target.assignee = auth.user?.fullName ?? 'Ijrochi'
  dropError.value = ''
}

const donutSlices = computed(() =>
  kpi.value.breakdown.map((b) => ({ label: b.label, value: b.count, tone: b.tone })),
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
    label: 'Kelib tushgan',
    tone: 'brand' as const,
    values: dynamicsDays.value.map(
      (d) => requests.value.filter((r) => r.createdAt.slice(0, 10) === d).length,
    ),
    fill: true,
  },
  {
    label: 'Bajarilgan',
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
    formError.value = 'Joylashuv va muammo tavsifi to‘ldirilishi shart'
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
    requester: auth.user?.fullName ?? 'Ijarachi',
    priority: form.priority,
    status: 'NEW',
    assignee: null,
    createdAt: `${day} 09:00`,
    dueAt: addDays(day, form.priority === 'Yuqori' ? 3 : 7),
    slaBreached: false,
    description:
      attached.length > 0
        ? `${form.description.trim()} Biriktirilgan fayllar: ${attached.join(', ')}.`
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
    title="Servis arizalari"
    subtitle="Arizalar navbati, ijro nazorati va hisoblagichlar monitoringi"
  >
    <template #actions>
      <UiButton variant="secondary" size="sm" to="/meters">
        <UiIcon name="meter" :size="16" />
        Hisoblagichlar
      </UiButton>
      <UiButton size="sm" @click="createOpen = true">
        <UiIcon name="plus" :size="16" />
        Yangi ariza
      </UiButton>
    </template>
  </AppTopbar>

  <main class="scroll-slim flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
    <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <UiKpi
        label="Yangi arizalar"
        :value="num(kpi.newCount)"
        icon="clipboard"
        tone="brand"
        class="cursor-pointer"
        @click="focusStatus('NEW')"
      />
      <UiKpi
        label="Jarayonda"
        :value="num(kpi.inProgress)"
        icon="wrench"
        tone="warn"
        class="cursor-pointer"
        @click="focusStatus('IN_PROGRESS')"
      />
      <UiKpi
        label="Bajarilgan"
        :value="num(kpi.completedToday)"
        icon="check"
        tone="ok"
        class="cursor-pointer"
        @click="focusStatus('COMPLETED')"
      />
      <UiKpi
        label="O‘rtacha bajarish vaqti"
        :value="String(kpi.avgHours)"
        unit="soat"
        icon="clock"
        tone="violet"
      />
    </section>

    <UiCard
      title="Arizalar navbati"
      :subtitle="`${rows.length} ta ariza ko‘rsatilmoqda · jami ${requests.length} ta`"
      flush
      :padded="false"
    >
      <template #actions>
        <UiTabs v-model="view" :tabs="viewTabs" />
      </template>

      <div class="grid gap-3 border-t border-ink-100 bg-surface-sunken px-5 py-4 lg:grid-cols-2 xl:grid-cols-4">
        <UiInput
          v-model="query"
          placeholder="Raqam, sarlavha yoki murojaatchi bo‘yicha qidirish"
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
            Tozalash
          </UiButton>
        </div>
      </div>

      <UiTable
        v-if="view === 'table'"
        :columns="columns"
        :rows="rows"
        :to="(row) => `/service-requests/${row.id}`"
        empty="Tanlangan filtrlarga mos ariza topilmadi"
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
            {{ row.priority }}
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
            SLA buzilgan
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
          <span v-else class="text-[13px] text-ink-400">Biriktirilmagan</span>
        </template>

        <template #cell-status="{ row }">
          <UiStatus kind="service" :value="row.status" size="sm" />
        </template>
      </UiTable>

      <div v-else class="space-y-3 p-5">
        <p class="text-[13px] text-ink-500">
          Kartani faqat keyingi bosqich ustuniga va faqat shu amal huquqi bo‘lsa ko‘chirish mumkin.
          Karta ustiga bosilsa ariza tafsiloti ochiladi.
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
                :title="canDrag(r) ? undefined : 'Bu bosqichda sizning rolingizda amal yo‘q'"
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
                  <span>{{ r.assignee ?? 'Biriktirilmagan' }}</span>
                  <span class="tabular">{{ dateShort(r.dueAt) }}</span>
                </div>
              </div>

              <p v-if="!col.items.length" class="px-1 py-6 text-center text-[13px] text-ink-400">
                Ariza yo‘q
              </p>
            </div>
          </div>
        </div>
      </div>
    </UiCard>

    <section class="grid gap-5 xl:grid-cols-3">
      <UiCard title="Arizalar bo‘yicha holat" subtitle="Joriy oy kesimida taqsimot">
        <UiDonut
          :slices="donutSlices"
          :center-value="num(donutTotal)"
          center-label="jami ariza"
          :size="176"
        />
      </UiCard>

      <UiCard title="Arizalar dinamikasi" subtitle="Kunlik kelib tushish va bajarilish">
        <UiLine :labels="dynamicsLabels" :series="dynamicsSeries" :height="196" />
      </UiCard>

      <UiCard title="Hisoblagichlar ko‘rsatkichlari" subtitle="Oxirgi qiyoslash natijalari" flush :padded="false">
        <template #actions>
          <UiButton variant="ghost" size="sm" to="/meters">
            Reyestr
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
                <span class="block truncate text-[13px] text-ink-500">{{ u.label }}</span>
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
    title="Yangi ariza"
    subtitle="Muammoni tavsiflang, ariza xizmat ko‘rsatish navbatiga tushadi"
    size="lg"
  >
    <div class="space-y-4">
      <div class="grid gap-4 sm:grid-cols-2">
        <UiField label="Kategoriya" required>
          <UiSelect
            v-model="form.category"
            :options="[
              { value: 'Santexnika', label: 'Santexnika' },
              { value: 'Elektr', label: 'Elektr' },
              { value: 'Konditsioner', label: 'Konditsioner' },
              { value: 'Qurilish', label: 'Qurilish' },
              { value: 'Tozalash', label: 'Tozalash' },
              { value: 'Boshqa', label: 'Boshqa' },
            ]"
          />
        </UiField>

        <UiField label="Ustuvorlik" required>
          <UiSelect
            v-model="form.priority"
            :options="[
              { value: 'Yuqori', label: 'Yuqori' },
              { value: 'O‘rtacha', label: 'O‘rtacha' },
              { value: 'Past', label: 'Past' },
            ]"
          />
        </UiField>

        <UiField label="Obyekt" required>
          <UiSelect
            v-model="form.building"
            :options="scopedBuildings.map((b) => ({ value: b.name, label: b.name }))"
          />
        </UiField>

        <UiField label="Joylashuv" required hint="Unit raqami yoki umumiy zona nomi">
          <UiInput v-model="form.unit" placeholder="708-xona" />
        </UiField>
      </div>

      <UiField label="Muammo tavsifi" required :error="formError">
        <textarea
          v-model="form.description"
          rows="4"
          placeholder="Muammoni qisqacha yozing"
          class="scroll-slim w-full rounded-field bg-white px-3.5 py-2.5 text-sm text-ink-800 ring-1 ring-inset ring-ink-200 transition-colors placeholder:text-ink-400 hover:ring-ink-300 focus:ring-2 focus:ring-brand-500"
        />
      </UiField>

      <UiField label="Rasm biriktirish" hint="Muammoni ko‘rsatuvchi suratlar tekshiruvni tezlashtiradi">
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
              :aria-label="`${p.file.name}: rasmni olib tashlash`"
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
            aria-label="Ariza rasmlari"
            @change="onPhotos"
          />

          <button
            v-if="photos.length < PHOTO_LIMIT"
            type="button"
            class="grid size-24 place-items-center rounded-field border-2 border-dashed border-ink-300 bg-ink-50 text-ink-500 transition-colors hover:border-brand-400 hover:bg-brand-50 hover:text-brand-600"
            aria-label="Rasm qo‘shish"
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
        <p v-else class="mt-2 text-[12px] text-ink-500">Rasm biriktirilmagan</p>
      </UiField>
    </div>

    <template #footer>
      <UiButton variant="ghost" @click="((createOpen = false), resetForm())">Bekor qilish</UiButton>
      <UiButton @click="submitRequest">
        <UiIcon name="send" :size="16" />
        Ariza yuborish
      </UiButton>
    </template>
  </UiModal>
</template>
