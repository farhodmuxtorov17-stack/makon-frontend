<script setup lang="ts">
import { buildingById } from '~/data/buildings'
import { UNITS, unitById } from '~/data/units'
import { area, num, sum } from '~/utils/format'

const auth = useAuthStore()
const lease = useLeaseStore()
const route = useRoute()

lease.seed()

const vacantUnits = computed(() => UNITS.filter((u) => u.status === 'VACANT'))

const unitOptions = computed(() =>
  vacantUnits.value.map((u) => ({
    value: u.id,
    label: `${buildingById(u.buildingId)?.name ?? ''} · Unit ${u.code} · ${area(u.area)}`,
  })),
)

/**
 * Kabinetdan faqat ijara arizasi yuboriladi: sotuv oqimi (bir martalik to‘lov,
 * SOLD holati va sotuv shartnomasi) tizimda hali mavjud emas, shuning uchun
 * formada ham taklif qilinmaydi.
 */
const REQUEST_TYPE = 'Ijaraga olish' as const

const form = reactive({
  unitId: '',
  price: '',
  startDate: '',
  term: '24',
  note: '',
})

const errors = reactive({ unitId: '', price: '', startDate: '' })

const unit = computed(() => (form.unitId ? unitById(form.unitId) : undefined))
const building = computed(() => (unit.value ? buildingById(unit.value.buildingId) : undefined))

/** Boshlanish sanasi standarti, keyingi oyning birinchi kuni */
function firstOfNextMonth() {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() + 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

onMounted(() => {
  const requested = String(route.query.unit ?? '')
  const found = vacantUnits.value.find((u) => u.id === requested)
  form.unitId = found?.id ?? ''
  form.startDate = firstOfNextMonth()
  if (found) form.price = String(monthlyPrice(found))
})

/**
 * Ayrim unitlar m² narxi bilan e’lon qilinadi, taklif narxi maydoni esa oylik
 * summani kutadi. Shuning uchun m² narxi unit maydoniga ko‘paytiriladi.
 */
function monthlyPrice(u: { price: number; area: number; priceUnit: string }) {
  return u.priceUnit === 'so‘m / m²' ? Math.round(u.price * u.area) : u.price
}

watch(
  () => form.unitId,
  (id) => {
    const u = vacantUnits.value.find((x) => x.id === id)
    if (u) form.price = String(monthlyPrice(u))
  },
)

const organization = computed(() => ({
  name: auth.user?.organization ?? '',
  tin: auth.user?.tin ?? '',
  director: auth.user?.fullName ?? '',
  phone: auth.user?.phone ?? '',
  email: auth.user?.email ?? '',
  address: auth.user?.address ?? '',
}))

const orgRows = computed(() => [
  { label: 'Tashkilot nomi', value: organization.value.name, icon: 'building' },
  { label: 'STIR', value: organization.value.tin, icon: 'clipboard' },
  { label: 'Vakil (direktor)', value: organization.value.director, icon: 'user' },
  { label: 'Telefon', value: organization.value.phone, icon: 'phone' },
  { label: 'E-pochta', value: organization.value.email, icon: 'send' },
  { label: 'Yuridik manzil', value: organization.value.address, icon: 'location' },
])

const TERM_OPTIONS = [
  { value: '12', label: '12 oy' },
  { value: '24', label: '24 oy' },
  { value: '36', label: '36 oy' },
  { value: '60', label: '60 oy' },
]

const term = computed(() => Number(form.term) || 12)
const price = computed(() => Number(form.price) || 0)
const estimate = computed(() => price.value * term.value)

const pending = ref(false)

function submit() {
  errors.unitId = form.unitId ? '' : 'Bo‘sh unitni tanlang'
  errors.price = price.value > 0 ? '' : 'Taklif narxini kiriting'
  errors.startDate = form.startDate ? '' : 'Boshlanish sanasini tanlang'
  if (errors.unitId || errors.price || errors.startDate) return

  pending.value = true
  const created = lease.createCase({
    unitId: form.unitId,
    org: { ...organization.value },
    offerPrice: price.value,
    startDate: form.startDate,
    term: term.value,
    note: form.note.trim(),
    type: REQUEST_TYPE,
  })
  pending.value = false

  if (created) navigateTo(`/cabinet/applications?yangi=${created.id}`)
}
</script>

<template>
  <AppTopbar
    title="Ijaraga olish arizasi"
    subtitle="Tanlangan maydon bo‘yicha rasmiy so‘rov yuboriladi"
    :breadcrumb="[
      { label: 'Kabinet', to: '/cabinet' },
      { label: 'Arizalarim', to: '/cabinet/applications' },
      { label: 'Yangi ariza' },
    ]"
  >
    <template #actions>
      <UiButton variant="secondary" size="sm" to="/cabinet/applications">
        <UiIcon name="chevronLeft" :size="16" />
        Orqaga
      </UiButton>
    </template>
  </AppTopbar>

  <main class="scroll-slim flex-1 overflow-y-auto p-4 sm:p-6">
    <div class="mx-auto grid max-w-[1000px] gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div class="min-w-0 space-y-5">
        <UiCard
          title="Ariza ma’lumotlari"
          subtitle="Shartlar bino rahbari va buxgalter tomonidan ko‘rib chiqiladi"
          icon="clipboard"
        >
          <form class="space-y-4" novalidate @submit.prevent="submit">
            <UiField label="Bo‘sh unit" required :error="errors.unitId">
              <UiSelect
                v-model="form.unitId"
                :options="unitOptions"
                placeholder="Maydonni tanlang"
                :invalid="!!errors.unitId"
              />
            </UiField>

            <div
              v-if="unit && building"
              class="flex flex-wrap items-center justify-between gap-3 rounded-field bg-surface-sunken px-4 py-3 ring-1 ring-inset ring-ink-200"
            >
              <span class="min-w-0 text-[13px] text-ink-600">
                {{ building.name }} · {{ unit.usage }} · {{ unit.floor }}-qavat ·
                {{ unit.rooms }} xona · {{ area(unit.area) }}
              </span>
              <span class="tabular shrink-0 text-[13px] font-bold text-brand-700">
                {{ num(unit.price) }} {{ unit.priceUnit }}
              </span>
            </div>

            <div class="grid gap-4 sm:grid-cols-2">
              <UiField
                label="Taklif narxi"
                required
                :error="errors.price"
                hint="Oylik summa, so‘m"
              >
                <UiInput
                  v-model="form.price"
                  type="number"
                  min="0"
                  placeholder="0"
                  :invalid="!!errors.price"
                >
                  <template #suffix><span class="text-[12px]">so‘m</span></template>
                </UiInput>
              </UiField>
              <UiField label="Muddat" required>
                <UiSelect v-model="form.term" :options="TERM_OPTIONS" />
              </UiField>
            </div>

            <UiField label="Boshlanish sanasi" required :error="errors.startDate">
              <UiInput v-model="form.startDate" type="date" :invalid="!!errors.startDate" />
            </UiField>

            <UiField label="Qo‘shimcha izoh" hint="Talab, shart yoki so‘rovlaringizni yozing">
              <textarea
                v-model="form.note"
                rows="4"
                class="w-full rounded-field bg-white px-3.5 py-2.5 text-sm text-ink-800 ring-1 ring-inset ring-ink-200 transition-colors placeholder:text-ink-400 hover:ring-ink-300 focus:ring-2 focus:ring-brand-500"
                placeholder="Masalan: maydonni bosqichma-bosqich egallash rejalashtirilgan"
              />
            </UiField>

            <div class="flex flex-wrap items-center justify-end gap-3 border-t border-ink-100 pt-4">
              <UiButton variant="ghost" to="/cabinet/applications">Bekor qilish</UiButton>
              <UiButton type="submit" :disabled="pending">
                <UiIcon name="send" :size="16" />
                Arizani yuborish
              </UiButton>
            </div>
          </form>
        </UiCard>
      </div>

      <div class="min-w-0 space-y-5">
        <UiCard title="Tashkilot ma’lumotlari" subtitle="Profildan avtomatik to‘ldirildi" icon="shield" tone="teal">
          <template #actions>
            <UiButton variant="ghost" size="sm" to="/profile">
              <UiIcon name="edit" :size="15" />
              Profilda tahrirlash
            </UiButton>
          </template>

          <dl class="space-y-2.5">
            <div
              v-for="r in orgRows"
              :key="r.label"
              class="rounded-field bg-surface-sunken px-3.5 py-2.5 ring-1 ring-inset ring-ink-200"
            >
              <!-- Ikonka `dt` ichida: `dl > div` faqat `dt`/`dd` ni saqlaydi -->
              <dt
                class="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wide text-ink-500"
              >
                <span
                  class="grid size-8 shrink-0 place-items-center rounded-[9px] bg-white text-brand-600 ring-1 ring-ink-200"
                >
                  <UiIcon :name="r.icon" :size="15" />
                </span>
                {{ r.label }}
              </dt>
              <dd class="tabular mt-0.5 break-words pl-11 text-[13px] font-semibold text-ink-900">
                {{ r.value || '-' }}
              </dd>
            </div>
          </dl>

          <p class="mt-3 flex items-start gap-2 text-[12px] leading-relaxed text-ink-500">
            <UiIcon name="lock" :size="14" class="mt-px shrink-0" />
            Maydonlar faqat o‘qish uchun, rekvizitlar profil bo‘limida yangilanadi.
          </p>
        </UiCard>

        <UiCard v-if="price > 0" title="Dastlabki hisob" subtitle="Yakuniy shartlar ko‘rikdan keyin" icon="chart" tone="brand">
          <dl class="space-y-3">
            <div class="flex items-baseline justify-between gap-3">
              <dt class="text-[13px] text-ink-500">Ariza turi</dt>
              <dd class="text-[14px] font-bold text-ink-900">{{ REQUEST_TYPE }}</dd>
            </div>
            <div class="flex items-baseline justify-between gap-3">
              <dt class="text-[13px] text-ink-500">Taklif narxi (oylik)</dt>
              <dd class="tabular text-[14px] font-bold text-ink-900">{{ sum(price) }}</dd>
            </div>
            <div class="flex items-baseline justify-between gap-3">
              <dt class="text-[13px] text-ink-500">Muddat</dt>
              <dd class="tabular text-[14px] font-bold text-ink-900">{{ term }} oy</dd>
            </div>
            <div class="flex items-baseline justify-between gap-3 border-t border-ink-100 pt-3">
              <dt class="text-[13px] text-ink-500">Muddat bo‘yicha jami</dt>
              <dd class="tabular text-[16px] font-extrabold text-brand-700">{{ sum(estimate) }}</dd>
            </div>
          </dl>
        </UiCard>
      </div>
    </div>
  </main>
</template>
