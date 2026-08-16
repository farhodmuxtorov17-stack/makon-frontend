/**
 * Word hujjatini (DOCX) tashqi kutubxonasiz yig‘ish.
 *
 * DOCX — bu OOXML qismlaridan iborat ZIP paket. Bu yerda siqishsiz («stored»)
 * ZIP yozuvchi va eng kichik to‘g‘ri hujjat tuzilmasi bor, shuning uchun
 * yuklab olingan fayl haqiqiy Word hujjati bo‘ladi.
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[i] = c >>> 0
  }
  return table
})()

/** Blob’ga to‘g‘ridan-to‘g‘ri beriladigan bayt massivi */
type Bytes = Uint8Array<ArrayBuffer>

function crc32(bytes: Bytes): number {
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) {
    c = (CRC_TABLE[(c ^ (bytes[i] ?? 0)) & 0xff] ?? 0) ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}

interface ZipEntry {
  name: string
  data: Bytes
}

/** Siqishsiz ZIP paket — DOCX uchun yetarli va eng ishonchli usul */
export function zipArchive(entries: ZipEntry[]): Blob {
  const encoder = new TextEncoder()
  const locals: Bytes[] = []
  const centrals: Bytes[] = []
  let offset = 0

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name)
    const crc = crc32(entry.data)
    const size = entry.data.length

    const local = new Uint8Array(30 + nameBytes.length)
    const lv = new DataView(local.buffer)
    lv.setUint32(0, 0x04034b50, true)
    lv.setUint16(4, 20, true)
    lv.setUint16(6, 0x0800, true)
    lv.setUint16(8, 0, true)
    lv.setUint16(10, 0, true)
    lv.setUint16(12, 0x21, true)
    lv.setUint32(14, crc, true)
    lv.setUint32(18, size, true)
    lv.setUint32(22, size, true)
    lv.setUint16(26, nameBytes.length, true)
    lv.setUint16(28, 0, true)
    local.set(nameBytes, 30)

    const central = new Uint8Array(46 + nameBytes.length)
    const cv = new DataView(central.buffer)
    cv.setUint32(0, 0x02014b50, true)
    cv.setUint16(4, 20, true)
    cv.setUint16(6, 20, true)
    cv.setUint16(8, 0x0800, true)
    cv.setUint16(10, 0, true)
    cv.setUint16(12, 0, true)
    cv.setUint16(14, 0x21, true)
    cv.setUint32(16, crc, true)
    cv.setUint32(20, size, true)
    cv.setUint32(24, size, true)
    cv.setUint16(28, nameBytes.length, true)
    cv.setUint16(30, 0, true)
    cv.setUint16(32, 0, true)
    cv.setUint16(34, 0, true)
    cv.setUint16(36, 0, true)
    cv.setUint32(38, 0, true)
    cv.setUint32(42, offset, true)
    central.set(nameBytes, 46)

    locals.push(local, entry.data)
    centrals.push(central)
    offset += local.length + size
  }

  const centralSize = centrals.reduce((s, c) => s + c.length, 0)
  const end = new Uint8Array(22)
  const ev = new DataView(end.buffer)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint16(4, 0, true)
  ev.setUint16(6, 0, true)
  ev.setUint16(8, entries.length, true)
  ev.setUint16(10, entries.length, true)
  ev.setUint32(12, centralSize, true)
  ev.setUint32(16, offset, true)
  ev.setUint16(20, 0, true)

  return new Blob([...locals, ...centrals, end], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })
}

export type DocxStyle = 'title' | 'subtitle' | 'heading' | 'body' | 'small'

export interface DocxLine {
  text: string
  style?: DocxStyle
}

function xmlEscape(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const SIZE: Record<DocxStyle, number> = {
  title: 32,
  subtitle: 20,
  heading: 24,
  body: 22,
  small: 18,
}

function paragraph(line: DocxLine) {
  const style = line.style ?? 'body'
  const bold = style === 'title' || style === 'heading'
  const align = style === 'title' || style === 'subtitle' ? '<w:jc w:val="center"/>' : ''
  const after = style === 'heading' ? 160 : style === 'title' ? 40 : 80
  const color = style === 'small' || style === 'subtitle' ? '<w:color w:val="5A6678"/>' : ''

  return (
    `<w:p><w:pPr>${align}<w:spacing w:after="${after}" w:line="276" w:lineRule="auto"/></w:pPr>` +
    `<w:r><w:rPr>${bold ? '<w:b/>' : ''}${color}<w:sz w:val="${SIZE[style]}"/>` +
    `<w:szCs w:val="${SIZE[style]}"/></w:rPr>` +
    `<w:t xml:space="preserve">${xmlEscape(line.text)}</w:t></w:r></w:p>`
  )
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`

/** Satrlar ro‘yxatidan Word hujjatini yig‘adi */
export function docxBlob(lines: DocxLine[]): Blob {
  const body = lines.map(paragraph).join('')
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="851" w:bottom="1134" w:left="1418" w:header="709" w:footer="709" w:gutter="0"/></w:sectPr></w:body></w:document>`

  const encoder = new TextEncoder()
  return zipArchive([
    { name: '[Content_Types].xml', data: encoder.encode(CONTENT_TYPES) },
    { name: '_rels/.rels', data: encoder.encode(ROOT_RELS) },
    { name: 'word/document.xml', data: encoder.encode(document) },
  ])
}

/** Brauzer orqali haqiqiy fayl saqlash */
export function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/** Fayl baytlaridan haqiqiy SHA-256 nazorat yig‘indisi */
export async function sha256Bytes(data: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** 284531 → "277.9 KB" */
export function fileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${bytes} B`
}
