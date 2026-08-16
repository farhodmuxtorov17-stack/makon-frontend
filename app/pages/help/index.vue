<script setup lang="ts">
import { dateShort } from '~/utils/format'

const auth = useAuthStore()

const roleCards = [
  {
    value: 'Ijarachi',
    caption: 'Shartnoma, to‘lov va to‘lov holati',
    icon: 'user',
    tone: 'bg-brand-50 text-brand-600',
  },
  {
    value: 'Buxgalter',
    caption: 'Hisobotlar, hisob-faktura va to‘lovlar',
    icon: 'wallet',
    tone: 'bg-ok-50 text-ok-600',
  },
  {
    value: 'Bino rahbari',
    caption: 'Bino boshqaruvi va xizmatlar',
    icon: 'building',
    tone: 'bg-info-50 text-info-600',
  },
  {
    value: 'Pudratchi',
    caption: 'Xizmat ko‘rsatish va buyurtmalar',
    icon: 'wrench',
    tone: 'bg-warn-50 text-warn-600',
  },
]

const FAQ = [
  {
    id: 'f-01',
    role: 'Ijarachi',
    question: 'To‘lovni qanday amalga oshirish mumkin?',
    answer:
      '«To‘lovlarim» bo‘limida joriy hisob-fakturani oching va rekvizitlar bo‘yicha bank o‘tkazmasini amalga oshiring. To‘lov tasdiqlangach hisob-faktura holati avtomatik «To‘langan» ga o‘zgaradi.',
  },
  {
    id: 'f-02',
    role: 'Ijarachi',
    question: 'Hisob-fakturani qayerdan yuklab olish mumkin?',
    answer:
      'Hisob-faktura qatorini bosing va ochilgan oynadagi «PDF yuklab olish» tugmasini tanlang. Barcha hisob-fakturalar «Hujjatlarim» bo‘limida ham saqlanadi.',
  },
  {
    id: 'f-03',
    role: 'Ijarachi',
    question: 'Servis arizasini qanday yuborish kerak?',
    answer:
      'Bosh sahifadagi «Yangi ariza yaratish» tugmasini bosing, kategoriya va prioritetni tanlab muammoni tavsiflang. Ariza bino xizmatiga yuboriladi va holati kabinetda kuzatiladi.',
  },
  {
    id: 'f-04',
    role: 'Bino rahbari',
    question: 'Yangi ijarachi qo‘shish tartibi qanday?',
    answer:
      'Ariza tasdiqlangach shartnoma loyihasi shakllantiriladi, mas’ul rahbar tomonidan tizim ichida tasdiqlanadi va unit holati «Ijarada» ga o‘tadi. Har bir bosqich ariza kartochkasida qayd etiladi.',
  },
  {
    id: 'f-05',
    role: 'Bino rahbari',
    question: 'Obyekt uchun xizmatlar buyurtma qilish qanday ishlaydi?',
    answer:
      'Servis arizasi yaratiladi, mas’ul xodim biriktiriladi va material so‘rovi tasdiqlanadi. Ish yakunlangach ijarachi tasdiqlashi uchun ariza yuboriladi.',
  },
  {
    id: 'f-06',
    role: 'Buxgalter',
    question: 'Hisob-faktura qanday shakllantiriladi?',
    answer:
      'Shartnoma shartlari va hisoblagich ko‘rsatkichlari asosida davr yakunida hisob-faktura yaratiladi. Tariflar ma’lumotnomasi hisob-kitobga avtomatik qo‘llanadi.',
  },
  {
    id: 'f-07',
    role: 'Buxgalter',
    question: 'Qarzdorlik hisobotini qayerdan olish mumkin?',
    answer:
      '«Qarzdorlik tahlili» bo‘limida muddat bo‘yicha taqsimot va ijarachilar kesimidagi qoldiqlar ko‘rsatiladi. Hisobotni eksport qilish mumkin.',
  },
  {
    id: 'f-08',
    role: 'Pudratchi',
    question: 'Ish topshirig‘ini qanday yopish mumkin?',
    answer:
      'Tekshiruv ro‘yxatidagi barcha bandlar bajarilgach ish topshirig‘i «Bajarilgan» holatiga o‘tkaziladi va ijarachi tasdiqlashiga yuboriladi.',
  },
  {
    id: 'f-09',
    role: 'Pudratchi',
    question: 'Material so‘rovini kim tasdiqlaydi?',
    answer:
      'Material so‘rovi bino rahbari tomonidan ko‘rib chiqiladi, tasdiqlangach ombordan beriladi va ish topshirig‘iga biriktiriladi.',
  },
]

const MANUALS = [
  { id: 'm-01', role: 'Ijarachi', name: 'Ijarachi uchun qo‘llanma', size: '2.4 MB', at: '2025-04-20' },
  { id: 'm-02', role: 'Buxgalter', name: 'Buxgalter uchun qo‘llanma', size: '3.1 MB', at: '2025-04-20' },
  { id: 'm-03', role: 'Bino rahbari', name: 'Bino rahbari uchun qo‘llanma', size: '3.8 MB', at: '2025-04-20' },
  { id: 'm-04', role: 'Pudratchi', name: 'Pudratchi uchun qo‘llanma', size: '2.7 MB', at: '2025-04-20' },
  { id: 'm-05', role: 'Umumiy', name: 'Tizim bo‘yicha umumiy qo‘llanma', size: '4.2 MB', at: '2025-05-06' },
]

const roleFilter = ref('all')
const query = ref('')
const openFaq = ref('')
const searchNote = ref('')

const filteredFaq = computed(() =>
  FAQ.filter((f) => {
    const byRole = roleFilter.value === 'all' || f.role === roleFilter.value
    const q = query.value.trim().toLowerCase()
    const byQuery =
      !q || f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q)
    return byRole && byQuery
  }),
)

const filteredManuals = computed(() =>
  MANUALS.filter((m) => roleFilter.value === 'all' || m.role === roleFilter.value || m.role === 'Umumiy'),
)

function toggleRole(value: string) {
  roleFilter.value = roleFilter.value === value ? 'all' : value
  openFaq.value = ''
  searchNote.value = ''
}

function toggleFaq(id: string) {
  openFaq.value = openFaq.value === id ? '' : id
}

function runSearch() {
  const first = filteredFaq.value[0]
  if (first) {
    openFaq.value = first.id
    searchNote.value = `${filteredFaq.value.length} ta javob topildi`
  } else {
    openFaq.value = ''
    searchNote.value = 'So‘rov bo‘yicha javob topilmadi, murojaat yuborishingiz mumkin'
  }
}

const generalManual = MANUALS[4]!

const manualOpen = ref(false)
const manualReady = ref(false)
const selectedManual = ref<(typeof MANUALS)[number] | null>(null)

function openManual(m: (typeof MANUALS)[number]) {
  selectedManual.value = m
  manualReady.value = false
  manualOpen.value = true
}

type Ticket = {
  id: string
  code: string
  subject: string
  category: string
  priority: 'Past' | 'O‘rta' | 'Yuqori'
  status: string
  createdAt: string
  description: string
}

const tickets = ref<Ticket[]>([
  {
    id: 't-078',
    code: 'TK-2025-078',
    subject: 'To‘lov kvitansiyasini olishda xato',
    category: 'To‘lovlar',
    priority: 'O‘rta',
    status: 'IN_PROGRESS',
    createdAt: '2025-05-18 10:24',
    description:
      'To‘lov amalga oshirilgach kvitansiya yuklanmayapti, hisob-faktura holati yangilanmagan.',
  },
  {
    id: 't-077',
    code: 'TK-2025-077',
    subject: 'Hisob-faktura ro‘yxatda ko‘rinmayapti',
    category: 'Hisobotlar',
    priority: 'Yuqori',
    status: 'NEW',
    createdAt: '2025-05-18 09:41',
    description: 'May oyi uchun shakllantirilgan hisob-faktura ro‘yxatda aks etmayapti.',
  },
  {
    id: 't-076',
    code: 'TK-2025-076',
    subject: 'Ijara shartnomasiga o‘zgartirish kiritish',
    category: 'Shartnomalar',
    priority: 'O‘rta',
    status: 'IN_PROGRESS',
    createdAt: '2025-05-17 16:08',
    description: 'Shartnomaga qo‘shimcha maydon bo‘yicha ilova kiritish so‘ralmoqda.',
  },
  {
    id: 't-075',
    code: 'TK-2025-075',
    subject: 'Texnik xizmat buyurtmasi holati',
    category: 'Xizmatlar',
    priority: 'Past',
    status: 'TRIAGE',
    createdAt: '2025-05-16 11:02',
    description: 'Yuborilgan servis arizasi bo‘yicha mas’ul xodim biriktirilmagan.',
  },
  {
    id: 't-074',
    code: 'TK-2025-074',
    subject: 'Yangi foydalanuvchi qo‘shishda yordam',
    category: 'Foydalanuvchilar',
    priority: 'O‘rta',
    status: 'CLOSED',
    createdAt: '2025-05-15 14:33',
    description: 'Tashkilot xodimiga kabinetdan foydalanish huquqi berildi.',
  },
  {
    id: 't-073',
    code: 'TK-2025-073',
    subject: 'Hisoblagich ko‘rsatkichi noto‘g‘ri hisoblandi',
    category: 'Hisoblagichlar',
    priority: 'Yuqori',
    status: 'CLOSED',
    createdAt: '2025-05-14 09:15',
    description: 'Suv hisoblagichi bo‘yicha sarf qayta hisoblab chiqildi va tuzatildi.',
  },
  {
    id: 't-072',
    code: 'TK-2025-072',
    subject: 'Mobil qurilmadan kirishda muammo',
    category: 'Tizim',
    priority: 'Past',
    status: 'CLOSED',
    createdAt: '2025-05-13 17:50',
    description: 'Brauzer keshini tozalash orqali kirish tiklandi.',
  },
])

const ticketStatus = ref('all')

const ticketTabs = computed(() => [
  { value: 'all', label: 'Barchasi', count: tickets.value.length },
  { value: 'NEW', label: 'Yangi', count: tickets.value.filter((t) => t.status === 'NEW').length },
  {
    value: 'IN_PROGRESS',
    label: 'Jarayonda',
    count: tickets.value.filter((t) => t.status === 'IN_PROGRESS').length,
  },
  {
    value: 'TRIAGE',
    label: 'Ko‘rib chiqilmoqda',
    count: tickets.value.filter((t) => t.status === 'TRIAGE').length,
  },
  {
    value: 'CLOSED',
    label: 'Yopilgan',
    count: tickets.value.filter((t) => t.status === 'CLOSED').length,
  },
])

const filteredTickets = computed(() =>
  tickets.value.filter((t) => ticketStatus.value === 'all' || t.status === ticketStatus.value),
)

const ticketColumns = [
  { key: 'code', label: 'ID' },
  { key: 'subject', label: 'Mavzu' },
  { key: 'category', label: 'Kategoriya' },
  { key: 'priority', label: 'Prioritet' },
  { key: 'status', label: 'Holat' },
  { key: 'createdAt', label: 'Yaratilgan sana', align: 'right' as const },
]

const PRIORITY_CLASS: Record<string, string> = {
  Yuqori: 'bg-danger-50 text-danger-700',
  'O‘rta': 'bg-warn-50 text-warn-700',
  Past: 'bg-ink-100 text-ink-600',
}

const ticketOpen = ref(false)
const selectedTicket = ref<Ticket | null>(null)

function openTicket(row: Record<string, unknown>) {
  selectedTicket.value = tickets.value.find((t) => t.id === row.id) ?? null
  ticketOpen.value = true
}

const createOpen = ref(false)
const createdCode = ref('')

const ticketForm = reactive({
  subject: '',
  category: 'To‘lovlar',
  priority: 'O‘rta',
  description: '',
})
const ticketError = ref('')

const categoryOptions = [
  { value: 'To‘lovlar', label: 'To‘lovlar' },
  { value: 'Hisobotlar', label: 'Hisobotlar' },
  { value: 'Shartnomalar', label: 'Shartnomalar' },
  { value: 'Xizmatlar', label: 'Xizmatlar' },
  { value: 'Hisoblagichlar', label: 'Hisoblagichlar' },
  { value: 'Foydalanuvchilar', label: 'Foydalanuvchilar' },
  { value: 'Tizim', label: 'Tizim' },
]

const priorityOptions = [
  { value: 'Past', label: 'Past' },
  { value: 'O‘rta', label: 'O‘rta' },
  { value: 'Yuqori', label: 'Yuqori' },
]

function submitTicket() {
  if (ticketForm.subject.trim().length < 4) {
    ticketError.value = 'Murojaat mavzusini kamida 4 ta belgidan iborat qilib yozing'
    return
  }
  ticketError.value = ''
  const nextNumber = 79 + tickets.value.length - 7
  const code = `TK-2025-0${nextNumber}`
  tickets.value.unshift({
    id: `t-0${nextNumber}`,
    code,
    subject: ticketForm.subject.trim(),
    category: ticketForm.category,
    priority: ticketForm.priority as Ticket['priority'],
    status: 'NEW',
    createdAt: '2025-05-18 11:05',
    description: ticketForm.description.trim() || 'Qo‘shimcha izoh ko‘rsatilmagan.',
  })
  createdCode.value = code
  ticketForm.subject = ''
  ticketForm.description = ''
  createOpen.value = false
}

const onboarding = ref([
  { id: 'o-1', label: 'Hisobingizni sozlash', done: true },
  { id: 'o-2', label: 'Obyekt ma’lumotlarini tekshirish', done: true },
  { id: 'o-3', label: 'Ijara shartnomasini ko‘rib chiqish', done: false },
  { id: 'o-4', label: 'To‘lov shartlarini sozlash', done: false },
  { id: 'o-5', label: 'Hisobotlarni ko‘rish', done: false },
])

const onboardingProgress = computed(() =>
  Math.round((onboarding.value.filter((s) => s.done).length / onboarding.value.length) * 100),
)

function toggleStep(id: string) {
  const step = onboarding.value.find((s) => s.id === id)
  if (step) step.done = !step.done
}

const supportOpen = ref(false)
const supportChannel = ref<{ title: string; value: string; caption: string; icon: string } | null>(
  null,
)
const supportSent = ref(false)

const supportChannels = [
  {
    id: 'chat',
    title: 'Chat orqali yordam',
    value: 'Onlayn mutaxassis bilan suhbat',
    caption: 'Ish kunlari 09:00 – 18:00 oralig‘ida javob beriladi.',
    icon: 'send',
    tone: 'bg-ok-50 text-ok-600',
  },
  {
    id: 'call',
    title: 'Qo‘ng‘iroq qilish',
    value: '+998 78 150 00 00',
    caption: 'Qo‘llab-quvvatlash xizmati: har kuni 09:00 – 18:00.',
    icon: 'help',
    tone: 'bg-brand-50 text-brand-600',
  },
  {
    id: 'email',
    title: 'Email orqali murojaat',
    value: 'support@makon.uz',
    caption: 'Murojaatlar ish kuni davomida ko‘rib chiqiladi.',
    icon: 'doc',
    tone: 'bg-info-50 text-info-600',
  },
  {
    id: 'remote',
    title: 'Masofaviy yordam',
    value: 'So‘rov yuborish',
    caption: 'Mutaxassis ruxsatingiz bilan ekraningizga masofadan ulanadi.',
    icon: 'external',
    tone: 'bg-warn-50 text-warn-600',
  },
]

function openSupport(c: (typeof supportChannels)[number]) {
  supportChannel.value = c
  supportSent.value = false
  supportOpen.value = true
}

const statusOpen = ref(false)

const systemServices = [
  { label: 'Kabinet va veb interfeys', state: 'Ishlamoqda' },
  { label: 'Hisob-kitob va billing', state: 'Ishlamoqda' },
  { label: 'Hujjatlar arxivi', state: 'Ishlamoqda' },
  { label: 'Hisoblagichlar yig‘ish xizmati', state: 'Ishlamoqda' },
  { label: 'Bildirishnomalar xizmati', state: 'Ishlamoqda' },
]
</script>

<template>
  <AppTopbar
    title="Yordam markazi"
    subtitle="FAQ, qo‘llanmalar, murojaatlar va tezkor yordam"
  >
    <template #actions>
      <UiButton variant="secondary" size="sm" @click="statusOpen = true">
        <UiIcon name="shield" :size="16" />
        Tizim holati
      </UiButton>
      <UiButton size="sm" @click="createOpen = true">
        <UiIcon name="plus" :size="16" />
        Yangi murojaat
      </UiButton>
    </template>
  </AppTopbar>

  <main class="scroll-slim flex-1 space-y-5 overflow-y-auto p-6">
    <div
      v-if="createdCode"
      class="flex items-center gap-3 rounded-card bg-ok-50 px-5 py-3.5 ring-1 ring-ok-100"
    >
      <span class="grid size-9 shrink-0 place-items-center rounded-[10px] bg-ok-500 text-white">
        <UiIcon name="check" :size="18" />
      </span>
      <p class="min-w-0 flex-1 text-[13.5px] text-ok-700">
        <b>#{{ createdCode }}</b> raqamli murojaatingiz qabul qilindi. Javob kabinetdagi
        bildirishnomalar orqali yuboriladi.
      </p>
      <button
        type="button"
        class="rounded-lg p-1.5 text-ok-700 transition-colors hover:bg-ok-100"
        aria-label="Xabarni yopish"
        @click="createdCode = ''"
      >
        <UiIcon name="x" :size="16" />
      </button>
    </div>

    <section class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div class="min-w-0 space-y-5">
        <UiCard>
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div class="min-w-0">
              <h2 class="text-[19px] font-bold text-ink-900">Yordam markaziga xush kelibsiz</h2>
              <p class="mt-1 text-[13.5px] text-ink-500">
                Savolingiz bormi? Javobni qidiring yoki murojaat yuboring.
              </p>
            </div>
            <div class="flex w-full items-center gap-2.5 sm:w-auto">
              <UiInput
                v-model="query"
                placeholder="Yordam markazidan qidirish"
                class="w-full sm:w-72"
              >
                <template #prefix><UiIcon name="search" :size="16" /></template>
              </UiInput>
              <UiButton @click="runSearch">
                <UiIcon name="search" :size="16" />
                Qidirish
              </UiButton>
            </div>
          </div>

          <p v-if="searchNote" class="mt-3 text-[12.5px] font-medium text-brand-700">
            {{ searchNote }}
          </p>

          <div class="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <button
              v-for="r in roleCards"
              :key="r.value"
              type="button"
              class="rounded-field p-4 text-left ring-1 transition-all hover:shadow-card"
              :class="
                roleFilter === r.value ? 'ring-2 ring-brand-500' : 'ring-ink-200 hover:ring-brand-300'
              "
              @click="toggleRole(r.value)"
            >
              <span class="grid size-10 place-items-center rounded-[10px]" :class="r.tone">
                <UiIcon :name="r.icon" :size="19" />
              </span>
              <span class="mt-3 block text-[13.5px] font-bold text-ink-900">{{ r.value }}</span>
              <span class="mt-0.5 block text-[12px] leading-snug text-ink-500">{{ r.caption }}</span>
            </button>
          </div>

          <div v-if="roleFilter !== 'all'" class="mt-3 flex items-center gap-2">
            <span class="text-[12.5px] text-ink-500">Faol saralash:</span>
            <button
              type="button"
              class="inline-flex items-center gap-1.5 rounded-pill bg-brand-50 px-2.5 py-1 text-[12px] font-semibold text-brand-700 transition-colors hover:bg-brand-100"
              @click="roleFilter = 'all'"
            >
              {{ roleFilter }}
              <UiIcon name="x" :size="12" />
            </button>
          </div>
        </UiCard>

        <div class="grid gap-5 lg:grid-cols-2">
          <UiCard title="Tezkor javoblar (FAQ)" :subtitle="`${filteredFaq.length} ta savol`" flush>
            <ul class="divide-y divide-ink-100">
              <li v-for="f in filteredFaq" :key="f.id">
                <button
                  type="button"
                  class="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-brand-50/40"
                  :aria-expanded="openFaq === f.id"
                  @click="toggleFaq(f.id)"
                >
                  <UiIcon
                    name="chevronRight"
                    :size="16"
                    class="shrink-0 text-ink-400 transition-transform"
                    :class="openFaq === f.id ? 'rotate-90 text-brand-600' : ''"
                  />
                  <span
                    class="min-w-0 flex-1 text-[13.5px]"
                    :class="openFaq === f.id ? 'font-bold text-brand-700' : 'font-medium text-ink-800'"
                  >
                    {{ f.question }}
                  </span>
                  <span class="shrink-0 rounded-pill bg-ink-100 px-2 py-0.5 text-[11px] font-semibold text-ink-600">
                    {{ f.role }}
                  </span>
                </button>
                <p
                  v-if="openFaq === f.id"
                  class="px-5 pb-4 pl-14 text-[13px] leading-relaxed text-ink-600"
                >
                  {{ f.answer }}
                </p>
              </li>
              <li v-if="!filteredFaq.length" class="px-5 py-12 text-center text-[13px] text-ink-500">
                So‘rov bo‘yicha javob topilmadi
              </li>
            </ul>
          </UiCard>

          <UiCard title="Foydalanuvchi qo‘llanmalari" subtitle="PDF hujjatlar" flush>
            <ul class="divide-y divide-ink-100">
              <li v-for="m in filteredManuals" :key="m.id" class="flex items-center gap-3.5 px-5 py-3.5">
                <span class="grid size-10 shrink-0 place-items-center rounded-[10px] bg-danger-50 text-danger-600">
                  <UiIcon name="doc" :size="18" />
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-[13.5px] font-semibold text-ink-900">{{ m.name }}</span>
                  <span class="block truncate text-[12px] text-ink-500">
                    PDF · {{ m.size }} · {{ dateShort(m.at) }}
                  </span>
                </span>
                <button
                  type="button"
                  class="grid size-9 shrink-0 place-items-center rounded-field text-brand-600 transition-colors hover:bg-brand-50"
                  :aria-label="`${m.name}: yuklab olish`"
                  @click="openManual(m)"
                >
                  <UiIcon name="download" :size="18" />
                </button>
              </li>
            </ul>
          </UiCard>
        </div>

        <UiCard title="Mening murojaatlarim" subtitle="Yuborilgan so‘rovlar va ularning holati" flush>
          <template #actions>
            <UiButton size="sm" @click="createOpen = true">
              <UiIcon name="plus" :size="15" />
              Yangi murojaat yaratish
            </UiButton>
          </template>

          <div class="px-5 pb-4">
            <UiTabs v-model="ticketStatus" :tabs="ticketTabs" variant="line" />
          </div>

          <UiTable
            :columns="ticketColumns"
            :rows="filteredTickets"
            empty="Tanlangan holat bo‘yicha murojaat topilmadi"
            @row-click="openTicket"
          >
            <template #cell-code="{ value }">
              <span class="tabular text-[13px] font-semibold text-ink-900">#{{ value }}</span>
            </template>
            <template #cell-subject="{ value }">
              <span class="text-[13.5px] text-ink-800">{{ value }}</span>
            </template>
            <template #cell-priority="{ value }">
              <span
                class="rounded-pill px-2.5 py-1 text-[11.5px] font-semibold"
                :class="PRIORITY_CLASS[String(value)]"
              >
                {{ value }}
              </span>
            </template>
            <template #cell-status="{ row }">
              <UiStatus kind="service" :value="String(row.status)" size="sm" />
            </template>
            <template #cell-createdAt="{ value }">
              <span class="tabular text-[13px]">{{ value }}</span>
            </template>
          </UiTable>
        </UiCard>
      </div>

      <div class="min-w-0 space-y-5">
        <UiCard title="Boshlash uchun qo‘llanma" subtitle="Bosqichlarni belgilab boring">
          <div class="flex items-center gap-3">
            <div class="h-2 flex-1 overflow-hidden rounded-pill bg-ink-100">
              <div
                class="h-full rounded-pill bg-brand-500 transition-all"
                :style="{ width: `${onboardingProgress}%` }"
              />
            </div>
            <span class="tabular text-[13px] font-bold text-ink-900">{{ onboardingProgress }}%</span>
          </div>

          <ul class="mt-4 space-y-1.5">
            <li v-for="(s, i) in onboarding" :key="s.id">
              <button
                type="button"
                class="flex w-full items-center gap-3 rounded-field px-3 py-2.5 text-left transition-colors hover:bg-ink-100"
                :aria-pressed="s.done"
                @click="toggleStep(s.id)"
              >
                <span
                  class="grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold"
                  :class="s.done ? 'bg-ok-500 text-white' : 'bg-ink-100 text-ink-500'"
                >
                  <UiIcon v-if="s.done" name="check" :size="13" />
                  <template v-else>{{ i + 1 }}</template>
                </span>
                <span
                  class="min-w-0 flex-1 truncate text-[13px]"
                  :class="s.done ? 'font-medium text-ink-500 line-through' : 'font-semibold text-ink-800'"
                >
                  {{ s.label }}
                </span>
              </button>
            </li>
          </ul>

          <UiButton
            variant="secondary"
            size="sm"
            class="mt-4"
            block
            @click="openManual(generalManual)"
          >
            Qo‘llanmani davom ettirish
            <UiIcon name="chevronRight" :size="15" />
          </UiButton>
        </UiCard>

        <UiCard title="Tezkor yordam" subtitle="Bog‘lanish kanallari" flush>
          <div class="space-y-2.5 px-5 pb-5">
            <button
              v-for="c in supportChannels"
              :key="c.id"
              type="button"
              class="flex w-full items-center gap-3.5 rounded-field p-3.5 text-left ring-1 ring-ink-200 transition-all hover:shadow-card hover:ring-brand-300"
              @click="openSupport(c)"
            >
              <span class="grid size-10 shrink-0 place-items-center rounded-[10px]" :class="c.tone">
                <UiIcon :name="c.icon" :size="18" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-[13.5px] font-semibold text-ink-900">{{ c.title }}</span>
                <span class="tabular block truncate text-[12.5px] text-brand-600">{{ c.value }}</span>
              </span>
              <UiIcon name="chevronRight" :size="16" class="shrink-0 text-ink-400" />
            </button>
          </div>
        </UiCard>

        <UiCard title="Tizim holati" subtitle="Xizmatlar barqarorligi">
          <div class="flex items-center gap-3 rounded-field bg-ok-50 px-4 py-3">
            <span class="grid size-9 shrink-0 place-items-center rounded-[10px] bg-ok-500 text-white">
              <UiIcon name="check" :size="18" />
            </span>
            <p class="min-w-0 flex-1 text-[13px] font-semibold text-ok-700">
              Barchasi ishlamoqda
              <span class="block font-normal text-ok-600">
                Barcha xizmatlar faol va barqaror ishlayapti
              </span>
            </p>
          </div>

          <div class="mt-3 flex items-center justify-between">
            <p class="text-[12.5px] text-ink-500">Oxirgi yangilanish: bugun, 10:30</p>
            <UiButton variant="ghost" size="sm" @click="statusOpen = true">Batafsil</UiButton>
          </div>
        </UiCard>
      </div>
    </section>
  </main>

  <UiModal
    v-model="manualOpen"
    title="Qo‘llanmani yuklab olish"
    :subtitle="selectedManual?.name ?? ''"
    size="sm"
  >
    <div v-if="selectedManual" class="space-y-4">
      <div class="flex items-center gap-3.5 rounded-field bg-surface-sunken p-4 ring-1 ring-ink-200">
        <span class="grid size-12 shrink-0 place-items-center rounded-field bg-danger-50 text-danger-600">
          <UiIcon name="doc" :size="24" />
        </span>
        <span class="min-w-0">
          <span class="block truncate text-[13.5px] font-semibold text-ink-900">
            {{ selectedManual.name }}.pdf
          </span>
          <span class="block text-[12px] text-ink-500">
            PDF · {{ selectedManual.size }} · {{ dateShort(selectedManual.at) }}
          </span>
        </span>
      </div>

      <p v-if="!manualReady" class="text-[13px] text-ink-600">
        Qo‘llanma nusxasi tayyorlanadi va brauzeringiz orqali saqlanadi.
      </p>
      <p v-else class="flex items-center gap-2 text-[13px] font-semibold text-ok-700">
        <UiIcon name="check" :size="16" />
        Qo‘llanma yuklab olishga tayyor.
      </p>
    </div>

    <template #footer>
      <UiButton variant="ghost" @click="manualOpen = false">Yopish</UiButton>
      <UiButton :disabled="manualReady" @click="manualReady = true">
        <UiIcon name="download" :size="16" />
        Yuklab olish
      </UiButton>
    </template>
  </UiModal>

  <UiModal
    v-model="ticketOpen"
    :title="selectedTicket ? `#${selectedTicket.code}` : 'Murojaat'"
    :subtitle="selectedTicket?.subject ?? ''"
  >
    <div v-if="selectedTicket" class="space-y-4">
      <div class="flex flex-wrap items-center gap-2.5">
        <UiStatus kind="service" :value="selectedTicket.status" />
        <span class="rounded-pill bg-ink-100 px-2.5 py-1 text-[12px] font-semibold text-ink-700">
          {{ selectedTicket.category }}
        </span>
        <span
          class="rounded-pill px-2.5 py-1 text-[12px] font-semibold"
          :class="PRIORITY_CLASS[selectedTicket.priority]"
        >
          Prioritet: {{ selectedTicket.priority }}
        </span>
      </div>

      <p class="text-[13.5px] leading-relaxed text-ink-700">{{ selectedTicket.description }}</p>

      <dl class="divide-y divide-ink-100 rounded-field ring-1 ring-ink-200">
        <div class="flex items-center justify-between px-4 py-2.5">
          <dt class="text-[12.5px] text-ink-500">Murojaat raqami</dt>
          <dd class="tabular text-[13px] font-semibold text-ink-900">#{{ selectedTicket.code }}</dd>
        </div>
        <div class="flex items-center justify-between px-4 py-2.5">
          <dt class="text-[12.5px] text-ink-500">Yaratilgan sana</dt>
          <dd class="tabular text-[13px] font-semibold text-ink-900">{{ selectedTicket.createdAt }}</dd>
        </div>
        <div class="flex items-center justify-between px-4 py-2.5">
          <dt class="text-[12.5px] text-ink-500">Murojaat egasi</dt>
          <dd class="text-[13px] font-semibold text-ink-900">
            {{ auth.user?.fullName ?? 'Dilshod Ergashev' }}
          </dd>
        </div>
      </dl>
    </div>

    <template #footer>
      <UiButton variant="ghost" @click="ticketOpen = false">Yopish</UiButton>
      <UiButton
        variant="secondary"
        @click="
          () => {
            ticketOpen = false
            createOpen = true
          }
        "
      >
        <UiIcon name="plus" :size="16" />
        Yangi murojaat
      </UiButton>
    </template>
  </UiModal>

  <UiModal v-model="createOpen" title="Yangi murojaat" subtitle="So‘rovingizni qo‘llab-quvvatlash xizmatiga yuboring">
    <div class="space-y-4">
      <UiField label="Mavzu" required :error="ticketError">
        <UiInput
          v-model="ticketForm.subject"
          placeholder="Masalan: hisob-faktura ko‘rinmayapti"
          :invalid="!!ticketError"
        />
      </UiField>

      <div class="grid gap-4 sm:grid-cols-2">
        <UiField label="Kategoriya" required>
          <UiSelect v-model="ticketForm.category" :options="categoryOptions" />
        </UiField>
        <UiField label="Prioritet" required>
          <UiSelect v-model="ticketForm.priority" :options="priorityOptions" />
        </UiField>
      </div>

      <UiField label="Tavsif" hint="Muammoni imkon qadar aniq yozing">
        <textarea
          v-model="ticketForm.description"
          rows="4"
          placeholder="Qo‘shimcha ma’lumot"
          class="w-full rounded-field bg-white px-3.5 py-2.5 text-sm text-ink-800 ring-1 ring-inset ring-ink-200 transition-colors placeholder:text-ink-400 hover:ring-ink-300 focus:ring-2 focus:ring-brand-500"
        />
      </UiField>
    </div>

    <template #footer>
      <UiButton variant="ghost" @click="createOpen = false">Bekor qilish</UiButton>
      <UiButton @click="submitTicket">
        <UiIcon name="send" :size="16" />
        Murojaatni yuborish
      </UiButton>
    </template>
  </UiModal>

  <UiModal
    v-model="supportOpen"
    :title="supportChannel?.title ?? 'Tezkor yordam'"
    :subtitle="supportChannel?.value ?? ''"
    size="sm"
  >
    <div v-if="supportChannel" class="space-y-4">
      <div class="rounded-field bg-surface-sunken p-4 ring-1 ring-ink-200">
        <p class="tabular text-[17px] font-bold text-ink-900">{{ supportChannel.value }}</p>
        <p class="mt-1 text-[12.5px] text-ink-500">{{ supportChannel.caption }}</p>
      </div>

      <p v-if="supportSent" class="flex items-center gap-2 text-[13px] font-semibold text-ok-700">
        <UiIcon name="check" :size="16" />
        So‘rovingiz qabul qilindi, mutaxassis siz bilan bog‘lanadi.
      </p>
    </div>

    <template #footer>
      <UiButton variant="ghost" @click="supportOpen = false">Yopish</UiButton>
      <UiButton :disabled="supportSent" @click="supportSent = true">
        <UiIcon name="send" :size="16" />
        Bog‘lanishni so‘rash
      </UiButton>
    </template>
  </UiModal>

  <UiModal v-model="statusOpen" title="Tizim holati" subtitle="Xizmatlar bo‘yicha batafsil ma’lumot">
    <ul class="divide-y divide-ink-100 rounded-field ring-1 ring-ink-200">
      <li v-for="s in systemServices" :key="s.label" class="flex items-center justify-between px-4 py-3">
        <span class="text-[13px] font-medium text-ink-800">{{ s.label }}</span>
        <span
          class="inline-flex items-center gap-1.5 rounded-pill bg-ok-50 px-2.5 py-1 text-[11.5px] font-semibold text-ok-700 ring-1 ring-inset ring-ok-100"
        >
          <UiIcon name="check" :size="12" />
          {{ s.state }}
        </span>
      </li>
    </ul>

    <p class="mt-4 text-[12.5px] text-ink-500">Oxirgi yangilanish: bugun, 10:30</p>

    <template #footer>
      <UiButton variant="ghost" @click="statusOpen = false">Yopish</UiButton>
    </template>
  </UiModal>
</template>
