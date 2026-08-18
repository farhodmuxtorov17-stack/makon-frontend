/**
 * Qavat rejasi generatori.
 *
 * Reja unitlarning HAQIQIY maydonidan quriladi: qavatning umumiy o‘lchami
 * ijaraga beriladigan maydonlar yig‘indisini samaradorlik koeffitsiyentiga
 * bo‘lish orqali topiladi, so‘ng maydon ikki tomonlama koridor bo‘ylab
 * taqsimlanadi. Shu sababli 600 m² lik unit 80 m² lik unitdan aynan yetti
 * baravar katta chiziladi, qavat esa arxitektura chizmasidek ko‘rinadi:
 * tashqi va ichki devor qalinligi, xizmat yadrosi (lift, zinapoya, sanitar
 * tugun), koridor, eshik burilishi va fasaddagi deraza yo‘laklari.
 *
 * Barcha o‘lchamlar METRDA. SVG shu o‘lchamda chiziladi, shuning uchun
 * o‘lcham chiziqlari va masshtab haqiqiy qiymatni ko‘rsatadi.
 */

export type PlanKind = 'office' | 'retail' | 'warehouse' | 'residential'

export interface PlanRect {
  x: number
  y: number
  w: number
  h: number
}

export interface PlanCoreItem {
  kind: 'lift' | 'stair' | 'wc' | 'shaft'
  rect: PlanRect
  label: string
}

/** Eshik: `facing` qaysi tomonga ochilishini, `hinge` qaysi chetda turishini bildiradi */
export interface PlanDoor {
  x: number
  y: number
  width: number
  facing: 'up' | 'down' | 'left' | 'right'
  hinge: 1 | -1
}

export interface PlanWindow {
  x1: number
  y1: number
  x2: number
  y2: number
}

export interface PlanUnitShape {
  id: string
  code: string
  area: number
  /** Metrdagi burchak nuqtalari */
  points: Array<[number, number]>
  door: PlanDoor
}

export interface FloorPlan {
  kind: PlanKind
  /** Qavatning tashqi o‘lchami, metr */
  width: number
  height: number
  /** Tashqi va ichki devor qalinligi, metr */
  wallOuter: number
  wallInner: number
  corridors: PlanRect[]
  core: PlanCoreItem[]
  units: PlanUnitShape[]
  windows: PlanWindow[]
  /** Devor tanasi: chizmada to‘ldirilgan holda chiziladi */
  walls: PlanRect[]
  /** Devordagi deraza teshiklari, tashqi devor bo‘ylab */
  openings: PlanRect[]
  /** Koordinata o‘qlari: raqamli (vertikal) va harfli (gorizontal) */
  axes: { xs: number[]; ys: number[] }
  /** Umumiy qurilish maydoni, m² */
  grossArea: number
  /** Ijaraga beriladigan maydon, m² */
  usableArea: number
  /** Foydali maydon ulushi, 0–1 */
  efficiency: number
}

export interface PlanInput {
  units: Array<{ id: string; code: string; area: number }>
  buildingType: string
  floor: number
  /** Yer osti qavati texnik qavat sifatida chiziladi */
  underground?: boolean
}

/**
 * Bino turi rejaning tuzilishini belgilaydi: ofisda tor koridor va markaziy
 * yadro, savdo markazida keng piyoda yo‘lak, omborda esa keng yo‘lak va
 * chetdagi ma’muriy blok bo‘ladi.
 */
const KIND_BY_TYPE: Record<string, PlanKind> = {
  'Biznes markaz': 'office',
  'Ofis binosi': 'office',
  'Savdo markaz': 'retail',
  'Ombor / logistika': 'warehouse',
  'Turar joy': 'residential',
}

interface KindSpec {
  /** Yo‘lak chuqurligi, metr: ofisda 8 m, omborda 18 m atrofida bo‘ladi */
  bandDepth: number
  /** Uzun tomonning qisqa tomonga nisbati */
  aspect: number
  /** Koridor kengligi, metr */
  corridor: number
  wallOuter: number
  wallInner: number
  /** Xizmat yadrosi maydoni ijara maydonining necha ulushiga teng */
  coreShare: number
}

const SPEC: Record<PlanKind, KindSpec> = {
  office: { bandDepth: 8.4, aspect: 1.55, corridor: 2.2, wallOuter: 0.35, wallInner: 0.12, coreShare: 0.13 },
  retail: { bandDepth: 12, aspect: 1.3, corridor: 4.5, wallOuter: 0.4, wallInner: 0.15, coreShare: 0.11 },
  warehouse: { bandDepth: 18, aspect: 2.1, corridor: 4, wallOuter: 0.45, wallInner: 0.2, coreShare: 0.05 },
  residential: { bandDepth: 7.2, aspect: 1.25, corridor: 1.8, wallOuter: 0.35, wallInner: 0.12, coreShare: 0.14 },
}

export function planKindOf(buildingType: string): PlanKind {
  return KIND_BY_TYPE[buildingType] ?? 'office'
}

const rect = (x: number, y: number, w: number, h: number): PlanRect => ({ x, y, w, h })

const corners = (r: PlanRect): Array<[number, number]> => [
  [r.x, r.y],
  [r.x + r.w, r.y],
  [r.x + r.w, r.y + r.h],
  [r.x, r.y + r.h],
]

/**
 * Unitlarni ikki yo‘lakka taqsimlaydi. Maqsad — ikkala yo‘lak uzunligi
 * imkon qadar teng bo‘lishi, shunda qavat simmetrik ko‘rinadi. Katta
 * maydonlar navbat bilan joylanadi, bu esa haqiqiy loyihalashga yaqin.
 */
function splitBands(areas: number[]): [number[], number[]] {
  const order = areas.map((a, i) => ({ a, i })).sort((p, q) => q.a - p.a)
  const top: number[] = []
  const bottom: number[] = []
  let sumTop = 0
  let sumBottom = 0
  for (const { i, a } of order) {
    if (sumTop <= sumBottom) {
      top.push(i)
      sumTop += a
    } else {
      bottom.push(i)
      sumBottom += a
    }
  }
  // Yo‘lak ichida kodlar tartibida joylashsin, aks holda raqamlar sakraydi
  return [top.sort((p, q) => p - q), bottom.sort((p, q) => p - q)]
}

/** Yadro tarkibi: lift, zinapoya va sanitar tugun bitta blokda turadi */
function buildCore(core: PlanRect, kind: PlanKind): PlanCoreItem[] {
  if (kind === 'warehouse') {
    return [
      { kind: 'stair', rect: rect(core.x, core.y, core.w, core.h * 0.5), label: 'Zinapoya' },
      { kind: 'wc', rect: rect(core.x, core.y + core.h * 0.5, core.w, core.h * 0.5), label: 'STU' },
    ]
  }

  const liftH = core.h * 0.42
  const stairH = core.h * 0.3
  const wcH = core.h - liftH - stairH
  const half = core.w / 2

  return [
    { kind: 'lift', rect: rect(core.x, core.y, half, liftH), label: 'Lift' },
    { kind: 'lift', rect: rect(core.x + half, core.y, half, liftH), label: 'Lift' },
    { kind: 'stair', rect: rect(core.x, core.y + liftH, core.w, stairH), label: 'Zinapoya' },
    { kind: 'wc', rect: rect(core.x, core.y + liftH + stairH, core.w, wcH), label: 'Sanitar tugun' },
  ]
}

/**
 * Fasad bo‘ylab deraza yo‘laklari. Har bir tashqi devorda bir tekis
 * taqsimlangan segmentlar chiziladi, omborda esa deraza o‘rniga yuk
 * eshiklari bo‘lgani uchun ular kamroq va kengroq bo‘ladi.
 */
function buildWindows(width: number, height: number, kind: PlanKind): PlanWindow[] {
  const step = kind === 'warehouse' ? 9 : kind === 'retail' ? 6 : 3.6
  const span = step * 0.62
  const out: PlanWindow[] = []

  const along = (length: number, place: (from: number, to: number) => PlanWindow) => {
    const count = Math.max(2, Math.floor(length / step))
    const pitch = length / count
    for (let i = 0; i < count; i++) {
      const centre = pitch * (i + 0.5)
      out.push(place(centre - span / 2, centre + span / 2))
    }
  }

  along(width, (a, b) => ({ x1: a, y1: 0, x2: b, y2: 0 }))
  along(width, (a, b) => ({ x1: a, y1: height, x2: b, y2: height }))
  along(height, (a, b) => ({ x1: 0, y1: a, x2: 0, y2: b }))
  along(height, (a, b) => ({ x1: width, y1: a, x2: width, y2: b }))
  return out
}


/**
 * Chizmadagi devor tanasi. Arxitektura chizmasida devor bitta chiziq emas,
 * qalinligi bor va to‘ldirib ko‘rsatiladi (poche). Tashqi kontur to‘rtta
 * lentadan, ichki bo‘linmalar esa unitlar orasidagi ingichka lentalardan
 * iborat.
 */
function buildWalls(
  width: number,
  height: number,
  wallOuter: number,
  wallInner: number,
  units: PlanUnitShape[],
  corridors: PlanRect[],
): PlanRect[] {
  const out: PlanRect[] = [
    rect(0, 0, width, wallOuter),
    rect(0, height - wallOuter, width, wallOuter),
    rect(0, wallOuter, wallOuter, height - wallOuter * 2),
    rect(width - wallOuter, wallOuter, wallOuter, height - wallOuter * 2),
  ]

  const half = wallInner / 2
  const seen = new Set<string>()
  const add = (r: PlanRect) => {
    const key = [r.x, r.y, r.w, r.h].map((v) => v.toFixed(2)).join(':')
    if (seen.has(key)) return
    seen.add(key)
    out.push(r)
  }

  for (const u of units) {
    const xs = u.points.map((p) => p[0])
    const ys = u.points.map((p) => p[1])
    const x1 = Math.min(...xs)
    const x2 = Math.max(...xs)
    const y1 = Math.min(...ys)
    const y2 = Math.max(...ys)
    // Har bir unitning to‘rt tomoni: tashqi konturga tegib turganlari
    // allaqachon tashqi devor bilan qoplangan
    if (y1 > wallOuter + 0.01) add(rect(x1 - half, y1 - half, x2 - x1 + wallInner, wallInner))
    if (y2 < height - wallOuter - 0.01) add(rect(x1 - half, y2 - half, x2 - x1 + wallInner, wallInner))
    if (x1 > wallOuter + 0.01) add(rect(x1 - half, y1 - half, wallInner, y2 - y1 + wallInner))
    if (x2 < width - wallOuter - 0.01) add(rect(x2 - half, y1 - half, wallInner, y2 - y1 + wallInner))
  }

  for (const c of corridors) {
    add(rect(c.x - half, c.y - half, c.w + wallInner, wallInner))
    add(rect(c.x - half, c.y + c.h - half, c.w + wallInner, wallInner))
  }

  return out
}

/**
 * Koordinata o‘qlari: chizmada raqamli va harfli o‘qlar unit chegaralaridan
 * o‘tadi, shuning uchun har bir bo‘linma o‘lchamga bog‘lanadi.
 */
function buildAxes(units: PlanUnitShape[], width: number, height: number) {
  // Pufakchalar diametri qavat o‘lchamiga bog‘liq, shuning uchun eng kichik
  // masofa ham shunga qarab olinadi: aks holda raqamlar ustma-ust tushadi
  const gap = Math.max(width, height) * 0.055
  const uniq = (list: number[], last: number) => {
    const sorted = [...new Set(list.map((v) => Math.round(v * 100) / 100))].sort((a, b) => a - b)
    const out: number[] = []
    for (const v of sorted) {
      if (!out.length || v - out[out.length - 1]! > gap) out.push(v)
    }
    // Oxirgi o‘q chetga juda yaqin bo‘lsa, uning o‘rniga chekka qoladi
    if (out.length > 1 && last - out[out.length - 1]! < gap) out[out.length - 1] = last
    else if (out[out.length - 1] !== last) out.push(last)
    return out
  }
  const xs = uniq([0, ...units.flatMap((u) => u.points.map((p) => p[0]))], width)
  const ys = uniq([0, ...units.flatMap((u) => u.points.map((p) => p[1]))], height)
  return { xs, ys }
}

/** Deraza teshigi: devor tanasidagi bo‘shliq */
function windowOpenings(windows: PlanWindow[], wallOuter: number): PlanRect[] {
  return windows.map((w) => {
    const horizontal = Math.abs(w.y2 - w.y1) < 0.001
    return horizontal
      ? rect(Math.min(w.x1, w.x2), w.y1 - wallOuter / 2, Math.abs(w.x2 - w.x1), wallOuter)
      : rect(w.x1 - wallOuter / 2, Math.min(w.y1, w.y2), wallOuter, Math.abs(w.y2 - w.y1))
  })
}

/**
 * Halqa reja: unitlar perimetr bo‘ylab to‘rt tomonda joylashadi, o‘rtada
 * aylanma koridor va xizmat yadrosi turadi. Katta qavatlar aynan shunday
 * loyihalanadi — ikki tomonlama koridor 2000 m² li qavatni 100 metrga
 * cho‘zib yuborardi, halqa esa uni ixcham qoldiradi.
 *
 * Har bir tomon o‘z chuqurligiga ega: chuqurlik shu tomondagi maydonlar
 * yig‘indisini tomon uzunligiga bo‘lish orqali topiladi. Shu sababli
 * to‘rtburchaklar yuzasi unitning haqiqiy m² qiymatiga aynan teng bo‘ladi.
 */
function buildRingPlan(
  list: Array<{ id: string; code: string; area: number }>,
  spec: KindSpec,
  kind: PlanKind,
): FloorPlan | null {
  const usableArea = list.reduce((s, u) => s + u.area, 0)
  const coreArea = usableArea * spec.coreShare

  // Unitlar to‘rt tomonga maydon bo‘yicha teng taqsimlanadi
  const groups: number[][] = [[], [], [], []]
  const sums = [0, 0, 0, 0]
  for (const { i, a } of list
    .map((u, i) => ({ i, a: u.area }))
    .sort((p, q) => q.a - p.a)) {
    let best = 0
    for (let n = 1; n < 4; n++) if (sums[n]! < sums[best]!) best = n
    groups[best]!.push(i)
    sums[best]! += a
  }
  for (const g of groups) g.sort((p, q) => p - q)
  if (groups.some((g) => !g.length)) return null

  const gross = (usableArea + coreArea) * 1.34
  let width = Math.sqrt(gross * spec.aspect)
  let height = gross / width

  let innerW = 0
  let innerH = 0
  let dTop = 0
  let dBottom = 0
  let dLeft = 0
  let dRight = 0
  let sideH = 0

  // Yadro va koridor uchun o‘rtada joy qolishi kerak, shuning uchun
  // o‘lchamlar yetarli bo‘lguncha qavat asta kattalashtiriladi
  for (let step = 0; step < 24; step++) {
    innerW = width - spec.wallOuter * 2
    innerH = height - spec.wallOuter * 2
    dTop = sums[0]! / innerW
    dBottom = sums[1]! / innerW
    sideH = innerH - dTop - dBottom
    if (sideH <= 1) {
      width *= 1.08
      height *= 1.08
      continue
    }
    dLeft = sums[2]! / sideH
    dRight = sums[3]! / sideH
    const holeW = innerW - dLeft - dRight
    const need = spec.corridor * 2 + Math.max(4.5, Math.sqrt(coreArea))
    if (holeW >= need && sideH >= need) break
    width *= 1.08
    height *= 1.08
  }

  if (sideH <= 1 || innerW - dLeft - dRight <= spec.corridor * 2) return null

  const x0 = spec.wallOuter
  const y0 = spec.wallOuter
  const bands = [
    { box: rect(x0, y0, innerW, dTop), horizontal: true, facing: 'down' as const },
    { box: rect(x0, y0 + innerH - dBottom, innerW, dBottom), horizontal: true, facing: 'up' as const },
    { box: rect(x0, y0 + dTop, dLeft, sideH), horizontal: false, facing: 'right' as const },
    { box: rect(x0 + innerW - dRight, y0 + dTop, dRight, sideH), horizontal: false, facing: 'left' as const },
  ]

  const shapes: PlanUnitShape[] = []
  bands.forEach((band, n) => {
    const depth = band.horizontal ? band.box.h : band.box.w
    if (depth <= 0) return
    let cursor = band.horizontal ? band.box.x : band.box.y
    groups[n]!.forEach((i, k) => {
      const u = list[i]!
      const span = u.area / depth
      const box = band.horizontal
        ? rect(cursor, band.box.y, span, depth)
        : rect(band.box.x, cursor, depth, span)
      cursor += span
      const doorW = Math.min(1.1, span * 0.5)
      const door: PlanDoor = band.horizontal
        ? {
            x: box.x + box.w / 2,
            y: band.facing === 'down' ? box.y + box.h : box.y,
            width: doorW,
            facing: band.facing,
            hinge: k % 2 === 0 ? 1 : -1,
          }
        : {
            x: band.facing === 'right' ? box.x + box.w : box.x,
            y: box.y + box.h / 2,
            width: doorW,
            facing: band.facing,
            hinge: k % 2 === 0 ? 1 : -1,
          }
      shapes.push({ id: u.id, code: u.code, area: u.area, points: corners(box), door })
    })
  })

  shapes.sort((a, b) => a.code.localeCompare(b.code, 'en', { numeric: true }))

  const hole = rect(x0 + dLeft, y0 + dTop, innerW - dLeft - dRight, sideH)
  const c = Math.min(spec.corridor, Math.min(hole.w, hole.h) / 3)
  const coreBox = rect(hole.x + c, hole.y + c, hole.w - c * 2, hole.h - c * 2)
  const ringCorridors = [
    rect(hole.x, hole.y, hole.w, c),
    rect(hole.x, hole.y + hole.h - c, hole.w, c),
    rect(hole.x, hole.y + c, c, hole.h - c * 2),
    rect(hole.x + hole.w - c, hole.y + c, c, hole.h - c * 2),
  ]

  return {
    kind,
    width,
    height,
    wallOuter: spec.wallOuter,
    wallInner: spec.wallInner,
    corridors: ringCorridors,
    core: buildCore(coreBox, kind),
    units: shapes,
    windows: buildWindows(width, height, kind),
    walls: buildWalls(width, height, spec.wallOuter, spec.wallInner, shapes, ringCorridors),
    openings: windowOpenings(buildWindows(width, height, kind), spec.wallOuter),
    axes: buildAxes(shapes, width, height),
    grossArea: width * height,
    usableArea,
    efficiency: usableArea / (width * height),
  }
}

/**
 * Qavat rejasini quradi.
 *
 * Tuzilma: tashqi devor → yuqori yo‘lak → koridor → pastki yo‘lak → tashqi
 * devor. Xizmat yadrosi yuqori yo‘lakning o‘rtasida turadi, koridor esa
 * uning oldidan uzilmasdan o‘tadi — haqiqiy ikki tomonlama koridorli
 * qavat aynan shunday tashkil qilinadi.
 *
 * Geometriya maydondan KELIB CHIQADI: yo‘lak chuqurligi tanlanadi, unit
 * kengligi esa `maydon / chuqurlik` ga teng bo‘ladi. Shuning uchun chizilgan
 * shakl yuzasi unitning haqiqiy m² qiymatiga aynan mos tushadi.
 */
export function buildFloorPlan(input: PlanInput): FloorPlan {
  const kind = input.underground ? 'warehouse' : planKindOf(input.buildingType)
  const spec = SPEC[kind]
  const list = input.units.filter((u) => u.area > 0)

  const usableArea = list.reduce((s, u) => s + u.area, 0)
  if (!list.length || usableArea <= 0) {
    return {
      kind,
      width: 20,
      height: 14,
      wallOuter: spec.wallOuter,
      wallInner: spec.wallInner,
      corridors: [],
      core: [],
      units: [],
      windows: buildWindows(20, 14, kind),
      walls: buildWalls(20, 14, spec.wallOuter, spec.wallInner, [], []),
      openings: windowOpenings(buildWindows(20, 14, kind), spec.wallOuter),
      axes: { xs: [0, 20], ys: [0, 14] },
      grossArea: 280,
      usableArea: 0,
      efficiency: 0,
    }
  }

  const areas = list.map((u) => u.area)
  const single = list.length === 1
  const [topIdx, bottomIdx] = single ? [[0], []] : splitBands(areas)
  const sumTop = topIdx.reduce((s, i) => s + areas[i]!, 0)
  const sumBottom = bottomIdx.reduce((s, i) => s + areas[i]!, 0)

  const coreArea = usableArea * spec.coreShare
  const bands = single ? 1 : 2
  // Yo‘lak chuqurligi belgilangan, ichki kenglik shundan kelib chiqadi
  const innerW = Math.max(12, (usableArea + coreArea) / (bands * spec.bandDepth))

  const depthTop = (sumTop + coreArea) / innerW
  const depthBottom = single ? 0 : sumBottom / innerW

  const corridorH = spec.corridor
  const width = innerW + spec.wallOuter * 2
  const height = depthTop + corridorH + depthBottom + spec.wallOuter * 2

  const innerX = spec.wallOuter
  const topY = spec.wallOuter
  const corridorY = topY + depthTop
  const bottomY = corridorY + corridorH

  const corridor = rect(innerX, corridorY, innerW, corridorH)

  /**
   * Yo‘lakni ketma-ket bo‘laklarga ajratadi: har bir bo‘lak kengligi
   * `maydon / chuqurlik`. Devorlar chiziq sifatida ustidan chiziladi,
   * shuning uchun maydondan hech nima yeb qo‘yilmaydi.
   */
  const slice = (indices: number[], depth: number, y: number, coreAt: number | null) => {
    const out: Array<{ index: number; box: PlanRect }> = []
    let cursor = innerX
    let core: PlanRect | null = null
    indices.forEach((index, n) => {
      if (coreAt === n) {
        const coreW = coreArea / depth
        core = rect(cursor, y, coreW, depth)
        cursor += coreW
      }
      const w = areas[index]! / depth
      out.push({ index, box: rect(cursor, y, w, depth) })
      cursor += w
    })
    if (coreAt !== null && coreAt >= indices.length) {
      const coreW = coreArea / depth
      core = rect(cursor, y, coreW, depth)
    }
    return { out, core }
  }

  // Yadro yuqori yo‘lakning o‘rtasiga tushadi
  const coreSlot = Math.max(1, Math.round(topIdx.length / 2))
  const top = slice(topIdx, depthTop, topY, coreSlot)
  const bottom = single
    ? { out: [] as Array<{ index: number; box: PlanRect }>, core: null }
    : slice(bottomIdx, depthBottom, bottomY, null)

  const shapes: PlanUnitShape[] = []
  const collect = (
    items: Array<{ index: number; box: PlanRect }>,
    facing: 'down' | 'up',
  ) => {
    items.forEach(({ index, box }, n) => {
      const u = list[index]!
      const doorW = Math.min(1.1, box.w * 0.5)
      // Eshik koridorga qaraydi, unit chetidan bir oz ichkarida
      const offset = Math.min(Math.max(box.w * 0.2, doorW * 0.6), box.w - doorW / 2 - 0.15)
      shapes.push({
        id: u.id,
        code: u.code,
        area: u.area,
        points: corners(box),
        door: {
          x: box.x + offset,
          y: facing === 'down' ? box.y + box.h : box.y,
          width: doorW,
          facing,
          hinge: n % 2 === 0 ? 1 : -1,
        },
      })
    })
  }
  collect(top.out, 'down')
  collect(bottom.out, 'up')

  shapes.sort((a, b) => a.code.localeCompare(b.code, 'en', { numeric: true }))

  // Juda cho‘zilgan qavat haqiqiy ko‘rinmaydi: bunday holda halqa rejaga o‘tamiz
  if (width / height > 3 && list.length >= 3) {
    const ring = buildRingPlan(list, spec, kind)
    if (ring) return ring
  }

  const coreBox = top.core ?? rect(innerX, topY, coreArea / Math.max(depthTop, 1), depthTop)

  return {
    kind,
    width,
    height,
    wallOuter: spec.wallOuter,
    wallInner: spec.wallInner,
    corridors: [corridor],
    core: buildCore(coreBox, kind),
    units: shapes,
    windows: buildWindows(width, height, kind),
    walls: buildWalls(width, height, spec.wallOuter, spec.wallInner, shapes, [corridor]),
    openings: windowOpenings(buildWindows(width, height, kind), spec.wallOuter),
    axes: buildAxes(shapes, width, height),
    grossArea: width * height,
    usableArea,
    efficiency: usableArea / (width * height),
  }
}

/**
 * Reja nuqtalarini 0–1 oralig‘iga o‘tkazadi. Saqlanadigan `polygon` maydoni
 * shu ko‘rinishda, shuning uchun kontent operatori chizgan shakl bilan
 * generator chizgan shakl bitta koordinata tizimida bo‘ladi.
 */
export function normalizePoints(
  points: Array<[number, number]>,
  plan: FloorPlan,
): number[][] {
  return points.map(([x, y]) => [
    Number((x / plan.width).toFixed(4)),
    Number((y / plan.height).toFixed(4)),
  ])
}
