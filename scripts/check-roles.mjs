/**
 * Rol izolyatsiyasini tekshiradi: har bir rol faqat o'z modullari va
 * funksiyalarini ko'rishi kerak.
 *
 * Uch narsani solishtiradi:
 *   1. `ROUTE_ACCESS` bo'yicha marshrutga kirish huquqi;
 *   2. `NAVIGATION` yon panelida ko'rsatiladigan yozuvlar;
 *   3. `ROLE_CAPABILITIES` bo'yicha amal huquqi.
 *
 * Yon panelda ochilmaydigan havola turishi yoki bo'lim ochiq bo'la turib
 * menyuda ko'rinmasligi nomuvofiqlik hisoblanadi.
 *
 * Ishga tushirish:  npx tsx scripts/check-roles.mjs
 */
import { pathToFileURL, fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const load = (rel) => import(pathToFileURL(resolve(root, rel)).href)

/*
 * `navigation.ts` yon panel nishonlari uchun do'konlarni import qiladi, ular esa
 * Nuxt avtomatik import qiladigan global nomlarga tayanadi. Node muhitida ular
 * yo'q, shuning uchun eng zarurlari shu yerda o'rniga qo'yiladi. Tekshiruv
 * faqat huquq jadvallariga qaraydi, do'kon holatiga emas.
 */
const vue = await import('vue')
Object.assign(globalThis, {
  piniaPluginPersistedstate: { localStorage: () => ({}) },
  computed: vue.computed,
  ref: vue.ref,
  reactive: vue.reactive,
  watch: vue.watch,
  useState: (_key, init) => vue.ref(init ? init() : undefined),
})

const { ROUTE_ACCESS, NAVIGATION, canAccess } = await load('app/constants/navigation.ts')
const { ROLE_META, ROLE_CAPABILITIES } = await load('app/constants/roles.ts')
const { ROLES } = await load('app/types/rbac.ts')
const { ACCESS_AREAS } = await load('app/constants/accessAreas.ts')

const problems = []
const report = (kind, message) => problems.push({ kind, message })

const prefixes = [...new Set(ROUTE_ACCESS.map((r) => r.prefix))].sort()

// 1. Har bir rol uchun ochiq marshrutlar
const openFor = new Map()
for (const role of ROLES) {
  openFor.set(role, prefixes.filter((p) => canAccess(p, role)))
}

// 2. Yon paneldagi har bir havola ochiq bo'lishi kerak
for (const role of ROLES) {
  const sections = NAVIGATION[role] ?? []
  for (const section of sections) {
    for (const item of section.items ?? []) {
      if (!canAccess(item.to, role)) {
        report('menyu', `${ROLE_META[role].label}: menyuda «${item.label ?? item.to}» bor, lekin ${item.to} ochilmaydi`)
      }
      for (const child of item.children ?? []) {
        if (!canAccess(child.to, role)) {
          report('menyu', `${ROLE_META[role].label}: ichki havola ${child.to} ochilmaydi`)
        }
      }
    }
  }
}

// 3. Rolning uy sahifasi unga ochiq bo'lishi shart
for (const role of ROLES) {
  const home = ROLE_META[role].home
  if (!canAccess(home, role)) {
    report('uy sahifasi', `${ROLE_META[role].label}: uy sahifasi ${home} o'ziga ochiq emas`)
  }
}

// 4. Ochiq bo'lim menyuda ko'rinsinmi: yozuvsiz qolgan modul
const HIDDEN_OK = new Set(['/cabinet', '/settings/audit'])
for (const role of ROLES) {
  const inMenu = new Set()
  for (const section of NAVIGATION[role] ?? []) {
    for (const item of section.items ?? []) {
      inMenu.add(item.to)
      for (const child of item.children ?? []) inMenu.add(child.to)
    }
  }
  for (const prefix of openFor.get(role)) {
    if (HIDDEN_OK.has(prefix)) continue
    const covered = [...inMenu].some((to) => to.startsWith(prefix) || prefix.startsWith(to))
    if (!covered) {
      report('yashirin modul', `${ROLE_META[role].label}: ${prefix} ochiq, lekin menyuda yo'q`)
    }
  }
}

// 5. Amal huquqi bo'lgan bo'lim rolga ochiq bo'lishi kerak
for (const role of ROLES) {
  const caps = ROLE_CAPABILITIES[role] ?? []
  for (const area of ACCESS_AREAS) {
    const writes = area.writes.filter((c) => caps.includes(c))
    if (!writes.length) continue
    const reachable = area.prefixes.some((p) => canAccess(p, role))
    if (!reachable) {
      report('huquq', `${ROLE_META[role].label}: «${area.label}» bo'limida ${writes.join(', ')} huquqi bor, lekin bo'lim ochilmaydi`)
    }
  }
}

// 6. Bir rolda ikkinchi rolning moduli ochiq qolmasin: kutilgan chegaralar
const EXPECTED = {
  SUPER_HEAD: 'hammasi',
  BUILDING_MANAGER: ['/dashboard/building', '/objects', '/applications', '/contracts', '/service-requests', '/facility', '/meters', '/reports'],
  ACCOUNTANT: ['/applications', '/contracts', '/billing', '/reports'],
  FACILITY: ['/service-requests', '/facility', '/meters'],
  WAREHOUSE_OPERATOR: ['/warehouse', '/facility/materials'],
  CONTENT_OPERATOR: ['/objects', '/content', '/applications', '/contracts'],
  TENANT_OWNER: ['/cabinet'],
}

for (const role of ROLES) {
  const expected = EXPECTED[role]
  if (!expected || expected === 'hammasi') continue
  for (const prefix of openFor.get(role)) {
    const allowed = expected.some((e) => prefix.startsWith(e) || e.startsWith(prefix))
    if (!allowed) {
      report('ortiqcha kirish', `${ROLE_META[role].label}: ${prefix} ochiq, kutilgan ro'yxatda yo'q`)
    }
  }
}

// Natija
console.log('Rol bo‘yicha ochiq modullar:\n')
for (const role of ROLES) {
  const open = openFor.get(role)
  console.log(`  ${ROLE_META[role].label.padEnd(24)} ${open.length} ta: ${open.join(' ')}`)
}

const caps = ROLES.map((r) => `${ROLE_META[r].label}: ${(ROLE_CAPABILITIES[r] ?? []).length}`)
console.log(`\nAmal huquqlari: ${caps.join(' | ')}`)

if (!problems.length) {
  console.log('\nNomuvofiqlik topilmadi.')
  process.exit(0)
}

const byKind = problems.reduce((acc, p) => ((acc[p.kind] = (acc[p.kind] || 0) + 1), acc), {})
console.log(`\n${problems.length} ta nomuvofiqlik:`, byKind, '\n')
for (const p of problems) console.log(`  [${p.kind}] ${p.message}`)
process.exit(1)
