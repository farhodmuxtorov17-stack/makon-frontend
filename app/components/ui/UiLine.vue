<script setup lang="ts">
/**
 * Chiziqli diagramma — gradient maydon, yorug‘ shtrix, nuqta belgilari va
 * kursor ostidagi qiymatni ko‘rsatuvchi kesishma chizig‘i.
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

export interface LineSeries {
  label: string
  tone: ChartTone
  values: number[]
  /** Chiziq ostini bo‘yash */
  fill?: boolean
}

const props = withDefaults(
  defineProps<{
    labels: string[]
    series: LineSeries[]
    height?: number
    /** Qiymat izohi (masalan "mln so‘m") */
    unit?: string
  }>(),
  { height: 200 },
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

function base(tone: ChartTone) {
  return BASE[tone] ?? BASE.brand
}

/* --- Koordinatalar (haqiqiy piksel o‘lchovida — belgilar cho‘zilmaydi) --- */

const uid = useId()
const plot = ref<HTMLElement | null>(null)
const { width: measured } = useElementSize(plot)

const PAD = { l: 10, r: 10, t: 14, b: 12 }

const W = computed(() => Math.max(Math.round(measured.value) || 560, 180))
const H = computed(() => props.height)

const bounds = computed(() => {
  const all = props.series.flatMap((s) => s.values).filter((v) => Number.isFinite(v))
  const min = Math.min(...all, 0)
  const max = Math.max(...all, 0)
  return { min, span: max - min || 1 }
})

const count = computed(() => Math.max(...props.series.map((s) => s.values.length), props.labels.length, 1))

function xAt(i: number) {
  const step = (W.value - PAD.l - PAD.r) / Math.max(count.value - 1, 1)
  return PAD.l + i * step
}

function yAt(v: number) {
  const { min, span } = bounds.value
  const usable = H.value - PAD.t - PAD.b
  return PAD.t + usable - ((v - min) / span) * usable
}

function pointsOf(values: number[]) {
  return values.map((v, i) => [xAt(i), yAt(v)] as const)
}

function linePath(values: number[]) {
  return pointsOf(values)
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(2)} ${p[1].toFixed(2)}`)
    .join(' ')
}

function areaPath(values: number[]) {
  const pts = pointsOf(values)
  const first = pts[0]
  const last = pts[pts.length - 1]
  if (!first || !last) return ''
  return `${linePath(values)} L${last[0].toFixed(2)} ${H.value} L${first[0].toFixed(2)} ${H.value} Z`
}

/** Seriya maydoni bo‘yaladimi: aniq ko‘rsatilmagan bo‘lsa — birinchisi bo‘yaladi */
const declaredFill = computed(() => props.series.some((s) => s.fill))

function filled(s: LineSeries, i: number) {
  return s.fill ?? (!declaredFill.value && i === 0)
}

/* --- Seriyani rang bilan emas, shakl bilan ham ajratamiz --- */

const DASH = ['1', '0.024 0.014', '0.005 0.013', '0.03 0.012 0.006 0.012']

function dashOf(i: number) {
  return drawn.value ? (DASH[i % DASH.length] ?? '1') : '1'
}

/** 0 — doira, 1 — kvadrat, 2 — romb, 3 — uchburchak */
function markerPath(i: number, x: number, y: number, r: number) {
  const shape = i % 4
  if (shape === 1) return `M${x - r} ${y - r}h${r * 2}v${r * 2}h${-r * 2}Z`
  if (shape === 2) return `M${x} ${y - r * 1.25}L${x + r * 1.25} ${y}L${x} ${y + r * 1.25}L${x - r * 1.25} ${y}Z`
  if (shape === 3) return `M${x} ${y - r * 1.3}L${x + r * 1.25} ${y + r}L${x - r * 1.25} ${y + r}Z`
  const d = r * 1.12
  return `M${x - d} ${y}a${d} ${d} 0 1 0 ${d * 2} 0a${d} ${d} 0 1 0 ${-d * 2} 0`
}

const SHAPE_NAME = ['doira', 'kvadrat', 'romb', 'uchburchak']

/* --- Kirish animatsiyasi --- */

const shown = ref(false)
const drawn = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

onMounted(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    shown.value = true
    drawn.value = true
    return
  }
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      shown.value = true
    }),
  )
  timer = setTimeout(() => {
    drawn.value = true
  }, 560)
})

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer)
})

/* --- Kursor va klaviatura --- */

const active = ref<number | null>(null)

function pick(clientX: number) {
  const el = plot.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const step = (W.value - PAD.l - PAD.r) / Math.max(count.value - 1, 1)
  const i = Math.round((clientX - rect.left - PAD.l) / (step || 1))
  active.value = Math.min(Math.max(i, 0), count.value - 1)
}

function onMove(e: PointerEvent) {
  pick(e.clientX)
}

function step(delta: number) {
  const next = (active.value ?? (delta > 0 ? -1 : count.value)) + delta
  active.value = Math.min(Math.max(next, 0), count.value - 1)
}

function fmt(v: number) {
  const a = Math.abs(v)
  if (a >= 1000) return num(Math.round(v))
  if (a >= 100) return num(v, 0)
  if (a >= 10) return num(v, 1)
  return num(v, 2)
}

const tipShift = computed(() => {
  const i = active.value
  if (i === null) return '-translate-x-1/2'
  const share = xAt(i) / Math.max(W.value, 1)
  if (share < 0.22) return 'translate-x-0'
  if (share > 0.78) return '-translate-x-full'
  return '-translate-x-1/2'
})

/* --- Matnli muqobil --- */

const summary = computed(() => {
  const rows = props.series.map((s, i) => {
    const vs = s.values.filter((v) => Number.isFinite(v))
    if (!vs.length) return `${s.label}: ma’lumot yo‘q`
    const first = vs[0] ?? 0
    const last = vs[vs.length - 1] ?? 0
    return `${s.label} (${SHAPE_NAME[i % 4]} belgisi): ${fmt(first)} dan ${fmt(last)} gacha, eng yuqori ${fmt(Math.max(...vs))}`
  })
  const span = props.labels.length
    ? `${props.labels.length} ta davr: ${props.labels[0]} — ${props.labels[props.labels.length - 1]}`
    : 'davrlar yo‘q'
  return `Chiziqli diagramma${props.unit ? `, ${props.unit}` : ''}. ${span}. ${rows.join('; ')}.`
})
</script>

<template>
  <div>
    <div
      ref="plot"
      class="relative outline-offset-4"
      tabindex="0"
      aria-label="Diagramma nuqtalari bo‘yicha o‘tish uchun chap va o‘ng strelkalardan foydalaning"
      :style="{ height: `${height}px` }"
      @pointermove="onMove"
      @pointerleave="active = null"
      @blur="active = null"
      @keydown.left.prevent="step(-1)"
      @keydown.right.prevent="step(1)"
      @keydown.esc="active = null"
    >
      <!-- To‘r chiziqlari -->
      <div class="pointer-events-none absolute inset-0 flex flex-col justify-between" aria-hidden="true">
        <span
          v-for="n in 5"
          :key="n"
          class="border-t"
          :class="n === 5 ? 'border-ink-200' : 'border-ink-100'"
        />
      </div>

      <svg
        :viewBox="`0 0 ${W} ${H}`"
        preserveAspectRatio="none"
        class="relative size-full"
        role="img"
        :aria-label="summary"
      >
        <defs>
          <linearGradient
            v-for="(s, i) in series"
            :id="`${uid}-fill-${i}`"
            :key="`f${i}`"
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop offset="0" :stop-color="base(s.tone)" stop-opacity="0.3" />
            <stop offset="0.72" :stop-color="base(s.tone)" stop-opacity="0.06" />
            <stop offset="1" :stop-color="base(s.tone)" stop-opacity="0" />
          </linearGradient>

          <linearGradient
            v-for="(s, i) in series"
            :id="`${uid}-stroke-${i}`"
            :key="`s${i}`"
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop offset="0" :stop-color="tint(base(s.tone), 0.24)" />
            <stop offset="1" :stop-color="shade(base(s.tone), 0.12)" />
          </linearGradient>

          <filter
            :id="`${uid}-lift`"
            filterUnits="userSpaceOnUse"
            x="0"
            y="0"
            :width="W"
            :height="H + 16"
          >
            <feDropShadow
              dx="0"
              dy="2.5"
              stdDeviation="3"
              flood-color="#131c2b"
              flood-opacity="0.18"
            />
          </filter>
        </defs>

        <!-- Maydon to‘ldirishi -->
        <path
          v-for="(s, i) in series"
          v-show="filled(s, i)"
          :key="`area${i}`"
          :d="areaPath(s.values)"
          :fill="`url(#${uid}-fill-${i})`"
          class="transition-opacity duration-500 ease-out"
          :class="shown ? 'opacity-100' : 'opacity-0'"
        />

        <!-- Kesishma chizig‘i -->
        <line
          v-if="active !== null"
          :x1="xAt(active)"
          :x2="xAt(active)"
          :y1="PAD.t - 8"
          :y2="H"
          stroke="#94a2b8"
          stroke-width="1"
          stroke-dasharray="3 3"
          vector-effect="non-scaling-stroke"
        />

        <g :filter="`url(#${uid}-lift)`">
          <path
            v-for="(s, i) in series"
            :key="`line${i}`"
            :d="linePath(s.values)"
            fill="none"
            :stroke="`url(#${uid}-stroke-${i})`"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            pathLength="1"
            :stroke-dasharray="dashOf(i)"
            :stroke-dashoffset="shown ? 0 : 1"
            class="transition-[stroke-dashoffset] duration-500 ease-out"
          />
        </g>

        <!-- Nuqta belgilari -->
        <g
          class="transition-opacity duration-300 ease-out"
          :class="shown ? 'opacity-100' : 'opacity-0'"
        >
          <template v-for="(s, i) in series" :key="`m${i}`">
            <path
              v-for="(v, j) in s.values"
              :key="`m${i}-${j}`"
              :d="markerPath(i, xAt(j), yAt(v), active === j ? 4.6 : 3.2)"
              :fill="base(s.tone)"
              stroke="#ffffff"
              stroke-width="1.6"
              vector-effect="non-scaling-stroke"
            />
          </template>
        </g>
      </svg>

      <!-- Qiymatlar paneli -->
      <div
        v-if="active !== null"
        class="pointer-events-none absolute top-1 z-10 min-w-[8.5rem] rounded-field bg-ink-900/95 px-3 py-2 shadow-pop"
        :class="tipShift"
        :style="{ left: `${xAt(active)}px` }"
      >
        <p class="text-[11px] font-semibold uppercase tracking-wide text-ink-300">
          {{ labels[active] ?? `#${active + 1}` }}
        </p>
        <ul class="mt-1.5 space-y-1">
          <li
            v-for="(s, i) in series"
            :key="s.label"
            class="flex items-center justify-between gap-3 text-[12px] text-white"
          >
            <span class="flex min-w-0 items-center gap-1.5">
              <svg viewBox="0 0 10 10" class="size-2.5 shrink-0" aria-hidden="true">
                <path :d="markerPath(i, 5, 5, 3.4)" :fill="tint(base(s.tone), 0.15)" />
              </svg>
              <span class="truncate">{{ s.label }}</span>
            </span>
            <span class="tabular shrink-0 font-semibold">{{ fmt(s.values[active] ?? 0) }}</span>
          </li>
        </ul>
      </div>
    </div>

    <div class="mt-2 flex items-center justify-between gap-1 overflow-hidden">
      <span
        v-for="(l, i) in labels"
        :key="l"
        class="min-w-0 truncate text-[11.5px]"
        :class="active === i ? 'font-semibold text-ink-800' : 'text-ink-500'"
      >
        {{ l }}
      </span>
    </div>

    <ul class="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
      <li v-for="(s, i) in series" :key="s.label" class="flex items-center gap-2 text-[12.5px]">
        <svg viewBox="0 0 22 10" class="h-2.5 w-5 shrink-0" aria-hidden="true">
          <line
            x1="1"
            y1="5"
            x2="21"
            y2="5"
            :stroke="base(s.tone)"
            stroke-width="2.5"
            stroke-linecap="round"
            :stroke-dasharray="i === 0 ? undefined : i === 1 ? '5 3' : i === 2 ? '1.5 3' : '6 2.5 1.5 2.5'"
          />
          <path :d="markerPath(i, 11, 5, 3)" :fill="base(s.tone)" stroke="#ffffff" stroke-width="1" />
        </svg>
        <span class="text-ink-600">{{ s.label }}</span>
      </li>
      <li v-if="unit" class="text-[12px] text-ink-400">{{ unit }}</li>
    </ul>

    <!-- Ekran o‘qigichlar uchun to‘liq qiymatlar -->
    <dl class="sr-only">
      <template v-for="(l, i) in labels" :key="l">
        <dt>{{ l }}</dt>
        <dd>{{ series.map((s) => `${s.label}: ${fmt(s.values[i] ?? 0)}`).join(', ') }}</dd>
      </template>
    </dl>
  </div>
</template>
