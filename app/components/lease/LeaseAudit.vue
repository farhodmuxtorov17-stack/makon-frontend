<script setup lang="ts">
import type { AuditEntry } from '~/stores/lease'
import { dateShort, timeOf } from '~/utils/format'

defineProps<{ entries: AuditEntry[] }>()

const ICON: Record<string, string> = {
  Ijarachi: 'user',
  'Bino rahbari': 'building',
  Buxgalter: 'wallet',
  'Bino egasi': 'shield',
  Avtomatik: 'gear',
}
</script>

<template>
  <ol v-if="entries.length" class="relative space-y-5 pl-8">
    <span class="absolute bottom-2 left-[13px] top-2 w-px bg-ink-200" aria-hidden="true" />
    <li v-for="(e, i) in entries" :key="`${e.at}-${i}`" class="relative">
      <span
        class="absolute -left-8 top-0 grid size-[27px] place-items-center rounded-full ring-4 ring-white"
        :class="i === entries.length - 1 ? 'bg-brand-500 text-white' : 'bg-ink-100 text-ink-600'"
      >
        <UiIcon :name="ICON[e.roleLabel] ?? 'clock'" :size="14" />
      </span>
      <p class="text-[14px] font-semibold text-ink-900">{{ e.action }}</p>
      <p class="tabular mt-0.5 text-[12px] text-ink-500">
        {{ dateShort(e.at) }} {{ timeOf(e.at) }} · {{ e.actor }}
        <span class="text-ink-400">({{ e.roleLabel }})</span>
      </p>
      <p v-if="e.detail" class="mt-1 text-[13px] leading-relaxed text-ink-600">{{ e.detail }}</p>
    </li>
  </ol>

  <UiEmpty
    v-else
    icon="clipboard"
    title="Audit yozuvlari yo‘q"
    description="Har bir bosqich o‘tishi kim, qachon va nima qilgani bilan shu yerda qayd etiladi."
    compact
  />
</template>
