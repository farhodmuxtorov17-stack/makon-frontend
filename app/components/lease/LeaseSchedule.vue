<script setup lang="ts">
import { scheduleTotals, type SchedulePeriod } from '~/stores/lease'
import { dateShort } from '~/utils/format'

const props = withDefaults(
  defineProps<{
    rows: SchedulePeriod[]
    /** Ko‘rsatiladigan davrlar soni; qolganini «Barchasi» ochadi */
    limit?: number
  }>(),
  { limit: 6 },
)

const { money, t, field, statusLabel } = useAppLabels()

const expanded = ref(false)

const visible = computed(() =>
  expanded.value ? props.rows : props.rows.slice(0, props.limit),
)

const hidden = computed(() => Math.max(0, props.rows.length - props.limit))

const totals = computed(() => scheduleTotals(props.rows))

const STATUS_LABEL = computed<Record<string, string>>(() => ({
  PLANNED: t('ui.schedulePlanned'),
  ISSUED: t('ui.scheduleIssued'),
  PAID: statusLabel('invoice', 'PAID'),
}))

const STATUS_CLASS: Record<string, string> = {
  PLANNED: 'bg-ink-100 text-ink-700 ring-ink-200',
  ISSUED: 'bg-brand-50 text-brand-700 ring-brand-200',
  PAID: 'bg-ok-50 text-ok-700 ring-ok-100',
}
</script>

<template>
  <div>
    <div v-if="rows.length" class="scroll-slim overflow-x-auto rounded-field ring-1 ring-ink-200">
      <table class="w-full min-w-[520px] border-collapse text-sm">
        <thead>
          <tr class="border-b border-ink-200 bg-surface-sunken">
            <th scope="col" class="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wide text-ink-500">
              {{ field('date') }}
            </th>
            <th scope="col" class="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wide text-ink-500">
              {{ field('period') }}
            </th>
            <th scope="col" class="px-4 py-3 text-right text-[12px] font-semibold uppercase tracking-wide text-ink-500">
              {{ field('amount') }}
            </th>
            <th scope="col" class="px-4 py-3 text-right text-[12px] font-semibold uppercase tracking-wide text-ink-500">
              {{ field('status') }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="r in visible"
            :key="r.id"
            class="border-b border-ink-100 last:border-0"
            :class="r.kind === 'DEPOSIT' ? 'bg-warn-50/40' : ''"
          >
            <td class="tabular whitespace-nowrap px-4 py-3 text-[13px] font-medium text-ink-900">
              {{ dateShort(r.dueAt) }}
            </td>
            <td class="px-4 py-3 text-[13px] text-ink-700">
              {{ r.label }}
              <span v-if="r.kind === 'RENT' && r.service > 0" class="block text-[12px] text-ink-500">
                {{ t('ui.rentServiceSplit', { rent: money(r.rent), service: money(r.service) }) }}
              </span>
            </td>
            <td class="tabular whitespace-nowrap px-4 py-3 text-right text-[13px] font-bold text-ink-900">
              {{ money(r.total) }}
            </td>
            <td class="px-4 py-3 text-right">
              <span
                class="inline-flex items-center gap-1.5 whitespace-nowrap rounded-pill px-2.5 py-1 text-[12px] font-semibold ring-1 ring-inset"
                :class="STATUS_CLASS[r.status]"
              >
                <UiIcon :name="r.status === 'PLANNED' ? 'clock' : 'check'" :size="12" />
                {{ STATUS_LABEL[r.status] }}
              </span>
            </td>
          </tr>
        </tbody>
        <!--
          Jadvalda depozit qatori ham ko‘rinadi, shuning uchun jamlanma uch
          satrga bo‘lindi: ijara to‘lovlari, depozit va ustun bo‘yicha yakun.
          Aks holda ustundagi sonlar yig‘indisi pastdagi son bilan mos kelmaydi.
        -->
        <tfoot>
          <tr class="border-t border-ink-200 bg-surface-sunken">
            <th scope="row" colspan="2" class="px-4 py-2.5 text-left text-[13px] font-semibold text-ink-600">
              {{ t('ui.rentPaymentsPeriods', { count: totals.periods }) }}
            </th>
            <td class="tabular px-4 py-2.5 text-right text-[13px] font-bold text-ink-900">
              {{ money(totals.total) }}
            </td>
            <td />
          </tr>
          <tr v-if="totals.deposit > 0" class="bg-surface-sunken">
            <th scope="row" colspan="2" class="px-4 py-2.5 text-left text-[13px] font-semibold text-ink-600">
              {{ t('ui.securityDeposit') }}
            </th>
            <td class="tabular px-4 py-2.5 text-right text-[13px] font-bold text-ink-900">
              {{ money(totals.deposit) }}
            </td>
            <td />
          </tr>
          <tr class="border-t border-ink-200 bg-surface-sunken">
            <th scope="row" colspan="2" class="px-4 py-3 text-left text-[13px] font-semibold text-ink-700">
              {{ t('ui.contractTotal') }}
            </th>
            <td class="tabular px-4 py-3 text-right text-[14px] font-extrabold text-brand-700">
              {{ money(totals.total + totals.deposit) }}
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>

    <UiEmpty
      v-else
      icon="calendar"
      :title="t('ui.scheduleEmptyTitle')"
      :description="t('ui.scheduleEmptyText')"
      compact
    />

    <button
      v-if="hidden > 0"
      type="button"
      class="mt-3 inline-flex min-h-10 items-center gap-1.5 rounded-field px-3 text-[13px] font-semibold text-brand-600 transition-colors duration-150 hover:bg-brand-50"
      @click="expanded = !expanded"
    >
      <UiIcon :name="expanded ? 'chevronDown' : 'chevronRight'" :size="16" />
      {{ expanded ? t('ui.collapse') : t('ui.showMorePeriods', { count: hidden }) }}
    </button>
  </div>
</template>
