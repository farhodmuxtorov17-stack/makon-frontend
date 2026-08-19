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
    /** Xotirada saqlanadigan nom: har bir ekran uchun alohida */
    id: string
    steps: TourStep[]
    /** Sarlavha: izoh nima haqida ekanini bildiradi */
    title?: string
    /** Birinchi tashrifda o'zi ochilsinmi */
    auto?: boolean
  }>(),
  { auto: true },
)

const seen = useStorage<string[]>('makon.tour.seen', [])
const open = ref(false)
const index = ref(0)
const box = ref<{ top: number; left: number; width: number; height: number } | null>(null)

const step = computed(() => props.steps[index.value] ?? null)
const isLast = computed(() => index.value === props.steps.length - 1)

/** Yoritilgan element atrofidagi ramka o'lchamini o'lchaydi */
function measure() {
  const selector = step.value?.target
  if (!selector) {
    box.value = null
    return
  }
  const el = document.querySelector(selector)
  if (!el) {
    box.value = null
    return
  }
  el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  const r = el.getBoundingClientRect()
  const pad = 8
  box.value = {
    top: r.top - pad,
    left: r.left - pad,
    width: r.width + pad * 2,
    height: r.height + pad * 2,
  }
}

/** Izoh oynasi yoritilgan element ostida yoki tepasida turadi */
const panelStyle = computed(() => {
  if (!box.value) {
    return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
  }
  const width = 344
  const gapY = 14
  const belowTop = box.value.top + box.value.height + gapY
  const fitsBelow = belowTop + 210 < window.innerHeight
  const top = fitsBelow ? belowTop : Math.max(16, box.value.top - 210 - gapY)
  const left = Math.min(
    Math.max(16, box.value.left + box.value.width / 2 - width / 2),
    Math.max(16, window.innerWidth - width - 16),
  )
  return { top: `${top}px`, left: `${left}px` }
})

function start() {
  index.value = 0
  open.value = true
  nextTick(measure)
}

function finish() {
  open.value = false
  if (!seen.value.includes(props.id)) seen.value = [...seen.value, props.id]
}

function go(delta: number) {
  const next = index.value + delta
  if (next < 0) return
  if (next >= props.steps.length) {
    finish()
    return
  }
  index.value = next
  nextTick(measure)
}

onMounted(() => {
  if (props.auto && props.steps.length && !seen.value.includes(props.id)) {
    // Sahifa joylashib bo'lgach o'lchaymiz, aks holda ramka noto'g'ri chiqadi
    setTimeout(start, 700)
  }
  window.addEventListener('resize', measure)
  window.addEventListener('scroll', measure, true)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', measure)
  window.removeEventListener('scroll', measure, true)
})

onKeyStroke('Escape', () => {
  if (open.value) finish()
})
onKeyStroke('ArrowRight', () => {
  if (open.value) go(1)
})
onKeyStroke('ArrowLeft', () => {
  if (open.value) go(-1)
})

defineExpose({ start })
</script>

<template>
  <!-- Qayta ko'rish tugmasi: izoh yopilgandan keyin ham qo'l ostida turadi -->
  <button
    type="button"
    class="inline-flex h-11 items-center gap-1.5 rounded-field px-3 text-[13px] font-semibold text-brand-600 transition-colors duration-150 hover:bg-brand-50 md:h-9"
    @click="start"
  >
    <UiIcon name="info" :size="16" />
    {{ title ?? 'Qanday ishlaydi' }}
  </button>

  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      leave-active-class="transition-opacity duration-150"
      leave-to-class="opacity-0"
    >
      <div v-if="open" class="fixed inset-0 z-[70]" role="dialog" aria-modal="true">
        <!-- Fon qorayadi, yoritilgan element ochiq qoladi -->
        <div class="absolute inset-0 bg-ink-900/55 backdrop-blur-[1px]" @click="finish" />

        <div
          v-if="box"
          class="pointer-events-none absolute rounded-card ring-2 ring-white transition-all duration-300 ease-out"
          :style="{
            top: `${box.top}px`,
            left: `${box.left}px`,
            width: `${box.width}px`,
            height: `${box.height}px`,
            boxShadow: '0 0 0 9999px rgb(19 28 43 / 0.55)',
          }"
        />

        <Transition
          enter-active-class="transition-all duration-250 ease-out"
          enter-from-class="opacity-0 translate-y-2"
          mode="out-in"
        >
          <div
            :key="index"
            class="absolute w-[344px] max-w-[calc(100vw-32px)] rounded-panel bg-surface p-5 shadow-pop"
            :style="panelStyle"
          >
            <p class="text-[11px] font-bold uppercase tracking-wide text-brand-600">
              {{ index + 1 }} / {{ steps.length }}
            </p>
            <h3 class="mt-1.5 text-[18px] font-bold leading-snug text-ink-900">
              {{ step?.title }}
            </h3>
            <p class="mt-2 text-[13px] leading-relaxed text-ink-600">{{ step?.body }}</p>

            <dl v-if="step?.after || step?.next" class="mt-3.5 space-y-2.5 border-t border-ink-100 pt-3.5">
              <div v-if="step?.after" class="flex gap-2.5">
                <dt class="mt-0.5 shrink-0 text-ok-600"><UiIcon name="check" :size="15" /></dt>
                <dd class="text-[12px] leading-relaxed text-ink-600">
                  <span class="font-semibold text-ink-800">Shundan keyin:</span>
                  {{ step.after }}
                </dd>
              </div>
              <div v-if="step?.next" class="flex gap-2.5">
                <dt class="mt-0.5 shrink-0 text-brand-600"><UiIcon name="arrowRight" :size="15" /></dt>
                <dd class="text-[12px] leading-relaxed text-ink-600">
                  <span class="font-semibold text-ink-800">Keyingi qadam:</span>
                  {{ step.next }}
                </dd>
              </div>
            </dl>

            <div class="mt-4 flex items-center justify-between gap-3">
              <button
                type="button"
                class="h-11 rounded-field px-2 text-[12px] font-semibold text-ink-500 transition-colors duration-150 hover:text-ink-700 md:h-9"
                @click="finish"
              >
                Yopish
              </button>
              <span class="flex items-center gap-2">
                <UiButton v-if="index > 0" variant="ghost" size="sm" @click="go(-1)">Orqaga</UiButton>
                <UiButton size="sm" @click="go(1)">
                  {{ isLast ? 'Tushunarli' : 'Keyingisi' }}
                </UiButton>
              </span>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
