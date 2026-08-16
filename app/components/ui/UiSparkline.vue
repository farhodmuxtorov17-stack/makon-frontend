<script setup lang="ts">
/**
 * Ixcham dinamika chizig‘i, gradient to‘ldirish bilan, karta pastki qirrasiga
 * tegib turadigan qilib joylashtirish uchun mo‘ljallangan.
 */
export type ChartTone =
  | 'brand'
  | 'ok'
  | 'warn'
  | 'danger'
  | 'violet'
  | 'info'
  | 'teal'
  | 'neutral'

const props = withDefaults(
  defineProps<{
    values: number[]
    tone?: ChartTone
    /** To‘ldirishsiz: faqat chiziq */
    bare?: boolean
    /** Ekran o‘qigich uchun izoh */
    label?: string
  }>(),
  { tone: 'brand' },
)

const BASE: Record<ChartTone, string> = {
  brand: '#0256f7',
  ok: '#16b99a',
  warn: '#faa53f',
  danger: '#f84448',
  violet: '#916cec',
  info: '#916cec',
  teal: '#16b99a',
  neutral: '#94a2b8',
}

function rgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function mix(hex: string, to: [number, number, number], t: number): string {
  const c = rgb(hex)
  const at = (i: 0 | 1 | 2) => Math.round(c[i] + (to[i] - c[i]) * t)
  return `rgb(${at(0)} ${at(1)} ${at(2)})`
}

const tint = (hex: string, t: number) => mix(hex, [255, 255, 255], t)
const shade = (hex: string, t: number) => mix(hex, [12, 22, 40], t)

const uid = useId()
const color = computed(() => BASE[props.tone] ?? BASE.brand)

const H = 40
const TOP = 8
const BOTTOM = 34

const points = computed(() => {
  const pts = props.values.filter((v) => Number.isFinite(v))
  if (pts.length < 2) return []
  const min = Math.min(...pts)
  const max = Math.max(...pts)
  const span = max - min || 1
  const step = 100 / (pts.length - 1)
  return pts.map((v, i) => [i * step, BOTTOM - ((v - min) / span) * (BOTTOM - TOP)] as const)
})

const linePath = computed(() =>
  points.value
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(2)} ${p[1].toFixed(2)}`)
    .join(' '),
)

const areaPath = computed(() => {
  const pts = points.value
  const first = pts[0]
  const last = pts[pts.length - 1]
  if (!first || !last) return ''
  return `${linePath.value} L${last[0].toFixed(2)} ${H} L${first[0].toFixed(2)} ${H} Z`
})

const shown = ref(false)

onMounted(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    shown.value = true
    return
  }
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      shown.value = true
    }),
  )
})

const summary = computed(() => {
  if (props.label) return props.label
  const pts = props.values.filter((v) => Number.isFinite(v))
  const first = pts[0]
  const last = pts[pts.length - 1]
  if (first === undefined || last === undefined) return 'Dinamika mavjud emas'
  return `Dinamika: ${num(first, first % 1 ? 1 : 0)} dan ${num(last, last % 1 ? 1 : 0)} gacha`
})
</script>

<template>
  <svg
    :viewBox="`0 0 100 ${H}`"
    preserveAspectRatio="none"
    role="img"
    :aria-label="summary"
  >
    <defs>
      <linearGradient :id="`${uid}-a`" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" :stop-color="color" stop-opacity="0.32" />
        <stop offset="0.7" :stop-color="color" stop-opacity="0.08" />
        <stop offset="1" :stop-color="color" stop-opacity="0" />
      </linearGradient>
      <linearGradient :id="`${uid}-s`" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" :stop-color="tint(color, 0.28)" />
        <stop offset="1" :stop-color="shade(color, 0.08)" />
      </linearGradient>
    </defs>

    <g
      class="transition-[transform,opacity] duration-500 ease-out"
      :style="{ transform: shown ? 'none' : 'translateY(7px)', opacity: shown ? 1 : 0 }"
    >
      <path v-if="!bare && areaPath" :d="areaPath" :fill="`url(#${uid}-a)`" />
      <path
        v-if="linePath"
        :d="linePath"
        fill="none"
        :stroke="`url(#${uid}-s)`"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        vector-effect="non-scaling-stroke"
      />
    </g>
  </svg>
</template>
