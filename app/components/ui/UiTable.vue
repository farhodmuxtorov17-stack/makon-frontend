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
    /**
     * Bir sahifadagi qatorlar soni. Berilmasa jadval avvalgidek to‘liq
     * chiziladi, shuning uchun mavjud ekranlar o‘zgarmaydi.
     */
    pageSize?: number
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

/*
 * Sahifalash. Uzun reyestr birdan chizilganda sahifa balandligi o'n
 * minglab pikselga yetadi va brauzer sekinlashadi, foydalanuvchi esa
 * kerakli qatorni topa olmaydi.
 */
const page = ref(1)

const pageCount = computed(() =>
  props.pageSize ? Math.max(1, Math.ceil(props.rows.length / props.pageSize)) : 1,
)

const visibleRows = computed(() => {
  if (!props.pageSize) return props.rows
  const start = (page.value - 1) * props.pageSize
  return props.rows.slice(start, start + props.pageSize)
})

const rangeLabel = computed(() => {
  if (!props.pageSize || !props.rows.length) return ''
  const start = (page.value - 1) * props.pageSize + 1
  const end = Math.min(page.value * props.pageSize, props.rows.length)
  return `${start}\u2013${end} / ${props.rows.length}`
})

// Filtr o'zgarganda birinchi sahifaga qaytamiz, aks holda bo'sh sahifa qoladi
watch(
  () => props.rows.length,
  () => {
    if (page.value > pageCount.value) page.value = 1
  },
)

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

      <!--
        Bosiladigan qatorga role="button" berilmaydi: u qatorni jadval
        daraxtidan uzib, katakchalarni ustun sarlavhasidan ajratib qo‘yadi.
        Qator o‘z «row» rolida qoladi, klaviatura bilan ishlash esa
        tabindex va Enter/Space orqali saqlanadi.
      -->
      <tbody>
        <tr v-if="!rows.length">
          <td :colspan="columns.length" class="px-4 py-14 text-center text-ink-500">
            {{ empty }}
          </td>
        </tr>

        <tr
          v-for="row in visibleRows"
          :key="String(row[rowKey])"
          class="border-b border-ink-100 transition-colors last:border-0 hover:bg-brand-50/40 focus-visible:bg-brand-50"
          :class="clickable ? 'cursor-pointer' : ''"
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

    <!-- Sahifalash: faqat `pageSize` berilganda va bir sahifadan ko'p bo'lsa -->
    <div
      v-if="pageSize && pageCount > 1"
      class="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 px-4 py-3"
    >
      <p class="tabular text-[12px] text-ink-500">{{ rangeLabel }}</p>
      <div class="flex items-center gap-2">
        <UiButton variant="ghost" size="sm" :disabled="page === 1" @click="page -= 1">
          <UiIcon name="chevronLeft" :size="15" />
          Oldingi
        </UiButton>
        <span class="tabular text-[12px] font-semibold text-ink-700">
          {{ page }} / {{ pageCount }}
        </span>
        <UiButton variant="ghost" size="sm" :disabled="page === pageCount" @click="page += 1">
          Keyingi
          <UiIcon name="chevronRight" :size="15" />
        </UiButton>
      </div>
    </div>
  </div>
</template>
