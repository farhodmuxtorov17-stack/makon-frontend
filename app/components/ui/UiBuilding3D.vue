<script setup lang="ts">
import { UNIT_STATUS, UNIT_STATUS_COLOR } from '~/constants/statuses'
import type { Building } from '~/data/buildings'
import { unitsOfBuilding, type Unit } from '~/data/units'
import { area as areaLabel } from '~/utils/format'

/**
 * Bino aksonometrik ko‘rinishi.
 *
 * Butun geometriya bino yozuvidan hisoblanadi: qavatlar soni, yer osti
 * darajalari, ijaraga beriladigan maydon, bino turi va klassi qavat
 * balandligi, tayanch konturi, fasad naqshi va tom shaklini beradi. Har bir
 * qavatning unit ko‘pburchaklari (0..1 normalizatsiyada) o‘sha qavat
 * plitasiga bir xil proyeksiya matritsasi orqali tushiriladi, shu sababli
 * 3D dagi reja 2D reja bilan bir xil geometriya bo‘ladi.
 *
 * Proyeksiya: model z o‘qi atrofida `rotation` burchagiga buriladi, so‘ng
 * `tilt` balandlik burchagi bilan ekranga tushiriladi.
 *   u = x·cosθ − y·sinθ
 *   v = x·sinθ + y·cosθ
 *   ekranX = cx + u·s
 *   ekranY = cy − (v·sinφ + z·cosφ)·s
 * Kameraga qaragan yo‘nalish C = (−sinθ·cosφ, −cosθ·cosφ, sinφ). Yuz
 * ko‘rinadimi degan savol normal bilan C ning skalyar ko‘paytmasi orqali
 * hal qilinadi. Yoritilganlik esa quyosh yo‘nalishi bilan hisoblanadi.
 *
 * Ish unumdorligi: kameradan bog‘liq bo‘lmagan hamma narsa (qavat
 * geometriyasi, fasad naqshi, tom va balkon elementlari, interyer tartibi)
 * alohida memoizatsiya qilingan `computed` larda turadi. Kamera burilganda
 * faqat proyeksiya va bo‘yoq bo‘yicha birlashtirish bosqichi ishlaydi.
 */

type ViewMode = 'occupancy' | 'levels' | 'interior' | 'furnished' | 'wire'
type Family = 'tower' | 'retail' | 'shed' | 'resi'
type SectionAxis = 'off' | 'x' | 'y'

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
  sectionAxis: SectionAxis
  sectionCut: number
  tool: 'none' | 'measure'
  layers: Layers
}

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
  /** 'p': birlashtirilgan yo‘l, 'c': bosh yoki gul tojining doirasi, 't': yozuv */
  k: 'p' | 'c' | 't'
  d?: string
  f: string
  o?: number
  w?: number
  x?: number
  y?: number
  r?: number
  s?: string
}

interface SlabView {
  floor: number
  name: string
  short: string
  underground: boolean
  selected: boolean
  dim: number
  parts: FacePart[]
  skin: InteriorItem[]
  cut: string
  topPoints: string
  topFill: string
  band: string
  edges: Array<{ d: string; hidden: boolean }>
  units: UnitShape[]
  interior: InteriorItem[] | null
  extras: InteriorItem[]
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
  { value: 'occupancy', label: 'Bandlik', hint: 'Fasad yuzasi holatlar ulushiga bo‘linadi' },
  { value: 'levels', label: 'Qavatlar', hint: 'Neytral hajm, to‘liq fasad naqshi va qavat raqamlari' },
  {
    value: 'interior',
    label: 'Interyer',
    hint: 'Tanlangan qavat kesib ochiladi, devor, eshik va deraza ko‘rinadi',
  },
  {
    value: 'furnished',
    label: 'Jihozlangan',
    hint: 'Tanlangan qavat devor, eshik, jihoz va xodimlar bilan',
  },
  { value: 'wire', label: 'Karkas', hint: 'Faqat qirralar, ichki tuzilma ko‘rinadi' },
]

/**
 * Holat legendasi. Rang va nom qavat rejasi bilan bitta jadvaldan olinadi,
 * shuning uchun 3D va 2D ko‘rinishda bir xil bo‘ladi.
 */
const CATEGORIES: Array<{ key: string; label: string; color: string }> = [
  { key: 'vacant', label: UNIT_STATUS.VACANT!.label, color: UNIT_STATUS_COLOR.VACANT! },
  { key: 'rented', label: UNIT_STATUS.RENTED!.label, color: UNIT_STATUS_COLOR.RENTED! },
  { key: 'sold', label: UNIT_STATUS.SOLD!.label, color: UNIT_STATUS_COLOR.SOLD! },
  { key: 'reserved', label: UNIT_STATUS.RESERVED!.label, color: UNIT_STATUS_COLOR.RESERVED! },
  { key: 'other', label: 'Texnik / Boshqa', color: UNIT_STATUS_COLOR.MAINTENANCE! },
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
/** Konstruktiv plita qalinligi, m */
const PLATE_T = 0.34

/** Qavat balandligi, m: bino turiga qarab */
const FLOOR_HEIGHT: Record<string, number> = {
  'Biznes markaz': 3.9,
  'Ofis binosi': 3.7,
  'Savdo markaz': 5.2,
  'Ombor / logistika': 6.2,
  'Turar joy': 3.2,
}

/** Tayanch kontur nisbati (chuqurlik / kenglik): ombor uzun, savdo keng */
const PLAN_RATIO: Record<string, number> = {
  'Biznes markaz': 0.66,
  'Ofis binosi': 0.62,
  'Savdo markaz': 0.8,
  'Ombor / logistika': 0.38,
  'Turar joy': 0.5,
}

const FAMILY_OF: Record<string, Family> = {
  'Biznes markaz': 'tower',
  'Ofis binosi': 'tower',
  'Savdo markaz': 'retail',
  'Ombor / logistika': 'shed',
  'Turar joy': 'resi',
}

const view = reactive<ViewState>({
  rotation: 32,
  tilt: 34,
  zoom: 1,
  explode: 0,
  sunHour: 13,
  night: false,
  sectionAxis: 'off',
  sectionCut: 0.5,
  tool: 'none',
  layers: { walls: true, openings: true, core: true, furniture: true, people: true, tech: true },
})

const hovered = ref<number | null>(null)
const hoveredUnit = ref('')
const focused = ref<number | null>(null)
const dragging = ref(false)
const svgRef = ref<SVGSVGElement | null>(null)

/** O‘lchash asbobi nuqtalari, tanlangan qavat sathidagi metr koordinatasi */
const mA = ref<{ x: number; y: number } | null>(null)
const mB = ref<{ x: number; y: number } | null>(null)
const mHover = ref<{ x: number; y: number } | null>(null)

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

/** Fasad qadamini uzunlikdan chiqaradi, interyer derazasi ham shu qadamda */
function bayCount(len: number) {
  return clamp(Math.round(len / 3.4), 3, 26)
}

const allUnits = computed(() => unitsOfBuilding(props.building.id))
const family = computed<Family>(() => FAMILY_OF[props.building.type] ?? 'tower')
/** A klass: to‘liq shisha fasad. B va C: panjarali deraza va spandrel */
const glazed = computed(() => /^\s*a/i.test(props.building.buildingClass))

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
 * yig‘indisi o‘sha ulushga to‘g‘ri keladi. Unit yozuvi bo‘lmasa, GLA bo‘yicha.
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
  const glaPlate = Math.max(b.gla / stack, 320)
  const unitPlate = best.share > 0.04 ? best.area / best.share : 0
  // Reja to‘liq kiritilgan qavatda o‘lcham unitlardan olinadi. Reja qisman
  // kiritilgan bo‘lsa, ikki-uch unit butun qavat o‘lchamini bermaydi, shu
  // sababli tayanch kontur GLA bo‘yicha olinadi, unit ko‘pburchaklari esa
  // `pScale` bilan kichraytiriladi: ularning haqiqiy m² i saqlanadi.
  const dense = best.count >= 4 && best.share > 0.25
  const plate = dense ? unitPlate : Math.max(glaPlate, unitPlate)
  const pScale = unitPlate && plate > unitPlate ? Math.sqrt(unitPlate / plate) : 1

  const w = Math.sqrt(plate / ratio)
  return { h, slab: h, w, d: w * ratio, pScale }
})

/* ==========================================================================
   Hajm: har bir qavatning tayanch konturi, balandligi va bazasi. Bino turi
   shu yerda hal qiladi. Ofis va biznes markaz ingichka minora, savdo markaz
   keng past hajm, ombor uzun past korpus, turar joy pog‘onali blok.
   ========================================================================== */

interface LevelGeom {
  floor: number
  i: number
  z0: number
  h: number
  w: number
  d: number
  ox: number
  oy: number
  ground: boolean
  under: boolean
  top: boolean
}

const massing = computed(() => {
  const b = props.building
  const geo = dims.value
  const fam = family.value
  const lv = levels.value
  const ug = b.undergroundFloors
  const groundK = fam === 'shed' ? 1.05 : 1.38
  const lastIndex = lv.length - 1
  const above = Math.max(b.floors, 1)
  /** Turar joyda pog‘ona shu qavatdan boshlanadi */
  const stepFrom = Math.max(2, Math.round(above * 0.62))

  const out: LevelGeom[] = []
  let z = -ug * geo.h

  for (let i = 0; i < lv.length; i++) {
    const info = lv[i]!
    const under = info.floor < 0
    const ground = i === ug
    const top = i === lastIndex
    const h = under ? geo.h : ground ? geo.h * groundK : geo.h

    let w = geo.w
    let d = geo.d
    let ox = 0
    let oy = 0

    if (!under) {
      const j = i - ug
      if (fam === 'resi' && j >= stepFrom) {
        const t = clamp((j - stepFrom + 1) / Math.max(above - stepFrom, 1), 0, 1)
        d = geo.d * (1 - 0.24 * t)
        oy = (d - geo.d) / 2
        w = geo.w * (1 - 0.07 * t)
      } else if (fam === 'tower' && top && above > 3) {
        w = geo.w * 0.94
        d = geo.d * 0.94
      } else if (fam === 'retail' && top && above > 2) {
        w = geo.w * 0.96
        d = geo.d * 0.96
      }
    } else {
      // Yer osti darajasi tayanch konturdan kengroq: parkovka plitasi
      w = geo.w * 1.05
      d = geo.d * 1.05
    }

    out.push({ floor: info.floor, i, z0: z, h, w, d, ox, oy, ground, under, top })
    z += h
  }

  const last = out[out.length - 1]
  const topZ = last ? last.z0 + last.h : geo.h
  return { levels: out, topZ, family: fam, base: { w: geo.w, d: geo.d } }
})

const selectedIndex = computed(() => levels.value.findIndex((l) => l.floor === props.floor))
const selectedLevel = computed(() => levels.value[selectedIndex.value])
const hoveredLevel = computed(() => levels.value.find((l) => l.floor === hovered.value))

/* ==========================================================================
   Fasad naqshi: yuz mahalliy koordinatasidagi to‘rtburchaklar. u yuz bo‘ylab
   metrda, h qavat asosidan metrda. Deraza qatorlari soni qavatlar soniga
   teng, chunki har bir yer usti qavati aynan bitta qator beradi.
   ========================================================================== */

type SkinRole = 'glass' | 'band' | 'shop' | 'entry' | 'dock' | 'louver'

interface SkinRect {
  u0: number
  u1: number
  h0: number
  h1: number
  role: SkinRole
  seed: number
}

function skinTypical(len: number, h: number, full: boolean, key: string): SkinRect[] {
  const n = bayCount(len)
  const g = len / n
  const out: SkinRect[] = []
  if (full) {
    // A klass: to‘liq shisha fasad, ingichka mullionlar bo‘shliq bilan beriladi
    out.push({ u0: 0, u1: len, h0: 0, h1: h * 0.11, role: 'band', seed: 0 })
    out.push({ u0: 0, u1: len, h0: h * 0.94, h1: h, role: 'band', seed: 0 })
    for (let i = 0; i < n; i++) {
      out.push({
        u0: i * g + 0.17,
        u1: (i + 1) * g - 0.17,
        h0: h * 0.11,
        h1: h * 0.94,
        role: 'glass',
        seed: hash01(key, i),
      })
    }
  } else {
    // B klass: muntazam panjaradagi teshik deraza va ko‘rinadigan spandrel
    out.push({ u0: 0, u1: len, h0: 0, h1: h * 0.31, role: 'band', seed: 0 })
    out.push({ u0: 0, u1: len, h0: h * 0.86, h1: h, role: 'band', seed: 0 })
    for (let i = 0; i < n; i++) {
      const c = (i + 0.5) * g
      out.push({
        u0: c - g * 0.29,
        u1: c + g * 0.29,
        h0: h * 0.37,
        h1: h * 0.83,
        role: 'glass',
        seed: hash01(key, i),
      })
    }
  }
  return out
}

function skinGround(len: number, h: number, fam: Family, faceIdx: number, key: string): SkinRect[] {
  const out: SkinRect[] = []

  if (fam === 'shed') {
    out.push({ u0: 0, u1: len, h0: 0, h1: 0.24, role: 'band', seed: 0 })
    out.push({ u0: 0, u1: len, h0: h * 0.86, h1: h, role: 'band', seed: 0 })
    if (faceIdx === 0 || faceIdx === 2) {
      // Yuk eshiklari uzun yon tomon bo‘ylab
      const n = clamp(Math.round(len / 9.5), 2, 6)
      const g = len / n
      const dw = Math.min(3.6, g * 0.5)
      const dh = Math.min(4.6, h * 0.66)
      for (let i = 0; i < n; i++) {
        const c = (i + 0.5) * g
        out.push({ u0: c - dw / 2, u1: c + dw / 2, h0: 0.24, h1: dh, role: 'dock', seed: 0 })
      }
    }
    out.push({ u0: 0.6, u1: len - 0.6, h0: h * 0.72, h1: h * 0.83, role: 'louver', seed: 0 })
    return out
  }

  // Kirish qavati: balandroq bo‘y, vitrina va kirish guruhi
  const n = clamp(Math.round(len / 5.4), 2, 8)
  const g = len / n
  const mid = Math.floor(n / 2)
  out.push({ u0: 0, u1: len, h0: 0, h1: 0.3, role: 'band', seed: 0 })
  out.push({ u0: 0, u1: len, h0: h * 0.88, h1: h, role: 'band', seed: 0 })
  for (let i = 0; i < n; i++) {
    const entry = faceIdx === 0 && (i === mid || (n > 3 && i === mid - 1))
    out.push({
      u0: i * g + 0.26,
      u1: (i + 1) * g - 0.26,
      h0: 0.3,
      h1: h * 0.88,
      role: entry ? 'entry' : 'shop',
      seed: hash01(key, i),
    })
  }
  return out
}

/**
 * Har bir qavat uchun to‘rt yuz naqshi. Yuz uzunligi ikki xil bo‘lgani
 * sababli qavatga ikkita massiv tayyorlanadi va ularga havola beriladi.
 */
const skin = computed<Array<Array<SkinRect[] | null>>>(() => {
  const m = massing.value
  const fam = m.family
  const full = glazed.value
  const id = props.building.id

  return m.levels.map((lg) => {
    if (lg.under) return [null, null, null, null]
    const kw = `${id}w${lg.i}`
    const kd = `${id}d${lg.i}`
    if (lg.ground) {
      return [
        skinGround(lg.w, lg.h, fam, 0, kw),
        skinGround(lg.d, lg.h, fam, 1, kd),
        skinGround(lg.w, lg.h, fam, 2, kw),
        skinGround(lg.d, lg.h, fam, 3, kd),
      ]
    }
    const aw = skinTypical(lg.w, lg.h, full, kw)
    const ad = skinTypical(lg.d, lg.h, full, kd)
    return [aw, ad, aw, ad]
  })
})

/* ==========================================================================
   Tashqi elementlar: tom parapeti va uskunasi, kirish soyaboni, balkon,
   ombor annexi va savdo markaz atriumi. Hammasi dunyo koordinatasidagi
   to‘rt nuqtali yuzalar, qavatga biriktiriladi va portlatish bilan birga
   ko‘chadi.
   ========================================================================== */

interface ExtQuad {
  p: Array<[number, number, number]>
  n: [number, number, number]
  role: string
}

const EXT_TONE: Record<string, string> = {
  roof: '#C4CFDE',
  parapet: '#CBD6E3',
  plant: '#9DACC0',
  tech: '#8B9BB0',
  canopy: '#8496AC',
  column: '#A6B4C6',
  rail: '#B6C5D8',
  balcony: '#CFD9E6',
  annex: '#C7D2E0',
  glass: '#8FB6DC',
  apron: '#A8B4C4',
}

function pushBox(
  out: ExtQuad[],
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  z0: number,
  z1: number,
  role: string,
  top = true,
) {
  out.push({
    p: [
      [x0, y0, z1],
      [x1, y0, z1],
      [x1, y0, z0],
      [x0, y0, z0],
    ],
    n: [0, -1, 0],
    role,
  })
  out.push({
    p: [
      [x1, y0, z1],
      [x1, y1, z1],
      [x1, y1, z0],
      [x1, y0, z0],
    ],
    n: [1, 0, 0],
    role,
  })
  out.push({
    p: [
      [x1, y1, z1],
      [x0, y1, z1],
      [x0, y1, z0],
      [x1, y1, z0],
    ],
    n: [0, 1, 0],
    role,
  })
  out.push({
    p: [
      [x0, y1, z1],
      [x0, y0, z1],
      [x0, y0, z0],
      [x0, y1, z0],
    ],
    n: [-1, 0, 0],
    role,
  })
  if (top) {
    out.push({
      p: [
        [x0, y0, z1],
        [x1, y0, z1],
        [x1, y1, z1],
        [x0, y1, z1],
      ],
      n: [0, 0, 1],
      role,
    })
  }
}

const extras = computed<ExtQuad[][]>(() => {
  const m = massing.value
  const fam = m.family
  const tech = view.layers.tech
  const out: ExtQuad[][] = m.levels.map(() => [])

  for (const lg of m.levels) {
    if (lg.under) continue
    const list = out[lg.i]!
    const X0 = lg.ox - lg.w / 2
    const X1 = lg.ox + lg.w / 2
    const Y0 = lg.oy - lg.d / 2
    const Y1 = lg.oy + lg.d / 2
    const zTop = lg.h

    // --- kirish qavati
    if (lg.ground) {
      if (fam === 'shed') {
        // Yuk maydonchasi: past platforma uzun yon tomon bo‘ylab
        pushBox(list, X0 + 1.5, Y0 - 3.4, X1 - 1.5, Y0, 0, 1.15, 'apron')

        // Ofis annexi: qisqa tomonga tirkalgan ikki qavatli blok
        const ah = Math.min(7.4, Math.max(m.topZ * 0.7, 4))
        const ay0 = lg.oy - lg.d * 0.3
        const ay1 = lg.oy + lg.d * 0.3
        const ax0 = X0 - Math.min(lg.w * 0.15, 14)
        pushBox(list, ax0, ay0, X0 + 0.6, ay1, 0, ah, 'annex')
        pushBox(list, ax0 - 0.35, ay0 - 0.35, X0 + 0.6, ay1 + 0.35, ah, ah + 0.7, 'parapet')
        for (let r = 0; r < 2; r++) {
          for (let c = 0; c < 3; c++) {
            const z0 = 1.2 + r * 3.1
            const y0 = ay0 + ((c + 0.25) * (ay1 - ay0)) / 3
            const y1 = ay0 + ((c + 0.75) * (ay1 - ay0)) / 3
            list.push({
              p: [
                [ax0 - 0.03, y0, z0 + 1.6],
                [ax0 - 0.03, y1, z0 + 1.6],
                [ax0 - 0.03, y1, z0],
                [ax0 - 0.03, y0, z0],
              ],
              n: [-1, 0, 0],
              role: 'glass',
            })
          }
        }
      } else {
        const cw = Math.min(lg.w * 0.42, 16)
        const cz = lg.h * 0.66
        pushBox(list, lg.ox - cw / 2, Y0 - 3.4, lg.ox + cw / 2, Y0 + 0.3, cz, cz + 0.42, 'canopy')
        pushBox(list, lg.ox - cw / 2 + 0.5, Y0 - 3.1, lg.ox - cw / 2 + 1, Y0 - 2.6, 0, cz, 'column')
        pushBox(list, lg.ox + cw / 2 - 1, Y0 - 3.1, lg.ox + cw / 2 - 0.5, Y0 - 2.6, 0, cz, 'column')
      }

      if (fam === 'retail') {
        // Kirish atriumi: baland shisha hajm, parapet bilan yakunlanadi
        const aw = Math.min(lg.w * 0.4, 26)
        const az = lg.h * 1.72
        pushBox(list, lg.ox - aw / 2, Y0 - 4.6, lg.ox + aw / 2, Y0 + 0.4, 0, az, 'glass')
        pushBox(
          list,
          lg.ox - aw / 2 - 0.4,
          Y0 - 5,
          lg.ox + aw / 2 + 0.4,
          Y0 + 0.4,
          az,
          az + 0.9,
          'parapet',
        )
      }
    }

    // --- turar joy balkonlari
    if (fam === 'resi' && !lg.ground && !lg.top) {
      const nb = clamp(Math.round(lg.w / 7), 2, 4)
      const bw = Math.min(lg.w / (nb * 1.7), 5.2)
      const dep = 1.35
      const bz = 0.42
      for (let i = 0; i < nb; i++) {
        const c = X0 + ((i + 0.5) * lg.w) / nb
        for (const side of [0, 2]) {
          const yEdge = side === 0 ? Y0 : Y1
          const yOut = side === 0 ? Y0 - dep : Y1 + dep
          list.push({
            p: [
              [c - bw / 2, yEdge, bz],
              [c + bw / 2, yEdge, bz],
              [c + bw / 2, yOut, bz],
              [c - bw / 2, yOut, bz],
            ],
            n: [0, 0, 1],
            role: 'balcony',
          })
          list.push({
            p: [
              [c - bw / 2, yOut, bz + 1.05],
              [c + bw / 2, yOut, bz + 1.05],
              [c + bw / 2, yOut, bz],
              [c - bw / 2, yOut, bz],
            ],
            n: [0, side === 0 ? -1 : 1, 0],
            role: 'rail',
          })
          list.push({
            p: [
              [c - bw / 2, yEdge, bz + 1.05],
              [c - bw / 2, yOut, bz + 1.05],
              [c - bw / 2, yOut, bz],
              [c - bw / 2, yEdge, bz],
            ],
            n: [-1, 0, 0],
            role: 'rail',
          })
        }
      }
    }

    // --- tom
    if (lg.top) {
      if (fam === 'shed') {
        // Yassi qiyalikdagi ikki nishabli tom, uchi uzun o‘q bo‘ylab
        const rise = clamp(lg.d * 0.06, 1.6, 5.5)
        const ex = 0.7
        const ax0 = X0 - ex
        const ax1 = X1 + ex
        const ay0 = Y0 - ex
        const ay1 = Y1 + ex
        list.push({
          p: [
            [ax0, ay0, zTop],
            [ax1, ay0, zTop],
            [ax1, lg.oy, zTop + rise],
            [ax0, lg.oy, zTop + rise],
          ],
          n: [0, -rise, lg.d / 2],
          role: 'roof',
        })
        list.push({
          p: [
            [ax0, ay1, zTop],
            [ax1, ay1, zTop],
            [ax1, lg.oy, zTop + rise],
            [ax0, lg.oy, zTop + rise],
          ],
          n: [0, rise, lg.d / 2],
          role: 'roof',
        })
        list.push({
          p: [
            [ax0, ay0, zTop],
            [ax0, ay1, zTop],
            [ax0, lg.oy, zTop + rise],
            [ax0, lg.oy, zTop + rise],
          ],
          n: [-1, 0, 0],
          role: 'parapet',
        })
        list.push({
          p: [
            [ax1, ay0, zTop],
            [ax1, ay1, zTop],
            [ax1, lg.oy, zTop + rise],
            [ax1, lg.oy, zTop + rise],
          ],
          n: [1, 0, 0],
          role: 'parapet',
        })
        // Tom yorug‘lik lentalari
        for (const k of [0.34, 0.66]) {
          const y = Y0 + lg.d * k
          const zz = zTop + rise * (1 - Math.abs(y - lg.oy) / (lg.d / 2))
          list.push({
            p: [
              [X0 + lg.w * 0.12, y, zz + 0.05],
              [X1 - lg.w * 0.12, y, zz + 0.05],
              [X1 - lg.w * 0.12, y + lg.d * 0.05, zz + 0.05],
              [X0 + lg.w * 0.12, y + lg.d * 0.05, zz + 0.05],
            ],
            n: [0, 0, 1],
            role: 'glass',
          })
        }
        if (tech) {
          pushBox(
            list,
            X0 + lg.w * 0.7,
            lg.oy - 2,
            X0 + lg.w * 0.7 + 3.4,
            lg.oy + 2,
            zTop + rise * 0.4,
            zTop + rise * 0.4 + 1.6,
            'tech',
          )
        }
      } else {
        const pt2 = 0.42
        const ph = fam === 'retail' ? 1.7 : fam === 'resi' ? 1.05 : 1.25
        pushBox(list, X0, Y0, X1, Y0 + pt2, zTop, zTop + ph, 'parapet')
        pushBox(list, X0, Y1 - pt2, X1, Y1, zTop, zTop + ph, 'parapet')
        pushBox(list, X0, Y0 + pt2, X0 + pt2, Y1 - pt2, zTop, zTop + ph, 'parapet')
        pushBox(list, X1 - pt2, Y0 + pt2, X1, Y1 - pt2, zTop, zTop + ph, 'parapet')

        const pw = lg.w * 0.32
        const pd = lg.d * 0.34
        pushBox(
          list,
          lg.ox - pw / 2,
          lg.oy - pd / 2,
          lg.ox + pw / 2,
          lg.oy + pd / 2,
          zTop,
          zTop + (fam === 'resi' ? 2.4 : 2.9),
          'plant',
        )

        if (tech) {
          const cw = Math.min(lg.w * 0.16, 4.6)
          pushBox(
            list,
            lg.ox + pw * 0.72,
            lg.oy - cw / 2,
            lg.ox + pw * 0.72 + cw,
            lg.oy + cw / 2,
            zTop,
            zTop + 1.35,
            'tech',
          )
          if (fam !== 'resi') {
            pushBox(
              list,
              lg.ox - pw * 0.72 - cw,
              lg.oy + pd * 0.3,
              lg.ox - pw * 0.72,
              lg.oy + pd * 0.3 + cw * 0.8,
              zTop,
              zTop + 1.15,
              'tech',
            )
          }
        }

        if (fam === 'resi') {
          pushBox(
            list,
            lg.ox - pw * 0.8,
            lg.oy - pd * 0.8,
            lg.ox - pw * 0.8 + 3.2,
            lg.oy - pd * 0.8 + 3.2,
            zTop,
            zTop + 2.6,
            'plant',
          )
        } else {
          // Antenna machtasi: tojni belgilaydi
          const mh = fam === 'retail' ? 4.2 : 6.4
          pushBox(
            list,
            lg.ox - 0.22,
            lg.oy - 0.22,
            lg.ox + 0.22,
            lg.oy + 0.22,
            zTop + 2.9,
            zTop + 2.9 + mh,
            'plant',
          )
        }
      }
    }
  }

  return out
})

/* ==========================================================================
   Interyer: devor qalinligi, eshik va deraza o‘rinlari, yo‘lak, sanuzel va
   texnik xona, lift shaxtasi va zinapoya, jihoz va xodimlar. Butun tartib
   metrda, tanlangan qavat mahalliy koordinatasida quriladi va `interiorPlan`
   da saqlanadi: kamera burilganda qayta hisoblanmaydi.
   ========================================================================== */

const DOOR_W = 0.9
const DOOR_H = 2.1
const PERSON_H = 1.7
const WALL_EXT = 0.34
const WALL_INT = 0.16

const IT = {
  wallExt: '#B4C2D6',
  wallInt: '#C6D2E3',
  leaf: '#8FA6C9',
  glass: '#7FB4DF',
  shaft: '#9AA9BE',
  cab: '#C8D3E1',
  step: '#C4CFDE',
  wet: '#9FC8D8',
  tech: '#B0A9C6',
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
  /** To‘rt yuzdan qaysi biriga tegishli: kameraga qaragan bo‘lsa chizilmaydi */
  face?: number
  /**
   * Chuqurlik tayanchi. Bir tekislikdagi qismlar (masalan bitta tashqi devor
   * bandlari, ustunlari va oynalari) bir xil chuqurlik oladi, shu sababli
   * saralashdan keyin yonma-yon turadi va bitta yo‘lga birlashadi.
   */
  ax?: number
  ay?: number
  az?: number
}

interface PlanDot {
  x: number
  y: number
  z: number
  r: number
  tone: string
}

interface PlanText {
  x: number
  y: number
  z: number
  text: string
}

interface InteriorPlan {
  level: 0 | 1 | 2
  quads: PlanQuad[]
  boxes: PlanBox[]
  dots: PlanDot[]
  texts: PlanText[]
  parts: number
}

const EMPTY_PLAN: InteriorPlan = { level: 0, quads: [], boxes: [], dots: [], texts: [], parts: 0 }

/** lg dan pastda jihoz va xodimlar chizilmaydi, faqat devor va eshiklar */
const isWide = useMediaQuery('(min-width: 1024px)')

const interiorLevel = computed<0 | 1 | 2>(() => {
  if (selectedIndex.value < 0) return 0
  if (props.mode === 'furnished') return 2
  if (props.mode === 'interior') return 1
  if (props.mode === 'occupancy' && view.explode > 0.25) return 1
  return 0
})

/** Tanlangan qavat kesib ochiladimi */
const cutaway = computed(() => props.mode !== 'wire' && interiorLevel.value > 0)

/** Ichki to‘siqlar: umumiy qirralarni takrorlamasdan, qalinligi bilan */
function buildPartitions(
  rooms: Array<{ poly: Array<[number, number]>; cx: number; cy: number }>,
  rect: { X0: number; Y0: number; X1: number; Y1: number },
  wallH: number,
  plateCx: number,
  plateCy: number,
  withDoors: boolean,
  boxes: PlanBox[],
  quads: PlanQuad[],
) {
  const seen = new Set<string>()
  const edge = 0.7
  const key = (v: number) => Math.round(v * 10) / 10
  const t = WALL_INT / 2

  const wall = (ax: number, ay: number, bx: number, by: number, z0: number, z1: number) => {
    if (Math.abs(ay - by) < 0.02) {
      boxes.push({
        x0: Math.min(ax, bx),
        y0: ay - t,
        x1: Math.max(ax, bx),
        y1: ay + t,
        z0,
        z1,
        tone: IT.wallInt,
      })
    } else if (Math.abs(ax - bx) < 0.02) {
      boxes.push({
        x0: ax - t,
        y0: Math.min(ay, by),
        x1: ax + t,
        y1: Math.max(ay, by),
        z0,
        z1,
        tone: IT.wallInt,
      })
    } else {
      quads.push({ ax, ay, bx, by, z0, z1, tone: IT.wallInt, op: 0.92, sw: 0.6 })
    }
  }

  for (const room of rooms) {
    const poly = room.poly
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
      const k = [`${key(a[0])}:${key(a[1])}`, `${key(b[0])}:${key(b[1])}`].sort().join('|')
      if (seen.has(k)) continue
      seen.add(k)

      const mx = (a[0] + b[0]) / 2
      const my = (a[1] + b[1]) / 2
      // Tashqi kontur bilan ustma-ust tushgan qirra tashqi devorda chiziladi
      if (
        mx - rect.X0 < edge ||
        rect.X1 - mx < edge ||
        my - rect.Y0 < edge ||
        rect.Y1 - my < edge
      ) {
        continue
      }

      const len = Math.hypot(b[0] - a[0], b[1] - a[1])
      if (!withDoors || i !== doorEdge || len < DOOR_W * 2.4) {
        wall(a[0], a[1], b[0], b[1], 0, wallH)
        continue
      }

      const t0 = 0.5 - DOOR_W / (2 * len)
      const t1 = 0.5 + DOOR_W / (2 * len)
      const px0 = a[0] + (b[0] - a[0]) * t0
      const py0 = a[1] + (b[1] - a[1]) * t0
      const px1 = a[0] + (b[0] - a[0]) * t1
      const py1 = a[1] + (b[1] - a[1]) * t1
      wall(a[0], a[1], px0, py0, 0, wallH)
      wall(px1, py1, b[0], b[1], 0, wallH)
      wall(px0, py0, px1, py1, DOOR_H, wallH)

      // Eshik qanoti 30 daraja ochiq holatda
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
        op: 0.92,
        sw: 0.7,
      })
    }
  }
}

/** Tashqi devor: qalinligi bilan, deraza o‘rinlari fasad qadamiga tushadi */
function buildPerimeter(
  rect: { X0: number; Y0: number; X1: number; Y1: number },
  wallH: number,
  openings: boolean,
  boxes: PlanBox[],
) {
  const { X0, Y0, X1, Y1 } = rect
  const T = WALL_EXT
  const sillZ = Math.min(0.92, wallH * 0.35)
  const headZ = Math.min(2.32, wallH * 0.86)

  const side = (face: number) => {
    const horiz = face === 0 || face === 2
    const len = horiz ? X1 - X0 : Y1 - Y0
    const a0 = horiz ? X0 : Y0
    const fix0 = face === 0 ? Y0 : face === 1 ? X1 - T : face === 2 ? Y1 - T : X0
    const fix1 = fix0 + T
    // Bitta devorning hamma qismi bir xil chuqurlik tayanchini oladi
    const ax = horiz ? (X0 + X1) / 2 : fix0 + T / 2
    const ay = horiz ? fix0 + T / 2 : (Y0 + Y1) / 2
    const az = wallH / 2

    const put = (u0: number, u1: number, z0: number, z1: number, tone: string) => {
      if (u1 - u0 < 0.05) return
      boxes.push(
        horiz
          ? { x0: u0, y0: fix0, x1: u1, y1: fix1, z0, z1, tone, face, ax, ay, az }
          : { x0: fix0, y0: u0, x1: fix1, y1: u1, z0, z1, tone, face, ax, ay, az },
      )
    }

    if (!openings) {
      put(a0, a0 + len, 0, wallH, IT.wallExt)
      return
    }

    const n = bayCount(len)
    const g = len / n
    put(a0, a0 + len, 0, sillZ, IT.wallExt)
    put(a0, a0 + len, headZ, wallH, IT.wallExt)
    for (let i = 0; i <= n; i++) {
      const c = a0 + i * g
      const p0 = i === 0 ? a0 : c - g * 0.21
      const p1 = i === n ? a0 + len : c + g * 0.21
      put(p0, p1, sillZ, headZ, IT.wallExt)
    }
    for (let i = 0; i < n; i++) {
      const c = a0 + (i + 0.5) * g
      put(c - g * 0.29, c + g * 0.29, sillZ, headZ, IT.glass)
    }
  }

  side(0)
  side(1)
  side(2)
  side(3)
}

const interiorPlan = computed<InteriorPlan>(() => {
  const want = interiorLevel.value
  if (!want) return EMPTY_PLAN

  const info = levels.value[selectedIndex.value]
  const lg = massing.value.levels[selectedIndex.value]
  if (!info || !lg || !info.units.length) return EMPTY_PLAN

  const L = view.layers
  const pk = dims.value.pScale
  const W = lg.w
  const D = lg.d
  const X0 = lg.ox - W / 2
  const X1 = lg.ox + W / 2
  const Y0 = lg.oy - D / 2
  const Y1 = lg.oy + D / 2
  const rect = { X0, Y0, X1, Y1 }
  const wallH = Math.min(2.8, lg.h * 0.72)

  const rooms = info.units.map((u) => {
    const poly = u.polygon.map((p) => {
      const nx = typeof p[0] === 'number' ? p[0] : 0
      const ny = typeof p[1] === 'number' ? p[1] : 0
      return [lg.ox + W * (nx - 0.5) * pk, lg.oy + D * (0.5 - ny) * pk] as [number, number]
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

  const quads: PlanQuad[] = []
  const boxes: PlanBox[] = []
  const dots: PlanDot[] = []
  const texts: PlanText[] = []

  if (L.walls) {
    buildPerimeter(rect, wallH, L.openings, boxes)
    buildPartitions(rooms, rect, wallH, plateCx, plateCy, L.openings, boxes, quads)
  }

  const box = (
    cx: number,
    cy: number,
    w: number,
    d: number,
    z0: number,
    z1: number,
    tone: string,
    face?: number,
  ) =>
    boxes.push({ x0: cx - w / 2, y0: cy - d / 2, x1: cx + w / 2, y1: cy + d / 2, z0, z1, tone, face })

  // --- lift yadrosi, zinapoya, sanuzel va texnik xona
  let kx = 0
  let ky = 0
  let kn = 0
  const grid = 18
  for (let i = 0; i < grid; i++) {
    for (let j = 0; j < grid; j++) {
      const x = X0 + W * 0.14 + ((i + 0.5) * W * 0.72) / grid
      const y = Y0 + D * 0.14 + ((j + 0.5) * D * 0.72) / grid
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
  }

  if (hasCore && L.core) {
    // Lift shaxtasi kesimda: kameraga qaragan devor olib tashlanadi
    const t = 0.18
    for (const sx of [kx - 1.5, kx + 1.5]) {
      const w = 2.5
      const d = 2.7
      box(sx, ky - d / 2 + t / 2, w, t, 0, wallH, IT.shaft, 0)
      box(sx, ky + d / 2 - t / 2, w, t, 0, wallH, IT.shaft, 2)
      box(sx - w / 2 + t / 2, ky, t, d, 0, wallH, IT.shaft, 3)
      box(sx + w / 2 - t / 2, ky, t, d, 0, wallH, IT.shaft, 1)
      // Kabina
      box(sx, ky, w - 0.9, d - 0.9, 0.04, 2.2, IT.cab)
    }

    // Zinapoya: ikkita marsh, oraliq maydoncha, zinalar ko‘rinadi
    const sy = ky + 3.4
    const run = 0.3
    const rise = 0.18
    for (let s = 0; s < 10; s++) {
      box(kx - 1.1, sy + s * run, 1.9, run, 0, 0.1 + s * rise, IT.step)
    }
    box(kx, sy + 10 * run + 0.7, 4.2, 1.4, 0, 0.1 + 10 * rise, IT.step)
    for (let s = 0; s < 10; s++) {
      box(kx + 1.1, sy + (9 - s) * run, 1.9, run, 0, 0.1 + (10 + s) * rise, IT.step)
    }
    box(kx - 2.3, sy + 5 * run, 0.16, 10 * run, 0, wallH, IT.wallInt, 3)
    box(kx + 2.3, sy + 5 * run, 0.16, 10 * run, 0, wallH, IT.wallInt, 1)
  }

  if (hasCore && L.tech) {
    // Sanuzel va texnik xona yadroga tirkalgan, alohida bo‘yoq va yozuv bilan
    const wx = kx - 4.7
    box(wx, ky, 3.1, 2.8, 0, 0.06, IT.wet)
    box(wx, ky - 1.45, 3.1, 0.14, 0, wallH, IT.wallInt, 0)
    box(wx, ky + 1.45, 3.1, 0.14, 0, wallH, IT.wallInt, 2)
    box(wx - 1.55, ky, 0.14, 2.8, 0, wallH, IT.wallInt, 3)
    box(wx + 1.55, ky, 0.14, 2.8, 0, wallH, IT.wallInt, 1)
    for (let i = 0; i < 3; i++) box(wx - 1 + i, ky + 1.05, 0.5, 0.4, 0, 0.42, IT.cab)
    texts.push({ x: wx, y: ky, z: wallH + 0.5, text: 'Sanuzel' })

    const tx = kx + 4.7
    box(tx, ky, 2.7, 2.8, 0, 0.06, IT.tech)
    box(tx, ky - 1.45, 2.7, 0.14, 0, wallH, IT.wallInt, 0)
    box(tx, ky + 1.45, 2.7, 0.14, 0, wallH, IT.wallInt, 2)
    box(tx - 1.35, ky, 0.14, 2.8, 0, wallH, IT.wallInt, 3)
    box(tx + 1.35, ky, 0.14, 2.8, 0, wallH, IT.wallInt, 1)
    box(tx, ky - 0.6, 1.6, 0.7, 0, 1.8, IT.block)
    texts.push({ x: tx, y: ky, z: wallH + 0.5, text: 'Texnik xona' })
  }

  if (want < 2 || !isWide.value || (!L.furniture && !L.people)) {
    return { level: 1, quads, boxes, dots, texts, parts: quads.length + boxes.length * 3 }
  }

  // --- jihozlar: unit turi va maydoniga qarab. Umumiy hajm cheklangan,
  //     unitlar ko‘p bo‘lgan qavatda ham kadr vaqti barqaror qoladi.
  let peopleLeft = 40
  const canFurnish = () => view.layers.furniture && boxes.length < 560
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

    if (canFurnish() && u.usage === 'Ofis') {
      const ws = Math.max(1, Math.min(6, Math.round(u.area / 14)))
      const share = u.area > 60 ? 0.62 : 1
      const bandD = rd * share
      const cols = Math.max(1, Math.min(ws, Math.round(Math.sqrt((ws * rw) / Math.max(bandD, 0.6)))))
      const rowsN = Math.ceil(ws / cols)
      for (let i = 0; i < ws; i++) {
        const x = x0 + (((i % cols) + 0.5) * rw) / cols
        const y = y0 + ((Math.floor(i / cols) + 0.5) * bandD) / rowsN
        if (!inside(x, y)) continue
        box(x, y, 1.4, 0.7, 0.62, 0.75, IT.desk)
        box(x, y + 0.62, 0.48, 0.48, 0.28, 0.44, IT.chair)
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
          box(mx, my, 2.4, 1.1, 0.64, 0.76, IT.desk)
          for (let i = 0; i < 4; i++) {
            box(
              mx - 0.75 + (i % 2) * 1.5,
              my + (i < 2 ? -0.95 : 0.95),
              0.46,
              0.46,
              0.28,
              0.44,
              IT.chair,
            )
          }
        }
      }
      const sx = x0 + rw * 0.5
      const sy = y1 - 0.5
      if (inside(sx, sy)) {
        box(sx, sy, 1.8, 0.8, 0.16, 0.44, IT.sofa)
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
          box(sx + 1.5, sy, 0.42, 0.42, 0, 0.5, IT.pot)
          dots.push({ x: sx + 1.5, y: sy, z: 0.76, r: 0.4, tone: IT.crown })
        }
      }
    } else if (canFurnish() && u.usage === 'Savdo') {
      const n = Math.max(2, Math.min(6, Math.round(rw / 2.4)))
      for (let i = 0; i < n; i++) {
        const x = x0 + ((i + 0.5) * rw) / n
        for (const y of [y0 + 0.5, y1 - 0.5]) {
          if (inside(x, y)) box(x, y, 1.1, 0.6, 0, 1.9, IT.rack)
        }
      }
      const ccx = x0 + rw * 0.5
      const ccy = y0 + rd * 0.5
      if (inside(ccx, ccy)) {
        box(ccx, ccy, 2.2, 0.7, 0, 1.05, IT.desk)
        seats.push([ccx, ccy + 0.85])
      }
    } else if (canFurnish() && u.usage === 'Ombor') {
      const n = Math.max(2, Math.min(7, Math.round(rw / 3.4)))
      for (const y of [y0 + rd * 0.22, y1 - rd * 0.22]) {
        for (let i = 0; i < n; i++) {
          const x = x0 + ((i + 0.5) * rw) / n
          if (inside(x, y)) box(x, y, 2.4, 1.1, 0, 2.3, IT.rack)
        }
      }
      seats.push([x0 + rw * 0.5, y0 + rd * 0.5])
    } else if (canFurnish() && u.usage === 'Turar joy') {
      const bx = x0 + rw * 0.26
      const by = y0 + rd * 0.28
      if (inside(bx, by)) box(bx, by, 1.6, 2.05, 0.1, 0.55, IT.bed)
      const sx2 = x0 + rw * 0.7
      const sy2 = y1 - rd * 0.3
      if (inside(sx2, sy2)) {
        box(sx2, sy2, 1.8, 0.85, 0.16, 0.44, IT.sofa)
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
        if (inside(sx2, sy2 - 1.3)) box(sx2, sy2 - 1.3, 1.1, 0.7, 0.3, 0.44, IT.desk)
        seats.push([sx2, sy2 - 0.9])
      }
      const kbx = x1 - 0.5
      const kby = y0 + rd * 0.5
      if (inside(kbx, kby)) box(kbx, kby, 0.65, 2.2, 0, 0.9, IT.block)
    } else if (u.usage === 'Texnik zona' ? L.tech : canFurnish()) {
      const tx = x0 + rw * 0.5
      const ty = y0 + rd * 0.5
      if (inside(tx, ty)) box(tx, ty, 1.6, 1, 0, 1.4, IT.block)
    }

    // --- xodimlar: faqat band unitlarda, ish o‘rni soniga mutanosib
    if (!L.people || !live || !seats.length) continue
    const wantPeople = Math.max(1, Math.min(3, Math.round(seats.length * 0.5)))
    for (let i = 0; i < wantPeople && peopleLeft > 0; i++) {
      const seat = seats[Math.floor(hash01(u.id, i) * seats.length)] ?? seats[0]!
      const x = seat[0] + (hash01(u.id, i + 41) - 0.5) * 0.5
      const y = seat[1] + (hash01(u.id, i + 83) - 0.5) * 0.5
      if (!inside(x, y)) continue
      const tone =
        PERSON_TONES[Math.floor(hash01(u.id, i + 127) * PERSON_TONES.length)] ?? PERSON_TONES[0]!
      box(x, y, 0.34, 0.24, 0, 0.86, tone)
      box(x, y, 0.42, 0.28, 0.86, PERSON_H - 0.22, tone)
      dots.push({ x, y, z: PERSON_H - 0.1, r: 0.14, tone: IT.head })
      peopleLeft--
    }
  }

  // --- yo‘lakdagi bir necha kishi
  if (hasCore && L.people) {
    for (let i = 0; i < 3 && peopleLeft > 0; i++) {
      const x = kx + (hash01(info.name, i) - 0.5) * 7
      const y = ky + (hash01(info.name, i + 31) - 0.5) * 5
      if (rooms.some((r) => inPolygon(x, y, r.poly))) continue
      const tone = PERSON_TONES[i % PERSON_TONES.length]!
      box(x, y, 0.34, 0.24, 0, 0.86, tone)
      box(x, y, 0.42, 0.28, 0.86, PERSON_H - 0.22, tone)
      dots.push({ x, y, z: PERSON_H - 0.1, r: 0.14, tone: IT.head })
      peopleLeft--
    }
  }

  const parts = quads.length + boxes.length * 3 + dots.length
  // Element soni chegaradan oshsa, jihoz va odamlarsiz sodda ko‘rinish
  if (parts > 1500) {
    const simpleB: PlanBox[] = []
    const simpleQ: PlanQuad[] = []
    if (L.walls) {
      buildPerimeter(rect, wallH, L.openings, simpleB)
      buildPartitions(rooms, rect, wallH, plateCx, plateCy, L.openings, simpleB, simpleQ)
    }
    return { level: 1, quads: simpleQ, boxes: simpleB, dots: [], texts, parts }
  }
  return { level: 2, quads, boxes, dots, texts, parts }
})

/* ==========================================================================
   Yoritish: quyosh yo‘nalishi kun vaqtidan chiqadi va yuz soyasini, yer
   sathidagi soya yo‘nalishini hamda tun rejimidagi deraza chirog‘ini
   boshqaradi.
   ========================================================================== */

const sun = computed(() => {
  const t = clamp((view.sunHour - 6) / 14, 0, 1)
  const az = ((-118 + t * 236) * Math.PI) / 180
  const el = ((7 + Math.sin(Math.PI * t) * 56) * Math.PI) / 180
  const ce = Math.cos(el)
  return { x: Math.sin(az) * ce, y: -Math.cos(az) * ce, z: Math.sin(el) }
})

/** Fasad elementining bo‘yog‘i: rol, yoritilganlik va tun rejimiga qarab */
function skinFill(role: SkinRole, amount: number, seed: number, night: boolean) {
  if (role === 'glass' || role === 'shop' || role === 'entry') {
    if (night) {
      if (role === 'entry') return '#FFE0A6'
      return seed > 0.42 ? shade('#F7CE86', 0.02 + seed * 0.14) : '#1B3049'
    }
    const base = role === 'entry' ? '#5F86AE' : role === 'shop' ? '#A6CBE8' : '#8FB6DC'
    return shade(base, amount + 0.12)
  }
  if (role === 'dock') return shade('#65758A', amount + 0.06)
  if (role === 'louver') return shade('#8D9CB0', amount)
  return shade('#D3DDEA', amount)
}

const scene = computed(() => {
  const geo = dims.value
  const lv = levels.value
  const m = massing.value
  const sk = skin.value
  const ex = extras.value
  const ug = props.building.undergroundFloors
  const mode = props.mode
  const plan = interiorPlan.value
  const night = view.night
  const pk = geo.pScale
  const S = sun.value

  const th = (view.rotation * Math.PI) / 180
  const ph = (view.tilt * Math.PI) / 180
  const ct = Math.cos(th)
  const st = Math.sin(th)
  const sp = Math.sin(ph)
  const cp = Math.cos(ph)

  const sel = selectedIndex.value
  const isCut = cutaway.value && plan.level > 0
  const step = view.explode * geo.h * 2.6
  const wallH = Math.min(2.8, geo.h * 0.72)
  const openLift =
    sel >= 0 && mode !== 'wire' ? (isCut ? Math.max(geo.h * 1.05, wallH * 2.3) : geo.h * 0.35) : 0

  const zBase = (i: number) => {
    const lg = m.levels[i]!
    let z = lg.z0 + step * (i - ug)
    if (sel >= 0 && i > sel) z += openLift
    return z
  }

  const hoverLift = geo.h * 0.34
  const lastGeo = m.levels[lv.length - 1]
  const zLow = zBase(0)
  const zHigh = zBase(lv.length - 1) + (lastGeo ? lastGeo.h : geo.h) + m.topZ * 0.08
  const spanH = Math.hypot(geo.w * 1.2, geo.d * 1.2)
  const spanV = Math.max(spanH * sp + (zHigh - zLow) * cp, 1)
  const s = Math.min((VW * 0.86) / spanH, (VH * 0.84) / spanV) * view.zoom
  const cx = VW / 2
  const cy = VH / 2 + ((zLow + zHigh) / 2) * cp * s

  const px = (x: number, y: number) => r1(cx + (x * ct - y * st) * s)
  const py = (x: number, y: number, z: number) => r1(cy - ((x * st + y * ct) * sp + z * cp) * s)
  const pt = (x: number, y: number, z: number) => `${px(x, y)},${py(x, y, z)}`

  /** Yuz kameraga qaraganmi: normal bilan kamera yo‘nalishining ko‘paytmasi */
  const dotC = (nx: number, ny: number, nz: number) => -nx * st * cp - ny * ct * cp + nz * sp

  /** Yoritilganlik: quyosh yo‘nalishi bilan, tunda umumiy qorong‘ilik */
  const lightOf = (nx: number, ny: number, nz: number) => {
    const len = Math.hypot(nx, ny, nz) || 1
    const d = (nx * S.x + ny * S.y + nz * S.z) / len
    const k = 0.5 + 0.5 * clamp(d, -1, 1)
    return night ? -0.58 + k * 0.16 : -0.48 + k * 0.54
  }

  const faceNormals: Array<[number, number]> = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ]
  const faceState = faceNormals.map(([nx, ny]) => ({
    visible: dotC(nx, ny, 0) > 0.0001,
    amount: lightOf(nx, ny, 0),
  }))
  const topAmount = lightOf(0, 0, 1)
  const topFace = Math.max(topAmount + 0.34, 0.1)

  // Kichik hajmlar (jihoz, zina, odam, kabina) bitta tekis bo‘yoq bilan bitta
  // yo‘lda chiziladi: bu masshtabda yuz farqi sezilmaydi, tugun soni esa uch
  // barobar kamayadi va bir xil bo‘yoqli qo‘shnilar birlashadi.
  let sideSum = 0
  let sideN = 0
  for (const f of faceState) {
    if (f.visible) {
      sideSum += f.amount
      sideN++
    }
  }
  const flatAmount = (topFace + (sideN ? sideSum / sideN : topAmount)) / 2

  // --- kesim tekisligi: kameraga yaqin yarim olib tashlanadi
  const sec = (() => {
    if (view.sectionAxis === 'off') return null
    const axis = view.sectionAxis
    const half = (axis === 'x' ? m.base.w : m.base.d) * 0.58
    const c = (view.sectionCut - 0.5) * 2 * half
    const keepHigh = axis === 'x' ? st > 0 : ct > 0
    return { axis, c, keepHigh }
  })()

  const keepV = (v: number) => (!sec ? true : sec.keepHigh ? v >= sec.c : v <= sec.c)
  const keepPt = (x: number, y: number) => (!sec ? true : keepV(sec.axis === 'x' ? x : y))

  const clipBox = (x0: number, y0: number, x1: number, y1: number) => {
    if (!sec) return [x0, y0, x1, y1] as [number, number, number, number]
    if (sec.axis === 'x') {
      const a = sec.keepHigh ? Math.max(x0, sec.c) : x0
      const b = sec.keepHigh ? x1 : Math.min(x1, sec.c)
      return b - a < 0.02 ? null : ([a, y0, b, y1] as [number, number, number, number])
    }
    const a = sec.keepHigh ? Math.max(y0, sec.c) : y0
    const b = sec.keepHigh ? y1 : Math.min(y1, sec.c)
    return b - a < 0.02 ? null : ([x0, a, x1, b] as [number, number, number, number])
  }

  /** Yuzning qaysi qismi kesimdan keyin qoladi, 0..1 parametrda */
  const faceSeg = (ax: number, ay: number, bx: number, by: number): [number, number] | null => {
    if (!sec) return [0, 1]
    const va = sec.axis === 'x' ? ax : ay
    const vb = sec.axis === 'x' ? bx : by
    const ka = keepV(va)
    const kb = keepV(vb)
    if (ka && kb) return [0, 1]
    if (!ka && !kb) return null
    const t = (sec.c - va) / (vb - va || 1)
    return ka ? [0, clamp(t, 0, 1)] : [clamp(t, 0, 1), 1]
  }

  const slabs: SlabView[] = lv.map((info, i) => {
    const lg = m.levels[i]!
    const lifted = info.floor === hovered.value ? hoverLift : 0
    const z0 = zBase(i) + lifted
    const isSel = i === sel
    const cutFloor = isSel && isCut
    const zTop = z0 + (cutFloor ? PLATE_T : lg.h)
    const dominant = info.mix.length
      ? info.mix.reduce((best, mi) => (mi.area > best.area ? mi : best), info.mix[0]!)
      : null

    let base = EMPTY_COLOR
    if (mode === 'occupancy') base = dominant ? dominant.color : EMPTY_COLOR
    else if (mode === 'levels') base = isSel ? '#7FA8F6' : '#B8C6DA'
    else base = isSel ? '#7FA8F6' : '#C3D2E6'
    // Yer osti darajasi neytral kul rangda: bandlik ranglari yer ustida qoladi
    if (lg.under) base = '#BDC8D6'

    const X0 = lg.ox - lg.w / 2
    const X1 = lg.ox + lg.w / 2
    const Y0 = lg.oy - lg.d / 2
    const Y1 = lg.oy + lg.d / 2
    const corners: Array<[number, number]> = [
      [X0, Y0],
      [X1, Y0],
      [X1, Y1],
      [X0, Y1],
    ]
    const clipped = clipBox(X0, Y0, X1, Y1)

    const quad = (
      a: [number, number],
      b: [number, number],
      q0: number,
      q1: number,
      t0: number,
      t1: number,
    ) => {
      const ax = a[0] + (b[0] - a[0]) * t0
      const ay = a[1] + (b[1] - a[1]) * t0
      const bx = a[0] + (b[0] - a[0]) * t1
      const by = a[1] + (b[1] - a[1]) * t1
      return `${pt(ax, ay, q1)} ${pt(bx, by, q1)} ${pt(bx, by, q0)} ${pt(ax, ay, q0)}`
    }

    const segs: Array<[number, number] | null> = [null, null, null, null]
    if (clipped) {
      for (let f = 0; f < 4; f++) {
        const a = corners[f]!
        const b = corners[(f + 1) % 4]!
        segs[f] = faceSeg(a[0], a[1], b[0], b[1])
      }
    }

    const parts: FacePart[] = []
    if (mode !== 'wire' && clipped) {
      for (let f = 0; f < 4; f++) {
        const state = faceState[f]!
        if (!state.visible) continue
        const seg = segs[f]
        if (!seg) continue
        const a = corners[f]!
        const b = corners[(f + 1) % 4]!
        if (mode === 'occupancy' && info.mix.length) {
          let t = 0
          for (const mi of info.mix) {
            const next = Math.min(t + mi.share, 1)
            const a0 = Math.max(t, seg[0])
            const a1 = Math.min(next, seg[1])
            if (a1 > a0 + 0.001) {
              parts.push({
                points: quad(a, b, z0, zTop, a0, a1),
                fill: shade(mi.color, state.amount),
              })
            }
            t = next
          }
        } else {
          parts.push({
            points: quad(a, b, z0, zTop, seg[0], seg[1]),
            fill: shade(base, state.amount),
          })
        }
      }
    }

    // --- fasad naqshi: yuz mahalliy to‘rtburchaklari ekranga tushiriladi
    const skinItems: InteriorItem[] = []
    const facadeAlpha =
      mode === 'wire' || cutFloor || lg.under
        ? 0
        : mode === 'occupancy'
          ? 0.46
          : mode === 'levels'
            ? 1
            : 0.72
    if (facadeAlpha > 0 && clipped) {
      const rects = sk[i]!
      const groups = new Map<string, string[]>()
      for (let f = 0; f < 4; f++) {
        const state = faceState[f]!
        if (!state.visible) continue
        const seg = segs[f]
        if (!seg) continue
        const list = rects[f]
        if (!list) continue
        const a = corners[f]!
        const b = corners[(f + 1) % 4]!
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
        const dx = (b[0] - a[0]) / len
        const dy = (b[1] - a[1]) / len
        for (const rc of list) {
          const t0 = Math.max(rc.u0 / len, seg[0])
          const t1 = Math.min(rc.u1 / len, seg[1])
          if (t1 - t0 < 0.0015) continue
          const ax = a[0] + dx * t0 * len
          const ay = a[1] + dy * t0 * len
          const bx = a[0] + dx * t1 * len
          const by = a[1] + dy * t1 * len
          const q0 = z0 + rc.h0
          const q1 = z0 + rc.h1
          const fill = skinFill(rc.role, state.amount, rc.seed, night)
          const d = `M${px(ax, ay)} ${py(ax, ay, q1)}L${px(bx, by)} ${py(bx, by, q1)}L${px(bx, by)} ${py(bx, by, q0)}L${px(ax, ay)} ${py(ax, ay, q0)}Z`
          const arr = groups.get(fill)
          if (arr) arr.push(d)
          else groups.set(fill, [d])
        }
      }
      for (const [fill, dl] of groups) {
        skinItems.push({ k: 'p', d: dl.join(''), f: fill, o: facadeAlpha })
      }
    }

    // --- kesim yuzasi: shtrixlangan tekislik
    let cut = ''
    if (sec && clipped && mode !== 'wire') {
      if (sec.axis === 'x' && sec.c > X0 + 0.02 && sec.c < X1 - 0.02) {
        cut = [pt(sec.c, Y0, zTop), pt(sec.c, Y1, zTop), pt(sec.c, Y1, z0), pt(sec.c, Y0, z0)].join(
          ' ',
        )
      } else if (sec.axis === 'y' && sec.c > Y0 + 0.02 && sec.c < Y1 - 0.02) {
        cut = [pt(X0, sec.c, zTop), pt(X1, sec.c, zTop), pt(X1, sec.c, z0), pt(X0, sec.c, z0)].join(
          ' ',
        )
      }
    }

    const showInterior = cutFloor && plan.level > 0
    const topRing = clipped
      ? [
          pt(clipped[0], clipped[1], zTop),
          pt(clipped[2], clipped[1], zTop),
          pt(clipped[2], clipped[3], zTop),
          pt(clipped[0], clipped[3], zTop),
        ].join(' ')
      : ''
    const topFill = showInterior
      ? view.layers.core
        ? CORRIDOR
        : '#EEF3FA'
      : mode === 'interior' || mode === 'furnished'
        ? isSel
          ? '#EAF1FE'
          : '#F2F6FC'
        : shade(base, night ? topAmount + 0.26 : Math.max(topAmount + 0.32, 0.14))

    // Tanlangan qavat lentasi: rang yagona belgi bo‘lmasligi uchun kontur ham
    let band = ''
    if (isSel && !cutFloor && mode !== 'wire' && clipped) {
      const bandParts: string[] = []
      for (let f = 0; f < 4; f++) {
        if (!faceState[f]!.visible) continue
        const seg = segs[f]
        if (!seg) continue
        const a = corners[f]!
        const b = corners[(f + 1) % 4]!
        const q = quad(a, b, z0 + lg.h * 0.15, z0 + lg.h * 0.85, seg[0], seg[1])
        bandParts.push(`M${q.replace(/ /g, 'L').replace(/,/g, ' ')}Z`)
      }
      band = bandParts.join('')
    }

    const edges: Array<{ d: string; hidden: boolean }> = []
    if (mode === 'wire') {
      for (let k = 0; k < 4; k++) {
        const c = corners[k]!
        const n = corners[(k + 1) % 4]!
        edges.push({
          d: `M${pt(c[0], c[1], zTop).replace(',', ' ')} L${pt(n[0], n[1], zTop).replace(',', ' ')}`,
          hidden: false,
        })
        edges.push({
          d: `M${pt(c[0], c[1], z0).replace(',', ' ')} L${pt(n[0], n[1], z0).replace(',', ' ')}`,
          hidden: !faceState[k]!.visible,
        })
        edges.push({
          d: `M${pt(c[0], c[1], z0).replace(',', ' ')} L${pt(c[0], c[1], zTop).replace(',', ' ')}`,
          hidden: !faceState[k]!.visible && !faceState[(k + 3) % 4]!.visible,
        })
      }
    }

    const wantUnits = mode === 'interior' || mode === 'wire' ? true : isSel
    const units: UnitShape[] = []
    if (wantUnits && info.units.length && clipped) {
      const zu = zTop + 0.03
      for (const u of info.units) {
        let sx = 0
        let sy = 0
        let skip = false
        const pts = u.polygon
          .map((p) => {
            const nx = typeof p[0] === 'number' ? p[0] : 0
            const ny = typeof p[1] === 'number' ? p[1] : 0
            const wx = lg.ox + lg.w * (nx - 0.5) * pk
            const wy = lg.oy + lg.d * (0.5 - ny) * pk
            if (!keepPt(wx, wy)) skip = true
            sx += px(wx, wy)
            sy += py(wx, wy, zu)
            return pt(wx, wy, zu)
          })
          .join(' ')
        if (skip) continue
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
      const zf = zTop
      const raw: Array<InteriorItem & { near: number }> = []
      const vOf = (x: number, y: number) => x * st + y * ct
      const face = (ax: number, ay: number, bx: number, by: number, q0: number, q1: number) =>
        `M${px(ax, ay)} ${py(ax, ay, q1)}L${px(bx, by)} ${py(bx, by, q1)}L${px(bx, by)} ${py(bx, by, q0)}L${px(ax, ay)} ${py(ax, ay, q0)}Z`

      for (const q of plan.quads) {
        if (!keepPt((q.ax + q.bx) / 2, (q.ay + q.by) / 2)) continue
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
        if (bx.face !== undefined && faceState[bx.face]!.visible) continue
        const cb = clipBox(bx.x0, bx.y0, bx.x1, bx.y1)
        if (!cb) continue
        const q0 = zf + bx.z0
        const q1 = zf + bx.z1
        const c: Array<[number, number]> = [
          [cb[0], cb[1]],
          [cb[2], cb[1]],
          [cb[2], cb[3]],
          [cb[0], cb[3]],
        ]
        const anchorZ = bx.az === undefined ? q1 : zf + bx.az
        const near =
          anchorZ * sp -
          vOf(
            bx.ax === undefined ? (cb[0] + cb[2]) / 2 : bx.ax,
            bx.ay === undefined ? (cb[1] + cb[3]) / 2 : bx.ay,
          ) *
            cp
        const top = `M${pt(c[0]![0], c[0]![1], q1).replace(',', ' ')}L${pt(c[1]![0], c[1]![1], q1).replace(',', ' ')}L${pt(c[2]![0], c[2]![1], q1).replace(',', ' ')}L${pt(c[3]![0], c[3]![1], q1).replace(',', ' ')}Z`

        const flat =
          bx.face === undefined &&
          cb[2] - cb[0] <= 2.6 &&
          cb[3] - cb[1] <= 2.6 &&
          bx.tone !== IT.wallInt &&
          bx.tone !== IT.wallExt &&
          bx.tone !== IT.glass

        if (flat) {
          let d = ''
          for (let f = 0; f < 4; f++) {
            if (!faceState[f]!.visible) continue
            const a = c[f]!
            const n2 = c[(f + 1) % 4]!
            d += face(a[0], a[1], n2[0], n2[1], q0, q1)
          }
          raw.push({ k: 'p', d: d + top, f: shade(bx.tone, flatAmount), o: 1, w: 0, near })
          continue
        }

        // Tashqi devor va lift shaxtasi kesimda ko‘rinadi: faqat xonaga
        // qaragan ichki yuza chiziladi. Shu sababli bitta devorning hamma
        // bandi bir xil bo‘yoq oladi va bitta yo‘lga birlashadi.
        const first = bx.face === undefined ? 0 : (bx.face + 2) % 4
        const last = bx.face === undefined ? 3 : first
        for (let f = first; f <= last; f++) {
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
            near: near - 0.05,
          })
        }
        raw.push({ k: 'p', d: top, f: shade(bx.tone, topFace), o: 1, w: 0, near: near + 0.05 })
      }

      for (const dot of plan.dots) {
        if (!keepPt(dot.x, dot.y)) continue
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

      for (const tx of plan.texts) {
        if (!keepPt(tx.x, tx.y)) continue
        const dz = zf + tx.z
        raw.push({
          k: 't',
          x: px(tx.x, tx.y),
          y: py(tx.x, tx.y, dz),
          f: '#31435C',
          s: tx.text,
          near: 1e6,
        })
      }

      raw.sort((a, b) => a.near - b.near)
      const merged: InteriorItem[] = []
      for (const it of raw) {
        const last = merged[merged.length - 1]
        if (
          it.k === 'p' &&
          last &&
          last.k === 'p' &&
          last.f === it.f &&
          last.o === it.o &&
          last.w === it.w
        ) {
          last.d = (last.d ?? '') + it.d
          continue
        }
        merged.push(
          it.k === 'p'
            ? { k: 'p', d: it.d, f: it.f, o: it.o, w: it.w }
            : it.k === 'c'
              ? { k: 'c', x: it.x, y: it.y, r: it.r, f: it.f }
              : { k: 't', x: it.x, y: it.y, f: it.f, s: it.s },
        )
      }
      interior = merged
    }

    // --- tashqi elementlar: tom, soyabon, balkon, annex
    const extraItems: InteriorItem[] = []
    if (mode !== 'wire' && !lg.under) {
      const list = ex[i]!
      const vOf = (x: number, y: number) => x * st + y * ct
      const raw: Array<{ d: string; f: string; near: number }> = []
      for (const q of list) {
        if (dotC(q.n[0], q.n[1], q.n[2]) <= 0) continue
        let ax = 0
        let ay = 0
        let az = 0
        let out = false
        for (const p of q.p) {
          ax += p[0]
          ay += p[1]
          az += p[2]
          if (!keepPt(p[0], p[1])) out = true
        }
        if (out) continue
        const k = q.p.length || 1
        raw.push({
          d: `M${q.p.map((p) => `${px(p[0], p[1])} ${py(p[0], p[1], z0 + p[2])}`).join('L')}Z`,
          f: shade(EXT_TONE[q.role] ?? '#C4CFDE', lightOf(q.n[0], q.n[1], q.n[2])),
          near: (z0 + az / k) * sp - vOf(ax / k, ay / k) * cp,
        })
      }
      raw.sort((a, b) => a.near - b.near)
      for (const it of raw) {
        const last = extraItems[extraItems.length - 1]
        if (last && last.f === it.f) last.d = (last.d ?? '') + it.d
        else extraItems.push({ k: 'p', d: it.d, f: it.f, o: 1 })
      }
    }

    let anchorX = -Infinity
    let anchorY = 0
    for (const c of corners) {
      const cxp = px(c[0], c[1])
      if (cxp > anchorX) {
        anchorX = cxp
        anchorY = py(c[0], c[1], zTop)
      }
    }

    return {
      floor: info.floor,
      name: info.name,
      short: info.short,
      underground: info.underground,
      selected: isSel,
      dim: isSel ? 1 : isCut && sel >= 0 && i > sel ? 0.2 : 1,
      parts,
      skin: skinItems,
      cut,
      topPoints: topRing,
      topFill,
      band,
      edges,
      units,
      interior,
      extras: extraItems,
      anchorX,
      anchorY,
      showLabel: mode === 'levels' || isSel || info.floor === hovered.value,
      aria: `${info.name}, ${info.total} unit, bandlik ${info.occupancy} foiz, ${info.label}`,
    }
  })

  // --- yer sathi: to‘r va quyosh yo‘nalishidagi soya
  const gw = geo.w * 1.5
  const gd = geo.d * 1.5
  const grid: string[] = []
  const divisions = 6
  for (let i = 0; i <= divisions; i++) {
    const x = -gw + (i * 2 * gw) / divisions
    grid.push(`M${px(x, -gd)} ${py(x, -gd, 0)} L${px(x, gd)} ${py(x, gd, 0)}`)
    const y = -gd + (i * 2 * gd) / divisions
    grid.push(`M${px(-gw, y)} ${py(-gw, y, 0)} L${px(gw, y)} ${py(gw, y, 0)}`)
  }

  const plane = [pt(-gw, -gd, 0), pt(gw, -gd, 0), pt(gw, gd, 0), pt(-gw, gd, 0)].join(' ')

  // Soya: kontur nuqtalari quyosh yo‘nalishi bo‘yicha siljiydi, ikki
  // to‘plamning qavariq qobig‘i olinadi
  const shadow = (() => {
    const hw = geo.w / 2
    const hd = geo.d / 2
    const base: Array<[number, number]> = [
      [-hw, -hd],
      [hw, -hd],
      [hw, hd],
      [-hw, hd],
    ]
    const k = clamp(1 / Math.max(S.z, 0.16), 0, 4.2)
    let offX = -S.x * m.topZ * k
    let offY = -S.y * m.topZ * k
    const cap = Math.max(geo.w, geo.d) * 2
    const l = Math.hypot(offX, offY) || 1
    if (l > cap) {
      offX = (offX / l) * cap
      offY = (offY / l) * cap
    }
    const pts: Array<[number, number]> = base.concat(
      base.map((p) => [p[0] + offX, p[1] + offY] as [number, number]),
    )
    pts.sort((a, b) => a[0] - b[0] || a[1] - b[1])
    const cross = (o: [number, number], a: [number, number], b: [number, number]) =>
      (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    const lower: Array<[number, number]> = []
    for (const p of pts) {
      while (
        lower.length >= 2 &&
        cross(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0
      ) {
        lower.pop()
      }
      lower.push(p)
    }
    const upper: Array<[number, number]> = []
    for (let i = pts.length - 1; i >= 0; i--) {
      const p = pts[i]!
      while (
        upper.length >= 2 &&
        cross(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0
      ) {
        upper.pop()
      }
      upper.push(p)
    }
    lower.pop()
    upper.pop()
    return lower
      .concat(upper)
      .map((p) => pt(p[0], p[1], 0))
      .join(' ')
  })()

  const groundMark = {
    x: clamp(px(-gw, gd), 14, VW - 90),
    y: clamp(py(-gw, gd, 0), 20, VH - 14),
  }

  // O‘lchash tekisligi: tanlangan qavat ustki sathi
  const selGeo = sel >= 0 ? m.levels[sel] : null
  const planeZ = selGeo ? zBase(sel) + (isCut ? PLATE_T : selGeo.h) : 0

  return {
    slabs,
    grid,
    plane,
    shadow,
    groundMark,
    cam: { cx, cy, s, ct, st, sp, cp, planeZ },
    px,
    py,
  }
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

/* ==========================================================================
   O‘lchash asbobi: ekran nuqtasi tanlangan qavat sathidagi gorizontal
   tekislikka teskari proyeksiya qilinadi, natija metrda chiqadi.
   ========================================================================== */

function toWorld(sx: number, sy: number) {
  const c = scene.value.cam
  if (!c.s || !c.sp) return null
  const u = (sx - c.cx) / c.s
  const v = ((c.cy - sy) / c.s - c.planeZ * c.cp) / c.sp
  return { x: u * c.ct + v * c.st, y: -u * c.st + v * c.ct }
}

function svgPoint(event: PointerEvent | MouseEvent) {
  const el = svgRef.value
  if (!el) return null
  const r = el.getBoundingClientRect()
  const k = Math.min(r.width / VW, r.height / VH)
  if (!k) return null
  return {
    x: (event.clientX - r.left - (r.width - VW * k) / 2) / k,
    y: (event.clientY - r.top - (r.height - VH * k) / 2) / k,
  }
}

const measureView = computed(() => {
  const a = mA.value
  if (!a) return null
  const sc = scene.value
  const z = sc.cam.planeZ
  const ax = sc.px(a.x, a.y)
  const ay = sc.py(a.x, a.y, z)
  const b = mB.value ?? mHover.value
  if (!b) return { ax, ay, bx: ax, by: ay, dist: 0, done: false, lx: ax, ly: ay - 20 }
  const bx = sc.px(b.x, b.y)
  const by = sc.py(b.x, b.y, z)
  return {
    ax,
    ay,
    bx,
    by,
    dist: Math.hypot(b.x - a.x, b.y - a.y),
    done: !!mB.value,
    lx: clamp((ax + bx) / 2, 48, VW - 48),
    ly: clamp((ay + by) / 2 - 14, 24, VH - 24),
  }
})

const measureNote = computed(() => {
  if (view.tool !== 'measure') {
    return 'Asbobni yoqing, so‘ng ko‘rinishda ikki nuqtani bosing. Natija metrda chiqadi.'
  }
  if (!mA.value) return 'Birinchi nuqtani bosing. O‘lchov tanlangan qavat sathida bajariladi.'
  if (!mB.value) return 'Ikkinchi nuqtani bosing. Esc tugmasi o‘lchovni tozalaydi.'
  return `Masofa: ${r1(measureView.value?.dist ?? 0)} m. Yangi o‘lchov uchun yana bosing.`
})

function clearMeasure() {
  mA.value = null
  mB.value = null
  mHover.value = null
}

const legend = computed(() => {
  const totals = new Map<string, number>()
  for (const u of allUnits.value) {
    const key = CATEGORY_OF[u.status] ?? 'other'
    totals.set(key, (totals.get(key) ?? 0) + 1)
  }
  return CATEGORIES.map((c) => ({ ...c, count: totals.get(c.key) ?? 0 }))
})

const modeHint = computed(() => MODES.find((m) => m.value === props.mode)?.hint ?? '')

/** Bino turi va klassidan kelib chiqqan tashqi ko‘rinish izohi */
const envelopeNote = computed(() => {
  const b = props.building
  const shape =
    family.value === 'tower'
      ? 'ingichka minora, kirish soyaboni va tomdagi toj'
      : family.value === 'retail'
        ? 'keng past hajm, baland shisha atrium va parapet'
        : family.value === 'shed'
          ? 'uzun past korpus, yuk eshiklari va ofis annexi'
          : 'pog‘onali turar joy bloki, balkonlar va terrasa'
  const fac = glazed.value ? 'to‘liq shisha fasad' : 'panjarali deraza va spandrel'
  return `${b.type}: ${shape}. ${b.buildingClass}: ${fac}, ${b.floors} qator deraza.`
})

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
    if (value === 'interior' && view.explode < 0.4) view.explode = 0.4
  },
)

watch([() => props.floor, () => props.mode], () => {
  hoveredUnit.value = ''
  clearMeasure()
})

function pickFloor(floor: number) {
  if (blockClick || view.tool === 'measure') return
  emit('update:floor', floor)
}

function pickUnit(floor: number, id: string) {
  if (blockClick || view.tool === 'measure') return
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
  dragRot = view.rotation
  dragTilt = view.tilt
  target.setPointerCapture(event.pointerId)
}

function onMove(event: PointerEvent) {
  if (!dragging.value) {
    if (view.tool === 'measure' && mA.value && !mB.value) {
      const p = svgPoint(event)
      mHover.value = p ? toWorld(p.x, p.y) : null
    }
    return
  }
  const dx = event.clientX - dragX
  const dy = event.clientY - dragY
  dragDist = Math.max(dragDist, Math.abs(dx) + Math.abs(dy))
  if (dragDist > 4) blockClick = true
  view.rotation = Math.round(wrap360(dragRot + dx * 0.42))
  view.tilt = Math.round(clamp(dragTilt - dy * 0.24, 6, 82))
}

function onUp(event: PointerEvent) {
  if (!dragging.value) return
  dragging.value = false
  const target = event.currentTarget as SVGSVGElement
  if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId)
}

function onViewClick(event: MouseEvent) {
  if (view.tool !== 'measure' || blockClick) return
  const p = svgPoint(event)
  if (!p) return
  const w = toWorld(p.x, p.y)
  if (!w) return
  if (mA.value && mB.value) {
    mB.value = null
    mA.value = w
    mHover.value = null
    return
  }
  if (!mA.value) {
    mA.value = w
    mHover.value = w
    return
  }
  mB.value = w
  mHover.value = null
}

function onEscape() {
  if (mA.value || mB.value) clearMeasure()
  else if (view.tool === 'measure') view.tool = 'none'
}

function spin(delta: number) {
  view.rotation = wrap360(view.rotation + delta)
}

function zoomBy(delta: number) {
  view.zoom = Math.round(clamp(view.zoom + delta, 0.6, 2.2) * 100) / 100
}

function resetView() {
  view.rotation = 32
  view.tilt = 34
  view.zoom = 1
  view.explode = props.mode === 'interior' ? 0.4 : 0
  view.sectionAxis = 'off'
  view.sectionCut = 0.5
  clearMeasure()
}

function patchView(patch: Partial<ViewState>) {
  Object.assign(view, patch)
  if (patch.tool === 'none') clearMeasure()
}
</script>

<template>
  <div class="min-w-0" @keydown.esc="onEscape">
    <div
      class="relative overflow-hidden rounded-panel ring-1 ring-inset transition-colors"
      :class="
        view.night
          ? 'bg-gradient-to-b from-ink-900 via-ink-900 to-ink-800 ring-ink-700'
          : 'bg-gradient-to-b from-white via-brand-50/45 to-ink-100/70 ring-ink-200/70'
      "
    >
      <div class="relative">
        <svg
          ref="svgRef"
          :viewBox="`0 0 ${VW} ${VH}`"
          preserveAspectRatio="xMidYMid meet"
          class="w-full touch-pan-y select-none"
          :class="[
            heightClass,
            view.tool === 'measure'
              ? 'cursor-crosshair'
              : dragging
                ? 'cursor-grabbing'
                : 'cursor-grab',
          ]"
          role="group"
          :aria-label="`${building.name} aksonometrik ko‘rinishi. Burilish ${Math.round(view.rotation)} daraja, nishab ${Math.round(view.tilt)} daraja.`"
          @pointerdown="onDown"
          @pointermove="onMove"
          @pointerup="onUp"
          @pointercancel="onUp"
          @click="onViewClick"
          @pointerleave="(hovered = null), (hoveredUnit = '')"
        >
          <defs>
            <filter :id="`mkn-shadow-${building.id}`" x="-60%" y="-80%" width="240%" height="280%">
              <feGaussianBlur stdDeviation="9" />
            </filter>
            <pattern
              :id="`mkn-cut-${building.id}`"
              width="9"
              height="9"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <rect width="9" height="9" fill="#E1E9F4" />
              <rect width="3" height="9" fill="#93A6C0" />
            </pattern>
          </defs>

          <!-- Yer sathi: to‘r va quyosh yo‘nalishidagi soya -->
          <polygon
            :points="scene.plane"
            :fill="view.night ? '#0B1220' : '#0256F7'"
            :fill-opacity="view.night ? 0.55 : 0.035"
          />
          <path
            v-for="(g, gi) in scene.grid"
            :key="`g${gi}`"
            :d="g"
            :stroke="view.night ? '#5A6E8C' : '#94A2B8'"
            :stroke-opacity="view.night ? 0.2 : 0.28"
            stroke-width="0.8"
            fill="none"
          />
          <polygon
            :points="scene.shadow"
            :fill="view.night ? '#02060E' : '#131C2B'"
            :fill-opacity="view.night ? 0.3 : 0.17"
            :filter="`url(#mkn-shadow-${building.id})`"
          />

          <template v-if="building.undergroundFloors">
            <text
              :x="scene.groundMark.x"
              :y="scene.groundMark.y + 16"
              font-size="12"
              font-weight="600"
              :fill="view.night ? '#9FB0C8' : '#64748B'"
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
                :stroke="slab.selected ? '#0256F7' : view.night ? '#8FA2BC' : '#48566B'"
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
                :stroke="view.night ? '#26364C' : '#FFFFFF'"
                stroke-width="0.6"
                stroke-opacity="0.42"
              />

              <!-- Fasad: deraza qatorlari, mullion va spandrel -->
              <path
                v-for="(sk2, si) in slab.skin"
                :key="`s${si}`"
                :d="sk2.d"
                :fill="sk2.f"
                :fill-opacity="sk2.o"
                class="pointer-events-none"
              />

              <!-- Tanlangan qavat lentasi -->
              <path
                v-if="slab.band"
                :d="slab.band"
                fill="#0256F7"
                fill-opacity="0.32"
                stroke="#0139B0"
                stroke-width="1.4"
                class="pointer-events-none"
              />

              <polygon
                v-if="slab.cut"
                :points="slab.cut"
                :fill="`url(#mkn-cut-${building.id})`"
                stroke="#5C7492"
                stroke-width="1.2"
              />

              <polygon
                v-if="slab.topPoints"
                :points="slab.topPoints"
                :fill="slab.topFill"
                :stroke="slab.selected ? '#0256F7' : view.night ? '#4A5E7A' : '#94A2B8'"
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
                  mode === 'wire'
                    ? 0.08
                    : u.active
                      ? 0.92
                      : hoveredUnit === u.id
                        ? 0.86
                        : slab.interior
                          ? 0.4
                          : 0.72
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

            <!-- Devor, eshik, deraza, yadro, jihoz va xodimlar: chuqurlik
                 bo‘yicha saralangan va bo‘yoq bo‘yicha birlashtirilgan qismlar -->
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
                <circle v-else-if="it.k === 'c'" :cx="it.x" :cy="it.y" :r="it.r" :fill="it.f" />
                <text
                  v-else
                  :x="it.x"
                  :y="it.y"
                  text-anchor="middle"
                  font-size="11"
                  font-weight="700"
                  :fill="it.f"
                  stroke="#FFFFFF"
                  stroke-width="3"
                  paint-order="stroke"
                >
                  {{ it.s }}
                </text>
              </template>
            </g>

            <!-- Tom, parapet, soyabon, balkon va annex -->
            <g v-if="slab.extras.length" class="pointer-events-none">
              <path
                v-for="(it, xi) in slab.extras"
                :key="`x${xi}`"
                :d="it.d"
                :fill="it.f"
                stroke="#FFFFFF"
                stroke-width="0.5"
                stroke-opacity="0.35"
              />
            </g>

            <!-- Fokus halqasi: klaviatura bilan yurganda ko‘rinadi -->
            <polygon
              v-if="focused === slab.floor && slab.topPoints"
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

          <!-- O‘lchash: ikki nuqta orasidagi masofa, o‘lchov chizig‘i bilan -->
          <g v-if="measureView" class="pointer-events-none">
            <path
              :d="`M${measureView.ax} ${measureView.ay}L${measureView.bx} ${measureView.by}`"
              stroke="#0256F7"
              stroke-width="2"
              :stroke-dasharray="measureView.done ? undefined : '6 4'"
              fill="none"
            />
            <circle
              :cx="measureView.ax"
              :cy="measureView.ay"
              r="4.5"
              fill="#0256F7"
              stroke="#FFFFFF"
              stroke-width="1.6"
            />
            <circle
              v-if="measureView.done"
              :cx="measureView.bx"
              :cy="measureView.by"
              r="4.5"
              fill="#0256F7"
              stroke="#FFFFFF"
              stroke-width="1.6"
            />
            <g v-if="measureView.dist > 0.05">
              <rect
                :x="measureView.lx - 42"
                :y="measureView.ly - 14"
                width="84"
                height="26"
                rx="13"
                fill="#131C2B"
                fill-opacity="0.94"
              />
              <text
                :x="measureView.lx"
                :y="measureView.ly + 4"
                text-anchor="middle"
                font-size="12.5"
                font-weight="700"
                fill="#FFFFFF"
              >
                {{ r1(measureView.dist) }} m
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
            <text
              :x="tooltip.x + 14"
              :y="tooltip.y + 24"
              font-size="13"
              font-weight="700"
              fill="#FFFFFF"
            >
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
          class="scroll-slim absolute left-2 top-1/2 flex max-h-[86%] w-11 -translate-y-1/2 flex-col gap-1 overflow-y-auto rounded-field bg-surface/92 p-1 shadow-card ring-1 ring-ink-200/70 backdrop-blur 2xl:hidden"
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
          class="absolute bottom-2 right-2 flex flex-row gap-1 rounded-field bg-surface/92 p-1.5 shadow-card ring-1 ring-ink-200/70 backdrop-blur 2xl:bottom-auto 2xl:left-3 2xl:right-auto 2xl:top-3 2xl:flex-col"
        >
          <button
            type="button"
            class="grid size-10 place-items-center rounded-[8px] text-ink-600 transition-colors hover:bg-brand-50 hover:text-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            aria-label="Chapga burish"
            @click.stop="spin(-15)"
          >
            <UiIcon name="refresh" :size="18" />
          </button>
          <button
            type="button"
            class="grid size-10 place-items-center rounded-[8px] text-ink-600 transition-colors hover:bg-brand-50 hover:text-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            aria-label="O‘ngga burish"
            @click.stop="spin(15)"
          >
            <UiIcon name="refresh" :size="18" class="-scale-x-100" />
          </button>
          <span class="my-auto h-6 w-px shrink-0 bg-ink-200 2xl:mx-1 2xl:my-0 2xl:h-px 2xl:w-auto" />
          <button
            type="button"
            class="grid size-10 place-items-center rounded-[8px] text-ink-600 transition-colors hover:bg-brand-50 hover:text-brand-600 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            aria-label="Yaqinlashtirish"
            :disabled="view.zoom >= 2.2"
            @click.stop="zoomBy(0.2)"
          >
            <UiIcon name="plus" :size="18" />
          </button>
          <button
            type="button"
            class="grid size-10 place-items-center rounded-[8px] text-ink-600 transition-colors hover:bg-brand-50 hover:text-brand-600 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            aria-label="Uzoqlashtirish"
            :disabled="view.zoom <= 0.6"
            @click.stop="zoomBy(-0.2)"
          >
            <UiIcon name="minus" :size="18" />
          </button>
          <span class="my-auto h-6 w-px shrink-0 bg-ink-200 2xl:mx-1 2xl:my-0 2xl:h-px 2xl:w-auto" />
          <button
            type="button"
            class="grid size-10 place-items-center rounded-[8px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            :class="
              view.tool === 'measure'
                ? 'bg-brand-500 text-white'
                : 'text-ink-600 hover:bg-brand-50 hover:text-brand-600'
            "
            aria-label="O‘lchash asbobi"
            :aria-pressed="view.tool === 'measure'"
            @click.stop="patchView({ tool: view.tool === 'measure' ? 'none' : 'measure' })"
          >
            <UiIcon name="size" :size="18" />
          </button>
          <button
            type="button"
            class="grid size-10 place-items-center rounded-[8px] text-ink-600 transition-colors hover:bg-brand-50 hover:text-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            aria-label="Ko‘rinishni tiklash"
            @click.stop="resetView"
          >
            <UiIcon name="target" :size="18" />
          </button>
          <span class="my-auto h-6 w-px shrink-0 bg-ink-200 2xl:mx-1 2xl:my-0 2xl:h-px 2xl:w-auto" />

          <!-- Kompas: shimol yo‘nalishi burilish burchagi bilan birga aylanadi -->
          <span
            class="hidden size-10 place-items-center 2xl:grid"
            role="img"
            :aria-label="`Shimol yo‘nalishi ${Math.round(view.rotation)} daraja burilgan`"
          >
            <svg viewBox="-16 -16 32 32" class="size-8" aria-hidden="true">
              <circle r="14.5" fill="#F8FAFD" stroke="#E2E8F2" stroke-width="1" />
              <g :transform="`rotate(${-view.rotation})`">
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
            @click.stop="emit('update:mode', m.value)"
          >
            {{ m.label }}
          </button>
        </div>
      </div>

      <UiBuilding3DControls
        v-if="controls"
        :state="view"
        :measure-note="measureNote"
        :measure-active="view.tool === 'measure'"
        @patch="patchView"
        @clear-measure="clearMeasure"
        @reset="resetView"
      />
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

    <p v-if="controls" class="mt-2.5 text-[12px] leading-relaxed text-ink-500">
      {{ envelopeNote }}
    </p>
    <p v-if="controls" class="mt-1 text-[12px] leading-relaxed text-ink-500">
      {{ modeHint }} · Ko‘rinishni tortib aylantiring, plitani bosib qavat tanlang.
      <span v-if="selectedLevel"> Tanlangan: {{ selectedLevel.name }}.</span>
    </p>
  </div>
</template>
