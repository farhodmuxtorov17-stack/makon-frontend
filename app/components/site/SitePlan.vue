<script setup lang="ts">
import { STRUCTURE_KIND, type SitePlot, type Structure, type StructureKindMeta } from '~/data/structures'
import { num } from '~/utils/format'

/**
 * Uchastka rejasi: qurilmalar yuqoridan ko‘rinishda chiziladi.
 *
 * Geometriya manbai bitta: `structures.ts` dagi metrdagi x, y, width, depth.
 * Chizma metrni pikselga bitta `scale` koeffitsiyenti orqali o‘tkazadi,
 * shuning uchun reja, o‘lcham chizig‘i va masshtab lineykasi doim bir xil
 * o‘lchovda qoladi. Konteyner kengligi o‘lchanadi va viewBox aynan piksel
 * o‘lchamida quriladi: shu tufayli yozuvlar kichraymaydi.
 */

const props = withDefaults(
  defineProps<{
    structures: Structure[]
    plot: SitePlot
    /** Chizma balandligi chegarasi, px */
    maxHeight?: number
  }>(),
  { maxHeight: 430 },
)

/** Tanlangan qurilma identifikatori: ro‘yxat bilan ikki tomonlama bog‘lanadi */
const selected = defineModel<string>('selected', { default: '' })

const wrap = ref<HTMLElement | null>(null)
const { width: measured } = useElementSize(wrap)

/** Chetlar: chapda va pastda o‘lcham chiziqlari uchun joy qoldiriladi */
const PAD = { left: 34, right: 12, top: 12, bottom: 38 }

/** Qurilma turining ohangi bo‘yicha bo‘yoq. Ranglar dizayn tokenlaridan */
const TONE_PAINT: Record<StructureKindMeta['tone'], { fill: string; stroke: string; text: string }> = {
  brand: { fill: '#dbe7ff', stroke: '#0256f7', text: '#0139b0' },
  ok: { fill: '#cdf2e6', stroke: '#01a573', text: '#04835d' },
  warn: { fill: '#ffe9c2', stroke: '#e8871a', text: '#8a4a0d' },
  violet: { fill: '#e4dbff', stroke: '#7d4fe0', text: '#6a3bc4' },
  neutral: { fill: '#e6ecf6', stroke: '#8595ad', text: '#48566b' },
}

/*
 * Reja konteyner kengligida chiziladi: viewBox birligi aynan bitta pikselga
 * teng bo‘ladi, shuning uchun 44 birlik bosish maydoni ekranda ham 44 px.
 *
 * O‘lchov kelmaguncha chizilmaydi. Ilgari bu yerda zaxira qiymat 640 turardi
 * va u konteyner bilan bog‘liq emas edi: telefonda 640 birlikli chizma 279 px
 * ga siqilardi, natijada bosish maydoni 44 emas, 19 px bo‘lib qolardi va
 * yozuvlar o‘qib bo‘lmas darajada kichrayardi.
 */
const ready = computed(() => measured.value > 0)
const canvasWidth = computed(() => Math.max(272, Math.round(measured.value)))

/** Tor ekranda reja pastroq bo‘ladi, shunda ro‘yxat ham ekranga sig‘adi */
const limitHeight = computed(() => (canvasWidth.value < 520 ? 296 : props.maxHeight))

const scale = computed(() => {
  const availW = canvasWidth.value - PAD.left - PAD.right
  const availH = limitHeight.value - PAD.top - PAD.bottom
  return Math.min(availW / Math.max(props.plot.width, 1), availH / Math.max(props.plot.depth, 1))
})

const box = computed(() => {
  const w = props.plot.width * scale.value
  const d = props.plot.depth * scale.value
  const availW = canvasWidth.value - PAD.left - PAD.right
  return { x: PAD.left + (availW - w) / 2, y: PAD.top, w, d }
})

const canvasHeight = computed(() => Math.round(box.value.d + PAD.top + PAD.bottom))

/** To‘r qadami: piksel oralig‘i 34 dan kichik bo‘lmaydigan yaxlit qiymat */
const gridStep = computed(
  () => [5, 10, 20, 25, 50, 100, 200].find((s) => s * scale.value >= 34) ?? 250,
)

const gridX = computed(() => {
  const out: number[] = []
  for (let m = gridStep.value; m < props.plot.width; m += gridStep.value) out.push(m * scale.value)
  return out
})

const gridY = computed(() => {
  const out: number[] = []
  for (let m = gridStep.value; m < props.plot.depth; m += gridStep.value) out.push(m * scale.value)
  return out
})

interface PlanShape {
  id: string
  x: number
  y: number
  w: number
  h: number
  fill: string
  stroke: string
  text: string
  meta: StructureKindMeta
  source: Structure
  /** Yer osti qurilmasi punktir bilan chiziladi */
  dashed: boolean
  label: string
  size: string
  showLabel: boolean
  showSize: boolean
  /** Avtoturargoh joylari chizig‘i */
  stalls: Array<{ x1: number; y1: number; x2: number; y2: number }>
  title: string
}

/**
 * Katta qurilma avval chiziladi, kichigi ustiga tushadi: yer osti parkovkasi
 * asosiy binoni o‘rab turadi, shuning uchun tartib muhim.
 */
const ordered = computed(() =>
  [...props.structures].sort((a, b) => b.width * b.depth - a.width * a.depth),
)

const shapes = computed<PlanShape[]>(() =>
  ordered.value.map((s) => {
    const meta = STRUCTURE_KIND[s.kind]
    const paint = TONE_PAINT[meta.tone]
    const x = box.value.x + s.x * scale.value
    const y = box.value.y + s.y * scale.value
    const w = s.width * scale.value
    const h = s.depth * scale.value
    const parking = s.kind === 'parkingSurface'

    /*
     * Avtoturargohda joy chiziqlari 2.5 m qadamda uzun tomon bo‘ylab
     * chiziladi. Chiziq soni cheklanadi, aks holda chizma qorayib ketadi.
     */
    const stalls: PlanShape['stalls'] = []
    if (parking && w > 24 && h > 24) {
      const along = s.width >= s.depth
      const total = Math.min(Math.floor((along ? s.width : s.depth) / 2.5), 34)
      const step = (along ? w : h) / Math.max(total, 1)
      for (let i = 1; i < total; i++) {
        if (along) stalls.push({ x1: x + i * step, y1: y + 3, x2: x + i * step, y2: y + h - 3 })
        else stalls.push({ x1: x + 3, y1: y + i * step, x2: x + w - 3, y2: y + i * step })
      }
    }

    return {
      id: s.id,
      x,
      y,
      w,
      h,
      fill: paint.fill,
      stroke: paint.stroke,
      text: paint.text,
      meta,
      source: s,
      dashed: s.kind === 'parkingUnderground',
      label: meta.short,
      size: `${num(s.width, 0)}×${num(s.depth, 0)} m`,
      showLabel: w >= 52 && h >= 19,
      showSize: w >= 66 && h >= 36,
      stalls,
      title: `${s.name}, ${meta.label}, ${num(s.width, 0)}×${num(s.depth, 0)} m`,
    }
  }),
)

/**
 * Qurilmaning bo‘sh, ya‘ni ustidan boshqa qurilma tushmagan joyi.
 *
 * Yer osti avtoturargohi asosiy binoni o‘rab turadi: uning to‘rtburchagi
 * kattaroq, shuning uchun avval chiziladi va o‘rtasi bino bilan berkiladi.
 * Ilgari bosish maydoni ham, yozuv ham aynan o‘sha berkilgan o‘rtaga
 * qo‘yilardi, natijada telefonda atigi 8 px chekka halqa bosilardi va
 * yozuvdan «Ye» harfigina ko‘rinardi.
 *
 * Shuning uchun har bir qurilma uchun ustidagi qurilmalar egallagan joy
 * hisoblanadi va to‘rt tomondan eng keng bo‘sh yo‘lak tanlanadi. Yozuv ham,
 * bosish maydoni ham o‘sha yo‘lakning o‘rtasiga tushadi.
 */
interface Anchor {
  cx: number
  cy: number
  freeW: number
  freeH: number
}

const anchors = computed<Map<string, Anchor>>(() => {
  const list = shapes.value
  const out = new Map<string, Anchor>()

  for (let i = 0; i < list.length; i++) {
    const sh = list[i]!
    const x0 = sh.x
    const y0 = sh.y
    const x1 = sh.x + sh.w
    const y1 = sh.y + sh.h

    // Keyin chizilgan, ya‘ni ustida turgan qurilmalar bilan kesishma
    let cx0 = Infinity
    let cy0 = Infinity
    let cx1 = -Infinity
    let cy1 = -Infinity
    for (let j = i + 1; j < list.length; j++) {
      const o = list[j]!
      const ix0 = Math.max(x0, o.x)
      const iy0 = Math.max(y0, o.y)
      const ix1 = Math.min(x1, o.x + o.w)
      const iy1 = Math.min(y1, o.y + o.h)
      if (ix1 <= ix0 || iy1 <= iy0) continue
      cx0 = Math.min(cx0, ix0)
      cy0 = Math.min(cy0, iy0)
      cx1 = Math.max(cx1, ix1)
      cy1 = Math.max(cy1, iy1)
    }

    const markaz = { cx: x0 + sh.w / 2, cy: y0 + sh.h / 2, freeW: sh.w, freeH: sh.h }

    // Kesishma yo‘q yoki o‘rtani berkitmaydi: o‘rta o‘z joyida qoladi
    if (cx1 < cx0 || markaz.cx < cx0 || markaz.cx > cx1 || markaz.cy < cy0 || markaz.cy > cy1) {
      out.set(sh.id, markaz)
      continue
    }

    /* To‘rt yo‘lak: tepa, past, chap, o‘ng. Eng kattasi tanlanadi. */
    const yolaklar = [
      { x: x0, y: y0, w: sh.w, h: Math.max(cy0 - y0, 0) },
      { x: x0, y: cy1, w: sh.w, h: Math.max(y1 - cy1, 0) },
      { x: x0, y: y0, w: Math.max(cx0 - x0, 0), h: sh.h },
      { x: cx1, y: y0, w: Math.max(x1 - cx1, 0), h: sh.h },
    ].sort((a, b) => b.w * b.h - a.w * a.h)

    const eng = yolaklar[0]!
    if (eng.w < 2 || eng.h < 2) {
      out.set(sh.id, markaz)
      continue
    }
    out.set(sh.id, {
      cx: eng.x + eng.w / 2,
      cy: eng.y + eng.h / 2,
      freeW: eng.w,
      freeH: eng.h,
    })
  }

  return out
})

const anchorOf = (id: string, sh: PlanShape): Anchor =>
  anchors.value.get(id) ?? { cx: sh.x + sh.w / 2, cy: sh.y + sh.h / 2, freeW: sh.w, freeH: sh.h }

/**
 * Bosish maydoni alohida qatlamda: har bir qurilmada kamida 44×44 px joy
 * qoladi, shuning uchun kichik qurilma ham telefonda bosiladi. Kichigi
 * ustida turadi, aks holda katta qurilma uni yopib qo‘yadi.
 */
const hits = computed(() =>
  shapes.value.map((sh) => {
    const a = anchorOf(sh.id, sh)
    const w = Math.max(Math.min(a.freeW, sh.w), 44)
    const h = Math.max(Math.min(a.freeH, sh.h), 44)
    return {
      id: sh.id,
      x: a.cx - w / 2,
      y: a.cy - h / 2,
      w,
      h,
      label: `${sh.source.name}, ${sh.meta.label}`,
    }
  }),
)

const activeShape = computed(() => shapes.value.find((s) => s.id === selected.value))

/** Chizmadagi turlar ro‘yxati: nishonchalar shu yerdan chiqadi */
const legend = computed(() => {
  const seen = new Map<string, { label: string; color: string; count: number }>()
  for (const s of props.structures) {
    const meta = STRUCTURE_KIND[s.kind]
    const found = seen.get(s.kind)
    if (found) found.count += 1
    else seen.set(s.kind, { label: meta.label, color: TONE_PAINT[meta.tone].stroke, count: 1 })
  }
  return Array.from(seen.values())
})

/** Masshtab lineykasi rejaning o‘ng pastki burchagida turadi */
const ruler = computed(() => {
  const len = gridStep.value * scale.value
  const x = box.value.x + box.value.w - len - 10
  const y = box.value.y + box.value.d - 14
  return { x, y, len, label: `${num(gridStep.value, 0)} m` }
})

const widthLabel = computed(() => `${num(props.plot.width, 0)} m`)
const depthLabel = computed(() => `${num(props.plot.depth, 0)} m`)

function pick(id: string) {
  selected.value = selected.value === id ? '' : id
}
</script>

<template>
  <div>
    <div ref="wrap" class="w-full">
      <svg
        v-if="structures.length && ready"
        :width="canvasWidth"
        :height="canvasHeight"
        :viewBox="`0 0 ${canvasWidth} ${canvasHeight}`"
        class="block w-full"
        role="group"
        aria-label="Uchastka rejasi, qurilmalar yuqoridan ko‘rinishda"
      >
        <!-- Uchastka maydoni va 10 metrli to‘r -->
        <rect
          :x="box.x"
          :y="box.y"
          :width="box.w"
          :height="box.d"
          rx="8"
          fill="#f8fafd"
          stroke="#cbd4e3"
          stroke-width="1"
        />
        <g stroke="#e2e8f2" stroke-width="1">
          <line
            v-for="gx in gridX"
            :key="`gx-${gx}`"
            :x1="box.x + gx"
            :y1="box.y + 1"
            :x2="box.x + gx"
            :y2="box.y + box.d - 1"
          />
          <line
            v-for="gy in gridY"
            :key="`gy-${gy}`"
            :x1="box.x + 1"
            :y1="box.y + gy"
            :x2="box.x + box.w - 1"
            :y2="box.y + gy"
          />
        </g>

        <!-- Qurilmalar -->
        <g v-for="sh in shapes" :key="sh.id">
          <rect
            :x="sh.x"
            :y="sh.y"
            :width="sh.w"
            :height="sh.h"
            rx="3"
            :fill="sh.fill"
            :fill-opacity="sh.dashed ? 0.55 : 1"
            :stroke="sh.stroke"
            :stroke-width="sh.id === selected ? 2.5 : 1.4"
            :stroke-dasharray="sh.dashed ? '6 4' : undefined"
          >
            <title>{{ sh.title }}</title>
          </rect>

          <line
            v-for="(st, i) in sh.stalls"
            :key="`${sh.id}-st-${i}`"
            :x1="st.x1"
            :y1="st.y1"
            :x2="st.x2"
            :y2="st.y2"
            :stroke="sh.stroke"
            stroke-width="1"
            stroke-opacity="0.42"
          />

          <!-- Yozuv qurilmaning berkilmagan joyiga tushadi -->
          <text
            v-if="sh.showLabel && anchorOf(sh.id, sh).freeW >= 52 && anchorOf(sh.id, sh).freeH >= 19"
            :x="anchorOf(sh.id, sh).cx"
            :y="anchorOf(sh.id, sh).cy + (sh.showSize && anchorOf(sh.id, sh).freeH >= 36 ? -3 : 4)"
            text-anchor="middle"
            font-size="12"
            font-weight="600"
            :fill="sh.text"
          >
            {{ sh.label }}
          </text>
          <text
            v-if="sh.showSize && anchorOf(sh.id, sh).freeW >= 66 && anchorOf(sh.id, sh).freeH >= 36"
            :x="anchorOf(sh.id, sh).cx"
            :y="anchorOf(sh.id, sh).cy + 12"
            text-anchor="middle"
            font-size="11"
            :fill="sh.text"
            fill-opacity="0.8"
          >
            {{ sh.size }}
          </text>
        </g>

        <!-- Tanlangan qurilma ajratiladi -->
        <rect
          v-if="activeShape"
          :x="activeShape.x - 4"
          :y="activeShape.y - 4"
          :width="activeShape.w + 8"
          :height="activeShape.h + 8"
          rx="6"
          fill="none"
          stroke="#0256f7"
          stroke-width="1.6"
          stroke-dasharray="5 4"
          pointer-events="none"
        />

        <!-- Masshtab lineykasi -->
        <g v-if="ruler.len > 24">
          <rect
            :x="ruler.x - 8"
            :y="ruler.y - 12"
            :width="ruler.len + 16"
            height="26"
            rx="6"
            fill="#ffffff"
            fill-opacity="0.9"
            stroke="#e2e8f2"
          />
          <line
            :x1="ruler.x"
            :y1="ruler.y + 4"
            :x2="ruler.x + ruler.len"
            :y2="ruler.y + 4"
            stroke="#48566b"
            stroke-width="1.4"
          />
          <line
            :x1="ruler.x"
            :y1="ruler.y"
            :x2="ruler.x"
            :y2="ruler.y + 8"
            stroke="#48566b"
            stroke-width="1.4"
          />
          <line
            :x1="ruler.x + ruler.len"
            :y1="ruler.y"
            :x2="ruler.x + ruler.len"
            :y2="ruler.y + 8"
            stroke="#48566b"
            stroke-width="1.4"
          />
          <text
            :x="ruler.x + ruler.len / 2"
            :y="ruler.y - 1"
            text-anchor="middle"
            font-size="11"
            font-weight="600"
            fill="#48566b"
          >
            {{ ruler.label }}
          </text>
        </g>

        <!-- Uchastka eni: pastdagi o‘lcham chizig‘i -->
        <g stroke="#94a2b8" stroke-width="1">
          <line :x1="box.x" :y1="box.y + box.d + 18" :x2="box.x + box.w" :y2="box.y + box.d + 18" />
          <line :x1="box.x" :y1="box.y + box.d + 13" :x2="box.x" :y2="box.y + box.d + 23" />
          <line
            :x1="box.x + box.w"
            :y1="box.y + box.d + 13"
            :x2="box.x + box.w"
            :y2="box.y + box.d + 23"
          />
        </g>
        <rect
          :x="box.x + box.w / 2 - 30"
          :y="box.y + box.d + 8"
          width="60"
          height="20"
          rx="5"
          fill="#ffffff"
        />
        <text
          :x="box.x + box.w / 2"
          :y="box.y + box.d + 22"
          text-anchor="middle"
          font-size="12"
          font-weight="600"
          fill="#48566b"
        >
          {{ widthLabel }}
        </text>

        <!-- Uchastka bo‘yi: chapdagi o‘lcham chizig‘i -->
        <g stroke="#94a2b8" stroke-width="1">
          <line :x1="box.x - 18" :y1="box.y" :x2="box.x - 18" :y2="box.y + box.d" />
          <line :x1="box.x - 23" :y1="box.y" :x2="box.x - 13" :y2="box.y" />
          <line :x1="box.x - 23" :y1="box.y + box.d" :x2="box.x - 13" :y2="box.y + box.d" />
        </g>
        <g :transform="`translate(${box.x - 18} ${box.y + box.d / 2}) rotate(-90)`">
          <rect x="-30" y="-10" width="60" height="20" rx="5" fill="#ffffff" />
          <text
            x="0"
            y="4"
            text-anchor="middle"
            font-size="12"
            font-weight="600"
            fill="#48566b"
          >
            {{ depthLabel }}
          </text>
        </g>

        <!-- Bosish maydoni: kamida 44 px, kichik qurilma ustida turadi -->
        <g>
          <rect
            v-for="hit in hits"
            :key="`hit-${hit.id}`"
            :x="hit.x"
            :y="hit.y"
            :width="hit.w"
            :height="hit.h"
            fill="transparent"
            class="cursor-pointer transition-colors hover:fill-brand-500/10"
            role="button"
            tabindex="0"
            :aria-label="hit.label"
            :aria-pressed="hit.id === selected"
            @click="pick(hit.id)"
            @keydown.enter.prevent="pick(hit.id)"
            @keydown.space.prevent="pick(hit.id)"
          />
        </g>
      </svg>

      <!-- O‘lchov kutilayotgan payt: joy egallab turadi, sakrash bo‘lmaydi -->
      <div
        v-else-if="structures.length"
        class="w-full animate-pulse rounded-panel bg-surface-sunken"
        :style="{ height: `${limitHeight}px` }"
        aria-hidden="true"
      />

      <UiEmpty
        v-else
        icon="grid"
        title="Uchastka tarkibi kiritilmagan"
        description="Bu obyekt bo‘yicha qurilmalar reyestri hali to‘ldirilmagan."
        compact
      />
    </div>

    <div v-if="structures.length" class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
      <span
        v-for="l in legend"
        :key="l.label"
        class="inline-flex items-center gap-2 text-[12px] text-ink-600"
      >
        <span class="size-3 shrink-0 rounded-[3px]" :style="{ backgroundColor: l.color }" />
        {{ l.label }}
        <span class="tabular font-semibold text-ink-400">{{ l.count }}</span>
      </span>
    </div>
  </div>
</template>
