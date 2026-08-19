<script setup lang="ts">
import { LEASE_STATUS } from '~/constants/statuses'
import { LEASE_FLOW, type LeaseStatus } from '~/stores/lease'

const props = defineProps<{ status: LeaseStatus }>()

const SHORT: Record<string, string> = {
  YANGI: 'Yangi ariza',
  SHARTNOMA_TAYYOR: 'Shartnoma tayyor',
  DIDOX_YUBORILDI: 'Didox’ga yuborildi',
  DIDOX_IMZOLANDI: 'Didox’da imzolandi',
  FAOL: 'Ariza yopildi',
}

const rejected = computed(() => props.status === 'RAD_ETILDI')

const current = computed(() =>
  rejected.value ? -1 : LEASE_FLOW.indexOf(props.status),
)

const steps = computed(() =>
  LEASE_FLOW.map((s, i) => ({
    key: s,
    label: SHORT[s] ?? LEASE_STATUS[s]?.label ?? s,
    full: LEASE_STATUS[s]?.label ?? s,
    done: !rejected.value && i < current.value,
    active: !rejected.value && i === current.value,
  })),
)
</script>

<template>
  <div>
    <ol class="flex flex-wrap gap-x-1 gap-y-3">
      <li v-for="(s, i) in steps" :key="s.key" class="flex min-w-0 flex-1 basis-[132px] items-center gap-2">
        <span
          class="grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-bold ring-1 ring-inset transition-colors duration-200"
          :class="
            s.done
              ? 'bg-ok-500 text-white ring-ok-500'
              : s.active
                ? 'bg-brand-500 text-white ring-brand-500'
                : rejected
                  ? 'bg-ink-100 text-ink-400 ring-ink-200'
                  : 'bg-white text-ink-400 ring-ink-200'
          "
          :aria-label="s.full"
        >
          <UiIcon v-if="s.done" name="check" :size="13" />
          <template v-else>{{ i + 1 }}</template>
        </span>
        <span
          class="min-w-0 truncate text-[12px] leading-tight"
          :class="s.active ? 'font-bold text-brand-700' : s.done ? 'font-semibold text-ink-700' : 'text-ink-500'"
          :title="s.full"
        >
          {{ s.label }}
        </span>
      </li>
    </ol>

    <p
      v-if="rejected"
      class="mt-3 inline-flex items-center gap-2 rounded-field bg-danger-50 px-3 py-2 text-[13px] font-semibold text-danger-700 ring-1 ring-inset ring-danger-100"
    >
      <UiIcon name="x" :size="15" />
      Ariza rad etilgan: sikl to‘xtatildi
    </p>
  </div>
</template>
