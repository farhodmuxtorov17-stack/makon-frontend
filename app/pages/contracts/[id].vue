<script setup lang="ts">
import { BUILDINGS } from '~/data/buildings'
import AppTopbar from '~/components/layout/AppTopbar.vue'
import { CONTRACTS, INVOICES, type Contract } from '~/data/business'
import { docxBlob, fileSize, saveBlob, type DocxLine } from '~/utils/docx'
import { dateLong, dateShort, num, sum } from '~/utils/format'

const route = useRoute()
const auth = useAuthStore()
const registry = reactive(CONTRACTS)

/**
 * Bino doirasi kartochkada ham tekshiriladi. Ilgari faqat ro'yxat
 * filtrlanardi va bino rahbari to'g'ridan-to'g'ri havola orqali boshqa
 * obyektning shartnoma shartlarini, ijarachisini va summasini o'qiy olardi.
 */
const contract = computed(() => {
  const found = registry.find((c) => c.id === String(route.params.id)) ?? null
  if (!found) return null
  const site = BUILDINGS.find((b) => b.name === found.buildingName)
  return site && !auth.inScope(site.id) ? null : found
})

const banner = ref('')
const approveOpen = ref(false)
const actOpen = ref(false)
const documentOpen = ref(false)
const activeDocument = ref<{ name: string; size: string; type: string } | null>(null)

/**
 * Reyestrdagi shartnoma bosqichlari. Ijara oqimidan kelgan shartnoma bu yerga
 * allaqachon faol holatda tushadi; reyestrda qo‘lda ochilgan shartnoma esa shu
 * sahifadagi amallar bilan bosqichma-bosqich yuritiladi. Ilgari bu yerda faqat
 * kelishuv qaydi bor edi, shuning uchun yozuv «Qoralama» va «Kelishilmoqda»
 * holatidan hech qachon chiqmasdi.
 */
const agreementStep = computed(
  () => contract.value?.timeline.find((t) => t.label === 'Kelishildi') ?? null,
)

const signedStep = computed(
  () => contract.value?.timeline.find((t) => t.label === 'Imzolandi') ?? null,
)

const activeStep = computed(
  () => contract.value?.timeline.find((t) => t.label === 'Faollashdi') ?? null,
)

const isAgreed = computed(() => agreementStep.value?.done === true)
const isSigned = computed(() => signedStep.value?.done === true)
const isActive = computed(() => activeStep.value?.done === true)

/** Shartnomani yuritish huquqi: rolga emas, amal huquqiga bog‘langan */
const canManage = computed(
  () => Boolean(contract.value) && auth.can('contract.manage') && auth.inScope(contract.value!.buildingId),
)

const relatedInvoices = computed(() =>
  contract.value ? INVOICES.filter((i) => i.tenant === contract.value?.tenant) : [],
)

const relatedDebt = computed(() =>
  relatedInvoices.value.reduce((s, i) => s + (i.total - i.paid), 0),
)

const currentApprover = computed(() => auth.user?.fullName ?? 'Jahongir Alimov')
const approveDate = computed(() => agreementStep.value?.date ?? '-')
const approver = computed(() =>
  isAgreed.value ? (agreementStep.value?.actor ?? '-') : currentApprover.value,
)

/** Kelishuv sanasi haqiqiy soatdan olinadi */
function todayIso() {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function openDocument(doc: { name: string; size: string; type: string }) {
  activeDocument.value = doc
  documentOpen.value = true
}

/** Shartnoma rekvizitlaridan hujjat matni */
function contractHead(c: Contract, title: string): DocxLine[] {
  return [
    { text: 'Makon Property Group', style: 'subtitle' },
    { text: title, style: 'title' },
    { text: `${c.code} · ${dateShort(c.startsAt)}`, style: 'subtitle' },
    { text: 'Tomonlar va obyekt', style: 'heading' },
    { text: `Ijaraga beruvchi: Makon Property Group` },
    { text: `Ijarachi: ${c.tenant}` },
    { text: `Obyekt: ${c.buildingName}, ${c.unitCode}` },
    { text: `Shartnoma turi: ${c.type}` },
  ]
}

function documentLines(c: Contract, name: string): DocxLine[] {
  return [
    ...contractHead(c, name),
    { text: 'Shartlar', style: 'heading' },
    { text: `Boshlanish sanasi: ${dateLong(c.startsAt)}` },
    {
      text: `Tugash sanasi: ${c.endsAt === '-' ? 'muddatsiz' : dateLong(c.endsAt)}`,
    },
    { text: `Shartnoma miqdori: ${sum(c.amount)}` },
    { text: `To‘lov shakli: ${c.paymentTerm}` },
    { text: 'Bosqichlar', style: 'heading' },
    ...c.timeline.map((t) => ({
      text: `${t.label}: ${t.done ? `bajarildi, ${t.date === '-' ? 'sana belgilanmagan' : dateShort(t.date)}, ${t.actor}` : 'kutilmoqda'}`,
    })),
    { text: 'Ijaraga beruvchi: imzo va muhr', style: 'small' },
    { text: 'Ijarachi: imzo va muhr', style: 'small' },
  ]
}

/** MKON-2025-0158 → TSD-2025-0158 */
function actCode(c: Contract) {
  return `TSD-${c.code.replace(/^[A-Z]+-/, '')}`
}

function actLines(c: Contract): DocxLine[] {
  return [
    ...contractHead(c, 'Kelishuv dalolatnomasi'),
    { text: 'Kelishuv qaydi', style: 'heading' },
    { text: `Dalolatnoma raqami: ${actCode(c)}` },
    { text: `Kelishuv sanasi: ${approveDate.value === '-' ? 'belgilanmagan' : dateLong(approveDate.value)}` },
    { text: `Kelishuvni qayd etgan shaxs: ${approver.value}` },
    { text: `Shartnoma miqdori: ${sum(c.amount)}` },
    { text: `Joriy holat: ${c.status}` },
    {
      text: 'Hujjat ichki kelishuvni qayd etadi. Imzolash Didox orqali, tashqi xizmatda bajariladi.',
    },
    { text: 'Ijaraga beruvchi: imzo va muhr', style: 'small' },
    { text: 'Ijarachi: imzo va muhr', style: 'small' },
  ]
}

/** Brauzer saqlaydigan nusxa: nomi va haqiqiy hajmi */
const documentOutput = computed(() => {
  const c = contract.value
  const d = activeDocument.value
  if (!c || !d) return null
  const base = d.name.replace(/\.[^.]+$/, '')
  const blob = docxBlob(documentLines(c, base))
  return { name: `${base}.docx`, size: fileSize(blob.size) }
})

function downloadDocument() {
  const c = contract.value
  const d = activeDocument.value
  if (!c || !d) return
  const base = d.name.replace(/\.[^.]+$/, '')
  const fileName = `${base}.docx`
  saveBlob(docxBlob(documentLines(c, base)), fileName)
  banner.value = `${fileName} fayli saqlandi.`
  documentOpen.value = false
}

function downloadAct() {
  const c = contract.value
  if (!c) return
  const fileName = `${actCode(c)}.docx`
  saveBlob(docxBlob(actLines(c)), fileName)
  banner.value = `${fileName} fayli saqlandi.`
  actOpen.value = false
}

/** Bosqichni bajarilgan deb belgilaydi va mas’ul bilan sanani yozadi */
function completeStep(label: string) {
  const step = contract.value?.timeline.find((t) => t.label === label)
  if (!step || step.done) return
  step.done = true
  step.date = todayIso()
  step.actor = currentApprover.value
}

/** Ichki kelishuv qaydi: shartnoma kelishuv bosqichiga o‘tadi */
function approveContract() {
  const c = contract.value
  if (!c) return
  const person = currentApprover.value
  completeStep('Kelishildi')
  if (c.status === 'DRAFT') c.status = 'REVIEW'
  banner.value = `${c.code} shartnomasi bo‘yicha kelishuv ${person} nomiga qayd etildi. Imzolash Didox orqali davom etadi.`
  approveOpen.value = false
}

/**
 * Imzolangan nusxa Didoxdan qaytgach shartnoma imzolangan deb belgilanadi.
 * Imzo tizim ichida qo‘yilmaydi, bu yerda faqat natija qayd etiladi.
 */
function markSigned() {
  const c = contract.value
  if (!c || !isAgreed.value || isSigned.value) return
  completeStep('Imzolandi')
  c.status = 'SIGNED'
  banner.value = `${c.code} shartnomasi imzolangan deb belgilandi. Endi uni faollashtirish mumkin.`
}

/** Faollashtirish: shartnoma reyestrda amaldagi hujjatga aylanadi */
function activateContract() {
  const c = contract.value
  if (!c || !isSigned.value || isActive.value) return
  completeStep('Faollashdi')
  c.status = 'ACTIVE'
  banner.value = `${c.code} shartnomasi faollashtirildi va reyestrda amalda deb ko‘rsatiladi.`
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

  <main class="scroll-slim flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
    <UiCard v-if="!contract" title="Shartnoma topilmadi">
      <p class="text-[14px] text-ink-600">
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
                <dd class="text-[14px] font-semibold text-ink-900">{{ contract.type }}</dd>
              </div>
              <div class="flex items-baseline justify-between gap-6 py-3">
                <dt class="text-[13px] text-ink-500">Yuridik shaxs / Ijarachi</dt>
                <dd class="text-[14px] font-semibold text-ink-900">{{ contract.tenant }}</dd>
              </div>
              <div class="flex items-baseline justify-between gap-6 py-3">
                <dt class="text-[13px] text-ink-500">Obyekt</dt>
                <dd class="text-right text-[14px] font-semibold text-ink-900">
                  {{ contract.buildingName }}, {{ contract.unitCode }}
                </dd>
              </div>
              <div class="flex items-baseline justify-between gap-6 py-3">
                <dt class="text-[13px] text-ink-500">Boshlanish sanasi</dt>
                <dd class="text-[14px] font-semibold text-ink-900">
                  {{ dateLong(contract.startsAt) }}
                </dd>
              </div>
              <div class="flex items-baseline justify-between gap-6 py-3">
                <dt class="text-[13px] text-ink-500">Tugash sanasi</dt>
                <dd class="text-[14px] font-semibold text-ink-900">
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
                <dd class="text-[14px] font-semibold text-ink-900">{{ contract.paymentTerm }}</dd>
              </div>
              <div class="flex items-baseline justify-between gap-6 py-3">
                <dt class="text-[13px] text-ink-500">Kelishuvni qayd etgan shaxs</dt>
                <dd class="text-right text-[14px] font-semibold text-ink-900">
                  <template v-if="isAgreed">
                    {{ approver }}
                    <span class="tabular block text-[12px] font-medium text-ink-500">
                      {{ dateShort(approveDate) }}
                    </span>
                  </template>
                  <span v-else class="text-[13px] font-medium text-ink-500">
                    Kelishuv kutilmoqda
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
                  <span class="block truncate text-[14px] font-semibold text-ink-900">
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
                  <p class="text-[14px] font-bold text-ink-900">{{ t.label }}</p>
                  <p class="mt-0.5 text-[13px] text-ink-500">
                    {{ t.date === '-' ? 'Sana belgilanmagan' : dateLong(t.date) }} · {{ t.actor }}
                  </p>
                </div>
                <span
                  class="shrink-0 self-start rounded-pill px-2.5 py-1 text-[12px] font-semibold"
                  :class="t.done ? 'bg-ok-50 text-ok-700' : 'bg-ink-100 text-ink-600'"
                >
                  {{ t.done ? 'Bajarildi' : 'Kutilmoqda' }}
                </span>
              </li>
            </ol>
          </UiCard>
        </div>

        <div class="min-w-0 space-y-5">
          <UiCard title="Shartnomani yuritish" subtitle="Kelishuv, imzo va faollashtirish qaydi">
            <div class="rounded-field bg-surface-sunken p-4">
              <div class="flex items-center justify-between gap-3">
                <span class="text-[13px] text-ink-500">Joriy holat</span>
                <UiStatus kind="contract" :value="contract.status" size="sm" />
              </div>
              <p class="mt-2 text-[13px] leading-relaxed text-ink-600">
                {{
                  isAgreed
                    ? `Shartlar ${dateShort(approveDate)} sanasida ${approver} tomonidan kelishilgan deb qayd etilgan.`
                    : 'Shartnoma shartlarni kelishishni kutmoqda. Kelishuv qayd etilgach hujjat imzolashga tayyorlanadi.'
                }}
              </p>
              <p class="mt-2 text-[13px] leading-relaxed text-ink-600">
                {{
                  isSigned
                    ? 'Hujjat Didox orqali imzolangan.'
                    : 'Imzolash Didox orqali, tashqi xizmatda bajariladi. Imzolangan nusxa qaytgach shu yerda qayd etiladi.'
                }}
              </p>
              <p v-if="isActive" class="mt-2 text-[13px] leading-relaxed text-ok-700">
                Shartnoma faollashtirilgan va reyestrda amalda deb ko‘rsatiladi.
              </p>
            </div>

            <template v-if="canManage">
              <UiButton v-if="!isAgreed" class="mt-4" size="lg" block @click="approveOpen = true">
                <UiIcon name="check" :size="18" />
                Kelishuvni qayd etish
              </UiButton>

              <UiButton
                v-else-if="!isSigned"
                class="mt-4"
                size="lg"
                block
                @click="markSigned"
              >
                <UiIcon name="edit" :size="18" />
                Imzolangan deb belgilash
              </UiButton>

              <UiButton
                v-else-if="!isActive"
                class="mt-4"
                size="lg"
                variant="success"
                block
                @click="activateContract"
              >
                <UiIcon name="check" :size="18" />
                Faollashtirish
              </UiButton>
            </template>

            <p
              v-else
              class="mt-4 flex items-center justify-center gap-2 rounded-field bg-ink-100 px-3 py-2.5 text-[13px] font-semibold text-ink-600"
            >
              <UiIcon name="eye" :size="15" />
              Faqat kuzatuv: shartnomani yuritish huquqi yo‘q
            </p>

            <UiButton
              v-if="isAgreed"
              class="mt-3"
              size="lg"
              variant="secondary"
              block
              @click="actOpen = true"
            >
              <UiIcon name="doc" :size="18" />
              Kelishuv dalolatnomasini ko‘rish
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
        title="Kelishuvni qayd etish"
        :subtitle="contract.code"
      >
        <p class="text-[14px] leading-relaxed text-ink-700">
          Kelishuv faqat tizim ichida qayd etiladi: dalolatnomaga kelishuvni qayd etgan shaxsning
          ismi va sana yoziladi. Hujjat imzolanmaydi va faollashtirilmaydi, imzolash Didox orqali
          alohida bajariladi.
        </p>
        <dl class="mt-4 divide-y divide-ink-100 rounded-field bg-surface-sunken px-4">
          <div class="flex items-baseline justify-between gap-4 py-2.5">
            <dt class="text-[13px] text-ink-500">Tomon</dt>
            <dd class="text-[14px] font-semibold text-ink-900">{{ contract.tenant }}</dd>
          </div>
          <div class="flex items-baseline justify-between gap-4 py-2.5">
            <dt class="text-[13px] text-ink-500">Kelishuvni qayd etuvchi</dt>
            <dd class="text-[14px] font-semibold text-ink-900">{{ currentApprover }}</dd>
          </div>
          <div class="flex items-baseline justify-between gap-4 py-2.5">
            <dt class="text-[13px] text-ink-500">Kelishuv sanasi</dt>
            <dd class="tabular text-[14px] font-semibold text-ink-900">
              {{ dateShort(todayIso()) }}
            </dd>
          </div>
          <div class="flex items-baseline justify-between gap-4 py-2.5">
            <dt class="text-[13px] text-ink-500">Miqdor</dt>
            <dd class="tabular text-[14px] font-semibold text-ink-900">
              {{ sum(contract.amount) }}
            </dd>
          </div>
          <div class="flex items-baseline justify-between gap-4 py-2.5">
            <dt class="text-[13px] text-ink-500">Amal qilish muddati</dt>
            <dd class="text-[14px] font-semibold text-ink-900">
              {{ dateShort(contract.startsAt) }} · {{ contract.endsAt === '-' ? 'muddatsiz' : dateShort(contract.endsAt) }}
            </dd>
          </div>
        </dl>

        <template #footer>
          <UiButton variant="ghost" @click="approveOpen = false">Bekor qilish</UiButton>
          <UiButton variant="success" @click="approveContract">
            <UiIcon name="check" :size="16" />
            Kelishuvni qayd etish
          </UiButton>
        </template>
      </UiModal>

      <UiModal
        v-model="actOpen"
        size="sm"
        title="Kelishuv dalolatnomasi"
        :subtitle="contract.code"
      >
        <dl class="divide-y divide-ink-100">
          <div class="flex items-baseline justify-between gap-4 py-2.5">
            <dt class="text-[13px] text-ink-500">Kelishuv sanasi</dt>
            <dd class="text-[14px] font-semibold text-ink-900">{{ dateLong(approveDate) }}</dd>
          </div>
          <div class="flex items-baseline justify-between gap-4 py-2.5">
            <dt class="text-[13px] text-ink-500">Kelishuvni qayd etgan shaxs</dt>
            <dd class="text-[14px] font-semibold text-ink-900">{{ approver }}</dd>
          </div>
          <div class="flex items-baseline justify-between gap-4 py-2.5">
            <dt class="text-[13px] text-ink-500">Tomon</dt>
            <dd class="text-[14px] font-semibold text-ink-900">{{ contract.tenant }}</dd>
          </div>
          <div class="flex items-baseline justify-between gap-4 py-2.5">
            <dt class="text-[13px] text-ink-500">Dalolatnoma raqami</dt>
            <dd class="tabular text-[14px] font-semibold text-ink-900">
              {{ actCode(contract) }}
            </dd>
          </div>
          <div class="flex items-baseline justify-between gap-4 py-2.5">
            <dt class="text-[13px] text-ink-500">Holati</dt>
            <dd><UiStatus kind="contract" :value="contract.status" size="sm" /></dd>
          </div>
        </dl>

        <template #footer>
          <UiButton variant="ghost" @click="actOpen = false">Yopish</UiButton>
          <UiButton @click="downloadAct">
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
            <p class="truncate text-[14px] font-bold text-ink-900">{{ documentOutput?.name }}</p>
            <p class="mt-0.5 text-[13px] text-ink-500">
              DOCX · {{ documentOutput?.size }} · {{ contract.code }}
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
