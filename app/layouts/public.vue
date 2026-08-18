<script setup lang="ts">
import { useStorage } from '@vueuse/core'
import { BUILDINGS } from '~/data/buildings'

const route = useRoute()

/** Sahifa butun ekranni egallasa (katalog qidiruvi), pastki blok chiqarilmaydi */
const fullscreen = computed(() => route.meta.fullscreen === true)

/** Sarlavhadagi ixcham menyu */
const HEADER_NAV = [
  { label: 'Katalog', to: '/catalog' },
  { label: 'Obyekt joylash', to: '/register' },
]

const NAV = [
  { label: 'Katalog', to: '/catalog' },
  { label: 'Obyekt joylash', to: '/register' },
  { label: 'Obyektlar', to: '/#obyektlar' },
  { label: 'Xarita', to: '/#xarita' },
  { label: 'Xizmatlar', to: '/#xizmatlar' },
  { label: 'Sevimlilar', to: '/catalog?fav=1' },
  { label: 'Yordam markazi', to: '/help' },
]

const favourites = useStorage<string[]>('makon.favourites', [])

/** Pastki blokda eng yirik obyektlar, qolganlari katalog orqali ochiladi */
const footerBuildings = [...BUILDINGS].sort((a, b) => b.gla - a.gla).slice(0, 6)

const QUICK = [
  { label: 'Bo‘sh joylar katalogi', to: '/catalog' },
  { label: 'Obyektlar xaritasi', to: '/#xarita' },
  { label: 'Xizmatlar', to: '/#xizmatlar' },
  { label: 'Tizim haqida', to: '/#tizim' },
  { label: 'Yangiliklar', to: '/#blog' },
]

const CATEGORIES = [
  { label: 'Biznes markazlar', to: '/catalog?type=biznes' },
  { label: 'Savdo markazlar', to: '/catalog?type=savdo' },
  { label: 'Ombor va logistika', to: '/catalog?type=ombor' },
  { label: 'Turar joylar', to: '/catalog?type=turar' },
]

const CONTACTS = [
  {
    d: 'M12 21s7-5.8 7-11a7 7 0 1 0-14 0c0 5.2 7 11 7 11zM12 12.6a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2z',
    label: 'Toshkent, Amir Temur ko‘chasi 88',
    note: 'Bosh ofis, Green Business Center, 7-qavat',
    href: '',
  },
  {
    d: 'M6.5 3.5h3l1.5 4-2 1.5a11 11 0 0 0 5 5l1.5-2 4 1.5v3a2 2 0 0 1-2 2A15.5 15.5 0 0 1 4.5 5.5a2 2 0 0 1 2-2z',
    label: '+998 71 200 00 88',
    note: 'Ijara va katalog bo‘yicha murojaatlar',
    href: 'tel:+998712000088',
  },
  {
    d: 'M3.5 6.5h17v11h-17zM3.5 7l8.5 6 8.5-6',
    label: 'info@makon.uz',
    note: 'Hujjat va shartnoma masalalari',
    href: 'mailto:info@makon.uz',
  },
  {
    d: 'M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17zM12 7.2V12l3 1.9',
    label: 'Dushanba – shanba, 09:00 – 19:00',
    note: 'Servis navbatchiligi 24/7 rejimida',
    href: '',
  },
]

const year = new Date().getFullYear()

function isActive(to: string) {
  if (to.startsWith('/#')) return route.path === '/' && route.hash === to.slice(1)
  return route.path === to || route.path.startsWith(`${to}/`)
}

const scrolled = ref(false)

function onScroll() {
  scrolled.value = window.scrollY > 40
}

const menuOpen = ref(false)
const drawer = ref<HTMLElement | null>(null)
const menuToggle = ref<HTMLButtonElement | null>(null)

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function focusables(): HTMLElement[] {
  if (!drawer.value) return []
  return Array.from(drawer.value.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.offsetParent !== null,
  )
}

function closeMenu() {
  menuOpen.value = false
}

function onKeydown(e: KeyboardEvent) {
  if (!menuOpen.value) return

  if (e.key === 'Escape') {
    e.preventDefault()
    closeMenu()
    return
  }

  if (e.key !== 'Tab') return

  const items = focusables()
  if (!items.length) return

  const first = items[0]!
  const last = items[items.length - 1]!
  const current = document.activeElement as HTMLElement | null
  const inside = !!current && !!drawer.value?.contains(current)

  if (e.shiftKey && (!inside || current === first)) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && (!inside || current === last)) {
    e.preventDefault()
    first.focus()
  }
}

watch(menuOpen, async (open) => {
  document.body.style.overflow = open ? 'hidden' : ''
  if (open) {
    await nextTick()
    focusables()[0]?.focus()
  } else {
    menuToggle.value?.focus()
  }
})

watch(
  () => route.fullPath,
  () => {
    if (menuOpen.value) menuOpen.value = false
  },
)

onMounted(() => {
  onScroll()
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})
</script>

<template>
  <div
    class="flex min-h-dvh flex-col bg-canvas"
    :class="fullscreen ? 'lg:h-dvh lg:overflow-hidden' : ''"
  >
    <header
      class="sticky top-0 z-40 border-b bg-surface/90 backdrop-blur-md transition-shadow duration-200 ease-out"
      :class="scrolled ? 'border-ink-200 shadow-card' : 'border-ink-200/60'"
    >
      <div
        class="mx-auto flex max-w-[1360px] items-center gap-4 px-4 transition-[height] duration-200 ease-out lg:px-8"
        :class="scrolled ? 'h-[58px]' : 'h-[76px]'"
      >
        <NuxtLink to="/" class="shrink-0" aria-label="MAKON bosh sahifa">
          <AppLogo :size="scrolled ? 'sm' : 'md'" />
        </NuxtLink>

        <nav class="ml-3 hidden items-center gap-0.5 lg:flex" aria-label="Asosiy menyu">
          <NuxtLink
            v-for="n in HEADER_NAV"
            :key="n.to"
            :to="n.to"
            class="rounded-field px-3 py-2 text-[13.5px] font-semibold transition-colors duration-150"
            :class="
              isActive(n.to)
                ? 'bg-brand-50 text-brand-700'
                : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900'
            "
            :aria-current="isActive(n.to) ? 'page' : undefined"
          >
            {{ n.label }}
          </NuxtLink>
        </nav>

        <div class="ml-auto flex items-center gap-1.5">
          <NuxtLink
            to="/catalog?fav=1"
            class="relative grid size-10 place-items-center rounded-field text-ink-600 transition-colors duration-150 hover:bg-ink-100 hover:text-danger-500"
            aria-label="Sevimli e’lonlar"
          >
            <svg
              class="size-[19px]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.7"
              aria-hidden="true"
            >
              <path
                d="M12 20.2 4.9 13.3a4.6 4.6 0 0 1 6.5-6.5l.6.6.6-.6a4.6 4.6 0 0 1 6.5 6.5z"
                stroke-linejoin="round"
              />
            </svg>
            <span
              v-if="favourites.length"
              class="tabular absolute right-0.5 top-0.5 min-w-[16px] rounded-full bg-danger-500 px-1 text-center text-[10px] font-bold leading-4 text-white"
            >
              {{ favourites.length }}
            </span>
          </NuxtLink>

          <LocaleSwitch class="hidden md:block" />

          <NuxtLink
            to="/help"
            class="hidden size-10 place-items-center rounded-field text-ink-600 transition-colors duration-150 hover:bg-ink-100 hover:text-ink-900 md:grid"
            aria-label="Yordam markazi"
          >
            <UiIcon name="help" :size="19" />
          </NuxtLink>

          <NuxtLink
            to="/profile"
            class="hidden size-10 place-items-center rounded-field text-ink-600 transition-colors duration-150 hover:bg-ink-100 hover:text-ink-900 md:grid"
            aria-label="Shaxsiy kabinet"
          >
            <UiIcon name="user" :size="19" />
          </NuxtLink>

          <UiButton size="sm" to="/login" class="ml-1 hidden md:inline-flex">Kirish</UiButton>

          <button
            ref="menuToggle"
            type="button"
            class="grid size-10 place-items-center rounded-field text-ink-700 ring-1 ring-inset ring-ink-200 transition-colors duration-150 hover:bg-ink-100 hover:text-ink-900 active:bg-ink-200 lg:hidden"
            :aria-expanded="menuOpen"
            aria-controls="public-drawer"
            aria-label="Menyuni ochish"
            @click="menuOpen = true"
          >
            <UiIcon name="filter" :size="20" />
          </button>
        </div>
      </div>
    </header>

    <Transition
      enter-active-class="transition-opacity duration-200 ease-out"
      enter-from-class="opacity-0"
      leave-active-class="pointer-events-none transition-opacity duration-150 ease-in"
      leave-to-class="opacity-0"
    >
      <div v-if="menuOpen" class="fixed inset-0 z-50 lg:hidden">
        <div class="absolute inset-0 bg-ink-900/50 backdrop-blur-[2px]" @click="closeMenu" />

        <Transition
          appear
          enter-active-class="transition-transform duration-200 ease-out"
          enter-from-class="translate-x-full"
        >
          <div
            id="public-drawer"
            ref="drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Menyu"
            class="scroll-slim absolute inset-y-0 right-0 flex w-[88%] max-w-[340px] flex-col overflow-y-auto bg-surface shadow-pop"
          >
            <div class="flex items-center justify-between gap-3 border-b border-ink-200 px-4 py-3.5">
              <AppLogo size="sm" />
              <button
                type="button"
                class="grid size-10 place-items-center rounded-field text-ink-500 transition-colors duration-150 hover:bg-ink-100 hover:text-ink-900"
                aria-label="Menyuni yopish"
                @click="closeMenu"
              >
                <UiIcon name="x" :size="20" />
              </button>
            </div>

            <nav class="grid gap-1 p-4" aria-label="Mobil menyu">
              <NuxtLink
                v-for="n in NAV"
                :key="n.to"
                :to="n.to"
                class="flex items-center justify-between rounded-field px-3.5 py-3 text-[14.5px] font-semibold transition-colors duration-150"
                :class="
                  isActive(n.to) ? 'bg-brand-50 text-brand-700' : 'text-ink-700 hover:bg-ink-100'
                "
                @click="closeMenu"
              >
                {{ n.label }}
                <UiIcon name="chevronRight" :size="16" class="text-ink-300" />
              </NuxtLink>
            </nav>

            <div class="border-t border-ink-200 px-4 py-4">
              <p class="text-[11px] font-bold uppercase tracking-wide text-ink-500">Kategoriyalar</p>
              <div class="mt-2.5 flex flex-wrap gap-2">
                <NuxtLink
                  v-for="c in CATEGORIES"
                  :key="c.to"
                  :to="c.to"
                  class="rounded-pill bg-ink-100 px-3 py-1.5 text-[12.5px] font-semibold text-ink-700 transition-colors duration-150 hover:bg-brand-50 hover:text-brand-700"
                  @click="closeMenu"
                >
                  {{ c.label }}
                </NuxtLink>
              </div>
            </div>

            <div class="mt-auto border-t border-ink-200 p-4">
              <div class="grid gap-2.5">
                <UiButton variant="secondary" to="/login" block @click="closeMenu">
                  Kirish
                </UiButton>
                <UiButton to="/login" block @click="closeMenu">Ro‘yxatdan o‘tish</UiButton>
              </div>
              <div class="mt-4 flex items-center justify-between gap-3">
                <a
                  href="tel:+998712000088"
                  class="text-[13px] font-semibold text-ink-600 transition-colors duration-150 hover:text-brand-600"
                >
                  +998 71 200 00 88
                </a>
                <LocaleSwitch />
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>

    <main class="min-h-0 flex-1">
      <slot />
    </main>

    <footer
      class="mt-auto border-t border-ink-200 bg-ink-900"
      :class="fullscreen ? 'lg:hidden' : ''"
    >
      <div class="mx-auto max-w-[1360px] px-4 py-12 lg:px-8 lg:py-14">
        <div class="grid gap-10 lg:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))]">
          <div>
            <AppLogo mono class="text-white" />
            <p class="mt-4 max-w-[46ch] text-[13.5px] leading-relaxed text-ink-400">
              MAKON: ko‘chmas mulk obyektlarini boshqarish va bo‘sh maydonlarni e’lon qilish
              platformasi. Ofis, savdo, ombor va turar joy maydonlari yagona katalogda; ariza,
              shartnoma va hisob-kitob jarayonlari yagona raqamli konturda yuritiladi.
            </p>

            <ul class="mt-6 space-y-3.5">
              <li v-for="c in CONTACTS" :key="c.label" class="flex gap-3">
                <span
                  class="mt-0.5 grid size-8 shrink-0 place-items-center rounded-field bg-white/10 text-brand-400"
                >
                  <svg
                    class="size-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.6"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <path :d="c.d" />
                  </svg>
                </span>
                <span class="min-w-0">
                  <a
                    v-if="c.href"
                    :href="c.href"
                    class="block text-[13.5px] font-semibold text-white transition-colors duration-150 hover:text-brand-400"
                  >
                    {{ c.label }}
                  </a>
                  <span v-else class="block text-[13.5px] font-semibold text-white">
                    {{ c.label }}
                  </span>
                  <span class="mt-0.5 block text-[12px] leading-relaxed text-ink-500">
                    {{ c.note }}
                  </span>
                </span>
              </li>
            </ul>

            <div class="mt-6 flex flex-wrap gap-2">
              <NuxtLink
                to="/catalog"
                class="inline-flex items-center gap-2 rounded-pill bg-white/10 px-3.5 py-2 text-[12.5px] font-semibold text-white transition-colors duration-150 hover:bg-white/20"
              >
                <UiIcon name="search" :size="15" />
                Bo‘sh joy qidirish
              </NuxtLink>
              <NuxtLink
                to="/login"
                class="inline-flex items-center gap-2 rounded-pill bg-brand-500 px-3.5 py-2 text-[12.5px] font-semibold text-white transition-colors duration-150 hover:bg-brand-600"
              >
                <UiIcon name="shield" :size="15" />
                Tizimga kirish
              </NuxtLink>
            </div>
          </div>

          <div>
            <h3 class="text-[11.5px] font-bold uppercase tracking-wide text-white">
              Tezkor havolalar
            </h3>
            <ul class="mt-4 space-y-2.5">
              <li v-for="l in QUICK" :key="l.to">
                <NuxtLink
                  :to="l.to"
                  class="text-[13.5px] text-ink-400 transition-colors duration-150 hover:text-white"
                >
                  {{ l.label }}
                </NuxtLink>
              </li>
            </ul>
          </div>

          <div>
            <h3 class="text-[11.5px] font-bold uppercase tracking-wide text-white">
              Katalog kategoriyalari
            </h3>
            <ul class="mt-4 space-y-2.5">
              <li v-for="c in CATEGORIES" :key="c.to">
                <NuxtLink
                  :to="c.to"
                  class="text-[13.5px] text-ink-400 transition-colors duration-150 hover:text-white"
                >
                  {{ c.label }}
                </NuxtLink>
              </li>
            </ul>
          </div>

          <div>
            <h3 class="text-[11.5px] font-bold uppercase tracking-wide text-white">Obyektlar</h3>
            <ul class="mt-4 space-y-2.5">
              <li v-for="b in footerBuildings" :key="b.id">
                <NuxtLink
                  :to="`/catalog/${b.slug}`"
                  class="group block text-[13.5px] text-ink-400 transition-colors duration-150 hover:text-white"
                >
                  {{ b.name }}
                  <span class="block text-[12px] text-ink-600 group-hover:text-ink-500">
                    {{ b.district }}
                  </span>
                </NuxtLink>
              </li>
              <li>
                <NuxtLink
                  to="/catalog"
                  class="text-[13.5px] font-semibold text-ink-300 transition-colors duration-150 hover:text-white"
                >
                  Yana {{ BUILDINGS.length - footerBuildings.length }} ta obyekt
                </NuxtLink>
              </li>
            </ul>
          </div>
        </div>

        <div class="mt-10 border-t border-white/10 pt-6">
          <p class="max-w-[92ch] text-[12px] leading-relaxed text-ink-500">
            Katalogdagi maydonlar bo‘yicha yakuniy shartlar obyekt egasi bilan tuziladigan
            shartnomada belgilanadi. Band unitlar bo‘yicha ijarachi va moliyaviy ma’lumotlar
            ommaviy ko‘rinishda ochilmaydi.
          </p>

          <div class="mt-4 flex flex-wrap items-center justify-between gap-4">
            <p class="text-[12.5px] text-ink-500">
              © {{ year }} MAKON. Barcha huquqlar himoyalangan.
            </p>
            <div class="flex flex-wrap items-center gap-5">
              <NuxtLink
                to="/#tizim"
                class="text-[12.5px] text-ink-500 transition-colors duration-150 hover:text-white"
              >
                Platforma imkoniyatlari
              </NuxtLink>
              <NuxtLink
                to="/catalog"
                class="text-[12.5px] text-ink-500 transition-colors duration-150 hover:text-white"
              >
                Katalog
              </NuxtLink>
              <NuxtLink
                to="/login"
                class="text-[12.5px] font-semibold text-brand-400 transition-colors duration-150 hover:text-white"
              >
                Tizimga kirish
              </NuxtLink>
            </div>
          </div>
        </div>
      </div>
    </footer>
  </div>
</template>
