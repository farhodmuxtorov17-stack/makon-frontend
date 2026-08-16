<script setup lang="ts">
export interface LineSeries {
  label: string
  tone: 'brand' | 'ok' | 'warn' | 'danger' | 'violet'
  values: number[]
  /** Chiziq ostini bo‘yash */
  fill?: boolean
}

const props = withDefaults(
  defineProps<{
    labels: string[]
    series: LineSeries[]
    height?: number
  }>(),
  { height: 200 },
)

const COLOR: Record<LineSeries['tone'], string> = {
  brand: '#0256F7',
  ok: '#16B99A',
  warn: '#FAA53F',
  danger: '#F84448',
  violet: '#916CEC',
}

const W = 100
const H = 40

const bounds = computed(() => {
  const all = props.series.flatMap((s) => s.values)
  const min = Math.min(...all, 0)
  const max = Math.max(...all)
  return { min, span: max - min || 1 }
})

function points(values: number[]) {
  const { min, span } = bounds.value
  const step = W / Math.max(values.length - 1, 1)
  return values.map((v, i) => [i * step, H - ((v - min) / span) * (H - 4) - 2] as const)
}

function linePath(values: number[]) {
  return points(values)
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(2)} ${p[1].toFixed(2)}`)
    .join(' ')
}

function areaPath(values: number[]) {
  const pts = points(values)
  const last = pts[pts.length - 1]
  if (!last) return ''
  return `${linePath(values)} L${last[0].toFixed(2)} ${H} L0 ${H} Z`
}
</script>

<template>
  <div>
    <div class="relative" :style="{ height: `${height}px` }">
      <!-- To‘r chiziqlari -->
      <div class="absolute inset-0 flex flex-col justify-between">
        <span v-for="n in 5" :key="n" class="border-t border-ink-100" />
      </div>

      <svg
        :viewBox="`0 0 ${W} ${H}`"
        preserveAspectRatio="none"
        class="relative size-full"
        aria-hidden="true"
      >
        <defs>
          <linearGradient v-for="s in series" :id="`ln-${s.label}`" :key="s.label" x1="0" y1="0" x2="0" y2="1">
            <stop :stop-color="COLOR[s.tone]" stop-opacity=".22" />
            <stop offset="1" :stop-color="COLOR[s.tone]" stop-opacity="0" />
          </linearGradient>
        </defs>

        <template v-for="s in series" :key="s.label">
          <path v-if="s.fill" :d="areaPath(s.values)" :fill="`url(#ln-${s.label})`" />
          <path
            :d="linePath(s.values)"
            fill="none"
            :stroke="COLOR[s.tone]"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            vector-effect="non-scaling-stroke"
          />
        </template>
      </svg>
    </div>

    <div class="mt-2 flex justify-between">
      <span v-for="l in labels" :key="l" class="text-[11.5px] text-ink-500">{{ l }}</span>
    </div>

    <ul class="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
      <li v-for="s in series" :key="s.label" class="flex items-center gap-2 text-[12.5px]">
        <span class="h-0.5 w-4 rounded-full" :style="{ background: COLOR[s.tone] }" />
        <span class="text-ink-600">{{ s.label }}</span>
      </li>
    </ul>
  </div>
</template>
