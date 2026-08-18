/**
 * Unit poligonlarini qavat rejasi generatoridan qayta hisoblaydi.
 *
 * `app/data/units.ts` dagi `polygon:` qiymatlari qo‘lda yozilgan va butun
 * portfelda atigi olti xil to‘rtburchak takrorlanardi. Bu skript har bir
 * qavat uchun `app/utils/floorPlan.ts` dagi generatorni chaqiradi va
 * natijani faylga qaytarib yozadi, shuning uchun chizilgan shakl yuzasi
 * unitning haqiqiy m² qiymatiga mos tushadi.
 *
 * Ishga tushirish:  npx tsx scripts/generate-floor-plans.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')

const { buildFloorPlan, normalizePoints } = await import(
  pathToFileURL(resolve(root, 'app/utils/floorPlan.ts')).href
)

const unitsPath = resolve(root, 'app/data/units.ts')
const buildingsPath = resolve(root, 'app/data/buildings.ts')

const unitsSrc = readFileSync(unitsPath, 'utf8')
const buildingsSrc = readFileSync(buildingsPath, 'utf8')

/** Bino turi id bo‘yicha */
const buildingType = new Map()
for (const m of buildingsSrc.matchAll(/id: '(b-\d+)',[\s\S]*?type: '([^']+)'/g)) {
  if (!buildingType.has(m[1])) buildingType.set(m[1], m[2])
}

/**
 * Har bir unit bloki `{ id: 'u-...' ... }` ko‘rinishida. Blokni qavs
 * balansini sanab ajratamiz: ichida massiv va ob’ektlar bor.
 */
function unitBlocks(src) {
  const blocks = []
  // UNITS massivi elementlari ikki bo‘sh joy bilan boshlanadi, maydonlari
  // to‘rt bo‘sh joy bilan. Ichki ob’ektlar chuqurroq turadi, shu bilan farq qiladi.
  const re = /\n {2}\{\n {4}id: '([^']+)'/g
  let m
  while ((m = re.exec(src))) {
    let depth = 0
    let i = m.index
    for (; i < src.length; i++) {
      if (src[i] === '{') depth++
      else if (src[i] === '}') {
        depth--
        if (depth === 0) break
      }
    }
    blocks.push({ id: m[1], start: m.index, end: i + 1, text: src.slice(m.index, i + 1) })
  }
  return blocks
}

const blocks = unitBlocks(unitsSrc)
if (!blocks.length) {
  console.error('Unit bloklari topilmadi')
  process.exit(1)
}

const field = (text, name) => {
  const m = text.match(new RegExp(`${name}: '?([^,'\\n]+)'?`))
  return m ? m[1].trim() : ''
}

const floors = new Map()
for (const b of blocks) {
  const buildingId = field(b.text, 'buildingId')
  const floor = Number(field(b.text, 'floor'))
  const area = Number(field(b.text, 'area'))
  const code = field(b.text, 'code')
  if (!buildingId || Number.isNaN(floor) || !area) continue
  const key = `${buildingId}|${floor}`
  if (!floors.has(key)) floors.set(key, [])
  floors.get(key).push({ id: b.id, code, area, buildingId, floor })
}

const polygonById = new Map()
const report = []

for (const [key, list] of floors) {
  const [buildingId, floorText] = key.split('|')
  const floor = Number(floorText)
  const type = buildingType.get(buildingId) ?? 'Biznes markaz'
  const plan = buildFloorPlan({
    units: list.map((u) => ({ id: u.id, code: u.code, area: u.area })),
    buildingType: type,
    floor,
    underground: floor === 0,
  })

  for (const shape of plan.units) {
    polygonById.set(shape.id, normalizePoints(shape.points, plan))
  }

  report.push({
    key,
    type,
    units: list.length,
    size: `${plan.width.toFixed(1)}×${plan.height.toFixed(1)}`,
    efficiency: (plan.efficiency * 100).toFixed(0),
    layout: plan.corridors.length > 1 ? 'halqa' : 'koridor',
  })
}

// Poligonlarni faylga qaytarib yozamiz, oxiridan boshiga qarab —
// shunda oldingi almashtirishlar keyingi indekslarni siljitmaydi
let out = unitsSrc
for (const b of [...blocks].reverse()) {
  const points = polygonById.get(b.id)
  if (!points) continue
  const literal = `polygon: [${points.map(([x, y]) => `[${x}, ${y}]`).join(', ')}]`
  const replaced = b.text.replace(/polygon: P\([^)]*\)|polygon: \[[^\]]*\](?:\])?/s, () => literal)
  if (replaced === b.text) {
    console.warn(`  ogohlantirish: ${b.id} da polygon topilmadi`)
    continue
  }
  out = out.slice(0, b.start) + replaced + out.slice(b.end)
}

writeFileSync(unitsPath, out, 'utf8')

console.log(`${floors.size} ta qavat, ${polygonById.size} ta unit poligoni qayta hisoblandi\n`)
const byLayout = report.reduce((acc, r) => ((acc[r.layout] = (acc[r.layout] || 0) + 1), acc), {})
console.log('Reja turi:', byLayout)
console.log('\nNamunalar:')
for (const r of report.slice(0, 8)) {
  console.log(
    `  ${r.key.padEnd(10)} ${r.type.slice(0, 17).padEnd(18)} ${String(r.units).padStart(2)} unit  ${r.size.padStart(13)} m  samaradorlik ${r.efficiency}%  ${r.layout}`,
  )
}
