<script setup lang="ts">
import { CONTRACTS } from '~/data/business'
import { dateShort, sum } from '~/utils/format'

const auth = useAuthStore()

const organization = computed(() => auth.user?.organization ?? 'Urban Office MCHJ')
const myContract = CONTRACTS.find((c) => c.code === 'MKON-2025-0158')!

type CabinetDocument = {
  id: string
  name: string
  code: string
  category: 'Shartnoma' | 'Dalolatnoma' | 'Hisob-faktura' | 'Qoidalar'
  unitCode: string
  format: 'PDF' | 'XLSX' | 'DOCX'
  size: string
  at: string
  summary: string
}

const DOCUMENTS: CabinetDocument[] = [
  {
    id: 'doc-01',
    name: 'Ijara shartnomasi',
    code: 'MKON-2025-0158',
    category: 'Shartnoma',
    unitCode: '501',
    format: 'PDF',
    size: '2.4 MB',
    at: '2025-05-18',
    summary: 'Unit 501 bo‘yicha asosiy ijara shartnomasi, tomonlar tomonidan tasdiqlangan.',
  },
  {
    id: 'doc-02',
    name: 'Ijara shartnomasi',
    code: 'MKON-2025-0161',
    category: 'Shartnoma',
    unitCode: '501',
    format: 'PDF',
    size: '2.1 MB',
    at: '2025-04-02',
    summary: 'Unit 501 bo‘yicha ijara shartnomasi, oylik oldindan to‘lov shartlari bilan.',
  },
  {
    id: 'doc-03',
    name: 'To‘lov jadvali',
    code: 'MKON-2025-0158',
    category: 'Shartnoma',
    unitCode: '501',
    format: 'XLSX',
    size: '340 KB',
    at: '2025-05-18',
    summary: 'Shartnoma muddati davomidagi oylik to‘lovlar jadvali.',
  },
  {
    id: 'doc-04',
    name: 'Qabul-topshirish akti',
    code: 'DLT-2025-0158',
    category: 'Dalolatnoma',
    unitCode: '501',
    format: 'PDF',
    size: '1.1 MB',
    at: '2025-05-18',
    summary: 'Unit egalikka topshirilganda tuzilgan qabul-topshirish dalolatnomasi.',
  },
  {
    id: 'doc-05',
    name: 'Hisoblagich ko‘rsatkichlari dalolatnomasi',
    code: 'DLT-2025-0166',
    category: 'Dalolatnoma',
    unitCode: '501',
    format: 'PDF',
    size: '780 KB',
    at: '2025-05-18',
    summary: 'Suv, elektr va issiqlik hisoblagichlarining boshlang‘ich ko‘rsatkichlari.',
  },
  {
    id: 'doc-06',
    name: 'Jihozlar ro‘yxati dalolatnomasi',
    code: 'DLT-2025-0159',
    category: 'Dalolatnoma',
    unitCode: '501',
    format: 'DOCX',
    size: '460 KB',
    at: '2025-04-02',
    summary: 'Unit bilan birga topshirilgan jihozlar ro‘yxati va holati.',
  },
  {
    id: 'doc-07',
    name: 'Hisob-faktura',
    code: 'INV-2025-0621',
    category: 'Hisob-faktura',
    unitCode: '501',
    format: 'PDF',
    size: '210 KB',
    at: '2025-05-01',
    summary: 'May 2025 davri uchun ijara va kommunal xizmatlar hisob-fakturasi.',
  },
  {
    id: 'doc-08',
    name: 'Hisob-faktura',
    code: 'INV-2025-0605',
    category: 'Hisob-faktura',
    unitCode: '501',
    format: 'PDF',
    size: '208 KB',
    at: '2025-05-01',
    summary: 'May 2025 davri uchun Unit 501 bo‘yicha hisob-faktura.',
  },
  {
    id: 'doc-09',
    name: 'Hisob-faktura',
    code: 'INV-2025-0512',
    category: 'Hisob-faktura',
    unitCode: '501',
    format: 'PDF',
    size: '206 KB',
    at: '2025-04-01',
    summary: 'Aprel 2025 davri uchun hisob-faktura, to‘liq to‘langan.',
  },
  {
    id: 'doc-10',
    name: 'Bino ichki tartib-qoidalari',
    code: 'QDL-2025-0007',
    category: 'Qoidalar',
    unitCode: 'Umumiy',
    format: 'PDF',
    size: '640 KB',
    at: '2025-01-15',
    summary: 'Ish vaqti, kirish tartibi, umumiy zonalardan foydalanish qoidalari.',
  },
  {
    id: 'doc-11',
    name: 'Yong‘in xavfsizligi yo‘riqnomasi',
    code: 'QDL-2025-0011',
    category: 'Qoidalar',
    unitCode: 'Umumiy',
    format: 'PDF',
    size: '520 KB',
    at: '2025-01-15',
    summary: 'Evakuatsiya rejasi va yong‘in xavfsizligi bo‘yicha talablar.',
  },
  {
    id: 'doc-12',
    name: 'To‘lov rekvizitlari',
    code: 'REK-2025-0044',
    category: 'Qoidalar',
    unitCode: 'Umumiy',
    format: 'PDF',
    size: '320 KB',
    at: '2025-01-15',
    summary: 'Bank rekvizitlari va to‘lov topshiriqnomasini to‘ldirish tartibi.',
  },
]

const CATEGORY_TONE: Record<string, string> = {
  Shartnoma: 'bg-brand-50 text-brand-600',
  Dalolatnoma: 'bg-info-50 text-info-600',
  'Hisob-faktura': 'bg-ok-50 text-ok-600',
  Qoidalar: 'bg-warn-50 text-warn-600',
}

const category = ref('all')
const format = ref('all')
const query = ref('')

const categoryTabs = computed(() => [
  { value: 'all', label: 'Barchasi', count: DOCUMENTS.length },
  {
    value: 'Shartnoma',
    label: 'Shartnoma',
    count: DOCUMENTS.filter((d) => d.category === 'Shartnoma').length,
  },
  {
    value: 'Dalolatnoma',
    label: 'Dalolatnoma',
    count: DOCUMENTS.filter((d) => d.category === 'Dalolatnoma').length,
  },
  {
    value: 'Hisob-faktura',
    label: 'Hisob-faktura',
    count: DOCUMENTS.filter((d) => d.category === 'Hisob-faktura').length,
  },
  {
    value: 'Qoidalar',
    label: 'Qoidalar',
    count: DOCUMENTS.filter((d) => d.category === 'Qoidalar').length,
  },
])

const formatOptions = [
  { value: 'all', label: 'Barcha formatlar' },
  { value: 'PDF', label: 'PDF' },
  { value: 'XLSX', label: 'XLSX' },
  { value: 'DOCX', label: 'DOCX' },
]

const filtered = computed(() =>
  DOCUMENTS.filter((d) => {
    const byCategory = category.value === 'all' || d.category === category.value
    const byFormat = format.value === 'all' || d.format === format.value
    const q = query.value.trim().toLowerCase()
    const byQuery =
      !q ||
      d.name.toLowerCase().includes(q) ||
      d.code.toLowerCase().includes(q) ||
      d.summary.toLowerCase().includes(q)
    return byCategory && byFormat && byQuery
  }),
)

const columns = [
  { key: 'name', label: 'Hujjat nomi' },
  { key: 'category', label: 'Kategoriya' },
  { key: 'unitCode', label: 'Unit' },
  { key: 'format', label: 'Format' },
  { key: 'size', label: 'Hajmi', align: 'right' as const },
  { key: 'at', label: 'Sana', align: 'right' as const },
  { key: 'actions', label: 'Amallar', align: 'right' as const },
]

const previewOpen = ref(false)
const downloadOpen = ref(false)
const downloadReady = ref(false)
const selected = ref<CabinetDocument | null>(null)

function openPreview(d: CabinetDocument) {
  selected.value = d
  previewOpen.value = true
}

function openDownload(d: CabinetDocument) {
  selected.value = d
  downloadReady.value = false
  downloadOpen.value = true
}

function docById(id: unknown) {
  return DOCUMENTS.find((d) => d.id === id)!
}
</script>

<template>
  <AppTopbar
    title="Hujjatlarim"
    subtitle="Shartnomalar, dalolatnomalar, hisob-fakturalar va qoidalar"
    :breadcrumb="[{ label: 'Kabinet', to: '/cabinet' }, { label: 'Hujjatlarim' }]"
  >
    <template #actions>
      <UiButton variant="secondary" size="sm" to="/cabinet/invoices">
        <UiIcon name="wallet" :size="16" />
        To‘lovlarim
      </UiButton>
      <UiButton size="sm" to="/cabinet/units">
        <UiIcon name="building" :size="16" />
        Mening unitlarim
      </UiButton>
    </template>
  </AppTopbar>

  <main class="scroll-slim flex-1 space-y-5 overflow-y-auto p-6">
    <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <button
        v-for="t in categoryTabs.slice(1)"
        :key="t.value"
        type="button"
        class="rounded-card bg-surface p-4 text-left shadow-card ring-1 transition-all hover:shadow-panel"
        :class="category === t.value ? 'ring-2 ring-brand-500' : 'ring-ink-200/60 hover:ring-brand-300'"
        @click="category = category === t.value ? 'all' : t.value"
      >
        <div class="flex items-start justify-between gap-3">
          <span class="grid size-10 place-items-center rounded-[10px]" :class="CATEGORY_TONE[t.value]">
            <UiIcon name="doc" :size="19" />
          </span>
          <span class="tabular text-[22px] font-bold leading-none text-ink-900">{{ t.count }}</span>
        </div>
        <p class="mt-3 text-[13.5px] font-semibold text-ink-900">{{ t.label }}</p>
        <p class="mt-0.5 text-[12px] text-ink-500">Kategoriya bo‘yicha saralash</p>
      </button>
    </section>

    <UiCard
      title="Hujjatlar ro‘yxati"
      :subtitle="`${organization} · ${filtered.length} ta hujjat`"
      flush
    >
      <div class="flex flex-wrap items-center gap-3 px-5 pb-4">
        <UiTabs v-model="category" :tabs="categoryTabs" />
        <UiSelect v-model="format" :options="formatOptions" size="sm" class="w-44" />
        <UiInput v-model="query" placeholder="Hujjat nomi yoki raqami bo‘yicha qidirish" class="w-full sm:w-80">
          <template #prefix><UiIcon name="search" :size="16" /></template>
        </UiInput>
      </div>

      <UiTable
        :columns="columns"
        :rows="filtered"
        empty="Tanlangan filtr bo‘yicha hujjat topilmadi"
        @row-click="(row) => openPreview(docById(row.id))"
      >
        <template #cell-name="{ row }">
          <span class="flex items-center gap-3">
            <span
              class="grid size-9 shrink-0 place-items-center rounded-[10px]"
              :class="CATEGORY_TONE[String(row.category)]"
            >
              <UiIcon name="doc" :size="17" />
            </span>
            <span class="min-w-0">
              <span class="block truncate text-[13.5px] font-semibold text-ink-900">{{ row.name }}</span>
              <span class="tabular block truncate text-[12px] text-ink-500">{{ row.code }}</span>
            </span>
          </span>
        </template>
        <template #cell-category="{ value }">
          <span class="rounded-pill bg-ink-100 px-2.5 py-1 text-[12px] font-semibold text-ink-700">
            {{ value }}
          </span>
        </template>
        <template #cell-unitCode="{ value }">
          <span class="text-[13px]">{{ value === 'Umumiy' ? 'Umumiy' : `Unit ${value}` }}</span>
        </template>
        <template #cell-format="{ value }">
          <span class="tabular text-[12.5px] font-semibold text-ink-700">{{ value }}</span>
        </template>
        <template #cell-at="{ value }">
          <span class="tabular text-[13px]">{{ dateShort(String(value)) }}</span>
        </template>
        <template #cell-actions="{ row }">
          <span class="flex items-center justify-end gap-1.5">
            <button
              type="button"
              class="grid size-9 place-items-center rounded-field text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-800"
              :aria-label="`${row.name}, ko‘rish`"
              @click.stop="openPreview(docById(row.id))"
            >
              <UiIcon name="eye" :size="17" />
            </button>
            <button
              type="button"
              class="grid size-9 place-items-center rounded-field text-brand-600 transition-colors hover:bg-brand-50"
              :aria-label="`${row.name}, yuklab olish`"
              @click.stop="openDownload(docById(row.id))"
            >
              <UiIcon name="download" :size="17" />
            </button>
          </span>
        </template>
      </UiTable>
    </UiCard>
  </main>

  <UiModal
    v-model="previewOpen"
    :title="selected?.name ?? 'Hujjat'"
    :subtitle="selected ? `${selected.code} · ${selected.format} · ${selected.size}` : ''"
    size="lg"
  >
    <div v-if="selected" class="space-y-4">
      <p class="text-[13px] text-ink-600">{{ selected.summary }}</p>

      <div class="rounded-field bg-white p-6 ring-1 ring-ink-200">
        <div class="flex items-start justify-between gap-6 border-b border-ink-200 pb-4">
          <div>
            <span class="text-brand-600"><AppLogo size="sm" mono /></span>
            <p class="mt-2 text-[12px] text-ink-500">Makon Property Group</p>
          </div>
          <div class="text-right">
            <p class="text-[15px] font-bold text-ink-900">{{ selected.name }}</p>
            <p class="tabular text-[12.5px] font-semibold text-ink-600">{{ selected.code }}</p>
            <p class="tabular text-[12px] text-ink-500">{{ dateShort(selected.at) }}</p>
          </div>
        </div>

        <dl class="grid gap-3 py-4 sm:grid-cols-2">
          <div>
            <dt class="text-[11.5px] uppercase tracking-wide text-ink-500">Ijarachi</dt>
            <dd class="text-[13.5px] font-semibold text-ink-900">{{ organization }}</dd>
          </div>
          <div>
            <dt class="text-[11.5px] uppercase tracking-wide text-ink-500">Obyekt</dt>
            <dd class="text-[13.5px] font-semibold text-ink-900">
              Green Business Center
              <template v-if="selected.unitCode !== 'Umumiy'"> · Unit {{ selected.unitCode }}</template>
            </dd>
          </div>
          <div v-if="selected.category === 'Shartnoma'">
            <dt class="text-[11.5px] uppercase tracking-wide text-ink-500">Amal qilish muddati</dt>
            <dd class="tabular text-[13.5px] font-semibold text-ink-900">
              {{ dateShort(myContract.startsAt) }} · {{ dateShort(myContract.endsAt) }}
            </dd>
          </div>
          <div v-if="selected.category === 'Shartnoma'">
            <dt class="text-[11.5px] uppercase tracking-wide text-ink-500">Shartnoma summasi</dt>
            <dd class="tabular text-[13.5px] font-semibold text-ink-900">{{ sum(myContract.amount) }}</dd>
          </div>
          <div v-if="selected.category === 'Hisob-faktura'">
            <dt class="text-[11.5px] uppercase tracking-wide text-ink-500">To‘lov shartlari</dt>
            <dd class="text-[13.5px] font-semibold text-ink-900">{{ myContract.paymentTerm }}</dd>
          </div>
          <div>
            <dt class="text-[11.5px] uppercase tracking-wide text-ink-500">Hujjat holati</dt>
            <dd><UiStatus kind="contract" value="SIGNED" size="sm" /></dd>
          </div>
        </dl>

        <div class="border-t border-ink-200 pt-4">
          <p class="text-[13px] leading-relaxed text-ink-700">{{ selected.summary }}</p>
          <p class="mt-2 text-[13px] leading-relaxed text-ink-700">
            Hujjat tomonlar tomonidan tasdiqlangan va tizim arxivida saqlanadi. Nusxasini yuklab
            olish yoki chop etish mumkin.
          </p>
        </div>

        <div class="mt-8 grid grid-cols-2 gap-6 text-[12px] text-ink-500">
          <div>
            <p class="border-b border-ink-300 pb-6">Ijaraga beruvchi</p>
            <p class="mt-1">Imzo va muhr</p>
          </div>
          <div>
            <p class="border-b border-ink-300 pb-6">Ijarachi</p>
            <p class="mt-1">Imzo va muhr</p>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <UiButton variant="ghost" @click="previewOpen = false">Yopish</UiButton>
      <UiButton
        variant="secondary"
        @click="
          () => {
            previewOpen = false
            if (selected) openDownload(selected)
          }
        "
      >
        <UiIcon name="download" :size="16" />
        Yuklab olish
      </UiButton>
    </template>
  </UiModal>

  <UiModal
    v-model="downloadOpen"
    title="Hujjatni yuklab olish"
    :subtitle="selected ? selected.name : ''"
    size="sm"
  >
    <div v-if="selected" class="space-y-4">
      <div class="flex items-center gap-3.5 rounded-field bg-surface-sunken p-4 ring-1 ring-ink-200">
        <span
          class="grid size-12 shrink-0 place-items-center rounded-field"
          :class="CATEGORY_TONE[selected.category]"
        >
          <UiIcon name="doc" :size="24" />
        </span>
        <span class="min-w-0">
          <span class="block truncate text-[13.5px] font-semibold text-ink-900">
            {{ selected.code }}.{{ selected.format.toLowerCase() }}
          </span>
          <span class="block text-[12px] text-ink-500">
            {{ selected.format }} · {{ selected.size }} · {{ dateShort(selected.at) }}
          </span>
        </span>
      </div>

      <p v-if="!downloadReady" class="text-[13px] text-ink-600">
        Hujjat nusxasi tayyorlanadi va brauzeringiz orqali saqlanadi.
      </p>
      <p v-else class="flex items-center gap-2 text-[13px] font-semibold text-ok-700">
        <UiIcon name="check" :size="16" />
        Hujjat yuklab olishga tayyor.
      </p>
    </div>

    <template #footer>
      <UiButton variant="ghost" @click="downloadOpen = false">Yopish</UiButton>
      <UiButton :disabled="downloadReady" @click="downloadReady = true">
        <UiIcon name="download" :size="16" />
        Yuklab olish
      </UiButton>
    </template>
  </UiModal>
</template>
