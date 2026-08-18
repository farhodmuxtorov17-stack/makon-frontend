<script setup lang="ts">
/**
 * Interfeys tili: o‘zbek yoki rus. Tanlov brauzer xotirasida saqlanadi va
 * sahifa yangilangandan keyin ham saqlanadi. `<html lang>` shu tanlovga mos
 * ravishda yangilanadi. Saqlash va tilni almashtirish `useLocaleChoice` da,
 * shuning uchun profil hamda sozlamalardagi tanlov ham shu yerga tushadi.
 */
import type { LocaleCode } from '~/composables/useLocaleChoice'

const { t, locales } = useI18n()

/**
 * Til nomi tanlangan interfeys tilida yoziladi: rus tiliga o‘tilganda
 * ro‘yxat ham rus tilida o‘qiladi. Ro‘yxatning o‘zi `nuxt.config.ts`
 * dagi `i18n.locales` dan olinadi, shuning uchun sarlavha, profil va
 * sozlamalardagi tanlov bir xil qatorlarni ko‘rsatadi.
 */
const LABEL_KEY: Record<LocaleCode, string> = {
  uz: 'shell.localeUz',
  ru: 'shell.localeRu',
}

const options = computed<Array<{ code: LocaleCode; short: string; label: string }>>(() =>
  (Object.keys(LABEL_KEY) as LocaleCode[])
    .filter((code) =>
      (locales.value as Array<{ code: string }>).length
        ? (locales.value as Array<{ code: string }>).some((l) => l.code === code)
        : true,
    )
    .map((code) => ({ code, short: code.toUpperCase(), label: t(LABEL_KEY[code]) })),
)

const { stored, pick } = useLocaleChoice()
const current = computed(
  () => options.value.find((o) => o.code === stored.value) ?? options.value[0]!,
)

useHead(() => ({ htmlAttrs: { lang: stored.value } }))

const open = ref(false)
const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)

onClickOutside(root, () => (open.value = false))

function close() {
  if (!open.value) return
  open.value = false
  trigger.value?.focus()
}

onKeyStroke('Escape', () => close())

function choose(code: LocaleCode) {
  pick(code)
  close()
}
</script>

<template>
  <div ref="root" class="relative">
    <button
      ref="trigger"
      type="button"
      class="inline-flex h-10 items-center gap-1.5 rounded-field px-2.5 text-[13px] font-semibold text-ink-700 ring-1 ring-inset ring-ink-200 transition-colors hover:bg-ink-100"
      :class="open ? 'bg-ink-100' : ''"
      aria-haspopup="menu"
      :aria-expanded="open"
      :aria-label="t('shell.localeAria', { label: current.label })"
      @click="open = !open"
    >
      <UiIcon name="globe" :size="17" class="text-ink-500" />
      {{ current.short }}
      <UiIcon
        name="chevronDown"
        :size="14"
        class="text-ink-400 transition-transform duration-150"
        :class="open ? 'rotate-180' : ''"
      />
    </button>

    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 -translate-y-1"
      leave-active-class="transition duration-100 ease-in"
      leave-to-class="opacity-0"
    >
      <ul
        v-if="open"
        role="menu"
        class="absolute right-0 z-30 mt-2 w-48 max-w-[calc(100vw-2rem)] overflow-hidden rounded-field bg-surface p-1 shadow-pop ring-1 ring-ink-200"
      >
        <li v-for="l in options" :key="l.code">
          <button
            type="button"
            role="menuitemradio"
            :aria-checked="l.code === stored"
            class="flex h-10 w-full items-center gap-2.5 rounded-[8px] px-3 text-left text-[13px] font-medium transition-colors hover:bg-ink-100"
            :class="l.code === stored ? 'text-brand-700' : 'text-ink-700'"
            @click="choose(l.code)"
          >
            <span
              class="grid size-6 shrink-0 place-items-center rounded-[6px] text-[10.5px] font-bold"
              :class="l.code === stored ? 'bg-brand-500 text-white' : 'bg-ink-100 text-ink-600'"
            >
              {{ l.short }}
            </span>
            <span class="flex-1 truncate">{{ l.label }}</span>
            <UiIcon v-if="l.code === stored" name="check" :size="15" class="text-brand-600" />
          </button>
        </li>
      </ul>
    </Transition>
  </div>
</template>
