<script setup lang="ts">
import { useStorage } from '@vueuse/core'

/**
 * Jonli izoh: ekrandagi elementni yoritib, nima qilish kerakligini, bosgandan
 * keyin nima bo'lishini va keyingi qadam nimaligini aytadi.
 *
 * Birinchi marta kirgan foydalanuvchida savol qolmasligi kerak, shuning uchun
 * izoh o'zi ochiladi. Keyin u yordam tugmasi orqali qayta ko'riladi.
 * Bosqichlar tugagach tugallangan deb belgilanadi va boshqa bezovta qilmaydi.
 */
export interface TourStep {
  /** Yoritiladigan element: CSS tanlagich. Topilmasa qadam markazda chiqadi */
  target?: string
  title: string
  /** Nima qilish kerak */
  body: string
  /** Bajarilgandan keyin nima bo'ladi */
  after?: string
  /** Keyingi qadam nima */
  next?: string
}

const props = withDefaults(
  defineProps<{
    /** Xotirada saqlanadigan nom: har bir ekran va rol uchun alohida */
    id: string
    steps: TourStep[]
    /** Yordam tugmasidagi yozuv */
    title?: string
    /** Birinchi tashrifda o'zi ochilsinmi */
    auto?: boolean
  }>(),
  { auto: true },
)

const { t } = useI18n()

interface Box {
  top: number
  left: number
  width: number
  height: number
}

/** Yoritilgan element atrofidagi bo'shliq */
const PAD = 8
/** Ramka bilan izoh oynasi orasidagi masofa */
const GAP = 14
/** Ekran chetidan qoldiriladigan eng kichik chekka */
const EDGE = 16

const seen = useStorage<string[]>('makon.tour.seen', [])
const open = ref(false)
const index = ref(0)
const box = ref<Box | null>(null)

const panelEl = ref<HTMLElement | null>(null)
const triggerEl = ref<HTMLElement | null>(null)

/** Telefon kengligida izoh oynasi pastdagi taglikka aylanadi */
const narrow = useMediaQuery('(max-width: 639px)')

const step = computed(() => props.steps[index.value] ?? null)
const isLast = computed(() => index.value === props.steps.length - 1)
const label = computed(() => props.title ?? t('tour.help'))

/* --- O'lchash va joylashtirish -------------------------------------------
 * Ramka uch manbadan qayta o'lchanadi: siljish va o'lcham hodisalari,
 * yoritilgan element bilan izoh oynasining o'lcham kuzatuvchisi, hamda
 * qadam almashgandan keyingi qisqa takror o'lchov. Shrift yoki rasm
 * kechikib joylashsa ham ramka element bilan bir joyda qoladi.
 */

let settle = 0
let restart = 0
let observer: ResizeObserver | null = null

const style = ref<Record<string, string>>({})

function targetEl() {
  const selector = step.value?.target
  if (!selector) return null
  try {
    return document.querySelector(selector)
  } catch {
    return null
  }
}

/** Elementni o'rab turgan eng yaqin siljiydigan blok */
function scrollParent(el: Element): HTMLElement | null {
  let node = el.parentElement
  while (node) {
    const overflow = getComputedStyle(node).overflowY
    if (/(auto|scroll)/.test(overflow) && node.scrollHeight - node.clientHeight > 4) return node
    node = node.parentElement
  }
  return null
}

/**
 * Yoritilgan elementni ko'rinadigan qismning yuqori uchdan biriga olib
 * keladi: ostida izoh oynasiga joy qoladi, telefonda taglik uni yopmaydi.
 */
function bringIntoView() {
  const el = targetEl()
  if (!el) return
  const parent = scrollParent(el)
  const view = parent
    ? parent.getBoundingClientRect()
    : ({ top: 0, bottom: window.innerHeight } as DOMRect)
  const r = el.getBoundingClientRect()
  const viewH = view.bottom - view.top
  // Baland blok ekranning yarmidan oshsa, uning yuqori qismi ko'rsatiladi
  const offset = r.height > viewH * 0.55 ? EDGE * 2 : viewH * 0.32
  const delta = r.top - (view.top + offset)
  if (Math.abs(delta) < 8) return
  if (parent) parent.scrollBy({ top: delta, behavior: 'smooth' })
  else window.scrollBy({ top: delta, behavior: 'smooth' })
}

function readBox() {
  const el = targetEl()
  if (!el) {
    if (box.value) box.value = null
    return
  }
  const r = el.getBoundingClientRect()
  const next: Box = {
    top: r.top - PAD,
    left: r.left - PAD,
    width: r.width + PAD * 2,
    height: r.height + PAD * 2,
  }
  const cur = box.value
  const same =
    cur &&
    Math.abs(cur.top - next.top) < 0.5 &&
    Math.abs(cur.left - next.left) < 0.5 &&
    Math.abs(cur.width - next.width) < 0.5 &&
    Math.abs(cur.height - next.height) < 0.5
  if (!same) box.value = next
}

/** Izoh oynasi ramkaning ostiga, joy yetmasa tepasiga qo'yiladi */
function place() {
  const el = panelEl.value
  const h = el?.offsetHeight ?? 280
  const w = el?.offsetWidth ?? 344
  const vw = window.innerWidth
  const vh = window.innerHeight
  const b = box.value

  let next: Record<string, string>

  if (!b) {
    next = { top: '50%', left: '50%', right: 'auto', bottom: 'auto', transform: 'translate(-50%, -50%)' }
  } else if (narrow.value) {
    next = { top: 'auto', left: `${EDGE}px`, right: `${EDGE}px`, bottom: `${EDGE}px`, transform: 'none' }
  } else {
    const below = b.top + b.height + GAP
    const above = b.top - h - GAP
    // Baland blok ikkala tomonga ham sig‘masa, oyna ekran pastiga qadaladi:
    // shunda blokning yuqori qismi va sarlavhasi ochiq qoladi
    let top = below + h + EDGE <= vh ? below : above >= EDGE ? above : vh - h - EDGE
    top = Math.min(Math.max(EDGE, top), Math.max(EDGE, vh - h - EDGE))
    const left = Math.min(
      Math.max(EDGE, b.left + b.width / 2 - w / 2),
      Math.max(EDGE, vw - w - EDGE),
    )
    next = { top: `${top}px`, left: `${left}px`, right: 'auto', bottom: 'auto', transform: 'none' }
  }

  const cur = style.value
  for (const key of Object.keys(next)) {
    if (cur[key] !== next[key]) {
      style.value = next
      return
    }
  }
}

function measureNow() {
  readBox()
  place()
}

/**
 * Qadam almashgach joylashuv bir zumda barqarorlashmaydi: silliq siljish
 * davom etadi, oyna balandligi o'zgaradi. Shuning uchun qisqa vaqt ichida
 * bir necha marta qayta o'lchanadi.
 */
function settleMeasure() {
  window.clearInterval(settle)
  measureNow()
  let ticks = 0
  settle = window.setInterval(() => {
    measureNow()
    if (++ticks > 26) window.clearInterval(settle)
  }, 45)
}

/** Yoritilgan element va izoh oynasi o'lchami o'zgarsa darhol qayta o'lchanadi */
function observe() {
  observer?.disconnect()
  observer = new ResizeObserver(measureNow)
  const el = targetEl()
  if (el) observer.observe(el)
  if (panelEl.value) observer.observe(panelEl.value)
  observer.observe(document.documentElement)
}

/* --- Klaviatura va fokus -------------------------------------------------
 * Izoh ochilganda fokus oyna ichiga o'tadi va Tab bilan tashqariga
 * chiqmaydi: o'qish dasturi orqa fondagi tugmalarni o'qib ketmaydi.
 */

function focusables() {
  if (!panelEl.value) return [] as HTMLElement[]
  return [
    ...panelEl.value.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
    ),
  ].filter((el) => el.offsetParent !== null)
}

/** Oynadagi oxirgi tugma «Keyingisi»: fokus shunga tushadi, Enter oldinga yuradi */
function focusPrimary() {
  const list = focusables()
  const primary = list[list.length - 1]
  if (primary) primary.focus()
  else panelEl.value?.focus()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    finish()
    return
  }
  if (event.key === 'ArrowRight') {
    event.preventDefault()
    go(1)
    return
  }
  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    go(-1)
    return
  }
  if (event.key !== 'Tab') return

  const list = focusables()
  if (!list.length) {
    event.preventDefault()
    return
  }
  const first = list[0]!
  const last = list[list.length - 1]!
  const active = document.activeElement
  if (event.shiftKey && (active === first || active === panelEl.value)) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && active === last) {
    event.preventDefault()
    first.focus()
  }
}

/* --- Boshqaruv ----------------------------------------------------------- */

function start() {
  if (!props.steps.length) return
  index.value = 0
  open.value = true
  window.addEventListener('resize', measureNow)
  window.addEventListener('scroll', measureNow, true)
  nextTick(() => {
    observe()
    bringIntoView()
    settleMeasure()
    focusPrimary()
  })
}

function stop() {
  window.clearInterval(settle)
  window.removeEventListener('resize', measureNow)
  window.removeEventListener('scroll', measureNow, true)
  observer?.disconnect()
  observer = null
}

function finish() {
  open.value = false
  stop()
  box.value = null
  if (!seen.value.includes(props.id)) seen.value = [...seen.value, props.id]
  nextTick(() => triggerEl.value?.focus())
}

function go(delta: number) {
  const next = index.value + delta
  if (next < 0) return
  if (next >= props.steps.length) {
    finish()
    return
  }
  index.value = next
  nextTick(() => {
    observe()
    bringIntoView()
    settleMeasure()
  })
}

onMounted(() => {
  if (props.auto && props.steps.length && !seen.value.includes(props.id)) {
    // Sahifa joylashib bo'lgach ochiladi, aks holda ramka noto'g'ri chiqadi
    restart = window.setTimeout(start, 650)
  }
})

onBeforeUnmount(() => {
  window.clearTimeout(restart)
  stop()
})

defineExpose({ start })
</script>

<template>
  <!-- Qayta ko'rish tugmasi: izoh yopilgandan keyin ham qo'l ostida turadi -->
  <button
    ref="triggerEl"
    type="button"
    class="inline-flex h-11 items-center gap-1.5 rounded-field px-3.5 text-[13px] font-semibold text-brand-600 ring-1 ring-inset ring-brand-200 transition-colors duration-150 hover:bg-brand-50 hover:ring-brand-300 md:h-9"
    @click="start"
  >
    <UiIcon name="help" :size="16" />
    {{ label }}
  </button>

  <Teleport to="body">
    <div
      v-if="open"
      class="tour-layer fixed inset-0 z-[70]"
      role="dialog"
      aria-modal="true"
      :aria-label="label"
      @keydown="onKeydown"
    >
      <!--
        Fon to'rtta parda bilan qoraytiriladi va yoritilgan element ochiq
        qoladi. Ilgari bu ulkan tarqalishli soya bilan qilingan edi, lekin
        brauzer bunday soyani to'liq quyuqlikda chizmaydi va ekran deyarli
        qoraymay qolardi.
      -->
      <div class="absolute inset-0" @click="finish">
        <template v-if="box">
          <div
            class="absolute inset-x-0 top-0 bg-ink-900/60"
            :style="{ height: `${Math.max(0, box.top)}px` }"
          />
          <div
            class="absolute inset-x-0 bottom-0 bg-ink-900/60"
            :style="{ top: `${Math.max(0, box.top + box.height)}px` }"
          />
          <div
            class="absolute left-0 bg-ink-900/60"
            :style="{
              top: `${box.top}px`,
              height: `${box.height}px`,
              width: `${Math.max(0, box.left)}px`,
            }"
          />
          <div
            class="absolute right-0 bg-ink-900/60"
            :style="{
              top: `${box.top}px`,
              height: `${box.height}px`,
              left: `${box.left + box.width}px`,
            }"
          />
        </template>
        <div v-else class="absolute inset-0 bg-ink-900/60" />
      </div>

      <div
        v-if="box"
        :key="index"
        class="tour-ring pointer-events-none absolute rounded-card ring-2 ring-white/90"
        :style="{
          top: `${box.top}px`,
          left: `${box.left}px`,
          width: `${box.width}px`,
          height: `${box.height}px`,
        }"
      />

      <div
        ref="panelEl"
        tabindex="-1"
        class="absolute flex max-h-[calc(100dvh-32px)] flex-col overflow-y-auto rounded-panel bg-surface p-5 shadow-pop outline-none sm:w-[344px]"
        :style="style"
      >
        <div :key="index" class="tour-step">
          <p class="text-[11px] font-bold uppercase tracking-wide text-brand-600">
            {{ t('tour.progress', { current: index + 1, total: steps.length }) }}
          </p>
          <h3 class="mt-1.5 text-[18px] font-bold leading-snug text-ink-900">
            {{ step?.title }}
          </h3>
          <p class="mt-2 text-[13px] leading-relaxed text-ink-600">{{ step?.body }}</p>

          <dl
            v-if="step?.after || step?.next"
            class="mt-3.5 space-y-2.5 border-t border-ink-100 pt-3.5"
          >
            <div v-if="step?.after" class="flex gap-2.5">
              <dt class="mt-0.5 shrink-0 text-ok-600"><UiIcon name="check" :size="15" /></dt>
              <dd class="text-[12px] leading-relaxed text-ink-600">
                <span class="font-semibold text-ink-800">{{ t('tour.afterLabel') }}</span>
                {{ step.after }}
              </dd>
            </div>
            <div v-if="step?.next" class="flex gap-2.5">
              <dt class="mt-0.5 shrink-0 text-brand-600">
                <UiIcon name="arrowRight" :size="15" />
              </dt>
              <dd class="text-[12px] leading-relaxed text-ink-600">
                <span class="font-semibold text-ink-800">{{ t('tour.nextLabel') }}</span>
                {{ step.next }}
              </dd>
            </div>
          </dl>
        </div>

        <!-- Bosqich nuqtalari: qaysi qadamda turgani bir qarashda ko'rinadi -->
        <div class="mt-4 flex items-center gap-1.5" aria-hidden="true">
          <span
            v-for="(s, i) in steps"
            :key="i"
            class="h-1.5 rounded-pill transition-all duration-200"
            :class="i === index ? 'w-5 bg-brand-500' : i < index ? 'w-1.5 bg-brand-300' : 'w-1.5 bg-ink-200'"
          />
        </div>

        <div class="mt-3.5 flex items-center justify-between gap-3">
          <button
            type="button"
            class="h-11 rounded-field px-2 text-[12px] font-semibold text-ink-500 transition-colors duration-150 hover:text-ink-700 md:h-9"
            @click="finish"
          >
            {{ t('tour.skip') }}
          </button>
          <span class="flex items-center gap-2">
            <UiButton v-if="index > 0" variant="ghost" size="sm" @click="go(-1)">
              {{ t('tour.back') }}
            </UiButton>
            <UiButton size="sm" @click="go(1)">
              {{ isLast ? t('tour.done') : t('tour.next') }}
            </UiButton>
          </span>
        </div>

        <p class="mt-2.5 hidden text-[11px] leading-snug text-ink-400 sm:block">
          {{ t('tour.hint') }}
        </p>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/*
 * Harakat sof CSS animatsiya bilan beriladi. Vue o'tish komponenti
 * `transitionend` hodisasini kutadi va sahifa fonga o'tganda u hodisa
 * kelmaydi: izoh keyingi qadamga o'tolmay qotib qolardi. Animatsiya esa
 * hech narsani kutmaydi va har doim oxirigacha boradi.
 */
@keyframes tour-fade {
  from {
    opacity: 0;
  }
}

@keyframes tour-rise {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
}

.tour-layer {
  animation: tour-fade 200ms ease-out both;
}

.tour-ring {
  animation: tour-fade 220ms ease-out both;
}

.tour-step {
  animation: tour-rise 220ms ease-out both;
}

@media (prefers-reduced-motion: reduce) {
  .tour-layer,
  .tour-ring,
  .tour-step {
    animation: none;
  }
}
</style>
