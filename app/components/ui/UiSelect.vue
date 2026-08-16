<script setup lang="ts">
withDefaults(
  defineProps<{
    options: Array<{ value: string; label: string }>
    placeholder?: string
    disabled?: boolean
    invalid?: boolean
    size?: 'sm' | 'md'
  }>(),
  { size: 'md' },
)

const model = defineModel<string>()

// Atributlar ildiz <div> ga emas, haqiqiy <select> ga tushishi kerak;
// class/style esa tashqi o‘ramda qoladi, chunki kenglik shu yerda beriladi.
defineOptions({ inheritAttrs: false })

const attrs = useAttrs()
const wrapAttrs = computed(() => ({ class: attrs.class, style: attrs.style }))
const fieldAttrs = computed(() => {
  const { class: _c, style: _s, ...rest } = attrs
  return rest
})
</script>

<template>
  <div v-bind="wrapAttrs" class="relative">
    <select
      v-bind="fieldAttrs"
      v-model="model"
      :disabled="disabled"
      :aria-invalid="invalid || undefined"
      class="w-full appearance-none rounded-field bg-white pl-3.5 pr-9 text-sm text-ink-800 ring-1 ring-inset transition-colors focus:ring-2 focus:ring-brand-500 disabled:bg-ink-50 disabled:text-ink-400"
      :class="[
        invalid ? 'ring-danger-400' : 'ring-ink-200 hover:ring-ink-300',
        size === 'sm' ? 'h-11 md:h-9' : 'h-11',
      ]"
    >
      <option v-if="placeholder" value="">{{ placeholder }}</option>
      <option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option>
    </select>

    <svg
      class="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-ink-400"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="m4 6 4 4 4-4"
        stroke="currentColor"
        stroke-width="1.7"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  </div>
</template>
