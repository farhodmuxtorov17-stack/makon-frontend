<script setup lang="ts">
/**
 * Ustunli diagramma — gradient bilan bo‘yalgan ustunlar, ixtiyoriy izometrik
 * chuqurlik, ustunga kursor kelganda qiymatlar paneli.
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

export interface BarSeries {
  label: string
  tone: ChartTone
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
    /** Izometrik yuqori va yon yuza — hajmli ko‘rinish */
    depth?: boolean
    /** Ustun ustidagi qiymat yozuvi; `auto` — siyrak diagrammalarda ko‘rinadi */
    valueLabels?: boolean | 'auto'
  }>(),
  { height: 200, valueLabels: 'auto' },
)

/* --- Ohanglar: bitta asosiy rangdan butun gradient oilasi hosil qilinadi --- */

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

function alpha(hex: string, a: number): string {
  const c = rgb(hex)
  return `rgb(${c[0]} ${c[1]} ${c[2]} / ${a})`
}

function base(tone: ChartTone) {
  return BASE[tone] ?? BASE.brand
}

/** Ustun tanasi: tepasi yorug‘, poyasi to‘yingan */
function bodyStyle(tone: ChartTone) {
  const c = base(tone)
  return {
    backgroundImage: `linear-gradient(180deg, ${tint(c, 0.32)} 0%, ${c} 56%, ${shade(c, 0.16)} 100%)`,
    boxShadow: `inset 0 1px 0 ${alpha('#ffffff', 0.5)}, 0 10px 16px -10px ${alpha(c, 0.7)}`,
  }
}

function topFaceStyle(tone: ChartTone) {
  return { background: tint(base(tone), 0.5) }
}

function sideFaceStyle(tone: ChartTone) {
  return { background: shade(base(tone), 0.3) }
}

/* --- O‘lchov --- */

const LABEL_H = 24
const DEPTH = 6

const max = computed(() => {
  const values = props.stacked
    ? props.labels.map((_, i) => props.series.reduce((s, x) => s + (x.values[i] ?? 0), 0))
    : props.series.flatMap((s) => s.values)
  return Math.max(...values.filter((v) => Number.isFinite(v)), 0)
})

function pct(v: number) {
  // Qiymat yozuvlari ko‘rsatilsa — tepada joy qoldiriladi
  const share = (v / (max.value || 1)) * 100 * (showValues.value ? 0.87 : 1)
  return v > 0 ? Math.max(share, 1.5) : 0
}

function columnTotal(i: number) {
  return props.series.reduce((s, x) => s + (x.values[i] ?? 0), 0)
}

/** Segmentning to‘plangan ustun ichidagi ulushi */
function segShare(i: number, v: number) {
  const total = columnTotal(i)
  return total > 0 ? (v / total) * 100 : 0
}

function fmt(v: number) {
  const a = Math.abs(v)
  if (a >= 1000) return num(Math.round(v))
  if (a >= 100) return num(v, 0)
  if (a >= 10) return num(v, 1)
  return num(v, 2)
}

const showValues = computed(() => {
  if (props.valueLabels !== 'auto') return props.valueLabels === true
  return props.labels.length <= 8 && (props.stacked === true || props.series.length === 1)
})

/* --- Kirish animatsiyasi (harakat kamaytirilgan bo‘lsa — darhol to‘liq holat) --- */

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

function grow(i: number) {
  return {
    transform: shown.value ? 'scaleY(1)' : 'scaleY(0)',
    transitionDelay: `${Math.min(i * 22, 220)}ms`,
  }
}

/* --- Kursor --- */

const active = ref<number | null>(null)

const tipShift = computed(() => {
  const i = active.value
  if (i === null) return '-translate-x-1/2'
  const share = (i + 0.5) / Math.max(props.labels.length, 1)
  if (share < 0.2) return 'translate-x-0'
  if (share > 0.8) return '-translate-x-full'
  return '-translate-x-1/2'
})

/* --- Matnli muqobil --- */

const summary = computed(() => {
  const rows = props.series.map((s) => {
    const vs = s.values.filter((v) => Number.isFinite(v))
    if (!vs.length) return `${s.label}: ma’lumot yo‘q`
    return `${s.label}: ${fmt(Math.min(...vs))} dan ${fmt(Math.max(...vs))} gacha`
  })
  const span = props.labels.length
    ? `${props.labels.length} ta ustun: ${props.labels[0]} — ${props.labels[props.labels.length - 1]}`
    : 'ustunlar yo‘q'
  return `Ustunli diagramma${props.unit ? `, ${props.unit}` : ''}. ${span}. ${rows.join('; ')}.`
})
</script>

<template>
  <div>
    <div class="relative" @pointerleave="active = null">
      <div class="relative" :style="{ height: `${height}px` }">
        <!-- To‘r chiziqlari -->
        <div
          class="pointer-events-none absolute inset-x-0 top-0 flex flex-col justify-between"
          :style="{ bottom: `${LABEL_H}px` }"
          aria-hidden="true"
        >
          <span
            v-for="n in 5"
            :key="n"
            class="border-t"
            :class="n === 5 ? 'border-ink-200' : 'border-ink-100'"
          />
        </div>

        <div
          class="relative flex h-full items-end gap-1.5 sm:gap-3"
          :class="depth ? 'pe-1.5' : ''"
          role="img"
          :aria-label="summary"
        >
          <div
            v-for="(label, i) in labels"
            :key="label"
            class="flex h-full min-w-0 flex-1 flex-col"
            @pointerenter="active = i"
          >
            <div class="relative flex flex-1 items-end justify-center gap-1">
              <!-- Qiymat yozuvi -->
              <span
                v-if="showValues"
                class="tabular pointer-events-none absolute inset-x-0 text-center text-[10.5px] font-semibold leading-none transition-opacity duration-300 ease-out"
                :class="[
                  active === i ? 'text-ink-900' : 'text-ink-500',
                  shown ? 'opacity-100' : 'opacity-0',
                ]"
                :style="{
                  bottom: `calc(${pct(stacked ? columnTotal(i) : (series[0]?.values[i] ?? 0))}% + 5px)`,
                }"
              >
                {{ fmt(stacked ? columnTotal(i) : (series[0]?.values[i] ?? 0)) }}
              </span>

              <!-- To‘plangan ustun -->
              <div
                v-if="stacked"
                class="relative w-full max-w-[38px] origin-bottom transition-transform duration-500 ease-out"
                :style="[{ height: `${pct(columnTotal(i))}%` }, grow(i)]"
              >
                <template v-if="depth && columnTotal(i) > 0">
                  <span
                    class="absolute bottom-0 left-full h-full origin-bottom-left"
                    :style="[
                      sideFaceStyle(series[series.length - 1]?.tone ?? 'brand'),
                      { width: `${DEPTH}px`, transform: 'skewY(-45deg)' },
                    ]"
                  />
                  <span
                    class="absolute inset-x-0 bottom-full origin-bottom-left"
                    :style="[
                      topFaceStyle(series[series.length - 1]?.tone ?? 'brand'),
                      { height: `${DEPTH}px`, transform: 'skewX(-45deg)' },
                    ]"
                  />
                </template>

                <div
                  class="absolute inset-0 flex flex-col-reverse overflow-hidden"
                  :class="depth ? 'rounded-t-[3px]' : 'rounded-t-[6px]'"
                >
                  <span
                    v-for="s in series"
                    :key="s.label"
                    :style="[
                      bodyStyle(s.tone),
                      { height: `${segShare(i, s.values[i] ?? 0)}%` },
                    ]"
                  />
                </div>
              </div>

              <!-- Yonma-yon ustunlar -->
              <template v-else>
                <div
                  v-for="s in series"
                  :key="s.label"
                  class="relative w-full max-w-[20px] origin-bottom transition-transform duration-500 ease-out"
                  :style="[{ height: `${pct(s.values[i] ?? 0)}%` }, grow(i)]"
                >
                  <template v-if="depth && (s.values[i] ?? 0) > 0">
                    <span
                      class="absolute bottom-0 left-full h-full origin-bottom-left"
                      :style="[
                        sideFaceStyle(s.tone),
                        { width: `${DEPTH}px`, transform: 'skewY(-45deg)' },
                      ]"
                    />
                    <span
                      class="absolute inset-x-0 bottom-full origin-bottom-left"
                      :style="[
                        topFaceStyle(s.tone),
                        { height: `${DEPTH}px`, transform: 'skewX(-45deg)' },
                      ]"
                    />
                  </template>

                  <span
                    class="absolute inset-0"
                    :class="depth ? 'rounded-t-[3px]' : 'rounded-t-[5px]'"
                    :style="bodyStyle(s.tone)"
                  />
                </div>
              </template>
            </div>

            <span
              class="mt-1.5 truncate text-center text-[11.5px] leading-[18px]"
              :class="active === i ? 'font-semibold text-ink-800' : 'text-ink-500'"
            >
              {{ label }}
            </span>
          </div>
        </div>
      </div>

      <!-- Qiymatlar paneli -->
      <div
        v-if="active !== null"
        class="pointer-events-none absolute top-1 z-10 min-w-[8.5rem] rounded-field bg-ink-900/95 px-3 py-2 shadow-pop"
        :class="tipShift"
        :style="{ left: `${((active + 0.5) / Math.max(labels.length, 1)) * 100}%` }"
      >
        <p class="text-[11px] font-semibold uppercase tracking-wide text-ink-300">
          {{ labels[active] }}
        </p>
        <ul class="mt-1.5 space-y-1">
          <li
            v-for="s in series"
            :key="s.label"
            class="flex items-center justify-between gap-3 text-[12px] text-white"
          >
            <span class="flex min-w-0 items-center gap-1.5">
              <span class="size-2 shrink-0 rounded-[2px]" :style="{ background: base(s.tone) }" />
              <span class="truncate">{{ s.label }}</span>
            </span>
            <span class="tabular shrink-0 font-semibold">{{ fmt(s.values[active] ?? 0) }}</span>
          </li>
          <li
            v-if="stacked && series.length > 1"
            class="flex items-center justify-between gap-3 border-t border-white/15 pt-1 text-[12px] font-semibold text-white"
          >
            <span>Jami</span>
            <span class="tabular">{{ fmt(columnTotal(active)) }}</span>
          </li>
        </ul>
      </div>
    </div>

    <ul class="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
      <li v-for="s in series" :key="s.label" class="flex items-center gap-2 text-[12.5px]">
        <span
          class="size-2.5 rounded-[3px]"
          :style="{
            backgroundImage: `linear-gradient(180deg, ${tint(base(s.tone), 0.3)}, ${base(s.tone)})`,
          }"
        />
        <span class="text-ink-600">{{ s.label }}</span>
      </li>
      <li v-if="unit" class="text-[12px] text-ink-400">{{ unit }}</li>
    </ul>

    <!-- Ekran o‘qigichlar uchun to‘liq qiymatlar -->
    <dl class="sr-only">
      <template v-for="(label, i) in labels" :key="label">
        <dt>{{ label }}</dt>
        <dd>{{ series.map((s) => `${s.label}: ${fmt(s.values[i] ?? 0)}`).join(', ') }}</dd>
      </template>
    </dl>
  </div>
</template>
