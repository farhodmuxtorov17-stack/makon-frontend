<script setup lang="ts">
import { STRUCTURE_KIND, type Structure } from '~/data/structures'
import { area, num } from '~/utils/format'

/**
 * Tanlangan qurilma kartasi: turi, o‘lchami, qavatlari va izohi.
 * Hech narsa tanlanmagan bo‘lsa, foydalanuvchiga keyingi qadam ko‘rsatiladi.
 */
const props = defineProps<{ structure?: Structure }>()

const { t } = useI18n()

const meta = computed(() => (props.structure ? STRUCTURE_KIND[props.structure.kind] : null))

const TONE_CHIP: Record<string, string> = {
  brand: 'bg-brand-50 text-brand-700 ring-brand-200',
  ok: 'bg-ok-50 text-ok-800 ring-ok-100',
  warn: 'bg-warn-50 text-warn-800 ring-warn-100',
  violet: 'bg-info-50 text-info-700 ring-info-100',
  neutral: 'bg-ink-100 text-ink-700 ring-ink-200',
}

const TONE_ICON: Record<string, string> = {
  brand: 'bg-brand-500 text-white',
  ok: 'bg-ok-600 text-white',
  warn: 'bg-warn-600 text-white',
  violet: 'bg-info-600 text-white',
  neutral: 'bg-ink-500 text-white',
}

interface DetailRow {
  label: string
  value: string
}

const rows = computed<DetailRow[]>(() => {
  const s = props.structure
  if (!s) return []
  const out: DetailRow[] = [
    { label: t('ui.plotDimensions'), value: `${num(s.width, 1)} × ${num(s.depth, 1)} m` },
    { label: t('ui.builtArea'), value: area(s.width * s.depth) },
  ]

  if (s.floors > 0 || s.undergroundFloors > 0) {
    out.push({
      label: t('ui.floorsRow'),
      value: s.undergroundFloors
        ? t('ui.floorsSplit', { above: s.floors, below: s.undergroundFloors })
        : t('ui.countPcs', { count: s.floors }),
    })
  }
  if (s.height >= 1) out.push({ label: t('ui.height'), value: `${num(s.height, 1)} m` })
  if (s.gla > 0) out.push({ label: t('ui.glaRow'), value: area(s.gla) })
  if (s.parkingSpaces) {
    out.push({ label: t('ui.parkingSpaces'), value: t('ui.countPcs', { count: num(s.parkingSpaces) }) })
  }

  return out
})
</script>

<template>
  <div
    v-if="structure && meta"
    class="rounded-field bg-surface-sunken p-4 ring-1 ring-inset ring-ink-200"
  >
    <div class="flex items-start gap-3">
      <span
        class="grid size-10 shrink-0 place-items-center rounded-[10px]"
        :class="TONE_ICON[meta.tone]"
      >
        <UiIcon :name="meta.icon" :size="19" />
      </span>
      <div class="min-w-0 flex-1">
        <p class="text-[14px] font-bold leading-snug text-ink-900">{{ structure.name }}</p>
        <div class="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span
            class="inline-flex rounded-pill px-2.5 py-0.5 text-[12px] font-semibold ring-1 ring-inset"
            :class="TONE_CHIP[meta.tone]"
          >
            {{ meta.label }}
          </span>
          <span
            class="inline-flex items-center gap-1 rounded-pill px-2.5 py-0.5 text-[12px] font-semibold ring-1 ring-inset"
            :class="
              meta.leasable
                ? 'bg-ok-50 text-ok-800 ring-ok-100'
                : 'bg-ink-100 text-ink-600 ring-ink-200'
            "
          >
            <UiIcon :name="meta.leasable ? 'wallet' : 'wrench'" :size="13" />
            {{ meta.leasable ? t('ui.leasable') : t('ui.serviceStructure') }}
          </span>
        </div>
      </div>
    </div>

    <dl class="mt-3.5 divide-y divide-ink-200">
      <div v-for="r in rows" :key="r.label" class="flex items-baseline gap-3 py-2">
        <dt class="w-[140px] shrink-0 text-[12px] text-ink-500">{{ r.label }}</dt>
        <dd class="tabular min-w-0 flex-1 text-[13px] font-semibold text-ink-900">{{ r.value }}</dd>
      </div>
    </dl>

    <p class="mt-2 text-[13px] leading-snug text-ink-600">{{ structure.note }}</p>
  </div>

  <div v-else class="rounded-field bg-surface-sunken p-4 ring-1 ring-inset ring-ink-200">
    <div class="flex items-start gap-3">
      <span class="grid size-10 shrink-0 place-items-center rounded-[10px] bg-ink-100 text-ink-400">
        <UiIcon name="target" :size="19" />
      </span>
      <div class="min-w-0">
        <p class="text-[14px] font-semibold text-ink-900">{{ t('ui.pickStructure') }}</p>
        <p class="mt-1 text-[13px] leading-snug text-ink-500">
          {{ t('ui.pickStructureHint') }}
        </p>
      </div>
    </div>
  </div>
</template>
