<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    label: string
    value: string
    unit?: string
    /** Foizdagi o‘zgarish; musbat — o‘sish, manfiy — pasayish */
    delta?: number
    /** Ba’zi ko‘rsatkichlarda pasayish yaxshi (masalan vacancy, qarzdorlik) */
    invert?: boolean
    icon?: string
    tone?: 'brand' | 'ok' | 'warn' | 'danger' | 'violet'
    /** Sparkline uchun qiymatlar */
    spark?: number[]
    to?: string
  }>(),
  { tone: 'brand' },
)

const TONE_ICON = {
  brand: 'bg-brand-50 text-brand-600',
  ok: 'bg-ok-50 text-ok-600',
  warn: 'bg-warn-50 text-warn-600',
  danger: 'bg-danger-50 text-danger-600',
  violet: 'bg-info-50 text-info-600',
}

const good = computed(() =>
  props.delta === undefined ? null : props.invert ? props.delta < 0 : props.delta > 0,
)

const sparkPath = computed(() => {
  const pts = props.spark
  if (!pts || pts.length < 2) return ''
  const min = Math.min(...pts)
  const max = Math.max(...pts)
  const span = max - min || 1
  const step = 100 / (pts.length - 1)
  return pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)} ${(28 - ((p - min) / span) * 24).toFixed(1)}`)
    .join(' ')
})
</script>

<template>
  <component
    :is="to ? resolveComponent('NuxtLink') : 'div'"
    :to="to"
    class="block rounded-card bg-surface p-4 shadow-card ring-1 ring-ink-200/60 transition-shadow"
    :class="to ? 'hover:shadow-panel' : ''"
  >
    <div class="flex items-start justify-between gap-3">
      <p class="text-[12.5px] font-medium leading-snug text-ink-500">{{ label }}</p>
      <span
        v-if="icon"
        class="grid size-9 shrink-0 place-items-center rounded-[10px]"
        :class="TONE_ICON[tone]"
      >
        <UiIcon :name="icon" :size="18" />
      </span>
    </div>

    <p class="mt-2.5 flex items-baseline gap-1.5">
      <span class="tabular text-[26px] font-bold leading-none text-ink-900">{{ value }}</span>
      <span v-if="unit" class="text-[13px] font-medium text-ink-500">{{ unit }}</span>
    </p>

    <div class="mt-2.5 flex items-end justify-between gap-3">
      <span
        v-if="delta !== undefined"
        class="inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[12px] font-semibold"
        :class="good ? 'bg-ok-50 text-ok-700' : 'bg-danger-50 text-danger-700'"
      >
        <UiIcon :name="delta > 0 ? 'arrowUp' : 'arrowDown'" :size="12" />
        {{ delta > 0 ? '+' : '' }}{{ delta }}%
      </span>
      <span v-else />

      <svg
        v-if="sparkPath"
        viewBox="0 0 100 30"
        preserveAspectRatio="none"
        class="h-7 w-20 shrink-0"
        :class="good === false ? 'text-danger-400' : 'text-brand-400'"
        aria-hidden="true"
      >
        <path
          :d="sparkPath"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          vector-effect="non-scaling-stroke"
        />
      </svg>
    </div>
  </component>
</template>
