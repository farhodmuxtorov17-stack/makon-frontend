/**
 * Header ko‘rsatkichlari: valyuta kursi va ob-havo.
 *
 * Ma’lumot avval loyihadagi snapshot’dan o‘qiladi, shu sababli tarmoqsiz
 * muhitda ham header to‘liq ishlaydi. So‘ng jonli manbadan yangilashga
 * urinib ko‘riladi; muvaffaqiyatsiz bo‘lsa snapshot ko‘rsatilaveradi.
 */

export interface RateInfo {
  code: string
  label: string
  rate: number
  diff: number
  date: string
}

export interface WeatherInfo {
  tempC: number
  code: number
  label: string
  icon: string
  city: string
}

/** Open-Meteo ob-havo kodlari, o‘zbekcha izoh va ikonka */
const WEATHER_CODES: Record<number, { label: string; icon: string }> = {
  0: { label: 'Ochiq', icon: 'sun' },
  1: { label: 'Asosan ochiq', icon: 'sun' },
  2: { label: 'Bulutli ochiq', icon: 'cloudSun' },
  3: { label: 'Bulutli', icon: 'cloud' },
  45: { label: 'Tuman', icon: 'fog' },
  48: { label: 'Qirovli tuman', icon: 'fog' },
  51: { label: 'Yengil shivalama', icon: 'drizzle' },
  53: { label: 'Shivalama', icon: 'drizzle' },
  55: { label: 'Kuchli shivalama', icon: 'drizzle' },
  61: { label: 'Yengil yomg‘ir', icon: 'rain' },
  63: { label: 'Yomg‘ir', icon: 'rain' },
  65: { label: 'Kuchli yomg‘ir', icon: 'rain' },
  71: { label: 'Yengil qor', icon: 'snow' },
  73: { label: 'Qor', icon: 'snow' },
  75: { label: 'Kuchli qor', icon: 'snow' },
  80: { label: 'Jala', icon: 'rain' },
  95: { label: 'Momaqaldiroq', icon: 'storm' },
}

/** Toshkent uchun avgust oyi o‘rtacha ko‘rsatkichi, tarmoqsiz holat uchun */
const WEATHER_FALLBACK: WeatherInfo = {
  tempC: 31,
  code: 0,
  label: 'Ochiq',
  icon: 'sun',
  city: 'Toshkent',
}

export function useHeaderData() {
  const rates = useState<RateInfo[]>('header-rates', () => [])
  const weather = useState<WeatherInfo>('header-weather', () => ({ ...WEATHER_FALLBACK }))

  const usd = computed(() => rates.value.find((r) => r.code === 'USD') ?? null)

  async function loadRates() {
    try {
      const local = await $fetch<Array<Record<string, string>>>(assetUrl('data/cbu.json'))
      rates.value = local.map((r) => ({
        code: r.Ccy!,
        label: r.CcyNm_UZ!,
        rate: Number(r.Rate),
        diff: Number(r.Diff),
        date: r.Date!,
      }))
    } catch {
      // snapshot topilmadi: header kursni ko‘rsatmaydi
    }

    // Jonli manbadan yangilashga urinish; xatolik jimgina e’tiborsiz qoldiriladi
    try {
      const live = await $fetch<Array<Record<string, string>>>(
        'https://cbu.uz/uz/arkhiv-kursov-valyut/json/',
        { timeout: 4000 },
      )
      const wanted = ['USD', 'EUR', 'RUB']
      const mapped = live
        .filter((r) => wanted.includes(r.Ccy!))
        .map((r) => ({
          code: r.Ccy!,
          label: r.CcyNm_UZ!,
          rate: Number(r.Rate),
          diff: Number(r.Diff),
          date: r.Date!,
        }))
      if (mapped.length) rates.value = mapped
    } catch {
      // tarmoq yo‘q: snapshot qoladi
    }
  }

  async function loadWeather() {
    try {
      const res = await $fetch<{
        current: { temperature_2m: number; weather_code: number }
      }>('https://api.open-meteo.com/v1/forecast', {
        params: {
          latitude: 41.3111,
          longitude: 69.2797,
          current: 'temperature_2m,weather_code',
          timezone: 'Asia/Tashkent',
        },
        timeout: 4000,
      })
      const meta = WEATHER_CODES[res.current.weather_code] ?? WEATHER_CODES[0]!
      weather.value = {
        tempC: Math.round(res.current.temperature_2m),
        code: res.current.weather_code,
        label: meta.label,
        icon: meta.icon,
        city: 'Toshkent',
      }
    } catch {
      // tarmoq yo‘q: mavsumiy o‘rtacha ko‘rsatiladi
    }
  }

  function load() {
    if (!import.meta.client) return
    loadRates()
    loadWeather()
  }

  return { rates, usd, weather, load }
}
