<script setup lang="ts">
import { LANDLORD_STIR, formatStir, organizationByStir } from '~/data/organizations'
import { USERS } from '~/data/users'
import { saveBlob } from '~/utils/docx'
import { todayIso } from '~/utils/format'

const { t } = useI18n()
const { field } = useAppLabels()

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
const CURRENT_TAB = '/settings/system'

const auth = useAuthStore()

const RESTORE_PHRASE = 'TIKLASH'

/*
 * Kompaniya profili tashkilotlar reyestridagi ijara beruvchi yozuvidan
 * olinadi. Ilgari bu yerda boshqa nom, boshqa STIR va boshqa telefon qotib
 * turardi: shartnomada bir kompaniya, sozlamalarda boshqasi ko'rinardi.
 */
const landlord = organizationByStir(LANDLORD_STIR)

const settings = reactive({
  company: {
    name: landlord?.name ?? 'Makon Property Group MCHJ',
    tin: formatStir(LANDLORD_STIR),
    address: landlord?.address ?? '',
    phone: landlord?.phone ?? '',
    email: landlord?.email ?? '',
  },
  access: {
    twoFactor: true,
    ipRestrict: true,
    lockout: true,
    autoLogout: true,
  },
  password: {
    minLength: 12,
    expiryDays: 90,
    historyCount: 5,
    lockoutAttempts: 5,
    sessionMinutes: 15,
  },
  backup: {
    frequency: 'daily',
    retentionDays: 30,
    storage: 'cloud-uz-1',
  },
  prefs: {
    inApp: true,
    digest: true,
    weeklyReport: false,
    language: 'uz',
    timezone: 'Asia/Tashkent',
  },
})

const dirty = ref(false)
const savedAt = ref<Phrase>({ k: 'cfg.todayAt', p: { time: '09:15' } })
const lastBackup = ref<Phrase>({ k: 'cfg.todayAt', p: { time: '02:15' } })
/** Oxirgi zaxira fayl hajmi, yaratilgandan keyin aniq ko‘rsatiladi */
const backupSize = ref('')

watch(settings, () => (dirty.value = true), { deep: true })

const frequencyOptions = computed(() => [
  { value: 'daily', label: t('cfg.freqDaily') },
  { value: 'h12', label: t('cfg.freq12h') },
  { value: 'weekly', label: t('cfg.freqWeekly') },
])

const storageOptions = computed(() => [
  { value: 'cloud-uz-1', label: t('cfg.storageCloud') },
  { value: 'local', label: t('cfg.storageLocal') },
  { value: 'both', label: t('cfg.storageBoth') },
])

const languageOptions = computed(() => [
  { value: 'uz', label: t('shell.localeUz') },
  { value: 'ru', label: t('shell.localeRu') },
])

const timezoneOptions = [
  { value: 'Asia/Tashkent', label: 'Asia/Tashkent (UTC+5)' },
  { value: 'Asia/Almaty', label: 'Asia/Almaty (UTC+6)' },
]

const audit = ref<Array<{ id: string; who: Phrase; text: Phrase; when: Phrase; tone: string }>>([
  {
    id: 'ev-1',
    who: { s: 'Jahongir Alimov' },
    text: { k: 'cfg.evtSettingsOpened' },
    when: { k: 'cfg.todayAt', p: { time: '09:15' } },
    tone: 'brand',
  },
  {
    id: 'ev-2',
    who: { k: 'cfg.systemActor' },
    text: { k: 'cfg.evtChannelSync' },
    when: { k: 'cfg.todayAt', p: { time: '09:02' } },
    tone: 'ok',
  },
  {
    id: 'ev-3',
    who: { k: 'cfg.securityActor' },
    text: { k: 'cfg.evtNewLogin' },
    when: { k: 'cfg.todayAt', p: { time: '08:47' } },
    tone: 'warn',
  },
  {
    id: 'ev-4',
    who: { s: 'Sevara Yusupova' },
    text: { k: 'cfg.evtRightsUpdated' },
    when: { k: 'cfg.todayAt', p: { time: '08:31' } },
    tone: 'brand',
  },
])

/**
 * Audit yozuvi amalni bajargan odam nomiga tushadi. Ilgari bu yerda bitta
 * ism qotib turardi: kim kirgan bo'lsa ham jurnalda o'sha ism chiqardi.
 */
function pushAudit(
  text: Phrase,
  tone: string,
  who: Phrase = auth.user?.fullName
    ? { s: auth.user.fullName }
    : { k: 'cfg.systemActor' },
) {
  audit.value.unshift({
    id: `ev-${audit.value.length + 5}`,
    who,
    text,
    when: { k: 'common.justNow' },
    tone,
  })
  if (audit.value.length > 8) audit.value.pop()
}

const companyOpen = ref(false)
const companyDraft = reactive({ name: '', tin: '', address: '', phone: '', email: '' })

function openCompany() {
  Object.assign(companyDraft, settings.company)
  companyOpen.value = true
}

function saveCompany() {
  Object.assign(settings.company, {
    name: companyDraft.name.trim(),
    tin: companyDraft.tin.trim(),
    address: companyDraft.address.trim(),
    phone: companyDraft.phone.trim(),
    email: companyDraft.email.trim(),
  })
  pushAudit({ k: 'cfg.evtCompanyUpdated' }, 'brand')
  companyOpen.value = false
}

const accessRows = computed(() => [
  {
    key: 'twoFactor',
    label: t('cfg.twoFactor'),
    caption: t('cfg.twoFactorCaption'),
    icon: 'shield',
    value: settings.access.twoFactor,
  },
  {
    key: 'ipRestrict',
    label: t('cfg.ipRestrict'),
    caption: t('cfg.ipRestrictCaption'),
    icon: 'globe',
    value: settings.access.ipRestrict,
  },
  {
    key: 'lockout',
    label: t('cfg.lockout'),
    caption: t('cfg.lockoutCaption', { n: settings.password.lockoutAttempts }),
    icon: 'lock',
    value: settings.access.lockout,
  },
  {
    key: 'autoLogout',
    label: t('cfg.autoLogout'),
    caption: t('cfg.autoLogoutCaption', { n: settings.password.sessionMinutes }),
    icon: 'clock',
    value: settings.access.autoLogout,
  },
])

function toggleAccess(key: string) {
  const target = settings.access as Record<string, boolean>
  target[key] = !target[key]
}

const backupOpen = ref(false)
const restoreOpen = ref(false)
const restorePhrase = ref('')

const restoreReady = computed(() => restorePhrase.value.trim() === RESTORE_PHRASE)

function openRestore() {
  restorePhrase.value = ''
  restoreOpen.value = true
}

/**
 * Zaxira nusxa haqiqatan fayl beradi.
 *
 * Ilgari tugma faqat «Hozirgina» yozuvini qo'yardi: administrator zaxira
 * olganiga ishonardi, lekin qo'lida hech nima qolmasdi. Endi joriy holat,
 * ya'ni sozlamalar, xodimlar reyestri va ijara sikli, bitta faylga
 * yig'iladi va yuklab olinadi. O'sha fayl «Tiklash» oynasiga qaytariladi.
 */
function confirmBackup() {
  const nusxa = {
    tizim: 'MAKON',
    yaratildi: new Date().toISOString(),
    muallif: auth.user?.fullName ?? '',
    sozlamalar: JSON.parse(JSON.stringify(settings)),
    xodimlar: USERS.map((u) => ({
      id: u.id,
      fio: u.fullName,
      email: u.email,
      rol: u.role,
      status: u.status,
      obyektlar: u.buildings,
    })),
    ijaraSikli: import.meta.client ? (window.localStorage.getItem('lease') ?? null) : null,
  }
  const hajm = new Blob([JSON.stringify(nusxa, null, 2)], { type: 'application/json' })
  backupSize.value = `${(hajm.size / 1024).toFixed(1)} KB`
  saveBlob(hajm, `makon-zaxira-${todayIso()}.json`)
  lastBackup.value = { k: 'common.justNow' }
  pushAudit({ k: 'cfg.evtBackupCreated', p: { size: backupSize.value } }, 'ok')
  backupOpen.value = false
}

/**
 * Boshlang'ich holatga qaytarish. Ijara siklini yurgizganda tizim yangi
 * shartnoma va hisob-faktura yaratadi, ular esa brauzer xotirasida saqlanib
 * qoladi. Taqdimotdan oldin raqamlar tozalanishi kerak, aks holda ekranda
 * oldingi sinovlardan qolgan qiymatlar ko'rinadi.
 */
function confirmRestore() {
  if (!restoreReady.value) return
  pushAudit({ k: 'cfg.evtSystemReset' }, 'warn')
  restoreOpen.value = false
  if (import.meta.client) {
    for (const key of ['lease', 'makon.tour.seen', 'makon.favourites']) {
      window.localStorage.removeItem(key)
    }
    window.location.reload()
  }
}

const sessions = ref<
  Array<{ id: string; device: Phrase; place: Phrase; when: Phrase; current: boolean }>
>([
  {
    id: 's-1',
    device: { s: 'Chrome • Windows 11' },
    place: { k: 'cfg.placeTashkent' },
    when: { k: 'cfg.now' },
    current: true,
  },
  {
    id: 's-2',
    device: { s: 'Safari • macOS' },
    place: { k: 'cfg.placeTashkent' },
    when: { k: 'cfg.minutesAgo', p: { n: 10 } },
    current: false,
  },
  {
    id: 's-3',
    device: { k: 'cfg.deviceMobileApp' },
    place: { k: 'cfg.placeSamarkand' },
    when: { k: 'cfg.minutesAgo', p: { n: 35 } },
    current: false,
  },
  {
    id: 's-4',
    device: { s: 'Chrome • Android' },
    place: { k: 'cfg.placeBukhara' },
    when: { k: 'cfg.hoursAgo', p: { n: 1 } },
    current: false,
  },
])

const closeAllOpen = ref(false)

function endSession(id: string) {
  const s = sessions.value.find((x) => x.id === id)
  if (!s || s.current) return
  sessions.value = sessions.value.filter((x) => x.id !== id)
  pushAudit({ k: 'cfg.evtSessionEnded', p: { device: say(s.device) } }, 'warn')
}

function confirmCloseAll() {
  const removed = sessions.value.filter((s) => !s.current).length
  sessions.value = sessions.value.filter((s) => s.current)
  pushAudit({ k: 'cfg.evtSessionsForced', p: { n: removed } }, 'danger')
  closeAllOpen.value = false
}

const saveOpen = ref(false)

function confirmSave() {
  dirty.value = false
  savedAt.value = { k: 'common.justNow' }
  pushAudit({ k: 'cfg.evtSettingsSaved' }, 'brand')
  saveOpen.value = false
}

const activityLabels = ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', '24:00']
const activitySeries = computed(() => [
  {
    label: t('cfg.activitySeries'),
    tone: 'brand' as const,
    values: [1.2, 0.9, 4.8, 7.6, 6.9, 3.4, 1.6],
    fill: true,
  },
])

const SECURITY_METRICS = computed(() => [
  {
    label: t('kpi.activeThreats'),
    value: '0',
    caption: t('cfg.noOpenIncidents'),
    icon: 'shield',
    tone: 'text-ok-600 bg-ok-50',
  },
  {
    label: t('kpi.systemProtection'),
    value: '98%',
    caption: t('cfg.policyCompliance'),
    icon: 'lock',
    tone: 'text-brand-600 bg-brand-50',
  },
  {
    label: t('kpi.blockedAttempts'),
    value: '256',
    caption: t('cfg.last30Days'),
    icon: 'warning',
    tone: 'text-danger-600 bg-danger-50',
  },
  {
    label: t('kpi.monitoring'),
    value: '24/7',
    caption: t('cfg.continuousWatch'),
    icon: 'eye',
    tone: 'text-info-600 bg-info-50',
  },
])

const TONE_DOT: Record<string, string> = {
  brand: 'bg-brand-500',
  ok: 'bg-ok-500',
  warn: 'bg-warn-500',
  danger: 'bg-danger-500',
}
</script>

<template>
  <AppTopbar
    :title="t('nav.settingsSystem')"
    :subtitle="t('cfg.systemCaption')"
    :breadcrumb="[
      { label: t('nav.settings'), to: '/settings/users' },
      { label: t('nav.settingsSystem') },
    ]"
  >
    <template #actions>
      <span
        class="hidden items-center gap-2 rounded-pill bg-ok-50 px-3 py-1.5 text-[13px] font-semibold text-ok-700 ring-1 ring-inset ring-ok-100 lg:inline-flex"
      >
        <UiIcon name="shield" :size="16" />
        {{ t('cfg.securityLevelHigh') }}
      </span>
      <UiButton size="sm" :disabled="!dirty" @click="saveOpen = true">
        <UiIcon name="check" :size="16" />
        {{ t('common.saveChanges') }}
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
      class="flex flex-wrap items-center gap-3 rounded-card px-4 py-3 text-[13px] ring-1"
      :class="dirty ? 'bg-warn-50 text-warn-700 ring-warn-100' : 'bg-surface text-ink-600 ring-ink-200/60'"
    >
      <UiIcon :name="dirty ? 'warning' : 'check'" :size="16" class="shrink-0" />
      <span class="min-w-0 flex-1">
        <template v-if="dirty">{{ t('cfg.unsavedChanges') }}</template>
        <template v-else>{{ t('cfg.allSaved', { at: say(savedAt) }) }}</template>
      </span>
      <UiButton v-if="dirty" size="sm" @click="saveOpen = true">{{ t('common.save') }}</UiButton>
    </div>

    <section class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div class="min-w-0 space-y-5">
        <div class="grid gap-5 lg:grid-cols-2 2xl:grid-cols-3">
          <UiCard :title="t('cfg.companyProfile')" :subtitle="t('cfg.companyProfileCaption')">
            <p class="text-[16px] font-bold text-ink-900">{{ settings.company.name }}</p>
            <dl class="mt-3 space-y-2.5 text-[13px]">
              <div class="flex items-start justify-between gap-3">
                <dt class="text-ink-500">STIR</dt>
                <dd class="tabular text-right font-semibold text-ink-900">{{ settings.company.tin }}</dd>
              </div>
              <div class="flex items-start justify-between gap-3">
                <dt class="shrink-0 text-ink-500">{{ field('address') }}</dt>
                <dd class="text-right font-medium text-ink-800">{{ settings.company.address }}</dd>
              </div>
              <div class="flex items-start justify-between gap-3">
                <dt class="text-ink-500">{{ t('common.phone') }}</dt>
                <dd class="tabular text-right font-semibold text-ink-900">{{ settings.company.phone }}</dd>
              </div>
              <div class="flex items-start justify-between gap-3">
                <dt class="text-ink-500">{{ t('common.email') }}</dt>
                <dd class="text-right font-semibold text-ink-900">{{ settings.company.email }}</dd>
              </div>
            </dl>
            <UiButton variant="secondary" size="sm" block class="mt-4" @click="openCompany">
              <UiIcon name="edit" :size="16" />
              {{ t('cfg.editProfile') }}
            </UiButton>
          </UiCard>

          <UiCard :title="t('cfg.accessPolicies')" :subtitle="t('cfg.accessPoliciesCaption')">
            <ul class="space-y-2">
              <li v-for="r in accessRows" :key="r.key">
                <button
                  type="button"
                  class="flex w-full items-center gap-3 rounded-field px-3 py-2.5 text-left ring-1 ring-inset ring-ink-200 transition-colors hover:ring-brand-300"
                  @click="toggleAccess(r.key)"
                >
                  <span class="grid size-9 shrink-0 place-items-center rounded-field bg-brand-50 text-brand-600">
                    <UiIcon :name="r.icon" :size="16" />
                  </span>
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-[13px] font-semibold text-ink-900">{{ r.label }}</span>
                    <span class="block truncate text-[12px] text-ink-500">{{ r.caption }}</span>
                  </span>
                  <span class="flex shrink-0 items-center gap-2">
                    <span
                      class="text-[12px] font-semibold"
                      :class="r.value ? 'text-ok-700' : 'text-ink-500'"
                    >
                      {{ r.value ? t('common.enabled') : t('common.disabled') }}
                    </span>
                    <span
                      class="inline-flex h-6 w-11 items-center rounded-pill p-0.5 transition-colors"
                      :class="r.value ? 'bg-brand-500' : 'bg-ink-300'"
                    >
                      <span
                        class="size-5 rounded-full bg-white transition-transform"
                        :class="r.value ? 'translate-x-5' : ''"
                      />
                    </span>
                  </span>
                </button>
              </li>
            </ul>
          </UiCard>

          <UiCard :title="t('cfg.passwordPolicy')" :subtitle="t('cfg.passwordPolicyCaption')">
            <div class="space-y-3.5">
              <UiField :label="t('cfg.minPasswordLength')" :hint="t('cfg.hintCharCount')">
                <UiInput v-model="settings.password.minLength" type="number" />
              </UiField>
              <UiField :label="t('cfg.passwordExpiry')" :hint="t('cfg.hintDays')">
                <UiInput v-model="settings.password.expiryDays" type="number" />
              </UiField>
              <UiField :label="t('cfg.passwordHistory')" :hint="t('cfg.passwordHistoryHint')">
                <UiInput v-model="settings.password.historyCount" type="number" />
              </UiField>
              <UiField :label="t('cfg.lockoutAttempts')" :hint="t('cfg.lockoutAttemptsHint')">
                <UiInput v-model="settings.password.lockoutAttempts" type="number" />
              </UiField>
              <UiField :label="t('cfg.sessionLength')" :hint="t('cfg.hintMinutes')">
                <UiInput v-model="settings.password.sessionMinutes" type="number" />
              </UiField>
            </div>
          </UiCard>

          <UiCard :title="t('cfg.backupRestore')" :subtitle="t('cfg.backupCaption')">
            <dl class="space-y-2.5 text-[13px]">
              <div class="flex items-center justify-between gap-3">
                <dt class="text-ink-500">{{ t('cfg.lastBackup') }}</dt>
                <dd class="tabular font-semibold text-ink-900">{{ say(lastBackup) }}</dd>
              </div>
            </dl>

            <div class="mt-3 space-y-3.5">
              <UiField :label="t('cfg.backupFrequency')">
                <UiSelect v-model="settings.backup.frequency" :options="frequencyOptions" />
              </UiField>
              <UiField :label="t('cfg.retention')" :hint="t('cfg.hintDays')">
                <UiInput v-model="settings.backup.retentionDays" type="number" />
              </UiField>
              <UiField :label="t('cfg.storageLocation')">
                <UiSelect v-model="settings.backup.storage" :options="storageOptions" />
              </UiField>
            </div>

            <div class="mt-4 grid grid-cols-2 gap-2.5">
              <UiButton variant="secondary" size="sm" @click="backupOpen = true">
                <UiIcon name="upload" :size="16" />
                {{ t('cfg.createBackup') }}
              </UiButton>
              <UiButton variant="danger" size="sm" @click="openRestore">
                <UiIcon name="refresh" :size="16" />
                {{ t('cfg.restore') }}
              </UiButton>
            </div>
          </UiCard>

          <UiCard :title="t('cfg.systemPrefs')" :subtitle="t('cfg.systemPrefsCaption')">
            <ul class="space-y-2">
              <li>
                <button
                  type="button"
                  class="flex w-full items-center justify-between gap-3 rounded-field px-3 py-2.5 text-left ring-1 ring-inset ring-ink-200 transition-colors hover:ring-brand-300"
                  @click="settings.prefs.inApp = !settings.prefs.inApp"
                >
                  <span class="text-[13px] font-semibold text-ink-900">
                    {{ t('cfg.inAppNotifications') }}
                  </span>
                  <span
                    class="inline-flex h-6 w-11 shrink-0 items-center rounded-pill p-0.5 transition-colors"
                    :class="settings.prefs.inApp ? 'bg-brand-500' : 'bg-ink-300'"
                  >
                    <span
                      class="size-5 rounded-full bg-white transition-transform"
                      :class="settings.prefs.inApp ? 'translate-x-5' : ''"
                    />
                  </span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  class="flex w-full items-center justify-between gap-3 rounded-field px-3 py-2.5 text-left ring-1 ring-inset ring-ink-200 transition-colors hover:ring-brand-300"
                  @click="settings.prefs.digest = !settings.prefs.digest"
                >
                  <span class="text-[13px] font-semibold text-ink-900">
                    {{ t('cfg.dailyDigest') }}
                  </span>
                  <span
                    class="inline-flex h-6 w-11 shrink-0 items-center rounded-pill p-0.5 transition-colors"
                    :class="settings.prefs.digest ? 'bg-brand-500' : 'bg-ink-300'"
                  >
                    <span
                      class="size-5 rounded-full bg-white transition-transform"
                      :class="settings.prefs.digest ? 'translate-x-5' : ''"
                    />
                  </span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  class="flex w-full items-center justify-between gap-3 rounded-field px-3 py-2.5 text-left ring-1 ring-inset ring-ink-200 transition-colors hover:ring-brand-300"
                  @click="settings.prefs.weeklyReport = !settings.prefs.weeklyReport"
                >
                  <span class="text-[13px] font-semibold text-ink-900">
                    {{ t('cfg.weeklyReportReminder') }}
                  </span>
                  <span
                    class="inline-flex h-6 w-11 shrink-0 items-center rounded-pill p-0.5 transition-colors"
                    :class="settings.prefs.weeklyReport ? 'bg-brand-500' : 'bg-ink-300'"
                  >
                    <span
                      class="size-5 rounded-full bg-white transition-transform"
                      :class="settings.prefs.weeklyReport ? 'translate-x-5' : ''"
                    />
                  </span>
                </button>
              </li>
              <li
                class="flex items-center justify-between gap-3 rounded-field bg-ink-50 px-3 py-2.5 text-[13px] text-ink-500 ring-1 ring-inset ring-ink-200"
              >
                <span>{{ t('cfg.externalChannels') }}</span>
                <span class="shrink-0 text-[12px] font-semibold">{{ t('cfg.notConnectedYet') }}</span>
              </li>
            </ul>

            <div class="mt-3.5 space-y-3.5">
              <UiField :label="t('cfg.defaultLanguage')" :hint="t('cfg.defaultLanguageHint')">
                <UiSelect v-model="settings.prefs.language" :options="languageOptions" />
              </UiField>
              <UiField :label="t('cfg.timezone')">
                <UiSelect v-model="settings.prefs.timezone" :options="timezoneOptions" />
              </UiField>
            </div>
          </UiCard>
        </div>

        <UiCard :title="t('cfg.securityStatus')" :subtitle="t('cfg.securityStatusCaption')">
          <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div v-for="m in SECURITY_METRICS" :key="m.label" class="rounded-field p-4 ring-1 ring-ink-200">
              <span class="grid size-9 place-items-center rounded-field" :class="m.tone">
                <UiIcon :name="m.icon" :size="18" />
              </span>
              <p class="tabular mt-3 text-[22px] font-bold leading-none text-ink-900">{{ m.value }}</p>
              <p class="mt-1.5 text-[13px] font-semibold text-ink-700">{{ m.label }}</p>
              <p class="text-[12px] text-ink-500">{{ m.caption }}</p>
            </div>
          </div>

          <div class="mt-5 border-t border-ink-100 pt-5">
            <UiLine :labels="activityLabels" :series="activitySeries" :height="200" />
          </div>
        </UiCard>
      </div>

      <div class="min-w-0 space-y-5">
        <UiCard
          :title="t('cfg.activeSessions')"
          :subtitle="t('cfg.openSessions', { n: sessions.length })"
          flush
        >
          <ul class="divide-y divide-ink-100">
            <li v-for="s in sessions" :key="s.id" class="flex items-center gap-3 px-5 py-3">
              <span class="grid size-9 shrink-0 place-items-center rounded-field bg-brand-50 text-brand-600">
                <UiIcon name="globe" :size="16" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-[13px] font-semibold text-ink-900">
                  {{ say(s.device) }}
                </span>
                <span class="block truncate text-[12px] text-ink-500">
                  {{ say(s.place) }} • {{ say(s.when) }}
                </span>
              </span>
              <span
                v-if="s.current"
                class="shrink-0 rounded-pill bg-ok-50 px-2.5 py-1 text-[12px] font-semibold text-ok-700 ring-1 ring-inset ring-ok-100"
              >
                {{ t('cfg.currentSession') }}
              </span>
              <button
                v-else
                type="button"
                class="shrink-0 rounded-[8px] px-2.5 py-1.5 text-[13px] font-semibold text-danger-600 transition-colors hover:bg-danger-50"
                @click="endSession(s.id)"
              >
                {{ t('cfg.endSession') }}
              </button>
            </li>
          </ul>

          <div class="px-5 py-4">
            <UiButton
              variant="danger"
              size="sm"
              block
              :disabled="sessions.length < 2"
              @click="closeAllOpen = true"
            >
              <UiIcon name="logout" :size="16" />
              {{ t('cfg.endAllSessions') }}
            </UiButton>
          </div>
        </UiCard>

        <UiCard :title="t('nav.settingsAudit')" :subtitle="t('cfg.recentEvents')" flush>
          <template #actions>
            <UiButton variant="ghost" size="sm" to="/settings/audit">{{ t('tab.all') }}</UiButton>
          </template>
          <ul class="divide-y divide-ink-100">
            <li v-for="e in audit" :key="e.id" class="flex items-start gap-3 px-5 py-3">
              <span class="mt-1.5 size-2 shrink-0 rounded-full" :class="TONE_DOT[e.tone]" />
              <span class="min-w-0 flex-1">
                <span class="block text-[13px] font-semibold text-ink-900">{{ say(e.who) }}</span>
                <span class="block text-[12px] leading-snug text-ink-600">{{ say(e.text) }}</span>
              </span>
              <span class="tabular shrink-0 text-[12px] text-ink-500">{{ say(e.when) }}</span>
            </li>
          </ul>
        </UiCard>
      </div>
    </section>

    <UiModal v-model="companyOpen" :title="t('cfg.editCompanyProfile')" size="md">
      <div class="space-y-4">
        <UiField :label="t('apply.orgLabel')" required>
          <UiInput v-model="companyDraft.name" />
        </UiField>
        <div class="grid gap-4 sm:grid-cols-2">
          <UiField label="STIR">
            <UiInput v-model="companyDraft.tin" />
          </UiField>
          <UiField :label="t('common.phone')">
            <UiInput v-model="companyDraft.phone" />
          </UiField>
        </div>
        <UiField :label="field('address')">
          <UiInput v-model="companyDraft.address" />
        </UiField>
        <UiField :label="t('common.email')">
          <UiInput v-model="companyDraft.email" type="email" />
        </UiField>
      </div>
      <template #footer>
        <UiButton variant="ghost" @click="companyOpen = false">{{ t('common.cancel') }}</UiButton>
        <UiButton :disabled="!companyDraft.name.trim()" @click="saveCompany">
          {{ t('common.save') }}
        </UiButton>
      </template>
    </UiModal>

    <UiModal v-model="backupOpen" :title="t('cfg.createBackupTitle')" size="sm">
      <p class="text-[14px] leading-relaxed text-ink-700">
        {{
          t('cfg.createBackupText', {
            storage: storageOptions.find((o) => o.value === settings.backup.storage)?.label ?? '',
          })
        }}
      </p>
      <template #footer>
        <UiButton variant="ghost" @click="backupOpen = false">{{ t('common.cancel') }}</UiButton>
        <UiButton @click="confirmBackup">{{ t('cfg.createBackup') }}</UiButton>
      </template>
    </UiModal>

    <UiModal
      v-model="restoreOpen"
      :title="t('cfg.restoreTitle')"
      :subtitle="t('cfg.restoreCaption')"
      size="sm"
    >
      <p class="flex items-start gap-2 rounded-field bg-danger-50 px-3.5 py-3 text-[13px] text-danger-700">
        <UiIcon name="warning" :size="16" class="mt-0.5 shrink-0" />
        {{ t('cfg.restoreWarning') }}
      </p>

      <UiField
        class="mt-4"
        :label="t('cfg.restoreConfirmLabel', { phrase: RESTORE_PHRASE })"
        required
        :error="restorePhrase && !restoreReady ? t('cfg.restorePhraseMismatch') : ''"
      >
        <UiInput v-model="restorePhrase" :placeholder="RESTORE_PHRASE" />
      </UiField>

      <template #footer>
        <UiButton variant="ghost" @click="restoreOpen = false">{{ t('common.cancel') }}</UiButton>
        <UiButton variant="danger" :disabled="!restoreReady" @click="confirmRestore">
          {{ t('cfg.resetToInitial') }}
        </UiButton>
      </template>
    </UiModal>

    <UiModal v-model="closeAllOpen" :title="t('cfg.endAllSessions')" size="sm">
      <p class="text-[14px] leading-relaxed text-ink-700">{{ t('cfg.endAllSessionsText') }}</p>
      <template #footer>
        <UiButton variant="ghost" @click="closeAllOpen = false">{{ t('common.cancel') }}</UiButton>
        <UiButton variant="danger" @click="confirmCloseAll">{{ t('cfg.endSession') }}</UiButton>
      </template>
    </UiModal>

    <UiModal v-model="saveOpen" :title="t('common.saveChanges')" size="sm">
      <p class="text-[14px] leading-relaxed text-ink-700">{{ t('cfg.saveChangesText') }}</p>
      <template #footer>
        <UiButton variant="ghost" @click="saveOpen = false">{{ t('common.cancel') }}</UiButton>
        <UiButton @click="confirmSave">{{ t('common.save') }}</UiButton>
      </template>
    </UiModal>
  </main>
</template>
