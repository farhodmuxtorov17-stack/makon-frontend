<script setup lang="ts">
import { buildingById } from '~/data/buildings'
import { unitsOfBuilding, type Unit } from '~/data/units'
import { area, num, percent } from '~/utils/format'

type ViewMode = 'occupancy' | 'levels' | 'interior' | 'furnished' | 'wire'

interface MixSlice {
  key: string
  label: string
  color: string
  count: number
  share: number
}

interface FloorRow {
  floor: number
  name: string
  short: string
  underground: boolean
  units: Unit[]
  total: number
  vacantCount: number
  totalArea: number
  vacantArea: number
  occupancy: number
  vacantShare: number
  label: string
  mix: MixSlice[]
  planFloor: number
}

/** Holat legendasi: tartib va ranglar buyurtmachi maketidan */
const CATEGORIES: Array<{ key: string; label: string; color: string }> = [
  { key: 'vacant', label: 'Bo‘sh', color: '#16B99A' },
  { key: 'rented', label: 'Ijarada', color: '#0256F7' },
  { key: 'sold', label: 'Sotilgan', color: '#F84448' },
  { key: 'reserved', label: 'Rezerv', color: '#FAA53F' },
  { key: 'other', label: 'Texnik / Boshqa', color: '#8494AC' },
]

const CATEGORY_OF: Record<string, string> = {
  VACANT: 'vacant',
  RENTED: 'rented',
  SOLD: 'sold',
  RESERVED: 'reserved',
  MAINTENANCE: 'other',
  DRAFT: 'other',
}

const route = useRoute()
const id = computed(() => String(route.params.id))
const auth = useAuthStore()

/** Biriktirilmagan obyekt 3D navigator havolasi orqali ham ochilmaydi */
const building = computed(() => {
  const b = buildingById(id.value)
  return b && auth.inScope(b.id) ? b : undefined
})

/** Ijarachi va narx ma’lumoti faqat ijara oqimida ishlaydigan rollarga ochiq */
const showFinance = computed(
  () => auth.can('application.decide') || auth.can('invoice.create') || auth.can('contract.sign'),
)

// 0 hech qachon haqiqiy daraja emas (yer osti manfiy, yer usti 1 dan boshlanadi),
// shu sababli birinchi kuzatuvchi reja kiritilgan eng boy qavatni ochadi.
const selectedFloor = ref(0)
const selectedUnit = ref('')
const viewMode = ref<ViewMode>('occupancy')

const allUnits = computed(() => (building.value ? unitsOfBuilding(building.value.id) : []))

const floorRows = computed<FloorRow[]>(() => {
  const b = building.value
  if (!b) return []

  const numbers: number[] = []
  for (let k = b.undergroundFloors; k >= 1; k--) numbers.push(-k)
  for (let f = 1; f <= b.floors; f++) numbers.push(f)

  return numbers.map((floor) => {
    const units = allUnits.value.filter((u) => u.floor === floor)
    const totalArea = units.reduce((s, u) => s + u.area, 0)
    const vacant = units.filter((u) => u.status === 'VACANT')
    const vacantArea = vacant.reduce((s, u) => s + u.area, 0)

    const mix: MixSlice[] = CATEGORIES.map((c) => {
      const own = units.filter((u) => (CATEGORY_OF[u.status] ?? 'other') === c.key)
      return {
        key: c.key,
        label: c.label,
        color: c.color,
        count: own.length,
        share: units.length ? own.length / units.length : 0,
      }
    }).filter((m) => m.count > 0)

    let label = 'Reja kiritilmagan'
    if (units.length) {
      if (!vacant.length) label = 'To‘liq band'
      else if (vacant.length === units.length) label = 'Butunlay bo‘sh'
      else label = 'Qisman bo‘sh'
    }

    return {
      floor,
      name: floor < 0 ? `${-floor}-yer osti qavati` : `${floor}-qavat`,
      short: String(floor),
      underground: floor < 0,
      units,
      total: units.length,
      vacantCount: vacant.length,
      totalArea,
      vacantArea,
      occupancy: totalArea ? Math.round(((totalArea - vacantArea) / totalArea) * 100) : 0,
      vacantShare: totalArea ? Math.round((vacantArea / totalArea) * 100) : 0,
      label,
      mix,
      planFloor: floor,
    }
  })
})

/** Ro‘yxat yuqoridan pastga, yuqori qavat tepada turadi */
const floorsDesc = computed(() => [...floorRows.value].reverse())
const floorsWithPlan = computed(() => floorRows.value.filter((f) => f.total > 0))

const currentFloor = computed(
  () => floorRows.value.find((f) => f.floor === selectedFloor.value) ?? floorRows.value[0],
)

const currentUnit = computed<Unit | undefined>(() =>
  currentFloor.value?.units.find((u) => u.id === selectedUnit.value),
)

const legend = computed(() => {
  const totals = new Map<string, number>()
  for (const u of allUnits.value) {
    const key = CATEGORY_OF[u.status] ?? 'other'
    totals.set(key, (totals.get(key) ?? 0) + 1)
  }
  return CATEGORIES.map((c) => ({ ...c, count: totals.get(c.key) ?? 0 }))
})

watch(
  floorRows,
  (rows) => {
    if (!rows.length) return
    if (rows.some((r) => r.floor === selectedFloor.value)) return
    const best = rows.reduce((a, b) => (b.total > a.total ? b : a), rows[0]!)
    selectedFloor.value = best.total ? best.floor : rows[rows.length - 1]!.floor
    selectedUnit.value = ''
  },
  { immediate: true },
)

watch(selectedFloor, () => {
  if (!currentFloor.value?.units.some((u) => u.id === selectedUnit.value)) selectedUnit.value = ''
})

const buildingStats = computed(() => {
  const b = building.value
  if (!b) return null
  return [
    {
      label: 'Qavatlar',
      value: String(b.floors),
      note: b.undergroundFloors ? `+${b.undergroundFloors} yer osti` : 'yer osti yo‘q',
      icon: 'layers',
      tone: 'bg-brand-50 text-brand-600',
    },
    {
      label: 'Unitlar',
      value: num(b.units),
      note: `${num(b.vacantUnits)} tasi bo‘sh`,
      icon: 'box',
      tone: 'bg-info-50 text-info-600',
    },
    {
      label: 'Bandlik',
      value: percent(b.occupancy),
      note: `${num(b.occupiedUnits)} unit band`,
      icon: 'chart',
      tone: 'bg-ok-50 text-ok-600',
    },
    {
      label: 'Bo‘sh, m²',
      value: num(b.vacantArea),
      note: `GLA ${num(b.gla)} m²`,
      icon: 'meter',
      tone: 'bg-warn-50 text-warn-600',
    },
  ]
})

const planLink = computed(() => {
  const b = building.value
  const f = currentFloor.value
  if (!b || !f) return '/objects'
  const query = selectedUnit.value ? `?unit=${selectedUnit.value}` : ''
  return `/objects/${b.id}/floors/${f.planFloor}${query}`
})

function contractLabel(unit: Unit) {
  if (unit.contractCode) return `Shartnoma ${unit.contractCode}`
  if (unit.status === 'RESERVED') return 'Rezervda, shartnoma tayyorlanmoqda'
  if (unit.status === 'MAINTENANCE') return 'Ta’mir ishlari tugagunicha to‘xtatilgan'
  if (unit.status === 'VACANT') return 'Shartnoma rasmiylashtirilmagan'
  return 'Shartnoma ma’lumotlari kiritilmagan'
}

const applyOpen = ref(false)

/** Bo‘sh unitga ariza yuborish, rolga qarab yo‘naltiradi */
function goApply() {
  const unit = currentUnit.value
  if (!unit || unit.status !== 'VACANT') return
  // Kirmagan mehmon hisob ochmasdan ariza qoldiradi
  if (!auth.isAuthenticated) return navigateTo(`/ariza?unit=${unit.id}`)
  if (auth.role !== 'TENANT_OWNER') {
    applyOpen.value = true
    return
  }
  return navigateTo(`/cabinet/apply?unit=${unit.id}`)
}
</script>

<template>
  <template v-if="!building">
    <AppTopbar
      title="Obyekt topilmadi"
      :breadcrumb="[{ label: 'Obyektlar', to: '/objects' }, { label: 'Topilmadi' }]"
    />
    <main class="scroll-slim flex-1 overflow-y-auto p-4 sm:p-6">
      <UiCard>
        <div class="flex flex-col items-center gap-4 py-12 text-center">
          <span class="grid size-14 place-items-center rounded-full bg-warn-50 text-warn-600">
            <UiIcon name="warning" :size="26" />
          </span>
          <p class="text-[15px] font-bold text-ink-900">Obyekt mavjud emas</p>
          <p class="max-w-sm text-[13px] leading-relaxed text-ink-500">
            Havola eskirgan yoki obyekt sizga biriktirilmagan bo‘lishi mumkin.
          </p>
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
      title="3D bino navigatori"
      :subtitle="`${building.name} · qavat va unit darajasidagi hajmli ko‘rinish`"
      :breadcrumb="[
        { label: 'Obyektlar', to: '/objects' },
        { label: building.name, to: `/objects/${building.id}` },
        { label: '3D navigator' },
      ]"
    >
      <template #actions>
        <UiButton variant="secondary" size="sm" :to="`/objects/${building.id}`">
          <UiIcon name="doc" :size="16" />
          Bino pasporti
        </UiButton>
        <UiButton size="sm" :to="planLink">
          <UiIcon name="layers" :size="16" />
          Qavat rejasi
        </UiButton>
      </template>
    </AppTopbar>

    <main class="scroll-slim flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
      <UiCard flush :padded="false">
        <div class="grid gap-5 p-5 sm:grid-cols-[minmax(0,240px)_minmax(0,1fr)]">
          <UiPhoto
            :name="building.photo"
            :alt="building.name"
            ratio="aspect-[16/10]"
            sizes="(max-width: 640px) 100vw, 240px"
            eager
          >
            <span
              class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-900/80 via-ink-900/20 to-transparent px-3 py-2 text-[11.5px] font-semibold text-white"
            >
              {{ building.buildYear }}-yil · {{ building.type }}
            </span>
          </UiPhoto>

          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <h2 class="min-w-0 truncate text-[20px] font-bold text-ink-900 sm:text-[22px]">
                {{ building.name }}
              </h2>
              <span
                class="rounded-pill bg-brand-50 px-2.5 py-0.5 text-[11.5px] font-semibold text-brand-700 ring-1 ring-inset ring-brand-200"
              >
                {{ building.buildingClass }}
              </span>
            </div>
            <p class="mt-1.5 flex items-center gap-1.5 text-[13px] text-ink-500">
              <UiIcon name="location" :size="15" class="shrink-0" />
              <span class="min-w-0 truncate">
                {{ building.city }}, {{ building.district }}, {{ building.street }}
              </span>
            </p>

            <div v-if="buildingStats" class="mt-4 grid grid-cols-2 gap-2.5 xl:grid-cols-4">
              <div
                v-for="k in buildingStats"
                :key="k.label"
                class="min-w-0 rounded-field bg-surface-sunken px-3 py-2.5 ring-1 ring-inset ring-ink-200/70"
              >
                <span class="flex items-start justify-between gap-2">
                  <span class="min-w-0">
                    <span
                      class="block truncate text-[11px] font-semibold uppercase tracking-wide text-ink-500"
                    >
                      {{ k.label }}
                    </span>
                    <span class="tabular mt-1.5 block truncate text-[19px] font-bold leading-none text-ink-900">
                      {{ k.value }}
                    </span>
                  </span>
                  <span class="grid size-7 shrink-0 place-items-center rounded-[8px]" :class="k.tone">
                    <UiIcon :name="k.icon" :size="15" />
                  </span>
                </span>
                <p class="mt-2 truncate text-[11.5px] text-ink-500">{{ k.note }}</p>
              </div>
            </div>
          </div>
        </div>
      </UiCard>

      <section
        class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] 2xl:grid-cols-[188px_minmax(0,1fr)_336px]"
      >
        <!-- Qavat ustuni faqat keng ekranda; undan pastda ko‘rinish ustidagi rels ishlaydi -->
        <UiCard
          class="hidden 2xl:block"
          title="Qavatni tanlang"
          :subtitle="`${floorsWithPlan.length} qavatda reja bor`"
          flush
          :padded="false"
        >
          <div class="scroll-slim max-h-[560px] overflow-y-auto px-2.5 pb-4">
            <button
              v-for="f in floorsDesc"
              :key="f.floor"
              type="button"
              class="mb-1 flex w-full items-center gap-2 rounded-field px-2 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
              :class="
                f.floor === selectedFloor
                  ? 'bg-brand-50 ring-1 ring-inset ring-brand-300'
                  : 'hover:bg-ink-50'
              "
              :aria-pressed="f.floor === selectedFloor"
              @click="selectedFloor = f.floor"
            >
              <span
                class="tabular grid size-8 shrink-0 place-items-center rounded-[8px] text-[12px] font-bold"
                :class="
                  f.floor === selectedFloor
                    ? 'bg-brand-500 text-white'
                    : f.underground
                      ? 'bg-ink-100 text-ink-500'
                      : 'bg-surface-sunken text-ink-700 ring-1 ring-inset ring-ink-200'
                "
              >
                {{ f.short }}
              </span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-[12.5px] font-semibold text-ink-900">
                  {{ f.name }}
                </span>
                <span class="mt-1 flex h-1.5 w-full overflow-hidden rounded-pill bg-ink-100">
                  <span
                    v-for="m in f.mix"
                    :key="m.key"
                    class="h-full"
                    :style="{ width: `${m.share * 100}%`, background: m.color }"
                  />
                </span>
                <span class="tabular mt-1 block truncate text-[11px] text-ink-500">
                  {{ f.total ? `${f.total} unit · ${f.occupancy}%` : 'Reja yo‘q' }}
                </span>
              </span>
            </button>
          </div>
        </UiCard>

        <UiCard
          title="Hajmli ko‘rinish"
          :subtitle="`${building.floors} qavat${building.undergroundFloors ? ` va ${building.undergroundFloors} yer osti darajasi` : ''} · geometriya bino yozuvidan hisoblanadi`"
          flush
          :padded="false"
        >
          <div class="px-4 pb-5 sm:px-5">
            <UiBuilding3D
              v-model:floor="selectedFloor"
              v-model:unit="selectedUnit"
              v-model:mode="viewMode"
              :building="building"
            />
          </div>
        </UiCard>

        <div class="min-w-0 space-y-5">
          <UiCard class="hidden lg:block" title="Holat legendasi" flush>
            <ul class="space-y-2">
              <li
                v-for="c in legend"
                :key="c.key"
                class="flex items-center gap-2.5 text-[13px] text-ink-700"
              >
                <span
                  class="size-3 shrink-0 rounded-full ring-1 ring-inset ring-ink-900/10"
                  :style="{ background: c.color }"
                />
                <span class="min-w-0 flex-1 truncate font-medium">{{ c.label }}</span>
                <span
                  class="tabular shrink-0 rounded-pill bg-ink-100 px-2 py-0.5 text-[11.5px] font-semibold text-ink-700"
                >
                  {{ c.count }}
                </span>
              </li>
            </ul>
          </UiCard>

          <UiCard v-if="currentFloor" title="Tanlangan qavat" flush>
            <div class="flex items-center justify-between gap-3">
              <p class="tabular min-w-0 truncate text-[20px] font-bold text-ink-900">
                {{ currentFloor.name }}
              </p>
              <span
                class="shrink-0 rounded-pill px-2.5 py-1 text-[11.5px] font-semibold ring-1 ring-inset"
                :class="
                  currentFloor.total
                    ? 'bg-ok-50 text-ok-700 ring-ok-100'
                    : 'bg-ink-100 text-ink-600 ring-ink-200'
                "
              >
                {{ currentFloor.total ? `Bo‘sh ${currentFloor.vacantShare}%` : currentFloor.label }}
              </span>
            </div>

            <dl class="mt-4 divide-y divide-ink-100">
              <div class="flex items-center justify-between gap-4 py-2.5">
                <dt class="text-[12.5px] text-ink-500">Jami maydon</dt>
                <dd class="tabular text-[13px] font-bold text-ink-900">
                  {{ currentFloor.total ? area(currentFloor.totalArea) : '-' }}
                </dd>
              </div>
              <div class="flex items-center justify-between gap-4 py-2.5">
                <dt class="text-[12.5px] text-ink-500">Bo‘sh maydon</dt>
                <dd class="tabular text-[13px] font-bold text-ok-600">
                  {{ currentFloor.total ? area(currentFloor.vacantArea) : '-' }}
                </dd>
              </div>
              <div class="flex items-center justify-between gap-4 py-2.5">
                <dt class="text-[12.5px] text-ink-500">Unitlar soni</dt>
                <dd class="tabular text-[13px] font-bold text-ink-900">
                  {{ currentFloor.total }} ta
                </dd>
              </div>
            </dl>

            <UiButton block class="mt-4" :to="planLink">
              <UiIcon name="send" :size="16" />
              Qavatga o‘tish
            </UiButton>
          </UiCard>

          <UiCard
            :title="currentFloor ? `${currentFloor.name} unitlari` : 'Unitlar'"
            :subtitle="
              currentFloor && currentFloor.total
                ? 'Konturni ajratish uchun unitni tanlang'
                : 'Tanlangan qavatda unit yozuvi yo‘q'
            "
          >
            <div v-if="currentFloor && currentFloor.total" class="space-y-1.5">
              <button
                v-for="u in currentFloor.units"
                :key="u.id"
                type="button"
                class="flex w-full items-center gap-3 rounded-field px-3 py-2.5 text-left ring-1 ring-inset transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                :class="
                  u.id === selectedUnit ? 'bg-brand-50 ring-brand-300' : 'ring-ink-200 hover:bg-ink-50'
                "
                :aria-pressed="u.id === selectedUnit"
                @click="selectedUnit = u.id === selectedUnit ? '' : u.id"
              >
                <span class="min-w-0 flex-1">
                  <span class="tabular block truncate text-[13px] font-bold text-ink-900">
                    {{ u.code }}
                  </span>
                  <span class="tabular mt-0.5 block truncate text-[11.5px] text-ink-500">
                    {{ area(u.area) }} · {{ u.usage }} · {{ u.rooms }} xona
                  </span>
                </span>
                <UiStatus kind="unit" :value="u.status" size="sm" />
              </button>
            </div>

            <div v-else class="flex flex-col items-center gap-3 py-8 text-center">
              <span class="grid size-12 place-items-center rounded-full bg-ink-100 text-ink-500">
                <UiIcon name="box" :size="22" />
              </span>
              <p class="text-[13px] text-ink-500">
                Bu darajada unit yozuvlari yuritilmaydi. Reja kiritilgan qavatni tanlang.
              </p>
              <div v-if="floorsWithPlan.length" class="flex flex-wrap justify-center gap-1.5">
                <button
                  v-for="f in floorsWithPlan"
                  :key="f.floor"
                  type="button"
                  class="rounded-pill bg-brand-50 px-3 py-1.5 text-[12px] font-semibold text-brand-700 transition-colors hover:bg-brand-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                  @click="selectedFloor = f.floor"
                >
                  {{ f.name }} · {{ f.total }}
                </button>
              </div>
            </div>
          </UiCard>

          <UiCard
            v-if="currentUnit"
            :title="`Unit ${currentUnit.code}`"
            :subtitle="`${currentFloor?.name} · ${building.name}`"
            icon="box"
            tone="info"
          >
            <UiStatus kind="unit" :value="currentUnit.status" />

            <dl class="mt-4 divide-y divide-ink-100">
              <div class="flex items-start gap-4 py-2.5">
                <dt class="w-[112px] shrink-0 text-[12.5px] text-ink-500">Maydoni</dt>
                <dd class="tabular min-w-0 flex-1 text-[13px] font-bold text-ink-900">
                  {{ area(currentUnit.area) }}
                </dd>
              </div>
              <div class="flex items-start gap-4 py-2.5">
                <dt class="w-[112px] shrink-0 text-[12.5px] text-ink-500">Turi</dt>
                <dd class="min-w-0 flex-1 text-[13px] font-semibold text-ink-900">
                  {{ currentUnit.usage }} · {{ currentUnit.rooms }} xona · {{ currentUnit.offer }}
                </dd>
              </div>
              <div v-if="showFinance" class="flex items-start gap-4 py-2.5">
                <dt class="w-[112px] shrink-0 text-[12.5px] text-ink-500">Ijarachi</dt>
                <dd class="min-w-0 flex-1 text-[13px] font-semibold text-ink-900">
                  {{ currentUnit.tenant ?? '-' }}
                </dd>
              </div>
              <div v-if="showFinance" class="flex items-start gap-4 py-2.5">
                <dt class="w-[112px] shrink-0 text-[12.5px] text-ink-500">Narxi</dt>
                <dd class="tabular min-w-0 flex-1 text-[13px] font-bold text-brand-600">
                  {{ num(currentUnit.price) }} {{ currentUnit.priceUnit }}
                </dd>
              </div>
              <div v-if="showFinance" class="flex items-start gap-4 py-2.5">
                <dt class="w-[112px] shrink-0 text-[12.5px] text-ink-500">Shartnoma</dt>
                <dd class="min-w-0 flex-1 text-[13px] font-semibold text-ink-800">
                  {{ contractLabel(currentUnit) }}
                </dd>
              </div>
            </dl>

            <div class="mt-4 flex flex-wrap gap-1.5">
              <span
                v-for="e in currentUnit.equipment"
                :key="e"
                class="rounded-pill bg-ink-100 px-2.5 py-1 text-[11.5px] font-medium text-ink-700"
              >
                {{ e }}
              </span>
            </div>

            <UiButton
              v-if="currentUnit.status === 'VACANT'"
              block
              class="mt-4"
              @click="goApply"
            >
              <UiIcon name="send" :size="16" />
              Ariza yuborish
            </UiButton>

            <UiButton
              block
              class="mt-2"
              :variant="currentUnit.status === 'VACANT' ? 'secondary' : 'primary'"
              :to="planLink"
            >
              <UiIcon name="arrowRight" :size="16" />
              2D rejada ochish
            </UiButton>
          </UiCard>

          <UiCard v-else title="Unit kartasi" subtitle="Tafsilot uchun unit tanlang">
            <div class="flex flex-col items-center gap-3 py-8 text-center">
              <span class="grid size-12 place-items-center rounded-full bg-brand-50 text-brand-600">
                <UiIcon name="cube" :size="22" />
              </span>
              <p class="text-[13px] text-ink-500">
                Hajmli ko‘rinishda yoki yuqoridagi ro‘yxatda unitni bosing, uning konturi
                ajratiladi va shu yerda kartasi ochiladi.
              </p>
            </div>
          </UiCard>
        </div>
      </section>
    </main>
  </template>

    <UiModal v-model="applyOpen" title="Ariza yuborish" size="sm">
      <p class="text-[13.5px] leading-relaxed text-ink-600">
        Ariza faqat ijarachi profilidan yuboriladi. Ichki rol bilan kirgan
        foydalanuvchi ariza yarata olmaydi, bu ijarachi tomonidagi amal.
      </p>
      <template #footer>
        <UiButton variant="secondary" @click="applyOpen = false">Yopish</UiButton>
      </template>
    </UiModal>
</template>
