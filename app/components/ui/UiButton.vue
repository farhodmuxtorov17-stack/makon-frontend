<script setup lang="ts">
type Variant = 'primary' | 'secondary' | 'ghost' | 'success' | 'danger' | 'subtle'
type Size = 'sm' | 'md' | 'lg'

const props = withDefaults(
  defineProps<{
    variant?: Variant
    size?: Size
    to?: string
    type?: 'button' | 'submit'
    disabled?: boolean
    block?: boolean
  }>(),
  { variant: 'primary', size: 'md', type: 'button' },
)

/**
 * Fon ranglari oq yorliq bilan WCAG AA (≥4.5:1) chegarasidan o‘tadi: brand-500
 * 5.71:1, teal-700 4.76:1, danger-700 6.42:1. Yorliq 13–15px, ya’ni «yirik
 * matn» emas, shuning uchun 3:1 emas, 4.5:1 talab qilinadi.
 */
const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-brand-500 text-white shadow-brand hover:bg-brand-600 active:bg-brand-700 disabled:bg-brand-300 disabled:shadow-none',
  success:
    'bg-teal-700 text-white shadow-[0_6px_20px_rgb(4_131_93/0.3)] hover:bg-teal-800 active:bg-teal-900 disabled:bg-teal-300 disabled:shadow-none',
  danger:
    'bg-danger-700 text-white hover:bg-danger-800 active:bg-danger-900 disabled:bg-danger-100',
  secondary:
    'bg-white text-brand-600 ring-1 ring-inset ring-brand-200 hover:bg-brand-50 hover:ring-brand-300 active:bg-brand-100',
  subtle: 'bg-ink-100 text-ink-700 hover:bg-ink-200 active:bg-ink-300',
  ghost: 'text-ink-600 hover:bg-ink-100 hover:text-ink-800 active:bg-ink-200',
}

const SIZES: Record<Size, string> = {
  // Telefonda tegish nishoni 44px dan kichik bo‘lmaydi, katta ekranda o‘lcham
  // avvalgidek qoladi.
  sm: 'h-11 px-3.5 text-[13px] gap-1.5 rounded-[8px] md:h-9',
  md: 'h-11 px-5 text-sm gap-2 rounded-[10px]',
  lg: 'h-[52px] px-6 text-[16px] gap-2.5 rounded-xl',
}

const classes = computed(() => [
  'inline-flex items-center justify-center font-semibold whitespace-nowrap',
  'transition-colors duration-150 disabled:cursor-not-allowed',
  VARIANTS[props.variant],
  SIZES[props.size],
  props.block ? 'w-full' : '',
])
</script>

<template>
  <NuxtLink v-if="to && !disabled" :to="to" :class="classes">
    <slot />
  </NuxtLink>
  <button v-else :type="type" :disabled="disabled" :class="classes">
    <slot />
  </button>
</template>
