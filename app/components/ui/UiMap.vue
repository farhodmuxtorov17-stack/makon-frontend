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

const { t } = useI18n()

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

/** Pin gradienti uchun ochiq va to‘q ohang */
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

/*
 * Klasterlash.
 *
 * Nuqtalar avval joriy masshtabdagi «jahon piksellari» ga o‘tkaziladi. Bu
 * qiymat xarita surilganda o‘zgarmaydi, shuning uchun guruhlar faqat masshtab,
 * o‘lcham yoki nuqtalar ro‘yxati o‘zgarganda qayta hisoblanadi. Surish paytida
 * faqat siljish qo‘shiladi.
 */

/** Ekranda shu masofadan yaqin nuqtalar bitta belgiga yig‘iladi, piksel */
const CLUSTER_PX = 44

interface MarkerGroup {
  key: string
  /** Guruh markazi, joriy masshtabdagi jahon piksellarida */
  wx: number
  wy: number
  items: MapMarker[]
  tone: string
}

/** Har bir xarita nusxasi uchun alohida gradient identifikatori */
const uid = useId()

const projected = computed(() => {
  // O‘lcham hali ma’lum bo‘lmasa guruhlash ham kerak emas
  void size.value.w
  return props.markers.map((m) => ({
    marker: m,
    wx: lon2px(m.lon, zoom.value),
    wy: lat2px(m.lat, zoom.value),
  }))
})

/** Guruhdagi eng ko‘p uchraydigan ohang, belgi rangi shundan olinadi */
function groupTone(items: MapMarker[]) {
  const tally = new Map<string, number>()
  for (const m of items) {
    const t = m.tone ?? 'brand'
    tally.set(t, (tally.get(t) ?? 0) + 1)
  }
  let best = 'brand'
  let top = 0
  for (const [t, n] of tally) {
    if (n > top) {
      top = n
      best = t
    }
  }
  return best
}

const groups = computed<MarkerGroup[]>(() => {
  const points = projected.value
  const taken = points.map(() => false)
  const out: MarkerGroup[] = []

  for (let i = 0; i < points.length; i++) {
    if (taken[i]) continue
    const seed = points[i]!
    taken[i] = true

    const bunch = [seed]
    let cx = seed.wx
    let cy = seed.wy

    for (let j = i + 1; j < points.length; j++) {
      if (taken[j]) continue
      const p = points[j]!
      if (Math.hypot(p.wx - cx, p.wy - cy) > CLUSTER_PX) continue
      taken[j] = true
      bunch.push(p)
      cx = bunch.reduce((s, b) => s + b.wx, 0) / bunch.length
      cy = bunch.reduce((s, b) => s + b.wy, 0) / bunch.length
    }

    const items = bunch.map((b) => b.marker)
    out.push({
      key: items.map((m) => m.id).join('.'),
      wx: cx,
      wy: cy,
      items,
      tone: groupTone(items),
    })
  }

  return out
})

/** Nechta nuqtani yig‘ganiga qarab belgi o‘lchami pog‘onalarda o‘sadi */
function badgeSize(n: number) {
  if (n >= 12) return 60
  if (n >= 7) return 52
  if (n >= 4) return 44
  return 38
}

/** Yoyilgan nuqtalar markazdan shu radiusdagi halqa bo‘ylab teng taqsimlanadi */
function spreadRadius(n: number) {
  return Math.min(148, Math.max(58, Math.round(7.6 * n) + 40))
}

/** Hozir yoyib ko‘rsatilayotgan guruh kaliti */
const spread = ref<string | null>(null)

const layout = computed(() => {
  const ox = origin.value.x
  const oy = origin.value.y

  const badges: Array<MarkerGroup & { left: number; top: number; size: number; open: boolean }> = []
  const pins: Array<MapMarker & { left: number; top: number; fromX?: number; fromY?: number }> = []

  for (const g of groups.value) {
    const left = g.wx - ox
    const top = g.wy - oy

    if (g.items.length === 1) {
      pins.push({ ...g.items[0]!, left, top })
      continue
    }

    const open = spread.value === g.key
    badges.push({ ...g, left, top, size: badgeSize(g.items.length), open })
    if (!open) continue

    const r = spreadRadius(g.items.length)
    g.items.forEach((m, i) => {
      const angle = (i / g.items.length) * Math.PI * 2 - Math.PI / 2
      pins.push({
        ...m,
        left: left + Math.cos(angle) * r,
        top: top + Math.sin(angle) * r,
        fromX: left,
        fromY: top,
      })
    })
  }

  return { badges, pins }
})

const badges = computed(() => layout.value.badges)
const placed = computed(() => layout.value.pins)

/** Yoyilgan nuqtalarni markaz bilan bog‘lovchi qisqa chiziqlar */
const links = computed(() =>
  layout.value.pins
    .filter((p) => p.fromX !== undefined && p.fromY !== undefined)
    .map((p) => ({ key: p.id, x1: p.fromX ?? 0, y1: p.fromY ?? 0, x2: p.left, y2: p.top })),
)

/** Guruh nuqtalari orasidagi eng katta oraliq, berilgan masshtabda, piksel */
function groupSpan(items: MapMarker[], z: number) {
  const xs = items.map((m) => lon2px(m.lon, z))
  const ys = items.map((m) => lat2px(m.lat, z))
  return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys))
}

/**
 * Guruh bosilganda nuqtalar ajraladigan eng yaqin masshtabga o‘tiladi.
 * Masshtab chegarasiga yetilgan bo‘lsa yoki eng yaqin masshtabda ham nuqtalar
 * ajralmasa, ular markaz atrofida halqa bo‘ylab yoyiladi.
 */
function openGroup(g: { key: string; items: MapMarker[] }) {
  if (spread.value === g.key) {
    spread.value = null
    return
  }

  if (zoom.value >= props.maxZoom || groupSpan(g.items, props.maxZoom) <= CLUSTER_PX) {
    spread.value = g.key
    return
  }

  spread.value = null

  const lats = g.items.map((m) => m.lat)
  const lons = g.items.map((m) => m.lon)
  center.value = {
    lat: (Math.min(...lats) + Math.max(...lats)) / 2,
    lon: (Math.min(...lons) + Math.max(...lons)) / 2,
  }

  const w = Math.max(size.value.w - 96, 120)
  const h = Math.max(size.value.h - 96, 120)

  // Guruh to‘liq sig‘adigan eng yaqin masshtab
  let cap = props.maxZoom
  for (let z = props.maxZoom; z > zoom.value; z--) {
    const xs = g.items.map((m) => lon2px(m.lon, z))
    const ys = g.items.map((m) => lat2px(m.lat, z))
    if (Math.max(...xs) - Math.min(...xs) <= w && Math.max(...ys) - Math.min(...ys) <= h) {
      cap = z
      break
    }
  }

  // Nuqtalar bir-biridan uziladigan eng kichik masshtab
  let split = props.maxZoom
  for (let z = zoom.value + 1; z <= props.maxZoom; z++) {
    if (groupSpan(g.items, z) > CLUSTER_PX * 1.5) {
      split = z
      break
    }
  }

  setZoom(clamp(Math.min(cap, split), zoom.value + 1, props.maxZoom))
}

// Masshtab yoki nuqtalar ro‘yxati o‘zgarsa yoyilgan guruh yopiladi
watch([zoom, () => props.markers], () => {
  spread.value = null
})

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
  spread.value = null
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
      <!-- Yoyilgan guruhni markazi bilan bog‘lovchi chiziqlar -->
      <svg v-if="links.length" class="pointer-events-none absolute inset-0 size-full" aria-hidden="true">
        <line
          v-for="l in links"
          :key="`link-${l.key}`"
          :x1="l.x1"
          :y1="l.y1"
          :x2="l.x2"
          :y2="l.y2"
          stroke="#131C2B"
          stroke-opacity="0.34"
          stroke-width="1.5"
          stroke-linecap="round"
        />
      </svg>

      <!-- Yaqin nuqtalar guruhi -->
      <div
        v-for="g in badges"
        :key="`group-${g.key}`"
        data-marker
        class="absolute -translate-x-1/2 -translate-y-1/2"
        :class="g.open || g.items.some((m) => m.id === highlight) ? 'z-10' : ''"
        :style="{ left: `${g.left}px`, top: `${g.top}px` }"
      >
        <button
          type="button"
          class="grid min-h-11 min-w-11 place-items-center transition-transform duration-200 ease-out hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-500"
          :class="
            g.open || g.items.some((m) => m.id === highlight)
              ? 'scale-110 drop-shadow-[0_8px_14px_rgba(19,28,43,0.32)]'
              : 'drop-shadow-[0_4px_9px_rgba(19,28,43,0.26)]'
          "
          :aria-label="
            t('ui.clusterAria', {
              count: g.items.length,
              action: g.open ? t('ui.clusterCollapse') : t('ui.clusterExpand'),
            })
          "
          :aria-expanded="g.open"
          @click="openGroup(g)"
        >
          <svg
            :width="g.size"
            :height="g.size"
            viewBox="0 0 64 64"
            fill="none"
            class="block"
            aria-hidden="true"
          >
            <defs>
              <linearGradient
                :id="`cluster-${uid}-${g.key}`"
                x1="14"
                y1="10"
                x2="50"
                y2="54"
                gradientUnits="userSpaceOnUse"
              >
                <stop :stop-color="pinTone(g.tone)[0]" />
                <stop offset="1" :stop-color="pinTone(g.tone)[1]" />
              </linearGradient>
            </defs>

            <!-- Tashqi yumshoq halqa, pin ohangining ochiq tusi -->
            <circle cx="32" cy="32" r="30" :fill="pinTone(g.tone)[0]" opacity=".2" />
            <circle cx="32" cy="32" r="26.5" :fill="pinTone(g.tone)[0]" opacity=".28" />

            <circle
              cx="32"
              cy="32"
              r="22.5"
              :fill="`url(#cluster-${uid}-${g.key})`"
              stroke="#FFFFFF"
              stroke-width="2.6"
            />

            <!-- Yuqoridan tushuvchi yorug‘lik, pin bilan bir tilda -->
            <path
              d="M32 11.5c-9.9 0-18.2 7-20.1 16.3A20.5 20.5 0 0 1 32 18.9c8.4 0 15.8 5 20.1 8.9C50.2 18.5 41.9 11.5 32 11.5z"
              fill="#FFFFFF"
              opacity=".16"
            />

            <text
              x="32"
              y="39"
              text-anchor="middle"
              class="tabular"
              font-size="20"
              font-weight="700"
              fill="#FFFFFF"
            >
              {{ g.items.length }}
            </text>
          </svg>
        </button>
      </div>

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

            <!-- Yuqoridan tushuvchi yorug‘lik -->
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
          <p class="text-[14px] font-semibold text-ink-900">{{ m.label }}</p>
          <p v-if="m.caption" class="mt-0.5 text-[12px] text-ink-500">{{ m.caption }}</p>
          <p v-if="m.value !== undefined" class="tabular mt-2 text-[22px] font-bold text-ink-900">
            {{ Math.round(m.value) }}<span class="ml-1 text-[12px] font-medium text-ink-500">
              {{ m.valueLabel ?? '%' }}
            </span>
          </p>
          <NuxtLink
            v-if="m.to"
            :to="m.to"
            class="mt-2 inline-flex items-center gap-1 text-[13px] font-semibold text-brand-600 hover:text-brand-700"
          >
            {{ t('ui.openObject') }}
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
          <dd class="tabular text-[16px] font-bold text-ink-900">{{ s.value }}</dd>
        </div>
      </dl>
    </div>

    <!-- Boshqaruv -->
    <div class="absolute right-3 top-3 flex flex-col gap-1.5">
      <button
        type="button"
        class="grid size-11 place-items-center rounded-field bg-surface md:size-9 text-ink-700 shadow-card ring-1 ring-ink-200 transition-colors hover:bg-brand-50 hover:text-brand-600 disabled:opacity-40"
        :aria-label="t('ui.enlarge')"
        :disabled="zoom >= maxZoom"
        @click="setZoom(zoom + 1)"
      >
        <UiIcon name="plus" :size="18" />
      </button>
      <button
        type="button"
        class="grid size-11 place-items-center rounded-field bg-surface md:size-9 text-ink-700 shadow-card ring-1 ring-ink-200 transition-colors hover:bg-brand-50 hover:text-brand-600 disabled:opacity-40"
        :aria-label="t('ui.reduce')"
        :disabled="zoom <= minZoom"
        @click="setZoom(zoom - 1)"
      >
        <UiIcon name="minus" :size="18" />
      </button>
      <button
        type="button"
        class="grid size-11 place-items-center rounded-field bg-surface md:size-9 text-ink-700 shadow-card ring-1 ring-ink-200 transition-colors hover:bg-brand-50 hover:text-brand-600"
        :aria-label="t('ui.showAllObjects')"
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
      <span v-for="l in legend" :key="l.label" class="flex items-center gap-1.5 text-[12px] text-ink-600">
        <span class="size-2.5 rounded-full" :class="l.class" />
        {{ l.label }}
      </span>
    </div>

    <!-- Litsenziya talabiga ko‘ra manba ko‘rsatiladi -->
    <p class="absolute bottom-0 right-0 bg-surface/85 px-1.5 py-0.5 text-[11px] text-ink-500">
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
