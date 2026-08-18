<script setup lang="ts">
/**
 * 3D navigator boshqaruv klasteri: ko‘rinish, qatlamlar va asboblar.
 *
 * Holat `state` obyektida keladi, o‘zgarishlar `patch` hodisasi orqali
 * ota komponentga qaytadi. Shu sababli bu komponent hech qanday
 * hisob-kitob qilmaydi va qayta chizilishi arzon.
 */

interface Layers {
  walls: boolean
  openings: boolean
  core: boolean
  furniture: boolean
  people: boolean
  tech: boolean
}

interface ViewState {
  rotation: number
  tilt: number
  zoom: number
  explode: number
  sunHour: number
  night: boolean
  sectionAxis: 'off' | 'x' | 'y'
  sectionCut: number
  tool: 'none' | 'measure'
  layers: Layers
}

const props = defineProps<{
  state: ViewState
  /** O‘lchash natijasi yoki keyingi qadam haqida qisqa yo‘riqnoma */
  measureNote: string
  measureActive: boolean
}>()

const emit = defineEmits<{
  (e: 'patch', patch: Partial<ViewState>): void
  (e: 'clear-measure'): void
  (e: 'reset'): void
}>()

const expanded = ref(false)

const LAYERS: Array<{ key: keyof Layers; label: string; hint: string }> = [
  { key: 'walls', label: 'Devorlar', hint: 'Tashqi devor va ichki to‘siqlar' },
  { key: 'openings', label: 'Eshiklar va derazalar', hint: 'Eshik qanoti va deraza o‘rinlari' },
  { key: 'core', label: 'Koridor va yadro', hint: 'Yo‘lak, lift shaxtasi va zinapoya' },
  { key: 'furniture', label: 'Mebel', hint: 'Stol, kreslo, stellaj va boshqa jihoz' },
  { key: 'people', label: 'Odamlar', hint: 'Masshtab uchun xodim figuralari' },
  { key: 'tech', label: 'Texnika', hint: 'Texnik xona, tom uskunasi, sanuzel' },
]

const AXES: Array<{ key: 'off' | 'x' | 'y'; label: string; aria: string }> = [
  { key: 'off', label: 'Yo‘q', aria: 'Kesim tekisligi o‘chirilgan' },
  { key: 'x', label: 'X o‘qi', aria: 'Kesim X o‘qi bo‘ylab' },
  { key: 'y', label: 'Y o‘qi', aria: 'Kesim Y o‘qi bo‘ylab' },
]

function num(event: Event) {
  return Number((event.target as HTMLInputElement).value)
}

function toggleLayer(key: keyof Layers) {
  emit('patch', { layers: { ...props.state.layers, [key]: !props.state.layers[key] } })
}

const activeLayers = computed(() => LAYERS.filter((l) => props.state.layers[l.key]).length)

const sunLabel = computed(() => {
  const h = Math.floor(props.state.sunHour)
  const m = Math.round((props.state.sunHour - h) * 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
})

const sunPhase = computed(() => {
  const h = props.state.sunHour
  if (props.state.night) return 'Tun rejimi, derazalar ichkaridan yoritilgan'
  if (h < 9) return 'Ertalabki past quyosh, uzun soya'
  if (h < 12) return 'Tushdan oldingi yorug‘lik'
  if (h < 15) return 'Tush payti, soya qisqa'
  if (h < 18) return 'Kechki yorug‘lik'
  return 'Quyosh botishi, soya uzayadi'
})

const sectionNote = computed(() => {
  if (props.state.sectionAxis === 'off') return 'Kesim o‘chirilgan, bino yaxlit ko‘rinadi'
  const percent = Math.round(props.state.sectionCut * 100)
  return `Kesim ${props.state.sectionAxis === 'x' ? 'X' : 'Y'} o‘qida, ${percent}% joyda. Old qism olib tashlanadi.`
})
</script>

<template>
  <div class="border-t border-ink-200/70 bg-surface/95">
    <button
      type="button"
      class="flex w-full items-center justify-between gap-3 px-4 py-3 text-left lg:hidden"
      :aria-expanded="expanded"
      aria-controls="mkn-3d-controls"
      @click="expanded = !expanded"
    >
      <span class="flex min-w-0 items-center gap-2">
        <UiIcon name="tools" :size="17" class="shrink-0 text-brand-600" />
        <span class="min-w-0 truncate text-[13px] font-bold text-ink-900">Boshqaruv paneli</span>
        <span
          class="tabular shrink-0 rounded-pill bg-ink-100 px-2 py-0.5 text-[11px] font-semibold text-ink-600"
        >
          {{ activeLayers }} / {{ LAYERS.length }} qatlam
        </span>
      </span>
      <UiIcon
        name="chevronDown"
        :size="18"
        class="shrink-0 text-ink-500 transition-transform"
        :class="expanded ? 'rotate-180' : ''"
      />
    </button>

    <div
      id="mkn-3d-controls"
      class="lg:block"
      :class="expanded ? 'block' : 'hidden'"
    >
      <div class="grid gap-4 p-4 md:grid-cols-2 lg:gap-5 2xl:grid-cols-3">
        <!-- ============================ KO‘RINISH ============================ -->
        <section class="min-w-0" aria-labelledby="mkn-grp-view">
          <h4
            id="mkn-grp-view"
            class="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-500"
          >
            <UiIcon name="cube" :size="14" class="shrink-0 text-brand-500" />
            Ko‘rinish
          </h4>

          <div class="mt-2.5 space-y-2.5">
            <label class="block">
              <span
                class="flex items-baseline justify-between gap-2 text-[11.5px] font-semibold text-ink-600"
              >
                Burilish
                <span class="tabular text-[12px] font-bold text-ink-900">
                  {{ Math.round(state.rotation) }}°
                </span>
              </span>
              <input
                :value="state.rotation"
                type="range"
                min="0"
                max="360"
                step="1"
                class="mt-1 h-1.5 w-full accent-brand-500"
                aria-label="Gorizontal burilish burchagi"
                @input="emit('patch', { rotation: num($event) })"
              />
            </label>

            <label class="block">
              <span
                class="flex items-baseline justify-between gap-2 text-[11.5px] font-semibold text-ink-600"
              >
                Nishab
                <span class="tabular text-[12px] font-bold text-ink-900">
                  {{ Math.round(state.tilt) }}°
                </span>
              </span>
              <input
                :value="state.tilt"
                type="range"
                min="6"
                max="82"
                step="1"
                class="mt-1 h-1.5 w-full accent-brand-500"
                aria-label="Kamera balandlik burchagi"
                @input="emit('patch', { tilt: num($event) })"
              />
            </label>

            <label class="block">
              <span
                class="flex items-baseline justify-between gap-2 text-[11.5px] font-semibold text-ink-600"
              >
                Masshtab
                <span class="tabular text-[12px] font-bold text-ink-900">
                  {{ Math.round(state.zoom * 100) }}%
                </span>
              </span>
              <input
                :value="state.zoom"
                type="range"
                min="0.6"
                max="2.2"
                step="0.05"
                class="mt-1 h-1.5 w-full accent-brand-500"
                aria-label="Masshtab darajasi"
                @input="emit('patch', { zoom: num($event) })"
              />
            </label>

            <label class="block">
              <span
                class="flex items-baseline justify-between gap-2 text-[11.5px] font-semibold text-ink-600"
              >
                Ajratish
                <span class="tabular text-[12px] font-bold text-ink-900">
                  {{ Math.round(state.explode * 100) }}%
                </span>
              </span>
              <input
                :value="state.explode"
                type="range"
                min="0"
                max="1"
                step="0.02"
                class="mt-1 h-1.5 w-full accent-brand-500"
                aria-label="Qavatlarni ajratish darajasi"
                @input="emit('patch', { explode: num($event) })"
              />
            </label>

            <label class="block">
              <span
                class="flex items-baseline justify-between gap-2 text-[11.5px] font-semibold text-ink-600"
              >
                Quyosh vaqti
                <span class="tabular text-[12px] font-bold text-ink-900">{{ sunLabel }}</span>
              </span>
              <input
                :value="state.sunHour"
                type="range"
                min="6"
                max="20"
                step="0.5"
                class="mt-1 h-1.5 w-full accent-warn-500"
                aria-label="Kun davomidagi quyosh burchagi"
                @input="emit('patch', { sunHour: num($event) })"
              />
            </label>

            <div class="flex flex-wrap gap-1.5">
              <button
                type="button"
                class="inline-flex h-9 items-center gap-1.5 rounded-field px-2.5 text-[12px] font-semibold ring-1 ring-inset transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                :class="
                  state.night
                    ? 'bg-ink-900 text-white ring-ink-900'
                    : 'bg-surface text-ink-700 ring-ink-200 hover:bg-ink-50'
                "
                :aria-pressed="state.night"
                @click="emit('patch', { night: !state.night })"
              >
                <UiIcon :name="state.night ? 'cloud' : 'sun'" :size="15" />
                {{ state.night ? 'Tun' : 'Kunduz' }}
              </button>

              <button
                type="button"
                class="inline-flex h-9 items-center gap-1.5 rounded-field bg-surface px-2.5 text-[12px] font-semibold text-ink-700 ring-1 ring-inset ring-ink-200 transition-colors hover:bg-ink-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                @click="emit('reset')"
              >
                <UiIcon name="target" :size="15" />
                Tiklash
              </button>
            </div>

            <p class="text-[11.5px] leading-snug text-ink-500">{{ sunPhase }}</p>
          </div>
        </section>

        <!-- ============================ QATLAMLAR ============================ -->
        <section class="min-w-0" aria-labelledby="mkn-grp-layers">
          <h4
            id="mkn-grp-layers"
            class="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-500"
          >
            <UiIcon name="layers" :size="14" class="shrink-0 text-brand-500" />
            Qatlamlar
          </h4>

          <div class="mt-2.5 flex flex-wrap gap-1.5" role="group" aria-label="Qatlamlarni yoqish va o‘chirish">
            <button
              v-for="l in LAYERS"
              :key="l.key"
              type="button"
              class="inline-flex h-9 min-w-0 items-center gap-1.5 rounded-field px-2.5 text-[12px] font-semibold ring-1 ring-inset transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
              :class="
                state.layers[l.key]
                  ? 'bg-brand-50 text-brand-700 ring-brand-300'
                  : 'bg-surface text-ink-500 ring-ink-200 hover:bg-ink-50'
              "
              :aria-pressed="state.layers[l.key]"
              :title="l.hint"
              @click="toggleLayer(l.key)"
            >
              <UiIcon :name="state.layers[l.key] ? 'check' : 'x'" :size="14" class="shrink-0" />
              <span class="min-w-0 truncate">{{ l.label }}</span>
            </button>
          </div>

          <p class="mt-2 text-[11.5px] leading-snug text-ink-500">
            Qatlamlar faqat tanlangan qavat interyerida ishlaydi. Belgisi bor tugma yoqilgan,
            krestli tugma o‘chirilgan.
          </p>
        </section>

        <!-- ============================ ASBOBLAR ============================ -->
        <section class="min-w-0" aria-labelledby="mkn-grp-tools">
          <h4
            id="mkn-grp-tools"
            class="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-500"
          >
            <UiIcon name="tools" :size="14" class="shrink-0 text-brand-500" />
            Asboblar
          </h4>

          <div class="mt-2.5 space-y-2.5">
            <div>
              <span class="text-[11.5px] font-semibold text-ink-600">Kesim tekisligi</span>
              <div class="mt-1 flex flex-wrap gap-1.5" role="group" aria-label="Kesim o‘qi">
                <button
                  v-for="a in AXES"
                  :key="a.key"
                  type="button"
                  class="inline-flex h-9 items-center rounded-field px-2.5 text-[12px] font-semibold ring-1 ring-inset transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                  :class="
                    state.sectionAxis === a.key
                      ? 'bg-brand-500 text-white ring-brand-500'
                      : 'bg-surface text-ink-700 ring-ink-200 hover:bg-ink-50'
                  "
                  :aria-label="a.aria"
                  :aria-pressed="state.sectionAxis === a.key"
                  @click="emit('patch', { sectionAxis: a.key })"
                >
                  {{ a.label }}
                </button>
              </div>

              <label class="mt-2 block">
                <span
                  class="flex items-baseline justify-between gap-2 text-[11.5px] font-semibold"
                  :class="state.sectionAxis === 'off' ? 'text-ink-400' : 'text-ink-600'"
                >
                  Kesim o‘rni
                  <span class="tabular text-[12px] font-bold">
                    {{ Math.round(state.sectionCut * 100) }}%
                  </span>
                </span>
                <input
                  :value="state.sectionCut"
                  type="range"
                  min="0.04"
                  max="0.96"
                  step="0.01"
                  class="mt-1 h-1.5 w-full accent-brand-500 disabled:opacity-40"
                  :disabled="state.sectionAxis === 'off'"
                  aria-label="Kesim tekisligining o‘rni"
                  @input="emit('patch', { sectionCut: num($event) })"
                />
              </label>
              <p class="mt-1 text-[11.5px] leading-snug text-ink-500">{{ sectionNote }}</p>
            </div>

            <div class="border-t border-ink-100 pt-2.5">
              <span class="text-[11.5px] font-semibold text-ink-600">O‘lchash</span>
              <div class="mt-1 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  class="inline-flex h-9 items-center gap-1.5 rounded-field px-2.5 text-[12px] font-semibold ring-1 ring-inset transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                  :class="
                    measureActive
                      ? 'bg-brand-500 text-white ring-brand-500'
                      : 'bg-surface text-ink-700 ring-ink-200 hover:bg-ink-50'
                  "
                  :aria-pressed="measureActive"
                  @click="emit('patch', { tool: measureActive ? 'none' : 'measure' })"
                >
                  <UiIcon name="size" :size="15" />
                  {{ measureActive ? 'O‘lchash yoqilgan' : 'O‘lchash asbobi' }}
                </button>
                <button
                  type="button"
                  class="inline-flex h-9 items-center gap-1.5 rounded-field bg-surface px-2.5 text-[12px] font-semibold text-ink-700 ring-1 ring-inset ring-ink-200 transition-colors hover:bg-ink-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                  @click="emit('clear-measure')"
                >
                  <UiIcon name="trash" :size="15" />
                  Tozalash
                </button>
              </div>
              <p class="mt-1 text-[11.5px] leading-snug text-ink-500">{{ measureNote }}</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>
