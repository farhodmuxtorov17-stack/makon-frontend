<script setup lang="ts">
import type { Building } from '~/data/buildings'
import { unitsOfBuilding, type Unit } from '~/data/units'
import { area as areaLabel } from '~/utils/format'

/**
 * Bino aksonometrik ko‘rinishi.
 *
 * Butun geometriya bino yozuvidan hisoblanadi: qavatlar soni, yer osti
 * darajalari, ijaraga beriladigan maydon va bino turi plitalar balandligi
 * hamda tayanch konturi o‘lchamlarini beradi. Har bir qavatning unit
 * ko‘pburchaklari (0..1 normalizatsiyada) o‘sha plitaning ustki yuzasiga
 * bir xil proyeksiya matritsasi orqali tushiriladi, shu sababli 3D dagi
 * reja 2D reja bilan bir xil geometriya bo‘ladi.
 *
 * Proyeksiya: model z o‘qi atrofida `rotation` burchagiga buriladi, so‘ng
 * `tilt` balandlik burchagi bilan ekranga tushiriladi.
 *   u = x·cosθ − y·sinθ
 *   v = x·sinθ + y·cosθ
 *   ekranX = cx + u·s
 *   ekranY = cy − (v·sinφ + z·cosφ)·s
 * Yuzaning ko‘rinishi normal vektorning kamera yo‘nalishiga skalyar
 * ko‘paytmasi orqali aniqlanadi, chizish tartibi pastdan yuqoriga.
 */

type ViewMode = 'occupancy' | 'levels' | 'interior' | 'furnished' | 'wire'

interface MixItem {
  key: string
  label: string
  color: string
  count: number
  area: number
  share: number
}

interface LevelInfo {
  floor: number
  index: number
  name: string
  short: string
  underground: boolean
  units: Unit[]
  total: number
  totalArea: number
  vacantCount: number
  vacantArea: number
  occupancy: number
  mix: MixItem[]
  label: string
}

interface FacePart {
  points: string
  fill: string
}

interface UnitShape {
  id: string
  code: string
  points: string
  fill: string
  cx: number
  cy: number
  active: boolean
}

interface InteriorItem {
  /** 'p': birlashtirilgan yo‘l, 'c', bosh yoki gul tojining doirasi */
  k: 'p' | 'c'
  d?: string
  f: string
  o?: number
  w?: number
  x?: number
  y?: number
  r?: number
}

interface SlabView {
  floor: number
  name: string
  short: string
  underground: boolean
  selected: boolean
  dim: number
  parts: FacePart[]
  topPoints: string
  topFill: string
  edges: Array<{ d: string; hidden: boolean }>
  units: UnitShape[]
  interior: InteriorItem[] | null
  anchorX: number
  anchorY: number
  showLabel: boolean
  aria: string
}

const props = withDefaults(
  defineProps<{
    building: Building
    /** Tanlangan qavat raqami (yer osti darajalari manfiy) */
    floor?: number
    /** Tanlangan unit identifikatori */
    unit?: string
    mode?: ViewMode
    /** Boshqaruv klasteri va izoh qatorini ko‘rsatish */
    controls?: boolean
    heightClass?: string
  }>(),
  {
    floor: 1,
    unit: '',
    mode: 'occupancy',
    controls: true,
    heightClass: 'h-[340px] sm:h-[440px] lg:h-[540px] xl:h-[600px]',
  },
)

const emit = defineEmits<{
  (e: 'update:floor', value: number): void
  (e: 'update:unit', value: string): void
  (e: 'update:mode', value: ViewMode): void
}>()

const VW = 900
const VH = 620

const MODES: Array<{ value: ViewMode; label: string; hint: string }> = [
  { value: 'occupancy', label: 'Bandlik', hint: 'Plita yon yuzasi holatlar ulushiga bo‘linadi' },
  { value: 'levels', label: 'Qavatlar', hint: 'Neytral plitalar va qavat raqamlari' },
  { value: 'interior', label: 'Interyer', hint: 'Har bir plitaga unit konturlari tushiriladi' },
  {
    value: 'furnished',
    label: 'Jihozlangan',
    hint: 'Tanlangan qavat devor, eshik, jihoz va xodimlar bilan',
  },
  { value: 'wire', label: 'Karkas', hint: 'Faqat qirralar, ichki tuzilma ko‘rinadi' },
]

/** Holat legendasi: tartib va ranglar buyurtmachi maketidan */
const CATEGORIES: Array<{ key: string; label: string; color: string }> = [
  { key: 'vacant', label: 'Bo‘sh', color: '#16B99A' },
  { key: 'rented', label: 'Ijarada', color: '#0256F7' },
  { key: 'sold', label: 'Sotilgan', color: '#F84448' },
  { key: 'reserved', label: 'Rezerv', color: '#FAA53F' },
  { key: 'other', label: 'Texnik / Boshqa', color: '#8494AC' },
]

const CATEGORY_OF: Record<string, string> = {
  VACANT: 'vacant',
  RENTED: 'rented',
  SOLD: 'sold',
  RESERVED: 'reserved',
  MAINTENANCE: 'other',
  DRAFT: 'other',
}

const EMPTY_COLOR = '#AFC0D6'
/** Unit konturlari egallamagan yuza, yo‘lak va yadro */
const CORRIDOR = '#E4EBF5'

/** Qavat balandligi, m: bino turiga qarab (ombor balandroq, turar joy pastroq) */
const FLOOR_HEIGHT: Record<string, number> = {
  'Biznes markaz': 3.9,
  'Ofis binosi': 3.7,
  'Savdo markaz': 5.4,
  'Ombor / logistika': 8.4,
  'Turar joy': 3.2,
}

/** Tayanch kontur nisbati (chuqurlik / kenglik) */
const PLAN_RATIO: Record<string, number> = {
  'Biznes markaz': 0.7,
  'Ofis binosi': 0.66,
  'Savdo markaz': 0.78,
  'Ombor / logistika': 0.5,
  'Turar joy': 0.58,
}

const rotation = ref(32)
const tilt = ref(34)
const zoom = ref(1)
const explode = ref(0)
const hovered = ref<number | null>(null)
const hoveredUnit = ref('')
const focused = ref<number | null>(null)
const dragging = ref(false)

let dragX = 0
let dragY = 0
let dragRot = 0
let dragTilt = 0
let dragDist = 0
let blockClick = false

function clamp(value: number, min: number, max: number) {
  return value < min ? min : value > max ? max : value
}

function wrap360(value: number) {
  return ((value % 360) + 360) % 360
}

function r1(value: number) {
  return Math.round(value * 10) / 10
}

function rgbOf(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** amount > 0: oqartiradi, amount < 0: qoraytiradi (yuz soyalari uchun) */
function shade(hex: string, amount: number) {
  const [r, g, b] = rgbOf(hex)
  const k = Math.abs(amount)
  const t: [number, number, number] = amount >= 0 ? [255, 255, 255] : [10, 21, 38]
  const mix = (c: number, d: number) => Math.round(c + (d - c) * k)
  return `rgb(${mix(r, t[0])},${mix(g, t[1])},${mix(b, t[2])})`
}

const allUnits = computed(() => unitsOfBuilding(props.building.id))

const levels = computed<LevelInfo[]>(() => {
  const b = props.building
  const list: number[] = []
  for (let k = b.undergroundFloors; k >= 1; k--) list.push(-k)
  for (let f = 1; f <= b.floors; f++) list.push(f)

  return list.map((floor, index) => {
    const units = allUnits.value.filter((u) => u.floor === floor)
    const totalArea = units.reduce((s, u) => s + u.area, 0)
    const vacant = units.filter((u) => u.status === 'VACANT')
    const vacantArea = vacant.reduce((s, u) => s + u.area, 0)

    const mix: MixItem[] = CATEGORIES.map((c) => {
      const own = units.filter((u) => (CATEGORY_OF[u.status] ?? 'other') === c.key)
      return {
        key: c.key,
        label: c.label,
        color: c.color,
        count: own.length,
        area: own.reduce((s, u) => s + u.area, 0),
        share: 0,
      }
    }).filter((m) => m.count > 0)

    const mixTotal = mix.reduce((s, m) => s + m.area, 0)
    for (const m of mix) m.share = mixTotal ? m.area / mixTotal : 1 / mix.length

    const occupancy = totalArea ? Math.round(((totalArea - vacantArea) / totalArea) * 100) : 0

    let label = 'Reja kiritilmagan'
    if (units.length) {
      if (!vacant.length) label = 'To‘liq band'
      else if (vacant.length === units.length) label = 'Butunlay bo‘sh'
      else label = 'Qisman bo‘sh'
    }

    return {
      floor,
      index,
      name: `${floor}-qavat`,
      short: String(floor),
      underground: floor < 0,
      units,
      total: units.length,
      totalArea,
      vacantCount: vacant.length,
      vacantArea,
      occupancy,
      mix,
      label,
    }
  })
})

/** Ko‘pburchak yuzasi (0..1 birlik kvadratidagi ulush), Gauss formulasi */
function polygonShare(polygon: number[][]) {
  let sum = 0
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i]!
    const b = polygon[(i + 1) % polygon.length]!
    const ax = typeof a[0] === 'number' ? a[0] : 0
    const ay = typeof a[1] === 'number' ? a[1] : 0
    const bx = typeof b[0] === 'number' ? b[0] : 0
    const by = typeof b[1] === 'number' ? b[1] : 0
    sum += ax * by - bx * ay
  }
  return Math.abs(sum) / 2
}

/**
 * Tayanch konturi o‘lchami unit yozuvlaridan olinadi: reja ko‘pburchaklari
 * birlik kvadratining qancha ulushini egallasa, e’lon qilingan maydonlar
 * yig‘indisi o‘sha ulushga to‘g‘ri keladi. Shu sababli 3D ga tushirilgan
 * kontur haqiqiy m² bilan mos bo‘ladi. Unit yozuvi bo‘lmasa, GLA bo‘yicha.
 */
const dims = computed(() => {
  const b = props.building
  const h = FLOOR_HEIGHT[b.type] ?? 3.8
  const ratio = PLAN_RATIO[b.type] ?? 0.68

  let best = { count: 0, area: 0, share: 0 }
  const grouped = new Map<number, { count: number; area: number; share: number }>()
  for (const u of allUnits.value) {
    const row = grouped.get(u.floor) ?? { count: 0, area: 0, share: 0 }
    row.count += 1
    row.area += u.area
    row.share += polygonShare(u.polygon)
    grouped.set(u.floor, row)
  }
  for (const row of grouped.values()) {
    if (row.count > best.count || (row.count === best.count && row.share > best.share)) best = row
  }

  const stack = Math.max(b.floors + b.undergroundFloors, 1)
  const plate =
    best.share > 0.04 ? best.area / best.share : Math.max(b.gla / stack, 320)

  const w = Math.sqrt(plate / ratio)
  return { h, slab: h * 0.8, w, d: w * ratio }
})

const selectedIndex = computed(() => levels.value.findIndex((l) => l.floor === props.floor))
const selectedLevel = computed(() => levels.value[selectedIndex.value])
const hoveredLevel = computed(() => levels.value.find((l) => l.floor === hovered.value))

/* ==========================================================================
   Interyer: devor, eshik, yo‘lak, yadro, jihoz va xodimlar.
   Butun tartib metrda, plita mahalliy koordinatasida quriladi va faqat
   tanlangan qavat uchun hisoblanadi. Tayyor tartib `interiorPlan` da
   saqlanadi: kamera burilganda u qayta hisoblanmaydi, faqat proyeksiya
   bosqichi ishlaydi.
   ========================================================================== */

const DOOR_W = 0.9
const DOOR_H = 2.1
const PERSON_H = 1.7

const IT = {
  wallExt: '#B9C6D9',
  wallInt: '#D6DFEC',
  leaf: '#8FA6C9',
  core: '#A9B7CB',
  step: '#C4CFDE',
  desk: '#C6A886',
  chair: '#5C6C86',
  sofa: '#7C92B3',
  bed: '#B6C4D9',
  block: '#AEBCCE',
  rack: '#98A7BC',
  pot: '#AE855F',
  crown: '#3FA98B',
  head: '#DCB694',
}

const PERSON_TONES = ['#3C4A61', '#4A5A75', '#334158', '#5A6A85']

/** Barqaror psevdo-tasodif: har qayta chizishda bir xil natija beradi */
function hash01(seed: string, salt: number) {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  h ^= salt + 0x9e37
  h = Math.imul(h, 16777619)
  return ((h >>> 0) % 100000) / 100000
}

function inPolygon(x: number, y: number, poly: Array<[number, number]>) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!
    const b = poly[j]!
    if (a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) {
      inside = !inside
    }
  }
  return inside
}

interface PlanQuad {
  ax: number
  ay: number
  bx: number
  by: number
  z0: number
  z1: number
  tone: string
  op: number
  sw: number
}

interface PlanBox {
  x0: number
  y0: number
  x1: number
  y1: number
  z0: number
  z1: number
  tone: string
}

interface PlanDot {
  x: number
  y: number
  z: number
  r: number
  tone: string
}

interface InteriorPlan {
  level: 0 | 1 | 2
  quads: PlanQuad[]
  boxes: PlanBox[]
  dots: PlanDot[]
  parts: number
}

const EMPTY_PLAN: InteriorPlan = { level: 0, quads: [], boxes: [], dots: [], parts: 0 }

/** lg dan pastda jihoz va xodimlar chizilmaydi, faqat devor va eshiklar */
const isWide = useMediaQuery('(min-width: 1024px)')

const interiorLevel = computed<0 | 1 | 2>(() => {
  if (selectedIndex.value < 0) return 0
  if (props.mode === 'furnished') return 2
  if (props.mode === 'interior') return 1
  if (props.mode === 'occupancy' && explode.value > 0.02) return 1
  return 0
})

/** Devorlarni umumiy qirralarni takrorlamasdan quradi */
function buildWalls(
  rooms: Array<{ poly: Array<[number, number]>; cx: number; cy: number }>,
  geo: { w: number; d: number },
  wallH: number,
  plateCx: number,
  plateCy: number,
  withDoors: boolean,
) {
  const quads: PlanQuad[] = []
  const seen = new Set<string>()
  const hw = geo.w / 2
  const hd = geo.d / 2
  const margin = Math.min(geo.w, geo.d) * 0.13
  const r1d = (v: number) => Math.round(v * 10) / 10

  for (const room of rooms) {
    const poly = room.poly
    // Yo‘lakka qaragan qirra, qavat markaziga eng yaqini
    let doorEdge = 0
    let bestDist = Infinity
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i]!
      const b = poly[(i + 1) % poly.length]!
      const dist = Math.hypot((a[0] + b[0]) / 2 - plateCx, (a[1] + b[1]) / 2 - plateCy)
      if (dist < bestDist) {
        bestDist = dist
        doorEdge = i
      }
    }

    for (let i = 0; i < poly.length; i++) {
      const a = poly[i]!
      const b = poly[(i + 1) % poly.length]!
      const k = [`${r1d(a[0])}:${r1d(a[1])}`, `${r1d(b[0])}:${r1d(b[1])}`].sort().join('|')
      if (seen.has(k)) continue
      seen.add(k)

      const mx = (a[0] + b[0]) / 2
      const my = (a[1] + b[1]) / 2
      // Tashqi devor qalinroq va to‘yingan, ichki to‘siq ingichka va shaffofroq
      const ext = hw - Math.abs(mx) < margin || hd - Math.abs(my) < margin
      const tone = ext ? IT.wallExt : IT.wallInt
      const op = ext ? 0.95 : 0.6
      const sw = ext ? 1.4 : 0.7
      const len = Math.hypot(b[0] - a[0], b[1] - a[1])

      if (!withDoors || i !== doorEdge || len < DOOR_W * 2.4) {
        quads.push({ ax: a[0], ay: a[1], bx: b[0], by: b[1], z0: 0, z1: wallH, tone, op, sw })
        continue
      }

      const t0 = 0.5 - DOOR_W / (2 * len)
      const t1 = 0.5 + DOOR_W / (2 * len)
      const px0 = a[0] + (b[0] - a[0]) * t0
      const py0 = a[1] + (b[1] - a[1]) * t0
      const px1 = a[0] + (b[0] - a[0]) * t1
      const py1 = a[1] + (b[1] - a[1]) * t1
      quads.push({ ax: a[0], ay: a[1], bx: px0, by: py0, z0: 0, z1: wallH, tone, op, sw })
      quads.push({ ax: px1, ay: py1, bx: b[0], by: b[1], z0: 0, z1: wallH, tone, op, sw })
      // eshik tepasidagi to‘sin
      quads.push({ ax: px0, ay: py0, bx: px1, by: py1, z0: DOOR_H, z1: wallH, tone, op, sw })

      // eshik qanoti 30° ochiq holatda
      const ex = (b[0] - a[0]) / len
      const ey = (b[1] - a[1]) / len
      let nx = room.cx - mx
      let ny = room.cy - my
      const proj = nx * ex + ny * ey
      nx -= proj * ex
      ny -= proj * ey
      const nl = Math.hypot(nx, ny) || 1
      nx /= nl
      ny /= nl
      const ca = Math.cos(Math.PI / 6)
      const sa = Math.sin(Math.PI / 6)
      quads.push({
        ax: px0,
        ay: py0,
        bx: px0 + DOOR_W * (ca * ex + sa * nx),
        by: py0 + DOOR_W * (ca * ey + sa * ny),
        z0: 0,
        z1: DOOR_H,
        tone: IT.leaf,
        op: 0.9,
        sw: 0.7,
      })
    }
  }
  return quads
}

const interiorPlan = computed<InteriorPlan>(() => {
  const want = interiorLevel.value
  if (!want) return EMPTY_PLAN

  const info = levels.value[selectedIndex.value]
  if (!info || !info.units.length) return EMPTY_PLAN

  const geo = dims.value
  const hw = geo.w / 2
  const hd = geo.d / 2
  const wallH = Math.min(2.6, geo.h * 0.72)

  const rooms = info.units.map((u) => {
    const poly = u.polygon.map((p) => {
      const nx = typeof p[0] === 'number' ? p[0] : 0
      const ny = typeof p[1] === 'number' ? p[1] : 0
      return [(nx - 0.5) * geo.w, (0.5 - ny) * geo.d] as [number, number]
    })
    let cx = 0
    let cy = 0
    for (const p of poly) {
      cx += p[0]
      cy += p[1]
    }
    const n = Math.max(poly.length, 1)
    return { unit: u, poly, cx: cx / n, cy: cy / n }
  })

  const plateCx = rooms.reduce((s, r) => s + r.cx, 0) / rooms.length
  const plateCy = rooms.reduce((s, r) => s + r.cy, 0) / rooms.length

  const quads = buildWalls(rooms, geo, wallH, plateCx, plateCy, true)
  const boxes: PlanBox[] = []
  const dots: PlanDot[] = []

  const pushBox = (
    cx: number,
    cy: number,
    w: number,
    d: number,
    z0: number,
    z1: number,
    tone: string,
  ) => boxes.push({ x0: cx - w / 2, y0: cy - d / 2, x1: cx + w / 2, y1: cy + d / 2, z0, z1, tone })

  // --- lift va zina yadrosi: unitlar egallamagan markaziy hududda
  let kx = 0
  let ky = 0
  let kn = 0
  const grid = 18
  for (let i = 0; i < grid; i++) {
    for (let j = 0; j < grid; j++) {
      const x = -hw * 0.72 + ((i + 0.5) * (2 * hw * 0.72)) / grid
      const y = -hd * 0.72 + ((j + 0.5) * (2 * hd * 0.72)) / grid
      if (rooms.some((r) => inPolygon(x, y, r.poly))) continue
      kx += x
      ky += y
      kn++
    }
  }
  const hasCore = kn > 6
  if (hasCore) {
    kx /= kn
    ky /= kn
    pushBox(kx - 1.35, ky, 2.3, 2.5, 0, wallH, IT.core)
    pushBox(kx + 1.35, ky, 2.3, 2.5, 0, wallH, IT.core)
    for (let st = 0; st < 8; st++) {
      pushBox(kx, ky - 2.5 - st * 0.32, 1.5, 0.3, 0, 0.22 + st * 0.2, IT.step)
    }
  }

  if (want < 2 || !isWide.value) {
    return { level: 1, quads, boxes, dots, parts: quads.length + boxes.length * 3 }
  }

  // --- jihozlar: unit turi va maydoniga qarab
  let peopleLeft = 40
  for (const room of rooms) {
    const u = room.unit
    const inside = (x: number, y: number) => inPolygon(x, y, room.poly)
    let x0 = Infinity
    let y0 = Infinity
    let x1 = -Infinity
    let y1 = -Infinity
    for (const p of room.poly) {
      if (p[0] < x0) x0 = p[0]
      if (p[0] > x1) x1 = p[0]
      if (p[1] < y0) y0 = p[1]
      if (p[1] > y1) y1 = p[1]
    }
    x0 += 0.6
    y0 += 0.6
    x1 -= 0.6
    y1 -= 0.6
    const rw = Math.max(x1 - x0, 0.9)
    const rd = Math.max(y1 - y0, 0.9)
    const live = u.status === 'RENTED' || u.status === 'SOLD'
    const seats: Array<[number, number]> = []

    if (u.usage === 'Ofis') {
      const ws = Math.max(1, Math.min(6, Math.round(u.area / 14)))
      const share = u.area > 60 ? 0.62 : 1
      const bandD = rd * share
      const cols = Math.max(1, Math.min(ws, Math.round(Math.sqrt((ws * rw) / Math.max(bandD, 0.6)))))
      const rowsN = Math.ceil(ws / cols)
      for (let i = 0; i < ws; i++) {
        const x = x0 + (((i % cols) + 0.5) * rw) / cols
        const y = y0 + ((Math.floor(i / cols) + 0.5) * bandD) / rowsN
        if (!inside(x, y)) continue
        pushBox(x, y, 1.4, 0.7, 0.62, 0.75, IT.desk)
        pushBox(x, y + 0.62, 0.48, 0.48, 0.28, 0.44, IT.chair)
        quads.push({
          ax: x - 0.24,
          ay: y + 0.85,
          bx: x + 0.24,
          by: y + 0.85,
          z0: 0.44,
          z1: 0.86,
          tone: IT.chair,
          op: 0.92,
          sw: 0.6,
        })
        seats.push([x, y + 0.95])
      }
      if (u.area > 60) {
        const mx = x0 + rw / 2
        const my = y0 + bandD + (rd - bandD) / 2
        if (inside(mx, my)) {
          pushBox(mx, my, 2.4, 1.1, 0.64, 0.76, IT.desk)
          for (let i = 0; i < 4; i++) {
            pushBox(mx - 0.75 + (i % 2) * 1.5, my + (i < 2 ? -0.95 : 0.95), 0.46, 0.46, 0.28, 0.44, IT.chair)
          }
        }
      }
      const sx = x0 + rw * 0.5
      const sy = y1 - 0.5
      if (inside(sx, sy)) {
        pushBox(sx, sy, 1.8, 0.8, 0.16, 0.44, IT.sofa)
        quads.push({
          ax: sx - 0.9,
          ay: sy + 0.4,
          bx: sx + 0.9,
          by: sy + 0.4,
          z0: 0.44,
          z1: 0.82,
          tone: IT.sofa,
          op: 0.9,
          sw: 0.6,
        })
        if (inside(sx + 1.5, sy)) {
          pushBox(sx + 1.5, sy, 0.42, 0.42, 0, 0.5, IT.pot)
          dots.push({ x: sx + 1.5, y: sy, z: 0.76, r: 0.4, tone: IT.crown })
        }
      }
    } else if (u.usage === 'Savdo') {
      const n = Math.max(2, Math.min(6, Math.round(rw / 2.4)))
      for (let i = 0; i < n; i++) {
        const x = x0 + ((i + 0.5) * rw) / n
        for (const y of [y0 + 0.5, y1 - 0.5]) {
          if (inside(x, y)) pushBox(x, y, 1.1, 0.6, 0, 1.9, IT.rack)
        }
      }
      const ccx = x0 + rw * 0.5
      const ccy = y0 + rd * 0.5
      if (inside(ccx, ccy)) {
        pushBox(ccx, ccy, 2.2, 0.7, 0, 1.05, IT.desk)
        seats.push([ccx, ccy + 0.85])
      }
    } else if (u.usage === 'Ombor') {
      const n = Math.max(2, Math.min(7, Math.round(rw / 3.4)))
      for (const y of [y0 + rd * 0.22, y1 - rd * 0.22]) {
        for (let i = 0; i < n; i++) {
          const x = x0 + ((i + 0.5) * rw) / n
          if (inside(x, y)) pushBox(x, y, 2.4, 1.1, 0, 2.3, IT.rack)
        }
      }
      seats.push([x0 + rw * 0.5, y0 + rd * 0.5])
    } else if (u.usage === 'Turar joy') {
      const bx = x0 + rw * 0.26
      const by = y0 + rd * 0.28
      if (inside(bx, by)) pushBox(bx, by, 1.6, 2.05, 0.1, 0.55, IT.bed)
      const sx2 = x0 + rw * 0.7
      const sy2 = y1 - rd * 0.3
      if (inside(sx2, sy2)) {
        pushBox(sx2, sy2, 1.8, 0.85, 0.16, 0.44, IT.sofa)
        quads.push({
          ax: sx2 - 0.9,
          ay: sy2 + 0.42,
          bx: sx2 + 0.9,
          by: sy2 + 0.42,
          z0: 0.44,
          z1: 0.82,
          tone: IT.sofa,
          op: 0.9,
          sw: 0.6,
        })
        if (inside(sx2, sy2 - 1.3)) pushBox(sx2, sy2 - 1.3, 1.1, 0.7, 0.3, 0.44, IT.desk)
        seats.push([sx2, sy2 - 0.9])
      }
      const kbx = x1 - 0.5
      const kby = y0 + rd * 0.5
      if (inside(kbx, kby)) pushBox(kbx, kby, 0.65, 2.2, 0, 0.9, IT.block)
    } else {
      const tx = x0 + rw * 0.5
      const ty = y0 + rd * 0.5
      if (inside(tx, ty)) pushBox(tx, ty, 1.6, 1, 0, 1.4, IT.block)
    }

    // --- xodimlar: faqat band unitlarda, ish o‘rni soniga mutanosib
    if (!live || !seats.length) continue
    const wantPeople = Math.max(1, Math.min(3, Math.round(seats.length * 0.5)))
    for (let i = 0; i < wantPeople && peopleLeft > 0; i++) {
      const seat = seats[Math.floor(hash01(u.id, i) * seats.length)] ?? seats[0]!
      const x = seat[0] + (hash01(u.id, i + 41) - 0.5) * 0.5
      const y = seat[1] + (hash01(u.id, i + 83) - 0.5) * 0.5
      if (!inside(x, y)) continue
      const tone = PERSON_TONES[Math.floor(hash01(u.id, i + 127) * PERSON_TONES.length)] ?? PERSON_TONES[0]!
      pushBox(x, y, 0.34, 0.24, 0, 0.86, tone)
      pushBox(x, y, 0.42, 0.28, 0.86, PERSON_H - 0.22, tone)
      dots.push({ x, y, z: PERSON_H - 0.1, r: 0.14, tone: IT.head })
      peopleLeft--
    }
  }

  // --- yo‘lakdagi bir necha kishi
  if (hasCore) {
    for (let i = 0; i < 3 && peopleLeft > 0; i++) {
      const x = kx + (hash01(info.name, i) - 0.5) * 7
      const y = ky + (hash01(info.name, i + 31) - 0.5) * 5
      if (rooms.some((r) => inPolygon(x, y, r.poly))) continue
      const tone = PERSON_TONES[i % PERSON_TONES.length]!
      pushBox(x, y, 0.34, 0.24, 0, 0.86, tone)
      pushBox(x, y, 0.42, 0.28, 0.86, PERSON_H - 0.22, tone)
      dots.push({ x, y, z: PERSON_H - 0.1, r: 0.14, tone: IT.head })
      peopleLeft--
    }
  }

  const parts = quads.length + boxes.length * 3 + dots.length
  // Element soni chegaradan oshsa, jihoz va odamlarsiz sodda ko‘rinish
  if (parts > 1200) {
    return {
      level: 1,
      quads: buildWalls(rooms, geo, wallH, plateCx, plateCy, true),
      boxes: [],
      dots: [],
      parts: 0,
    }
  }
  return { level: 2, quads, boxes, dots, parts }
})

const scene = computed(() => {
  const geo = dims.value
  const lv = levels.value
  const ug = props.building.undergroundFloors
  const mode = props.mode
  const plan = interiorPlan.value

  const th = (rotation.value * Math.PI) / 180
  const ph = (tilt.value * Math.PI) / 180
  const ct = Math.cos(th)
  const st = Math.sin(th)
  const sp = Math.sin(ph)
  const cp = Math.cos(ph)

  const sel = selectedIndex.value
  const step = explode.value * geo.h * 2.6
  // Jihozlangan rejimda tanlangan qavat ustida xona balandligidan kengroq
  // ochilish qoldiriladi: interyer to‘liq ko‘rinadi
  const wallH = Math.min(2.6, geo.h * 0.72)
  const openLift =
    sel >= 0 ? (mode === 'furnished' ? Math.max(geo.h * 0.95, wallH * 2.1) : geo.h * 0.95) : 0
  const hoverLift = (geo.h - geo.slab) * 0.85

  const zBase = (i: number) => {
    const k = i - ug
    let z = k * geo.h + step * k
    if (sel >= 0 && i > sel) z += openLift
    return z
  }

  const zLow = zBase(0)
  const zHigh = zBase(lv.length - 1) + geo.slab
  const spanH = Math.hypot(geo.w, geo.d)
  const spanV = Math.max(spanH * sp + (zHigh - zLow) * cp, 1)
  const s = Math.min((VW * 0.88) / spanH, (VH * 0.86) / spanV) * zoom.value
  const cx = VW / 2
  const cy = VH / 2 + ((zLow + zHigh) / 2) * cp * s

  const px = (x: number, y: number) => r1(cx + (x * ct - y * st) * s)
  const py = (x: number, y: number, z: number) => r1(cy - ((x * st + y * ct) * sp + z * cp) * s)
  const pt = (x: number, y: number, z: number) => `${px(x, y)},${py(x, y, z)}`

  const hw = geo.w / 2
  const hd = geo.d / 2
  const corners: Array<[number, number]> = [
    [-hw, -hd],
    [hw, -hd],
    [hw, hd],
    [-hw, hd],
  ]
  const normals: Array<[number, number]> = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ]

  // Yuz ko‘rinadimi: aylantirilgan normalning kameraga qaragan tashkil
  // etuvchisi manfiy bo‘lsa, yuz bizga qaragan.
  const faceState = normals.map(([nx, ny]) => {
    const nu = nx * ct - ny * st
    const nv = nx * st + ny * ct
    return { visible: nv < -0.0001, amount: clamp(-0.17 - nu * 0.19, -0.42, 0.05) }
  })

  const quad = (
    a: [number, number],
    b: [number, number],
    z0: number,
    z1: number,
    t0: number,
    t1: number,
  ) => {
    const ax = a[0] + (b[0] - a[0]) * t0
    const ay = a[1] + (b[1] - a[1]) * t0
    const bx = a[0] + (b[0] - a[0]) * t1
    const by = a[1] + (b[1] - a[1]) * t1
    return `${pt(ax, ay, z1)} ${pt(bx, by, z1)} ${pt(bx, by, z0)} ${pt(ax, ay, z0)}`
  }

  const slabs: SlabView[] = lv.map((info, i) => {
    const lifted = info.floor === hovered.value ? hoverLift : 0
    const z0 = zBase(i) + lifted
    const z1 = z0 + geo.slab
    const isSel = i === sel
    const dominant = info.mix.length
      ? info.mix.reduce((best, m) => (m.area > best.area ? m : best), info.mix[0]!)
      : null

    let base = EMPTY_COLOR
    if (mode === 'occupancy') base = dominant ? dominant.color : EMPTY_COLOR
    else if (mode === 'levels') base = isSel ? '#0256F7' : '#AEBED4'
    else base = isSel ? '#7FA8F6' : '#C3D2E6'

    const parts: FacePart[] = []
    if (mode !== 'wire') {
      for (let f = 0; f < 4; f++) {
        const state = faceState[f]!
        if (!state.visible) continue
        const a = corners[f]!
        const b = corners[(f + 1) % 4]!
        if (mode === 'occupancy' && info.mix.length) {
          let t = 0
          for (const m of info.mix) {
            const next = Math.min(t + m.share, 1)
            parts.push({ points: quad(a, b, z0, z1, t, next), fill: shade(m.color, state.amount) })
            t = next
          }
        } else {
          parts.push({ points: quad(a, b, z0, z1, 0, 1), fill: shade(base, state.amount) })
        }
      }
    }

    const showInterior = isSel && plan.level > 0
    const topRing = corners.map((c) => pt(c[0], c[1], z1)).join(' ')
    // Unit konturlari egallamagan yuza, yo‘lak va yadro hududi
    const topFill = showInterior
      ? CORRIDOR
      : mode === 'interior' || mode === 'furnished'
        ? isSel
          ? '#EAF1FE'
          : '#F2F6FC'
        : shade(base, isSel ? 0.28 : 0.36)

    const edges: Array<{ d: string; hidden: boolean }> = []
    if (mode === 'wire') {
      for (let k = 0; k < 4; k++) {
        const c = corners[k]!
        const n = corners[(k + 1) % 4]!
        edges.push({
          d: `M${pt(c[0], c[1], z1).replace(',', ' ')} L${pt(n[0], n[1], z1).replace(',', ' ')}`,
          hidden: false,
        })
        edges.push({
          d: `M${pt(c[0], c[1], z0).replace(',', ' ')} L${pt(n[0], n[1], z0).replace(',', ' ')}`,
          hidden: !faceState[k]!.visible,
        })
        edges.push({
          d: `M${pt(c[0], c[1], z0).replace(',', ' ')} L${pt(c[0], c[1], z1).replace(',', ' ')}`,
          hidden: !faceState[k]!.visible && !faceState[(k + 3) % 4]!.visible,
        })
      }
    }

    const wantUnits = mode === 'interior' || mode === 'wire' ? true : isSel
    const units: UnitShape[] = []
    if (wantUnits && info.units.length) {
      const zu = z1 + geo.slab * 0.06
      for (const u of info.units) {
        let sx = 0
        let sy = 0
        const pts = u.polygon
          .map((p) => {
            const nx = typeof p[0] === 'number' ? p[0] : 0
            const ny = typeof p[1] === 'number' ? p[1] : 0
            const wx = (nx - 0.5) * geo.w
            const wy = (0.5 - ny) * geo.d
            sx += px(wx, wy)
            sy += py(wx, wy, zu)
            return pt(wx, wy, zu)
          })
          .join(' ')
        const n = Math.max(u.polygon.length, 1)
        units.push({
          id: u.id,
          code: u.code,
          points: pts,
              fill:
            CATEGORIES.find((c) => c.key === (CATEGORY_OF[u.status] ?? 'other'))?.color ??
            EMPTY_COLOR,
          cx: r1(sx / n),
          cy: r1(sy / n),
          active: u.id === props.unit,
        })
      }
    }

    // --- interyerni proyeksiya qilamiz: tartib metrda tayyor turadi, bu
    //     bosqichda faqat nuqtalar ekranga tushiriladi va chuqurlik bo‘yicha
    //     saralanadi. Bir xil bo‘yoqli ketma-ket qismlar bitta yo‘lga
    //     birlashtiriladi: kamera burilganda yangilanadigan tugun kam bo‘ladi.
    let interior: InteriorItem[] | null = null
    if (showInterior) {
      const zf = z1 + geo.slab * 0.06
      const raw: Array<InteriorItem & { near: number }> = []
      const vOf = (x: number, y: number) => x * st + y * ct
      const face = (
        ax: number,
        ay: number,
        bx: number,
        by: number,
        q0: number,
        q1: number,
      ) =>
        `M${px(ax, ay)} ${py(ax, ay, q1)}L${px(bx, by)} ${py(bx, by, q1)}L${px(bx, by)} ${py(bx, by, q0)}L${px(ax, ay)} ${py(ax, ay, q0)}Z`

      for (const q of plan.quads) {
        const q0 = zf + q.z0
        const q1 = zf + q.z1
        raw.push({
          k: 'p',
          d: face(q.ax, q.ay, q.bx, q.by, q0, q1),
          f: q.tone,
          o: q.op,
          w: q.sw,
          near: ((q0 + q1) / 2) * sp - vOf((q.ax + q.bx) / 2, (q.ay + q.by) / 2) * cp,
        })
      }

      for (const bx of plan.boxes) {
        const q0 = zf + bx.z0
        const q1 = zf + bx.z1
        const c: Array<[number, number]> = [
          [bx.x0, bx.y0],
          [bx.x1, bx.y0],
          [bx.x1, bx.y1],
          [bx.x0, bx.y1],
        ]
        const near = q1 * sp - vOf((bx.x0 + bx.x1) / 2, (bx.y0 + bx.y1) / 2) * cp
        for (let f = 0; f < 4; f++) {
          const fs = faceState[f]!
          if (!fs.visible) continue
          const a = c[f]!
          const n2 = c[(f + 1) % 4]!
          raw.push({
            k: 'p',
            d: face(a[0], a[1], n2[0], n2[1], q0, q1),
            f: shade(bx.tone, fs.amount),
            o: 1,
            w: 0,
            near: near - 0.01,
          })
        }
        raw.push({
          k: 'p',
          d: `M${pt(c[0]![0], c[0]![1], q1).replace(',', ' ')}L${pt(c[1]![0], c[1]![1], q1).replace(',', ' ')}L${pt(c[2]![0], c[2]![1], q1).replace(',', ' ')}L${pt(c[3]![0], c[3]![1], q1).replace(',', ' ')}Z`,
          f: shade(bx.tone, 0.16),
          o: 1,
          w: 0,
          near,
        })
      }

      for (const dot of plan.dots) {
        const dz = zf + dot.z
        raw.push({
          k: 'c',
          x: px(dot.x, dot.y),
          y: py(dot.x, dot.y, dz),
          r: r1(dot.r * s),
          f: dot.tone,
          near: dz * sp - vOf(dot.x, dot.y) * cp,
        })
      }

      raw.sort((a, b) => a.near - b.near)
      const merged: InteriorItem[] = []
      for (const it of raw) {
        const last = merged[merged.length - 1]
        if (it.k === 'p' && last && last.k === 'p' && last.f === it.f && last.o === it.o && last.w === it.w) {
          last.d = (last.d ?? '') + it.d
          continue
        }
        merged.push(
          it.k === 'p'
            ? { k: 'p', d: it.d, f: it.f, o: it.o, w: it.w }
            : { k: 'c', x: it.x, y: it.y, r: it.r, f: it.f },
        )
      }
      interior = merged
    }

    let anchorX = -Infinity
    let anchorY = 0
    for (const c of corners) {
      const cxp = px(c[0], c[1])
      if (cxp > anchorX) {
        anchorX = cxp
        anchorY = py(c[0], c[1], z1)
      }
    }

    return {
      floor: info.floor,
      name: info.name,
      short: info.short,
      underground: info.underground,
      selected: isSel,
      // Jihozlangan rejimda tepadagi qavatlar shaffof, kesim hosil bo‘ladi
      dim: isSel ? 1 : mode === 'furnished' && sel >= 0 && i > sel ? 0.16 : sel >= 0 ? 0.68 : 1,
      parts,
      topPoints: topRing,
      topFill,
      edges,
      units,
      interior,
      anchorX,
      anchorY,
      showLabel: mode === 'levels' || isSel || info.floor === hovered.value,
      aria: `${info.name}, ${info.total} unit, bandlik ${info.occupancy} foiz, ${info.label}`,
    }
  })

  // Yer sathi: kontur atrofidagi to‘r va yumshoq soya
  const gw = geo.w * 1.45
  const gd = geo.d * 1.45
  const grid: string[] = []
  const divisions = 6
  for (let i = 0; i <= divisions; i++) {
    const x = -gw + (i * 2 * gw) / divisions
    grid.push(`M${px(x, -gd)} ${py(x, -gd, 0)} L${px(x, gd)} ${py(x, gd, 0)}`)
    const y = -gd + (i * 2 * gd) / divisions
    grid.push(`M${px(-gw, y)} ${py(-gw, y, 0)} L${px(gw, y)} ${py(gw, y, 0)}`)
  }

  const plane = [
    pt(-gw, -gd, 0),
    pt(gw, -gd, 0),
    pt(gw, gd, 0),
    pt(-gw, gd, 0),
  ].join(' ')

  const shadow = corners.map((c) => pt(c[0] * 1.06, c[1] * 1.06, 0)).join(' ')

  const groundMark = {
    x: clamp(px(-gw, gd), 14, VW - 90),
    y: clamp(py(-gw, gd, 0), 20, VH - 14),
  }

  return { slabs, grid, plane, shadow, groundMark, scale: s }
})

const tooltip = computed(() => {
  const info = hoveredLevel.value
  if (!info) return null
  const slab = scene.value.slabs.find((s) => s.floor === info.floor)
  if (!slab) return null
  const w = 178
  const x = clamp(slab.anchorX + 14, 8, VW - w - 8)
  const y = clamp(slab.anchorY - 62, 8, VH - 82)
  return {
    x,
    y,
    w,
    name: info.name,
    units: info.total ? `${info.total} unit · ${info.vacantCount} bo‘sh` : 'Reja kiritilmagan',
    occupancy: info.total ? `Bandlik ${info.occupancy}%` : info.label,
  }
})

/** Sichqoncha ostidagi xona: kod, maydon va holat */
const roomTip = computed(() => {
  if (!hoveredUnit.value) return null
  const info = levels.value[selectedIndex.value]
  const u = info?.units.find((x) => x.id === hoveredUnit.value)
  if (!u) return null
  const shape = scene.value.slabs.find((sl) => sl.selected)?.units.find((x) => x.id === u.id)
  if (!shape) return null
  const cat = CATEGORIES.find((c) => c.key === (CATEGORY_OF[u.status] ?? 'other'))
  const w = 176
  return {
    x: clamp(shape.cx + 12, 8, VW - w - 8),
    y: clamp(shape.cy - 80, 8, VH - 86),
    w,
    code: `Unit ${u.code}`,
    area: areaLabel(u.area),
    status: cat?.label ?? '',
    color: cat?.color ?? EMPTY_COLOR,
  }
})

const legend = computed(() => {
  const totals = new Map<string, number>()
  for (const u of allUnits.value) {
    const key = CATEGORY_OF[u.status] ?? 'other'
    totals.set(key, (totals.get(key) ?? 0) + 1)
  }
  return CATEGORIES.map((c) => ({ ...c, count: totals.get(c.key) ?? 0 }))
})

const modeHint = computed(() => MODES.find((m) => m.value === props.mode)?.hint ?? '')

/** Mobil rels: yuqori qavat tepada turadi */
const railLevels = computed(() => [...levels.value].reverse())
const railRef = ref<HTMLElement | null>(null)

// Tanlangan qavat rels ichida ko‘rinib turishi kerak
watch(
  () => props.floor,
  async () => {
    await nextTick()
    railRef.value?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({
      block: 'nearest',
    })
  },
  { immediate: true },
)

watch(
  () => props.mode,
  (value) => {
    if (value === 'interior' && explode.value < 0.4) explode.value = 0.4
  },
)

watch([() => props.floor, () => props.mode], () => {
  hoveredUnit.value = ''
})

function pickFloor(floor: number) {
  if (blockClick) return
  emit('update:floor', floor)
}

function pickUnit(floor: number, id: string) {
  if (blockClick) return
  emit('update:floor', floor)
  emit('update:unit', id)
}

function onDown(event: PointerEvent) {
  if (event.pointerType === 'mouse' && event.button !== 0) return
  const target = event.currentTarget as SVGSVGElement
  dragging.value = true
  blockClick = false
  dragDist = 0
  dragX = event.clientX
  dragY = event.clientY
  dragRot = rotation.value
  dragTilt = tilt.value
  target.setPointerCapture(event.pointerId)
}

function onMove(event: PointerEvent) {
  if (!dragging.value) return
  const dx = event.clientX - dragX
  const dy = event.clientY - dragY
  dragDist = Math.max(dragDist, Math.abs(dx) + Math.abs(dy))
  if (dragDist > 4) blockClick = true
  rotation.value = Math.round(wrap360(dragRot + dx * 0.42))
  tilt.value = Math.round(clamp(dragTilt - dy * 0.24, 6, 82))
}

function onUp(event: PointerEvent) {
  if (!dragging.value) return
  dragging.value = false
  const target = event.currentTarget as SVGSVGElement
  if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId)
}

function spin(delta: number) {
  rotation.value = wrap360(rotation.value + delta)
}

function zoomBy(delta: number) {
  zoom.value = Math.round(clamp(zoom.value + delta, 0.6, 2.2) * 100) / 100
}

function resetView() {
  rotation.value = 32
  tilt.value = 34
  zoom.value = 1
  explode.value = props.mode === 'interior' ? 0.4 : 0
}
</script>

<template>
  <div class="min-w-0">
    <div
      class="relative overflow-hidden rounded-panel bg-gradient-to-b from-white via-brand-50/45 to-ink-100/70 ring-1 ring-inset ring-ink-200/70"
    >
      <div class="relative">
      <svg
        :viewBox="`0 0 ${VW} ${VH}`"
        preserveAspectRatio="xMidYMid meet"
        class="w-full touch-pan-y select-none"
        :class="[heightClass, dragging ? 'cursor-grabbing' : 'cursor-grab']"
        role="group"
        :aria-label="`${building.name} aksonometrik ko‘rinishi. Burilish ${rotation} daraja, nishab ${tilt} daraja.`"
        @pointerdown="onDown"
        @pointermove="onMove"
        @pointerup="onUp"
        @pointercancel="onUp"
        @pointerleave="(hovered = null), (hoveredUnit = '')"
      >
        <defs>
          <filter :id="`mkn-shadow-${building.id}`" x="-40%" y="-60%" width="180%" height="220%">
            <feGaussianBlur stdDeviation="9" />
          </filter>
        </defs>

        <!-- Yer sathi: to‘r va yumshoq soya chuqurlikni o‘qishga yordam beradi -->
        <polygon :points="scene.plane" fill="#0256F7" fill-opacity="0.035" />
        <path
          v-for="(g, gi) in scene.grid"
          :key="`g${gi}`"
          :d="g"
          stroke="#94A2B8"
          stroke-opacity="0.28"
          stroke-width="0.8"
          fill="none"
        />
        <polygon
          :points="scene.shadow"
          fill="#131C2B"
          fill-opacity="0.16"
          :filter="`url(#mkn-shadow-${building.id})`"
        />

        <template v-if="building.undergroundFloors">
          <text
            :x="scene.groundMark.x"
            :y="scene.groundMark.y + 16"
            font-size="12"
            font-weight="600"
            fill="#64748B"
          >
            Yer sathi
          </text>
        </template>

        <!-- Plitalar pastdan yuqoriga chiziladi: kamera doim tepadan qaraydi -->
        <g
          v-for="slab in scene.slabs"
          :key="slab.floor"
          role="button"
          tabindex="0"
          :aria-label="slab.aria"
          :aria-pressed="slab.selected"
          class="cursor-pointer outline-none"
          :opacity="slab.dim"
          @pointerenter="hovered = slab.floor"
          @focus="(focused = slab.floor), (hovered = slab.floor)"
          @blur="(focused = null), (hovered = null)"
          @click="pickFloor(slab.floor)"
          @keydown.enter.prevent="emit('update:floor', slab.floor)"
          @keydown.space.prevent="emit('update:floor', slab.floor)"
        >
          <template v-if="mode === 'wire'">
            <path
              v-for="(e, ei) in slab.edges"
              :key="ei"
              :d="e.d"
              fill="none"
              :stroke="slab.selected ? '#0256F7' : '#48566B'"
              :stroke-width="slab.selected ? 1.6 : 1"
              :stroke-opacity="e.hidden ? 0.22 : 0.92"
              :stroke-dasharray="e.hidden ? '4 4' : undefined"
              stroke-linecap="round"
            />
          </template>

          <template v-else>
            <polygon
              v-for="(p, pi) in slab.parts"
              :key="pi"
              :points="p.points"
              :fill="p.fill"
              stroke="#FFFFFF"
              stroke-width="0.7"
              stroke-opacity="0.5"
            />
            <polygon
              :points="slab.topPoints"
              :fill="slab.topFill"
              :stroke="slab.selected ? '#0256F7' : '#94A2B8'"
              :stroke-width="slab.selected ? 2 : 0.9"
              :stroke-opacity="slab.selected ? 1 : 0.55"
              :stroke-dasharray="slab.underground ? '7 5' : undefined"
            />
          </template>

          <!-- Unit ko‘pburchaklari plita ustki yuzasiga tushiriladi -->
          <g
            v-for="u in slab.units"
            :key="u.id"
            @click.stop="pickUnit(slab.floor, u.id)"
            @pointerenter="slab.selected ? (hoveredUnit = u.id) : null"
            @pointerleave="hoveredUnit === u.id ? (hoveredUnit = '') : null"
          >
            <title>{{ u.code }}</title>
            <polygon
              :points="u.points"
              :fill="u.fill"
              :fill-opacity="
                mode === 'wire' ? 0.08 : u.active ? 0.92 : hoveredUnit === u.id ? 0.86 : 0.72
              "
              :stroke="u.active ? '#0139B0' : hoveredUnit === u.id ? '#0256F7' : '#FFFFFF'"
              :stroke-width="u.active ? 2.2 : hoveredUnit === u.id ? 1.8 : 0.9"
            />
            <text
              v-if="slab.selected && mode !== 'wire' && !slab.interior"
              :x="u.cx"
              :y="u.cy + 4"
              text-anchor="middle"
              font-size="11"
              font-weight="700"
              :fill="u.active ? '#FFFFFF' : '#131C2B'"
              class="pointer-events-none"
            >
              {{ u.code }}
            </text>
          </g>

          <!-- Devor, eshik, yadro, jihoz va xodimlar: chuqurlik bo‘yicha
               saralangan va bo‘yoq bo‘yicha birlashtirilgan qismlar.
               Bosishni ushlamaydi: xona tanlash unit konturi orqali ishlaydi. -->
          <g v-if="slab.interior" class="pointer-events-none">
            <template v-for="(it, ii) in slab.interior" :key="ii">
              <path
                v-if="it.k === 'p'"
                :d="it.d"
                :fill="it.f"
                :fill-opacity="it.o"
                :stroke="it.w ? '#FFFFFF' : 'none'"
                :stroke-width="it.w || undefined"
                stroke-linejoin="round"
              />
              <circle v-else :cx="it.x" :cy="it.y" :r="it.r" :fill="it.f" />
            </template>
          </g>

          <!-- Fokus halqasi: klaviatura bilan yurganda ko‘rinadi -->
          <polygon
            v-if="focused === slab.floor"
            :points="slab.topPoints"
            fill="none"
            stroke="#0256F7"
            stroke-width="3"
            stroke-dasharray="6 4"
          />

          <g v-if="slab.showLabel" class="pointer-events-none">
            <path
              :d="`M${slab.anchorX} ${slab.anchorY} L${slab.anchorX + 16} ${slab.anchorY - 4}`"
              stroke="#94A2B8"
              stroke-width="1"
              fill="none"
            />
            <rect
              :x="slab.anchorX + 16"
              :y="slab.anchorY - 16"
              :width="slab.selected ? 96 : 40"
              height="23"
              rx="11.5"
              :fill="slab.selected ? '#0256F7' : '#FFFFFF'"
              :stroke="slab.selected ? '#0256F7' : '#E2E8F2'"
              stroke-width="1"
            />
            <text
              :x="slab.anchorX + 26"
              :y="slab.anchorY"
              font-size="12"
              font-weight="700"
              :fill="slab.selected ? '#FFFFFF' : '#354152'"
            >
              {{ slab.selected ? slab.name : slab.short }}
            </text>
          </g>
        </g>

        <!-- Sichqoncha ostidagi qavat haqida qisqa ma’lumot -->
        <g v-if="tooltip && !roomTip" class="pointer-events-none">
          <rect
            :x="tooltip.x"
            :y="tooltip.y"
            :width="tooltip.w"
            height="70"
            rx="12"
            fill="#131C2B"
            fill-opacity="0.94"
          />
          <text :x="tooltip.x + 14" :y="tooltip.y + 24" font-size="13" font-weight="700" fill="#FFFFFF">
            {{ tooltip.name }}
          </text>
          <text :x="tooltip.x + 14" :y="tooltip.y + 43" font-size="12" fill="#CBD4E3">
            {{ tooltip.units }}
          </text>
          <text :x="tooltip.x + 14" :y="tooltip.y + 60" font-size="12" fill="#CBD4E3">
            {{ tooltip.occupancy }}
          </text>
        </g>

        <!-- Sichqoncha ostidagi xona: kod, maydon va holat -->
        <g v-if="roomTip" class="pointer-events-none">
          <rect
            :x="roomTip.x"
            :y="roomTip.y"
            :width="roomTip.w"
            height="72"
            rx="12"
            fill="#131C2B"
            fill-opacity="0.94"
          />
          <text
            :x="roomTip.x + 14"
            :y="roomTip.y + 25"
            font-size="13"
            font-weight="700"
            fill="#FFFFFF"
          >
            {{ roomTip.code }}
          </text>
          <text :x="roomTip.x + 14" :y="roomTip.y + 44" font-size="12" fill="#CBD4E3">
            {{ roomTip.area }}
          </text>
          <circle :cx="roomTip.x + 19" :cy="roomTip.y + 58" r="4.5" :fill="roomTip.color" />
          <text :x="roomTip.x + 30" :y="roomTip.y + 62" font-size="12" fill="#CBD4E3">
            {{ roomTip.status }}
          </text>
        </g>
      </svg>

      <!-- Mobil ko‘rinishda qavat tanlash relsi ko‘rinish ustida turadi -->
      <div
        ref="railRef"
        class="scroll-slim absolute left-2 top-1/2 flex max-h-[86%] w-11 -translate-y-1/2 flex-col gap-1 overflow-y-auto rounded-field bg-surface/92 p-1 shadow-card ring-1 ring-ink-200/70 backdrop-blur xl:hidden"
        role="group"
        aria-label="Qavat tanlash relsi"
      >
        <button
          v-for="l in railLevels"
          :key="l.floor"
          type="button"
          :data-active="l.floor === floor"
          class="tabular h-8 shrink-0 rounded-[7px] text-[11.5px] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500"
          :class="
            l.floor === floor
              ? 'bg-brand-500 text-white'
              : l.total
                ? 'text-ink-700 hover:bg-brand-50'
                : 'text-ink-400 hover:bg-ink-100'
          "
          :aria-label="`${l.name}, ${l.total} unit`"
          :aria-pressed="l.floor === floor"
          @click="emit('update:floor', l.floor)"
        >
          {{ l.short }}
        </button>
      </div>

      <div
        v-if="controls"
        class="absolute bottom-2 right-2 flex flex-row gap-1 rounded-field bg-surface/92 p-1.5 shadow-card ring-1 ring-ink-200/70 backdrop-blur xl:bottom-auto xl:left-3 xl:right-auto xl:top-3 xl:flex-col"
      >
        <button
          type="button"
          class="grid size-10 place-items-center rounded-[8px] text-ink-600 transition-colors hover:bg-brand-50 hover:text-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          aria-label="Chapga burish"
          @click="spin(-15)"
        >
          <UiIcon name="refresh" :size="18" />
        </button>
        <button
          type="button"
          class="grid size-10 place-items-center rounded-[8px] text-ink-600 transition-colors hover:bg-brand-50 hover:text-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          aria-label="O‘ngga burish"
          @click="spin(15)"
        >
          <UiIcon name="refresh" :size="18" class="-scale-x-100" />
        </button>
        <span class="my-auto h-6 w-px shrink-0 bg-ink-200 xl:mx-1 xl:my-0 xl:h-px xl:w-auto" />
        <button
          type="button"
          class="grid size-10 place-items-center rounded-[8px] text-ink-600 transition-colors hover:bg-brand-50 hover:text-brand-600 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          aria-label="Yaqinlashtirish"
          :disabled="zoom >= 2.2"
          @click="zoomBy(0.2)"
        >
          <UiIcon name="plus" :size="18" />
        </button>
        <button
          type="button"
          class="grid size-10 place-items-center rounded-[8px] text-ink-600 transition-colors hover:bg-brand-50 hover:text-brand-600 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          aria-label="Uzoqlashtirish"
          :disabled="zoom <= 0.6"
          @click="zoomBy(-0.2)"
        >
          <UiIcon name="minus" :size="18" />
        </button>
        <span class="my-auto h-6 w-px shrink-0 bg-ink-200 lg:mx-1 lg:my-0 lg:h-px lg:w-auto" />
        <button
          type="button"
          class="grid size-10 place-items-center rounded-[8px] text-ink-600 transition-colors hover:bg-brand-50 hover:text-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          aria-label="Ko‘rinishni tiklash"
          @click="resetView"
        >
          <UiIcon name="target" :size="18" />
        </button>
        <span class="my-auto h-6 w-px shrink-0 bg-ink-200 lg:mx-1 lg:my-0 lg:h-px lg:w-auto" />

        <!-- Kompas: shimol yo‘nalishi burilish burchagi bilan birga aylanadi -->
        <span
          class="hidden size-10 place-items-center xl:grid"
          role="img"
          :aria-label="`Shimol yo‘nalishi ${Math.round(rotation)} daraja burilgan`"
        >
          <svg viewBox="-16 -16 32 32" class="size-8" aria-hidden="true">
            <circle r="14.5" fill="#F8FAFD" stroke="#E2E8F2" stroke-width="1" />
            <g :transform="`rotate(${-rotation})`">
              <path d="M0 -11 L3.6 2.6 L0 0.4 L-3.6 2.6 Z" fill="#0256F7" />
              <path d="M0 11 L3.6 -2.6 L0 -0.4 L-3.6 -2.6 Z" fill="#CBD4E3" />
            </g>
          </svg>
        </span>
      </div>

      <div
        v-if="controls"
        class="absolute inset-x-2 top-2 flex flex-wrap justify-center gap-0.5 rounded-field bg-surface/92 p-1 shadow-card ring-1 ring-ink-200/70 backdrop-blur lg:inset-x-auto lg:right-3 lg:top-3 lg:max-w-[70%] lg:justify-end"
      >
        <button
          v-for="m in MODES"
          :key="m.value"
          type="button"
          class="rounded-[8px] px-2 py-1.5 text-[11px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          :class="
            mode === m.value
              ? 'bg-brand-500 text-white'
              : 'text-ink-600 hover:bg-brand-50 hover:text-brand-600'
          "
          :aria-pressed="mode === m.value"
          @click="emit('update:mode', m.value)"
        >
          {{ m.label }}
        </button>
      </div>
      </div>

      <div
        v-if="controls"
        class="border-t border-ink-200/70 bg-surface/92 p-3 backdrop-blur xl:absolute xl:inset-x-4 xl:bottom-4 xl:rounded-field xl:border xl:border-ink-200/70 xl:shadow-card"
      >
        <div class="grid gap-2.5 sm:grid-cols-3">
          <label class="block">
            <span class="flex items-baseline justify-between text-[11px] font-semibold uppercase tracking-wide text-ink-500">
              Burilish
              <span class="tabular text-[12px] font-bold normal-case tracking-normal text-ink-800">
                {{ Math.round(rotation) }}°
              </span>
            </span>
            <input
              v-model.number="rotation"
              type="range"
              min="0"
              max="360"
              step="1"
              class="mt-1.5 h-1.5 w-full accent-brand-500"
              aria-label="Gorizontal burilish burchagi"
            />
          </label>

          <label class="block">
            <span class="flex items-baseline justify-between text-[11px] font-semibold uppercase tracking-wide text-ink-500">
              Nishab
              <span class="tabular text-[12px] font-bold normal-case tracking-normal text-ink-800">
                {{ Math.round(tilt) }}°
              </span>
            </span>
            <input
              v-model.number="tilt"
              type="range"
              min="6"
              max="82"
              step="1"
              class="mt-1.5 h-1.5 w-full accent-brand-500"
              aria-label="Kamera balandlik burchagi"
            />
          </label>

          <label class="block">
            <span class="flex items-baseline justify-between text-[11px] font-semibold uppercase tracking-wide text-ink-500">
              Ajratish
              <span class="tabular text-[12px] font-bold normal-case tracking-normal text-ink-800">
                {{ Math.round(explode * 100) }}%
              </span>
            </span>
            <input
              v-model.number="explode"
              type="range"
              min="0"
              max="1"
              step="0.02"
              class="mt-1.5 h-1.5 w-full accent-brand-500"
              aria-label="Qavatlarni ajratish darajasi"
            />
          </label>
        </div>
      </div>
    </div>

    <!-- Holat legendasi: mobil va planshet-portretda gorizontal lenta,
         kengroq ekranlarda o‘ng ustundagi karta ko‘rsatiladi -->
    <div v-if="controls" class="scroll-slim -mx-1 mt-3 overflow-x-auto px-1 lg:hidden">
      <div class="flex w-max items-center gap-3">
        <span
          v-for="c in legend"
          :key="c.key"
          class="inline-flex shrink-0 items-center gap-1.5 rounded-pill bg-surface-sunken px-2.5 py-1.5 text-[12px] font-semibold text-ink-700 ring-1 ring-inset ring-ink-200"
        >
          <span
            class="size-2.5 shrink-0 rounded-full ring-1 ring-inset ring-ink-900/10"
            :style="{ background: c.color }"
          />
          {{ c.label }}
          <span class="tabular font-bold text-ink-500">{{ c.count }}</span>
        </span>
      </div>
    </div>

    <p v-if="controls" class="mt-2.5 text-[12px] text-ink-500">
      {{ modeHint }} · Ko‘rinishni tortib aylantiring, plitani bosib qavat tanlang.
      <span v-if="selectedLevel"> Tanlangan: {{ selectedLevel.name }}.</span>
    </p>
  </div>
</template>
