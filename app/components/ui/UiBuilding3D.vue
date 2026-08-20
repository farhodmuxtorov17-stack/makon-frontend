<script setup lang="ts">
import { UNIT_STATUS_COLOR } from '~/constants/statuses'
import type { Building } from '~/data/buildings'
import {
  STRUCTURE_KIND,
  sitePlotOf,
  structuresOf,
  type Structure,
  type StructureKind,
} from '~/data/structures'
import { unitsOfBuilding, type Unit } from '~/data/units'
import { area as areaLabel } from '~/utils/format'
import { buildFloorPlan, type FloorPlan, type PlanRect } from '~/utils/floorPlan'

/**
 * Uchastka navigatori.
 *
 * Sahna bitta binoni emas, butun uchastkani ko‘rsatadi. Tarkib
 * `structuresOf()` dan keladi: asosiy bino yoki ombor bloklari, ma’muriy
 * bino, KPP, qozonxona, avtoturargohlar, konferens markaz, kafe va boshqa
 * qurilmalar. Har biri o‘z o‘rnida (`x`, `y`) va o‘z o‘lchamida (`width`,
 * `depth`, `height`) turadi, kamera esa `sitePlotOf()` bergan uchastka
 * to‘rtburchagiga moslashadi.
 *
 * Fasad chizilmaydi, MODELLASHTIRILADI. Har bir yuz mahalliy uch sonli
 * koordinatada quriladi: `u` yuz bo‘ylab metrda, `h` qavat asosidan
 * metrda, `z` esa devor tekisligidan chuqurlik. Musbat `z` ichkariga
 * (deraza chuqurchasi, kirish portali, yuk eshigi), manfiy `z` tashqariga
 * (mullion, tokcha, karniz, balkon) chiqadi. Proyeksiya bosqichi shu uch
 * sonni ekranga o‘tkazadi va chuqurlikdagi elementning yon qirralarini ham
 * chizadi, shuning uchun deraza yassi to‘rtburchak emas, chuqurchada
 * o‘tirgan bo‘lib ko‘rinadi: bir yon qirrasi yorug‘, ikkinchisi soyada.
 *
 * Binoning surati fasadga yopishtirilmaydi. U faqat ma’lumot manbai:
 * `samplePhoto()` uni kichik kadrga tushirib o‘rtacha ranglarini o‘lchaydi,
 * material paletasi shu o‘lchovga qarab suriladi. Shu sababli qizg‘ish
 * g‘ishtli bino iliq, ko‘k shishali minora sovuq tusda chiqadi, lekin
 * geometriya har doim modeldan quriladi.
 *
 * Interyer manbai bitta: `buildFloorPlan()`. Qavat kesib ochilganda o‘sha
 * generator chaqiriladi va 2D qavat rejasi bilan bir xil natija qaytadi:
 * tashqi devor, ichki bo‘linmalar, koridor, xizmat yadrosi, eshiklar va
 * deraza yo‘laklari.
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
 * Ish unumdorligi: kameradan bog‘liq bo‘lmagan hamma narsa (uchastka
 * tarkibi, hajmlar, fasad panellari, tashqi elementlar, interyer tartibi)
 * alohida memoizatsiya qilingan `computed` larda turadi. Kamera burilganda
 * faqat proyeksiya ishlaydi. Ko‘rinmaydigan yuz, ekrandan chiqqan qurilma
 * va ochilgan qavat ustidagi daraja umuman qurilmaydi, mayda tafsilot esa
 * masshtab kichrayganda o‘chadi.
 */

type ViewMode = 'occupancy' | 'interior' | 'wire'
type Family = 'tower' | 'retail' | 'shed' | 'resi'

/** Fasad retsepti: qurilma turi va bino klassidan tanlanadi */
type Skin =
  | 'curtain'
  | 'office'
  | 'mall'
  | 'shed'
  | 'resi'
  | 'pavilion'
  | 'service'
  | 'pad'
  | 'pit'

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
  alpha: number
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
  key: string
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

/** Uchastkadagi bitta qurilmaning chizilgan ko‘rinishi */
interface StructView {
  id: string
  name: string
  kindLabel: string
  host: boolean
  selected: boolean
  opacity: number
  slabs: SlabView[]
  /** Yassi maydon: avtoturargoh qoplamasi va joy chiziqlari */
  pad: Paint[]
  outline: string
  /** Kontur uzuq chiziqda: yer osti hajmi shu bilan ajraladi */
  dash: boolean
  tagX: number
  tagY: number
  tagW: number
  tagText: string
  aria: string
}

const props = withDefaults(
  defineProps<{
    building: Building
    /** Tanlangan qavat raqami, yer osti darajalari manfiy */
    floor?: number
    /** Tanlangan unit identifikatori */
    unit?: string
    /** Tanlangan qurilma identifikatori, bo‘sh bo‘lsa asosiy qurilma */
    structure?: string
    mode?: ViewMode
    /** Boshqaruv elementlari va izoh qatorini ko‘rsatish */
    controls?: boolean
    heightClass?: string
  }>(),
  {
    floor: 1,
    unit: '',
    structure: '',
    mode: 'occupancy',
    controls: true,
    heightClass: 'h-[360px] sm:h-[460px] lg:h-[540px] xl:h-[600px]',
  },
)

const emit = defineEmits<{
  (e: 'update:floor', value: number): void
  (e: 'update:unit', value: string): void
  (e: 'update:mode', value: ViewMode): void
  (e: 'update:structure', value: string): void
}>()

const { buildingTypeLabel, t, statusLabel, floorLabel } = useAppLabels()

const VW = 900
const VH = 620

const MODES = computed<Array<{ value: ViewMode; label: string; hint: string }>>(() => [
  { value: 'occupancy', label: t('ui.modeSite'), hint: t('ui.modeSiteHint') },
  { value: 'interior', label: t('ui.modeInterior'), hint: t('ui.modeInteriorHint') },
  { value: 'wire', label: t('ui.modeWire'), hint: t('ui.modeWireHint') },
])

const LAYERS = computed<Array<{ key: keyof Layers; label: string }>>(() => [
  { key: 'walls', label: t('ui.layerWallsDoors') },
  { key: 'windows', label: t('ui.layerWindows') },
  { key: 'core', label: t('ui.layerCore') },
])

/**
 * Holat legendasi. Rang va nom qavat rejasi bilan bitta jadvaldan olinadi,
 * shuning uchun 3D va 2D ko‘rinishda bir xil bo‘ladi.
 */
const CATEGORIES = computed<Array<{ key: string; label: string; color: string }>>(() => [
  { key: 'vacant', label: statusLabel('unit', 'VACANT'), color: UNIT_STATUS_COLOR.VACANT! },
  { key: 'rented', label: statusLabel('unit', 'RENTED'), color: UNIT_STATUS_COLOR.RENTED! },
  { key: 'sold', label: statusLabel('unit', 'SOLD'), color: UNIT_STATUS_COLOR.SOLD! },
  { key: 'reserved', label: statusLabel('unit', 'RESERVED'), color: UNIT_STATUS_COLOR.RESERVED! },
  { key: 'other', label: t('ui.catOther'), color: UNIT_STATUS_COLOR.MAINTENANCE! },
])

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
/** Xizmat qurilmasining lentasi: bandlik ma’nosi yo‘q, neytral qoladi */
const SERVICE_COLOR = '#B6C2D2'
/** Konstruktiv plita qalinligi, m */
const PLATE_T = 0.34

const FAMILY_OF: Record<string, Family> = {
  'Biznes markaz': 'tower',
  'Ofis binosi': 'tower',
  'Savdo markaz': 'retail',
  'Ombor / logistika': 'shed',
  'Turar joy': 'resi',
}

/** Qurilma turi qaysi fasad retseptini oladi */
const SKIN_OF_KIND: Record<StructureKind, Skin> = {
  main: 'office',
  warehouse: 'shed',
  admin: 'office',
  parkingSurface: 'pad',
  parkingUnderground: 'pit',
  checkpoint: 'service',
  boiler: 'service',
  cafe: 'pavilion',
  carwash: 'pavilion',
  conference: 'pavilion',
  gym: 'pavilion',
  retailPavilion: 'pavilion',
  utility: 'service',
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
  cornice: '#BAC6D6',
  plant: '#9DACC0',
  canopy: '#8496AC',
  column: '#A6B4C6',
  rail: '#B6C5D8',
  annex: '#C7D2E0',
  glass: '#8FB6DC',
  apron: '#A8B4C4',
  ramp: '#9EAAB9',
  stack: '#98A5B5',
  mark: '#E8EEF7',
}

/** Fasad materiallari: har bir retsept o‘z to‘plamini oladi */
interface Palette {
  wall: string
  wallAlt: string
  spandrel: string
  glass: string
  glassAlt: string
  glassDeep: string
  mullion: string
  metal: string
  base: string
  accent: string
  door: string
}

const SKINS: Skin[] = [
  'curtain',
  'office',
  'mall',
  'shed',
  'resi',
  'pavilion',
  'service',
  'pad',
  'pit',
]

const PALETTE: Record<Skin, Palette> = {
  curtain: {
    wall: '#C6D2E1',
    wallAlt: '#B7C5D8',
    spandrel: '#8CA1BC',
    glass: '#7CA6D0',
    glassAlt: '#96BBDF',
    glassDeep: '#5C80A7',
    mullion: '#8E9FB8',
    metal: '#AEBCCE',
    base: '#98A6B7',
    accent: '#3F6795',
    door: '#41576D',
  },
  office: {
    wall: '#D4DBE4',
    wallAlt: '#C2CBD8',
    spandrel: '#AEB9C8',
    glass: '#7A9DC1',
    glassAlt: '#8FB2D3',
    glassDeep: '#5B7A9B',
    mullion: '#A4B0C1',
    metal: '#B7C2D0',
    base: '#9CA8B6',
    accent: '#4E6D8E',
    door: '#44576A',
  },
  mall: {
    wall: '#DBE1EA',
    wallAlt: '#C6D0DD',
    spandrel: '#A7B4C5',
    glass: '#87B0D7',
    glassAlt: '#A2C5E5',
    glassDeep: '#6187AD',
    mullion: '#98A6B8',
    metal: '#B3BFCE',
    base: '#96A2B1',
    accent: '#2F6FBE',
    door: '#3B546C',
  },
  shed: {
    wall: '#C0C9D5',
    wallAlt: '#ADB8C5',
    spandrel: '#9AA6B4',
    glass: '#88A4BD',
    glassAlt: '#9AB5CB',
    glassDeep: '#688097',
    mullion: '#919EAD',
    metal: '#A5B1BE',
    base: '#8B96A2',
    accent: '#C2703A',
    door: '#5A697A',
  },
  resi: {
    wall: '#D9D1C6',
    wallAlt: '#CABFB1',
    spandrel: '#B9AE9F',
    glass: '#87A4C1',
    glassAlt: '#9CB8D1',
    glassDeep: '#66829E',
    mullion: '#AFA69A',
    metal: '#C1C8D0',
    base: '#A49A8C',
    accent: '#8A6A4C',
    door: '#695648',
  },
  pavilion: {
    wall: '#D2DAE5',
    wallAlt: '#C0CAD8',
    spandrel: '#A6B3C4',
    glass: '#84AACE',
    glassAlt: '#9CBFDE',
    glassDeep: '#5F84A9',
    mullion: '#94A2B4',
    metal: '#AFBBC9',
    base: '#98A4B2',
    accent: '#39769C',
    door: '#41586E',
  },
  service: {
    wall: '#CBD3DD',
    wallAlt: '#B9C2CF',
    spandrel: '#A6B0BE',
    glass: '#82A0BC',
    glassAlt: '#96B2CB',
    glassDeep: '#627E99',
    mullion: '#9AA6B4',
    metal: '#ACB8C5',
    base: '#8F9AA7',
    accent: '#4A657F',
    door: '#4C5D6E',
  },
  pad: {
    wall: '#B8C2CF',
    wallAlt: '#AAB5C3',
    spandrel: '#9EAAB8',
    glass: '#8FA8C0',
    glassAlt: '#9FB6CB',
    glassDeep: '#6F8699',
    mullion: '#9AA6B3',
    metal: '#AAB6C3',
    base: '#8F9AA6',
    accent: '#E8EEF7',
    door: '#57677A',
  },
  pit: {
    wall: '#AEB9C7',
    wallAlt: '#A1ACBB',
    spandrel: '#96A2B1',
    glass: '#8AA0B7',
    glassAlt: '#98AEC3',
    glassDeep: '#6B8194',
    mullion: '#93A0AF',
    metal: '#A3AFBD',
    base: '#8A95A2',
    accent: '#5D7086',
    door: '#4F6072',
  },
}

/**
 * Fotosuratning fasad oynasi: surat kengligi va balandligining ulushida.
 *
 * Reyestrdagi suratlarda bino kadr o‘rtasida turadi, tepasida osmon, pastida
 * yo‘l yoki maydoncha bo‘ladi. Rang o‘lchovi butun kadrdan emas, faqat shu
 * oynadan olinadi, aks holda o‘rtacha rangga osmon va asfalt qo‘shilib
 * ketardi. Chegaralar bino oilasi bo‘yicha tanlangan.
 */
const PHOTO_CROP: Record<Family, { u0: number; u1: number; v0: number; v1: number }> = {
  tower: { u0: 0.3, u1: 0.72, v0: 0.42, v1: 0.72 },
  retail: { u0: 0.42, u1: 0.9, v0: 0.35, v1: 0.62 },
  shed: { u0: 0.26, u1: 0.74, v0: 0.42, v1: 0.6 },
  resi: { u0: 0.46, u1: 0.88, v0: 0.26, v1: 0.68 },
}

/** Yorug‘lik yo‘nalishi qat’iy: har bir uchastkada soya bir xil o‘qiladi */
const SUN = (() => {
  const az = (-36 * Math.PI) / 180
  const el = (49 * Math.PI) / 180
  const ce = Math.cos(el)
  return { x: Math.sin(az) * ce, y: -Math.cos(az) * ce, z: Math.sin(el) }
})()

const START_ROTATION = 34
const START_TILT = 30

/**
 * Tafsilot chegarasi. Bir metr ekranda shuncha pikseldan kam joy egallasa
 * deraza chuqurchasi va mullion baribir ko‘rinmaydi, shuning uchun ular
 * chizilmaydi va o‘rniga bitta lenta qoladi.
 */
const DETAIL_MIN_PX = 3.6
/**
 * Tortish paytidagi yuza byudjeti. Fasad tafsiloti shu chegaradan oshsa,
 * kamera harakatlanayotganda soddalashtirilgan ko‘rinish chiziladi va
 * qo‘yib yuborilgach to‘liq tafsilot qaytadi. Chegara o‘lchov bilan
 * tanlangan: shu narxdan past uchastka tortilayotganda ham bir kadrni
 * o‘n millisekunddan tez quradi.
 */
const DETAIL_BUDGET = 800

const view = reactive({
  rotation: START_ROTATION,
  tilt: START_TILT,
  zoom: 1,
  exploded: false,
  layers: { walls: true, windows: true, core: true } as Layers,
})

const hovered = ref<number | null>(null)
const hoveredUnit = ref('')
const hoveredStruct = ref('')
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

function rgbOf(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function hexOf(r: number, g: number, b: number) {
  const c = (v: number) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`
}

/** Ikki rangni aralashtiradi: t = 0 birinchi rang, t = 1 ikkinchi rang */
function mixHex(a: string, b: string, t: number) {
  const p = rgbOf(a)
  const q = rgbOf(b)
  const k = clamp(t, 0, 1)
  return hexOf(p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k, p[2] + (q[2] - p[2]) * k)
}

/** To‘yinganlikni pasaytiradi: qurilish materiali kamdan-kam yorqin bo‘ladi */
function mute(hex: string, k: number) {
  const [r, g, b] = rgbOf(hex)
  const y = 0.299 * r + 0.587 * g + 0.114 * b
  return hexOf(r + (y - r) * k, g + (y - g) * k, b + (y - b) * k)
}

/** Yorqinlikni belgilangan oraliqqa keltiradi: fasad na qora, na oqarib ketadi */
function levelTo(hex: string, lo: number, hi: number) {
  const [r, g, b] = rgbOf(hex)
  const y = 0.299 * r + 0.587 * g + 0.114 * b
  const want = clamp(y, lo, hi)
  if (y < 1) return hexOf(want, want, want)
  const k = want / y
  return hexOf(r * k, g * k, b * k)
}


/* ==========================================================================
   Surat: faqat rang manbai. Kadr kichik holatda o‘qiladi va uchta tus
   ajratiladi: yorug‘ qoplama, o‘rtacha tus va to‘q oyna. Material paletasi
   shu o‘lchov tomon suriladi, geometriya esa har doim modeldan quriladi.
   ========================================================================== */

interface PhotoTone {
  light: string
  mid: string
  dark: string
}

const photoTone = ref<PhotoTone | null>(null)

const photoSrc = computed(() =>
  props.building.photo ? assetUrl(`img/${props.building.photo}-md.webp`) : '',
)

function samplePhoto(src: string, crop: { u0: number; u1: number; v0: number; v1: number }) {
  photoTone.value = null
  if (!src || typeof document === 'undefined') return

  const img = new Image()
  img.decoding = 'async'
  img.onload = () => {
    try {
      const side = 36
      const canvas = document.createElement('canvas')
      canvas.width = side
      canvas.height = side
      const ctx = canvas.getContext('2d')
      if (!ctx || !img.naturalWidth || !img.naturalHeight) return
      ctx.drawImage(
        img,
        img.naturalWidth * crop.u0,
        img.naturalHeight * crop.v0,
        img.naturalWidth * (crop.u1 - crop.u0),
        img.naturalHeight * (crop.v1 - crop.v0),
        0,
        0,
        side,
        side,
      )
      const data = ctx.getImageData(0, 0, side, side).data
      const pix: Array<{ y: number; r: number; g: number; b: number }> = []
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i] ?? 0
        const g = data[i + 1] ?? 0
        const b = data[i + 2] ?? 0
        pix.push({ y: 0.299 * r + 0.587 * g + 0.114 * b, r, g, b })
      }
      if (pix.length < 16) return
      pix.sort((p, q) => p.y - q.y)

      /** Yorqinlik bo‘yicha saralangan qatordan bir bo‘lakning o‘rtacha rangi */
      const band = (a: number, b: number) => {
        const i0 = Math.floor(pix.length * a)
        const i1 = Math.max(i0 + 1, Math.floor(pix.length * b))
        let r = 0
        let g = 0
        let bl = 0
        for (let i = i0; i < i1; i++) {
          const p = pix[i]!
          r += p.r
          g += p.g
          bl += p.b
        }
        const n = i1 - i0
        return hexOf(r / n, g / n, bl / n)
      }

      // To‘yinganlik pasaytiriladi va yorqinlik oraliqqa keltiriladi: aks
      // holda kechki suratdan olingan rang butun uchastkani qoraytirib
      // yuborardi, quyoshli suratdan olingani esa oqartirib yuborardi
      photoTone.value = {
        light: levelTo(mute(band(0.68, 0.94), 0.45), 168, 224),
        mid: levelTo(mute(band(0.4, 0.64), 0.4), 132, 196),
        dark: levelTo(mute(band(0.1, 0.32), 0.3), 82, 148),
      }
    } catch {
      // Kadrni o‘qib bo‘lmasa asosiy palitra qoladi
      photoTone.value = null
    }
  }
  img.onerror = () => {
    photoTone.value = null
  }
  img.src = src
}

const allUnits = computed(() => unitsOfBuilding(props.building.id))
const family = computed<Family>(() => FAMILY_OF[props.building.type] ?? 'tower')
/** A klass: to‘liq shisha fasad. B va C: panjarali deraza va spandrel */
const glazed = computed(() => /^\s*a/i.test(props.building.buildingClass))

/** Asosiy binoning fasad retsepti: bino turi va klassi hal qiladi */
const mainSkin = computed<Skin>(() => {
  const fam = family.value
  if (fam === 'retail') return 'mall'
  if (fam === 'shed') return 'shed'
  if (fam === 'resi') return 'resi'
  return glazed.value ? 'curtain' : 'office'
})

watch([photoSrc, family], ([src, fam]) => samplePhoto(src, PHOTO_CROP[fam]), { immediate: true })

/**
 * Material paletasi. Asosiy qurilma suratdagi rangga kuchliroq, qolgan
 * qurilmalar zaifroq suriladi: shunda uchastka bitta majmua bo‘lib
 * o‘qiladi, lekin KPP yoki qozonxona asosiy binoning nusxasiga aylanmaydi.
 */
const palettes = computed<Record<Skin, Palette>>(() => {
  const tone = photoTone.value
  const lead = mainSkin.value
  const out = {} as Record<Skin, Palette>
  for (const key of SKINS) {
    const base = PALETTE[key]
    if (!tone) {
      out[key] = base
      continue
    }
    const k = key === lead ? 0.5 : 0.2
    out[key] = {
      wall: mixHex(base.wall, tone.light, k),
      wallAlt: mixHex(base.wallAlt, tone.mid, k),
      spandrel: mixHex(base.spandrel, tone.mid, k * 0.8),
      glass: mixHex(base.glass, tone.dark, k * 0.7),
      glassAlt: mixHex(base.glassAlt, tone.mid, k * 0.5),
      glassDeep: mixHex(base.glassDeep, tone.dark, k * 0.85),
      mullion: mixHex(base.mullion, tone.mid, k * 0.6),
      metal: mixHex(base.metal, tone.light, k * 0.5),
      base: mixHex(base.base, tone.mid, k * 0.6),
      accent: base.accent,
      door: base.door,
    }
  }
  return out
})

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

    const mix: MixItem[] = CATEGORIES.value.map((c) => {
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

    let label = t('ui.planNotEntered')
    if (units.length) {
      if (!vacant.length) label = t('ui.fullyOccupied')
      else if (vacant.length === units.length) label = t('ui.fullyVacant')
      else label = t('ui.partlyVacant')
    }

    return {
      floor,
      index,
      // Yer osti darajasi manfiy raqamda turadi, nomi esa tizimning qolgan
      // qismidagi kabi yoziladi: -1 → «1-yer osti qavati»
      name:
        floor < 0
          ? t('unitOf.floorUnderground', { floor: -floor })
          : floorLabel(floor),
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

/** Butun uchastka bo‘yicha holatlar ulushi: unit reyestri yo‘q qurilmalarga */
const siteMix = computed<MixItem[]>(() => {
  const mix: MixItem[] = CATEGORIES.value.map((c) => {
    const own = allUnits.value.filter((u) => (CATEGORY_OF[u.status] ?? 'other') === c.key)
    return {
      key: c.key,
      label: c.label,
      color: c.color,
      count: own.length,
      area: own.reduce((s, u) => s + u.area, 0),
      share: 0,
    }
  }).filter((m) => m.count > 0)
  const total = mix.reduce((s, m) => s + m.area, 0)
  for (const m of mix) m.share = total ? m.area / total : 1 / mix.length
  return mix
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

/* ==========================================================================
   Uchastka tarkibi: har bir qurilma dunyo koordinatasidagi to‘rtburchakka
   o‘tkaziladi. Uchastka markazi koordinata boshi bo‘ladi, shuning uchun
   kamera burilganda sahna joyida qoladi. Reja o‘qi pastga, dunyo o‘qi
   yuqoriga qaraydi, shu sababli y teskari o‘giriladi.
   ========================================================================== */

interface SiteItem {
  s: Structure
  id: string
  kind: StructureKind
  kindLabel: string
  kindShort: string
  name: string
  leasable: boolean
  skin: Skin
  host: boolean
  x0: number
  y0: number
  x1: number
  y1: number
  cx: number
  cy: number
  w: number
  d: number
  floors: number
  under: number
  storey: number
  height: number
}

const site = computed(() => {
  const b = props.building
  const list = structuresOf(b.id)
  const plot = sitePlotOf(b.id)
  const hx = plot.width / 2
  const hy = plot.depth / 2

  /*
   * Qavat relsi, unit konturlari va interyer bitta qurilmaga biriktiriladi:
   * asosiy binoga, ombor uchastkasida esa eng katta blokka. Reyestrdagi
   * unitlar aynan o‘sha hajmga tegishli.
   */
  let hostId = ''
  const main = list.find((s) => s.kind === 'main')
  if (main) {
    hostId = main.id
  } else {
    let best = 0
    for (const s of list) {
      if (!STRUCTURE_KIND[s.kind].leasable) continue
      const size = s.width * s.depth * Math.max(s.floors, 1)
      if (size > best) {
        best = size
        hostId = s.id
      }
    }
  }

  const items: SiteItem[] = list.map((s) => {
    const meta = STRUCTURE_KIND[s.kind]
    const floors = Math.max(s.floors, 0)
    return {
      s,
      id: s.id,
      kind: s.kind,
      kindLabel: meta.label,
      kindShort: meta.short,
      name: s.name,
      leasable: meta.leasable,
      skin: s.kind === 'main' ? mainSkin.value : SKIN_OF_KIND[s.kind],
      host: s.id === hostId,
      x0: s.x - hx,
      x1: s.x + s.width - hx,
      y0: hy - (s.y + s.depth),
      y1: hy - s.y,
      cx: s.x + s.width / 2 - hx,
      cy: hy - (s.y + s.depth / 2),
      w: s.width,
      d: s.depth,
      floors,
      under: s.undergroundFloors,
      storey: floors > 0 ? s.height / floors : s.height,
      height: s.height,
    }
  })

  return { plot, items, hostId }
})

const hostItem = computed(() => site.value.items.find((i) => i.host) ?? null)

/** Tanlangan qurilma: tashqaridan boshqarilmasa ichki holat ishlaydi */
const innerStruct = ref('')
const activeStructId = computed(() => {
  const wanted = props.structure || innerStruct.value
  const items = site.value.items
  if (wanted && items.some((i) => i.id === wanted)) return wanted
  return site.value.hostId || items[0]?.id || ''
})
const activeStruct = computed(
  () => site.value.items.find((i) => i.id === activeStructId.value) ?? null,
)

/* ==========================================================================
   Hajm: har bir qurilmaning darajalari. Asosiy qurilmada darajalar unit
   reyestridan chiqadi va yer osti qavatlari ham bo‘ladi, qolganlarida esa
   qavat soni va balandligi uchastka ma’lumotidan olinadi.
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

interface VolumeGeom {
  item: SiteItem
  rows: LevelInfo[]
  levels: LevelGeom[]
  topZ: number
  botZ: number
}

/** Unit reyestri yo‘q qurilma uchun soddalashtirilgan daraja yozuvi */
function plainRow(item: SiteItem, i: number, mix: MixItem[]): LevelInfo {
  return {
    floor: i + 1,
    index: i,
    name: floorLabel(i + 1),
    short: String(i + 1),
    underground: false,
    units: [],
    total: 0,
    totalArea: 0,
    vacantCount: 0,
    vacantArea: 0,
    occupancy: 0,
    mix: item.leasable ? mix : [],
    label: item.kindLabel,
  }
}

const volumes = computed<VolumeGeom[]>(() => {
  const s = site.value
  const lv = levels.value
  const b = props.building
  const fam = family.value
  const mix = siteMix.value
  const out: VolumeGeom[] = []

  for (const item of s.items) {
    if (item.skin === 'pad') {
      out.push({ item, rows: [], levels: [], topZ: Math.max(item.height, 0.2), botZ: 0 })
      continue
    }
    if (item.skin === 'pit') {
      // Yer osti avtoturargohi: yer sathidan pastda, chuqurligi daraja soniga bog‘liq
      const pitZ = Math.max(item.under, 1) * 3.2
      out.push({ item, rows: [], levels: [], topZ: 0.12, botZ: -pitZ })
      continue
    }

    if (item.host && lv.length) {
      const ug = b.undergroundFloors
      /*
       * Qavat balandligi uchastka ma’lumotidagi hajm balandligidan chiqadi,
       * lekin bo‘luvchi reyestrdagi yer usti qavatlari soni bo‘ladi: unit
       * kiritilgan har bir qavat chizilishi kerak, hajm esa ma’lumotdagi
       * balandlikdan oshib ketmasligi kerak.
       */
      const rawStorey = item.height / Math.max(b.floors, 1)
      const storey = rawStorey > 1 ? rawStorey : item.storey > 1 ? item.storey : 3.4
      const groundK = fam === 'shed' ? 1.04 : 1.3
      const above = Math.max(b.floors, 1)
      /** Turar joyda pog‘ona shu qavatdan boshlanadi */
      const stepFrom = Math.max(2, Math.round(above * 0.62))
      const lastIndex = lv.length - 1
      const geom: LevelGeom[] = []
      let z = -ug * storey

      for (let i = 0; i < lv.length; i++) {
        const info = lv[i]!
        const under = info.floor < 0
        const ground = i === ug
        const top = i === lastIndex
        const h = under ? storey : ground ? storey * groundK : storey

        let w = item.w
        let d = item.d
        let oy = item.cy

        if (under) {
          // Yer osti darajasi tayanch konturdan kengroq: parkovka plitasi
          w = item.w * 1.06
          d = item.d * 1.06
        } else {
          const j = i - ug
          if (fam === 'resi' && j >= stepFrom) {
            const t = clamp((j - stepFrom + 1) / Math.max(above - stepFrom, 1), 0, 1)
            d = item.d * (1 - 0.22 * t)
            oy = item.cy + (d - item.d) / 2
            w = item.w * (1 - 0.07 * t)
          } else if (fam === 'tower' && top && above > 3) {
            w = item.w * 0.94
            d = item.d * 0.94
          } else if (fam === 'retail' && top && above > 2) {
            w = item.w * 0.96
            d = item.d * 0.96
          }
        }

        geom.push({ floor: info.floor, i, z0: z, h, w, d, ox: item.cx, oy, ground, under, top })
        z += h
      }

      const last = geom[geom.length - 1]
      out.push({
        item,
        rows: lv,
        levels: geom,
        topZ: last ? last.z0 + last.h : item.height,
        botZ: -ug * storey,
      })
      continue
    }

    const floors = Math.max(item.floors, 1)
    const storey = item.height / floors
    const rows: LevelInfo[] = []
    const geom: LevelGeom[] = []
    for (let i = 0; i < floors; i++) {
      rows.push(plainRow(item, i, mix))
      geom.push({
        floor: i + 1,
        i,
        z0: i * storey,
        h: storey,
        w: item.w,
        d: item.d,
        ox: item.cx,
        oy: item.cy,
        ground: i === 0,
        under: false,
        top: i === floors - 1,
      })
    }
    out.push({ item, rows, levels: geom, topZ: item.height, botZ: 0 })
  }

  return out
})

const hostIndex = computed(() => volumes.value.findIndex((v) => v.item.host))
const selectedIndex = computed(() => levels.value.findIndex((l) => l.floor === props.floor))
const selectedLevel = computed(() => levels.value[selectedIndex.value])
const hoveredLevel = computed(() => levels.value.find((l) => l.floor === hovered.value))

/** Tanlangan qavat kesib ochiladimi: faqat asosiy qurilmada ishlaydi */
const cutaway = computed(
  () => props.mode === 'interior' && selectedIndex.value >= 0 && hostIndex.value >= 0,
)

/* ==========================================================================
   Fasad modeli.

   Yuz mahalliy koordinatada quriladi: `u` yuz bo‘ylab metrda, `h` qavat
   asosidan metrda, `z` devor tekisligidan chuqurlik. Har bir panel alohida
   geometriya: qavat lentasi, spandrel, mullion foni, oyna, deraza tokchasi,
   kirish portali, yuk eshigi, balkon. Chuqurlikdagi panelning yon qirralari
   ham chiziladi, shuning uchun deraza yassi to‘rtburchak emas.

   Chizish tartibi qatlam raqami bilan beriladi: avval yassi qoplama, so‘ng
   chuqurchadagi oyna, keyin tashqariga chiqqan profil va oxirida balkon
   kabi yirik qo‘shimchalar. Shu tartib qurilish paytida bir marta
   hisoblanadi, kamera burilganda esa qayta saralash kerak bo‘lmaydi.
   ========================================================================== */

/** Chizish qatlami: kichik raqam avval chiziladi */
const F_BASE = 0
const F_OPEN = 1
const F_OUT = 2
const F_ADD = 3

interface FacePane {
  u0: number
  u1: number
  h0: number
  h1: number
  /** Devor tekisligidan chuqurlik. Musbat ichkariga, manfiy tashqariga */
  z: number
  tone: string
  lay: number
  /** 1 bo‘lsa yon qirralar chiziladi va panel hajmli ko‘rinadi */
  edge: number
  /** 1 bo‘lsa h0 sathida gorizontal tokcha chiziladi: balkon poli, karniz */
  ledge: number
  /** 1 bo‘lsa bandlik ulushlari bilan bo‘yaladi */
  occ: number
  /** 0 hamma masshtabda, 1 faqat yaqin, 2 faqat uzoq ko‘rinishda */
  lod: number
}

interface PaneOpt {
  z?: number
  lay?: number
  edge?: number
  ledge?: number
  occ?: number
  lod?: number
}

interface FaceCtx {
  skin: Skin
  pal: Palette
  len: number
  h: number
  face: number
  row: number
  ground: boolean
  top: boolean
  /** Kirish guruhi shu yuzga tushadi */
  front: boolean
  /** Uzun yuz: balkon qatori va yuk eshiklari shu tomonda bo‘ladi */
  long: boolean
  showOcc: boolean
  occTone: string
  bays: Array<[number, number]> | null
}

function addPane(
  out: FacePane[],
  u0: number,
  u1: number,
  h0: number,
  h1: number,
  tone: string,
  o: PaneOpt = {},
) {
  if (u1 - u0 < 0.06 || h1 - h0 < 0.04) return
  out.push({
    u0,
    u1,
    h0,
    h1,
    z: o.z ?? 0,
    tone,
    lay: o.lay ?? F_BASE,
    edge: o.edge ?? 0,
    ledge: o.ledge ?? 0,
    occ: o.occ ?? 0,
    lod: o.lod ?? 0,
  })
}

/** Deraza qadamini yuz uzunligiga tekis bo‘ladi */
function grid(len: number, mod: number, gap: number): Array<[number, number]> {
  const n = Math.max(1, Math.round(len / mod))
  const pitch = len / n
  const out: Array<[number, number]> = []
  for (let i = 0; i < n; i++) {
    const a = i * pitch + gap / 2
    const b = (i + 1) * pitch - gap / 2
    if (b - a > 0.12) out.push([a, b])
  }
  return out
}

/**
 * Oynaning tusi. Qo‘shni oynalar bir xil bo‘lsa fasad yassi chiqadi,
 * shuning uchun aks etish farqi qat’iy naqsh bilan beriladi: tasodif yo‘q,
 * shu sababli kamera burilganda ham naqsh o‘zgarmaydi.
 */
function glassTone(pal: Palette, i: number, row: number) {
  const k = (i * 5 + row * 3) % 7
  if (k === 0 || k === 4) return pal.glassAlt
  if (k === 6) return pal.glassDeep
  return pal.glass
}

/**
 * Qavat lentasi balandligi. Qavat balandligining o‘ndan biri: bandlik
 * ranglari uzoqdan ham o‘qiladi, lekin fasad naqshini bosib ketmaydi.
 */
function bandOf(h: number) {
  return clamp(h * 0.1, 0.24, 0.5)
}

/**
 * Qavat lentasi. Har bir qavatning ustki qirrasida turadi, shuning uchun
 * ikki lenta orasidagi masofa aynan qavat balandligiga teng. Ijaraga
 * beriladigan qurilmada lenta bandlik ulushlariga bo‘linadi.
 */
function slabBand(c: FaceCtx, out: FacePane[], bandH: number) {
  addPane(out, 0, c.len, c.h - bandH, c.h, c.occTone, {
    z: -0.12,
    lay: F_OUT,
    edge: 1,
    occ: c.showOcc ? 1 : 0,
  })
}

/** Kirish qavati: tsokol, vitrina va kirish portali */
function faceStorefront(c: FaceCtx, out: FacePane[], hh: number) {
  const { pal, len } = c
  const plinth = Math.min(0.5, hh * 0.1)
  const head = hh * 0.88
  addPane(out, 0, len, 0, plinth, pal.base, { z: -0.07, lay: F_OUT, edge: 1 })
  addPane(out, 0, len, plinth, hh, pal.mullion, { z: 0.07 })
  addPane(out, 0, len, head, hh, pal.wall, { z: 0.03 })

  const cells = grid(len, c.skin === 'mall' ? 4.4 : 3.2, 0.26)
  const mid = Math.floor(cells.length / 2)
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i]!
    const entry = c.front && (i === mid || (cells.length > 4 && i === mid - 1))
    if (entry) {
      // Kirish portali yuzdan chuqurroq o‘tiradi, ichida eshik qanotlari turadi
      addPane(out, cell[0], cell[1], 0.04, head, pal.glassDeep, { z: 0.62, lay: F_OPEN, edge: 1 })
      const half = (cell[1] - cell[0]) / 2
      addPane(out, cell[0] + 0.18, cell[0] + half - 0.05, 0.04, head * 0.72, pal.door, {
        z: 0.56,
        lay: F_OPEN,
        lod: 1,
      })
      addPane(out, cell[0] + half + 0.05, cell[1] - 0.18, 0.04, head * 0.72, pal.door, {
        z: 0.56,
        lay: F_OPEN,
        lod: 1,
      })
    } else {
      addPane(out, cell[0], cell[1], plinth, head, glassTone(pal, i, c.row), {
        z: 0.24,
        lay: F_OPEN,
        edge: 1,
      })
    }
  }
}

/** A klass minora: to‘liq shisha fasad, tor va tez qadam, ingichka mullion */
function faceCurtain(c: FaceCtx, out: FacePane[]) {
  const { pal, len, h } = c
  const bandH = bandOf(h)
  const hh = h - bandH
  if (c.ground) {
    faceStorefront(c, out, hh)
    slabBand(c, out, bandH)
    return
  }

  const sill = hh * 0.2
  const head = hh * 0.97
  // Spandrel: plita oldidagi to‘siq paneli
  addPane(out, 0, len, 0, sill, pal.spandrel, { z: 0.05 })
  // Oynalar orasidagi vertikal profil shu fondan ko‘rinadi
  addPane(out, 0, len, sill, head, pal.mullion, { z: 0.08 })
  addPane(out, 0, len, head, hh, pal.wallAlt, { z: 0.03 })

  const cells = grid(len, 1.5, 0.15)
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i]!
    addPane(out, cell[0], cell[1], sill + 0.06, head - 0.05, glassTone(pal, i, c.row), {
      z: 0.16,
      lay: F_OPEN,
      edge: 1,
      lod: 1,
    })
  }
  addPane(out, 0.18, len - 0.18, sill + 0.06, head - 0.05, pal.glass, {
    z: 0.13,
    lay: F_OPEN,
    lod: 2,
  })
  // Ko‘ndalang bog‘lam: oyna maydonini ikkiga bo‘ladi
  const tr = sill + (head - sill) * 0.58
  addPane(out, 0, len, tr, tr + 0.1, pal.metal, { z: -0.08, lay: F_OUT, lod: 1 })
  slabBand(c, out, bandH)
}

/** B va C klass ofis: panjarali teshik deraza, chuqur yon qirra va tokcha */
function faceOffice(c: FaceCtx, out: FacePane[]) {
  const { pal, len, h } = c
  const bandH = bandOf(h)
  const hh = h - bandH
  if (c.ground) {
    faceStorefront(c, out, hh)
    slabBand(c, out, bandH)
    return
  }

  const sill = clamp(hh * 0.26, 0.7, 1.15)
  const head = hh * 0.9
  const cells = c.bays && c.bays.length ? c.bays : grid(len, 2.8, 1.05)
  addPane(out, 0, len, 0, hh, pal.wall, { z: 0.03 })

  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i]!
    const a = clamp(cell[0], 0, len)
    const b = clamp(cell[1], 0, len)
    if (b - a < 0.4) continue
    addPane(out, a, b, sill, head, glassTone(pal, i, c.row), { z: 0.3, lay: F_OPEN, edge: 1 })
    addPane(out, a - 0.1, b + 0.1, sill - 0.14, sill, pal.base, {
      z: -0.11,
      lay: F_OUT,
      edge: 1,
      lod: 1,
    })
    addPane(out, a - 0.1, b + 0.1, head, head + 0.14, pal.wallAlt, {
      z: -0.05,
      lay: F_OUT,
      lod: 1,
    })
  }
  slabBand(c, out, bandH)
}

/** Savdo markaz: kassetali qoplama, keng vitrina lentasi va reklama paneli */
function faceMall(c: FaceCtx, out: FacePane[]) {
  const { pal, len, h } = c
  const bandH = bandOf(h)
  const hh = h - bandH
  if (c.ground) {
    faceStorefront(c, out, hh)
    slabBand(c, out, bandH)
    return
  }

  const sill = hh * 0.26
  const head = hh * 0.76
  addPane(out, 0, len, 0, hh, pal.wall, { z: 0.05, lod: 2 })
  const cass = grid(len, 2.6, 0.1)
  for (let i = 0; i < cass.length; i++) {
    const cell = cass[i]!
    addPane(out, cell[0], cell[1], 0, hh, i % 2 ? pal.wall : pal.wallAlt, { z: 0.05, lod: 1 })
  }

  addPane(out, 0, len, sill, head, pal.mullion, { z: 0.09 })
  const cells = grid(len, 3.6, 0.2)
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i]!
    addPane(out, cell[0], cell[1], sill + 0.06, head - 0.06, glassTone(pal, i, c.row), {
      z: 0.22,
      lay: F_OPEN,
      edge: 1,
    })
  }
  if (c.front && c.top) {
    const sh = Math.min(1.3, hh * 0.16)
    addPane(out, len * 0.1, len * 0.46, head + 0.3, head + 0.3 + sh, pal.accent, {
      z: -0.18,
      lay: F_OUT,
      edge: 1,
    })
  }
  slabBand(c, out, bandH)
}

/** Ombor bloki: profilli qoplama, tepada lenta deraza, pastda yuk eshiklari */
function faceShed(c: FaceCtx, out: FacePane[]) {
  const { pal, len, h } = c
  const bandH = clamp(h * 0.06, 0.24, 0.5)
  const hh = h - bandH
  const plinth = Math.min(1.1, hh * 0.14)
  addPane(out, 0, len, 0, plinth, pal.base, { z: -0.06, lay: F_OUT, edge: 1 })
  addPane(out, 0, len, plinth, hh, pal.wall, { z: 0.04 })

  // Profilli qoplama: vertikal qovurg‘alar
  const ribs = clamp(Math.round(len / 1.7), 3, 56)
  for (let i = 1; i < ribs; i++) {
    const x = (len * i) / ribs
    addPane(out, x - 0.055, x + 0.055, plinth, hh, pal.wallAlt, {
      z: -0.07,
      lay: F_OUT,
      lod: 1,
    })
  }

  // Tepadagi lenta deraza: omborda deraza kam va keng bo‘ladi
  const w0 = hh * 0.72
  const w1 = hh * 0.87
  addPane(out, 0.7, len - 0.7, w0, w1, pal.mullion, { z: 0.08 })
  const strip = grid(len - 1.4, 4.4, 0.22)
  for (let i = 0; i < strip.length; i++) {
    const cell = strip[i]!
    addPane(out, cell[0] + 0.7, cell[1] + 0.7, w0 + 0.06, w1 - 0.06, glassTone(pal, i, c.row), {
      z: 0.18,
      lay: F_OPEN,
      edge: 1,
      lod: 1,
    })
  }
  addPane(out, 0.8, len - 0.8, w0 + 0.06, w1 - 0.06, pal.glass, { z: 0.14, lay: F_OPEN, lod: 2 })

  if (c.ground && c.long) {
    const n = clamp(Math.round(len / 9.5), 2, 8)
    const step = len / n
    const dw = Math.min(3.6, step * 0.5)
    const dh = Math.min(4.6, hh * 0.62)
    for (let i = 0; i < n; i++) {
      const cc = (i + 0.5) * step
      addPane(out, cc - dw / 2, cc + dw / 2, plinth, dh, pal.door, {
        z: 0.36,
        lay: F_OPEN,
        edge: 1,
      })
      // Seksiyali eshik panellari
      for (let k = 1; k < 4; k++) {
        const y = plinth + ((dh - plinth) * k) / 4
        addPane(out, cc - dw / 2 + 0.06, cc + dw / 2 - 0.06, y - 0.045, y + 0.045, pal.metal, {
          z: 0.32,
          lay: F_OPEN,
          lod: 1,
        })
      }
      // Rezina buferlar
      addPane(out, cc - dw / 2 - 0.26, cc - dw / 2 - 0.05, plinth, plinth + 1.1, pal.accent, {
        z: -0.14,
        lay: F_OUT,
        edge: 1,
        lod: 1,
      })
      addPane(out, cc + dw / 2 + 0.05, cc + dw / 2 + 0.26, plinth, plinth + 1.1, pal.accent, {
        z: -0.14,
        lay: F_OUT,
        edge: 1,
        lod: 1,
      })
    }
  }
  if (c.ground && c.front) {
    addPane(out, 1.1, 2.3, 0, Math.min(2.2, hh * 0.7), pal.door, { z: 0.18, lay: F_OPEN, edge: 1 })
  }
  slabBand(c, out, bandH)
}

/** Turar joy: g‘isht qoplama, tokchali deraza va balkon qatorlari */
function faceResi(c: FaceCtx, out: FacePane[]) {
  const { pal, len, h } = c
  const bandH = bandOf(h)
  const hh = h - bandH
  if (c.ground) {
    faceStorefront(c, out, hh)
    slabBand(c, out, bandH)
    return
  }

  const sill = clamp(hh * 0.3, 0.8, 1.2)
  const head = hh * 0.88
  const cells = c.bays && c.bays.length ? c.bays : grid(len, 3.2, 1.15)
  addPane(out, 0, len, 0, hh, pal.wall, { z: 0.03 })

  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i]!
    const a = clamp(cell[0], 0, len)
    const b = clamp(cell[1], 0, len)
    if (b - a < 0.4) continue
    addPane(out, a, b, sill, head, glassTone(pal, i, c.row), { z: 0.28, lay: F_OPEN, edge: 1 })
    addPane(out, a - 0.12, b + 0.12, sill - 0.15, sill, pal.base, {
      z: -0.12,
      lay: F_OUT,
      edge: 1,
      lod: 1,
    })
  }

  // Balkon qatorlari: uzun yuzlarda har ikkinchi katak
  if (c.long) {
    const bz = Math.min(sill * 0.3, 0.4)
    for (let i = 0; i < cells.length; i += 2) {
      const cell = cells[i]!
      const a = clamp(cell[0] - 0.55, 0, len)
      const b = clamp(cell[1] + 0.55, 0, len)
      if (b - a < 1) continue
      addPane(out, a, b, bz, bz + 1.15, pal.metal, {
        z: -1.35,
        lay: F_ADD,
        edge: 1,
        ledge: 1,
      })
    }
  }
  slabBand(c, out, bandH)
}

/** Pavilyon: bir qavatli shisha hajm, kirish o‘rtada */
function facePavilion(c: FaceCtx, out: FacePane[]) {
  const { pal, len, h } = c
  const bandH = clamp(h * 0.16, 0.32, 0.7)
  const hh = h - bandH
  const plinth = Math.min(0.4, hh * 0.12)
  addPane(out, 0, len, 0, plinth, pal.base, { z: -0.06, lay: F_OUT, edge: 1 })
  addPane(out, 0, len, plinth, hh, pal.mullion, { z: 0.07 })

  const cells = grid(len, 2.6, 0.18)
  const mid = Math.floor(cells.length / 2)
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i]!
    if (c.front && i === mid) {
      addPane(out, cell[0], cell[1], 0.04, hh * 0.86, pal.door, { z: 0.34, lay: F_OPEN, edge: 1 })
    } else {
      addPane(out, cell[0], cell[1], plinth, hh, glassTone(pal, i, c.row), {
        z: 0.2,
        lay: F_OPEN,
        edge: 1,
      })
    }
  }
  slabBand(c, out, bandH)
}

/** Xizmat qurilmasi: KPP, qozonxona va texnik blok. Devor yopiq, deraza kam */
function faceService(c: FaceCtx, out: FacePane[]) {
  const { pal, len, h } = c
  const bandH = clamp(h * 0.14, 0.26, 0.5)
  const hh = h - bandH
  const plinth = Math.min(0.5, hh * 0.16)
  addPane(out, 0, len, 0, plinth, pal.base, { z: -0.06, lay: F_OUT, edge: 1 })
  addPane(out, 0, len, plinth, hh, pal.wall, { z: 0.03 })

  const sill = Math.min(1.05, hh * 0.42)
  const head = Math.min(hh * 0.84, sill + 1.3)
  const cells = grid(len, 2.8, 1.5)
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i]!
    addPane(out, cell[0], cell[1], sill, head, glassTone(pal, i, c.row), {
      z: 0.22,
      lay: F_OPEN,
      edge: 1,
    })
  }
  if (c.front) {
    const dw = Math.min(1.2, len * 0.24)
    const cc = Math.max(len * 0.2, dw)
    addPane(out, cc - dw / 2, cc + dw / 2, 0, Math.min(2.15, hh * 0.82), pal.door, {
      z: 0.16,
      lay: F_OPEN,
      edge: 1,
    })
  }
  slabBand(c, out, bandH)
}

function buildFace(c: FaceCtx): FacePane[] {
  const out: FacePane[] = []
  if (c.len < 0.6 || c.h < 0.4) return out
  switch (c.skin) {
    case 'curtain':
      faceCurtain(c, out)
      break
    case 'office':
      faceOffice(c, out)
      break
    case 'mall':
      faceMall(c, out)
      break
    case 'shed':
      faceShed(c, out)
      break
    case 'resi':
      faceResi(c, out)
      break
    case 'pavilion':
      facePavilion(c, out)
      break
    case 'service':
      faceService(c, out)
      break
    default:
      break
  }
  /*
   * Chizish tartibi shu yerda bir marta belgilanadi. Qatlam ichida chuqurroq
   * panel avval chiziladi, bir xil chuqurlikdagilar esa rang bo‘yicha
   * guruhlanadi: shunda proyeksiya bosqichida qo‘shni panellar bitta yo‘lga
   * birlashadi va SVG tugunlari soni kam qoladi.
   */
  out.sort(
    (a, b) => a.lay - b.lay || b.z - a.z || (a.tone < b.tone ? -1 : a.tone > b.tone ? 1 : 0),
  )
  return out
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

/**
 * Butun uchastkaning fasad panellari. Kameradan bog‘liq emas, shuning uchun
 * bir marta hisoblanadi. Shu yerda tafsilot narxi ham o‘lchanadi: yaqin
 * ko‘rinishda nechta yuza chiziladi va uzoq ko‘rinishda nechta qoladi.
 */
const facade = computed(() => {
  const vols = volumes.value
  const pals = palettes.value
  const mode = props.mode
  const planMapAll = plans.value
  const faces: Array<Array<Array<FacePane[] | null>>> = []
  let fine = 0
  let coarse = 0

  for (const vol of vols) {
    const item = vol.item
    const perLevel: Array<Array<FacePane[] | null>> = []
    if (item.skin === 'pad' || item.skin === 'pit') {
      faces.push(perLevel)
      continue
    }
    const pal = pals[item.skin]

    for (let i = 0; i < vol.levels.length; i++) {
      const lg = vol.levels[i]!
      if (lg.under) {
        perLevel.push([null, null, null, null])
        continue
      }
      const row = vol.rows[i]
      const dom =
        row && row.mix.length
          ? row.mix.reduce((best, m) => (m.area > best.area ? m : best), row.mix[0]!)
          : null
      const lease = item.leasable && mode === 'occupancy'
      const occTone = lease ? (dom ? dom.color : EMPTY_COLOR) : SERVICE_COLOR
      const plan = item.host ? planMapAll.get(lg.floor) : undefined

      const list: Array<FacePane[] | null> = []
      for (let f = 0; f < 4; f++) {
        const len = f % 2 === 0 ? lg.w : lg.d
        const other = f % 2 === 0 ? lg.d : lg.w
        const panes = buildFace({
          skin: item.skin,
          pal,
          len,
          h: lg.h,
          face: f,
          row: i,
          ground: lg.ground,
          top: lg.top,
          front: f === 0,
          long: len >= other,
          showOcc: lease && !!dom,
          occTone,
          bays: plan ? baysOf(plan, lg, f) : null,
        })
        list.push(panes)
        for (const p of panes) {
          if (p.lod !== 2) fine += p.edge ? 2.4 : 1
          if (p.lod !== 1) coarse += 1
        }
      }
      perLevel.push(list)
    }
    faces.push(perLevel)
  }

  // Bir vaqtda odatda ikkita yuz ko‘rinadi, shuning uchun narx yarmiga bo‘linadi
  return { faces, fine: Math.round(fine / 2), coarse: Math.round(coarse / 2) }
})

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
  const vol = volumes.value[hostIndex.value]
  const i = selectedIndex.value
  const info = levels.value[i]
  const lg = vol?.levels[i]
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
      fill: CATEGORIES.value.find((c) => c.key === key)?.color ?? EMPTY_COLOR,
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
  const vol = volumes.value[hostIndex.value]
  const i = selectedIndex.value
  const info = levels.value[i]
  const lg = vol?.levels[i]
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
   Tashqi elementlar: tom parapeti va karnizi, tomdagi texnika bloki, kirish
   soyaboni, ombor rampasi va yuk maydonchasi, qozonxona quvuri. Hammasi
   dunyo koordinatasidagi to‘rt nuqtali yuzalar, qavatga biriktiriladi va
   ajratish bilan birga ko‘chadi.
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

const extras = computed(() => {
  const vols = volumes.value
  const per: ExtQuad[][][] = []
  const tops: number[] = []

  for (const vol of vols) {
    const item = vol.item
    const list: ExtQuad[][] = vol.levels.map(() => [])
    let top = vol.topZ
    if (item.skin === 'pad' || item.skin === 'pit') {
      per.push(list)
      tops.push(top)
      continue
    }

    for (const lg of vol.levels) {
      if (lg.under) continue
      const own = list[lg.i]!
      const X0 = lg.ox - lg.w / 2
      const X1 = lg.ox + lg.w / 2
      const Y0 = lg.oy - lg.d / 2
      const Y1 = lg.oy + lg.d / 2
      const zTop = lg.h

      if (lg.ground) {
        if (item.skin === 'shed') {
          // Yuk maydonchasi va rampa: dok eshiklari oldida
          const dock = Math.min(1.15, lg.h * 0.14)
          pushBox(own, X0 + 1.2, Y0 - 7, X1 - 1.2, Y0 - 3, 0, 0.22, 'apron')
          own.push({
            p: [
              [X0 + 1.2, Y0 - 3, 0.22],
              [X1 - 1.2, Y0 - 3, 0.22],
              [X1 - 1.2, Y0, dock],
              [X0 + 1.2, Y0, dock],
            ],
            n: [0, -(dock - 0.22), 3],
            role: 'ramp',
          })
          own.push({
            p: [
              [X0 + 1.2, Y0 - 3, 0.22],
              [X0 + 1.2, Y0, dock],
              [X0 + 1.2, Y0, 0],
              [X0 + 1.2, Y0 - 3, 0],
            ],
            n: [-1, 0, 0],
            role: 'ramp',
          })
          own.push({
            p: [
              [X1 - 1.2, Y0 - 3, 0.22],
              [X1 - 1.2, Y0, dock],
              [X1 - 1.2, Y0, 0],
              [X1 - 1.2, Y0 - 3, 0],
            ],
            n: [1, 0, 0],
            role: 'ramp',
          })
        } else if (
          item.host &&
          (item.skin === 'curtain' ||
            item.skin === 'office' ||
            item.skin === 'mall' ||
            item.skin === 'resi')
        ) {
          // Kirish soyaboni va uni ushlab turgan ustunlar
          const cw = Math.min(lg.w * 0.42, 16)
          const cz = lg.h * 0.66
          pushBox(own, lg.ox - cw / 2, Y0 - 3.2, lg.ox + cw / 2, Y0 + 0.3, cz, cz + 0.4, 'canopy')
          pushBox(own, lg.ox - cw / 2 + 0.5, Y0 - 2.9, lg.ox - cw / 2 + 1, Y0 - 2.4, 0, cz, 'column')
          pushBox(own, lg.ox + cw / 2 - 1, Y0 - 2.9, lg.ox + cw / 2 - 0.5, Y0 - 2.4, 0, cz, 'column')
        }

        if (item.skin === 'mall' && item.host) {
          // Kirish atriumi: baland shisha hajm, parapet bilan yakunlanadi
          const aw = Math.min(lg.w * 0.4, 26)
          const az = lg.h * 1.7
          pushBox(own, lg.ox - aw / 2, Y0 - 4.6, lg.ox + aw / 2, Y0 + 0.4, 0, az, 'glass')
          pushBox(
            own,
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

      if (lg.top) {
        if (item.skin === 'shed') {
          // Yassi qiyalikdagi ikki nishabli tom, uchi uzun o‘q bo‘ylab
          const rise = clamp(lg.d * 0.06, 1.2, 4.5)
          const ex = 0.7
          const ax0 = X0 - ex
          const ax1 = X1 + ex
          own.push({
            p: [
              [ax0, Y0 - ex, zTop],
              [ax1, Y0 - ex, zTop],
              [ax1, lg.oy, zTop + rise],
              [ax0, lg.oy, zTop + rise],
            ],
            n: [0, -rise, lg.d / 2],
            role: 'roof',
          })
          own.push({
            p: [
              [ax0, Y1 + ex, zTop],
              [ax1, Y1 + ex, zTop],
              [ax1, lg.oy, zTop + rise],
              [ax0, lg.oy, zTop + rise],
            ],
            n: [0, rise, lg.d / 2],
            role: 'roof',
          })
          for (const k of [0.34, 0.66]) {
            const y = Y0 + lg.d * k
            const zz = zTop + rise * (1 - Math.abs(y - lg.oy) / (lg.d / 2))
            own.push({
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
          top = Math.max(top, lg.z0 + zTop + rise)
        } else {
          // Karniz: parapet ostidan chiqib turadigan lenta
          const ov = clamp(Math.min(lg.w, lg.d) * 0.02, 0.2, 0.4)
          const cz = Math.min(0.42, lg.h * 0.12)
          pushBox(own, X0 - ov, Y0 - ov, X1 + ov, Y0, zTop - cz, zTop, 'cornice')
          pushBox(own, X0 - ov, Y1, X1 + ov, Y1 + ov, zTop - cz, zTop, 'cornice')
          pushBox(own, X0 - ov, Y0, X0, Y1, zTop - cz, zTop, 'cornice')
          pushBox(own, X1, Y0, X1 + ov, Y1, zTop - cz, zTop, 'cornice')

          const pt2 = clamp(Math.min(lg.w, lg.d) * 0.02, 0.3, 0.5)
          const ph = item.host
            ? item.skin === 'mall'
              ? 1.7
              : item.skin === 'resi'
                ? 1.05
                : 1.25
            : Math.min(0.7, lg.h * 0.16)
          pushBox(own, X0, Y0, X1, Y0 + pt2, zTop, zTop + ph, 'parapet')
          pushBox(own, X0, Y1 - pt2, X1, Y1, zTop, zTop + ph, 'parapet')
          pushBox(own, X0, Y0 + pt2, X0 + pt2, Y1 - pt2, zTop, zTop + ph, 'parapet')
          pushBox(own, X1 - pt2, Y0 + pt2, X1, Y1 - pt2, zTop, zTop + ph, 'parapet')
          top = Math.max(top, lg.z0 + zTop + ph)

          if (item.kind === 'boiler') {
            // Qozonxona quvuri: uchastkada shu qurilma shundan tanilib turadi
            const sx = lg.ox + lg.w * 0.3
            const sy = lg.oy + lg.d * 0.24
            pushBox(own, sx - 0.35, sy - 0.35, sx + 0.35, sy + 0.35, zTop, zTop + 7, 'stack')
            pushBox(own, sx - 0.5, sy - 0.5, sx + 0.5, sy + 0.5, zTop + 7, zTop + 7.4, 'plant')
            top = Math.max(top, lg.z0 + zTop + 7.4)
          } else if (item.host) {
            // Tomdagi texnika bloki va toj
            const pw = lg.w * 0.32
            const pd = lg.d * 0.34
            const bh = item.skin === 'resi' ? 2.4 : 2.9
            pushBox(own, lg.ox - pw / 2, lg.oy - pd / 2, lg.ox + pw / 2, lg.oy + pd / 2, zTop, zTop + bh, 'plant')
            top = Math.max(top, lg.z0 + zTop + bh)
            if (item.skin === 'resi') {
              pushBox(
                own,
                lg.ox - pw * 0.8,
                lg.oy - pd * 0.8,
                lg.ox - pw * 0.8 + 3.2,
                lg.oy - pd * 0.8 + 3.2,
                zTop,
                zTop + 2.6,
                'plant',
              )
            } else {
              const mh = item.skin === 'mall' ? 4.2 : 6.4
              pushBox(own, lg.ox - 0.22, lg.oy - 0.22, lg.ox + 0.22, lg.oy + 0.22, zTop + bh, zTop + bh + mh, 'plant')
              top = Math.max(top, lg.z0 + zTop + bh + mh)
            }
          } else if (item.floors > 1 || item.w * item.d > 260) {
            // Katta yordamchi binoda ham tomda texnika bloki bo‘ladi
            const pw = Math.min(lg.w * 0.3, 6)
            const pd = Math.min(lg.d * 0.3, 5)
            pushBox(own, lg.ox - pw / 2, lg.oy - pd / 2, lg.ox + pw / 2, lg.oy + pd / 2, zTop, zTop + 1.5, 'plant')
            top = Math.max(top, lg.z0 + zTop + 1.5)
          }
        }
      }

      if (lg.ground) {
        for (const q of own) {
          for (const p of q.p) top = Math.max(top, lg.z0 + p[2])
        }
      }
    }

    per.push(list)
    tops.push(top)
  }

  return { per, tops }
})

/**
 * Kadrga sig‘dirish chegaralari: butun uchastka to‘rtburchagi. Kameradan
 * bog‘liq emas, shuning uchun aylantirganda masshtab o‘zgarmaydi.
 */
const bounds = computed(() => {
  const plot = site.value.plot
  const hw = plot.width / 2 + 5
  const hd = plot.depth / 2 + 5
  return {
    cx: 0,
    cy: 0,
    hw,
    hd,
    /** Burilishdan qat’i nazar eng katta gorizontal yoyilish yarmi */
    radius: Math.hypot(hw, hd) || 1,
  }
})

/* ==========================================================================
   Sahna: proyeksiya va bo‘yoq bo‘yicha birlashtirish. Faqat shu bosqich
   kameraga bog‘liq.
   ========================================================================== */

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

/** Yuz bo‘ylab yo‘nalish: f-yuzning `u` o‘qi qo‘shni yuzning normaliga teng */
const FACE_DIR: Array<[number, number]> = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
]
/** Yuzdan ichkariga qaragan yo‘nalish */
const FACE_IN: Array<[number, number]> = [
  [0, 1],
  [-1, 0],
  [0, -1],
  [1, 0],
]

const scene = computed(() => {
  const vols = volumes.value
  const fac = facade.value
  const ex = extras.value
  const pals = palettes.value
  const mode = props.mode
  const inner = interiorGeom.value
  const shapes = selectedShapes.value
  const hostI = hostIndex.value
  const activeId = activeStructId.value
  const ug = props.building.undergroundFloors

  const th = (view.rotation * Math.PI) / 180
  const ph = (view.tilt * Math.PI) / 180
  const ct = Math.cos(th)
  const st = Math.sin(th)
  const sp = Math.sin(ph)
  const cp = Math.cos(ph)

  const sel = selectedIndex.value
  const isCut = inner !== null
  const hostVol = hostI >= 0 ? vols[hostI] : undefined
  const hostStorey = hostVol?.levels[0]?.h ?? 3.4
  const step = view.exploded ? hostStorey * 1.5 : 0
  // Tanlangan qavat ustidagi darajalar ko‘tariladi: ichkariga qarash uchun
  const openLift = isCut ? Math.max(hostStorey * 1.15, (inner?.wallH ?? 2.6) * 2.4) : 0

  /** Asosiy qurilma darajasining ko‘tarilgan asosi */
  const hostZ = (i: number) => {
    const lg = hostVol?.levels[i]
    if (!lg) return 0
    let z = lg.z0 + step * (i - ug)
    if (sel >= 0 && i > sel) z += openLift
    return z
  }
  const hostShift = (i: number) => hostZ(i) - (hostVol?.levels[i]?.z0 ?? 0)

  // Kadrga sig‘dirish: masshtab burilishdan qat’i nazar bir xil qoladi
  const bd = bounds.value
  let zLow = 0
  let zHigh = 4
  for (let vi = 0; vi < vols.length; vi++) {
    const vol = vols[vi]!
    if (vol.botZ < zLow) zLow = vol.botZ
    let t = ex.tops[vi] ?? vol.topZ
    if (vi === hostI && vol.levels.length) t += hostShift(vol.levels.length - 1)
    if (t > zHigh) zHigh = t
  }

  const spanH = bd.radius * 2
  const spanV = Math.max(spanH * sp + (zHigh - zLow) * cp, 1)
  const sc = Math.min((VW * 0.9) / spanH, (VH * 0.88) / spanV) * view.zoom
  const cx = VW / 2
  const cy = VH / 2 + ((zLow + zHigh) / 2) * cp * sc

  const px = (x: number, y: number) => r1(cx + (x * ct - y * st) * sc)
  const py = (x: number, y: number, z: number) => r1(cy - ((x * st + y * ct) * sp + z * cp) * sc)
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

  /** Ixtiyoriy to‘rt nuqtali yuza: gorizontal tokcha va qopqoqlar uchun */
  const quad4 = (
    ax: number,
    ay: number,
    az: number,
    bx: number,
    by: number,
    bz: number,
    cx2: number,
    cy2: number,
    cz2: number,
    dx2: number,
    dy2: number,
    dz2: number,
  ) =>
    `M${px(ax, ay)} ${py(ax, ay, az)}L${px(bx, by)} ${py(bx, by, bz)}L${px(cx2, cy2)} ${py(cx2, cy2, cz2)}L${px(dx2, dy2)} ${py(dx2, dy2, dz2)}Z`

  /*
   * Bo‘yoq keshi. Bir kadrda beshtacha yorug‘lik darajasi va o‘ttizga yaqin
   * material rangi ishlatiladi, shuning uchun `shade` ni har bir panel uchun
   * qayta hisoblash o‘rniga natija saqlanadi.
   */
  const toneCache = new Map<string, string>()
  const tint = (hex: string, amount: number) => {
    const key = `${hex}|${amount}`
    let got = toneCache.get(key)
    if (got === undefined) {
      got = shade(hex, amount)
      toneCache.set(key, got)
    }
    return got
  }

  /*
   * Tafsilot ikki bosqichda kamayadi.
   *
   * `fine`: bir metr ekranda kam joy egallasa alohida oyna va mullion
   * baribir ajralmaydi, shuning uchun ular o‘rniga bitta lenta chiziladi.
   *
   * `deep`: chuqurlik qirralari eng qimmat qism, bitta panel o‘rniga uchta
   * yuza beradi. Kamera tortilayotganda byudjetdan oshgan uchastkada shu
   * qirralar vaqtincha o‘chadi, deraza to‘ri esa joyida qoladi. Shu tufayli
   * burilish silliq bo‘ladi va qo‘yib yuborilgach hajm darhol qaytadi.
   */
  const pxPerM = sc * cp
  const fine = mode !== 'wire' && pxPerM >= DETAIL_MIN_PX
  const deep = fine && (!dragging.value || fac.fine <= DETAIL_BUDGET)

  /** Bir kadrda chizilgan yuzalar soni */
  let drawn = 0

  const structs: StructView[] = []

  // Uzoqdagi qurilma avval chiziladi: uchastkada hajmlar kesishmaydi,
  // shuning uchun markazlar chuqurligi bo‘yicha saralash yetarli
  const order = vols.map((_, i) => i)
  order.sort((a, b) => vOf(vols[b]!.item.cx, vols[b]!.item.cy) - vOf(vols[a]!.item.cx, vols[a]!.item.cy))

  for (const vi of order) {
    const vol = vols[vi]!
    const item = vol.item
    const isActive = item.id === activeId
    const pal = pals[item.skin]

    const bx0 = item.x0
    const bx1 = item.x1
    const by0 = item.y0
    const by1 = item.y1
    const baseCorners: Array<[number, number]> = [
      [bx0, by0],
      [bx1, by0],
      [bx1, by1],
      [bx0, by1],
    ]

    // --- ekran chegarasidan tashqarida qolgan qurilma umuman qurilmaydi
    let volTop = ex.tops[vi] ?? vol.topZ
    if (vi === hostI && vol.levels.length) volTop += hostShift(vol.levels.length - 1)
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    for (const c of baseCorners) {
      for (const z of [vol.botZ, volTop]) {
        const sx = px(c[0], c[1])
        const sy = py(c[0], c[1], z)
        if (sx < minX) minX = sx
        if (sx > maxX) maxX = sx
        if (sy < minY) minY = sy
        if (sy > maxY) maxY = sy
      }
    }
    if (maxX < -30 || minX > VW + 30 || maxY < -30 || minY > VH + 30) continue

    // --- nishoncha uchun eng o‘ng burchak
    let tagAnchorX = -Infinity
    let tagAnchorY = 0
    for (const c of baseCorners) {
      const sx = px(c[0], c[1])
      if (sx > tagAnchorX) {
        tagAnchorX = sx
        tagAnchorY = py(c[0], c[1], volTop)
      }
    }
    const tagText = item.name
    const tagW = Math.min(230, 22 + tagText.length * 7)

    const view2: StructView = {
      id: item.id,
      name: item.name,
      kindLabel: item.kindLabel,
      host: item.host,
      selected: isActive,
      opacity: mode === 'wire' ? 1 : isActive ? 1 : 0.82,
      slabs: [],
      pad: [],
      outline: '',
      dash: item.skin === 'pit',
      tagX: clamp(tagAnchorX + 14, 8, VW - tagW - 8),
      // Qurilma nomi qavat nishonchasidan yuqorida turadi, aks holda bir
      // qavatli blokda ikkalasi ustma-ust tushadi
      tagY: clamp(tagAnchorY - 26, 22, VH - 16),
      tagW,
      tagText,
      aria: `${item.name}, ${item.kindLabel}`,
    }

    // --- yassi maydon: avtoturargoh qoplamasi va joy chiziqlari
    if (item.skin === 'pad') {
      const z = 0.04
      view2.pad.push({
        d: quad4(bx0, by0, z, bx1, by0, z, bx1, by1, z, bx0, by1, z),
        f: tint('#93A0AE', topAmount + 0.24),
        o: 0.96,
      })
      const along = item.w >= item.d
      const span = along ? item.w : item.d
      const n = clamp(Math.round(span / 2.7), 2, 46)
      const marks: string[] = []
      const zm = 0.06
      for (let i = 1; i < n; i++) {
        const t = i / n
        if (along) {
          const x = bx0 + (bx1 - bx0) * t
          marks.push(
            quad4(x - 0.08, by0 + 0.6, zm, x + 0.08, by0 + 0.6, zm, x + 0.08, by1 - 0.6, zm, x - 0.08, by1 - 0.6, zm),
          )
        } else {
          const y = by0 + (by1 - by0) * t
          marks.push(
            quad4(bx0 + 0.6, y - 0.08, zm, bx1 - 0.6, y - 0.08, zm, bx1 - 0.6, y + 0.08, zm, bx0 + 0.6, y + 0.08, zm),
          )
        }
      }
      if (marks.length) {
        view2.pad.push({ d: marks.join(''), f: tint('#E4EBF5', topAmount + 0.3), o: 0.7 })
        drawn += marks.length + 1
      }
      view2.outline = baseCorners.map((c) => pt(c[0], c[1], 0.08)).join(' ')
      structs.push(view2)
      continue
    }

    // --- yer osti avtoturargohi: yer sathidan pastda turadi
    if (item.skin === 'pit') {
      const pitZ = vol.botZ
      const raw: Array<{ d: string; f: string; o: number; near: number }> = []
      for (let f = 0; f < 4; f++) {
        const fs = faceState[f]!
        if (!fs.visible) continue
        const a = baseCorners[f]!
        const b = baseCorners[(f + 1) % 4]!
        raw.push({
          d: face4(a[0], a[1], b[0], b[1], pitZ, 0),
          f: tint(pal.wall, fs.amount),
          o: 1,
          near: -vOf((a[0] + b[0]) / 2, (a[1] + b[1]) / 2) * cp,
        })
      }
      view2.pad.push(...mergePaint(raw).map((p) => ({ ...p, o: 0.34 })))
      view2.outline = baseCorners.map((c) => pt(c[0], c[1], 0.02)).join(' ')
      drawn += raw.length
      structs.push(view2)
      continue
    }

    // --- hajmli qurilma: har bir daraja alohida chiziladi
    for (let i = 0; i < vol.levels.length; i++) {
      const lg = vol.levels[i]!
      const info = vol.rows[i]
      if (!info) continue
      const host = vi === hostI
      const z0 = host ? hostZ(i) : lg.z0
      const isSel = host && i === sel
      const cutFloor = isSel && isCut
      const zTop = z0 + (cutFloor ? PLATE_T : lg.h)
      const above = host && sel >= 0 && i > sel
      // Fasad faqat kesim rejimida yashiriladi: ochilgan qavat ustidagi
      // darajalar ko‘tarilib, ichkariga qarashga xalaqit bermasligi kerak
      const hideDetail = above && isCut

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

      let lo = Infinity
      let hi = -Infinity
      for (const c of corners) {
        const sy = py(c[0], c[1], zTop)
        if (sy < lo) lo = sy
        if (sy > hi) hi = sy
      }
      if (hi < -40 || lo > VH + 40) continue

      const dominant = info.mix.length
        ? info.mix.reduce((best, mi) => (mi.area > best.area ? mi : best), info.mix[0]!)
        : null

      let base = EMPTY_COLOR
      if (mode === 'occupancy') {
        base = dominant ? dominant.color : EMPTY_COLOR
      } else {
        base = isSel ? '#7FA8F6' : '#C3D2E6'
      }
      if (lg.under) base = '#BDC8D6'

      /*
       * Fasad orqa foni. Bandlik rangi materialga zaif qo‘shiladi: qavat
       * holati bir qarashda o‘qiladi, lekin fasad naqshini bosib ketmaydi.
       * Aniq ulushlar qavat lentasida ko‘rsatiladi.
       */
      const backTone =
        mode === 'occupancy' && !lg.under
          ? mixHex(pal.wall, base, item.leasable ? 0.2 : 0.06)
          : base

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

      // --- fasad tekisligi: bosish maydoni va material foni
      const parts: FacePart[] = []
      if (mode !== 'wire') {
        for (let f = 0; f < 4; f++) {
          const state = faceState[f]!
          if (!state.visible) continue
          const a = corners[f]!
          const b = corners[(f + 1) % 4]!
          parts.push({
            points: quad(a, b, z0, zTop, 0, 1),
            fill: tint(backTone, state.amount),
            alpha: 1,
          })
          drawn++
        }
      }

      // --- modellashtirilgan fasad: qavat lentasi, spandrel, mullion,
      //     chuqurchadagi deraza, kirish portali, yuk eshigi, balkon
      const skinItems: Paint[] = []
      if (mode !== 'wire' && !cutFloor && !lg.under && !hideDetail) {
        const faces = fac.faces[vi]?.[i]
        if (faces) {
          const bins: Array<Map<string, string[]>> = [new Map(), new Map(), new Map(), new Map()]
          const put = (lay: number, fill: string, d: string) => {
            const bin = bins[lay] ?? bins[0]!
            const arr = bin.get(fill)
            if (arr) arr.push(d)
            else bin.set(fill, [d])
            drawn++
          }

          for (let f = 0; f < 4; f++) {
            const state = faceState[f]!
            if (!state.visible) continue
            const panes = faces[f]
            if (!panes || !panes.length) continue
            const a = corners[f]!
            const dir = FACE_DIR[f]!
            const inw = FACE_IN[f]!
            const ux = dir[0]
            const uy = dir[1]
            const nx = inw[0]
            const ny = inw[1]
            const sideU = faceState[(f + 1) % 4]!
            const sideV = faceState[(f + 3) % 4]!
            const amount = state.amount

            for (const p of panes) {
              if (fine ? p.lod === 2 : p.lod === 1) continue
              const q0 = z0 + p.h0
              const q1 = z0 + p.h1
              const zz = p.z
              const ax = a[0] + ux * p.u0 + nx * zz
              const ay = a[1] + uy * p.u0 + ny * zz
              const bx = a[0] + ux * p.u1 + nx * zz
              const by = a[1] + uy * p.u1 + ny * zz

              if (p.occ && info.mix.length > 1) {
                // Qavat lentasi bandlik ulushlariga bo‘linadi
                let t = 0
                for (const mi of info.mix) {
                  const next = Math.min(t + mi.share, 1)
                  if (next > t + 0.002) {
                    put(
                      p.lay,
                      tint(mi.color, amount),
                      face4(
                        ax + (bx - ax) * t,
                        ay + (by - ay) * t,
                        ax + (bx - ax) * next,
                        ay + (by - ay) * next,
                        q0,
                        q1,
                      ),
                    )
                  }
                  t = next
                }
              } else {
                put(p.lay, tint(p.tone, amount), face4(ax, ay, bx, by, q0, q1))
              }

              if (!p.edge || !deep || zz === 0) continue
              const wx0 = a[0] + ux * p.u0
              const wy0 = a[1] + uy * p.u0
              const wx1 = a[0] + ux * p.u1
              const wy1 = a[1] + uy * p.u1

              if (zz > 0) {
                // Chuqurcha: bir yon qirra yorug‘, ikkinchisi soyada qoladi
                if (sideU.visible) {
                  put(p.lay, tint(p.tone, sideU.amount - 0.1), face4(wx0, wy0, ax, ay, q0, q1))
                }
                if (sideV.visible) {
                  put(p.lay, tint(p.tone, sideV.amount - 0.1), face4(wx1, wy1, bx, by, q0, q1))
                }
                put(
                  p.lay,
                  tint(p.tone, topAmount + 0.08),
                  quad4(wx0, wy0, q0, wx1, wy1, q0, bx, by, q0, ax, ay, q0),
                )
              } else {
                // Tashqariga chiqqan profil: ustki qopqog‘i yorug‘ chiqadi
                if (sideV.visible) {
                  put(p.lay, tint(p.tone, sideV.amount), face4(wx0, wy0, ax, ay, q0, q1))
                }
                if (sideU.visible) {
                  put(p.lay, tint(p.tone, sideU.amount), face4(wx1, wy1, bx, by, q0, q1))
                }
                put(
                  p.lay,
                  tint(p.tone, topAmount + 0.16),
                  quad4(wx0, wy0, q1, wx1, wy1, q1, bx, by, q1, ax, ay, q1),
                )
                if (p.ledge) {
                  put(
                    p.lay,
                    tint(p.tone, topAmount + 0.06),
                    quad4(wx0, wy0, q0, wx1, wy1, q0, bx, by, q0, ax, ay, q0),
                  )
                }
              }
            }
          }

          for (const bin of bins) {
            for (const [fill, list] of bin) skinItems.push({ d: list.join(''), f: fill, o: 1 })
          }
        }
      }

      // --- plita ustki yuzasi: yashirin qolganda umuman chizilmaydi
      const showTop = lg.top || isSel || (host && view.exploded) || (isCut && host && i === sel - 1)
      const topPoints = showTop
        ? [pt(X0, Y0, zTop), pt(X1, Y0, zTop), pt(X1, Y1, zTop), pt(X0, Y1, zTop)].join(' ')
        : ''
      // Tom qoplamasi material rangida qoladi: bandlik rangi u yerda zaif
      // ishora bo‘lib, tomni pushti yoki yashil qilib yubormaydi
      const roofTone =
        mode === 'occupancy' && !lg.under ? mixHex(pal.wallAlt, base, 0.08) : backTone
      const topFill = cutFloor
        ? IT.base
        : isSel
          ? '#E9F0FE'
          : tint(roofTone, Math.max(topAmount + 0.3, 0.12))

      // --- tanlangan qavat: rang yagona belgi bo‘lmasligi uchun kontur ham
      let band = ''
      if (isSel && !cutFloor && mode !== 'wire') {
        const bandParts: string[] = []
        for (let f = 0; f < 4; f++) {
          if (!faceState[f]!.visible) continue
          const a = corners[f]!
          const b = corners[(f + 1) % 4]!
          const q = quad(a, b, z0, z0 + lg.h, 0, 1)
          bandParts.push(`M${q.replace(/ /g, 'L').replace(/,/g, ' ')}Z`)
        }
        band = bandParts.join('')
      }

      const edges: Array<{ d: string; hidden: boolean }> = []
      if (mode === 'wire') {
        for (let k = 0; k < 4; k++) {
          const c = corners[k]!
          const n2 = corners[(k + 1) % 4]!
          edges.push({
            d: `M${pt(c[0], c[1], zTop).replace(',', ' ')} L${pt(n2[0], n2[1], zTop).replace(',', ' ')}`,
            hidden: false,
          })
          edges.push({
            d: `M${pt(c[0], c[1], z0).replace(',', ' ')} L${pt(n2[0], n2[1], z0).replace(',', ' ')}`,
            hidden: !faceState[k]!.visible,
          })
          edges.push({
            d: `M${pt(c[0], c[1], z0).replace(',', ' ')} L${pt(c[0], c[1], zTop).replace(',', ' ')}`,
            hidden: !faceState[k]!.visible && !faceState[(k + 3) % 4]!.visible,
          })
          drawn += 3
        }
      }

      // --- unit konturlari: faqat asosiy qurilmaning tanlangan qavatida
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
          const n2 = Math.max(list.length, 1)
          units.push({
            id: shape.id,
            code: shape.code,
            points: list.join(' '),
            fill: shape.fill,
            cx: r1(sxSum / n2),
            cy: r1(sySum / n2),
            active: shape.id === props.unit,
          })
          drawn++
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
              f: tint(b.tone, fs.amount),
              o: 1,
              near: near - 0.04,
            })
          }
          raw.push({
            d: `M${pt(c[0]![0], c[0]![1], q1).replace(',', ' ')}L${pt(c[1]![0], c[1]![1], q1).replace(',', ' ')}L${pt(c[2]![0], c[2]![1], q1).replace(',', ' ')}L${pt(c[3]![0], c[3]![1], q1).replace(',', ' ')}Z`,
            f: tint(b.tone, topFace),
            o: 1,
            near: near + 0.04,
          })
        }

        for (const bl of inner.blades) {
          raw.push({
            d: face4(bl.ax, bl.ay, bl.bx, bl.by, zf, zf + bl.z1),
            f: tint(bl.tone, flatAmount),
            o: 0.95,
            near: (zf + bl.z1 / 2) * sp - vOf((bl.ax + bl.bx) / 2, (bl.ay + bl.by) / 2) * cp,
          })
        }

        drawn += raw.length
        interior.push(...mergePaint(raw))

        for (const l of inner.labels) {
          labels.push({ x: px(l.x, l.y), y: py(l.x, l.y, zf + l.z), text: l.text })
        }
      }

      // --- tashqi elementlar: tom, karniz, parapet, soyabon, rampa, quvur
      const extraItems: Paint[] = []
      if (mode !== 'wire' && !lg.under && !hideDetail) {
        const list = ex.per[vi]?.[i]
        if (list && list.length) {
          const raw: Array<{ d: string; f: string; o: number; near: number }> = []
          for (const q of list) {
            if (dotC(q.n[0], q.n[1], q.n[2]) <= 0) continue
            let sx = 0
            let sy = 0
            let sz = 0
            for (const p of q.p) {
              sx += p[0]
              sy += p[1]
              sz += p[2]
            }
            const k = q.p.length || 1
            raw.push({
              d: `M${q.p.map((p) => `${px(p[0], p[1])} ${py(p[0], p[1], z0 + p[2])}`).join('L')}Z`,
              f: tint(EXT_TONE[q.role] ?? '#C4CFDE', lightOf(q.n[0], q.n[1], q.n[2])),
              o: 1,
              near: (z0 + sz / k) * sp - vOf(sx / k, sy / k) * cp,
            })
          }
          drawn += raw.length
          extraItems.push(...mergePaint(raw))
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
      const labelW = isSel ? 152 : 44
      const labelX = clamp(anchorX + 16, 8, VW - labelW - 8)
      const labelY = clamp(anchorY, 24, VH - 12)

      view2.slabs.push({
        key: `${item.id}-${info.floor}`,
        floor: info.floor,
        name: info.name,
        short: info.short,
        underground: info.underground,
        selected: isSel,
        // Tanlangan qavat to‘q qoladi. Kesim rejimida ochilgan qavat
        // ustidagi darajalar deyarli shaffof bo‘ladi, oddiy rejimda esa
        // fasad oqarib ketmasligi uchun farq kichik qoladi
        opacity: !host || sel < 0 || isSel ? 1 : isCut ? (above ? 0.2 : 0.62) : 0.94,
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
        aria: host
          ? t('ui.slabAria', {
              name: info.name,
              total: info.total,
              occupancy: info.occupancy,
              label: info.label,
            })
          : `${item.name}, ${info.name}`,
      })
    }

    if (isActive && mode !== 'wire') {
      view2.outline = baseCorners.map((c) => pt(c[0], c[1], 0.05)).join(' ')
    }
    structs.push(view2)
  }

  // --- uchastka sathi: to‘r va quyosh yo‘nalishidagi soyalar
  const gx0 = -bd.hw
  const gx1 = bd.hw
  const gy0 = -bd.hd
  const gy1 = bd.hd
  const gridLines: string[] = []
  const divisions = 8
  for (let i = 0; i <= divisions; i++) {
    const x = gx0 + ((gx1 - gx0) * i) / divisions
    gridLines.push(`M${px(x, gy0)} ${py(x, gy0, 0)} L${px(x, gy1)} ${py(x, gy1, 0)}`)
    const y = gy0 + ((gy1 - gy0) * i) / divisions
    gridLines.push(`M${px(gx0, y)} ${py(gx0, y, 0)} L${px(gx1, y)} ${py(gx1, y, 0)}`)
  }
  const plane = [pt(gx0, gy0, 0), pt(gx1, gy0, 0), pt(gx1, gy1, 0), pt(gx0, gy1, 0)].join(' ')

  // Soya: kontur nuqtalari quyosh yo‘nalishi bo‘yicha siljiydi, ikki
  // to‘plamning qavariq qobig‘i olinadi
  const sunK = clamp(1 / Math.max(SUN.z, 0.16), 0, 3.4)
  const cross = (o: [number, number], a: [number, number], b: [number, number]) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const shadows: string[] = []
  for (let vi = 0; vi < vols.length; vi++) {
    const vol = vols[vi]!
    const item = vol.item
    if (item.skin === 'pit' || item.skin === 'pad') continue
    const hTop = vol.topZ
    const offX = -SUN.x * hTop * sunK
    const offY = -SUN.y * hTop * sunK
    const rect: Array<[number, number]> = [
      [item.x0, item.y0],
      [item.x1, item.y0],
      [item.x1, item.y1],
      [item.x0, item.y1],
    ]
    const pts = rect.concat(rect.map((p) => [p[0] + offX, p[1] + offY] as [number, number]))
    pts.sort((a, b) => a[0] - b[0] || a[1] - b[1])
    const lower: Array<[number, number]> = []
    for (const p of pts) {
      while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0) {
        lower.pop()
      }
      lower.push(p)
    }
    const upper: Array<[number, number]> = []
    for (let i = pts.length - 1; i >= 0; i--) {
      const p = pts[i]!
      while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0) {
        upper.pop()
      }
      upper.push(p)
    }
    lower.pop()
    upper.pop()
    shadows.push(
      lower
        .concat(upper)
        .map((p) => pt(p[0], p[1], 0))
        .join(' '),
    )
  }

  return {
    structs,
    gridLines,
    plane,
    shadows,
    /** Chizilgan yuzalar soni: o‘lchov uchun ko‘rinishga yozib qo‘yiladi */
    drawn,
    /** Yaqin ko‘rinishdagi taxminiy narx: tafsilot chegarasi shu bilan solishtiriladi */
    cost: fac.fine,
    scale: Math.round(pxPerM * 10) / 10,
    groundMark: {
      x: clamp(px(gx0, gy1), 14, VW - 96),
      y: clamp(py(gx0, gy1, 0), 20, VH - 14),
    },
  }
})

/* ==========================================================================
   Izoh oynachalari, legenda va qurilma kartochkasi
   ========================================================================== */

const tooltip = computed(() => {
  const info = hoveredLevel.value
  if (!info || info.floor === props.floor) return null
  const host = scene.value.structs.find((s) => s.host)
  const slab = host?.slabs.find((s) => s.floor === info.floor)
  if (!slab) return null
  const w = 184
  return {
    x: clamp(slab.anchorX + 14, 8, VW - w - 8),
    y: clamp(slab.anchorY - 60, 8, VH - 80),
    w,
    name: info.name,
    units: info.total
      ? t('ui.tipUnits', { total: info.total, vacant: info.vacantCount })
      : info.label,
    occupancy: info.total
      ? t('ui.tipOccupancy', { value: info.occupancy })
      : t('common.empty'),
  }
})

/** Sichqoncha ostidagi xona: kod, maydon va holat */
const roomTip = computed(() => {
  if (!hoveredUnit.value) return null
  const u = selectedLevel.value?.units.find((x) => x.id === hoveredUnit.value)
  if (!u) return null
  const host = scene.value.structs.find((s) => s.host)
  const shape = host?.slabs.find((sl) => sl.selected)?.units.find((x) => x.id === u.id)
  if (!shape) return null
  const cat = CATEGORIES.value.find((c) => c.key === (CATEGORY_OF[u.status] ?? 'other'))
  const w = 178
  return {
    x: clamp(shape.cx + 12, 8, VW - w - 8),
    y: clamp(shape.cy - 82, 8, VH - 88),
    w,
    code: t('ui.unitCode', { code: u.code }),
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
  return CATEGORIES.value.map((c) => ({ ...c, count: totals.get(c.key) ?? 0 }))
})

const modeHint = computed(() => MODES.value.find((m) => m.value === props.mode)?.hint ?? '')

/** Uchastka tarkibi: pastdagi tanlash lentasi shu ro‘yxatdan quriladi */
const structureList = computed(() =>
  site.value.items.map((i) => ({
    id: i.id,
    name: i.name,
    short: i.kindShort,
    kind: i.kindLabel,
    leasable: i.leasable,
    host: i.host,
  })),
)

const vacantSummary = computed(() => {
  const list = allUnits.value
  if (!list.length) return ''
  const free = list.filter((u) => u.status === 'VACANT')
  if (!free.length) return t('ui.noVacantUnits')
  return t('ui.vacantSummary', {
    count: free.length,
    area: areaLabel(free.reduce((s, u) => s + u.area, 0)),
  })
})

/** Tanlangan qurilma kartochkasi: nomi, turi, o‘lchami va bo‘sh maydoni */
const activeInfo = computed(() => {
  const item = activeStruct.value
  if (!item) return null
  const s = item.s
  const facts: string[] = [`${Math.round(item.w)} × ${Math.round(item.d)} m`]
  if (item.floors > 0) facts.push(t('ui.factFloors', { count: item.floors }))
  if (s.undergroundFloors) facts.push(t('ui.factUnderground', { count: s.undergroundFloors }))
  if (s.gla) facts.push(t('ui.factGla', { area: areaLabel(s.gla) }))
  if (s.parkingSpaces) facts.push(t('ui.factParking', { count: s.parkingSpaces }))
  return {
    name: item.name,
    kind: item.kindLabel,
    leasable: item.leasable,
    host: item.host,
    note: s.note,
    facts: facts.join(' · '),
    vacant: item.host ? vacantSummary.value : '',
  }
})

const siteNote = computed(() => {
  const s = site.value
  const b = props.building
  const lease = s.items.filter((i) => i.leasable).length
  const shape =
    family.value === 'tower'
      ? t('ui.shapeTower')
      : family.value === 'retail'
        ? t('ui.shapeRetail')
        : family.value === 'shed'
          ? t('ui.shapeShed')
          : t('ui.shapeResi')
  return t('ui.siteNote', {
    type: buildingTypeLabel(b.type),
    count: s.items.length,
    lease,
    width: Math.round(s.plot.width),
    depth: Math.round(s.plot.depth),
    shape,
  })
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

// Obyekt almashsa tanlov asosiy qurilmaga qaytadi
watch(
  () => props.building.id,
  () => {
    innerStruct.value = ''
    hoveredStruct.value = ''
  },
)

/** Qurilma tanlanadi: kartochkada nomi, turi, maydoni va bo‘sh maydoni chiqadi */
function pickStruct(id: string) {
  if (blockClick) return
  innerStruct.value = id
  emit('update:structure', id)
}

/**
 * Qurilma bosilganda avval o‘zi tanlanadi. Allaqachon tanlangan asosiy
 * qurilmada esa bosilgan qavatning ichi darhol ochiladi.
 */
function pickFloor(floor: number, id: string, host: boolean) {
  if (blockClick) return
  if (activeStructId.value !== id) {
    pickStruct(id)
    return
  }
  if (!host) return
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
  zoomBy(event.deltaY > 0 ? -0.14 : 0.14)
}

function spin(delta: number) {
  view.rotation = wrap360(view.rotation + delta)
}

function zoomBy(delta: number) {
  view.zoom = Math.round(clamp(view.zoom + delta, 0.6, 3.6) * 100) / 100
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
        :data-quads="scene.drawn"
        :data-scale="scene.scale"
        :data-cost="scene.cost"
        :aria-label="
          t('ui.sceneAria', {
            name: building.name,
            count: structureList.length,
            rotation: Math.round(view.rotation),
            tilt: Math.round(view.tilt),
          })
        "
        @pointerdown="onDown"
        @pointermove="onMove"
        @pointerup="onUp"
        @pointercancel="onUp"
        @wheel.prevent="onWheel"
        @pointerleave="(hovered = null), (hoveredUnit = ''), (hoveredStruct = '')"
      >
        <defs>
          <filter :id="`mkn-shadow-${building.id}`" x="-60%" y="-80%" width="240%" height="280%">
            <feGaussianBlur stdDeviation="9" />
          </filter>
        </defs>

        <!-- Uchastka sathi: to‘r va quyosh yo‘nalishidagi soyalar -->
        <polygon :points="scene.plane" fill="#0256F7" fill-opacity="0.035" />
        <path
          v-for="(g, gi) in scene.gridLines"
          :key="`g${gi}`"
          :d="g"
          stroke="#94A2B8"
          stroke-opacity="0.24"
          stroke-width="0.8"
          fill="none"
        />
        <g :filter="`url(#mkn-shadow-${building.id})`">
          <polygon
            v-for="(sh, si) in scene.shadows"
            :key="`sh${si}`"
            :points="sh"
            fill="#131C2B"
            fill-opacity="0.15"
          />
        </g>

        <text
          v-if="building.undergroundFloors"
          :x="scene.groundMark.x"
          :y="scene.groundMark.y + 16"
          font-size="12"
          font-weight="600"
          fill="#64748B"
        >
          {{ t('ui.groundLevel') }}
        </text>

        <!--
          Uchastkadagi qurilmalar. Tartib chuqurlik bo‘yicha: uzoqdagi hajm
          avval chiziladi. Har bir qurilma alohida guruh, shuning uchun uni
          bosib tanlash va xiralashtirish mumkin.
        -->
        <g
          v-for="st in scene.structs"
          :key="st.id"
          class="cursor-pointer"
          :opacity="st.opacity"
          @pointerenter="hoveredStruct = st.id"
          @click="pickStruct(st.id)"
        >
          <title>{{ st.aria }}</title>

          <!-- Yassi maydon: avtoturargoh qoplamasi, joy chiziqlari, yer osti hajmi -->
          <path
            v-for="(p, pi) in st.pad"
            :key="`p${pi}`"
            :d="p.d"
            :fill="p.f"
            :fill-opacity="p.o"
          />
          <polygon
            v-if="st.outline"
            :points="st.outline"
            fill="none"
            :stroke="st.selected ? '#0256F7' : '#7C8BA1'"
            :stroke-width="st.selected ? 2.2 : 1.1"
            :stroke-dasharray="st.dash ? '8 6' : undefined"
            class="pointer-events-none"
          />

          <!-- Plitalar pastdan yuqoriga chiziladi: kamera doim tepadan qaraydi -->
          <g
            v-for="slab in st.slabs"
            :key="slab.key"
            :opacity="slab.opacity"
            @pointerenter="st.host ? (hovered = slab.floor) : null"
            @click.stop="pickFloor(slab.floor, st.id, st.host)"
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
              />

              <!-- Modellashtirilgan fasad: qavat lentasi, spandrel, mullion,
                   chuqurchadagi deraza, kirish portali, yuk eshigi, balkon -->
              <path
                v-for="(sk, si) in slab.skin"
                :key="`s${si}`"
                :d="sk.d"
                :fill="sk.f"
                :fill-opacity="sk.o"
                class="pointer-events-none"
              />

              <!-- Tanlangan qavat: yengil bo‘yoq va aniq kontur -->
              <path
                v-if="slab.band"
                :d="slab.band"
                fill="#0256F7"
                fill-opacity="0.14"
                stroke="#0139B0"
                stroke-width="1.8"
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

            <!-- Tom, karniz, parapet, soyabon, rampa va quvur -->
            <g v-if="slab.extras.length" class="pointer-events-none">
              <path
                v-for="(it, xi) in slab.extras"
                :key="`x${xi}`"
                :d="it.d"
                :fill="it.f"
                stroke="#FFFFFF"
                stroke-width="0.5"
                stroke-opacity="0.3"
              />
            </g>

            <g
              v-if="st.host && (slab.selected || hovered === slab.floor)"
              class="pointer-events-none"
            >
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

          <!-- Qurilma nishonchasi: tanlangan va sichqoncha ostidagi hajmda -->
          <g
            v-if="mode !== 'wire' && (st.selected || hoveredStruct === st.id)"
            class="pointer-events-none"
          >
            <rect
              :x="st.tagX"
              :y="st.tagY - 15"
              :width="st.tagW"
              height="23"
              rx="11"
              :fill="st.selected ? '#131C2B' : '#FFFFFF'"
              :stroke="st.selected ? '#131C2B' : '#E2E8F2'"
              stroke-width="1"
            />
            <text
              :x="st.tagX + 11"
              :y="st.tagY + 1"
              font-size="12"
              font-weight="700"
              :fill="st.selected ? '#FFFFFF' : '#354152'"
            >
              {{ st.tagText }}
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

      <!-- Qavat relsi: asosiy binoning qavatlari, doim ko‘rinib turadi -->
      <div
        ref="railRef"
        class="scroll-slim absolute left-2 top-1/2 flex max-h-[88%] w-[62px] -translate-y-1/2 flex-col gap-0.5 overflow-y-auto rounded-field bg-surface/94 p-1 shadow-card ring-1 ring-ink-200/70 backdrop-blur"
        role="group"
        :aria-label="t('ui.railAria', { name: hostItem?.name ?? building.name })"
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
            :aria-label="
              t('ui.railFloorAria', { name: l.name, total: l.total, occupancy: l.occupancy })
            "
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
        :aria-label="t('ui.viewModeAria')"
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
        :aria-label="t('ui.cameraAria')"
      >
        <button
          type="button"
          class="grid size-10 place-items-center rounded-[8px] text-ink-600 transition-colors hover:bg-brand-50 hover:text-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          :aria-label="t('ui.turnLeft')"
          @click.stop="spin(-20)"
        >
          <UiIcon name="refresh" :size="18" />
        </button>
        <button
          type="button"
          class="grid size-10 place-items-center rounded-[8px] text-ink-600 transition-colors hover:bg-brand-50 hover:text-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          :aria-label="t('ui.turnRight')"
          @click.stop="spin(20)"
        >
          <UiIcon name="refresh" :size="18" class="-scale-x-100" />
        </button>
        <span class="my-auto h-6 w-px shrink-0 bg-ink-200" />
        <button
          type="button"
          class="grid size-10 place-items-center rounded-[8px] text-ink-600 transition-colors hover:bg-brand-50 hover:text-brand-600 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          :aria-label="t('ui.zoomIn')"
          :disabled="view.zoom >= 3.6"
          @click.stop="zoomBy(0.25)"
        >
          <UiIcon name="plus" :size="18" />
        </button>
        <button
          type="button"
          class="grid size-10 place-items-center rounded-[8px] text-ink-600 transition-colors hover:bg-brand-50 hover:text-brand-600 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          :aria-label="t('ui.zoomOut')"
          :disabled="view.zoom <= 0.6"
          @click.stop="zoomBy(-0.25)"
        >
          <UiIcon name="minus" :size="18" />
        </button>
        <button
          type="button"
          class="grid size-10 place-items-center rounded-[8px] text-ink-600 transition-colors hover:bg-brand-50 hover:text-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          :aria-label="t('ui.resetViewAria')"
          @click.stop="resetView"
        >
          <UiIcon name="target" :size="18" />
        </button>
      </div>
    </div>

    <!-- Uchastka tarkibi: qurilmani ro‘yxatdan ham tanlash mumkin -->
    <div v-if="controls" class="scroll-slim -mx-1 mt-3 overflow-x-auto px-1">
      <div class="flex w-max items-center gap-1.5" role="group" :aria-label="t('ui.siteStructuresAria')">
        <button
          v-for="s in structureList"
          :key="s.id"
          type="button"
          class="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-field px-3 text-[12px] font-semibold ring-1 ring-inset transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          :class="
            s.id === activeStructId
              ? 'bg-brand-500 text-white ring-brand-500'
              : 'bg-surface text-ink-700 ring-ink-200 hover:bg-ink-50'
          "
          :aria-pressed="s.id === activeStructId"
          :title="s.kind"
          @click="pickStruct(s.id)"
          @pointerenter="hoveredStruct = s.id"
          @pointerleave="hoveredStruct === s.id ? (hoveredStruct = '') : null"
        >
          <span
            class="size-2 shrink-0 rounded-full"
            :class="
              s.id === activeStructId ? 'bg-white/80' : s.leasable ? 'bg-brand-500' : 'bg-ink-300'
            "
          />
          {{ s.name }}
        </button>
      </div>
    </div>

    <!-- Tanlangan qurilma kartochkasi -->
    <div
      v-if="controls && activeInfo"
      class="mt-2.5 rounded-field bg-surface-sunken px-3 py-2.5 ring-1 ring-inset ring-ink-200"
    >
      <div class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span class="text-[13px] font-bold text-ink-900">{{ activeInfo.name }}</span>
        <span
          class="rounded-pill bg-surface px-2 py-0.5 text-[11px] font-semibold text-ink-600 ring-1 ring-inset ring-ink-200"
        >
          {{ activeInfo.kind }}
        </span>
      </div>
      <p class="tabular mt-1 text-[12px] text-ink-600">{{ activeInfo.facts }}</p>
      <p v-if="activeInfo.vacant" class="mt-0.5 text-[12px] font-semibold text-ok-700">
        {{ activeInfo.vacant }}
      </p>
      <p class="mt-0.5 text-[12px] leading-relaxed text-ink-500">{{ activeInfo.note }}</p>
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
        {{ t('ui.explodeFloors') }}
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
      {{ t('ui.dragHint') }}
      <span v-if="selectedLevel"> {{ t('ui.selectedFloor', { name: selectedLevel.name }) }}</span>
    </p>
    <p v-if="controls" class="mt-1 text-[12px] leading-relaxed text-ink-500">
      {{ siteNote }}
    </p>
  </div>
</template>
