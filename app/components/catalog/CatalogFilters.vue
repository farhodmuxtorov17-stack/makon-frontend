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
  usageOptions: Array<{ value: string; label: string }>
  /** Ijara narxi so‘m/oy da o‘lchanadi, «Sotuv» tabida bu oraliq ko‘rsatilmaydi */
  showRentPrice: boolean
  /** Sotuv narxi so‘m/m² da o‘lchanadi, «Ijaraga» tabida ko‘rsatilmaydi */
  showSalePrice: boolean
  activeCount: number
}>()

const emit = defineEmits<{ reset: []; clearChip: [key: string] }>()

const { t } = useI18n()

const q = defineModel<string>('q', { required: true })
const sort = defineModel<string>('sort', { required: true })
// Narx va maydon maydonlari raqamli, shuning uchun bo‘sh bo‘lmaganda son keladi.
// Ijara va sotuv oraliqlari alohida: biri so‘m/oy, ikkinchisi so‘m/m² shkalasida,
// shuning uchun bitta maydonda solishtirib bo‘lmaydi.
const rentMin = defineModel<string | number>('rentMin', { required: true })
const rentMax = defineModel<string | number>('rentMax', { required: true })
const saleMin = defineModel<string | number>('saleMin', { required: true })
const saleMax = defineModel<string | number>('saleMax', { required: true })
const selected = defineModel<string[]>('selected', { required: true })
const areaMin = defineModel<string | number>('areaMin', { required: true })
const areaMax = defineModel<string | number>('areaMax', { required: true })
const distance = defineModel<string>('distance', { required: true })
// Maqsad bino turidan alohida: biznes markazda ham ombor xonasi bo‘lishi mumkin
const usage = defineModel<string>('usage', { required: true })

function toggleType(value: string) {
  selected.value = selected.value.includes(value)
    ? selected.value.filter((v) => v !== value)
    : [...selected.value, value]
}
</script>

<template>
  <div class="space-y-5">
    <div>
      <h2 class="text-[18px] font-bold leading-tight text-ink-900">{{ heading }}</h2>
      <p class="mt-1 text-[12px] leading-relaxed text-ink-500">{{ summary }}</p>

      <div v-if="chips.length" class="mt-2.5 flex flex-wrap gap-1.5">
        <span
          v-for="c in chips"
          :key="c.key"
          class="inline-flex max-w-full items-center gap-1 rounded-pill bg-brand-50 py-1 pl-2.5 pr-1 text-[12px] font-semibold text-brand-700"
        >
          <span class="truncate">{{ c.label }}</span>
          <button
            type="button"
            class="relative grid size-5 shrink-0 place-items-center rounded-full text-brand-600 transition-colors duration-150 after:absolute after:-inset-3 after:content-[''] hover:bg-brand-100 hover:text-brand-800 md:after:hidden"
            :aria-label="t('cat.removeChip', { label: c.label })"
            @click="emit('clearChip', c.key)"
          >
            <UiIcon name="x" :size="12" />
          </button>
        </span>
      </div>
    </div>

    <UiInput
      v-model="q"
      :placeholder="t('cat.namePlaceholder')"
      :aria-label="t('cat.nameSearchAria')"
    >
      <template #prefix>
        <UiIcon name="search" :size="16" />
      </template>
    </UiInput>

    <section>
      <p class="text-[11px] font-bold uppercase tracking-wide text-ink-500">{{ t('sort.title') }}</p>
      <UiSelect
        v-model="sort"
        :options="sortOptions"
        size="sm"
        class="mt-2"
        :aria-label="t('cat.sortAria')"
      />
    </section>

    <section v-if="showRentPrice">
      <p class="text-[11px] font-bold uppercase tracking-wide text-ink-500">
        {{ t('cat.rentPriceTitle') }}
      </p>
      <div class="mt-2 grid grid-cols-2 gap-2">
        <label class="block min-w-0">
          <span class="mb-1 block text-[11px] font-medium text-ink-500">{{ t('common.min') }}</span>
          <UiInput
            v-model="rentMin"
            type="number"
            inputmode="numeric"
            min="0"
            step="500000"
            placeholder="0"
            :aria-label="t('cat.rentMinAria')"
          />
        </label>
        <label class="block min-w-0">
          <span class="mb-1 block text-[11px] font-medium text-ink-500">{{ t('common.max') }}</span>
          <UiInput
            v-model="rentMax"
            type="number"
            inputmode="numeric"
            min="0"
            step="500000"
            :placeholder="t('common.unlimited')"
            :aria-label="t('cat.rentMaxAria')"
          />
        </label>
      </div>
    </section>

    <section v-if="showSalePrice">
      <p class="text-[11px] font-bold uppercase tracking-wide text-ink-500">
        {{ t('cat.salePriceTitle') }}
      </p>
      <div class="mt-2 grid grid-cols-2 gap-2">
        <label class="block min-w-0">
          <span class="mb-1 block text-[11px] font-medium text-ink-500">{{ t('common.min') }}</span>
          <UiInput
            v-model="saleMin"
            type="number"
            inputmode="numeric"
            min="0"
            step="100000"
            placeholder="0"
            :aria-label="t('cat.saleMinAria')"
          />
        </label>
        <label class="block min-w-0">
          <span class="mb-1 block text-[11px] font-medium text-ink-500">{{ t('common.max') }}</span>
          <UiInput
            v-model="saleMax"
            type="number"
            inputmode="numeric"
            min="0"
            step="100000"
            :placeholder="t('common.unlimited')"
            :aria-label="t('cat.saleMaxAria')"
          />
        </label>
      </div>
    </section>

    <section>
      <p class="text-[11px] font-bold uppercase tracking-wide text-ink-500">
        {{ t('field.buildingType') }}
      </p>
      <ul class="mt-1.5 -mx-2">
        <li v-for="opt in types" :key="opt.value">
          <label
            class="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-field px-2 transition-colors duration-150 hover:bg-ink-100"
          >
            <input
              type="checkbox"
              class="size-4 shrink-0 cursor-pointer accent-brand-500"
              :checked="selected.includes(opt.value)"
              :aria-label="t('cat.typeOptionAria', { label: opt.label, count: opt.count })"
              @change="toggleType(opt.value)"
            />
            <span class="min-w-0 flex-1 truncate text-[13px] font-medium text-ink-700">
              {{ opt.label }}
            </span>
            <span class="tabular shrink-0 text-[12px] font-semibold text-ink-500">
              {{ opt.count }}
            </span>
          </label>
        </li>
      </ul>
    </section>

    <section>
      <p class="text-[11px] font-bold uppercase tracking-wide text-ink-500">
        {{ t('cat.areaTitle') }}
      </p>
      <div class="mt-2 grid grid-cols-2 gap-2">
        <label class="block min-w-0">
          <span class="mb-1 block text-[11px] font-medium text-ink-500">{{ t('common.min') }}</span>
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
          <span class="mb-1 block text-[11px] font-medium text-ink-500">{{ t('common.max') }}</span>
          <UiInput
            v-model="areaMax"
            type="number"
            inputmode="numeric"
            min="0"
            step="10"
            :placeholder="t('common.unlimited')"
          />
        </label>
      </div>
    </section>

    <section>
      <p class="text-[11px] font-bold uppercase tracking-wide text-ink-500">
        {{ t('cat.usageTitle') }}
      </p>
      <UiSelect
        v-model="usage"
        :options="usageOptions"
        size="sm"
        class="mt-2"
        :aria-label="t('cat.usageAria')"
      />
    </section>

    <section>
      <p class="text-[11px] font-bold uppercase tracking-wide text-ink-500">
        {{ t('cat.distanceTitle') }}
      </p>
      <UiSelect
        v-model="distance"
        :options="distanceOptions"
        size="sm"
        class="mt-2"
        :aria-label="t('cat.distanceAria')"
      />
    </section>

    <UiButton v-if="activeCount > 0" variant="subtle" size="sm" block @click="emit('reset')">
      <UiIcon name="refresh" :size="16" />
      {{ t('filter.reset') }}
    </UiButton>
  </div>
</template>
