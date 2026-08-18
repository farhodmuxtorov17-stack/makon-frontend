<script setup lang="ts">
import { FIELD_CONTEXT } from '~/composables/useField'

const { t } = useAppLabels()

const props = defineProps<{
  label?: string
  required?: boolean
  hint?: string
  error?: string
  /** Tashqaridan berilgan `id`; berilmasa maydon uni o‘zi yaratadi */
  for?: string
}>()

/**
 * Yorliq boshqaruv elementining yonida turadi, shuning uchun bog‘lanish
 * faqat `for`/`id` juftligi orqali bo‘ladi. Chaqiruv joylari `for` bermasa,
 * maydon `id` ni o‘zi yaratadi va uni ikki yo‘l bilan uzatadi: `UiInput` va
 * `UiSelect` ga kontekst orqali, oddiy `input`/`select`/`textarea` ga esa DOM
 * darajasida, chunki ular komponent emas va kontekstni o‘qiy olmaydi.
 */
const generated = useId()
const controlId = computed(() => props.for || generated)
const errorId = computed(() => `${controlId.value}-error`)
const hintId = computed(() => `${controlId.value}-hint`)
const describedBy = computed(() =>
  props.error ? errorId.value : props.hint ? hintId.value : undefined,
)

provide(FIELD_CONTEXT, { id: controlId, describedBy })

const root = ref<HTMLElement | null>(null)

function linkPlainControl() {
  const el = root.value?.querySelector<HTMLElement>('input, select, textarea')
  if (!el || el.id) return
  el.id = controlId.value
  if (describedBy.value && !el.getAttribute('aria-describedby')) {
    el.setAttribute('aria-describedby', describedBy.value)
  }
}

onMounted(linkPlainControl)
onUpdated(linkPlainControl)
</script>

<template>
  <div ref="root" class="min-w-0">
    <label
      v-if="label"
      :for="controlId"
      class="mb-1.5 flex items-center gap-1 text-[13px] font-semibold text-ink-700"
    >
      {{ label }}
      <span v-if="required" class="text-danger-500" aria-hidden="true">*</span>
      <span v-if="required" class="sr-only">{{ t('common.requiredField') }}</span>
    </label>

    <slot />

    <p
      v-if="error"
      :id="errorId"
      role="alert"
      class="mt-1.5 text-[12px] font-medium text-danger-600"
    >
      {{ error }}
    </p>
    <p v-else-if="hint" :id="hintId" class="mt-1.5 text-[12px] text-ink-500">{{ hint }}</p>
  </div>
</template>
