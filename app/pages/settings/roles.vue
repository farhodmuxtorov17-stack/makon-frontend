<script setup lang="ts">
import { userCountByRole } from '~/data/users'
import {
  ROLE_CAPABILITIES,
  ROLE_META,
  ROLE_RING_CLASSES,
  ROLE_TONE_CLASSES,
} from '~/constants/roles'
import {
  ACCESS_AREAS,
  baseLevel,
  overrideKey,
  type AreaKey,
} from '~/constants/accessAreas'
import { ROLES, type AccessLevel, type Capability, type Role } from '~/types/rbac'

const { t } = useI18n()
const { tr, field, roleLabel, roleCaption } = useAppLabels()

/** Rol kartochkasidagi daraja, ko‘rish sohasi va cheklov matni */
const roleLevel = (r: Role) => tr(`role.${r}.level`, ROLE_META[r].level)
const roleScope = (r: Role) => tr(`role.${r}.scope`, ROLE_META[r].scope)
const roleLimitation = (r: Role) => tr(`role.${r}.limitation`, ROLE_META[r].limitation)

const SETTINGS_TABS = computed(() => [
  { label: t('nav.settingsUsers'), to: '/settings/users', icon: 'users' },
  { label: t('nav.settingsRoles'), to: '/settings/roles', icon: 'shield' },
  { label: t('nav.settingsIntegrations'), to: '/settings/integrations', icon: 'globe' },
  { label: t('nav.settingsReference'), to: '/settings/reference-data', icon: 'layers' },
  { label: t('nav.settingsSystem'), to: '/settings/system', icon: 'gear' },
  { label: t('nav.settingsAudit'), to: '/settings/audit', icon: 'clipboard' },
])
const CURRENT_TAB = '/settings/roles'

const auth = useAuthStore()

/** Amal huquqlarining interfeysdagi nomi lug‘atdan olinadi */
const CAPABILITY_KEY: Record<Capability, string> = {
  'application.decide': 'cfg.capApplicationDecide',
  'contract.manage': 'cfg.capContractManage',
  'payment.confirm': 'cfg.capPaymentConfirm',
  'invoice.create': 'cfg.capInvoiceCreate',
  'workorder.assign': 'cfg.capWorkOrderAssign',
  'workorder.execute': 'cfg.capWorkOrderExecute',
  'unit.editTechnical': 'cfg.capUnitTechnical',
  'unit.editContent': 'cfg.capUnitContent',
  'warehouse.issue': 'cfg.capWarehouseIssue',
  'meter.read': 'cfg.capMeterRead',
  'system.administer': 'cfg.capSystemAdminister',
}

const capabilityLabel = (c: Capability) => t(CAPABILITY_KEY[c]!)

/** Matritsa ustunlari nomi: registrdagi o‘zbekcha nom zaxira sifatida qoladi */
const AREA_KEY: Record<AreaKey, string> = {
  dashboard: 'nav.dashboardExecutive',
  objects: 'cfg.areaObjects',
  content: 'cfg.areaContent',
  applications: 'nav.applications',
  contracts: 'nav.contracts',
  billing: 'cfg.areaBilling',
  service: 'cfg.areaService',
  warehouse: 'cfg.areaWarehouse',
  meters: 'nav.meters',
  reports: 'nav.reports',
  settings: 'cfg.areaSettings',
  cabinet: 'cfg.areaCabinet',
}

const areaLabel = (key: AreaKey, fallback: string) => tr(AREA_KEY[key], fallback)

/** Ustun sarlavhasi va izoh ro‘yxati uchun tayyor ko‘rinish */
const AREA_VIEW = computed(() =>
  ACCESS_AREAS.map((a) => ({
    key: a.key,
    label: areaLabel(a.key, a.label),
    writeLabel: a.writes.length
      ? a.writes.map((c) => capabilityLabel(c)).join(' · ')
      : t('cfg.noWriteRight'),
  })),
)

const LEVEL_STYLE: Record<AccessLevel, { badge: string; mark: string }> = {
  full: { badge: 'bg-ok-50 text-ok-700 ring-ok-100', mark: 'text-ok-600' },
  scoped: { badge: 'bg-warn-50 text-warn-700 ring-warn-100', mark: 'text-warn-600' },
  none: { badge: 'bg-ink-100 text-ink-600 ring-ink-200', mark: 'text-ink-400' },
}

const LEVEL_META = computed<
  Record<AccessLevel, { label: string; badge: string; mark: string; desc: string }>
>(() => ({
  full: { ...LEVEL_STYLE.full, label: t('accessLevel.full'), desc: t('cfg.levelFullDesc') },
  scoped: {
    ...LEVEL_STYLE.scoped,
    label: t('accessLevel.limited'),
    desc: t('cfg.levelLimitedDesc'),
  },
  none: { ...LEVEL_STYLE.none, label: t('accessLevel.none'), desc: t('cfg.levelNoneDesc') },
}))

type Matrix = Record<Role, Record<AreaKey, AccessLevel>>

/**
 * Joriy holat: asosiy qoida ustiga saqlangan o‘zgartirishlar qo‘yiladi.
 * `ROLES` va `ACCESS_AREAS` barcha kalitlarni qamrab olgani uchun natija to‘liq.
 */
function buildMatrix(): Matrix {
  const out = {} as Matrix
  for (const role of ROLES) {
    const row = {} as Record<AreaKey, AccessLevel>
    for (const area of ACCESS_AREAS) {
      row[area.key] = auth.accessOverrides[overrideKey(role, area.key)] ?? baseLevel(role, area)
    }
    out[role] = row
  }
  return out
}

function cloneMatrix(src: Matrix): Matrix {
  const out = {} as Matrix
  for (const role of ROLES) {
    const row = {} as Record<AreaKey, AccessLevel>
    for (const area of ACCESS_AREAS) row[area.key] = src[role][area.key]
    out[role] = row
  }
  return out
}

const baseline = ref<Matrix>(buildMatrix())
const matrix = ref<Matrix>(buildMatrix())

function cell(role: Role, key: AreaKey): AccessLevel {
  return matrix.value[role][key]
}

const changes = computed(() => {
  const list: Array<{
    role: Role
    areaKey: AreaKey
    areaLabel: string
    from: AccessLevel
    to: AccessLevel
  }> = []
  for (const role of ROLES) {
    for (const area of ACCESS_AREAS) {
      const from = baseline.value[role][area.key]
      const to = matrix.value[role][area.key]
      if (from !== to)
        list.push({ role, areaKey: area.key, areaLabel: areaLabel(area.key, area.label), from, to })
    }
  }
  return list
})

const dirty = computed(() => changes.value.length > 0)

/** To‘liq → Cheklangan → Yo‘q → To‘liq */
function nextLevel(level: AccessLevel): AccessLevel {
  if (level === 'full') return 'scoped'
  if (level === 'scoped') return 'none'
  return 'full'
}

function cycle(role: Role, key: AreaKey) {
  matrix.value[role][key] = nextLevel(matrix.value[role][key])
}

const saveOpen = ref(false)
const flash = ref('')

function restore() {
  matrix.value = cloneMatrix(baseline.value)
  flash.value = t('cfg.matrixReverted')
}

/**
 * Saqlash haqiqiy kuchga kiradi: asosiy qoidadan farq qiladigan kataklar
 * seansga yoziladi va shu zahoti yon panel, marshrut hamda tugmalarga ta’sir
 * qiladi. Super rahbarning sozlamalar bo‘limi yopilmaydi.
 */
function confirmSave() {
  const count = changes.value.length
  const next: Record<string, AccessLevel> = {}
  for (const role of ROLES) {
    for (const area of ACCESS_AREAS) {
      const level = matrix.value[role][area.key]
      if (level !== baseLevel(role, area)) next[overrideKey(role, area.key)] = level
    }
  }
  auth.applyAccessOverrides(next)
  baseline.value = cloneMatrix(matrix.value)
  flash.value = t('cfg.matrixSaved', { n: count })
  saveOpen.value = false
}

/** «Foydalanuvchilar» ro‘yxatidagi hisoblar soni bilan bir xil */
const USER_COUNT = userCountByRole()

const totalUsers = ROLES.reduce((sum, role) => sum + USER_COUNT[role], 0)

const focusRole = ref<Role | null>(null)

function toggleFocus(role: Role) {
  focusRole.value = focusRole.value === role ? null : role
}

function levelCount(role: Role, level: AccessLevel) {
  return ACCESS_AREAS.filter((a) => matrix.value[role][a.key] === level).length
}

function capabilitiesOf(role: Role) {
  return ROLE_CAPABILITIES[role].map((c) => ({ code: c, label: capabilityLabel(c) }))
}
</script>

<template>
  <AppTopbar
    :title="t('nav.settingsRoles')"
    :subtitle="t('cfg.rolesCaption')"
    :breadcrumb="[
      { label: t('nav.settings'), to: '/settings/users' },
      { label: t('nav.settingsRoles') },
    ]"
  >
    <template #actions>
      <UiButton variant="ghost" size="sm" :disabled="!dirty" @click="restore">
        <UiIcon name="refresh" :size="16" />
        {{ t('cfg.revert') }}
      </UiButton>
      <UiButton size="sm" :disabled="!dirty" @click="saveOpen = true">
        <UiIcon name="check" :size="16" />
        {{ t('common.saveChanges') }}
      </UiButton>
    </template>
  </AppTopbar>

  <main class="scroll-slim min-w-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
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
      v-if="flash"
      class="flex items-start gap-2.5 rounded-card bg-ok-50 px-4 py-3 text-[13px] text-ok-700 ring-1 ring-ok-100"
    >
      <UiIcon name="check" :size="16" class="mt-0.5 shrink-0" />
      <span class="min-w-0 flex-1">{{ flash }}</span>
      <button
        type="button"
        class="shrink-0 rounded-[8px] p-1 transition-colors hover:bg-ok-100"
        :aria-label="t('common.dismiss')"
        @click="flash = ''"
      >
        <UiIcon name="x" :size="16" />
      </button>
    </div>

    <div
      v-if="dirty"
      class="flex flex-wrap items-center gap-3 rounded-card bg-warn-50 px-4 py-3 text-[13px] text-warn-700 ring-1 ring-warn-100"
    >
      <UiIcon name="warning" :size="16" class="shrink-0" />
      <span class="min-w-0 flex-1">{{ t('cfg.matrixDirty', { n: changes.length }) }}</span>
      <UiButton size="sm" @click="saveOpen = true">{{ t('common.saveChanges') }}</UiButton>
    </div>

    <UiCard
      :title="t('cfg.matrixTitle')"
      :subtitle="t('cfg.matrixCaption')"
      flush
      :padded="false"
    >
      <template #actions>
        <span class="tabular text-[13px] font-semibold text-ink-500">
          {{ t('cfg.matrixSize', { roles: ROLES.length, areas: AREA_VIEW.length }) }}
        </span>
      </template>

      <div class="scroll-slim min-w-0 overflow-x-auto border-y border-ink-100">
        <table class="min-w-max border-collapse text-sm">
          <thead>
            <tr class="border-b border-ink-200 bg-surface-sunken">
              <th
                scope="col"
                class="sticky left-0 z-20 w-[152px] min-w-[152px] border-r border-ink-200 bg-surface-sunken px-3 py-3 text-left text-[12px] font-semibold uppercase tracking-wide text-ink-500"
              >
                {{ field('role') }}
              </th>
              <th
                v-for="a in AREA_VIEW"
                :key="a.key"
                scope="col"
                class="min-w-[124px] px-3 py-3 text-center text-[12px] font-semibold uppercase tracking-wide text-ink-500"
                :title="`${a.label}: ${a.writeLabel}`"
              >
                {{ a.label }}
              </th>
            </tr>
          </thead>

          <tbody>
            <tr
              v-for="role in ROLES"
              :key="role"
              class="border-b border-ink-100 last:border-0"
              :class="focusRole && focusRole !== role ? 'opacity-45' : ''"
            >
              <th
                scope="row"
                class="sticky left-0 z-10 w-[152px] min-w-[152px] border-r border-ink-200 bg-surface px-3 py-3 text-left align-top"
              >
                <span class="flex items-start gap-2">
                  <span
                    class="mt-[5px] size-2.5 shrink-0 rounded-full ring-[5px] ring-inset"
                    :class="ROLE_RING_CLASSES[ROLE_META[role].tone]"
                    aria-hidden="true"
                  />
                  <span class="min-w-0">
                    <span class="block text-[13px] font-semibold leading-snug text-ink-900">
                      {{ roleLabel(role) }}
                    </span>
                    <span class="mt-1 block text-[11px] font-normal leading-snug text-ink-500">
                      {{
                        t('cfg.levelCounts', {
                          full: levelCount(role, 'full'),
                          limited: levelCount(role, 'scoped'),
                          none: levelCount(role, 'none'),
                        })
                      }}
                    </span>
                  </span>
                </span>
              </th>

              <td v-for="a in AREA_VIEW" :key="a.key" class="px-2 py-2.5 text-center">
                <button
                  type="button"
                  class="mx-auto flex w-full max-w-[108px] flex-col items-center gap-1 rounded-field px-2 py-2 ring-1 ring-inset transition-colors hover:ring-brand-300"
                  :class="LEVEL_META[cell(role, a.key)].badge"
                  :aria-label="
                    t('cfg.cellAria', {
                      role: roleLabel(role),
                      area: a.label,
                      level: LEVEL_META[cell(role, a.key)].label,
                      next: LEVEL_META[nextLevel(cell(role, a.key))].label,
                    })
                  "
                  :title="
                    t('cfg.cellTitle', {
                      area: a.label,
                      level: LEVEL_META[cell(role, a.key)].label,
                    })
                  "
                  @click="cycle(role, a.key)"
                >
                  <svg
                    class="size-5"
                    :class="LEVEL_META[cell(role, a.key)].mark"
                    viewBox="0 0 20 20"
                    fill="none"
                    aria-hidden="true"
                  >
                    <template v-if="cell(role, a.key) === 'full'">
                      <circle cx="10" cy="10" r="8.4" fill="currentColor" opacity=".16" />
                      <path
                        d="m5.8 10.4 2.9 2.9 5.6-6.4"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                    </template>
                    <template v-else-if="cell(role, a.key) === 'scoped'">
                      <circle
                        cx="10"
                        cy="10"
                        r="7.2"
                        stroke="currentColor"
                        stroke-width="2.2"
                        stroke-linecap="round"
                        stroke-dasharray="3.4 3.2"
                      />
                      <circle cx="10" cy="10" r="2.4" fill="currentColor" />
                    </template>
                    <template v-else>
                      <path
                        d="M6 6l8 8M14 6l-8 8"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                      />
                    </template>
                  </svg>
                  <span class="text-[11px] font-semibold leading-none">
                    {{ LEVEL_META[cell(role, a.key)].label }}
                  </span>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="px-5 py-4">
        <p class="text-[13px] font-semibold text-ink-700">{{ t('cfg.legend') }}</p>
        <ul class="mt-2.5 space-y-2">
          <li class="flex items-start gap-2 text-[13px] text-ink-600">
            <svg class="mt-px size-5 shrink-0 text-ok-600" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <circle cx="10" cy="10" r="8.4" fill="currentColor" opacity=".16" />
              <path d="m5.8 10.4 2.9 2.9 5.6-6.4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <span>
              <b class="font-semibold text-ink-800">{{ t('accessLevel.full') }}</b>,
              {{ LEVEL_META.full.desc }}
            </span>
          </li>
          <li class="flex items-start gap-2 text-[13px] text-ink-600">
            <svg class="mt-px size-5 shrink-0 text-warn-600" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <circle cx="10" cy="10" r="7.2" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-dasharray="3.4 3.2" />
              <circle cx="10" cy="10" r="2.4" fill="currentColor" />
            </svg>
            <span>
              <b class="font-semibold text-ink-800">{{ t('accessLevel.limited') }}</b>,
              {{ LEVEL_META.scoped.desc }}
            </span>
          </li>
          <li class="flex items-start gap-2 text-[13px] text-ink-600">
            <svg class="mt-px size-5 shrink-0 text-ink-400" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            </svg>
            <span>
              <b class="font-semibold text-ink-800">{{ t('accessLevel.none') }}</b>,
              {{ LEVEL_META.none.desc }}
            </span>
          </li>
        </ul>

        <p class="mt-4 text-[13px] font-semibold text-ink-700">{{ t('cfg.legendWrites') }}</p>
        <ul class="mt-2.5 grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
          <li
            v-for="a in AREA_VIEW"
            :key="a.key"
            class="flex items-start gap-2 rounded-[8px] bg-surface-sunken px-2.5 py-2 text-[12px]"
          >
            <UiIcon name="key" :size="14" class="mt-0.5 shrink-0 text-ink-400" />
            <span class="min-w-0">
              <b class="block font-semibold text-ink-800">{{ a.label }}</b>
              <span class="block leading-snug text-ink-500">{{ a.writeLabel }}</span>
            </span>
          </li>
        </ul>

        <p class="mt-3.5 text-[12px] leading-relaxed text-ink-500">
          {{
            t('cfg.matrixNote', {
              role: roleLabel('SUPER_HEAD'),
              level: t('accessLevel.limited'),
            })
          }}
        </p>
      </div>
    </UiCard>

    <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <UiCard v-for="role in ROLES" :key="role">
        <div class="flex items-start justify-between gap-3">
          <span
            class="inline-flex items-center rounded-pill px-2.5 py-1 text-xs font-semibold ring-1 ring-inset"
            :class="ROLE_TONE_CLASSES[ROLE_META[role].tone]"
          >
            {{ roleLabel(role) }}
          </span>
          <span class="tabular shrink-0 text-[13px] font-semibold text-ink-500">
            {{ t('cfg.userCount', { n: USER_COUNT[role] }) }}
          </span>
        </div>

        <p class="mt-2.5 text-[13px] leading-relaxed text-ink-600">{{ roleCaption(role) }}</p>

        <dl class="mt-3.5 space-y-2.5 border-t border-ink-100 pt-3.5 text-[13px]">
          <div class="flex items-start justify-between gap-3">
            <dt class="shrink-0 text-ink-500">{{ t('cfg.roleLevel') }}</dt>
            <dd class="text-right font-semibold text-ink-900">{{ roleLevel(role) }}</dd>
          </div>
          <div class="flex items-start justify-between gap-3">
            <dt class="shrink-0 text-ink-500">{{ t('cfg.roleScope') }}</dt>
            <dd class="text-right font-semibold text-ink-900">{{ roleScope(role) }}</dd>
          </div>
          <div class="flex items-center justify-between gap-3">
            <dt class="text-ink-500">{{ t('nav.cabinet') }}</dt>
            <dd>
              <NuxtLink
                :to="ROLE_META[role].home"
                class="inline-flex items-center gap-1 font-semibold text-brand-600 hover:text-brand-700"
              >
                {{ ROLE_META[role].home }}
                <UiIcon name="external" :size="14" />
              </NuxtLink>
            </dd>
          </div>
          <div class="flex items-center justify-between gap-3">
            <dt class="text-ink-500">{{ t('cfg.openAreas') }}</dt>
            <dd class="tabular font-semibold text-ink-900">
              {{ levelCount(role, 'full') + levelCount(role, 'scoped') }} / {{ AREA_VIEW.length }}
            </dd>
          </div>
        </dl>

        <div
          class="mt-3.5 flex items-start gap-2 rounded-field bg-warn-50 px-3 py-2.5 text-[13px] leading-relaxed text-warn-700 ring-1 ring-inset ring-warn-100"
        >
          <UiIcon name="lock" :size="16" class="mt-0.5 shrink-0" />
          <span class="min-w-0">
            <b class="font-semibold">{{ t('cfg.limitation') }}</b> {{ roleLimitation(role) }}
          </span>
        </div>

        <p class="mt-3.5 text-[12px] font-semibold uppercase tracking-wide text-ink-500">
          {{ t('cfg.capabilities') }}
        </p>
        <ul class="mt-2 flex flex-wrap gap-1.5">
          <li
            v-for="c in capabilitiesOf(role)"
            :key="c.code"
            class="inline-flex items-center gap-1.5 rounded-pill bg-ink-100 px-2.5 py-1 text-[12px] font-semibold text-ink-700 ring-1 ring-inset ring-ink-200"
          >
            <UiIcon name="key" :size="12" class="shrink-0 text-ink-500" />
            {{ c.label }}
          </li>
          <li v-if="!capabilitiesOf(role).length" class="text-[12px] text-ink-500">
            {{ t('cfg.noWriteGranted') }}
          </li>
        </ul>

        <UiButton variant="secondary" size="sm" block class="mt-4" @click="toggleFocus(role)">
          {{ focusRole === role ? t('cfg.unfocus') : t('cfg.focusInMatrix') }}
        </UiButton>
      </UiCard>
    </section>

    <p class="tabular text-[13px] text-ink-500">
      {{ t('cfg.rolesTotal', { roles: ROLES.length, users: totalUsers }) }}
    </p>

    <UiModal
      v-model="saveOpen"
      :title="t('common.saveChanges')"
      :subtitle="t('cfg.saveMatrixCaption')"
      size="lg"
    >
      <p v-if="!changes.length" class="text-[14px] text-ink-600">{{ t('empty.noChanges') }}.</p>

      <ul v-else class="scroll-slim max-h-[50vh] divide-y divide-ink-100 overflow-y-auto">
        <li
          v-for="c in changes"
          :key="`${c.role}-${c.areaKey}`"
          class="flex flex-wrap items-center gap-2.5 py-3"
        >
          <span
            class="inline-flex items-center rounded-pill px-2.5 py-1 text-xs font-semibold ring-1 ring-inset"
            :class="ROLE_TONE_CLASSES[ROLE_META[c.role].tone]"
          >
            {{ roleLabel(c.role) }}
          </span>
          <span class="min-w-0 flex-1 truncate text-[14px] font-semibold text-ink-900">
            {{ c.areaLabel }}
          </span>
          <span
            class="inline-flex items-center rounded-pill px-2.5 py-1 text-[12px] font-semibold ring-1 ring-inset"
            :class="LEVEL_META[c.from].badge"
          >
            {{ LEVEL_META[c.from].label }}
          </span>
          <UiIcon name="arrowRight" :size="16" class="text-ink-400" />
          <span
            class="inline-flex items-center rounded-pill px-2.5 py-1 text-[12px] font-semibold ring-1 ring-inset"
            :class="LEVEL_META[c.to].badge"
          >
            {{ LEVEL_META[c.to].label }}
          </span>
        </li>
      </ul>

      <p
        class="mt-4 flex items-start gap-2 rounded-field bg-warn-50 px-3.5 py-3 text-[13px] text-warn-700"
      >
        <UiIcon name="warning" :size="16" class="mt-0.5 shrink-0" />
        {{ t('cfg.matrixApplyNote') }}
      </p>

      <template #footer>
        <UiButton variant="ghost" @click="saveOpen = false">{{ t('common.cancel') }}</UiButton>
        <UiButton :disabled="!changes.length" @click="confirmSave">
          {{ t('cfg.confirmAndSave') }}
        </UiButton>
      </template>
    </UiModal>
  </main>
</template>
