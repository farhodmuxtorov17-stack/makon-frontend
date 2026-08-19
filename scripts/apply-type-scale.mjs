/**
 * Tipografika shkalasini butun ilovaga qo'llaydi.
 *
 * Ilovada 27 xil ixtiyoriy shrift o'lchami ishlatilardi: 12px, 12.5px, 13px,
 * 13.5px kabi qiymatlar ko'z bilan deyarli farq qilmaydi, lekin ekranlar
 * o'rtasida tartibsizlik hosil qiladi. Shkala sakkiz pog'onaga keltiriladi,
 * har biri o'z vazifasiga ega.
 *
 * Ishga tushirish:  node scripts/apply-type-scale.mjs
 * `--dry` bilan faqat hisobot chiqaradi, faylga tegmaydi.
 */
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const dry = process.argv.includes('--dry')

/**
 * Shkala pog'onalari. Zich ma'muriy interfeys uchun tanlangan: asosiy matn
 * 13px, chunki jadval va ro'yxatlar ko'p. Har bir pog'onaning vazifasi bor,
 * shuning uchun oraliq qiymat kiritishga ehtiyoj qolmaydi.
 */
const SCALE = [
  { px: 11, role: 'Mayda yorliq, katta harfli sarlavhacha' },
  { px: 12, role: 'Izoh, ikkinchi darajali matn' },
  { px: 13, role: 'Asosiy matn: jadval, ro‘yxat, forma' },
  { px: 14, role: 'Kengaytirilgan matn, tugma yozuvi' },
  { px: 16, role: 'Kirish matni, bo‘lim tavsifi' },
  { px: 18, role: 'Karta sarlavhasi' },
  { px: 22, role: 'Sahifa sarlavhasi' },
  { px: 28, role: 'Ko‘rsatkich qiymati' },
  { px: 34, role: 'Bosh sahifa sarlavhasi' },
]

const STEPS = SCALE.map((s) => s.px)

/** Eng yaqin pog'ona: teng masofada bo'lsa kattasi tanlanadi */
function snap(value) {
  let best = STEPS[0]
  let bestGap = Infinity
  for (const step of STEPS) {
    const gap = Math.abs(step - value)
    if (gap < bestGap || (gap === bestGap && step > best)) {
      best = step
      bestGap = gap
    }
  }
  return best
}

const SKIP = new Set(['node_modules', '.nuxt', '.output', 'dist', '.git'])

/**
 * Ayni paytda boshqa ish olib borilayotgan fayllar. Ular tugagach shkala
 * ularga ham qo'llanadi, aks holda ikki tomonlama tahrir bir-birini buzadi.
 * `--all` bayrog'i bilan istisnosiz ishlaydi.
 */
const RESERVED = process.argv.includes('--all')
  ? []
  : [
      'app/pages/index.vue',
      'app/layouts/public.vue',
      'app/pages/login.vue',
      'app/components/lease/',
      'app/pages/applications/',
      'app/pages/contracts/',
      'app/pages/catalog/',
      'app/components/catalog/',
      'app/pages/cabinet/units.vue',
      'app/components/ui/UiBuilding3D.vue',
      'app/components/ui/UiBuilding3DControls.vue',
      'app/pages/objects/[id]/3d.vue',
    ]

const reserved = (file) => {
  const rel = relative(root, file).split('\\').join('/')
  return RESERVED.some((r) => rel.startsWith(r))
}
const files = []
const walk = (dir) => {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full)
    else if (entry.endsWith('.vue')) files.push(full)
  }
}
walk(resolve(root, 'app'))

const moves = new Map()
let touched = 0
let changedFiles = 0

for (const file of files) {
  if (reserved(file)) continue
  const src = readFileSync(file, 'utf8')
  let count = 0
  const out = src.replace(/text-\[(\d+(?:\.\d+)?)px\]/g, (whole, raw) => {
    const value = Number(raw)
    const next = snap(value)
    if (next === value) return whole
    count++
    const key = `${value} -> ${next}`
    moves.set(key, (moves.get(key) ?? 0) + 1)
    return `text-[${next}px]`
  })
  if (count) {
    if (!dry) writeFileSync(file, out, 'utf8')
    touched += count
    changedFiles++
  }
}

console.log('Tipografika shkalasi:\n')
for (const step of SCALE) console.log(`  ${String(step.px).padStart(2)}px  ${step.role}`)

console.log(`\n${changedFiles} ta faylda ${touched} ta o'lcham shkalaga keltirildi${dry ? ' (sinov rejimi)' : ''}\n`)
for (const [move, n] of [...moves.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${move.padEnd(14)} ${n} ta`)
}

const rest = new Set()
for (const file of files) {
  if (reserved(file)) continue
  for (const m of readFileSync(file, 'utf8').matchAll(/text-\[(\d+(?:\.\d+)?)px\]/g)) rest.add(Number(m[1]))
}
console.log(`\nQolgan o'lchamlar: ${[...rest].sort((a, b) => a - b).join(', ')}`)
console.log(`Turlari: ${rest.size} ta (avval 27 ta edi)`)
console.log('Fayl: ' + relative(root, files[0] ?? '').replace(/\\/g, '/') + ' va boshqalar')
