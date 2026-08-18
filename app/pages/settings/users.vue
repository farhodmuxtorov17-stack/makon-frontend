<script setup lang="ts">
import { USERS, type UserRow } from '~/data/users'
import { BUILDINGS } from '~/data/buildings'
import { ROLE_META, ROLE_TONE_CLASSES } from '~/constants/roles'
import { ROLES, type Role } from '~/types/rbac'
import { ROUTE_ACCESS } from '~/constants/navigation'

const SETTINGS_TABS = [
  { label: 'Foydalanuvchilar', to: '/settings/users', icon: 'users' },
  { label: 'Rollar va huquqlar', to: '/settings/roles', icon: 'shield' },
  { label: 'Integratsiyalar', to: '/settings/integrations', icon: 'globe' },
  { label: 'Ma’lumotnomalar', to: '/settings/reference-data', icon: 'layers' },
  { label: 'Tizim sozlamalari', to: '/settings/system', icon: 'gear' },
  { label: 'Audit jurnali', to: '/settings/audit', icon: 'clipboard' },
]
const CURRENT_TAB = '/settings/users'



const users = ref<UserRow[]>(USERS.map((u) => ({ ...u })))

const search = ref('')
const roleFilter = ref('all')
const statusFilter = ref('all')

const roleOptions = [
  { value: 'all', label: 'Barcha rollar' },
  ...ROLES.map((r) => ({ value: r, label: ROLE_META[r].label })),
]

const statusOptions = [
  { value: 'all', label: 'Barcha statuslar' },
  { value: 'ACTIVE', label: 'Faol' },
  { value: 'INACTIVE', label: 'Nofaol' },
]

const buildingOptions = BUILDINGS.map((b) => ({ value: b.id, label: b.name }))

function initials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

function scopeLabel(u: UserRow) {
  if (u.scopeAll) return `Barchasi (${BUILDINGS.length}/${BUILDINGS.length})`
  if (!u.buildings.length) return 'Biriktirilmagan'
  if (u.buildings.length === 1)
    return BUILDINGS.find((b) => b.id === u.buildings[0])?.name ?? 'Obyekt'
  return `${u.buildings.length} ta obyekt`
}

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return users.value.filter((u) => {
    const matchQ =
      !q ||
      u.fullName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.phone.replace(/\s/g, '').includes(q.replace(/\s/g, ''))
    const matchRole = roleFilter.value === 'all' || u.role === roleFilter.value
    const matchStatus = statusFilter.value === 'all' || u.status === statusFilter.value
    return matchQ && matchRole && matchStatus
  })
})

const columns = [
  { key: 'fullName', label: 'F.I.Sh.' },
  { key: 'email', label: 'Email / Telefon' },
  { key: 'role', label: 'Rol' },
  { key: 'scope', label: 'Obyekt biriktirish' },
  { key: 'status', label: 'Status' },
  { key: 'lastLogin', label: 'Oxirgi kirish', align: 'right' as const },
]

const rows = computed(() =>
  filtered.value.map((u) => ({ ...u, scope: scopeLabel(u), meta: ROLE_META[u.role] })),
)

const flash = ref('')

const editOpen = ref(false)
const editTab = ref('main')
const editTabs = [
  { value: 'main', label: 'Asosiy ma’lumotlar' },
  { value: 'access', label: 'Rol va huquqlar' },
  { value: 'prefs', label: 'Sozlamalar' },
]

const draft = reactive({
  id: '',
  fullName: '',
  email: '',
  phone: '',
  position: '',
  role: 'BUILDING_MANAGER' as Role,
  scopeAll: false,
  buildings: [] as string[],
  status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
  notifyInApp: true,
  notifyDigest: false,
  language: 'uz',
})

function openEdit(row: Record<string, unknown>) {
  const u = users.value.find((x) => x.id === row.id)
  if (!u) return
  draft.id = u.id
  draft.fullName = u.fullName
  draft.email = u.email
  draft.phone = u.phone
  draft.position = u.position
  draft.role = u.role
  draft.scopeAll = u.scopeAll
  draft.buildings = [...u.buildings]
  draft.status = u.status
  draft.notifyInApp = u.notifyInApp
  draft.notifyDigest = u.notifyDigest
  draft.language = u.language
  editTab.value = 'main'
  editOpen.value = true
}

/** Boshqa dialoglar kabi Escape bilan yopiladi */
onKeyStroke('Escape', () => {
  if (editOpen.value) editOpen.value = false
})

function toggleDraftBuilding(id: string) {
  const i = draft.buildings.indexOf(id)
  if (i === -1) draft.buildings.push(id)
  else draft.buildings.splice(i, 1)
  if (draft.buildings.length) draft.scopeAll = false
}

function setScopeAll(value: boolean) {
  draft.scopeAll = value
  if (value) draft.buildings = []
}

const draftValid = computed(
  () => draft.fullName.trim().length > 2 && /.+@.+\..+/.test(draft.email.trim()),
)

function saveEdit() {
  if (!draftValid.value) return
  const i = users.value.findIndex((u) => u.id === draft.id)
  if (i === -1) return
  const prev = users.value[i]!
  users.value[i] = {
    ...prev,
    fullName: draft.fullName.trim(),
    email: draft.email.trim(),
    phone: draft.phone.trim(),
    position: draft.position.trim(),
    role: draft.role,
    scopeAll: draft.scopeAll,
    buildings: draft.scopeAll ? [] : [...draft.buildings],
    status: draft.status,
    notifyInApp: draft.notifyInApp,
    notifyDigest: draft.notifyDigest,
    language: draft.language,
  }
  flash.value = `«${users.value[i]!.fullName}» ma’lumotlari yangilandi.`
  editOpen.value = false
}

const AREA_LABELS: Record<string, string> = {
  '/dashboard/executive': 'Boshqaruv paneli',
  '/dashboard/building': 'Obyekt paneli',
  '/objects': 'Obyektlar',
  '/content': 'Kontent tayyorlash',
  '/applications': 'Arizalar',
  '/contracts': 'Shartnomalar',
  '/billing': 'Billing va nazorat',
  '/service-requests': 'Servis va monitoring',
  '/facility/materials': 'Material so‘rovlari',
  '/facility': 'Xo‘jalik bo‘limi',
  '/warehouse': 'Ombor va jihozlar',
  '/settings/audit': 'Audit jurnali',
  '/meters': 'Hisoblagichlar',
  '/reports': 'Hisobotlar',
  '/settings': 'Sozlamalar',
  '/cabinet': 'Ijarachi kabineti',
}

const roleAreas = computed(() =>
  ROUTE_ACCESS.map((r) => ({
    prefix: r.prefix,
    label: AREA_LABELS[r.prefix] ?? r.prefix,
    allowed: r.roles.includes(draft.role),
  })),
)

const addOpen = ref(false)
const addForm = reactive({
  fullName: '',
  email: '',
  phone: '',
  position: '',
  role: 'BUILDING_MANAGER' as Role,
  scopeAll: false,
  buildings: [] as string[],
})
const addTouched = ref(false)

const addValid = computed(
  () => addForm.fullName.trim().length > 2 && /.+@.+\..+/.test(addForm.email.trim()),
)

function openAdd() {
  addForm.fullName = ''
  addForm.email = ''
  addForm.phone = '+998 '
  addForm.position = ''
  addForm.role = 'BUILDING_MANAGER'
  addForm.scopeAll = false
  addForm.buildings = []
  addTouched.value = false
  addOpen.value = true
}

function setAddScopeAll(value: boolean) {
  addForm.scopeAll = value
  if (value) addForm.buildings = []
}

function toggleAddBuilding(id: string) {
  const i = addForm.buildings.indexOf(id)
  if (i === -1) addForm.buildings.push(id)
  else addForm.buildings.splice(i, 1)
  if (addForm.buildings.length) addForm.scopeAll = false
}

function submitAdd() {
  addTouched.value = true
  if (!addValid.value) return
  const next = users.value.length + 1
  users.value.unshift({
    id: `u-${String(next).padStart(2, '0')}-n`,
    fullName: addForm.fullName.trim(),
    email: addForm.email.trim(),
    phone: addForm.phone.trim(),
    position: addForm.position.trim() || ROLE_META[addForm.role].label,
    role: addForm.role,
    scopeAll: addForm.scopeAll,
    buildings: addForm.scopeAll ? [] : [...addForm.buildings],
    status: 'ACTIVE',
    lastLogin: 'Hali kirmagan',
    notifyInApp: true,
    notifyDigest: addForm.role === 'SUPER_HEAD' || addForm.role === 'ACCOUNTANT',
    language: 'uz',
  })
  flash.value = `«${addForm.fullName.trim()}» foydalanuvchilar ro‘yxatiga qo‘shildi.`
  addOpen.value = false
}

function toggleStatus(id: string) {
  const u = users.value.find((x) => x.id === id)
  if (!u) return
  u.status = u.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
  flash.value = `«${u.fullName}» statusi «${u.status === 'ACTIVE' ? 'Faol' : 'Nofaol'}» ga o‘zgartirildi.`
}
</script>

<template>
  <AppTopbar
    title="Foydalanuvchilar"
    subtitle="Tizim foydalanuvchilari, rollari va obyektga biriktirilishi"
    :breadcrumb="[{ label: 'Sozlamalar', to: '/settings/users' }, { label: 'Foydalanuvchilar' }]"
  >
    <template #actions>
      <UiButton size="sm" @click="openAdd">
        <UiIcon name="plus" :size="16" />
        Foydalanuvchi qo‘shish
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
      v-if="flash"
      class="flex items-start gap-2.5 rounded-card bg-ok-50 px-4 py-3 text-[13px] text-ok-700 ring-1 ring-ok-100"
    >
      <UiIcon name="check" :size="17" class="mt-0.5 shrink-0" />
      <span class="min-w-0 flex-1">{{ flash }}</span>
      <button
        type="button"
        class="shrink-0 rounded-[6px] p-1 text-ok-700 transition-colors hover:bg-ok-100"
        aria-label="Xabarni yopish"
        @click="flash = ''"
      >
        <UiIcon name="x" :size="15" />
      </button>
    </div>

    <UiCard
      title="Foydalanuvchilar ro‘yxati"
      :subtitle="`Jami: ${users.length} ta • ko‘rsatilmoqda: ${filtered.length} ta`"
      flush
    >
      <div class="grid gap-3 px-5 pb-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_220px_200px]">
        <UiInput v-model="search" placeholder="F.I.Sh., email yoki telefon bo‘yicha qidirish">
          <template #prefix><UiIcon name="search" :size="17" /></template>
        </UiInput>
        <UiSelect v-model="roleFilter" :options="roleOptions" />
        <UiSelect v-model="statusFilter" :options="statusOptions" />
      </div>

      <UiTable
        :columns="columns"
        :rows="rows"
        empty="Filtrga mos foydalanuvchi topilmadi"
        @row-click="openEdit"
      >
        <template #cell-fullName="{ row }">
          <span class="flex items-center gap-3">
            <UiAvatar :user-id="row.id" :full-name="row.fullName" :role="row.role" size="sm" />
            <span class="min-w-0">
              <span class="block truncate text-[13.5px] font-semibold text-ink-900">
                {{ row.fullName }}
              </span>
              <span class="block truncate text-[12px] text-ink-500">{{ row.position }}</span>
            </span>
          </span>
        </template>

        <template #cell-email="{ row }">
          <span class="block text-[13px] text-ink-800">{{ row.email }}</span>
          <span class="tabular block text-[12px] text-ink-500">{{ row.phone }}</span>
        </template>

        <template #cell-role="{ row }">
          <span
            class="inline-flex items-center rounded-pill px-2.5 py-1 text-xs font-semibold ring-1 ring-inset"
            :class="ROLE_TONE_CLASSES[row.meta.tone]"
          >
            {{ row.meta.label }}
          </span>
        </template>

        <template #cell-scope="{ row }">
          <span class="text-[13px] text-ink-700">{{ row.scope }}</span>
        </template>

        <template #cell-status="{ row }">
          <button
            type="button"
            class="inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs font-semibold ring-1 ring-inset transition-colors"
            :class="
              row.status === 'ACTIVE'
                ? 'bg-ok-50 text-ok-700 ring-ok-100 hover:bg-ok-100'
                : 'bg-ink-100 text-ink-700 ring-ink-200 hover:bg-ink-200'
            "
            :title="row.status === 'ACTIVE' ? 'Nofaol qilish' : 'Faollashtirish'"
            @click.stop="toggleStatus(row.id)"
          >
            <svg class="size-3 shrink-0" viewBox="0 0 12 12" aria-hidden="true">
              <circle v-if="row.status === 'ACTIVE'" cx="6" cy="6" r="4" fill="currentColor" />
              <circle v-else cx="6" cy="6" r="3.6" fill="none" stroke="currentColor" stroke-width="2" />
            </svg>
            {{ row.status === 'ACTIVE' ? 'Faol' : 'Nofaol' }}
          </button>
        </template>

        <template #cell-lastLogin="{ row }">
          <span class="tabular text-[13px] text-ink-600">{{ row.lastLogin }}</span>
        </template>
      </UiTable>
    </UiCard>

    <UiCard title="Ruxsatlar ierarxiyasi" subtitle="Rol qaysi obyektlarni ko‘rishini belgilaydi">
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div
          v-for="r in ROLES"
          :key="r"
          class="rounded-field p-4 ring-1 ring-ink-200"
        >
          <div class="flex items-center gap-2.5">
            <span
              class="inline-flex items-center rounded-pill px-2.5 py-1 text-xs font-semibold ring-1 ring-inset"
              :class="ROLE_TONE_CLASSES[ROLE_META[r].tone]"
            >
              {{ ROLE_META[r].label }}
            </span>
            <span class="tabular text-[12px] font-semibold text-ink-500">
              {{ users.filter((u) => u.role === r).length }} ta
            </span>
          </div>
          <p class="mt-2 text-[12.5px] leading-relaxed text-ink-600">{{ ROLE_META[r].caption }}</p>
          <button
            type="button"
            class="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-600 transition-colors hover:text-brand-700"
            @click="roleFilter = r"
          >
            Shu roldagilarni ko‘rsatish
            <UiIcon name="arrowRight" :size="14" />
          </button>
        </div>
      </div>
    </UiCard>

    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-150 ease-out"
        enter-from-class="opacity-0"
        leave-active-class="transition duration-100 ease-in"
        leave-to-class="opacity-0"
      >
        <div
          v-if="editOpen"
          class="fixed inset-0 z-50 flex justify-end bg-ink-900/40 backdrop-blur-[2px]"
          @click.self="editOpen = false"
        >
          <aside
            class="flex h-full w-full max-w-lg flex-col bg-surface shadow-pop"
            role="dialog"
            aria-modal="true"
            aria-label="Foydalanuvchi tahrirlash"
          >
            <header class="flex items-start justify-between gap-4 border-b border-ink-200 px-6 py-5">
              <div class="min-w-0">
                <h2 class="text-lg font-bold text-ink-900">Foydalanuvchi tahrirlash</h2>
                <p class="mt-0.5 truncate text-[13px] text-ink-500">{{ draft.email }}</p>
              </div>
              <button
                type="button"
                class="-mr-1 -mt-1 rounded-lg p-2 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
                aria-label="Yopish"
                @click="editOpen = false"
              >
                <UiIcon name="x" :size="18" />
              </button>
            </header>

            <div class="flex items-center gap-3.5 border-b border-ink-100 px-6 py-4">
              <UiAvatar :user-id="draft.id" :full-name="draft.fullName" :role="draft.role" size="lg" ring />
              <div class="min-w-0">
                <p class="truncate text-[15px] font-bold text-ink-900">{{ draft.fullName }}</p>
                <div class="mt-1.5 flex flex-wrap items-center gap-2">
                  <span
                    class="inline-flex items-center rounded-pill px-2.5 py-1 text-xs font-semibold ring-1 ring-inset"
                    :class="ROLE_TONE_CLASSES[ROLE_META[draft.role].tone]"
                  >
                    {{ ROLE_META[draft.role].label }}
                  </span>
                  <span
                    class="inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs font-semibold ring-1 ring-inset"
                    :class="
                      draft.status === 'ACTIVE'
                        ? 'bg-ok-50 text-ok-700 ring-ok-100'
                        : 'bg-ink-100 text-ink-700 ring-ink-200'
                    "
                  >
                    <svg class="size-3" viewBox="0 0 12 12" aria-hidden="true">
                      <circle v-if="draft.status === 'ACTIVE'" cx="6" cy="6" r="4" fill="currentColor" />
                      <circle v-else cx="6" cy="6" r="3.6" fill="none" stroke="currentColor" stroke-width="2" />
                    </svg>
                    {{ draft.status === 'ACTIVE' ? 'Faol' : 'Nofaol' }}
                  </span>
                </div>
              </div>
            </div>

            <div class="px-6 pt-4">
              <UiTabs v-model="editTab" :tabs="editTabs" variant="line" />
            </div>

            <div class="scroll-slim flex-1 space-y-5 overflow-y-auto px-6 py-5">
              <template v-if="editTab === 'main'">
                <UiField label="F.I.Sh." required :error="draft.fullName.trim().length > 2 ? '' : 'Kamida 3 ta belgi kiriting'">
                  <UiInput v-model="draft.fullName" />
                </UiField>
                <UiField label="Email" required :error="/.+@.+\..+/.test(draft.email) ? '' : 'To‘g‘ri email kiriting'">
                  <UiInput v-model="draft.email" type="email" />
                </UiField>
                <UiField label="Telefon">
                  <UiInput v-model="draft.phone" />
                </UiField>
                <UiField label="Lavozim">
                  <UiInput v-model="draft.position" />
                </UiField>
                <div>
                  <UiField label="Rol">
                    <UiSelect
                      v-model="draft.role"
                      :options="ROLES.map((r) => ({ value: r, label: ROLE_META[r].label }))"
                    />
                  </UiField>
                  <p
                    class="mt-2 flex items-start gap-2 rounded-field bg-warn-50 px-3 py-2.5 text-[12.5px] leading-relaxed text-warn-700 ring-1 ring-inset ring-warn-100"
                  >
                    <UiIcon name="lock" :size="15" class="mt-0.5 shrink-0" />
                    <span class="min-w-0">
                      <b class="font-semibold">Cheklov:</b> {{ ROLE_META[draft.role].limitation }}
                    </span>
                  </p>
                  <p class="mt-1.5 text-[12px] text-ink-500">
                    {{ ROLE_META[draft.role].level }} · {{ ROLE_META[draft.role].scope }}. Rol
                    o‘zgarishi ruxsatlar ro‘yxatini darhol yangilaydi.
                  </p>
                </div>
              </template>

              <template v-else-if="editTab === 'access'">
                <div>
                  <p class="text-[13px] font-semibold text-ink-700">Obyekt biriktirish</p>
                  <div class="mt-2.5 space-y-2">
                    <label
                      class="flex cursor-pointer items-start gap-3 rounded-field p-3 ring-1 ring-inset transition-colors"
                      :class="draft.scopeAll ? 'bg-brand-50 ring-brand-300' : 'ring-ink-200 hover:ring-ink-300'"
                    >
                      <input
                        type="radio"
                        class="mt-0.5 size-4 shrink-0 accent-brand-500"
                        :checked="draft.scopeAll"
                        @change="setScopeAll(true)"
                      />
                      <span>
                        <span class="block text-[13.5px] font-semibold text-ink-900">
                          Barcha obyektlar ({{ BUILDINGS.length }}/{{ BUILDINGS.length }})
                        </span>
                        <span class="block text-[12px] text-ink-500">
                          Foydalanuvchi portfeldagi barcha obyektlarni ko‘radi
                        </span>
                      </span>
                    </label>

                    <label
                      class="flex cursor-pointer items-start gap-3 rounded-field p-3 ring-1 ring-inset transition-colors"
                      :class="!draft.scopeAll ? 'bg-brand-50 ring-brand-300' : 'ring-ink-200 hover:ring-ink-300'"
                    >
                      <input
                        type="radio"
                        class="mt-0.5 size-4 shrink-0 accent-brand-500"
                        :checked="!draft.scopeAll"
                        @change="setScopeAll(false)"
                      />
                      <span>
                        <span class="block text-[13.5px] font-semibold text-ink-900">Tanlangan obyekt</span>
                        <span class="block text-[12px] text-ink-500">
                          Faqat belgilangan obyektlar ma’lumotlari ko‘rinadi
                        </span>
                      </span>
                    </label>
                  </div>

                  <ul class="mt-3 space-y-1.5">
                    <li v-for="b in BUILDINGS" :key="b.id">
                      <label
                        class="flex cursor-pointer items-center gap-3 rounded-field px-3 py-2.5 ring-1 ring-inset transition-colors"
                        :class="
                          draft.buildings.includes(b.id)
                            ? 'bg-brand-50/60 ring-brand-200'
                            : 'ring-ink-200 hover:ring-ink-300'
                        "
                      >
                        <input
                          type="checkbox"
                          class="size-4 shrink-0 accent-brand-500"
                          :checked="draft.buildings.includes(b.id)"
                          @change="toggleDraftBuilding(b.id)"
                        />
                        <span class="min-w-0 flex-1">
                          <span class="block truncate text-[13px] font-semibold text-ink-900">
                            {{ b.name }}
                          </span>
                          <span class="block truncate text-[11.5px] text-ink-500">
                            {{ b.city }}, {{ b.district }}
                          </span>
                        </span>
                        <span
                          v-if="draft.buildings.includes(b.id)"
                          class="shrink-0 text-[11.5px] font-semibold text-brand-600"
                        >
                          Biriktirildi
                        </span>
                      </label>
                    </li>
                  </ul>

                  <p v-if="draft.scopeAll" class="mt-2.5 text-[12px] text-ink-500">
                    Hozir «Barcha obyektlar» tanlangan, alohida belgilash uchun quyidagi obyektni
                    belgilang, rejim avtomatik «Tanlangan obyekt» ga o‘tadi.
                  </p>
                </div>

                <div>
                  <p class="text-[13px] font-semibold text-ink-700">
                    «{{ ROLE_META[draft.role].label }}» roli uchun ochiq bo‘limlar
                  </p>
                  <ul class="mt-2.5 grid gap-1.5 sm:grid-cols-2">
                    <li
                      v-for="a in roleAreas"
                      :key="a.prefix"
                      class="flex items-center gap-2 rounded-[8px] px-2.5 py-1.5 text-[12.5px]"
                      :class="a.allowed ? 'bg-ok-50 text-ok-700' : 'bg-ink-100 text-ink-500'"
                    >
                      <UiIcon :name="a.allowed ? 'check' : 'x'" :size="14" />
                      <span class="truncate">{{ a.label }}</span>
                    </li>
                  </ul>
                  <NuxtLink
                    to="/settings/roles"
                    class="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-600 hover:text-brand-700"
                  >
                    Ruxsatlar matritsasini ochish
                    <UiIcon name="arrowRight" :size="14" />
                  </NuxtLink>
                </div>
              </template>

              <template v-else>
                <div class="space-y-2">
                  <button
                    type="button"
                    class="flex w-full items-center justify-between gap-3 rounded-field px-4 py-3 text-left ring-1 ring-inset ring-ink-200 transition-colors hover:ring-ink-300"
                    @click="draft.status = draft.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'"
                  >
                    <span>
                      <span class="block text-[13.5px] font-semibold text-ink-900">Hisob holati</span>
                      <span class="block text-[12px] text-ink-500">
                        Nofaol hisob tizimga kira olmaydi
                      </span>
                    </span>
                    <span
                      class="inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs font-semibold ring-1 ring-inset"
                      :class="
                        draft.status === 'ACTIVE'
                          ? 'bg-ok-50 text-ok-700 ring-ok-100'
                          : 'bg-ink-100 text-ink-700 ring-ink-200'
                      "
                    >
                      {{ draft.status === 'ACTIVE' ? 'Faol' : 'Nofaol' }}
                    </span>
                  </button>

                  <button
                    type="button"
                    class="flex w-full items-center justify-between gap-3 rounded-field px-4 py-3 text-left ring-1 ring-inset ring-ink-200 transition-colors hover:ring-ink-300"
                    @click="draft.notifyInApp = !draft.notifyInApp"
                  >
                    <span class="text-[13.5px] font-semibold text-ink-900">Tizim ichidagi bildirishnomalar</span>
                    <span
                      class="inline-flex h-6 w-11 shrink-0 items-center rounded-pill p-0.5 transition-colors"
                      :class="draft.notifyInApp ? 'bg-brand-500' : 'bg-ink-300'"
                    >
                      <span
                        class="size-5 rounded-full bg-white transition-transform"
                        :class="draft.notifyInApp ? 'translate-x-5' : ''"
                      />
                    </span>
                  </button>

                  <button
                    type="button"
                    class="flex w-full items-center justify-between gap-3 rounded-field px-4 py-3 text-left ring-1 ring-inset ring-ink-200 transition-colors hover:ring-ink-300"
                    @click="draft.notifyDigest = !draft.notifyDigest"
                  >
                    <span>
                      <span class="block text-[13.5px] font-semibold text-ink-900">Kunlik hisobot xulosasi</span>
                      <span class="block text-[12px] text-ink-500">Tizim ichida ko‘rsatiladi</span>
                    </span>
                    <span
                      class="inline-flex h-6 w-11 shrink-0 items-center rounded-pill p-0.5 transition-colors"
                      :class="draft.notifyDigest ? 'bg-brand-500' : 'bg-ink-300'"
                    >
                      <span
                        class="size-5 rounded-full bg-white transition-transform"
                        :class="draft.notifyDigest ? 'translate-x-5' : ''"
                      />
                    </span>
                  </button>
                </div>

                <UiField
                  label="Interfeys tili"
                  hint="Shu hisob uchun boshlang‘ich til, egasi uni o‘z profilida o‘zgartira oladi"
                >
                  <UiSelect
                    v-model="draft.language"
                    :options="[
                      { value: 'uz', label: 'O‘zbekcha' },
                      { value: 'ru', label: 'Русский' },
                    ]"
                  />
                </UiField>
              </template>
            </div>

            <footer class="flex items-center justify-end gap-3 border-t border-ink-200 bg-surface-sunken px-6 py-4">
              <UiButton variant="ghost" @click="editOpen = false">Bekor qilish</UiButton>
              <UiButton :disabled="!draftValid" @click="saveEdit">Saqlash</UiButton>
            </footer>
          </aside>
        </div>
      </Transition>
    </Teleport>

    <UiModal
      v-model="addOpen"
      title="Foydalanuvchi qo‘shish"
      subtitle="Yangi hisob yaratiladi va ro‘yxatga qo‘shiladi"
    >
      <div class="space-y-4">
        <UiField
          label="F.I.Sh."
          required
          :error="addTouched && addForm.fullName.trim().length < 3 ? 'Kamida 3 ta belgi kiriting' : ''"
        >
          <UiInput v-model="addForm.fullName" placeholder="Masalan: Anvar Sobirov" />
        </UiField>

        <div class="grid gap-4 sm:grid-cols-2">
          <UiField
            label="Email"
            required
            :error="addTouched && !/.+@.+\..+/.test(addForm.email) ? 'To‘g‘ri email kiriting' : ''"
          >
            <UiInput v-model="addForm.email" type="email" placeholder="a.sobirov@makon.uz" />
          </UiField>
          <UiField label="Telefon">
            <UiInput v-model="addForm.phone" placeholder="+998 90 000 00 00" />
          </UiField>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <UiField label="Lavozim">
            <UiInput v-model="addForm.position" placeholder="Masalan: Obyekt rahbari" />
          </UiField>
          <UiField label="Rol" required>
            <UiSelect
              v-model="addForm.role"
              :options="ROLES.map((r) => ({ value: r, label: ROLE_META[r].label }))"
            />
          </UiField>
        </div>

        <div>
          <p class="mb-2 text-[13px] font-semibold text-ink-700">Obyekt biriktirish</p>
          <label class="mb-2 flex cursor-pointer items-center gap-2.5 text-[13px] text-ink-700">
            <input
              type="radio"
              class="size-4 accent-brand-500"
              :checked="addForm.scopeAll"
              @change="setAddScopeAll(true)"
            />
            Barcha obyektlar
          </label>
          <label class="mb-2 flex cursor-pointer items-center gap-2.5 text-[13px] text-ink-700">
            <input
              type="radio"
              class="size-4 accent-brand-500"
              :checked="!addForm.scopeAll"
              @change="setAddScopeAll(false)"
            />
            Tanlangan obyekt
          </label>

          <div class="grid gap-1.5 sm:grid-cols-2">
            <label
              v-for="b in buildingOptions"
              :key="b.value"
              class="flex cursor-pointer items-center gap-2.5 rounded-field px-3 py-2 text-[13px] ring-1 ring-inset transition-colors"
              :class="
                addForm.buildings.includes(b.value)
                  ? 'bg-brand-50/60 text-ink-900 ring-brand-200'
                  : 'text-ink-700 ring-ink-200 hover:ring-ink-300'
              "
            >
              <input
                type="checkbox"
                class="size-4 shrink-0 accent-brand-500"
                :checked="addForm.buildings.includes(b.value)"
                @change="toggleAddBuilding(b.value)"
              />
              <span class="truncate">{{ b.label }}</span>
            </label>
          </div>
        </div>
      </div>

      <template #footer>
        <UiButton variant="ghost" @click="addOpen = false">Bekor qilish</UiButton>
        <UiButton @click="submitAdd">
          <UiIcon name="plus" :size="16" />
          Qo‘shish
        </UiButton>
      </template>
    </UiModal>
  </main>
</template>
