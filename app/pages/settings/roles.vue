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

const SETTINGS_TABS = [
  { label: 'Foydalanuvchilar', to: '/settings/users', icon: 'users' },
  { label: 'Rollar va huquqlar', to: '/settings/roles', icon: 'shield' },
  { label: 'Integratsiyalar', to: '/settings/integrations', icon: 'globe' },
  { label: 'Ma’lumotnomalar', to: '/settings/reference-data', icon: 'layers' },
  { label: 'Tizim sozlamalari', to: '/settings/system', icon: 'gear' },
  { label: 'Audit jurnali', to: '/settings/audit', icon: 'clipboard' },
]
const CURRENT_TAB = '/settings/roles'

const auth = useAuthStore()

/** Amal huquqlarining interfeysdagi nomi */
const CAPABILITY_LABELS: Record<Capability, string> = {
  'application.decide': 'Ariza bo‘yicha qaror',
  'contract.manage': 'Shartnoma tayyorlash va yuborish',
  'payment.confirm': 'To‘lovni tasdiqlash',
  'invoice.create': 'Hisob-faktura chiqarish',
  'workorder.assign': 'Ish topshirig‘ini biriktirish',
  'workorder.execute': 'Ish topshirig‘ini bajarish',
  'unit.editTechnical': 'Unit texnik holatini tahrirlash',
  'unit.editContent': 'Unit kontentini tahrirlash',
  'warehouse.issue': 'Material berish',
  'system.administer': 'Tizimni boshqarish',
}

/** Ustun sarlavhasi va izoh ro‘yxati uchun tayyor ko‘rinish */
const AREA_VIEW = ACCESS_AREAS.map((a) => ({
  ...a,
  writeLabel: a.writes.length
    ? a.writes.map((c) => CAPABILITY_LABELS[c]).join(' · ')
    : 'Yozuv huquqi yo‘q: faqat ko‘rish',
}))

const LEVEL_META: Record<AccessLevel, { label: string; badge: string; mark: string; desc: string }> =
  {
    full: {
      label: 'To‘liq',
      badge: 'bg-ok-50 text-ok-700 ring-ok-100',
      mark: 'text-ok-600',
      desc: 'bo‘lim ochiq va rolda yozuv huquqi bor',
    },
    scoped: {
      label: 'Cheklangan',
      badge: 'bg-warn-50 text-warn-700 ring-warn-100',
      mark: 'text-warn-600',
      desc: 'bo‘lim ochiq, lekin yozuv huquqi yo‘q, faqat ko‘rish',
    },
    none: {
      label: 'Yo‘q',
      badge: 'bg-ink-100 text-ink-600 ring-ink-200',
      mark: 'text-ink-400',
      desc: 'bo‘lim rol uchun umuman ochilmaydi',
    },
  }

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
      if (from !== to) list.push({ role, areaKey: area.key, areaLabel: area.label, from, to })
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
  flash.value = 'Matritsa saqlangan holatiga qaytarildi.'
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
  flash.value = `Ruxsatlar matritsasi saqlandi: ${count} ta katak yangilandi va darhol kuchga kirdi.`
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
  return ROLE_CAPABILITIES[role].map((c) => ({ code: c, label: CAPABILITY_LABELS[c] }))
}
</script>

<template>
  <AppTopbar
    title="Rollar va huquqlar"
    subtitle="Sakkiz rol bo‘yicha bo‘lim ruxsatlari va amal huquqlari"
    :breadcrumb="[{ label: 'Sozlamalar', to: '/settings/users' }, { label: 'Rollar va huquqlar' }]"
  >
    <template #actions>
      <UiButton variant="ghost" size="sm" :disabled="!dirty" @click="restore">
        <UiIcon name="refresh" :size="16" />
        Qaytarish
      </UiButton>
      <UiButton size="sm" :disabled="!dirty" @click="saveOpen = true">
        <UiIcon name="check" :size="16" />
        O‘zgarishlarni saqlash
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
      <UiIcon name="check" :size="17" class="mt-0.5 shrink-0" />
      <span class="min-w-0 flex-1">{{ flash }}</span>
      <button
        type="button"
        class="shrink-0 rounded-[6px] p-1 transition-colors hover:bg-ok-100"
        aria-label="Xabarni yopish"
        @click="flash = ''"
      >
        <UiIcon name="x" :size="15" />
      </button>
    </div>

    <div
      v-if="dirty"
      class="flex flex-wrap items-center gap-3 rounded-card bg-warn-50 px-4 py-3 text-[13px] text-warn-700 ring-1 ring-warn-100"
    >
      <UiIcon name="warning" :size="17" class="shrink-0" />
      <span class="min-w-0 flex-1">
        Saqlanmagan o‘zgarishlar: {{ changes.length }} ta katak. Saqlamaguningizcha amaldagi
        ruxsatlar o‘zgarmaydi.
      </span>
      <UiButton size="sm" @click="saveOpen = true">O‘zgarishlarni saqlash</UiButton>
    </div>

    <UiCard
      title="Ruxsatlar matritsasi"
      subtitle="Katakni bosing: holat «To‘liq → Cheklangan → Yo‘q» tartibida almashadi"
      flush
      :padded="false"
    >
      <template #actions>
        <span class="tabular text-[12.5px] font-semibold text-ink-500">
          {{ ROLES.length }} rol × {{ AREA_VIEW.length }} bo‘lim
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
                Rol
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
                    <span class="block text-[12.5px] font-semibold leading-snug text-ink-900">
                      {{ ROLE_META[role].label }}
                    </span>
                    <span class="mt-1 block text-[11px] font-normal leading-snug text-ink-500">
                      To‘liq {{ levelCount(role, 'full') }} • Cheklangan
                      {{ levelCount(role, 'scoped') }} • Yo‘q {{ levelCount(role, 'none') }}
                    </span>
                  </span>
                </span>
              </th>

              <td v-for="a in AREA_VIEW" :key="a.key" class="px-2 py-2.5 text-center">
                <button
                  type="button"
                  class="mx-auto flex w-full max-w-[108px] flex-col items-center gap-1 rounded-field px-2 py-2 ring-1 ring-inset transition-colors hover:ring-brand-300"
                  :class="LEVEL_META[cell(role, a.key)].badge"
                  :aria-label="`${ROLE_META[role].label}, ${a.label}: ${LEVEL_META[cell(role, a.key)].label}. Keyingi holat: ${LEVEL_META[nextLevel(cell(role, a.key))].label}`"
                  :title="`${a.label}: ${LEVEL_META[cell(role, a.key)].label} (o‘zgartirish uchun bosing)`"
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
        <p class="text-[13px] font-semibold text-ink-700">Belgilar izohi</p>
        <ul class="mt-2.5 space-y-2">
          <li class="flex items-start gap-2 text-[12.5px] text-ink-600">
            <svg class="mt-px size-5 shrink-0 text-ok-600" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <circle cx="10" cy="10" r="8.4" fill="currentColor" opacity=".16" />
              <path d="m5.8 10.4 2.9 2.9 5.6-6.4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <span><b class="font-semibold text-ink-800">To‘liq</b>, {{ LEVEL_META.full.desc }}</span>
          </li>
          <li class="flex items-start gap-2 text-[12.5px] text-ink-600">
            <svg class="mt-px size-5 shrink-0 text-warn-600" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <circle cx="10" cy="10" r="7.2" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-dasharray="3.4 3.2" />
              <circle cx="10" cy="10" r="2.4" fill="currentColor" />
            </svg>
            <span>
              <b class="font-semibold text-ink-800">Cheklangan</b>, {{ LEVEL_META.scoped.desc }}
            </span>
          </li>
          <li class="flex items-start gap-2 text-[12.5px] text-ink-600">
            <svg class="mt-px size-5 shrink-0 text-ink-400" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            </svg>
            <span><b class="font-semibold text-ink-800">Yo‘q</b>, {{ LEVEL_META.none.desc }}</span>
          </li>
        </ul>

        <p class="mt-4 text-[13px] font-semibold text-ink-700">
          Ustun qaysi amal huquqi bilan «To‘liq» bo‘ladi
        </p>
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
          Boshlang‘ich qiymatlar marshrut ruxsatlari va rol amal huquqlari jadvalidan hisoblanadi.
          Shuning uchun «Super rahbar» arizalarni ko‘radi, lekin qaror qabul qilmaydi, u
          «Cheklangan» darajada turadi.
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
            {{ ROLE_META[role].label }}
          </span>
          <span class="tabular shrink-0 text-[12.5px] font-semibold text-ink-500">
            {{ USER_COUNT[role] }} ta foydalanuvchi
          </span>
        </div>

        <p class="mt-2.5 text-[13px] leading-relaxed text-ink-600">{{ ROLE_META[role].caption }}</p>

        <dl class="mt-3.5 space-y-2.5 border-t border-ink-100 pt-3.5 text-[12.5px]">
          <div class="flex items-start justify-between gap-3">
            <dt class="shrink-0 text-ink-500">Daraja</dt>
            <dd class="text-right font-semibold text-ink-900">{{ ROLE_META[role].level }}</dd>
          </div>
          <div class="flex items-start justify-between gap-3">
            <dt class="shrink-0 text-ink-500">Ko‘rish sohasi</dt>
            <dd class="text-right font-semibold text-ink-900">{{ ROLE_META[role].scope }}</dd>
          </div>
          <div class="flex items-center justify-between gap-3">
            <dt class="text-ink-500">Bosh sahifa</dt>
            <dd>
              <NuxtLink
                :to="ROLE_META[role].home"
                class="inline-flex items-center gap-1 font-semibold text-brand-600 hover:text-brand-700"
              >
                {{ ROLE_META[role].home }}
                <UiIcon name="external" :size="13" />
              </NuxtLink>
            </dd>
          </div>
          <div class="flex items-center justify-between gap-3">
            <dt class="text-ink-500">Ochiq bo‘limlar</dt>
            <dd class="tabular font-semibold text-ink-900">
              {{ levelCount(role, 'full') + levelCount(role, 'scoped') }} / {{ AREA_VIEW.length }}
            </dd>
          </div>
        </dl>

        <div
          class="mt-3.5 flex items-start gap-2 rounded-field bg-warn-50 px-3 py-2.5 text-[12.5px] leading-relaxed text-warn-700 ring-1 ring-inset ring-warn-100"
        >
          <UiIcon name="lock" :size="15" class="mt-0.5 shrink-0" />
          <span class="min-w-0">
            <b class="font-semibold">Cheklov:</b> {{ ROLE_META[role].limitation }}
          </span>
        </div>

        <p class="mt-3.5 text-[12px] font-semibold uppercase tracking-wide text-ink-500">
          Amal huquqlari
        </p>
        <ul class="mt-2 flex flex-wrap gap-1.5">
          <li
            v-for="c in capabilitiesOf(role)"
            :key="c.code"
            class="inline-flex items-center gap-1.5 rounded-pill bg-ink-100 px-2.5 py-1 text-[11.5px] font-semibold text-ink-700 ring-1 ring-inset ring-ink-200"
          >
            <UiIcon name="key" :size="12" class="shrink-0 text-ink-500" />
            {{ c.label }}
          </li>
          <li v-if="!capabilitiesOf(role).length" class="text-[12px] text-ink-500">
            Yozuv huquqi berilmagan: faqat ko‘rish
          </li>
        </ul>

        <UiButton variant="secondary" size="sm" block class="mt-4" @click="toggleFocus(role)">
          {{ focusRole === role ? 'Ajratishni bekor qilish' : 'Matritsada ajratib ko‘rsatish' }}
        </UiButton>
      </UiCard>
    </section>

    <p class="tabular text-[12.5px] text-ink-500">
      Jami {{ ROLES.length }} ta rol va {{ totalUsers }} ta foydalanuvchi hisobi.
    </p>

    <UiModal
      v-model="saveOpen"
      title="O‘zgarishlarni saqlash"
      subtitle="Quyidagi ruxsat o‘zgarishlari tasdiqlanadi"
      size="lg"
    >
      <p v-if="!changes.length" class="text-[13.5px] text-ink-600">O‘zgarish topilmadi.</p>

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
            {{ ROLE_META[c.role].label }}
          </span>
          <span class="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-ink-900">
            {{ c.areaLabel }}
          </span>
          <span
            class="inline-flex items-center rounded-pill px-2.5 py-1 text-[11.5px] font-semibold ring-1 ring-inset"
            :class="LEVEL_META[c.from].badge"
          >
            {{ LEVEL_META[c.from].label }}
          </span>
          <UiIcon name="arrowRight" :size="15" class="text-ink-400" />
          <span
            class="inline-flex items-center rounded-pill px-2.5 py-1 text-[11.5px] font-semibold ring-1 ring-inset"
            :class="LEVEL_META[c.to].badge"
          >
            {{ LEVEL_META[c.to].label }}
          </span>
        </li>
      </ul>

      <p
        class="mt-4 flex items-start gap-2 rounded-field bg-warn-50 px-3.5 py-3 text-[12.5px] text-warn-700"
      >
        <UiIcon name="warning" :size="16" class="mt-0.5 shrink-0" />
        O‘zgarishlar barcha faol seanslarga darhol qo‘llanadi va audit jurnalida qayd etiladi.
      </p>

      <template #footer>
        <UiButton variant="ghost" @click="saveOpen = false">Bekor qilish</UiButton>
        <UiButton :disabled="!changes.length" @click="confirmSave">Tasdiqlash va saqlash</UiButton>
      </template>
    </UiModal>
  </main>
</template>
