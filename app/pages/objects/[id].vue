<script setup lang="ts">
import { buildingById } from '~/data/buildings'
import { unitsOfBuilding, unitsOfFloor } from '~/data/units'
import { area, num, percent, sum, sumShort } from '~/utils/format'

const route = useRoute()

const id = computed(() => String(route.params.id))
const nested = computed(() => route.path.replace(/\/+$/, '') !== `/objects/${id.value}`)
const building = computed(() => buildingById(id.value))

const units = computed(() => (building.value ? unitsOfBuilding(building.value.id) : []))

const editOpen = ref(false)
const pdfOpen = ref(false)
const notice = ref('')
const pdfSections = ref<string[]>(['pasport', 'qavatlar', 'unitlar'])

const editForm = reactive({
  name: '',
  street: '',
  district: '',
  buildingClass: '',
  manager: '',
  managerPhone: '',
})

watchEffect(() => {
  const b = building.value
  if (!b) return
  editForm.name = b.name
  editForm.street = b.street
  editForm.district = b.district
  editForm.buildingClass = b.buildingClass
  editForm.manager = b.manager
  editForm.managerPhone = b.managerPhone
})

interface SpecRow {
  label: string
  value: string
  tone?: 'ok' | 'warn'
  mono?: boolean
}

const spec = computed<SpecRow[]>(() => {
  const b = building.value
  if (!b) return []
  return [
    { label: 'ID', value: b.code, mono: true },
    { label: 'Nomi', value: b.name },
    { label: 'Manzil', value: `${b.city} shahri, ${b.district}, ${b.street}` },
    { label: 'Turi', value: b.type },
    { label: 'Bino klassi', value: b.buildingClass },
    { label: 'Qurilgan yil', value: `${b.buildYear}-yil` },
    { label: 'Umumiy maydon', value: area(b.gla) },
    {
      label: 'Qavatlar soni',
      value: b.undergroundFloors
        ? `${b.floors} (+${b.undergroundFloors} yer osti)`
        : String(b.floors),
    },
    { label: 'Unitlar soni', value: num(b.units) },
    { label: 'Band unitlar', value: `${num(b.occupiedUnits)} (${percent(b.occupancy)})`, tone: 'ok' },
    {
      label: 'Bo‘sh unitlar',
      value: `${num(b.vacantUnits)} (${percent(100 - b.occupancy)})`,
      tone: 'warn',
    },
    { label: 'Jihozlar', value: b.equipment.join(', ') },
  ]
})

const floors = computed(() => {
  const b = building.value
  if (!b) return []
  const list = Array.from({ length: b.floors }, (_, i) => b.floors - i)
  if (b.undergroundFloors) list.push(0)
  return list.map((floor) => {
    const floorUnits = unitsOfFloor(b.id, floor)
    return {
      floor,
      label: floor === 0 ? 'Yer osti · texnik qavat' : `${floor}-qavat`,
      total: floorUnits.length,
      vacant: floorUnits.filter((u) => u.status === 'VACANT').length,
      area: floorUnits.reduce((s, u) => s + u.area, 0),
    }
  })
})

/** Galereyada ko‘rsatilayotgan rakurs; obyekt almashsa asosiy rasmga qaytadi */
const picked = ref('')
watch(building, () => {
  picked.value = ''
})

const activePhoto = computed({
  get: () => picked.value || building.value?.photo || '',
  set: (v: string) => {
    picked.value = v
  },
})

const locationMarkers = computed(() =>
  building.value
    ? [
        {
          id: building.value.id,
          lat: building.value.lat,
          lon: building.value.lon,
          label: building.value.name,
          caption: `${building.value.district} · ${building.value.type}`,
          value: building.value.occupancy,
          valueLabel: '% bandlik',
          tone: 'brand' as const,
        },
      ]
    : [],
)

const unitColumns = [
  { key: 'code', label: 'Unit', width: '110px' },
  { key: 'floor', label: 'Qavat', align: 'right' as const, numeric: true },
  { key: 'areaLabel', label: 'Maydoni', align: 'right' as const, numeric: true },
  { key: 'usage', label: 'Turi' },
  { key: 'offer', label: 'Taklif' },
  { key: 'tenant', label: 'Ijarachi / Xaridor' },
  { key: 'priceLabel', label: 'Narxi', align: 'right' as const, numeric: true },
  { key: 'status', label: 'Holat', align: 'center' as const, width: '140px' },
]

const unitRows = computed(() =>
  units.value.map((u) => ({
    id: u.id,
    code: u.code,
    floor: u.floor,
    areaLabel: area(u.area),
    usage: u.usage,
    offer: u.offer,
    tenant: u.tenant ?? '-',
    priceLabel: `${num(u.price)} ${u.priceUnit}`,
    status: u.status,
  })),
)

const unitSummary = computed(() => ({
  total: units.value.length,
  vacant: units.value.filter((u) => u.status === 'VACANT').length,
  area: units.value.reduce((s, u) => s + u.area, 0),
}))

function unitPath(row: Record<string, unknown>) {
  return `/objects/${id.value}/floors/${row.floor}?unit=${row.id}`
}

function togglePdfSection(key: string) {
  const next = new Set(pdfSections.value)
  next.has(key) ? next.delete(key) : next.add(key)
  pdfSections.value = Array.from(next)
}

function submitEdit() {
  notice.value = `«${editForm.name}» obyekti ma’lumotlari yangilandi va auditda qayd etildi.`
  editOpen.value = false
}

function submitPdf() {
  notice.value = `Bino pasporti PDF ko‘rinishida tayyorlandi, ${pdfSections.value.length} ta bo‘lim.`
  pdfOpen.value = false
}
</script>

<template>
  <NuxtPage v-if="nested" />

  <template v-else-if="!building">
    <AppTopbar
      title="Obyekt topilmadi"
      :breadcrumb="[{ label: 'Obyektlar', to: '/objects' }, { label: 'Topilmadi' }]"
    />
    <main class="scroll-slim flex-1 overflow-y-auto p-6">
      <UiCard>
        <div class="flex flex-col items-center gap-4 py-12 text-center">
          <span class="grid size-14 place-items-center rounded-full bg-warn-50 text-warn-600">
            <UiIcon name="warning" :size="26" />
          </span>
          <div>
            <p class="text-[15px] font-bold text-ink-900">Bunday obyekt reyestrda yo‘q</p>
            <p class="mt-1 text-[13px] text-ink-500">
              Havola eskirgan bo‘lishi mumkin. Reyestrga qaytib, kerakli obyektni tanlang.
            </p>
          </div>
          <UiButton to="/objects">
            <UiIcon name="chevronLeft" :size="16" />
            Obyektlar reyestri
          </UiButton>
        </div>
      </UiCard>
    </main>
  </template>

  <template v-else>
    <AppTopbar
      :title="building.name"
      :subtitle="`${building.type} · ${building.city}, ${building.district}`"
      :breadcrumb="[{ label: 'Obyektlar', to: '/objects' }, { label: building.name }]"
    >
      <template #actions>
        <UiButton variant="secondary" size="sm" @click="editOpen = true">
          <UiIcon name="edit" :size="16" />
          Tahrirlash
        </UiButton>
        <UiButton variant="secondary" size="sm" @click="pdfOpen = true">
          <UiIcon name="doc" :size="16" />
          PDF pasport
        </UiButton>
        <UiButton size="sm" :to="`/objects/${building.id}/3d`">
          <UiIcon name="cube" :size="16" />
          3D ko‘rinish
        </UiButton>
      </template>
    </AppTopbar>

    <main class="scroll-slim flex-1 space-y-5 overflow-y-auto p-6">
      <div
        v-if="notice"
        class="flex items-start gap-3 rounded-card bg-ok-50 px-4 py-3.5 ring-1 ring-inset ring-ok-100"
      >
        <UiIcon name="check" :size="18" class="mt-0.5 shrink-0 text-ok-600" />
        <p class="flex-1 text-[13px] font-medium text-ok-700">{{ notice }}</p>
        <button
          type="button"
          class="shrink-0 rounded-[8px] p-1 text-ok-600 transition-colors hover:bg-ok-100"
          aria-label="Xabarnomani yopish"
          @click="notice = ''"
        >
          <UiIcon name="x" :size="15" />
        </button>
      </div>

      <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <UiKpi
          label="Bandlik darajasi"
          :value="percent(building.occupancy)"
          icon="building"
          tone="brand"
          :spark="[building.occupancy - 6, building.occupancy - 4, building.occupancy - 2, building.occupancy - 1, building.occupancy]"
        />
        <UiKpi
          label="Bo‘sh maydon"
          :value="num(building.vacantArea)"
          unit="m²"
          icon="layers"
          tone="ok"
        />
        <UiKpi
          label="Oylik ijara tushumi"
          :value="sumShort(building.monthlyRevenue)"
          icon="wallet"
          tone="violet"
        />
        <UiKpi
          label="Qarzdorlik"
          :value="sumShort(building.debt)"
          icon="warning"
          tone="danger"
        />
      </section>

      <section class="grid gap-5 xl:grid-cols-3">
        <UiCard title="Bino pasporti" subtitle="Obyekt bo‘yicha to‘liq ma’lumotlar kartasi">
          <template #actions>
            <UiStatus
              :kind="building.status === 'ACTIVE' ? 'contract' : 'unit'"
              :value="building.status === 'ACTIVE' ? 'ACTIVE' : 'ARCHIVED'"
              size="sm"
            />
          </template>

          <!-- Haqiqiy fotogalereya -->
          <div class="space-y-2.5">
            <UiPhoto
              :name="activePhoto"
              :alt="building.name"
              ratio="aspect-[16/10]"
              rounded="rounded-field"
              sizes="(max-width: 1280px) 100vw, 420px"
              eager
            >
              <span
                class="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink-900/70 via-ink-900/10 to-transparent"
              />
              <span class="absolute bottom-3 left-3.5 right-3.5">
                <span class="block text-[15px] font-semibold text-white drop-shadow">
                  {{ building.name }}
                </span>
                <span class="block text-[12px] text-white/85">
                  {{ building.district }} · {{ building.buildingClass }}
                </span>
              </span>
            </UiPhoto>

            <div v-if="building.gallery.length > 1" class="grid grid-cols-4 gap-2">
              <button
                v-for="g in building.gallery"
                :key="g"
                type="button"
                class="overflow-hidden rounded-[9px] ring-2 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                :class="g === activePhoto ? 'ring-brand-500' : 'ring-transparent hover:ring-ink-300'"
                :aria-label="`${building.name}, rakurs ${building.gallery.indexOf(g) + 1}`"
                :aria-pressed="g === activePhoto"
                @click="activePhoto = g"
              >
                <UiPhoto :name="g" :alt="building.name" ratio="aspect-[4/3]" rounded="rounded-none" sizes="110px" />
              </button>
            </div>
          </div>

          <dl class="mt-4 divide-y divide-ink-100">
            <div v-for="row in spec" :key="row.label" class="flex gap-4 py-2.5">
              <dt class="w-[124px] shrink-0 text-[12.5px] text-ink-500">{{ row.label }}</dt>
              <dd
                class="min-w-0 flex-1 text-[13px] font-semibold"
                :class="[
                  row.tone === 'ok'
                    ? 'text-ok-600'
                    : row.tone === 'warn'
                      ? 'text-warn-600'
                      : 'text-ink-900',
                  row.mono ? 'tabular' : '',
                ]"
              >
                {{ row.value }}
              </dd>
            </div>

            <div class="flex items-center gap-4 py-3">
              <dt class="w-[124px] shrink-0 text-[12.5px] text-ink-500">Mas’ul rahbar</dt>
              <dd class="flex min-w-0 flex-1 items-center gap-2.5">
                <span
                  class="grid size-9 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-600"
                >
                  <UiIcon name="user" :size="17" />
                </span>
                <span class="min-w-0">
                  <span class="block truncate text-[13px] font-semibold text-ink-900">
                    {{ building.manager }}
                  </span>
                  <span class="tabular block text-[12px] text-ink-500">
                    {{ building.managerPhone }}
                  </span>
                </span>
              </dd>
            </div>
          </dl>
        </UiCard>

        <div class="min-w-0 space-y-5 xl:col-span-2">
          <UiCard title="Qulayliklar" subtitle="Obyektda mavjud infratuzilma">
            <div class="flex flex-wrap gap-2">
              <span
                v-for="a in building.amenities"
                :key="a"
                class="inline-flex items-center gap-2 rounded-pill bg-ok-50 px-3 py-1.5 text-[12.5px] font-medium text-ok-700 ring-1 ring-inset ring-ok-100"
              >
                <UiIcon name="check" :size="14" />
                {{ a }}
              </span>
            </div>

            <div class="mt-4 flex flex-wrap gap-2 border-t border-ink-100 pt-4">
              <span
                v-for="e in building.equipment"
                :key="e"
                class="inline-flex items-center gap-2 rounded-pill bg-ink-100 px-3 py-1.5 text-[12.5px] font-medium text-ink-700"
              >
                <UiIcon name="wrench" :size="14" />
                {{ e }}
              </span>
            </div>
          </UiCard>

          <UiCard title="Qavatlar" subtitle="Qavat rejasiga o‘tish uchun tanlang" flush :padded="false">
            <template #actions>
              <UiButton variant="ghost" size="sm" :to="`/objects/${building.id}/3d`">
                3D navigator
                <UiIcon name="chevronRight" :size="15" />
              </UiButton>
            </template>

            <div class="scroll-slim max-h-[268px] overflow-y-auto px-5 pb-5">
              <div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                <NuxtLink
                  v-for="f in floors"
                  :key="f.floor"
                  :to="`/objects/${building.id}/floors/${f.floor}`"
                  class="group flex items-center gap-3 rounded-field px-3 py-2.5 ring-1 ring-ink-200 transition-all hover:shadow-card hover:ring-brand-300"
                >
                  <span
                    class="tabular grid size-9 shrink-0 place-items-center rounded-[9px] text-[13px] font-bold"
                    :class="
                      f.total
                        ? 'bg-brand-50 text-brand-700'
                        : 'bg-ink-100 text-ink-500'
                    "
                  >
                    {{ f.floor === 0 ? '00' : f.floor }}
                  </span>
                  <span class="min-w-0 flex-1">
                    <span
                      class="block truncate text-[13px] font-semibold text-ink-900 group-hover:text-brand-600"
                    >
                      {{ f.label }}
                    </span>
                    <span class="block truncate text-[12px] text-ink-500">
                      {{ f.total ? `${f.total} unit · ${f.vacant} bo‘sh` : 'Reja kiritilmagan' }}
                    </span>
                  </span>
                  <UiIcon name="chevronRight" :size="15" class="shrink-0 text-ink-400" />
                </NuxtLink>
              </div>
            </div>
          </UiCard>

          <UiCard
            title="Obyekt unitlari"
            :subtitle="`${unitSummary.total} ta yozuv · ${unitSummary.vacant} bo‘sh · ${area(unitSummary.area)}`"
            flush
            :padded="false"
          >
            <UiTable
              :columns="unitColumns"
              :rows="unitRows"
              :to="unitPath"
              empty="Ushbu obyekt bo‘yicha unit yozuvlari hali kiritilmagan"
            >
              <template #cell-code="{ row }">
                <span class="tabular text-[13px] font-bold text-ink-900">{{ row.code }}</span>
              </template>
              <template #cell-floor="{ row }">
                <span class="tabular">{{ row.floor }}-qavat</span>
              </template>
              <template #cell-status="{ row }">
                <UiStatus kind="unit" :value="String(row.status)" size="sm" />
              </template>
            </UiTable>
          </UiCard>
        </div>
      </section>

      <UiModal
        v-model="editOpen"
        title="Obyekt ma’lumotlarini tahrirlash"
        :subtitle="building.code"
        size="lg"
      >
        <div class="grid gap-4 sm:grid-cols-2">
          <UiField label="Bino nomi" class="sm:col-span-2">
            <UiInput v-model="editForm.name" />
          </UiField>
          <UiField label="Tuman">
            <UiInput v-model="editForm.district" />
          </UiField>
          <UiField label="Ko‘cha va uy raqami">
            <UiInput v-model="editForm.street" />
          </UiField>
          <UiField label="Bino klassi">
            <UiInput v-model="editForm.buildingClass" />
          </UiField>
          <UiField label="Mas’ul rahbar">
            <UiInput v-model="editForm.manager" />
          </UiField>
          <UiField label="Telefon" class="sm:col-span-2">
            <UiInput v-model="editForm.managerPhone" />
          </UiField>
        </div>

        <template #footer>
          <UiButton variant="ghost" @click="editOpen = false">Bekor qilish</UiButton>
          <UiButton @click="submitEdit">
            <UiIcon name="check" :size="16" />
            Saqlash
          </UiButton>
        </template>
      </UiModal>

      <UiModal
        v-model="pdfOpen"
        title="PDF pasport"
        subtitle="Hujjatga kiritiladigan bo‘limlarni belgilang"
      >
        <div class="space-y-2.5">
          <button
            v-for="s in [
              { key: 'pasport', label: 'Bino pasporti', hint: 'Asosiy ma’lumotlar va jihozlar' },
              { key: 'qavatlar', label: 'Qavatlar ro‘yxati', hint: 'Har bir qavat bo‘yicha yig‘ma' },
              { key: 'unitlar', label: 'Unitlar jadvali', hint: 'Holat, ijarachi va narx' },
              { key: 'moliya', label: 'Moliyaviy ko‘rsatkichlar', hint: 'Tushum va qarzdorlik' },
            ]"
            :key="s.key"
            type="button"
            class="flex w-full items-center gap-3 rounded-field px-4 py-3 text-left ring-1 ring-inset transition-colors"
            :class="
              pdfSections.includes(s.key) ? 'bg-brand-50 ring-brand-300' : 'ring-ink-200 hover:bg-ink-50'
            "
            @click="togglePdfSection(s.key)"
          >
            <span
              class="grid size-6 shrink-0 place-items-center rounded-[7px] ring-1 ring-inset"
              :class="
                pdfSections.includes(s.key)
                  ? 'bg-brand-500 text-white ring-brand-500'
                  : 'text-transparent ring-ink-300'
              "
            >
              <UiIcon name="check" :size="14" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block text-[13.5px] font-semibold text-ink-900">{{ s.label }}</span>
              <span class="block text-[12px] text-ink-500">{{ s.hint }}</span>
            </span>
          </button>
        </div>

        <p class="mt-4 text-[12.5px] text-ink-500">
          Hujjat {{ building.name }} obyekti bo‘yicha {{ pdfSections.length }} ta bo‘limdan
          shakllantiriladi. Umumiy maydon: {{ area(building.gla) }}, oylik tushum:
          {{ sum(building.monthlyRevenue) }}.
        </p>

        <template #footer>
          <UiButton variant="ghost" @click="pdfOpen = false">Bekor qilish</UiButton>
          <UiButton :disabled="!pdfSections.length" @click="submitPdf">
            <UiIcon name="download" :size="16" />
            Yuklab olish
          </UiButton>
        </template>
      </UiModal>
    </main>
  </template>
</template>
