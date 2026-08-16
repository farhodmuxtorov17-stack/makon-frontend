import { ConflictException, Injectable } from '@nestjs/common'
import { LeaseStatus, Role } from '@prisma/client'
import type { Capability } from '../../common/rbac/capabilities'
import { ROLE_LABELS, hasCapability } from '../../common/rbac/capabilities'

/** Ijara siklidagi amallar. */
export enum LeaseAction {
  SUBMIT = 'SUBMIT',
  MARK_CONTACTED = 'MARK_CONTACTED',
  SAVE_OFFER = 'SAVE_OFFER',
  APPROVE_OPERATION = 'APPROVE_OPERATION',
  APPROVE_FINANCE = 'APPROVE_FINANCE',
  COMPOSE_CONTRACT = 'COMPOSE_CONTRACT',
  SEND_TO_DIDOX = 'SEND_TO_DIDOX',
  CHECK_DIDOX = 'CHECK_DIDOX',
  UPLOAD_SIGNED = 'UPLOAD_SIGNED',
  ACTIVATE = 'ACTIVATE',
  REJECT = 'REJECT',
  RETURN_FOR_REWORK = 'RETURN_FOR_REWORK',
}

/** Muvaffaqiyatli oqim tartibi, qayta ishlashga qaytarish shu ketma-ketlik bo‘yicha. */
export const LEASE_FLOW: LeaseStatus[] = [
  LeaseStatus.YANGI,
  LeaseStatus.OPERATSIYA_TASDIQLADI,
  LeaseStatus.MOLIYA_TASDIQLADI,
  LeaseStatus.QORALAMA_TAYYOR,
  LeaseStatus.DIDOX_YUBORILDI,
  LeaseStatus.DIDOX_IMZOLANDI,
  LeaseStatus.FAOL,
]

/** Yakuniy holatlar, ulardan keyin oqim davom etmaydi. */
export const TERMINAL_STATUSES: LeaseStatus[] = [LeaseStatus.FAOL, LeaseStatus.RAD_ETILDI]

/** Maqsad holatining maxsus turlari. */
export type TransitionTarget = LeaseStatus | 'SAME' | 'PREVIOUS'

export interface LeaseTransition {
  action: LeaseAction
  /** Amal ruxsat etilgan joriy holatlar */
  from: LeaseStatus[]
  /** Amaldan keyingi holat */
  to: TransitionTarget
  /** Amalni bajara oladigan rollar */
  roles: Role[]
  /** Qo‘shimcha yozuv huquqi, `ROLE_CAPABILITIES` jadvalidan */
  capability?: Capability
  /** Interfeysdagi tugma nomi */
  label: string
  /** Audit yozuviga tushadigan amal nomi */
  auditAction: string
}

/**
 * Holat mashinasi ma’lumot sifatida e’lon qilinadi: yangi bosqich qo‘shish
 * uchun shu jadvalga bitta satr qo‘shiladi, xizmat kodi o‘zgarmaydi.
 */
export const LEASE_TRANSITIONS: LeaseTransition[] = [
  {
    action: LeaseAction.SUBMIT,
    from: [],
    to: LeaseStatus.YANGI,
    roles: [Role.TENANT_OWNER],
    label: 'Ariza yuborish',
    auditAction: 'Ariza yuborildi',
  },
  {
    action: LeaseAction.MARK_CONTACTED,
    from: [LeaseStatus.YANGI],
    to: 'SAME',
    roles: [Role.BUILDING_MANAGER],
    capability: 'application.decide',
    label: 'Bog‘lanildi',
    auditAction: 'Bog‘lanildi',
  },
  {
    action: LeaseAction.SAVE_OFFER,
    from: [LeaseStatus.YANGI, LeaseStatus.OPERATSIYA_TASDIQLADI],
    to: 'SAME',
    roles: [Role.BUILDING_MANAGER, Role.ACCOUNTANT],
    capability: 'application.decide',
    label: 'Shartlarni saqlash',
    auditAction: 'Kelishilgan shartlar saqlandi',
  },
  {
    action: LeaseAction.APPROVE_OPERATION,
    from: [LeaseStatus.YANGI],
    to: LeaseStatus.OPERATSIYA_TASDIQLADI,
    roles: [Role.BUILDING_MANAGER],
    capability: 'application.decide',
    label: 'Tasdiqlash',
    auditAction: 'Operatsiya tasdiqladi',
  },
  {
    action: LeaseAction.APPROVE_FINANCE,
    from: [LeaseStatus.OPERATSIYA_TASDIQLADI],
    to: LeaseStatus.MOLIYA_TASDIQLADI,
    roles: [Role.ACCOUNTANT],
    capability: 'application.decide',
    label: 'Moliya tasdiqlash',
    auditAction: 'Moliya tasdiqladi',
  },
  {
    action: LeaseAction.COMPOSE_CONTRACT,
    from: [LeaseStatus.MOLIYA_TASDIQLADI],
    to: LeaseStatus.QORALAMA_TAYYOR,
    roles: [Role.BUILDING_MANAGER, Role.ACCOUNTANT],
    capability: 'contract.sign',
    label: 'Shartnoma qoralamasini tuzish',
    auditAction: 'Shartnoma qoralamasi tuzildi',
  },
  {
    action: LeaseAction.SEND_TO_DIDOX,
    from: [LeaseStatus.QORALAMA_TAYYOR],
    to: LeaseStatus.DIDOX_YUBORILDI,
    roles: [Role.BUILDING_MANAGER],
    capability: 'contract.sign',
    label: 'Didox orqali yuborish',
    auditAction: 'Didox orqali yuborildi',
  },
  {
    action: LeaseAction.CHECK_DIDOX,
    from: [LeaseStatus.DIDOX_YUBORILDI],
    to: 'SAME',
    roles: [Role.BUILDING_MANAGER],
    capability: 'contract.sign',
    label: 'Didox holatini tekshirish',
    auditAction: 'Didox holati tekshirildi',
  },
  {
    action: LeaseAction.UPLOAD_SIGNED,
    from: [LeaseStatus.DIDOX_IMZOLANDI],
    to: 'SAME',
    roles: [Role.BUILDING_MANAGER],
    capability: 'contract.sign',
    label: 'Imzolangan hujjatni yuklash',
    auditAction: 'Imzolangan hujjat yuklandi',
  },
  {
    action: LeaseAction.ACTIVATE,
    from: [LeaseStatus.DIDOX_IMZOLANDI],
    to: LeaseStatus.FAOL,
    roles: [Role.BUILDING_MANAGER],
    capability: 'contract.sign',
    label: 'Faollashtirish',
    auditAction: 'Shartnoma faollashtirildi',
  },
  {
    action: LeaseAction.REJECT,
    from: [
      LeaseStatus.YANGI,
      LeaseStatus.OPERATSIYA_TASDIQLADI,
      LeaseStatus.MOLIYA_TASDIQLADI,
      LeaseStatus.QORALAMA_TAYYOR,
      LeaseStatus.DIDOX_YUBORILDI,
      LeaseStatus.DIDOX_IMZOLANDI,
    ],
    to: LeaseStatus.RAD_ETILDI,
    roles: [Role.BUILDING_MANAGER, Role.ACCOUNTANT],
    capability: 'application.decide',
    label: 'Rad etish',
    auditAction: 'Ariza rad etildi',
  },
  {
    action: LeaseAction.RETURN_FOR_REWORK,
    from: [
      LeaseStatus.OPERATSIYA_TASDIQLADI,
      LeaseStatus.MOLIYA_TASDIQLADI,
      LeaseStatus.QORALAMA_TAYYOR,
      LeaseStatus.DIDOX_YUBORILDI,
      LeaseStatus.DIDOX_IMZOLANDI,
    ],
    to: 'PREVIOUS',
    roles: [Role.BUILDING_MANAGER, Role.ACCOUNTANT],
    capability: 'application.decide',
    label: 'Qayta ishlashga yuborish',
    auditAction: 'Qayta ishlashga yuborildi',
  },
]

const TRANSITION_INDEX = new Map<LeaseAction, LeaseTransition>(
  LEASE_TRANSITIONS.map((transition) => [transition.action, transition]),
)

export interface TransitionActor {
  role: Role
}

/**
 * Holat o‘tishlarining yagona qo‘riqchisi.
 *
 * Noto‘g‘ri rol yoki noto‘g‘ri joriy holat bo‘lganda 409 qaytariladi:
 * ikkala holatda ham o‘tish bajarilmaydi va sabab javob tanasida ko‘rinadi.
 */
@Injectable()
export class LeaseStateMachine {
  /** Barcha e’lon qilingan o‘tishlar. */
  transitions(): LeaseTransition[] {
    return LEASE_TRANSITIONS
  }

  find(action: LeaseAction): LeaseTransition {
    const transition = TRANSITION_INDEX.get(action)
    if (!transition) {
      throw new ConflictException({
        message: `Noma’lum amal: ${action}`,
        reason: 'UNKNOWN_ACTION',
      })
    }
    return transition
  }

  /** Rol shu amalni bajara oladimi. */
  roleAllows(action: LeaseAction, role: Role): boolean {
    const transition = this.find(action)
    if (!transition.roles.includes(role)) return false
    if (transition.capability && !hasCapability(role, transition.capability)) return false
    return true
  }

  /** Joriy holatdan shu amal mumkinmi. */
  statusAllows(action: LeaseAction, current: LeaseStatus): boolean {
    const transition = this.find(action)
    if (transition.from.length === 0) return true
    return transition.from.includes(current)
  }

  /** Amaldan keyingi holat. */
  nextStatus(action: LeaseAction, current: LeaseStatus): LeaseStatus {
    const transition = this.find(action)
    if (transition.to === 'SAME') return current
    if (transition.to === 'PREVIOUS') {
      const index = LEASE_FLOW.indexOf(current)
      return index > 0 ? (LEASE_FLOW[index - 1] as LeaseStatus) : LeaseStatus.YANGI
    }
    return transition.to
  }

  /** Rolga hozir ko‘rinadigan amallar ro‘yxati. */
  availableActions(current: LeaseStatus, role: Role): LeaseTransition[] {
    return LEASE_TRANSITIONS.filter(
      (transition) =>
        transition.action !== LeaseAction.SUBMIT &&
        this.statusAllows(transition.action, current) &&
        this.roleAllows(transition.action, role),
    )
  }

  /**
   * O‘tishni tekshiradi va yangi holatni qaytaradi.
   * Rol mos kelmasa yoki joriy holat noto‘g‘ri bo‘lsa, 409 ko‘tariladi.
   */
  assertTransition(
    action: LeaseAction,
    current: LeaseStatus,
    actor: TransitionActor,
  ): { transition: LeaseTransition; next: LeaseStatus } {
    const transition = this.find(action)

    if (!this.roleAllows(action, actor.role)) {
      throw new ConflictException({
        message: `«${transition.label}» amalini ${ROLE_LABELS[actor.role]} bajara olmaydi`,
        reason: 'ROLE_NOT_ALLOWED',
        action,
        role: actor.role,
        allowedRoles: transition.roles,
      })
    }

    if (!this.statusAllows(action, current)) {
      throw new ConflictException({
        message: `«${transition.label}» amali «${current}» holatida mumkin emas`,
        reason: 'INVALID_STATE',
        action,
        current,
        allowedFrom: transition.from,
      })
    }

    return { transition, next: this.nextStatus(action, current) }
  }
}
