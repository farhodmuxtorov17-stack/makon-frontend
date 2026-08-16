<script setup lang="ts">
/**
 * MAKON belgisi: geometrik monogramma: «M» harfi ikki minora va ular
 * orasidagi o‘yiq shaklida qurilgan, ostida poydevor chizig‘i. Belgi 24px
 * balandlikda ham o‘qiladi, `mono` rejimida bir rangda chiziladi.
 */
withDefaults(
  defineProps<{
    size?: 'sm' | 'md' | 'lg'
    mono?: boolean
  }>(),
  { size: 'md' },
)

// Har bir nusxaning gradienti alohida, bir sahifada bir nechta belgi bo‘lsa
// ham havolalar chalkashmaydi.
const uid = `makon-${useId()}`

const MARK = { sm: 'size-7', md: 'size-9', lg: 'size-11' }
const WORD = { sm: 'text-[15px]', md: 'text-[19px]', lg: 'text-[23px]' }
const GAP = { sm: 'gap-2', md: 'gap-2.5', lg: 'gap-3' }

/** Monogramma konturi: ikki minora va ular orasidagi o‘yiq */
const GLYPH =
  'M10 25.9V10.3l10 7.4 10-7.4v15.6h-4.3v-7.1l-4.85 3.6a1.4 1.4 0 0 1-1.7 0L14.3 18.8v7.1z'
</script>

<template>
  <span class="inline-flex items-center" :class="GAP[size]">
    <svg :class="MARK[size]" class="shrink-0" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <template v-if="mono">
        <rect
          x="1.15"
          y="1.15"
          width="37.7"
          height="37.7"
          rx="10.6"
          stroke="currentColor"
          stroke-width="2.3"
        />
        <path :d="GLYPH" fill="currentColor" />
        <rect x="10" y="28.1" width="20" height="2.4" rx="1.2" fill="currentColor" opacity=".5" />
      </template>

      <template v-else>
        <rect width="40" height="40" rx="11.5" :fill="`url(#${uid}-brand)`" />
        <rect width="40" height="40" rx="11.5" :fill="`url(#${uid}-sheen)`" />
        <path :d="GLYPH" fill="white" />
        <rect x="10" y="28.1" width="20" height="2.4" rx="1.2" fill="white" fill-opacity=".5" />
        <defs>
          <linearGradient :id="`${uid}-brand`" x1="2" y1="0" x2="38" y2="40">
            <stop stop-color="#0256F7" />
            <stop offset=".55" stop-color="#2F8CF8" />
            <stop offset="1" stop-color="#17C3D4" />
          </linearGradient>
          <linearGradient :id="`${uid}-sheen`" x1="0" y1="0" x2="14" y2="34">
            <stop stop-color="#FFFFFF" stop-opacity=".22" />
            <stop offset=".6" stop-color="#FFFFFF" stop-opacity="0" />
          </linearGradient>
        </defs>
      </template>
    </svg>

    <span
      class="font-display font-extrabold leading-none tracking-[-0.02em]"
      :class="[WORD[size], mono ? 'text-current' : 'text-ink-900']"
    >
      MAKON
    </span>
  </span>
</template>
