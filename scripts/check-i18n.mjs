/**
 * Tarjima to'liqligini tekshiradi.
 *
 * Tizim o'zbek va rus tilida ishlaydi. Til almashtirilganda ekranda o'zbekcha
 * matn qolib ketmasligi kerak. Bu tekshiruv beshta narsani ko'radi:
 *
 *   1. uz va ru lug'atlaridagi kalitlar bir xilmi;
 *   2. rus qiymati o'zbekchasidan farq qiladimi (tarjima qilinmay qolganlari);
 *   3. rus matnida o'zbek tutuq belgisi (ʻ) qolmaganmi;
 *   4. kodda chaqirilgan t('...') kaliti lug'atda bormi;
 *   5. shablonda tarjimaga chiqarilmagan matn qolganmi.
 *
 * Ishga tushirish:  node scripts/check-i18n.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')

const uz = JSON.parse(readFileSync(join(root, 'i18n/locales/uz.json'), 'utf8'))
const ru = JSON.parse(readFileSync(join(root, 'i18n/locales/ru.json'), 'utf8'))

const flat = (o, p = '') =>
  Object.entries(o).flatMap(([k, v]) =>
    v && typeof v === 'object' ? flat(v, `${p}${k}.`) : [[`${p}${k}`, v]],
  )

const U = new Map(flat(uz))
const R = new Map(flat(ru))

/*
 * Ikkala tilda bir xil bo'lishi TABIIY bo'lgan qiymatlar: brend nomi, format
 * andozalari, faqat raqam va belgidan iborat matnlar. Ular hisobga olinmaydi.
 */
const BIR_XIL_MAYLI = /^(MAKON|Didox|MCHJ|STIR|GLA|SLA|QQS|USD|UZS|m²|%)$/
const FAQAT_ANDOZA = /^[\s\d%.,:+\-–—/()]*(\{[a-zA-Z]+\}[\s\d%.,:+\-–—/()]*)+$/
/** Harfi yo'q qiymat: raqam, foiz, oraliq. Ikkala tilda bir xil bo'lishi tabiiy. */
const HARFSIZ = /^[^\p{L}]+$/u

const muammo = []

// --- 1. kalitlar mosligi ---------------------------------------------------
for (const k of U.keys()) if (!R.has(k)) muammo.push(['kalit', `ru da yo'q: ${k}`])
for (const k of R.keys()) if (!U.has(k)) muammo.push(['kalit', `uz da yo'q: ${k}`])

// --- 2 va 3. tarjima qilinmagan qiymatlar ----------------------------------
for (const [k, v] of U) {
  const r = R.get(k)
  if (typeof v !== 'string' || typeof r !== 'string') continue
  const a = v.trim()
  const b = r.trim()

  /*
   * O'rin egallovchilar ikkala tilda bir xil bo'ladi, shuning uchun ular
   * olib tashlangandan keyin harf qolmasa, qiymat tarjimani talab qilmaydi:
   * «{name}: {qty} {unit}» yoki «SLA, %» kabi andozalar shunday.
   */
  const harfli = (t) => /\p{L}/u.test(t.replace(/\{[^}]*\}/g, '').replace(/\b(SLA|GLA|QQS|USD|UZS)\b/g, ''))

  if (
    a === b &&
    a.length > 3 &&
    harfli(a) &&
    !BIR_XIL_MAYLI.test(a) &&
    !FAQAT_ANDOZA.test(a) &&
    !HARFSIZ.test(a)
  ) {
    muammo.push(['tarjimasiz', `${k} = ${a}`])
  }

  // Rus matnida o'zbek tutuq belgisi lotin harfi yonida turibdimi
  if (/[a-zA-Z][ʻ‘’']/.test(b) && !BIR_XIL_MAYLI.test(b)) {
    muammo.push(['aralash', `${k} = ${b}`])
  }
}

/*
 * --- 2b. vue-i18n xabar sintaksisi ------------------------------------------
 *
 * Bu eng qimmat tekshiruv. vue-i18n da `@` boshqa kalitga havola boshlaydi,
 * `|` esa ko'plik shakllarini ajratadi. Elektron pochta namunasidagi bitta
 * `@` («ism@kompaniya.uz») butun lug'at faylining kompilyatsiyasini buzadi:
 * hech qanday kalit yuklanmaydi va barcha ekranlarda tarjima o'rniga kalit
 * yo'li chiqadi. Xato faqat dev server jurnalida ko'rinadi, ekranda esa
 * sabab tushunarsiz bo'lib qoladi.
 *
 * To'g'ri yozilishi: `ism{'@'}kompaniya.uz`.
 */
for (const [lang, M] of [
  ['uz', U],
  ['ru', R],
]) {
  for (const [k, v] of M) {
    if (typeof v !== 'string') continue
    if (/(^|[^{'])@/.test(v.replace(/\{'@'\}/g, ''))) {
      muammo.push(['sintaksis', `${lang}: ${k} ichida ekranlanmagan @ — {'@'} deb yozing`])
    }
    if (v.includes('|')) {
      muammo.push(['sintaksis', `${lang}: ${k} ichida ekranlanmagan | — ko'plik ajratgichi`])
    }
  }
}

// --- fayllarni yig'ish -----------------------------------------------------
const SKIP = new Set(['node_modules', '.nuxt', '.output', 'dist', '.git'])
const files = []
const walk = (dir) => {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full)
    else if (entry.endsWith('.vue') || entry.endsWith('.ts')) files.push(full)
  }
}
walk(join(root, 'app'))

// --- 4. mavjud bo'lmagan kalitga murojaat -----------------------------------
const KALIT = /\bt\(\s*['"`]([\w.]+)['"`]/g
for (const file of files) {
  const src = readFileSync(file, 'utf8')
  for (const m of src.matchAll(KALIT)) {
    const key = m[1]
    if (!U.has(key)) muammo.push(['yoq-kalit', `${relative(root, file)}: t('${key}')`])
  }
}

// --- 5. shablonda qolgan qattiq matn ---------------------------------------
const MATN = />[^<>{}]*[A-Za-z][^<>{}]*</g

/** Ikkala tilda bir xil qoladigan atama, birlik va manba nomlari */
const ATAMA =
  /^(MAKON|Didox|MCHJ|STIR|GLA|SLA|QQS|USD|UZS|m²|CSV|PDF|XLSX|DOCX|SHA-256|OK|ID|Endpoint|mk_live|1 USD|©\s*\w+)$/

/*
 * Shablon ichidagi ifoda parchasi matn emas. `:class="a > 0 ? 'x' : 'y'"`
 * kabi bog'lanishlar atribut ichida bo'lsa ham, ko'p qatorli yozuvda
 * `>` va `<` orasiga tushib qoladi. Tirnoq, savol belgisi va qiyoslash
 * belgilari bor parcha o'tkazib yuboriladi.
 */
const IFODA = /['"`?]|=>|&&|\|\||\.\w+\s*$/

const qattiq = []
for (const file of files) {
  if (!file.endsWith('.vue')) continue
  const src = readFileSync(file, 'utf8')
  const i = src.indexOf('<template>')
  if (i < 0) continue
  for (const m of src.slice(i).matchAll(MATN)) {
    const text = m[0].slice(1, -1).trim()
    if (text.length < 4 || !/[a-zA-Z]/.test(text)) continue
    if (ATAMA.test(text) || IFODA.test(text)) continue
    qattiq.push(`${relative(root, file)}: ${text.slice(0, 60)}`)
  }
}

// --- hisobot ---------------------------------------------------------------
const guruh = muammo.reduce((acc, [g]) => ((acc[g] = (acc[g] || 0) + 1), acc), {})

console.log(`Lug'at: uz ${U.size} kalit, ru ${R.size} kalit`)
console.log(`Tekshirilgan fayl: ${files.length}`)
console.log('')

if (qattiq.length) {
  console.log(`Shablonda tarjimaga chiqarilmagan matn: ${qattiq.length}`)
  for (const q of qattiq.slice(0, 25)) console.log('   ', q)
  if (qattiq.length > 25) console.log(`    ... yana ${qattiq.length - 25} ta`)
  console.log('')
}

if (!muammo.length && !qattiq.length) {
  console.log('Tarjima to‘liq, nomuvofiqlik topilmadi.')
  process.exit(0)
}

for (const [g, n] of Object.entries(guruh)) console.log(`${g}: ${n} ta`)
console.log('')
for (const [g, text] of muammo.slice(0, 40)) console.log(`  [${g}] ${text}`)
if (muammo.length > 40) console.log(`  ... yana ${muammo.length - 40} ta`)

process.exit(1)
