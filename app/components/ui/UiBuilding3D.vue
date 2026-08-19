<script setup lang="ts">
import { UNIT_STATUS, UNIT_STATUS_COLOR } from '~/constants/statuses'
import type { Building } from '~/data/buildings'
import { unitsOfBuilding, type Unit } from '~/data/units'
import { area as areaLabel } from '~/utils/format'
import { buildFloorPlan, type FloorPlan, type PlanRect } from '~/utils/floorPlan'

/**
 * Bino aksonometrik navigatori.
 *
 * Geometriya manbai bitta: `buildFloorPlan()`. Har bir daraja uchun o‘sha
 * generator chaqiriladi va 2D qavat rejasi bilan bir xil natija qaytadi:
 * tashqi devor, ichki bo‘linmalar, koridor, xizmat yadrosi, eshiklar va
 * deraza yo‘laklari. Interyer qatlami shu rejadan ko‘tariladi, unit
 * konturlari ham shu rejadan olinadi, shuning uchun 3D dagi qavat 2D
 * chizmadagi qavatning aynan o‘zi bo‘ladi.
 *
 * Bino tashqi hajmi ham shu manbadan chiqadi: tayanch kontur o‘lchami tipik
 * qavat rejasining metrdagi eni va bo‘yiga teng. Reja turi bino turidan
 * olingani uchun ombor uzun va past, savdo markaz keng, ofis va biznes
 * markaz ixcham chiqadi.
 *
 * Proyeksiya: model z o‘qi atrofida `rotation` ga buriladi, so‘ng `tilt`
 * balandlik burchagi bilan ekranga tushiriladi.
 *   u = x·cosθ − y·sinθ
 *   v = x·sinθ + y·cosθ
 *   ekranX = cx + u·s
 *   ekranY = cy − (v·sinφ + z·cosφ)·s
 * Kameraga qaragan yo‘nalish C = (−sinθ·cosφ, −cosθ·cosφ, sinφ). Yuz
 * ko‘rinadimi degan savol normal bilan C ning skalyar ko‘paytmasi orqali
 * hal qilinadi.
 *
 * Ish unumdorligi: kameradan bog‘liq bo‘lmagan hamma narsa (rejalar, hajm,
 * fasad naqshi, tashqi elementlar, interyer tartibi) alohida memoizatsiya
 * qilingan `computed` larda turadi. Kamera burilganda faqat proyeksiya
 * ishlaydi, ekrandan chiqib ketgan daraja esa umuman qurilmaydi.
 */

type ViewMode = 'occupancy' | 'interior' | 'wire'
type Family = 'tower' | 'retail' | 'shed' | 'resi'

interface Layers {
  walls: boolean
  windows: boolean
  core: boolean
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

/** Bitta bo‘yoq bilan chiziladigan birlashtirilgan yo‘l */
interface Paint {
  d: string
  f: string
  o: number
}

interface FacePart {
  points: string
  fill: string
  /** Fotosurat ustida turganda bandlik rangi shaffof bo‘yoq bo‘lib qoladi */
  alpha: number
}

/**
 * Fotosurat yopishtiriladigan tashqi yuz. Bitta yuzga bitta surat tushadi,
 * qavatlar bo‘yicha takrorlanmaydi.
 */
interface PhotoFace {
  f: number
  /** Yuz silueti: yer ustidagi darajalar konturlarining birlashmasi */
  d: string
  /** Suratni yuz parallelogrammiga o‘tkazadigan affin matritsa */
  m: string
  x: number
  y: number
  w: number
  h: number
  /** Yuz yorug‘ligiga mos qorayish qatlamining shaffofligi */
  dark: number
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

interface SlabView {
  floor: number
  name: string
  short: string
  underground: boolean
  selected: boolean
  opacity: number
  parts: FacePart[]
  skin: Paint[]
  topPoints: string
  topFill: string
  band: string
  edges: Array<{ d: string; hidden: boolean }>
  units: UnitShape[]
  patches: Paint[]
  interior: Paint[]
  labels: Array<{ x: number; y: number; text: string }>
  extras: Paint[]
  anchorX: number
  anchorY: number
  /** Qavat nishonchasi: kadr ichida qolishi uchun chegaraga bosiladi */
  labelX: number
  labelY: number
  labelW: number
  aria: string
}

const props = withDefaults(
  defineProps<{
    building: Building
    /** Tanlangan qavat raqami, yer osti darajalari manfiy */
    floor?: number
    /** Tanlangan unit identifikatori */
    unit?: string
    mode?: ViewMode
    /** Boshqaruv elementlari va izoh qatorini ko‘rsatish */
    controls?: boolean
    heightClass?: string
  }>(),
  {
    floor: 1,
    unit: '',
    mode: 'occupancy',
    controls: true,
    heightClass: 'h-[360px] sm:h-[460px] lg:h-[540px] xl:h-[600px]',
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
  {
    value: 'occupancy',
    label: 'Bino',
    hint: 'Fasad yuzasi qavatdagi holatlar ulushiga bo‘linadi. Qavat tanlansa, u to‘q rangda qoladi.',
  },
  {
    value: 'interior',
    label: 'Interyer',
    hint: 'Tanlangan qavat ochiladi va uning rejasi ko‘tariladi: devor, eshik, deraza, koridor va xizmat yadrosi.',
  },
  {
    value: 'wire',
    label: 'Karkas',
    hint: 'Faqat qirralar. Butun stikning tuzilishi bir qarashda ko‘rinadi.',
  },
]

const LAYERS: Array<{ key: keyof Layers; label: string }> = [
  { key: 'walls', label: 'Devor va eshik' },
  { key: 'windows', label: 'Derazalar' },
  { key: 'core', label: 'Koridor va yadro' },
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
  HIDDEN: 'other',
}

const EMPTY_COLOR = '#AFC0D6'
/** Konstruktiv plita qalinligi, m */
const PLATE_T = 0.34

/** Qavat balandligi, m: bino turiga qarab */
const FLOOR_HEIGHT: Record<string, number> = {
  'Biznes markaz': 3.9,
  'Ofis binosi': 3.7,
  'Savdo markaz': 5.2,
  'Ombor / logistika': 6.4,
  'Turar joy': 3.2,
}

const FAMILY_OF: Record<string, Family> = {
  'Biznes markaz': 'tower',
  'Ofis binosi': 'tower',
  'Savdo markaz': 'retail',
  'Ombor / logistika': 'shed',
  'Turar joy': 'resi',
}

/** Interyer bo‘yoqlari: 2D rejadagi qatlamlar bilan bir xil ma’noda */
const IT = {
  wallExt: '#B4C2D6',
  wallInt: '#C7D3E3',
  glass: '#8CB9E2',
  leaf: '#8AA2C6',
  corridor: '#E6EDF7',
  lift: '#9BA9BF',
  stair: '#B5C3D5',
  wc: '#A3C8D8',
  shaft: '#A9B5C7',
  base: '#F0F4FB',
}

const CORE_TONE: Record<string, string> = {
  lift: IT.lift,
  stair: IT.stair,
  wc: IT.wc,
  shaft: IT.shaft,
}

const EXT_TONE: Record<string, string> = {
  roof: '#C4CFDE',
  parapet: '#CBD6E3',
  plant: '#9DACC0',
  canopy: '#8496AC',
  column: '#A6B4C6',
  rail: '#B6C5D8',
  balcony: '#CFD9E6',
  annex: '#C7D2E0',
  glass: '#8FB6DC',
  apron: '#A8B4C4',
}

/**
 * Fotosuratning fasad oynasi: surat kengligi va balandligining ulushida.
 *
 * Reyestrdagi suratlarda bino kadr o‘rtasida turadi, tepasida osmon, pastida
 * yo‘l yoki maydoncha bo‘ladi. Devorga butun kadr emas, faqat shu oyna
 * tushiriladi, aks holda fasadning ustida osmon, ostida asfalt paydo bo‘lardi.
 * Chegaralar bino oilasi bo‘yicha tanlangan: minorada bino baland va tor,
 * omborda esa uzun past tasma bo‘lib kadrning o‘rta qismini egallaydi.
 */
const PHOTO_CROP: Record<Family, { u0: number; u1: number; v0: number; v1: number }> = {
  tower: { u0: 0.22, u1: 0.8, v0: 0.22, v1: 0.7 },
  retail: { u0: 0.3, u1: 0.88, v0: 0.18, v1: 0.64 },
  shed: { u0: 0.16, u1: 0.84, v0: 0.32, v1: 0.62 },
  resi: { u0: 0.4, u1: 0.92, v0: 0.18, v1: 0.68 },
}

/** Surat chiziladigan mahalliy kadr tomoni: matritsa shu kadrni yuzga qo‘yadi */
const PHOTO_BOX = 100

/** Yorug‘lik yo‘nalishi qat’iy: har bir binoda soya bir xil o‘qiladi */
const SUN = (() => {
  const az = (-36 * Math.PI) / 180
  const el = (49 * Math.PI) / 180
  const ce = Math.cos(el)
  return { x: Math.sin(az) * ce, y: -Math.cos(az) * ce, z: Math.sin(el) }
})()

const START_ROTATION = 34
const START_TILT = 30

const view = reactive({
  rotation: START_ROTATION,
  tilt: START_TILT,
  zoom: 1,
  exploded: false,
  layers: { walls: true, windows: true, core: true } as Layers,
})

const hovered = ref<number | null>(null)
const hoveredUnit = ref('')
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

/** amount > 0: oqartiradi, amount < 0: qoraytiradi (yuz soyalari uchun) */
function shade(hex: string, amount: number) {
  const n = Number.parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  const k = Math.abs(amount)
  const t = amount >= 0 ? 255 : 12
  const mix = (c: number) => Math.round(c + (t - c) * k)
  return `rgb(${mix(r)},${mix(g)},${mix(b)})`
}

function median(list: number[]) {
  if (!list.length) return 0
  const sorted = [...list].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)] ?? 0
}

const allUnits = computed(() => unitsOfBuilding(props.building.id))
const family = computed<Family>(() => FAMILY_OF[props.building.type] ?? 'tower')
/** A klass: to‘liq shisha fasad. B va C: panjarali deraza va spandrel */
const glazed = computed(() => /^\s*a/i.test(props.building.buildingClass))

/**
 * Binoning haqiqiy surati. Reyestrdagi nom bo‘sh bo‘lsa yoki fayl yuklanmasa
 * `photoOk` o‘chadi va tashqi ko‘rinish avvalgi bo‘yoq bilan chiziladi.
 */
const photoSrc = computed(() =>
  props.building.photo ? assetUrl(`img/${props.building.photo}-md.webp`) : '',
)
const photoOk = ref(true)

// Bino almashsa yangi suratga qaytadan urinamiz, aks holda bir marta xato
// bergan komponent boshqa hech qachon surat ko‘rsatmaydi
watch(
  () => props.building.photo,
  () => {
    photoOk.value = true
  },
)

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

    let label = 'Reja kiritilmagan'
    if (units.length) {
      if (!vacant.length) label = 'To‘liq band'
      else if (vacant.length === units.length) label = 'Butunlay bo‘sh'
      else label = 'Qisman bo‘sh'
    }

    return {
      floor,
      index,
      // Yer osti darajasi manfiy raqamda turadi, nomi esa tizimning qolgan
      // qismidagi kabi yoziladi: -1 → «1-yer osti qavati»
      name: floor < 0 ? `${-floor}-yer osti qavati` : `${floor}-qavat`,
      short: String(floor),
      underground: floor < 0,
      units,
      total: units.length,
      totalArea,
      vacantCount: vacant.length,
      vacantArea,
      occupancy: totalArea ? Math.round(((totalArea - vacantArea) / totalArea) * 100) : 0,
      mix,
      label,
    }
  })
})

/**
 * Har bir darajaning rejasi. Chaqiruv 2D qavat sahifasidagi bilan bir xil:
 * `underground` bayrog‘i berilmaydi, chunki reyestrda 0-qavat yo‘q va reja
 * turi doim bino turidan olinadi. Shu sababli bu yerdagi reja bilan
 * `/objects/{id}/floors/{n}` sahifasidagi reja bitta geometriya bo‘ladi.
 */
const plans = computed(() => {
  const b = props.building
  const map = new Map<number, FloorPlan>()
  for (const l of levels.value) {
    map.set(
      l.floor,
      buildFloorPlan({
        units: l.units.map((u) => ({ id: u.id, code: u.code, area: u.area })),
        buildingType: b.type,
        floor: l.floor,
      }),
    )
  }
  return map
})

/**
 * Tayanch kontur: tipik qavat rejasining metrdagi o‘lchami. Reja bo‘yi bino
 * turiga bog‘liq doimiy qiymat (masalan ofisda ikki tomonlama koridor
 * chuqurligi), eni esa qavat maydonidan chiqadi. Shuning uchun mediana butun
 * stik uchun to‘g‘ri o‘lchamni beradi.
 */
const envelope = computed(() => {
  const above = levels.value.filter((l) => !l.underground)
  const source = above.length ? above : levels.value
  const list = source
    .map((l) => plans.value.get(l.floor))
    .filter((p): p is FloorPlan => p !== undefined)
  return {
    w: median(list.map((p) => p.width)) || 30,
    d: median(list.map((p) => p.height)) || 18,
    h: FLOOR_HEIGHT[props.building.type] ?? 3.8,
  }
})

/* ==========================================================================
   Hajm: har bir darajaning tayanch konturi, balandligi va bazasi. Bino turi
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
  const geo = envelope.value
  const fam = family.value
  const lv = levels.value
  const ug = b.undergroundFloors
  const groundK = fam === 'shed' ? 1.04 : 1.36
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
    const ox = 0
    let oy = 0

    if (under) {
      // Yer osti darajasi tayanch konturdan kengroq: parkovka plitasi
      w = geo.w * 1.06
      d = geo.d * 1.06
    } else {
      const j = i - ug
      if (fam === 'resi' && j >= stepFrom) {
        const t = clamp((j - stepFrom + 1) / Math.max(above - stepFrom, 1), 0, 1)
        d = geo.d * (1 - 0.22 * t)
        oy = (d - geo.d) / 2
        w = geo.w * (1 - 0.07 * t)
      } else if (fam === 'tower' && top && above > 3) {
        w = geo.w * 0.94
        d = geo.d * 0.94
      } else if (fam === 'retail' && top && above > 2) {
        w = geo.w * 0.96
        d = geo.d * 0.96
      }
    }

    out.push({ floor: info.floor, i, z0: z, h, w, d, ox, oy, ground, under, top })
    z += h
  }

  const last = out[out.length - 1]
  const topZ = last ? last.z0 + last.h : geo.h
  return { levels: out, topZ, family: fam }
})

const selectedIndex = computed(() => levels.value.findIndex((l) => l.floor === props.floor))
const selectedLevel = computed(() => levels.value[selectedIndex.value])
const hoveredLevel = computed(() => levels.value.find((l) => l.floor === hovered.value))

/** Tanlangan qavat kesib ochiladimi */
const cutaway = computed(() => props.mode === 'interior' && selectedIndex.value >= 0)

/* ==========================================================================
   Reja koordinatasidan dunyo koordinatasiga o‘tkazish. Reja metrda, chap
   yuqori burchagi (0, 0). Dunyoda reja yuqori chekkasi kameradan uzoq
   tomonda turadi, shu sababli 3D dagi tartib 2D chizmadagi tartib bilan bir
   xil o‘qiladi.
   ========================================================================== */

interface WorldBox {
  x0: number
  y0: number
  x1: number
  y1: number
  z0: number
  z1: number
  tone: string
  /**
   * Tashqi qobiq yuzi. Kameraga qaragan bo‘lsa devor butunlay olib tashlanadi
   * (kesim), aks holda faqat xonaga qaragan ichki yuza chiziladi.
   */
  face?: number
}

interface WorldBlade {
  ax: number
  ay: number
  bx: number
  by: number
  z1: number
  tone: string
}

interface PlanMap {
  to: (x: number, y: number) => [number, number]
  box: (r: PlanRect, z0: number, z1: number, tone: string, face?: number) => WorldBox
}

function planMap(lg: LevelGeom, plan: FloorPlan): PlanMap {
  const sx = lg.w / plan.width
  const sy = lg.d / plan.height
  const X0 = lg.ox - lg.w / 2
  const Y1 = lg.oy + lg.d / 2
  const to = (x: number, y: number): [number, number] => [X0 + x * sx, Y1 - y * sy]
  const box = (r: PlanRect, z0: number, z1: number, tone: string, face?: number): WorldBox => {
    const a = to(r.x, r.y + r.h)
    const b = to(r.x + r.w, r.y)
    return { x0: a[0], y0: a[1], x1: b[0], y1: b[1], z0, z1, tone, face }
  }
  return { to, box }
}

/** Tanlangan qavat unit konturlari, reja generatoridan olinadi */
const selectedShapes = computed(() => {
  const i = selectedIndex.value
  const info = levels.value[i]
  const lg = massing.value.levels[i]
  const plan = info ? plans.value.get(info.floor) : undefined
  if (!info || !lg || !plan) return []

  const byId = new Map(info.units.map((u) => [u.id, u]))
  const { to } = planMap(lg, plan)
  return plan.units.map((pu) => {
    const u = byId.get(pu.id)
    const key = CATEGORY_OF[u?.status ?? 'DRAFT'] ?? 'other'
    return {
      id: pu.id,
      code: pu.code,
      fill: CATEGORIES.find((c) => c.key === key)?.color ?? EMPTY_COLOR,
      pts: pu.points.map((p) => to(p[0], p[1])),
    }
  })
})

/* ==========================================================================
   Interyer: tanlangan qavat rejasi metr o‘lchamida ko‘tariladi. Tashqi devor
   deraza yo‘laklari bilan, ichki bo‘linmalar eshik o‘rinlari bilan, koridor
   pol dog‘i, xizmat yadrosi esa yaxlit hajm bo‘lib chiziladi.
   ========================================================================== */

interface InteriorGeom {
  boxes: WorldBox[]
  blades: WorldBlade[]
  patches: Array<{ pts: Array<[number, number]>; tone: string }>
  labels: Array<{ x: number; y: number; z: number; text: string }>
  wallH: number
}

const interiorGeom = computed<InteriorGeom | null>(() => {
  if (!cutaway.value) return null
  const i = selectedIndex.value
  const info = levels.value[i]
  const lg = massing.value.levels[i]
  const plan = info ? plans.value.get(info.floor) : undefined
  if (!info || !lg || !plan || !plan.units.length) return null

  const L = view.layers
  const { to, box } = planMap(lg, plan)
  const W = plan.width
  const H = plan.height
  const T = plan.wallOuter
  const wallH = Math.min(2.9, lg.h * 0.72)
  const sillZ = Math.min(0.95, wallH * 0.34)
  const headZ = Math.min(2.4, wallH * 0.86)
  const doorH = Math.min(2.05, wallH * 0.76)

  const boxes: WorldBox[] = []
  const blades: WorldBlade[] = []
  const patches: Array<{ pts: Array<[number, number]>; tone: string }> = []
  const labels: Array<{ x: number; y: number; z: number; text: string }> = []

  // --- koridor: pol dog‘i, devorsiz
  if (L.core) {
    for (const c of plan.corridors) {
      patches.push({
        pts: [to(c.x, c.y), to(c.x + c.w, c.y), to(c.x + c.w, c.y + c.h), to(c.x, c.y + c.h)],
        tone: IT.corridor,
      })
    }
  }

  // --- tashqi devordagi deraza yo‘laklari rejaning `windows` massividan
  const eps = 1e-6
  const top: Array<[number, number]> = []
  const bottom: Array<[number, number]> = []
  const left: Array<[number, number]> = []
  const right: Array<[number, number]> = []
  if (L.windows) {
    for (const w of plan.windows) {
      if (Math.abs(w.y2 - w.y1) < eps) {
        const span: [number, number] = [Math.min(w.x1, w.x2), Math.max(w.x1, w.x2)]
        if (Math.abs(w.y1) < eps) top.push(span)
        else bottom.push(span)
      } else {
        const span: [number, number] = [Math.min(w.y1, w.y2), Math.max(w.y1, w.y2)]
        if (Math.abs(w.x1) < eps) left.push(span)
        else right.push(span)
      }
    }
  }

  /**
   * Bitta tashqi devor lentasi. Deraza oralig‘ida uch bo‘lak chiqadi: pastki
   * spandrel, shisha va tepadagi peshtoq.
   */
  const runSide = (
    spans: Array<[number, number]>,
    a0: number,
    a1: number,
    make: (u0: number, u1: number) => PlanRect,
    face: number,
  ) => {
    if (!L.walls) return
    const list = spans
      .map((s) => [Math.max(s[0], a0), Math.min(s[1], a1)] as [number, number])
      .filter((s) => s[1] - s[0] > 0.08)
      .sort((p, q) => p[0] - q[0])

    let cursor = a0
    for (const [s0, s1] of list) {
      if (s1 <= cursor) continue
      const p0 = Math.max(s0, cursor)
      if (p0 > cursor + 0.02) boxes.push(box(make(cursor, p0), 0, wallH, IT.wallExt, face))
      boxes.push(box(make(p0, s1), 0, sillZ, IT.wallExt, face))
      boxes.push(box(make(p0, s1), sillZ, headZ, IT.glass, face))
      boxes.push(box(make(p0, s1), headZ, wallH, IT.wallExt, face))
      cursor = s1
    }
    if (a1 > cursor + 0.02) boxes.push(box(make(cursor, a1), 0, wallH, IT.wallExt, face))
  }

  // Reja yuqori chekkasi dunyodagi 2-yuzga, pastki chekkasi 0-yuzga tushadi
  runSide(top, 0, W, (u0, u1) => ({ x: u0, y: 0, w: u1 - u0, h: T }), 2)
  runSide(bottom, 0, W, (u0, u1) => ({ x: u0, y: H - T, w: u1 - u0, h: T }), 0)
  runSide(left, T, H - T, (u0, u1) => ({ x: 0, y: u0, w: T, h: u1 - u0 }), 3)
  runSide(right, T, H - T, (u0, u1) => ({ x: W - T, y: u0, w: T, h: u1 - u0 }), 1)

  // --- eshik o‘rinlari: rejadagi `door` yozuvidan, 2D chizmadagi bilan bir xil
  const doors = plan.units.map((u) => {
    const d = u.door
    const horiz = d.facing === 'up' || d.facing === 'down'
    const start = horiz ? d.x : d.y
    const end = start + d.width * d.hinge
    return { horiz, line: horiz ? d.y : d.x, a: Math.min(start, end), b: Math.max(start, end) }
  })

  /** Tashqi kontur lentasi: u allaqachon deraza bilan birga chizilgan */
  const isOuterBand = (r: PlanRect) =>
    (Math.abs(r.h - T) < 1e-9 && (r.y < 1e-9 || Math.abs(r.y + r.h - H) < 1e-9)) ||
    (Math.abs(r.w - T) < 1e-9 && (r.x < 1e-9 || Math.abs(r.x + r.w - W) < 1e-9))

  if (L.walls) {
    for (const r of plan.walls) {
      if (isOuterBand(r)) continue
      const horiz = r.w >= r.h
      const thick = horiz ? r.h : r.w
      const line = horiz ? r.y + r.h / 2 : r.x + r.w / 2
      const a0 = horiz ? r.x : r.y
      const a1 = a0 + (horiz ? r.w : r.h)

      const cuts = doors
        .filter(
          (d) =>
            d.horiz === horiz &&
            Math.abs(d.line - line) <= thick / 2 + 0.03 &&
            d.b > a0 + 0.02 &&
            d.a < a1 - 0.02,
        )
        .map((d) => [Math.max(d.a, a0), Math.min(d.b, a1)] as [number, number])
        .sort((p, q) => p[0] - q[0])

      const piece = (u0: number, u1: number, z0: number, z1: number) => {
        if (u1 - u0 < 0.03) return
        boxes.push(
          box(
            horiz ? { x: u0, y: r.y, w: u1 - u0, h: r.h } : { x: r.x, y: u0, w: r.w, h: u1 - u0 },
            z0,
            z1,
            IT.wallInt,
          ),
        )
      }

      let cursor = a0
      for (const [c0, c1] of cuts) {
        piece(cursor, c0, 0, wallH)
        // Eshik tepasidagi peshtoq bo‘lagi
        piece(Math.max(c0, cursor), c1, doorH, wallH)
        cursor = Math.max(cursor, c1)
      }
      piece(cursor, a1, 0, wallH)
    }

    // --- eshik qanotlari: 2D chizmadagi kabi to‘liq ochiq holatda
    for (const u of plan.units) {
      const d = u.door
      const sign = d.facing === 'down' || d.facing === 'right' ? 1 : -1
      const horiz = d.facing === 'up' || d.facing === 'down'
      const a = to(d.x, d.y)
      const b = horiz ? to(d.x, d.y + d.width * sign) : to(d.x + d.width * sign, d.y)
      blades.push({ ax: a[0], ay: a[1], bx: b[0], by: b[1], z1: doorH, tone: IT.leaf })
    }
  }

  // --- xizmat yadrosi: lift, zinapoya va sanitar tugun yaxlit hajm bo‘lib turadi
  if (L.core) {
    const seen = new Set<string>()
    for (const c of plan.core) {
      boxes.push(box(c.rect, 0, wallH, CORE_TONE[c.kind] ?? IT.shaft))
      if (seen.has(c.kind)) continue
      seen.add(c.kind)
      const p = to(c.rect.x + c.rect.w / 2, c.rect.y + c.rect.h / 2)
      labels.push({ x: p[0], y: p[1], z: wallH + 0.4, text: c.label })
    }
  }

  return { boxes, blades, patches, labels, wallH }
})

/* ==========================================================================
   Fasad naqshi: yuz mahalliy koordinatasidagi to‘rtburchaklar. u yuz bo‘ylab
   metrda, h qavat asosidan metrda. Tipik qavatda deraza o‘rinlari o‘sha
   qavat rejasidagi deraza yo‘laklaridan olinadi, shuning uchun tashqi
   ko‘rinish ham reja bilan bitta manbadan chiqadi.
   ========================================================================== */

type SkinRole = 'glass' | 'band' | 'shop' | 'entry' | 'dock' | 'louver'

interface SkinRect {
  u0: number
  u1: number
  h0: number
  h1: number
  role: SkinRole
}

/** Reja deraza yo‘laklari yuz bo‘ylab metrga o‘tkaziladi */
function baysOf(plan: FloorPlan, lg: LevelGeom, face: number): Array<[number, number]> {
  const sx = lg.w / plan.width
  const sy = lg.d / plan.height
  const eps = 1e-6
  const out: Array<[number, number]> = []
  for (const w of plan.windows) {
    if (Math.abs(w.y2 - w.y1) < eps) {
      const a = Math.min(w.x1, w.x2)
      const b = Math.max(w.x1, w.x2)
      if (Math.abs(w.y1 - plan.height) < eps) {
        if (face === 0) out.push([a * sx, b * sx])
      } else if (face === 2) {
        out.push([(plan.width - b) * sx, (plan.width - a) * sx])
      }
    } else {
      const a = Math.min(w.y1, w.y2)
      const b = Math.max(w.y1, w.y2)
      if (Math.abs(w.x1 - plan.width) < eps) {
        if (face === 1) out.push([(plan.height - b) * sy, (plan.height - a) * sy])
      } else if (face === 3) {
        out.push([a * sy, b * sy])
      }
    }
  }
  return out.sort((p, q) => p[0] - q[0])
}

function skinTypical(bays: Array<[number, number]>, len: number, h: number, full: boolean) {
  const out: SkinRect[] = []
  if (full) {
    // A klass: to‘liq shisha fasad, ingichka mullionlar bo‘shliq bilan beriladi
    out.push({ u0: 0, u1: len, h0: 0, h1: h * 0.12, role: 'band' })
    out.push({ u0: 0, u1: len, h0: h * 0.94, h1: h, role: 'band' })
    for (const [a, b] of bays) {
      const pad = Math.min(0.34, (b - a) * 0.16)
      out.push({ u0: a - pad, u1: b + pad, h0: h * 0.12, h1: h * 0.94, role: 'glass' })
    }
  } else {
    // B klass: muntazam panjaradagi teshik deraza va ko‘rinadigan spandrel
    out.push({ u0: 0, u1: len, h0: 0, h1: h * 0.32, role: 'band' })
    out.push({ u0: 0, u1: len, h0: h * 0.86, h1: h, role: 'band' })
    for (const [a, b] of bays) {
      out.push({ u0: a, u1: b, h0: h * 0.38, h1: h * 0.83, role: 'glass' })
    }
  }
  return out
}

function skinGround(len: number, h: number, fam: Family, faceIdx: number) {
  const out: SkinRect[] = []

  if (fam === 'shed') {
    out.push({ u0: 0, u1: len, h0: 0, h1: 0.26, role: 'band' })
    out.push({ u0: 0, u1: len, h0: h * 0.86, h1: h, role: 'band' })
    if (faceIdx === 0 || faceIdx === 2) {
      // Yuk eshiklari uzun yon tomon bo‘ylab
      const n = clamp(Math.round(len / 9.5), 2, 8)
      const g = len / n
      const dw = Math.min(3.6, g * 0.5)
      const dh = Math.min(4.6, h * 0.64)
      for (let i = 0; i < n; i++) {
        const c = (i + 0.5) * g
        out.push({ u0: c - dw / 2, u1: c + dw / 2, h0: 0.26, h1: dh, role: 'dock' })
      }
    }
    out.push({ u0: 0.6, u1: len - 0.6, h0: h * 0.72, h1: h * 0.82, role: 'louver' })
    return out
  }

  // Kirish qavati: balandroq bo‘y, vitrina va kirish guruhi
  const n = clamp(Math.round(len / 5.4), 2, 10)
  const g = len / n
  const mid = Math.floor(n / 2)
  out.push({ u0: 0, u1: len, h0: 0, h1: 0.3, role: 'band' })
  out.push({ u0: 0, u1: len, h0: h * 0.88, h1: h, role: 'band' })
  for (let i = 0; i < n; i++) {
    const entry = faceIdx === 0 && (i === mid || (n > 3 && i === mid - 1))
    out.push({
      u0: i * g + 0.26,
      u1: (i + 1) * g - 0.26,
      h0: 0.3,
      h1: h * 0.88,
      role: entry ? 'entry' : 'shop',
    })
  }
  return out
}

const skin = computed<Array<Array<SkinRect[] | null>>>(() => {
  const m = massing.value
  const fam = m.family
  const full = glazed.value

  return m.levels.map((lg) => {
    if (lg.under) return [null, null, null, null]
    if (lg.ground) {
      return [
        skinGround(lg.w, lg.h, fam, 0),
        skinGround(lg.d, lg.h, fam, 1),
        skinGround(lg.w, lg.h, fam, 2),
        skinGround(lg.d, lg.h, fam, 3),
      ]
    }
    const plan = plans.value.get(lg.floor)
    if (!plan) return [null, null, null, null]
    return [0, 1, 2, 3].map((f) =>
      skinTypical(baysOf(plan, lg, f), f === 0 || f === 2 ? lg.w : lg.d, lg.h, full),
    )
  })
})

/* ==========================================================================
   Tashqi elementlar: tom parapeti, kirish soyaboni, balkon, ombor annexi va
   savdo markaz atriumi. Hammasi dunyo koordinatasidagi to‘rt nuqtali yuzalar,
   qavatga biriktiriladi va ajratish bilan birga ko‘chadi.
   ========================================================================== */

interface ExtQuad {
  p: Array<[number, number, number]>
  n: [number, number, number]
  role: string
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

const extras = computed<ExtQuad[][]>(() => {
  const m = massing.value
  const fam = m.family
  const out: ExtQuad[][] = m.levels.map(() => [])

  for (const lg of m.levels) {
    if (lg.under) continue
    const list = out[lg.i]!
    const X0 = lg.ox - lg.w / 2
    const X1 = lg.ox + lg.w / 2
    const Y0 = lg.oy - lg.d / 2
    const Y1 = lg.oy + lg.d / 2
    const zTop = lg.h

    if (lg.ground) {
      if (fam === 'shed') {
        // Yuk maydonchasi va qisqa tomonga tirkalgan ofis annexi
        pushBox(list, X0 + 1.5, Y0 - 3.6, X1 - 1.5, Y0, 0, 1.15, 'apron')
        const ah = Math.min(7.6, Math.max(m.topZ * 0.68, 4))
        const ay0 = lg.oy - lg.d * 0.3
        const ay1 = lg.oy + lg.d * 0.3
        const ax0 = X0 - Math.min(lg.w * 0.14, 14)
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
        const cz = lg.h * 0.64
        pushBox(list, lg.ox - cw / 2, Y0 - 3.4, lg.ox + cw / 2, Y0 + 0.3, cz, cz + 0.42, 'canopy')
        pushBox(list, lg.ox - cw / 2 + 0.5, Y0 - 3.1, lg.ox - cw / 2 + 1, Y0 - 2.6, 0, cz, 'column')
        pushBox(list, lg.ox + cw / 2 - 1, Y0 - 3.1, lg.ox + cw / 2 - 0.5, Y0 - 2.6, 0, cz, 'column')
      }

      if (fam === 'retail') {
        // Kirish atriumi: baland shisha hajm, parapet bilan yakunlanadi
        const aw = Math.min(lg.w * 0.4, 26)
        const az = lg.h * 1.7
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

/**
 * Kadrga sig‘dirish uchun kerak bo‘ladigan chegaralar. Tom machtasi, kirish
 * soyaboni, ombor annexi va balkon ham hisobga olinadi, shuning uchun hech
 * bir bino chetidan qirqilib qolmaydi. Kameradan bog‘liq emas.
 */
const bounds = computed(() => {
  const m = massing.value
  const ex = extras.value
  let x0 = Infinity
  let x1 = -Infinity
  let y0 = Infinity
  let y1 = -Infinity
  /** Har bir darajaning ustki chegarasi: qavat balandligi yoki toj */
  const tops: number[] = []

  for (const lg of m.levels) {
    x0 = Math.min(x0, lg.ox - lg.w / 2)
    x1 = Math.max(x1, lg.ox + lg.w / 2)
    y0 = Math.min(y0, lg.oy - lg.d / 2)
    y1 = Math.max(y1, lg.oy + lg.d / 2)
    let top = lg.h
    for (const q of ex[lg.i] ?? []) {
      for (const p of q.p) {
        if (p[0] < x0) x0 = p[0]
        if (p[0] > x1) x1 = p[0]
        if (p[1] < y0) y0 = p[1]
        if (p[1] > y1) y1 = p[1]
        if (p[2] > top) top = p[2]
      }
    }
    tops.push(top)
  }

  return {
    cx: (x0 + x1) / 2,
    cy: (y0 + y1) / 2,
    hw: (x1 - x0) / 2 || 1,
    hd: (y1 - y0) / 2 || 1,
    /** Burilishdan qat’i nazar eng katta gorizontal yoyilish yarmi */
    radius: Math.hypot((x1 - x0) / 2, (y1 - y0) / 2) || 1,
    tops,
  }
})

/* ==========================================================================
   Sahna: proyeksiya va bo‘yoq bo‘yicha birlashtirish. Faqat shu bosqich
   kameraga bog‘liq.
   ========================================================================== */

function skinFill(role: SkinRole, amount: number) {
  if (role === 'glass' || role === 'shop' || role === 'entry') {
    const base = role === 'entry' ? '#5F86AE' : role === 'shop' ? '#A6CBE8' : '#8FB6DC'
    return shade(base, amount + 0.12)
  }
  if (role === 'dock') return shade('#65758A', amount + 0.06)
  if (role === 'louver') return shade('#8D9CB0', amount)
  return shade('#D3DDEA', amount)
}

/** Chuqurlik bo‘yicha saralaydi va bir xil bo‘yoqli qo‘shnilarni birlashtiradi */
function mergePaint(raw: Array<{ d: string; f: string; o: number; near: number }>): Paint[] {
  raw.sort((a, b) => a.near - b.near)
  const out: Paint[] = []
  for (const it of raw) {
    const last = out[out.length - 1]
    if (last && last.f === it.f && last.o === it.o) last.d += it.d
    else out.push({ d: it.d, f: it.f, o: it.o })
  }
  return out
}

const scene = computed(() => {
  const geo = envelope.value
  const lv = levels.value
  const m = massing.value
  const sk = skin.value
  const ex = extras.value
  const ug = props.building.undergroundFloors
  const mode = props.mode
  const inner = interiorGeom.value
  const shapes = selectedShapes.value

  const th = (view.rotation * Math.PI) / 180
  const ph = (view.tilt * Math.PI) / 180
  const ct = Math.cos(th)
  const st = Math.sin(th)
  const sp = Math.sin(ph)
  const cp = Math.cos(ph)

  const sel = selectedIndex.value
  const isCut = inner !== null
  const step = view.exploded ? geo.h * 1.5 : 0
  // Tanlangan qavat ustidagi darajalar ko‘tariladi: ichkariga qarash uchun
  const openLift = isCut ? Math.max(geo.h * 1.15, (inner?.wallH ?? 2.6) * 2.4) : 0

  const zBase = (i: number) => {
    const lg = m.levels[i]!
    let z = lg.z0 + step * (i - ug)
    if (sel >= 0 && i > sel) z += openLift
    return z
  }

  // Kadrga sig‘dirish: masshtab burilishdan qat’i nazar bir xil qoladi
  // (aylantirganda bino kattalashib-kichraymaydi), markazlash esa joriy
  // burchak bo‘yicha aniq hisoblanadi.
  const bd = bounds.value
  const zLow = zBase(0)
  let zHigh = zLow + geo.h
  for (let i = 0; i < lv.length; i++) zHigh = Math.max(zHigh, zBase(i) + (bd.tops[i] ?? geo.h))

  const spanH = bd.radius * 2
  const spanV = Math.max(spanH * sp + (zHigh - zLow) * cp, 1)
  const s = Math.min((VW * 0.9) / spanH, (VH * 0.88) / spanV) * view.zoom
  const cx = VW / 2 - (bd.cx * ct - bd.cy * st) * s
  const cy = VH / 2 + ((bd.cx * st + bd.cy * ct) * sp + ((zLow + zHigh) / 2) * cp) * s

  const px = (x: number, y: number) => r1(cx + (x * ct - y * st) * s)
  const py = (x: number, y: number, z: number) => r1(cy - ((x * st + y * ct) * sp + z * cp) * s)
  const pt = (x: number, y: number, z: number) => `${px(x, y)},${py(x, y, z)}`
  const vOf = (x: number, y: number) => x * st + y * ct

  /** Yuz kameraga qaraganmi: normal bilan kamera yo‘nalishining ko‘paytmasi */
  const dotC = (nx: number, ny: number, nz: number) => -nx * st * cp - ny * ct * cp + nz * sp

  const lightOf = (nx: number, ny: number, nz: number) => {
    const len = Math.hypot(nx, ny, nz) || 1
    const d = (nx * SUN.x + ny * SUN.y + nz * SUN.z) / len
    return -0.46 + (0.5 + 0.5 * clamp(d, -1, 1)) * 0.54
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
  const topFace = Math.max(topAmount + 0.32, 0.1)

  // Eshik qanoti kabi ingichka qismlar bitta tekis bo‘yoq oladi: bu
  // masshtabda yuz farqi sezilmaydi
  let sideSum = 0
  let sideN = 0
  for (const f of faceState) {
    if (f.visible) {
      sideSum += f.amount
      sideN++
    }
  }
  const flatAmount = (topFace + (sideN ? sideSum / sideN : topAmount)) / 2

  const face4 = (ax: number, ay: number, bx: number, by: number, q0: number, q1: number) =>
    `M${px(ax, ay)} ${py(ax, ay, q1)}L${px(bx, by)} ${py(bx, by, q1)}L${px(bx, by)} ${py(bx, by, q0)}L${px(ax, ay)} ${py(ax, ay, q0)}Z`

  /* ------------------------------------------------------------------
     Tashqi ko‘rinish: haqiqiy fotosurat ko‘rinadigan vertikal yuzlarga.

     Aksonometriyada yuz parallelogramm bo‘lgani uchun surat aniq affin
     matritsa bilan tushadi. Uchta nuqta yetarli: yuqori chap P0, yuqori
     o‘ng P1 va pastki chap P2. U = P1 − P0 va V = P2 − P0 vektorlari
     mahalliy kadrning yon tomonlariga aylanadi.

     Surat butun hajm uchun bir marta chiziladi: pastki chegara yer sathi,
     yuqorisi esa stikning eng baland nuqtasi. Yer osti darajalari qirqib
     tashlanadi, ular yer ostida turadi.
     ------------------------------------------------------------------ */
  const photo: PhotoFace[] = []
  // Kesim va ajratilgan holatda surat chizilmaydi: u yerda hajm bo‘lingan
  const usePhoto =
    mode === 'occupancy' && photoOk.value && photoSrc.value !== '' && !isCut && !view.exploded
  if (usePhoto) {
    const crop = PHOTO_CROP[m.family]
    // Kadrning qaysi qismi yuzga tushishi: oyna butun kadrga cho‘ziladi,
    // ortiqcha chekkalar yuz konturidan tashqarida qolib qirqiladi
    const iw = PHOTO_BOX / Math.max(crop.u1 - crop.u0, 0.05)
    const ih = PHOTO_BOX / Math.max(crop.v1 - crop.v0, 0.05)
    const hw = geo.w / 2
    const hd = geo.d / 2
    const ring: Array<[number, number]> = [
      [-hw, -hd],
      [hw, -hd],
      [hw, hd],
      [-hw, hd],
    ]
    // Eng yorug‘ yuz tayanch qilib olinadi: qorayish burilishdan qat’i nazar
    // bir xil o‘qiladi, chunki quyosh yo‘nalishi qo‘zg‘almaydi
    let bright = -1
    for (const f of faceState) bright = Math.max(bright, f.amount)

    for (let f = 0; f < 4; f++) {
      const state = faceState[f]!
      if (!state.visible) continue

      // Siluet: har bir yer usti darajasi o‘z konturi bilan qo‘shiladi,
      // shuning uchun pog‘onali turar joyda ham surat hajmdan chiqmaydi
      const shell: string[] = []
      for (let i = 0; i < m.levels.length; i++) {
        const lg = m.levels[i]!
        if (lg.under) continue
        const ax0 = lg.ox - lg.w / 2
        const ax1 = lg.ox + lg.w / 2
        const ay0 = lg.oy - lg.d / 2
        const ay1 = lg.oy + lg.d / 2
        const c: Array<[number, number]> = [
          [ax0, ay0],
          [ax1, ay0],
          [ax1, ay1],
          [ax0, ay1],
        ]
        const a = c[f]!
        const b = c[(f + 1) % 4]!
        const q0 = zBase(i)
        shell.push(face4(a[0], a[1], b[0], b[1], q0, q0 + lg.h))
      }
      if (!shell.length) continue

      const a = ring[f]!
      const b = ring[(f + 1) % 4]!
      const p0x = px(a[0], a[1])
      const p0y = py(a[0], a[1], m.topZ)
      const p1x = px(b[0], b[1])
      const p1y = py(b[0], b[1], m.topZ)
      const p2x = px(a[0], a[1])
      const p2y = py(a[0], a[1], 0)
      const ux = (p1x - p0x) / PHOTO_BOX
      const uy = (p1y - p0y) / PHOTO_BOX
      const vx = (p2x - p0x) / PHOTO_BOX
      const vy = (p2y - p0y) / PHOTO_BOX
      const k5 = (n: number) => Math.round(n * 100000) / 100000

      photo.push({
        f,
        d: shell.join(''),
        m: `matrix(${k5(ux)},${k5(uy)},${k5(vx)},${k5(vy)},${p0x},${p0y})`,
        x: r1(-crop.u0 * iw),
        y: r1(-crop.v0 * ih),
        w: r1(iw),
        h: r1(ih),
        dark: Math.round(clamp(0.05 + (bright - state.amount) * 2, 0, 0.38) * 1000) / 1000,
      })
    }
  }
  const photoOn = photo.length > 0

  const slabs: SlabView[] = []

  for (let i = 0; i < lv.length; i++) {
    const info = lv[i]!
    const lg = m.levels[i]!
    const z0 = zBase(i)
    const isSel = i === sel
    const cutFloor = isSel && isCut
    const zTop = z0 + (cutFloor ? PLATE_T : lg.h)
    const above = sel >= 0 && i > sel

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

    // --- ekran chegarasidan tashqarida qolgan daraja umuman qurilmaydi
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    for (const c of corners) {
      for (const z of [z0, zTop + (lg.top ? 9 : 0)]) {
        const ex2 = px(c[0], c[1])
        const ey2 = py(c[0], c[1], z)
        if (ex2 < minX) minX = ex2
        if (ex2 > maxX) maxX = ex2
        if (ey2 < minY) minY = ey2
        if (ey2 > maxY) maxY = ey2
      }
    }
    if (maxX < -24 || minX > VW + 24 || maxY < -24 || minY > VH + 24) continue

    const dominant = info.mix.length
      ? info.mix.reduce((best, mi) => (mi.area > best.area ? mi : best), info.mix[0]!)
      : null

    let base = EMPTY_COLOR
    if (mode === 'occupancy') base = dominant ? dominant.color : EMPTY_COLOR
    else base = isSel ? '#7FA8F6' : '#C3D2E6'
    // Yer osti darajasi neytral kul rangda: bandlik ranglari yer ustida qoladi
    if (lg.under) base = '#BDC8D6'

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

    /*
     * Fasad bo‘yog‘ining zichligi. Surat yopishtirilgan yer usti darajalarida
     * bandlik rangi shaffof filtr bo‘lib qoladi: rang ham o‘qiladi, g‘isht,
     * shisha va panel ham ko‘rinib turadi. Tanlangan qavatda filtr quyuqroq,
     * shuning uchun u qo‘shni qavatlardan darrov ajralib turadi. Yer osti
     * darajasida surat yo‘q, u yerda bo‘yoq to‘liq zichlikda qoladi.
     */
    const photoHere = photoOn && !lg.under
    const partAlpha = photoHere ? (isSel ? 0.56 : 0.3) : 1

    // --- fasad tekisliklari
    const parts: FacePart[] = []
    if (mode !== 'wire') {
      for (let f = 0; f < 4; f++) {
        const state = faceState[f]!
        if (!state.visible) continue
        const a = corners[f]!
        const b = corners[(f + 1) % 4]!
        if (mode === 'occupancy' && info.mix.length) {
          let t = 0
          for (const mi of info.mix) {
            const next = Math.min(t + mi.share, 1)
            if (next > t + 0.001) {
              parts.push({
                points: quad(a, b, z0, zTop, t, next),
                fill: shade(mi.color, state.amount),
                alpha: partAlpha,
              })
            }
            t = next
          }
        } else {
          parts.push({
            points: quad(a, b, z0, zTop, 0, 1),
            fill: shade(base, state.amount),
            alpha: partAlpha,
          })
        }
      }
    }

    // --- fasad naqshi. Ko‘tarilgan va kesilgan darajalarda tafsilot kerak
    //     emas, surat yopishtirilgan yuzda esa deraza allaqachon suratda bor
    const skinItems: Paint[] = []
    if (mode !== 'wire' && !cutFloor && !lg.under && !above && !photoHere) {
      const facadeAlpha = mode === 'occupancy' ? 0.46 : 0.74
      const rects = sk[i]!
      const groups = new Map<string, string[]>()
      for (let f = 0; f < 4; f++) {
        const state = faceState[f]!
        if (!state.visible) continue
        const list = rects[f]
        if (!list) continue
        const a = corners[f]!
        const b = corners[(f + 1) % 4]!
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
        const dx = (b[0] - a[0]) / len
        const dy = (b[1] - a[1]) / len
        for (const rc of list) {
          const t0 = clamp(rc.u0, 0, len)
          const t1 = clamp(rc.u1, 0, len)
          if (t1 - t0 < 0.06) continue
          const fill = skinFill(rc.role, state.amount)
          const d = face4(
            a[0] + dx * t0,
            a[1] + dy * t0,
            a[0] + dx * t1,
            a[1] + dy * t1,
            z0 + rc.h0,
            z0 + rc.h1,
          )
          const arr = groups.get(fill)
          if (arr) arr.push(d)
          else groups.set(fill, [d])
        }
      }
      for (const [fill, dl] of groups) skinItems.push({ d: dl.join(''), f: fill, o: facadeAlpha })
    }

    // --- plita ustki yuzasi: yashirin qolganda umuman chizilmaydi
    const showTop = lg.top || isSel || view.exploded || (isCut && i === sel - 1)
    const topPoints = showTop
      ? [pt(X0, Y0, zTop), pt(X1, Y0, zTop), pt(X1, Y1, zTop), pt(X0, Y1, zTop)].join(' ')
      : ''
    const topFill = cutFloor
      ? IT.base
      : isSel
        ? '#E9F0FE'
        : shade(base, Math.max(topAmount + 0.34, 0.14))

    // --- tanlangan qavat lentasi: rang yagona belgi bo‘lmasligi uchun kontur ham
    let band = ''
    if (isSel && !cutFloor && mode !== 'wire') {
      const bandParts: string[] = []
      for (let f = 0; f < 4; f++) {
        if (!faceState[f]!.visible) continue
        const a = corners[f]!
        const b = corners[(f + 1) % 4]!
        const q = quad(a, b, z0 + lg.h * 0.16, z0 + lg.h * 0.84, 0, 1)
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

    // --- unit konturlari: faqat tanlangan qavatda
    const units: UnitShape[] = []
    if (isSel && mode !== 'wire') {
      const zu = zTop + 0.02
      for (const shape of shapes) {
        let sxSum = 0
        let sySum = 0
        const list = shape.pts.map((p) => {
          sxSum += px(p[0], p[1])
          sySum += py(p[0], p[1], zu)
          return pt(p[0], p[1], zu)
        })
        const n = Math.max(list.length, 1)
        units.push({
          id: shape.id,
          code: shape.code,
          points: list.join(' '),
          fill: shape.fill,
          cx: r1(sxSum / n),
          cy: r1(sySum / n),
          active: shape.id === props.unit,
        })
      }
    }

    // --- interyer: koridor dog‘i, devor, eshik, deraza va xizmat yadrosi
    const patches: Paint[] = []
    const interior: Paint[] = []
    const labels: Array<{ x: number; y: number; text: string }> = []
    if (cutFloor && inner) {
      const zf = zTop
      for (const p of inner.patches) {
        patches.push({
          d: `M${p.pts.map((q) => `${px(q[0], q[1])} ${py(q[0], q[1], zf + 0.01)}`).join('L')}Z`,
          f: p.tone,
          o: 1,
        })
      }

      const raw: Array<{ d: string; f: string; o: number; near: number }> = []
      for (const b of inner.boxes) {
        if (b.face !== undefined && faceState[b.face]!.visible) continue
        const q0 = zf + b.z0
        const q1 = zf + b.z1
        const c: Array<[number, number]> = [
          [b.x0, b.y0],
          [b.x1, b.y0],
          [b.x1, b.y1],
          [b.x0, b.y1],
        ]
        const near = ((q0 + q1) / 2) * sp - vOf((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2) * cp
        const first = b.face === undefined ? 0 : (b.face + 2) % 4
        const last = b.face === undefined ? 3 : first
        for (let f = first; f <= last; f++) {
          const fs = faceState[f]!
          if (!fs.visible) continue
          const a = c[f]!
          const n2 = c[(f + 1) % 4]!
          raw.push({
            d: face4(a[0], a[1], n2[0], n2[1], q0, q1),
            f: shade(b.tone, fs.amount),
            o: 1,
            near: near - 0.04,
          })
        }
        raw.push({
          d: `M${pt(c[0]![0], c[0]![1], q1).replace(',', ' ')}L${pt(c[1]![0], c[1]![1], q1).replace(',', ' ')}L${pt(c[2]![0], c[2]![1], q1).replace(',', ' ')}L${pt(c[3]![0], c[3]![1], q1).replace(',', ' ')}Z`,
          f: shade(b.tone, topFace),
          o: 1,
          near: near + 0.04,
        })
      }

      for (const bl of inner.blades) {
        raw.push({
          d: face4(bl.ax, bl.ay, bl.bx, bl.by, zf, zf + bl.z1),
          f: shade(bl.tone, flatAmount),
          o: 0.95,
          near: (zf + bl.z1 / 2) * sp - vOf((bl.ax + bl.bx) / 2, (bl.ay + bl.by) / 2) * cp,
        })
      }

      interior.push(...mergePaint(raw))

      for (const l of inner.labels) {
        labels.push({ x: px(l.x, l.y), y: py(l.x, l.y, zf + l.z), text: l.text })
      }
    }

    // --- tashqi elementlar: tom, soyabon, balkon, annex
    const extraItems: Paint[] = []
    if (mode !== 'wire' && !lg.under && !above) {
      const raw: Array<{ d: string; f: string; o: number; near: number }> = []
      for (const q of ex[i]!) {
        if (dotC(q.n[0], q.n[1], q.n[2]) <= 0) continue
        let ax = 0
        let ay = 0
        let az = 0
        for (const p of q.p) {
          ax += p[0]
          ay += p[1]
          az += p[2]
        }
        const k = q.p.length || 1
        raw.push({
          d: `M${q.p.map((p) => `${px(p[0], p[1])} ${py(p[0], p[1], z0 + p[2])}`).join('L')}Z`,
          f: shade(EXT_TONE[q.role] ?? '#C4CFDE', lightOf(q.n[0], q.n[1], q.n[2])),
          o: 1,
          near: (z0 + az / k) * sp - vOf(ax / k, ay / k) * cp,
        })
      }
      extraItems.push(...mergePaint(raw))
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
    const labelW = isSel ? 152 : 44
    const labelX = clamp(anchorX + 16, 8, VW - labelW - 8)
    const labelY = clamp(anchorY, 24, VH - 12)

    slabs.push({
      floor: info.floor,
      name: info.name,
      short: info.short,
      underground: info.underground,
      selected: isSel,
      // Tanlangan qavat to‘q qoladi, qolganlari shaffofroq: ochilgan qavat
      // ustidagi darajalar esa deyarli shaffof bo‘ladi
      opacity: sel < 0 || isSel ? 1 : isCut && above ? 0.22 : 0.62,
      parts,
      skin: skinItems,
      topPoints,
      topFill,
      band,
      edges,
      units,
      patches,
      interior,
      labels,
      extras: extraItems,
      anchorX,
      anchorY,
      labelX,
      labelY,
      labelW,
      aria: `${info.name}, ${info.total} unit, bandlik ${info.occupancy} foiz, ${info.label}`,
    })
  }

  // --- yer sathi: to‘r va quyosh yo‘nalishidagi soya. Maydonchaning o‘lchami
  //     binoning haqiqiy chegarasidan chiqadi, shuning uchun uzun ombor ham,
  //     ixcham minora ham bir xil nisbatdagi zamin ustida turadi.
  const gx0 = bd.cx - bd.hw * 1.5
  const gx1 = bd.cx + bd.hw * 1.5
  const gy0 = bd.cy - bd.hd * 1.5
  const gy1 = bd.cy + bd.hd * 1.5
  const grid: string[] = []
  const divisions = 6
  for (let i = 0; i <= divisions; i++) {
    const x = gx0 + ((gx1 - gx0) * i) / divisions
    grid.push(`M${px(x, gy0)} ${py(x, gy0, 0)} L${px(x, gy1)} ${py(x, gy1, 0)}`)
    const y = gy0 + ((gy1 - gy0) * i) / divisions
    grid.push(`M${px(gx0, y)} ${py(gx0, y, 0)} L${px(gx1, y)} ${py(gx1, y, 0)}`)
  }
  const plane = [pt(gx0, gy0, 0), pt(gx1, gy0, 0), pt(gx1, gy1, 0), pt(gx0, gy1, 0)].join(' ')

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
    const k = clamp(1 / Math.max(SUN.z, 0.16), 0, 3.4)
    const offX = -SUN.x * m.topZ * k
    const offY = -SUN.y * m.topZ * k
    const pts = base.concat(base.map((p) => [p[0] + offX, p[1] + offY] as [number, number]))
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

  return {
    slabs,
    photo,
    grid,
    plane,
    shadow,
    groundMark: {
      x: clamp(px(gx0, gy1), 14, VW - 90),
      y: clamp(py(gx0, gy1, 0), 20, VH - 14),
    },
  }
})

const tooltip = computed(() => {
  const info = hoveredLevel.value
  if (!info || info.floor === props.floor) return null
  const slab = scene.value.slabs.find((s) => s.floor === info.floor)
  if (!slab) return null
  const w = 184
  return {
    x: clamp(slab.anchorX + 14, 8, VW - w - 8),
    y: clamp(slab.anchorY - 60, 8, VH - 80),
    w,
    name: info.name,
    units: info.total ? `${info.total} unit · ${info.vacantCount} bo‘sh` : info.label,
    occupancy: info.total ? `Bandlik ${info.occupancy}%` : 'Ma’lumot yo‘q',
  }
})

/** Sichqoncha ostidagi xona: kod, maydon va holat */
const roomTip = computed(() => {
  if (!hoveredUnit.value) return null
  const u = selectedLevel.value?.units.find((x) => x.id === hoveredUnit.value)
  if (!u) return null
  const shape = scene.value.slabs.find((sl) => sl.selected)?.units.find((x) => x.id === u.id)
  if (!shape) return null
  const cat = CATEGORIES.find((c) => c.key === (CATEGORY_OF[u.status] ?? 'other'))
  const w = 178
  return {
    x: clamp(shape.cx + 12, 8, VW - w - 8),
    y: clamp(shape.cy - 82, 8, VH - 88),
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
  const env = envelope.value
  return `${b.type}: ${shape}. ${b.buildingClass}: ${fac}. Tayanch kontur ${Math.round(env.w)} × ${Math.round(env.d)} m, qavat balandligi ${env.h} m.`
})

/* ==========================================================================
   Qavat relsi va boshqaruv
   ========================================================================== */

/** Rels yuqoridan pastga: eng yuqori qavat tepada turadi */
const railLevels = computed(() => [...levels.value].reverse())
const railRef = ref<HTMLElement | null>(null)

watch(
  () => props.floor,
  async () => {
    hoveredUnit.value = ''
    await nextTick()
    railRef.value
      ?.querySelector<HTMLElement>('[data-active="true"]')
      ?.scrollIntoView({ block: 'nearest' })
  },
  { immediate: true },
)

watch(
  () => props.mode,
  () => {
    hoveredUnit.value = ''
  },
)

/**
 * Qavat bosilganda darhol o'sha qavatning ichi ochiladi. Ilgari bosish faqat
 * qavatni ajratardi va rejani ko'rish uchun yana bir necha qadam kerak edi.
 */
function pickFloor(floor: number) {
  if (blockClick) return
  emit('update:floor', floor)
  if (props.mode !== 'interior') emit('update:mode', 'interior')
}

function pickUnit(floor: number, id: string) {
  if (blockClick) return
  emit('update:floor', floor)
  emit('update:unit', id)
}

/** Rels ichida klaviatura bilan yurish: yuqoriga bosilsa qavat ko‘tariladi */
function stepFloor(delta: number) {
  const list = levels.value
  const i = list.findIndex((l) => l.floor === props.floor)
  const next = list[clamp((i < 0 ? 0 : i) + delta, 0, list.length - 1)]
  if (next) emit('update:floor', next.floor)
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
  // Ko‘rsatkich ushlanmasa ham tortish ishlaydi, shuning uchun xato yutiladi
  try {
    target.setPointerCapture(event.pointerId)
  } catch {
    /* ushlab turish imkoni yo‘q */
  }
}

function onMove(event: PointerEvent) {
  if (!dragging.value) return
  const dx = event.clientX - dragX
  const dy = event.clientY - dragY
  dragDist = Math.max(dragDist, Math.abs(dx) + Math.abs(dy))
  if (dragDist > 5) blockClick = true
  view.rotation = Math.round(wrap360(dragRot + dx * 0.42))
  view.tilt = Math.round(clamp(dragTilt - dy * 0.24, 10, 74))
}

function onUp(event: PointerEvent) {
  if (!dragging.value) return
  dragging.value = false
  const target = event.currentTarget as SVGSVGElement
  try {
    if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId)
  } catch {
    /* ushlab turish allaqachon bekor qilingan */
  }
}

function onWheel(event: WheelEvent) {
  zoomBy(event.deltaY > 0 ? -0.12 : 0.12)
}

function spin(delta: number) {
  view.rotation = wrap360(view.rotation + delta)
}

function zoomBy(delta: number) {
  view.zoom = Math.round(clamp(view.zoom + delta, 0.6, 2.6) * 100) / 100
}

function resetView() {
  view.rotation = START_ROTATION
  view.tilt = START_TILT
  view.zoom = 1
  view.exploded = false
}

function toggleLayer(key: keyof Layers) {
  view.layers[key] = !view.layers[key]
}
</script>

<template>
  <div class="min-w-0">
    <div
      class="relative overflow-hidden rounded-panel bg-gradient-to-b from-white via-brand-50/40 to-ink-100/70 ring-1 ring-inset ring-ink-200/70"
    >
      <svg
        :viewBox="`0 0 ${VW} ${VH}`"
        preserveAspectRatio="xMidYMid meet"
        class="w-full touch-pan-y select-none"
        :class="[heightClass, dragging ? 'cursor-grabbing' : 'cursor-grab']"
        role="img"
        :aria-label="`${building.name} aksonometrik ko‘rinishi. Burilish ${Math.round(view.rotation)} daraja, nishab ${Math.round(view.tilt)} daraja. Qavat tanlash uchun chapdagi relsdan foydalaning.`"
        @pointerdown="onDown"
        @pointermove="onMove"
        @pointerup="onUp"
        @pointercancel="onUp"
        @wheel.prevent="onWheel"
        @pointerleave="(hovered = null), (hoveredUnit = '')"
      >
        <defs>
          <filter :id="`mkn-shadow-${building.id}`" x="-60%" y="-80%" width="240%" height="280%">
            <feGaussianBlur stdDeviation="9" />
          </filter>

          <!-- Surat yuz konturidan chiqmasligi uchun qirqim -->
          <clipPath
            v-for="fc in scene.photo"
            :id="`mkn-face-${building.id}-${fc.f}`"
            :key="`cp${fc.f}`"
          >
            <path :d="fc.d" />
          </clipPath>
        </defs>

        <!-- Yer sathi: to‘r va quyosh yo‘nalishidagi soya -->
        <polygon :points="scene.plane" fill="#0256F7" fill-opacity="0.035" />
        <path
          v-for="(g, gi) in scene.grid"
          :key="`g${gi}`"
          :d="g"
          stroke="#94A2B8"
          stroke-opacity="0.26"
          stroke-width="0.8"
          fill="none"
        />
        <polygon
          :points="scene.shadow"
          fill="#131C2B"
          fill-opacity="0.16"
          :filter="`url(#mkn-shadow-${building.id})`"
        />

        <text
          v-if="building.undergroundFloors"
          :x="scene.groundMark.x"
          :y="scene.groundMark.y + 16"
          font-size="12"
          font-weight="600"
          fill="#64748B"
        >
          Yer sathi
        </text>

        <!--
          Binoning haqiqiy surati. Har bir ko‘rinadigan yuzga bitta surat
          tushadi va butun hajmni qoplaydi, qavatlar bo‘yicha takrorlanmaydi.
          Ustidagi qorayish qatlami yon yuzlarni ajratadi, aks holda hajm
          yassi ko‘rinardi. Qavat bo‘yoqlari keyin, shaffof filtr bo‘lib
          chiziladi, shuning uchun bandlik ma’lumoti yo‘qolmaydi.
        -->
        <g v-if="scene.photo.length" class="pointer-events-none">
          <g
            v-for="fc in scene.photo"
            :key="`ph${fc.f}`"
            :clip-path="`url(#mkn-face-${building.id}-${fc.f})`"
          >
            <image
              :href="photoSrc"
              :x="fc.x"
              :y="fc.y"
              :width="fc.w"
              :height="fc.h"
              :transform="fc.m"
              preserveAspectRatio="none"
              @error="photoOk = false"
            />
          </g>
          <path
            v-for="fc in scene.photo"
            :key="`sh${fc.f}`"
            :d="fc.d"
            fill="#0B1220"
            :fill-opacity="fc.dark"
          />
        </g>

        <!-- Plitalar pastdan yuqoriga chiziladi: kamera doim tepadan qaraydi -->
        <g
          v-for="slab in scene.slabs"
          :key="slab.floor"
          class="cursor-pointer"
          :opacity="slab.opacity"
          @pointerenter="hovered = slab.floor"
          @click="pickFloor(slab.floor)"
        >
          <title>{{ slab.aria }}</title>

          <template v-if="mode === 'wire'">
            <path
              v-for="(e, ei) in slab.edges"
              :key="ei"
              :d="e.d"
              fill="none"
              :stroke="slab.selected ? '#0256F7' : '#48566B'"
              :stroke-width="slab.selected ? 1.8 : 1"
              :stroke-opacity="e.hidden ? 0.2 : 0.9"
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
              :fill-opacity="p.alpha"
              stroke="#FFFFFF"
              stroke-width="0.6"
              stroke-opacity="0.4"
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
              fill-opacity="0.3"
              stroke="#0139B0"
              stroke-width="1.6"
              class="pointer-events-none"
            />

            <polygon
              v-if="slab.topPoints"
              :points="slab.topPoints"
              :fill="slab.topFill"
              :stroke="slab.selected ? '#0256F7' : '#94A2B8'"
              :stroke-width="slab.selected ? 2.2 : 0.9"
              :stroke-opacity="slab.selected ? 1 : 0.5"
              :stroke-dasharray="slab.underground ? '7 5' : undefined"
            />

            <!-- Koridor pol dog‘i -->
            <path
              v-for="(p, pi) in slab.patches"
              :key="`c${pi}`"
              :d="p.d"
              :fill="p.f"
              class="pointer-events-none"
            />
          </template>

          <!-- Unit konturlari plita ustki yuzasiga tushiriladi -->
          <g
            v-for="u in slab.units"
            :key="u.id"
            @click.stop="pickUnit(slab.floor, u.id)"
            @pointerenter="hoveredUnit = u.id"
            @pointerleave="hoveredUnit === u.id ? (hoveredUnit = '') : null"
          >
            <title>{{ u.code }}</title>
            <polygon
              :points="u.points"
              :fill="u.fill"
              :fill-opacity="
                u.active ? 0.92 : hoveredUnit === u.id ? 0.86 : slab.interior.length ? 0.44 : 0.74
              "
              :stroke="u.active ? '#0139B0' : hoveredUnit === u.id ? '#0256F7' : '#FFFFFF'"
              :stroke-width="u.active ? 2.4 : hoveredUnit === u.id ? 1.9 : 0.9"
            />
            <text
              v-if="!slab.interior.length"
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

          <!-- Devor, eshik, deraza va xizmat yadrosi: chuqurlik bo‘yicha
               saralangan va bo‘yoq bo‘yicha birlashtirilgan qismlar -->
          <g v-if="slab.interior.length" class="pointer-events-none">
            <path
              v-for="(it, ii) in slab.interior"
              :key="ii"
              :d="it.d"
              :fill="it.f"
              :fill-opacity="it.o"
            />
            <text
              v-for="(l, li) in slab.labels"
              :key="`l${li}`"
              :x="l.x"
              :y="l.y"
              text-anchor="middle"
              font-size="10.5"
              font-weight="700"
              fill="#31435C"
              stroke="#FFFFFF"
              stroke-width="3"
              paint-order="stroke"
            >
              {{ l.text }}
            </text>
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
              stroke-opacity="0.34"
            />
          </g>

          <g v-if="slab.selected || hovered === slab.floor" class="pointer-events-none">
            <path
              :d="`M${slab.anchorX} ${slab.anchorY} L${slab.labelX} ${slab.labelY - 4}`"
              stroke="#94A2B8"
              stroke-width="1"
              fill="none"
            />
            <rect
              :x="slab.labelX"
              :y="slab.labelY - 16"
              :width="slab.labelW"
              height="24"
              rx="12"
              :fill="slab.selected ? '#0256F7' : '#FFFFFF'"
              :stroke="slab.selected ? '#0256F7' : '#E2E8F2'"
              stroke-width="1"
            />
            <text
              :x="slab.labelX + 11"
              :y="slab.labelY + 1"
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

      <!-- Qavat relsi: navigatorning asosiy boshqaruvi, doim ko‘rinib turadi -->
      <div
        ref="railRef"
        class="scroll-slim absolute left-2 top-1/2 flex max-h-[88%] w-[62px] -translate-y-1/2 flex-col gap-0.5 overflow-y-auto rounded-field bg-surface/94 p-1 shadow-card ring-1 ring-ink-200/70 backdrop-blur"
        role="group"
        aria-label="Qavat tanlash relsi"
        @keydown.up.prevent="stepFloor(1)"
        @keydown.down.prevent="stepFloor(-1)"
      >
        <template v-for="(l, li) in railLevels" :key="l.floor">
          <!-- Yer sathi chizig‘i: yer usti va yer osti darajalari orasida -->
          <span
            v-if="l.underground && !railLevels[li - 1]?.underground"
            class="my-0.5 block border-t border-dashed border-ink-300"
            aria-hidden="true"
          />
          <button
            type="button"
            :data-active="l.floor === floor"
            class="flex h-[34px] shrink-0 items-center gap-1.5 rounded-[7px] px-1.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500"
            :class="
              l.floor === floor
                ? 'bg-brand-500 text-white'
                : 'text-ink-700 hover:bg-brand-50 hover:text-brand-700'
            "
            :aria-label="`${l.name}, ${l.total} unit, bandlik ${l.occupancy} foiz`"
            :aria-pressed="l.floor === floor"
            @click="emit('update:floor', l.floor)"
            @pointerenter="hovered = l.floor"
            @pointerleave="hovered === l.floor ? (hovered = null) : null"
          >
            <span class="tabular w-[18px] shrink-0 text-right text-[12px] font-bold">
              {{ l.short }}
            </span>
            <span
              class="flex h-1.5 min-w-0 flex-1 overflow-hidden rounded-pill"
              :class="l.floor === floor ? 'bg-white/30' : 'bg-ink-200'"
            >
              <span
                v-for="mx in l.mix"
                :key="mx.key"
                class="h-full"
                :style="{ width: `${mx.share * 100}%`, background: mx.color }"
              />
            </span>
          </button>
        </template>
      </div>

      <!-- Ko‘rinish rejimi -->
      <div
        v-if="controls"
        class="absolute right-2 top-2 flex gap-0.5 rounded-field bg-surface/94 p-1 shadow-card ring-1 ring-ink-200/70 backdrop-blur"
        role="group"
        aria-label="Ko‘rinish rejimi"
      >
        <button
          v-for="m in MODES"
          :key="m.value"
          type="button"
          class="h-9 rounded-[8px] px-3 text-[12px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          :class="
            mode === m.value
              ? 'bg-brand-500 text-white'
              : 'text-ink-600 hover:bg-brand-50 hover:text-brand-700'
          "
          :aria-pressed="mode === m.value"
          @click.stop="emit('update:mode', m.value)"
        >
          {{ m.label }}
        </button>
      </div>

      <!-- Kamera: aylantirish, masshtab, tiklash -->
      <div
        v-if="controls"
        class="absolute bottom-2 right-2 flex gap-0.5 rounded-field bg-surface/94 p-1 shadow-card ring-1 ring-ink-200/70 backdrop-blur"
        role="group"
        aria-label="Kamera boshqaruvi"
      >
        <button
          type="button"
          class="grid size-10 place-items-center rounded-[8px] text-ink-600 transition-colors hover:bg-brand-50 hover:text-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          aria-label="Chapga burish"
          @click.stop="spin(-20)"
        >
          <UiIcon name="refresh" :size="18" />
        </button>
        <button
          type="button"
          class="grid size-10 place-items-center rounded-[8px] text-ink-600 transition-colors hover:bg-brand-50 hover:text-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          aria-label="O‘ngga burish"
          @click.stop="spin(20)"
        >
          <UiIcon name="refresh" :size="18" class="-scale-x-100" />
        </button>
        <span class="my-auto h-6 w-px shrink-0 bg-ink-200" />
        <button
          type="button"
          class="grid size-10 place-items-center rounded-[8px] text-ink-600 transition-colors hover:bg-brand-50 hover:text-brand-600 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          aria-label="Yaqinlashtirish"
          :disabled="view.zoom >= 2.6"
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
        <button
          type="button"
          class="grid size-10 place-items-center rounded-[8px] text-ink-600 transition-colors hover:bg-brand-50 hover:text-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          aria-label="Ko‘rinishni boshlang‘ich holatga qaytarish"
          @click.stop="resetView"
        >
          <UiIcon name="target" :size="18" />
        </button>
      </div>
    </div>

    <!-- Qatlamlar: faqat interyer rejimida ma’noga ega -->
    <div v-if="controls" class="mt-3 flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        class="inline-flex h-9 items-center gap-1.5 rounded-field px-3 text-[12px] font-semibold ring-1 ring-inset transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        :class="
          view.exploded
            ? 'bg-brand-500 text-white ring-brand-500'
            : 'bg-surface text-ink-700 ring-ink-200 hover:bg-ink-50'
        "
        :aria-pressed="view.exploded"
        @click="view.exploded = !view.exploded"
      >
        <UiIcon name="layers" :size="15" />
        Qavatlarni ajratish
      </button>

      <template v-if="mode === 'interior'">
        <button
          v-for="l in LAYERS"
          :key="l.key"
          type="button"
          class="inline-flex h-9 items-center gap-1.5 rounded-field px-3 text-[12px] font-semibold ring-1 ring-inset transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          :class="
            view.layers[l.key]
              ? 'bg-brand-50 text-brand-700 ring-brand-300'
              : 'bg-surface text-ink-500 ring-ink-200 hover:bg-ink-50'
          "
          :aria-pressed="view.layers[l.key]"
          @click="toggleLayer(l.key)"
        >
          <UiIcon :name="view.layers[l.key] ? 'check' : 'x'" :size="14" />
          {{ l.label }}
        </button>
      </template>
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

    <p v-if="controls" class="mt-3 text-[12px] leading-relaxed text-ink-500">
      {{ modeHint }}
    </p>
    <p v-if="controls" class="mt-1 text-[12px] leading-relaxed text-ink-500">
      Ko‘rinishni tortib aylantiring, g‘ildirak bilan masshtabni o‘zgartiring, chapdagi relsdan
      qavat tanlang.
      <span v-if="selectedLevel"> Tanlangan: {{ selectedLevel.name }}.</span>
    </p>
    <p v-if="controls" class="mt-1 text-[12px] leading-relaxed text-ink-500">
      {{ envelopeNote }}
    </p>
  </div>
</template>
