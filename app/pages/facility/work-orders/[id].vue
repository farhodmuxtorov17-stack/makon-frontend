<script setup lang="ts">
import { BUILDINGS } from '~/data/buildings'
import {
  MATERIAL_REQUESTS,
  SERVICE_REQUESTS,
  checklistFor,
  materialsFor,
  materialsTotal,
  type MaterialRequest,
  type ServiceRequest,
  type WorkMaterialLine,
} from '~/data/operations'
import { docxBlob, fileSize, saveBlob, type DocxLine } from '~/utils/docx'
import { dateShort, sum } from '~/utils/format'

/** Material so‘rovi reyestrdagi yozuvga asos va haqiqiy pozitsiyalarni qo‘shadi */
interface MaterialRequestEntry extends MaterialRequest {
  reason?: string
  lines?: WorkMaterialLine[]
}

const route = useRoute()
const auth = useAuthStore()

const { t } = useI18n()
const { money, field, priorityLabel, moduleTitle, statusLabel, tr } = useAppLabels()

/** Kategoriya ma’lumotda o‘zbekcha saqlanadi, ko‘rinadigan nomi lug‘atdan olinadi */
const CATEGORY_KEY: Record<string, string> = {
  Santexnika: 'serviceCategory.plumbing',
  Elektr: 'serviceCategory.electric',
  Konditsioner: 'serviceCategory.hvac',
  Qurilish: 'serviceCategory.construction',
  Tozalash: 'serviceCategory.cleaning',
  Boshqa: 'serviceCategory.other',
}

/** Ijro amallari faqat ijrochida: rahbar biriktiradi va kuzatadi */
const canExecute = computed(() => auth.can('workorder.execute'))

/** Ro‘yxat sahifasi nomi rolga bog‘langan, nav zanjiri ham shu atamani oladi */
const listTitle = computed(() =>
  canExecute.value ? moduleTitle('myWorkOrders') : moduleTitle('workOrders'),
)

const requests = useState<ServiceRequest[]>('service-requests', () =>
  SERVICE_REQUESTS.map((r) => ({ ...r })),
)

const checks = useState<Record<string, boolean[]>>('work-order-checks', () =>
  Object.fromEntries(SERVICE_REQUESTS.map((r) => [r.id, checklistFor(r).map((c) => c.done)])),
)
const evidence = useState<Record<string, number>>('work-order-evidence', () =>
  Object.fromEntries(SERVICE_REQUESTS.map((r) => [r.id, Math.min(4, Math.round(r.progress / 25))])),
)
const notes = useState<Record<string, string[]>>('work-order-notes', () => ({}))

/**
 * Bino doirasi bu yerda ham tekshiriladi, aks holda topshiriqni havola
 * orqali doiradan tashqarida ham ochish mumkin edi.
 */
const order = computed(() => {
  const found = requests.value.find((r) => r.id === String(route.params.id))
  if (!found) return undefined
  const site = BUILDINGS.find((b) => b.name === found.buildingName)
  return site && !auth.inScope(site.id) ? undefined : found
})

/** Chek-list bandlari topshiriq kategoriyasidan quriladi */
const checklist = computed(() => (order.value ? checklistFor(order.value) : []))

const orderChecks = computed(() => {
  const o = order.value
  if (!o) return []
  const items = checklistFor(o)
  const saved = checks.value[o.id]
  const fits = !!saved && saved.length === items.length
  return items.map((c, i) => (fits ? saved![i] === true : c.done))
})

const doneCount = computed(() => orderChecks.value.filter(Boolean).length)
const evidenceCount = computed(() => (order.value ? (evidence.value[order.value.id] ?? 0) : 0))
const orderNotes = computed(() => (order.value ? (notes.value[order.value.id] ?? []) : []))

function toggleCheck(index: number) {
  const o = order.value
  if (!canExecute.value || !o) return
  const items = checklistFor(o)
  const saved = checks.value[o.id]
  const list = saved && saved.length === items.length ? [...saved] : items.map((c) => c.done)
  list[index] = !list[index]
  checks.value[o.id] = list
}

/** Material so‘rovlari reyestri: material sahifasi va ombor bilan umumiy */
const materialRequests = useState<MaterialRequestEntry[]>('material-requests', () =>
  MATERIAL_REQUESTS.map((r) => ({ ...r })),
)

/** Materiallar topshiriq kodiga bog‘langan: har bir ishda o‘z pozitsiyalari */
const materials = computed(() => (order.value ? materialsFor(order.value.code) : []))

/** Taxminiy xarajat: topshiriq bo‘yicha rejalashtirilgan material qiymati */
const estimate = computed(() => (order.value ? materialsTotal(order.value.code) : 0))

/** Amaldagi xarajat faqat ombordan berilgan so‘rov bo‘yicha aniqlanadi */
const issuedRequest = computed(() =>
  materialRequests.value.find((m) => m.workOrder === order.value?.code && m.status === 'ISSUED'),
)
const actual = computed(() => issuedRequest.value?.amount ?? 0)

/** Akt faqat bajarilgan ishga beriladi */
const ACT_STATUSES: ServiceRequest['status'][] = ['COMPLETED', 'TENANT_CONFIRMATION', 'CLOSED']
const actReady = computed(() => !!order.value && ACT_STATUSES.includes(order.value.status))

/**
 * Aktning yagona sana manbasi: ish yakunlangan kun. Kartada, modalda va
 * hujjatda aynan shu sana chiqadi.
 */
function actDate(o: ServiceRequest): string {
  return (o.completedAt ?? o.dueAt).slice(0, 10)
}

const PRIORITY_STYLE: Record<string, { text: string; shape: string }> = {
  Yuqori: { text: 'text-danger-600', shape: 'dot' },
  'O‘rtacha': { text: 'text-warn-600', shape: 'ring' },
  Past: { text: 'text-ink-500', shape: 'bar' },
}

const uploadOpen = ref(false)
const uploadNote = ref('')

/** Haqiqiy fayllar: tanlash oynasi orqali olinadi */
const uploadFiles = ref<File[]>([])
const uploadInput = ref<HTMLInputElement | null>(null)

function pickUploadFiles() {
  uploadInput.value?.click()
}

function onUploadFiles(event: Event) {
  const target = event.target as HTMLInputElement
  const picked = Array.from(target.files ?? [])
  target.value = ''
  if (picked.length === 0) return
  uploadFiles.value = [...uploadFiles.value, ...picked]
}

function removeUploadFile(index: number) {
  uploadFiles.value.splice(index, 1)
}

function saveUpload() {
  if (!canExecute.value) return
  const o = order.value
  if (!o || uploadFiles.value.length === 0) return
  evidence.value[o.id] = (evidence.value[o.id] ?? 0) + uploadFiles.value.length
  const names = uploadFiles.value.map((x) => x.name).join(', ')
  notes.value[o.id] = [
    t('wo.noteWithFiles', {
      note: uploadNote.value.trim() || t('wo.uploadNoteDefault'),
      files: names,
    }),
    ...(notes.value[o.id] ?? []),
  ]
  o.progress = Math.max(o.progress, 90)
  uploadFiles.value = []
  uploadNote.value = ''
  uploadOpen.value = false
}

const evidenceOpen = ref(false)
const evidenceFiles = ref<Array<{ file: File; url: string }>>([])
const evidenceInput = ref<HTMLInputElement | null>(null)

function pickEvidence() {
  evidenceInput.value?.click()
}

function onEvidenceFiles(event: Event) {
  const target = event.target as HTMLInputElement
  const picked = Array.from(target.files ?? [])
  target.value = ''
  for (const file of picked) evidenceFiles.value.push({ file, url: URL.createObjectURL(file) })
}

function removeEvidence(index: number) {
  const gone = evidenceFiles.value.splice(index, 1)[0]
  if (gone) URL.revokeObjectURL(gone.url)
}

function clearEvidence() {
  for (const e of evidenceFiles.value) URL.revokeObjectURL(e.url)
  evidenceFiles.value = []
}

onBeforeUnmount(clearEvidence)

function saveEvidence() {
  if (!canExecute.value) return
  const o = order.value
  if (!o || evidenceFiles.value.length === 0) return
  evidence.value[o.id] = (evidence.value[o.id] ?? 0) + evidenceFiles.value.length
  notes.value[o.id] = [
    t('wo.evidenceAttachedNote', {
      files: evidenceFiles.value.map((e) => e.file.name).join(', '),
    }),
    ...(notes.value[o.id] ?? []),
  ]
  clearEvidence()
  evidenceOpen.value = false
}

const noteOpen = ref(false)
const noteText = ref('')
const noteError = ref('')

function saveNote() {
  if (!canExecute.value) return
  const o = order.value
  if (!o) return
  if (!noteText.value.trim()) {
    noteError.value = t('wo.noteRequired')
    return
  }
  notes.value[o.id] = [noteText.value.trim(), ...(notes.value[o.id] ?? [])]
  noteText.value = ''
  noteError.value = ''
  noteOpen.value = false
}

const actOpen = ref(false)

function printAct() {
  if (import.meta.client) window.print()
}

/** Bajarilgan ish akti Word hujjati sifatida */
function actLines(o: ServiceRequest): DocxLine[] {
  return [
    { text: 'Makon Property Group', style: 'subtitle' },
    { text: t('wo.actTitle'), style: 'title' },
    { text: `${o.code} · ${dateShort(actDate(o))}`, style: 'subtitle' },
    { text: t('wo.order'), style: 'heading' },
    { text: t('wo.actLineTitle', { value: o.title }) },
    { text: t('wo.actLineObject', { building: o.buildingName, unit: o.unitCode }) },
    { text: t('wo.actLineRequester', { value: o.requester }) },
    { text: t('wo.actLineExecutor', { value: o.assignee ?? t('wo.unassigned') }) },
    {
      text: t('wo.actLineCategory', {
        category: tr(CATEGORY_KEY[o.category], o.category),
        priority: priorityLabel(o.priority),
      }),
    },
    { text: t('wo.actLineCompletedAt', { value: dateShort(actDate(o)) }) },
    { text: t('navShort.materials'), style: 'heading' },
    ...materialsFor(o.code).map((m) => ({
      text: t('wo.actLineMaterial', {
        name: m.name,
        qty: m.qty,
        unit: m.unit,
        total: sum(m.qty * m.price),
      }),
    })),
    {
      text: t('wo.actLineActual', {
        value: issuedRequest.value ? sum(actual.value) : t('wo.notIssuedInline'),
      }),
    },
    { text: t('wo.actLineEstimate', { value: sum(estimate.value) }), style: 'small' },
    { text: t('wo.actSignatures'), style: 'heading' },
    { text: t('wo.actLineHandedOver', { value: o.assignee ?? t('wo.unassigned') }), style: 'small' },
    { text: t('wo.actLineAccepted', { value: o.requester }), style: 'small' },
  ]
}

function downloadAct() {
  const o = order.value
  if (!o || !actReady.value) return
  saveBlob(docxBlob(actLines(o)), `${o.code}-akt.docx`)
}
</script>

<template>
  <AppTopbar
    :title="order?.title ?? t('wo.notFound')"
    :subtitle="order ? `${order.code} · ${order.buildingName}` : t('wo.notFoundSubtitle')"
    :breadcrumb="[
      { label: listTitle, to: '/facility/work-orders' },
      { label: order?.code ?? t('wo.order') },
    ]"
  >
    <template #actions>
      <UiButton variant="secondary" size="sm" to="/facility/work-orders">
        <UiIcon name="chevronLeft" :size="16" />
        {{ t('common.backToList') }}
      </UiButton>
      <UiButton v-if="order" size="sm" :to="`/service-requests/${order.id}`">
        <UiIcon name="clipboard" :size="16" />
        {{ t('wo.requestCard') }}
      </UiButton>
    </template>
  </AppTopbar>

  <main class="scroll-slim flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
    <section v-if="order" class="grid gap-5 xl:grid-cols-3">
      <div class="space-y-5 xl:col-span-2">
        <UiCard>
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0">
              <h2 class="text-[22px] font-bold leading-tight text-ink-900">{{ order.title }}</h2>
              <p class="tabular mt-1 text-[13px] font-semibold text-brand-600">{{ order.code }}</p>
            </div>
            <UiStatus kind="service" :value="order.status" />
          </div>

          <dl class="mt-5 grid gap-x-5 gap-y-4 rounded-field bg-surface-sunken p-4 sm:grid-cols-3 lg:grid-cols-5">
            <div class="min-w-0">
              <dt class="text-[12px] text-ink-500">{{ field('object') }}</dt>
              <dd class="mt-0.5 truncate text-[14px] font-semibold text-ink-900">
                {{ order.buildingName }}
              </dd>
            </div>
            <div class="min-w-0">
              <dt class="text-[12px] text-ink-500">{{ field('location') }}</dt>
              <dd class="mt-0.5 truncate text-[14px] font-semibold text-ink-900">
                {{ order.unitCode }}
              </dd>
            </div>
            <div class="min-w-0">
              <dt class="text-[12px] text-ink-500">{{ t('wo.orderedBy') }}</dt>
              <dd class="mt-0.5 truncate text-[14px] font-semibold text-ink-900">
                {{ order.requester }}
              </dd>
            </div>
            <div class="min-w-0">
              <dt class="text-[12px] text-ink-500">{{ field('deadline') }}</dt>
              <dd class="tabular mt-0.5 text-[14px] font-semibold text-ink-900">
                {{ dateShort(order.dueAt) }}
              </dd>
            </div>
            <div class="min-w-0">
              <dt class="text-[12px] text-ink-500">{{ field('priority') }}</dt>
              <dd
                class="mt-0.5 inline-flex items-center gap-1.5 text-[14px] font-semibold"
                :class="PRIORITY_STYLE[order.priority]?.text"
              >
                <svg class="size-3 shrink-0" viewBox="0 0 12 12" aria-hidden="true">
                  <circle
                    v-if="PRIORITY_STYLE[order.priority]?.shape === 'dot'"
                    cx="6"
                    cy="6"
                    r="4"
                    fill="currentColor"
                  />
                  <circle
                    v-else-if="PRIORITY_STYLE[order.priority]?.shape === 'ring'"
                    cx="6"
                    cy="6"
                    r="3.6"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  />
                  <rect v-else x="1.8" y="4.6" width="8.4" height="2.8" rx="1.4" fill="currentColor" />
                </svg>
                {{ priorityLabel(order.priority) }}
              </dd>
            </div>
          </dl>

          <div class="mt-5">
            <h3 class="text-[13px] font-semibold text-ink-700">{{ t('wo.description') }}</h3>
            <p class="mt-1.5 text-[14px] leading-relaxed text-ink-600">{{ order.description }}</p>
          </div>

          <div class="mt-5">
            <h3 class="text-[13px] font-semibold text-ink-700">{{ t('wo.beforeAfter') }}</h3>
            <div class="mt-2.5 grid gap-4 sm:grid-cols-2">
              <div class="relative overflow-hidden rounded-field ring-1 ring-ink-200">
                <svg viewBox="0 0 400 240" class="block h-44 w-full" aria-hidden="true">
                  <rect width="400" height="240" fill="#eef2f8" />
                  <path d="M0 0h400L262 82H138z" fill="#e2e8f2" />
                  <path d="M0 240l138-70h124l138 70z" fill="#cbd4e3" />
                  <path d="M0 0v240l138-70V82z" fill="#e8edf5" />
                  <path d="M400 0v240l-138-70V82z" fill="#e8edf5" />
                  <rect x="138" y="82" width="124" height="88" fill="#dfe6f0" />
                  <rect x="150" y="14" width="46" height="6" rx="3" fill="#cbd4e3" />
                  <rect x="212" y="14" width="46" height="6" rx="3" fill="#cbd4e3" />
                  <rect x="164" y="104" width="72" height="46" rx="4" fill="#cbd4e3" />
                </svg>
                <span
                  class="absolute left-3 top-3 rounded-pill bg-ink-900/70 px-2.5 py-1 text-[12px] font-semibold text-white"
                >
                  {{ t('wo.before') }}
                </span>
              </div>

              <div class="relative overflow-hidden rounded-field ring-1 ring-ink-200">
                <svg viewBox="0 0 400 240" class="block h-44 w-full" aria-hidden="true">
                  <rect width="400" height="240" fill="#f4f8ff" />
                  <path d="M0 0h400L262 82H138z" fill="#e0eaff" />
                  <path d="M0 240l138-70h124l138 70z" fill="#c7d9fe" />
                  <path d="M0 0v240l138-70V82z" fill="#eef4ff" />
                  <path d="M400 0v240l-138-70V82z" fill="#eef4ff" />
                  <rect x="138" y="82" width="124" height="88" fill="#e6eeff" />
                  <rect x="150" y="12" width="46" height="9" rx="4.5" fill="#739afa" />
                  <rect x="212" y="12" width="46" height="9" rx="4.5" fill="#739afa" />
                  <rect x="118" y="40" width="60" height="7" rx="3.5" fill="#a1bffd" />
                  <rect x="222" y="40" width="60" height="7" rx="3.5" fill="#a1bffd" />
                  <rect x="164" y="104" width="72" height="46" rx="4" fill="#a1bffd" />
                </svg>
                <span
                  class="absolute left-3 top-3 rounded-pill bg-ok-600/90 px-2.5 py-1 text-[12px] font-semibold text-white"
                >
                  {{ t('wo.after') }}
                </span>
              </div>
            </div>
          </div>

          <div class="mt-5 border-t border-ink-100 pt-5">
            <h3 class="text-[13px] font-semibold text-ink-700">{{ t('common.mainInfo') }}</h3>
            <dl class="mt-3 grid gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
              <div class="min-w-0">
                <dt class="text-[12px] text-ink-500">{{ t('wo.contractorOrStaff') }}</dt>
                <dd class="mt-0.5 truncate text-[14px] font-semibold text-ink-900">
                  {{ order.assignee ?? t('wo.unassigned') }}
                </dd>
              </div>
              <div class="min-w-0">
                <dt class="text-[12px] text-ink-500">{{ field('startDate') }}</dt>
                <dd class="tabular mt-0.5 text-[14px] font-semibold text-ink-900">
                  {{ dateShort(order.createdAt.slice(0, 10)) }} {{ order.createdAt.slice(11) }}
                </dd>
              </div>
              <div class="min-w-0">
                <dt class="text-[12px] text-ink-500">{{ t('wo.plannedEnd') }}</dt>
                <dd class="tabular mt-0.5 text-[14px] font-semibold text-ink-900">
                  {{ dateShort(order.dueAt) }}
                </dd>
              </div>
              <div class="min-w-0">
                <dt class="text-[12px] text-ink-500">{{ t('wo.currentStatus') }}</dt>
                <dd class="mt-0.5 truncate text-[14px] font-semibold text-ink-900">
                  {{ statusLabel('service', order.status) }}
                </dd>
              </div>
            </dl>

            <div class="mt-4">
              <div class="flex items-baseline justify-between">
                <span class="text-[12px] text-ink-500">{{ t('wo.completion') }}</span>
                <span class="tabular text-[13px] font-bold text-ink-900">{{ order.progress }}%</span>
              </div>
              <div class="mt-1.5 h-2 overflow-hidden rounded-pill bg-ink-100">
                <div
                  class="h-full rounded-pill transition-all duration-300"
                  :class="order.progress === 100 ? 'bg-ok-500' : 'bg-brand-500'"
                  :style="{ width: `${Math.max(order.progress, 2)}%` }"
                />
              </div>
            </div>
          </div>

          <div v-if="orderNotes.length" class="mt-5 border-t border-ink-100 pt-5">
            <h3 class="text-[13px] font-semibold text-ink-700">{{ t('common.notes') }}</h3>
            <ul class="mt-2.5 space-y-2">
              <li
                v-for="(n, i) in orderNotes"
                :key="i"
                class="flex items-start gap-2.5 rounded-field bg-surface-sunken px-3.5 py-2.5 text-[13px] text-ink-700"
              >
                <UiIcon name="doc" :size="16" class="mt-0.5 shrink-0 text-ink-400" />
                <span class="min-w-0 flex-1">{{ n }}</span>
              </li>
            </ul>
          </div>
        </UiCard>

        <p
          v-if="!canExecute"
          class="rounded-card bg-surface-sunken px-5 py-4 text-[13px] leading-relaxed text-ink-600 ring-1 ring-inset ring-ink-200"
        >
          {{ t('wo.watchOnlyNotice') }}
        </p>

        <div v-else class="grid gap-4 lg:grid-cols-2">
          <button
            type="button"
            class="flex items-center gap-4 rounded-card border-2 border-dashed border-brand-200 bg-brand-50/40 px-5 py-4 text-left transition-colors hover:border-brand-400 hover:bg-brand-50"
            @click="uploadOpen = true"
          >
            <span class="grid size-11 shrink-0 place-items-center rounded-[10px] bg-white text-brand-600 shadow-card">
              <UiIcon name="upload" :size="20" />
            </span>
            <span class="min-w-0">
              <span class="block text-[14px] font-bold text-ink-900">{{ t('wo.uploadWork') }}</span>
              <span class="block text-[13px] text-ink-500">{{ t('wo.uploadWorkHint') }}</span>
            </span>
          </button>

          <div class="flex flex-wrap items-center gap-3">
            <UiButton class="flex-1" @click="evidenceOpen = true">
              <UiIcon name="plus" :size="17" />
              {{ t('wo.addEvidence') }}
            </UiButton>
            <UiButton variant="secondary" class="flex-1" @click="noteOpen = true">
              <UiIcon name="doc" :size="17" />
              {{ t('wo.addNote') }}
            </UiButton>
          </div>
        </div>
      </div>

      <div class="space-y-5">
        <UiCard :title="t('wo.evidenceTitle')">
          <template #actions>
            <span class="tabular text-[13px] font-bold text-ink-700">
              {{ t('wo.evidenceCount', { n: evidenceCount }) }}
            </span>
          </template>

          <div v-if="evidenceCount > 0" class="grid grid-cols-4 gap-2">
            <div
              v-for="n in Math.min(evidenceCount, 4)"
              :key="n"
              class="relative overflow-hidden rounded-[10px] ring-1 ring-ink-200"
            >
              <svg viewBox="0 0 64 64" class="block size-full" aria-hidden="true">
                <rect width="64" height="64" fill="#eef2f8" />
                <circle cx="20" cy="19" r="6" fill="#c7d9fe" />
                <path d="M4 52 24 30l13 15 8-9 15 16z" fill="#a1bffd" />
                <path d="M0 52h64v12H0z" fill="#e2e8f2" />
              </svg>
              <span
                v-if="n === 4 && evidenceCount > 4"
                class="absolute inset-0 grid place-items-center bg-ink-900/55 text-[13px] font-bold text-white"
              >
                +{{ evidenceCount - 3 }}
              </span>
            </div>
          </div>
          <p v-else class="text-[13px] text-ink-500">{{ t('wo.evidenceEmpty') }}</p>

          <UiButton
            v-if="canExecute"
            variant="ghost"
            size="sm"
            block
            class="mt-3"
            @click="evidenceOpen = true"
          >
            <UiIcon name="plus" :size="16" />
            {{ t('wo.addEvidence') }}
          </UiButton>
        </UiCard>

        <UiCard :title="t('wo.materialsUsed')">
          <template #actions>
            <span class="tabular text-[13px] font-bold text-ink-700">
              {{ t('common.countPcs', { n: materials.length }) }}
            </span>
          </template>

          <ul v-if="materials.length" class="space-y-2.5">
            <li v-for="m in materials" :key="m.code" class="flex items-center gap-3">
              <span class="grid size-9 shrink-0 place-items-center rounded-[10px] bg-ink-100 text-ink-600">
                <UiIcon name="cube" :size="17" />
              </span>
              <span class="min-w-0 flex-1 truncate text-[14px] font-medium text-ink-800">
                {{ m.name }}
              </span>
              <span class="tabular shrink-0 text-[13px] font-semibold text-ink-700">
                {{ m.qty }} {{ m.unit }}
              </span>
            </li>
          </ul>

          <p v-else class="text-[13px] text-ink-500">
            {{ t('wo.materialsEmpty') }}
          </p>

          <UiButton variant="ghost" size="sm" block class="mt-3" to="/facility/materials">
            {{ t('nav.materials') }}
            <UiIcon name="chevronRight" :size="15" />
          </UiButton>
        </UiCard>

        <UiCard :title="t('wo.checklistTitle')">
          <template #actions>
            <span class="tabular text-[13px] font-bold text-ink-700">
              {{ doneCount }} / {{ checklist.length }}
            </span>
          </template>

          <ul class="space-y-1">
            <li v-for="(c, i) in checklist" :key="c.label">
              <button
                type="button"
                class="flex w-full items-center gap-3 rounded-field px-2 py-2 text-left transition-colors"
                :class="canExecute ? 'hover:bg-brand-50/60' : 'cursor-default'"
                :aria-pressed="orderChecks[i] === true"
                :disabled="!canExecute"
                @click="toggleCheck(i)"
              >
                <span
                  class="grid size-5 shrink-0 place-items-center rounded-full ring-1 transition-colors"
                  :class="orderChecks[i] ? 'bg-ok-500 text-white ring-ok-500' : 'bg-white text-transparent ring-ink-300'"
                >
                  <svg class="size-3" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <path
                      d="M2.6 6.3 5 8.7l4.4-5"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </span>
                <span
                  class="min-w-0 flex-1 text-[13px]"
                  :class="orderChecks[i] ? 'text-ink-500 line-through' : 'font-medium text-ink-800'"
                >
                  {{ c.label }}
                </span>
                <span
                  class="shrink-0 text-[12px] font-semibold"
                  :class="orderChecks[i] ? 'text-ok-600' : 'text-ink-400'"
                >
                  {{ orderChecks[i] ? t('common.done') : t('common.pending') }}
                </span>
              </button>
            </li>
          </ul>
        </UiCard>

        <UiCard :title="t('wo.costAndAct')">
          <template #actions>
            <span
              class="inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-[12px] font-semibold ring-1 ring-inset"
              :class="
                actReady
                  ? 'bg-ok-50 text-ok-700 ring-ok-100'
                  : 'bg-warn-50 text-warn-700 ring-warn-100'
              "
            >
              <svg class="size-3 shrink-0" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path
                  v-if="actReady"
                  d="M2.6 6.3 5 8.7l4.4-5"
                  stroke="currentColor"
                  stroke-width="1.9"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <g v-else stroke="currentColor" stroke-width="1.6" fill="none">
                  <circle cx="6" cy="6" r="4.2" />
                  <path d="M6 3.6V6l1.9 1.2" stroke-linecap="round" />
                </g>
              </svg>
              {{ actReady ? t('wo.actReady') : t('wo.actPending') }}
            </span>
          </template>

          <dl class="space-y-3">
            <div class="flex items-baseline justify-between gap-3">
              <dt class="text-[13px] text-ink-500">{{ t('wo.estimate') }}</dt>
              <dd class="tabular text-[14px] font-bold text-ink-900">{{ money(estimate) }}</dd>
            </div>
            <div class="flex items-baseline justify-between gap-3">
              <dt class="text-[13px] text-ink-500">{{ t('wo.actualCost') }}</dt>
              <dd
                v-if="issuedRequest"
                class="tabular text-[14px] font-bold"
                :class="actual > estimate ? 'text-danger-600' : 'text-ok-600'"
              >
                {{ money(actual) }}
              </dd>
              <dd v-else class="text-[13px] text-ink-500">{{ t('wo.notIssued') }}</dd>
            </div>
            <div class="flex items-baseline justify-between gap-3">
              <dt class="text-[13px] text-ink-500">{{ t('wo.completedAt') }}</dt>
              <dd class="tabular text-[14px] font-bold text-ink-900">
                {{ actReady ? dateShort(actDate(order)) : '-' }}
              </dd>
            </div>
          </dl>

          <UiButton
            variant="secondary"
            block
            class="mt-4"
            :disabled="!actReady"
            @click="actOpen = true"
          >
            <UiIcon name="doc" :size="17" />
            {{ t('wo.viewAct') }}
          </UiButton>

          <p v-if="!actReady" class="mt-2 text-[12px] text-ink-500">
            {{ t('wo.actHint') }}
          </p>
        </UiCard>
      </div>
    </section>

    <UiCard v-else>
      <div class="py-10 text-center">
        <p class="text-[16px] font-semibold text-ink-900">{{ t('wo.notFoundTitle') }}</p>
        <p class="mt-1.5 text-[13px] text-ink-500">
          {{ t('wo.notFoundHint') }}
        </p>
        <UiButton class="mt-5" to="/facility/work-orders">
          <UiIcon name="chevronLeft" :size="17" />
          {{ t('wo.backToMyWork') }}
        </UiButton>
      </div>
    </UiCard>
  </main>

  <UiModal
    v-model="uploadOpen"
    :title="t('wo.uploadWork')"
    :subtitle="t('wo.uploadSubtitle')"
  >
    <div class="space-y-4">
      <input
        ref="uploadInput"
        type="file"
        accept="image/*,video/*,.pdf,.docx"
        multiple
        class="sr-only"
        :aria-label="t('wo.uploadFilesAria')"
        @change="onUploadFiles"
      />

      <button
        type="button"
        class="grid w-full place-items-center gap-2 rounded-field border-2 border-dashed border-ink-300 bg-ink-50 px-6 py-9 text-ink-500 transition-colors hover:border-brand-400 hover:bg-brand-50 hover:text-brand-600"
        @click="pickUploadFiles"
      >
        <svg viewBox="0 0 48 48" class="size-11" fill="none" aria-hidden="true">
          <path
            d="M14 32a8 8 0 0 1-.6-16 11 11 0 0 1 21 3 7 7 0 0 1-.4 13H30"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <path
            d="M24 40V24m0 0-5.5 5.5M24 24l5.5 5.5"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <span class="text-[14px] font-semibold">{{ t('common.clickToAttach') }}</span>
        <span class="text-[12px]">{{ t('common.attachedCount', { n: uploadFiles.length }) }}</span>
      </button>

      <ul v-if="uploadFiles.length" class="space-y-1.5">
        <li
          v-for="(x, i) in uploadFiles"
          :key="`${x.name}-${i}`"
          class="flex items-center gap-2.5 rounded-field px-3 py-2 ring-1 ring-ink-200"
        >
          <UiIcon name="doc" :size="16" class="shrink-0 text-brand-600" />
          <span class="min-w-0 flex-1 truncate text-[13px] text-ink-700">
            {{ x.name }}
            <span class="tabular text-ink-500">· {{ fileSize(x.size) }}</span>
          </span>
          <button
            type="button"
            class="grid size-11 shrink-0 place-items-center rounded-lg text-ink-400 transition-colors hover:bg-danger-50 hover:text-danger-600 md:size-9"
            :aria-label="t('common.removeFileAria', { name: x.name })"
            @click="removeUploadFile(i)"
          >
            <UiIcon name="x" :size="14" />
          </button>
        </li>
      </ul>

      <UiField :label="t('common.note')" :hint="t('wo.uploadNoteHint')">
        <textarea
          v-model="uploadNote"
          rows="3"
          :placeholder="t('wo.uploadNotePlaceholder')"
          class="scroll-slim w-full rounded-field bg-white px-3.5 py-2.5 text-sm text-ink-800 ring-1 ring-inset ring-ink-200 transition-colors placeholder:text-ink-400 hover:ring-ink-300 focus:ring-2 focus:ring-brand-500"
        />
      </UiField>
    </div>

    <template #footer>
      <UiButton variant="ghost" @click="uploadOpen = false">{{ t('common.cancel') }}</UiButton>
      <UiButton variant="success" :disabled="uploadFiles.length === 0" @click="saveUpload">
        <UiIcon name="check" :size="16" />
        {{ t('wo.uploadAndSave') }}
      </UiButton>
    </template>
  </UiModal>

  <UiModal
    v-model="evidenceOpen"
    :title="t('wo.addEvidence')"
    :subtitle="t('wo.evidenceSubtitle')"
    size="sm"
  >
    <div class="flex flex-wrap gap-3">
      <div
        v-for="(e, i) in evidenceFiles"
        :key="`${e.file.name}-${i}`"
        class="relative size-24 overflow-hidden rounded-field ring-1 ring-ink-200"
      >
        <img :src="e.url" :alt="e.file.name" class="size-full object-cover" />
        <button
          type="button"
          class="absolute right-1 top-1 grid size-8 place-items-center rounded-full bg-ink-900/60 text-white transition-colors hover:bg-danger-600 md:size-6"
          :aria-label="t('wo.removeEvidenceAria', { name: e.file.name })"
          @click="removeEvidence(i)"
        >
          <UiIcon name="x" :size="13" />
        </button>
      </div>

      <input
        ref="evidenceInput"
        type="file"
        accept="image/*"
        multiple
        class="sr-only"
        :aria-label="t('wo.evidencePhotos')"
        @change="onEvidenceFiles"
      />

      <button
        type="button"
        class="grid size-24 place-items-center rounded-field border-2 border-dashed border-ink-300 bg-ink-50 text-ink-500 transition-colors hover:border-brand-400 hover:bg-brand-50 hover:text-brand-600"
        :aria-label="t('wo.addEvidencePhoto')"
        @click="pickEvidence"
      >
        <UiIcon name="plus" :size="24" />
      </button>
    </div>

    <template #footer>
      <UiButton variant="ghost" @click="((evidenceOpen = false), clearEvidence())">
        {{ t('common.cancel') }}
      </UiButton>
      <UiButton :disabled="evidenceFiles.length === 0" @click="saveEvidence">
        <UiIcon name="check" :size="16" />
        {{ t('common.attach') }}
      </UiButton>
    </template>
  </UiModal>

  <UiModal
    v-model="noteOpen"
    :title="t('wo.addNote')"
    :subtitle="t('wo.noteSubtitle')"
    size="sm"
  >
    <UiField :label="t('wo.noteText')" required :error="noteError">
      <textarea
        v-model="noteText"
        rows="4"
        :placeholder="t('wo.notePlaceholder')"
        class="scroll-slim w-full rounded-field bg-white px-3.5 py-2.5 text-sm text-ink-800 ring-1 ring-inset ring-ink-200 transition-colors placeholder:text-ink-400 hover:ring-ink-300 focus:ring-2 focus:ring-brand-500"
      />
    </UiField>

    <template #footer>
      <UiButton variant="ghost" @click="noteOpen = false">{{ t('common.cancel') }}</UiButton>
      <UiButton @click="saveNote">
        <UiIcon name="check" :size="16" />
        {{ t('common.save') }}
      </UiButton>
    </template>
  </UiModal>

  <UiModal
    v-model="actOpen"
    :title="t('wo.actTitleWithCode', { code: order?.code ?? '' })"
    :subtitle="t('wo.actPreview')"
    size="lg"
  >
    <div v-if="order && actReady" class="rounded-field bg-white p-6 ring-1 ring-ink-200">
      <div class="flex items-start justify-between gap-4 border-b border-ink-200 pb-4">
        <div>
          <p class="text-[18px] font-bold text-ink-900">{{ t('wo.actTitle') }}</p>
          <p class="tabular mt-1 text-[13px] text-ink-500">
            {{ order.code }} · {{ dateShort(actDate(order)) }}
          </p>
        </div>
        <AppLogo size="sm" />
      </div>

      <dl class="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
        <div class="flex justify-between gap-3 border-b border-ink-100 pb-2">
          <dt class="text-[13px] text-ink-500">{{ field('object') }}</dt>
          <dd class="text-[13px] font-semibold text-ink-900">{{ order.buildingName }}</dd>
        </div>
        <div class="flex justify-between gap-3 border-b border-ink-100 pb-2">
          <dt class="text-[13px] text-ink-500">{{ field('location') }}</dt>
          <dd class="text-[13px] font-semibold text-ink-900">{{ order.unitCode }}</dd>
        </div>
        <div class="flex justify-between gap-3 border-b border-ink-100 pb-2">
          <dt class="text-[13px] text-ink-500">{{ field('executor') }}</dt>
          <dd class="text-[13px] font-semibold text-ink-900">
            {{ order.assignee ?? t('wo.unassigned') }}
          </dd>
        </div>
        <div class="flex justify-between gap-3 border-b border-ink-100 pb-2">
          <dt class="text-[13px] text-ink-500">{{ t('wo.orderedBy') }}</dt>
          <dd class="text-[13px] font-semibold text-ink-900">{{ order.requester }}</dd>
        </div>
      </dl>

      <table class="mt-5 w-full border-collapse text-sm">
        <thead>
          <tr class="border-b border-ink-200 bg-surface-sunken">
            <th class="px-3 py-2 text-left text-[12px] font-semibold uppercase tracking-wide text-ink-500">
              {{ field('name') }}
            </th>
            <th class="px-3 py-2 text-right text-[12px] font-semibold uppercase tracking-wide text-ink-500">
              {{ field('quantity') }}
            </th>
            <th class="px-3 py-2 text-right text-[12px] font-semibold uppercase tracking-wide text-ink-500">
              {{ field('amount') }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="m in materials" :key="m.code" class="border-b border-ink-100">
            <td class="px-3 py-2.5 text-ink-700">{{ m.name }}</td>
            <td class="tabular px-3 py-2.5 text-right text-ink-700">{{ m.qty }} {{ m.unit }}</td>
            <td class="tabular px-3 py-2.5 text-right font-semibold text-ink-900">
              {{ money(m.qty * m.price) }}
            </td>
          </tr>
          <tr class="border-b border-ink-100">
            <td class="px-3 py-2.5 text-ink-600" colspan="2">{{ t('wo.estimate') }}</td>
            <td class="tabular px-3 py-2.5 text-right text-ink-700">{{ money(estimate) }}</td>
          </tr>
          <tr class="bg-surface-sunken">
            <td class="px-3 py-2.5 font-semibold text-ink-800" colspan="2">
              {{ t('wo.actualCostIssued') }}
            </td>
            <td class="tabular px-3 py-2.5 text-right font-bold text-ink-900">
              {{ issuedRequest ? money(actual) : t('wo.notIssuedShort') }}
            </td>
          </tr>
        </tbody>
      </table>

      <div class="mt-6 grid gap-6 sm:grid-cols-2">
        <div>
          <p class="text-[12px] text-ink-500">{{ t('wo.handedOver') }}</p>
          <p class="mt-6 border-t border-ink-300 pt-1.5 text-[13px] text-ink-600">
            {{ order.assignee ?? '-' }}
          </p>
        </div>
        <div>
          <p class="text-[12px] text-ink-500">{{ t('wo.acceptedBy') }}</p>
          <p class="mt-6 border-t border-ink-300 pt-1.5 text-[13px] text-ink-600">
            {{ order.requester }}
          </p>
        </div>
      </div>
    </div>

    <template #footer>
      <UiButton variant="ghost" @click="actOpen = false">{{ t('common.close') }}</UiButton>
      <UiButton variant="secondary" :disabled="!actReady" @click="downloadAct">
        <UiIcon name="download" :size="16" />
        {{ t('common.download') }}
      </UiButton>
      <UiButton :disabled="!actReady" @click="printAct">
        <UiIcon name="print" :size="16" />
        {{ t('common.print') }}
      </UiButton>
    </template>
  </UiModal>
</template>

<style>
/**
 * Chop etishda faqat ochiq hujjat qog‘ozga tushadi: yon menyu, topbar va
 * orqadagi kartalar bosilmaydi. Qoida global, chunki oyna `body` ga
 * ko‘chiriladi va sahifa qatlamidan tashqarida turadi.
 */
@media print {
  body * {
    visibility: hidden;
  }

  [role='dialog'],
  [role='dialog'] * {
    visibility: visible;
  }

  [role='dialog'] {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    max-height: none;
    overflow: visible;
    background: #fff;
    box-shadow: none;
  }

  [role='dialog'] > div {
    overflow: visible !important;
  }

  [role='dialog'] > header,
  [role='dialog'] > footer {
    display: none !important;
  }
}
</style>
