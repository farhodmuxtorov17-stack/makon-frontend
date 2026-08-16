<script setup lang="ts">
import { signedContractDocx, type LeaseCase } from '~/stores/lease'
import { saveBlob } from '~/utils/docx'
import { dateShort, timeOf } from '~/utils/format'

const props = defineProps<{ item: LeaseCase; canCheck: boolean }>()
const emit = defineEmits<{ check: [] }>()

const ticket = computed(() => props.item.didox)

const signed = computed(() => ticket.value?.state === 'Imzolangan')

const STATE_CLASS: Record<string, string> = {
  Yuborilgan: 'bg-warn-50 text-warn-700 ring-warn-100',
  'Ko‘rib chiqilmoqda': 'bg-brand-50 text-brand-700 ring-brand-200',
  Imzolangan: 'bg-ok-50 text-ok-700 ring-ok-100',
}

const STATE_ICON: Record<string, string> = {
  Yuborilgan: 'send',
  'Ko‘rib chiqilmoqda': 'clock',
  Imzolangan: 'check',
}

const downloaded = ref('')

function downloadSigned() {
  const t = ticket.value
  const doc = props.item.contract
  if (!t || !doc || !signed.value) return
  const fileName = `${doc.code}-imzolangan.docx`
  saveBlob(signedContractDocx(doc, t), fileName)
  downloaded.value = fileName
}
</script>

<template>
  <div v-if="ticket" class="space-y-4">
    <!-- Didox kartasi -->
    <div class="rounded-card bg-surface-sunken p-4 ring-1 ring-inset ring-ink-200 sm:p-5">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="flex items-start gap-3">
          <span class="grid size-10 shrink-0 place-items-center rounded-field bg-brand-500 text-white">
            <UiIcon name="external" :size="19" />
          </span>
          <div class="min-w-0">
            <p class="text-[11.5px] font-semibold uppercase tracking-wide text-ink-500">
              Didox: tashqi imzolash xizmati
            </p>
            <p class="tabular mt-0.5 text-[15px] font-bold text-ink-900">{{ ticket.docNumber }}</p>
          </div>
        </div>
        <span
          class="inline-flex shrink-0 items-center gap-1.5 rounded-pill px-3 py-1.5 text-[12px] font-bold ring-1 ring-inset"
          :class="STATE_CLASS[ticket.state]"
        >
          <UiIcon :name="STATE_ICON[ticket.state] ?? 'clock'" :size="14" />
          {{ ticket.state }}
        </span>
      </div>

      <dl class="mt-4 grid gap-x-6 sm:grid-cols-2">
        <div
          v-for="r in [
            { l: 'Hujjat raqami', v: ticket.docNumber },
            { l: 'Yuborilgan vaqti', v: `${dateShort(ticket.sentAt)} ${timeOf(ticket.sentAt)}` },
            { l: 'Qabul qiluvchi', v: ticket.recipient },
            { l: 'Qabul qiluvchi STIR', v: ticket.recipientTin },
            { l: 'Yuborgan xodim', v: ticket.sentBy },
            {
              l: 'Oxirgi tekshiruv',
              v: ticket.lastCheckedAt
                ? `${dateShort(ticket.lastCheckedAt)} ${timeOf(ticket.lastCheckedAt)}`
                : 'Tekshirilmagan',
            },
          ]"
          :key="r.l"
          class="flex items-baseline justify-between gap-3 border-b border-ink-100 py-2.5 last:border-0"
        >
          <dt class="text-[12.5px] text-ink-500">{{ r.l }}</dt>
          <dd class="tabular min-w-0 text-right text-[13px] font-semibold text-ink-900">{{ r.v }}</dd>
        </div>
      </dl>

      <p class="mt-4 flex items-start gap-2 rounded-field bg-white px-3.5 py-2.5 text-[12.5px] leading-relaxed text-ink-600 ring-1 ring-inset ring-ink-200">
        <UiIcon name="info" :size="15" class="mt-px shrink-0 text-brand-600" />
        Imzolash Didox tomonida bajariladi, imzolovchini Didox o‘zi xabardor qiladi. MAKON
        faqat hujjat holatini kuzatadi va imzolangan nusxani qabul qiladi.
      </p>

      <div class="mt-4 flex flex-wrap gap-2.5">
        <UiButton v-if="canCheck && !signed" size="sm" @click="emit('check')">
          <UiIcon name="refresh" :size="15" />
          Didox holatini tekshirish
        </UiButton>
        <UiButton
          v-if="signed"
          variant="secondary"
          size="sm"
          @click="downloadSigned"
        >
          <UiIcon name="download" :size="15" />
          Imzolangan hujjatni yuklab olish
        </UiButton>
      </div>

      <p
        v-if="downloaded"
        class="mt-3 flex items-center gap-2 rounded-field bg-ok-50 px-3.5 py-2.5 text-[12.5px] font-semibold text-ok-700 ring-1 ring-inset ring-ok-100"
      >
        <UiIcon name="check" :size="15" />
        {{ downloaded }} yuklab olindi, endi uni tizimga qaytadan yuklang
      </p>
    </div>

    <!-- Holat tarixi -->
    <div>
      <p class="mb-2.5 text-[11.5px] font-semibold uppercase tracking-wide text-ink-500">
        Holat o‘zgarishi tarixi
      </p>
      <ol class="relative space-y-4 pl-8">
        <span class="absolute bottom-2 left-[13px] top-2 w-px bg-ink-200" aria-hidden="true" />
        <li v-for="(h, i) in ticket.history" :key="`${h.at}-${i}`" class="relative">
          <span
            class="absolute -left-8 top-0 grid size-[27px] place-items-center rounded-full ring-4 ring-white"
            :class="
              h.state === 'Imzolangan' ? 'bg-ok-500 text-white' : 'bg-ink-100 text-ink-600'
            "
          >
            <UiIcon :name="STATE_ICON[h.state] ?? 'clock'" :size="14" />
          </span>
          <p class="text-[13.5px] font-semibold text-ink-900">{{ h.state }}</p>
          <p class="tabular mt-0.5 text-[12px] text-ink-500">
            {{ dateShort(h.at) }} {{ timeOf(h.at) }}
          </p>
          <p class="mt-0.5 text-[12.5px] leading-relaxed text-ink-600">{{ h.note }}</p>
        </li>
      </ol>
    </div>
  </div>

  <UiEmpty
    v-else
    icon="external"
    title="Hujjat Didox’ga yuborilmagan"
    description="Shartnoma qoralamasi tayyor bo‘lgach, bino rahbari uni Didox orqali imzolashga yuboradi."
    compact
  />
</template>
