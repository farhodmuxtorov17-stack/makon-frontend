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
  errors.fullName = form.fullName.trim().length >= 4 ? '' : t('usr.errFullName')
  errors.phone = form.phone.trim().length >= 9 ? '' : t('usr.errPhone')
  errors.email = /.+@.+\..+/.test(form.email.trim()) ? '' : t('usr.errEmail')
  if (errors.fullName || errors.phone || errors.email) return
  if (!auth.user) return

  auth.user.fullName = form.fullName.trim()
  auth.user.position = form.position.trim()
  auth.user.phone = form.phone.trim()
  auth.user.email = form.email.trim()
  savedMessage.value = t('usr.savedProfile')
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
    passwordErrors.current = t('usr.errCurrentPassword')
    return
  }
  if (passwordForm.next.trim().length < 8) {
    passwordErrors.next = t('usr.passwordRule')
    return
  }
  if (passwordForm.next !== passwordForm.repeat) {
    passwordErrors.repeat = t('usr.errPasswordMismatch')
    return
  }

  savedMessage.value = t('usr.savedPassword')
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

/** Tugatilgan seans ro‘yxatdan chiqadi, nomlar esa tanlangan tilda qoladi */
const endedSessions = ref<string[]>([])

const sessions = computed<Session[]>(() =>
  [
    {
      id: 'ss-1',
      device: t('usr.deviceChrome'),
      platform: 'Windows 11',
      location: t('usr.locTashkent'),
      at: t('usr.sessionToday', { time: '09:12' }),
      current: true,
    },
    {
      id: 'ss-2',
      device: t('usr.deviceSafari'),
      platform: 'macOS 15',
      location: t('usr.locTashkent'),
      at: '17.05.2025, 18:40',
      current: false,
    },
    {
      id: 'ss-3',
      device: t('usr.deviceMobileApp'),
      platform: 'Android 15',
      location: t('usr.locSamarkand'),
      at: '15.05.2025, 12:05',
      current: false,
    },
  ].filter((s) => !endedSessions.value.includes(s.id)),
)

function endSession(id: string) {
  if (!endedSessions.value.includes(id)) endedSessions.value.push(id)
  savedMessage.value = t('usr.sessionEnded')
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

/** Yoqilgan-o‘chirilgan holat alohida saqlanadi, nomlar esa tarjimadan keladi */
const notificationOn = reactive<Record<string, boolean>>({
  'ns-1': true,
  'ns-2': true,
  'ns-3': true,
  'ns-4': false,
})

const notificationSettings = computed(() => [
  {
    id: 'ns-1',
    label: t('usr.notifyInApp'),
    caption: t('usr.notifyInAppHint'),
    on: notificationOn['ns-1'],
  },
  {
    id: 'ns-2',
    label: t('usr.notifyPayment'),
    caption: t('usr.notifyPaymentHint'),
    on: notificationOn['ns-2'],
  },
  {
    id: 'ns-3',
    label: t('usr.notifyService'),
    caption: t('usr.notifyServiceHint'),
    on: notificationOn['ns-3'],
  },
  {
    id: 'ns-4',
    label: t('usr.notifyDocs'),
    caption: t('usr.notifyDocsHint'),
    on: notificationOn['ns-4'],
  },
])

function toggleNotification(id: string) {
  notificationOn[id] = !notificationOn[id]
}
</script>

<template>
  <AppTopbar :title="t('common.profile')" :subtitle="t('usr.profileCaption')">
    <template #actions>
      <UiButton variant="secondary" size="sm" @click="openPassword">
        <UiIcon name="lock" :size="16" />
        {{ t('usr.changePassword') }}
      </UiButton>
      <UiButton size="sm" to="/notifications">
        <UiIcon name="bell" :size="16" />
        {{ t('common.notifications') }}
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
        :aria-label="t('usr.closeMessage')"
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
          <p class="text-[11px] font-bold uppercase tracking-wider text-brand-600">
            {{ t('field.role') }}
          </p>
          <p class="mt-0.5 text-[14px] font-bold text-brand-700">{{ roleLabel }}</p>
          <p class="mt-0.5 text-[12px] leading-snug text-brand-600">{{ roleCaption }}</p>
        </div>

        <dl class="mt-4 divide-y divide-ink-100 border-t border-ink-100">
          <div class="flex items-center justify-between py-2.5">
            <dt class="text-[13px] text-ink-500">{{ t('field.organization') }}</dt>
            <dd class="text-[13px] font-semibold text-ink-900">{{ auth.user?.organization ?? '-' }}</dd>
          </div>
          <div class="flex items-center justify-between py-2.5">
            <dt class="text-[13px] text-ink-500">{{ t('common.phone') }}</dt>
            <dd class="tabular text-[13px] font-semibold text-ink-900">{{ auth.user?.phone ?? '-' }}</dd>
          </div>
          <div class="flex items-center justify-between py-2.5">
            <dt class="text-[13px] text-ink-500">{{ t('common.email') }}</dt>
            <dd class="truncate text-[13px] font-semibold text-ink-900">{{ auth.user?.email ?? '-' }}</dd>
          </div>
        </dl>

        <UiButton variant="secondary" size="sm" class="mt-4" block to="/help">
          <UiIcon name="help" :size="15" />
          {{ t('nav.help') }}
        </UiButton>
      </UiCard>

      <UiCard :title="t('usr.personalData')" :subtitle="t('usr.personalDataCaption')">
        <template #actions>
          <span
            v-if="dirty"
            class="rounded-pill bg-warn-50 px-2.5 py-1 text-[12px] font-semibold text-warn-700"
          >
            {{ t('usr.unsavedChanges') }}
          </span>
        </template>

        <div class="grid gap-4 sm:grid-cols-2">
          <UiField :label="t('field.fullName')" required :error="errors.fullName">
            <UiInput
              v-model="form.fullName"
              :invalid="!!errors.fullName"
              :placeholder="t('usr.fullNamePlaceholder')"
            />
          </UiField>

          <UiField :label="t('field.position')">
            <UiInput v-model="form.position" :placeholder="t('usr.positionPlaceholder')" />
          </UiField>

          <UiField :label="t('field.organization')" :hint="t('usr.organizationHint')">
            <UiInput :model-value="auth.user?.organization ?? ''" readonly />
          </UiField>

          <UiField :label="t('field.role')" :hint="t('usr.roleHint')">
            <UiInput :model-value="roleLabel" readonly />
          </UiField>

          <UiField :label="t('common.phone')" required :error="errors.phone">
            <UiInput v-model="form.phone" :invalid="!!errors.phone" placeholder="+998 90 000 00 00" />
          </UiField>

          <UiField :label="t('common.email')" required :error="errors.email">
            <UiInput
              v-model="form.email"
              type="email"
              :invalid="!!errors.email"
              :placeholder="t('usr.emailPlaceholder')"
            />
          </UiField>
        </div>

        <div class="mt-5 flex items-center justify-end gap-3 border-t border-ink-100 pt-4">
          <UiButton variant="ghost" :disabled="!dirty" @click="resetForm">
            {{ t('common.cancel') }}
          </UiButton>
          <UiButton :disabled="!dirty" @click="saveProfile">
            <UiIcon name="check" :size="16" />
            {{ t('common.save') }}
          </UiButton>
        </div>
      </UiCard>
    </section>

    <section class="grid gap-5 xl:grid-cols-2">
      <UiCard :title="t('usr.security')" :subtitle="t('usr.securityCaption')" flush>
        <div class="px-5 pb-4">
          <div class="flex items-center gap-3.5 rounded-field p-4 ring-1 ring-ink-200">
            <span class="grid size-10 shrink-0 place-items-center rounded-[10px] bg-brand-50 text-brand-600">
              <UiIcon name="lock" :size="19" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block text-[14px] font-semibold text-ink-900">
                {{ t('login.passwordLabel') }}
              </span>
              <span class="block text-[12px] text-ink-500">
                {{ t('usr.passwordAdvice') }}
              </span>
            </span>
            <UiButton variant="secondary" size="sm" @click="openPassword">
              {{ t('common.change') }}
            </UiButton>
          </div>
        </div>

        <div class="px-5 pb-5">
          <p class="mb-2 text-[13px] font-semibold text-ink-700">{{ t('usr.activeSessions') }}</p>
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
                    {{ t('usr.currentSession') }}
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
                {{ t('usr.endSession') }}
              </UiButton>
            </li>
            <li v-if="!sessions.length" class="px-4 py-8 text-center text-[13px] text-ink-500">
              {{ t('empty.noSessions') }}
            </li>
          </ul>
        </div>
      </UiCard>

      <UiCard :title="t('usr.interface')" :subtitle="t('usr.interfaceCaption')">
        <UiField :label="t('common.language')" :hint="t('usr.languageHint')">
          <UiSelect v-model="language" :options="languageOptions" />
        </UiField>

        <div class="mt-5">
          <p class="mb-2 text-[13px] font-semibold text-ink-700">{{ t('usr.notifySettings') }}</p>
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
            {{ t('usr.channelsNote') }}
          </p>
        </div>
      </UiCard>
    </section>
  </main>

  <UiModal
    v-model="passwordOpen"
    :title="t('usr.changePassword')"
    :subtitle="t('usr.passwordRule')"
    size="sm"
  >
    <div class="space-y-4">
      <UiField :label="t('usr.currentPassword')" required :error="passwordErrors.current">
        <UiInput
          v-model="passwordForm.current"
          type="password"
          :placeholder="t('usr.currentPassword')"
          :invalid="!!passwordErrors.current"
        />
      </UiField>
      <UiField :label="t('usr.newPassword')" required :error="passwordErrors.next">
        <UiInput
          v-model="passwordForm.next"
          type="password"
          :placeholder="t('usr.newPassword')"
          :invalid="!!passwordErrors.next"
        />
      </UiField>
      <UiField :label="t('usr.confirmPassword')" required :error="passwordErrors.repeat">
        <UiInput
          v-model="passwordForm.repeat"
          type="password"
          :placeholder="t('usr.repeatPassword')"
          :invalid="!!passwordErrors.repeat"
        />
      </UiField>

      <p class="flex items-start gap-2 rounded-field bg-brand-50 px-3.5 py-2.5 text-[12px] text-brand-700">
        <UiIcon name="info" :size="15" class="mt-0.5 shrink-0" />
        {{ t('usr.passwordNote', { section: t('usr.security') }) }}
      </p>
    </div>

    <template #footer>
      <UiButton variant="ghost" @click="passwordOpen = false">{{ t('common.cancel') }}</UiButton>
      <UiButton @click="submitPassword">
        <UiIcon name="check" :size="16" />
        {{ t('common.save') }}
      </UiButton>
    </template>
  </UiModal>
</template>
