<script setup lang="ts">
/**
 * Obyekt fotosurati. `public/img/{name}-{sm|md|lg}.webp` fayllariga tayanadi
 * va brauzerga mos o‘lchamni tanlash imkonini beradi.
 */
const props = withDefaults(
  defineProps<{
    name: string
    alt: string
    /** Tashqi o‘ram uchun nisbat sinfi */
    ratio?: string
    /** Eng katta ko‘rsatiladigan kenglik — srcset tanlovi uchun */
    sizes?: string
    /** Shaffof fonli izometrik kesimlar uchun */
    contain?: boolean
    eager?: boolean
    rounded?: string
  }>(),
  {
    ratio: 'aspect-[4/3]',
    sizes: '(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw',
    contain: false,
    eager: false,
    rounded: 'rounded-panel',
  },
)

const failed = ref(false)

// Nom o‘zgarsa yangi rasmga qayta urinamiz — aks holda bir marta xato bergan
// komponent boshqa hech qachon rasm ko‘rsatmaydi.
watch(
  () => props.name,
  () => {
    failed.value = false
  },
)

const srcset = computed(() =>
  [
    `/img/${props.name}-sm.webp 480w`,
    `/img/${props.name}-md.webp 900w`,
    `/img/${props.name}-lg.webp 1600w`,
  ].join(', '),
)
</script>

<template>
  <div
    class="relative overflow-hidden bg-ink-100"
    :class="[ratio, rounded, contain ? 'bg-transparent' : '']"
  >
    <img
      v-if="!failed"
      :src="`/img/${name}-md.webp`"
      :srcset="srcset"
      :sizes="sizes"
      :alt="alt"
      :loading="eager ? 'eager' : 'lazy'"
      :fetchpriority="eager ? 'high' : 'auto'"
      decoding="async"
      class="size-full transition-transform duration-500"
      :class="contain ? 'object-contain' : 'object-cover'"
      @error="failed = true"
    />

    <!-- Rasm topilmasa — neytral o‘rin egallovchi, matnsiz -->
    <div v-else class="grid size-full place-items-center text-ink-300">
      <UiIcon name="building" :size="40" />
    </div>

    <slot />
  </div>
</template>
