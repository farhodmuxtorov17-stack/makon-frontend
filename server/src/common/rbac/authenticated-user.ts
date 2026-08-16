import { Role } from '@prisma/client'

/** Sessiya sohibi: `app/types/rbac.ts` dagi `SessionUser` ning server tomoni. */
export interface AuthenticatedUser {
  id: string
  login: string
  fullName: string
  role: Role
  organizationId: string
  organizationName: string
  /** Faqat shu binolar doirasida ma’lumot ko‘radi, bo‘sh bo‘lsa cheklovsiz */
  buildingScope: string[]
  /** Omborchi uchun biriktirilgan ombor(lar) */
  warehouseScope: string[]
  position: string | null
  phone: string
  email: string | null
  tin: string | null
  address: string | null
}

/** Kirish tokeni ichidagi ma’lumot. */
export interface AccessTokenPayload {
  sub: string
  role: Role
  org: string
  typ: 'access'
}

/** Yangilash tokeni ichidagi ma’lumot. */
export interface RefreshTokenPayload {
  sub: string
  jti: string
  typ: 'refresh'
}

/** Ro‘yxatdan o‘tish oralig‘idagi qisqa muddatli token. */
export interface RegistrationTokenPayload {
  phone: string
  typ: 'registration'
}
