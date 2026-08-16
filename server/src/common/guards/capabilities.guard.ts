import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { CAPABILITY_KEY } from '../decorators'
import type { AuthenticatedUser } from '../rbac/authenticated-user'
import { type Capability, hasCapability } from '../rbac/capabilities'

/**
 * Ikkinchi qatlam: yozuv va qaror huquqi.
 * Bu tekshiruvda super rahbar uchun chetlab o‘tish yo‘q: u arizani ko‘radi,
 * lekin qarorni operatsion rollar qabul qiladi.
 */
@Injectable()
export class CapabilitiesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Capability[] | undefined>(CAPABILITY_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (!required || required.length === 0) return true

    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>()
    const user = request.user
    if (!user) throw new ForbiddenException('Sessiya topilmadi')

    const granted = required.every((capability) => hasCapability(user.role, capability))
    if (granted) return true

    throw new ForbiddenException({
      message: 'Bu amalni bajarish huquqingiz yo‘q',
      reason: 'CAPABILITY_MISSING',
      required,
    })
  }
}
