<script setup lang="ts">
export interface MapMarker {
  id: string
  lat: number
  lon: number
  label: string
  /** Nishoncha ostidagi qo‘shimcha qator */
  caption?: string
  /** 0–100: nuqta o‘lchami va rangi shu qiymatdan kelib chiqadi */
  value?: number
  /** Qiymat yonida ko‘rsatiladigan birlik */
  valueLabel?: string
  to?: string
  tone?: 'brand' | 'ok' | 'warn' | 'danger' | 'info'
}

const props = withDefaults(
  defineProps<{
    markers?: MapMarker[]
    center?: { lat: number; lon: number }
    zoom?: number
    minZoom?: number
    maxZoom?: number
    height?: string
    /** Maydon ulushini bildiruvchi doiralar */
    showCoverage?: boolean
    /** Yuqori chap burchakdagi ko‘rsatkichlar paneli */
    stats?: Array<{ label: string; value: string }>
    legend?: Array<{ label: string; class: string }>
    /** Ochilganda barcha nuqtalar ko‘rinadigan qilib joylashtiriladi */
    autoFit?: boolean
  }>(),
  {
    markers: () => [],
    center: () => ({ lat: 41.3111, lon: 69.2797 }),
    zoom: 12,
    minZoom: 10,
    maxZoom: 14,
    height: '420px',
    showCoverage: true,
    stats: () => [],
    legend: () => [],
    autoFit: true,
  },
)

const emit = defineEmits<{ markerClick: [marker: MapMarker] }>()

const TILE = 256

/** Yuklab olingan plitkalar qamrovi, markaz shu chegaradan chiqmaydi */
const BOUNDS = { lonMin: 68.95, lonMax: 69.9, latMin: 41.0, latMax: 41.65 }

const lon2px = (lon: number, z: number) => ((lon + 180) / 360) * 2 ** z * TILE
const lat2px = (lat: number, z: number) =>
  ((1 - Math.asinh(Math.tan((lat * Math.PI) / 180)) / Math.PI) / 2) * 2 ** z * TILE
const px2lon = (x: number, z: number) => (x / (2 ** z * TILE)) * 360 - 180
const px2lat = (y: number, z: number) => {
  const n = Math.PI - 2 * Math.PI * (y / (2 ** z * TILE))
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)))
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

const host = ref<HTMLElement | null>(null)
const size = ref({ w: 800, h: 420 })
const zoom = ref(props.zoom)
const center = ref({ ...props.center })
const active = ref<string | null>(null)
const dragging = ref(false)

let observer: ResizeObserver | null = null
let start = { x: 0, y: 0, cx: 0, cy: 0 }

let fitted = false

onMounted(() => {
  if (!host.value) return
  observer = new ResizeObserver(([entry]) => {
    if (!entry) return
    size.value = { w: entry.contentRect.width, h: entry.contentRect.height }
    // Birinchi o‘lcham ma’lum bo‘lgach barcha nuqtalar ko‘rinadigan qilib joylaymiz
    if (!fitted && props.autoFit && entry.contentRect.width > 0) {
      fitted = true
      fit()
    }
  })
  observer.observe(host.value)
})

onBeforeUnmount(() => observer?.disconnect())

/** Ko‘rinayotgan maydonning chap-yuqori burchagi, jahon piksellarida */
const origin = computed(() => ({
  x: lon2px(center.value.lon, zoom.value) - size.value.w / 2,
  y: lat2px(center.value.lat, zoom.value) - size.value.h / 2,
}))

const tiles = computed(() => {
  const z = zoom.value
  const max = 2 ** z
  const { x, y } = origin.value
  const x0 = Math.floor(x / TILE)
  const y0 = Math.floor(y / TILE)
  const x1 = Math.floor((x + size.value.w) / TILE)
  const y1 = Math.floor((y + size.value.h) / TILE)
  const out: Array<{ key: string; src: string; left: number; top: number }> = []
  for (let tx = x0; tx <= x1; tx++) {
    for (let ty = y0; ty <= y1; ty++) {
      if (ty < 0 || ty >= max) continue
      const wrapped = ((tx % max) + max) % max
      out.push({
        key: `${z}/${tx}/${ty}`,
        src: assetUrl(`map/${z}/${wrapped}/${ty}.png`),
        left: tx * TILE - x,
        top: ty * TILE - y,
      })
    }
  }
  return out
})

const placed = computed(() =>
  props.markers.map((m) => ({
    ...m,
    left: lon2px(m.lon, zoom.value) - origin.value.x,
    top: lat2px(m.lat, zoom.value) - origin.value.y,
  })),
)

const TONE_DOT: Record<string, string> = {
  brand: 'bg-brand-500',
  ok: 'bg-ok-500',
  warn: 'bg-warn-500',
  danger: 'bg-danger-500',
  info: 'bg-info-500',
}

const TONE_RING: Record<string, string> = {
  brand: 'bg-brand-500/15',
  ok: 'bg-ok-500/15',
  warn: 'bg-warn-500/15',
  danger: 'bg-danger-500/15',
  info: 'bg-info-500/15',
}

function recenter() {
  center.value = {
    lat: clamp(center.value.lat, BOUNDS.latMin, BOUNDS.latMax),
    lon: clamp(center.value.lon, BOUNDS.lonMin, BOUNDS.lonMax),
  }
}

function onPointerDown(e: PointerEvent) {
  if ((e.target as HTMLElement).closest('[data-marker]')) return
  dragging.value = true
  start = {
    x: e.clientX,
    y: e.clientY,
    cx: lon2px(center.value.lon, zoom.value),
    cy: lat2px(center.value.lat, zoom.value),
  }
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}

function onPointerMove(e: PointerEvent) {
  if (!dragging.value) return
  const nx = start.cx - (e.clientX - start.x)
  const ny = start.cy - (e.clientY - start.y)
  center.value = { lon: px2lon(nx, zoom.value), lat: px2lat(ny, zoom.value) }
  recenter()
}

function onPointerUp(e: PointerEvent) {
  dragging.value = false
  ;(e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId)
}

function setZoom(next: number) {
  zoom.value = clamp(Math.round(next), props.minZoom, props.maxZoom)
  recenter()
}

function onWheel(e: WheelEvent) {
  e.preventDefault()
  setZoom(zoom.value + (e.deltaY < 0 ? 1 : -1))
}

/** Barcha nuqtalar sig‘adigan eng katta masshtabni tanlaydi */
function fit() {
  if (!props.markers.length) return
  const lats = props.markers.map((m) => m.lat)
  const lons = props.markers.map((m) => m.lon)
  const latMin = Math.min(...lats)
  const latMax = Math.max(...lats)
  const lonMin = Math.min(...lons)
  const lonMax = Math.max(...lons)

  center.value = { lat: (latMin + latMax) / 2, lon: (lonMin + lonMax) / 2 }

  const padding = 96
  const w = Math.max(size.value.w - padding, 120)
  const h = Math.max(size.value.h - padding, 120)

  let best = props.minZoom
  for (let z = props.maxZoom; z >= props.minZoom; z--) {
    const dx = Math.abs(lon2px(lonMax, z) - lon2px(lonMin, z))
    const dy = Math.abs(lat2px(latMin, z) - lat2px(latMax, z))
    if (dx <= w && dy <= h) {
      best = z
      break
    }
  }
  setZoom(best)
}

function pick(m: MapMarker) {
  active.value = active.value === m.id ? null : m.id
  emit('markerClick', m)
}

/** Plitka yo‘q bo‘lsa (masalan chekka hudud), jimgina yashiriladi */
function hideTile(e: Event) {
  ;(e.target as HTMLImageElement).style.visibility = 'hidden'
}
</script>

<template>
  <div
    ref="host"
    class="relative select-none overflow-hidden rounded-panel bg-[#EDF3F7] ring-1 ring-inset ring-ink-200"
    :style="{ height }"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @wheel="onWheel"
  >
    <!-- Plitka qatlami -->
    <div class="absolute inset-0" :class="dragging ? 'cursor-grabbing' : 'cursor-grab'">
      <img
        v-for="t in tiles"
        :key="t.key"
        :src="t.src"
        width="256"
        height="256"
        alt=""
        draggable="false"
        class="pointer-events-none absolute max-w-none"
        :style="{ left: `${t.left}px`, top: `${t.top}px` }"
        @error="hideTile"
      />
    </div>

    <!-- Maydon qamrovi doiralari -->
    <div v-if="showCoverage" class="pointer-events-none absolute inset-0">
      <span
        v-for="m in placed"
        :key="`c-${m.id}`"
        class="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
        :class="TONE_RING[m.tone ?? 'brand']"
        :style="{
          left: `${m.left}px`,
          top: `${m.top}px`,
          width: `${40 + (m.value ?? 50) * 0.9}px`,
          height: `${40 + (m.value ?? 50) * 0.9}px`,
        }"
      />
    </div>

    <!-- Markerlar -->
    <div class="absolute inset-0">
      <div
        v-for="m in placed"
        :key="m.id"
        data-marker
        class="absolute -translate-x-1/2 -translate-y-1/2"
        :style="{ left: `${m.left}px`, top: `${m.top}px` }"
      >
        <button
          type="button"
          class="group relative grid size-9 place-items-center rounded-full bg-surface shadow-pop ring-2 ring-white transition-transform hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          :aria-label="`${m.label}${m.caption ? ', ' + m.caption : ''}`"
          :aria-expanded="active === m.id"
          @click="pick(m)"
        >
          <span class="size-3.5 rounded-full" :class="TONE_DOT[m.tone ?? 'brand']" />
          <span
            v-if="m.value !== undefined"
            class="tabular absolute -right-1.5 -top-1.5 rounded-full bg-ink-900 px-1.5 text-[10px] font-bold leading-4 text-white"
          >
            {{ Math.round(m.value) }}
          </span>
        </button>

        <!-- Ma’lumot kartasi -->
        <div
          v-if="active === m.id"
          class="absolute bottom-full left-1/2 z-20 mb-2 w-56 -translate-x-1/2 rounded-field bg-surface p-3 text-left shadow-pop ring-1 ring-ink-200"
        >
          <p class="text-[13.5px] font-semibold text-ink-900">{{ m.label }}</p>
          <p v-if="m.caption" class="mt-0.5 text-[12px] text-ink-500">{{ m.caption }}</p>
          <p v-if="m.value !== undefined" class="tabular mt-2 text-[20px] font-bold text-ink-900">
            {{ Math.round(m.value) }}<span class="ml-1 text-[12px] font-medium text-ink-500">
              {{ m.valueLabel ?? '%' }}
            </span>
          </p>
          <NuxtLink
            v-if="m.to"
            :to="m.to"
            class="mt-2 inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand-600 hover:text-brand-700"
          >
            Obyektni ochish
            <UiIcon name="chevronRight" :size="14" />
          </NuxtLink>
        </div>
      </div>
    </div>

    <!-- Ko‘rsatkichlar paneli -->
    <div
      v-if="stats.length"
      class="absolute left-3 top-3 rounded-field bg-surface/95 p-3 shadow-card ring-1 ring-ink-200 backdrop-blur-sm"
    >
      <dl class="grid grid-cols-2 gap-x-5 gap-y-2">
        <div v-for="s in stats" :key="s.label">
          <dt class="text-[11px] uppercase tracking-wide text-ink-500">{{ s.label }}</dt>
          <dd class="tabular text-[15px] font-bold text-ink-900">{{ s.value }}</dd>
        </div>
      </dl>
    </div>

    <!-- Boshqaruv -->
    <div class="absolute right-3 top-3 flex flex-col gap-1.5">
      <button
        type="button"
        class="grid size-9 place-items-center rounded-field bg-surface text-ink-700 shadow-card ring-1 ring-ink-200 transition-colors hover:bg-brand-50 hover:text-brand-600 disabled:opacity-40"
        aria-label="Kattalashtirish"
        :disabled="zoom >= maxZoom"
        @click="setZoom(zoom + 1)"
      >
        <UiIcon name="plus" :size="18" />
      </button>
      <button
        type="button"
        class="grid size-9 place-items-center rounded-field bg-surface text-ink-700 shadow-card ring-1 ring-ink-200 transition-colors hover:bg-brand-50 hover:text-brand-600 disabled:opacity-40"
        aria-label="Kichraytirish"
        :disabled="zoom <= minZoom"
        @click="setZoom(zoom - 1)"
      >
        <UiIcon name="minus" :size="18" />
      </button>
      <button
        type="button"
        class="grid size-9 place-items-center rounded-field bg-surface text-ink-700 shadow-card ring-1 ring-ink-200 transition-colors hover:bg-brand-50 hover:text-brand-600"
        aria-label="Barcha obyektlarni ko‘rsatish"
        @click="fit"
      >
        <UiIcon name="target" :size="18" />
      </button>
    </div>

    <!-- Izoh -->
    <div
      v-if="legend.length"
      class="absolute bottom-3 left-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-field bg-surface/95 px-3 py-2 shadow-card ring-1 ring-ink-200 backdrop-blur-sm"
    >
      <span v-for="l in legend" :key="l.label" class="flex items-center gap-1.5 text-[11.5px] text-ink-600">
        <span class="size-2.5 rounded-full" :class="l.class" />
        {{ l.label }}
      </span>
    </div>

    <!-- Litsenziya talabiga ko‘ra manba ko‘rsatiladi -->
    <p class="absolute bottom-0 right-0 bg-surface/85 px-1.5 py-0.5 text-[10px] text-ink-500">
      <a
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noopener"
        class="hover:text-brand-600"
      >
        © OpenStreetMap
      </a>
      ·
      <a href="https://carto.com/attributions" target="_blank" rel="noopener" class="hover:text-brand-600">
        © CARTO
      </a>
    </p>
  </div>
</template>
