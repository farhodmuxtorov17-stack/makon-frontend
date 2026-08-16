<script setup lang="ts" generic="T extends Record<string, any>">
export interface Column {
  key: string
  label: string
  align?: 'left' | 'right' | 'center'
  width?: string
  /** Raqamli ustunlar bir xil kenglikdagi raqamlar bilan tekislanadi */
  numeric?: boolean
}

const props = withDefaults(
  defineProps<{
    columns: Column[]
    rows: T[]
    rowKey?: string
    empty?: string
    /** Qator bosilganda o‘tiladigan manzilni qaytaruvchi funksiya */
    to?: (row: T) => string
  }>(),
  { rowKey: 'id', empty: 'Ma’lumot topilmadi' },
)

const emit = defineEmits<{ rowClick: [row: T] }>()

/**
 * `rowClick` e’lon qilingan emit bo‘lgani uchun Vue uni `$attrs` dan olib
 * tashlaydi: shuning uchun tinglovchi bor-yo‘qligi vnode props’dan aniqlanadi.
 */
const instance = getCurrentInstance()
const hasRowClick = Boolean(instance?.vnode.props?.onRowClick)

const clickable = computed(() => Boolean(props.to) || hasRowClick)

function activate(row: T) {
  if (props.to) navigateTo(props.to(row))
  else emit('rowClick', row)
}
</script>

<template>
  <div class="scroll-slim overflow-x-auto">
    <table class="w-full min-w-max border-collapse text-sm">
      <thead>
        <tr class="border-b border-ink-200 bg-surface-sunken">
          <th
            v-for="c in columns"
            :key="c.key"
            scope="col"
            class="px-4 py-3 text-[12px] font-semibold uppercase tracking-wide text-ink-500 whitespace-nowrap"
            :class="[
              c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left',
            ]"
            :style="c.width ? { width: c.width } : undefined"
          >
            {{ c.label }}
          </th>
        </tr>
      </thead>

      <tbody>
        <tr v-if="!rows.length">
          <td :colspan="columns.length" class="px-4 py-14 text-center text-ink-500">
            {{ empty }}
          </td>
        </tr>

        <tr
          v-for="row in rows"
          :key="String(row[rowKey])"
          class="border-b border-ink-100 transition-colors last:border-0 hover:bg-brand-50/40 focus-visible:bg-brand-50"
          :class="clickable ? 'cursor-pointer' : ''"
          :role="clickable ? 'button' : undefined"
          :tabindex="clickable ? 0 : undefined"
          @click="clickable && activate(row)"
          @keydown.enter.prevent="clickable && activate(row)"
          @keydown.space.prevent="clickable && activate(row)"
        >
          <td
            v-for="c in columns"
            :key="c.key"
            class="px-4 py-3.5 text-ink-700 align-middle"
            :class="[
              c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left',
              c.numeric ? 'tabular font-medium text-ink-900' : '',
            ]"
          >
            <slot :name="`cell-${c.key}`" :row="row" :value="row[c.key]">
              {{ row[c.key] }}
            </slot>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
