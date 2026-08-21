<script setup lang="ts">
import { NuxtLink } from '#components'
/**
 * Ko‘rsatkich kartasi: gradientli ikonka maydoni, yirik qiymat, o‘zgarish
 * nishonchasi va karta qirralarigacha yetib boradigan dinamika chizig‘i.
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
    label: string
    value: string
    unit?: string
    /** Foizdagi o‘zgarish: musbat qiymat o‘sishni, manfiy qiymat pasayishni bildiradi */
    delta?: number
    /** Ba’zi ko‘rsatkichlarda pasayish yaxshi (masalan vacancy, qarzdorlik) */
    invert?: boolean
    icon?: string
    tone?: ChartTone
    /** Sparkline uchun qiymatlar */
    spark?: number[]
    to?: string
    /** Foizli ko‘rsatkich uchun radial o‘lchagich (0–100) */
    gauge?: number
    /** Radial o‘lchagich uchun yuqori chegara */
    gaugeMax?: number
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

function alpha(hex: string, a: number): string {
  const c = rgb(hex)
  return `rgb(${c[0]} ${c[1]} ${c[2]} / ${a})`
}

const color = computed(() => BASE[props.tone] ?? BASE.brand)

const iconStyle = computed(() => ({
  backgroundImage: `linear-gradient(140deg, ${tint(color.value, 0.94)} 0%, ${tint(color.value, 0.78)} 100%)`,
  boxShadow: `inset 0 1px 0 rgb(255 255 255 / 0.85), 0 6px 14px -10px ${alpha(color.value, 0.9)}`,
  color: shade(color.value, 0.45),
}))

const glowStyle = computed(() => ({
  backgroundImage: `radial-gradient(58% 52% at 100% 0%, ${alpha(color.value, 0.14)} 0%, ${alpha(color.value, 0)} 72%)`,
}))

const good = computed(() =>
  props.delta === undefined ? null : props.invert ? props.delta < 0 : props.delta > 0,
)

const sparkTone = computed<ChartTone>(() => (good.value === false ? 'danger' : props.tone))

const hasSpark = computed(() => !!props.spark && props.spark.length > 1 && props.gauge === undefined)

/**
 * «37.58 mlrd so‘m» kabi qiymatda birlik raqamdan ajratiladi: aks holda besh
 * ustunli qatorda (1440px da karta ichi 168px) satr o‘rtasidan sinadi va
 * `leading-none` tufayli ikki qator bir-biriga tegib ketadi. Ajratish faqat
 * qiymat sof sondan boshlanib, ortidan harf bilan boshlanuvchi birlik kelsa
 * ishlaydi, shuning uchun «87%», «190 029» va «Urban Office MCHJ» kabi
 * qiymatlar tegilmasdan qoladi.
 */
const VALUE_UNIT = /^([+\-−]?[\d.,\s]*\d)\s+(\p{L}.*)$/u

const parts = computed(() => {
  if (props.unit) return { value: props.value, unit: props.unit }
  const match = VALUE_UNIT.exec(props.value.trim())
  return match ? { value: match[1]!, unit: match[2]! } : { value: props.value, unit: props.unit }
})

/**
 * Ildiz element. `resolveComponent('NuxtLink')` shablon ichida nomni topa
 * olmasa satrni qaytaradi va DOM'ga `href`siz `<nuxtlink>` elementi tushadi:
 * karta bosilmay qoladi. Komponentning o'zini bog'laganda bunday bo'lmaydi.
 */
const root = computed(() => (props.to ? NuxtLink : 'div'))
</script>

<template>
  <component
    :is="root"
    :to="to"
    class="relative block overflow-hidden rounded-card bg-surface p-5 shadow-card ring-1 ring-ink-200/60 transition-all duration-200"
    :class="[to ? 'hover:-translate-y-0.5 hover:shadow-panel hover:ring-brand-200' : '', hasSpark ? 'pb-6' : '']"
  >
    <span class="pointer-events-none absolute inset-0" :style="glowStyle" aria-hidden="true" />

    <UiSparkline
      v-if="hasSpark && spark"
      :values="spark"
      :tone="sparkTone"
      :label="`${label} dinamikasi`"
      class="pointer-events-none absolute inset-x-0 bottom-0 h-14 w-full"
    />

    <div class="relative">
      <div class="flex items-start justify-between gap-3">
        <p class="text-[13px] font-medium leading-snug text-ink-500">{{ label }}</p>
        <span
          v-if="icon"
          class="grid size-9 shrink-0 place-items-center rounded-field ring-1 ring-inset ring-white/60"
          :style="iconStyle"
        >
          <UiIcon :name="icon" :size="18" />
        </span>
      </div>

      <div class="mt-2.5 flex items-end justify-between gap-3">
        <div class="min-w-0">
          <p class="flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
            <span
              class="tabular whitespace-nowrap text-[28px] font-bold leading-none text-ink-900"
            >{{ parts.value }}</span>
            <span
              v-if="parts.unit"
              class="text-[13px] font-medium text-ink-500"
            >{{ parts.unit }}</span>
          </p>

          <span
            v-if="delta !== undefined && delta !== 0"
            class="mt-2.5 inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[12px] font-semibold ring-1 ring-inset"
            :class="
              good
                ? 'bg-ok-50 text-ok-700 ring-ok-500/20'
                : 'bg-danger-50 text-danger-700 ring-danger-500/20'
            "
          >
            <UiIcon :name="delta > 0 ? 'arrowUp' : 'arrowDown'" :size="12" />
            {{ delta > 0 ? '+' : '' }}{{ delta }}%
          </span>
        </div>

        <UiGauge
          v-if="gauge !== undefined"
          :value="gauge"
          :max="gaugeMax ?? 100"
          :tone="tone"
          :size="76"
          :label="label"
          class="-my-1"
        />
      </div>
    </div>
  </component>
</template>
