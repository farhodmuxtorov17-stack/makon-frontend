<script setup lang="ts">
import type { ActivationChange } from '~/stores/lease'
import { dateShort, timeOf } from '~/utils/format'

defineProps<{ at: string; changes: ActivationChange[] }>()
</script>

<template>
  <div class="rounded-card bg-ok-50 p-5 ring-1 ring-inset ring-ok-100">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <span class="grid size-10 shrink-0 place-items-center rounded-field bg-ok-500 text-white">
          <UiIcon name="check" :size="20" />
        </span>
        <div>
          <p class="text-[15px] font-bold text-ok-700">Ariza yopildi</p>
          <p class="tabular text-[12.5px] text-ok-600">
            {{ dateShort(at) }} {{ timeOf(at) }}, amalga oshirilgan o‘zgarishlar
          </p>
        </div>
      </div>
      <span
        class="rounded-pill bg-white px-3 py-1.5 text-[12px] font-bold text-ok-700 ring-1 ring-inset ring-ok-100"
      >
        {{ changes.length }} ta o‘zgarish
      </span>
    </div>

    <ul class="mt-4 grid gap-2.5">
      <li
        v-for="c in changes"
        :key="c.label"
        class="flex items-start gap-3 rounded-field bg-white px-4 py-3 ring-1 ring-inset ring-ok-100"
      >
        <span class="grid size-9 shrink-0 place-items-center rounded-[10px] bg-ok-50 text-ok-600">
          <UiIcon :name="c.icon" :size="18" />
        </span>
        <span class="min-w-0">
          <span class="block text-[13.5px] font-semibold text-ink-900">{{ c.label }}</span>
          <span v-if="c.detail" class="mt-0.5 block text-[12.5px] leading-relaxed text-ink-600">
            {{ c.detail }}
          </span>
        </span>
      </li>
    </ul>
  </div>
</template>
