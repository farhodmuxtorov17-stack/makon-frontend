<script setup lang="ts">
withDefaults(
  defineProps<{
    type?: string
    placeholder?: string
    disabled?: boolean
    readonly?: boolean
    invalid?: boolean
    /** O‘ng tomonda tasdiq belgisi (maketdagi yashil ✓) */
    valid?: boolean
  }>(),
  { type: 'text' },
)

const model = defineModel<string | number>()

// id, inputmode va shu kabi atributlar ildiz <div> ga emas, haqiqiy
// <input> ga tushishi kerak — aks holda yorliq maydonga bog‘lanmaydi.
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
    <span
      v-if="$slots.prefix"
      class="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none"
    >
      <slot name="prefix" />
    </span>

    <input
      v-bind="fieldAttrs"
      v-model="model"
      :type="type"
      :placeholder="placeholder"
      :disabled="disabled"
      :readonly="readonly"
      :aria-invalid="invalid || undefined"
      class="h-11 w-full rounded-field bg-white text-sm text-ink-800 ring-1 ring-inset transition-colors placeholder:text-ink-400 focus:ring-2 focus:ring-brand-500 disabled:bg-ink-50 disabled:text-ink-400 read-only:bg-ink-50"
      :class="[
        invalid ? 'ring-danger-400' : 'ring-ink-200 hover:ring-ink-300',
        $slots.prefix ? 'pl-10' : 'pl-3.5',
        valid || $slots.suffix ? 'pr-10' : 'pr-3.5',
      ]"
    />

    <span v-if="$slots.suffix" class="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-400">
      <slot name="suffix" />
    </span>
    <svg
      v-else-if="valid"
      class="absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-ok-500"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.5" />
      <path
        d="M5 8.2 7 10.2l4-4.4"
        stroke="currentColor"
        stroke-width="1.7"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  </div>
</template>
