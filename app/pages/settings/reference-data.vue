<script setup lang="ts">
import { UNIT_STATUS } from '~/constants/statuses'

const SETTINGS_TABS = [
  { label: 'Foydalanuvchilar', to: '/settings/users', icon: 'users' },
  { label: 'Rollar va huquqlar', to: '/settings/roles', icon: 'shield' },
  { label: 'Integratsiyalar', to: '/settings/integrations', icon: 'globe' },
  { label: 'Ma’lumotnomalar', to: '/settings/reference-data', icon: 'layers' },
  { label: 'Tizim sozlamalari', to: '/settings/system', icon: 'gear' },
  { label: 'Audit jurnali', to: '/settings/audit', icon: 'clipboard' },
]
const CURRENT_TAB = '/settings/reference-data'

const CATEGORY_META: Record<string, { label: string; badge: string }> = {
  buildings: { label: 'Binolar', badge: 'bg-ok-50 text-ok-700 ring-ok-100' },
  units: { label: 'Unitlar', badge: 'bg-brand-50 text-brand-700 ring-brand-200' },
  services: { label: 'Xizmatlar', badge: 'bg-info-50 text-info-700 ring-info-100' },
  tariffs: { label: 'Tariflar', badge: 'bg-teal-50 text-teal-700 ring-teal-200' },
  equipment: { label: 'Uskunalar', badge: 'bg-warn-50 text-warn-700 ring-warn-100' },
  floors: { label: 'Qavatlar', badge: 'bg-ink-100 text-ink-700 ring-ink-200' },
  statuses: { label: 'Statuslar', badge: 'bg-danger-50 text-danger-700 ring-danger-100' },
}

/** Ro‘yxatda kutilmagan turkum uchrasa ham nishoncha ko‘rinishda qoladi */
const CATEGORY_FALLBACK = { label: 'Turkumsiz', badge: 'bg-ink-100 text-ink-700 ring-ink-200' }

function categoryMeta(category: string) {
  return CATEGORY_META[category] ?? CATEGORY_FALLBACK
}

/**
 * Unit statuslari ma’lumotnomasi status registridan olinadi: kod sifatida
 * tizim ishlatadigan haqiqiy belgi ko‘rsatiladi, nomi esa boshqa ekranlar
 * bilan bir xil bo‘ladi.
 */
const UNIT_STATUS_RECORDS = Object.entries(UNIT_STATUS).map(([code, def]) => ({
  code,
  label: def.label,
}))

const GROUPS: Record<string, string[]> = {
  all: Object.keys(CATEGORY_META),
  building: ['buildings', 'units'],
  service: ['services'],
  tariff: ['tariffs'],
  equipment: ['equipment'],
  floor: ['floors'],
  status: ['statuses'],
}

interface RefRecord {
  code: string
  label: string
}

interface RefEntry {
  id: string
  name: string
  nameRu: string
  nameEn: string
  category: string
  code: string
  description: string
  status: 'ACTIVE' | 'ARCHIVED'
  updatedAt: string
  updatedBy: string
  icon: string
  records: RefRecord[]
}

const entries = ref<RefEntry[]>([
  {
    id: 'rd-01',
    name: 'Binolar turlari',
    nameRu: 'Типы зданий',
    nameEn: 'Building Types',
    category: 'buildings',
    code: 'BLD_TYPE',
    description: 'Turli xil bino turlarining klassifikatori',
    status: 'ACTIVE',
    updatedAt: '18.05.2025 10:24',
    updatedBy: 'Jahongir Alimov',
    icon: 'building',
    records: [
      { code: 'BT-01', label: 'Biznes markaz' },
      { code: 'BT-02', label: 'Savdo markaz' },
      { code: 'BT-03', label: 'Ombor / logistika' },
      { code: 'BT-04', label: 'Turar joy' },
      { code: 'BT-05', label: 'Ofis binosi' },
    ],
  },
  {
    id: 'rd-02',
    name: 'Bo‘sh unit toifalari',
    nameRu: 'Категории свободных юнитов',
    nameEn: 'Vacant Unit Categories',
    category: 'units',
    code: 'UNIT_CAT',
    description: 'Bo‘sh unitlar toifalari va o‘lchov birliklari',
    status: 'ACTIVE',
    updatedAt: '18.05.2025 09:41',
    updatedBy: 'Dilshod Karimov',
    icon: 'cube',
    records: [
      { code: 'UC-01', label: 'Ofis maydoni' },
      { code: 'UC-02', label: 'Savdo maydoni' },
      { code: 'UC-03', label: 'Ombor maydoni' },
      { code: 'UC-04', label: 'Turar joy' },
      { code: 'UC-05', label: 'Parking o‘rni' },
    ],
  },
  {
    id: 'rd-03',
    name: 'Xizmat turlari',
    nameRu: 'Типы услуг',
    nameEn: 'Service Types',
    category: 'services',
    code: 'SRV_CAT',
    description: 'Ko‘rsatiladigan xizmatlar klassifikatori',
    status: 'ACTIVE',
    updatedAt: '18.05.2025 09:12',
    updatedBy: 'Otabek Rahimov',
    icon: 'wrench',
    records: [
      { code: 'SC-01', label: 'Elektr ta’minoti' },
      { code: 'SC-02', label: 'Suv ta’minoti' },
      { code: 'SC-03', label: 'Isitish va sovitish' },
      { code: 'SC-04', label: 'Tozalash xizmati' },
      { code: 'SC-05', label: 'Qo‘riqlash xizmati' },
      { code: 'SC-06', label: 'Lift xizmati' },
    ],
  },
  {
    id: 'rd-04',
    name: 'Tarif jadvallari',
    nameRu: 'Тарифные таблицы',
    nameEn: 'Tariff Tables',
    category: 'tariffs',
    code: 'TARIFF_TAB',
    description: 'Tarif rejalari va narx jadvallari',
    status: 'ACTIVE',
    updatedAt: '17.05.2025 18:30',
    updatedBy: 'Sevara Yusupova',
    icon: 'wallet',
    records: [
      { code: 'TR-01', label: 'Elektr energiyasi (kVt-soat)' },
      { code: 'TR-02', label: 'Suv ta’minoti (m³)' },
      { code: 'TR-03', label: 'Issiqlik ta’minoti (Gkal)' },
      { code: 'TR-04', label: 'Boshqaruv xizmati (m²)' },
      { code: 'TR-05', label: 'Tozalash xizmati (m²)' },
    ],
  },
  {
    id: 'rd-05',
    name: 'Uskuna turlari',
    nameRu: 'Типы оборудования',
    nameEn: 'Equipment Types',
    category: 'equipment',
    code: 'EQP_TYPE',
    description: 'Bino uskunalari va texnikalar turlari',
    status: 'ACTIVE',
    updatedAt: '17.05.2025 16:08',
    updatedBy: 'Sardor Yo‘ldoshev',
    icon: 'box',
    records: [
      { code: 'EQ-01', label: 'Lift' },
      { code: 'EQ-02', label: 'Eskalator' },
      { code: 'EQ-03', label: 'Generator' },
      { code: 'EQ-04', label: 'Yong‘in signalizatsiyasi' },
      { code: 'EQ-05', label: 'Suv nasosi' },
      { code: 'EQ-06', label: 'Videokuzatuv (CCTV)' },
      { code: 'EQ-07', label: 'Havo tozalash tizimi' },
    ],
  },
  {
    id: 'rd-06',
    name: 'Qavat belgilari',
    nameRu: 'Обозначения этажей',
    nameEn: 'Floor Labels',
    category: 'floors',
    code: 'FLR_LABEL',
    description: 'Qavatlar nomi va belgilar klassifikatori',
    status: 'ACTIVE',
    updatedAt: '15.05.2025 11:02',
    updatedBy: 'Bobur Ismoilov',
    icon: 'layers',
    records: [
      { code: 'FL-B2', label: 'Yerto‘la −2' },
      { code: 'FL-B1', label: 'Yerto‘la −1' },
      { code: 'FL-00', label: 'Zamin qavat' },
      { code: 'FL-01', label: '1-qavat' },
      { code: 'FL-TP', label: 'Tipovoy qavat' },
      { code: 'FL-TX', label: 'Texnik qavat' },
    ],
  },
  {
    id: 'rd-07',
    name: 'Statuslar katalogi',
    nameRu: 'Каталог статусов',
    nameEn: 'Status Catalog',
    category: 'statuses',
    code: 'STATUS_CAT',
    description: 'Tizimdagi statuslar va ularning holatlari',
    status: 'ACTIVE',
    updatedAt: '15.05.2025 10:22',
    updatedBy: 'Jahongir Alimov',
    icon: 'clipboard',
    records: UNIT_STATUS_RECORDS,
  },
])

const activeGroup = ref('all')
const search = ref('')
const statusFilter = ref('all')

const groupTabs = computed(() => [
  { value: 'all', label: 'Barchasi', count: entries.value.length },
  { value: 'building', label: 'Binolar va birliklar', count: countOf('building') },
  { value: 'service', label: 'Xizmatlar', count: countOf('service') },
  { value: 'tariff', label: 'Tariflar va to‘lovlar', count: countOf('tariff') },
  { value: 'equipment', label: 'Uskunalar', count: countOf('equipment') },
  { value: 'floor', label: 'Qavatlar', count: countOf('floor') },
  { value: 'status', label: 'Statuslar', count: countOf('status') },
])

function countOf(group: string) {
  return entries.value.filter((e) => GROUPS[group]!.includes(e.category)).length
}

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return entries.value.filter((e) => {
    const inGroup = GROUPS[activeGroup.value]!.includes(e.category)
    const matchQ =
      !q ||
      e.name.toLowerCase().includes(q) ||
      e.code.toLowerCase().includes(q) ||
      e.description.toLowerCase().includes(q)
    const matchStatus = statusFilter.value === 'all' || e.status === statusFilter.value
    return inGroup && matchQ && matchStatus
  })
})

const columns = [
  { key: 'name', label: 'Nomi' },
  { key: 'category', label: 'Turkum' },
  { key: 'code', label: 'Kod' },
  { key: 'description', label: 'Tavsif' },
  { key: 'status', label: 'Status' },
  { key: 'updatedAt', label: 'Oxirgi yangilangan', align: 'right' as const },
  { key: 'actions', label: 'Amallar', align: 'right' as const, width: '96px' },
]

const stats = computed(() => {
  const activeEntries = entries.value.filter((e) => e.status === 'ACTIVE')
  return {
    total: entries.value.length,
    activeRecords: activeEntries.reduce((s, e) => s + e.records.length, 0),
    archived: entries.value.filter((e) => e.status === 'ARCHIVED').length,
  }
})

const addedCount = ref(9)
const changedCount = ref(14)

const activity = ref([
  { id: 'af-01', title: 'Tarif jadvallari yangilandi', who: 'Jahongir Alimov', when: '2 soat oldin', icon: 'wallet' },
  { id: 'af-02', title: 'Xizmat turlari qo‘shildi', who: 'Otabek Rahimov', when: '5 soat oldin', icon: 'wrench' },
  { id: 'af-03', title: 'Unit toifasi o‘zgartirildi', who: 'Dilshod Karimov', when: '1 kun oldin', icon: 'cube' },
  { id: 'af-04', title: 'Status yangi qo‘shildi', who: 'Sevara Yusupova', when: '2 kun oldin', icon: 'clipboard' },
])

function logActivity(title: string, icon: string) {
  activity.value.unshift({
    id: `af-${activity.value.length + 5}`,
    title,
    who: 'Jahongir Alimov',
    when: 'Hozirgina',
    icon,
  })
  if (activity.value.length > 8) activity.value.pop()
}

const panelOpen = ref(false)

/** Boshqa dialoglar kabi Escape bilan yopiladi */
onKeyStroke('Escape', () => {
  if (panelOpen.value) panelOpen.value = false
})

const panelTab = ref('general')
const panelTabs = [
  { value: 'general', label: 'Umumiy ma’lumot' },
  { value: 'records', label: 'Yozuvlar ro‘yxati' },
]

const draft = reactive({
  id: '',
  name: '',
  nameRu: '',
  nameEn: '',
  category: 'buildings',
  code: '',
  description: '',
  status: 'ACTIVE' as 'ACTIVE' | 'ARCHIVED',
})

const draftRecords = ref<RefRecord[]>([])

const categoryOptions = Object.entries(CATEGORY_META).map(([value, meta]) => ({
  value,
  label: meta.label,
}))

const statusOptions = [
  { value: 'ACTIVE', label: 'Faol' },
  { value: 'ARCHIVED', label: 'Arxivlangan' },
]

const filterStatusOptions = [{ value: 'all', label: 'Barcha statuslar' }, ...statusOptions]

function openPanel(row: Record<string, unknown>) {
  const e = entries.value.find((x) => x.id === row.id)
  if (!e) return
  draft.id = e.id
  draft.name = e.name
  draft.nameRu = e.nameRu
  draft.nameEn = e.nameEn
  draft.category = e.category
  draft.code = e.code
  draft.description = e.description
  draft.status = e.status
  draftRecords.value = e.records.map((r) => ({ ...r }))
  actionResult.value = ''
  panelTab.value = 'general'
  panelOpen.value = true
}

const draftValid = computed(() => draft.name.trim().length > 2 && draft.code.trim().length > 2)

const flash = ref('')

function savePanel() {
  if (!draftValid.value) return
  const i = entries.value.findIndex((e) => e.id === draft.id)
  if (i === -1) return
  entries.value[i] = {
    ...entries.value[i]!,
    name: draft.name.trim(),
    nameRu: draft.nameRu.trim(),
    nameEn: draft.nameEn.trim(),
    category: draft.category,
    code: draft.code.trim().toUpperCase(),
    description: draft.description.trim(),
    status: draft.status,
    records: draftRecords.value.map((r) => ({ ...r })),
    updatedAt: 'Hozirgina',
    updatedBy: 'Jahongir Alimov',
  }
  changedCount.value += 1
  logActivity(`«${draft.name.trim()}» ma’lumotnomasi yangilandi`, 'edit')
  flash.value = `«${draft.name.trim()}» saqlandi.`
  panelOpen.value = false
}

const archiveOpen = ref(false)

function confirmArchive() {
  draft.status = 'ARCHIVED'
  const i = entries.value.findIndex((e) => e.id === draft.id)
  if (i !== -1) {
    entries.value[i] = { ...entries.value[i]!, status: 'ARCHIVED', updatedAt: 'Hozirgina' }
  }
  logActivity(`«${draft.name}» arxivlandi`, 'box')
  flash.value = `«${draft.name}» arxivga o‘tkazildi.`
  archiveOpen.value = false
  panelOpen.value = false
}

const recordOpen = ref(false)
const newRecord = reactive({ code: '', label: '' })
const recordTouched = ref(false)
const recordError = ref('')

function openRecordForm() {
  newRecord.code = ''
  newRecord.label = ''
  recordTouched.value = false
  recordError.value = ''
  recordOpen.value = true
}

function submitRecord() {
  recordTouched.value = true
  recordError.value = ''
  if (!newRecord.code.trim() || !newRecord.label.trim()) return
  const code = newRecord.code.trim().toUpperCase()
  if (draftRecords.value.some((r) => r.code === code)) {
    recordError.value = 'Bu kod allaqachon mavjud'
    return
  }
  draftRecords.value.push({
    code,
    label: newRecord.label.trim(),
  })
  addedCount.value += 1
  logActivity(`«${draft.name}» ga yangi yozuv qo‘shildi`, 'plus')
  recordOpen.value = false
  panelTab.value = 'records'
}

function removeRecord(code: string) {
  draftRecords.value = draftRecords.value.filter((r) => r.code !== code)
}

const actionOpen = ref(false)
const actionInfo = reactive({ key: '', title: '', text: '', confirmLabel: 'Tasdiqlash' })

const QUICK_ACTIONS = [
  { key: 'import', label: 'Excel’dan import qilish', icon: 'upload', tone: 'text-brand-600 bg-brand-50' },
  { key: 'template', label: 'Shablon yuklab olish', icon: 'doc', tone: 'text-teal-700 bg-teal-50' },
  { key: 'export', label: 'Eksport (Excel)', icon: 'download', tone: 'text-ok-700 bg-ok-50' },
  { key: 'recount', label: 'Yozuvlar sonini yangilash', icon: 'refresh', tone: 'text-info-700 bg-info-50' },
]

function openAction(key: string) {
  actionInfo.key = key
  if (key === 'import') {
    actionInfo.title = 'Excel’dan import qilish'
    actionInfo.text = `«${draft.name}» ma’lumotnomasiga yozuvlar Excel faylidan yuklanadi. Fayl ustunlari shablon bilan mos bo‘lishi kerak: kod va nomi.`
    actionInfo.confirmLabel = 'Importni boshlash'
  } else if (key === 'template') {
    actionInfo.title = 'Shablon yuklab olish'
    actionInfo.text = `«${draft.code}» kodi uchun to‘ldirish shabloni (XLSX) tayyorlanadi.`
    actionInfo.confirmLabel = 'Yuklab olish'
  } else if (key === 'export') {
    actionInfo.title = 'Eksport (Excel)'
    actionInfo.text = `«${draft.name}» ma’lumotnomasidagi ${draftRecords.value.length} ta yozuv XLSX ko‘rinishida eksport qilinadi.`
    actionInfo.confirmLabel = 'Eksport qilish'
  } else {
    actionInfo.title = 'Yozuvlar sonini yangilash'
    actionInfo.text = 'Ma’lumotnoma bo‘yicha yozuvlar soni qayta hisoblanadi va ro‘yxatda yangilanadi.'
    actionInfo.confirmLabel = 'Qayta hisoblash'
  }
  actionOpen.value = true
}

const actionResult = ref('')

function confirmAction() {
  if (actionInfo.key === 'recount') {
    actionResult.value = `Qayta hisoblandi: ${draftRecords.value.length} ta yozuv.`
  } else if (actionInfo.key === 'import') {
    actionResult.value = 'Import navbatga qo‘yildi, fayl yuklangach yozuvlar qo‘shiladi.'
  } else if (actionInfo.key === 'template') {
    actionResult.value = `Shablon tayyorlandi: ${draft.code}_shablon.xlsx`
  } else {
    actionResult.value = `Eksport tayyorlandi: ${draft.code}.xlsx (${draftRecords.value.length} ta yozuv)`
  }
  logActivity(`${actionInfo.title}, «${draft.name}»`, 'refresh')
  actionOpen.value = false
}
</script>

<template>
  <AppTopbar
    title="Ma’lumotnomalar va klassifikatorlar"
    subtitle="Tizim ma’lumotnomalari, kodlari va yozuvlarini boshqarish"
    :breadcrumb="[{ label: 'Sozlamalar', to: '/settings/users' }, { label: 'Ma’lumotnomalar' }]"
  >
    <template #actions>
      <UiButton variant="secondary" size="sm" to="/settings/audit">
        <UiIcon name="clipboard" :size="16" />
        Audit jurnali
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
        class="shrink-0 rounded-[6px] p-1 transition-colors hover:bg-ok-100"
        aria-label="Xabarni yopish"
        @click="flash = ''"
      >
        <UiIcon name="x" :size="15" />
      </button>
    </div>

    <div class="scroll-slim -mx-1 overflow-x-auto px-1 pb-1">
      <UiTabs v-model="activeGroup" :tabs="groupTabs" />
    </div>

    <UiCard
      title="Ma’lumotnomalar ro‘yxati"
      :subtitle="`Ko‘rsatilmoqda: ${filtered.length} / ${entries.length} ta`"
      flush
    >
      <div class="grid gap-3 px-5 pb-4 sm:grid-cols-[minmax(0,1fr)_220px]">
        <UiInput v-model="search" placeholder="Nomi, kodi yoki tavsifi bo‘yicha qidirish">
          <template #prefix><UiIcon name="search" :size="17" /></template>
        </UiInput>
        <UiSelect v-model="statusFilter" :options="filterStatusOptions" />
      </div>

      <UiTable
        :columns="columns"
        :rows="filtered"
        empty="Bu turkumda ma’lumotnoma topilmadi"
        @row-click="openPanel"
      >
        <template #cell-name="{ row }">
          <span class="flex items-center gap-3">
            <span class="grid size-9 shrink-0 place-items-center rounded-[10px] bg-brand-50 text-brand-600">
              <UiIcon :name="row.icon" :size="18" />
            </span>
            <span class="min-w-0">
              <span class="block truncate text-[14px] font-semibold text-ink-900">{{ row.name }}</span>
              <span class="tabular block text-[12px] text-ink-500">
                {{ row.records.length }} ta yozuv
              </span>
            </span>
          </span>
        </template>

        <template #cell-category="{ row }">
          <span
            class="inline-flex items-center rounded-pill px-2.5 py-1 text-xs font-semibold ring-1 ring-inset"
            :class="categoryMeta(row.category).badge"
          >
            {{ categoryMeta(row.category).label }}
          </span>
        </template>

        <template #cell-code="{ row }">
          <span class="tabular rounded-[6px] bg-ink-100 px-2 py-1 text-[12px] font-semibold text-ink-700">
            {{ row.code }}
          </span>
        </template>

        <template #cell-description="{ row }">
          <span class="block max-w-[24rem] truncate text-[13px] text-ink-600">
            {{ row.description }}
          </span>
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
            <svg class="size-3 shrink-0" viewBox="0 0 12 12" aria-hidden="true">
              <circle v-if="row.status === 'ACTIVE'" cx="6" cy="6" r="4" fill="currentColor" />
              <rect v-else x="2.4" y="2.4" width="7.2" height="7.2" rx="1.6" fill="currentColor" />
            </svg>
            {{ row.status === 'ACTIVE' ? 'Faol' : 'Arxivlangan' }}
          </span>
        </template>

        <template #cell-updatedAt="{ row }">
          <span class="tabular block text-[13px] text-ink-700">{{ row.updatedAt }}</span>
          <span class="block text-[12px] text-ink-500">{{ row.updatedBy }}</span>
        </template>

        <template #cell-actions="{ row }">
          <button
            type="button"
            class="inline-flex items-center gap-1.5 rounded-[8px] px-2.5 py-1.5 text-[13px] font-semibold text-brand-600 transition-colors hover:bg-brand-50"
            @click.stop="openPanel(row)"
          >
            <UiIcon name="edit" :size="15" />
            Ochish
          </button>
        </template>
      </UiTable>
    </UiCard>

    <section class="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <UiCard title="Tezkor statistika" subtitle="Ma’lumotnomalar bo‘yicha joriy holat">
        <dl class="grid gap-4 sm:grid-cols-3 xl:grid-cols-5">
          <div class="rounded-field p-4 ring-1 ring-ink-200">
            <dt class="text-[12px] text-ink-500">Jami ma’lumotnomalar</dt>
            <dd class="tabular mt-1.5 text-[22px] font-bold leading-none text-ink-900">
              {{ stats.total }}
            </dd>
          </div>
          <div class="rounded-field p-4 ring-1 ring-ink-200">
            <dt class="text-[12px] text-ink-500">Faol yozuvlar</dt>
            <dd class="tabular mt-1.5 text-[22px] font-bold leading-none text-ok-600">
              {{ stats.activeRecords }}
            </dd>
          </div>
          <div class="rounded-field p-4 ring-1 ring-ink-200">
            <dt class="text-[12px] text-ink-500">Yangi qo‘shilgan</dt>
            <dd class="tabular mt-1.5 text-[22px] font-bold leading-none text-brand-600">
              {{ addedCount }}
            </dd>
          </div>
          <div class="rounded-field p-4 ring-1 ring-ink-200">
            <dt class="text-[12px] text-ink-500">O‘zgartirilgan</dt>
            <dd class="tabular mt-1.5 text-[22px] font-bold leading-none text-info-600">
              {{ changedCount }}
            </dd>
          </div>
          <div class="rounded-field p-4 ring-1 ring-ink-200">
            <dt class="text-[12px] text-ink-500">Arxivlangan</dt>
            <dd class="tabular mt-1.5 text-[22px] font-bold leading-none text-ink-700">
              {{ stats.archived }}
            </dd>
          </div>
        </dl>

        <p v-if="actionResult" class="mt-4 flex items-center gap-2 rounded-field bg-brand-50 px-3.5 py-2.5 text-[13px] text-brand-800">
          <UiIcon name="info" :size="16" />
          {{ actionResult }}
        </p>
      </UiCard>

      <UiCard title="So‘nggi faoliyat" subtitle="Ma’lumotnomalar bo‘yicha o‘zgarishlar" flush>
        <ul class="divide-y divide-ink-100">
          <li v-for="a in activity" :key="a.id" class="flex items-center gap-3.5 px-5 py-3">
            <span class="grid size-9 shrink-0 place-items-center rounded-[10px] bg-brand-50 text-brand-600">
              <UiIcon :name="a.icon" :size="17" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-[13px] font-semibold text-ink-900">{{ a.title }}</span>
              <span class="block truncate text-[12px] text-ink-500">{{ a.who }} • {{ a.when }}</span>
            </span>
          </li>
        </ul>
      </UiCard>
    </section>

    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-150 ease-out"
        enter-from-class="opacity-0"
        leave-active-class="transition duration-100 ease-in"
        leave-to-class="opacity-0"
      >
        <div
          v-if="panelOpen"
          class="fixed inset-0 z-50 flex justify-end bg-ink-900/40 backdrop-blur-[2px]"
          @click.self="panelOpen = false"
        >
          <aside
            class="flex h-full w-full max-w-lg flex-col bg-surface shadow-pop"
            role="dialog"
            aria-modal="true"
            aria-label="Ma’lumotnoma tahrirlash"
          >
            <header class="flex items-start justify-between gap-4 border-b border-ink-200 px-6 py-5">
              <div class="min-w-0">
                <h2 class="truncate text-lg font-bold text-ink-900">{{ draft.name }}</h2>
                <p class="tabular mt-0.5 text-[13px] text-ink-500">{{ draft.code }}</p>
              </div>
              <button
                type="button"
                class="-mr-1 -mt-1 rounded-lg p-2 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
                aria-label="Yopish"
                @click="panelOpen = false"
              >
                <UiIcon name="x" :size="18" />
              </button>
            </header>

            <div class="px-6 pt-4">
              <UiTabs v-model="panelTab" :tabs="panelTabs" variant="line" />
            </div>

            <div class="scroll-slim flex-1 space-y-5 overflow-y-auto px-6 py-5">
              <template v-if="panelTab === 'general'">
                <UiField label="Nomi" required :error="draft.name.trim().length > 2 ? '' : 'Kamida 3 ta belgi'">
                  <UiInput v-model="draft.name" />
                </UiField>

                <div class="grid gap-4 sm:grid-cols-2">
                  <UiField label="Kod" required :error="draft.code.trim().length > 2 ? '' : 'Kamida 3 ta belgi'">
                    <UiInput v-model="draft.code" />
                  </UiField>
                  <UiField label="Turkum">
                    <UiSelect v-model="draft.category" :options="categoryOptions" />
                  </UiField>
                </div>

                <UiField label="Status">
                  <UiSelect v-model="draft.status" :options="statusOptions" />
                </UiField>

                <UiField label="Tavsif">
                  <textarea
                    v-model="draft.description"
                    rows="3"
                    class="w-full rounded-field bg-white px-3.5 py-2.5 text-sm text-ink-800 ring-1 ring-inset ring-ink-200 transition-colors placeholder:text-ink-400 hover:ring-ink-300 focus:ring-2 focus:ring-brand-500"
                    placeholder="Ma’lumotnoma vazifasini qisqacha yozing"
                  />
                </UiField>

                <div>
                  <p class="mb-2.5 text-[13px] font-semibold text-ink-700">Ko‘p tildagi nomlar</p>
                  <div class="space-y-3">
                    <UiField label="O‘zbekcha">
                      <UiInput v-model="draft.name" />
                    </UiField>
                    <UiField label="Русский">
                      <UiInput v-model="draft.nameRu" />
                    </UiField>
                    <UiField label="English">
                      <UiInput v-model="draft.nameEn" />
                    </UiField>
                  </div>
                </div>

                <div>
                  <p class="mb-2.5 text-[13px] font-semibold text-ink-700">Tezkor amallar</p>
                  <ul class="space-y-1.5">
                    <li>
                      <button
                        type="button"
                        class="flex w-full items-center gap-3 rounded-field px-3 py-2.5 text-left ring-1 ring-inset ring-ink-200 transition-colors hover:ring-brand-300"
                        @click="openRecordForm"
                      >
                        <span class="grid size-8 shrink-0 place-items-center rounded-[8px] bg-brand-50 text-brand-600">
                          <UiIcon name="plus" :size="16" />
                        </span>
                        <span class="flex-1 text-[13px] font-semibold text-ink-800">
                          Yangi yozuv qo‘shish
                        </span>
                        <UiIcon name="chevronRight" :size="16" class="text-ink-400" />
                      </button>
                    </li>
                    <li v-for="qa in QUICK_ACTIONS" :key="qa.key">
                      <button
                        type="button"
                        class="flex w-full items-center gap-3 rounded-field px-3 py-2.5 text-left ring-1 ring-inset ring-ink-200 transition-colors hover:ring-brand-300"
                        @click="openAction(qa.key)"
                      >
                        <span class="grid size-8 shrink-0 place-items-center rounded-[8px]" :class="qa.tone">
                          <UiIcon :name="qa.icon" :size="16" />
                        </span>
                        <span class="flex-1 text-[13px] font-semibold text-ink-800">{{ qa.label }}</span>
                        <UiIcon name="chevronRight" :size="16" class="text-ink-400" />
                      </button>
                    </li>
                  </ul>
                  <p
                    v-if="actionResult"
                    class="mt-2.5 flex items-start gap-2 rounded-field bg-brand-50 px-3.5 py-2.5 text-[13px] text-brand-800"
                  >
                    <UiIcon name="info" :size="16" class="mt-0.5 shrink-0" />
                    {{ actionResult }}
                  </p>
                </div>
              </template>

              <template v-else>
                <div class="flex items-center justify-between gap-3">
                  <p class="text-[13px] font-semibold text-ink-700">
                    Yozuvlar: {{ draftRecords.length }} ta
                  </p>
                  <UiButton variant="secondary" size="sm" @click="openRecordForm">
                    <UiIcon name="plus" :size="15" />
                    Qo‘shish
                  </UiButton>
                </div>

                <ul class="divide-y divide-ink-100 rounded-field ring-1 ring-ink-200">
                  <li
                    v-if="!draftRecords.length"
                    class="px-4 py-8 text-center text-[13px] text-ink-500"
                  >
                    Yozuvlar yo‘q: «Qo‘shish» tugmasi orqali kiriting.
                  </li>
                  <li
                    v-for="r in draftRecords"
                    :key="r.code"
                    class="flex items-center gap-3 px-4 py-2.5"
                  >
                    <span class="tabular shrink-0 rounded-[6px] bg-ink-100 px-2 py-1 text-[12px] font-semibold text-ink-700">
                      {{ r.code }}
                    </span>
                    <span class="min-w-0 flex-1 truncate text-[13px] text-ink-800">{{ r.label }}</span>
                    <button
                      type="button"
                      class="shrink-0 rounded-[6px] p-1.5 text-ink-400 transition-colors hover:bg-danger-50 hover:text-danger-600"
                      :aria-label="`${r.label} yozuvini olib tashlash`"
                      @click="removeRecord(r.code)"
                    >
                      <UiIcon name="trash" :size="16" />
                    </button>
                  </li>
                </ul>

                <p class="text-[12px] leading-relaxed text-ink-500">
                  O‘zgarishlar «Saqlash» tugmasi bosilgandan keyin ma’lumotnomaga yoziladi.
                </p>
              </template>
            </div>

            <footer class="flex items-center justify-between gap-3 border-t border-ink-200 bg-surface-sunken px-6 py-4">
              <UiButton variant="danger" size="sm" @click="archiveOpen = true">
                <UiIcon name="box" :size="16" />
                Arxivlash
              </UiButton>
              <span class="flex gap-3">
                <UiButton variant="ghost" @click="panelOpen = false">Bekor qilish</UiButton>
                <UiButton :disabled="!draftValid" @click="savePanel">Saqlash</UiButton>
              </span>
            </footer>
          </aside>
        </div>
      </Transition>
    </Teleport>

    <UiModal v-model="recordOpen" title="Yangi yozuv qo‘shish" size="sm">
      <div class="space-y-4">
        <UiField
          label="Kod"
          required
          :error="recordError || (recordTouched && !newRecord.code.trim() ? 'Kod majburiy' : '')"
        >
          <UiInput v-model="newRecord.code" placeholder="Masalan: BT-06" />
        </UiField>
        <UiField
          label="Nomi"
          required
          :error="recordTouched && !newRecord.label.trim() ? 'Nomi majburiy' : ''"
        >
          <UiInput v-model="newRecord.label" placeholder="Yozuv nomi" />
        </UiField>
      </div>
      <template #footer>
        <UiButton variant="ghost" @click="recordOpen = false">Bekor qilish</UiButton>
        <UiButton @click="submitRecord">Qo‘shish</UiButton>
      </template>
    </UiModal>

    <UiModal v-model="actionOpen" :title="actionInfo.title" size="sm">
      <p class="text-[14px] leading-relaxed text-ink-700">{{ actionInfo.text }}</p>
      <template #footer>
        <UiButton variant="ghost" @click="actionOpen = false">Bekor qilish</UiButton>
        <UiButton @click="confirmAction">{{ actionInfo.confirmLabel }}</UiButton>
      </template>
    </UiModal>

    <UiModal
      v-model="archiveOpen"
      title="Ma’lumotnomani arxivlash"
      subtitle="Arxivlangan ma’lumotnoma yangi yozuvlarda tanlanmaydi"
      size="sm"
    >
      <p class="text-[14px] leading-relaxed text-ink-700">
        «{{ draft.name }}» ({{ draft.code }}) arxivga o‘tkaziladi. Mavjud yozuvlar saqlanadi, ammo
        ma’lumotnoma yangi shakllarni to‘ldirishda ko‘rinmaydi.
      </p>
      <template #footer>
        <UiButton variant="ghost" @click="archiveOpen = false">Bekor qilish</UiButton>
        <UiButton variant="danger" @click="confirmArchive">Arxivlash</UiButton>
      </template>
    </UiModal>
  </main>
</template>
