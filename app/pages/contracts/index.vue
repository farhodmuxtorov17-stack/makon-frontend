<script setup lang="ts">
import AppTopbar from '~/components/layout/AppTopbar.vue'
import { BUILDINGS } from '~/data/buildings'
import { CONTRACTS, type Contract } from '~/data/business'
import { CONTRACT_STATUS } from '~/constants/statuses'
import { dateShort, num, sum, sumShort } from '~/utils/format'

const auth = useAuthStore()

/** Reyestr faqat foydalanuvchi biriktirilgan obyektlar bilan cheklanadi */
const scopedBuildings = computed(() => BUILDINGS.filter((b) => auth.inScope(b.id)))

const contracts = ref<Contract[]>(
  CONTRACTS.filter((c) => auth.inScope(c.buildingId)).map((c) => ({ ...c })),
)

const search = ref('')
const type = ref('all')
const status = ref('all')
const building = ref('all')
const stage = ref('all')
const banner = ref('')

function isApproved(c: Contract) {
  return c.timeline.some((t) => t.label === 'Imzolandi' && t.done)
}

const STAGE_MATCH: Record<string, (c: Contract) => boolean> = {
  created: (c) => c.status === 'DRAFT',
  agreed: (c) => c.status === 'REVIEW',
  signed: (c) => isApproved(c),
  active: (c) => c.status === 'ACTIVE',
}

const typeOptions = [
  { value: 'all', label: 'Shartnoma turi' },
  { value: 'Ijara', label: 'Ijara' },
  { value: 'Sotuv', label: 'Sotuv' },
]

const statusOptions = computed(() => [
  { value: 'all', label: 'Barcha statuslar' },
  ...Array.from(new Set(contracts.value.map((c) => c.status))).map((s) => ({
    value: s,
    label: CONTRACT_STATUS[s]?.label ?? s,
  })),
])

const buildingOptions = computed(() => [
  { value: 'all', label: 'Barcha obyektlar' },
  ...scopedBuildings.value.map((b) => ({ value: b.name, label: b.name })),
])

const filtered = computed(() =>
  contracts.value.filter((c) => {
    const q = search.value.trim().toLowerCase()
    const byQuery =
      !q || `${c.code} ${c.tenant} ${c.buildingName} ${c.unitCode}`.toLowerCase().includes(q)
    const byType = type.value === 'all' || c.type === type.value
    const byStatus = status.value === 'all' || c.status === status.value
    const byBuilding = building.value === 'all' || c.buildingName === building.value
    const byStage = stage.value === 'all' || (STAGE_MATCH[stage.value]?.(c) ?? true)
    return byQuery && byType && byStatus && byBuilding && byStage
  }),
)

const columns = [
  { key: 'code', label: 'Shartnoma №' },
  { key: 'type', label: 'Turi' },
  { key: 'tenant', label: 'Yuridik shaxs / Ijarachi' },
  { key: 'place', label: 'Obyekt + Unit' },
  { key: 'startsAt', label: 'Boshlanish' },
  { key: 'endsAt', label: 'Tugash' },
  { key: 'amount', label: 'Miqdor', align: 'right' as const, numeric: true },
  { key: 'status', label: 'Status' },
  { key: 'approval', label: 'Tasdiqlash' },
]

const rows = computed(() =>
  filtered.value.map((c) => {
    const approval = c.timeline.find((t) => t.label === 'Imzolandi')
    return {
      id: c.id,
      code: c.code,
      type: c.type,
      tenant: c.tenant,
      place: `${c.buildingName} · ${c.unitCode}`,
      startsAt: c.startsAt,
      endsAt: c.endsAt,
      amount: c.amount,
      status: c.status,
      approval: approval?.done ? approval.actor : '',
      approvalDate: approval?.done ? approval.date : '',
    }
  }),
)

function contractLink(row: Record<string, unknown>) {
  return `/contracts/${row.id}`
}

const totalValue = computed(() => filtered.value.reduce((s, c) => s + c.amount, 0))
const activeCount = computed(() => contracts.value.filter((c) => c.status === 'ACTIVE').length)
const reviewCount = computed(() =>
  contracts.value.filter((c) => c.status === 'REVIEW' || c.status === 'DRAFT').length,
)
const signedCount = computed(() => contracts.value.filter(isApproved).length)

function resetFilters() {
  search.value = ''
  type.value = 'all'
  status.value = 'all'
  building.value = 'all'
  stage.value = 'all'
}

const steps = computed(() =>
  [
    {
      key: 'created',
      label: 'Yaratildi',
      caption: 'Loyiha shakllantirildi',
      icon: 'clipboard',
    },
    {
      key: 'agreed',
      label: 'Kelishildi',
      caption: 'Tomonlar kelishuvi',
      icon: 'users',
    },
    {
      key: 'signed',
      label: 'Imzolandi',
      caption: 'Ichki tasdiqlash bajarildi',
      icon: 'edit',
    },
    {
      key: 'active',
      label: 'Faollashdi',
      caption: 'Tizimda faol',
      icon: 'check',
    },
  ].map((s) => ({
    ...s,
    count: contracts.value.filter((c) => STAGE_MATCH[s.key]?.(c) ?? false).length,
  })),
)

function applyStep(key: string) {
  stage.value = stage.value === key ? 'all' : key
  status.value = 'all'
}

const createOpen = ref(false)
const seq = ref(Math.max(...CONTRACTS.map((c) => Number(c.code.slice(-4)))))

const form = reactive({
  type: 'Ijara',
  tenant: '',
  building: scopedBuildings.value[0]?.name ?? BUILDINGS[0]!.name,
  unitCode: '',
  startsAt: '2025-06-01',
  endsAt: '2027-05-31',
  amount: '',
  paymentTerm: 'Oylik oldindan to‘lov',
})

const paymentTermOptions = [
  { value: 'Oylik oldindan to‘lov', label: 'Oylik oldindan to‘lov' },
  { value: 'Choraklik to‘lov', label: 'Choraklik to‘lov' },
  { value: 'Bir martalik to‘lov', label: 'Bir martalik to‘lov' },
]

const createValid = computed(() => form.tenant.trim().length > 2 && Number(form.amount) > 0)

function openCreate() {
  form.type = 'Ijara'
  form.tenant = ''
  form.building = scopedBuildings.value[0]?.name ?? BUILDINGS[0]!.name
  form.unitCode = ''
  form.startsAt = '2025-06-01'
  form.endsAt = '2027-05-31'
  form.amount = ''
  form.paymentTerm = 'Oylik oldindan to‘lov'
  createOpen.value = true
}

function createContract() {
  if (!createValid.value) return
  seq.value += 1
  const code = `MKON-2025-0${seq.value}`
  const created: Contract = {
    id: `c-0${seq.value}`,
    code,
    type: form.type === 'Sotuv' ? 'Sotuv' : 'Ijara',
    tenant: form.tenant.trim(),
    buildingId: BUILDINGS.find((b) => b.name === form.building)?.id ?? scopedBuildings.value[0]?.id ?? BUILDINGS[0]!.id,
    buildingName: form.building,
    unitCode: form.unitCode.trim() || 'Unit -',
    startsAt: form.startsAt,
    endsAt: form.type === 'Sotuv' ? '-' : form.endsAt,
    status: 'DRAFT',
    amount: Number(form.amount),
    paymentTerm: form.paymentTerm,
    documents: [{ name: 'Shartnoma loyihasi.pdf', size: '1.4 MB', type: 'pdf' }],
    timeline: [
      { label: 'Yaratildi', date: '2025-05-19', actor: 'Nilufar Rahimova', done: true },
      { label: 'Kelishildi', date: '-', actor: '-', done: false },
      { label: 'Imzolandi', date: '-', actor: '-', done: false },
      { label: 'Faollashdi', date: '-', actor: '-', done: false },
    ],
  }
  CONTRACTS.unshift(created)
  contracts.value = [...CONTRACTS]
  banner.value = `${code} shartnomasi loyiha holatida yaratildi.`
  createOpen.value = false
  resetFilters()
}
</script>

<template>
  <AppTopbar
    title="Shartnomalar reyestri"
    subtitle="Ijara va sotuv shartnomalari, ilovalar va tasdiqlash holati"
    :breadcrumb="[{ label: 'Shartnomalar' }]"
  >
    <template #actions>
      <UiButton variant="secondary" size="sm" to="/billing/invoices">
        <UiIcon name="wallet" :size="16" />
        Billing
      </UiButton>
      <UiButton size="sm" @click="openCreate">
        <UiIcon name="plus" :size="16" />
        Yangi shartnoma
      </UiButton>
    </template>
  </AppTopbar>

  <main class="scroll-slim flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
    <div
      v-if="banner"
      class="flex items-center gap-3 rounded-card bg-ok-50 px-4 py-3 ring-1 ring-ok-100"
    >
      <UiIcon name="check" :size="18" class="text-ok-600" />
      <p class="min-w-0 flex-1 text-[13px] font-medium text-ok-700">{{ banner }}</p>
      <button
        type="button"
        class="rounded-lg p-1 text-ok-700 transition-colors hover:bg-ok-100"
        aria-label="Xabarni yopish"
        @click="banner = ''"
      >
        <UiIcon name="x" :size="16" />
      </button>
    </div>

    <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <UiKpi
        label="Jami shartnomalar"
        :value="num(contracts.length)"
        unit="ta"
        icon="contract"
        tone="brand"
      />
      <UiKpi label="Faol shartnomalar" :value="num(activeCount)" unit="ta" icon="check" tone="ok" />
      <UiKpi
        label="Kelishuv bosqichida"
        :value="num(reviewCount)"
        unit="ta"
        icon="clock"
        tone="warn"
      />
      <UiKpi
        label="Tasdiqlangan shartnomalar"
        :value="num(signedCount)"
        unit="ta"
        icon="shield"
        tone="violet"
      />
    </section>

    <UiCard
      title="Shartnomalar reyestri"
      :subtitle="`Reyestrdagi umumiy qiymat: ${sumShort(totalValue)}`"
      flush
      :padded="false"
    >
      <div class="flex flex-wrap items-center gap-3 px-5 pb-4">
        <UiInput
          v-model="search"
          placeholder="Shartnoma raqami yoki ijarachi bo‘yicha qidirish"
          class="min-w-[240px] flex-1"
        >
          <template #prefix>
            <UiIcon name="search" :size="18" />
          </template>
        </UiInput>
        <UiSelect v-model="type" :options="typeOptions" class="w-full sm:w-44" />
        <UiSelect v-model="status" :options="statusOptions" class="w-full sm:w-48" />
        <UiSelect v-model="building" :options="buildingOptions" class="w-full sm:w-56" />
        <UiButton variant="ghost" @click="resetFilters">
          <UiIcon name="refresh" :size="16" />
          Tozalash
        </UiButton>
      </div>

      <UiTable
        :columns="columns"
        :rows="rows"
        :to="contractLink"
        empty="Tanlangan shartlarga mos shartnoma topilmadi"
      >
        <template #cell-code="{ row }">
          <span class="font-semibold text-brand-600">{{ row.code }}</span>
        </template>
        <template #cell-tenant="{ row }">
          <span class="font-semibold text-ink-900">{{ row.tenant }}</span>
        </template>
        <template #cell-place="{ row }">
          <span class="text-[13px] text-ink-600">{{ row.place }}</span>
        </template>
        <template #cell-startsAt="{ row }">{{ dateShort(String(row.startsAt)) }}</template>
        <template #cell-endsAt="{ row }">{{ dateShort(String(row.endsAt)) }}</template>
        <template #cell-amount="{ row }">{{ sum(Number(row.amount)) }}</template>
        <template #cell-status="{ row }">
          <UiStatus kind="contract" :value="String(row.status)" size="sm" />
        </template>
        <template #cell-approval="{ row }">
          <template v-if="row.approval">
            <span class="block text-[13px] font-semibold text-ink-900">{{ row.approval }}</span>
            <span class="tabular block text-[11.5px] text-ink-500">
              {{ dateShort(String(row.approvalDate)) }}
            </span>
          </template>
          <span v-else class="text-[12.5px] text-ink-500">Tasdiqlash kutilmoqda</span>
        </template>
      </UiTable>

      <div
        class="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 px-5 py-3.5"
      >
        <p class="text-[13px] text-ink-500">
          Jami: <b class="text-ink-800">{{ rows.length }} ta</b> shartnoma
        </p>
        <p class="text-[13px] text-ink-500">
          Qiymati: <b class="tabular text-ink-800">{{ sum(totalValue) }}</b>
        </p>
      </div>
    </UiCard>

    <UiCard
      title="Shartnoma holati bosqichlari"
      subtitle="Bosqichni bosing, reyestr shu bosqich bo‘yicha filtrlanadi"
    >
      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div v-for="(s, i) in steps" :key="s.key" class="flex items-center gap-3">
          <button
            type="button"
            class="flex min-w-0 flex-1 items-center gap-3 rounded-field p-3 text-left ring-1 transition-colors"
            :class="
              stage === s.key
                ? 'bg-brand-50/70 ring-brand-300'
                : 'ring-ink-200 hover:bg-brand-50/40 hover:ring-brand-200'
            "
            :aria-pressed="stage === s.key"
            @click="applyStep(s.key)"
          >
            <span class="grid size-10 shrink-0 place-items-center rounded-full bg-ok-50 text-ok-600">
              <UiIcon :name="s.icon" :size="18" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-[13.5px] font-bold text-ink-900">{{ s.label }}</span>
              <span class="block truncate text-[12px] text-ink-500">{{ s.caption }}</span>
            </span>
            <span class="tabular shrink-0 text-[13px] font-bold text-ink-700">{{ s.count }}</span>
          </button>
          <UiIcon
            v-if="i < steps.length - 1"
            name="arrowRight"
            :size="18"
            class="hidden shrink-0 text-ink-300 xl:block"
          />
        </div>
      </div>
    </UiCard>

    <UiModal
      v-model="createOpen"
      title="Yangi shartnoma"
      subtitle="Shartnoma loyiha holatida yaratiladi va kelishuvga yuboriladi"
    >
      <div class="grid gap-4 sm:grid-cols-2">
        <UiField label="Shartnoma turi" required>
          <UiSelect
            v-model="form.type"
            :options="[
              { value: 'Ijara', label: 'Ijara' },
              { value: 'Sotuv', label: 'Sotuv' },
            ]"
          />
        </UiField>
        <UiField label="To‘lov shakli" required>
          <UiSelect v-model="form.paymentTerm" :options="paymentTermOptions" />
        </UiField>
        <UiField label="Yuridik shaxs / Ijarachi" required class="sm:col-span-2">
          <UiInput v-model="form.tenant" placeholder="Tashkilot nomi" />
        </UiField>
        <UiField label="Obyekt" required>
          <UiSelect
            v-model="form.building"
            :options="scopedBuildings.map((b) => ({ value: b.name, label: b.name }))"
          />
        </UiField>
        <UiField label="Unit">
          <UiInput v-model="form.unitCode" placeholder="Unit 708" />
        </UiField>
        <UiField label="Boshlanish sanasi" required>
          <UiInput v-model="form.startsAt" type="date" />
        </UiField>
        <UiField label="Tugash sanasi" :hint="form.type === 'Sotuv' ? 'Sotuvda talab etilmaydi' : undefined">
          <UiInput v-model="form.endsAt" type="date" :disabled="form.type === 'Sotuv'" />
        </UiField>
        <UiField label="Shartnoma miqdori" required hint="So‘mda" class="sm:col-span-2">
          <UiInput v-model="form.amount" type="number" placeholder="0" />
        </UiField>
      </div>

      <template #footer>
        <UiButton variant="ghost" @click="createOpen = false">Bekor qilish</UiButton>
        <UiButton :disabled="!createValid" @click="createContract">
          <UiIcon name="check" :size="16" />
          Yaratish
        </UiButton>
      </template>
    </UiModal>
  </main>
</template>
