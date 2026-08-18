import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2026-08-01',
  devtools: { enabled: false },
  ssr: false,

  modules: ['@pinia/nuxt', 'pinia-plugin-persistedstate/nuxt', '@vueuse/nuxt', '@nuxtjs/i18n'],

  css: ['~/assets/css/main.css'],

  // Komponentlar papka nomi prefiksisiz ro‘yxatga olinadi:
  // components/layout/AppSidebar.vue → <AppSidebar />
  components: [{ path: '~/components', pathPrefix: false }],

  vite: {
    plugins: [tailwindcss()],
  },

  app: {
    // GitHub Pages loyihaning nomli papkasida joylashadi, yo‘l muhit
    // o‘zgaruvchisidan olinadi, lokal ishlaganda ildizda qoladi.
    baseURL: import.meta.env.NUXT_APP_BASE_URL || '/',
    buildAssetsDir: 'assets',
    head: {
      title: 'MAKON, ko‘chmas mulk boshqaruv tizimi',
      htmlAttrs: { lang: 'uz' },
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      ],
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    },
  },

  i18n: {
    strategy: 'no_prefix',
    defaultLocale: 'uz',
    locales: [
      { code: 'uz', name: 'O‘zbekcha', file: 'uz.json' },
      { code: 'ru', name: 'Ruscha', file: 'ru.json' },
    ],
    detectBrowserLanguage: false,
  },

  typescript: { strict: true },
})
