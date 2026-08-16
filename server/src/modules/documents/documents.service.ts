import { Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { ScopeService } from '../../common/scope/scope.service'
import { pageResult } from '../../common/dto/pagination.dto'
import type { AuthenticatedUser } from '../../common/rbac/authenticated-user'
import type { DocumentQueryDto } from './dto/document.dto'

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopeService,
  ) {}

  async list(user: AuthenticatedUser, query: DocumentQueryDto) {
    const where: Prisma.DocumentWhereInput = {
      kind: query.kind,
      contractId: query.contractId,
      leaseCaseId: query.leaseCaseId,
      organizationId: this.scope.organizationFilter(user),
      ...(query.search ? { fileName: { contains: query.search, mode: 'insensitive' } } : {}),
    }

    const [items, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        include: { contract: true, leaseCase: true },
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.document.count({ where }),
    ])

    return pageResult(
      items.map((doc) => ({
        id: doc.id,
        kind: doc.kind,
        name: doc.fileName,
        size: `${Math.max(1, Math.round(doc.size / 1024))} KB`,
        bytes: doc.size,
        type: doc.extension,
        hash: doc.hash,
        contractCode: doc.contract?.code ?? null,
        leaseCaseCode: doc.leaseCase?.code ?? null,
        uploadedAt: doc.createdAt.toISOString(),
        uploadedBy: doc.uploadedByName,
      })),
      total,
      query,
    )
  }

  async findOne(user: AuthenticatedUser, id: string) {
    const doc = await this.prisma.document.findUnique({
      where: { id },
      include: { contract: true, leaseCase: true },
    })
    if (!doc) throw new NotFoundException('Hujjat topilmadi')
    if (doc.organizationId) this.scope.assertOrganization(user, doc.organizationId)

    return {
      id: doc.id,
      kind: doc.kind,
      name: doc.fileName,
      storageKey: doc.storageKey,
      mimeType: doc.mimeType,
      extension: doc.extension,
      size: doc.size,
      hash: doc.hash,
      contractCode: doc.contract?.code ?? null,
      leaseCaseCode: doc.leaseCase?.code ?? null,
      uploadedAt: doc.createdAt.toISOString(),
      uploadedBy: doc.uploadedByName,
    }
  }
}
