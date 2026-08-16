import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Role } from '@prisma/client'
import { ROLES_KEY } from '../decorators'
import type { AuthenticatedUser } from '../rbac/authenticated-user'
import { ROLE_HOME } from '../rbac/capabilities'

/**
 * Birinchi qatlam: marshrutga kirish huquqi.
 * Super rahbar barcha rol tekshiruvlaridan o‘tadi, qolgan rollar ruxsat
 * bo‘lmagan marshrutda o‘z bosh sahifasiga qaytariladi.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const allowed = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (!allowed || allowed.length === 0) return true

    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>()
    const user = request.user
    if (!user) throw new ForbiddenException('Sessiya topilmadi')

    if (user.role === Role.SUPER_HEAD) return true
    if (allowed.includes(user.role)) return true

    throw new ForbiddenException({
      message: 'Bu bo‘limga kirish huquqingiz yo‘q',
      reason: 'ROLE_NOT_ALLOWED',
      redirect: ROLE_HOME[user.role],
    })
  }
}
