<script setup lang="ts">
import { CONTRACTS } from '~/data/business'
import { BUILDINGS, type Building } from '~/data/buildings'
import { STRUCTURE_KIND, sitePlotOf, structuresOf, type Structure } from '~/data/structures'
import { unitsOfBuilding, type Unit } from '~/data/units'
import { UNIT_STATUS_COLOR } from '~/constants/statuses'
import { docxBlob, fileSlug, saveBlob, type DocxLine } from '~/utils/docx'
import { area as areaText, dateShort, num, percent, sum, todayIso } from '~/utils/format'

/**
 * Ombor obyektlari: ijaraga beriladigan ombor bloklari va ulardagi unitlar.
 *
 * Bu ekran material omboridan (`/warehouse`) butunlay boshqa narsa bilan
 * ishlaydi. U yerda javonda turgan jihoz va sarf materiallari sanaladi, bu
 * yerda esa ijaraga beriladigan ombor binolari, ulardagi bo‘sh maydonlar va
 * ijara shartlari boshqariladi.
 *
 * Ma’lumot manbai uchta reyestr va faqat ular:
 *   - `data/buildings.ts`   uchastka pasporti (klass, jihoz, menejer);
 *   - `data/structures.ts`  uchastkadagi qurilmalar geometriyasi (blok, KPP,
 *                           yuk maydoni, qozonxona), 3D navigator shu yerdan;
 *   - `data/units.ts`       unit reyestri (maydon, holat, ijarachi, narx);
 *   - `data/business.ts`    shartnoma reyestri (tugash sanasi).
 *
 * Ekranda birorta ko‘rsatkich qo‘lda yozilmagan: har bir son shu reyestrlardan
 * hisoblanadi, shuning uchun kartadagi raqam jadvaldagi qatorlar bilan va
 * chizmadagi katak bilan doim mos tushadi.
 */

const auth = useAuthStore()

const { money, moneyShort,
  t,
  field,
  statusLabel,
  statusOptions: unitStatusOptions,
  floorLabel,
} = useAppLabels()

// ---------------------------------------------------------------------------
// Muhandislik normalari

/** Ferma va tom qatlami balandligi, metr: foydali balandlik shundan chiqadi */
const TRUSS_HEIGHT = 1.2

/**
 * Pol yuklamasi normasi, t/m². Ombor loyihalashda bu ko‘rsatkich bino
 * klassiga bog‘lanadi, shuning uchun qiymat pasportdagi klassdan olinadi.
 * Yuqori darajada plita yuklamasi yarmiga tushadi.
 */
const SLAB_LOAD: Record<string, number> = {
  'A klass': 8,
  'B+ klass': 6,
  'B klass': 5,
  'C klass': 4,
}

/** Shartnomani yangilash oynasi, kun: shu muddat ichida tugaydigani navbatda */
const RENEWAL_WINDOW = 365

/** Bir oydagi o‘rtacha kun: qolgan muddatni oyga o‘tkazish uchun */
const DAYS_IN_MONTH = 30.44

const TODAY = todayIso()

const round1 = (v: number) => Math.round(v * 10) / 10
const round2 = (v: number) => Math.round(v * 100) / 100

function daysBetween(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00`).getTime()
  const b = new Date(`${to}T00:00:00`).getTime()
  return Math.round((b - a) / 86400000)
}

/** «Kran (4)» → 4, «Generator» → 1, topilmasa 0 */
function equipmentCount(list: string[], prefix: string): number {
  for (const item of list) {
    if (!item.startsWith(prefix)) continue
    const found = /\((\d+)\)/.exec(item)
    return found ? Number(found[1]) : 1
  }
  return 0
}

// ---------------------------------------------------------------------------
// Reyestrdan hisoblanadigan model

interface UnitRow {
  id: string
  code: string
  floor: number
  area: number
  status: Unit['status']
  tenant: string
  contractCode: string
  /** Oylik ijara, so‘m. Sotuvga qo‘yilgan unitda 0 */
  rent: number
  /** m² boshiga oylik ijara, so‘m */
  rentPerSqm: number
  /** Sotuv taklifidagi m² narxi, so‘m. Ijaradagi unitda 0 */
  salePerSqm: number
  endsAt: string
  daysLeft: number | null
  equipment: string[]
}

interface BlockView {
  id: string
  name: string
  siteId: string
  structure: Structure
  rows: UnitRow[]
  /** Blok egallagan reyestr qavatlari, o‘sish tartibida */
  floors: number[]
  levels: number
  area: number
  occupiedArea: number
  vacantArea: number
  reservedArea: number
  serviceArea: number
  occupancy: number
  vacantCount: number
  /** Eng katta yaxlit bo‘sh maydon, m²: yirik ijarachi shunga qaraydi */
  largestVacant: number
  docks: number
  gates: number
  craneBays: number
  hydrants: number
  /** Bitta dokka to‘g‘ri keladigan maydon, m²: kam bo‘lsa aylanma tez */
  areaPerDock: number
  clearHeight: number
  slabLoad: number
  /** Yuqori darajadagi plita yuklamasi, t/m². Bir darajali blokda 0 */
  slabLoadUpper: number
  monthlyRent: number
  vacancyCost: number
  askingPerSqm: number
  passingPerSqm: number
  renewalCount: number
  renewalArea: number
  /** Shartnomalarning maydon bo‘yicha o‘rtacha qolgan muddati, oy */
  wault: number
}

interface SiteView {
  id: string
  building: Building
  blocks: BlockView[]
  services: Structure[]
  plot: { width: number; depth: number }
  area: number
  vacantArea: number
  occupancy: number
  unitCount: number
  vacantCount: number
  monthlyRent: number
  vacancyCost: number
  truckSpaces: number
  cranes: number
  freightLifts: number
}

/**
 * Unitlar bloklarga taqsimlanadi. Reyestrda unit bevosita blokka bog‘lanmagan,
 * shuning uchun taqsimot qat’iy qoida bilan hisoblanadi: unitlar qavat va kod
 * tartibida saralanadi, har bir blok esa o‘z ulushini (uchastka maydonining
 * bloklar soniga bo‘lingani) to‘ldirguncha ketma-ket unit oladi. Qoida sof
 * funksiya bo‘lgani uchun jadval, chizma va kartochka bitta taqsimotni
 * ko‘rsatadi.
 */
function splitUnits(units: Unit[], blocks: number): Unit[][] {
  const out: Unit[][] = Array.from({ length: Math.max(1, blocks) }, () => [] as Unit[])
  const sorted = [...units].sort((a, b) => a.floor - b.floor || a.code.localeCompare(b.code))
  const total = sorted.reduce((acc, u) => acc + u.area, 0)
  const share = total > 0 ? total / out.length : 1
  let filled = 0
  for (const unit of sorted) {
    const index = Math.min(out.length - 1, Math.floor(filled / share))
    out[index]!.push(unit)
    filled += unit.area
  }
  return out
}

const contractIndex = computed(() => new Map(CONTRACTS.map((c) => [c.code, c])))

function buildRow(unit: Unit): UnitRow {
  const contract = unit.contractCode ? contractIndex.value.get(unit.contractCode) : undefined
  const endsAt = contract && contract.endsAt !== '-' ? contract.endsAt : ''
  const rental = unit.priceUnit === 'so‘m / oy'
  return {
    id: unit.id,
    code: unit.code,
    floor: unit.floor,
    area: unit.area,
    status: unit.status,
    tenant: unit.tenant ?? '',
    contractCode: unit.contractCode ?? '',
    rent: rental ? unit.price : 0,
    rentPerSqm: rental && unit.area > 0 ? Math.round(unit.price / unit.area) : 0,
    salePerSqm: rental ? 0 : unit.price,
    endsAt,
    daysLeft: endsAt ? daysBetween(TODAY, endsAt) : null,
    equipment: unit.equipment,
  }
}

function buildBlock(building: Building, structure: Structure, units: Unit[]): BlockView {
  const rows = units.map(buildRow)
  const floors = [...new Set(units.map((u) => u.floor))].sort((a, b) => a - b)
  const levels = Math.max(1, floors.length)

  const area = round2(rows.reduce((acc, r) => acc + r.area, 0))
  const pick = (status: UnitRow['status']) => rows.filter((r) => r.status === status)
  const sumArea = (list: UnitRow[]) => round2(list.reduce((acc, r) => acc + r.area, 0))

  const occupied = rows.filter((r) => r.status === 'RENTED' || r.status === 'SOLD')
  const vacant = pick('VACANT')
  const occupiedArea = sumArea(occupied)
  const vacantArea = sumArea(vacant)

  const renewals = occupied.filter((r) => r.daysLeft !== null && r.daysLeft <= RENEWAL_WINDOW)
  const termArea = occupied.filter((r) => r.daysLeft !== null)
  const termWeight = termArea.reduce((acc, r) => acc + r.area * (r.daysLeft ?? 0), 0)
  const termTotal = termArea.reduce((acc, r) => acc + r.area, 0)

  // Rampa, yuk eshigi va kran yo‘nalishi unit jihozlari ro‘yxatidan sanaladi
  const docks = rows.filter((r) =>
    r.equipment.some((e) => e.startsWith('Rampa') || e.startsWith('Yuk platformasi')),
  ).length
  const gates = rows.filter((r) => r.equipment.some((e) => e.startsWith('Yuk eshigi'))).length
  const craneBays = rows.filter((r) => r.equipment.some((e) => e.startsWith('Kran'))).length
  const hydrants = rows.filter((r) => r.equipment.some((e) => e.startsWith('Yong'))).length

  const slabBase = SLAB_LOAD[building.buildingClass] ?? 4

  return {
    id: structure.id,
    name: structure.name,
    siteId: building.id,
    structure,
    rows,
    floors,
    levels,
    area,
    occupiedArea,
    vacantArea,
    reservedArea: sumArea(pick('RESERVED')),
    serviceArea: sumArea(pick('MAINTENANCE')),
    occupancy: area > 0 ? Math.round((occupiedArea / area) * 100) : 0,
    vacantCount: vacant.length,
    largestVacant: vacant.reduce((acc, r) => Math.max(acc, r.area), 0),
    docks,
    gates,
    craneBays,
    hydrants,
    areaPerDock: docks > 0 ? Math.round(area / docks) : 0,
    clearHeight: round1((structure.height - TRUSS_HEIGHT) / levels),
    slabLoad: slabBase,
    slabLoadUpper: levels > 1 ? round1(slabBase / 2) : 0,
    monthlyRent: occupied.reduce((acc, r) => acc + r.rent, 0),
    vacancyCost: vacant.reduce((acc, r) => acc + r.rent, 0),
    askingPerSqm: vacantArea > 0 ? Math.round(vacant.reduce((a, r) => a + r.rent, 0) / vacantArea) : 0,
    passingPerSqm:
      occupiedArea > 0 ? Math.round(occupied.reduce((a, r) => a + r.rent, 0) / occupiedArea) : 0,
    renewalCount: renewals.length,
    renewalArea: sumArea(renewals),
    wault: termTotal > 0 ? round1(termWeight / termTotal / DAYS_IN_MONTH) : 0,
  }
}

function buildSite(building: Building): SiteView {
  const structures = structuresOf(building.id)
  const shells = structures.filter((s) => s.kind === 'warehouse')
  const units = unitsOfBuilding(building.id).filter((u) => u.usage === 'Ombor')
  const groups = splitUnits(units, shells.length)
  const blocks = shells.map((shell, i) => buildBlock(building, shell, groups[i] ?? []))

  const area = round2(blocks.reduce((acc, b) => acc + b.area, 0))
  const vacantArea = round2(blocks.reduce((acc, b) => acc + b.vacantArea, 0))
  const occupiedArea = round2(blocks.reduce((acc, b) => acc + b.occupiedArea, 0))

  return {
    id: building.id,
    building,
    blocks,
    services: structures.filter((s) => s.kind !== 'warehouse'),
    plot: sitePlotOf(building.id),
    area,
    vacantArea,
    occupancy: area > 0 ? Math.round((occupiedArea / area) * 100) : 0,
    unitCount: blocks.reduce((acc, b) => acc + b.rows.length, 0),
    vacantCount: blocks.reduce((acc, b) => acc + b.vacantCount, 0),
    monthlyRent: blocks.reduce((acc, b) => acc + b.monthlyRent, 0),
    vacancyCost: blocks.reduce((acc, b) => acc + b.vacancyCost, 0),
    truckSpaces: structures.reduce((acc, s) => acc + (s.parkingSpaces ?? 0), 0),
    cranes: equipmentCount(building.equipment, 'Kran'),
    freightLifts: equipmentCount(building.equipment, 'Yuk lifti'),
  }
}

/** Rolga biriktirilgan ombor uchastkalari */
const sites = computed<SiteView[]>(() =>
  BUILDINGS.filter((b) => b.type === 'Ombor / logistika' && auth.inScope(b.id)).map(buildSite),
)

// ---------------------------------------------------------------------------
// Tanlov holati

const siteId = ref('')
const blockId = ref('')
const unitId = ref('')

const activeSite = computed<SiteView | null>(
  () => sites.value.find((s) => s.id === siteId.value) ?? sites.value[0] ?? null,
)

const activeBlock = computed<BlockView | null>(() => {
  const site = activeSite.value
  if (!site) return null
  return site.blocks.find((b) => b.id === blockId.value) ?? site.blocks[0] ?? null
})

const activeUnit = computed<UnitRow | null>(
  () => activeBlock.value?.rows.find((r) => r.id === unitId.value) ?? null,
)

function selectSite(id: string) {
  siteId.value = id
  blockId.value = ''
  unitId.value = ''
}

function selectBlock(id: string) {
  // Blok almashmasa unit tanlovi saqlanadi: chizmadagi katak bosilganda
  // avval blok, keyin unit tanlanadi va ikkinchi amal birinchisini bekor
  // qilib yubormasligi kerak.
  if (blockId.value === id) return
  blockId.value = id
  unitId.value = ''
}

function selectUnit(id: string) {
  unitId.value = unitId.value === id ? '' : id
}

// ---------------------------------------------------------------------------
// Portfel jamlanmasi: kartadagi son quyidagi jadvallardagi qatorlardan chiqadi

const portfolio = computed(() => {
  const list = sites.value
  const area = round2(list.reduce((acc, s) => acc + s.area, 0))
  const vacantArea = round2(list.reduce((acc, s) => acc + s.vacantArea, 0))
  const occupiedArea = round2(area - vacantArea)
  const blocks = list.reduce((acc, s) => acc + s.blocks.length, 0)
  const leased = list.flatMap((s) => s.blocks).reduce((acc, b) => acc + b.occupiedArea, 0)
  return {
    sites: list.length,
    blocks,
    area,
    vacantArea,
    occupiedArea,
    occupancy: area > 0 ? Math.round((leased / area) * 100) : 0,
    vacantCount: list.reduce((acc, s) => acc + s.vacantCount, 0),
    unitCount: list.reduce((acc, s) => acc + s.unitCount, 0),
    monthlyRent: list.reduce((acc, s) => acc + s.monthlyRent, 0),
    vacancyCost: list.reduce((acc, s) => acc + s.vacancyCost, 0),
    renewalCount: list
      .flatMap((s) => s.blocks)
      .reduce((acc, b) => acc + b.renewalCount, 0),
    renewalArea: round2(
      list.flatMap((s) => s.blocks).reduce((acc, b) => acc + b.renewalArea, 0),
    ),
  }
})

const kpis = computed(() => {
  const p = portfolio.value
  return [
    {
      key: 'area',
      label: t('whs.blKpiArea'),
      value: num(p.area),
      unit: t('unitOf.sqm'),
      icon: 'box',
      tone: 'brand' as const,
      gauge: undefined as number | undefined,
    },
    {
      key: 'occupancy',
      label: t('kpi.occupancy'),
      value: percent(p.occupancy),
      unit: undefined as string | undefined,
      icon: 'chart',
      tone: 'ok' as const,
      gauge: p.occupancy as number | undefined,
    },
    {
      key: 'vacant',
      label: t('kpi.vacantArea'),
      value: num(p.vacantArea),
      unit: t('unitOf.sqm'),
      icon: 'grid',
      tone: 'warn' as const,
      gauge: undefined as number | undefined,
    },
    {
      key: 'loss',
      label: t('whs.blKpiVacancyCost'),
      value: moneyShort(p.vacancyCost),
      unit: undefined as string | undefined,
      icon: 'wallet',
      tone: 'danger' as const,
      gauge: undefined as number | undefined,
    },
    {
      key: 'renewal',
      label: t('whs.blKpiRenewal'),
      value: num(p.renewalCount),
      unit: t('whs.contractWord'),
      icon: 'calendar',
      tone: 'violet' as const,
      gauge: undefined as number | undefined,
    },
  ]
})

/** Kartalar ostidagi izoh qatori: har bir son yuqoridagi jamlanmadan */
const portfolioFacts = computed(() => {
  const p = portfolio.value
  return [
    {
      key: 'sites',
      label: t('whs.blFactSites'),
      value: t('whs.blSitesBlocks', { s: p.sites, b: p.blocks }),
    },
    {
      key: 'units',
      label: t('kpi.units'),
      value: t('whs.blUnitsValue', { v: p.vacantCount, total: p.unitCount }),
    },
    { key: 'rent', label: t('whs.monthlyRentIncome'), value: moneyShort(p.monthlyRent) },
    {
      key: 'renewal',
      label: t('whs.blExpiring12'),
      value: t('whs.blCountArea', { n: p.renewalCount, area: num(p.renewalArea) }),
    },
  ]
})

// ---------------------------------------------------------------------------
// Uchastka navigatori: aksonometrik proyeksiya
//
//   u = x·cosθ − y·sinθ                 (ekran gorizontali)
//   w = −(v·sinφ + z·cosφ),  v = x·sinθ + y·cosθ   (ekran vertikali)
//
// Kameraga qaragan yo‘nalish C = (−sinθ·cosφ, −cosθ·cosφ, sinφ). Yuz
// ko‘rinadimi degan savol yuz normali bilan C ning skalyar ko‘paytmasi
// orqali hal qilinadi, shuning uchun burilganda orqa devorlar chizilmaydi.

/*
 * Kadr o‘lchami ataylab kichik: SVG konteyner kengligiga cho‘ziladi, shuning
 * uchun viewBox kichik bo‘lsa yozuvlar nisbatan yirikroq chiqadi va 768 px
 * ekranda ham, 1440 px da ham o‘qiladigan qoladi.
 */
const VIEW_W = 560
const VIEW_H = 352
const TILT = 32
const ROTATION_STEP = 15
const ROTATION_LIMIT = 60

const rotation = ref(-35)

/**
 * Chizmada ko‘rsatiladigan daraja. Ikki darajali blokda plitalar bir-birining
 * ustida turadi va ular birga chizilsa kataklar qo‘shilib ketadi, shuning uchun
 * odatda pastki qavat ko‘rsatiladi, «Barcha qavat» esa ustma-ust ko‘rinish beradi.
 */
const levelFilter = ref<number | 'all'>('all')

function rotate(direction: number) {
  const next = rotation.value + direction * ROTATION_STEP
  rotation.value = Math.max(-ROTATION_LIMIT, Math.min(ROTATION_LIMIT, next))
}

/** Blok uchun boshlang‘ich daraja: ko‘p darajalida eng pastkisi */
function defaultLevel(block: BlockView | null): number | 'all' {
  if (!block || block.floors.length < 2) return 'all'
  return block.floors[0] ?? 'all'
}

function resetView() {
  rotation.value = -35
  levelFilter.value = defaultLevel(activeBlock.value)
}

watch(
  activeBlock,
  (block) => {
    levelFilter.value = defaultLevel(block)
  },
  { immediate: true },
)

interface Face {
  points: string
  fill: string
  opacity: number
}

interface Cell {
  id: string
  code: string
  points: string
  fill: string
  cx: number
  cy: number
  width: number
  label: string
  aria: string
}

interface BlockShape {
  id: string
  name: string
  faces: Face[]
  cells: Cell[]
  /** Kodi sig‘adigan kataklar: yorliq shablonda emas, shu yerda ajratiladi */
  labels: Cell[]
  docks: Face[]
  badgeX: number
  badgeY: number
  badgeW: number
  badgeText: string
  badgeTone: string
  selected: boolean
  depth: number
  aria: string
}

interface ServiceShape {
  id: string
  faces: Face[]
  label: string
  labelX: number
  labelY: number
  depth: number
}

/** Blok nishonchasi: barcha qurilmalar ustidan alohida qatlamda chiziladi */
interface Badge {
  id: string
  x: number
  y: number
  w: number
  text: string
  tone: string
  selected: boolean
}

/** Chizish navbatidagi element: blok yoki xizmat qurilmasi */
interface SceneItem {
  id: string
  depth: number
  block?: BlockShape
  service?: ServiceShape
}

/** Xizmat qurilmalari uchun neytral ranglar: e’tibor ombor bloklarida qoladi */
const SERVICE_FILL = { top: '#e2e8f2', side: '#cbd4e3', front: '#d7deeb' }
const SHELL_FILL = { top: '#c9d6ee', side: '#aebfe0', front: '#bccdec' }

const scene = computed(() => {
  const site = activeSite.value
  if (!site) return null

  const th = (rotation.value * Math.PI) / 180
  const ph = (TILT * Math.PI) / 180
  const cos = Math.cos(th)
  const sin = Math.sin(th)
  const sinP = Math.sin(ph)
  const cosP = Math.cos(ph)

  const flat = (x: number, y: number, z: number) => ({
    u: x * cos - y * sin,
    w: -((x * sin + y * cos) * sinP + z * cosP),
  })

  const depthOf = (x: number, y: number) => x * sin + y * cos
  const camera = { x: -sin * cosP, y: -cos * cosP, z: sinP }

  const structures = [...site.blocks.map((b) => b.structure), ...site.services]
  const plot = site.plot

  // Kadr o‘lchami: uchastka va barcha qurilmalar burchaklaridan
  const points: Array<{ u: number; w: number }> = [
    flat(0, 0, 0),
    flat(plot.width, 0, 0),
    flat(plot.width, plot.depth, 0),
    flat(0, plot.depth, 0),
  ]
  for (const s of structures) {
    for (const [dx, dy] of [
      [0, 0],
      [s.width, 0],
      [s.width, s.depth],
      [0, s.depth],
    ]) {
      points.push(flat(s.x + (dx ?? 0), s.y + (dy ?? 0), 0))
      points.push(flat(s.x + (dx ?? 0), s.y + (dy ?? 0), s.height))
    }
  }

  const minU = Math.min(...points.map((p) => p.u))
  const maxU = Math.max(...points.map((p) => p.u))
  const minW = Math.min(...points.map((p) => p.w))
  const maxW = Math.max(...points.map((p) => p.w))
  const pad = 30
  const scale = Math.min(
    (VIEW_W - pad * 2) / Math.max(1, maxU - minU),
    (VIEW_H - pad * 2) / Math.max(1, maxW - minW),
  )
  const offsetX = pad - minU * scale + (VIEW_W - pad * 2 - (maxU - minU) * scale) / 2
  const offsetY = pad - minW * scale + (VIEW_H - pad * 2 - (maxW - minW) * scale) / 2

  const to = (x: number, y: number, z: number) => {
    const p = flat(x, y, z)
    return { x: p.u * scale + offsetX, y: p.w * scale + offsetY }
  }

  const poly = (list: Array<[number, number, number]>) =>
    list.map(([x, y, z]) => {
      const p = to(x, y, z)
      return `${round1(p.x)},${round1(p.y)}`
    }).join(' ')

  const visible = (nx: number, ny: number, nz: number) =>
    nx * camera.x + ny * camera.y + nz * camera.z > 0

  /** Qutining ko‘rinadigan yuzlari: tom va kameraga qaragan ikki devor */
  function boxFaces(s: Structure, palette: { top: string; side: string; front: string }, opacity: number): Face[] {
    const { x, y, width: w, depth: d, height: h } = s
    const out: Face[] = []
    if (visible(0, -1, 0)) {
      out.push({
        points: poly([[x, y, 0], [x + w, y, 0], [x + w, y, h], [x, y, h]]),
        fill: palette.front,
        opacity,
      })
    }
    if (visible(0, 1, 0)) {
      out.push({
        points: poly([[x, y + d, 0], [x + w, y + d, 0], [x + w, y + d, h], [x, y + d, h]]),
        fill: palette.front,
        opacity,
      })
    }
    if (visible(-1, 0, 0)) {
      out.push({
        points: poly([[x, y, 0], [x, y + d, 0], [x, y + d, h], [x, y, h]]),
        fill: palette.side,
        opacity,
      })
    }
    if (visible(1, 0, 0)) {
      out.push({
        points: poly([[x + w, y, 0], [x + w, y + d, 0], [x + w, y + d, h], [x + w, y, h]]),
        fill: palette.side,
        opacity,
      })
    }
    out.push({
      points: poly([[x, y, h], [x + w, y, h], [x + w, y + d, h], [x, y + d, h]]),
      fill: palette.top,
      opacity,
    })
    return out
  }

  // Uchastka maydoni va 20 metrlik to‘r
  const ground = poly([
    [0, 0, 0],
    [plot.width, 0, 0],
    [plot.width, plot.depth, 0],
    [0, plot.depth, 0],
  ])

  const grid: string[] = []
  for (let gx = 20; gx < plot.width; gx += 20) {
    const a = to(gx, 0, 0)
    const b = to(gx, plot.depth, 0)
    grid.push(`M${round1(a.x)},${round1(a.y)}L${round1(b.x)},${round1(b.y)}`)
  }
  for (let gy = 20; gy < plot.depth; gy += 20) {
    const a = to(0, gy, 0)
    const b = to(plot.width, gy, 0)
    grid.push(`M${round1(a.x)},${round1(a.y)}L${round1(b.x)},${round1(b.y)}`)
  }

  const services: ServiceShape[] = site.services.map((s) => {
    const center = to(s.x + s.width / 2, s.y + s.depth / 2, s.height)
    return {
      id: s.id,
      faces: boxFaces(s, SERVICE_FILL, 0.92),
      label: STRUCTURE_KIND[s.kind].short,
      labelX: round1(center.x),
      labelY: round1(center.y - 6),
      depth: depthOf(s.x + s.width / 2, s.y + s.depth / 2),
    }
  })

  const blocks: BlockShape[] = site.blocks.map((block) => {
    const s = block.structure
    const selected = block.id === activeBlock.value?.id
    const shellOpacity = selected ? 0.22 : 0.44
    const usable = Math.max(1, s.height - TRUSS_HEIGHT)
    const levelHeight = usable / block.levels

    /*
     * Unit kataklari: har bir daraja o‘z plitasida, kengligi maydonga
     * mutanosib. Tanlanmagan ko‘p darajali blokda faqat pastki qavat
     * chiziladi, aks holda ikki plita ustma-ust tushib chizmani chalkashtiradi.
     */
    const shown: number | 'all' = selected ? levelFilter.value : defaultLevel(block)
    const cells: Cell[] = []
    block.floors.forEach((floor, index) => {
      if (shown !== 'all' && shown !== floor) return
      const list = block.rows
        .filter((r) => r.floor === floor)
        .sort((a, b) => a.code.localeCompare(b.code))
      const total = list.reduce((acc, r) => acc + r.area, 0)
      if (total <= 0) return
      const z = index * levelHeight + 0.12
      let cursor = 0
      for (const row of list) {
        const from = s.x + (cursor / total) * s.width
        cursor += row.area
        const till = s.x + (cursor / total) * s.width
        const a = to(from, s.y, z)
        const b = to(till, s.y, z)
        const c = to(till, s.y + s.depth, z)
        const d = to(from, s.y + s.depth, z)
        cells.push({
          id: row.id,
          code: row.code,
          points: [a, b, c, d].map((p) => `${round1(p.x)},${round1(p.y)}`).join(' '),
          fill: UNIT_STATUS_COLOR[row.status] ?? '#8494AC',
          cx: round1((a.x + c.x) / 2),
          cy: round1((a.y + c.y) / 2),
          width: Math.abs(b.x - a.x),
          label: row.code,
          aria: `${row.code}, ${areaText(row.area)}`,
        })
      }
    })

    // Dok-rampalar old fasadda: soni unit jihozlaridan olingan
    const docks: Face[] = []
    if (block.docks > 0 && visible(0, -1, 0)) {
      const step = s.width / (block.docks + 1)
      for (let i = 1; i <= block.docks; i++) {
        const cx = s.x + step * i
        docks.push({
          points: poly([
            [cx - 1.6, s.y, 0],
            [cx + 1.6, s.y, 0],
            [cx + 1.6, s.y, 1.5],
            [cx - 1.6, s.y, 1.5],
          ]),
          fill: '#354152',
          opacity: 0.82,
        })
      }
    }

    // Nishoncha tom ustida, blok konturidan yuqorida turadi
    const badge = to(s.x + s.width / 2, s.y + s.depth / 2, s.height)
    const badgeText = `${block.name} · ${block.occupancy}%`
    const tone =
      block.occupancy >= 90 ? '#04835d' : block.occupancy >= 70 ? '#0256f7' : '#bd6512'

    return {
      id: block.id,
      name: block.name,
      faces: boxFaces(s, SHELL_FILL, shellOpacity),
      cells,
      // Yorliq faqat sig‘adigan katakda: aks holda qo‘shni kod bilan qo‘shilib ketadi
      labels: cells.filter((c) => c.width > c.label.length * 7 + 6),
      docks,
      badgeX: round1(badge.x),
      badgeY: round1(badge.y - 26),
      // 12px yarim qalin shriftda belgi eni taxminan 6.6px
      badgeW: round1(badgeText.length * 6.6 + 20),
      badgeText,
      badgeTone: tone,
      selected,
      depth: depthOf(s.x + s.width / 2, s.y + s.depth / 2),
      aria: t('whs.blBlockAria', {
        name: block.name,
        area: areaText(block.area),
        occupancy: block.occupancy,
      }),
    }
  })

  // Uzoqdagi qurilma birinchi chiziladi, shunda yaqindagi uni yopadi
  const order: SceneItem[] = [
    ...blocks.map((b) => ({ id: b.id, depth: b.depth, block: b })),
    ...services.map((s) => ({ id: s.id, depth: s.depth, service: s })),
  ].sort((a, b) => b.depth - a.depth)

  const badges: Badge[] = blocks.map((b) => ({
    id: b.id,
    x: round1(b.badgeX - b.badgeW / 2),
    y: round1(b.badgeY - 14),
    w: b.badgeW,
    text: b.badgeText,
    tone: b.badgeTone,
    selected: b.selected,
  }))

  return { ground, grid, order, badges }
})

const legend = computed(() => [
  { label: statusLabel('unit', 'VACANT'), color: UNIT_STATUS_COLOR.VACANT },
  { label: statusLabel('unit', 'RENTED'), color: UNIT_STATUS_COLOR.RENTED },
  { label: statusLabel('unit', 'RESERVED'), color: UNIT_STATUS_COLOR.RESERVED },
  { label: statusLabel('unit', 'MAINTENANCE'), color: UNIT_STATUS_COLOR.MAINTENANCE },
])

const levelTabs = computed(() => {
  const block = activeBlock.value
  if (!block || block.floors.length < 2) return []
  return [
    { value: 'all', label: t('filter.allFloors') },
    ...block.floors.map((f) => ({ value: String(f), label: floorLabel(f) })),
  ]
})

const levelModel = computed({
  get: () => (levelFilter.value === 'all' ? 'all' : String(levelFilter.value)),
  set: (value: string) => {
    levelFilter.value = value === 'all' ? 'all' : Number(value)
  },
})

// ---------------------------------------------------------------------------
// Blok kartochkasidagi ko‘rsatkichlar

const blockFacts = computed(() => {
  const b = activeBlock.value
  if (!b) return []
  return [
    {
      key: 'floors',
      label: field('floors', 'Qavatlar'),
      value: b.floors.map((f) => `${f}`).join(', '),
      hint: t('whs.blLevelsUnits', { levels: b.levels, units: b.rows.length }),
    },
    {
      key: 'height',
      label: t('whs.blClearHeight'),
      value: `${num(b.clearHeight, 1)} ${t('unitOf.meter')}`,
      hint: t('whs.blClearHeightHint'),
    },
    {
      key: 'load',
      label: t('whs.blSlabLoad'),
      value: b.slabLoadUpper
        ? `${num(b.slabLoad, 1)} / ${num(b.slabLoadUpper, 1)} ${t('unitOf.tonPerSqm')}`
        : `${num(b.slabLoad, 1)} ${t('unitOf.tonPerSqm')}`,
      hint: b.slabLoadUpper ? t('whs.blSlabLoadTwo') : t('whs.blSlabLoadNorm'),
    },
    {
      key: 'docks',
      label: t('whs.blDock'),
      value: `${b.docks} ${t('unitOf.pcs')}`,
      hint: b.areaPerDock
        ? t('whs.blAreaPerDock', { area: num(b.areaPerDock) })
        : t('whs.blNoDock'),
    },
    {
      key: 'gates',
      label: t('whs.blGate'),
      value: `${b.gates} ${t('unitOf.pcs')}`,
      hint: t('whs.blCraneBays', { n: b.craneBays }),
    },
    {
      key: 'fire',
      label: t('whs.blHydrant'),
      value: `${b.hydrants} ${t('unitOf.pcs')}`,
      hint: t('whs.blFromUnits', { n: b.rows.length }),
    },
    {
      key: 'blocked',
      label: t('whs.blReservedMaintenance'),
      value: `${num(b.reservedArea + b.serviceArea)} ${t('unitOf.sqm')}`,
      hint: t('whs.blNotOffered'),
    },
  ]
})

const blockMoney = computed(() => {
  const b = activeBlock.value
  if (!b) return []
  return [
    {
      key: 'passing',
      label: t('whs.blPassingRent'),
      value: b.passingPerSqm ? t('whs.blPerSqmValue', { v: num(b.passingPerSqm) }) : t('common.no'),
    },
    {
      key: 'asking',
      label: t('whs.blAskingRent'),
      value: b.askingPerSqm
        ? t('whs.blPerSqmValue', { v: num(b.askingPerSqm) })
        : t('empty.noVacantArea'),
    },
    { key: 'rent', label: t('whs.monthlyRentIncome'), value: moneyShort(b.monthlyRent) },
    {
      key: 'loss',
      label: t('whs.blKpiVacancyCost'),
      value: b.vacancyCost ? moneyShort(b.vacancyCost) : t('unitOf.currencyValue', { value: 0 }),
    },
    {
      key: 'wault',
      label: t('whs.blWault'),
      value: b.wault ? `${num(b.wault, 1)} ${t('unitOf.month')}` : t('common.no'),
    },
    {
      key: 'renewal',
      label: t('whs.blExpires12'),
      value: b.renewalCount
        ? t('whs.blCountArea', { n: b.renewalCount, area: num(b.renewalArea) })
        : t('common.no'),
    },
  ]
})

// ---------------------------------------------------------------------------
// Jadvallar

const blockColumns = computed(() => [
  { key: 'name', label: field('block', 'Blok') },
  { key: 'floors', label: field('floor', 'Qavat') },
  { key: 'area', label: field('areaSqm', 'Maydon, m²'), align: 'right' as const, numeric: true },
  { key: 'units', label: field('unit', 'Unit'), align: 'right' as const, numeric: true },
  { key: 'occupancy', label: t('kpi.occupancy') },
  { key: 'vacant', label: t('whs.blVacantSqm'), align: 'right' as const, numeric: true },
  { key: 'docks', label: t('whs.blDockGate'), align: 'right' as const, numeric: true },
  { key: 'height', label: field('height', 'Balandlik'), align: 'right' as const, numeric: true },
  { key: 'rent', label: field('pricePerSqm', 'm² narxi'), align: 'right' as const, numeric: true },
])

const blockRows = computed(() =>
  (activeSite.value?.blocks ?? []).map((b) => ({
    id: b.id,
    name: b.name,
    floors: b.floors.map((f) => floorLabel(f)).join(', '),
    area: b.area,
    units: b.rows.length,
    occupancy: b.occupancy,
    vacant: b.vacantArea,
    vacantCount: b.vacantCount,
    docks: `${b.docks} / ${b.gates}`,
    height: b.clearHeight,
    rent: b.passingPerSqm || b.askingPerSqm,
  })),
)

const unitQuery = ref('')
const unitStatus = ref('all')

const statusOptions = computed(() => [
  { value: 'all', label: t('filter.allStatuses') },
  ...unitStatusOptions('unit', ['VACANT', 'RENTED', 'RESERVED', 'MAINTENANCE']),
])

const unitColumns = computed(() => [
  { key: 'code', label: field('unit', 'Unit'), width: '96px' },
  { key: 'floor', label: field('floor', 'Qavat'), align: 'right' as const, numeric: true },
  { key: 'area', label: field('areaSqm', 'Maydon, m²'), align: 'right' as const, numeric: true },
  { key: 'status', label: field('status', 'Holat') },
  { key: 'tenant', label: field('tenant', 'Ijarachi') },
  { key: 'rent', label: field('monthlyPrice', 'Oylik narx'), align: 'right' as const, numeric: true },
  { key: 'perSqm', label: field('pricePerSqm', 'm² narxi'), align: 'right' as const, numeric: true },
  { key: 'ends', label: field('contractEnd', 'Shartnoma tugashi') },
  { key: 'features', label: field('equipment', 'Jihoz') },
])

const unitRows = computed(() => {
  const block = activeBlock.value
  if (!block) return []
  const q = unitQuery.value.trim().toLowerCase()
  return block.rows
    .filter((r) => {
      if (unitStatus.value !== 'all' && r.status !== unitStatus.value) return false
      if (q && ![r.code, r.tenant, r.contractCode].some((v) => v.toLowerCase().includes(q)))
        return false
      return true
    })
    .sort((a, b) => a.floor - b.floor || a.code.localeCompare(b.code))
})

const unitFiltersDirty = computed(() => !!unitQuery.value.trim() || unitStatus.value !== 'all')

/** Bo‘sh jadval izohi: nima uchun qator yo‘qligini aytadi */
const unitEmptyText = computed(() => {
  if (unitStatus.value === 'VACANT' && !unitQuery.value.trim()) {
    return t('whs.blEmptyVacant')
  }
  return t('whs.blEmptyUnits')
})

function resetUnitFilters() {
  unitQuery.value = ''
  unitStatus.value = 'all'
}

/** Faqat bo‘sh maydonni ko‘rsatish: bir bosishda taklif ro‘yxati chiqadi */
function showVacantOnly() {
  unitStatus.value = 'VACANT'
  unitQuery.value = ''
}

/** Shartnoma tugashiga qolgan muddat: 12 oydan kam bo‘lsa ogohlantiriladi */
function expiryTone(days: number | null) {
  if (days === null) return 'text-ink-400'
  if (days <= 180) return 'text-danger-600'
  if (days <= RENEWAL_WINDOW) return 'text-warn-700'
  return 'text-ink-600'
}

// ---------------------------------------------------------------------------
// Bo‘sh maydon ro‘yxatini hujjat qilib saqlash

const exporting = ref(false)

function exportVacancy() {
  const site = activeSite.value
  if (!site) return
  exporting.value = true

  const lines: DocxLine[] = [
    { text: t('whs.blVacancyDocTitle'), style: 'title' },
    { text: `${site.building.name}, ${site.building.district}`, style: 'subtitle' },
    { text: t('whs.blAsOfDate', { date: dateShort(TODAY) }), style: 'small' },
    { text: '' },
  ]

  for (const block of site.blocks) {
    const vacant = block.rows.filter((r) => r.status === 'VACANT')
    lines.push({ text: `${block.name}`, style: 'heading' })
    lines.push({
      text: t('whs.blDocBlockSummary', {
        area: num(block.area),
        occupancy: block.occupancy,
        height: num(block.clearHeight, 1),
        load: num(block.slabLoad, 1),
        cranes: block.craneBays,
        docks: block.docks,
        gates: block.gates,
      }),
    })
    if (!vacant.length) {
      lines.push({ text: `${t('empty.noVacantArea')}.`, style: 'small' })
      lines.push({ text: '' })
      continue
    }
    for (const row of vacant) {
      lines.push({
        text: t('whs.blDocUnitLine', {
          code: row.code,
          floor: floorLabel(row.floor),
          area: num(row.area),
          rent: sum(row.rent),
          perSqm: num(row.rentPerSqm),
          equipment: row.equipment.join(', '),
        }),
      })
    }
    lines.push({
      text: t('whs.blDocBlockTotal', {
        n: vacant.length,
        area: num(block.vacantArea),
        cost: sum(block.vacancyCost),
      }),
      style: 'small',
    })
    lines.push({ text: '' })
  }

  lines.push({
    text: t('whs.blDocSiteTotal', {
      area: num(site.vacantArea),
      cost: sum(site.vacancyCost),
    }),
    style: 'heading',
  })
  lines.push({
    text: t('whs.blDocContact', {
      name: site.building.manager,
      phone: site.building.managerPhone,
    }),
  })

  saveBlob(docxBlob(lines), `${fileSlug(`bosh-maydon-${site.building.name}`)}.docx`)
  exporting.value = false
}
</script>

<template>
  <AppTopbar
    :title="t('whs.blocksTitle')"
    :subtitle="t('whs.blocksCaption')"
    :breadcrumb="[
      { label: field('warehouse', 'Ombor'), to: '/warehouse' },
      { label: t('whs.blocksTitle') },
    ]"
  >
    <template #actions>
      <UiButton variant="secondary" size="sm" to="/warehouse">
        <UiIcon name="box" :size="16" />
        {{ t('whs.materialWarehouse') }}
      </UiButton>
      <UiButton size="sm" :loading="exporting" @click="exportVacancy">
        <UiIcon name="download" :size="16" />
        {{ t('whs.blVacancyList') }}
      </UiButton>
    </template>
  </AppTopbar>

  <main class="scroll-slim flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
    <!-- Modul chegarasi: bu ekran ijara omborlari, javondagi material emas -->
    <div
      class="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-card bg-brand-50 px-4 py-2 ring-1 ring-inset ring-brand-100"
    >
      <UiIcon name="info" :size="18" class="shrink-0 text-brand-600" />
      <p class="min-w-[240px] flex-1 py-1 text-[13px] leading-relaxed text-brand-700">
        {{ t('whs.blScopeNote') }}
      </p>
      <NuxtLink
        to="/warehouse"
        class="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-field px-3 text-[13px] font-semibold text-brand-700 transition-colors hover:bg-brand-100"
      >
        {{ t('whs.blGoToMaterial') }}
        <UiIcon name="chevronRight" :size="16" />
      </NuxtLink>
    </div>

    <section v-if="sites.length" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      <UiKpi
        v-for="k in kpis"
        :key="k.key"
        :label="k.label"
        :value="k.value"
        :unit="k.unit"
        :icon="k.icon"
        :tone="k.tone"
        :gauge="k.gauge"
      />
    </section>

    <dl
      v-if="sites.length"
      class="grid gap-x-6 gap-y-3 rounded-card bg-surface p-4 shadow-card ring-1 ring-ink-200/60 sm:grid-cols-2 xl:grid-cols-4"
    >
      <div
        v-for="f in portfolioFacts"
        :key="f.key"
        class="flex items-baseline justify-between gap-3 border-b border-ink-100 pb-3 last:border-0 sm:border-0 sm:pb-0"
      >
        <dt class="text-[13px] text-ink-500">{{ f.label }}</dt>
        <dd class="tabular text-right text-[13px] font-bold text-ink-900">{{ f.value }}</dd>
      </div>
    </dl>

    <UiEmpty
      v-if="!sites.length"
      icon="box"
      :title="t('whs.blNoSitesTitle')"
      :description="t('whs.blNoSitesText')"
    />

    <template v-else>
      <!-- Obyekt tanlash -->
      <UiCard
        :title="t('whs.blocksTitle')"
        :subtitle="t('whs.blSitesBlocksCount', { s: sites.length, b: portfolio.blocks })"
        icon="building"
        flush
        :padded="false"
      >
        <div class="grid gap-3 border-t border-ink-100 p-4 sm:p-5 md:grid-cols-2 xl:grid-cols-3">
          <button
            v-for="s in sites"
            :key="s.id"
            type="button"
            class="rounded-panel p-4 text-left ring-1 transition-all hover:-translate-y-0.5 hover:shadow-card"
            :class="
              s.id === activeSite?.id
                ? 'bg-brand-50 ring-2 ring-brand-400'
                : 'bg-surface ring-ink-200 hover:ring-brand-300'
            "
            :aria-pressed="s.id === activeSite?.id"
            @click="selectSite(s.id)"
          >
            <span class="flex items-start justify-between gap-3">
              <span class="min-w-0">
                <span class="block truncate text-[14px] font-bold text-ink-900">
                  {{ s.building.name }}
                </span>
                <span class="mt-0.5 block truncate text-[12px] text-ink-500">
                  {{ s.building.district }} · {{ s.building.buildingClass }}
                </span>
              </span>
              <span
                class="tabular shrink-0 rounded-pill px-2 py-0.5 text-[12px] font-bold"
                :class="
                  s.occupancy >= 90
                    ? 'bg-ok-50 text-ok-800'
                    : s.occupancy >= 70
                      ? 'bg-brand-50 text-brand-700'
                      : 'bg-warn-50 text-warn-800'
                "
              >
                {{ s.occupancy }}%
              </span>
            </span>

            <span class="mt-3 block h-1.5 overflow-hidden rounded-pill bg-ink-200">
              <span
                class="block h-full rounded-pill bg-brand-500"
                :style="{ width: `${s.occupancy}%` }"
              />
            </span>

            <span class="mt-3 grid grid-cols-3 gap-2">
              <span class="block">
                <span class="tabular block text-[14px] font-bold text-ink-900">
                  {{ s.blocks.length }}
                </span>
                <span class="block text-[11px] text-ink-500">{{ t('whs.blockWord') }}</span>
              </span>
              <span class="block">
                <span class="tabular block text-[14px] font-bold text-ink-900">
                  {{ num(s.area) }}
                </span>
                <span class="block text-[11px] text-ink-500">{{ t('whs.blSqmTotal') }}</span>
              </span>
              <span class="block">
                <span
                  class="tabular block text-[14px] font-bold"
                  :class="s.vacantArea > 0 ? 'text-ok-700' : 'text-ink-900'"
                >
                  {{ num(s.vacantArea) }}
                </span>
                <span class="block text-[11px] text-ink-500">{{ t('whs.blSqmVacant') }}</span>
              </span>
            </span>
          </button>
        </div>
      </UiCard>

      <!-- Uchastka navigatori va blok kartochkasi -->
      <section class="grid gap-5 xl:grid-cols-3">
        <UiCard
          class="xl:col-span-2"
          :title="t('whs.blNavigator')"
          :subtitle="t('whs.blNavigatorCaption')"
          icon="cube"
        >
          <template #actions>
            <div class="flex items-center gap-1.5">
              <UiButton
                variant="ghost"
                size="sm"
                :aria-label="t('whs.blRotateLeft')"
                @click="rotate(-1)"
              >
                <UiIcon name="chevronLeft" :size="16" />
              </UiButton>
              <UiButton
                variant="ghost"
                size="sm"
                :aria-label="t('whs.blRotateRight')"
                @click="rotate(1)"
              >
                <UiIcon name="chevronRight" :size="16" />
              </UiButton>
              <UiButton variant="ghost" size="sm" @click="resetView">
                <UiIcon name="refresh" :size="16" />
                {{ t('whs.blResetView') }}
              </UiButton>
            </div>
          </template>

          <div v-if="levelTabs.length" class="mb-3 flex flex-wrap items-center gap-2">
            <span class="text-[12px] font-semibold text-ink-500">{{ t('whs.blLevel') }}</span>
            <UiTabs v-model="levelModel" :tabs="levelTabs" />
          </div>

          <!--
            Chizma telefon ekranida siqilib ketmasligi uchun eng kichik kengligi
            belgilangan: sahifa emas, shu quti gorizontal siljiydi, shuning
            uchun unit kodlari har qanday ekranda o‘qiladigan qoladi.
          -->
          <div
            class="scroll-slim overflow-x-auto rounded-panel bg-surface-sunken ring-1 ring-ink-200"
          >
            <svg
              v-if="scene"
              :viewBox="`0 0 ${VIEW_W} ${VIEW_H}`"
              class="block h-auto w-full min-w-[560px]"
              role="img"
              :aria-label="
                t('whs.blSceneAria', {
                  site: activeSite?.building.name ?? '',
                  n: activeSite?.blocks.length ?? 0,
                })
              "
            >
              <!-- Uchastka maydoni va o‘lchov to‘ri -->
              <polygon :points="scene.ground" fill="#eef2f8" stroke="#dbe3f0" stroke-width="1" />
              <path
                v-for="(line, i) in scene.grid"
                :key="`g${i}`"
                :d="line"
                stroke="#dde5f1"
                stroke-width="1"
                fill="none"
              />

              <template v-for="item in scene.order" :key="item.id">
                <!-- Xizmat qurilmalari: KPP, yuk maydoni, qozonxona -->
                <g v-if="item.service">
                  <polygon
                    v-for="(f, i) in item.service.faces"
                    :key="i"
                    :points="f.points"
                    :fill="f.fill"
                    :fill-opacity="f.opacity"
                    stroke="#b9c6dd"
                    stroke-width="1"
                  />
                  <text
                    :x="item.service.labelX"
                    :y="item.service.labelY"
                    text-anchor="middle"
                    class="fill-ink-500 text-[11px] font-semibold"
                  >
                    {{ item.service.label }}
                  </text>
                </g>

                <!-- Ombor bloki: shaffof qobiq, ichida unit kataklari -->
                <g
                  v-else-if="item.block"
                  class="cursor-pointer"
                  role="button"
                  tabindex="0"
                  :aria-label="item.block.aria"
                  @click="selectBlock(item.block.id)"
                  @keydown.enter.prevent="selectBlock(item.block.id)"
                  @keydown.space.prevent="selectBlock(item.block.id)"
                >
                  <polygon
                    v-for="(f, i) in item.block.faces"
                    :key="`f${i}`"
                    :points="f.points"
                    :fill="f.fill"
                    :fill-opacity="f.opacity"
                    :stroke="item.block.selected ? '#0256f7' : '#94a2b8'"
                    :stroke-width="item.block.selected ? 1.6 : 1"
                  />

                  <polygon
                    v-for="cell in item.block.cells"
                    :key="cell.id"
                    :points="cell.points"
                    :fill="cell.fill"
                    :fill-opacity="item.block.selected ? 0.94 : 0.62"
                    :stroke="cell.id === unitId ? '#131c2b' : '#ffffff'"
                    :stroke-width="cell.id === unitId ? 2.4 : 1"
                    class="cursor-pointer transition-opacity hover:opacity-80"
                    @click.stop="selectBlock(item.block.id); selectUnit(cell.id)"
                  >
                    <title>{{ cell.aria }}</title>
                  </polygon>

                  <!-- Dok-rampalar old devorda: plitadan keyin, aks holda ular yopiladi -->
                  <polygon
                    v-for="(d, i) in item.block.docks"
                    :key="`d${i}`"
                    :points="d.points"
                    :fill="d.fill"
                    :fill-opacity="d.opacity"
                    class="pointer-events-none"
                  />

                  <!-- Kod har qanday rang ustida o‘qilishi uchun to‘q hoshiya bilan -->
                  <text
                    v-for="cell in item.block.labels"
                    :key="`t${cell.id}`"
                    :x="cell.cx"
                    :y="cell.cy + 4"
                    text-anchor="middle"
                    stroke="#131c2b"
                    stroke-width="2.6"
                    stroke-opacity="0.5"
                    paint-order="stroke"
                    class="pointer-events-none fill-white text-[11px] font-bold"
                  >
                    {{ cell.label }}
                  </text>

                </g>
              </template>

              <!-- Nishonchalar eng ustki qatlamda: qo‘shni blok ularni yopmaydi -->
              <g v-for="b in scene.badges" :key="`b${b.id}`" class="pointer-events-none">
                <rect
                  :x="b.x"
                  :y="b.y"
                  :width="b.w"
                  height="20"
                  rx="10"
                  fill="#ffffff"
                  :stroke="b.selected ? '#0256f7' : '#cbd4e3'"
                  :stroke-width="b.selected ? 1.6 : 1"
                />
                <text
                  :x="b.x + b.w / 2"
                  :y="b.y + 14"
                  text-anchor="middle"
                  class="text-[12px] font-bold"
                  :fill="b.tone"
                >
                  {{ b.text }}
                </text>
              </g>
            </svg>
          </div>

          <div class="mt-3 flex flex-wrap items-center justify-between gap-3">
            <ul class="flex flex-wrap items-center gap-x-4 gap-y-2">
              <li
                v-for="l in legend"
                :key="l.label"
                class="flex items-center gap-1.5 text-[12px] text-ink-600"
              >
                <span class="size-3 rounded-[4px]" :style="{ backgroundColor: l.color }" />
                {{ l.label }}
              </li>
              <li class="flex items-center gap-1.5 text-[12px] text-ink-600">
                <span class="h-3 w-2 rounded-[4px] bg-ink-700" />
                {{ t('whs.blDock') }}
              </li>
            </ul>
            <p class="tabular text-[12px] text-ink-500">
              {{
                t('whs.blPlotSize', {
                  w: num(activeSite?.plot.width ?? 0),
                  d: num(activeSite?.plot.depth ?? 0),
                })
              }}
            </p>
          </div>
        </UiCard>

        <UiCard
          v-if="activeBlock"
          :title="activeBlock.name"
          :subtitle="`${activeSite?.building.name}, ${areaText(activeBlock.area)}`"
          icon="box"
          tone="warn"
        >
          <div class="grid grid-cols-3 gap-2.5">
            <div class="rounded-field bg-brand-50 p-3 ring-1 ring-inset ring-brand-100">
              <span class="tabular block text-[22px] font-bold leading-none text-brand-700">
                {{ activeBlock.occupancy }}%
              </span>
              <span class="mt-1.5 block text-[11px] font-medium text-brand-700">
                {{ t('kpi.occupancy') }}
              </span>
            </div>
            <div class="rounded-field bg-ok-50 p-3 ring-1 ring-inset ring-ok-100">
              <span class="tabular block text-[22px] font-bold leading-none text-ok-800">
                {{ activeBlock.vacantCount }}
              </span>
              <span class="mt-1.5 block text-[11px] font-medium text-ok-800">
                {{ t('whs.blVacantUnit') }}
              </span>
            </div>
            <div class="rounded-field bg-ink-100 p-3 ring-1 ring-inset ring-ink-200">
              <span class="tabular block text-[22px] font-bold leading-none text-ink-900">
                {{ num(activeBlock.largestVacant) }}
              </span>
              <span class="mt-1.5 block text-[11px] font-medium text-ink-600">
                {{ t('whs.blLargestSqm') }}
              </span>
            </div>
          </div>

          <dl class="mt-4 space-y-2.5 border-t border-ink-100 pt-4">
            <div v-for="f in blockFacts" :key="f.key" class="flex items-baseline justify-between gap-3">
              <dt class="min-w-0 text-[13px] text-ink-500">
                {{ f.label }}
                <span class="block truncate text-[11px] text-ink-400">{{ f.hint }}</span>
              </dt>
              <dd class="tabular shrink-0 text-[14px] font-bold text-ink-900">{{ f.value }}</dd>
            </div>
          </dl>

          <dl class="mt-4 space-y-2.5 border-t border-ink-100 pt-4">
            <div v-for="m in blockMoney" :key="m.key" class="flex items-baseline justify-between gap-3">
              <dt class="text-[13px] text-ink-500">{{ m.label }}</dt>
              <dd class="tabular shrink-0 text-[14px] font-bold text-ink-900">{{ m.value }}</dd>
            </div>
          </dl>

          <div v-if="activeUnit" class="mt-4 rounded-field bg-surface-sunken p-3.5 ring-1 ring-ink-200">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="tabular text-[14px] font-bold text-ink-900">
                  {{ t('whs.blUnitWithCode', { code: activeUnit.code }) }}
                </p>
                <p class="mt-0.5 text-[12px] text-ink-500">
                  {{ floorLabel(activeUnit.floor) }} · {{ areaText(activeUnit.area) }}
                </p>
              </div>
              <UiStatus kind="unit" :value="activeUnit.status" size="sm" />
            </div>
            <p v-if="activeUnit.tenant" class="mt-2 text-[13px] text-ink-700">
              {{ activeUnit.tenant }}
              <span class="tabular text-ink-500">· {{ activeUnit.contractCode }}</span>
            </p>
            <p v-else class="mt-2 text-[13px] font-semibold text-ok-700">
              {{ t('whs.blOfferedForRent') }}
            </p>
            <p class="tabular mt-1.5 text-[13px] text-ink-700">
              {{
                activeUnit.rent
                  ? `${money(activeUnit.rent)} / ${t('unitOf.month')}`
                  : t('whs.blPerSqmValue', { v: num(activeUnit.salePerSqm) })
              }}
            </p>
          </div>

          <UiButton
            v-if="activeBlock.vacantCount"
            variant="secondary"
            size="sm"
            block
            class="mt-4"
            @click="showVacantOnly"
          >
            <UiIcon name="filter" :size="16" />
            {{ t('whs.blShowVacant') }}
          </UiButton>
        </UiCard>
      </section>

      <!-- Uchastka bloklari -->
      <UiCard
        :title="t('whs.blSiteBlocks')"
        :subtitle="
          t('whs.blSiteBlocksCaption', {
            site: activeSite?.building.name ?? '',
            n: activeSite?.blocks.length ?? 0,
            area: num(activeSite?.area ?? 0),
          })
        "
        icon="layers"
        flush
        :padded="false"
      >
        <UiTable
          :columns="blockColumns"
          :rows="blockRows"
          :empty="t('whs.blEmptyBlocks')"
          @row-click="selectBlock($event.id)"
        >
          <template #cell-name="{ row }">
            <span class="flex items-center gap-2">
              <span
                class="size-2.5 shrink-0 rounded-full"
                :class="row.id === activeBlock?.id ? 'bg-brand-500' : 'bg-ink-300'"
              />
              <span class="font-semibold text-ink-900">{{ row.name }}</span>
            </span>
          </template>

          <template #cell-floors="{ row }">
            <span class="text-[13px] text-ink-600">{{ row.floors }}</span>
          </template>

          <template #cell-area="{ row }">{{ num(row.area) }}</template>

          <template #cell-occupancy="{ row }">
            <span class="flex items-center gap-2">
              <span class="h-1.5 w-16 shrink-0 overflow-hidden rounded-pill bg-ink-200">
                <span
                  class="block h-full rounded-pill"
                  :class="
                    row.occupancy >= 90 ? 'bg-ok-500' : row.occupancy >= 70 ? 'bg-brand-500' : 'bg-warn-500'
                  "
                  :style="{ width: `${row.occupancy}%` }"
                />
              </span>
              <span class="tabular text-[13px] font-semibold text-ink-900">{{ row.occupancy }}%</span>
            </span>
          </template>

          <template #cell-vacant="{ row }">
            <span :class="row.vacant > 0 ? 'font-bold text-ok-700' : 'text-ink-400'">
              {{ num(row.vacant) }}
            </span>
          </template>

          <template #cell-height="{ row }">{{ num(row.height, 1) }} {{ t('unitOf.meter') }}</template>
          <template #cell-rent="{ row }">{{ num(row.rent) }}</template>
        </UiTable>

        <!-- Uchastka infratuzilmasi: pasport va qurilmalar reyestridan -->
        <template #footer>
          <ul class="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[12px] text-ink-600">
            <li class="tabular flex items-center gap-1.5">
              <UiIcon name="cube" :size="14" class="text-ink-400" />
              {{ t('whs.blTruckSpaces', { n: activeSite?.truckSpaces ?? 0 }) }}
            </li>
            <li class="tabular flex items-center gap-1.5">
              <UiIcon name="tools" :size="14" class="text-ink-400" />
              {{ t('whs.blCranes', { n: activeSite?.cranes ?? 0 }) }}
            </li>
            <li class="tabular flex items-center gap-1.5">
              <UiIcon name="layers" :size="14" class="text-ink-400" />
              {{ t('whs.blFreightLifts', { n: activeSite?.freightLifts ?? 0 }) }}
            </li>
            <li class="tabular flex items-center gap-1.5">
              <UiIcon name="user" :size="14" class="text-ink-400" />
              {{ activeSite?.building.manager }}, {{ activeSite?.building.managerPhone }}
            </li>
          </ul>
        </template>
      </UiCard>

      <!-- Blok unitlari -->
      <UiCard
        v-if="activeBlock"
        :title="t('whs.blBlockUnits', { name: activeBlock.name })"
        :subtitle="
          t('whs.blUnitsShown', { n: unitRows.length, total: activeBlock.rows.length })
        "
        icon="grid"
        tone="teal"
        flush
        :padded="false"
      >
        <div class="grid gap-3 border-t border-ink-100 bg-surface-sunken px-4 py-4 sm:px-5 lg:grid-cols-3">
          <UiInput v-model="unitQuery" :placeholder="t('whs.blUnitSearch')" class="lg:col-span-1">
            <template #prefix>
              <UiIcon name="search" :size="18" />
            </template>
          </UiInput>
          <UiSelect v-model="unitStatus" :options="statusOptions" />
          <div class="flex items-center gap-2">
            <UiButton variant="secondary" size="sm" @click="showVacantOnly">
              {{ t('filter.onlyVacant') }}
            </UiButton>
            <UiButton v-if="unitFiltersDirty" variant="ghost" size="sm" @click="resetUnitFilters">
              <UiIcon name="refresh" :size="16" />
              {{ t('common.reset') }}
            </UiButton>
          </div>
        </div>

        <UiTable
          :columns="unitColumns"
          :rows="unitRows"
          :empty="unitEmptyText"
          @row-click="selectUnit($event.id)"
        >
          <template #cell-code="{ row }">
            <span
              class="tabular inline-flex items-center gap-1.5 text-[13px] font-bold text-ink-900"
            >
              <span
                class="size-2.5 shrink-0 rounded-[4px]"
                :style="{ backgroundColor: UNIT_STATUS_COLOR[row.status] }"
              />
              {{ row.code }}
              <UiIcon v-if="row.id === unitId" name="check" :size="14" class="text-brand-500" />
            </span>
          </template>

          <template #cell-floor="{ row }">{{ row.floor }}</template>
          <template #cell-area="{ row }">{{ num(row.area) }}</template>

          <template #cell-status="{ row }">
            <UiStatus kind="unit" :value="row.status" size="sm" />
          </template>

          <template #cell-tenant="{ row }">
            <span v-if="row.tenant" class="text-[13px] text-ink-800">{{ row.tenant }}</span>
            <span v-else class="text-[13px] text-ink-400">{{ statusLabel('unit', 'VACANT') }}</span>
          </template>

          <template #cell-rent="{ row }">
            <span v-if="row.rent">{{ num(row.rent) }}</span>
            <span v-else class="text-ink-400">{{ t('whs.blForSale') }}</span>
          </template>

          <template #cell-perSqm="{ row }">
            <span v-if="row.rentPerSqm">{{ num(row.rentPerSqm) }}</span>
            <span v-else>{{ num(row.salePerSqm) }}</span>
          </template>

          <template #cell-ends="{ row }">
            <span v-if="row.endsAt" class="tabular text-[13px]" :class="expiryTone(row.daysLeft)">
              {{ dateShort(row.endsAt) }}
              <span class="block text-[11px]">
                {{ num(row.daysLeft ?? 0) }} {{ t('unitOf.day') }}
              </span>
            </span>
            <span v-else class="text-[13px] text-ink-400">{{ t('whs.blNoContract') }}</span>
          </template>

          <template #cell-features="{ row }">
            <span class="flex flex-wrap gap-1">
              <span
                v-for="e in row.equipment"
                :key="e"
                class="rounded-pill bg-ink-100 px-2 py-0.5 text-[11px] font-medium text-ink-600"
              >
                {{ e }}
              </span>
            </span>
          </template>
        </UiTable>
      </UiCard>
    </template>
  </main>
</template>
