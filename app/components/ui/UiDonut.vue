<script setup lang="ts">
/**
 * Halqasimon diagramma: har bir bo‘lak o‘z gradienti bilan, ichki soya,
 * kirishda o‘sish animatsiyasi va bo‘lak ustiga kelganda ajratib ko‘rsatish.
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

export interface Slice {
  label: string
  value: number
  tone: ChartTone
}

const props = withDefaults(
  defineProps<{
    slices: Slice[]
    centerValue?: string
    centerLabel?: string
    size?: number
    /** Halqa qalinligi (SVG birligida, 100×100 maydonda) */
    thickness?: number
  }>(),
  { size: 180, thickness: 12 },
)

const BASE: Record<ChartTone, string> = {
  brand: '#0256f7',
  ok: '#16b99a',
  warn: '#faa53f',
  danger: '#f84448',
  violet: '#916cec',
  info: '#916cec',
  teal: '#16b99a',
  neutral: '#cbd4e3',
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

const uid = useId()
const R = 42
const C = 2 * Math.PI * R
const GAP = 3

const total = computed(() => props.slices.reduce((s, x) => s + Math.max(x.value, 0), 0) || 1)

const segments = computed(() => {
  let offset = 0
  return props.slices.map((s) => {
    const value = Math.max(s.value, 0)
    const len = (value / total.value) * C
    const from = (offset / C) * 360
    const to = ((offset + len) / C) * 360
    const mid = ((from + to) / 2) * (Math.PI / 180)
    const seg = {
      tone: s.tone,
      color: base(s.tone),
      from: tint(base(s.tone), 0.24),
      to: shade(base(s.tone), 0.2),
      x1: 50 + R * Math.cos((from * Math.PI) / 180),
      y1: 50 + R * Math.sin((from * Math.PI) / 180),
      x2: 50 + R * Math.cos((to * Math.PI) / 180),
      y2: 50 + R * Math.sin((to * Math.PI) / 180),
      dx: Math.cos(mid) * 3.2,
      dy: Math.sin(mid) * 3.2,
      dash: `${Math.max(len - GAP, 0.001)} ${C - Math.max(len - GAP, 0.001)}`,
      offset: -offset,
      share: Math.round((value / total.value) * 100),
      label: s.label,
      value: s.value,
    }
    offset += len
    return seg
  })
})

/* --- Kirish animatsiyasi --- */

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

/* --- Kursor --- */

const active = ref<number | null>(null)
const current = computed(() => (active.value === null ? null : (segments.value[active.value] ?? null)))

const summary = computed(() => {
  const rows = segments.value.map((s) => `${s.label}, ${s.share}%`)
  const head = props.centerLabel ? `${props.centerLabel}: ${props.centerValue ?? ''}. ` : ''
  return `Halqasimon diagramma. ${head}Bo‘laklar: ${rows.join(', ')}.`
})
</script>

<template>
  <div class="flex flex-wrap items-center gap-6">
    <div class="relative shrink-0" :style="{ width: `${size}px`, height: `${size}px` }">
      <svg
        viewBox="0 0 100 100"
        class="size-full"
        role="img"
        :aria-label="summary"
        @pointerleave="active = null"
      >
        <defs>
          <linearGradient
            v-for="(s, i) in segments"
            :id="`${uid}-seg-${i}`"
            :key="`g${i}`"
            gradientUnits="userSpaceOnUse"
            :x1="s.x1"
            :y1="s.y1"
            :x2="s.x2"
            :y2="s.y2"
          >
            <stop offset="0" :stop-color="s.from" />
            <stop offset="1" :stop-color="s.to" />
          </linearGradient>

          <radialGradient :id="`${uid}-hole`">
            <stop offset="0.66" stop-color="#131c2b" stop-opacity="0" />
            <stop offset="0.93" stop-color="#131c2b" stop-opacity="0.06" />
            <stop offset="1" stop-color="#131c2b" stop-opacity="0.16" />
          </radialGradient>

          <filter
            :id="`${uid}-lift`"
            filterUnits="userSpaceOnUse"
            x="0"
            y="0"
            width="100"
            height="100"
          >
            <feDropShadow
              dx="0"
              dy="1.5"
              stdDeviation="1.8"
              flood-color="#131c2b"
              flood-opacity="0.18"
            />
          </filter>
        </defs>

        <circle cx="50" cy="50" :r="R" fill="none" stroke="#eef2f8" :stroke-width="thickness" />

        <g :filter="`url(#${uid}-lift)`">
          <g transform="rotate(-90 50 50)">
            <g
              v-for="(s, i) in segments"
              :key="i"
              class="transition-[transform,opacity] duration-200 ease-out"
              :style="{
                transform: active === i ? `translate(${s.dx}px, ${s.dy}px)` : 'none',
                opacity: active === null || active === i ? 1 : 0.35,
              }"
            >
              <circle
                cx="50"
                cy="50"
                :r="R"
                fill="none"
                :stroke="`url(#${uid}-seg-${i})`"
                :stroke-width="thickness"
                stroke-linecap="round"
                :stroke-dasharray="shown ? s.dash : `0.001 ${C}`"
                :stroke-dashoffset="s.offset"
                class="cursor-pointer transition-[stroke-dasharray] duration-500 ease-out"
                @pointerenter="active = i"
              />
            </g>
          </g>
        </g>

        <!-- Ichki soya: halqaga chuqurlik beradi -->
        <circle
          cx="50"
          cy="50"
          :r="50 - thickness"
          :fill="`url(#${uid}-hole)`"
          class="pointer-events-none"
        />
      </svg>

      <div
        v-if="centerValue || current"
        class="pointer-events-none absolute inset-0 grid place-content-center place-items-center px-6 text-center"
      >
        <span class="tabular text-xl font-bold text-ink-900">
          {{ current ? `${current.share}%` : centerValue }}
        </span>
        <span class="mt-0.5 line-clamp-2 max-w-[8rem] text-[11px] text-ink-500">
          {{ current ? current.label : centerLabel }}
        </span>
      </div>
    </div>

    <ul class="min-w-[10rem] flex-1 space-y-2.5">
      <li
        v-for="(s, i) in segments"
        :key="i"
        class="flex items-center gap-2.5 text-[13px] transition-opacity duration-200 ease-out"
        :class="active === null || active === i ? 'opacity-100' : 'opacity-50'"
        @pointerenter="active = i"
        @pointerleave="active = null"
      >
        <span
          class="size-2.5 shrink-0 rounded-full"
          :style="{ backgroundImage: `linear-gradient(140deg, ${s.from}, ${s.to})` }"
        />
        <span class="min-w-0 flex-1 truncate text-ink-600">{{ s.label }}</span>
        <span class="tabular shrink-0 font-semibold text-ink-900">{{ s.share }}%</span>
      </li>
    </ul>
  </div>
</template>
