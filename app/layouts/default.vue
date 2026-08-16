<script setup lang="ts">
/**
 * Ish maydoni karkasi. Telefonda yon panel butunlay olib qo‘yiladi — uning
 * o‘rnini pastki navigatsiya qatori egallaydi; planshetdan boshlab yon panel
 * qaytadi (planshetda tor tasma, katta ekranda yorliqlar bilan).
 */
const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const home = computed(() => auth.roleMeta?.home ?? '/')
const showBack = computed(() => route.path !== home.value)

function goBack() {
  const previous = router.options.history.state.back
  if (typeof previous === 'string') router.back()
  else navigateTo(home.value)
}
</script>

<template>
  <div class="flex min-h-dvh bg-canvas">
    <AppSidebar class="sticky top-0" />

    <div class="flex min-w-0 flex-1 flex-col pb-[calc(58px+env(safe-area-inset-bottom))] md:pb-0">
      <!-- Telefon sarlavha qatori -->
      <div
        class="flex h-14 shrink-0 items-center gap-1 border-b border-ink-200 bg-surface px-2 md:hidden"
      >
        <button
          v-if="showBack"
          type="button"
          class="grid size-11 shrink-0 place-items-center rounded-field text-ink-600 transition-colors hover:bg-ink-100 active:bg-ink-100"
          aria-label="Orqaga qaytish"
          @click="goBack"
        >
          <UiIcon name="chevronLeft" :size="21" />
        </button>

        <NuxtLink :to="home" class="flex h-11 min-w-0 items-center rounded-lg px-2">
          <AppLogo size="sm" />
        </NuxtLink>
      </div>

      <slot />
    </div>

    <AppBottomNav />
  </div>
</template>
