<script setup lang="ts">
type IntegrationStatus = 'CONNECTED' | 'DISCONNECTED' | 'ERROR'

/** Ekranga chiqadigan matn: lug‘at kaliti yoki tarjima qilinmaydigan qiymat */
interface Phrase {
  k?: string
  p?: Record<string, unknown>
  s?: string
}

interface Integration {
  id: string
  nameKey: string
  captionKey: string
  icon: string
  status: IntegrationStatus
  enabled: boolean
  endpoint: string
  keyTail: string
  keyPrefix: string
  timeout: number
  retries: number
  lastCheck: Phrase
  responseMs: number
  steps: string[]
  failKey: string
}

interface CheckStep {
  label: string
  state: 'wait' | 'run' | 'done' | 'fail'
}

interface CheckState {
  phase: 'running' | 'ok' | 'fail'
  steps: CheckStep[]
  message: string
}

interface ApiKey {
  id: string
  nameKey?: string
  name: string
  prefix: string
  tail: string
  scope: string
  createdAt: string
  lastUsed: Phrase
  status: 'ACTIVE' | 'REVOKED'
}

interface Webhook {
  id: string
  url: string
  eventKey: string
  active: boolean
  lastCode: number
}

const auth = useAuthStore()
const canAdmin = computed(() => auth.can('system.administer'))

const { t } = useI18n()
const { field, columns: labelColumns } = useAppLabels()

const say = (p: Phrase) => (p.k ? t(p.k, p.p ?? {}) : (p.s ?? ''))

const SETTINGS_TABS = computed(() => [
  { label: t('nav.settingsUsers'), to: '/settings/users', icon: 'users' },
  { label: t('nav.settingsRoles'), to: '/settings/roles', icon: 'shield' },
  { label: t('nav.settingsIntegrations'), to: '/settings/integrations', icon: 'globe' },
  { label: t('nav.settingsReference'), to: '/settings/reference-data', icon: 'layers' },
  { label: t('nav.settingsSystem'), to: '/settings/system', icon: 'gear' },
  { label: t('nav.settingsAudit'), to: '/settings/audit', icon: 'clipboard' },
])
const CURRENT_TAB = '/settings/integrations'

const STATUS_STYLE: Record<
  IntegrationStatus,
  { key: string; badge: string; mark: string; shape: 'check' | 'bar' | 'cross' }
> = {
  CONNECTED: {
    key: 'connection.connected',
    badge: 'bg-ok-50 text-ok-700 ring-ok-100',
    mark: 'text-ok-500',
    shape: 'check',
  },
  DISCONNECTED: {
    key: 'connection.disconnected',
    badge: 'bg-ink-100 text-ink-700 ring-ink-200',
    mark: 'text-ink-400',
    shape: 'bar',
  },
  ERROR: {
    key: 'connection.error',
    badge: 'bg-danger-50 text-danger-700 ring-danger-100',
    mark: 'text-danger-500',
    shape: 'cross',
  },
}

const STATUS_META = computed<
  Record<IntegrationStatus, { label: string; badge: string; mark: string; shape: string }>
>(() => ({
  CONNECTED: { ...STATUS_STYLE.CONNECTED, label: t(STATUS_STYLE.CONNECTED.key) },
  DISCONNECTED: { ...STATUS_STYLE.DISCONNECTED, label: t(STATUS_STYLE.DISCONNECTED.key) },
  ERROR: { ...STATUS_STYLE.ERROR, label: t(STATUS_STYLE.ERROR.key) },
}))

const intName = (i: Integration | null | undefined) => (i ? t(i.nameKey) : '')

const integrations = ref<Integration[]>([
  {
    id: 'soliq',
    nameKey: 'cfg.intSoliq',
    captionKey: 'cfg.intSoliqCaption',
    icon: 'doc',
    status: 'DISCONNECTED',
    enabled: false,
    endpoint: 'https://api.soliq.uz/v2/invoice',
    keyPrefix: 'slq_live',
    keyTail: '9c30',
    timeout: 45,
    retries: 2,
    lastCheck: { s: '28.04.2025 16:20' },
    responseMs: 0,
    steps: ['cfg.stepChannelOpen', 'cfg.stepStirCheck', 'cfg.stepInvoiceFormat'],
    failKey: '',
  },
  {
    id: 'bank',
    nameKey: 'cfg.intBank',
    captionKey: 'cfg.intBankCaption',
    icon: 'wallet',
    status: 'ERROR',
    enabled: true,
    endpoint: 'https://pay.makon.uz/v1/gateway',
    keyPrefix: 'bnk_live',
    keyTail: '71ad',
    timeout: 20,
    retries: 4,
    lastCheck: { k: 'cfg.todayAt', p: { time: '07:44' } },
    responseMs: 0,
    steps: ['cfg.stepGatewayConnect', 'cfg.stepMerchantId', 'cfg.stepPayChannelState'],
    failKey: 'cfg.failMerchant',
  },
  {
    id: 'sms',
    nameKey: 'cfg.intSms',
    captionKey: 'cfg.intSmsCaption',
    icon: 'send',
    status: 'DISCONNECTED',
    enabled: false,
    endpoint: 'https://sms.makon.uz/v1/message',
    keyPrefix: 'sms_live',
    keyTail: '2e58',
    timeout: 15,
    retries: 2,
    lastCheck: { s: '12.04.2025 11:05' },
    responseMs: 0,
    steps: ['cfg.stepProviderConnect', 'cfg.stepSenderName', 'cfg.stepBalanceLimit'],
    failKey: '',
  },
  {
    id: 'smtp',
    nameKey: 'cfg.intSmtp',
    captionKey: 'cfg.intSmtpCaption',
    icon: 'doc',
    status: 'DISCONNECTED',
    enabled: false,
    endpoint: 'smtp.makon.uz:587',
    keyPrefix: 'smtp_live',
    keyTail: '6d14',
    timeout: 25,
    retries: 3,
    lastCheck: { s: '05.05.2025 08:30' },
    responseMs: 0,
    steps: ['cfg.stepSmtpConnect', 'cfg.stepTls', 'cfg.stepSenderAddress'],
    failKey: '',
  },
  {
    id: 'telegram',
    nameKey: 'cfg.intTelegram',
    captionKey: 'cfg.intTelegramCaption',
    icon: 'bell',
    status: 'CONNECTED',
    enabled: true,
    endpoint: 'https://bot.makon.uz/v1/notify',
    keyPrefix: 'tgm_live',
    keyTail: '8f02',
    timeout: 10,
    retries: 2,
    lastCheck: { k: 'cfg.todayAt', p: { time: '09:02' } },
    responseMs: 148,
    steps: ['cfg.stepChannelConnect', 'cfg.stepChannelMembership', 'cfg.stepSendRight'],
    failKey: '',
  },
])

const checks = ref<Record<string, CheckState>>({})
let timers: ReturnType<typeof setTimeout>[] = []

function maskedKey(prefix: string, tail: string) {
  return `${prefix}_••••••••${tail}`
}

function runCheck(item: Integration) {
  if (!item.enabled) return
  const willFail = item.status === 'ERROR'
  const steps: CheckStep[] = item.steps.map((label, idx) => ({
    label,
    state: idx === 0 ? 'run' : 'wait',
  }))
  checks.value[item.id] = { phase: 'running', steps, message: '' }

  item.steps.forEach((_, idx) => {
    timers.push(
      setTimeout(
        () => {
          const c = checks.value[item.id]
          if (!c) return
          const last = idx === item.steps.length - 1
          if (last && willFail) {
            c.steps[idx]!.state = 'fail'
            c.phase = 'fail'
            c.message = item.failKey
            item.lastCheck = { k: 'common.justNow' }
            item.responseMs = 0
            return
          }
          c.steps[idx]!.state = 'done'
          if (!last) {
            c.steps[idx + 1]!.state = 'run'
            return
          }
          c.phase = 'ok'
          c.message = 'cfg.checkOk'
          item.status = 'CONNECTED'
          item.lastCheck = { k: 'common.justNow' }
          item.responseMs = 120 + item.timeout * 3
        },
        650 * (idx + 1),
      ),
    )
  })
}

const configId = ref('')
const configOpen = ref(false)
const configEndpoint = ref('')
const configKey = ref('')
const configTimeout = ref(30)
const configRetries = ref(3)
const configShowKey = ref(false)
const configError = ref('')

const configTarget = computed(() => integrations.value.find((i) => i.id === configId.value) ?? null)

function openConfig(item: Integration) {
  configId.value = item.id
  configEndpoint.value = item.endpoint
  configKey.value = ''
  configTimeout.value = item.timeout
  configRetries.value = item.retries
  configShowKey.value = false
  configError.value = ''
  configOpen.value = true
}

function saveConfig() {
  const target = configTarget.value
  if (!target) return
  if (!configEndpoint.value.trim()) {
    configError.value = t('cfg.endpointRequired')
    return
  }
  const timeout = Number(configTimeout.value)
  const retries = Number(configRetries.value)
  if (!timeout || timeout < 5 || timeout > 180) {
    configError.value = t('cfg.timeoutRange')
    return
  }
  if (retries < 0 || retries > 9) {
    configError.value = t('cfg.retriesRange')
    return
  }
  target.endpoint = configEndpoint.value.trim()
  target.timeout = timeout
  target.retries = retries
  const entered = configKey.value.trim()
  if (entered.length >= 4) {
    target.keyTail = entered.slice(-4)
    if (target.status === 'ERROR') target.status = 'DISCONNECTED'
  }
  checks.value[target.id] = {
    phase: 'ok',
    steps: [],
    message: 'cfg.configSaved',
  }
  target.lastCheck = { k: 'common.justNow' }
  configOpen.value = false
  configError.value = ''
}

const toggleId = ref('')
const toggleOpen = ref(false)

const toggleTarget = computed(() => integrations.value.find((i) => i.id === toggleId.value) ?? null)

function askToggle(item: Integration) {
  toggleId.value = item.id
  toggleOpen.value = true
}

function confirmToggle() {
  const target = toggleTarget.value
  if (!target) return
  target.enabled = !target.enabled
  if (!target.enabled) {
    target.status = 'DISCONNECTED'
    target.responseMs = 0
    delete checks.value[target.id]
  } else {
    checks.value[target.id] = {
      phase: 'ok',
      steps: [],
      message: 'cfg.integrationEnabled',
    }
  }
  target.lastCheck = { k: 'common.justNow' }
  toggleOpen.value = false
}

const keys = ref<ApiKey[]>([
  {
    id: 'k-01',
    nameKey: 'cfg.keyPortal',
    name: 'Portal integratsiyasi',
    prefix: 'mk_live',
    tail: '3f8a',
    scope: 'To‘liq huquq',
    createdAt: '2026-04-16',
    lastUsed: { k: 'cfg.todayAt', p: { time: '09:41' } },
    status: 'ACTIVE',
  },
  {
    id: 'k-02',
    nameKey: 'cfg.keyAccounting',
    name: 'Buxgalteriya eksporti',
    prefix: 'mk_live',
    tail: 'c204',
    scope: 'Faqat o‘qish',
    createdAt: '2026-05-06',
    lastUsed: { k: 'cfg.yesterdayAt', p: { time: '18:05' } },
    status: 'ACTIVE',
  },
  {
    id: 'k-03',
    nameKey: 'cfg.mobileApp',
    name: 'Mobil ilova',
    prefix: 'mk_live',
    tail: '9b71',
    scope: 'To‘liq huquq',
    createdAt: '2026-02-22',
    lastUsed: { s: '02.08.2026' },
    status: 'ACTIVE',
  },
  {
    id: 'k-04',
    nameKey: 'cfg.keyLegacyReports',
    name: 'Eski hisobot moduli',
    prefix: 'mk_live',
    tail: '10e6',
    scope: 'Faqat o‘qish',
    createdAt: '2025-11-09',
    lastUsed: { s: '20.05.2026' },
    status: 'REVOKED',
  },
])

const keyName = (k: { nameKey?: string; name: string }) => (k.nameKey ? t(k.nameKey) : k.name)

const keyColumns = computed(() =>
  labelColumns([
    { key: 'name', field: 'name' },
    { key: 'masked', field: 'prefix', width: '210px' },
    { key: 'scope', field: 'scope' },
    { key: 'createdAt', field: 'createdAt', width: '130px' },
    { key: 'lastUsed', field: 'lastUsed', width: '160px' },
    { key: 'status', field: 'status', width: '150px' },
    { key: 'action', field: 'action', align: 'right', width: '140px' },
  ]),
)

const keyRows = computed(() =>
  keys.value.map((k) => ({ ...k, label: keyName(k), masked: maskedKey(k.prefix, k.tail) })),
)

/** Amal doirasi qiymati o‘zgarmaydi, faqat ko‘rinadigan nomi tarjima qilinadi */
const SCOPE_KEY: Record<string, string> = {
  'To‘liq huquq': 'cfg.scopeFull',
  'Faqat o‘qish': 'cfg.scopeReadOnly',
}

const scopeLabel = (value: string) => t(SCOPE_KEY[value] ?? 'cfg.scopeFull')

const SCOPE_OPTIONS = computed(() =>
  Object.keys(SCOPE_KEY).map((value) => ({ value, label: scopeLabel(value) })),
)

const newKeyOpen = ref(false)
const newKeyName = ref('')
const newKeyScope = ref(SCOPE_OPTIONS.value[0]!.value)
const newKeyError = ref('')

const issuedOpen = ref(false)
const issuedValue = ref('')
const issuedName = ref('')
const copied = ref(false)
let copyTimer: ReturnType<typeof setTimeout> | undefined

function openNewKey() {
  newKeyName.value = ''
  newKeyScope.value = SCOPE_OPTIONS.value[0]!.value
  newKeyError.value = ''
  newKeyOpen.value = true
}

function freshTail() {
  return Math.floor(Math.random() * 0xffff)
    .toString(16)
    .padStart(4, '0')
}

function createKey() {
  if (!newKeyName.value.trim()) {
    newKeyError.value = t('cfg.keyNameRequired')
    return
  }
  const tail = freshTail()
  const seq = keys.value.length + 1
  keys.value.unshift({
    id: `k-${String(seq).padStart(2, '0')}-${tail}`,
    name: newKeyName.value.trim(),
    prefix: 'mk_live',
    tail,
    scope: newKeyScope.value,
    createdAt: '2026-08-18',
    lastUsed: { k: 'cfg.neverUsed' },
    status: 'ACTIVE',
  })
  issuedName.value = newKeyName.value.trim()
  issuedValue.value = `mk_live_••••••••••••${tail}`
  newKeyOpen.value = false
  copied.value = false
  issuedOpen.value = true
}

async function copyIssued() {
  if (import.meta.client && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(issuedValue.value).catch(() => undefined)
  }
  copied.value = true
  if (copyTimer) clearTimeout(copyTimer)
  copyTimer = setTimeout(() => (copied.value = false), 2200)
}

const revokeId = ref('')
const revokeOpen = ref(false)

const revokeTarget = computed(() => keys.value.find((k) => k.id === revokeId.value) ?? null)

function askRevoke(id: string) {
  revokeId.value = id
  revokeOpen.value = true
}

function confirmRevoke() {
  const target = revokeTarget.value
  if (!target) return
  target.status = 'REVOKED'
  revokeOpen.value = false
}

const webhooks = ref<Webhook[]>([
  {
    id: 'wh-01',
    url: 'https://portal.makon.uz/hooks/invoice',
    eventKey: 'cfg.hookInvoicePaid',
    active: true,
    lastCode: 200,
  },
  {
    id: 'wh-02',
    url: 'https://portal.makon.uz/hooks/contract',
    eventKey: 'cfg.hookContractSigned',
    active: true,
    lastCode: 200,
  },
  {
    id: 'wh-03',
    url: 'https://crm.makon.uz/hooks/application',
    eventKey: 'cfg.hookApplicationReceived',
    active: true,
    lastCode: 200,
  },
  {
    id: 'wh-04',
    url: 'https://crm.makon.uz/hooks/service',
    eventKey: 'cfg.hookServiceClosed',
    active: false,
    lastCode: 0,
  },
])

interface ProbeResult {
  phase: 'sending' | 'done'
  code: number
  ms: number
  body: string
}

const probes = ref<Record<string, ProbeResult>>({})

function probeWebhook(w: Webhook) {
  probes.value[w.id] = { phase: 'sending', code: 0, ms: 0, body: '' }
  timers.push(
    setTimeout(() => {
      const ms = 90 + w.url.length * 3
      const code = w.active ? 200 : 503
      w.lastCode = code
      probes.value[w.id] = {
        phase: 'done',
        code,
        ms,
        body: w.active
          ? `{ "qabul_qilindi": true, "hodisa": "${t(w.eventKey)}", "kechikish_ms": ${ms} }`
          : `{ "qabul_qilindi": false, "sabab": "${t('cfg.webhookStopped')}" }`,
      }
    }, 900),
  )
}

function toggleWebhook(w: Webhook) {
  w.active = !w.active
  if (!w.active) w.lastCode = 0
  delete probes.value[w.id]
}

onBeforeUnmount(() => {
  timers.forEach(clearTimeout)
  timers = []
  if (copyTimer) clearTimeout(copyTimer)
})

const connectedCount = computed(
  () => integrations.value.filter((i) => i.status === 'CONNECTED').length,
)
const errorCount = computed(() => integrations.value.filter((i) => i.status === 'ERROR').length)
const activeKeys = computed(() => keys.value.filter((k) => k.status === 'ACTIVE').length)
const activeHooks = computed(() => webhooks.value.filter((w) => w.active).length)
</script>

<template>
  <AppTopbar
    :title="t('nav.settingsIntegrations')"
    :subtitle="t('cfg.integrationsCaption')"
    :breadcrumb="[
      { label: t('nav.settings'), to: '/settings/users' },
      { label: t('nav.settingsIntegrations') },
    ]"
  >
    <template #actions>
      <span
        class="hidden items-center gap-2 rounded-pill bg-brand-50 px-3 py-1.5 text-[13px] font-semibold text-brand-700 ring-1 ring-inset ring-brand-200 lg:inline-flex"
      >
        <UiIcon name="globe" :size="15" />
        {{ t('cfg.connectedOf', { n: connectedCount, total: integrations.length }) }}
      </span>
      <UiButton v-if="canAdmin" size="sm" @click="openNewKey">
        <UiIcon name="key" :size="16" />
        {{ t('cfg.newKey') }}
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
      v-if="!canAdmin"
      class="flex flex-wrap items-center gap-3 rounded-card bg-ink-50 px-4 py-3 text-[13px] text-ink-600 ring-1 ring-ink-200"
    >
      <UiIcon name="lock" :size="17" class="shrink-0" />
      <span class="min-w-0 flex-1">{{ t('cfg.adminOnlyNote') }}</span>
    </div>

    <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <UiKpi
        :label="t('cfg.kpiConnected')"
        :value="String(connectedCount)"
        :unit="t('unitOf.pcs')"
        icon="check"
        tone="ok"
      />
      <UiKpi
        :label="t('cfg.kpiWithError')"
        :value="String(errorCount)"
        :unit="t('unitOf.pcs')"
        icon="warning"
        tone="danger"
      />
      <UiKpi
        :label="t('cfg.kpiActiveKeys')"
        :value="String(activeKeys)"
        :unit="t('unitOf.pcs')"
        icon="key"
        tone="brand"
      />
      <UiKpi
        :label="t('cfg.kpiActiveHooks')"
        :value="String(activeHooks)"
        :unit="t('unitOf.pcs')"
        icon="send"
        tone="violet"
      />
    </section>

    <section class="grid gap-5 lg:grid-cols-2 2xl:grid-cols-3">
      <UiCard
        v-for="item in integrations"
        :key="item.id"
        :title="intName(item)"
        :subtitle="t(item.captionKey)"
      >
        <template #actions>
          <span
            class="inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs font-semibold ring-1 ring-inset"
            :class="STATUS_META[item.status].badge"
          >
            <svg
              class="size-3 shrink-0"
              :class="STATUS_META[item.status].mark"
              viewBox="0 0 12 12"
              fill="none"
              aria-hidden="true"
            >
              <path
                v-if="STATUS_META[item.status].shape === 'check'"
                d="M2.6 6.3 5 8.7l4.4-5"
                stroke="currentColor"
                stroke-width="1.9"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <path
                v-else-if="STATUS_META[item.status].shape === 'cross'"
                d="M3.2 3.2l5.6 5.6M8.8 3.2l-5.6 5.6"
                stroke="currentColor"
                stroke-width="1.9"
                stroke-linecap="round"
              />
              <rect v-else x="1.8" y="4.6" width="8.4" height="2.8" rx="1.4" fill="currentColor" />
            </svg>
            {{ STATUS_META[item.status].label }}
          </span>
        </template>

        <div class="flex items-start gap-3">
          <span
            class="grid size-10 shrink-0 place-items-center rounded-[12px]"
            :class="item.enabled ? 'bg-brand-50 text-brand-600' : 'bg-ink-100 text-ink-500'"
          >
            <UiIcon :name="item.icon" :size="19" />
          </span>
          <dl class="min-w-0 flex-1 space-y-2 text-[13px]">
            <div class="flex items-start justify-between gap-3">
              <dt class="shrink-0 text-ink-500">Endpoint</dt>
              <dd class="tabular min-w-0 truncate text-right font-semibold text-ink-900">
                {{ item.endpoint }}
              </dd>
            </div>
            <div class="flex items-start justify-between gap-3">
              <dt class="shrink-0 text-ink-500">{{ t('cfg.key') }}</dt>
              <dd class="tabular min-w-0 truncate text-right font-semibold text-ink-700">
                {{ maskedKey(item.keyPrefix, item.keyTail) }}
              </dd>
            </div>
            <div class="flex items-start justify-between gap-3">
              <dt class="shrink-0 text-ink-500">{{ t('cfg.lastCheck') }}</dt>
              <dd class="tabular text-right font-semibold text-ink-900">
                {{ say(item.lastCheck) }}
              </dd>
            </div>
            <div class="flex items-start justify-between gap-3">
              <dt class="shrink-0 text-ink-500">{{ t('cfg.responseTime') }}</dt>
              <dd class="tabular text-right font-semibold text-ink-900">
                {{ item.responseMs ? `${item.responseMs} ms` : '-' }}
              </dd>
            </div>
            <div class="flex items-start justify-between gap-3">
              <dt class="shrink-0 text-ink-500">{{ t('cfg.timeoutRetries') }}</dt>
              <dd class="tabular text-right font-semibold text-ink-700">
                {{ t('cfg.timeoutRetriesValue', { t: item.timeout, r: item.retries }) }}
              </dd>
            </div>
          </dl>
        </div>

        <ul v-if="checks[item.id]?.steps.length" class="mt-3 space-y-1.5 border-t border-ink-100 pt-3">
          <li
            v-for="s in checks[item.id]!.steps"
            :key="s.label"
            class="flex items-center gap-2 text-[13px]"
            :class="
              s.state === 'done'
                ? 'text-ok-700'
                : s.state === 'fail'
                  ? 'text-danger-700'
                  : s.state === 'run'
                    ? 'text-brand-700'
                    : 'text-ink-500'
            "
          >
            <UiIcon
              :name="
                s.state === 'done'
                  ? 'check'
                  : s.state === 'fail'
                    ? 'x'
                    : s.state === 'run'
                      ? 'refresh'
                      : 'clock'
              "
              :size="14"
            />
            {{ t(s.label) }}
          </li>
        </ul>

        <p
          v-if="checks[item.id] && checks[item.id]!.phase !== 'running' && checks[item.id]!.message"
          class="mt-3 flex items-start gap-2 rounded-field px-3 py-2.5 text-[13px]"
          :class="
            checks[item.id]!.phase === 'fail'
              ? 'bg-danger-50 text-danger-700'
              : 'bg-ok-50 text-ok-700'
          "
        >
          <UiIcon
            :name="checks[item.id]!.phase === 'fail' ? 'warning' : 'check'"
            :size="15"
            class="mt-0.5 shrink-0"
          />
          {{ t(checks[item.id]!.message) }}
        </p>

        <p
          v-else-if="item.status === 'ERROR' && !checks[item.id] && item.failKey"
          class="mt-3 flex items-start gap-2 rounded-field bg-danger-50 px-3 py-2.5 text-[13px] text-danger-700"
        >
          <UiIcon name="warning" :size="15" class="mt-0.5 shrink-0" />
          {{ t(item.failKey) }}
        </p>

        <div v-if="canAdmin" class="mt-4 grid gap-2.5">
          <UiButton
            variant="secondary"
            size="sm"
            block
            :disabled="!item.enabled || checks[item.id]?.phase === 'running'"
            @click="runCheck(item)"
          >
            <UiIcon :name="checks[item.id]?.phase === 'running' ? 'refresh' : 'send'" :size="15" />
            {{
              checks[item.id]?.phase === 'running'
                ? t('common.checking')
                : t('cfg.checkConnection')
            }}
          </UiButton>

          <UiButton variant="ghost" size="sm" block @click="openConfig(item)">
            <UiIcon name="gear" :size="15" />
            {{ t('cfg.configure') }}
          </UiButton>
          <UiButton
            :variant="item.enabled ? 'danger' : 'success'"
            size="sm"
            block
            @click="askToggle(item)"
          >
            <UiIcon :name="item.enabled ? 'x' : 'check'" :size="15" />
            {{ item.enabled ? t('cfg.turnOff') : t('cfg.turnOn') }}
          </UiButton>

          <p v-if="!item.enabled" class="text-center text-[12px] text-ink-500">
            {{ t('cfg.disabledHint') }}
          </p>
        </div>

        <p
          v-else
          class="mt-4 rounded-field bg-ink-50 px-3 py-2.5 text-center text-[12px] text-ink-500"
        >
          {{ t('cfg.adminActionsOnly') }}
        </p>
      </UiCard>
    </section>

    <UiCard
      :title="t('cfg.apiKeys')"
      :subtitle="t('cfg.keysSummary', { active: activeKeys, total: keys.length })"
      flush
      :padded="false"
    >
      <template #actions>
        <UiButton v-if="canAdmin" size="sm" @click="openNewKey">
          <UiIcon name="plus" :size="16" />
          {{ t('cfg.newKey') }}
        </UiButton>
      </template>

      <UiTable :columns="keyColumns" :rows="keyRows" :empty="t('empty.noApiKeys')">
        <template #cell-name="{ row }">
          <span class="font-semibold text-ink-900">{{ row.label }}</span>
        </template>

        <template #cell-scope="{ row }">
          <span class="text-[13px] text-ink-700">{{ scopeLabel(row.scope) }}</span>
        </template>

        <template #cell-masked="{ row }">
          <span class="tabular text-[13px] text-ink-700">{{ row.masked }}</span>
        </template>

        <template #cell-createdAt="{ row }">
          <span class="tabular">{{ row.createdAt }}</span>
        </template>

        <template #cell-lastUsed="{ row }">
          <span class="tabular text-[13px]">{{ say(row.lastUsed) }}</span>
        </template>

        <template #cell-status="{ row }">
          <span
            class="inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs font-semibold ring-1 ring-inset"
            :class="
              row.status === 'ACTIVE'
                ? 'bg-ok-50 text-ok-700 ring-ok-100'
                : 'bg-ink-100 text-ink-700 ring-ink-200'
            "
          >
            <svg
              class="size-3 shrink-0"
              :class="row.status === 'ACTIVE' ? 'text-ok-500' : 'text-ink-400'"
              viewBox="0 0 12 12"
              fill="none"
              aria-hidden="true"
            >
              <path
                v-if="row.status === 'ACTIVE'"
                d="M2.6 6.3 5 8.7l4.4-5"
                stroke="currentColor"
                stroke-width="1.9"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <path
                v-else
                d="M3.2 3.2l5.6 5.6M8.8 3.2l-5.6 5.6"
                stroke="currentColor"
                stroke-width="1.9"
                stroke-linecap="round"
              />
            </svg>
            {{ row.status === 'ACTIVE' ? t('common.active') : t('cfg.revoked') }}
          </span>
        </template>

        <template #cell-action="{ row }">
          <UiButton
            v-if="canAdmin && row.status === 'ACTIVE'"
            variant="ghost"
            size="sm"
            @click="askRevoke(row.id)"
          >
            <UiIcon name="trash" :size="15" />
            {{ t('cfg.revoke') }}
          </UiButton>
          <span v-else class="text-[12px] text-ink-400">-</span>
        </template>
      </UiTable>

      <div class="border-t border-ink-200 bg-surface-sunken px-5 py-3.5 text-[13px] text-ink-600">
        {{ t('cfg.keyValueNote') }}
      </div>
    </UiCard>

    <UiCard
      :title="t('cfg.webhooks')"
      :subtitle="t('cfg.activeChannels', { n: activeHooks })"
      flush
      :padded="false"
    >
      <ul class="divide-y divide-ink-100">
        <li v-for="w in webhooks" :key="w.id" class="px-5 py-4">
          <div class="flex flex-wrap items-start gap-3">
            <span
              class="grid size-9 shrink-0 place-items-center rounded-[10px]"
              :class="w.active ? 'bg-brand-50 text-brand-600' : 'bg-ink-100 text-ink-500'"
            >
              <UiIcon name="send" :size="17" />
            </span>

            <span class="min-w-0 flex-1">
              <span class="tabular block truncate text-[14px] font-semibold text-ink-900">
                {{ w.url }}
              </span>
              <span class="block truncate text-[12px] text-ink-500">
                {{ t('cfg.eventLabel', { event: t(w.eventKey) }) }}
              </span>
            </span>

            <span
              class="inline-flex shrink-0 items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs font-semibold ring-1 ring-inset"
              :class="
                w.active ? 'bg-ok-50 text-ok-700 ring-ok-100' : 'bg-ink-100 text-ink-700 ring-ink-200'
              "
            >
              <svg
                class="size-3 shrink-0"
                :class="w.active ? 'text-ok-500' : 'text-ink-400'"
                viewBox="0 0 12 12"
                fill="none"
                aria-hidden="true"
              >
                <circle v-if="w.active" cx="6" cy="6" r="4" fill="currentColor" />
                <rect v-else x="1.8" y="4.6" width="8.4" height="2.8" rx="1.4" fill="currentColor" />
              </svg>
              {{ w.active ? t('common.active') : t('status.listing.PAUSED') }}
            </span>

            <span
              v-if="w.lastCode"
              class="tabular shrink-0 rounded-pill bg-ink-100 px-2.5 py-1 text-[12px] font-semibold text-ink-700"
            >
              HTTP {{ w.lastCode }}
            </span>

            <span
              v-if="canAdmin"
              class="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0"
            >
              <UiButton
                variant="secondary"
                size="sm"
                :disabled="probes[w.id]?.phase === 'sending'"
                @click="probeWebhook(w)"
              >
                <UiIcon name="send" :size="15" />
                {{
                  probes[w.id]?.phase === 'sending' ? t('cfg.sending') : t('cfg.sendTestRequest')
                }}
              </UiButton>
              <UiButton variant="ghost" size="sm" @click="toggleWebhook(w)">
                {{ w.active ? t('cfg.pause') : t('cfg.activate') }}
              </UiButton>
            </span>
          </div>

          <div
            v-if="probes[w.id]"
            class="mt-3 overflow-hidden rounded-field ring-1 ring-ink-200"
          >
            <div
              class="flex flex-wrap items-center justify-between gap-2 border-b border-ink-200 px-3.5 py-2.5"
              :class="
                probes[w.id]!.phase === 'sending'
                  ? 'bg-surface-sunken'
                  : probes[w.id]!.code === 200
                    ? 'bg-ok-50'
                    : 'bg-danger-50'
              "
            >
              <span
                class="inline-flex items-center gap-1.5 text-[13px] font-semibold"
                :class="
                  probes[w.id]!.phase === 'sending'
                    ? 'text-ink-600'
                    : probes[w.id]!.code === 200
                      ? 'text-ok-700'
                      : 'text-danger-700'
                "
              >
                <UiIcon
                  :name="
                    probes[w.id]!.phase === 'sending'
                      ? 'refresh'
                      : probes[w.id]!.code === 200
                        ? 'check'
                        : 'warning'
                  "
                  :size="14"
                />
                {{
                  probes[w.id]!.phase === 'sending'
                    ? t('cfg.requestSending')
                    : t('cfg.responseHttp', { code: probes[w.id]!.code })
                }}
              </span>
              <span
                v-if="probes[w.id]!.phase === 'done'"
                class="tabular text-[12px] text-ink-600"
              >
                {{ probes[w.id]!.ms }} ms
              </span>
            </div>
            <pre
              v-if="probes[w.id]!.phase === 'done'"
              class="scroll-slim overflow-x-auto bg-ink-900 px-3.5 py-3 text-[12px] leading-relaxed text-ink-100"
            >{{ probes[w.id]!.body }}</pre>
          </div>
        </li>
      </ul>

      <div class="border-t border-ink-200 bg-surface-sunken px-5 py-3.5 text-[13px] text-ink-600">
        {{ t('cfg.testRequestNote') }}
      </div>
    </UiCard>
  </main>

  <UiModal
    v-model="configOpen"
    :title="
      configTarget
        ? t('cfg.integrationSettingsOf', { name: intName(configTarget) })
        : t('cfg.integrationSettings')
    "
    :subtitle="t('cfg.configCaption')"
  >
    <div class="space-y-4">
      <UiField :label="t('cfg.endpointAddress')" required>
        <UiInput v-model="configEndpoint" />
      </UiField>

      <UiField
        :label="t('cfg.secretKey')"
        :hint="
          configTarget
            ? t('cfg.currentKeyHint', {
                key: maskedKey(configTarget.keyPrefix, configTarget.keyTail),
              })
            : ''
        "
      >
        <div class="flex items-center gap-2">
          <UiInput
            v-model="configKey"
            :type="configShowKey ? 'text' : 'password'"
            :placeholder="t('cfg.enterNewKey')"
            class="min-w-0 flex-1"
          />
          <button
            type="button"
            class="grid size-11 shrink-0 place-items-center rounded-field text-ink-500 ring-1 ring-inset ring-ink-200 transition-colors hover:text-brand-600 hover:ring-brand-300"
            :aria-label="configShowKey ? t('cfg.hideKey') : t('cfg.showKey')"
            @click="configShowKey = !configShowKey"
          >
            <UiIcon :name="configShowKey ? 'x' : 'eye'" :size="18" />
          </button>
        </div>
      </UiField>

      <div class="grid gap-4 sm:grid-cols-2">
        <UiField label="Timeout" required :hint="t('cfg.hintSeconds')">
          <UiInput v-model="configTimeout" type="number" />
        </UiField>
        <UiField :label="t('cfg.retriesCount')" required :hint="t('cfg.hintZeroToNine')">
          <UiInput v-model="configRetries" type="number" />
        </UiField>
      </div>

      <p v-if="configError" class="text-[13px] font-medium text-danger-600">{{ configError }}</p>
    </div>

    <template #footer>
      <UiButton variant="ghost" @click="configOpen = false">{{ t('common.cancel') }}</UiButton>
      <UiButton @click="saveConfig">
        <UiIcon name="check" :size="16" />
        {{ t('common.save') }}
      </UiButton>
    </template>
  </UiModal>

  <UiModal
    v-model="toggleOpen"
    :title="toggleTarget?.enabled ? t('cfg.disableIntegration') : t('cfg.enableIntegration')"
    size="sm"
  >
    <p class="text-[14px] leading-relaxed text-ink-700">
      <template v-if="toggleTarget?.enabled">
        {{ t('cfg.disableIntegrationText', { name: intName(toggleTarget) }) }}
      </template>
      <template v-else>
        {{ t('cfg.enableIntegrationText', { name: intName(toggleTarget) }) }}
      </template>
    </p>

    <template #footer>
      <UiButton variant="ghost" @click="toggleOpen = false">{{ t('common.cancel') }}</UiButton>
      <UiButton :variant="toggleTarget?.enabled ? 'danger' : 'success'" @click="confirmToggle">
        {{ toggleTarget?.enabled ? t('cfg.turnOff') : t('cfg.turnOn') }}
      </UiButton>
    </template>
  </UiModal>

  <UiModal
    v-model="newKeyOpen"
    :title="t('cfg.newApiKey')"
    :subtitle="t('cfg.keyShownOnce')"
  >
    <div class="space-y-4">
      <UiField :label="t('cfg.keyName')" required :error="newKeyError">
        <UiInput v-model="newKeyName" :placeholder="t('cfg.keyNamePlaceholder')" />
      </UiField>
      <UiField :label="field('scope')" required>
        <UiSelect v-model="newKeyScope" :options="SCOPE_OPTIONS" />
      </UiField>
      <i18n-t
        keypath="cfg.keyPrefixNote"
        tag="p"
        scope="global"
        class="rounded-field bg-surface-sunken px-3.5 py-3 text-[13px] text-ink-600"
      >
        <template #prefix><b class="text-ink-900">mk_live</b></template>
      </i18n-t>
    </div>

    <template #footer>
      <UiButton variant="ghost" @click="newKeyOpen = false">{{ t('common.cancel') }}</UiButton>
      <UiButton @click="createKey">
        <UiIcon name="key" :size="16" />
        {{ t('cfg.createKey') }}
      </UiButton>
    </template>
  </UiModal>

  <UiModal
    v-model="issuedOpen"
    :title="t('cfg.keyCreated')"
    :subtitle="t('cfg.keyCopyNow')"
    size="sm"
  >
    <div class="space-y-4">
      <i18n-t keypath="cfg.keyAdded" tag="p" scope="global" class="text-[13px] text-ink-600">
        <template #name><b class="text-ink-900">{{ issuedName }}</b></template>
      </i18n-t>

      <div class="flex items-center gap-2">
        <span
          class="tabular flex h-11 min-w-0 flex-1 items-center overflow-hidden rounded-field bg-ink-50 px-3.5 text-[13px] text-ink-800 ring-1 ring-inset ring-ink-200"
        >
          <span class="truncate">{{ issuedValue }}</span>
        </span>
        <UiButton variant="secondary" @click="copyIssued">
          <UiIcon :name="copied ? 'check' : 'doc'" :size="16" />
          {{ copied ? t('common.copied') : t('common.copy') }}
        </UiButton>
      </div>

      <p class="flex items-start gap-2 rounded-field bg-warn-50 px-3.5 py-3 text-[13px] text-warn-700">
        <UiIcon name="warning" :size="16" class="mt-0.5 shrink-0" />
        {{ t('cfg.keyLostNote') }}
      </p>
    </div>

    <template #footer>
      <UiButton @click="issuedOpen = false">{{ t('tour.done') }}</UiButton>
    </template>
  </UiModal>

  <UiModal v-model="revokeOpen" :title="t('cfg.revokeKey')" size="sm">
    <p class="text-[14px] leading-relaxed text-ink-700">
      {{ t('cfg.revokeKeyText', { name: revokeTarget ? keyName(revokeTarget) : '' }) }}
    </p>
    <template #footer>
      <UiButton variant="ghost" @click="revokeOpen = false">{{ t('common.cancel') }}</UiButton>
      <UiButton variant="danger" @click="confirmRevoke">{{ t('cfg.revokeKey') }}</UiButton>
    </template>
  </UiModal>
</template>
