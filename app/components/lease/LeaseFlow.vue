<script setup lang="ts">
import { LEASE_FLOW, type LeaseStatus } from '~/stores/lease'

const props = defineProps<{ status: LeaseStatus }>()

const { t, statusLabel } = useAppLabels()

/** Pog‘onada joy tor: bu holatlarning nomi qisqartirilgan shaklda chiqadi */
const SHORT_KEY: Record<string, string> = {
  SHARTNOMA_TAYYOR: 'ui.shortContractReady',
}

const rejected = computed(() => props.status === 'RAD_ETILDI')

const current = computed(() =>
  rejected.value ? -1 : LEASE_FLOW.indexOf(props.status),
)

const steps = computed(() =>
  LEASE_FLOW.map((s, i) => {
    const full = statusLabel('lease', s)
    return {
      key: s,
      label: SHORT_KEY[s] ? t(SHORT_KEY[s]!) : full,
      full,
      done: !rejected.value && i < current.value,
      active: !rejected.value && i === current.value,
    }
  }),
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
          <UiIcon v-if="s.done" name="check" :size="14" />
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
      <UiIcon name="x" :size="16" />
      {{ t('ui.leaseRejectedNote') }}
    </p>
  </div>
</template>
