<script setup lang="ts">
/**
 * Bo‘sh holat: ikonka, sarlavha, tushuntirish va amal. «Ma’lumot topilmadi»
 * degan quruq qator o‘rniga foydalanuvchiga keyingi qadamni ko‘rsatadi.
 */
withDefaults(
  defineProps<{
    icon?: string
    title: string
    description?: string
    /** Asosiy amal */
    actionLabel?: string
    actionTo?: string
    /** Ikkilamchi amal: odatda filtrlarni tozalash */
    secondaryLabel?: string
    compact?: boolean
    tone?: 'neutral' | 'brand' | 'ok' | 'warn'
  }>(),
  { icon: 'search', compact: false, tone: 'neutral' },
)

const emit = defineEmits<{ action: []; secondary: [] }>()

const TONE: Record<string, string> = {
  neutral: 'bg-ink-100 text-ink-400',
  brand: 'bg-brand-50 text-brand-500',
  ok: 'bg-ok-50 text-ok-500',
  warn: 'bg-warn-50 text-warn-500',
}
</script>

<template>
  <div
    class="flex flex-col items-center justify-center text-center"
    :class="compact ? 'px-4 py-10' : 'px-6 py-16'"
  >
    <span
      class="grid place-items-center rounded-full"
      :class="[TONE[tone], compact ? 'size-12' : 'size-16']"
    >
      <UiIcon :name="icon" :size="compact ? 22 : 28" />
    </span>

    <p class="mt-4 text-[15px] font-semibold text-ink-900">{{ title }}</p>
    <p v-if="description" class="mt-1.5 max-w-sm text-[13px] leading-relaxed text-ink-500">
      {{ description }}
    </p>

    <div v-if="actionLabel || secondaryLabel" class="mt-5 flex flex-wrap items-center justify-center gap-2.5">
      <UiButton v-if="actionLabel && actionTo" size="sm" :to="actionTo">{{ actionLabel }}</UiButton>
      <UiButton v-else-if="actionLabel" size="sm" @click="emit('action')">
        {{ actionLabel }}
      </UiButton>
      <UiButton v-if="secondaryLabel" variant="secondary" size="sm" @click="emit('secondary')">
        {{ secondaryLabel }}
      </UiButton>
    </div>

    <slot />
  </div>
</template>
