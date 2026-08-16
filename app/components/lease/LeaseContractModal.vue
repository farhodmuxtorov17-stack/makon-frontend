<script setup lang="ts">
import { contractDocx, type LeaseCase } from '~/stores/lease'
import { saveBlob } from '~/utils/docx'
import { dateShort, sum } from '~/utils/format'

const props = defineProps<{ item: LeaseCase }>()
const open = defineModel<boolean>({ required: true })

const downloaded = ref('')

const doc = computed(() => props.item.contract)

function download() {
  const d = doc.value
  if (!d) return
  const fileName = `${d.code}.docx`
  saveBlob(contractDocx(d), fileName)
  downloaded.value = fileName
}
</script>

<template>
  <UiModal
    v-model="open"
    :title="doc ? `Ijara shartnomasi № ${doc.code}` : 'Shartnoma qoralamasi'"
    :subtitle="`${item.buildingName} · Unit ${item.unitCode} · ${item.org.name}`"
    size="lg"
  >
    <div v-if="doc" class="space-y-5">
      <div class="rounded-field bg-surface-sunken px-4 py-3.5 ring-1 ring-inset ring-ink-200">
        <p class="text-[11.5px] font-semibold uppercase tracking-wide text-ink-500">Hujjat</p>
        <p class="mt-1 text-[15px] font-bold text-ink-900">Ijara shartnomasi № {{ doc.code }}</p>
        <p class="tabular mt-0.5 text-[12.5px] text-ink-600">
          Tuzilgan sana {{ dateShort(doc.composedAt) }} · amal qilish muddati
          {{ dateShort(doc.startsAt) }} · {{ dateShort(doc.endsAt) }}
        </p>
      </div>

      <section>
        <h3 class="text-[11.5px] font-semibold uppercase tracking-wide text-ink-500">Tomonlar</h3>
        <div class="mt-2.5 grid gap-3 sm:grid-cols-2">
          <div
            v-for="p in [doc.landlord, doc.tenant]"
            :key="p.role"
            class="rounded-field p-4 ring-1 ring-ink-200"
          >
            <p class="text-[12px] font-semibold text-brand-600">{{ p.role }}</p>
            <p class="mt-1 text-[14px] font-bold text-ink-900">{{ p.name }}</p>
            <dl class="mt-2.5 space-y-1.5">
              <div
                v-for="r in [
                  { l: 'STIR', v: p.tin },
                  { l: 'Vakil', v: p.director },
                  { l: 'Telefon', v: p.phone },
                  { l: 'E-pochta', v: p.email },
                  { l: 'Manzil', v: p.address },
                ]"
                :key="r.l"
                class="flex items-start justify-between gap-3"
              >
                <dt class="shrink-0 text-[12px] text-ink-500">{{ r.l }}</dt>
                <dd class="min-w-0 text-right text-[12.5px] font-semibold text-ink-800">
                  {{ r.v }}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      <section>
        <h3 class="text-[11.5px] font-semibold uppercase tracking-wide text-ink-500">
          Ijara obyekti
        </h3>
        <dl class="mt-2.5 grid gap-x-6 sm:grid-cols-2">
          <div
            v-for="r in doc.object"
            :key="r.label"
            class="flex items-baseline justify-between gap-3 border-b border-ink-100 py-2.5 last:border-0"
          >
            <dt class="text-[12.5px] text-ink-500">{{ r.label }}</dt>
            <dd class="tabular text-right text-[13px] font-semibold text-ink-900">{{ r.value }}</dd>
          </div>
        </dl>
      </section>

      <section>
        <h3 class="text-[11.5px] font-semibold uppercase tracking-wide text-ink-500">
          Moliyaviy shartlar
        </h3>
        <dl class="mt-2.5 grid gap-x-6 sm:grid-cols-2">
          <div
            v-for="r in doc.terms"
            :key="r.label"
            class="flex items-baseline justify-between gap-3 border-b border-ink-100 py-2.5 last:border-0"
          >
            <dt class="text-[12.5px] text-ink-500">{{ r.label }}</dt>
            <dd class="tabular text-right text-[13px] font-semibold text-ink-900">{{ r.value }}</dd>
          </div>
        </dl>
      </section>

      <section>
        <h3 class="text-[11.5px] font-semibold uppercase tracking-wide text-ink-500">
          To‘lov grafigi
        </h3>
        <ul class="mt-2.5 divide-y divide-ink-100 rounded-field ring-1 ring-ink-200">
          <li
            v-for="r in doc.schedule"
            :key="r.id"
            class="flex items-center justify-between gap-3 px-4 py-2.5"
          >
            <span class="min-w-0">
              <span class="tabular block text-[12px] text-ink-500">{{ dateShort(r.dueAt) }}</span>
              <span class="block truncate text-[13px] font-semibold text-ink-800">{{ r.label }}</span>
            </span>
            <span class="tabular shrink-0 text-[13px] font-bold text-ink-900">{{ sum(r.total) }}</span>
          </li>
        </ul>
      </section>

      <section>
        <h3 class="text-[11.5px] font-semibold uppercase tracking-wide text-ink-500">
          Shartnoma bandlari
        </h3>
        <ol class="mt-2.5 space-y-3">
          <li v-for="(c, i) in doc.clauses" :key="c.title" class="flex gap-3">
            <span
              class="tabular grid size-6 shrink-0 place-items-center rounded-full bg-brand-50 text-[11px] font-bold text-brand-700"
            >
              {{ i + 1 }}
            </span>
            <span class="min-w-0">
              <span class="block text-[13px] font-semibold text-ink-900">{{ c.title }}</span>
              <span class="mt-0.5 block text-[12.5px] leading-relaxed text-ink-600">{{ c.text }}</span>
            </span>
          </li>
        </ol>
      </section>

      <p
        v-if="downloaded"
        class="flex items-center gap-2 rounded-field bg-ok-50 px-3.5 py-2.5 text-[12.5px] font-semibold text-ok-700 ring-1 ring-inset ring-ok-100"
      >
        <UiIcon name="check" :size="15" />
        {{ downloaded }} fayli yuklab olindi
      </p>
    </div>

    <template #footer>
      <UiButton variant="ghost" @click="open = false">Yopish</UiButton>
      <UiButton :disabled="!doc" @click="download">
        <UiIcon name="download" :size="16" />
        DOCX yuklab olish
      </UiButton>
    </template>
  </UiModal>
</template>
