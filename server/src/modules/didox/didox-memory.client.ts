import { Injectable, NotFoundException } from '@nestjs/common'
import { DidoxState } from '@prisma/client'
import type {
  DidoxClient,
  DidoxDownloadResult,
  DidoxSendInput,
  DidoxSendResult,
  DidoxStatusResult,
} from './didox-client.interface'

/**
 * Mahalliy ishlab chiqish uchun amalga oshirish: hujjat xotirada saqlanadi,
 * holat esa har bir tekshiruvda navbatdagi bosqichga o‘tadi
 * (Yuborilgan, Ko‘rib chiqilmoqda, Imzolangan). Bu tashqi xizmat
 * ulanmagan holatda ham butun ijara siklini oxirigacha yurishga imkon beradi.
 */
const STATE_FLOW: DidoxState[] = [
  DidoxState.YUBORILGAN,
  DidoxState.KORIB_CHIQILMOQDA,
  DidoxState.IMZOLANGAN,
]

interface StoredDocument {
  docNumber: string
  externalId: string
  recipientName: string
  fileName: string
  mimeType: string
  content: Buffer
  state: DidoxState
}

@Injectable()
export class DidoxMemoryClient implements DidoxClient {
  readonly kind = 'memory'

  private readonly documents = new Map<string, StoredDocument>()
  private sequence = 48_210

  async send(input: DidoxSendInput): Promise<DidoxSendResult> {
    this.sequence += 1
    const docNumber = `DX-${new Date().getFullYear()}-${this.sequence}`

    this.documents.set(docNumber, {
      docNumber,
      externalId: `${this.sequence}`,
      recipientName: input.recipientName,
      fileName: input.fileName,
      mimeType: input.mimeType,
      content: input.content,
      state: DidoxState.YUBORILGAN,
    })

    return {
      docNumber,
      externalId: `${this.sequence}`,
      state: DidoxState.YUBORILGAN,
      sentAt: new Date(),
      note: `Hujjat ${input.recipientName} tashkilotiga imzolash uchun yuborildi`,
    }
  }

  async getStatus(docNumber: string): Promise<DidoxStatusResult> {
    const stored = this.get(docNumber)
    const index = STATE_FLOW.indexOf(stored.state)
    const next = STATE_FLOW[index + 1]
    if (next) stored.state = next

    return {
      state: stored.state,
      checkedAt: new Date(),
      note: this.noteFor(stored),
      signedFileUrl:
        stored.state === DidoxState.IMZOLANGAN ? `didox://${stored.docNumber}/signed` : null,
    }
  }

  async download(docNumber: string): Promise<DidoxDownloadResult> {
    const stored = this.get(docNumber)
    if (stored.state !== DidoxState.IMZOLANGAN) {
      throw new NotFoundException('Imzolangan nusxa hali tayyor emas')
    }
    return {
      fileName: stored.fileName.replace(/\.(\w+)$/, '-signed.$1'),
      mimeType: stored.mimeType,
      content: stored.content,
    }
  }

  private get(docNumber: string): StoredDocument {
    const stored = this.documents.get(docNumber)
    if (!stored) throw new NotFoundException(`${docNumber} raqamli hujjat topilmadi`)
    return stored
  }

  private noteFor(stored: StoredDocument): string {
    switch (stored.state) {
      case DidoxState.KORIB_CHIQILMOQDA:
        return `${stored.recipientName} hujjatni ochdi va ko‘rib chiqmoqda`
      case DidoxState.IMZOLANGAN:
        return 'Hujjat imzolandi va Didox tomonida yakunlandi'
      default:
        return 'Hujjat imzolash uchun yuborilgan, javob kutilmoqda'
    }
  }
}
