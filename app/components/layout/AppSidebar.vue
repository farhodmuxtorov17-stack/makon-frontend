<script setup lang="ts">
import { useMediaQuery, useStorage } from '@vueuse/core'
import { NAVIGATION, type NavItem } from '~/constants/navigation'

const auth = useAuthStore()
const route = useRoute()

const sections = computed(() => (auth.role ? NAVIGATION[auth.role] : []))
const meta = computed(() => auth.roleMeta)

/**
 * Planshetda yon panel doim tor tasma ko‘rinishida, kontent uchun joy
 * qoladi. Katta ekranda foydalanuvchi o‘zi yig‘ib qo‘yishi mumkin va tanlov
 * saqlanadi.
 */
const wideScreen = useMediaQuery('(min-width: 1280px)')
const collapsed = useStorage('makon.sidebar.collapsed', false)
const rail = computed(() => !wideScreen.value || collapsed.value)

const openGroups = ref<Set<string>>(new Set())

function matches(to: string) {
  return route.path === to || route.path.startsWith(`${to}/`)
}

/** Bir nechta yo‘l mos kelsa eng aniq (eng uzun) manzil tanlanadi. */
const activeTo = computed(() => {
  const all = sections.value
    .flatMap((s) => s.items)
    .flatMap((i) => [i.to, ...(i.children?.map((c) => c.to) ?? [])])
  return all.filter(matches).sort((a, b) => b.length - a.length)[0] ?? ''
})

function isActive(item: NavItem) {
  return item.to === activeTo.value || (item.children?.some((c) => c.to === activeTo.value) ?? false)
}

function groupOpen(item: NavItem) {
  return openGroups.value.has(item.to) || isActive(item)
}

function toggleGroup(to: string) {
  const next = new Set(openGroups.value)
  next.has(to) ? next.delete(to) : next.add(to)
  openGroups.value = next
}

/**
 * Tasma rejimida yorliq yonma-yon oynachada ko‘rsatiladi. Navigatsiya
 * ro‘yxati o‘zi aylanadigan blok bo‘lgani uchun oynacha `body` ga
 * ko‘chiriladi: aks holda u qirqilib qolardi.
 */
const hint = ref<{ item: NavItem; top: number } | null>(null)

function showHint(item: NavItem, event: Event) {
  if (!rail.value) return
  const target = event.currentTarget as HTMLElement | null
  if (!target) return
  hint.value = { item, top: target.getBoundingClientRect().top }
}

function hideHint() {
  hint.value = null
}

watch(rail, hideHint)
watch(() => route.fullPath, hideHint)
</script>

<template>
  <aside
    class="hidden h-dvh shrink-0 flex-col border-r border-ink-200 bg-surface md:flex"
    :class="rail ? 'w-[76px]' : 'w-[272px]'"
  >
    <!-- Logotip va yig‘ish boshqaruvi -->
    <div
      class="flex shrink-0 items-center"
      :class="rail ? 'flex-col justify-center gap-2 px-2 py-4' : 'h-[76px] justify-between px-5'"
    >
      <NuxtLink :to="meta?.home ?? '/'" class="flex rounded-lg">
        <span class="flex overflow-hidden" :class="rail ? 'w-9' : ''">
          <AppLogo />
        </span>
      </NuxtLink>

      <button
        v-if="wideScreen"
        type="button"
        class="grid size-9 shrink-0 place-items-center rounded-field text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
        :aria-label="collapsed ? 'Yon panelni yoyish' : 'Yon panelni yig‘ish'"
        :aria-pressed="collapsed"
        @click="collapsed = !collapsed"
      >
        <UiIcon :name="collapsed ? 'chevronRight' : 'chevronLeft'" :size="18" />
      </button>
    </div>

    <!-- Navigatsiya -->
    <nav
      class="scroll-slim flex-1 overflow-y-auto pb-4 pt-1"
      :class="rail ? 'px-2' : 'px-3'"
      aria-label="Bo‘limlar"
    >
      <div v-for="(section, si) in sections" :key="si" :class="si > 0 ? (rail ? 'mt-4' : 'mt-6') : ''">
        <div v-if="si > 0 && rail" class="mx-auto mb-3 h-px w-8 bg-ink-200" />

        <p
          v-if="section.title && !rail"
          class="mb-2 px-3 text-[10px] font-bold uppercase tracking-wider text-ink-400"
        >
          {{ section.title }}
        </p>

        <ul :class="rail ? 'space-y-1.5' : 'space-y-0.5'">
          <li
            v-for="item in section.items"
            :key="item.to"
            @mouseenter="showHint(item, $event)"
            @mouseleave="hideHint"
            @focusin="showHint(item, $event)"
            @focusout="hideHint"
          >
            <!-- Bo‘lim (ichki menyuli) -->
            <template v-if="item.children && !rail">
              <button
                type="button"
                class="flex w-full items-center gap-3 rounded-field px-3 py-2.5 text-left text-[13.5px] font-semibold transition-colors"
                :class="
                  isActive(item)
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900'
                "
                :aria-expanded="groupOpen(item)"
                @click="toggleGroup(item.to)"
              >
                <UiIcon :name="item.icon" :size="19" />
                <span class="flex-1 truncate">{{ item.label }}</span>
                <UiIcon
                  name="chevronDown"
                  :size="15"
                  class="transition-transform"
                  :class="groupOpen(item) ? '' : '-rotate-90'"
                />
              </button>

              <ul v-show="groupOpen(item)" class="mt-0.5 space-y-0.5 pl-[38px]">
                <li v-for="child in item.children" :key="child.to">
                  <NuxtLink
                    :to="child.to"
                    class="block rounded-[8px] px-3 py-2 text-[13px] font-medium transition-colors"
                    :class="
                      child.to === activeTo
                        ? 'bg-brand-50 font-semibold text-brand-700'
                        : 'text-ink-500 hover:bg-ink-100 hover:text-ink-800'
                    "
                  >
                    {{ child.label }}
                  </NuxtLink>
                </li>
              </ul>
            </template>

            <!-- Oddiy havola (tasma rejimida bo‘limlar ham havola bo‘ladi) -->
            <NuxtLink
              v-else
              :to="item.to"
              class="relative flex items-center rounded-field font-semibold transition-colors"
              :class="[
                rail
                  ? 'mx-auto size-11 justify-center'
                  : 'gap-3 px-3 py-2.5 text-[13.5px]',
                isActive(item)
                  ? 'bg-brand-500 text-white shadow-brand'
                  : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900',
              ]"
              :aria-label="rail ? item.label : undefined"
              :aria-current="isActive(item) ? 'page' : undefined"
            >
              <UiIcon :name="item.icon" :size="rail ? 21 : 19" />

              <span v-if="!rail" class="flex-1 truncate">{{ item.label }}</span>

              <span
                v-if="item.badge"
                class="tabular grid min-w-5 place-items-center rounded-pill text-[11px] font-bold"
                :class="[
                  rail
                    ? 'absolute -right-1 -top-1 bg-danger-500 px-1 leading-4 text-white ring-2 ring-surface'
                    : isActive(item)
                      ? 'bg-white/25 px-1.5 py-0.5 text-white'
                      : 'bg-danger-500 px-1.5 py-0.5 text-white',
                ]"
              >
                {{ item.badge }}
              </span>
            </NuxtLink>
          </li>
        </ul>
      </div>
    </nav>

    <!-- Qo‘llab-quvvatlash -->
    <div class="shrink-0" :class="rail ? 'px-2 pb-4' : 'p-3'">
      <NuxtLink
        v-if="rail"
        to="/help"
        class="mx-auto grid size-11 place-items-center rounded-field bg-brand-500 text-white shadow-brand transition-transform duration-200 hover:-translate-y-0.5"
        aria-label="Yordam markazi, 24/7 qo‘llab-quvvatlash"
        @mouseenter="showHint({ label: 'Yordam markazi', to: '/help', icon: 'headset' }, $event)"
        @mouseleave="hideHint"
        @focusin="showHint({ label: 'Yordam markazi', to: '/help', icon: 'headset' }, $event)"
        @focusout="hideHint"
      >
        <UiIcon name="headset" :size="21" />
      </NuxtLink>

      <NuxtLink
        v-else
        to="/help"
        class="flex items-center gap-3 rounded-panel bg-gradient-to-br from-brand-50 to-brand-100/70 p-3.5 ring-1 ring-inset ring-brand-100 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card hover:ring-brand-300"
      >
        <span class="min-w-0 flex-1">
          <span class="block text-[12.5px] font-semibold text-ink-900">Yordam markazi</span>
          <span class="tabular mt-0.5 block text-[14px] font-bold text-brand-700">
            +998 71 205 00 00
          </span>
          <span class="mt-0.5 block text-[11px] text-ink-500">24/7 qo‘llab-quvvatlash</span>
        </span>
        <span
          class="grid size-11 shrink-0 place-items-center rounded-field bg-brand-500 text-white shadow-brand"
        >
          <UiIcon name="headset" :size="22" />
        </span>
      </NuxtLink>
    </div>
  </aside>

  <!-- Tasma rejimidagi yorliq oynachasi -->
  <Teleport to="body">
    <div
      v-if="hint"
      role="tooltip"
      class="pointer-events-none fixed left-[76px] z-50 pl-2"
      :style="{ top: `${hint.top}px` }"
    >
      <div class="max-w-[220px] rounded-field bg-ink-900 px-3 py-2 shadow-pop">
        <p class="whitespace-nowrap text-[12.5px] font-semibold leading-[26px] text-white">
          {{ hint.item.label }}
        </p>
      </div>
    </div>
  </Teleport>
</template>
