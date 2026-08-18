import { useStorage } from '@vueuse/core'

export type LocaleCode = 'uz' | 'ru'

/**
 * Interfeys tili bitta joydan boshqariladi. Tanlov `makon.locale` kalitida
 * saqlanadi, sahifa yangilangandan keyin ham qoladi, va sarlavhadagi til
 * tugmasi bilan profil hamda sozlamalardagi tanlov ayrilib qolmaydi:
 * hammasi shu kalitga yozadi.
 */
export function useLocaleChoice() {
  const { locale, setLocale } = useI18n()
  const stored = useStorage<LocaleCode>('makon.locale', 'uz')

  watch(
    stored,
    (code) => {
      if (locale.value !== code) setLocale(code)
    },
    { immediate: true },
  )

  function pick(code: string) {
    if (code === 'uz' || code === 'ru') stored.value = code
  }

  return { stored, pick }
}
