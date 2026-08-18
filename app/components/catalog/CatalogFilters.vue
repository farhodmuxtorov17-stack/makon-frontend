<script setup lang="ts">
/**
 * Katalog qidiruvining filtr paneli. Bitta nusxa keng ekranda chap ustunda,
 * tor ekranda esa ochiladigan panelda ko‘rsatiladi.
 */
export interface CatalogTypeOption {
  value: string
  label: string
  count: number
}

export interface CatalogChip {
  key: string
  label: string
}

defineProps<{
  heading: string
  summary: string
  chips: CatalogChip[]
  types: CatalogTypeOption[]
  sortOptions: Array<{ value: string; label: string }>
  distanceOptions: Array<{ value: string; label: string }>
  activeCount: number
}>()

const emit = defineEmits<{ reset: []; clearChip: [key: string] }>()

const q = defineModel<string>('q', { required: true })
const sort = defineModel<string>('sort', { required: true })
const priceMin = defineModel<string>('priceMin', { required: true })
const priceMax = defineModel<string>('priceMax', { required: true })
const selected = defineModel<string[]>('selected', { required: true })
const areaMin = defineModel<string>('areaMin', { required: true })
const areaMax = defineModel<string>('areaMax', { required: true })
const distance = defineModel<string>('distance', { required: true })

function toggleType(value: string) {
  selected.value = selected.value.includes(value)
    ? selected.value.filter((v) => v !== value)
    : [...selected.value, value]
}
</script>

<template>
  <div class="space-y-5">
    <div>
      <h2 class="text-[17px] font-bold leading-tight text-ink-900">{{ heading }}</h2>
      <p class="mt-1 text-[12px] leading-relaxed text-ink-500">{{ summary }}</p>

      <div v-if="chips.length" class="mt-2.5 flex flex-wrap gap-1.5">
        <span
          v-for="c in chips"
          :key="c.key"
          class="inline-flex max-w-full items-center gap-1 rounded-pill bg-brand-50 py-1 pl-2.5 pr-1 text-[11.5px] font-semibold text-brand-700"
        >
          <span class="truncate">{{ c.label }}</span>
          <button
            type="button"
            class="grid size-5 shrink-0 place-items-center rounded-full text-brand-600 transition-colors duration-150 hover:bg-brand-100 hover:text-brand-800"
            :aria-label="`${c.label} shartini olib tashlash`"
            @click="emit('clearChip', c.key)"
          >
            <UiIcon name="x" :size="11" />
          </button>
        </span>
      </div>
    </div>

    <UiInput v-model="q" placeholder="Nom bo‘yicha…" aria-label="Nom bo‘yicha qidirish">
      <template #prefix>
        <UiIcon name="search" :size="17" />
      </template>
    </UiInput>

    <section>
      <p class="text-[11px] font-bold uppercase tracking-wide text-ink-400">Saralash</p>
      <UiSelect
        v-model="sort"
        :options="sortOptions"
        size="sm"
        class="mt-2"
        aria-label="Natijalarni saralash"
      />
    </section>

    <section>
      <p class="text-[11px] font-bold uppercase tracking-wide text-ink-400">Narx (so‘m / oy)</p>
      <div class="mt-2 grid grid-cols-2 gap-2">
        <label class="block min-w-0">
          <span class="mb-1 block text-[11px] font-medium text-ink-500">Min</span>
          <UiInput
            v-model="priceMin"
            type="number"
            inputmode="numeric"
            min="0"
            step="500000"
            placeholder="0"
          />
        </label>
        <label class="block min-w-0">
          <span class="mb-1 block text-[11px] font-medium text-ink-500">Maks</span>
          <UiInput
            v-model="priceMax"
            type="number"
            inputmode="numeric"
            min="0"
            step="500000"
            placeholder="Cheksiz"
          />
        </label>
      </div>
    </section>

    <section>
      <p class="text-[11px] font-bold uppercase tracking-wide text-ink-400">Mulk turi</p>
      <ul class="mt-1.5 -mx-2">
        <li v-for="t in types" :key="t.value">
          <label
            class="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-field px-2 transition-colors duration-150 hover:bg-ink-100"
          >
            <input
              type="checkbox"
              class="size-4 shrink-0 cursor-pointer accent-brand-500"
              :checked="selected.includes(t.value)"
              :aria-label="`${t.label}, ${t.count} ta variant`"
              @change="toggleType(t.value)"
            />
            <span class="min-w-0 flex-1 truncate text-[13px] font-medium text-ink-700">
              {{ t.label }}
            </span>
            <span class="tabular shrink-0 text-[12px] font-semibold text-ink-400">
              {{ t.count }}
            </span>
          </label>
        </li>
      </ul>
    </section>

    <section>
      <p class="text-[11px] font-bold uppercase tracking-wide text-ink-400">Maydon (m²)</p>
      <div class="mt-2 grid grid-cols-2 gap-2">
        <label class="block min-w-0">
          <span class="mb-1 block text-[11px] font-medium text-ink-500">Min</span>
          <UiInput
            v-model="areaMin"
            type="number"
            inputmode="numeric"
            min="0"
            step="10"
            placeholder="0"
          />
        </label>
        <label class="block min-w-0">
          <span class="mb-1 block text-[11px] font-medium text-ink-500">Maks</span>
          <UiInput
            v-model="areaMax"
            type="number"
            inputmode="numeric"
            min="0"
            step="10"
            placeholder="Cheksiz"
          />
        </label>
      </div>
    </section>

    <section>
      <p class="text-[11px] font-bold uppercase tracking-wide text-ink-400">Markazdan masofa</p>
      <UiSelect
        v-model="distance"
        :options="distanceOptions"
        size="sm"
        class="mt-2"
        aria-label="Shahar markazidan masofa"
      />
    </section>

    <UiButton v-if="activeCount > 0" variant="subtle" size="sm" block @click="emit('reset')">
      <UiIcon name="refresh" :size="16" />
      Filtrlarni tozalash
    </UiButton>
  </div>
</template>
