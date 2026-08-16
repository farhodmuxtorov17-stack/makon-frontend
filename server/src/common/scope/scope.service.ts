import { ForbiddenException, Injectable } from '@nestjs/common'
import { Role } from '@prisma/client'
import type { AuthenticatedUser } from '../rbac/authenticated-user'

/**
 * Ko‘rish sohasi: so‘rov darajasida cheklov.
 *
 * Bino rahbari boshqa binoning yozuvlarini jismonan o‘qiy olmaydi, chunki
 * cheklov interfeysda emas, `where` shartida qo‘llanadi. Ijarachi esa faqat
 * o‘z tashkiloti yozuvlarini ko‘radi.
 *
 * Qoidalar `app/stores/auth.ts` dagi `inScope` getteri bilan bir xil:
 * bo‘sh `buildingScope` cheklovsizlikni bildiradi.
 */
@Injectable()
export class ScopeService {
  /** Super rahbar barcha obyektlarni ko‘radi. */
  isUnrestricted(user: AuthenticatedUser): boolean {
    return user.role === Role.SUPER_HEAD || user.buildingScope.length === 0
  }

  /** Ijarachi tashqi foydalanuvchi: faqat o‘z tashkiloti. */
  isTenant(user: AuthenticatedUser): boolean {
    return user.role === Role.TENANT_OWNER
  }

  /** Ruxsat etilgan bino identifikatorlari. `null` cheklov yo‘qligini bildiradi. */
  buildingIds(user: AuthenticatedUser): string[] | null {
    if (this.isTenant(user)) return user.buildingScope.length > 0 ? [...user.buildingScope] : []
    if (this.isUnrestricted(user)) return null
    return [...user.buildingScope]
  }

  /** Bino shu foydalanuvchining ko‘rish sohasiga kiradimi. */
  canReadBuilding(user: AuthenticatedUser, buildingId: string): boolean {
    const ids = this.buildingIds(user)
    if (ids === null) return true
    return ids.includes(buildingId)
  }

  /** Soha tashqarisidagi bino so‘ralganda so‘rov to‘xtatiladi. */
  assertBuilding(user: AuthenticatedUser, buildingId: string): void {
    if (this.canReadBuilding(user, buildingId)) return
    throw new ForbiddenException({
      message: 'Bu obyekt sizning ko‘rish sohangizga kirmaydi',
      reason: 'BUILDING_OUT_OF_SCOPE',
      buildingId,
    })
  }

  /**
   * `buildingId` ustuni uchun Prisma sharti.
   * Cheklov bo‘lmasa `undefined` qaytadi va so‘rovga shart qo‘shilmaydi.
   */
  buildingFilter(user: AuthenticatedUser): { in: string[] } | undefined {
    const ids = this.buildingIds(user)
    if (ids === null) return undefined
    return { in: ids }
  }

  /**
   * So‘ralgan bino bo‘yicha filtr, foydalanuvchi sohasi bilan kesishtiriladi.
   * Soha tashqarisidagi bino so‘ralsa, so‘rov to‘xtatiladi.
   */
  buildingFilterFor(
    user: AuthenticatedUser,
    requestedBuildingId?: string,
  ): { in: string[] } | { equals: string } | undefined {
    if (requestedBuildingId) {
      this.assertBuilding(user, requestedBuildingId)
      return { equals: requestedBuildingId }
    }
    return this.buildingFilter(user)
  }

  /** Ijarachi uchun tashkilot cheklovi, xodimlarda cheklov yo‘q. */
  organizationFilter(user: AuthenticatedUser): { equals: string } | undefined {
    return this.isTenant(user) ? { equals: user.organizationId } : undefined
  }

  /** Ijarachi boshqa tashkilot yozuviga murojaat qilsa, so‘rov to‘xtatiladi. */
  assertOrganization(user: AuthenticatedUser, organizationId: string): void {
    if (!this.isTenant(user)) return
    if (user.organizationId === organizationId) return
    throw new ForbiddenException({
      message: 'Bu yozuv boshqa tashkilotga tegishli',
      reason: 'ORGANIZATION_OUT_OF_SCOPE',
    })
  }

  /** Biriktirilgan omborlar. `null` cheklov yo‘qligini bildiradi. */
  warehouseIds(user: AuthenticatedUser): string[] | null {
    if (user.role === Role.SUPER_HEAD) return null
    if (user.role !== Role.WAREHOUSE_OPERATOR) return null
    return [...user.warehouseScope]
  }

  canReadWarehouse(user: AuthenticatedUser, warehouseId: string): boolean {
    const ids = this.warehouseIds(user)
    if (ids === null) return true
    return ids.includes(warehouseId)
  }

  assertWarehouse(user: AuthenticatedUser, warehouseId: string): void {
    if (this.canReadWarehouse(user, warehouseId)) return
    throw new ForbiddenException({
      message: 'Bu ombor sizga biriktirilmagan',
      reason: 'WAREHOUSE_OUT_OF_SCOPE',
      warehouseId,
    })
  }

  warehouseFilter(user: AuthenticatedUser): { in: string[] } | undefined {
    const ids = this.warehouseIds(user)
    if (ids === null) return undefined
    return { in: ids }
  }

  warehouseFilterFor(
    user: AuthenticatedUser,
    requestedWarehouseId?: string,
  ): { in: string[] } | { equals: string } | undefined {
    if (requestedWarehouseId) {
      this.assertWarehouse(user, requestedWarehouseId)
      return { equals: requestedWarehouseId }
    }
    return this.warehouseFilter(user)
  }
}
