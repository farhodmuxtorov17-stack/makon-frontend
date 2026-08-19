<script setup lang="ts">
withDefaults(
  defineProps<{
    title?: string
    subtitle?: string
    padded?: boolean
    flush?: boolean
    /** Bosiladigan karta: ko‘tarilish effekti va kursor qo‘shiladi */
    interactive?: boolean
    /** Sarlavha yonidagi ikonka */
    icon?: string
    /** Ikonka fonining ohangi */
    tone?: 'brand' | 'ok' | 'warn' | 'danger' | 'info' | 'teal' | 'neutral'
  }>(),
  { padded: true, tone: 'brand' },
)

const TONE: Record<string, string> = {
  brand: 'bg-brand-50 text-brand-600',
  ok: 'bg-ok-50 text-ok-600',
  warn: 'bg-warn-50 text-warn-600',
  danger: 'bg-danger-50 text-danger-600',
  info: 'bg-info-50 text-info-600',
  teal: 'bg-teal-50 text-teal-600',
  neutral: 'bg-ink-100 text-ink-600',
}
</script>

<template>
  <section
    class="overflow-hidden rounded-card bg-surface shadow-card ring-1 ring-ink-200/60"
    :class="
      interactive
        ? 'cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-pop hover:ring-brand-200'
        : ''
    "
  >
    <header
      v-if="title || $slots.header || $slots.actions"
      class="flex items-start justify-between gap-4 px-5 pt-5"
      :class="flush ? 'pb-4' : 'pb-0'"
    >
      <div v-if="title || subtitle" class="flex min-w-0 items-start gap-3">
        <span
          v-if="icon"
          class="grid size-9 shrink-0 place-items-center rounded-field"
          :class="TONE[tone]"
        >
          <UiIcon :name="icon" :size="18" />
        </span>
        <span class="min-w-0">
          <h3 class="truncate text-[16px] font-semibold text-ink-900">{{ title }}</h3>
          <p v-if="subtitle" class="mt-0.5 text-[13px] text-ink-500">{{ subtitle }}</p>
        </span>
      </div>
      <slot name="header" />
      <div v-if="$slots.actions" class="flex shrink-0 items-center gap-2">
        <slot name="actions" />
      </div>
    </header>

    <div :class="padded ? 'p-5' : ''">
      <slot />
    </div>

    <footer v-if="$slots.footer" class="border-t border-ink-100 bg-surface-sunken px-5 py-3.5">
      <slot name="footer" />
    </footer>
  </section>
</template>
