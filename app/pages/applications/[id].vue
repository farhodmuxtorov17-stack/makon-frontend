<script setup lang="ts">
import {
  buildSchedule,
  serviceTotalOf,
  type LeaseOffer,
  type Periodicity,
  type SignedDocument,
} from '~/stores/lease'
import { unitById } from '~/data/units'
import { area, dateShort, num, sum, timeOf } from '~/utils/format'

const route = useRoute()
const auth = useAuthStore()
const lease = useLeaseStore()

lease.seed()

const item = computed(() => lease.byId(String(route.params.id)))
const unit = computed(() => (item.value ? unitById(item.value.unitId) : undefined))

const actorName = computed(() => auth.user?.fullName ?? '-')
const isManager = computed(() => auth.role === 'BUILDING_MANAGER')
const isAccountant = computed(() => auth.role === 'ACCOUNTANT')

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

const canApproveOperation = computed(
  () => item.value?.status === 'YANGI' && isManager.value && auth.can('application.decide'),
)

const canApproveFinance = computed(
  () =>
    item.value?.status === 'OPERATSIYA_TASDIQLADI' &&
    isAccountant.value &&
    auth.can('application.decide'),
)

const canSendDidox = computed(
  () => item.value?.status === 'QORALAMA_TAYYOR' && isManager.value && auth.can('contract.sign'),
)

const canCheckDidox = computed(
  () => item.value?.status === 'DIDOX_YUBORILDI' && isManager.value && auth.can('contract.sign'),
)

const canUpload = computed(
  () => item.value?.status === 'DIDOX_IMZOLANDI' && isManager.value && auth.can('contract.sign'),
)

const canActivate = computed(
  () =>
    item.value?.status === 'DIDOX_IMZOLANDI' &&
    Boolean(item.value?.signedDocument) &&
    isManager.value &&
    auth.can('application.decide'),
)

const editing = computed(() => canApproveOperation.value || canApproveFinance.value)

const shownSchedule = computed(() =>
  editing.value ? previewSchedule.value : (item.value?.schedule ?? []),
)

const formInvalid = computed(() => draftOffer.value.monthlyRent <= 0)

/** Didox bosqichi ko‘rinadigan holatlar */
const didoxStage = computed(() =>
  ['DIDOX_YUBORILDI', 'DIDOX_IMZOLANDI', 'FAOL'].includes(item.value?.status ?? ''),
)

const activationBlockers = computed(() => {
  const c = item.value
  if (!c) return []
  const list: string[] = []
  if (c.didox?.state !== 'Imzolangan') list.push('Didox holati «Imzolangan» ga o‘tmagan')
  if (!c.signedDocument) list.push('Imzolangan hujjat tizimga yuklanmagan')
  if (!isManager.value) list.push('Faollashtirish huquqi bino rahbariga tegishli')
  return list
})

// --- Amallar ---------------------------------------------------------------

const contractOpen = ref(false)
const rejectOpen = ref(false)
const reworkOpen = ref(false)
const reason = ref('')
const notice = ref('')

function approveOperation() {
  if (!item.value || formInvalid.value) return
  lease.approveOperation(item.value.id, actorName.value, draftOffer.value)
  notice.value = 'Kelishilgan shartlar tasdiqlandi va buxgalterga yuborildi.'
}

function approveFinance() {
  if (!item.value || formInvalid.value) return
  lease.approveFinance(item.value.id, actorName.value, draftOffer.value)
  notice.value = 'Moliyaviy shartlar tasdiqlandi, shartnoma qoralamasi tayyor.'
}

function sendDidox() {
  if (!item.value) return
  lease.sendToDidox(item.value.id, actorName.value)
  notice.value = 'Hujjat Didox orqali imzolashga yuborildi.'
}

function checkDidox() {
  if (!item.value) return
  lease.checkDidox(item.value.id, actorName.value)
  notice.value = `Didox holati yangilandi: ${item.value.didox?.state ?? '-'}.`
}

function onUpload(file: Omit<SignedDocument, 'uploadedAt' | 'uploadedBy'>) {
  if (!item.value) return
  lease.attachSignedDocument(item.value.id, actorName.value, file)
  notice.value = `${file.fileName} yuklandi, nazorat yig‘indisi hisoblandi.`
}

function onRemoveUpload() {
  if (!item.value) return
  lease.removeSignedDocument(item.value.id, actorName.value)
  notice.value = ''
}

function activate() {
  if (!item.value || !canActivate.value) return
  lease.activate(item.value.id, actorName.value)
  notice.value = 'Shartnoma faollashtirildi, o‘zgarishlar quyida ko‘rsatilgan.'
}

function confirmReject() {
  if (!item.value || !reason.value.trim()) return
  lease.reject(
    item.value.id,
    actorName.value,
    isAccountant.value ? 'Buxgalter' : 'Bino rahbari',
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
    isAccountant.value ? 'Buxgalter' : 'Bino rahbari',
    reason.value.trim(),
  )
  reworkOpen.value = false
  reason.value = ''
}

function markContacted() {
  if (!item.value) return
  lease.markContacted(
    item.value.id,
    actorName.value,
    isAccountant.value ? 'Buxgalter' : 'Bino rahbari',
  )
}
</script>

<template>
  <AppTopbar
    :title="item?.code ?? 'Ariza topilmadi'"
    :subtitle="item ? `${item.org.name} · ${item.buildingName} · Unit ${item.unitCode}` : undefined"
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
      class="flex items-start gap-3 rounded-card bg-ok-50 px-4 py-3.5 ring-1 ring-inset ring-ok-100"
      role="status"
    >
      <UiIcon name="check" :size="18" class="mt-0.5 shrink-0 text-ok-600" />
      <p class="min-w-0 flex-1 text-[13px] font-medium text-ok-700">{{ notice }}</p>
      <button
        type="button"
        class="shrink-0 rounded-[8px] p-1.5 text-ok-600 transition-colors hover:bg-ok-100"
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

          <UiButton v-if="canSendDidox" size="sm" @click="sendDidox">
            <UiIcon name="send" :size="15" />
            Didox orqali yuborish
          </UiButton>

          <UiButton v-if="canCheckDidox" size="sm" @click="checkDidox">
            <UiIcon name="refresh" :size="15" />
            Didox holatini tekshirish
          </UiButton>

          <template v-if="canApproveOperation">
            <UiButton variant="success" size="sm" :disabled="formInvalid" @click="approveOperation">
              <UiIcon name="check" :size="15" />
              Tasdiqlash
            </UiButton>
            <UiButton variant="danger" size="sm" @click="rejectOpen = true">
              <UiIcon name="x" :size="15" />
              Rad etish
            </UiButton>
          </template>

          <template v-if="canApproveFinance">
            <UiButton variant="success" size="sm" :disabled="formInvalid" @click="approveFinance">
              <UiIcon name="check" :size="15" />
              Moliya tasdiqlash
            </UiButton>
            <UiButton variant="secondary" size="sm" @click="reworkOpen = true">
              <UiIcon name="refresh" :size="15" />
              Qayta ishlashga yuborish
            </UiButton>
            <UiButton variant="danger" size="sm" @click="rejectOpen = true">
              <UiIcon name="x" :size="15" />
              Rad etish
            </UiButton>
          </template>
        </div>
      </div>

      <div class="mt-5">
        <LeaseFlow :status="item.status" />
      </div>

      <p
        v-if="item.status === 'RAD_ETILDI' && item.rejectReason"
        class="mt-4 flex items-start gap-2 rounded-field bg-danger-50 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-danger-700 ring-1 ring-inset ring-danger-100"
      >
        <UiIcon name="warning" :size="15" class="mt-px shrink-0" />
        Rad etish sababi: {{ item.rejectReason }}
      </p>
    </UiCard>

    <!-- Faollashtirish natijasi -->
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
              v-if="!item.contactedAt && (isManager || isAccountant)"
              variant="secondary"
              size="sm"
              class="mt-3"
              @click="markContacted"
            >
              <UiIcon name="check" :size="15" />
              Bog‘lanildi deb belgilash
            </UiButton>
          </div>
        </UiCard>

        <!-- Kelishilgan shartlar -->
        <UiCard
          :title="canApproveFinance ? 'Moliyaviy shartlarni tekshirish' : 'Kelishilgan shartlar'"
          :subtitle="
            editing
              ? 'Qiymatni o‘zgartiring: to‘lov grafigi darhol qayta hisoblanadi'
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
              v-if="canApproveFinance"
              label="Tuzatish sababi"
              class="sm:col-span-2"
              hint="Shartlar o‘zgartirilgan bo‘lsa sababi audit jurnalida qoladi"
            >
              <UiInput
                v-model="form.adjustmentReason"
                placeholder="Masalan: depozit ikki oylik ijara miqdorigacha kamaytirildi"
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

        <!-- Imzolangan hujjatni yuklash va faollashtirish -->
        <UiCard
          v-if="item.status === 'DIDOX_IMZOLANDI' || item.status === 'FAOL'"
          title="Imzolangan hujjat va faollashtirish"
          subtitle="Didox’dan olingan nusxa tizimga yuklanadi"
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
            <UiButton :disabled="!canActivate" @click="activate">
              <UiIcon name="check" :size="17" />
              Faollashtirish
            </UiButton>

            <p
              v-if="activationBlockers.length"
              class="mt-2.5 flex items-start gap-2 rounded-field bg-warn-50 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-warn-700 ring-1 ring-inset ring-warn-100"
            >
              <UiIcon name="warning" :size="15" class="mt-px shrink-0" />
              <span>
                Faollashtirish uchun yetishmayapti:
                <b>{{ activationBlockers.join('; ') }}</b>
              </span>
            </p>
          </div>
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
          title="So‘ralayotgan unit"
          :subtitle="item.buildingName"
          icon="building"
        >
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
            variant="secondary"
            size="sm"
            block
            class="mt-4"
            :to="`/objects/${item.buildingId}/floors/${item.floor}?unit=${item.unitId}`"
          >
            <UiIcon name="layers" :size="15" />
            Qavat rejasida ko‘rish
          </UiButton>
        </UiCard>
      </div>
    </div>

    <LeaseContractModal v-model="contractOpen" :item="item" />

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
        title="Bunday ariza topilmadi"
        description="Ariza arxivlangan yoki havola noto‘g‘ri bo‘lishi mumkin."
        action-label="Arizalar navbatiga qaytish"
        action-to="/applications"
      />
    </UiCard>
  </main>
</template>
