<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string
    subtitle?: string
    size?: 'sm' | 'md' | 'lg' | 'xl'
  }>(),
  { size: 'md' },
)

const open = defineModel<boolean>({ required: true })

const SIZES = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
}

const overlay = ref<HTMLElement | null>(null)
const route = useRoute()

onKeyStroke('Escape', () => {
  if (open.value) open.value = false
})

/** Sahifa almashganda ochiq oyna yopiladi */
watch(
  () => route.fullPath,
  () => {
    if (open.value) open.value = false
  },
)

watchEffect(() => {
  if (import.meta.client) {
    document.body.style.overflow = open.value ? 'hidden' : ''
  }
})

/**
 * Teleport qilingan tugun chiqish animatsiyasi tugashini kutadi; komponent
 * shu orada yo‘q qilinsa tugun body’da osilib qoladi — shuning uchun uni
 * qo‘lda olib tashlaymiz.
 */
onBeforeUnmount(() => {
  if (!import.meta.client) return
  document.body.style.overflow = ''
  overlay.value?.remove()
})
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0"
      leave-active-class="transition duration-100 ease-in pointer-events-none"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        ref="overlay"
        class="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4 backdrop-blur-[2px]"
        @click.self="open = false"
      >
        <Transition
          appear
          enter-active-class="transition duration-200 ease-out"
          enter-from-class="opacity-0 scale-[0.97] translate-y-2"
        >
          <div
            role="dialog"
            aria-modal="true"
            :aria-label="title"
            class="flex max-h-[88vh] w-full min-w-0 flex-col overflow-hidden rounded-panel bg-surface shadow-pop"
            :class="SIZES[size]"
          >
            <header class="flex items-start justify-between gap-4 border-b border-ink-200 px-6 py-5">
              <div class="min-w-0">
                <h2 class="text-lg font-bold text-ink-900">{{ title }}</h2>
                <p v-if="subtitle" class="mt-1 text-[13px] text-ink-500">{{ subtitle }}</p>
              </div>
              <button
                type="button"
                class="-mr-1 -mt-1 rounded-lg p-2 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
                aria-label="Yopish"
                @click="open = false"
              >
                <svg class="size-5" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path
                    d="M5.5 5.5l9 9m0-9l-9 9"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                  />
                </svg>
              </button>
            </header>

            <div class="scroll-slim flex-1 overflow-y-auto px-6 py-5">
              <slot />
            </div>

            <footer
              v-if="$slots.footer"
              class="flex items-center justify-end gap-3 border-t border-ink-200 bg-surface-sunken px-6 py-4"
            >
              <slot name="footer" />
            </footer>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
