<script setup lang="ts">
import { siteSummary, sitePlotOf, structuresOf } from '~/data/structures'
import { num } from '~/utils/format'

/**
 * «Uchastka tarkibi» bo‘limi: reja va qurilmalar ro‘yxati bitta tanlov
 * holatini bo‘lishadi. Rejadagi shakl bosilsa ro‘yxatdagi qator ham
 * ajraladi va aksincha.
 */
const props = defineProps<{ buildingId: string }>()

const { t } = useI18n()

const structures = computed(() => structuresOf(props.buildingId))
const plot = computed(() => sitePlotOf(props.buildingId))
const summary = computed(() => siteSummary(props.buildingId))

const selected = ref('')

// Boshqa obyektga o‘tilganda tanlov saqlanib qolmaydi
watch(() => props.buildingId, () => {
  selected.value = ''
})

const active = computed(() => structures.value.find((s) => s.id === selected.value))

/**
 * Uchastka maydoni: 100 m² bir sotixga teng. Ko'paytma chizmadagi yaxlit
 * o'lcham chiziqlaridan olinadi, shunda karta va reja bir xil raqamni beradi.
 */
const plotArea = computed(() => Math.round(plot.value.width) * Math.round(plot.value.depth))

const stats = computed(() => [
  {
    key: 'total',
    label: t('ui.totalStructures'),
    value: num(summary.value.structures),
    hint: t('ui.onPlot', {
      width: num(plot.value.width, 0),
      depth: num(plot.value.depth, 0),
    }),
    icon: 'grid',
    tone: 'bg-brand-50 text-brand-600',
  },
  {
    key: 'leasable',
    label: t('ui.leasable'),
    value: num(summary.value.leasable),
    hint: t('ui.glaHint', { value: num(summary.value.gla) }),
    icon: 'wallet',
    tone: 'bg-ok-50 text-ok-700',
  },
  {
    key: 'service',
    label: t('ui.serviceStructure'),
    value: num(summary.value.service),
    hint: t('ui.serviceHint'),
    icon: 'wrench',
    tone: 'bg-ink-100 text-ink-600',
  },
  {
    key: 'parking',
    label: t('ui.parkingSpace'),
    value: num(summary.value.parkingSpaces),
    hint: t('ui.aboveBelowGround'),
    icon: 'cube',
    tone: 'bg-info-50 text-info-600',
  },
  {
    key: 'plot',
    label: t('ui.plotArea'),
    value: num(plotArea.value),
    hint: t('ui.sotix', { value: num(plotArea.value / 100, 1) }),
    icon: 'location',
    tone: 'bg-warn-50 text-warn-800',
  },
])
</script>

<template>
  <UiCard
    :title="t('ui.siteComposition')"
    :subtitle="t('ui.siteCompositionSub', { count: summary.structures })"
    icon="grid"
  >
    <template #actions>
      <span
        class="tabular hidden items-center gap-2 rounded-pill bg-ink-100 px-3 py-1.5 text-[12px] font-semibold text-ink-700 sm:inline-flex"
      >
        <UiIcon name="layers" :size="15" />
        {{ num(plot.width, 0) }} × {{ num(plot.depth, 0) }} m
      </span>
    </template>

    <div class="grid gap-2.5 sm:grid-cols-3 xl:grid-cols-5">
      <div
        v-for="s in stats"
        :key="s.key"
        class="rounded-field p-3 ring-1 ring-inset ring-ink-200"
      >
        <div class="flex items-center gap-2">
          <span class="grid size-8 shrink-0 place-items-center rounded-[8px]" :class="s.tone">
            <UiIcon :name="s.icon" :size="16" />
          </span>
          <span class="min-w-0 text-[12px] font-medium text-ink-500">{{ s.label }}</span>
        </div>
        <p class="tabular mt-2 text-[22px] font-bold leading-none text-ink-900">{{ s.value }}</p>
        <p class="mt-1.5 truncate text-[12px] text-ink-500">{{ s.hint }}</p>
      </div>
    </div>

    <div class="mt-5 grid gap-5 xl:grid-cols-5">
      <div class="min-w-0 xl:col-span-3">
        <div class="rounded-field p-3 ring-1 ring-inset ring-ink-200">
          <div class="mb-2 flex items-center justify-between gap-3">
            <p class="text-[13px] font-bold text-ink-900">{{ t('ui.sitePlan') }}</p>
            <p class="text-[12px] text-ink-500">{{ t('ui.clickShape') }}</p>
          </div>
          <SitePlan v-model:selected="selected" :structures="structures" :plot="plot" />
        </div>
      </div>

      <div class="min-w-0 space-y-4 xl:col-span-2">
        <SiteStructureDetail :structure="active" />
        <SiteStructureList v-model:selected="selected" :structures="structures" />
      </div>
    </div>
  </UiCard>
</template>
