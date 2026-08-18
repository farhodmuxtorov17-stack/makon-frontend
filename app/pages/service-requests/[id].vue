<script setup lang="ts">
import { SERVICE_REQUESTS, WORK_CHECKLIST, WORK_MATERIALS, type ServiceRequest } from '~/data/operations'
import type { Capability } from '~/types/rbac'
import { dateShort, sum } from '~/utils/format'

type ServiceStatus = ServiceRequest['status']

interface FlowAction {
  key: string
  label: string
  next: ServiceStatus
  variant: 'primary' | 'secondary' | 'success'
  icon: string
  progress: number
  note: string
  question: string
  /** Amalni bajarish uchun yetarli bo‘lgan huquqlar */
  capabilities: Capability[]
}

/** Biriktirish bosqichi rahbarga ham, ijrochiga ham ochiq */
const ASSIGN_OR_EXECUTE: Capability[] = ['workorder.assign', 'workorder.execute']
const EXECUTE_ONLY: Capability[] = ['workorder.execute']

const route = useRoute()
const auth = useAuthStore()

const requests = useState<ServiceRequest[]>('service-requests', () =>
  SERVICE_REQUESTS.map((r) => ({ ...r })),
)

const request = computed(() => requests.value.find((r) => r.id === String(route.params.id)))

const checklist = ref(WORK_CHECKLIST.map((c) => ({ ...c })))
const doneCount = computed(() => checklist.value.filter((c) => c.done).length)

function toggleCheck(index: number) {
  if (!canExecute.value) return
  const item = checklist.value[index]
  if (item) item.done = !item.done
}

const materialsTotal = WORK_MATERIALS.reduce((s, m) => s + m.qty * m.price, 0)

const history = ref<Array<{ label: string; status: ServiceStatus; at: string }>>([])

const timeline = computed(() => {
  const r = request.value
  if (!r) return []
  return [
    ...history.value,
    { label: 'Ariza qabul qilindi va navbatga qo‘yildi', status: 'NEW' as ServiceStatus, at: `${dateShort(r.createdAt.slice(0, 10))} ${r.createdAt.slice(11)}` },
  ]
})

const ACCEPT: FlowAction = {
  key: 'accept',
  label: 'Qabul qilish',
  next: 'ASSIGNED',
  variant: 'primary',
  icon: 'check',
  progress: 10,
  note: 'Ariza qabul qilindi va ijrochiga biriktirildi',
  question: 'Ariza qabul qilinsin va sizga biriktirilsinmi?',
  capabilities: ASSIGN_OR_EXECUTE,
}

const START: FlowAction = {
  key: 'start',
  label: 'Ishni boshlash',
  next: 'IN_PROGRESS',
  variant: 'primary',
  icon: 'wrench',
  progress: 35,
  note: 'Ish boshlandi',
  question: 'Ish boshlandi deb belgilansinmi?',
  capabilities: EXECUTE_ONLY,
}

const FLOW: Record<string, FlowAction[]> = {
  NEW: [ACCEPT],
  TRIAGE: [ACCEPT],
  ASSIGNED: [START],
  INSPECTION: [START],
  RETURNED: [START],
  IN_PROGRESS: [
    {
      key: 'material',
      label: 'Material so‘rash',
      next: 'MATERIAL_PENDING',
      variant: 'secondary',
      icon: 'box',
      progress: 50,
      note: 'Ombordan material so‘raldi',
      question: 'Ushbu ariza bo‘yicha ombordan material so‘ralsinmi?',
      capabilities: EXECUTE_ONLY,
    },
    {
      key: 'finish',
      label: 'Yakunlash',
      next: 'COMPLETED',
      variant: 'success',
      icon: 'check',
      progress: 100,
      note: 'Ish yakunlandi',
      question: 'Ish to‘liq bajarildi va yakunlansinmi?',
      capabilities: EXECUTE_ONLY,
    },
  ],
  MATERIAL_PENDING: [
    {
      key: 'resume',
      label: 'Ishni davom ettirish',
      next: 'IN_PROGRESS',
      variant: 'primary',
      icon: 'refresh',
      progress: 60,
      note: 'Material olindi, ish davom ettirildi',
      question: 'Material olindi va ish davom ettirilsinmi?',
      capabilities: EXECUTE_ONLY,
    },
  ],
  COMPLETED: [
    {
      key: 'confirm',
      label: 'Tasdiqlashga yuborish',
      next: 'TENANT_CONFIRMATION',
      variant: 'primary',
      icon: 'send',
      progress: 100,
      note: 'Murojaatchi tasdig‘iga yuborildi',
      question: 'Bajarilgan ish murojaatchi tasdig‘iga yuborilsinmi?',
      capabilities: EXECUTE_ONLY,
    },
  ],
  TENANT_CONFIRMATION: [
    {
      key: 'close',
      label: 'Arizani yopish',
      next: 'CLOSED',
      variant: 'success',
      icon: 'check',
      progress: 100,
      note: 'Ariza yopildi',
      question: 'Ariza yopilsinmi?',
      capabilities: EXECUTE_ONLY,
    },
  ],
  CLOSED: [],
}

const canExecute = computed(() => auth.can('workorder.execute'))

/** Rolga tegishli bo‘lmagan bosqich tugmasi umuman ko‘rsatilmaydi */
const actions = computed(() =>
  request.value
    ? (FLOW[request.value.status] ?? []).filter((a) => a.capabilities.some((c) => auth.can(c)))
    : [],
)

const isClosed = computed(() => request.value?.status === 'CLOSED')
const stageActions = computed(() => (request.value ? (FLOW[request.value.status] ?? []) : []))

const pending = ref<FlowAction | null>(null)
const confirmOpen = computed({
  get: () => pending.value !== null,
  set: (v: boolean) => {
    if (!v) pending.value = null
  },
})

function applyAction() {
  const action = pending.value
  const r = request.value
  if (action && r && action.capabilities.some((c) => auth.can(c))) {
    r.status = action.next
    r.progress = Math.max(r.progress, action.progress)
    if (!r.assignee && canExecute.value) r.assignee = auth.user?.fullName ?? 'Ijrochi'
    if (action.next === 'CLOSED' || action.next === 'COMPLETED') r.slaBreached = false
    history.value.unshift({ label: action.note, status: action.next, at: 'Hozir' })
  }
  pending.value = null
}

const PRIORITY_STYLE: Record<string, { text: string; shape: string }> = {
  Yuqori: { text: 'text-danger-600', shape: 'dot' },
  'O‘rtacha': { text: 'text-warn-600', shape: 'ring' },
  Past: { text: 'text-ink-500', shape: 'bar' },
}

const info = computed(() => {
  const r = request.value
  if (!r) return []
  return [
    { label: 'Obyekt', value: r.buildingName },
    { label: 'Unit / joylashuv', value: r.unitCode },
    { label: 'Murojaatchi', value: r.requester },
    { label: 'Kategoriya', value: r.category },
    { label: 'Yaratilgan', value: `${dateShort(r.createdAt.slice(0, 10))} ${r.createdAt.slice(11)}` },
    { label: 'Bajarish muddati', value: dateShort(r.dueAt) },
    { label: 'Ijrochi', value: r.assignee ?? 'Biriktirilmagan' },
  ]
})
</script>

<template>
  <AppTopbar
    :title="request?.title ?? 'Ariza topilmadi'"
    :subtitle="request ? `${request.code} · ${request.buildingName}` : 'So‘ralgan yozuv mavjud emas'"
    :breadcrumb="[
      { label: 'Servis arizalari', to: '/service-requests' },
      { label: request?.code ?? 'Ariza' },
    ]"
  >
    <template #actions>
      <UiButton variant="secondary" size="sm" to="/service-requests">
        <UiIcon name="chevronLeft" :size="16" />
        Navbatga qaytish
      </UiButton>
    </template>
  </AppTopbar>

  <main class="scroll-slim flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
    <template v-if="request">
      <section class="grid gap-5 xl:grid-cols-3">
        <div class="min-w-0 space-y-5 xl:col-span-2">
          <UiCard>
            <div class="flex flex-wrap items-center gap-2.5">
              <UiStatus kind="service" :value="request.status" />
              <span
                class="inline-flex items-center gap-1.5 text-[13px] font-semibold"
                :class="PRIORITY_STYLE[request.priority]?.text"
              >
                <svg class="size-3 shrink-0" viewBox="0 0 12 12" aria-hidden="true">
                  <circle
                    v-if="PRIORITY_STYLE[request.priority]?.shape === 'dot'"
                    cx="6"
                    cy="6"
                    r="4"
                    fill="currentColor"
                  />
                  <circle
                    v-else-if="PRIORITY_STYLE[request.priority]?.shape === 'ring'"
                    cx="6"
                    cy="6"
                    r="3.6"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  />
                  <rect v-else x="1.8" y="4.6" width="8.4" height="2.8" rx="1.4" fill="currentColor" />
                </svg>
                {{ request.priority }} ustuvorlik
              </span>
              <span
                v-if="request.slaBreached"
                class="inline-flex items-center gap-1.5 rounded-pill bg-danger-50 px-2.5 py-1 text-xs font-semibold text-danger-700 ring-1 ring-inset ring-danger-100"
              >
                <svg class="size-3 shrink-0 text-danger-500" viewBox="0 0 12 12" aria-hidden="true">
                  <path d="M6 1.2 11.4 10.8H.6z" fill="currentColor" />
                </svg>
                SLA buzilgan
              </span>
            </div>

            <h2 class="mt-3 text-[22px] font-bold leading-tight text-ink-900">
              {{ request.title }}
            </h2>
            <p class="tabular mt-1 text-[13px] font-semibold text-brand-600">{{ request.code }}</p>

            <dl class="mt-5 grid gap-x-5 gap-y-4 border-t border-ink-100 pt-5 sm:grid-cols-2 lg:grid-cols-4">
              <div v-for="f in info" :key="f.label" class="min-w-0">
                <dt class="text-[12px] text-ink-500">{{ f.label }}</dt>
                <dd class="mt-0.5 truncate text-[13.5px] font-semibold text-ink-900">
                  {{ f.value }}
                </dd>
              </div>
            </dl>

            <div class="mt-5 border-t border-ink-100 pt-5">
              <h3 class="text-[13px] font-semibold text-ink-700">Muammo tavsifi</h3>
              <p class="mt-1.5 text-[13.5px] leading-relaxed text-ink-600">
                {{ request.description }}
              </p>
            </div>

            <div class="mt-5 border-t border-ink-100 pt-5">
              <div class="flex items-baseline justify-between">
                <h3 class="text-[13px] font-semibold text-ink-700">Bajarilish darajasi</h3>
                <span class="tabular text-[13px] font-bold text-ink-900">{{ request.progress }}%</span>
              </div>
              <div class="mt-2 h-2.5 overflow-hidden rounded-pill bg-ink-100">
                <div
                  class="h-full rounded-pill transition-all duration-300"
                  :class="request.progress === 100 ? 'bg-ok-500' : 'bg-brand-500'"
                  :style="{ width: `${Math.max(request.progress, 2)}%` }"
                />
              </div>
            </div>
          </UiCard>

          <UiCard title="Oldin / Keyin" subtitle="Ish joyining holati bo‘yicha qayd">
            <div class="grid gap-4 sm:grid-cols-2">
              <div class="relative overflow-hidden rounded-field ring-1 ring-ink-200">
                <svg viewBox="0 0 400 240" class="block h-44 w-full" aria-hidden="true">
                  <rect width="400" height="240" fill="#eef2f8" />
                  <path d="M0 0h400L262 82H138z" fill="#e2e8f2" />
                  <path d="M0 240l138-70h124l138 70z" fill="#cbd4e3" />
                  <path d="M0 0v240l138-70V82z" fill="#e8edf5" />
                  <path d="M400 0v240l-138-70V82z" fill="#e8edf5" />
                  <rect x="138" y="82" width="124" height="88" fill="#dfe6f0" />
                  <rect x="150" y="14" width="46" height="6" rx="3" fill="#cbd4e3" />
                  <rect x="212" y="14" width="46" height="6" rx="3" fill="#cbd4e3" />
                  <rect x="164" y="104" width="72" height="46" rx="4" fill="#cbd4e3" />
                  <path d="M60 190h44M296 190h44" stroke="#b9c4d6" stroke-width="4" stroke-linecap="round" />
                </svg>
                <span
                  class="absolute left-3 top-3 rounded-pill bg-ink-900/70 px-2.5 py-1 text-[11.5px] font-semibold text-white"
                >
                  Oldin
                </span>
              </div>

              <div class="relative overflow-hidden rounded-field ring-1 ring-ink-200">
                <svg viewBox="0 0 400 240" class="block h-44 w-full" aria-hidden="true">
                  <rect width="400" height="240" fill="#f4f8ff" />
                  <path d="M0 0h400L262 82H138z" fill="#e0eaff" />
                  <path d="M0 240l138-70h124l138 70z" fill="#c7d9fe" />
                  <path d="M0 0v240l138-70V82z" fill="#eef4ff" />
                  <path d="M400 0v240l-138-70V82z" fill="#eef4ff" />
                  <rect x="138" y="82" width="124" height="88" fill="#e6eeff" />
                  <rect x="150" y="12" width="46" height="9" rx="4.5" fill="#739afa" />
                  <rect x="212" y="12" width="46" height="9" rx="4.5" fill="#739afa" />
                  <rect x="118" y="40" width="60" height="7" rx="3.5" fill="#a1bffd" />
                  <rect x="222" y="40" width="60" height="7" rx="3.5" fill="#a1bffd" />
                  <rect x="164" y="104" width="72" height="46" rx="4" fill="#a1bffd" />
                  <path d="M60 190h44M296 190h44" stroke="#8fb0fb" stroke-width="4" stroke-linecap="round" />
                </svg>
                <span
                  class="absolute left-3 top-3 rounded-pill bg-ok-600/90 px-2.5 py-1 text-[11.5px] font-semibold text-white"
                >
                  Keyin
                </span>
              </div>
            </div>
          </UiCard>

          <UiCard title="Ishda ishlatilgan materiallar" :subtitle="`${WORK_MATERIALS.length} ta pozitsiya`" flush :padded="false">
            <template #actions>
              <UiButton variant="ghost" size="sm" to="/facility/materials">
                Material so‘rovlari
                <UiIcon name="chevronRight" :size="15" />
              </UiButton>
            </template>

            <UiTable
              :columns="[
                { key: 'name', label: 'Nomi' },
                { key: 'qty', label: 'Miqdor', align: 'right', numeric: true },
                { key: 'unit', label: 'O‘lchov birligi' },
                { key: 'price', label: 'Narxi', align: 'right', numeric: true },
                { key: 'total', label: 'Summa', align: 'right', numeric: true },
              ]"
              :rows="WORK_MATERIALS.map((m) => ({ ...m, id: m.name, total: m.qty * m.price }))"
            >
              <template #cell-price="{ row }">{{ sum(row.price) }}</template>
              <template #cell-total="{ row }">
                <span class="font-bold text-ink-900">{{ sum(row.total) }}</span>
              </template>
            </UiTable>

            <div class="flex items-center justify-between border-t border-ink-200 bg-surface-sunken px-4 py-3.5">
              <span class="text-[13px] font-semibold text-ink-700">Jami</span>
              <span class="tabular text-[15px] font-bold text-ink-900">{{ sum(materialsTotal) }}</span>
            </div>
          </UiCard>
        </div>

        <div class="min-w-0 space-y-5">
          <UiCard title="Bajarish nazorati (chek-list)">
            <template #actions>
              <span class="tabular text-[13px] font-bold text-ink-700">
                {{ doneCount }} / {{ checklist.length }}
              </span>
            </template>

            <ul class="space-y-1">
              <li v-for="(c, i) in checklist" :key="c.label">
                <button
                  type="button"
                  class="flex w-full items-center gap-3 rounded-field px-2 py-2.5 text-left transition-colors"
                  :class="canExecute ? 'hover:bg-brand-50/60' : 'cursor-default'"
                  :aria-pressed="c.done"
                  :disabled="!canExecute"
                  @click="toggleCheck(i)"
                >
                  <span
                    class="grid size-5 shrink-0 place-items-center rounded-full ring-1 transition-colors"
                    :class="c.done ? 'bg-ok-500 text-white ring-ok-500' : 'bg-white text-transparent ring-ink-300'"
                  >
                    <svg class="size-3" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                      <path
                        d="M2.6 6.3 5 8.7l4.4-5"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                    </svg>
                  </span>
                  <span
                    class="min-w-0 flex-1 text-[13.5px]"
                    :class="c.done ? 'text-ink-500 line-through' : 'font-medium text-ink-800'"
                  >
                    {{ c.label }}
                  </span>
                  <span
                    class="shrink-0 text-[12px] font-semibold"
                    :class="c.done ? 'text-ok-600' : 'text-ink-400'"
                  >
                    {{ c.done ? 'Bajarildi' : 'Kutilmoqda' }}
                  </span>
                </button>
              </li>
            </ul>
          </UiCard>

          <UiCard title="Ariza bo‘yicha amallar" subtitle="Har bir amal tasdiqdan so‘ng qo‘llanadi">
            <div v-if="actions.length" class="space-y-2.5">
              <UiButton
                v-for="a in actions"
                :key="a.key"
                :variant="a.variant"
                block
                @click="pending = a"
              >
                <UiIcon :name="a.icon" :size="17" />
                {{ a.label }}
              </UiButton>
            </div>
            <p
              v-else-if="isClosed"
              class="rounded-field bg-ok-50 px-4 py-3 text-[13px] font-medium text-ok-700"
            >
              Ariza yopilgan: qo‘shimcha amal talab etilmaydi.
            </p>
            <p
              v-else-if="stageActions.length"
              class="rounded-field bg-surface-sunken px-4 py-3 text-[13px] leading-relaxed text-ink-600"
            >
              Bu bosqichdagi amallarni ijrochi bajaradi. Sizning rolingizda ariza faqat kuzatiladi.
            </p>
            <p v-else class="rounded-field bg-surface-sunken px-4 py-3 text-[13px] text-ink-600">
              Joriy bosqichda amal talab etilmaydi.
            </p>
          </UiCard>

          <UiCard title="Ariza harakati" subtitle="Status o‘zgarishlari tarixi" flush :padded="false">
            <ul class="divide-y divide-ink-100 border-t border-ink-100">
              <li v-for="(h, i) in timeline" :key="i" class="flex items-start gap-3 px-5 py-3.5">
                <span
                  class="mt-1 size-2.5 shrink-0 rounded-full"
                  :class="i === 0 ? 'bg-brand-500' : 'bg-ink-300'"
                />
                <span class="min-w-0 flex-1">
                  <span class="block text-[13.5px] font-medium text-ink-800">{{ h.label }}</span>
                  <span class="mt-1 flex items-center gap-2">
                    <UiStatus kind="service" :value="h.status" size="sm" />
                    <span class="text-[12px] text-ink-500">{{ h.at }}</span>
                  </span>
                </span>
              </li>
            </ul>
          </UiCard>
        </div>
      </section>
    </template>

    <UiCard v-else>
      <div class="py-10 text-center">
        <p class="text-[15px] font-semibold text-ink-900">Bunday raqamli ariza topilmadi</p>
        <p class="mt-1.5 text-[13px] text-ink-500">
          Ariza yopilgan yoki manzil noto‘g‘ri kiritilgan bo‘lishi mumkin.
        </p>
        <UiButton class="mt-5" to="/service-requests">
          <UiIcon name="chevronLeft" :size="17" />
          Arizalar navbatiga qaytish
        </UiButton>
      </div>
    </UiCard>
  </main>

  <UiModal
    v-model="confirmOpen"
    :title="pending?.label ?? 'Amalni tasdiqlash'"
    subtitle="Amal ariza tarixida qayd etiladi"
    size="sm"
  >
    <p class="text-[14px] leading-relaxed text-ink-700">{{ pending?.question }}</p>
    <p v-if="request" class="mt-3 rounded-field bg-surface-sunken px-4 py-3 text-[13px] text-ink-600">
      <span class="tabular font-bold text-ink-900">{{ request.code }}</span>
      · {{ request.title }}
    </p>

    <template #footer>
      <UiButton variant="ghost" @click="pending = null">Bekor qilish</UiButton>
      <UiButton :variant="pending?.variant ?? 'primary'" @click="applyAction">
        <UiIcon name="check" :size="16" />
        Tasdiqlash
      </UiButton>
    </template>
  </UiModal>
</template>
