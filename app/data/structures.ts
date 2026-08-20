import { BUILDINGS, type Building } from './buildings'

/**
 * Obyekt tarkibidagi qurilmalar.
 *
 * Ilgari tizimda «obyekt» va «bino» bitta narsa edi. Aslida obyekt bu
 * uchastka: unda asosiy bino bilan birga nazorat-o'tkazish punkti,
 * avtoturargoh, qozonxona, ombor bloklari, kafe, konferens zal va boshqa
 * qurilmalar turadi. Rahbar faqat asosiy binoni emas, butun uchastkani
 * boshqaradi, shuning uchun ularning hammasi reyestrda ham, 3D navigatorda
 * ham ko'rinishi kerak.
 *
 * Ombor uchastkasi alohida holat: u yerda odatda bir nechta blok bo'ladi,
 * deyarli hammasi bir qavatli, lekin maydoni katta. Shuning uchun blok
 * soni va o'lchami bino turiga qarab hisoblanadi.
 */

export type StructureKind =
  | 'main'
  | 'warehouse'
  | 'admin'
  | 'parkingSurface'
  | 'parkingUnderground'
  | 'checkpoint'
  | 'boiler'
  | 'cafe'
  | 'carwash'
  | 'conference'
  | 'gym'
  | 'retailPavilion'
  | 'utility'

export interface StructureKindMeta {
  label: string
  /** Qisqa nom: chizmada va nishonchada */
  short: string
  /** Ijaraga beriladimi: yo'q bo'lsa xizmat qurilmasi */
  leasable: boolean
  icon: string
  tone: 'brand' | 'ok' | 'warn' | 'violet' | 'neutral'
}

export const STRUCTURE_KIND: Record<StructureKind, StructureKindMeta> = {
  main: { label: 'Asosiy bino', short: 'Asosiy', leasable: true, icon: 'building', tone: 'brand' },
  warehouse: { label: 'Ombor bloki', short: 'Ombor', leasable: true, icon: 'box', tone: 'warn' },
  admin: { label: 'Ma’muriy bino', short: 'Ma’muriy', leasable: true, icon: 'contract', tone: 'brand' },
  parkingSurface: { label: 'Yer usti avtoturargoh', short: 'Parkovka', leasable: false, icon: 'cube', tone: 'neutral' },
  parkingUnderground: { label: 'Yer osti avtoturargoh', short: 'Yer osti parkovka', leasable: false, icon: 'cube', tone: 'neutral' },
  checkpoint: { label: 'Nazorat-o‘tkazish punkti', short: 'KPP', leasable: false, icon: 'shield', tone: 'neutral' },
  boiler: { label: 'Qozonxona', short: 'Qozonxona', leasable: false, icon: 'meter', tone: 'neutral' },
  cafe: { label: 'Kafe', short: 'Kafe', leasable: true, icon: 'users', tone: 'ok' },
  carwash: { label: 'Avtomoyka', short: 'Moyka', leasable: true, icon: 'wrench', tone: 'ok' },
  conference: { label: 'Konferens zal', short: 'Konferens', leasable: true, icon: 'users', tone: 'violet' },
  gym: { label: 'Sport zal', short: 'Sport', leasable: true, icon: 'sparkle', tone: 'violet' },
  retailPavilion: { label: 'Savdo pavilyoni', short: 'Pavilyon', leasable: true, icon: 'grid', tone: 'ok' },
  utility: { label: 'Texnik bino', short: 'Texnik', leasable: false, icon: 'tools', tone: 'neutral' },
}

export interface Structure {
  id: string
  buildingId: string
  kind: StructureKind
  name: string
  /** Yer usti qavatlari */
  floors: number
  undergroundFloors: number
  /** Uchastkadagi o'rni va o'lchami, metrda. Chap yuqori burchakdan */
  x: number
  y: number
  width: number
  depth: number
  /** Bino balandligi, metr: 3D da shu bo'yicha ko'tariladi */
  height: number
  /** Ijaraga beriladigan maydon, m². Xizmat qurilmasida 0 */
  gla: number
  /** Avtoturargoh uchun joy soni */
  parkingSpaces?: number
  note: string
}

/** Uchastka o'lchami: barcha qurilmalar shu maydonga joylashadi */
export interface SitePlot {
  width: number
  depth: number
}

const rounded = (v: number) => Math.round(v * 10) / 10

/**
 * Uchastka tarkibi bino turiga qarab quriladi. Har bir tur uchun haqiqiy
 * majmuada uchraydigan qurilmalar to'plami olingan: biznes markazda yer osti
 * parkovka va konferens zal, savdo markazida yer usti parkovka va pavilyonlar,
 * ombor uchastkasida bir nechta blok va ma'muriy bino, turar joy majmuasida
 * qozonxona va sport zal.
 */
function composeSite(b: Building): Structure[] {
  const out: Structure[] = []
  let seq = 0
  const add = (s: Omit<Structure, 'id' | 'buildingId'>) => {
    seq += 1
    out.push({ id: `${b.id}-s${String(seq).padStart(2, '0')}`, buildingId: b.id, ...s })
  }

  // Asosiy bino o'lchami qavat maydonidan chiqadi
  const floorArea = b.floors > 0 ? b.gla / b.floors : b.gla
  const mainWidth = rounded(Math.sqrt(Math.max(floorArea, 200) * 1.55))
  const mainDepth = rounded(Math.max(floorArea, 200) / mainWidth)
  const storey = b.type === 'Ombor / logistika' ? 7.5 : b.type === 'Savdo markaz' ? 5.2 : 3.4

  if (b.type === 'Ombor / logistika') {
    /*
     * Ombor uchastkasi: bloklar soni maydonga qarab, deyarli hammasi bir
     * qavatli. Ikki qavatli blok faqat yirik uchastkada uchraydi va u
     * ham ma'muriy qismi bilan birga.
     */
    const blocks = Math.max(2, Math.min(4, Math.round(b.gla / 6000)))
    const blockArea = b.gla / blocks
    const blockWidth = rounded(Math.sqrt(blockArea * 2.4))
    const blockDepth = rounded(blockArea / blockWidth)

    for (let i = 0; i < blocks; i++) {
      const twoStorey = i === 0 && b.floors >= 2 && b.gla > 12000
      add({
        kind: 'warehouse',
        name: `${String.fromCharCode(65 + i)} bloki`,
        floors: twoStorey ? 2 : 1,
        undergroundFloors: 0,
        x: 30,
        y: 40 + i * (blockDepth + 26),
        width: blockWidth,
        depth: blockDepth,
        height: twoStorey ? 13.5 : 9.5,
        gla: rounded(blockArea),
        note: twoStorey
          ? 'Ikki qavatli blok: pastda saqlash, tepada ofis maydonlari'
          : 'Bir qavatli saqlash bloki, rampa va yuk eshiklari bilan',
      })
    }

    add({
      kind: 'admin',
      name: 'Ma’muriy bino',
      floors: 2,
      undergroundFloors: 0,
      x: 30,
      y: 4,
      width: 26,
      depth: 14,
      height: 7.4,
      gla: 520,
      note: 'Qabulxona, buxgalteriya va logistika xizmati',
    })
    add({
      kind: 'checkpoint',
      name: 'Kirish KPP',
      floors: 1,
      undergroundFloors: 0,
      x: 2,
      y: 6,
      width: 8,
      depth: 6,
      height: 3.4,
      gla: 0,
      note: 'Yuk mashinalari uchun tarozi va shlagbaum',
    })
    add({
      kind: 'parkingSurface',
      name: 'Yuk mashinalari maydoni',
      floors: 1,
      undergroundFloors: 0,
      x: 2,
      y: 40,
      width: 22,
      depth: 90,
      height: 0.2,
      gla: 0,
      parkingSpaces: 40,
      note: 'Manevr maydoni va kutish joylari',
    })
    add({
      kind: 'boiler',
      name: 'Qozonxona',
      floors: 1,
      undergroundFloors: 0,
      x: 30 + blockWidth + 8,
      y: 40,
      width: 12,
      depth: 9,
      height: 4.6,
      gla: 0,
      note: 'Issiqlik punkti va suv tayyorlash',
    })
    return out
  }

  // Yer usti majmualari: asosiy bino markazda
  add({
    kind: 'main',
    name: b.name,
    floors: b.floors,
    undergroundFloors: b.undergroundFloors,
    x: 34,
    y: 30,
    width: mainWidth,
    depth: mainDepth,
    height: rounded(b.floors * storey),
    gla: rounded(b.gla),
    note: 'Ijaraga beriladigan asosiy maydonlar',
  })

  add({
    kind: 'checkpoint',
    name: 'KPP',
    floors: 1,
    undergroundFloors: 0,
    x: 3,
    y: 8,
    width: 7,
    depth: 5,
    height: 3.2,
    gla: 0,
    note: 'Kirish nazorati va videokuzatuv punkti',
  })

  if (b.undergroundFloors > 0) {
    add({
      kind: 'parkingUnderground',
      name: 'Yer osti avtoturargoh',
      floors: 0,
      undergroundFloors: b.undergroundFloors,
      x: 30,
      y: 26,
      width: rounded(mainWidth + 8),
      depth: rounded(mainDepth + 8),
      height: 0.2,
      gla: 0,
      parkingSpaces: b.undergroundFloors * 60,
      note: 'Rampalar va lift yadrosiga chiqish bilan',
    })
  }

  add({
    kind: 'parkingSurface',
    name: 'Mehmon avtoturargohi',
    floors: 1,
    undergroundFloors: 0,
    x: 3,
    y: 30 + mainDepth + 10,
    width: 26,
    depth: 34,
    height: 0.2,
    gla: 0,
    parkingSpaces: 48,
    note: 'Qisqa muddatli to‘xtash joylari',
  })

  add({
    kind: 'boiler',
    name: 'Qozonxona',
    floors: 1,
    undergroundFloors: 0,
    x: 34 + mainWidth + 10,
    y: 30,
    width: 11,
    depth: 8,
    height: 4.4,
    gla: 0,
    note: 'Issiqlik punkti, hisoblagichlar shu yerda',
  })

  if (b.type === 'Biznes markaz' || b.type === 'Ofis binosi') {
    add({
      kind: 'conference',
      name: 'Konferens markaz',
      floors: 1,
      undergroundFloors: 0,
      x: 34 + mainWidth + 10,
      y: 44,
      width: 22,
      depth: 16,
      height: 5.6,
      gla: 340,
      note: 'Ikkita zal, tarjima kabinasi bilan',
    })
    add({
      kind: 'cafe',
      name: 'Kafe pavilyoni',
      floors: 1,
      undergroundFloors: 0,
      x: 3,
      y: 22,
      width: 14,
      depth: 10,
      height: 4,
      gla: 140,
      note: 'Ijarachilar va mehmonlar uchun',
    })
  }

  if (b.type === 'Savdo markaz') {
    add({
      kind: 'retailPavilion',
      name: 'Tashqi savdo pavilyonlari',
      floors: 1,
      undergroundFloors: 0,
      x: 3,
      y: 22,
      width: 30,
      depth: 12,
      height: 4.2,
      gla: 360,
      note: 'Kichik maydonli mustaqil nuqtalar',
    })
    add({
      kind: 'carwash',
      name: 'Avtomoyka',
      floors: 1,
      undergroundFloors: 0,
      x: 34 + mainWidth + 10,
      y: 44,
      width: 16,
      depth: 10,
      height: 4.2,
      gla: 160,
      note: 'Uch post, suv tozalash tizimi bilan',
    })
  }

  if (b.type === 'Turar joy') {
    add({
      kind: 'gym',
      name: 'Sport zal',
      floors: 1,
      undergroundFloors: 0,
      x: 34 + mainWidth + 10,
      y: 44,
      width: 20,
      depth: 14,
      height: 5,
      gla: 280,
      note: 'Yashovchilar uchun, alohida kirish bilan',
    })
    add({
      kind: 'utility',
      name: 'Xo‘jalik bloki',
      floors: 1,
      undergroundFloors: 0,
      x: 3,
      y: 22,
      width: 12,
      depth: 8,
      height: 3.6,
      gla: 0,
      note: 'Inventar va chiqindi xonasi',
    })
  }

  return out
}

/** Barcha uchastkalar tarkibi. Bino reyestridan hosil qilinadi */
export const STRUCTURES: Structure[] = BUILDINGS.flatMap(composeSite)

export function structuresOf(buildingId: string): Structure[] {
  const found = STRUCTURES.filter((s) => s.buildingId === buildingId)
  if (found.length) return found

  /*
   * Reyestrga ish vaqtida qo'shilgan obyektda tarkib hali yo'q: u shu yerda
   * quriladi va bir marta reyestrga qo'shiladi. Shu tufayli yangi obyekt
   * kartochkasi ham bo'sh chiqmaydi.
   */
  const b = BUILDINGS.find((x) => x.id === buildingId)
  if (!b) return []
  const built = composeSite(b)
  STRUCTURES.push(...built)
  return built
}

/** Uchastkada uchraydigan qurilma turlari: reyestr filtri shu ro'yxatdan ishlaydi */
export function structureKindsOf(buildingId: string): StructureKind[] {
  return Array.from(new Set(structuresOf(buildingId).map((s) => s.kind)))
}

export function structureById(id: string): Structure | undefined {
  return STRUCTURES.find((s) => s.id === id)
}

/** Uchastka o'lchami: eng chekkadagi qurilmadan chiqadi, chetiga yo'l qoldiriladi */
export function sitePlotOf(buildingId: string): SitePlot {
  const list = structuresOf(buildingId)
  if (!list.length) return { width: 120, depth: 100 }
  const width = Math.max(...list.map((s) => s.x + s.width)) + 12
  const depth = Math.max(...list.map((s) => s.y + s.depth)) + 12
  return { width: rounded(width), depth: rounded(depth) }
}

/** Ijaraga beriladigan qurilmalar: reyestrda maydon sifatida ko'rinadi */
export function leasableStructures(buildingId: string): Structure[] {
  return structuresOf(buildingId).filter((s) => STRUCTURE_KIND[s.kind].leasable)
}

/** Uchastka bo'yicha yig'ma ko'rsatkichlar */
export function siteSummary(buildingId: string) {
  const list = structuresOf(buildingId)
  return {
    structures: list.length,
    leasable: list.filter((s) => STRUCTURE_KIND[s.kind].leasable).length,
    service: list.filter((s) => !STRUCTURE_KIND[s.kind].leasable).length,
    parkingSpaces: list.reduce((sum, s) => sum + (s.parkingSpaces ?? 0), 0),
    gla: rounded(list.reduce((sum, s) => sum + s.gla, 0)),
    plot: sitePlotOf(buildingId),
  }
}
