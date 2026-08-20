<script setup lang="ts">
import { CONTACT } from '~/constants/contacts'
import { ROLE_META } from '~/constants/roles'
import { docxBlob, fileSize, saveBlob, type DocxLine } from '~/utils/docx'
import { dateShort } from '~/utils/format'
import type { Role } from '~/types/rbac'

const auth = useAuthStore()
const { t, moduleTitle, roleLabel, priorityLabel } = useAppLabels()

/**
 * Rol nomlari rollar registridan olinadi: yordam markazidagi yozuv bilan
 * yon paneldagi nom hech qachon ayrilib qolmaydi.
 */
const ROLE = {
  head: ROLE_META.SUPER_HEAD.label,
  manager: ROLE_META.BUILDING_MANAGER.label,
  accountant: ROLE_META.ACCOUNTANT.label,
  facility: ROLE_META.FACILITY.label,
  warehouse: ROLE_META.WAREHOUSE_OPERATOR.label,
  content: ROLE_META.CONTENT_OPERATOR.label,
  tenant: ROLE_META.TENANT_OWNER.label,
  general: 'Umumiy',
}

/**
 * Saralash qiymati registrdagi yozuvga bog‘liq bo‘lib qoladi, ko‘rinadigan
 * nom esa tarjima lug‘atidan olinadi: til almashganda saralash buzilmaydi.
 */
const ROLE_CODE = new Map<string, Role>([
  [ROLE.head, 'SUPER_HEAD'],
  [ROLE.manager, 'BUILDING_MANAGER'],
  [ROLE.accountant, 'ACCOUNTANT'],
  [ROLE.facility, 'FACILITY'],
  [ROLE.warehouse, 'WAREHOUSE_OPERATOR'],
  [ROLE.content, 'CONTENT_OPERATOR'],
  [ROLE.tenant, 'TENANT_OWNER'],
])

function roleName(value: string) {
  const code = ROLE_CODE.get(value)
  return code ? roleLabel(code) : t('hlp.roleGeneral')
}

const roleCards = [
  {
    value: ROLE.tenant,
    captionKey: 'hlp.capTenant',
    icon: 'user',
    tone: 'bg-brand-50 text-brand-600',
  },
  {
    value: ROLE.accountant,
    captionKey: 'hlp.capAccountant',
    icon: 'wallet',
    tone: 'bg-ok-50 text-ok-600',
  },
  {
    value: ROLE.manager,
    captionKey: 'hlp.capManager',
    icon: 'building',
    tone: 'bg-info-50 text-info-600',
  },
  {
    value: ROLE.facility,
    captionKey: 'hlp.capFacility',
    icon: 'wrench',
    tone: 'bg-warn-50 text-warn-600',
  },
  {
    value: ROLE.head,
    captionKey: 'hlp.capHead',
    icon: 'chart',
    tone: 'bg-brand-50 text-brand-600',
  },
  {
    value: ROLE.warehouse,
    captionKey: 'hlp.capWarehouse',
    icon: 'box',
    tone: 'bg-lime-50 text-lime-700',
  },
  {
    value: ROLE.content,
    captionKey: 'hlp.capContent',
    icon: 'layers',
    tone: 'bg-rose-50 text-rose-700',
  },
]

const FAQ_SOURCE = [
  { id: 'f-01', role: ROLE.tenant, q: 'hlp.faq01q', a: 'hlp.faq01a' },
  { id: 'f-02', role: ROLE.tenant, q: 'hlp.faq02q', a: 'hlp.faq02a' },
  { id: 'f-03', role: ROLE.tenant, q: 'hlp.faq03q', a: 'hlp.faq03a' },
  { id: 'f-04', role: ROLE.manager, q: 'hlp.faq04q', a: 'hlp.faq04a' },
  { id: 'f-05', role: ROLE.manager, q: 'hlp.faq05q', a: 'hlp.faq05a' },
  { id: 'f-06', role: ROLE.accountant, q: 'hlp.faq06q', a: 'hlp.faq06a' },
  { id: 'f-07', role: ROLE.accountant, q: 'hlp.faq07q', a: 'hlp.faq07a' },
  { id: 'f-08', role: ROLE.facility, q: 'hlp.faq08q', a: 'hlp.faq08a' },
  { id: 'f-09', role: ROLE.facility, q: 'hlp.faq09q', a: 'hlp.faq09a' },
  { id: 'f-10', role: ROLE.head, q: 'hlp.faq10q', a: 'hlp.faq10a' },
  { id: 'f-11', role: ROLE.head, q: 'hlp.faq11q', a: 'hlp.faq11a' },
  { id: 'f-12', role: ROLE.warehouse, q: 'hlp.faq12q', a: 'hlp.faq12a' },
  { id: 'f-13', role: ROLE.warehouse, q: 'hlp.faq13q', a: 'hlp.faq13a' },
  { id: 'f-14', role: ROLE.content, q: 'hlp.faq14q', a: 'hlp.faq14a' },
  { id: 'f-15', role: ROLE.content, q: 'hlp.faq15q', a: 'hlp.faq15a' },
]

/** Qidiruv ko‘rinadigan matn bo‘yicha ishlashi uchun savollar tarjima bilan yig‘iladi */
const FAQ = computed(() =>
  FAQ_SOURCE.map((f) => ({
    id: f.id,
    role: f.role,
    question: t(f.q),
    answer: t(f.a),
  })),
)

const MANUALS = [
  { id: 'm-01', role: ROLE.tenant, nameKey: 'hlp.manualTenant', at: '2026-07-21' },
  { id: 'm-02', role: ROLE.accountant, nameKey: 'hlp.manualAccountant', at: '2026-07-21' },
  { id: 'm-03', role: ROLE.manager, nameKey: 'hlp.manualManager', at: '2026-07-21' },
  { id: 'm-04', role: ROLE.facility, nameKey: 'hlp.manualFacility', at: '2026-07-21' },
  { id: 'm-06', role: ROLE.head, nameKey: 'hlp.manualHead', at: '2026-07-21' },
  { id: 'm-07', role: ROLE.warehouse, nameKey: 'hlp.manualWarehouse', at: '2026-07-21' },
  { id: 'm-08', role: ROLE.content, nameKey: 'hlp.manualContent', at: '2026-07-21' },
  { id: 'm-05', role: ROLE.general, nameKey: 'hlp.manualGeneral', at: '2026-08-06' },
]

/** Qo‘llanma nomi hujjat sarlavhasida ham, fayl nomida ham shu yerdan olinadi */
function manualName(m: (typeof MANUALS)[number]) {
  return t(m.nameKey)
}

const roleFilter = ref('all')
const query = ref('')
const openFaq = ref('')
const searchNote = ref('')

const filteredFaq = computed(() =>
  FAQ.value.filter((f) => {
    const byRole = roleFilter.value === 'all' || f.role === roleFilter.value
    const q = query.value.trim().toLowerCase()
    const byQuery =
      !q || f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q)
    return byRole && byQuery
  }),
)

const filteredManuals = computed(() =>
  MANUALS.filter(
    (m) => roleFilter.value === 'all' || m.role === roleFilter.value || m.role === ROLE.general,
  ),
)

function toggleRole(value: string) {
  roleFilter.value = roleFilter.value === value ? 'all' : value
  openFaq.value = ''
  searchNote.value = ''
}

function toggleFaq(id: string) {
  openFaq.value = openFaq.value === id ? '' : id
}

function runSearch() {
  const first = filteredFaq.value[0]
  if (first) {
    openFaq.value = first.id
    searchNote.value = t('hlp.searchFound', { n: filteredFaq.value.length })
  } else {
    openFaq.value = ''
    searchNote.value = t('hlp.searchNone')
  }
}

const generalManual = MANUALS.find((m) => m.role === ROLE.general)!

const manualOpen = ref(false)
const savedManual = ref('')
const selectedManual = ref<(typeof MANUALS)[number] | null>(null)

function openManual(m: (typeof MANUALS)[number]) {
  selectedManual.value = m
  savedManual.value = ''
  manualOpen.value = true
}

/** Qo‘llanma matni savol-javob bazasidan yig‘iladi */
function manualLines(m: (typeof MANUALS)[number]): DocxLine[] {
  const topics =
    m.role === ROLE.general ? FAQ.value : FAQ.value.filter((q) => q.role === m.role)
  const lines: DocxLine[] = [
    { text: 'Makon Property Group', style: 'subtitle' },
    { text: manualName(m), style: 'title' },
    { text: t('hlp.docPublished', { date: dateShort(m.at) }), style: 'subtitle' },
    { text: t('hlp.docAbout'), style: 'heading' },
    {
      text:
        m.role === ROLE.general
          ? t('hlp.docAboutGeneral')
          : t('hlp.docAboutRole', { role: roleName(m.role) }),
    },
  ]

  let index = 0
  for (const topic of topics) {
    index += 1
    lines.push({ text: `${index}. ${topic.question}`, style: 'heading' })
    if (m.role === ROLE.general)
      lines.push({ text: t('hlp.docRoleLine', { role: roleName(topic.role) }), style: 'small' })
    lines.push({ text: topic.answer })
  }

  lines.push(
    { text: t('hlp.docSupport'), style: 'heading' },
    { text: t('hlp.docPhone', { value: CONTACT.phone }) },
    { text: t('hlp.docEmail', { value: CONTACT.email }) },
    { text: t('hlp.workHours', { value: CONTACT.hours }), style: 'small' },
  )

  return lines
}

/** Brauzer saqlaydigan nusxa: nomi va haqiqiy hajmi */
const manualOutput = computed(() => {
  const m = selectedManual.value
  if (!m) return null
  const blob = docxBlob(manualLines(m))
  return { name: `${manualName(m)}.docx`, size: fileSize(blob.size) }
})

function downloadManual() {
  const m = selectedManual.value
  if (!m) return
  const fileName = `${manualName(m)}.docx`
  saveBlob(docxBlob(manualLines(m)), fileName)
  savedManual.value = fileName
}

type Ticket = {
  id: string
  code: string
  /** Namunaviy yozuvlar lug‘atdan, foydalanuvchi yozgani esa matn sifatida saqlanadi */
  subjectKey?: string
  subject: string
  category: string
  priority: 'Past' | 'O‘rtacha' | 'Yuqori'
  status: string
  createdAt: string
  descriptionKey?: string
  description: string
}

const tickets = ref<Ticket[]>([
  {
    id: 't-078',
    code: 'TK-2025-078',
    subjectKey: 'hlp.t078Subject',
    subject: '',
    category: 'To‘lovlar',
    priority: 'O‘rtacha',
    status: 'IN_PROGRESS',
    createdAt: '2025-05-18 10:24',
    descriptionKey: 'hlp.t078Text',
    description: '',
  },
  {
    id: 't-077',
    code: 'TK-2025-077',
    subjectKey: 'hlp.t077Subject',
    subject: '',
    category: 'Hisobotlar',
    priority: 'Yuqori',
    status: 'NEW',
    createdAt: '2025-05-18 09:41',
    descriptionKey: 'hlp.t077Text',
    description: '',
  },
  {
    id: 't-076',
    code: 'TK-2025-076',
    subjectKey: 'hlp.t076Subject',
    subject: '',
    category: 'Shartnomalar',
    priority: 'O‘rtacha',
    status: 'IN_PROGRESS',
    createdAt: '2025-05-17 16:08',
    descriptionKey: 'hlp.t076Text',
    description: '',
  },
  {
    id: 't-075',
    code: 'TK-2025-075',
    subjectKey: 'hlp.t075Subject',
    subject: '',
    category: 'Xizmatlar',
    priority: 'Past',
    status: 'TRIAGE',
    createdAt: '2025-05-16 11:02',
    descriptionKey: 'hlp.t075Text',
    description: '',
  },
  {
    id: 't-074',
    code: 'TK-2025-074',
    subjectKey: 'hlp.t074Subject',
    subject: '',
    category: 'Foydalanuvchilar',
    priority: 'O‘rtacha',
    status: 'CLOSED',
    createdAt: '2025-05-15 14:33',
    descriptionKey: 'hlp.t074Text',
    description: '',
  },
  {
    id: 't-073',
    code: 'TK-2025-073',
    subjectKey: 'hlp.t073Subject',
    subject: '',
    category: 'Hisoblagichlar',
    priority: 'Yuqori',
    status: 'CLOSED',
    createdAt: '2025-05-14 09:15',
    descriptionKey: 'hlp.t073Text',
    description: '',
  },
  {
    id: 't-072',
    code: 'TK-2025-072',
    subjectKey: 'hlp.t072Subject',
    subject: '',
    category: 'Tizim',
    priority: 'Past',
    status: 'CLOSED',
    createdAt: '2025-05-13 17:50',
    descriptionKey: 'hlp.t072Text',
    description: '',
  },
])

/**
 * Murojaat kategoriyasi ma’lumotda o‘zbekcha qiymat sifatida saqlanadi, shuning
 * uchun filtr va tanlov ishlashda qoladi, tarjima faqat ko‘rinadigan nomga tegadi.
 */
const CATEGORY_KEYS: Record<string, string> = {
  'To‘lovlar': 'navShort.payments',
  Hisobotlar: 'nav.reports',
  Shartnomalar: 'nav.contracts',
  Xizmatlar: 'hlp.catServices',
  Hisoblagichlar: 'nav.meters',
  Foydalanuvchilar: 'nav.settingsUsers',
  Tizim: 'hlp.catSystem',
}

function categoryLabel(value: string) {
  const key = CATEGORY_KEYS[value]
  return key ? t(key) : value
}

function ticketSubject(row: Ticket) {
  return row.subjectKey ? t(row.subjectKey) : row.subject
}

function ticketText(row: Ticket) {
  return row.descriptionKey ? t(row.descriptionKey) : row.description
}

const ticketStatus = ref('all')

const ticketTabs = computed(() => [
  { value: 'all', label: t('tab.all'), count: tickets.value.length },
  {
    value: 'NEW',
    label: t('tab.new'),
    count: tickets.value.filter((x) => x.status === 'NEW').length,
  },
  {
    value: 'IN_PROGRESS',
    label: t('tab.inProgress'),
    count: tickets.value.filter((x) => x.status === 'IN_PROGRESS').length,
  },
  {
    value: 'TRIAGE',
    label: t('tab.underReview'),
    count: tickets.value.filter((x) => x.status === 'TRIAGE').length,
  },
  {
    value: 'CLOSED',
    label: t('tab.closed'),
    count: tickets.value.filter((x) => x.status === 'CLOSED').length,
  },
])

const filteredTickets = computed(() =>
  tickets.value.filter((x) => ticketStatus.value === 'all' || x.status === ticketStatus.value),
)

/** Jadval qatorlari: ko‘rinadigan matn tarjima bilan, saralash qiymatlari o‘zgarmaydi */
const ticketRows = computed(() =>
  filteredTickets.value.map((x) => ({
    ...x,
    subject: ticketSubject(x),
    category: categoryLabel(x.category),
  })),
)

const ticketColumns = computed(() => [
  { key: 'code', label: t('field.id') },
  { key: 'subject', label: t('field.subject') },
  { key: 'category', label: t('field.category') },
  { key: 'priority', label: t('hlp.priority') },
  { key: 'status', label: t('field.status') },
  { key: 'createdAt', label: t('field.createdDate'), align: 'right' as const },
])

const PRIORITY_CLASS: Record<string, string> = {
  Yuqori: 'bg-danger-50 text-danger-700',
  'O‘rtacha': 'bg-warn-50 text-warn-700',
  Past: 'bg-ink-100 text-ink-600',
}

const ticketOpen = ref(false)
const selectedTicket = ref<Ticket | null>(null)

function openTicket(row: Record<string, unknown>) {
  selectedTicket.value = tickets.value.find((x) => x.id === row.id) ?? null
  ticketOpen.value = true
}

const createOpen = ref(false)
const createdCode = ref('')

const ticketForm = reactive({
  subject: '',
  category: 'To‘lovlar',
  priority: 'O‘rtacha',
  description: '',
})
const ticketError = ref('')

const categoryOptions = computed(() =>
  Object.keys(CATEGORY_KEYS).map((value) => ({ value, label: categoryLabel(value) })),
)

const priorityOptions = computed(() =>
  ['Past', 'O‘rtacha', 'Yuqori'].map((value) => ({ value, label: priorityLabel(value) })),
)

function submitTicket() {
  if (ticketForm.subject.trim().length < 4) {
    ticketError.value = t('hlp.subjectError')
    return
  }
  ticketError.value = ''
  const nextNumber = 79 + tickets.value.length - 7
  const code = `TK-2025-0${nextNumber}`
  tickets.value.unshift({
    id: `t-0${nextNumber}`,
    code,
    subject: ticketForm.subject.trim(),
    category: ticketForm.category,
    priority: ticketForm.priority as Ticket['priority'],
    status: 'NEW',
    createdAt: '2025-05-18 11:05',
    description: ticketForm.description.trim() || t('hlp.noComment'),
  })
  createdCode.value = code
  ticketForm.subject = ''
  ticketForm.description = ''
  createOpen.value = false
}

const onboarding = ref([
  { id: 'o-1', labelKey: 'hlp.step1', done: true },
  { id: 'o-2', labelKey: 'hlp.step2', done: true },
  { id: 'o-3', labelKey: 'hlp.step3', done: false },
  { id: 'o-4', labelKey: 'hlp.step4', done: false },
  { id: 'o-5', labelKey: 'hlp.step5', done: false },
])

const onboardingProgress = computed(() =>
  Math.round((onboarding.value.filter((s) => s.done).length / onboarding.value.length) * 100),
)

function toggleStep(id: string) {
  const step = onboarding.value.find((s) => s.id === id)
  if (step) step.done = !step.done
}

const supportOpen = ref(false)
const supportChannel = ref<{
  id: string
  title: string
  value: string
  caption: string
  icon: string
} | null>(null)

const supportChannels = computed(() => [
  {
    id: 'chat',
    title: t('hlp.chChatTitle'),
    value: t('hlp.chChatValue'),
    caption: t('hlp.workHours', { value: CONTACT.hours }),
    icon: 'send',
    tone: 'bg-ok-50 text-ok-600',
  },
  {
    id: 'call',
    title: t('hlp.chCallTitle'),
    value: CONTACT.phone,
    caption: t('hlp.chCallCaption', { hours: CONTACT.hours }),
    icon: 'help',
    tone: 'bg-brand-50 text-brand-600',
  },
  {
    id: 'email',
    title: t('hlp.chEmailTitle'),
    value: CONTACT.email,
    caption: t('hlp.chEmailCaption'),
    icon: 'doc',
    tone: 'bg-info-50 text-info-600',
  },
  {
    id: 'remote',
    title: t('hlp.chRemoteTitle'),
    value: t('hlp.chRemoteValue'),
    caption: t('hlp.chRemoteCaption'),
    icon: 'external',
    tone: 'bg-warn-50 text-warn-600',
  },
])

function openSupport(c: (typeof supportChannels.value)[number]) {
  supportChannel.value = c
  supportOpen.value = true
}

/** Qo‘ng‘iroq va e-pochta kanallari haqiqiy havola bilan ochiladi */
const supportLink = computed(() => {
  const c = supportChannel.value
  if (!c) return ''
  if (c.id === 'call') return `tel:${c.value.replace(/[^+\d]/g, '')}`
  if (c.id === 'email') return `mailto:${c.value}`
  return ''
})

const copied = ref(false)

async function copyChannel() {
  const c = supportChannel.value
  if (!c) return
  try {
    await navigator.clipboard.writeText(c.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 2200)
  } catch {
    copied.value = false
  }
}

const statusOpen = ref(false)

const SERVICE_KEYS = [
  'hlp.svcCabinet',
  'hlp.svcBilling',
  'hlp.svcArchive',
  'hlp.svcMeters',
  'hlp.svcNotify',
]

const systemServices = computed(() =>
  SERVICE_KEYS.map((key) => ({ label: t(key), state: t('hlp.svcRunning') })),
)
</script>

<template>
  <AppTopbar :title="moduleTitle('help')" :subtitle="t('hlp.subtitle')">
    <template #actions>
      <UiButton variant="secondary" size="sm" @click="statusOpen = true">
        <UiIcon name="shield" :size="16" />
        {{ t('hlp.systemStatus') }}
      </UiButton>
      <UiButton size="sm" @click="createOpen = true">
        <UiIcon name="plus" :size="16" />
        {{ t('hlp.newTicket') }}
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
      <i18n-t
        keypath="hlp.ticketCreated"
        tag="p"
        scope="global"
        class="min-w-0 flex-1 text-[14px] text-ok-700"
      >
        <template #code><b>#{{ createdCode }}</b></template>
      </i18n-t>
      <button
        type="button"
        class="rounded-lg p-1.5 text-ok-700 transition-colors hover:bg-ok-100"
        :aria-label="t('common.closeMessage')"
        @click="createdCode = ''"
      >
        <UiIcon name="x" :size="16" />
      </button>
    </div>

    <section class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div class="min-w-0 space-y-5">
        <UiCard>
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div class="min-w-0">
              <h2 class="text-[18px] font-bold text-ink-900">{{ t('hlp.welcome') }}</h2>
              <p class="mt-1 text-[14px] text-ink-500">
                {{ t('hlp.welcomeLead') }}
              </p>
            </div>
            <div class="flex w-full items-center gap-2.5 sm:w-auto">
              <UiInput
                v-model="query"
                :placeholder="t('hlp.searchPlaceholder')"
                class="w-full sm:w-72"
              >
                <template #prefix><UiIcon name="search" :size="16" /></template>
              </UiInput>
              <UiButton @click="runSearch">
                <UiIcon name="search" :size="16" />
                {{ t('common.search') }}
              </UiButton>
            </div>
          </div>

          <p v-if="searchNote" class="mt-3 text-[13px] font-medium text-brand-700">
            {{ searchNote }}
          </p>

          <div class="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <button
              v-for="r in roleCards"
              :key="r.value"
              type="button"
              class="rounded-field p-4 text-left ring-1 transition-all hover:shadow-card"
              :class="
                roleFilter === r.value ? 'ring-2 ring-brand-500' : 'ring-ink-200 hover:ring-brand-300'
              "
              @click="toggleRole(r.value)"
            >
              <span class="grid size-10 place-items-center rounded-[10px]" :class="r.tone">
                <UiIcon :name="r.icon" :size="19" />
              </span>
              <span class="mt-3 block text-[14px] font-bold text-ink-900">
                {{ roleName(r.value) }}
              </span>
              <span class="mt-0.5 block text-[12px] leading-snug text-ink-500">
                {{ t(r.captionKey) }}
              </span>
            </button>
          </div>

          <div v-if="roleFilter !== 'all'" class="mt-3 flex items-center gap-2">
            <span class="text-[13px] text-ink-500">{{ t('hlp.activeFilter') }}</span>
            <button
              type="button"
              class="inline-flex items-center gap-1.5 rounded-pill bg-brand-50 px-2.5 py-1 text-[12px] font-semibold text-brand-700 transition-colors hover:bg-brand-100"
              @click="roleFilter = 'all'"
            >
              {{ roleName(roleFilter) }}
              <UiIcon name="x" :size="12" />
            </button>
          </div>
        </UiCard>

        <div class="grid gap-5 lg:grid-cols-2">
          <UiCard
            :title="t('hlp.faqTitle')"
            :subtitle="t('hlp.faqCount', { n: filteredFaq.length })"
            flush
          >
            <ul class="divide-y divide-ink-100">
              <li v-for="f in filteredFaq" :key="f.id">
                <button
                  type="button"
                  class="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-brand-50/40"
                  :aria-expanded="openFaq === f.id"
                  @click="toggleFaq(f.id)"
                >
                  <UiIcon
                    name="chevronRight"
                    :size="16"
                    class="shrink-0 text-ink-400 transition-transform"
                    :class="openFaq === f.id ? 'rotate-90 text-brand-600' : ''"
                  />
                  <span
                    class="min-w-0 flex-1 text-[14px]"
                    :class="openFaq === f.id ? 'font-bold text-brand-700' : 'font-medium text-ink-800'"
                  >
                    {{ f.question }}
                  </span>
                  <span class="shrink-0 rounded-pill bg-ink-100 px-2 py-0.5 text-[11px] font-semibold text-ink-600">
                    {{ roleName(f.role) }}
                  </span>
                </button>
                <p
                  v-if="openFaq === f.id"
                  class="px-5 pb-4 pl-14 text-[13px] leading-relaxed text-ink-600"
                >
                  {{ f.answer }}
                </p>
              </li>
              <li v-if="!filteredFaq.length" class="px-5 py-12 text-center text-[13px] text-ink-500">
                {{ t('hlp.faqEmpty') }}
              </li>
            </ul>
          </UiCard>

          <UiCard :title="t('hlp.manualsTitle')" :subtitle="t('hlp.manualsCaption')" flush>
            <ul class="divide-y divide-ink-100">
              <li v-for="m in filteredManuals" :key="m.id" class="flex items-center gap-3.5 px-5 py-3.5">
                <span class="grid size-10 shrink-0 place-items-center rounded-[10px] bg-danger-50 text-danger-600">
                  <UiIcon name="doc" :size="18" />
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-[14px] font-semibold text-ink-900">
                    {{ manualName(m) }}
                  </span>
                  <span class="block truncate text-[12px] text-ink-500">
                    {{ roleName(m.role) }} · {{ dateShort(m.at) }}
                  </span>
                </span>
                <button
                  type="button"
                  class="grid size-11 shrink-0 place-items-center rounded-field text-brand-600 transition-colors hover:bg-brand-50 md:size-9"
                  :aria-label="t('hlp.manualDownloadAria', { name: manualName(m) })"
                  @click="openManual(m)"
                >
                  <UiIcon name="download" :size="18" />
                </button>
              </li>
            </ul>
          </UiCard>
        </div>

        <UiCard :title="t('hlp.ticketsTitle')" :subtitle="t('hlp.ticketsCaption')" flush>
          <template #actions>
            <UiButton size="sm" @click="createOpen = true">
              <UiIcon name="plus" :size="15" />
              {{ t('hlp.newTicketCreate') }}
            </UiButton>
          </template>

          <div class="px-5 pb-4">
            <UiTabs v-model="ticketStatus" :tabs="ticketTabs" variant="line" />
          </div>

          <UiTable
            :columns="ticketColumns"
            :rows="ticketRows"
            :empty="t('hlp.ticketsEmpty')"
            @row-click="openTicket"
          >
            <template #cell-code="{ value }">
              <span class="tabular text-[13px] font-semibold text-ink-900">#{{ value }}</span>
            </template>
            <template #cell-subject="{ value }">
              <span class="text-[14px] text-ink-800">{{ value }}</span>
            </template>
            <template #cell-priority="{ row }">
              <span
                class="rounded-pill px-2.5 py-1 text-[12px] font-semibold"
                :class="PRIORITY_CLASS[String(row.priority)]"
              >
                {{ priorityLabel(String(row.priority)) }}
              </span>
            </template>
            <template #cell-status="{ row }">
              <UiStatus kind="service" :value="String(row.status)" size="sm" />
            </template>
            <template #cell-createdAt="{ value }">
              <span class="tabular text-[13px]">{{ value }}</span>
            </template>
          </UiTable>
        </UiCard>
      </div>

      <div class="min-w-0 space-y-5">
        <UiCard :title="t('hlp.onboardingTitle')" :subtitle="t('hlp.onboardingCaption')">
          <div class="flex items-center gap-3">
            <div class="h-2 flex-1 overflow-hidden rounded-pill bg-ink-100">
              <div
                class="h-full rounded-pill bg-brand-500 transition-all"
                :style="{ width: `${onboardingProgress}%` }"
              />
            </div>
            <span class="tabular text-[13px] font-bold text-ink-900">{{ onboardingProgress }}%</span>
          </div>

          <ul class="mt-4 space-y-1.5">
            <li v-for="(s, i) in onboarding" :key="s.id">
              <button
                type="button"
                class="flex w-full items-center gap-3 rounded-field px-3 py-2.5 text-left transition-colors hover:bg-ink-100"
                :aria-pressed="s.done"
                @click="toggleStep(s.id)"
              >
                <span
                  class="grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold"
                  :class="s.done ? 'bg-ok-500 text-white' : 'bg-ink-100 text-ink-500'"
                >
                  <UiIcon v-if="s.done" name="check" :size="13" />
                  <template v-else>{{ i + 1 }}</template>
                </span>
                <span
                  class="min-w-0 flex-1 truncate text-[13px]"
                  :class="s.done ? 'font-medium text-ink-500 line-through' : 'font-semibold text-ink-800'"
                >
                  {{ t(s.labelKey) }}
                </span>
              </button>
            </li>
          </ul>

          <UiButton
            variant="secondary"
            size="sm"
            class="mt-4"
            block
            @click="openManual(generalManual)"
          >
            {{ t('hlp.onboardingContinue') }}
            <UiIcon name="chevronRight" :size="15" />
          </UiButton>
        </UiCard>

        <UiCard :title="t('hlp.supportTitle')" :subtitle="t('hlp.supportCaption')" flush>
          <div class="space-y-2.5 px-5 pb-5">
            <button
              v-for="c in supportChannels"
              :key="c.id"
              type="button"
              class="flex w-full items-center gap-3.5 rounded-field p-3.5 text-left ring-1 ring-ink-200 transition-all hover:shadow-card hover:ring-brand-300"
              @click="openSupport(c)"
            >
              <span class="grid size-10 shrink-0 place-items-center rounded-[10px]" :class="c.tone">
                <UiIcon :name="c.icon" :size="18" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-[14px] font-semibold text-ink-900">{{ c.title }}</span>
                <span class="tabular block truncate text-[13px] text-brand-600">{{ c.value }}</span>
              </span>
              <UiIcon name="chevronRight" :size="16" class="shrink-0 text-ink-400" />
            </button>
          </div>
        </UiCard>

        <UiCard :title="t('hlp.systemStatus')" :subtitle="t('hlp.statusCaption')">
          <div class="flex items-center gap-3 rounded-field bg-ok-50 px-4 py-3">
            <span class="grid size-9 shrink-0 place-items-center rounded-[10px] bg-ok-500 text-white">
              <UiIcon name="check" :size="18" />
            </span>
            <p class="min-w-0 flex-1 text-[13px] font-semibold text-ok-700">
              {{ t('hlp.allRunning') }}
              <span class="block font-normal text-ok-600">
                {{ t('hlp.allRunningText') }}
              </span>
            </p>
          </div>

          <div class="mt-3 flex items-center justify-between">
            <p class="text-[13px] text-ink-500">{{ t('hlp.lastUpdate') }}</p>
            <UiButton variant="ghost" size="sm" @click="statusOpen = true">
              {{ t('common.more') }}
            </UiButton>
          </div>
        </UiCard>
      </div>
    </section>
  </main>

  <UiModal
    v-model="manualOpen"
    :title="t('hlp.manualModalTitle')"
    :subtitle="selectedManual ? manualName(selectedManual) : ''"
    size="sm"
  >
    <div v-if="selectedManual" class="space-y-4">
      <div class="flex items-center gap-3.5 rounded-field bg-surface-sunken p-4 ring-1 ring-ink-200">
        <span class="grid size-12 shrink-0 place-items-center rounded-field bg-brand-50 text-brand-600">
          <UiIcon name="doc" :size="24" />
        </span>
        <span class="min-w-0">
          <span class="block truncate text-[14px] font-semibold text-ink-900">
            {{ manualOutput?.name }}
          </span>
          <span class="block text-[12px] text-ink-500">
            DOCX · {{ manualOutput?.size }} · {{ dateShort(selectedManual.at) }}
          </span>
        </span>
      </div>

      <p v-if="!savedManual" class="text-[13px] text-ink-600">
        {{ t('hlp.manualNote') }}
      </p>
      <p v-else class="flex items-start gap-2 text-[13px] font-semibold text-ok-700">
        <UiIcon name="check" :size="16" class="mt-px shrink-0" />
        <span class="min-w-0">{{ t('hlp.manualSaved', { name: savedManual }) }}</span>
      </p>
    </div>

    <template #footer>
      <UiButton variant="ghost" @click="manualOpen = false">{{ t('common.close') }}</UiButton>
      <UiButton @click="downloadManual">
        <UiIcon name="download" :size="16" />
        {{ t('common.download') }}
      </UiButton>
    </template>
  </UiModal>

  <UiModal
    v-model="ticketOpen"
    :title="selectedTicket ? `#${selectedTicket.code}` : t('hlp.ticket')"
    :subtitle="selectedTicket ? ticketSubject(selectedTicket) : ''"
  >
    <div v-if="selectedTicket" class="space-y-4">
      <div class="flex flex-wrap items-center gap-2.5">
        <UiStatus kind="service" :value="selectedTicket.status" />
        <span class="rounded-pill bg-ink-100 px-2.5 py-1 text-[12px] font-semibold text-ink-700">
          {{ categoryLabel(selectedTicket.category) }}
        </span>
        <span
          class="rounded-pill px-2.5 py-1 text-[12px] font-semibold"
          :class="PRIORITY_CLASS[selectedTicket.priority]"
        >
          {{ t('hlp.priorityValue', { value: priorityLabel(selectedTicket.priority) }) }}
        </span>
      </div>

      <p class="text-[14px] leading-relaxed text-ink-700">{{ ticketText(selectedTicket) }}</p>

      <dl class="divide-y divide-ink-100 rounded-field ring-1 ring-ink-200">
        <div class="flex items-center justify-between px-4 py-2.5">
          <dt class="text-[13px] text-ink-500">{{ t('hlp.ticketNo') }}</dt>
          <dd class="tabular text-[13px] font-semibold text-ink-900">#{{ selectedTicket.code }}</dd>
        </div>
        <div class="flex items-center justify-between px-4 py-2.5">
          <dt class="text-[13px] text-ink-500">{{ t('field.createdDate') }}</dt>
          <dd class="tabular text-[13px] font-semibold text-ink-900">{{ selectedTicket.createdAt }}</dd>
        </div>
        <div class="flex items-center justify-between px-4 py-2.5">
          <dt class="text-[13px] text-ink-500">{{ t('hlp.ticketOwner') }}</dt>
          <dd class="text-[13px] font-semibold text-ink-900">
            {{ auth.user?.fullName ?? 'Dilshod Ergashev' }}
          </dd>
        </div>
      </dl>
    </div>

    <template #footer>
      <UiButton variant="ghost" @click="ticketOpen = false">{{ t('common.close') }}</UiButton>
      <UiButton
        variant="secondary"
        @click="
          () => {
            ticketOpen = false
            createOpen = true
          }
        "
      >
        <UiIcon name="plus" :size="16" />
        {{ t('hlp.newTicket') }}
      </UiButton>
    </template>
  </UiModal>

  <UiModal
    v-model="createOpen"
    :title="t('hlp.newTicket')"
    :subtitle="t('hlp.newTicketCaption')"
  >
    <div class="space-y-4">
      <UiField :label="t('field.subject')" required :error="ticketError">
        <UiInput
          v-model="ticketForm.subject"
          :placeholder="t('hlp.subjectPlaceholder')"
          :invalid="!!ticketError"
        />
      </UiField>

      <div class="grid gap-4 sm:grid-cols-2">
        <UiField :label="t('field.category')" required>
          <UiSelect v-model="ticketForm.category" :options="categoryOptions" />
        </UiField>
        <UiField :label="t('hlp.priority')" required>
          <UiSelect v-model="ticketForm.priority" :options="priorityOptions" />
        </UiField>
      </div>

      <UiField :label="t('field.description')" :hint="t('hlp.descHint')">
        <textarea
          v-model="ticketForm.description"
          rows="4"
          :placeholder="t('hlp.descPlaceholder')"
          class="w-full rounded-field bg-white px-3.5 py-2.5 text-sm text-ink-800 ring-1 ring-inset ring-ink-200 transition-colors placeholder:text-ink-400 hover:ring-ink-300 focus:ring-2 focus:ring-brand-500"
        />
      </UiField>
    </div>

    <template #footer>
      <UiButton variant="ghost" @click="createOpen = false">{{ t('common.cancel') }}</UiButton>
      <UiButton @click="submitTicket">
        <UiIcon name="send" :size="16" />
        {{ t('hlp.submitTicket') }}
      </UiButton>
    </template>
  </UiModal>

  <UiModal
    v-model="supportOpen"
    :title="supportChannel?.title ?? t('hlp.supportTitle')"
    :subtitle="supportChannel?.value ?? ''"
    size="sm"
  >
    <div v-if="supportChannel" class="space-y-4">
      <div class="rounded-field bg-surface-sunken p-4 ring-1 ring-ink-200">
        <p class="tabular text-[18px] font-bold text-ink-900">{{ supportChannel.value }}</p>
        <p class="mt-1 text-[13px] text-ink-500">{{ supportChannel.caption }}</p>
      </div>

      <p v-if="!supportLink" class="text-[13px] leading-relaxed text-ink-600">
        {{ t('hlp.channelHint', { phone: CONTACT.phone }) }}
      </p>

      <p v-if="copied" class="flex items-center gap-2 text-[13px] font-semibold text-ok-700">
        <UiIcon name="check" :size="16" />
        {{ t('hlp.addressCopied') }}
      </p>
    </div>

    <template #footer>
      <UiButton variant="ghost" @click="supportOpen = false">{{ t('common.close') }}</UiButton>
      <UiButton variant="secondary" @click="copyChannel">
        <UiIcon name="clipboard" :size="16" />
        {{ t('common.copy') }}
      </UiButton>
      <UiButton v-if="supportLink" :to="supportLink">
        <UiIcon name="send" :size="16" />
        {{ supportChannel?.id === 'call' ? t('hlp.chCallTitle') : t('hlp.writeEmail') }}
      </UiButton>
      <UiButton
        v-else
        @click="
          () => {
            supportOpen = false
            createOpen = true
          }
        "
      >
        <UiIcon name="send" :size="16" />
        {{ t('hlp.newTicket') }}
      </UiButton>
    </template>
  </UiModal>

  <UiModal
    v-model="statusOpen"
    :title="t('hlp.systemStatus')"
    :subtitle="t('hlp.statusModalCaption')"
  >
    <ul class="divide-y divide-ink-100 rounded-field ring-1 ring-ink-200">
      <li v-for="s in systemServices" :key="s.label" class="flex items-center justify-between px-4 py-3">
        <span class="text-[13px] font-medium text-ink-800">{{ s.label }}</span>
        <span
          class="inline-flex items-center gap-1.5 rounded-pill bg-ok-50 px-2.5 py-1 text-[12px] font-semibold text-ok-700 ring-1 ring-inset ring-ok-100"
        >
          <UiIcon name="check" :size="12" />
          {{ s.state }}
        </span>
      </li>
    </ul>

    <p class="mt-4 text-[13px] text-ink-500">{{ t('hlp.lastUpdate') }}</p>

    <template #footer>
      <UiButton variant="ghost" @click="statusOpen = false">{{ t('common.close') }}</UiButton>
    </template>
  </UiModal>
</template>
