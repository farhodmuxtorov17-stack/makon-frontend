<script setup lang="ts">
export interface BarSeries {
  label: string
  tone: 'brand' | 'ok' | 'warn' | 'danger' | 'violet'
  values: number[]
}

const props = withDefaults(
  defineProps<{
    labels: string[]
    series: BarSeries[]
    /** Ustunlarni bir-birining ustiga qo‘yish */
    stacked?: boolean
    height?: number
    /** Qiymat izohi (masalan "mln so‘m") */
    unit?: string
  }>(),
  { height: 200 },
)

const FILL: Record<BarSeries['tone'], string> = {
  brand: '#0256F7',
  ok: '#16B99A',
  warn: '#FAA53F',
  danger: '#F84448',
  violet: '#916CEC',
}

const max = computed(() => {
  if (props.stacked) {
    return Math.max(
      ...props.labels.map((_, i) => props.series.reduce((s, x) => s + (x.values[i] ?? 0), 0)),
    )
  }
  return Math.max(...props.series.flatMap((s) => s.values))
})

function pct(v: number) {
  return (v / (max.value || 1)) * 100
}
</script>

<template>
  <div>
    <div class="flex items-end gap-3" :style="{ height: `${height}px` }">
      <div v-for="(label, i) in labels" :key="label" class="flex h-full min-w-0 flex-1 flex-col">
        <div class="flex flex-1 items-end justify-center gap-1">
          <!-- To‘plangan ustun -->
          <div
            v-if="stacked"
            class="flex w-full max-w-[38px] flex-col-reverse overflow-hidden rounded-t-[6px]"
          >
            <div
              v-for="s in series"
              :key="s.label"
              :style="{ height: `${pct(s.values[i] ?? 0)}%`, background: FILL[s.tone] }"
              :title="`${s.label}: ${s.values[i]}`"
            />
          </div>

          <!-- Yonma-yon ustunlar -->
          <template v-else>
            <div
              v-for="s in series"
              :key="s.label"
              class="w-full max-w-[18px] rounded-t-[5px] transition-all"
              :style="{ height: `${pct(s.values[i] ?? 0)}%`, background: FILL[s.tone] }"
              :title="`${s.label}: ${s.values[i]}`"
            />
          </template>
        </div>

        <span class="mt-2 truncate text-center text-[11.5px] text-ink-500">{{ label }}</span>
      </div>
    </div>

    <ul class="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
      <li v-for="s in series" :key="s.label" class="flex items-center gap-2 text-[12.5px]">
        <span class="size-2.5 rounded-[3px]" :style="{ background: FILL[s.tone] }" />
        <span class="text-ink-600">{{ s.label }}</span>
      </li>
      <li v-if="unit" class="text-[12px] text-ink-400">{{ unit }}</li>
    </ul>
  </div>
</template>
