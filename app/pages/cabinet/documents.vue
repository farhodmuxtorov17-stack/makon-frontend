<script setup lang="ts">
import { buildingById } from '~/data/buildings'
import { CONTRACTS, INVOICES, type Contract, type Invoice } from '~/data/business'
import { UNITS, type Unit } from '~/data/units'
import {
  formatStir,
  LANDLORD_STIR,
  ORGANIZATIONS,
  organizationByStir,
} from '~/data/organizations'
import { csvBlob, docxBlob, fileSize, fileSlug, saveBlob, type DocxLine } from '~/utils/docx'
import { area, dateShort, monthTitle, num, sum } from '~/utils/format'

const auth = useAuthStore()
const lease = useLeaseStore()

lease.seed()

/** Kabinet faqat kirgan foydalanuvchining tashkiloti bilan ishlaydi */
const organization = computed(() => auth.user?.organization ?? '')

const myUnits = computed(() =>
  UNITS.filter((u) => organization.value && u.tenant === organization.value),
)

const myContracts = computed(() =>
  CONTRACTS.filter((c) => organization.value && c.tenant === organization.value),
)

const myInvoices = computed(() =>
  INVOICES.filter((i) => organization.value && i.tenant === organization.value),
)

/** «Unit 501» va «501» yozuvlari bir xil unitga ishora qiladi */
function unitCodeOf(value: string) {
  return String(value ?? '').replace(/^\s*Unit\s*/i, '').trim()
}

function unitOf(code: string, buildingId?: string): Unit | undefined {
  const clean = unitCodeOf(code)
  return UNITS.find(
    (u) => u.code === clean && (!buildingId || u.buildingId === buildingId),
  )
}

function buildingNameOf(buildingId: string, fallback: string) {
  return buildingById(buildingId)?.name ?? fallback
}

// ---------------------------------------------------------------------------
// Tomonlar rekvizitlari

interface PartyRequisites {
  name: string
  stir: string
  address: string
  director: string
  bank: string
  account: string
}

const landlord = computed<PartyRequisites>(() => {
  const o = organizationByStir(LANDLORD_STIR)
  return {
    name: o?.name ?? '',
    stir: formatStir(o?.stir ?? LANDLORD_STIR),
    address: o?.address ?? '',
    director: o?.director ?? '',
    bank: o?.bank ?? '',
    account: o?.account ?? '',
  }
})

const tenantParty = computed<PartyRequisites>(() => {
  const o =
    organizationByStir(auth.user?.tin ?? '') ??
    ORGANIZATIONS.find((x) => x.name === organization.value)
  return {
    name: o?.name ?? organization.value,
    stir: formatStir(o?.stir ?? auth.user?.tin ?? ''),
    address: o?.address ?? auth.user?.address ?? '',
    director: o?.director ?? auth.user?.fullName ?? '',
    bank: o?.bank ?? '',
    account: o?.account ?? '',
  }
})

function partyRows(p: PartyRequisites) {
  return [
    { label: 'Nomi', value: p.name },
    { label: 'STIR', value: p.stir },
    { label: 'Yuridik manzil', value: p.address },
    { label: 'Bank', value: p.bank },
    { label: 'Hisob raqami', value: p.account },
    { label: 'Rahbar', value: p.director },
  ].filter((r) => r.value)
}

function partyLines(title: string, p: PartyRequisites): DocxLine[] {
  return [
    { text: title, style: 'heading' },
    ...partyRows(p).map((r) => ({ text: `${r.label}: ${r.value}` })),
  ]
}

// ---------------------------------------------------------------------------
// Hisoblagichlar

/**
 * Maydon topshirilgan kuni qayd etilgan boshlang‘ich ko‘rsatkichlar.
 * Dalolatnoma o‘sha kungi holatni qayd etadi, shuning uchun keyingi o‘qishlar
 * bu qiymatlarni o‘zgartirmaydi: joriy ko‘rsatkichlar «Hisoblagichlar»
 * bo‘limida turadi va shu qiymatlardan boshlab hisoblanadi.
 */
const HANDOVER_METERS = [
  { type: 'Suv', code: 'MTR-SV-0014', serial: 'SV-442716', unit: 'm³', place: 'sanuzel tuguni', reading: 90.7 },
  { type: 'Elektr', code: 'MTR-EL-0032', serial: 'EL-884733', unit: 'kVt-soat', place: 'kirish shchiti', reading: 1022.6 },
  { type: 'Issiqlik', code: 'MTR-IS-0009', serial: 'IS-770418', unit: 'Gkal', place: 'issiqlik tuguni', reading: 27.4 },
]

// ---------------------------------------------------------------------------
// Hujjatlar reyestri: shartnoma, hisob-faktura va unit ma’lumotidan yig‘iladi

type DocCategory = 'Shartnoma' | 'Dalolatnoma' | 'Hisob-faktura' | 'Qoidalar'
type DocFormat = 'DOCX' | 'CSV'

interface CabinetDocument {
  id: string
  name: string
  code: string
  category: DocCategory
  /** Hujjat tarkibini quruvchi shakl */
  kind:
    | 'contract'
    | 'schedule'
    | 'handover'
    | 'equipment'
    | 'meters'
    | 'invoice'
    | 'requisites'
    | 'rules'
    | 'fire'
  unitCode: string
  format: DocFormat
  at: string
  summary: string
  contractCode?: string
  invoiceCode?: string
  unitId?: string
  buildingName?: string
}

const VAT_RATE = 12

function vatOf(total: number) {
  return Math.round(total - total / (1 + VAT_RATE / 100))
}

function addMonthsIso(iso: string, months: number) {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  const day = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + months)
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(day, last))
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function monthsBetween(startIso: string, endIso: string) {
  const s = new Date(`${startIso}T00:00:00`)
  const e = new Date(`${endIso}T00:00:00`)
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 12
  const diff = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth())
  return Math.max(1, Math.round(diff))
}

/** Shartnoma bo‘yicha oylik ijara to‘lovi: unit narxi shartnoma stavkasidir */
function monthlyRentOf(c: Contract) {
  const u = unitOf(c.unitCode, c.buildingId)
  if (u && u.priceUnit === 'so‘m / oy') return u.price
  return Math.round(c.amount / monthsBetween(c.startsAt, c.endsAt))
}

const DOCUMENTS = computed<CabinetDocument[]>(() => {
  const out: CabinetDocument[] = []

  for (const c of myContracts.value) {
    const code = c.code.replace(/^MKON/, '')
    const unitCode = unitCodeOf(c.unitCode)
    const u = unitOf(c.unitCode, c.buildingId)
    const building = buildingNameOf(c.buildingId, c.buildingName)
    const base = {
      unitCode,
      unitId: u?.id,
      buildingName: building,
      contractCode: c.code,
    }

    out.push(
      {
        ...base,
        id: `${c.id}-contract`,
        name: 'Ijara shartnomasi',
        code: c.code,
        category: 'Shartnoma',
        kind: 'contract',
        format: 'DOCX',
        at: c.startsAt,
        summary: `${building} · Unit ${unitCode} bo‘yicha ijara shartnomasi, ${dateShort(c.startsAt)} dan ${dateShort(c.endsAt)} gacha.`,
      },
      {
        ...base,
        id: `${c.id}-schedule`,
        name: 'To‘lov jadvali',
        code: c.code,
        category: 'Shartnoma',
        kind: 'schedule',
        format: 'CSV',
        at: c.startsAt,
        summary: `Shartnoma muddati davomidagi to‘lov davrlari, ${c.paymentTerm.toLowerCase()}.`,
      },
      {
        ...base,
        id: `${c.id}-handover`,
        name: 'Qabul-topshirish akti',
        code: `DLT${code}`,
        category: 'Dalolatnoma',
        kind: 'handover',
        format: 'DOCX',
        at: c.startsAt,
        summary: `Unit ${unitCode} ijarachiga topshirilganda tuzilgan dalolatnoma.`,
      },
      {
        ...base,
        id: `${c.id}-equipment`,
        name: 'Jihozlar ro‘yxati dalolatnomasi',
        code: `JIH${code}`,
        category: 'Dalolatnoma',
        kind: 'equipment',
        format: 'DOCX',
        at: c.startsAt,
        summary: `Unit ${unitCode} bilan birga topshirilgan jihozlar ro‘yxati va holati.`,
      },
      {
        ...base,
        id: `${c.id}-meters`,
        name: 'Hisoblagich ko‘rsatkichlari dalolatnomasi',
        code: `HSB${code}`,
        category: 'Dalolatnoma',
        kind: 'meters',
        format: 'DOCX',
        at: c.startsAt,
        summary: 'Suv, elektr va issiqlik hisoblagichlarining boshlang‘ich ko‘rsatkichlari.',
      },
    )
  }

  for (const i of myInvoices.value) {
    const u = unitOf(i.unitCode)
    out.push({
      id: `${i.id}-invoice`,
      name: 'Hisob-faktura',
      code: i.code,
      category: 'Hisob-faktura',
      kind: 'invoice',
      unitCode: unitCodeOf(i.unitCode),
      unitId: u?.id,
      buildingName: i.buildingName,
      invoiceCode: i.code,
      format: 'DOCX',
      at: i.issuedAt,
      summary: `${i.period} davri uchun ${i.buildingName} · ${i.unitCode} bo‘yicha hisob-faktura.`,
    })
  }

  if (out.length) {
    const building = myUnits.value[0]
      ? buildingNameOf(myUnits.value[0].buildingId, '')
      : (myContracts.value[0]
          ? buildingNameOf(myContracts.value[0].buildingId, myContracts.value[0].buildingName)
          : '')

    out.push(
      {
        id: 'gen-requisites',
        name: 'To‘lov rekvizitlari',
        code: 'REK-2025-0044',
        category: 'Qoidalar',
        kind: 'requisites',
        unitCode: 'Umumiy',
        buildingName: building,
        format: 'DOCX',
        at: '2026-04-17',
        summary: 'Ijaraga beruvchining bank rekvizitlari va to‘lov topshiriqnomasini to‘ldirish tartibi.',
      },
      {
        id: 'gen-rules',
        name: 'Bino ichki tartib-qoidalari',
        code: 'QDL-2025-0007',
        category: 'Qoidalar',
        kind: 'rules',
        unitCode: 'Umumiy',
        buildingName: building,
        format: 'DOCX',
        at: '2026-04-17',
        summary: 'Ish vaqti, kirish tartibi, umumiy zonalardan foydalanish qoidalari.',
      },
      {
        id: 'gen-fire',
        name: 'Yong‘in xavfsizligi yo‘riqnomasi',
        code: 'QDL-2025-0011',
        category: 'Qoidalar',
        kind: 'fire',
        unitCode: 'Umumiy',
        buildingName: building,
        format: 'DOCX',
        at: '2026-04-17',
        summary: 'Evakuatsiya rejasi va yong‘in xavfsizligi bo‘yicha talablar.',
      },
    )
  }

  return out
})

const CATEGORY_TONE: Record<string, string> = {
  Shartnoma: 'bg-brand-50 text-brand-600',
  Dalolatnoma: 'bg-info-50 text-info-600',
  'Hisob-faktura': 'bg-ok-50 text-ok-600',
  Qoidalar: 'bg-warn-50 text-warn-600',
}

const category = ref('all')
const format = ref('all')
const query = ref('')

const categoryTabs = computed(() => {
  const count = (key: DocCategory) => DOCUMENTS.value.filter((d) => d.category === key).length
  return [
    { value: 'all', label: 'Barchasi', count: DOCUMENTS.value.length },
    { value: 'Shartnoma', label: 'Shartnoma', count: count('Shartnoma') },
    { value: 'Dalolatnoma', label: 'Dalolatnoma', count: count('Dalolatnoma') },
    { value: 'Hisob-faktura', label: 'Hisob-faktura', count: count('Hisob-faktura') },
    { value: 'Qoidalar', label: 'Qoidalar', count: count('Qoidalar') },
  ]
})

/** Filtrda faqat haqiqatan yaratiladigan formatlar ko‘rinadi */
const formatOptions = computed(() => [
  { value: 'all', label: 'Barcha formatlar' },
  ...[...new Set(DOCUMENTS.value.map((d) => d.format))].map((f) => ({ value: f, label: f })),
])

// ---------------------------------------------------------------------------
// Hujjat matni: har bir kategoriya uchun alohida shakl

function contractOf(d: CabinetDocument) {
  return CONTRACTS.find((c) => c.code === d.contractCode)
}

function invoiceOf(d: CabinetDocument): Invoice | undefined {
  return INVOICES.find((i) => i.code === d.invoiceCode)
}

function unitOfDoc(d: CabinetDocument) {
  return d.unitId ? UNITS.find((u) => u.id === d.unitId) : undefined
}

function headerLines(d: CabinetDocument): DocxLine[] {
  return [
    { text: landlord.value.name, style: 'subtitle' },
    { text: d.name, style: 'title' },
    { text: `${d.code} · ${dateShort(d.at)}`, style: 'subtitle' },
  ]
}

function signatureLines(): DocxLine[] {
  return [
    { text: `Ijaraga beruvchi: ${landlord.value.director} _______________ M.O‘.`, style: 'small' },
    { text: `Ijarachi: ${tenantParty.value.director} _______________ M.O‘.`, style: 'small' },
  ]
}

function objectLines(d: CabinetDocument): DocxLine[] {
  const u = unitOfDoc(d)
  const rows: DocxLine[] = [
    { text: 'Ijara obyekti', style: 'heading' },
    { text: `Obyekt: ${d.buildingName ?? '-'}` },
    { text: `Unit: ${d.unitCode}` },
  ]
  if (u) {
    rows.push(
      { text: `Maydon: ${area(u.area)}` },
      { text: `Qavat: ${u.floor}-qavat, xonalar soni: ${u.rooms} ta` },
      { text: `Tayinlanishi: ${u.usage || '-'}` },
    )
  }
  return rows
}

/** Shartnoma bo‘yicha to‘lov davrlari: faol sikl grafigi yoki shartnoma shartlari */
function scheduleRows(c: Contract) {
  const item = lease.cases.find((x) => x.contract?.code === c.code)
  if (item && item.schedule.length) {
    return item.schedule.map((r, index) => ({
      no: index + 1,
      label: r.label,
      dueAt: r.dueAt,
      rent: r.rent,
      service: r.service,
      total: r.total,
    }))
  }

  const months = monthsBetween(c.startsAt, c.endsAt)
  const monthly = monthlyRentOf(c)
  return Array.from({ length: months }, (_, index) => {
    const dueAt = addMonthsIso(c.startsAt, index)
    return {
      no: index + 1,
      label: monthTitle(dueAt),
      dueAt,
      rent: monthly,
      service: 0,
      total: monthly,
    }
  })
}

function documentRows(d: CabinetDocument): Array<Array<string | number>> {
  const c = contractOf(d)
  if (!c) return [['Ma’lumot topilmadi']]
  const rows = scheduleRows(c)
  const head: Array<Array<string | number>> = [
    [`To‘lov jadvali · ${c.code}`],
    [`Ijaraga beruvchi: ${landlord.value.name} · STIR ${landlord.value.stir}`],
    [`Ijarachi: ${tenantParty.value.name} · STIR ${tenantParty.value.stir}`],
    [`Obyekt: ${d.buildingName ?? '-'} · Unit ${d.unitCode}`],
    [],
    ['№', 'Davr', 'To‘lov sanasi', 'Ijara, so‘m', 'Servis, so‘m', `QQS ${VAT_RATE}%, so‘m`, 'Jami, so‘m'],
  ]
  for (const r of rows) {
    head.push([r.no, r.label, dateShort(r.dueAt), r.rent, r.service, vatOf(r.total), r.total])
  }
  const total = rows.reduce((a, r) => a + r.total, 0)
  head.push([], ['Jami', '', '', '', '', vatOf(total), total])
  return head
}

function documentLines(d: CabinetDocument): DocxLine[] {
  const lines: DocxLine[] = headerLines(d)
  const c = contractOf(d)
  const u = unitOfDoc(d)

  if (d.kind === 'contract' && c) {
    const months = monthsBetween(c.startsAt, c.endsAt)
    const monthly = monthlyRentOf(c)
    lines.push(
      ...partyLines('Ijaraga beruvchi', landlord.value),
      ...partyLines('Ijarachi', tenantParty.value),
      ...objectLines(d),
      { text: 'Shartnoma shartlari', style: 'heading' },
      { text: `Shartnoma raqami: ${c.code}` },
      { text: `Amal qilish muddati: ${dateShort(c.startsAt)} · ${dateShort(c.endsAt)} (${months} oy)` },
      { text: `Oylik ijara to‘lovi: ${sum(monthly)} (QQS ${VAT_RATE}% kiritilgan: ${sum(vatOf(monthly))})` },
      { text: `Muddat bo‘yicha jami: ${sum(monthly * months)}` },
      { text: `To‘lov shakli: ${c.paymentTerm}` },
      { text: `Shartnoma holati: ${c.status === 'ACTIVE' ? 'Faol' : c.status}` },
      { text: 'Tomonlarning majburiyatlari', style: 'heading' },
      {
        text: 'Ijaraga beruvchi maydonni shartnomada ko‘rsatilgan holatda topshiradi, muhandislik tizimlari ishlashini ta’minlaydi va oyning birinchi ish kunida hisob-faktura taqdim etadi.',
      },
      {
        text: 'Ijarachi to‘lovni hisob-fakturada ko‘rsatilgan muddatda amalga oshiradi, maydondan shartnomada belgilangan maqsadda foydalanadi va bino ichki tartib-qoidalariga rioya qiladi.',
      },
    )
  } else if (d.kind === 'handover') {
    lines.push(
      { text: 'Tomonlar', style: 'heading' },
      { text: `Topshirdi: ${landlord.value.name}, vakil ${landlord.value.director}` },
      { text: `Qabul qildi: ${tenantParty.value.name}, vakil ${tenantParty.value.director}` },
      { text: `Topshirish sanasi: ${dateShort(d.at)}` },
      ...(c ? [{ text: `Shartnoma: ${c.code}` }] : []),
      ...objectLines(d),
      { text: 'Topshiriladigan pozitsiyalar', style: 'heading' },
      { text: `1. Ijara maydoni · ${u ? area(u.area) : '-'} · holati: foydalanishga yaroqli` },
      { text: `2. Kirish eshigi va qulf tizimi · 1 komplekt · holati: ishchi holatda` },
      { text: `3. Muhandislik chiqishlari (elektr, suv, ventilyatsiya) · holati: ulangan` },
      { text: `4. Kalitlar · 2 komplekt · topshirildi` },
      { text: 'Xulosa', style: 'heading' },
      {
        text: 'Maydon ko‘zdan kechirildi, yashirin nuqsonlar aniqlanmadi. Tomonlarning bir-biriga da’vosi yo‘q.',
      },
    )
  } else if (d.kind === 'equipment') {
    lines.push(
      { text: 'Tomonlar', style: 'heading' },
      { text: `Topshirdi: ${landlord.value.name}, vakil ${landlord.value.director}` },
      { text: `Qabul qildi: ${tenantParty.value.name}, vakil ${tenantParty.value.director}` },
      { text: `Topshirish sanasi: ${dateShort(d.at)}` },
      ...objectLines(d),
      { text: 'Jihozlar ro‘yxati', style: 'heading' },
    )
    const equipment = u?.equipment ?? []
    if (equipment.length) {
      equipment.forEach((e, index) => {
        lines.push({ text: `${index + 1}. ${e} · 1 dona · holati: ishchi holatda` })
      })
    } else {
      lines.push({ text: 'Unit bo‘yicha jihoz ro‘yxatga olinmagan.' })
    }
    lines.push(
      { text: 'Xulosa', style: 'heading' },
      {
        text: 'Yuqorida sanab o‘tilgan jihozlar ijarachiga ishchi holatda topshirildi va shartnoma tugaganda shu holatda qaytariladi.',
      },
    )
  } else if (d.kind === 'meters') {
    lines.push(
      { text: 'Tomonlar', style: 'heading' },
      { text: `Topshirdi: ${landlord.value.name}, vakil ${landlord.value.director}` },
      { text: `Qabul qildi: ${tenantParty.value.name}, vakil ${tenantParty.value.director}` },
      { text: `Qayd etilgan sana: ${dateShort(d.at)}` },
      ...objectLines(d),
      { text: 'Boshlang‘ich ko‘rsatkichlar', style: 'heading' },
    )
    HANDOVER_METERS.forEach((m, index) => {
      lines.push({
        text:
          `${index + 1}. ${m.type} · ${m.code} · zavod raqami ${m.serial} · ` +
          `joylashuvi: ${d.unitCode}-unit, ${m.place} · ko‘rsatkich: ${num(m.reading, 2)} ${m.unit}`,
      })
    })
    lines.push(
      { text: 'Xulosa', style: 'heading' },
      {
        text: 'Ko‘rsatkichlar tomonlar ishtirokida olindi va keyingi davr sarfini hisoblash uchun boshlang‘ich qiymat sifatida qabul qilinadi.',
      },
    )
  } else if (d.kind === 'invoice') {
    const inv = invoiceOf(d)
    if (inv) {
      // Hisob-faktura shartnomasi: unit kodi va ijarachi bo‘yicha topiladi
      const invContract =
        c ??
        myContracts.value.find(
          (x) => unitCodeOf(x.unitCode) === unitCodeOf(inv.unitCode) && x.status === 'ACTIVE',
        )
      const monthly = invContract ? monthlyRentOf(invContract) : inv.total
      const rent = Math.min(monthly || inv.total, inv.total)
      const rest = inv.total - rent
      lines.push(
        ...partyLines('Yetkazib beruvchi (ijaraga beruvchi)', landlord.value),
        ...partyLines('Xaridor (ijarachi)', tenantParty.value),
        { text: 'Hisob ma’lumotlari', style: 'heading' },
        { text: `Obyekt: ${inv.buildingName} · ${inv.unitCode}` },
        { text: `Hisob davri: ${inv.period}` },
        { text: `Berilgan sana: ${dateShort(inv.issuedAt)}` },
        { text: `To‘lov muddati: ${dateShort(inv.dueAt)}` },
        ...(invContract
          ? [
              { text: `Shartnoma: ${invContract.code} · ${dateShort(invContract.startsAt)}` },
              { text: `To‘lov shakli: ${invContract.paymentTerm}` },
            ]
          : []),
        { text: 'Xizmatlar', style: 'heading' },
        {
          text: `1. Ijara to‘lovi · 1 oy × ${sum(rent)} · QQS ${VAT_RATE}%: ${sum(vatOf(rent))} · jami ${sum(rent)}`,
        },
      )
      if (rest > 0) {
        lines.push({
          text: `2. Servis va boshqaruv xizmati · 1 oy × ${sum(rest)} · QQS ${VAT_RATE}%: ${sum(vatOf(rest))} · jami ${sum(rest)}`,
        })
      }
      lines.push(
        { text: 'Yakun', style: 'heading' },
        { text: `QQS siz jami: ${sum(inv.total - vatOf(inv.total))}` },
        { text: `QQS (${VAT_RATE}%): ${sum(vatOf(inv.total))}` },
        { text: `Jami to‘lov: ${sum(inv.total)}` },
        { text: `To‘langan: ${sum(inv.paid)}` },
        { text: `Qoldiq: ${sum(Math.max(inv.total - inv.paid, 0))}` },
      )
    }
  } else if (d.kind === 'requisites') {
    lines.push(
      ...partyLines('Ijaraga beruvchi rekvizitlari', landlord.value),
      ...partyLines('To‘lovchi rekvizitlari', tenantParty.value),
      { text: 'To‘lov topshiriqnomasini to‘ldirish tartibi', style: 'heading' },
      { text: `1. Benefitsiar: ${landlord.value.name}, STIR ${landlord.value.stir}.` },
      { text: `2. Hisob raqami: ${landlord.value.account}, bank: ${landlord.value.bank}.` },
      {
        text: `3. To‘lov maqsadi: hisob-faktura raqami va davri ko‘rsatiladi, masalan «${myInvoices.value[0]?.code ?? 'INV-YYYY-NNNN'} bo‘yicha ijara to‘lovi».`,
      },
      {
        text: `4. Summa hisob-fakturada ko‘rsatilgan qiymatga teng bo‘lishi kerak, QQS (${VAT_RATE}%) summaga kiritilgan.`,
      },
      {
        text: '5. To‘lov hisob-fakturada ko‘rsatilgan muddatgacha amalga oshiriladi, kechikkan kunlar uchun shartnomada belgilangan penya hisoblanadi.',
      },
    )
    if (myContracts.value.length) {
      lines.push({ text: 'Amaldagi shartnomalar', style: 'heading' })
      myContracts.value.forEach((x, index) => {
        lines.push({
          text: `${index + 1}. ${x.code} · Unit ${unitCodeOf(x.unitCode)} · ${x.paymentTerm}`,
        })
      })
    }
  } else if (d.kind === 'rules') {
    lines.push(
      { text: 'Umumiy qoidalar', style: 'heading' },
      { text: `Obyekt: ${d.buildingName ?? '-'}` },
      { text: '1. Ish vaqti: dushanba–juma 08:00–20:00, shanba 09:00–17:00. Boshqa vaqtda kirish navbatchi orqali rasmiylashtiriladi.' },
      { text: '2. Kirish tartibi: xodimlar ruxsatnoma kartasi bilan, mehmonlar qabulxonada ro‘yxatdan o‘tib kiradi.' },
      { text: '3. Umumiy zonalar (koridor, lift, sanuzel, avtoturargoh) barcha ijarachilar uchun umumiy, ularni band qilish taqiqlanadi.' },
      { text: '4. Ta’mir va montaj ishlari bino xizmati bilan oldindan kelishiladi va ish vaqtidan tashqari bajariladi.' },
      { text: '5. Nosozlik yoki avariya holati kabinetdagi servis arizasi orqali xabar qilinadi.' },
      { text: '6. Binoda chekish faqat belgilangan joylarda ruxsat etiladi.' },
      { text: 'Javobgarlik', style: 'heading' },
      {
        text: 'Qoidalar buzilgan taqdirda bino rahbari yozma ogohlantirish beradi, takroriy holatda yetkazilgan zarar ijarachi hisobidan qoplanadi.',
      },
    )
  } else if (d.kind === 'fire') {
    lines.push(
      { text: 'Talablar', style: 'heading' },
      { text: `Obyekt: ${d.buildingName ?? '-'}` },
      { text: '1. Evakuatsiya yo‘llari va zaxira chiqish eshiklari doimo bo‘sh saqlanadi.' },
      { text: '2. Har bir maydonda yong‘in o‘chirgich bo‘lishi va uning tekshiruv muddati amal qilishi shart.' },
      { text: '3. Yong‘in datchiklari va avtomatik o‘chirish tizimini o‘chirish yoki to‘sish taqiqlanadi.' },
      { text: '4. Elektr uzatgichlarni ortiqcha yuklash va vaqtinchalik simlardan foydalanish man etiladi.' },
      { text: '5. Yong‘in signali berilganda xodimlar eng yaqin evakuatsiya chiqishi orqali yig‘ilish nuqtasiga chiqadi.' },
      { text: 'Mas’uliyat', style: 'heading' },
      {
        text: 'Har bir ijarachi o‘z maydonida yong‘in xavfsizligi uchun mas’ul xodimni tayinlaydi va uning ma’lumotini bino xizmatiga taqdim etadi.',
      },
    )
  }

  lines.push({ text: 'Mazmuni', style: 'heading' }, { text: d.summary })

  if (d.kind !== 'requisites' && d.kind !== 'rules' && d.kind !== 'fire') {
    lines.push(...signatureLines())
  }

  return lines
}

/** Yuklab olinadigan faylning haqiqiy o‘zi: hajmi ham shundan olinadi */
function blobOf(d: CabinetDocument) {
  return d.format === 'CSV' ? csvBlob(documentRows(d)) : docxBlob(documentLines(d))
}

/** Fayl nomi hujjat nomini ham, kodini ham o‘z ichiga oladi: nusxalar bosib ketmaydi */
function fileNameOf(d: CabinetDocument) {
  return `${fileSlug(d.name)}-${d.code}.${d.format.toLowerCase()}`
}

const filtered = computed(() =>
  DOCUMENTS.value.filter((d) => {
    const byCategory = category.value === 'all' || d.category === category.value
    const byFormat = format.value === 'all' || d.format === format.value
    const q = query.value.trim().toLowerCase()
    const byQuery =
      !q ||
      d.name.toLowerCase().includes(q) ||
      d.code.toLowerCase().includes(q) ||
      d.summary.toLowerCase().includes(q)
    return byCategory && byFormat && byQuery
  }),
)

/** Jadval qatorlari: hajm haqiqiy fayl baytlaridan hisoblanadi */
const rows = computed(() =>
  filtered.value.map((d) => ({ ...d, size: fileSize(blobOf(d).size) })),
)

const columns = [
  { key: 'name', label: 'Hujjat nomi' },
  { key: 'category', label: 'Kategoriya' },
  { key: 'unitCode', label: 'Unit' },
  { key: 'format', label: 'Format' },
  { key: 'size', label: 'Hajmi', align: 'right' as const },
  { key: 'at', label: 'Sana', align: 'right' as const },
  { key: 'actions', label: 'Amallar', align: 'right' as const },
]

const previewOpen = ref(false)
const downloadOpen = ref(false)
const selected = ref<CabinetDocument | null>(null)
const savedFile = ref('')

function openPreview(d: CabinetDocument | undefined) {
  if (!d) return
  selected.value = d
  previewOpen.value = true
}

function openDownload(d: CabinetDocument | undefined) {
  if (!d) return
  selected.value = d
  savedFile.value = ''
  downloadOpen.value = true
}

function docById(id: unknown) {
  return DOCUMENTS.value.find((d) => d.id === id)
}

/** Ko‘rish oynasidagi hujjat matni: yuklab olinadigan fayl bilan bir xil manba */
const previewLines = computed(() =>
  selected.value && selected.value.format === 'DOCX' ? documentLines(selected.value) : [],
)

const previewTable = computed(() =>
  selected.value && selected.value.format === 'CSV' ? documentRows(selected.value) : [],
)

const outputFile = computed(() => {
  const d = selected.value
  if (!d) return null
  return { name: fileNameOf(d), size: fileSize(blobOf(d).size), format: d.format }
})

function downloadDocument() {
  const d = selected.value
  if (!d) return
  const fileName = fileNameOf(d)
  saveBlob(blobOf(d), fileName)
  savedFile.value = fileName
}

/** Kabinet bosh sahifasidan kelgan havola tegishli hujjatni ochadi */
const route = useRoute()

onMounted(() => {
  const code = String(route.query.hujjat ?? '')
  if (!code) return
  openPreview(DOCUMENTS.value.find((d) => d.code === code))
})
</script>

<template>
  <AppTopbar
    title="Hujjatlarim"
    subtitle="Shartnomalar, dalolatnomalar, hisob-fakturalar va qoidalar"
    :breadcrumb="[{ label: 'Kabinet', to: '/cabinet' }, { label: 'Hujjatlarim' }]"
  >
    <template #actions>
      <UiButton variant="secondary" size="sm" to="/cabinet/invoices">
        <UiIcon name="wallet" :size="16" />
        To‘lovlarim
      </UiButton>
      <UiButton size="sm" to="/cabinet/units">
        <UiIcon name="building" :size="16" />
        Mening unitlarim
      </UiButton>
    </template>
  </AppTopbar>

  <main class="scroll-slim flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
    <section v-if="DOCUMENTS.length" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <button
        v-for="t in categoryTabs.slice(1)"
        :key="t.value"
        type="button"
        class="rounded-card bg-surface p-4 text-left shadow-card ring-1 transition-all hover:shadow-panel"
        :class="category === t.value ? 'ring-2 ring-brand-500' : 'ring-ink-200/60 hover:ring-brand-300'"
        @click="category = category === t.value ? 'all' : t.value"
      >
        <div class="flex items-start justify-between gap-3">
          <span class="grid size-10 place-items-center rounded-[10px]" :class="CATEGORY_TONE[t.value]">
            <UiIcon name="doc" :size="19" />
          </span>
          <span class="tabular text-[22px] font-bold leading-none text-ink-900">{{ t.count }}</span>
        </div>
        <p class="mt-3 text-[14px] font-semibold text-ink-900">{{ t.label }}</p>
        <p class="mt-0.5 text-[12px] text-ink-500">Kategoriya bo‘yicha filtrlash</p>
      </button>
    </section>

    <UiCard
      title="Hujjatlar ro‘yxati"
      :subtitle="`${organization || 'Tashkilot'} · ${filtered.length} ta hujjat`"
      flush
    >
      <UiEmpty
        v-if="!DOCUMENTS.length"
        icon="doc"
        title="Hujjat topilmadi"
        description="Tashkilotingiz nomiga rasmiylashtirilgan shartnoma yoki hisob-faktura bo‘lmaguncha bu bo‘lim bo‘sh turadi. Maydon uchun ariza yuboring, shartnoma faollashgach hujjatlar shu yerda paydo bo‘ladi."
        action-label="Ijaraga olish arizasi"
        action-to="/cabinet/apply"
      />

      <template v-else>
        <div class="flex flex-wrap items-center gap-3 px-5 pb-4">
          <UiTabs v-model="category" :tabs="categoryTabs" />
          <UiSelect v-model="format" :options="formatOptions" size="sm" class="w-44" />
          <UiInput v-model="query" placeholder="Hujjat nomi yoki raqami bo‘yicha qidirish" class="w-full sm:w-80">
            <template #prefix><UiIcon name="search" :size="16" /></template>
          </UiInput>
        </div>

        <UiTable
          :columns="columns"
          :rows="rows"
          empty="Tanlangan filtr bo‘yicha hujjat topilmadi"
          @row-click="(row) => openPreview(docById(row.id))"
        >
          <template #cell-name="{ row }">
            <span class="flex items-center gap-3">
              <span
                class="grid size-9 shrink-0 place-items-center rounded-[10px]"
                :class="CATEGORY_TONE[String(row.category)]"
              >
                <UiIcon name="doc" :size="17" />
              </span>
              <span class="min-w-0">
                <span class="block truncate text-[14px] font-semibold text-ink-900">{{ row.name }}</span>
                <span class="tabular block truncate text-[12px] text-ink-500">{{ row.code }}</span>
              </span>
            </span>
          </template>
          <template #cell-category="{ value }">
            <span class="rounded-pill bg-ink-100 px-2.5 py-1 text-[12px] font-semibold text-ink-700">
              {{ value }}
            </span>
          </template>
          <template #cell-unitCode="{ value }">
            <span class="text-[13px]">{{ value === 'Umumiy' ? 'Umumiy' : `Unit ${value}` }}</span>
          </template>
          <template #cell-format="{ value }">
            <span class="tabular text-[13px] font-semibold text-ink-700">{{ value }}</span>
          </template>
          <template #cell-at="{ value }">
            <span class="tabular text-[13px]">{{ dateShort(String(value)) }}</span>
          </template>
          <template #cell-actions="{ row }">
            <span class="flex items-center justify-end gap-1.5">
              <button
                type="button"
                class="grid size-11 place-items-center rounded-field text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-800 md:size-9"
                :aria-label="`${row.name}, ko‘rish`"
                @click.stop="openPreview(docById(row.id))"
              >
                <UiIcon name="eye" :size="17" />
              </button>
              <button
                type="button"
                class="grid size-11 place-items-center rounded-field text-brand-600 transition-colors hover:bg-brand-50 md:size-9"
                :aria-label="`${row.name}, yuklab olish`"
                @click.stop="openDownload(docById(row.id))"
              >
                <UiIcon name="download" :size="17" />
              </button>
            </span>
          </template>
        </UiTable>
      </template>
    </UiCard>
  </main>

  <UiModal
    v-model="previewOpen"
    :title="selected?.name ?? 'Hujjat'"
    :subtitle="selected ? `${selected.code} · ${selected.format} · ${outputFile?.size ?? ''}` : ''"
    size="lg"
  >
    <div v-if="selected" class="space-y-4">
      <div class="rounded-field bg-white p-6 ring-1 ring-ink-200">
        <div class="flex flex-wrap items-start justify-between gap-6 border-b border-ink-200 pb-4">
          <div class="min-w-0">
            <span class="text-brand-600"><AppLogo size="sm" mono /></span>
            <p class="mt-2 text-[12px] text-ink-500">{{ landlord.name }}</p>
            <p class="text-[12px] text-ink-500">{{ landlord.address }}</p>
          </div>
          <div class="text-right">
            <p class="text-[16px] font-bold text-ink-900">{{ selected.name }}</p>
            <p class="tabular text-[13px] font-semibold text-ink-600">{{ selected.code }}</p>
            <p class="tabular text-[12px] text-ink-500">{{ dateShort(selected.at) }}</p>
          </div>
        </div>

        <div v-if="previewLines.length" class="pt-4">
          <template v-for="(l, i) in previewLines" :key="`pl-${i}`">
            <p
              v-if="l.style === 'heading'"
              class="mt-4 text-[13px] font-bold uppercase tracking-wide text-ink-700 first:mt-0"
            >
              {{ l.text }}
            </p>
            <p
              v-else-if="l.style === 'title' || l.style === 'subtitle'"
              class="hidden"
            >
              {{ l.text }}
            </p>
            <p
              v-else
              class="mt-1 text-[13px] leading-relaxed"
              :class="l.style === 'small' ? 'text-ink-500' : 'text-ink-700'"
            >
              {{ l.text }}
            </p>
          </template>
        </div>

        <div v-else-if="previewTable.length" class="scroll-slim overflow-x-auto pt-4">
          <table class="w-full min-w-max border-collapse text-[13px]">
            <tbody>
              <tr
                v-for="(r, i) in previewTable"
                :key="`pt-${i}`"
                class="border-b border-ink-100 last:border-0"
              >
                <td
                  v-for="(cell, j) in r"
                  :key="`pt-${i}-${j}`"
                  class="px-2 py-1.5"
                  :class="[
                    j === 0 ? 'text-ink-800' : 'text-ink-600',
                    typeof cell === 'number' ? 'tabular text-right' : 'text-left',
                  ]"
                >
                  {{ typeof cell === 'number' ? num(cell) : cell }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <template #footer>
      <UiButton variant="ghost" @click="previewOpen = false">Yopish</UiButton>
      <UiButton
        variant="secondary"
        @click="
          () => {
            previewOpen = false
            if (selected) openDownload(selected)
          }
        "
      >
        <UiIcon name="download" :size="16" />
        Yuklab olish
      </UiButton>
    </template>
  </UiModal>

  <UiModal
    v-model="downloadOpen"
    title="Hujjatni yuklab olish"
    :subtitle="selected ? selected.name : ''"
    size="sm"
  >
    <div v-if="selected" class="space-y-4">
      <div class="flex items-center gap-3.5 rounded-field bg-surface-sunken p-4 ring-1 ring-ink-200">
        <span
          class="grid size-12 shrink-0 place-items-center rounded-field"
          :class="CATEGORY_TONE[selected.category]"
        >
          <UiIcon name="doc" :size="24" />
        </span>
        <span class="min-w-0">
          <span class="block truncate text-[14px] font-semibold text-ink-900">
            {{ outputFile?.name }}
          </span>
          <span class="block text-[12px] text-ink-500">
            {{ outputFile?.format }} · {{ outputFile?.size }} · {{ dateShort(selected.at) }}
          </span>
        </span>
      </div>

      <p v-if="!savedFile" class="text-[13px] text-ink-600">
        {{
          selected.format === 'CSV'
            ? 'Jadval CSV ko‘rinishida yig‘iladi va Excel dasturida ochiladi.'
            : 'Hujjat nusxasi Word ko‘rinishida yig‘iladi va brauzeringiz orqali saqlanadi.'
        }}
      </p>
      <p v-else class="flex items-start gap-2 text-[13px] font-semibold text-ok-700">
        <UiIcon name="check" :size="16" class="mt-px shrink-0" />
        <span class="min-w-0">{{ savedFile }} fayli saqlandi.</span>
      </p>
    </div>

    <template #footer>
      <UiButton variant="ghost" @click="downloadOpen = false">Yopish</UiButton>
      <UiButton @click="downloadDocument">
        <UiIcon name="download" :size="16" />
        Yuklab olish
      </UiButton>
    </template>
  </UiModal>
</template>
