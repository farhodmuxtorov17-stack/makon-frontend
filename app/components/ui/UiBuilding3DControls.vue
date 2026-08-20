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

const { t } = useI18n()

const expanded = ref(false)

const LAYERS = computed<Array<{ key: keyof Layers; label: string; hint: string }>>(() => [
  { key: 'walls', label: t('ui.layerWalls'), hint: t('ui.layerWallsHint') },
  { key: 'openings', label: t('ui.layerOpenings'), hint: t('ui.layerOpeningsHint') },
  { key: 'core', label: t('ui.layerCore'), hint: t('ui.layerCoreHint') },
  { key: 'furniture', label: t('ui.layerFurniture'), hint: t('ui.layerFurnitureHint') },
  { key: 'people', label: t('ui.layerPeople'), hint: t('ui.layerPeopleHint') },
  { key: 'tech', label: t('ui.layerTech'), hint: t('ui.layerTechHint') },
])

const AXES = computed<Array<{ key: 'off' | 'x' | 'y'; label: string; aria: string }>>(() => [
  { key: 'off', label: t('common.no'), aria: t('ui.sectionOffAria') },
  { key: 'x', label: t('ui.axisX'), aria: t('ui.axisXAria') },
  { key: 'y', label: t('ui.axisY'), aria: t('ui.axisYAria') },
])

function num(event: Event) {
  return Number((event.target as HTMLInputElement).value)
}

function toggleLayer(key: keyof Layers) {
  emit('patch', { layers: { ...props.state.layers, [key]: !props.state.layers[key] } })
}

const activeLayers = computed(
  () => LAYERS.value.filter((l) => props.state.layers[l.key]).length,
)

const sunLabel = computed(() => {
  const h = Math.floor(props.state.sunHour)
  const m = Math.round((props.state.sunHour - h) * 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
})

const sunPhase = computed(() => {
  const h = props.state.sunHour
  if (props.state.night) return t('ui.sunPhaseNight')
  if (h < 9) return t('ui.sunPhaseMorning')
  if (h < 12) return t('ui.sunPhaseForenoon')
  if (h < 15) return t('ui.sunPhaseNoon')
  if (h < 18) return t('ui.sunPhaseEvening')
  return t('ui.sunPhaseSunset')
})

const sectionNote = computed(() => {
  if (props.state.sectionAxis === 'off') return t('ui.sectionNoteOff')
  return t('ui.sectionNoteOn', {
    axis: props.state.sectionAxis === 'x' ? 'X' : 'Y',
    percent: Math.round(props.state.sectionCut * 100),
  })
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
        <span class="min-w-0 truncate text-[13px] font-bold text-ink-900">
          {{ t('nav.dashboardBuilding') }}
        </span>
        <span
          class="tabular shrink-0 rounded-pill bg-ink-100 px-2 py-0.5 text-[11px] font-semibold text-ink-600"
        >
          {{ t('ui.layerCount', { active: activeLayers, total: LAYERS.length }) }}
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
            {{ t('ui.groupView') }}
          </h4>

          <div class="mt-2.5 space-y-2.5">
            <label class="block">
              <span
                class="flex items-baseline justify-between gap-2 text-[12px] font-semibold text-ink-600"
              >
                {{ t('ui.rotation') }}
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
                :aria-label="t('ui.rotationAria')"
                @input="emit('patch', { rotation: num($event) })"
              />
            </label>

            <label class="block">
              <span
                class="flex items-baseline justify-between gap-2 text-[12px] font-semibold text-ink-600"
              >
                {{ t('ui.tilt') }}
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
                :aria-label="t('ui.tiltAria')"
                @input="emit('patch', { tilt: num($event) })"
              />
            </label>

            <label class="block">
              <span
                class="flex items-baseline justify-between gap-2 text-[12px] font-semibold text-ink-600"
              >
                {{ t('ui.scale') }}
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
                :aria-label="t('ui.scaleAria')"
                @input="emit('patch', { zoom: num($event) })"
              />
            </label>

            <label class="block">
              <span
                class="flex items-baseline justify-between gap-2 text-[12px] font-semibold text-ink-600"
              >
                {{ t('ui.explode') }}
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
                :aria-label="t('ui.explodeAria')"
                @input="emit('patch', { explode: num($event) })"
              />
            </label>

            <label class="block">
              <span
                class="flex items-baseline justify-between gap-2 text-[12px] font-semibold text-ink-600"
              >
                {{ t('ui.sunTime') }}
                <span class="tabular text-[12px] font-bold text-ink-900">{{ sunLabel }}</span>
              </span>
              <input
                :value="state.sunHour"
                type="range"
                min="6"
                max="20"
                step="0.5"
                class="mt-1 h-1.5 w-full accent-warn-500"
                :aria-label="t('ui.sunAria')"
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
                {{ state.night ? t('ui.night') : t('ui.day') }}
              </button>

              <button
                type="button"
                class="inline-flex h-9 items-center gap-1.5 rounded-field bg-surface px-2.5 text-[12px] font-semibold text-ink-700 ring-1 ring-inset ring-ink-200 transition-colors hover:bg-ink-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                @click="emit('reset')"
              >
                <UiIcon name="target" :size="15" />
                {{ t('ui.restoreView') }}
              </button>
            </div>

            <p class="text-[12px] leading-snug text-ink-500">{{ sunPhase }}</p>
          </div>
        </section>

        <!-- ============================ QATLAMLAR ============================ -->
        <section class="min-w-0" aria-labelledby="mkn-grp-layers">
          <h4
            id="mkn-grp-layers"
            class="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-500"
          >
            <UiIcon name="layers" :size="14" class="shrink-0 text-brand-500" />
            {{ t('ui.groupLayers') }}
          </h4>

          <div
            class="mt-2.5 flex flex-wrap gap-1.5"
            role="group"
            :aria-label="t('ui.layersToggleAria')"
          >
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

          <p class="mt-2 text-[12px] leading-snug text-ink-500">
            {{ t('ui.layersNote') }}
          </p>
        </section>

        <!-- ============================ ASBOBLAR ============================ -->
        <section class="min-w-0" aria-labelledby="mkn-grp-tools">
          <h4
            id="mkn-grp-tools"
            class="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-500"
          >
            <UiIcon name="tools" :size="14" class="shrink-0 text-brand-500" />
            {{ t('ui.groupTools') }}
          </h4>

          <div class="mt-2.5 space-y-2.5">
            <div>
              <span class="text-[12px] font-semibold text-ink-600">
                {{ t('ui.sectionPlane') }}
              </span>
              <div
                class="mt-1 flex flex-wrap gap-1.5"
                role="group"
                :aria-label="t('ui.sectionAxisAria')"
              >
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
                  class="flex items-baseline justify-between gap-2 text-[12px] font-semibold"
                  :class="state.sectionAxis === 'off' ? 'text-ink-400' : 'text-ink-600'"
                >
                  {{ t('ui.sectionPos') }}
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
                  :aria-label="t('ui.sectionPosAria')"
                  @input="emit('patch', { sectionCut: num($event) })"
                />
              </label>
              <p class="mt-1 text-[12px] leading-snug text-ink-500">{{ sectionNote }}</p>
            </div>

            <div class="border-t border-ink-100 pt-2.5">
              <span class="text-[12px] font-semibold text-ink-600">{{ t('ui.measure') }}</span>
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
                  {{ measureActive ? t('ui.measureOn') : t('ui.measureTool') }}
                </button>
                <button
                  type="button"
                  class="inline-flex h-9 items-center gap-1.5 rounded-field bg-surface px-2.5 text-[12px] font-semibold text-ink-700 ring-1 ring-inset ring-ink-200 transition-colors hover:bg-ink-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                  @click="emit('clear-measure')"
                >
                  <UiIcon name="trash" :size="15" />
                  {{ t('common.reset') }}
                </button>
              </div>
              <p class="mt-1 text-[12px] leading-snug text-ink-500">{{ measureNote }}</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>
