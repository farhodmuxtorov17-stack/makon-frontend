<script setup lang="ts">
import { ROLE_META, ROLE_RING_CLASSES } from '~/constants/roles'
import type { Role } from '~/types/rbac'

/**
 * Foydalanuvchi avatari.
 *
 * Agar `public/img/people/{userId}.webp` mavjud bo‘lsa — haqiqiy fotosurat
 * ko‘rsatiladi. Fayl qo‘yilmagan bo‘lsa, ism-familiya bosh harflaridan
 * tuzilgan avatar chiziladi. Xodim suratlari papkaga qo‘shilgan zahoti
 * butun tizim bo‘ylab avtomatik almashadi.
 */
const props = withDefaults(
  defineProps<{
    /** Foydalanuvchi identifikatori — fotosurat fayl nomi shundan olinadi */
    userId?: string
    fullName: string
    role?: Role | null
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
    /** Rol rangidagi halqa */
    ring?: boolean
  }>(),
  { size: 'md', ring: false },
)

const failed = ref(false)

watch(
  () => props.userId,
  () => {
    failed.value = false
  },
)

const initials = computed(() =>
  props.fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase(),
)

const SIZES: Record<string, { box: string; text: string; px: number }> = {
  xs: { box: 'size-7', text: 'text-[10px]', px: 28 },
  sm: { box: 'size-9', text: 'text-[12px]', px: 36 },
  md: { box: 'size-10', text: 'text-[13px]', px: 40 },
  lg: { box: 'size-14', text: 'text-[17px]', px: 56 },
  xl: { box: 'size-20', text: 'text-[24px]', px: 80 },
}

const dims = computed(() => SIZES[props.size] ?? SIZES.md!)

/** Ism bo‘yicha barqaror rang — bir xil odam doim bir xil ohangda */
const TINTS = [
  'bg-brand-50 text-brand-700',
  'bg-teal-50 text-teal-700',
  'bg-info-50 text-info-700',
  'bg-warn-50 text-warn-700',
  'bg-lime-50 text-lime-700',
  'bg-rose-50 text-rose-700',
  'bg-indigo-50 text-indigo-700',
]

const tint = computed(() => {
  let h = 0
  for (const ch of props.fullName) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return TINTS[h % TINTS.length]!
})

const ringClass = computed(() =>
  props.ring && props.role
    ? `ring-2 ring-offset-2 ring-offset-white ${ROLE_RING_CLASSES[ROLE_META[props.role].tone]}`
    : '',
)

const src = computed(() => (props.userId ? `/img/people/${props.userId}.webp` : ''))
</script>

<template>
  <span
    class="relative grid shrink-0 place-items-center overflow-hidden rounded-full font-bold"
    :class="[dims.box, dims.text, ringClass, src && !failed ? 'bg-ink-100' : tint]"
    :title="fullName"
  >
    <img
      v-if="src && !failed"
      :src="src"
      :alt="fullName"
      :width="dims.px"
      :height="dims.px"
      loading="lazy"
      decoding="async"
      class="size-full object-cover"
      @error="failed = true"
    />
    <template v-else>{{ initials }}</template>
  </span>
</template>
