<script setup lang="ts">
const auth = useAuthStore()
const { t, locales } = useI18n()
const { roleLabel: roleName, roleCaption: roleNote } = useAppLabels()

const roleLabel = computed(() => (auth.role ? roleName(auth.role) : '-'))
const roleCaption = computed(() => (auth.role ? roleNote(auth.role) : ''))

const initials = computed(() =>
  (auth.user?.fullName ?? '')
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join(''),
)

const form = reactive({
  fullName: auth.user?.fullName ?? '',
  position: auth.user?.position ?? '',
  phone: auth.user?.phone ?? '',
  email: auth.user?.email ?? '',
})

const errors = reactive({ fullName: '', phone: '', email: '' })
const savedMessage = ref('')

const dirty = computed(
  () =>
    form.fullName !== (auth.user?.fullName ?? '') ||
    form.position !== (auth.user?.position ?? '') ||
    form.phone !== (auth.user?.phone ?? '') ||
    form.email !== (auth.user?.email ?? ''),
)

function resetForm() {
  form.fullName = auth.user?.fullName ?? ''
  form.position = auth.user?.position ?? ''
  form.phone = auth.user?.phone ?? ''
  form.email = auth.user?.email ?? ''
  errors.fullName = ''
  errors.phone = ''
  errors.email = ''
}

function saveProfile() {
  errors.fullName = form.fullName.trim().length >= 4 ? '' : 'F.I.Sh. to‘liq kiritilishi kerak'
  errors.phone = form.phone.trim().length >= 9 ? '' : 'Telefon raqamini to‘liq kiriting'
  errors.email = /.+@.+\..+/.test(form.email.trim()) ? '' : 'E-pochta manzili noto‘g‘ri'
  if (errors.fullName || errors.phone || errors.email) return
  if (!auth.user) return

  auth.user.fullName = form.fullName.trim()
  auth.user.position = form.position.trim()
  auth.user.phone = form.phone.trim()
  auth.user.email = form.email.trim()
  savedMessage.value = 'Profil ma’lumotlari saqlandi'
}

const passwordOpen = ref(false)
const passwordForm = reactive({ current: '', next: '', repeat: '' })

/** Har bir xabar o‘z maydoniga tushadi, aks holda xato boshqa qatorda ko‘rinadi */
const passwordErrors = reactive({ current: '', next: '', repeat: '' })

function clearPasswordErrors() {
  passwordErrors.current = ''
  passwordErrors.next = ''
  passwordErrors.repeat = ''
}

function openPassword() {
  passwordForm.current = ''
  passwordForm.next = ''
  passwordForm.repeat = ''
  clearPasswordErrors()
  passwordOpen.value = true
}

function submitPassword() {
  clearPasswordErrors()

  if (!passwordForm.current.trim()) {
    passwordErrors.current = 'Joriy parolni kiriting'
    return
  }
  if (passwordForm.next.trim().length < 8) {
    passwordErrors.next = 'Yangi parol kamida 8 ta belgidan iborat bo‘lishi kerak'
    return
  }
  if (passwordForm.next !== passwordForm.repeat) {
    passwordErrors.repeat = 'Yangi parol va tasdiqlash mos kelmadi'
    return
  }

  savedMessage.value = 'Parol muvaffaqiyatli yangilandi'
  passwordOpen.value = false
}

interface Session {
  id: string
  device: string
  platform: string
  location: string
  at: string
  current: boolean
}

const sessions = ref<Session[]>([
  {
    id: 'ss-1',
    device: 'Chrome brauzeri',
    platform: 'Windows 11',
    location: 'Toshkent, O‘zbekiston',
    at: 'Bugun, 09:12',
    current: true,
  },
  {
    id: 'ss-2',
    device: 'Safari brauzeri',
    platform: 'macOS 15',
    location: 'Toshkent, O‘zbekiston',
    at: '17.05.2025, 18:40',
    current: false,
  },
  {
    id: 'ss-3',
    device: 'Makon mobil ilovasi',
    platform: 'Android 15',
    location: 'Samarqand, O‘zbekiston',
    at: '15.05.2025, 12:05',
    current: false,
  },
])

function endSession(id: string) {
  sessions.value = sessions.value.filter((s) => s.id !== id)
  savedMessage.value = 'Tanlangan seans tugatildi'
}

/**
 * Til tanlovi sarlavhadagi tugma bilan bitta xotiradan o‘qiladi, shuning
 * uchun bu yerdagi tanlov yangilashdan keyin ham saqlanadi.
 */
const { stored: storedLocale, pick: pickLocale } = useLocaleChoice()

const language = computed({
  get: () => String(storedLocale.value),
  set: (value: string) => pickLocale(value),
})

/** Nomlar sarlavhadagi til tugmasi bilan bir xil kalitdan o‘qiladi */
const LANGUAGE_LABEL: Record<string, string> = {
  uz: 'shell.localeUz',
  ru: 'shell.localeRu',
}

const languageOptions = computed(() =>
  (locales.value as Array<{ code: string; name: string }>).map((l) => ({
    value: l.code,
    label: LANGUAGE_LABEL[l.code] ? t(LANGUAGE_LABEL[l.code]!) : l.name,
  })),
)

const notificationSettings = ref([
  {
    id: 'ns-1',
    label: 'Tizim ichidagi bildirishnomalar',
    caption: 'Kabinetdagi qo‘ng‘iroqcha orqali ko‘rsatiladi',
    on: true,
  },
  {
    id: 'ns-2',
    label: 'To‘lov eslatmalari',
    caption: 'To‘lov muddati yaqinlashganda xabar beriladi',
    on: true,
  },
  {
    id: 'ns-3',
    label: 'Servis arizalari yangiliklari',
    caption: 'Ariza holati o‘zgarganda xabar beriladi',
    on: true,
  },
  {
    id: 'ns-4',
    label: 'Hujjat va shartnoma o‘zgarishlari',
    caption: 'Yangi hujjat qo‘shilganda xabar beriladi',
    on: false,
  },
])

function toggleNotification(id: string) {
  const item = notificationSettings.value.find((n) => n.id === id)
  if (item) item.on = !item.on
}
</script>

<template>
  <AppTopbar title="Profil" subtitle="Shaxsiy ma’lumotlar, xavfsizlik va interfeys sozlamalari">
    <template #actions>
      <UiButton variant="secondary" size="sm" @click="openPassword">
        <UiIcon name="lock" :size="16" />
        Parolni o‘zgartirish
      </UiButton>
      <UiButton size="sm" to="/notifications">
        <UiIcon name="bell" :size="16" />
        Bildirishnomalar
      </UiButton>
    </template>
  </AppTopbar>

  <main class="scroll-slim flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
    <div
      v-if="savedMessage"
      class="flex items-center gap-3 rounded-card bg-ok-50 px-5 py-3.5 ring-1 ring-ok-100"
    >
      <span class="grid size-9 shrink-0 place-items-center rounded-[10px] bg-ok-500 text-white">
        <UiIcon name="check" :size="18" />
      </span>
      <p class="min-w-0 flex-1 text-[14px] text-ok-700">{{ savedMessage }}</p>
      <button
        type="button"
        class="rounded-lg p-1.5 text-ok-700 transition-colors hover:bg-ok-100"
        aria-label="Xabarni yopish"
        @click="savedMessage = ''"
      >
        <UiIcon name="x" :size="16" />
      </button>
    </div>

    <section class="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
      <UiCard>
        <div class="flex items-center gap-4">
          <UiAvatar
            :user-id="auth.user?.id"
            :full-name="auth.user?.fullName ?? ''"
            :role="auth.role"
            size="xl"
            ring
          />
          <div class="min-w-0">
            <h3 class="truncate text-[18px] font-bold text-ink-900">
              {{ auth.user?.fullName ?? '-' }}
            </h3>
            <p class="truncate text-[13px] text-ink-500">{{ auth.user?.position ?? '-' }}</p>
          </div>
        </div>

        <div class="mt-4 rounded-field bg-brand-50 px-4 py-3">
          <p class="text-[11px] font-bold uppercase tracking-wider text-brand-600">Rol</p>
          <p class="mt-0.5 text-[14px] font-bold text-brand-700">{{ roleLabel }}</p>
          <p class="mt-0.5 text-[12px] leading-snug text-brand-600">{{ roleCaption }}</p>
        </div>

        <dl class="mt-4 divide-y divide-ink-100 border-t border-ink-100">
          <div class="flex items-center justify-between py-2.5">
            <dt class="text-[13px] text-ink-500">Tashkilot</dt>
            <dd class="text-[13px] font-semibold text-ink-900">{{ auth.user?.organization ?? '-' }}</dd>
          </div>
          <div class="flex items-center justify-between py-2.5">
            <dt class="text-[13px] text-ink-500">Telefon</dt>
            <dd class="tabular text-[13px] font-semibold text-ink-900">{{ auth.user?.phone ?? '-' }}</dd>
          </div>
          <div class="flex items-center justify-between py-2.5">
            <dt class="text-[13px] text-ink-500">E-pochta</dt>
            <dd class="truncate text-[13px] font-semibold text-ink-900">{{ auth.user?.email ?? '-' }}</dd>
          </div>
        </dl>

        <UiButton variant="secondary" size="sm" class="mt-4" block to="/help">
          <UiIcon name="help" :size="15" />
          Yordam markazi
        </UiButton>
      </UiCard>

      <UiCard title="Shaxsiy ma’lumotlar" subtitle="Ma’lumotlarni tahrirlab, saqlang">
        <template #actions>
          <span
            v-if="dirty"
            class="rounded-pill bg-warn-50 px-2.5 py-1 text-[12px] font-semibold text-warn-700"
          >
            Saqlanmagan o‘zgarishlar
          </span>
        </template>

        <div class="grid gap-4 sm:grid-cols-2">
          <UiField label="F.I.Sh." required :error="errors.fullName">
            <UiInput v-model="form.fullName" :invalid="!!errors.fullName" placeholder="Familiya Ism" />
          </UiField>

          <UiField label="Lavozim">
            <UiInput v-model="form.position" placeholder="Lavozim nomi" />
          </UiField>

          <UiField label="Tashkilot" hint="Tashkilot nomi shartnoma asosida belgilanadi">
            <UiInput :model-value="auth.user?.organization ?? ''" readonly />
          </UiField>

          <UiField label="Rol" hint="Rolni tizim administratori o‘zgartiradi">
            <UiInput :model-value="roleLabel" readonly />
          </UiField>

          <UiField label="Telefon" required :error="errors.phone">
            <UiInput v-model="form.phone" :invalid="!!errors.phone" placeholder="+998 90 000 00 00" />
          </UiField>

          <UiField label="E-pochta" required :error="errors.email">
            <UiInput
              v-model="form.email"
              type="email"
              :invalid="!!errors.email"
              placeholder="ism@tashkilot.uz"
            />
          </UiField>
        </div>

        <div class="mt-5 flex items-center justify-end gap-3 border-t border-ink-100 pt-4">
          <UiButton variant="ghost" :disabled="!dirty" @click="resetForm">Bekor qilish</UiButton>
          <UiButton :disabled="!dirty" @click="saveProfile">
            <UiIcon name="check" :size="16" />
            Saqlash
          </UiButton>
        </div>
      </UiCard>
    </section>

    <section class="grid gap-5 xl:grid-cols-2">
      <UiCard title="Xavfsizlik" subtitle="Parol va faol seanslar" flush>
        <div class="px-5 pb-4">
          <div class="flex items-center gap-3.5 rounded-field p-4 ring-1 ring-ink-200">
            <span class="grid size-10 shrink-0 place-items-center rounded-[10px] bg-brand-50 text-brand-600">
              <UiIcon name="lock" :size="19" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block text-[14px] font-semibold text-ink-900">Parol</span>
              <span class="block text-[12px] text-ink-500">
                Xavfsizlik uchun parolni muntazam yangilab turing
              </span>
            </span>
            <UiButton variant="secondary" size="sm" @click="openPassword">O‘zgartirish</UiButton>
          </div>
        </div>

        <div class="px-5 pb-5">
          <p class="mb-2 text-[13px] font-semibold text-ink-700">Faol seanslar</p>
          <ul class="divide-y divide-ink-100 rounded-field ring-1 ring-ink-200">
            <li v-for="s in sessions" :key="s.id" class="flex items-center gap-3.5 px-4 py-3">
              <span class="grid size-10 shrink-0 place-items-center rounded-[10px] bg-ink-100 text-ink-600">
                <UiIcon name="shield" :size="18" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="flex items-center gap-2">
                  <span class="truncate text-[13px] font-semibold text-ink-900">{{ s.device }}</span>
                  <span
                    v-if="s.current"
                    class="rounded-pill bg-ok-50 px-2 py-0.5 text-[11px] font-semibold text-ok-700"
                  >
                    Joriy seans
                  </span>
                </span>
                <span class="block truncate text-[12px] text-ink-500">
                  {{ s.platform }} · {{ s.location }} · {{ s.at }}
                </span>
              </span>
              <UiButton
                variant="ghost"
                size="sm"
                :disabled="s.current"
                @click="endSession(s.id)"
              >
                Seansni tugatish
              </UiButton>
            </li>
            <li v-if="!sessions.length" class="px-4 py-8 text-center text-[13px] text-ink-500">
              Faol seanslar yo‘q
            </li>
          </ul>
        </div>
      </UiCard>

      <UiCard title="Interfeys" subtitle="Til va bildirishnoma sozlamalari">
        <UiField label="Interfeys tili" hint="Tanlov darhol qo‘llanadi">
          <UiSelect v-model="language" :options="languageOptions" />
        </UiField>

        <div class="mt-5">
          <p class="mb-2 text-[13px] font-semibold text-ink-700">Bildirishnoma sozlamalari</p>
          <ul class="divide-y divide-ink-100 rounded-field ring-1 ring-ink-200">
            <li v-for="n in notificationSettings" :key="n.id" class="flex items-center gap-3.5 px-4 py-3">
              <span class="min-w-0 flex-1">
                <span class="block truncate text-[13px] font-semibold text-ink-900">{{ n.label }}</span>
                <span class="block truncate text-[12px] text-ink-500">{{ n.caption }}</span>
              </span>
              <button
                type="button"
                role="switch"
                :aria-checked="n.on"
                :aria-label="n.label"
                class="relative h-6 w-11 shrink-0 rounded-pill transition-colors"
                :class="n.on ? 'bg-brand-500' : 'bg-ink-200'"
                @click="toggleNotification(n.id)"
              >
                <span
                  class="absolute top-0.5 size-5 rounded-full bg-white shadow-card transition-all"
                  :class="n.on ? 'left-[22px]' : 'left-0.5'"
                />
              </button>
            </li>
          </ul>
          <p class="mt-2.5 text-[12px] text-ink-500">
            Joriy bosqichda barcha xabarlar tizim ichida ko‘rsatiladi. SMS, e-mail va Telegram
            kanallari keyingi bosqichda ulanadi.
          </p>
        </div>
      </UiCard>
    </section>
  </main>

  <UiModal
    v-model="passwordOpen"
    title="Parolni o‘zgartirish"
    subtitle="Yangi parol kamida 8 ta belgidan iborat bo‘lishi kerak"
    size="sm"
  >
    <div class="space-y-4">
      <UiField label="Joriy parol" required :error="passwordErrors.current">
        <UiInput
          v-model="passwordForm.current"
          type="password"
          placeholder="Joriy parol"
          :invalid="!!passwordErrors.current"
        />
      </UiField>
      <UiField label="Yangi parol" required :error="passwordErrors.next">
        <UiInput
          v-model="passwordForm.next"
          type="password"
          placeholder="Yangi parol"
          :invalid="!!passwordErrors.next"
        />
      </UiField>
      <UiField label="Yangi parolni tasdiqlash" required :error="passwordErrors.repeat">
        <UiInput
          v-model="passwordForm.repeat"
          type="password"
          placeholder="Yangi parolni takrorlang"
          :invalid="!!passwordErrors.repeat"
        />
      </UiField>

      <p class="flex items-start gap-2 rounded-field bg-brand-50 px-3.5 py-2.5 text-[12px] text-brand-700">
        <UiIcon name="info" :size="15" class="mt-0.5 shrink-0" />
        Parol o‘zgartirilgach boshqa qurilmalardagi seanslar amal qilishda davom etadi, kerak
        bo‘lsa ularni «Xavfsizlik» bo‘limidan tugating.
      </p>
    </div>

    <template #footer>
      <UiButton variant="ghost" @click="passwordOpen = false">Bekor qilish</UiButton>
      <UiButton @click="submitPassword">
        <UiIcon name="check" :size="16" />
        Saqlash
      </UiButton>
    </template>
  </UiModal>
</template>
