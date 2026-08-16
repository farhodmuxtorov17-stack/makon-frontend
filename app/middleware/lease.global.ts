/**
 * Ijara sikli holati brauzer xotirasida saqlanadi, obyekt reyestri esa dastur
 * qayta yuklanganda boshlang‘ich qiymatlardan tiklanadi. Shuning uchun har bir
 * o‘tishda faol shartnomalar reyestrga qayta qo‘llanadi: band unitlar, bino
 * statistikasi, shartnoma va hisob-faktura. Amal takrorlanmaydi — qo‘llangan
 * yozuvlar bir marta hisobga olinadi.
 */
export default defineNuxtRouteMiddleware(() => {
  useLeaseStore().syncWorld()
})
