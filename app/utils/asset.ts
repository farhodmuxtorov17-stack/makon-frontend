/**
 * Loyiha ildizi ostidagi statik faylga yo‘l. Ilova kichik papkada joylashsa
 * (masalan GitHub Pages), `baseURL` avtomatik qo‘shiladi.
 */
export function assetUrl(path: string) {
  const base = useRuntimeConfig().app.baseURL || '/'
  return `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`
}
