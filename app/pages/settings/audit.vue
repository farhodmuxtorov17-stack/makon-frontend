<script setup lang="ts">
import { ROLE_META, ROLE_TONE_CLASSES } from '~/constants/roles'
import { ROLES, type Role } from '~/types/rbac'
import { dateShort, todayIso } from '~/utils/format'
import { csvBlob, docxBlob, fileSlug, saveBlob } from '~/utils/docx'

const SETTINGS_TABS = [
  { label: 'Foydalanuvchilar', to: '/settings/users', icon: 'users' },
  { label: 'Rollar va huquqlar', to: '/settings/roles', icon: 'shield' },
  { label: 'Integratsiyalar', to: '/settings/integrations', icon: 'globe' },
  { label: 'Ma’lumotnomalar', to: '/settings/reference-data', icon: 'layers' },
  { label: 'Tizim sozlamalari', to: '/settings/system', icon: 'gear' },
  { label: 'Audit jurnali', to: '/settings/audit', icon: 'clipboard' },
]
const CURRENT_TAB = '/settings/audit'

interface DiffLine {
  field: string
  before: string
  after: string
}

interface AuditEvent {
  id: string
  date: string
  time: string
  user: string
  role: Role
  module: string
  action: string
  object: string
  result: 'SUCCESS' | 'ERROR'
  ip: string
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
    object: 'Xavfsizlik siyosatlari',
    result: 'SUCCESS',
    ip: '10.0.14.22',
    detail: 'Kirish siyosatlari yangilandi va barcha faol seanslarga qo‘llandi.',
    diff: [
      { field: 'Ikki bosqichli autentifikatsiya', before: 'O‘chirilgan', after: 'Yoqilgan' },
      { field: 'Seans muddati', before: '30 daqiqa', after: '15 daqiqa' },
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
    object: 'INV-2025-0412',
    result: 'SUCCESS',
    ip: '10.0.14.31',
    detail: 'Hisob-faktura to‘lovi tasdiqlandi va yopildi.',
    diff: [
      { field: 'Status', before: 'Qisman to‘langan', after: 'To‘langan' },
      { field: 'To‘langan summa', before: '18 400 000 so‘m', after: '24 600 000 so‘m' },
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
    object: 'Mega Mall / Unit MM-214',
    result: 'SUCCESS',
    ip: '10.0.21.9',
    detail: 'Unit maydoni va ijara narxi qayta kiritildi.',
    diff: [
      { field: 'Maydon', before: '118.40 m²', after: '124.60 m²' },
      { field: 'Ijara narxi', before: '9 200 000 so‘m', after: '9 850 000 so‘m' },
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
    object: 'Malika Tosheva',
    result: 'SUCCESS',
    ip: '10.0.14.22',
    detail: 'Foydalanuvchi roli va obyekt biriktirilishi yangilandi.',
    diff: [
      { field: 'Rol', before: 'Bino rahbari', after: 'Buxgalter' },
      { field: 'Obyekt biriktirish', before: 'Mega Mall', after: 'Green Business Center, Harmony Residence' },
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
    object: 'Veb interfeys',
    result: 'ERROR',
    ip: '84.54.72.118',
    detail: 'Parol uch marta noto‘g‘ri kiritildi, hisob vaqtincha bloklandi.',
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
    object: 'Tarif jadvallari (TARIFF_TAB)',
    result: 'SUCCESS',
    ip: '10.0.14.31',
    detail: 'Kommunal tarif qiymatlari yangi davr uchun yangilandi.',
    diff: [
      { field: 'Elektr energiyasi', before: '1 180 so‘m / kVt-soat', after: '1 250 so‘m / kVt-soat' },
      { field: 'Amal qilish sanasi', before: '02.07.2026', after: '01.08.2026' },
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
    object: 'SH-2025-0148',
    result: 'SUCCESS',
    ip: '10.0.33.7',
    detail: 'Shartnoma tizim ichida tasdiqlandi va faol holatga o‘tdi.',
    diff: [
      { field: 'Status', before: 'Kelishilmoqda', after: 'Imzolangan' },
      { field: 'Tasdiqlagan shaxs', before: '-', after: 'Nigora Aripova' },
      { field: 'Tasdiqlash sanasi', before: '-', after: '17.08.2026' },
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
    object: 'SR-2025-0921',
    result: 'SUCCESS',
    ip: '10.0.44.15',
    detail: 'Servis arizasi holati yakuniy bosqichga o‘tkazildi.',
    diff: [
      { field: 'Status', before: 'Jarayonda', after: 'Bajarilgan' },
      { field: 'Sarflangan vaqt', before: '3.5 soat', after: '5.0 soat' },
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
    object: 'Ijara to‘lovlari hisoboti',
    result: 'SUCCESS',
    ip: '213.230.98.44',
    detail: 'Kabinet orqali shaxsiy to‘lovlar hisoboti PDF ko‘rinishida yuklab olindi.',
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
    object: 'INV-2025-0407',
    result: 'SUCCESS',
    ip: '10.0.14.44',
    detail: 'Yangi hisob-faktura shakllantirildi va ijarachiga yuborildi.',
    diff: [
      { field: 'Summa', before: '-', after: '31 200 000 so‘m' },
      { field: 'To‘lov muddati', before: '-', after: '25.08.2026' },
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
    object: 'MT-2025-0096',
    result: 'SUCCESS',
    ip: '10.0.52.3',
    detail: 'Material so‘rovi tasdiqlandi va omborga berish uchun yuborildi.',
    diff: [{ field: 'Status', before: 'Yuborilgan', after: 'Tasdiqlangan' }],
  },
  {
    id: 'log-0173',
    date: '2026-08-16',
    time: '09:33:10',
    user: 'Rustam Qodirov',
    role: 'TENANT_OWNER',
    module: 'Autentifikatsiya',
    action: 'Kirish',
    object: 'Mobil ilova',
    result: 'ERROR',
    ip: '178.218.201.76',
    detail: 'Hisob nofaol holatda bo‘lgani uchun kirish rad etildi.',
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
    object: 'Sardor Yo‘ldoshev',
    result: 'SUCCESS',
    ip: '10.0.14.22',
    detail: 'Yangi foydalanuvchi yaratildi va texnik xizmat roliga biriktirildi.',
    diff: [
      { field: 'Rol', before: '-', after: 'Pudratchi / xo‘jalik bo‘limi' },
      { field: 'Obyekt biriktirish', before: '-', after: 'Green Business Center, Urban Office' },
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
    object: 'Telegram bildirishnoma kanali',
    result: 'SUCCESS',
    ip: '10.0.14.22',
    detail: 'Bildirishnoma kanalining yuborish jadvali o‘zgartirildi va ulanish qayta tekshirildi.',
    diff: [{ field: 'Yuborish jadvali', before: 'Har 6 soatda', after: 'Har kuni 02:00' }],
  },
  {
    id: 'log-0170',
    date: '2026-08-15',
    time: '11:02:37',
    user: 'Dilshod Karimov',
    role: 'BUILDING_MANAGER',
    module: 'Obyektlar',
    action: 'O‘chirish',
    object: 'Mega Mall / Unit MM-118 e’loni',
    result: 'SUCCESS',
    ip: '10.0.21.9',
    detail: 'Unit e’loni arxivga o‘tkazildi, unitning o‘zi saqlanib qoldi.',
    diff: [{ field: 'E’lon holati', before: 'E’lon qilingan', after: 'Arxivlangan' }],
  },
  {
    id: 'log-0169',
    date: '2026-08-15',
    time: '10:22:14',
    user: 'Sevara Yusupova',
    role: 'ACCOUNTANT',
    module: 'Hisobotlar',
    action: 'Eksport',
    object: 'Qarzdorlik detallashtirilgan hisoboti',
    result: 'SUCCESS',
    ip: '10.0.14.31',
    detail: 'Hisobot XLSX ko‘rinishida tayyorlandi va yuklab olindi.',
    diff: [],
  },
]

const MODULES = [...new Set(EVENTS.map((e) => e.module))].sort()
const ACTIONS = [...new Set(EVENTS.map((e) => e.action))].sort()
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

const userOptions = [{ value: 'all', label: 'Barcha foydalanuvchilar' }, ...USERS.map((u) => ({ value: u, label: u }))]
const roleOptions = [
  { value: 'all', label: 'Barcha rollar' },
  ...ROLES.map((r) => ({ value: r, label: ROLE_META[r].label })),
]
const moduleOptions = [{ value: 'all', label: 'Barcha modullar' }, ...MODULES.map((m) => ({ value: m, label: m }))]
const actionOptions = [{ value: 'all', label: 'Barcha amallar' }, ...ACTIONS.map((a) => ({ value: a, label: a }))]
const resultOptions = [
  { value: 'all', label: 'Barcha natijalar' },
  { value: 'SUCCESS', label: 'Muvaffaqiyatli' },
  { value: 'ERROR', label: 'Xatolik' },
]

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return EVENTS.filter((e) => {
    const matchQ =
      !q ||
      e.object.toLowerCase().includes(q) ||
      e.detail.toLowerCase().includes(q) ||
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

const columns = [
  { key: 'at', label: 'Vaqt' },
  { key: 'user', label: 'Foydalanuvchi' },
  { key: 'role', label: 'Rol' },
  { key: 'module', label: 'Modul' },
  { key: 'action', label: 'Amal' },
  { key: 'object', label: 'Obyekt' },
  { key: 'result', label: 'Natija' },
  { key: 'ip', label: 'IP', align: 'right' as const },
]

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
        { text: 'Audit jurnali', style: 'title' },
        { text: `${range} · ${filtered.value.length} ta yozuv`, style: 'subtitle' },
        ...filtered.value.map((e) => ({
          text: `${dateShort(e.date)} ${e.time} · ${e.user} (${ROLE_META[e.role].label}) · ${e.module} · ${e.action} · ${e.object} · ${e.result === 'SUCCESS' ? 'Muvaffaqiyatli' : 'Xato'} · ${e.ip}`,
          style: 'body' as const,
        })),
      ]),
      name,
    )
  } else {
    saveBlob(
      csvBlob([
        ['Sana', 'Vaqt', 'Foydalanuvchi', 'Rol', 'Modul', 'Amal', 'Obyekt', 'Natija', 'IP manzil'],
        ...filtered.value.map((e) => [
          dateShort(e.date),
          e.time,
          e.user,
          ROLE_META[e.role].label,
          e.module,
          e.action,
          e.object,
          e.result === 'SUCCESS' ? 'Muvaffaqiyatli' : 'Xato',
          e.ip,
        ]),
      ]),
      name,
    )
  }

  exportResult.value = `${name} yuklab olindi: ${filtered.value.length} ta yozuv (${range}).`
  exportOpen.value = false
}
</script>

<template>
  <AppTopbar
    title="Audit jurnali"
    subtitle="Tizimdagi barcha amallar qayd yozuvlari"
    :breadcrumb="[{ label: 'Sozlamalar', to: '/settings/users' }, { label: 'Audit jurnali' }]"
  >
    <template #actions>
      <UiButton variant="secondary" size="sm" @click="exportOpen = true">
        <UiIcon name="download" :size="16" />
        Eksport
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
      class="flex items-start gap-2.5 rounded-card bg-brand-50 px-4 py-3 text-[12.5px] leading-relaxed text-brand-800"
    >
      <UiIcon name="lock" :size="17" class="mt-0.5 shrink-0 text-brand-600" />
      <span>
        Audit yozuvlari faqat qo‘shiladi: ularni tahrirlash yoki o‘chirish mumkin emas. Har bir
        yozuv vaqt belgisi, foydalanuvchi va IP manzil bilan doimiy saqlanadi.
      </span>
    </div>

    <p v-if="exportResult" class="flex items-center gap-2 rounded-card bg-ok-50 px-4 py-3 text-[13px] text-ok-700 ring-1 ring-ok-100">
      <UiIcon name="check" :size="17" />
      {{ exportResult }}
    </p>

    <UiCard title="Filtrlar" subtitle="Jurnalni foydalanuvchi, modul va davr bo‘yicha toraytiring">
      <template #actions>
        <UiButton variant="ghost" size="sm" @click="resetFilters">Tozalash</UiButton>
      </template>

      <div class="grid gap-4 lg:grid-cols-3 2xl:grid-cols-4">
        <UiField label="Qidiruv">
          <UiInput v-model="search" placeholder="Obyekt, tavsif, IP yoki yozuv raqami">
            <template #prefix><UiIcon name="search" :size="17" /></template>
          </UiInput>
        </UiField>
        <UiField label="Foydalanuvchi">
          <UiSelect v-model="userFilter" :options="userOptions" />
        </UiField>
        <UiField label="Rol">
          <UiSelect v-model="roleFilter" :options="roleOptions" />
        </UiField>
        <UiField label="Modul">
          <UiSelect v-model="moduleFilter" :options="moduleOptions" />
        </UiField>
        <UiField label="Amal">
          <UiSelect v-model="actionFilter" :options="actionOptions" />
        </UiField>
        <UiField label="Natija">
          <UiSelect v-model="resultFilter" :options="resultOptions" />
        </UiField>
        <UiField label="Sana (dan)">
          <UiInput v-model="fromDate" type="date" />
        </UiField>
        <UiField label="Sana (gacha)">
          <UiInput v-model="toDate" type="date" />
        </UiField>
      </div>

      <div class="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-ink-100 pt-4 text-[12.5px]">
        <span class="tabular font-semibold text-ink-700">Topildi: {{ filtered.length }} ta yozuv</span>
        <span class="inline-flex items-center gap-1.5 text-ok-700">
          <UiIcon name="check" :size="14" />
          Muvaffaqiyatli: {{ successCount }}
        </span>
        <span class="inline-flex items-center gap-1.5 text-danger-700">
          <UiIcon name="x" :size="14" />
          Xatolik: {{ errorCount }}
        </span>
      </div>
    </UiCard>

    <UiCard title="Hodisalar ro‘yxati" subtitle="Qatorni bosing, to‘liq tafsilot va o‘zgarishlar" flush>
      <UiTable
        :columns="columns"
        :rows="filtered"
        empty="Filtrga mos yozuv topilmadi"
        @row-click="openDetail"
      >
        <template #cell-at="{ row }">
          <span class="tabular block text-[13px] font-semibold text-ink-900">
            {{ dateShort(row.date) }}
          </span>
          <span class="tabular block text-[11.5px] text-ink-500">{{ row.time }}</span>
        </template>

        <template #cell-user="{ row }">
          <span class="block text-[13px] font-semibold text-ink-900">{{ row.user }}</span>
          <span class="tabular block text-[11.5px] text-ink-500">{{ row.id }}</span>
        </template>

        <template #cell-role="{ row }">
          <span
            class="inline-flex items-center rounded-pill px-2.5 py-1 text-xs font-semibold ring-1 ring-inset"
            :class="ROLE_TONE_CLASSES[ROLE_META[row.role].tone]"
          >
            {{ ROLE_META[row.role].label }}
          </span>
        </template>

        <template #cell-module="{ row }">
          <span class="text-[13px] text-ink-700">{{ row.module }}</span>
        </template>

        <template #cell-action="{ row }">
          <span class="rounded-[6px] bg-ink-100 px-2 py-1 text-[12px] font-semibold text-ink-700">
            {{ row.action }}
          </span>
        </template>

        <template #cell-object="{ row }">
          <span class="block max-w-[18rem] truncate text-[13px] text-ink-700">{{ row.object }}</span>
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
            {{ row.result === 'SUCCESS' ? 'Muvaffaqiyatli' : 'Xatolik' }}
          </span>
        </template>

        <template #cell-ip="{ row }">
          <span class="tabular text-[12.5px] text-ink-600">{{ row.ip }}</span>
        </template>
      </UiTable>
    </UiCard>

    <UiModal
      v-model="detailOpen"
      title="Audit yozuvi tafsiloti"
      :subtitle="selected ? `${selected.id} • ${dateShort(selected.date)} ${selected.time}` : ''"
      size="lg"
    >
      <template v-if="selected">
        <dl class="grid gap-4 sm:grid-cols-2">
          <div>
            <dt class="text-[12px] text-ink-500">Foydalanuvchi</dt>
            <dd class="mt-1 text-[13.5px] font-semibold text-ink-900">{{ selected.user }}</dd>
          </div>
          <div>
            <dt class="text-[12px] text-ink-500">Rol</dt>
            <dd class="mt-1">
              <span
                class="inline-flex items-center rounded-pill px-2.5 py-1 text-xs font-semibold ring-1 ring-inset"
                :class="ROLE_TONE_CLASSES[ROLE_META[selected.role].tone]"
              >
                {{ ROLE_META[selected.role].label }}
              </span>
            </dd>
          </div>
          <div>
            <dt class="text-[12px] text-ink-500">Modul va amal</dt>
            <dd class="mt-1 text-[13.5px] font-semibold text-ink-900">
              {{ selected.module }} • {{ selected.action }}
            </dd>
          </div>
          <div>
            <dt class="text-[12px] text-ink-500">Obyekt</dt>
            <dd class="mt-1 text-[13.5px] font-semibold text-ink-900">{{ selected.object }}</dd>
          </div>
          <div>
            <dt class="text-[12px] text-ink-500">IP manzil</dt>
            <dd class="tabular mt-1 text-[13.5px] font-semibold text-ink-900">{{ selected.ip }}</dd>
          </div>
          <div>
            <dt class="text-[12px] text-ink-500">Natija</dt>
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
                {{ selected.result === 'SUCCESS' ? 'Muvaffaqiyatli' : 'Xatolik' }}
              </span>
            </dd>
          </div>
        </dl>

        <p class="mt-4 rounded-field bg-ink-50 px-4 py-3 text-[13px] leading-relaxed text-ink-700">
          {{ selected.detail }}
        </p>

        <div class="mt-5">
          <p class="text-[13px] font-semibold text-ink-700">O‘zgarishlar (oldingi / yangi qiymat)</p>

          <p v-if="!selected.diff.length" class="mt-2 text-[13px] text-ink-500">
            Bu hodisada maydon qiymatlari o‘zgarmagan, faqat amal fakti qayd etilgan.
          </p>

          <ul v-else class="mt-2.5 space-y-2.5">
            <li v-for="d in selected.diff" :key="d.field" class="rounded-field ring-1 ring-ink-200">
              <p class="border-b border-ink-100 px-4 py-2 text-[12.5px] font-semibold text-ink-700">
                {{ d.field }}
              </p>
              <div class="grid gap-px bg-ink-100 sm:grid-cols-2">
                <div class="bg-danger-50 px-4 py-3">
                  <p class="flex items-center gap-1.5 text-[11.5px] font-semibold text-danger-700">
                    <UiIcon name="arrowDown" :size="13" />
                    Oldingi qiymat
                  </p>
                  <p class="mt-1 text-[13px] text-ink-800">{{ d.before }}</p>
                </div>
                <div class="bg-ok-50 px-4 py-3">
                  <p class="flex items-center gap-1.5 text-[11.5px] font-semibold text-ok-700">
                    <UiIcon name="arrowUp" :size="13" />
                    Yangi qiymat
                  </p>
                  <p class="mt-1 text-[13px] text-ink-800">{{ d.after }}</p>
                </div>
              </div>
            </li>
          </ul>
        </div>

        <p class="mt-5 flex items-start gap-2 rounded-field bg-ink-50 px-3.5 py-3 text-[12px] text-ink-600">
          <UiIcon name="lock" :size="15" class="mt-0.5 shrink-0" />
          Yozuv o‘zgartirilmaydi va o‘chirilmaydi, audit jurnali faqat qo‘shiladigan rejimda
          ishlaydi.
        </p>
      </template>

      <template #footer>
        <UiButton variant="ghost" @click="detailOpen = false">Yopish</UiButton>
        <UiButton variant="secondary" @click="exportFromDetail">
          <UiIcon name="download" :size="16" />
          Eksport
        </UiButton>
      </template>
    </UiModal>

    <UiModal v-model="exportOpen" title="Audit jurnalini eksport qilish" size="sm">
      <p class="text-[13.5px] leading-relaxed text-ink-700">
        Joriy filtr bo‘yicha {{ filtered.length }} ta yozuv eksport qilinadi
        ({{ dateShort(fromDate) }} – {{ dateShort(toDate) }}).
      </p>

      <div class="mt-4">
        <p class="mb-2 text-[13px] font-semibold text-ink-700">Format</p>
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
        <UiButton variant="ghost" @click="exportOpen = false">Bekor qilish</UiButton>
        <UiButton @click="confirmExport">Eksport qilish</UiButton>
      </template>
    </UiModal>
  </main>
</template>
