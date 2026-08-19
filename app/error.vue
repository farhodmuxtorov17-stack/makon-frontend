<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()

const auth = useAuthStore()

const isForbidden = computed(() => props.error.statusCode === 403)
const home = computed(() => auth.roleMeta?.home ?? '/')
</script>

<template>
  <div class="grid min-h-dvh place-items-center bg-canvas p-6">
    <div class="w-full max-w-md rounded-panel bg-surface p-8 text-center shadow-panel ring-1 ring-ink-200/60">
      <span
        class="mx-auto grid size-16 place-items-center rounded-full"
        :class="isForbidden ? 'bg-warn-50 text-warn-600' : 'bg-brand-50 text-brand-600'"
      >
        <UiIcon :name="isForbidden ? 'lock' : 'search'" :size="30" />
      </span>

      <p class="mt-5 font-display text-4xl font-extrabold text-ink-900">
        {{ error.statusCode }}
      </p>
      <h1 class="mt-2 text-lg font-bold text-ink-900">
        {{ isForbidden ? 'Ruxsat berilmagan' : 'Sahifa topilmadi' }}
      </h1>
      <p class="mt-2 text-[14px] leading-relaxed text-ink-600">
        {{
          isForbidden
            ? 'Ushbu bo‘limga kirish sizning rolingiz doirasiga kirmaydi. Zarur bo‘lsa tizim administratoriga murojaat qiling.'
            : 'So‘ralgan sahifa mavjud emas yoki ko‘chirilgan bo‘lishi mumkin.'
        }}
      </p>

      <div class="mt-6 flex justify-center gap-3">
        <UiButton variant="secondary" @click="clearError({ redirect: home })">
          <UiIcon name="chevronLeft" :size="16" />
          Orqaga
        </UiButton>
        <UiButton @click="clearError({ redirect: home })">Bosh sahifaga</UiButton>
      </div>
    </div>
  </div>
</template>
