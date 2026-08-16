import { DidoxState } from '@prisma/client'

/**
 * Didox tashqi xizmat. Tizim faqat to‘rt amalni bajaradi:
 * hujjatni yuboradi, holatni tekshiradi, imzolangan faylni yuklab oladi
 * va uni tizimga qaytadan yuklaydi.
 *
 * Imzolash jarayoni boshqarilmaydi: imzo faqat Didox tomonida qo‘yiladi,
 * tizim ichida imzo oynasi yoki sertifikat tanlash yo‘q.
 */
export interface DidoxSendInput {
  /** Shartnoma raqami, MKON-2026-XXXX */
  contractCode: string
  /** Qabul qiluvchi tashkilot nomi */
  recipientName: string
  /** Qabul qiluvchining STIR raqami */
  recipientTin: string
  /** Yuboriladigan hujjat mazmuni */
  content: Buffer
  fileName: string
  mimeType: string
}

export interface DidoxSendResult {
  /** Didox tizimidagi hujjat raqami */
  docNumber: string
  /** Didox tomonidagi ichki identifikator */
  externalId: string
  state: DidoxState
  sentAt: Date
  note: string
}

export interface DidoxStatusResult {
  state: DidoxState
  checkedAt: Date
  note: string
  /** Imzolangan fayl mavjud bo‘lsa, uni yuklab olish havolasi */
  signedFileUrl: string | null
}

export interface DidoxDownloadResult {
  fileName: string
  mimeType: string
  content: Buffer
}

export interface DidoxClient {
  readonly kind: string

  /** Hujjatni imzolash uchun yuboradi. */
  send(input: DidoxSendInput): Promise<DidoxSendResult>

  /** Hujjatning joriy holatini so‘raydi. */
  getStatus(docNumber: string): Promise<DidoxStatusResult>

  /** Imzolangan nusxani yuklab oladi. */
  download(docNumber: string): Promise<DidoxDownloadResult>
}

export const DIDOX_CLIENT = Symbol('MAKON_DIDOX_CLIENT')
