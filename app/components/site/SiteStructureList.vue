<script setup lang="ts">
import { STRUCTURE_KIND, type Structure } from '~/data/structures'
import { area, num } from '~/utils/format'

/**
 * Uchastka qurilmalari ro‘yxati. Ijaraga beriladiganlari va xizmat
 * qurilmalari alohida guruhda turadi: rahbar avval daromad keltiradigan
 * qismni, keyin infratuzilmani ko‘radi.
 */
const props = defineProps<{ structures: Structure[] }>()

const selected = defineModel<string>('selected', { default: '' })

const TONE_ICON: Record<string, string> = {
  brand: 'bg-brand-50 text-brand-600',
  ok: 'bg-ok-50 text-ok-700',
  warn: 'bg-warn-50 text-warn-800',
  violet: 'bg-info-50 text-info-600',
  neutral: 'bg-ink-100 text-ink-600',
}

interface Row {
  id: string
  name: string
  kindLabel: string
  icon: string
  tone: string
  metric: string
  hint: string
}

function toRow(s: Structure): Row {
  const meta = STRUCTURE_KIND[s.kind]
  return {
    id: s.id,
    name: s.name,
    kindLabel: meta.label,
    icon: meta.icon,
    tone: meta.tone,
    metric: s.gla > 0 ? area(s.gla) : s.parkingSpaces ? `${num(s.parkingSpaces)} joy` : `${num(s.width * s.depth, 0)} m²`,
    hint: s.floors > 1 ? `${s.floors} qavat` : s.undergroundFloors ? `${s.undergroundFloors} yer osti qavat` : '1 qavat',
  }
}

const groups = computed(() => {
  const leasable = props.structures.filter((s) => STRUCTURE_KIND[s.kind].leasable)
  const service = props.structures.filter((s) => !STRUCTURE_KIND[s.kind].leasable)
  return [
    {
      key: 'leasable',
      title: 'Ijaraga beriladigan qurilmalar',
      icon: 'wallet',
      tone: 'text-ok-700',
      rows: leasable.map(toRow),
      total: area(leasable.reduce((s, x) => s + x.gla, 0)),
      totalLabel: 'ijara maydoni',
    },
    {
      key: 'service',
      title: 'Xizmat qurilmalari',
      icon: 'wrench',
      tone: 'text-ink-600',
      rows: service.map(toRow),
      total: `${num(service.reduce((s, x) => s + (x.parkingSpaces ?? 0), 0))} ta`,
      totalLabel: 'avtoturargoh joyi',
    },
  ].filter((g) => g.rows.length)
})

function pick(id: string) {
  selected.value = selected.value === id ? '' : id
}
</script>

<template>
  <div class="space-y-4">
    <section v-for="g in groups" :key="g.key">
      <div class="flex items-center justify-between gap-3">
        <span class="inline-flex items-center gap-2 text-[13px] font-bold" :class="g.tone">
          <UiIcon :name="g.icon" :size="15" />
          {{ g.title }}
          <span class="tabular rounded-pill bg-ink-100 px-2 py-0.5 text-[12px] text-ink-600">
            {{ g.rows.length }}
          </span>
        </span>
        <span class="tabular hidden text-[12px] text-ink-500 sm:inline">
          {{ g.total }} {{ g.totalLabel }}
        </span>
      </div>

      <ul class="mt-2 space-y-1.5">
        <li v-for="r in g.rows" :key="r.id">
          <button
            type="button"
            class="flex min-h-11 w-full items-center gap-3 rounded-field px-3 py-2 text-left ring-1 ring-inset transition-colors"
            :class="
              r.id === selected
                ? 'bg-brand-50 ring-brand-300'
                : 'ring-ink-200 hover:bg-ink-50 hover:ring-ink-300'
            "
            :aria-pressed="r.id === selected"
            @click="pick(r.id)"
          >
            <span
              class="grid size-9 shrink-0 place-items-center rounded-[9px]"
              :class="TONE_ICON[r.tone]"
            >
              <UiIcon :name="r.icon" :size="17" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-[13px] font-semibold text-ink-900">{{ r.name }}</span>
              <span class="block truncate text-[12px] text-ink-500">
                {{ r.kindLabel }} · {{ r.hint }}
              </span>
            </span>
            <span class="tabular shrink-0 text-[13px] font-semibold text-ink-700">
              {{ r.metric }}
            </span>
          </button>
        </li>
      </ul>
    </section>
  </div>
</template>
