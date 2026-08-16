<script setup lang="ts">
import AppTopbar from '~/components/layout/AppTopbar.vue'
import { CONTRACTS, INVOICES } from '~/data/business'
import { dateLong, dateShort, num, sum } from '~/utils/format'

const route = useRoute()
const auth = useAuthStore()
const registry = reactive(CONTRACTS)

const contract = computed(() => registry.find((c) => c.id === String(route.params.id)) ?? null)

const banner = ref('')
const approveOpen = ref(false)
const actOpen = ref(false)
const documentOpen = ref(false)
const activeDocument = ref<{ name: string; size: string; type: string } | null>(null)

const approvalStep = computed(
  () => contract.value?.timeline.find((t) => t.label === 'Imzolandi') ?? null,
)

const isApproved = computed(() => approvalStep.value?.done === true)

const relatedInvoices = computed(() =>
  contract.value ? INVOICES.filter((i) => i.tenant === contract.value?.tenant) : [],
)

const relatedDebt = computed(() =>
  relatedInvoices.value.reduce((s, i) => s + (i.total - i.paid), 0),
)

const currentApprover = computed(() => auth.user?.fullName ?? 'Jahongir Alimov')
const approveDate = computed(() => approvalStep.value?.date ?? '-')
const approver = computed(() =>
  isApproved.value ? (approvalStep.value?.actor ?? '-') : currentApprover.value,
)
const approveToday = '2025-05-19'

function openDocument(doc: { name: string; size: string; type: string }) {
  activeDocument.value = doc
  documentOpen.value = true
}

function downloadDocument() {
  if (activeDocument.value) {
    banner.value = `${activeDocument.value.name} hujjati yuklab olindi.`
  }
  documentOpen.value = false
}

function approveContract() {
  const c = contract.value
  if (!c) return
  const person = currentApprover.value
  c.status = 'ACTIVE'
  const agreed = c.timeline.find((t) => t.label === 'Kelishildi')
  if (agreed && !agreed.done) {
    agreed.done = true
    agreed.date = approveToday
    agreed.actor = 'Nilufar Rahimova'
  }
  const approved = c.timeline.find((t) => t.label === 'Imzolandi')
  if (approved) {
    approved.done = true
    approved.date = approveToday
    approved.actor = person
  }
  const activated = c.timeline.find((t) => t.label === 'Faollashdi')
  if (activated) {
    activated.done = true
    activated.date = approveToday
    activated.actor = 'Tizim'
  }
  banner.value = `${c.code} shartnomasi ${person} tomonidan tasdiqlandi va faol holatga o‘tkazildi.`
  approveOpen.value = false
}

const DOC_TONE: Record<string, string> = {
  pdf: 'bg-danger-50 text-danger-600',
  xlsx: 'bg-ok-50 text-ok-600',
  docx: 'bg-brand-50 text-brand-600',
}
</script>

<template>
  <AppTopbar
    :title="contract ? contract.code : 'Shartnoma topilmadi'"
    :subtitle="contract ? `${contract.type} shartnomasi · ${contract.tenant}` : ''"
    :breadcrumb="[
      { label: 'Shartnomalar', to: '/contracts' },
      { label: contract ? contract.code : 'Topilmadi' },
    ]"
  >
    <template #actions>
      <UiButton variant="secondary" size="sm" to="/contracts">
        <UiIcon name="chevronLeft" :size="16" />
        Reyestrga qaytish
      </UiButton>
      <UiButton v-if="contract" variant="secondary" size="sm" to="/billing/invoices">
        <UiIcon name="wallet" :size="16" />
        Hisob-fakturalar
      </UiButton>
    </template>
  </AppTopbar>

  <main class="scroll-slim flex-1 space-y-5 overflow-y-auto p-6">
    <UiCard v-if="!contract" title="Shartnoma topilmadi">
      <p class="text-[13.5px] text-ink-600">
        So‘ralgan shartnoma reyestrda mavjud emas yoki arxivga o‘tkazilgan.
      </p>
      <UiButton class="mt-4" to="/contracts">
        <UiIcon name="contract" :size="16" />
        Shartnomalar reyestri
      </UiButton>
    </UiCard>

    <template v-else>
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

      <section class="grid gap-5 xl:grid-cols-3">
        <div class="min-w-0 space-y-5 xl:col-span-2">
          <UiCard title="Shartnoma tafsilotlari" subtitle="Asosiy shartlar va tomonlar">
            <template #actions>
              <UiStatus kind="contract" :value="contract.status" />
            </template>

            <dl class="divide-y divide-ink-100">
              <div class="flex items-baseline justify-between gap-6 py-3">
                <dt class="text-[13px] text-ink-500">Turi</dt>
                <dd class="text-[13.5px] font-semibold text-ink-900">{{ contract.type }}</dd>
              </div>
              <div class="flex items-baseline justify-between gap-6 py-3">
                <dt class="text-[13px] text-ink-500">Yuridik shaxs / Ijarachi</dt>
                <dd class="text-[13.5px] font-semibold text-ink-900">{{ contract.tenant }}</dd>
              </div>
              <div class="flex items-baseline justify-between gap-6 py-3">
                <dt class="text-[13px] text-ink-500">Obyekt</dt>
                <dd class="text-right text-[13.5px] font-semibold text-ink-900">
                  {{ contract.buildingName }}, {{ contract.unitCode }}
                </dd>
              </div>
              <div class="flex items-baseline justify-between gap-6 py-3">
                <dt class="text-[13px] text-ink-500">Boshlanish sanasi</dt>
                <dd class="text-[13.5px] font-semibold text-ink-900">
                  {{ dateLong(contract.startsAt) }}
                </dd>
              </div>
              <div class="flex items-baseline justify-between gap-6 py-3">
                <dt class="text-[13px] text-ink-500">Tugash sanasi</dt>
                <dd class="text-[13.5px] font-semibold text-ink-900">
                  {{ contract.endsAt === '-' ? 'Muddatsiz' : dateLong(contract.endsAt) }}
                </dd>
              </div>
              <div class="flex items-baseline justify-between gap-6 py-3">
                <dt class="text-[13px] text-ink-500">Shartnoma miqdori</dt>
                <dd class="tabular text-[14px] font-bold text-ink-900">
                  {{ sum(contract.amount) }}
                </dd>
              </div>
              <div class="flex items-baseline justify-between gap-6 py-3">
                <dt class="text-[13px] text-ink-500">To‘lov shakli</dt>
                <dd class="text-[13.5px] font-semibold text-ink-900">{{ contract.paymentTerm }}</dd>
              </div>
              <div class="flex items-baseline justify-between gap-6 py-3">
                <dt class="text-[13px] text-ink-500">Tasdiqlagan shaxs</dt>
                <dd class="text-right text-[13.5px] font-semibold text-ink-900">
                  <template v-if="isApproved">
                    {{ approver }}
                    <span class="tabular block text-[12px] font-medium text-ink-500">
                      {{ dateShort(approveDate) }}
                    </span>
                  </template>
                  <span v-else class="text-[13px] font-medium text-ink-500">
                    Tasdiqlash kutilmoqda
                  </span>
                </dd>
              </div>
            </dl>
          </UiCard>

          <UiCard
            title="Ilova qilingan hujjatlar"
            :subtitle="`${num(contract.documents.length)} ta fayl biriktirilgan`"
            flush
            :padded="false"
          >
            <p v-if="!contract.documents.length" class="px-5 py-6 text-[13px] text-ink-500">
              Hujjat biriktirilmagan.
            </p>
            <ul v-else class="divide-y divide-ink-100 border-t border-ink-100">
              <li
                v-for="d in contract.documents"
                :key="d.name"
                class="flex items-center gap-4 px-5 py-3.5"
              >
                <span
                  class="grid size-10 shrink-0 place-items-center rounded-[10px]"
                  :class="DOC_TONE[d.type] ?? 'bg-ink-100 text-ink-600'"
                >
                  <UiIcon name="doc" :size="18" />
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-[13.5px] font-semibold text-ink-900">
                    {{ d.name }}
                  </span>
                  <span class="block text-[12px] text-ink-500">
                    {{ d.size }} · {{ d.type.toUpperCase() }}
                  </span>
                </span>
                <UiButton variant="secondary" size="sm" @click="openDocument(d)">
                  <UiIcon name="download" :size="15" />
                  Yuklab olish
                </UiButton>
              </li>
            </ul>
          </UiCard>

          <UiCard title="Shartnoma jarayoni" subtitle="Bosqichlar, sanalar va mas’ul shaxslar">
            <ol class="space-y-0">
              <li
                v-for="(t, i) in contract.timeline"
                :key="t.label"
                class="flex gap-4"
                :class="i < contract.timeline.length - 1 ? 'pb-5' : ''"
              >
                <div class="flex flex-col items-center">
                  <span
                    class="grid size-9 shrink-0 place-items-center rounded-full ring-1"
                    :class="
                      t.done
                        ? 'bg-ok-50 text-ok-600 ring-ok-100'
                        : 'bg-ink-50 text-ink-400 ring-ink-200'
                    "
                  >
                    <UiIcon :name="t.done ? 'check' : 'clock'" :size="17" />
                  </span>
                  <span
                    v-if="i < contract.timeline.length - 1"
                    class="mt-1 w-px flex-1"
                    :class="t.done ? 'bg-ok-100' : 'bg-ink-200'"
                  />
                </div>
                <div class="min-w-0 flex-1 pt-1">
                  <p class="text-[13.5px] font-bold text-ink-900">{{ t.label }}</p>
                  <p class="mt-0.5 text-[12.5px] text-ink-500">
                    {{ t.date === '-' ? 'Sana belgilanmagan' : dateLong(t.date) }} · {{ t.actor }}
                  </p>
                </div>
                <span
                  class="shrink-0 self-start rounded-pill px-2.5 py-1 text-[11.5px] font-semibold"
                  :class="t.done ? 'bg-ok-50 text-ok-700' : 'bg-ink-100 text-ink-600'"
                >
                  {{ t.done ? 'Bajarildi' : 'Kutilmoqda' }}
                </span>
              </li>
            </ol>
          </UiCard>
        </div>

        <div class="min-w-0 space-y-5">
          <UiCard title="Shartnomani tasdiqlash" subtitle="Ichki tasdiqlash va faollashtirish">
            <div class="rounded-field bg-surface-sunken p-4">
              <div class="flex items-center justify-between gap-3">
                <span class="text-[13px] text-ink-500">Joriy holat</span>
                <UiStatus kind="contract" :value="contract.status" size="sm" />
              </div>
              <p class="mt-2 text-[12.5px] leading-relaxed text-ink-600">
                {{
                  isApproved
                    ? `Shartnomani ${dateShort(approveDate)} sanasida ${approver} tasdiqlagan, hujjat tizimda faol.`
                    : 'Shartnoma tasdiqlashni kutmoqda. Tasdiqlangach hujjat shartlari qulflanadi va shartnoma faol holatga o‘tadi.'
                }}
              </p>
            </div>

            <UiButton v-if="!isApproved" class="mt-4" size="lg" block @click="approveOpen = true">
              <UiIcon name="check" :size="18" />
              Shartnomani tasdiqlash
            </UiButton>

            <UiButton
              v-else
              class="mt-4"
              size="lg"
              variant="secondary"
              block
              @click="actOpen = true"
            >
              <UiIcon name="doc" :size="18" />
              Tasdiqlash dalolatnomasini ko‘rish
            </UiButton>
          </UiCard>

          <UiCard title="Moliyaviy holat" subtitle="Ijarachi bo‘yicha hisob-fakturalar" flush :padded="false">
            <div class="grid grid-cols-2 gap-3 px-5 pb-4">
              <div class="rounded-field bg-surface-sunken p-3">
                <p class="text-[12px] text-ink-500">Hujjatlar</p>
                <p class="tabular mt-0.5 text-sm font-bold text-ink-900">
                  {{ num(relatedInvoices.length) }} ta
                </p>
              </div>
              <div class="rounded-field bg-surface-sunken p-3">
                <p class="text-[12px] text-ink-500">Qarzdorlik</p>
                <p class="tabular mt-0.5 text-sm font-bold text-danger-600">
                  {{ sum(relatedDebt) }}
                </p>
              </div>
            </div>

            <p v-if="!relatedInvoices.length" class="border-t border-ink-100 px-5 py-5 text-[13px] text-ink-500">
              Ushbu ijarachi bo‘yicha hisob-faktura shakllantirilmagan.
            </p>
            <ul v-else class="divide-y divide-ink-100 border-t border-ink-100">
              <li v-for="i in relatedInvoices" :key="i.id" class="px-5 py-3">
                <NuxtLink to="/billing/invoices" class="group flex items-center gap-3">
                  <span class="min-w-0 flex-1">
                    <span
                      class="block truncate text-[13px] font-semibold text-ink-900 group-hover:text-brand-600"
                    >
                      {{ i.code }}
                    </span>
                    <span class="block text-[12px] text-ink-500">{{ i.period }}</span>
                  </span>
                  <span class="tabular shrink-0 text-[13px] font-bold text-ink-900">
                    {{ sum(i.total) }}
                  </span>
                  <UiStatus kind="invoice" :value="i.status" size="sm" />
                </NuxtLink>
              </li>
            </ul>
          </UiCard>
        </div>
      </section>

      <UiModal
        v-model="approveOpen"
        size="sm"
        title="Shartnomani tasdiqlash"
        :subtitle="contract.code"
      >
        <p class="text-[13.5px] leading-relaxed text-ink-700">
          Tasdiqlash tizim ichida qayd etiladi: dalolatnomaga tasdiqlagan shaxsning ismi va sana
          yoziladi. Tasdiqlangandan so‘ng hujjat shartlari o‘zgartirilmaydi va shartnoma faol
          holatga o‘tkaziladi.
        </p>
        <dl class="mt-4 divide-y divide-ink-100 rounded-field bg-surface-sunken px-4">
          <div class="flex items-baseline justify-between gap-4 py-2.5">
            <dt class="text-[13px] text-ink-500">Tomon</dt>
            <dd class="text-[13.5px] font-semibold text-ink-900">{{ contract.tenant }}</dd>
          </div>
          <div class="flex items-baseline justify-between gap-4 py-2.5">
            <dt class="text-[13px] text-ink-500">Tasdiqlovchi</dt>
            <dd class="text-[13.5px] font-semibold text-ink-900">{{ currentApprover }}</dd>
          </div>
          <div class="flex items-baseline justify-between gap-4 py-2.5">
            <dt class="text-[13px] text-ink-500">Tasdiqlash sanasi</dt>
            <dd class="tabular text-[13.5px] font-semibold text-ink-900">
              {{ dateShort(approveToday) }}
            </dd>
          </div>
          <div class="flex items-baseline justify-between gap-4 py-2.5">
            <dt class="text-[13px] text-ink-500">Miqdor</dt>
            <dd class="tabular text-[13.5px] font-semibold text-ink-900">
              {{ sum(contract.amount) }}
            </dd>
          </div>
          <div class="flex items-baseline justify-between gap-4 py-2.5">
            <dt class="text-[13px] text-ink-500">Amal qilish muddati</dt>
            <dd class="text-[13.5px] font-semibold text-ink-900">
              {{ dateShort(contract.startsAt) }} · {{ contract.endsAt === '-' ? 'muddatsiz' : dateShort(contract.endsAt) }}
            </dd>
          </div>
        </dl>

        <template #footer>
          <UiButton variant="ghost" @click="approveOpen = false">Bekor qilish</UiButton>
          <UiButton variant="success" @click="approveContract">
            <UiIcon name="check" :size="16" />
            Tasdiqlashni yakunlash
          </UiButton>
        </template>
      </UiModal>

      <UiModal
        v-model="actOpen"
        size="sm"
        title="Tasdiqlash dalolatnomasi"
        :subtitle="contract.code"
      >
        <dl class="divide-y divide-ink-100">
          <div class="flex items-baseline justify-between gap-4 py-2.5">
            <dt class="text-[13px] text-ink-500">Tasdiqlash sanasi</dt>
            <dd class="text-[13.5px] font-semibold text-ink-900">{{ dateLong(approveDate) }}</dd>
          </div>
          <div class="flex items-baseline justify-between gap-4 py-2.5">
            <dt class="text-[13px] text-ink-500">Tasdiqlovchi</dt>
            <dd class="text-[13.5px] font-semibold text-ink-900">{{ approver }}</dd>
          </div>
          <div class="flex items-baseline justify-between gap-4 py-2.5">
            <dt class="text-[13px] text-ink-500">Tomon</dt>
            <dd class="text-[13.5px] font-semibold text-ink-900">{{ contract.tenant }}</dd>
          </div>
          <div class="flex items-baseline justify-between gap-4 py-2.5">
            <dt class="text-[13px] text-ink-500">Dalolatnoma raqami</dt>
            <dd class="tabular text-[13.5px] font-semibold text-ink-900">
              TSD-2025-{{ contract.code.slice(-4) }}
            </dd>
          </div>
          <div class="flex items-baseline justify-between gap-4 py-2.5">
            <dt class="text-[13px] text-ink-500">Holati</dt>
            <dd><UiStatus kind="contract" :value="contract.status" size="sm" /></dd>
          </div>
        </dl>

        <template #footer>
          <UiButton variant="ghost" @click="actOpen = false">Yopish</UiButton>
          <UiButton
            @click="
              () => {
                actOpen = false
                banner = `${contract?.code} tasdiqlash dalolatnomasi yuklab olindi.`
              }
            "
          >
            <UiIcon name="download" :size="16" />
            Yuklab olish
          </UiButton>
        </template>
      </UiModal>

      <UiModal
        v-model="documentOpen"
        size="sm"
        title="Hujjatni yuklab olish"
        :subtitle="activeDocument ? activeDocument.name : ''"
      >
        <div v-if="activeDocument" class="flex items-center gap-4">
          <span
            class="grid size-12 shrink-0 place-items-center rounded-field"
            :class="DOC_TONE[activeDocument.type] ?? 'bg-ink-100 text-ink-600'"
          >
            <UiIcon name="doc" :size="22" />
          </span>
          <div class="min-w-0">
            <p class="truncate text-[14px] font-bold text-ink-900">{{ activeDocument.name }}</p>
            <p class="mt-0.5 text-[12.5px] text-ink-500">
              {{ activeDocument.size }} · {{ activeDocument.type.toUpperCase() }} ·
              {{ contract.code }}
            </p>
          </div>
        </div>

        <template #footer>
          <UiButton variant="ghost" @click="documentOpen = false">Bekor qilish</UiButton>
          <UiButton @click="downloadDocument">
            <UiIcon name="download" :size="16" />
            Yuklab olish
          </UiButton>
        </template>
      </UiModal>
    </template>
  </main>
</template>
