<script setup lang="ts">
import { BUILDINGS } from '~/data/buildings'
import { UNITS, type Unit } from '~/data/units'
import { dateShort, num, percent } from '~/utils/format'

interface QueueRow {
  id: string
  buildingId: string
  buildingName: string
  buildingCode: string
  floor: number
  floorName: string
  units: number
  withPlan: number
  withAttrs: number
  planDone: boolean
  attrsDone: boolean
  updated: string
  codes: string
}

const auth = useAuthStore()

const query = ref('')
const fBuilding = ref('all')
const fState = ref('all')

const scoped = computed(() => BUILDINGS.filter((b) => auth.inScope(b.id)))

function planReady(u: Unit) {
  return Array.isArray(u.polygon) && u.polygon.length >= 3
}

function attrsReady(u: Unit) {
  return Boolean(u.usage) && u.area > 0 && Boolean(u.status) && u.equipment.length > 0
}

function floorName(floor: number) {
  return floor < 0 ? `${-floor}-yer osti qavati` : `${floor}-qavat`
}

// Kiritilgan qavatlar oxirgi tahrir sanasi bo‘yicha tartiblanadi
function updatedOn(order: number) {
  const day = 26 - (order % 18)
  return `2025-05-${String(day).padStart(2, '0')}`
}

const queue = computed<QueueRow[]>(() => {
  const rows: QueueRow[] = []
  let order = 0

  for (const b of scoped.value) {
    const levels: number[] = []
    for (let f = b.floors; f >= 1; f -= 1) levels.push(f)
    for (let k = 1; k <= b.undergroundFloors; k++) levels.push(-k)

    for (const floor of levels) {
      const list = UNITS.filter((u) => u.buildingId === b.id && u.floor === floor)
      const withPlan = list.filter(planReady).length
      const withAttrs = list.filter(attrsReady).length
      if (list.length) order += 1

      rows.push({
        id: `${b.id}-${floor}`,
        buildingId: b.id,
        buildingName: b.name,
        buildingCode: b.code,
        floor,
        floorName: floorName(floor),
        units: list.length,
        withPlan,
        withAttrs,
        planDone: list.length > 0 && withPlan === list.length,
        attrsDone: list.length > 0 && withAttrs === list.length,
        updated: list.length ? updatedOn(order - 1) : '',
        codes: list.map((u) => u.code).join(' '),
      })
    }
  }

  return rows
})

const kpi = computed(() => {
  const all = queue.value
  const drawn = all.filter((r) => r.planDone).length
  return {
    total: all.length,
    drawn,
    pending: all.length - drawn,
    attrs: all.filter((r) => !r.attrsDone).length,
    units: all.reduce((s, r) => s + r.units, 0),
  }
})

const buildingOptions = computed(() => [
  { value: 'all', label: 'Barcha binolar' },
  ...scoped.value.map((b) => ({ value: b.id, label: b.name })),
])

const stateOptions = computed(() => [
  { value: 'all', label: `Barchasi (${kpi.value.total})` },
  { value: 'plan', label: `Reja kutilmoqda (${kpi.value.pending})` },
  { value: 'attrs', label: `Atributi to‘liq emas (${kpi.value.attrs})` },
])

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()

  return queue.value.filter((r) => {
    if (fBuilding.value !== 'all' && r.buildingId !== fBuilding.value) return false
    if (fState.value === 'plan' && r.planDone) return false
    if (fState.value === 'attrs' && r.attrsDone) return false
    if (q) {
      const haystack =
        `${r.buildingName} ${r.buildingCode} ${r.floorName} ${r.codes}`.toLowerCase()
      if (!haystack.includes(q)) return false
    }
    return true
  })
})

const perBuilding = computed(() =>
  scoped.value.map((b) => {
    const rows = queue.value.filter((r) => r.buildingId === b.id)
    const drawn = rows.filter((r) => r.planDone).length
    return {
      id: b.id,
      name: b.name,
      type: b.type,
      floors: rows.length,
      drawn,
      units: rows.reduce((s, r) => s + r.units, 0),
      ratio: rows.length ? Math.round((drawn / rows.length) * 100) : 0,
    }
  }),
)

const dirty = computed(
  () => Boolean(query.value.trim()) || fBuilding.value !== 'all' || fState.value !== 'all',
)

const columns = [
  { key: 'buildingName', label: 'Bino', width: '240px' },
  { key: 'floorName', label: 'Qavat', width: '160px' },
  { key: 'units', label: 'Unitlar', align: 'right' as const, numeric: true, width: '110px' },
  { key: 'plan', label: 'Reja holati', width: '190px' },
  { key: 'attrs', label: 'Atribut holati', width: '210px' },
  { key: 'updated', label: 'Oxirgi yangilanish', align: 'right' as const, width: '160px' },
]

function floorLink(row: QueueRow) {
  return `/content/floors?building=${row.buildingId}&floor=${row.floor}`
}

function setState(value: string) {
  fState.value = fState.value === value ? 'all' : value
}

function setBuilding(id: string) {
  fBuilding.value = fBuilding.value === id ? 'all' : id
}

function resetFilters() {
  query.value = ''
  fBuilding.value = 'all'
  fState.value = 'all'
}
</script>

<template>
  <AppTopbar
    title="Kontent navbati"
    subtitle="2D rejalar va unit atributlari to‘liqligi bo‘yicha ish navbati"
  >
    <template #actions>
      <UiButton variant="secondary" size="sm" to="/content/units">
        <UiIcon name="clipboard" :size="16" />
        Unit atributlari
      </UiButton>
      <UiButton size="sm" to="/content/floors">
        <UiIcon name="layers" :size="16" />
        Qavat rejalari
      </UiButton>
    </template>
  </AppTopbar>

  <main class="scroll-slim flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
    <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <button type="button" class="block w-full text-left" :aria-pressed="!dirty" @click="resetFilters">
        <UiKpi
          label="Jami qavatlar"
          :value="num(kpi.total)"
          unit="qavat"
          icon="layers"
          tone="brand"
        />
      </button>
      <button
        type="button"
        class="block w-full text-left"
        :aria-pressed="fState === 'all'"
        @click="fState = 'all'"
      >
        <UiKpi label="Reja chizilgan" :value="num(kpi.drawn)" unit="qavat" icon="check" tone="ok" />
      </button>
      <button
        type="button"
        class="block w-full text-left"
        :aria-pressed="fState === 'plan'"
        @click="setState('plan')"
      >
        <UiKpi
          label="Reja kutilmoqda"
          :value="num(kpi.pending)"
          unit="qavat"
          icon="clock"
          tone="warn"
        />
      </button>
      <button
        type="button"
        class="block w-full text-left"
        :aria-pressed="fState === 'attrs'"
        @click="setState('attrs')"
      >
        <UiKpi
          label="Atributi to‘liq emas"
          :value="num(kpi.attrs)"
          unit="qavat"
          icon="warning"
          tone="danger"
        />
      </button>
    </section>

    <UiCard
      title="Binolar bo‘yicha tayyorlik"
      subtitle="Kartani bosing: navbat shu bino bo‘yicha filtrlanadi"
    >
      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <button
          v-for="b in perBuilding"
          :key="b.id"
          type="button"
          class="rounded-field p-4 text-left ring-1 ring-inset transition-colors"
          :class="
            fBuilding === b.id ? 'bg-brand-50/70 ring-brand-300' : 'ring-ink-200 hover:bg-ink-50'
          "
          :aria-pressed="fBuilding === b.id"
          @click="setBuilding(b.id)"
        >
          <span class="flex items-center gap-2.5">
            <span class="grid size-9 shrink-0 place-items-center rounded-[9px] bg-brand-50 text-brand-600">
              <UiIcon name="building" :size="18" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-[14px] font-bold text-ink-900">{{ b.name }}</span>
              <span class="block truncate text-[12px] text-ink-500">{{ b.type }}</span>
            </span>
            <span class="tabular shrink-0 text-[13px] font-bold text-brand-600">
              {{ percent(b.ratio) }}
            </span>
          </span>

          <span class="mt-3 block h-1.5 w-full overflow-hidden rounded-pill bg-ink-100">
            <span class="block h-full rounded-pill bg-brand-500" :style="{ width: `${b.ratio}%` }" />
          </span>

          <span class="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-500">
            <span class="tabular">{{ b.drawn }} / {{ b.floors }} qavat rejasi</span>
            <span class="tabular">{{ num(b.units) }} unit kiritilgan</span>
          </span>
        </button>
      </div>
    </UiCard>

    <UiCard
      title="Ish navbati"
      subtitle="Qatorni bosing: qavat rejasi muharririda ochiladi"
      flush
      :padded="false"
    >
      <template #actions>
        <span class="tabular hidden text-[12px] text-ink-500 sm:inline">
          {{ filtered.length }} / {{ kpi.total }}
        </span>
      </template>

      <div class="flex flex-wrap items-center gap-3 px-4 pb-4 lg:px-5">
        <UiInput v-model="query" placeholder="Bino, qavat yoki unit kodi bo‘yicha qidirish" class="min-w-[200px] flex-1">
          <template #prefix>
            <UiIcon name="search" :size="17" />
          </template>
        </UiInput>

        <UiSelect v-model="fBuilding" :options="buildingOptions" class="w-full sm:w-52" />
        <UiSelect v-model="fState" :options="stateOptions" class="w-full sm:w-60" />

        <UiButton variant="ghost" :disabled="!dirty" @click="resetFilters">
          <UiIcon name="refresh" :size="15" />
          Tozalash
        </UiButton>
      </div>

      <UiTable
        :columns="columns"
        :rows="filtered"
        :to="floorLink"
        empty="Filtr shartlariga mos qavat topilmadi"
      >
        <template #cell-buildingName="{ row }">
          <span class="min-w-0">
            <span class="block truncate text-[14px] font-semibold text-brand-600">
              {{ row.buildingName }}
            </span>
            <span class="tabular block truncate text-[12px] text-ink-500">{{ row.buildingCode }}</span>
          </span>
        </template>

        <template #cell-floorName="{ row }">
          <span class="flex items-center gap-2 text-[13px] font-semibold text-ink-900">
            <UiIcon name="layers" :size="15" class="text-ink-400" />
            {{ row.floorName }}
          </span>
        </template>

        <template #cell-units="{ row }">
          <span class="tabular" :class="row.units ? 'text-ink-900' : 'text-ink-400'">
            {{ row.units }}
          </span>
        </template>

        <template #cell-plan="{ row }">
          <span
            class="inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-[12px] font-semibold ring-1 ring-inset"
            :class="
              row.planDone
                ? 'bg-ok-50 text-ok-700 ring-ok-100'
                : 'bg-warn-50 text-warn-700 ring-warn-100'
            "
          >
            <UiIcon :name="row.planDone ? 'check' : 'clock'" :size="13" />
            {{ row.planDone ? 'Reja chizilgan' : 'Reja kutilmoqda' }}
          </span>
        </template>

        <template #cell-attrs="{ row }">
          <span class="flex items-center gap-2">
            <span
              class="inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-[12px] font-semibold ring-1 ring-inset"
              :class="
                row.attrsDone
                  ? 'bg-ok-50 text-ok-700 ring-ok-100'
                  : 'bg-danger-50 text-danger-700 ring-danger-100'
              "
            >
              <UiIcon :name="row.attrsDone ? 'check' : 'warning'" :size="13" />
              {{ row.attrsDone ? 'To‘liq' : 'To‘liq emas' }}
            </span>
            <span v-if="row.units" class="tabular text-[12px] text-ink-500">
              {{ row.withAttrs }} / {{ row.units }}
            </span>
          </span>
        </template>

        <template #cell-updated="{ row }">
          <span v-if="row.updated" class="tabular text-[13px] text-ink-600">
            {{ dateShort(row.updated) }}
          </span>
          <span v-else class="text-[13px] text-ink-400">Kiritilmagan</span>
        </template>
      </UiTable>

      <div
        class="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 px-4 py-4 lg:px-5"
      >
        <p class="text-[13px] text-ink-500">
          Navbatda: <b class="text-ink-800">{{ filtered.length }}</b> ta qavat ·
          <span class="tabular text-ok-600">{{ kpi.drawn }}</span> reja tayyor ·
          <span class="tabular text-warn-600">{{ kpi.pending }}</span> reja kutilmoqda
        </p>
        <UiButton variant="secondary" size="sm" to="/content/floors">
          <UiIcon name="edit" :size="15" />
          Muharrirni ochish
        </UiButton>
      </div>
    </UiCard>
  </main>
</template>
