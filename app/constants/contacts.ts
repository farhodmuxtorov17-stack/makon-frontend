import { LANDLORD_STIR, organizationByStir } from '~/data/organizations'

/**
 * Bog‘lanish rekvizitlari bitta joyda turadi: ommaviy sayt, yordam markazi,
 * kirish oynasi va yon paneldagi qo‘llab-quvvatlash kartasi shu yerdan
 * o‘qiydi. Raqam, e-pochta va manzil ijaraga beruvchi tashkilot yozuvidan
 * olinadi, shuning uchun reyestrdagi ma’lumot bilan ekrandagi matn ayrilib
 * qolmaydi.
 */
const landlord = organizationByStir(LANDLORD_STIR)

const phone = landlord?.phone ?? '+998 78 150 00 00'
const email = landlord?.email ?? 'info@makon.uz'

export const CONTACT = {
  /** Yagona qabul raqami: ijara, katalog va qo‘llab-quvvatlash bo‘yicha */
  phone,
  phoneHref: `tel:+${phone.replace(/\D/g, '')}`,
  email,
  emailHref: `mailto:${email}`,
  address: landlord?.address ?? 'Toshkent shahri, Mirobod tumani, Amir Temur ko‘chasi 88',
  /**
   * Qabulxona ish vaqti. Servis navbatchiligi bundan mustasno va u alohida
   * izoh sifatida beriladi. Tarjimasi `public.contactHours` kalitida.
   */
  hours: 'Dushanba–shanba, 09:00–19:00',
}
