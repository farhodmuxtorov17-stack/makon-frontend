/**
 * Unit maydonlarini qavat ichida tabiiy tarqatadi.
 *
 * Reyestr generatsiya qilinganda bitta qavatdagi barcha unitlar bir xil
 * maydonga ega bo'lib qolgan edi (masalan b-01 ning 9-qavatida beshta unit
 * ham aynan 86.40 m²). Haqiqiy binoda burchak xonalar kattaroq, koridor
 * o'rtasidagilar kichikroq bo'ladi, shuning uchun reja ham bir xil
 * to'rtburchaklar qatoriga o'xshab qolmaydi.
 *
 * Qavatning UMUMIY maydoni o'zgarmaydi: koeffitsiyentlar qo'llanilgach
 * natija qayta normallashtiriladi. Shu sababli bino GLA si va portfel
 * jamlari o'zgarmaydi. Narx m² boshiga saqlanadi, xonalar soni esa yangi
 * maydondan qayta hisoblanadi.
 *
 * Ishga tushirish:
 *   npx tsx scripts/vary-unit-areas.mjs
 *   npx tsx scripts/generate-floor-plans.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const unitsPath = resolve(here, '..', 'app/data/units.ts')
const src = readFileSync(unitsPath, 'utf8')

/** Unit bloklarini qavs balansini sanab ajratamiz */
function unitBlocks(text) {
  const blocks = []
  const re = /\r?\n {2}\{\r?\n {4}id: '([^']+)'/g
  let m
  while ((m = re.exec(text))) {
    let depth = 0
    let i = m.index
    for (; i < text.length; i++) {
      if (text[i] === '{') depth++
      else if (text[i] === '}') {
        depth--
        if (depth === 0) break
      }
    }
    blocks.push({ id: m[1], start: m.index, end: i + 1, text: text.slice(m.index, i + 1) })
  }
  return blocks
}

const field = (text, name) => {
  const m = text.match(new RegExp(`${name}: '?([^,'\\n]+)'?`))
  return m ? m[1].trim() : ''
}

const blocks = unitBlocks(src)
if (!blocks.length) {
  console.error('Unit bloklari topilmadi')
  process.exit(1)
}

/**
 * Qavat ichidagi nisbatlar. Ketma-ketlik qat'iy, shuning uchun natija
 * har safar bir xil chiqadi va reja tasodifiy o'zgarib turmaydi.
 * Burchakdagi maydonlar kattaroq, oraliqdagilar kichikroq.
 */
const SHAPES = [
  [1.42, 0.74, 1.06, 0.68, 1.28, 0.82],
  [0.79, 1.34, 0.71, 1.18, 0.94, 1.44],
  [1.15, 0.86, 1.38, 0.7, 1.02, 0.89],
  [0.72, 1.24, 0.95, 1.46, 0.77, 1.16],
]

const floors = new Map()
for (const b of blocks) {
  const buildingId = field(b.text, 'buildingId')
  const floor = Number(field(b.text, 'floor'))
  const area = Number(field(b.text, 'area'))
  if (!buildingId || Number.isNaN(floor) || !area) continue
  const key = `${buildingId}|${floor}`
  if (!floors.has(key)) floors.set(key, [])
  floors.get(key).push({ ...b, area, floor })
}

const nextArea = new Map()
let touched = 0
let floorsChanged = 0

let f = 0
for (const [, list] of floors) {
  f++
  if (list.length < 2) continue

  const total = list.reduce((s, u) => s + u.area, 0)
  const shape = SHAPES[f % SHAPES.length]
  const raw = list.map((u, i) => u.area * shape[i % shape.length])
  const rawTotal = raw.reduce((s, v) => s + v, 0)

  // Qayta normallashtirish: qavat jami o'zgarmasin
  const scaled = raw.map((v) => (v / rawTotal) * total)

  // Yaxlitlashdan keyingi farq eng katta unitga qo'shiladi
  const rounded = scaled.map((v) => Math.round(v * 10) / 10)
  const drift = Math.round((total - rounded.reduce((s, v) => s + v, 0)) * 10) / 10
  let biggest = 0
  rounded.forEach((v, i) => {
    if (v > rounded[biggest]) biggest = i
  })
  rounded[biggest] = Math.round((rounded[biggest] + drift) * 10) / 10

  let changed = false
  list.forEach((u, i) => {
    const value = Math.max(12, rounded[i])
    if (Math.abs(value - u.area) > 0.05) changed = true
    nextArea.set(u.id, value)
    touched++
  })
  if (changed) floorsChanged++
}

/** Xonalar soni maydondan: ofisda ~24 m², omborda ~220 m² bir xona */
function roomsFor(area, usage) {
  const per = usage === 'Ombor' ? 220 : usage === 'Savdo' ? 45 : usage === 'Turar joy' ? 28 : 24
  return Math.max(1, Math.round(area / per))
}

let out = src
for (const b of [...blocks].reverse()) {
  const area = nextArea.get(b.id)
  if (area === undefined) continue
  const oldArea = Number(field(b.text, 'area'))
  if (!oldArea || Math.abs(area - oldArea) < 0.05) continue

  const usage = field(b.text, 'usage')
  const offer = field(b.text, 'offer')
  const oldPrice = Number(field(b.text, 'price'))

  let text = b.text.replace(/area: [\d.]+/, `area: ${area.toFixed(1)}`)
  text = text.replace(/rooms: \d+/, `rooms: ${roomsFor(area, usage)}`)

  // Ijara narxi maydonga mutanosib, sotuv narxi esa m² boshiga berilgani
  // uchun o'zgarmaydi
  if (offer === 'Ijara' && oldPrice > 0) {
    const price = Math.round((oldPrice / oldArea) * area * 10) / 10
    text = text.replace(/price: [\d.]+/, `price: ${Math.round(price)}`)
  }

  out = out.slice(0, b.start) + text + out.slice(b.end)
}

writeFileSync(unitsPath, out, 'utf8')

const sample = [...floors.entries()].find(([, l]) => l.length >= 4)
console.log(`${floors.size} ta qavat ko'rildi, ${floorsChanged} tasida maydonlar tarqatildi (${touched} unit)`)
if (sample) {
  const [key, list] = sample
  console.log(`\nNamuna ${key}:`)
  for (const u of list) {
    console.log(`  ${u.id}: ${u.area.toFixed(1)} → ${(nextArea.get(u.id) ?? u.area).toFixed(1)} m²`)
  }
  const before = list.reduce((s, u) => s + u.area, 0)
  const after = list.reduce((s, u) => s + (nextArea.get(u.id) ?? u.area), 0)
  console.log(`  qavat jami: ${before.toFixed(1)} → ${after.toFixed(1)} m²`)
}
