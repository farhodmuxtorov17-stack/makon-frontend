/**
 * Yozuv raqamlari: PREFIKS-YIL-NNNN.
 * Oxirgi raqam bazadagi eng katta koddan olinadi, shuning uchun boshlang‘ich
 * ma’lumotlar bilan bir xil ketma-ketlik davom etadi.
 */
export function nextCode(
  prefix: string,
  year: number,
  lastCode: string | null | undefined,
  width = 4,
): string {
  const head = `${prefix}-${year}-`
  const tail =
    lastCode && lastCode.startsWith(head) ? Number.parseInt(lastCode.slice(head.length), 10) : 0
  const next = Number.isFinite(tail) ? tail + 1 : 1
  return `${head}${String(next).padStart(width, '0')}`
}
