/**
 * Reyestr yaxlitligini tekshiradi.
 *
 * Ekranlar bir nechta reyestrdan o'qiydi: unit, shartnoma, hisob-faktura,
 * tashkilot, bino. Ular orasida ziddiyat bo'lsa foydalanuvchi bitta narsa
 * haqida ikki xil haqiqat ko'radi. Bu skript shunday ziddiyatlarni bitta
 * joyda, brauzersiz topadi.
 *
 * Ishga tushirish:  npx tsx scripts/check-data.mjs
 * Xato topilsa chiqish kodi 1 bo'ladi, shuning uchun CI da ham ishlatsa bo'ladi.
 */
import { pathToFileURL } from 'node:url'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const load = (rel) => import(pathToFileURL(resolve(root, rel)).href)

const { UNITS } = await load('app/data/units.ts')
const { CONTRACTS, INVOICES } = await load('app/data/business.ts')
const { BUILDINGS } = await load('app/data/buildings.ts')
const { ORGANIZATIONS } = await load('app/data/organizations.ts')

const problems = []
const report = (kind, message) => problems.push({ kind, message })

const buildingById = new Map(BUILDINGS.map((b) => [b.id, b]))
const unitById = new Map(UNITS.map((u) => [u.id, u]))
const contractByCode = new Map()
for (const c of CONTRACTS) {
  if (contractByCode.has(c.code)) {
    report('shartnoma', `${c.code} reyestrda ikki marta yozilgan`)
  }
  contractByCode.set(c.code, c)
}

// 1. Noyob identifikatorlar
const ids = new Set()
for (const u of UNITS) {
  if (ids.has(u.id)) report('unit', `${u.id} identifikatori takrorlanmoqda`)
  ids.add(u.id)
}

const codeByBuilding = new Map()
for (const u of UNITS) {
  const key = `${u.buildingId}|${u.code}`
  if (codeByBuilding.has(key)) {
    report('unit', `${u.buildingId} da «${u.code}» kodi ikki unitda: ${codeByBuilding.get(key)} va ${u.id}`)
  }
  codeByBuilding.set(key, u.id)
}

// 2. Unit qaysi binoga tegishli va qavati bino balandligiga sig'adimi
for (const u of UNITS) {
  const b = buildingById.get(u.buildingId)
  if (!b) {
    report('unit', `${u.id} mavjud bo'lmagan binoga bog'langan: ${u.buildingId}`)
    continue
  }
  if (u.floor > b.floors) {
    report('qavat', `${u.id} ${u.floor}-qavatda, ${b.name} esa ${b.floors} qavatli`)
  }
  if (u.floor < 0 && Math.abs(u.floor) > b.undergroundFloors) {
    report('qavat', `${u.id} ${u.floor} darajada, binoda ${b.undergroundFloors} yer osti qavati bor`)
  }
}

// 3. Shartnoma kodi mavjudmi va o'sha unitga ishora qiladimi
for (const u of UNITS) {
  if (!u.contractCode) continue
  const c = contractByCode.get(u.contractCode)
  if (!c) {
    report('shartnoma', `${u.id} da ${u.contractCode} kodi bor, reyestrda bunday shartnoma yo'q`)
    continue
  }
  if (c.tenant && u.tenant && c.tenant !== u.tenant) {
    report('shartnoma', `${u.contractCode}: unitda «${u.tenant}», shartnomada «${c.tenant}»`)
  }
}

// 4. Bitta unitda bir vaqtda ikkita amaldagi shartnoma
const activeByUnit = new Map()
for (const c of CONTRACTS) {
  const status = typeof c.status === 'string' ? c.status : ''
  if (status !== 'ACTIVE') continue
  const key = `${c.buildingName}|${c.unitCode}`
  if (activeByUnit.has(key)) {
    report('shartnoma', `${key}: bir vaqtda ikkita faol shartnoma (${activeByUnit.get(key)} va ${c.code})`)
  }
  activeByUnit.set(key, c.code)
}

// 5. Holat va shartnoma mosligi
for (const u of UNITS) {
  if (u.status === 'RENTED' && !u.contractCode) {
    report('holat', `${u.id} «Ijarada», lekin shartnoma kodi yo'q`)
  }
  if (u.status === 'VACANT' && u.contractCode) {
    report('holat', `${u.id} «Bo'sh», lekin ${u.contractCode} shartnomasi biriktirilgan`)
  }
  if (u.status === 'VACANT' && u.tenant) {
    report('holat', `${u.id} «Bo'sh», lekin ijarachisi ko'rsatilgan: ${u.tenant}`)
  }
}

// 6. Narx birligi taklif turiga mos kelishi
for (const u of UNITS) {
  if (u.offer === 'Ijara' && u.priceUnit !== 'so‘m / oy') {
    report('narx', `${u.id} ijaraga beriladi, birligi esa «${u.priceUnit}»`)
  }
  if (u.offer === 'Sotuv' && u.priceUnit !== 'so‘m / m²') {
    report('narx', `${u.id} sotuvda, birligi esa «${u.priceUnit}»`)
  }
  if (u.status !== 'DRAFT' && u.offer && u.price <= 0) {
    report('narx', `${u.id} taklif qilingan, narxi esa ${u.price}`)
  }
}

// 7. Poligon yuzasi unit maydoniga mos kelishi
const polygonArea = (points, width, height) => {
  let sum = 0
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i]
    const [x2, y2] = points[(i + 1) % points.length]
    sum += x1 * width * (y2 * height) - x2 * width * (y1 * height)
  }
  return Math.abs(sum / 2)
}

const floorGroups = new Map()
for (const u of UNITS) {
  const key = `${u.buildingId}|${u.floor}`
  if (!floorGroups.has(key)) floorGroups.set(key, [])
  floorGroups.get(key).push(u)
}

for (const [key, list] of floorGroups) {
  for (const u of list) {
    if (!Array.isArray(u.polygon) || u.polygon.length < 3) {
      report('reja', `${u.id} da poligon yo'q yoki uch nuqtadan kam`)
    }
  }
  // Bir qavatdagi poligonlar ustma-ust tushmasligi kerak
  const box = (p) => ({
    x1: Math.min(...p.map((q) => q[0])),
    x2: Math.max(...p.map((q) => q[0])),
    y1: Math.min(...p.map((q) => q[1])),
    y2: Math.max(...p.map((q) => q[1])),
  })
  const boxes = list.filter((u) => Array.isArray(u.polygon) && u.polygon.length >= 3)
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = box(boxes[i].polygon)
      const b = box(boxes[j].polygon)
      const w = Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1)
      const h = Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1)
      if (w > 0.005 && h > 0.005) {
        report('reja', `${key}: ${boxes[i].code} va ${boxes[j].code} poligonlari ustma-ust tushgan`)
      }
    }
  }
}

// 8. Hisob-faktura unit va ijarachiga mos kelishi
for (const inv of INVOICES) {
  if (inv.total < inv.paid) {
    report('hisob-faktura', `${inv.code}: to'langan (${inv.paid}) jamidan (${inv.total}) katta`)
  }
  if (inv.total <= 0) {
    report('hisob-faktura', `${inv.code}: summa ${inv.total}`)
  }
  if (inv.status === 'PAID' && inv.paid < inv.total) {
    report('hisob-faktura', `${inv.code}: «To'langan» deb belgilangan, qoldiq ${inv.total - inv.paid}`)
  }
  if (inv.issuedAt && inv.dueAt && inv.dueAt < inv.issuedAt) {
    report('hisob-faktura', `${inv.code}: to'lov muddati (${inv.dueAt}) chiqarilgan sanadan (${inv.issuedAt}) oldin`)
  }
}

// 9. Shartnoma muddatlari
for (const c of CONTRACTS) {
  if (c.startAt && c.endAt && c.endAt <= c.startAt) {
    report('shartnoma', `${c.code}: tugash sanasi (${c.endAt}) boshlanishdan (${c.startAt}) keyin emas`)
  }
}

// 10. Bino agregatlari reyestrga mos kelishi
for (const b of BUILDINGS) {
  const list = UNITS.filter((u) => u.buildingId === b.id)
  const gla = Math.round(list.reduce((s, u) => s + u.area, 0))
  if (!list.length) {
    report('bino', `${b.name} uchun reyestrda birorta unit yo'q`)
    continue
  }
  if (b.units !== list.length) {
    report('bino', `${b.name}: pasportda ${b.units} unit, reyestrda ${list.length} ta`)
  }
  const declared = Math.round(b.gla)
  if (declared && Math.abs(declared - gla) / declared > 0.02) {
    report('bino', `${b.name}: pasportda ${declared} m², reyestrda ${gla} m²`)
  }
}

// 11. Tashkilot nomlari izchilligi
const orgNames = new Set(ORGANIZATIONS.map((o) => o.name))
const tenantNames = new Set(UNITS.map((u) => u.tenant).filter(Boolean))
for (const name of tenantNames) {
  const similar = [...orgNames].find(
    (o) => o !== name && o.replace(/\s+/g, '').toLowerCase() === String(name).replace(/\s+/g, '').toLowerCase(),
  )
  if (similar) report('tashkilot', `«${name}» va «${similar}» bitta tashkilotning ikki yozuvi`)
}

// Natija
const byKind = problems.reduce((acc, p) => ((acc[p.kind] = (acc[p.kind] || 0) + 1), acc), {})
console.log(`Reyestr: ${UNITS.length} unit, ${CONTRACTS.length} shartnoma, ${INVOICES.length} hisob-faktura, ${BUILDINGS.length} bino\n`)

if (!problems.length) {
  console.log('Ziddiyat topilmadi.')
  process.exit(0)
}

console.log(`${problems.length} ta ziddiyat topildi:`, byKind, '\n')
const shown = new Map()
for (const p of problems) {
  const seen = shown.get(p.kind) ?? 0
  if (seen < 8) {
    console.log(`  [${p.kind}] ${p.message}`)
    shown.set(p.kind, seen + 1)
  }
}
for (const [kind, count] of Object.entries(byKind)) {
  if (count > 8) console.log(`  [${kind}] ... yana ${count - 8} ta`)
}
process.exit(1)
