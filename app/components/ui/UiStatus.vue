<script setup lang="ts">
import {
  STATUS_REGISTRY,
  TONE_BADGE,
  TONE_MARK,
  type StatusKind,
  type StatusDef,
} from '~/constants/statuses'

const props = withDefaults(
  defineProps<{
    kind: StatusKind
    value: string
    size?: 'sm' | 'md'
    /**
     * `badge` nishoncha ko‘rinishi, `plain` esa fon va halqasiz, faqat belgi
     * va nom. `plain` matn qatoriga (dt/dd, karta ichidagi qator) mo‘ljallangan:
     * ekran status nomini `UNIT_STATUS[x].label` orqali qo‘lda chiqarmasin,
     * aks holda o‘sha joy tarjima qilinmay qoladi.
     */
    variant?: 'badge' | 'plain'
  }>(),
  { size: 'md', variant: 'badge' },
)

const { statusLabel } = useAppLabels()

/**
 * Rang va shakl registrdan, nom esa tarjima kalitidan olinadi. Shu tufayli
 * tanlangan til butun mahsulotdagi status nishonchalariga ham tarqaladi.
 */
const def = computed<StatusDef>(() => {
  const found = STATUS_REGISTRY[props.kind][props.value]
  return {
    label: statusLabel(props.kind, props.value),
    tone: found?.tone ?? 'neutral',
    shape: found?.shape ?? 'square',
  }
})
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 whitespace-nowrap"
    :class="[
      variant === 'badge'
        ? ['rounded-pill font-semibold ring-1 ring-inset', TONE_BADGE[def.tone]]
        : 'font-medium text-ink-700',
      variant === 'badge'
        ? size === 'sm'
          ? 'px-2 py-0.5 text-[11px]'
          : 'px-2.5 py-1 text-xs'
        : size === 'sm'
          ? 'text-[12px]'
          : 'text-[13px]',
    ]"
  >
    <!-- Shakl belgisi: status faqat rang bilan emas, shakl bilan ham farqlanadi -->
    <svg
      class="size-3 shrink-0"
      :class="TONE_MARK[def.tone]"
      viewBox="0 0 12 12"
      aria-hidden="true"
    >
      <circle v-if="def.shape === 'dot'" cx="6" cy="6" r="4" fill="currentColor" />
      <circle
        v-else-if="def.shape === 'ring'"
        cx="6"
        cy="6"
        r="3.6"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      />
      <rect
        v-else-if="def.shape === 'square'"
        x="2.4"
        y="2.4"
        width="7.2"
        height="7.2"
        rx="1.6"
        fill="currentColor"
      />
      <path
        v-else-if="def.shape === 'check'"
        d="M2.6 6.3 5 8.7l4.4-5"
        fill="none"
        stroke="currentColor"
        stroke-width="1.9"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        v-else-if="def.shape === 'cross'"
        d="M3.2 3.2l5.6 5.6M8.8 3.2l-5.6 5.6"
        fill="none"
        stroke="currentColor"
        stroke-width="1.9"
        stroke-linecap="round"
      />
      <g v-else-if="def.shape === 'clock'" fill="none" stroke="currentColor" stroke-width="1.6">
        <circle cx="6" cy="6" r="4.2" />
        <path d="M6 3.6V6l1.9 1.2" stroke-linecap="round" />
      </g>
      <rect v-else x="1.8" y="4.6" width="8.4" height="2.8" rx="1.4" fill="currentColor" />
    </svg>
    {{ def.label }}
  </span>
</template>
