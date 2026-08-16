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
    /** Tashqaridan ajratib ko‘rsatiladigan nuqta, masalan ro‘yxatdagi karta ustida */
    highlight?: string | null
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
    highlight: null,
  },
)

const emit = defineEmits<{
  markerClick: [marker: MapMarker]
  markerHover: [id: string | null]
}>()

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

/** Pin gradienti uchun ochiq va toʻq ohang */
const TONE_HEX: Record<string, [string, string]> = {
  brand: ['#4E8BFB', '#0139B0'],
  ok: ['#3FBDA8', '#04835D'],
  warn: ['#F5B45C', '#BD6512'],
  danger: ['#FB7679', '#BD131A'],
  info: ['#A98BF2', '#6A3BC4'],
}

function pinTone(tone?: string): [string, string] {
  return TONE_HEX[tone ?? 'brand'] ?? TONE_HEX.brand!
}

const TONE_RING_SOLID: Record<string, string> = {
  brand: 'ring-brand-500',
  ok: 'ring-ok-500',
  warn: 'ring-warn-500',
  danger: 'ring-danger-500',
  info: 'ring-info-500',
}

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
        class="absolute -translate-x-1/2 -translate-y-full"
        :class="highlight === m.id || active === m.id ? 'z-10' : ''"
        :style="{ left: `${m.left}px`, top: `${m.top}px` }"
      >
        <button
          type="button"
          class="group relative block transition-[transform,filter] duration-200 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-500"
          :class="
            active === m.id
              ? 'scale-[1.18] drop-shadow-[0_8px_14px_rgba(19,28,43,0.35)]'
              : highlight === m.id
                ? 'scale-110 drop-shadow-[0_6px_12px_rgba(19,28,43,0.28)]'
                : 'drop-shadow-[0_3px_6px_rgba(19,28,43,0.22)] hover:scale-105'
          "
          :aria-label="`${m.label}${m.caption ? ', ' + m.caption : ''}`"
          :aria-expanded="active === m.id"
          @click="pick(m)"
          @mouseenter="emit('markerHover', m.id)"
          @mouseleave="emit('markerHover', null)"
          @focus="emit('markerHover', m.id)"
          @blur="emit('markerHover', null)"
        >
          <svg width="44" height="54" viewBox="0 0 44 54" fill="none" class="block">
            <defs>
              <linearGradient :id="`pin-${m.id}`" x1="8" y1="4" x2="36" y2="42">
                <stop :stop-color="pinTone(m.tone)[0]" />
                <stop offset="1" :stop-color="pinTone(m.tone)[1]" />
              </linearGradient>
            </defs>

            <!-- Yerdagi soya -->
            <ellipse cx="22" cy="49.5" rx="7" ry="2.4" fill="#131C2B" opacity=".22" />

            <!-- Pin gavdasi: yumaloq bosh va pastga qarab ingichkalashuvchi uch -->
            <path
              d="M22 3.5c-8.8 0-16 7.1-16 15.9 0 5.6 2.6 9.6 6.2 13.6l8 8.9c1 1.1 2.6 1.1 3.6 0l8-8.9c3.6-4 6.2-8 6.2-13.6 0-8.8-7.2-15.9-16-15.9z"
              :fill="`url(#pin-${m.id})`"
              stroke="#FFFFFF"
              stroke-width="2.4"
              stroke-linejoin="round"
            />

            <!-- Yuqoridan tushuvchi yorugʻlik -->
            <path
              d="M22 6.4c-7 0-12.8 5.4-13 12.2 3.4-3.6 7.9-5.6 13-5.6s9.6 2 13 5.6c-.2-6.8-6-12.2-13-12.2z"
              fill="#FFFFFF"
              opacity=".22"
            />

            <text
              x="22"
              y="24.5"
              text-anchor="middle"
              class="tabular"
              font-size="13.5"
              font-weight="700"
              fill="#FFFFFF"
            >
              {{ m.value !== undefined ? Math.round(m.value) : '' }}
            </text>
          </svg>

          <!-- Tanlangan pin ostidagi puls halqasi -->
          <span
            v-if="active === m.id"
            class="pointer-events-none absolute bottom-1 left-1/2 size-3 -translate-x-1/2 rounded-full ring-2"
            :class="TONE_RING_SOLID[m.tone ?? 'brand']"
            aria-hidden="true"
          />
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
