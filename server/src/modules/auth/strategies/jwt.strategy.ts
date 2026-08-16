import { Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { PrismaService } from '../../../prisma/prisma.service'
import type { AccessTokenPayload, AuthenticatedUser } from '../../../common/rbac/authenticated-user'

/**
 * Kirish tokeni tekshiriladi va sessiya sohibi bazadan o‘qiladi.
 * Ko‘rish sohasi tokendan emas, bazadan olinadi: huquq o‘zgarsa,
 * u darhol kuchga kiradi.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.accessSecret') ?? '',
    })
  }

  async validate(payload: AccessTokenPayload): Promise<AuthenticatedUser> {
    if (payload.typ !== 'access') throw new UnauthorizedException('Token turi mos emas')

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { organization: true },
    })

    if (!user || !user.isActive) throw new UnauthorizedException('Hisob faol emas')

    return {
      id: user.id,
      login: user.login,
      fullName: user.fullName,
      role: user.role,
      organizationId: user.organizationId,
      organizationName: user.organization.name,
      buildingScope: user.buildingScope,
      warehouseScope: user.warehouseScope,
      position: user.position,
      phone: user.phone,
      email: user.email,
      tin: user.organization.tin,
      address: user.organization.address,
    }
  }
}
