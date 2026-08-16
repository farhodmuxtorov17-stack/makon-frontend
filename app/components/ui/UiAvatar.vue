<script setup lang="ts">
import { ROLE_META, ROLE_RING_CLASSES } from '~/constants/roles'
import type { Role } from '~/types/rbac'

/**
 * Foydalanuvchi avatari.
 *
 * Agar `public/img/people/{userId}.webp` mavjud bo‘lsa, haqiqiy fotosurat
 * ko‘rsatiladi. Fayl qo‘yilmagan bo‘lsa, ism-familiya bosh harflaridan
 * tuzilgan avatar chiziladi. Xodim suratlari papkaga qo‘shilgan zahoti
 * butun tizim bo‘ylab avtomatik almashadi.
 */
const props = withDefaults(
  defineProps<{
    /** Foydalanuvchi identifikatori, fotosurat fayl nomi shundan olinadi */
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

/**
 * Ism bo‘yicha barqaror ohang: bir xil odam doim bir xil rangda ko‘rinadi.
 * Gradient yuzaga chuqurlik beradi, ustidagi yorug‘lik esa avatarni yassi
 * doiradan ajratib turadi.
 */
const TINTS = [
  { from: '#4E8BFB', to: '#0139B0' },
  { from: '#3FBDA8', to: '#04835D' },
  { from: '#A98BF2', to: '#6A3BC4' },
  { from: '#F5B45C', to: '#BD6512' },
  { from: '#9ACD5A', to: '#4E7D1C' },
  { from: '#F2789A', to: '#B81F49' },
  { from: '#7C8CEE', to: '#3A45B0' },
]

const tint = computed(() => {
  let h = 0
  for (const ch of props.fullName) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return TINTS[h % TINTS.length]!
})

const tintStyle = computed(() => ({
  backgroundImage: `linear-gradient(145deg, ${tint.value.from} 0%, ${tint.value.to} 100%)`,
}))

const ringClass = computed(() =>
  props.ring && props.role
    ? `ring-2 ring-offset-2 ring-offset-white ${ROLE_RING_CLASSES[ROLE_META[props.role].tone]}`
    : '',
)

const src = computed(() => (props.userId ? assetUrl(`img/people/${props.userId}.webp`) : ''))
</script>

<template>
  <span
    class="relative grid shrink-0 place-items-center overflow-hidden rounded-full font-bold text-white"
    :class="[dims.box, dims.text, ringClass, src && !failed ? 'bg-ink-100' : '']"
    :style="src && !failed ? undefined : tintStyle"
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

    <template v-else>
      <!-- Yuqoridan tushuvchi yumshoq yorug‘lik -->
      <span
        class="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/25 to-transparent"
        aria-hidden="true"
      />
      <span class="relative tracking-wide drop-shadow-[0_1px_1px_rgba(0,0,0,0.25)]">
        {{ initials }}
      </span>
    </template>
  </span>
</template>
