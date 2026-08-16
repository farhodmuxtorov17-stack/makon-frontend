import { SetMetadata, createParamDecorator, type ExecutionContext } from '@nestjs/common'
import { Role } from '@prisma/client'
import type { Capability } from '../rbac/capabilities'
import type { AuthenticatedUser } from '../rbac/authenticated-user'

export const ROLES_KEY = 'makon:roles'
export const CAPABILITY_KEY = 'makon:capability'
export const PUBLIC_KEY = 'makon:public'

/** Marshrutga qaysi rollar kira olishini belgilaydi. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles)

/** Yozuv amalini bajarish uchun kerakli huquq. */
export const RequireCapability = (...capabilities: Capability[]) =>
  SetMetadata(CAPABILITY_KEY, capabilities)

/** Token talab qilinmaydigan marshrut. */
export const Public = () => SetMetadata(PUBLIC_KEY, true)

/** Joriy sessiya sohibi. */
export const CurrentUser = createParamDecorator(
  (field: keyof AuthenticatedUser | undefined, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>()
    const user = request.user as AuthenticatedUser
    return field ? user?.[field] : user
  },
)
