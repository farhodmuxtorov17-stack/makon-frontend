<script setup lang="ts">
import { scheduleTotals, type SchedulePeriod } from '~/stores/lease'
import { dateShort, sum } from '~/utils/format'

const props = withDefaults(
  defineProps<{
    rows: SchedulePeriod[]
    /** Ko‘rsatiladigan davrlar soni; qolganini «Barchasi» ochadi */
    limit?: number
  }>(),
  { limit: 6 },
)

const expanded = ref(false)

const visible = computed(() =>
  expanded.value ? props.rows : props.rows.slice(0, props.limit),
)

const hidden = computed(() => Math.max(0, props.rows.length - props.limit))

const totals = computed(() => scheduleTotals(props.rows))

const STATUS_LABEL: Record<string, string> = {
  PLANNED: 'Rejalashtirilgan',
  ISSUED: 'Tasdiqlangan',
  PAID: 'To‘langan',
}

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
            <th scope="col" class="px-4 py-3 text-left text-[11.5px] font-semibold uppercase tracking-wide text-ink-500">
              Sana
            </th>
            <th scope="col" class="px-4 py-3 text-left text-[11.5px] font-semibold uppercase tracking-wide text-ink-500">
              Davr
            </th>
            <th scope="col" class="px-4 py-3 text-right text-[11.5px] font-semibold uppercase tracking-wide text-ink-500">
              Summa
            </th>
            <th scope="col" class="px-4 py-3 text-right text-[11.5px] font-semibold uppercase tracking-wide text-ink-500">
              Holat
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
              <span v-if="r.kind === 'RENT' && r.service > 0" class="block text-[11.5px] text-ink-500">
                Ijara {{ sum(r.rent) }} · servis {{ sum(r.service) }}
              </span>
            </td>
            <td class="tabular whitespace-nowrap px-4 py-3 text-right text-[13px] font-bold text-ink-900">
              {{ sum(r.total) }}
            </td>
            <td class="px-4 py-3 text-right">
              <span
                class="inline-flex items-center gap-1.5 whitespace-nowrap rounded-pill px-2.5 py-1 text-[11.5px] font-semibold ring-1 ring-inset"
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
            <th scope="row" colspan="2" class="px-4 py-2.5 text-left text-[12.5px] font-semibold text-ink-600">
              Ijara to‘lovlari ({{ totals.periods }} ta davr)
            </th>
            <td class="tabular px-4 py-2.5 text-right text-[13px] font-bold text-ink-900">
              {{ sum(totals.total) }}
            </td>
            <td />
          </tr>
          <tr v-if="totals.deposit > 0" class="bg-surface-sunken">
            <th scope="row" colspan="2" class="px-4 py-2.5 text-left text-[12.5px] font-semibold text-ink-600">
              Kafolat depoziti
            </th>
            <td class="tabular px-4 py-2.5 text-right text-[13px] font-bold text-ink-900">
              {{ sum(totals.deposit) }}
            </td>
            <td />
          </tr>
          <tr class="border-t border-ink-200 bg-surface-sunken">
            <th scope="row" colspan="2" class="px-4 py-3 text-left text-[12.5px] font-semibold text-ink-700">
              Shartnoma bo‘yicha jami
            </th>
            <td class="tabular px-4 py-3 text-right text-[13.5px] font-extrabold text-brand-700">
              {{ sum(totals.total + totals.deposit) }}
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>

    <UiEmpty
      v-else
      icon="calendar"
      title="To‘lov grafigi hali hisoblanmagan"
      description="Kommersiya taklifi shartlarini kiriting, grafik avtomatik hisoblanadi."
      compact
    />

    <button
      v-if="hidden > 0"
      type="button"
      class="mt-3 inline-flex min-h-10 items-center gap-1.5 rounded-field px-3 text-[12.5px] font-semibold text-brand-600 transition-colors duration-150 hover:bg-brand-50"
      @click="expanded = !expanded"
    >
      <UiIcon :name="expanded ? 'chevronDown' : 'chevronRight'" :size="15" />
      {{ expanded ? 'Qisqartirish' : `Yana ${hidden} ta davrni ko‘rsatish` }}
    </button>
  </div>
</template>
