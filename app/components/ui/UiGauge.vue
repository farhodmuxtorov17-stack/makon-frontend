<script setup lang="ts">
/**
 * Radial ko‘rsatkich — gradientli yoy, orqasida yo‘lak, markazida foiz.
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
    value: number
    /** Yuqori chegara (odatda 100) */
    max?: number
    /** Piksel o‘lchami */
    size?: number
    tone?: ChartTone
    /** Markazdagi qiymat yonidagi birlik */
    unit?: string
    /** Yoy ostidagi qisqa izoh */
    caption?: string
    /** Ekran o‘qigich uchun izoh */
    label?: string
    /** Yoy qalinligi (100×100 maydon birligida) */
    thickness?: number
  }>(),
  { max: 100, size: 96, tone: 'brand', unit: '%', thickness: 9 },
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

/** 270° yoy: 135° dan 405° gacha */
const R = 38
const START = { x: 50 + R * Math.cos((135 * Math.PI) / 180), y: 50 + R * Math.sin((135 * Math.PI) / 180) }
const END = { x: 50 + R * Math.cos((45 * Math.PI) / 180), y: 50 + R * Math.sin((45 * Math.PI) / 180) }
const ARC = `M${START.x.toFixed(2)} ${START.y.toFixed(2)} A${R} ${R} 0 1 1 ${END.x.toFixed(2)} ${END.y.toFixed(2)}`

const ratio = computed(() => {
  const top = props.max || 100
  return Math.min(Math.max(props.value / top, 0), 1)
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

const text = computed(() => num(props.value, props.value % 1 ? 1 : 0))
const summary = computed(
  () => `${props.label ?? props.caption ?? 'Ko‘rsatkich'}: ${text.value}${props.unit ?? ''}`,
)
</script>

<template>
  <div class="relative shrink-0" :style="{ width: `${size}px`, height: `${size}px` }">
    <svg viewBox="0 0 100 100" class="size-full" role="img" :aria-label="summary">
      <defs>
        <linearGradient :id="`${uid}-g`" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" :stop-color="shade(color, 0.14)" />
          <stop offset="0.55" :stop-color="color" />
          <stop offset="1" :stop-color="tint(color, 0.34)" />
        </linearGradient>

        <filter
          :id="`${uid}-lift`"
          filterUnits="userSpaceOnUse"
          x="0"
          y="0"
          width="100"
          height="100"
        >
          <feDropShadow dx="0" dy="1.5" stdDeviation="1.6" flood-color="#131c2b" flood-opacity="0.2" />
        </filter>
      </defs>

      <path
        :d="ARC"
        fill="none"
        stroke="#eef2f8"
        :stroke-width="thickness"
        stroke-linecap="round"
      />

      <path
        :d="ARC"
        fill="none"
        :stroke="`url(#${uid}-g)`"
        :stroke-width="thickness"
        stroke-linecap="round"
        pathLength="1"
        stroke-dasharray="1"
        :stroke-dashoffset="shown ? 1 - ratio : 1"
        :filter="`url(#${uid}-lift)`"
        class="transition-[stroke-dashoffset] duration-500 ease-out"
      />
    </svg>

    <div class="pointer-events-none absolute inset-0 grid place-content-center place-items-center text-center">
      <p class="flex items-baseline justify-center gap-0.5">
        <span class="tabular text-[19px] font-bold leading-none text-ink-900">{{ text }}</span>
        <span v-if="unit" class="text-[11px] font-semibold text-ink-500">{{ unit }}</span>
      </p>
      <span v-if="caption" class="mt-1 line-clamp-2 max-w-[5.5rem] text-[10.5px] leading-tight text-ink-500">
        {{ caption }}
      </span>
    </div>
  </div>
</template>
