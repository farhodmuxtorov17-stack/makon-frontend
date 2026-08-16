<script setup lang="ts">
export interface Slice {
  label: string
  value: number
  tone: 'brand' | 'ok' | 'warn' | 'danger' | 'violet' | 'neutral'
}

const props = withDefaults(
  defineProps<{
    slices: Slice[]
    centerValue?: string
    centerLabel?: string
    size?: number
  }>(),
  { size: 180 },
)

const STROKE: Record<Slice['tone'], string> = {
  brand: '#0256F7',
  ok: '#16B99A',
  warn: '#FAA53F',
  danger: '#F84448',
  violet: '#916CEC',
  neutral: '#CBD4E3',
}

const R = 42
const C = 2 * Math.PI * R

const segments = computed(() => {
  const total = props.slices.reduce((s, x) => s + x.value, 0) || 1
  let offset = 0
  return props.slices.map((s) => {
    const len = (s.value / total) * C
    const seg = {
      color: STROKE[s.tone],
      dash: `${Math.max(len - 2, 0)} ${C - Math.max(len - 2, 0)}`,
      offset: -offset,
      share: Math.round((s.value / total) * 100),
      label: s.label,
      value: s.value,
    }
    offset += len
    return seg
  })
})
</script>

<template>
  <div class="flex flex-wrap items-center gap-6">
    <div class="relative shrink-0" :style="{ width: `${size}px`, height: `${size}px` }">
      <svg viewBox="0 0 100 100" class="-rotate-90">
        <circle cx="50" cy="50" :r="R" fill="none" stroke="#EEF2F8" stroke-width="12" />
        <circle
          v-for="(s, i) in segments"
          :key="i"
          cx="50"
          cy="50"
          :r="R"
          fill="none"
          :stroke="s.color"
          stroke-width="12"
          stroke-linecap="round"
          :stroke-dasharray="s.dash"
          :stroke-dashoffset="s.offset"
        />
      </svg>

      <div
        v-if="centerValue"
        class="absolute inset-0 grid place-content-center place-items-center text-center"
      >
        <span class="tabular text-xl font-bold text-ink-900">{{ centerValue }}</span>
        <span v-if="centerLabel" class="mt-0.5 max-w-[8rem] text-[11px] text-ink-500">
          {{ centerLabel }}
        </span>
      </div>
    </div>

    <ul class="min-w-[10rem] flex-1 space-y-2.5">
      <li v-for="(s, i) in segments" :key="i" class="flex items-center gap-2.5 text-[13px]">
        <span class="size-2.5 shrink-0 rounded-full" :style="{ background: s.color }" />
        <span class="min-w-0 flex-1 truncate text-ink-600">{{ s.label }}</span>
        <span class="tabular shrink-0 font-semibold text-ink-900">{{ s.share }}%</span>
      </li>
    </ul>
  </div>
</template>
