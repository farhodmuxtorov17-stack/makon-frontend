<script setup lang="ts">
import { ROLE_META, ROLE_TONE_CLASSES } from '~/constants/roles'
import { ROLES, type Role } from '~/types/rbac'
import { dateShort, todayIso } from '~/utils/format'
import { csvBlob, docxBlob, fileSlug, saveBlob } from '~/utils/docx'

const { t } = useI18n()
const { field, columns: labelColumns, roleLabel } = useAppLabels()

/** Ekranga chiqadigan matn: lug‘at kaliti yoki tarjima qilinmaydigan qiymat */
interface Phrase {
  k?: string
  p?: Record<string, unknown>
  s?: string
}

const say = (p: Phrase) => (p.k ? t(p.k, p.p ?? {}) : (p.s ?? ''))

const SETTINGS_TABS = computed(() => [
  { label: t('nav.settingsUsers'), to: '/settings/users', icon: 'users' },
  { label: t('nav.settingsRoles'), to: '/settings/roles', icon: 'shield' },
  { label: t('nav.settingsIntegrations'), to: '/settings/integrations', icon: 'globe' },
  { label: t('nav.settingsReference'), to: '/settings/reference-data', icon: 'layers' },
  { label: t('nav.settingsSystem'), to: '/settings/system', icon: 'gear' },
  { label: t('nav.settingsAudit'), to: '/settings/audit', icon: 'clipboard' },
])
const CURRENT_TAB = '/settings/audit'

/**
 * Modul va amal qiymati o‘zgarmaydi: filtr va solishtirish shu qiymat bo‘yicha
 * ishlaydi, ekranda esa lug‘atdagi nom ko‘rinadi.
 */
const MODULE_KEY: Record<string, string> = {
  Sozlamalar: 'nav.settings',
  Billing: 'cfg.moduleBilling',
  Obyektlar: 'nav.objects',
  Foydalanuvchilar: 'nav.settingsUsers',
  Autentifikatsiya: 'cfg.moduleAuth',
  Shartnomalar: 'nav.contracts',
  Servis: 'section.service',
  Hisobotlar: 'nav.reports',
  Ombor: 'section.warehouse',
}

const ACTION_KEY: Record<string, string> = {
  'O‘zgartirish': 'cfg.actionEdit',
  Tasdiqlash: 'cfg.actionApprove',
  Kirish: 'cfg.actionLogin',
  Imzolash: 'cfg.actionSign',
  Eksport: 'common.export',
  Yaratish: 'cfg.actionCreate',
  'O‘chirish': 'cfg.actionDelete',
}

const moduleLabel = (value: string) => (MODULE_KEY[value] ? t(MODULE_KEY[value]!) : value)
const actionLabel = (value: string) => (ACTION_KEY[value] ? t(ACTION_KEY[value]!) : value)
const resultLabel = (result: 'SUCCESS' | 'ERROR') =>
  result === 'SUCCESS' ? t('cfg.resultSuccess') : t('connection.error')

interface DiffLine {
  field: Phrase
  before: Phrase
  after: Phrase
}

interface AuditEvent {
  id: string
  date: string
  time: string
  user: string
  role: Role
  module: string
  action: string
  object: Phrase
  result: 'SUCCESS' | 'ERROR'
  ip: string
  /** Tafsilot matnining lug‘at kaliti */
  detail: string
  diff: DiffLine[]
}

const EVENTS: AuditEvent[] = [
  {
    id: 'log-0184',
    date: '2026-08-18',
    time: '10:24:12',
    user: 'Jahongir Alimov',
    role: 'SUPER_HEAD',
    module: 'Sozlamalar',
    action: 'O‘zgartirish',
    object: { k: 'cfg.objSecurityPolicies' },
    result: 'SUCCESS',
    ip: '10.0.14.22',
    detail: 'cfg.detPolicyApplied',
    diff: [
      {
        field: { k: 'cfg.twoFactor' },
        before: { k: 'common.disabled' },
        after: { k: 'common.enabled' },
      },
      {
        field: { k: 'cfg.sessionLength' },
        before: { k: 'cfg.minutesValue', p: { value: 30 } },
        after: { k: 'cfg.minutesValue', p: { value: 15 } },
      },
    ],
  },
  {
    id: 'log-0183',
    date: '2026-08-18',
    time: '09:58:41',
    user: 'Sevara Yusupova',
    role: 'ACCOUNTANT',
    module: 'Billing',
    action: 'Tasdiqlash',
    object: { s: 'INV-2025-0412' },
    result: 'SUCCESS',
    ip: '10.0.14.31',
    detail: 'cfg.detInvoicePaid',
    diff: [
      {
        field: { k: 'field.status' },
        before: { k: 'status.invoice.PARTIALLY_PAID' },
        after: { k: 'status.invoice.PAID' },
      },
      {
        field: { k: 'cfg.paidAmount' },
        before: { k: 'unitOf.currencyValue', p: { value: '18 400 000' } },
        after: { k: 'unitOf.currencyValue', p: { value: '24 600 000' } },
      },
    ],
  },
  {
    id: 'log-0182',
    date: '2026-08-18',
    time: '09:41:07',
    user: 'Dilshod Karimov',
    role: 'BUILDING_MANAGER',
    module: 'Obyektlar',
    action: 'O‘zgartirish',
    object: { s: 'Mega Mall / Unit MM-214' },
    result: 'SUCCESS',
    ip: '10.0.21.9',
    detail: 'cfg.detUnitEdited',
    diff: [
      {
        field: { k: 'field.area' },
        before: { k: 'unitOf.sqmValue', p: { value: '118.40' } },
        after: { k: 'unitOf.sqmValue', p: { value: '124.60' } },
      },
      {
        field: { k: 'cfg.rentPrice' },
        before: { k: 'unitOf.currencyValue', p: { value: '9 200 000' } },
        after: { k: 'unitOf.currencyValue', p: { value: '9 850 000' } },
      },
    ],
  },
  {
    id: 'log-0181',
    date: '2026-08-18',
    time: '09:12:55',
    user: 'Jahongir Alimov',
    role: 'SUPER_HEAD',
    module: 'Foydalanuvchilar',
    action: 'O‘zgartirish',
    object: { s: 'Malika Tosheva' },
    result: 'SUCCESS',
    ip: '10.0.14.22',
    detail: 'cfg.detUserUpdated',
    diff: [
      {
        field: { k: 'field.role' },
        before: { k: 'role.BUILDING_MANAGER.label' },
        after: { k: 'role.ACCOUNTANT.label' },
      },
      {
        field: { k: 'field.buildingScope' },
        before: { s: 'Mega Mall' },
        after: { s: 'Green Business Center, Harmony Residence' },
      },
    ],
  },
  {
    id: 'log-0180',
    date: '2026-08-18',
    time: '08:47:30',
    user: 'Otabek Rahimov',
    role: 'FACILITY',
    module: 'Autentifikatsiya',
    action: 'Kirish',
    object: { k: 'cfg.objWebInterface' },
    result: 'ERROR',
    ip: '84.54.72.118',
    detail: 'cfg.detLoginBlocked',
    diff: [],
  },
  {
    id: 'log-0179',
    date: '2026-08-17',
    time: '18:30:02',
    user: 'Sevara Yusupova',
    role: 'ACCOUNTANT',
    module: 'Sozlamalar',
    action: 'O‘zgartirish',
    object: { k: 'cfg.objTariffTables' },
    result: 'SUCCESS',
    ip: '10.0.14.31',
    detail: 'cfg.detTariffUpdated',
    diff: [
      {
        field: { k: 'cfg.electricity' },
        before: { k: 'cfg.tariffPerKwh', p: { value: '1 180' } },
        after: { k: 'cfg.tariffPerKwh', p: { value: '1 250' } },
      },
      {
        field: { k: 'cfg.effectiveDate' },
        before: { s: '02.07.2026' },
        after: { s: '01.08.2026' },
      },
    ],
  },
  {
    id: 'log-0178',
    date: '2026-08-17',
    time: '17:12:44',
    user: 'Nigora Aripova',
    role: 'BUILDING_MANAGER',
    module: 'Shartnomalar',
    action: 'Imzolash',
    object: { s: 'SH-2025-0148' },
    result: 'SUCCESS',
    ip: '10.0.33.7',
    detail: 'cfg.detContractSigned',
    diff: [
      {
        field: { k: 'field.status' },
        before: { k: 'status.contract.REVIEW' },
        after: { k: 'status.contract.SIGNED' },
      },
      {
        field: { k: 'cfg.approvedBy' },
        before: { s: '-' },
        after: { s: 'Nigora Aripova' },
      },
      {
        field: { k: 'cfg.approvalDate' },
        before: { s: '-' },
        after: { s: '17.08.2026' },
      },
    ],
  },
  {
    id: 'log-0177',
    date: '2026-08-17',
    time: '16:08:19',
    user: 'Sardor Yo‘ldoshev',
    role: 'FACILITY',
    module: 'Servis',
    action: 'O‘zgartirish',
    object: { s: 'SR-2025-0921' },
    result: 'SUCCESS',
    ip: '10.0.44.15',
    detail: 'cfg.detServiceClosed',
    diff: [
      {
        field: { k: 'field.status' },
        before: { k: 'status.service.IN_PROGRESS' },
        after: { k: 'status.service.COMPLETED' },
      },
      {
        field: { k: 'cfg.timeSpent' },
        before: { k: 'cfg.hoursValue', p: { value: '3.5' } },
        after: { k: 'cfg.hoursValue', p: { value: '5.0' } },
      },
    ],
  },
  {
    id: 'log-0176',
    date: '2026-08-17',
    time: '12:47:38',
    user: 'Aziza Nurmatova',
    role: 'TENANT_OWNER',
    module: 'Hisobotlar',
    action: 'Eksport',
    object: { k: 'cfg.objRentPaymentsReport' },
    result: 'SUCCESS',
    ip: '213.230.98.44',
    detail: 'cfg.detCabinetExport',
    diff: [],
  },
  {
    id: 'log-0175',
    date: '2026-08-16',
    time: '14:20:51',
    user: 'Malika Tosheva',
    role: 'ACCOUNTANT',
    module: 'Billing',
    action: 'Yaratish',
    object: { s: 'INV-2025-0407' },
    result: 'SUCCESS',
    ip: '10.0.14.44',
    detail: 'cfg.detInvoiceCreated',
    diff: [
      {
        field: { k: 'field.amount' },
        before: { s: '-' },
        after: { k: 'unitOf.currencyValue', p: { value: '31 200 000' } },
      },
      {
        field: { k: 'field.dueDate' },
        before: { s: '-' },
        after: { s: '25.08.2026' },
      },
    ],
  },
  {
    id: 'log-0174',
    date: '2026-08-16',
    time: '11:05:23',
    user: 'Bobur Ismoilov',
    role: 'BUILDING_MANAGER',
    module: 'Ombor',
    action: 'O‘zgartirish',
    object: { s: 'MT-2025-0096' },
    result: 'SUCCESS',
    ip: '10.0.52.3',
    detail: 'cfg.detMaterialApproved',
    diff: [
      {
        field: { k: 'field.status' },
        before: { k: 'status.material.SUBMITTED' },
        after: { k: 'status.material.APPROVED' },
      },
    ],
  },
  {
    id: 'log-0173',
    date: '2026-08-16',
    time: '09:33:10',
    user: 'Rustam Qodirov',
    role: 'TENANT_OWNER',
    module: 'Autentifikatsiya',
    action: 'Kirish',
    object: { k: 'cfg.mobileApp' },
    result: 'ERROR',
    ip: '178.218.201.76',
    detail: 'cfg.detLoginRejected',
    diff: [],
  },
  {
    id: 'log-0172',
    date: '2026-08-15',
    time: '17:05:48',
    user: 'Jahongir Alimov',
    role: 'SUPER_HEAD',
    module: 'Foydalanuvchilar',
    action: 'Yaratish',
    object: { s: 'Sardor Yo‘ldoshev' },
    result: 'SUCCESS',
    ip: '10.0.14.22',
    detail: 'cfg.detUserCreated',
    diff: [
      {
        field: { k: 'field.role' },
        before: { s: '-' },
        after: { k: 'role.FACILITY.label' },
      },
      {
        field: { k: 'field.buildingScope' },
        before: { s: '-' },
        after: { s: 'Green Business Center, Urban Office' },
      },
    ],
  },
  {
    id: 'log-0171',
    date: '2026-08-15',
    time: '13:41:02',
    user: 'Jahongir Alimov',
    role: 'SUPER_HEAD',
    module: 'Sozlamalar',
    action: 'O‘zgartirish',
    object: { k: 'cfg.objTelegramChannel' },
    result: 'SUCCESS',
    ip: '10.0.14.22',
    detail: 'cfg.detChannelSchedule',
    diff: [
      {
        field: { k: 'cfg.sendSchedule' },
        before: { k: 'cfg.every6h' },
        after: { k: 'cfg.dailyAt', p: { time: '02:00' } },
      },
    ],
  },
  {
    id: 'log-0170',
    date: '2026-08-15',
    time: '11:02:37',
    user: 'Dilshod Karimov',
    role: 'BUILDING_MANAGER',
    module: 'Obyektlar',
    action: 'O‘chirish',
    object: { k: 'cfg.objUnitListing' },
    result: 'SUCCESS',
    ip: '10.0.21.9',
    detail: 'cfg.detListingArchived',
    diff: [
      {
        field: { k: 'cfg.listingState' },
        before: { k: 'status.listing.PUBLISHED' },
        after: { k: 'status.listing.ARCHIVED' },
      },
    ],
  },
  {
    id: 'log-0169',
    date: '2026-08-15',
    time: '10:22:14',
    user: 'Sevara Yusupova',
    role: 'ACCOUNTANT',
    module: 'Hisobotlar',
    action: 'Eksport',
    object: { k: 'cfg.objDebtReport' },
    result: 'SUCCESS',
    ip: '10.0.14.31',
    detail: 'cfg.detReportExported',
    diff: [],
  },
]

const MODULES = [...new Set(EVENTS.map((e) => e.module))]
const ACTIONS = [...new Set(EVENTS.map((e) => e.action))]
const USERS = [...new Set(EVENTS.map((e) => e.user))].sort()

const search = ref('')
const userFilter = ref('all')
const roleFilter = ref('all')
const moduleFilter = ref('all')
const actionFilter = ref('all')
const resultFilter = ref('all')
/**
 * Sana oralig‘i jurnaldagi yozuvlardan olinadi: sahifa ochilganda butun
 * jurnal ko‘rinadi va yangi yozuv qo‘shilganda oraliq o‘zi kengayadi.
 */
const LOG_DATES = EVENTS.map((e) => e.date).sort()
const LOG_FROM = LOG_DATES[0] ?? todayIso()
const LOG_TO = LOG_DATES[LOG_DATES.length - 1] ?? todayIso()

const fromDate = ref(LOG_FROM)
const toDate = ref(LOG_TO)

const userOptions = computed(() => [
  { value: 'all', label: t('cfg.allUsers') },
  ...USERS.map((u) => ({ value: u, label: u })),
])
const roleOptions = computed(() => [
  { value: 'all', label: t('filter.allRoles') },
  ...ROLES.map((r) => ({ value: r, label: roleLabel(r) })),
])
const moduleOptions = computed(() => [
  { value: 'all', label: t('cfg.allModules') },
  ...MODULES.map((m) => ({ value: m, label: moduleLabel(m) })).sort((a, b) =>
    a.label.localeCompare(b.label),
  ),
])
const actionOptions = computed(() => [
  { value: 'all', label: t('cfg.allActions') },
  ...ACTIONS.map((a) => ({ value: a, label: actionLabel(a) })).sort((a, b) =>
    a.label.localeCompare(b.label),
  ),
])
const resultOptions = computed(() => [
  { value: 'all', label: t('cfg.allResults') },
  { value: 'SUCCESS', label: t('cfg.resultSuccess') },
  { value: 'ERROR', label: t('connection.error') },
])

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return EVENTS.filter((e) => {
    const matchQ =
      !q ||
      say(e.object).toLowerCase().includes(q) ||
      t(e.detail).toLowerCase().includes(q) ||
      e.id.toLowerCase().includes(q) ||
      e.ip.includes(q)
    const matchUser = userFilter.value === 'all' || e.user === userFilter.value
    const matchRole = roleFilter.value === 'all' || e.role === roleFilter.value
    const matchModule = moduleFilter.value === 'all' || e.module === moduleFilter.value
    const matchAction = actionFilter.value === 'all' || e.action === actionFilter.value
    const matchResult = resultFilter.value === 'all' || e.result === resultFilter.value
    const matchFrom = !fromDate.value || e.date >= fromDate.value
    const matchTo = !toDate.value || e.date <= toDate.value
    return matchQ && matchUser && matchRole && matchModule && matchAction && matchResult && matchFrom && matchTo
  })
})

const successCount = computed(() => filtered.value.filter((e) => e.result === 'SUCCESS').length)
const errorCount = computed(() => filtered.value.filter((e) => e.result === 'ERROR').length)

function resetFilters() {
  search.value = ''
  userFilter.value = 'all'
  roleFilter.value = 'all'
  moduleFilter.value = 'all'
  actionFilter.value = 'all'
  resultFilter.value = 'all'
  fromDate.value = LOG_FROM
  toDate.value = LOG_TO
}

const columns = computed(() =>
  labelColumns([
    { key: 'at', field: 'time' },
    { key: 'user', field: 'user' },
    { key: 'role', field: 'role' },
    { key: 'module', field: 'module' },
    { key: 'action', field: 'action' },
    { key: 'object', field: 'object' },
    { key: 'result', field: 'result' },
    { key: 'ip', field: 'ip', align: 'right' },
  ]),
)

const detailOpen = ref(false)
const selected = ref<AuditEvent | null>(null)

function openDetail(row: AuditEvent) {
  selected.value = EVENTS.find((e) => e.id === row.id) ?? null
  detailOpen.value = selected.value !== null
}

const exportOpen = ref(false)
const exportFormat = ref('CSV')
const exportResult = ref('')

function exportFromDetail() {
  detailOpen.value = false
  exportOpen.value = true
}

/**
 * Jurnal haqiqiy fayl bo‘lib yuklanadi. Audit yozuvi tekshiruvda dalil
 * sifatida ishlatiladi, shuning uchun ekrandagi filtr faylga ham tushadi.
 */
function confirmExport() {
  const range = `${dateShort(fromDate.value)} – ${dateShort(toDate.value)}`
  const name = `${fileSlug('Audit jurnali')}-${fromDate.value}-${toDate.value}.${exportFormat.value.toLowerCase()}`

  if (exportFormat.value === 'DOCX') {
    saveBlob(
      docxBlob([
        { text: t('nav.settingsAudit'), style: 'title' },
        {
          text: `${range} · ${t('cfg.recordCount', { n: filtered.value.length })}`,
          style: 'subtitle',
        },
        ...filtered.value.map((e) => ({
          text: `${dateShort(e.date)} ${e.time} · ${e.user} (${roleLabel(e.role)}) · ${moduleLabel(e.module)} · ${actionLabel(e.action)} · ${say(e.object)} · ${resultLabel(e.result)} · ${e.ip}`,
          style: 'body' as const,
        })),
      ]),
      name,
    )
  } else {
    saveBlob(
      csvBlob([
        [
          field('date'),
          field('time'),
          field('user'),
          field('role'),
          field('module'),
          field('action'),
          field('object'),
          field('result'),
          field('ip'),
        ],
        ...filtered.value.map((e) => [
          dateShort(e.date),
          e.time,
          e.user,
          roleLabel(e.role),
          moduleLabel(e.module),
          actionLabel(e.action),
          say(e.object),
          resultLabel(e.result),
          e.ip,
        ]),
      ]),
      name,
    )
  }

  exportResult.value = t('cfg.exportSaved', {
    name,
    n: filtered.value.length,
    range,
  })
  exportOpen.value = false
}
</script>

<template>
  <AppTopbar
    :title="t('nav.settingsAudit')"
    :subtitle="t('cfg.auditCaption')"
    :breadcrumb="[
      { label: t('nav.settings'), to: '/settings/users' },
      { label: t('nav.settingsAudit') },
    ]"
  >
    <template #actions>
      <UiButton variant="secondary" size="sm" @click="exportOpen = true">
        <UiIcon name="download" :size="16" />
        {{ t('common.export') }}
      </UiButton>
    </template>
  </AppTopbar>

  <main class="scroll-slim flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
    <nav class="flex flex-wrap gap-2">
      <NuxtLink
        v-for="t in SETTINGS_TABS"
        :key="t.to"
        :to="t.to"
        class="inline-flex items-center gap-2 rounded-field px-4 py-2.5 text-[13px] font-semibold ring-1 ring-inset transition-colors"
        :class="
          t.to === CURRENT_TAB
            ? 'bg-brand-500 text-white ring-brand-500 shadow-brand'
            : 'bg-surface text-ink-600 ring-ink-200 hover:text-brand-600 hover:ring-brand-300'
        "
        :aria-current="t.to === CURRENT_TAB ? 'page' : undefined"
      >
        <UiIcon :name="t.icon" :size="16" />
        {{ t.label }}
      </NuxtLink>
    </nav>

    <div
      class="flex items-start gap-2.5 rounded-card bg-brand-50 px-4 py-3 text-[13px] leading-relaxed text-brand-800"
    >
      <UiIcon name="lock" :size="17" class="mt-0.5 shrink-0 text-brand-600" />
      <span>{{ t('cfg.auditAppendOnly') }}</span>
    </div>

    <p v-if="exportResult" class="flex items-center gap-2 rounded-card bg-ok-50 px-4 py-3 text-[13px] text-ok-700 ring-1 ring-ok-100">
      <UiIcon name="check" :size="17" />
      {{ exportResult }}
    </p>

    <UiCard :title="t('common.filters')" :subtitle="t('cfg.auditFilterCaption')">
      <template #actions>
        <UiButton variant="ghost" size="sm" @click="resetFilters">{{ t('common.reset') }}</UiButton>
      </template>

      <div class="grid gap-4 lg:grid-cols-3 2xl:grid-cols-4">
        <UiField :label="t('common.search')">
          <UiInput v-model="search" :placeholder="t('cfg.auditSearchPlaceholder')">
            <template #prefix><UiIcon name="search" :size="17" /></template>
          </UiInput>
        </UiField>
        <UiField :label="field('user')">
          <UiSelect v-model="userFilter" :options="userOptions" />
        </UiField>
        <UiField :label="field('role')">
          <UiSelect v-model="roleFilter" :options="roleOptions" />
        </UiField>
        <UiField :label="field('module')">
          <UiSelect v-model="moduleFilter" :options="moduleOptions" />
        </UiField>
        <UiField :label="field('action')">
          <UiSelect v-model="actionFilter" :options="actionOptions" />
        </UiField>
        <UiField :label="field('result')">
          <UiSelect v-model="resultFilter" :options="resultOptions" />
        </UiField>
        <UiField :label="t('cfg.dateFrom')">
          <UiInput v-model="fromDate" type="date" />
        </UiField>
        <UiField :label="t('cfg.dateTo')">
          <UiInput v-model="toDate" type="date" />
        </UiField>
      </div>

      <div class="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-ink-100 pt-4 text-[13px]">
        <span class="tabular font-semibold text-ink-700">
          {{ t('cfg.foundRecords', { n: filtered.length }) }}
        </span>
        <span class="inline-flex items-center gap-1.5 text-ok-700">
          <UiIcon name="check" :size="14" />
          {{ t('cfg.resultSuccess') }}: {{ successCount }}
        </span>
        <span class="inline-flex items-center gap-1.5 text-danger-700">
          <UiIcon name="x" :size="14" />
          {{ t('connection.error') }}: {{ errorCount }}
        </span>
      </div>
    </UiCard>

    <UiCard :title="t('cfg.eventsList')" :subtitle="t('cfg.eventsListCaption')" flush>
      <UiTable
        :page-size="25"
        :columns="columns"
        :rows="filtered"
        :empty="t('cfg.emptyLog')"
        @row-click="openDetail"
      >
        <template #cell-at="{ row }">
          <span class="tabular block text-[13px] font-semibold text-ink-900">
            {{ dateShort(row.date) }}
          </span>
          <span class="tabular block text-[12px] text-ink-500">{{ row.time }}</span>
        </template>

        <template #cell-user="{ row }">
          <span class="block text-[13px] font-semibold text-ink-900">{{ row.user }}</span>
          <span class="tabular block text-[12px] text-ink-500">{{ row.id }}</span>
        </template>

        <template #cell-role="{ row }">
          <span
            class="inline-flex items-center rounded-pill px-2.5 py-1 text-xs font-semibold ring-1 ring-inset"
            :class="ROLE_TONE_CLASSES[ROLE_META[row.role].tone]"
          >
            {{ roleLabel(row.role) }}
          </span>
        </template>

        <template #cell-module="{ row }">
          <span class="text-[13px] text-ink-700">{{ moduleLabel(row.module) }}</span>
        </template>

        <template #cell-action="{ row }">
          <span class="rounded-[6px] bg-ink-100 px-2 py-1 text-[12px] font-semibold text-ink-700">
            {{ actionLabel(row.action) }}
          </span>
        </template>

        <template #cell-object="{ row }">
          <span class="block max-w-[18rem] truncate text-[13px] text-ink-700">
            {{ say(row.object) }}
          </span>
        </template>

        <template #cell-result="{ row }">
          <span
            class="inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs font-semibold ring-1 ring-inset"
            :class="
              row.result === 'SUCCESS'
                ? 'bg-ok-50 text-ok-700 ring-ok-100'
                : 'bg-danger-50 text-danger-700 ring-danger-100'
            "
          >
            <UiIcon :name="row.result === 'SUCCESS' ? 'check' : 'x'" :size="13" />
            {{ resultLabel(row.result) }}
          </span>
        </template>

        <template #cell-ip="{ row }">
          <span class="tabular text-[13px] text-ink-600">{{ row.ip }}</span>
        </template>
      </UiTable>
    </UiCard>

    <UiModal
      v-model="detailOpen"
      :title="t('cfg.auditDetailTitle')"
      :subtitle="selected ? `${selected.id} • ${dateShort(selected.date)} ${selected.time}` : ''"
      size="lg"
    >
      <template v-if="selected">
        <dl class="grid gap-4 sm:grid-cols-2">
          <div>
            <dt class="text-[12px] text-ink-500">{{ field('user') }}</dt>
            <dd class="mt-1 text-[14px] font-semibold text-ink-900">{{ selected.user }}</dd>
          </div>
          <div>
            <dt class="text-[12px] text-ink-500">{{ field('role') }}</dt>
            <dd class="mt-1">
              <span
                class="inline-flex items-center rounded-pill px-2.5 py-1 text-xs font-semibold ring-1 ring-inset"
                :class="ROLE_TONE_CLASSES[ROLE_META[selected.role].tone]"
              >
                {{ roleLabel(selected.role) }}
              </span>
            </dd>
          </div>
          <div>
            <dt class="text-[12px] text-ink-500">{{ t('cfg.moduleAndAction') }}</dt>
            <dd class="mt-1 text-[14px] font-semibold text-ink-900">
              {{ moduleLabel(selected.module) }} • {{ actionLabel(selected.action) }}
            </dd>
          </div>
          <div>
            <dt class="text-[12px] text-ink-500">{{ field('object') }}</dt>
            <dd class="mt-1 text-[14px] font-semibold text-ink-900">{{ say(selected.object) }}</dd>
          </div>
          <div>
            <dt class="text-[12px] text-ink-500">{{ field('ip') }}</dt>
            <dd class="tabular mt-1 text-[14px] font-semibold text-ink-900">{{ selected.ip }}</dd>
          </div>
          <div>
            <dt class="text-[12px] text-ink-500">{{ field('result') }}</dt>
            <dd class="mt-1">
              <span
                class="inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs font-semibold ring-1 ring-inset"
                :class="
                  selected.result === 'SUCCESS'
                    ? 'bg-ok-50 text-ok-700 ring-ok-100'
                    : 'bg-danger-50 text-danger-700 ring-danger-100'
                "
              >
                <UiIcon :name="selected.result === 'SUCCESS' ? 'check' : 'x'" :size="13" />
                {{ resultLabel(selected.result) }}
              </span>
            </dd>
          </div>
        </dl>

        <p class="mt-4 rounded-field bg-ink-50 px-4 py-3 text-[13px] leading-relaxed text-ink-700">
          {{ t(selected.detail) }}
        </p>

        <div class="mt-5">
          <p class="text-[13px] font-semibold text-ink-700">{{ t('cfg.diffTitle') }}</p>

          <p v-if="!selected.diff.length" class="mt-2 text-[13px] text-ink-500">
            {{ t('cfg.diffEmpty') }}
          </p>

          <ul v-else class="mt-2.5 space-y-2.5">
            <li
              v-for="d in selected.diff"
              :key="say(d.field)"
              class="rounded-field ring-1 ring-ink-200"
            >
              <p class="border-b border-ink-100 px-4 py-2 text-[13px] font-semibold text-ink-700">
                {{ say(d.field) }}
              </p>
              <div class="grid gap-px bg-ink-100 sm:grid-cols-2">
                <div class="bg-danger-50 px-4 py-3">
                  <p class="flex items-center gap-1.5 text-[12px] font-semibold text-danger-700">
                    <UiIcon name="arrowDown" :size="13" />
                    {{ t('cfg.previousValue') }}
                  </p>
                  <p class="mt-1 text-[13px] text-ink-800">{{ say(d.before) }}</p>
                </div>
                <div class="bg-ok-50 px-4 py-3">
                  <p class="flex items-center gap-1.5 text-[12px] font-semibold text-ok-700">
                    <UiIcon name="arrowUp" :size="13" />
                    {{ t('cfg.newValue') }}
                  </p>
                  <p class="mt-1 text-[13px] text-ink-800">{{ say(d.after) }}</p>
                </div>
              </div>
            </li>
          </ul>
        </div>

        <p class="mt-5 flex items-start gap-2 rounded-field bg-ink-50 px-3.5 py-3 text-[12px] text-ink-600">
          <UiIcon name="lock" :size="15" class="mt-0.5 shrink-0" />
          {{ t('cfg.auditImmutable') }}
        </p>
      </template>

      <template #footer>
        <UiButton variant="ghost" @click="detailOpen = false">{{ t('common.close') }}</UiButton>
        <UiButton variant="secondary" @click="exportFromDetail">
          <UiIcon name="download" :size="16" />
          {{ t('common.export') }}
        </UiButton>
      </template>
    </UiModal>

    <UiModal v-model="exportOpen" :title="t('cfg.exportAuditTitle')" size="sm">
      <p class="text-[14px] leading-relaxed text-ink-700">
        {{
          t('cfg.exportAuditText', {
            n: filtered.length,
            range: `${dateShort(fromDate)} – ${dateShort(toDate)}`,
          })
        }}
      </p>

      <div class="mt-4">
        <p class="mb-2 text-[13px] font-semibold text-ink-700">{{ field('format') }}</p>
        <div class="flex gap-2">
          <button
            v-for="f in ['CSV', 'DOCX']"
            :key="f"
            type="button"
            class="inline-flex items-center gap-2 rounded-field px-4 py-2.5 text-[13px] font-semibold ring-1 ring-inset transition-colors"
            :class="
              exportFormat === f
                ? 'bg-brand-50 text-brand-700 ring-brand-300'
                : 'bg-white text-ink-600 ring-ink-200 hover:ring-ink-300'
            "
            @click="exportFormat = f"
          >
            <UiIcon :name="exportFormat === f ? 'check' : 'doc'" :size="15" />
            {{ f }}
          </button>
        </div>
      </div>

      <template #footer>
        <UiButton variant="ghost" @click="exportOpen = false">{{ t('common.cancel') }}</UiButton>
        <UiButton @click="confirmExport">{{ t('common.exportAction') }}</UiButton>
      </template>
    </UiModal>
  </main>
</template>
