import type { ComputedRef, InjectionKey } from 'vue'

/**
 * `UiField` o‘zi yaratgan `id` ni ichidagi boshqaruv elementiga shu kontekst
 * orqali uzatadi: shunda yorliq har doim maydonga bog‘lanadi va chaqiruv
 * joylarida hech narsa o‘zgartirilmaydi.
 */
export interface FieldContext {
  /** Boshqaruv elementiga beriladigan `id`; yorliqning `for` qiymati shu */
  id: ComputedRef<string>
  /** Xato yoki izoh matnining `id` si, yo‘q bo‘lsa `undefined` */
  describedBy: ComputedRef<string | undefined>
}

export const FIELD_CONTEXT: InjectionKey<FieldContext> = Symbol('makon.field')

/** `UiField` ichidagi boshqaruv element uchun yorliq bog‘lanishini oladi */
export function useFieldContext(): FieldContext | null {
  return inject(FIELD_CONTEXT, null)
}
