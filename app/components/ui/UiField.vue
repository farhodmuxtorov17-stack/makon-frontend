<script setup lang="ts">
defineProps<{
  label?: string
  required?: boolean
  hint?: string
  error?: string
  for?: string
}>()
</script>

<template>
  <div class="min-w-0">
    <label
      v-if="label"
      :for="$props.for"
      class="mb-1.5 flex items-center gap-1 text-[13px] font-semibold text-ink-700"
    >
      {{ label }}
      <span v-if="required" class="text-danger-500" aria-hidden="true">*</span>
      <span v-if="required" class="sr-only">majburiy maydon</span>
    </label>

    <slot />

    <p v-if="error" class="mt-1.5 text-[12px] font-medium text-danger-600">{{ error }}</p>
    <p v-else-if="hint" class="mt-1.5 text-[12px] text-ink-500">{{ hint }}</p>
  </div>
</template>
