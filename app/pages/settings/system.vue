<script setup lang="ts">
const SETTINGS_TABS = [
  { label: 'Foydalanuvchilar', to: '/settings/users', icon: 'users' },
  { label: 'Rollar va huquqlar', to: '/settings/roles', icon: 'shield' },
  { label: 'Integratsiyalar', to: '/settings/integrations', icon: 'globe' },
  { label: 'Ma’lumotnomalar', to: '/settings/reference-data', icon: 'layers' },
  { label: 'Tizim sozlamalari', to: '/settings/system', icon: 'gear' },
  { label: 'Audit jurnali', to: '/settings/audit', icon: 'clipboard' },
]
const CURRENT_TAB = '/settings/system'

const RESTORE_PHRASE = 'TIKLASH'

const settings = reactive({
  company: {
    name: 'MAKON Solutions MCHJ',
    tin: '309 876 543',
    address: 'Toshkent, Mirzo Ulug‘bek tumani, Amir Temur ko‘chasi 88',
    phone: '+998 78 120 00 00',
    email: 'info@makon.uz',
  },
  access: {
    twoFactor: true,
    ipRestrict: true,
    lockout: true,
    autoLogout: true,
  },
  password: {
    minLength: 12,
    expiryDays: 90,
    historyCount: 5,
    lockoutAttempts: 5,
    sessionMinutes: 15,
  },
  backup: {
    frequency: 'daily',
    retentionDays: 30,
    storage: 'cloud-uz-1',
  },
  prefs: {
    inApp: true,
    digest: true,
    weeklyReport: false,
    language: 'uz',
    timezone: 'Asia/Tashkent',
  },
})

const dirty = ref(false)
const savedAt = ref('Bugun 09:15')
const lastBackup = ref('Bugun 02:15')

watch(settings, () => (dirty.value = true), { deep: true })

const frequencyOptions = [
  { value: 'daily', label: 'Har kuni' },
  { value: 'h12', label: 'Har 12 soatda' },
  { value: 'weekly', label: 'Har hafta' },
]

const storageOptions = [
  { value: 'cloud-uz-1', label: 'Bulut (uz-west-1)' },
  { value: 'local', label: 'Ichki server' },
  { value: 'both', label: 'Bulut + ichki server' },
]

const languageOptions = [
  { value: 'uz', label: 'O‘zbekcha' },
  { value: 'ru', label: 'Русский' },
]

const timezoneOptions = [
  { value: 'Asia/Tashkent', label: 'Asia/Tashkent (UTC+5)' },
  { value: 'Asia/Almaty', label: 'Asia/Almaty (UTC+6)' },
]

const audit = ref([
  { id: 'ev-1', who: 'Jahongir Alimov', text: 'Tizim sozlamalari ochildi', when: 'Bugun 09:15', tone: 'brand' },
  { id: 'ev-2', who: 'Tizim', text: 'Bildirishnoma kanali sinxronizatsiyasi bajarildi', when: 'Bugun 09:02', tone: 'ok' },
  { id: 'ev-3', who: 'Xavfsizlik', text: 'Yangi kirish: Chrome / Windows', when: 'Bugun 08:47', tone: 'warn' },
  { id: 'ev-4', who: 'Sevara Yusupova', text: 'Foydalanuvchi huquqlari yangilandi', when: 'Bugun 08:31', tone: 'brand' },
])

function pushAudit(text: string, tone: string, who = 'Jahongir Alimov') {
  audit.value.unshift({ id: `ev-${audit.value.length + 5}`, who, text, when: 'Hozirgina', tone })
  if (audit.value.length > 8) audit.value.pop()
}

const companyOpen = ref(false)
const companyDraft = reactive({ name: '', tin: '', address: '', phone: '', email: '' })

function openCompany() {
  Object.assign(companyDraft, settings.company)
  companyOpen.value = true
}

function saveCompany() {
  Object.assign(settings.company, {
    name: companyDraft.name.trim(),
    tin: companyDraft.tin.trim(),
    address: companyDraft.address.trim(),
    phone: companyDraft.phone.trim(),
    email: companyDraft.email.trim(),
  })
  pushAudit('Kompaniya profili yangilandi', 'brand')
  companyOpen.value = false
}

const accessRows = computed(() => [
  {
    key: 'twoFactor',
    label: 'Ikki bosqichli autentifikatsiya',
    caption: 'Kirishda qo‘shimcha tasdiqlash kodi so‘raladi',
    icon: 'shield',
    value: settings.access.twoFactor,
  },
  {
    key: 'ipRestrict',
    label: 'IP manzil bo‘yicha cheklash',
    caption: 'Ruxsat etilgan tarmoqlar: 10.0.0.0/8, 172.16.0.0/12',
    icon: 'globe',
    value: settings.access.ipRestrict,
  },
  {
    key: 'lockout',
    label: 'Noto‘g‘ri urinishda bloklash',
    caption: `${settings.password.lockoutAttempts} ta noto‘g‘ri urinishdan keyin hisob bloklanadi`,
    icon: 'lock',
    value: settings.access.lockout,
  },
  {
    key: 'autoLogout',
    label: 'Faoliyatsizlikda seansni yopish',
    caption: `${settings.password.sessionMinutes} daqiqadan keyin avtomatik chiqish`,
    icon: 'clock',
    value: settings.access.autoLogout,
  },
])

function toggleAccess(key: string) {
  const target = settings.access as Record<string, boolean>
  target[key] = !target[key]
}

const backupOpen = ref(false)
const restoreOpen = ref(false)
const restorePhrase = ref('')

const restoreReady = computed(() => restorePhrase.value.trim() === RESTORE_PHRASE)

function openRestore() {
  restorePhrase.value = ''
  restoreOpen.value = true
}

function confirmBackup() {
  lastBackup.value = 'Hozirgina'
  pushAudit('Zaxira nusxa yaratildi', 'ok')
  backupOpen.value = false
}

function confirmRestore() {
  if (!restoreReady.value) return
  pushAudit('Zaxiradan tiklash jarayoni ishga tushirildi', 'warn')
  restoreOpen.value = false
}

const sessions = ref([
  { id: 's-1', device: 'Chrome • Windows 11', place: 'Toshkent, O‘zbekiston', when: 'Hozir', current: true },
  { id: 's-2', device: 'Safari • macOS', place: 'Toshkent, O‘zbekiston', when: '10 daqiqa oldin', current: false },
  { id: 's-3', device: 'Mobil ilova • iOS', place: 'Samarqand, O‘zbekiston', when: '35 daqiqa oldin', current: false },
  { id: 's-4', device: 'Chrome • Android', place: 'Buxoro, O‘zbekiston', when: '1 soat oldin', current: false },
])

const closeAllOpen = ref(false)

function endSession(id: string) {
  const s = sessions.value.find((x) => x.id === id)
  if (!s || s.current) return
  sessions.value = sessions.value.filter((x) => x.id !== id)
  pushAudit(`Seans tugatildi: ${s.device}`, 'warn')
}

function confirmCloseAll() {
  const removed = sessions.value.filter((s) => !s.current).length
  sessions.value = sessions.value.filter((s) => s.current)
  pushAudit(`${removed} ta seans majburan tugatildi`, 'danger')
  closeAllOpen.value = false
}

const saveOpen = ref(false)

function confirmSave() {
  dirty.value = false
  savedAt.value = 'Hozirgina'
  pushAudit('Tizim sozlamalari saqlandi', 'brand')
  saveOpen.value = false
}

const activityLabels = ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', '24:00']
const activitySeries = [
  {
    label: 'Tizimdagi faoliyat (so‘rovlar, ming)',
    tone: 'brand' as const,
    values: [1.2, 0.9, 4.8, 7.6, 6.9, 3.4, 1.6],
    fill: true,
  },
]

const SECURITY_METRICS = [
  { label: 'Faol tahdidlar', value: '0', caption: 'Ochiq hodisa yo‘q', icon: 'shield', tone: 'text-ok-600 bg-ok-50' },
  { label: 'Tizim himoyasi', value: '98%', caption: 'Siyosatlar bajarilishi', icon: 'lock', tone: 'text-brand-600 bg-brand-50' },
  { label: 'Bloklangan urinishlar', value: '256', caption: 'So‘nggi 30 kun', icon: 'warning', tone: 'text-danger-600 bg-danger-50' },
  { label: 'Monitoring', value: '24/7', caption: 'Uzluksiz kuzatuv', icon: 'eye', tone: 'text-info-600 bg-info-50' },
]

const TONE_DOT: Record<string, string> = {
  brand: 'bg-brand-500',
  ok: 'bg-ok-500',
  warn: 'bg-warn-500',
  danger: 'bg-danger-500',
}
</script>

<template>
  <AppTopbar
    title="Tizim sozlamalari"
    subtitle="Tizim parametrlari, xavfsizlik va integratsiyalarni boshqarish"
    :breadcrumb="[{ label: 'Sozlamalar', to: '/settings/users' }, { label: 'Tizim sozlamalari' }]"
  >
    <template #actions>
      <span
        class="hidden items-center gap-2 rounded-pill bg-ok-50 px-3 py-1.5 text-[13px] font-semibold text-ok-700 ring-1 ring-inset ring-ok-100 lg:inline-flex"
      >
        <UiIcon name="shield" :size="15" />
        Xavfsizlik darajasi: Yuqori
      </span>
      <UiButton size="sm" :disabled="!dirty" @click="saveOpen = true">
        <UiIcon name="check" :size="16" />
        O‘zgarishlarni saqlash
      </UiButton>
    </template>
  </AppTopbar>

  <main class="scroll-slim flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
    <nav class="flex flex-wrap gap-2">
      <NuxtLink
        v-for="t in SETTINGS_TABS"
        :key="t.to"
        :to="t.to"
        class="inline-flex items-center gap-2 rounded-field px-4 py-2.5 text-[13px] font-semibold ring-1 ring-inset transition-colors"
        :class="
          t.to === CURRENT_TAB
            ? 'bg-brand-500 text-white ring-brand-500 shadow-brand'
            : 'bg-surface text-ink-600 ring-ink-200 hover:text-brand-600 hover:ring-brand-300'
        "
        :aria-current="t.to === CURRENT_TAB ? 'page' : undefined"
      >
        <UiIcon :name="t.icon" :size="16" />
        {{ t.label }}
      </NuxtLink>
    </nav>

    <div
      class="flex flex-wrap items-center gap-3 rounded-card px-4 py-3 text-[13px] ring-1"
      :class="dirty ? 'bg-warn-50 text-warn-700 ring-warn-100' : 'bg-surface text-ink-600 ring-ink-200/60'"
    >
      <UiIcon :name="dirty ? 'warning' : 'check'" :size="17" class="shrink-0" />
      <span class="min-w-0 flex-1">
        <template v-if="dirty">Saqlanmagan o‘zgarishlar mavjud.</template>
        <template v-else>Barcha o‘zgarishlar saqlangan. Oxirgi saqlash: {{ savedAt }}.</template>
      </span>
      <UiButton v-if="dirty" size="sm" @click="saveOpen = true">Saqlash</UiButton>
    </div>

    <section class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div class="min-w-0 space-y-5">
        <div class="grid gap-5 lg:grid-cols-2 2xl:grid-cols-3">
          <UiCard title="Kompaniya profili" subtitle="Rasmiy rekvizitlar">
            <p class="text-[16px] font-bold text-ink-900">{{ settings.company.name }}</p>
            <dl class="mt-3 space-y-2.5 text-[13px]">
              <div class="flex items-start justify-between gap-3">
                <dt class="text-ink-500">STIR</dt>
                <dd class="tabular text-right font-semibold text-ink-900">{{ settings.company.tin }}</dd>
              </div>
              <div class="flex items-start justify-between gap-3">
                <dt class="shrink-0 text-ink-500">Manzil</dt>
                <dd class="text-right font-medium text-ink-800">{{ settings.company.address }}</dd>
              </div>
              <div class="flex items-start justify-between gap-3">
                <dt class="text-ink-500">Telefon</dt>
                <dd class="tabular text-right font-semibold text-ink-900">{{ settings.company.phone }}</dd>
              </div>
              <div class="flex items-start justify-between gap-3">
                <dt class="text-ink-500">E-pochta</dt>
                <dd class="text-right font-semibold text-ink-900">{{ settings.company.email }}</dd>
              </div>
            </dl>
            <UiButton variant="secondary" size="sm" block class="mt-4" @click="openCompany">
              <UiIcon name="edit" :size="15" />
              Profilni tahrirlash
            </UiButton>
          </UiCard>

          <UiCard title="Kirish va ruxsat siyosatlari" subtitle="Autentifikatsiya qoidalari">
            <ul class="space-y-2">
              <li v-for="r in accessRows" :key="r.key">
                <button
                  type="button"
                  class="flex w-full items-center gap-3 rounded-field px-3 py-2.5 text-left ring-1 ring-inset ring-ink-200 transition-colors hover:ring-brand-300"
                  @click="toggleAccess(r.key)"
                >
                  <span class="grid size-9 shrink-0 place-items-center rounded-[10px] bg-brand-50 text-brand-600">
                    <UiIcon :name="r.icon" :size="17" />
                  </span>
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-[13px] font-semibold text-ink-900">{{ r.label }}</span>
                    <span class="block truncate text-[12px] text-ink-500">{{ r.caption }}</span>
                  </span>
                  <span class="flex shrink-0 items-center gap-2">
                    <span
                      class="text-[12px] font-semibold"
                      :class="r.value ? 'text-ok-700' : 'text-ink-500'"
                    >
                      {{ r.value ? 'Yoqilgan' : 'O‘chirilgan' }}
                    </span>
                    <span
                      class="inline-flex h-6 w-11 items-center rounded-pill p-0.5 transition-colors"
                      :class="r.value ? 'bg-brand-500' : 'bg-ink-300'"
                    >
                      <span
                        class="size-5 rounded-full bg-white transition-transform"
                        :class="r.value ? 'translate-x-5' : ''"
                      />
                    </span>
                  </span>
                </button>
              </li>
            </ul>
          </UiCard>

          <UiCard title="Parol va avtorizatsiya sozlamalari" subtitle="Parol siyosati parametrlari">
            <div class="space-y-3.5">
              <UiField label="Minimal parol uzunligi" hint="Belgilar soni">
                <UiInput v-model="settings.password.minLength" type="number" />
              </UiField>
              <UiField label="Parol eskirish muddati" hint="Kunlarda">
                <UiInput v-model="settings.password.expiryDays" type="number" />
              </UiField>
              <UiField label="Oldingi parollarni qayta ishlatish" hint="Nechta oxirgi parol taqiqlanadi">
                <UiInput v-model="settings.password.historyCount" type="number" />
              </UiField>
              <UiField label="Bloklashgacha urinishlar soni" hint="Noto‘g‘ri parol urinishlari">
                <UiInput v-model="settings.password.lockoutAttempts" type="number" />
              </UiField>
              <UiField label="Seans muddati" hint="Daqiqalarda">
                <UiInput v-model="settings.password.sessionMinutes" type="number" />
              </UiField>
            </div>
          </UiCard>

          <UiCard title="Zaxira nusxa va tiklash" subtitle="Ma’lumotlar zaxirasi">
            <dl class="space-y-2.5 text-[13px]">
              <div class="flex items-center justify-between gap-3">
                <dt class="text-ink-500">So‘nggi zaxira nusxa</dt>
                <dd class="tabular font-semibold text-ink-900">{{ lastBackup }}</dd>
              </div>
            </dl>

            <div class="mt-3 space-y-3.5">
              <UiField label="Zaxira chastotasi">
                <UiSelect v-model="settings.backup.frequency" :options="frequencyOptions" />
              </UiField>
              <UiField label="Saqlash muddati" hint="Kunlarda">
                <UiInput v-model="settings.backup.retentionDays" type="number" />
              </UiField>
              <UiField label="Saqlash joyi">
                <UiSelect v-model="settings.backup.storage" :options="storageOptions" />
              </UiField>
            </div>

            <div class="mt-4 grid grid-cols-2 gap-2.5">
              <UiButton variant="secondary" size="sm" @click="backupOpen = true">
                <UiIcon name="upload" :size="15" />
                Zaxira yaratish
              </UiButton>
              <UiButton variant="danger" size="sm" @click="openRestore">
                <UiIcon name="refresh" :size="15" />
                Tiklash
              </UiButton>
            </div>
          </UiCard>

          <UiCard title="Tizim afzalliklari" subtitle="Bildirishnoma va mintaqaviy sozlamalar">
            <ul class="space-y-2">
              <li>
                <button
                  type="button"
                  class="flex w-full items-center justify-between gap-3 rounded-field px-3 py-2.5 text-left ring-1 ring-inset ring-ink-200 transition-colors hover:ring-brand-300"
                  @click="settings.prefs.inApp = !settings.prefs.inApp"
                >
                  <span class="text-[13px] font-semibold text-ink-900">Tizim ichidagi bildirishnomalar</span>
                  <span
                    class="inline-flex h-6 w-11 shrink-0 items-center rounded-pill p-0.5 transition-colors"
                    :class="settings.prefs.inApp ? 'bg-brand-500' : 'bg-ink-300'"
                  >
                    <span
                      class="size-5 rounded-full bg-white transition-transform"
                      :class="settings.prefs.inApp ? 'translate-x-5' : ''"
                    />
                  </span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  class="flex w-full items-center justify-between gap-3 rounded-field px-3 py-2.5 text-left ring-1 ring-inset ring-ink-200 transition-colors hover:ring-brand-300"
                  @click="settings.prefs.digest = !settings.prefs.digest"
                >
                  <span class="text-[13px] font-semibold text-ink-900">Kunlik xulosa paneli</span>
                  <span
                    class="inline-flex h-6 w-11 shrink-0 items-center rounded-pill p-0.5 transition-colors"
                    :class="settings.prefs.digest ? 'bg-brand-500' : 'bg-ink-300'"
                  >
                    <span
                      class="size-5 rounded-full bg-white transition-transform"
                      :class="settings.prefs.digest ? 'translate-x-5' : ''"
                    />
                  </span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  class="flex w-full items-center justify-between gap-3 rounded-field px-3 py-2.5 text-left ring-1 ring-inset ring-ink-200 transition-colors hover:ring-brand-300"
                  @click="settings.prefs.weeklyReport = !settings.prefs.weeklyReport"
                >
                  <span class="text-[13px] font-semibold text-ink-900">Haftalik hisobot eslatmasi</span>
                  <span
                    class="inline-flex h-6 w-11 shrink-0 items-center rounded-pill p-0.5 transition-colors"
                    :class="settings.prefs.weeklyReport ? 'bg-brand-500' : 'bg-ink-300'"
                  >
                    <span
                      class="size-5 rounded-full bg-white transition-transform"
                      :class="settings.prefs.weeklyReport ? 'translate-x-5' : ''"
                    />
                  </span>
                </button>
              </li>
              <li
                class="flex items-center justify-between gap-3 rounded-field bg-ink-50 px-3 py-2.5 text-[13px] text-ink-500 ring-1 ring-inset ring-ink-200"
              >
                <span>E-pochta / SMS / Telegram kanallari</span>
                <span class="shrink-0 text-[12px] font-semibold">Joriy bosqichda ulanmagan</span>
              </li>
            </ul>

            <div class="mt-3.5 space-y-3.5">
              <UiField
                label="Standart interfeys tili"
                hint="Yangi hisoblar shu til bilan ochiladi, foydalanuvchi uni profilida o‘zgartiradi"
              >
                <UiSelect v-model="settings.prefs.language" :options="languageOptions" />
              </UiField>
              <UiField label="Vaqt zonasi">
                <UiSelect v-model="settings.prefs.timezone" :options="timezoneOptions" />
              </UiField>
            </div>
          </UiCard>
        </div>

        <UiCard title="Xavfsizlik holati" subtitle="Monitoring ko‘rsatkichlari va sutkalik faoliyat">
          <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div v-for="m in SECURITY_METRICS" :key="m.label" class="rounded-field p-4 ring-1 ring-ink-200">
              <span class="grid size-9 place-items-center rounded-[10px]" :class="m.tone">
                <UiIcon :name="m.icon" :size="18" />
              </span>
              <p class="tabular mt-3 text-[22px] font-bold leading-none text-ink-900">{{ m.value }}</p>
              <p class="mt-1.5 text-[13px] font-semibold text-ink-700">{{ m.label }}</p>
              <p class="text-[12px] text-ink-500">{{ m.caption }}</p>
            </div>
          </div>

          <div class="mt-5 border-t border-ink-100 pt-5">
            <UiLine :labels="activityLabels" :series="activitySeries" :height="200" />
          </div>
        </UiCard>
      </div>

      <div class="min-w-0 space-y-5">
        <UiCard title="Faol sessiyalar" :subtitle="`${sessions.length} ta ochiq seans`" flush>
          <ul class="divide-y divide-ink-100">
            <li v-for="s in sessions" :key="s.id" class="flex items-center gap-3 px-5 py-3">
              <span class="grid size-9 shrink-0 place-items-center rounded-[10px] bg-brand-50 text-brand-600">
                <UiIcon name="globe" :size="17" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-[13px] font-semibold text-ink-900">{{ s.device }}</span>
                <span class="block truncate text-[12px] text-ink-500">{{ s.place }} • {{ s.when }}</span>
              </span>
              <span
                v-if="s.current"
                class="shrink-0 rounded-pill bg-ok-50 px-2.5 py-1 text-[12px] font-semibold text-ok-700 ring-1 ring-inset ring-ok-100"
              >
                Joriy seans
              </span>
              <button
                v-else
                type="button"
                class="shrink-0 rounded-[8px] px-2.5 py-1.5 text-[13px] font-semibold text-danger-600 transition-colors hover:bg-danger-50"
                @click="endSession(s.id)"
              >
                Tugatish
              </button>
            </li>
          </ul>

          <div class="px-5 py-4">
            <UiButton
              variant="danger"
              size="sm"
              block
              :disabled="sessions.length < 2"
              @click="closeAllOpen = true"
            >
              <UiIcon name="logout" :size="15" />
              Barcha sessiyalarni tugatish
            </UiButton>
          </div>
        </UiCard>

        <UiCard title="Audit jurnali" subtitle="So‘nggi tizim hodisalari" flush>
          <template #actions>
            <UiButton variant="ghost" size="sm" to="/settings/audit">Barchasi</UiButton>
          </template>
          <ul class="divide-y divide-ink-100">
            <li v-for="e in audit" :key="e.id" class="flex items-start gap-3 px-5 py-3">
              <span class="mt-1.5 size-2 shrink-0 rounded-full" :class="TONE_DOT[e.tone]" />
              <span class="min-w-0 flex-1">
                <span class="block text-[13px] font-semibold text-ink-900">{{ e.who }}</span>
                <span class="block text-[12px] leading-snug text-ink-600">{{ e.text }}</span>
              </span>
              <span class="tabular shrink-0 text-[12px] text-ink-500">{{ e.when }}</span>
            </li>
          </ul>
        </UiCard>
      </div>
    </section>

    <UiModal v-model="companyOpen" title="Kompaniya profilini tahrirlash" size="md">
      <div class="space-y-4">
        <UiField label="Tashkilot nomi" required>
          <UiInput v-model="companyDraft.name" />
        </UiField>
        <div class="grid gap-4 sm:grid-cols-2">
          <UiField label="STIR">
            <UiInput v-model="companyDraft.tin" />
          </UiField>
          <UiField label="Telefon">
            <UiInput v-model="companyDraft.phone" />
          </UiField>
        </div>
        <UiField label="Manzil">
          <UiInput v-model="companyDraft.address" />
        </UiField>
        <UiField label="E-pochta">
          <UiInput v-model="companyDraft.email" type="email" />
        </UiField>
      </div>
      <template #footer>
        <UiButton variant="ghost" @click="companyOpen = false">Bekor qilish</UiButton>
        <UiButton :disabled="!companyDraft.name.trim()" @click="saveCompany">Saqlash</UiButton>
      </template>
    </UiModal>

    <UiModal v-model="backupOpen" title="Zaxira nusxa yaratish" size="sm">
      <p class="text-[14px] leading-relaxed text-ink-700">
        Joriy ma’lumotlar bazasining to‘liq zaxira nusxasi yaratiladi va
        «{{ storageOptions.find((o) => o.value === settings.backup.storage)?.label }}» saqlash
        joyiga joylanadi.
      </p>
      <template #footer>
        <UiButton variant="ghost" @click="backupOpen = false">Bekor qilish</UiButton>
        <UiButton @click="confirmBackup">Zaxira yaratish</UiButton>
      </template>
    </UiModal>

    <UiModal
      v-model="restoreOpen"
      title="Zaxiradan tiklash"
      subtitle="Bu amal joriy ma’lumotlarni zaxira nusxa bilan almashtiradi"
      size="sm"
    >
      <p class="flex items-start gap-2 rounded-field bg-danger-50 px-3.5 py-3 text-[13px] text-danger-700">
        <UiIcon name="warning" :size="16" class="mt-0.5 shrink-0" />
        Tiklash boshlangach joriy ma’lumotlar qaytarilmaydi. Amal audit jurnalida qayd etiladi.
      </p>

      <UiField
        class="mt-4"
        :label="`Tasdiqlash uchun «${RESTORE_PHRASE}» so‘zini kiriting`"
        required
        :error="restorePhrase && !restoreReady ? 'So‘z aynan mos kelmadi' : ''"
      >
        <UiInput v-model="restorePhrase" :placeholder="RESTORE_PHRASE" />
      </UiField>

      <template #footer>
        <UiButton variant="ghost" @click="restoreOpen = false">Bekor qilish</UiButton>
        <UiButton variant="danger" :disabled="!restoreReady" @click="confirmRestore">
          Tiklashni boshlash
        </UiButton>
      </template>
    </UiModal>

    <UiModal v-model="closeAllOpen" title="Barcha sessiyalarni tugatish" size="sm">
      <p class="text-[14px] leading-relaxed text-ink-700">
        Joriy seansdan tashqari barcha ochiq seanslar yopiladi. Foydalanuvchilar qaytadan tizimga
        kirishlari kerak bo‘ladi.
      </p>
      <template #footer>
        <UiButton variant="ghost" @click="closeAllOpen = false">Bekor qilish</UiButton>
        <UiButton variant="danger" @click="confirmCloseAll">Tugatish</UiButton>
      </template>
    </UiModal>

    <UiModal v-model="saveOpen" title="O‘zgarishlarni saqlash" size="sm">
      <p class="text-[14px] leading-relaxed text-ink-700">
        Tizim sozlamalari, xavfsizlik siyosatlari va integratsiya parametrlari saqlanadi hamda
        audit jurnalida qayd etiladi.
      </p>
      <template #footer>
        <UiButton variant="ghost" @click="saveOpen = false">Bekor qilish</UiButton>
        <UiButton @click="confirmSave">Saqlash</UiButton>
      </template>
    </UiModal>
  </main>
</template>
