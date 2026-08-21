<script setup lang="ts">
import { scheduleTotals, type LeaseCase } from '~/stores/lease'
import { area, dateShort, timeOf } from '~/utils/format'

const auth = useAuthStore()
const lease = useLeaseStore()
const route = useRoute()
const { t } = useI18n()
const { money, field } = useAppLabels()

/** Ariza turi ma’lumotda o‘zbekcha qiymat sifatida saqlanadi */
const REQUEST_TYPE_KEY: Record<string, string> = {
  'Ijaraga olish': 'common.requestTypeLease',
  'Sotib olish': 'landing.offerSale',
}

function requestTypeLabel(value: string) {
  const key = REQUEST_TYPE_KEY[value]
  return key ? t(key) : value
}

lease.seed()

const organization = computed(() => auth.user?.organization ?? '')

const myCases = computed(() => lease.forOrganization(organization.value))

const selectedId = ref('')

onMounted(() => {
  const created = String(route.query.yangi ?? '')
  selectedId.value = myCases.value.some((c) => c.id === created)
    ? created
    : (myCases.value[0]?.id ?? '')
})

const selected = computed<LeaseCase | null>(
  () => myCases.value.find((c) => c.id === selectedId.value) ?? myCases.value[0] ?? null,
)

const createdCase = computed(() => {
  const created = String(route.query.yangi ?? '')
  return myCases.value.find((c) => c.id === created) ?? null
})

const noticeOpen = ref(true)

/** Didox’da imzo kutayotgan hujjatlar, kabinetdagi eng muhim vazifa */
const awaitingSignature = computed(() =>
  myCases.value.filter((c) => c.status === 'DIDOX_YUBORILDI'),
)

const stats = computed(() => ({
  total: myCases.value.length,
  inProgress: myCases.value.filter((c) => c.status !== 'FAOL' && c.status !== 'RAD_ETILDI').length,
  active: myCases.value.filter((c) => c.status === 'FAOL').length,
  rejected: myCases.value.filter((c) => c.status === 'RAD_ETILDI').length,
}))

const contractOpen = ref(false)

function totalOf(c: LeaseCase) {
  return c.schedule.length ? scheduleTotals(c.schedule).total : c.request.offerPrice
}

const STAGE_HINT = computed<Record<string, string>>(() => ({
  YANGI: t('cab.stageNew'),
  SHARTNOMA_TAYYOR: t('cab.stageContractReady'),
  DIDOX_YUBORILDI: t('cab.stageDidoxSent'),
  DIDOX_IMZOLANDI: t('cab.stageDidoxSigned'),
  FAOL: t('cab.stageActive'),
  RAD_ETILDI: t('cab.stageRejected'),
}))
</script>

<template>
  <AppTopbar
    :title="t('nav.myApplications')"
    :subtitle="t('cab.applicationsCaption')"
    :breadcrumb="[
      { label: t('cab.title'), to: '/cabinet' },
      { label: t('nav.myApplications') },
    ]"
  >
    <template #actions>
      <UiButton variant="secondary" size="sm" to="/catalog">
        <UiIcon name="search" :size="16" />
        {{ t('cab.vacantSpaces') }}
      </UiButton>
      <UiButton size="sm" to="/cabinet/apply">
        <UiIcon name="plus" :size="16" />
        {{ t('cab.newApplication') }}
      </UiButton>
    </template>
  </AppTopbar>

  <main class="scroll-slim flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
    <div
      v-if="createdCase && noticeOpen"
      class="flex items-start gap-3 rounded-card bg-ok-50 px-4 py-3.5 ring-1 ring-inset ring-ok-100"
      role="status"
    >
      <span class="grid size-9 shrink-0 place-items-center rounded-field bg-ok-500 text-white">
        <UiIcon name="check" :size="18" />
      </span>
      <p class="min-w-0 flex-1 text-[14px] text-ok-700">
        <b>{{ createdCase.code }}</b> {{ t('cab.applicationCreatedNotice') }}
      </p>
      <button
        type="button"
        class="shrink-0 rounded-lg p-1.5 text-ok-700 transition-colors hover:bg-ok-100"
        :aria-label="t('common.closeMessage')"
        @click="noticeOpen = false"
      >
        <UiIcon name="x" :size="16" />
      </button>
    </div>

    <!-- Didox’da imzolash kutilmoqda -->
    <section
      v-if="awaitingSignature.length"
      class="rounded-card bg-warn-50 p-5 ring-1 ring-inset ring-warn-100"
    >
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <span class="grid size-10 shrink-0 place-items-center rounded-field bg-warn-500 text-white">
            <UiIcon name="external" :size="20" />
          </span>
          <div class="min-w-0">
            <p class="text-[16px] font-bold text-warn-700">{{ t('cab.didoxWaiting') }}</p>
            <p class="text-[13px] text-ink-600">
              {{ t('cab.didoxWaitingHint') }}
            </p>
          </div>
        </div>
        <span class="rounded-pill bg-white px-3 py-1.5 text-[12px] font-bold text-warn-700">
          {{ t('cab.docCount', { n: awaitingSignature.length }) }}
        </span>
      </div>

      <ul class="mt-4 grid gap-2.5">
        <li v-for="c in awaitingSignature" :key="c.id">
          <button
            type="button"
            class="flex w-full flex-wrap items-center gap-3 rounded-field bg-white px-4 py-3 text-left ring-1 ring-inset ring-warn-100 transition-colors duration-150 hover:ring-warn-200"
            @click="selectedId = c.id"
          >
            <span class="min-w-0 flex-1">
              <span class="block text-[14px] font-bold text-ink-900">
                {{ c.contract?.code ?? c.code }}
              </span>
              <span class="block truncate text-[12px] text-ink-500">
                {{ c.buildingName }} · Unit {{ c.unitCode }} · Didox {{ c.didox?.docNumber }}
              </span>
            </span>
            <span class="tabular shrink-0 text-[13px] font-bold text-ink-900">
              {{ money(totalOf(c)) }}
            </span>
            <UiIcon name="chevronRight" :size="16" class="shrink-0 text-ink-400" />
          </button>
        </li>
      </ul>
    </section>

    <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <UiKpi
        :label="t('kpi.totalApplications')"
        :value="String(stats.total)"
        :unit="t('unitOf.pcs')"
        icon="clipboard"
        tone="brand"
      />
      <UiKpi
        :label="t('tab.inProgress')"
        :value="String(stats.inProgress)"
        :unit="t('unitOf.pcs')"
        icon="clock"
        tone="warn"
      />
      <UiKpi
        :label="t('kpi.activeContract')"
        :value="String(stats.active)"
        :unit="t('unitOf.pcs')"
        icon="check"
        tone="ok"
      />
      <UiKpi
        :label="t('tab.rejected')"
        :value="String(stats.rejected)"
        :unit="t('unitOf.pcs')"
        icon="x"
        tone="danger"
      />
    </section>

    <div v-if="myCases.length" class="grid gap-5 xl:grid-cols-[336px_minmax(0,1fr)]">
      <!-- Ro‘yxat -->
      <aside class="min-w-0 space-y-3">
        <button
          v-for="c in myCases"
          :key="c.id"
          type="button"
          class="block w-full rounded-card bg-surface p-4 text-left shadow-card ring-1 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-pop"
          :class="selected?.id === c.id ? 'ring-2 ring-brand-500' : 'ring-ink-200/60'"
          :aria-pressed="selected?.id === c.id"
          @click="selectedId = c.id"
        >
          <span class="flex items-start justify-between gap-2">
            <span class="min-w-0">
              <span class="block text-[14px] font-bold text-ink-900">{{ c.code }}</span>
              <span class="block truncate text-[12px] text-ink-500">
                {{
                  c.unitId
                    ? `${c.buildingName} · Unit ${c.unitCode}`
                    : t('cab.unitBeingAgreed')
                }}
              </span>
            </span>
            <UiStatus kind="lease" :value="c.status" size="sm" />
          </span>
          <span class="tabular mt-2.5 block text-[13px] font-bold text-brand-700">
            {{ money(totalOf(c)) }}
          </span>
          <span class="mt-1 block text-[12px] leading-snug text-ink-500">
            {{ STAGE_HINT[c.status] }}
          </span>
        </button>
      </aside>

      <!-- Tafsilot -->
      <div v-if="selected" class="min-w-0 space-y-5">
        <UiCard>
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0">
              <h2 class="text-[18px] font-bold text-ink-900">{{ selected.code }}</h2>
              <p class="mt-0.5 text-[13px] text-ink-600">
                {{
                  selected.unitId
                    ? `${selected.buildingName} · Unit ${selected.unitCode} · ${area(selected.area)} · ${selected.floor}-qavat`
                    : t('cab.unitAgreedWithOperator')
                }}
              </p>
            </div>
            <UiButton
              v-if="selected.contract"
              variant="secondary"
              size="sm"
              @click="contractOpen = true"
            >
              <UiIcon name="doc" :size="16" />
              {{ t('cab.viewContract') }}
            </UiButton>
          </div>

          <div class="mt-4">
            <LeaseFlow :status="selected.status" />
          </div>

          <p
            class="mt-4 flex items-start gap-2 rounded-field px-3.5 py-2.5 text-[13px] leading-relaxed ring-1 ring-inset"
            :class="
              selected.status === 'RAD_ETILDI'
                ? 'bg-danger-50 text-danger-700 ring-danger-100'
                : selected.status === 'FAOL'
                  ? 'bg-ok-50 text-ok-700 ring-ok-100'
                  : 'bg-surface-sunken text-ink-700 ring-ink-200'
            "
          >
            <UiIcon
              :name="
                selected.status === 'RAD_ETILDI'
                  ? 'warning'
                  : selected.status === 'FAOL'
                    ? 'check'
                    : 'clock'
              "
              :size="16"
              class="mt-px shrink-0"
            />
            <span>
              {{ STAGE_HINT[selected.status] }}
              <span v-if="selected.status === 'RAD_ETILDI' && selected.rejectReason">, {{ selected.rejectReason }}
              </span>
            </span>
          </p>
        </UiCard>

        <LeaseActivation
          v-if="selected.activation"
          :at="selected.activation.at"
          :changes="selected.activation.changes"
        />

        <UiCard :title="t('cab.requestTerms')" :subtitle="t('cab.yourRequest')" icon="clipboard">
          <dl class="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <div>
              <dt class="text-[12px] text-ink-500">{{ field('applicationType') }}</dt>
              <dd class="mt-0.5 text-[13px] font-semibold text-ink-900">
                {{ requestTypeLabel(selected.request.type) }}
              </dd>
            </div>
            <div>
              <dt class="text-[12px] text-ink-500">{{ field('offerPriceMonthly') }}</dt>
              <dd class="tabular mt-0.5 text-[13px] font-semibold text-ink-900">
                {{ money(selected.request.offerPrice) }}
              </dd>
            </div>
            <div>
              <dt class="text-[12px] text-ink-500">{{ field('startDate') }}</dt>
              <dd class="tabular mt-0.5 text-[13px] font-semibold text-ink-900">
                {{ dateShort(selected.request.startDate) }}
              </dd>
            </div>
            <div>
              <dt class="text-[12px] text-ink-500">{{ field('deadline') }}</dt>
              <dd class="tabular mt-0.5 text-[13px] font-semibold text-ink-900">
                {{ t('apply.termMonths', { count: selected.request.term }) }}
              </dd>
            </div>
            <div>
              <dt class="text-[12px] text-ink-500">{{ field('submitted') }}</dt>
              <dd class="tabular mt-0.5 text-[13px] font-semibold text-ink-900">
                {{ dateShort(selected.request.submittedAt) }}
                {{ timeOf(selected.request.submittedAt) }}
              </dd>
            </div>
            <div>
              <dt class="text-[12px] text-ink-500">{{ field('organization') }}</dt>
              <dd class="mt-0.5 text-[13px] font-semibold text-ink-900">{{ selected.org.name }}</dd>
            </div>
            <div v-if="selected.request.note" class="sm:col-span-2">
              <dt class="text-[12px] text-ink-500">{{ field('comment') }}</dt>
              <dd class="mt-1 rounded-field bg-surface-sunken p-3.5 text-[13px] leading-relaxed text-ink-700">
                {{ selected.request.note }}
              </dd>
            </div>
          </dl>
        </UiCard>

        <UiCard
          v-if="selected.offer"
          :title="t('tour.application.terms.title')"
          :subtitle="t('cab.agreedTermsCaption')"
          icon="wallet"
          tone="teal"
        >
          <LeaseTotals :item="selected" />
        </UiCard>

        <UiCard
          v-if="selected.schedule.length"
          :title="t('cab.paymentSchedule')"
          :subtitle="t('cab.paymentScheduleCaption')"
          icon="calendar"
        >
          <LeaseSchedule :rows="selected.schedule" />
        </UiCard>

        <UiCard
          v-if="selected.didox"
          :title="t('cab.didoxStatus')"
          :subtitle="t('cab.didoxStatusCaption')"
          icon="external"
          tone="info"
        >
          <LeaseDidox :item="selected" :can-check="false" />
        </UiCard>

        <UiCard
          :title="t('cab.applicationHistory')"
          :subtitle="t('cab.applicationHistoryCaption')"
          icon="clipboard"
          tone="neutral"
        >
          <LeaseAudit :entries="selected.audit" />
        </UiCard>
      </div>
    </div>

    <UiCard v-else>
      <UiEmpty
        icon="clipboard"
        :title="t('empty.noApplicationsSent')"
        :description="t('cab.noApplicationsDesc')"
        :action-label="t('landing.ctaCatalog')"
        action-to="/catalog"
      />
    </UiCard>

    <LeaseContractModal v-if="selected" v-model="contractOpen" :item="selected" />
  </main>
</template>
