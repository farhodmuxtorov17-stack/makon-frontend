<script setup lang="ts">
import { CONTACT } from '~/constants/contacts'
import { LEASE_STATUS } from '~/constants/statuses'
import { area, dateShort, sum, timeOf } from '~/utils/format'

definePageMeta({ layout: 'public', public: true })

const route = useRoute()
const lease = useLeaseStore()

lease.seed()

const code = computed(() => String(route.params.code ?? '').toUpperCase())
const item = computed(() => lease.byCode(code.value))

const digits = ref('')
const submitted = ref(false)
const opened = ref(false)
const pending = ref(false)

/** Telefon raqamining oxirgi to‘rt raqami */
const expected = computed(() => {
  const raw = (item.value?.org.phone ?? '').replace(/\D/g, '')
  return raw.slice(-4)
})

const mismatch = ref(false)

function onDigitsInput(event: Event) {
  const el = event.target as HTMLInputElement
  digits.value = el.value.replace(/\D/g, '').slice(0, 4)
  el.value = digits.value
  mismatch.value = false
}

let timer: ReturnType<typeof setTimeout> | null = null

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer)
})

function unlock() {
  submitted.value = true
  mismatch.value = false
  if (digits.value.length !== 4 || pending.value) return

  pending.value = true
  timer = setTimeout(() => {
    pending.value = false
    if (digits.value !== expected.value) {
      mismatch.value = true
      return
    }
    opened.value = true
  }, 420)
}

const STAGE_HINT: Record<string, string> = {
  YANGI: 'Ariza qabul qilindi va bino rahbari ko‘rigida turibdi',
  OPERATSIYA_TASDIQLADI: 'Shartlar kelishildi, moliyaviy tekshiruv bosqichida',
  MOLIYA_TASDIQLADI: 'Moliyaviy shartlar tasdiqlandi, shartnoma qoralamasi tayyorlanmoqda',
  QORALAMA_TAYYOR: 'Shartnoma qoralamasi tayyor, imzolashga yuborish kutilmoqda',
  DIDOX_YUBORILDI: 'Shartnoma imzolash uchun Didox orqali yuborildi',
  DIDOX_IMZOLANDI: 'Shartnoma imzolandi, faollashtirish bosqichida',
  FAOL: 'Shartnoma amalda: maydon sizning nomingizga rasmiylashtirildi',
  RAD_ETILDI: 'Ariza rad etilgan',
}

const stageHint = computed(() => (item.value ? (STAGE_HINT[item.value.status] ?? '') : ''))
const statusLabel = computed(() =>
  item.value ? (LEASE_STATUS[item.value.status]?.label ?? item.value.status) : '',
)

const registerPath = computed(() => `/auth/register?ariza=${code.value}`)

const CONTACTS = [
  { icon: 'phone', label: 'Ijara bo‘limi', value: CONTACT.phone, href: CONTACT.phoneHref },
  { icon: 'send', label: 'E-pochta', value: CONTACT.email, href: CONTACT.emailHref },
  { icon: 'clock', label: 'Ish vaqti', value: CONTACT.hours, href: '' },
]
</script>

<template>
  <div class="mx-auto w-full max-w-[900px] px-4 py-8 lg:px-8 lg:py-12">
    <nav class="flex flex-wrap items-center gap-1.5 text-[13px] text-ink-500" aria-label="Yo‘l">
      <NuxtLink to="/" class="rounded-[6px] hover:text-brand-600">Bosh sahifa</NuxtLink>
      <span aria-hidden="true">/</span>
      <NuxtLink to="/ariza" class="rounded-[6px] hover:text-brand-600">Ariza</NuxtLink>
      <span aria-hidden="true">/</span>
      <span class="tabular font-semibold text-ink-700">{{ code }}</span>
    </nav>

    <!-- Ariza topilmadi -->
    <div v-if="!item" class="mt-8">
      <UiCard>
        <div class="py-6 text-center">
          <span
            class="mx-auto grid size-14 place-items-center rounded-[16px] bg-danger-50 text-danger-600"
            aria-hidden="true"
          >
            <UiIcon name="warning" :size="26" />
          </span>
          <h1 class="mt-4 font-display text-[22px] font-extrabold text-ink-900">
            Ariza topilmadi
          </h1>
          <p class="mx-auto mt-2 max-w-[52ch] text-[14px] leading-relaxed text-ink-600">
            <span class="tabular font-semibold text-ink-900">{{ code }}</span>
            raqamli ariza tizimda yo‘q. Havolani to‘liq nusxalaganingizni tekshiring yoki yangi
            ariza yuboring.
          </p>
          <div class="mt-5 flex flex-wrap justify-center gap-2.5">
            <UiButton to="/ariza">Yangi ariza yuborish</UiButton>
            <UiButton to="/catalog" variant="secondary">Katalog</UiButton>
          </div>
        </div>
      </UiCard>
    </div>

    <!-- Telefon raqami bilan ochish -->
    <div v-else-if="!opened" class="mx-auto mt-8 max-w-[520px]">
      <UiCard>
        <span
          class="grid size-12 place-items-center rounded-[14px] bg-brand-50 text-brand-600"
          aria-hidden="true"
        >
          <UiIcon name="lock" :size="24" />
        </span>

        <h1 class="mt-4 font-display text-[22px] font-extrabold leading-tight text-ink-900">
          Arizani ochish
        </h1>
        <p class="mt-2 text-[14px] leading-relaxed text-ink-600">
          <span class="tabular font-semibold text-ink-900">{{ code }}</span>
          arizasi topildi. Ma’lumotlarni ko‘rish uchun arizada ko‘rsatilgan telefon raqamining
          oxirgi to‘rt raqamini kiriting.
        </p>

        <form class="mt-5 space-y-4" novalidate @submit.prevent="unlock">
          <UiField
            label="Telefon raqamining oxirgi to‘rt raqami"
            required
            for="last-four"
            :error="
              mismatch
                ? 'Raqam mos kelmadi. Arizada ko‘rsatilgan telefon raqamini tekshiring'
                : submitted && digits.length !== 4
                  ? 'To‘rtta raqam kiriting'
                  : ''
            "
          >
            <input
              id="last-four"
              type="text"
              inputmode="numeric"
              maxlength="4"
              autocomplete="off"
              placeholder="0000"
              :value="digits"
              :aria-invalid="mismatch || undefined"
              class="tabular h-12 w-full rounded-field bg-white px-3.5 text-center text-lg font-bold tracking-[0.3em] text-ink-900 ring-1 ring-inset transition-colors placeholder:font-normal placeholder:tracking-normal placeholder:text-ink-400 focus:ring-2 focus:ring-brand-500"
              :class="mismatch ? 'ring-danger-400' : 'ring-ink-200 hover:ring-ink-300'"
              @input="onDigitsInput"
            />
          </UiField>

          <UiButton type="submit" size="lg" block :disabled="pending">
            {{ pending ? 'Tekshirilmoqda…' : 'Arizani ochish' }}
          </UiButton>
        </form>

        <p class="mt-4 flex items-start gap-2 text-[12px] leading-relaxed text-ink-500">
          <UiIcon name="shield" :size="14" class="mt-px shrink-0" />
          Bu tekshiruv ariza ma’lumotlari faqat uni yuborgan shaxsga ko‘rinishini ta’minlaydi.
        </p>
      </UiCard>
    </div>

    <!-- Ariza holati -->
    <div v-else class="mt-6 space-y-5">
      <header>
        <p class="text-[11px] font-semibold uppercase tracking-wide text-brand-600">
          Ariza holati
        </p>
        <h1 class="tabular mt-2 font-display text-[28px] font-extrabold leading-tight text-ink-900">
          {{ item.code }}
        </h1>
        <p class="mt-1.5 text-[14px] text-ink-600">
          {{ item.buildingName }}, Unit {{ item.unitCode }}, {{ item.floor }}-qavat
        </p>
      </header>

      <UiCard>
        <div class="flex flex-wrap items-center gap-2.5">
          <UiStatus kind="lease" :value="item.status" />
          <span class="rounded-pill bg-ink-100 px-2.5 py-1 text-[12px] font-semibold text-ink-700">
            {{ item.request.type }}
          </span>
          <span class="tabular text-[13px] text-ink-500">
            Yuborilgan: {{ dateShort(item.request.submittedAt) }}
            {{ timeOf(item.request.submittedAt) }}
          </span>
        </div>

        <div class="mt-5">
          <LeaseFlow :status="item.status" />
        </div>

        <p
          v-if="stageHint"
          class="mt-4 flex items-start gap-2 rounded-field bg-surface-sunken px-3.5 py-2.5 text-[13px] leading-relaxed text-ink-700 ring-1 ring-inset ring-ink-200"
        >
          <UiIcon name="info" :size="15" class="mt-px shrink-0 text-brand-600" />
          <span>
            <span class="font-semibold text-ink-900">{{ statusLabel }}.</span>
            {{ stageHint }}
          </span>
        </p>

        <p
          v-if="item.status === 'RAD_ETILDI' && item.rejectReason"
          class="mt-3 flex items-start gap-2 rounded-field bg-danger-50 px-3.5 py-2.5 text-[13px] leading-relaxed text-danger-700 ring-1 ring-inset ring-danger-100"
        >
          <UiIcon name="warning" :size="15" class="mt-px shrink-0" />
          Rad etish sababi: {{ item.rejectReason }}
        </p>

        <p
          v-if="item.contactedAt"
          class="mt-3 flex items-center gap-2 text-[13px] font-medium text-ok-700"
        >
          <UiIcon name="check" :size="15" class="shrink-0" />
          Operator siz bilan bog‘landi: {{ dateShort(item.contactedAt) }}
          {{ timeOf(item.contactedAt) }}
        </p>
      </UiCard>

      <!-- Kabinet ochish taklifi -->
      <UiCard v-if="item.guest && item.accountInvitedAt" tone="brand" icon="user" title="Kabinet ochish taklifi">
        <p class="text-[13px] leading-relaxed text-ink-700">
          Operator siz uchun shaxsiy kabinet ochishni taklif qildi. Parol o‘rnatsangiz, ariza,
          shartnoma va hisob-fakturalar bir joyda bo‘ladi, holatni har safar kod bilan ochish
          shart emas.
        </p>
        <UiButton :to="registerPath" size="lg" class="mt-4">
          <UiIcon name="key" :size="16" />
          Parol o‘rnatib kabinet ochish
        </UiButton>
      </UiCard>

      <div class="grid gap-5 lg:grid-cols-2">
        <UiCard title="So‘rovingiz shartlari" icon="clipboard">
          <dl class="space-y-3">
            <div class="flex items-baseline justify-between gap-3">
              <dt class="text-[13px] text-ink-500">Taklif narxi (oylik)</dt>
              <dd class="tabular text-[14px] font-bold text-ink-900">
                {{ sum(item.request.offerPrice) }}
              </dd>
            </div>
            <div class="flex items-baseline justify-between gap-3">
              <dt class="text-[13px] text-ink-500">Muddat</dt>
              <dd class="tabular text-[14px] font-bold text-ink-900">
                {{ item.request.term }} oy
              </dd>
            </div>
            <div class="flex items-baseline justify-between gap-3">
              <dt class="text-[13px] text-ink-500">Boshlanish sanasi</dt>
              <dd class="tabular text-[14px] font-bold text-ink-900">
                {{ dateShort(item.request.startDate) }}
              </dd>
            </div>
            <div class="flex items-baseline justify-between gap-3">
              <dt class="text-[13px] text-ink-500">Maydon</dt>
              <dd class="tabular text-[14px] font-bold text-ink-900">{{ area(item.area) }}</dd>
            </div>
            <div v-if="item.request.note" class="border-t border-ink-100 pt-3">
              <dt class="text-[13px] text-ink-500">Izohingiz</dt>
              <dd class="mt-1.5 rounded-field bg-surface-sunken p-3 text-[13px] leading-relaxed text-ink-700">
                {{ item.request.note }}
              </dd>
            </div>
          </dl>
        </UiCard>

        <UiCard title="Savollar bo‘yicha aloqa" icon="headset" tone="teal">
          <ul class="space-y-2.5">
            <li v-for="c in CONTACTS" :key="c.label">
              <component
                :is="c.href ? 'a' : 'div'"
                :href="c.href || undefined"
                class="flex items-center gap-3 rounded-field px-1 py-1.5 transition-colors"
                :class="c.href ? 'hover:bg-surface-sunken' : ''"
              >
                <span
                  class="grid size-9 shrink-0 place-items-center rounded-[10px] bg-surface-sunken text-brand-600 ring-1 ring-ink-200"
                >
                  <UiIcon :name="c.icon" :size="16" />
                </span>
                <span class="min-w-0">
                  <span class="block text-[12px] text-ink-500">{{ c.label }}</span>
                  <span class="block break-words text-[13px] font-semibold text-ink-900">
                    {{ c.value }}
                  </span>
                </span>
              </component>
            </li>
          </ul>

          <p class="mt-3 text-[12px] leading-relaxed text-ink-500">
            Murojaat qilganda ariza raqamini ayting: {{ item.code }}.
          </p>
        </UiCard>
      </div>

      <div class="flex flex-wrap gap-2.5">
        <UiButton to="/catalog" variant="secondary">
          <UiIcon name="search" :size="16" />
          Boshqa maydonlarni ko‘rish
        </UiButton>
        <UiButton variant="ghost" @click="opened = false">
          <UiIcon name="lock" :size="16" />
          Ma’lumotlarni yopish
        </UiButton>
      </div>
    </div>
  </div>
</template>
