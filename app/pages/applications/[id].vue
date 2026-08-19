<script setup lang="ts">
import {
  buildSchedule,
  serviceTotalOf,
  type LeaseOffer,
  type Periodicity,
  type SignedDocument,
} from '~/stores/lease'
import { unitById, vacantUnits } from '~/data/units'
import { buildingById } from '~/data/buildings'
import { ROLE_META } from '~/constants/roles'
import { area, dateShort, num, sum, timeOf } from '~/utils/format'

const route = useRoute()
const auth = useAuthStore()
const lease = useLeaseStore()

lease.seed()

/**
 * Biriktirilgan binodan tashqaridagi ariza to‘g‘ridan-to‘g‘ri havola bilan ham
 * ochilmaydi: yozuv topilmagan holatga tushadi va barcha amal tugmalari yopiladi.
 */
const item = computed(() => {
  const c = lease.byId(String(route.params.id))
  if (!c) return null
  /* Maydoni belgilanmagan ariza hech bir binoga tegishli emas: uni operator ochadi */
  return !c.buildingId || auth.inScope(c.buildingId) ? c : null
})
const unit = computed(() => (item.value?.unitId ? unitById(item.value.unitId) : undefined))

/** Maydon hali kelishilmagan: operator qo‘ng‘iroqdan keyin belgilaydi */
const needsUnit = computed(() => Boolean(item.value) && !item.value!.unitId)

/** Soha tekshiruvi: maydonsiz ariza barcha mas’ul xodimlarga ochiq */
const inScope = computed(
  () => Boolean(item.value) && (!item.value!.buildingId || auth.inScope(item.value!.buildingId)),
)

const actorName = computed(() => auth.user?.fullName ?? '-')
/** Audit jurnalidagi rol nomi joriy foydalanuvchidan olinadi */
const roleLabel = computed(() => (auth.role ? ROLE_META[auth.role].label : 'Xodim'))

/**
 * Arizani oxirigacha olib boradigan rol. Ilgari bu tekshiruv store ichida
 * edi va bitta binoga bog‘langan, shuning uchun boshqa binolarning arizasi
 * hech kimga yetib bormasdi.
 */
const canManage = computed(() => auth.can('application.decide') || auth.can('system.administer'))

/**
 * Sotuv so‘rovi ijara oqimiga kirmaydi: oldi-sotdi shartnomasi tizim orqali
 * tuzilmaydi, shuning uchun bunday yozuvda faqat bog‘lanish va rad etish bor.
 */
const isPurchase = computed(() => item.value?.request.type === 'Sotib olish')

// --- Kelishilgan shartlar formasi -----------------------------------------

const form = reactive({
  monthlyRent: 0,
  deposit: 0,
  servicePerSqm: 0,
  periodicity: 'Oylik' as Periodicity,
  adjustmentReason: '',
})

const PERIODICITY_OPTIONS = [
  { value: 'Oylik', label: 'Oylik' },
  { value: 'Choraklik', label: 'Choraklik' },
  { value: 'Yillik', label: 'Yillik' },
]

watch(
  item,
  (c) => {
    if (!c) return
    if (c.offer) {
      form.monthlyRent = c.offer.monthlyRent
      form.deposit = c.offer.deposit
      form.servicePerSqm = c.offer.servicePerSqm
      form.periodicity = c.offer.periodicity
      form.adjustmentReason = c.offer.adjustmentReason
      return
    }
    const base = c.request.offerPrice || unit.value?.price || 0
    form.monthlyRent = base
    form.deposit = base * 2
    form.servicePerSqm = 18000
    form.periodicity = 'Oylik'
    form.adjustmentReason = ''
  },
  { immediate: true },
)

const draftOffer = computed<LeaseOffer>(() => ({
  monthlyRent: Number(form.monthlyRent) || 0,
  deposit: Number(form.deposit) || 0,
  servicePerSqm: Number(form.servicePerSqm) || 0,
  periodicity: form.periodicity,
  adjustmentReason: form.adjustmentReason.trim(),
}))

/** Kirish qiymatlari o‘zgarishi bilan grafik qayta hisoblanadi */
const previewSchedule = computed(() =>
  item.value ? buildSchedule(draftOffer.value, item.value.request, item.value.area) : [],
)

const serviceTotal = computed(() =>
  item.value ? serviceTotalOf(draftOffer.value, item.value.area) : 0,
)

// --- Rolga bog‘liq amallar -------------------------------------------------

/**
 * Shartnoma bosqichlari aniq rolga emas, amal huquqiga va biriktirilgan
 * binoga bog‘lanadi. Ilgari tekshiruv bitta rolga bog‘langani uchun o‘sha
 * rolning binosidan tashqaridagi ariza shartnoma bosqichida abadiy qolib
 * ketardi: endi `contract.manage` huquqi bor har bir rol o‘z doirasidagi
 * arizani oxirigacha olib boradi.
 */
const canSign = computed(
  () => Boolean(item.value) && auth.can('contract.manage') && inScope.value,
)

/**
 * Yagona tasdiq: operator telefon orqali kelishgan shartlarni kiritadi va
 * arizani tasdiqlaydi. Tugma bosilgan zahoti shartnoma tuziladi, oraliq
 * moliya tasdig‘i yo‘q.
 */
const canApprove = computed(
  () =>
    item.value?.status === 'YANGI' &&
    !needsUnit.value &&
    !isPurchase.value &&
    auth.can('application.decide') &&
    inScope.value,
)

/** Maydonni belgilash huquqi arizani yuritish huquqidan kelib chiqadi */
const canAssignUnit = computed(
  () => needsUnit.value && item.value?.status === 'YANGI' && auth.can('application.decide'),
)

/** Shartnoma matni Didoxga yuborilgunicha tahrirlanadi */
const canEditContract = computed(
  () => item.value?.status === 'SHARTNOMA_TAYYOR' && Boolean(item.value.contract) && canSign.value,
)

const canSendDidox = computed(() => item.value?.status === 'SHARTNOMA_TAYYOR' && canSign.value)

const canCheckDidox = computed(() => item.value?.status === 'DIDOX_YUBORILDI' && canSign.value)

const canUpload = computed(() => item.value?.status === 'DIDOX_IMZOLANDI' && canSign.value)

/** Ariza yopiladi: imzolangan nusxa yuklangandan keyin */
const canClose = computed(
  () =>
    item.value?.status === 'DIDOX_IMZOLANDI' &&
    Boolean(item.value?.signedDocument) &&
    canSign.value,
)

/** Rad etish har bir jonli bosqichda ochiq: sikl hech qayerda qotib qolmaydi */
const canDecide = computed(
  () =>
    Boolean(item.value) &&
    !['FAOL', 'RAD_ETILDI'].includes(item.value?.status ?? '') &&
    (auth.can('application.decide') || canSign.value),
)

/** Birinchi bosqichda qaytariladigan oldingi bosqich yo‘q */
const canRework = computed(() => canDecide.value && item.value?.status !== 'YANGI')

/** Qaror huquqi yo‘q rol uchun tugma o‘rniga aniq belgi ko‘rsatiladi */
const readOnly = computed(
  () =>
    !auth.can('application.decide') &&
    !canSign.value &&
    !['FAOL', 'RAD_ETILDI'].includes(item.value?.status ?? ''),
)

/** Obyektlar moduli hamma rolga ochiq emas, havola shunga qarab ko‘rsatiladi */
const canOpenObjects = computed(() => auth.canRoute('/objects'))

const editing = computed(() => canApprove.value)

// --- Maydonni belgilash ----------------------------------------------------

const unitChoice = ref('')

/** Bo‘sh maydonlar, byudjetga yaqinligi bo‘yicha tartiblangan */
const unitOptions = computed(() => {
  const budget = item.value?.request.offerPrice ?? 0
  const monthly = (u: { price: number; area: number; priceUnit: string }) =>
    u.priceUnit === 'so‘m / m²' ? Math.round(u.price * u.area) : u.price
  return vacantUnits()
    .filter((u) => u.offer !== 'Sotuv' && auth.inScope(u.buildingId))
    .slice()
    .sort((a, b) => Math.abs(monthly(a) - budget) - Math.abs(monthly(b) - budget))
    .map((u) => ({
      value: u.id,
      label: `${buildingById(u.buildingId)?.name ?? ''} · Unit ${u.code} · ${num(u.area, 2)} m² · ${sum(monthly(u))} / oy`,
    }))
})

function assignUnit() {
  if (!item.value || !unitChoice.value) return
  lease.assignUnit(item.value.id, actorName.value, roleLabel.value, unitChoice.value)
  say(`Maydon belgilandi: ${item.value.buildingName} · Unit ${item.value.unitCode}.`)
  unitChoice.value = ''
}

const shownSchedule = computed(() =>
  editing.value ? previewSchedule.value : (item.value?.schedule ?? []),
)

const formInvalid = computed(() => draftOffer.value.monthlyRent <= 0)

/** Didox bosqichi ko‘rinadigan holatlar */
const didoxStage = computed(() =>
  ['DIDOX_YUBORILDI', 'DIDOX_IMZOLANDI', 'FAOL'].includes(item.value?.status ?? ''),
)

const closeBlockers = computed(() => {
  const c = item.value
  if (!c) return []
  const list: string[] = []
  if (c.didox?.state !== 'Imzolangan') list.push('Didox holati «Imzolangan» ga o‘tmagan')
  if (!c.signedDocument) list.push('Imzolangan hujjat tizimga yuklanmagan')
  if (!canSign.value) list.push('Arizani yopish huquqi shartnoma yuritish huquqiga bog‘langan')
  return list
})

// --- Amallar ---------------------------------------------------------------

const contractOpen = ref(false)
const contractEditOpen = ref(false)
const rejectOpen = ref(false)
const reworkOpen = ref(false)
const reason = ref('')
const notice = ref('')
/** Xabar ohangi: tekshiruv natijasi o‘zgarishsiz bo‘lsa yashil emas, kulrang */
const noticeTone = ref<'ok' | 'info'>('ok')

function say(text: string, tone: 'ok' | 'info' = 'ok') {
  notice.value = text
  noticeTone.value = tone
}

function approve() {
  if (!item.value || formInvalid.value) return
  lease.approveApplication(item.value.id, actorName.value, roleLabel.value, draftOffer.value)
  const code = item.value.contract?.code
  say(
    code
      ? `Ariza tasdiqlandi. Tizim ${code} raqamli ijara shartnomasini tuzdi.`
      : 'Ariza tasdiqlandi.',
  )
}

function sendDidox() {
  if (!item.value) return
  lease.sendToDidox(item.value.id, actorName.value, roleLabel.value)
  say(`Hujjat Didox orqali imzolashga yuborildi: ${item.value.didox?.docNumber ?? '-'}.`)
}

/**
 * Tekshiruv natijasi qanday bo‘lsa, shunday aytiladi. Ilgari holat
 * o‘zgarmagan taqdirda ham «yangilandi» deb yozilar edi.
 */
function checkDidox() {
  if (!item.value) return
  const result = lease.checkDidox(item.value.id, actorName.value, roleLabel.value)
  if (!result) return
  if (result.changed) say(`Didoxda yangi holat: ${result.state}.`)
  else say(`Didoxda holat o‘zgarmagan, hujjat hamon «${result.state}» holatida.`, 'info')
}

function onUpload(file: Omit<SignedDocument, 'uploadedAt' | 'uploadedBy'>) {
  if (!item.value) return
  lease.attachSignedDocument(item.value.id, actorName.value, roleLabel.value, file)
  say(`${file.fileName} yuklandi, nazorat yig‘indisi hisoblandi.`)
}

function onRemoveUpload() {
  if (!item.value) return
  lease.removeSignedDocument(item.value.id, actorName.value, roleLabel.value)
  notice.value = ''
}

function closeCase() {
  if (!item.value || !canClose.value) return
  lease.closeCase(item.value.id, actorName.value, roleLabel.value)
  say(
    `Ariza yopildi. Ijarachiga ${item.value.access?.login ?? '-'} logini berildi, parol quyida ko‘rsatilgan.`,
  )
}

function confirmReject() {
  if (!item.value || !reason.value.trim()) return
  lease.reject(
    item.value.id,
    actorName.value,
    roleLabel.value,
    reason.value.trim(),
  )
  rejectOpen.value = false
  reason.value = ''
}

function confirmRework() {
  if (!item.value || !reason.value.trim()) return
  lease.returnForRework(
    item.value.id,
    actorName.value,
    roleLabel.value,
    reason.value.trim(),
  )
  reworkOpen.value = false
  reason.value = ''
}

function markContacted() {
  if (!item.value) return
  lease.markContacted(item.value.id, actorName.value, roleLabel.value)
}

/** Hisobsiz mijozga kabinet ochish taklif qilinadi */
function inviteAccount() {
  if (!item.value) return
  lease.inviteAccount(item.value.id, actorName.value, roleLabel.value)
  say('Mijozga kabinet ochish taklif qilindi, u parol o‘rnatib kabinetga kiradi.')
}

// --- Shartnomani tizim ichida tahrirlash -----------------------------------

const clauseDraft = ref<Array<{ title: string; text: string }>>([])

function openContractEditor() {
  clauseDraft.value = (item.value?.contract?.clauses ?? []).map((c) => ({ ...c }))
  contractEditOpen.value = true
}

function addClause() {
  clauseDraft.value.push({ title: '', text: '' })
}

function removeClause(index: number) {
  clauseDraft.value.splice(index, 1)
}

const clauseDraftValid = computed(() =>
  clauseDraft.value.every((c) => c.title.trim() && c.text.trim()),
)

function saveContract() {
  if (!item.value || !clauseDraftValid.value) return
  lease.editContract(item.value.id, actorName.value, roleLabel.value, clauseDraft.value)
  contractEditOpen.value = false
  say(`${item.value.contract?.code ?? 'Shartnoma'} matni yangilandi.`)
}

// --- Kabinet kaliti --------------------------------------------------------

const copied = ref('')

async function copyValue(label: string, value: string) {
  try {
    await navigator.clipboard.writeText(value)
    copied.value = label
    setTimeout(() => (copied.value = ''), 2200)
  } catch {
    copied.value = ''
  }
}
</script>

<template>
  <AppTopbar
    :title="item?.code ?? 'Ariza topilmadi'"
    :subtitle="
      item
        ? item.unitId
          ? `${item.org.name} · ${item.buildingName} · Unit ${item.unitCode}`
          : `${item.org.name} · maydon Operator bilan kelishiladi`
        : undefined
    "
    :breadcrumb="[{ label: 'Arizalar', to: '/applications' }, { label: item?.code ?? '-' }]"
  >
    <template #actions>
      <UiButton variant="secondary" size="sm" to="/applications">
        <UiIcon name="chevronLeft" :size="16" />
        Navbatga qaytish
      </UiButton>
    </template>
  </AppTopbar>

  <main v-if="item" class="scroll-slim flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
    <div
      v-if="notice"
      class="flex items-start gap-3 rounded-card px-4 py-3.5 ring-1 ring-inset"
      :class="noticeTone === 'ok' ? 'bg-ok-50 ring-ok-100' : 'bg-ink-50 ring-ink-200'"
      role="status"
    >
      <UiIcon
        :name="noticeTone === 'ok' ? 'check' : 'info'"
        :size="18"
        class="mt-0.5 shrink-0"
        :class="noticeTone === 'ok' ? 'text-ok-600' : 'text-ink-500'"
      />
      <p
        class="min-w-0 flex-1 text-[13px] font-medium"
        :class="noticeTone === 'ok' ? 'text-ok-700' : 'text-ink-700'"
      >
        {{ notice }}
      </p>
      <button
        type="button"
        class="shrink-0 rounded-[8px] p-1.5 transition-colors"
        :class="
          noticeTone === 'ok'
            ? 'text-ok-600 hover:bg-ok-100'
            : 'text-ink-500 hover:bg-ink-100'
        "
        aria-label="Xabarni yopish"
        @click="notice = ''"
      >
        <UiIcon name="x" :size="15" />
      </button>
    </div>

    <!-- Holat va bosqichlar -->
    <UiCard>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex flex-wrap items-center gap-2.5">
          <UiStatus kind="lease" :value="item.status" />
          <span class="rounded-pill bg-ink-100 px-2.5 py-1 text-[12px] font-semibold text-ink-700">
            {{ item.request.type }}
          </span>
          <span
            v-if="item.contract"
            class="rounded-pill bg-brand-50 px-2.5 py-1 text-[12px] font-semibold text-brand-700"
          >
            {{ item.contract.code }}
          </span>
        </div>

        <div class="flex flex-wrap gap-2">
          <UiButton v-if="item.contract" variant="secondary" size="sm" @click="contractOpen = true">
            <UiIcon name="doc" :size="15" />
            Shartnomani ko‘rish
          </UiButton>

          <UiButton v-if="canEditContract" variant="secondary" size="sm" @click="openContractEditor">
            <UiIcon name="edit" :size="15" />
            Shartnomani tahrirlash
          </UiButton>

          <UiButton v-if="canSendDidox" size="sm" @click="sendDidox">
            <UiIcon name="send" :size="15" />
            Didox orqali yuborish
          </UiButton>

          <UiButton v-if="canCheckDidox" size="sm" @click="checkDidox">
            <UiIcon name="refresh" :size="15" />
            Didox holatini tekshirish
          </UiButton>

          <UiButton
            v-if="canApprove"
            variant="success"
            size="sm"
            :disabled="formInvalid"
            @click="approve"
          >
            <UiIcon name="check" :size="15" />
            Tasdiqlash
          </UiButton>

          <UiButton v-if="canRework" variant="secondary" size="sm" @click="reworkOpen = true">
            <UiIcon name="refresh" :size="15" />
            Qayta ishlashga yuborish
          </UiButton>

          <UiButton v-if="canDecide" variant="danger" size="sm" @click="rejectOpen = true">
            <UiIcon name="x" :size="15" />
            Rad etish
          </UiButton>

          <span
            v-if="readOnly"
            class="inline-flex items-center gap-2 rounded-pill bg-ink-100 px-3 py-1.5 text-[12px] font-semibold text-ink-600"
          >
            <UiIcon name="eye" :size="15" />
            Faqat kuzatuv: qaror huquqi yo‘q
          </span>
        </div>
      </div>

      <div class="mt-5">
        <LeaseFlow :status="item.status" />
      </div>

      <p
        v-if="needsUnit && item.status === 'YANGI'"
        class="mt-4 flex items-start gap-2 rounded-field bg-warn-50 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-warn-700 ring-1 ring-inset ring-warn-100"
      >
        <UiIcon name="info" :size="15" class="mt-px shrink-0" />
        <span>
          Maydon Operator bilan kelishiladi: mijoz ariza yuborganda maydon tanlamagan.
          Qo‘ng‘iroqdan keyin o‘ng paneldagi ro‘yxatdan maydonni belgilang, shundan keyin
          arizani tasdiqlash mumkin bo‘ladi.
        </span>
      </p>

      <p
        v-if="item.status === 'RAD_ETILDI' && item.rejectReason"
        class="mt-4 flex items-start gap-2 rounded-field bg-danger-50 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-danger-700 ring-1 ring-inset ring-danger-100"
      >
        <UiIcon name="warning" :size="15" class="mt-px shrink-0" />
        Rad etish sababi: {{ item.rejectReason }}
      </p>
    </UiCard>

    <!-- Ariza yopilgandagi o‘zgarishlar -->
    <LeaseActivation
      v-if="item.activation"
      :at="item.activation.at"
      :changes="item.activation.changes"
    />

    <div class="grid gap-5 xl:grid-cols-3">
      <div class="space-y-5 xl:col-span-2">
        <!-- Ariza va bog‘lanish -->
        <UiCard title="Ariza ma’lumotlari" subtitle="Ijarachi kiritgan shartlar" icon="clipboard">
          <dl class="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <div>
              <dt class="text-[12px] text-ink-500">Tashkilot</dt>
              <dd class="mt-0.5 text-sm font-semibold text-ink-900">{{ item.org.name }}</dd>
            </div>
            <div>
              <dt class="text-[12px] text-ink-500">STIR</dt>
              <dd class="tabular mt-0.5 text-sm font-semibold text-ink-900">{{ item.org.tin }}</dd>
            </div>
            <div>
              <dt class="text-[12px] text-ink-500">Taklif narxi (oylik)</dt>
              <dd class="tabular mt-0.5 text-sm font-semibold text-ink-900">
                {{ sum(item.request.offerPrice) }}
              </dd>
            </div>
            <div>
              <dt class="text-[12px] text-ink-500">Muddat</dt>
              <dd class="tabular mt-0.5 text-sm font-semibold text-ink-900">
                {{ item.request.term }} oy · {{ dateShort(item.request.startDate) }} dan
              </dd>
            </div>
            <div>
              <dt class="text-[12px] text-ink-500">Yuborilgan sana</dt>
              <dd class="tabular mt-0.5 text-sm font-semibold text-ink-900">
                {{ dateShort(item.request.submittedAt) }} {{ timeOf(item.request.submittedAt) }}
              </dd>
            </div>
            <div>
              <dt class="text-[12px] text-ink-500">Yuridik manzil</dt>
              <dd class="mt-0.5 text-sm font-semibold text-ink-900">{{ item.org.address }}</dd>
            </div>
            <div v-if="item.request.note" class="sm:col-span-2">
              <dt class="text-[12px] text-ink-500">Izoh</dt>
              <dd class="mt-1 rounded-field bg-surface-sunken p-3.5 text-[13px] leading-relaxed text-ink-700">
                {{ item.request.note }}
              </dd>
            </div>
          </dl>

          <!-- Bog‘lanish bloki -->
          <div class="mt-5 rounded-field bg-surface-sunken p-4 ring-1 ring-inset ring-ink-200">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <p class="text-[11.5px] font-semibold uppercase tracking-wide text-ink-500">
                Bog‘lanish
              </p>
              <span
                v-if="item.contactedAt"
                class="inline-flex items-center gap-1.5 rounded-pill bg-ok-50 px-2.5 py-1 text-[11.5px] font-semibold text-ok-700 ring-1 ring-inset ring-ok-100"
              >
                <UiIcon name="check" :size="12" />
                Bog‘lanildi · {{ dateShort(item.contactedAt) }} {{ timeOf(item.contactedAt) }}
              </span>
            </div>

            <div class="mt-3 grid gap-3 sm:grid-cols-3">
              <div class="flex items-center gap-2.5">
                <span class="grid size-9 shrink-0 place-items-center rounded-[10px] bg-white text-brand-600 ring-1 ring-ink-200">
                  <UiIcon name="user" :size="16" />
                </span>
                <span class="min-w-0">
                  <span class="block text-[11.5px] text-ink-500">Vakil</span>
                  <span class="block truncate text-[13px] font-semibold text-ink-900">
                    {{ item.org.director }}
                  </span>
                </span>
              </div>
              <a
                :href="`tel:${item.org.phone.replace(/\s/g, '')}`"
                class="flex items-center gap-2.5 rounded-field transition-colors duration-150 hover:bg-white"
              >
                <span class="grid size-9 shrink-0 place-items-center rounded-[10px] bg-white text-brand-600 ring-1 ring-ink-200">
                  <UiIcon name="phone" :size="16" />
                </span>
                <span class="min-w-0">
                  <span class="block text-[11.5px] text-ink-500">Telefon</span>
                  <span class="tabular block truncate text-[13px] font-semibold text-brand-700">
                    {{ item.org.phone }}
                  </span>
                </span>
              </a>
              <a
                :href="`mailto:${item.org.email}`"
                class="flex items-center gap-2.5 rounded-field transition-colors duration-150 hover:bg-white"
              >
                <span class="grid size-9 shrink-0 place-items-center rounded-[10px] bg-white text-brand-600 ring-1 ring-ink-200">
                  <UiIcon name="send" :size="16" />
                </span>
                <span class="min-w-0">
                  <span class="block text-[11.5px] text-ink-500">E-pochta</span>
                  <span class="block truncate text-[13px] font-semibold text-brand-700">
                    {{ item.org.email }}
                  </span>
                </span>
              </a>
            </div>

            <UiButton
              v-if="!item.contactedAt && canManage"
              variant="secondary"
              size="sm"
              class="mt-3"
              @click="markContacted"
            >
              <UiIcon name="check" :size="15" />
              Bog‘lanildi deb belgilash
            </UiButton>
          </div>

          <!-- Hisobsiz yuborilgan ariza -->
          <div
            v-if="item.guest"
            class="mt-4 rounded-field bg-warn-50 p-4 ring-1 ring-inset ring-warn-100"
          >
            <p class="flex items-start gap-2 text-[12.5px] font-semibold text-warn-700">
              <UiIcon name="info" :size="15" class="mt-px shrink-0" />
              Mijozda hali hisob yo‘q: ariza ochiq forma orqali yuborilgan
            </p>
            <p class="mt-1.5 text-[12.5px] leading-relaxed text-ink-600">
              Ariza yuborgan shaxs: {{ item.contactName }}. Telefon raqami bir martalik kod bilan
              tasdiqlangan.
            </p>

            <template v-if="item.accountInvitedAt">
              <p class="mt-2.5 flex items-center gap-2 text-[12.5px] font-semibold text-ok-700">
                <UiIcon name="check" :size="15" class="shrink-0" />
                Kabinet ochish taklif qilindi: {{ dateShort(item.accountInvitedAt) }}
                {{ timeOf(item.accountInvitedAt) }}
              </p>
              <p class="mt-1.5 text-[12px] leading-relaxed text-ink-600">
                Mijoz ariza sahifasidan parol o‘rnatadi va kabinetga kiradi.
              </p>
            </template>

            <UiButton
              v-else-if="canManage"
              variant="secondary"
              size="sm"
              class="mt-3"
              @click="inviteAccount"
            >
              <UiIcon name="user" :size="15" />
              Kabinet yaratishni taklif qilish
            </UiButton>
          </div>
        </UiCard>

        <!-- Kelishilgan shartlar -->
        <UiCard
          title="Kelishilgan shartlar"
          :subtitle="
            editing
              ? 'Telefon suhbatida kelishilgan qiymatlarni kiriting: to‘lov grafigi darhol qayta hisoblanadi'
              : 'Tasdiqlangan shartlar'
          "
          icon="wallet"
          tone="teal"
        >
          <div v-if="editing" class="grid gap-4 sm:grid-cols-2">
            <UiField label="Oylik ijara narxi" required hint="so‘m / oy">
              <UiInput v-model="form.monthlyRent" type="number" min="0" :invalid="formInvalid">
                <template #suffix><span class="text-[12px]">so‘m</span></template>
              </UiInput>
            </UiField>
            <UiField label="Kafolat depoziti" hint="so‘m, bir martalik">
              <UiInput v-model="form.deposit" type="number" min="0">
                <template #suffix><span class="text-[12px]">so‘m</span></template>
              </UiInput>
            </UiField>
            <UiField
              label="Servis to‘lovi"
              :hint="`so‘m / m² / oy · ${num(item.area, 2)} m² uchun jami ${sum(serviceTotal)}`"
            >
              <UiInput v-model="form.servicePerSqm" type="number" min="0">
                <template #suffix><span class="text-[12px]">so‘m/m²</span></template>
              </UiInput>
            </UiField>
            <UiField label="To‘lov davriyligi" required>
              <UiSelect v-model="form.periodicity" :options="PERIODICITY_OPTIONS" />
            </UiField>

            <UiField
              label="Kelishuv izohi"
              class="sm:col-span-2"
              hint="Suhbatda kelishilgan qo‘shimcha shart audit jurnalida qoladi"
            >
              <UiInput
                v-model="form.adjustmentReason"
                placeholder="Masalan: depozit ikki oylik ijara miqdorigacha kelishildi"
              />
            </UiField>
          </div>

          <LeaseTotals v-else :item="item" />

          <div v-if="editing" class="mt-5 border-t border-ink-100 pt-5">
            <LeaseTotals :item="{ ...item, offer: draftOffer, schedule: previewSchedule }" />
          </div>
        </UiCard>

        <!-- To‘lov grafigi -->
        <UiCard
          title="To‘lov grafigi"
          subtitle="Shartlar asosida avtomatik hisoblanadi"
          icon="calendar"
          tone="brand"
        >
          <LeaseSchedule :rows="shownSchedule" />
        </UiCard>

        <!-- Didox -->
        <UiCard
          v-if="didoxStage"
          title="Didox orqali imzolash"
          subtitle="Tashqi xizmatdagi hujjat holati"
          icon="external"
          tone="info"
        >
          <LeaseDidox :item="item" :can-check="canCheckDidox" @check="checkDidox" />
        </UiCard>

        <!-- Imzolangan hujjatni yuklash va arizani yopish -->
        <UiCard
          v-if="item.status === 'DIDOX_IMZOLANDI' || item.status === 'FAOL'"
          title="Imzolangan hujjat va arizani yopish"
          subtitle="Didox’dan olingan nusxa ariza kartochkasiga yuklanadi"
          icon="shield"
          tone="ok"
        >
          <LeaseSignedUpload
            :document="item.signedDocument"
            :readonly="!canUpload"
            @upload="onUpload"
            @remove="onRemoveUpload"
          />

          <div v-if="item.status !== 'FAOL'" class="mt-4">
            <UiButton :disabled="!canClose" @click="closeCase">
              <UiIcon name="check" :size="17" />
              Arizani yopish
            </UiButton>
            <p class="mt-2 text-[12.5px] leading-relaxed text-ink-500">
              Ariza yopilganda unit band qilinadi, shartnoma reyestrga tushadi va ijarachi kabineti
              uchun login bilan parol beriladi.
            </p>

            <p
              v-if="closeBlockers.length"
              class="mt-2.5 flex items-start gap-2 rounded-field bg-warn-50 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-warn-700 ring-1 ring-inset ring-warn-100"
            >
              <UiIcon name="warning" :size="15" class="mt-px shrink-0" />
              <span>
                Arizani yopish uchun yetishmayapti:
                <b>{{ closeBlockers.join('; ') }}</b>
              </span>
            </p>
          </div>
        </UiCard>

        <!-- Ijarachi kabineti uchun kalit -->
        <UiCard
          v-if="item.access"
          title="Ijarachi kabineti"
          subtitle="Ariza yopilganda tizim avtomatik bergan kirish ma’lumotlari"
          icon="user"
          tone="brand"
        >
          <div class="grid gap-3 sm:grid-cols-2">
            <div
              v-for="row in [
                { key: 'login', label: 'Login', value: item.access.login },
                { key: 'password', label: 'Parol', value: item.access.password },
              ]"
              :key="row.key"
              class="rounded-field bg-surface-sunken p-4 ring-1 ring-inset ring-ink-200"
            >
              <p class="text-[11.5px] font-semibold uppercase tracking-wide text-ink-500">
                {{ row.label }}
              </p>
              <div class="mt-1.5 flex items-center gap-2">
                <code
                  class="tabular min-w-0 flex-1 truncate rounded-[6px] bg-white px-2.5 py-1.5 text-[14px] font-bold text-ink-900 ring-1 ring-inset ring-ink-200"
                >
                  {{ row.value }}
                </code>
                <button
                  type="button"
                  class="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-field px-2.5 text-[12px] font-semibold text-brand-600 transition-colors duration-150 hover:bg-white"
                  :aria-label="`${row.label} qiymatidan nusxa olish`"
                  @click="copyValue(row.key, row.value)"
                >
                  <UiIcon :name="copied === row.key ? 'check' : 'clipboard'" :size="14" />
                  {{ copied === row.key ? 'Nusxalandi' : 'Nusxa olish' }}
                </button>
              </div>
            </div>
          </div>

          <p class="mt-3.5 flex items-start gap-2 rounded-field bg-brand-50 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-brand-700 ring-1 ring-inset ring-brand-200">
            <UiIcon name="info" :size="15" class="mt-px shrink-0" />
            <span>
              Kalit {{ dateShort(item.access.issuedAt) }} {{ timeOf(item.access.issuedAt) }} da
              berildi. Uni ijarachi vakiliga yetkazing, kabinetga birinchi kirishda parol
              o‘zgartiriladi.
            </span>
          </p>
        </UiCard>

        <!-- Audit -->
        <UiCard title="Audit jurnali" subtitle="Kim, qachon, nima qildi" icon="clipboard" tone="neutral">
          <LeaseAudit :entries="item.audit" />
        </UiCard>
      </div>

      <!-- Unit paneli -->
      <div class="min-w-0">
        <UiCard
          class="xl:sticky xl:top-[88px]"
          :title="needsUnit ? 'Maydon tanlanmagan' : 'So‘ralayotgan unit'"
          :subtitle="needsUnit ? 'Operator qo‘ng‘iroqda kelishadi' : item.buildingName"
          icon="building"
        >
          <template v-if="needsUnit">
            <p
              class="flex items-start gap-2 rounded-field bg-warn-50 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-warn-700 ring-1 ring-inset ring-warn-100"
            >
              <UiIcon name="info" :size="15" class="mt-px shrink-0" />
              Mijoz ariza yuborganda maydon tanlamagan: u byudjet va muddatni ko‘rsatgan.
              Maydon telefon suhbatidan keyin belgilanadi.
            </p>

            <dl class="mt-4 space-y-3">
              <div class="flex items-baseline justify-between gap-3">
                <dt class="text-[12.5px] text-ink-500">Byudjet</dt>
                <dd class="tabular text-[13px] font-semibold text-ink-900">
                  {{ sum(item.request.offerPrice) }} / oy
                </dd>
              </div>
              <div class="flex items-baseline justify-between gap-3">
                <dt class="text-[12.5px] text-ink-500">Muddat</dt>
                <dd class="tabular text-[13px] font-semibold text-ink-900">
                  {{ item.request.term }} oy
                </dd>
              </div>
            </dl>

            <template v-if="canAssignUnit">
              <UiField
                label="Kelishilgan maydon"
                class="mt-4"
                hint="Ro‘yxat byudjetga yaqinligi bo‘yicha tartiblangan"
              >
                <UiSelect
                  v-model="unitChoice"
                  :options="[{ value: '', label: 'Maydonni tanlang' }, ...unitOptions]"
                />
              </UiField>

              <UiButton block class="mt-3" :disabled="!unitChoice" @click="assignUnit">
                <UiIcon name="check" :size="16" />
                Maydonni biriktirish
              </UiButton>
            </template>

            <p
              v-else
              class="mt-4 flex items-center justify-center gap-2 rounded-field bg-ink-100 px-3 py-2.5 text-[12.5px] font-semibold text-ink-600"
            >
              <UiIcon name="eye" :size="15" />
              Maydonni Operator belgilaydi
            </p>
          </template>

          <template v-else>
          <dl class="space-y-3">
            <div class="flex items-baseline justify-between gap-3">
              <dt class="text-[12.5px] text-ink-500">Unit raqami</dt>
              <dd class="text-[13px] font-semibold text-ink-900">{{ item.unitCode }}</dd>
            </div>
            <div class="flex items-baseline justify-between gap-3">
              <dt class="text-[12.5px] text-ink-500">Maydon</dt>
              <dd class="tabular text-[13px] font-semibold text-ink-900">{{ area(item.area) }}</dd>
            </div>
            <div class="flex items-baseline justify-between gap-3">
              <dt class="text-[12.5px] text-ink-500">Qavat</dt>
              <dd class="text-[13px] font-semibold text-ink-900">{{ item.floor }}-qavat</dd>
            </div>
            <div class="flex items-baseline justify-between gap-3">
              <dt class="text-[12.5px] text-ink-500">Foydalanish turi</dt>
              <dd class="text-[13px] font-semibold text-ink-900">{{ item.usage }}</dd>
            </div>
            <div v-if="unit" class="flex items-baseline justify-between gap-3">
              <dt class="text-[12.5px] text-ink-500">Joriy holati</dt>
              <dd><UiStatus kind="unit" :value="unit.status" size="sm" /></dd>
            </div>
            <div class="flex items-start justify-between gap-3">
              <dt class="shrink-0 text-[12.5px] text-ink-500">Manzil</dt>
              <dd class="min-w-0 text-right text-[12.5px] font-medium text-ink-700">
                {{ item.buildingAddress }}
              </dd>
            </div>
          </dl>

          <div v-if="unit?.equipment.length" class="mt-4 border-t border-ink-100 pt-4">
            <p class="mb-2 text-[11.5px] font-semibold uppercase tracking-wide text-ink-500">
              Jihozlar
            </p>
            <ul class="space-y-1.5">
              <li
                v-for="e in unit.equipment"
                :key="e"
                class="flex items-center gap-2 text-[12.5px] text-ink-700"
              >
                <UiIcon name="check" :size="14" class="shrink-0 text-ok-500" />
                {{ e }}
              </li>
            </ul>
          </div>

          <UiButton
            v-if="canOpenObjects"
            variant="secondary"
            size="sm"
            block
            class="mt-4"
            :to="`/objects/${item.buildingId}/floors/${item.floor}?unit=${item.unitId}`"
          >
            <UiIcon name="layers" :size="15" />
            Qavat rejasida ko‘rish
          </UiButton>
          </template>
        </UiCard>
      </div>
    </div>

    <LeaseContractModal v-model="contractOpen" :item="item" />

    <!-- Shartnomani tizim ichida tahrirlash -->
    <UiModal
      v-model="contractEditOpen"
      size="lg"
      title="Shartnomani tahrirlash"
      :subtitle="item.contract ? `${item.contract.code} · ${item.org.name}` : item.code"
    >
      <p class="text-[13px] leading-relaxed text-ink-600">
        Shartnoma bandlarini o‘zgartiring yoki tomonlar bilan kelishilgan qo‘shimcha shartni
        kiriting. O‘zgarishlar hujjatga va yuklab olinadigan DOCX nusxaga darhol tushadi.
      </p>

      <div class="mt-4 space-y-4">
        <div
          v-for="(c, i) in clauseDraft"
          :key="i"
          class="rounded-field bg-surface-sunken p-4 ring-1 ring-inset ring-ink-200"
        >
          <div class="flex items-center justify-between gap-3">
            <span class="text-[11.5px] font-semibold uppercase tracking-wide text-ink-500">
              {{ i + 1 }}-band
            </span>
            <button
              type="button"
              class="grid size-9 place-items-center rounded-field text-ink-500 transition-colors duration-150 hover:bg-white hover:text-danger-600"
              :aria-label="`${i + 1}-bandni olib tashlash`"
              @click="removeClause(i)"
            >
              <UiIcon name="trash" :size="16" />
            </button>
          </div>
          <UiField label="Band sarlavhasi" required class="mt-2">
            <UiInput v-model="c.title" placeholder="Masalan: Qo‘shimcha shart" />
          </UiField>
          <UiField label="Band matni" required class="mt-3">
            <textarea
              v-model="c.text"
              rows="3"
              class="w-full rounded-field bg-white px-3.5 py-2.5 text-sm text-ink-800 ring-1 ring-inset ring-ink-200 transition-colors placeholder:text-ink-400 focus:ring-2 focus:ring-brand-500"
              placeholder="Band matnini yozing…"
            />
          </UiField>
        </div>
      </div>

      <UiButton variant="secondary" size="sm" class="mt-4" @click="addClause">
        <UiIcon name="plus" :size="15" />
        Qo‘shimcha shart kiritish
      </UiButton>

      <template #footer>
        <UiButton variant="ghost" @click="contractEditOpen = false">Bekor qilish</UiButton>
        <UiButton :disabled="!clauseDraftValid || !clauseDraft.length" @click="saveContract">
          <UiIcon name="check" :size="16" />
          Saqlash
        </UiButton>
      </template>
    </UiModal>

    <!-- Rad etish -->
    <UiModal v-model="rejectOpen" title="Arizani rad etish" :subtitle="item.code">
      <UiField
        label="Rad etish sababi"
        required
        hint="Sabab ijarachiga ko‘rinadi va audit jurnalida saqlanadi"
      >
        <textarea
          v-model="reason"
          rows="4"
          class="w-full rounded-field bg-white px-3.5 py-2.5 text-sm text-ink-800 ring-1 ring-inset ring-ink-200 transition-colors placeholder:text-ink-400 focus:ring-2 focus:ring-brand-500"
          placeholder="Sababni yozing…"
        />
      </UiField>
      <template #footer>
        <UiButton variant="ghost" @click="rejectOpen = false">Bekor qilish</UiButton>
        <UiButton variant="danger" :disabled="!reason.trim()" @click="confirmReject">
          Rad etish
        </UiButton>
      </template>
    </UiModal>

    <!-- Qayta ishlashga yuborish -->
    <UiModal v-model="reworkOpen" title="Qayta ishlashga yuborish" :subtitle="item.code">
      <UiField label="Sabab" required hint="Ariza oldingi bosqichga qaytariladi">
        <textarea
          v-model="reason"
          rows="4"
          class="w-full rounded-field bg-white px-3.5 py-2.5 text-sm text-ink-800 ring-1 ring-inset ring-ink-200 transition-colors placeholder:text-ink-400 focus:ring-2 focus:ring-brand-500"
          placeholder="Qaysi shartlarni qayta ko‘rib chiqish kerak?"
        />
      </UiField>
      <template #footer>
        <UiButton variant="ghost" @click="reworkOpen = false">Bekor qilish</UiButton>
        <UiButton :disabled="!reason.trim()" @click="confirmRework">Qaytarish</UiButton>
      </template>
    </UiModal>
  </main>

  <main v-else class="flex flex-1 items-center justify-center p-6">
    <UiCard>
      <UiEmpty
        icon="clipboard"
        title="Ariza mavjud emas"
        description="Yozuv arxivlangan, havola noto‘g‘ri yoki ariza sizga biriktirilgan obyektlarga tegishli emas."
        action-label="Arizalar navbatiga qaytish"
        action-to="/applications"
      />
    </UiCard>
  </main>
</template>
