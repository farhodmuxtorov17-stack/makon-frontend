# MAKON

Tijorat ko‘chmas mulk obyektlarini boshqarish axborot tizimi. Obyekt reyestri,
qavat va unit navigatsiyasi, ijara sikli, billing, servis desk, ombor va rolga
asoslangan ish maydonlari bitta konturda birlashtirilgan.

Frontend qismi. Backend integratsiyasi uchun ma’lumot qatlami `app/data/` da
izolyatsiya qilingan — API ulanganda faqat shu qatlam almashtiriladi.

---

## Ishga tushirish

Talab: Node.js 20 yoki undan yuqori.

```bash
npm install
npm run dev
```

Ilova `http://localhost:4310` da ochiladi.

```bash
npm run build      # ishlab chiqarish uchun yig‘ish
npm run generate   # statik hosting uchun yig‘ish
npm run preview    # yig‘ilgan versiyani ko‘rish
npm run check      # barcha komponentlarni kompilyator orqali tekshirish
npm run typecheck  # tiplarni tekshirish
```

---

## Arxitektura

| Qatlam | Yechim | Izoh |
|---|---|---|
| Karkas | Nuxt 4, Vue 3 `<script setup>`, TypeScript strict | Fayl asosidagi marshrutlash |
| Uslublar | Tailwind CSS v4 | Dizayn tokenlari `app/assets/css/main.css` da |
| Holat | Pinia + persisted state | Sessiya va ijara sikli |
| Xalqarolashtirish | `@nuxtjs/i18n` | O‘zbek va rus tillari |
| Xarita | Ichki raster plitkalar | Tashqi so‘rovsiz |
| 3D va grafiklar | Ichki SVG komponentlar | Tashqi kutubxonasiz |

Tashqi CDN, tashqi shrift va tashqi rasm ishlatilmaydi. Shriftlar, xarita
plitkalari va fotosuratlar repozitoriyda saqlanadi — ilova tarmoqsiz muhitda
ham to‘liq ishlaydi.

### Katalog tuzilishi

```
app/
  components/
    layout/        sidebar, header, logo, til tanlash
    ui/            umumiy komponentlar kutubxonasi
  composables/     qayta ishlatiladigan mantiq
  constants/       rollar, navigatsiya, status registrlari
  data/            obyektlar, unitlar, shartnomalar, billing, operatsiyalar
  layouts/         ilova, ommaviy va autentifikatsiya karkaslari
  middleware/      autentifikatsiya va rol tekshiruvi
  pages/           ekranlar
  stores/          sessiya va ijara sikli holati
  types/           RBAC tiplari
  utils/           formatlash yordamchilari
public/
  img/             obyekt fotosuratlari (webp, uch o‘lchamda)
  map/             xarita plitkalari
  fonts/           shriftlar
  data/            valyuta kursi
scripts/
  check-sfc.mjs    komponentlarni kompilyator orqali tekshiruvchi skript
```

---

## Rollar va huquqlar

Tizimda 7 rol. Har biri o‘z modullarini va o‘z ma’lumot doirasini ko‘radi.

| Rol | Ko‘rish doirasi | Bosh sahifa |
|---|---|---|
| `SUPER_HEAD` | Barcha obyektlar, tizim sozlamalari | `/dashboard/executive` |
| `BUILDING_MANAGER` | Biriktirilgan bino(lar) | `/dashboard/building` |
| `ACCOUNTANT` | Moliyaviy kontur | `/billing/invoices` |
| `FACILITY` | Biriktirilgan ish topshiriqlari | `/facility/work-orders` |
| `WAREHOUSE_OPERATOR` | Biriktirilgan ombor | `/warehouse` |
| `CONTENT_OPERATOR` | Biriktirilgan bino va qavatlar | `/content` |
| `TENANT_OWNER` | Faqat o‘z tashkiloti | `/cabinet` |

Kirish ikki qatlamda tekshiriladi:

- **Marshrut** — `ROUTE_ACCESS` (`app/constants/navigation.ts`)
- **Amal** — `ROLE_CAPABILITIES` (`app/constants/roles.ts`)

Sahifani ko‘rish huquqi undagi qarorni qabul qilish huquqini bildirmaydi.
Masalan super rahbar arizani ko‘radi, lekin uni tasdiqlamaydi — bu vakolat
operatsion rollarda.

---

## Autentifikatsiya

**Xodimlar** — `/login`, login va parol. Hisoblarni super rahbar yaratadi,
rol hisobga biriktirilgan.

**Ijarachilar** — uch qadamli o‘z-o‘zidan ro‘yxatdan o‘tish:

1. `/register` — telefon raqami, bir martalik kod yuboriladi
2. `/auth/verify` — 6 xonali kodni tasdiqlash
3. `/auth/register` — akkaunt turi, rekvizitlar, parol

Yakunda `TENANT_OWNER` roli bilan shaxsiy kabinet ochiladi.

Marshrut himoyasi: `app/middleware/auth.global.ts` (sessiya) va
`app/middleware/role.ts` (rol). `SUPER_HEAD` barcha tekshiruvlardan o‘tadi.

---

## Ijara sikli

Tizimning markaziy jarayoni. Holat `app/stores/lease.ts` da saqlanadi, shuning
uchun ijarachi, operator va buxgalter bir xil ma’lumotni ko‘radi.

```
YANGI  →  OPERATSIYA_TASDIQLADI  →  MOLIYA_TASDIQLADI  →  QORALAMA_TAYYOR
       →  DIDOX_YUBORILDI       →  DIDOX_IMZOLANDI    →  FAOL
```

1. Ijarachi katalogdan bo‘sh unitni topadi va ariza yuboradi
2. Operator bog‘lanib shartlarni kelishadi, kommersiya taklifini tuzadi va tasdiqlaydi
3. Buxgalter moliyaviy shartlarni va to‘lov grafigini tekshiradi
4. Tizim shartnoma qoralamasini avtomatik shakllantiradi
5. Hujjat Didox orqali imzolashga yuboriladi — imzolash tashqi tomonda bajariladi
6. Imzolangan hujjat yuklanadi, nazorat yig‘indisi hisoblanadi
7. Shartnoma faollashadi: unit band bo‘ladi, e’lon yopiladi, bino statistikasi
   qayta hisoblanadi, ijarachi kabineti va billing grafigi ishga tushadi

Har bir o‘tish audit yozuvini qoldiradi.

---

## Ma’lumot manbalari

- Xarita plitkalari — © OpenStreetMap hissadorlari, © CARTO
- Valyuta kursi — O‘zbekiston Respublikasi Markaziy banki
- Ob-havo — joriy ko‘rsatkich, tarmoqsiz holatda mavsumiy o‘rtacha qiymat

---

## Sifat nazorati

```bash
npm run check      # 85+ komponent kompilyatsiyasi
npm run typecheck  # TypeScript strict
```

`scripts/check-sfc.mjs` har bir komponentni Vue kompilyatori orqali o‘tkazadi
va kompilyatsiyadan keyin qolib ketgan makro chaqiruvlarini ham aniqlaydi —
bunday xato ish vaqtida butun ilovani to‘xtatib qo‘yishi mumkin.

---

## Deploy

`main` tarmog‘iga push qilinganda GitHub Actions statik versiyani yig‘ib
GitHub Pages’ga chiqaradi (`.github/workflows/deploy.yml`).

Repozitoriya sozlamalarida **Settings → Pages → Source: GitHub Actions**
tanlangan bo‘lishi kerak.

---

## Litsenziya

Mualliflik huquqi buyurtmachiga tegishli. Barcha huquqlar himoyalangan.
