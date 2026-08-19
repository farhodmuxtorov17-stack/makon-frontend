<script setup lang="ts">
import {
  MATERIAL_REQUESTS,
  SERVICE_REQUESTS,
  STOCK_ITEMS,
  materialsFor,
  type MaterialRequest,
  type ServiceRequest,
  type WorkMaterialLine,
} from '~/data/operations'
import { dateShort, num, sum, todayIso } from '~/utils/format'

/** Material so‘rovi reyestrdagi yozuvga asos va haqiqiy pozitsiyalarni qo‘shadi */
interface MaterialRequestEntry extends MaterialRequest {
  reason?: string
  lines?: WorkMaterialLine[]
}

const auth = useAuthStore()

/** Havola faqat ochiladigan bo‘lsa ko‘rsatiladi. Super rahbar hamma joyga kiradi. */
function canOpen(path: string) {
  if (!auth.role) return false
  return auth.role === 'SUPER_HEAD' || auth.canRoute(path)
}

/** So‘rov bo‘yicha qarorni bino rahbari qabul qiladi, omborchi esa beradi */
const canDecide = computed(() => auth.can('workorder.assign'))

const requests = useState<ServiceRequest[]>('service-requests', () =>
  SERVICE_REQUESTS.map((r) => ({ ...r })),
)

/**
 * Reyestr umumiy: arizadan yaratilgan so‘rov shu ro‘yxatga tushadi va
 * ombor sahifasi aynan shu yozuvlarni ko‘radi. Sahifadan chiqilsa ham
 * yo‘qolmaydi.
 */
const list = useState<MaterialRequestEntry[]>('material-requests', () =>
  MATERIAL_REQUESTS.map((r) => ({ ...r })),
)

const tab = ref('all')
const query = ref('')

const tabs = computed(() => {
  const count = (status: string) => list.value.filter((r) => r.status === status).length
  return [
    { value: 'all', label: 'Barchasi', count: list.value.length },
    { value: 'SUBMITTED', label: 'Yuborilgan', count: count('SUBMITTED') },
    { value: 'APPROVED', label: 'Tasdiqlangan', count: count('APPROVED') },
    { value: 'ISSUED', label: 'Berilgan', count: count('ISSUED') },
    { value: 'REJECTED', label: 'Rad etilgan', count: count('REJECTED') },
  ]
})

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  return list.value.filter((r) => {
    if (tab.value !== 'all' && r.status !== tab.value) return false
    if (q && ![r.code, r.workOrder, r.buildingName, r.requester].some((v) => v.toLowerCase().includes(q)))
      return false
    return true
  })
})

const rows = computed(() => filtered.value.map((r) => ({ ...r })))

const totalAmount = computed(() => filtered.value.reduce((s, r) => s + r.amount, 0))

const columns = [
  { key: 'code', label: 'Raqam', width: '160px' },
  { key: 'workOrder', label: 'Ish topshirig‘i' },
  { key: 'buildingName', label: 'Obyekt' },
  { key: 'items', label: 'Pozitsiyalar', align: 'right' as const, numeric: true },
  { key: 'amount', label: 'Summa', align: 'right' as const, numeric: true },
  { key: 'status', label: 'Status' },
  { key: 'createdAt', label: 'Sana' },
]

/**
 * So‘rov pozitsiyalari haqiqiy: yangi so‘rovda foydalanuvchi qo‘shgan
 * qatorlar, reyestrdagi eski so‘rovda esa shu ish topshirig‘iga biriktirilgan
 * ombor pozitsiyalari. Shuning uchun qatorlar yig‘indisi doim so‘rov
 * summasiga teng bo‘ladi.
 */
function linesOf(r: MaterialRequestEntry): WorkMaterialLine[] {
  return r.lines ?? materialsFor(r.workOrder)
}

const detail = ref<MaterialRequestEntry | null>(null)
const detailOpen = computed({
  get: () => detail.value !== null,
  set: (v: boolean) => {
    if (!v) detail.value = null
  },
})

const detailLines = computed(() =>
  detail.value
    ? linesOf(detail.value).map((l) => ({ ...l, id: l.code, total: l.qty * l.price }))
    : [],
)
const detailTotal = computed(() => detailLines.value.reduce((s, l) => s + l.total, 0))
const detailOrder = computed(() =>
  detail.value ? requests.value.find((r) => r.code === detail.value!.workOrder) : undefined,
)

function openDetail(row: Record<string, unknown>) {
  detail.value = list.value.find((r) => r.id === String(row.id)) ?? null
}

/** SUBMITTED holatidagi so‘rov bo‘yicha qaror: tasdiqlash yoki rad etish */
function decide(status: 'APPROVED' | 'REJECTED') {
  const target = detail.value
  if (!target || !canDecide.value || target.status !== 'SUBMITTED') return
  const row = list.value.find((r) => r.id === target.id)
  if (row) row.status = status
  detail.value = null
}

const createOpen = ref(false)
const draftLines = ref<WorkMaterialLine[]>([])
const pickItem = ref(STOCK_ITEMS[0]!.id)
const pickQty = ref(1)
const pickOrder = ref(SERVICE_REQUESTS[1]!.code)
const reason = ref('')
const createError = ref('')

const workOrderOptions = computed(() =>
  requests.value.map((r) => ({ value: r.code, label: `${r.code} · ${r.title}` })),
)

const itemOptions = STOCK_ITEMS.map((i) => ({ value: i.id, label: `${i.name} (${i.code})` }))

const draftTotal = computed(() => draftLines.value.reduce((s, l) => s + l.qty * l.price, 0))

function addLine() {
  const item = STOCK_ITEMS.find((i) => i.id === pickItem.value)
  const qty = Number(pickQty.value)
  if (!item || !qty || qty < 1) {
    createError.value = 'Pozitsiya tanlang va miqdorni 1 dan kam bo‘lmagan qilib kiriting'
    return
  }
  const exists = draftLines.value.find((l) => l.code === item.code)
  if (exists) exists.qty += qty
  else
    draftLines.value.push({
      code: item.code,
      name: item.name,
      unit: item.unit,
      price: item.price,
      qty,
    })
  pickQty.value = 1
  createError.value = ''
}

function removeLine(code: string) {
  draftLines.value = draftLines.value.filter((l) => l.code !== code)
}

function resetDraft() {
  draftLines.value = []
  pickQty.value = 1
  pickItem.value = STOCK_ITEMS[0]!.id
  reason.value = ''
  createError.value = ''
}

function submitRequest() {
  if (!draftLines.value.length) {
    createError.value = 'Kamida bitta pozitsiya qo‘shing'
    return
  }
  if (!reason.value.trim()) {
    createError.value = 'So‘rov asosini yozing'
    return
  }
  const order = requests.value.find((r) => r.code === pickOrder.value)
  const seq = list.value.reduce((m, r) => Math.max(m, Number(r.code.slice(-4)) || 0), 0) + 1
  const numbered = String(seq).padStart(4, '0')
  list.value.unshift({
    id: `mr-${numbered}`,
    // Hujjat raqamining yili joriy sanadan olinadi
    code: `MT-${new Date().getFullYear()}-${numbered}`,
    workOrder: pickOrder.value,
    requester: auth.user?.fullName ?? 'Ijrochi',
    items: draftLines.value.length,
    amount: draftTotal.value,
    status: 'SUBMITTED',
    // So‘rov bugun tuziladi, ish topshirig‘ining sanasi bilan almashtirilmaydi
    createdAt: todayIso(),
    buildingName: order?.buildingName ?? 'Green Business Center',
    reason: reason.value.trim(),
    lines: draftLines.value.map((l) => ({ ...l })),
  })
  tab.value = 'all'
  createOpen.value = false
  resetDraft()
}
</script>

<template>
  <AppTopbar
    title="Material so‘rovlari"
    subtitle="Ish topshiriqlari bo‘yicha ombordan material so‘rash va nazorat"
  >
    <template #actions>
      <UiButton
        v-if="canOpen('/warehouse')"
        variant="secondary"
        size="sm"
        to="/warehouse"
      >
        <UiIcon name="box" :size="16" />
        Ombor qoldiqlari
      </UiButton>
      <UiButton size="sm" @click="createOpen = true">
        <UiIcon name="plus" :size="16" />
        Yangi material so‘rovi
      </UiButton>
    </template>
  </AppTopbar>

  <main class="scroll-slim flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
    <section class="grid gap-4 sm:grid-cols-3">
      <UiKpi
        label="Ko‘rsatilgan so‘rovlar"
        :value="num(filtered.length)"
        icon="clipboard"
        tone="brand"
      />
      <UiKpi
        label="Tanlangan summasi"
        :value="sum(totalAmount)"
        icon="wallet"
        tone="violet"
      />
      <UiKpi
        label="Tasdiq kutayotgan"
        :value="num(list.filter((r) => r.status === 'SUBMITTED').length)"
        icon="clock"
        tone="warn"
        class="cursor-pointer"
        @click="tab = 'SUBMITTED'"
      />
    </section>

    <UiCard
      title="So‘rovlar reyestri"
      :subtitle="`${rows.length} ta yozuv`"
      flush
      :padded="false"
    >
      <template #actions>
        <UiInput
          v-model="query"
          placeholder="Raqam yoki ish topshirig‘i bo‘yicha qidirish"
          class="w-64"
        >
          <template #prefix>
            <UiIcon name="search" :size="18" />
          </template>
        </UiInput>
      </template>

      <div class="border-t border-ink-100 px-5 pt-4">
        <UiTabs v-model="tab" :tabs="tabs" variant="line" />
      </div>

      <UiTable
        :columns="columns"
        :rows="rows"
        empty="Tanlangan holatga mos so‘rov topilmadi"
        @row-click="openDetail"
      >
        <template #cell-code="{ row }">
          <span class="tabular text-[13px] font-bold text-ink-900">{{ row.code }}</span>
        </template>

        <template #cell-workOrder="{ row }">
          <span class="tabular text-[13px] font-semibold text-brand-600">{{ row.workOrder }}</span>
        </template>

        <template #cell-items="{ row }">{{ row.items }} ta</template>

        <template #cell-amount="{ row }">
          <span class="font-bold text-ink-900">{{ sum(row.amount) }}</span>
        </template>

        <template #cell-status="{ row }">
          <UiStatus kind="material" :value="row.status" size="sm" />
        </template>

        <template #cell-createdAt="{ row }">
          <span class="tabular">{{ dateShort(row.createdAt) }}</span>
        </template>
      </UiTable>

      <div class="flex items-center justify-between border-t border-ink-200 bg-surface-sunken px-5 py-3.5">
        <span class="text-[13px] text-ink-600">
          Qator ustiga bosilsa so‘rov pozitsiyalari ochiladi
        </span>
        <span class="tabular text-[14px] font-bold text-ink-900">{{ sum(totalAmount) }}</span>
      </div>
    </UiCard>
  </main>

  <UiModal
    v-model="detailOpen"
    :title="detail ? `${detail.code} · pozitsiyalar` : 'So‘rov'"
    :subtitle="detail ? `${detail.workOrder} · ${detail.buildingName}` : undefined"
    size="lg"
  >
    <div v-if="detail" class="space-y-4">
      <div class="flex flex-wrap items-center gap-3">
        <UiStatus kind="material" :value="detail.status" />
        <span class="text-[13px] text-ink-500">
          So‘rov beruvchi: <b class="text-ink-800">{{ detail.requester }}</b>
        </span>
        <span class="tabular text-[13px] text-ink-500">{{ dateShort(detail.createdAt) }}</span>
      </div>

      <div v-if="detail.reason" class="rounded-field bg-surface-sunken px-4 py-3">
        <p class="text-[12px] text-ink-500">Asos</p>
        <p class="mt-1 text-[13.5px] leading-relaxed text-ink-800">{{ detail.reason }}</p>
      </div>

      <UiTable
        :columns="[
          { key: 'name', label: 'Nomi' },
          { key: 'unit', label: 'O‘lchov birligi' },
          { key: 'qty', label: 'Miqdor', align: 'right', numeric: true },
          { key: 'price', label: 'Narxi', align: 'right', numeric: true },
          { key: 'total', label: 'Summa', align: 'right', numeric: true },
        ]"
        :rows="detailLines"
      >
        <template #cell-price="{ row }">{{ sum(row.price) }}</template>
        <template #cell-total="{ row }">
          <span class="font-bold text-ink-900">{{ sum(row.total) }}</span>
        </template>
      </UiTable>

      <div class="flex items-center justify-between rounded-field bg-surface-sunken px-4 py-3">
        <span class="text-[13px] font-semibold text-ink-700">Jami</span>
        <span class="tabular text-[15px] font-bold text-ink-900">{{ sum(detailTotal) }}</span>
      </div>
    </div>

    <template #footer>
      <UiButton variant="ghost" @click="detail = null">Yopish</UiButton>
      <UiButton
        v-if="detailOrder && canOpen('/service-requests')"
        variant="secondary"
        :to="`/service-requests/${detailOrder.id}`"
      >
        Ish topshirig‘i kartasi
        <UiIcon name="chevronRight" :size="15" />
      </UiButton>
      <template v-if="canDecide && detail?.status === 'SUBMITTED'">
        <UiButton variant="secondary" @click="decide('REJECTED')">
          <UiIcon name="x" :size="16" />
          Rad etish
        </UiButton>
        <UiButton variant="success" @click="decide('APPROVED')">
          <UiIcon name="check" :size="16" />
          Tasdiqlash
        </UiButton>
      </template>
      <UiButton v-else-if="canOpen('/warehouse')" to="/warehouse">
        <UiIcon name="box" :size="16" />
        Omborda ko‘rish
      </UiButton>
    </template>
  </UiModal>

  <UiModal
    v-model="createOpen"
    title="Yangi material so‘rovi"
    subtitle="Ish topshirig‘ini tanlang va kerakli pozitsiyalarni qo‘shing"
    size="lg"
  >
    <div class="space-y-4">
      <UiField label="Ish topshirig‘i" required>
        <UiSelect v-model="pickOrder" :options="workOrderOptions" />
      </UiField>

      <div class="grid gap-3 rounded-field bg-surface-sunken p-4 sm:grid-cols-[1fr_120px_auto]">
        <UiField label="Pozitsiya">
          <UiSelect v-model="pickItem" :options="itemOptions" />
        </UiField>
        <UiField label="Miqdor">
          <UiInput v-model="pickQty" type="number" />
        </UiField>
        <div class="flex items-end">
          <UiButton variant="secondary" block @click="addLine">
            <UiIcon name="plus" :size="16" />
            Qo‘shish
          </UiButton>
        </div>
      </div>

      <div v-if="draftLines.length" class="overflow-hidden rounded-field ring-1 ring-ink-200">
        <ul class="divide-y divide-ink-100">
          <li v-for="l in draftLines" :key="l.code" class="flex items-center gap-3 px-4 py-3">
            <span class="min-w-0 flex-1">
              <span class="block truncate text-[13.5px] font-semibold text-ink-900">{{ l.name }}</span>
              <span class="tabular block text-[12px] text-ink-500">
                {{ l.qty }} {{ l.unit }} × {{ sum(l.price) }}
              </span>
            </span>
            <span class="tabular shrink-0 text-[13.5px] font-bold text-ink-900">
              {{ sum(l.qty * l.price) }}
            </span>
            <button
              type="button"
              class="shrink-0 rounded-lg p-2 text-ink-400 transition-colors hover:bg-danger-50 hover:text-danger-600"
              aria-label="Pozitsiyani olib tashlash"
              @click="removeLine(l.code)"
            >
              <UiIcon name="trash" :size="16" />
            </button>
          </li>
        </ul>
        <div class="flex items-center justify-between bg-surface-sunken px-4 py-3">
          <span class="text-[13px] font-semibold text-ink-700">
            Jami {{ draftLines.length }} ta pozitsiya
          </span>
          <span class="tabular text-[15px] font-bold text-ink-900">{{ sum(draftTotal) }}</span>
        </div>
      </div>

      <p v-else class="rounded-field border border-dashed border-ink-300 px-4 py-6 text-center text-[13px] text-ink-500">
        Pozitsiya qo‘shilmagan
      </p>

      <UiField label="Asos" required :error="createError">
        <textarea
          v-model="reason"
          rows="3"
          placeholder="Material qaysi ish uchun talab qilinayotganini yozing"
          class="scroll-slim w-full rounded-field bg-white px-3.5 py-2.5 text-sm text-ink-800 ring-1 ring-inset ring-ink-200 transition-colors placeholder:text-ink-400 hover:ring-ink-300 focus:ring-2 focus:ring-brand-500"
        />
      </UiField>
    </div>

    <template #footer>
      <UiButton variant="ghost" @click="((createOpen = false), resetDraft())">Bekor qilish</UiButton>
      <UiButton @click="submitRequest">
        <UiIcon name="send" :size="16" />
        So‘rovni yuborish
      </UiButton>
    </template>
  </UiModal>
</template>
