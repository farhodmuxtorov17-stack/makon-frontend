<script setup lang="ts">
import type { SignedDocument } from '~/stores/lease'
import { fileSize, sha256Bytes } from '~/utils/docx'
import { dateShort, timeOf } from '~/utils/format'

const props = defineProps<{ document: SignedDocument | null; readonly?: boolean }>()

const emit = defineEmits<{
  upload: [file: Omit<SignedDocument, 'uploadedAt' | 'uploadedBy'>]
  remove: []
}>()

const ACCEPTED = ['pdf', 'docx', 'doc']

const input = ref<HTMLInputElement | null>(null)
const error = ref('')
const busy = ref(false)
const copied = ref(false)

function pick() {
  error.value = ''
  input.value?.click()
}

async function onChange(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  target.value = ''
  if (!file) return

  const extension = (file.name.split('.').pop() ?? '').toLowerCase()
  if (!ACCEPTED.includes(extension)) {
    error.value = `«.${extension || '—'}» formati qabul qilinmaydi. Didox’dan olingan imzolangan hujjatni PDF yoki DOCX ko‘rinishida yuklang.`
    return
  }
  if (file.size === 0) {
    error.value = 'Tanlangan fayl bo‘sh — hujjatni qaytadan yuklab oling.'
    return
  }

  error.value = ''
  busy.value = true
  try {
    const buffer = await file.arrayBuffer()
    const hash = await sha256Bytes(buffer)
    emit('upload', {
      fileName: file.name,
      size: file.size,
      mime: file.type || (extension === 'pdf' ? 'application/pdf' : 'application/octet-stream'),
      extension,
      hash,
    })
  } finally {
    busy.value = false
  }
}

async function copyHash() {
  const hash = props.document?.hash
  if (!hash) return
  try {
    await navigator.clipboard.writeText(hash)
    copied.value = true
    setTimeout(() => (copied.value = false), 2200)
  } catch {
    copied.value = false
  }
}
</script>

<template>
  <div>
    <!-- Yuklangan hujjat -->
    <div v-if="document" class="rounded-field bg-ok-50 p-4 ring-1 ring-inset ring-ok-100">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="flex min-w-0 items-start gap-3">
          <span class="grid size-11 shrink-0 place-items-center rounded-field bg-white text-ok-600 ring-1 ring-ok-100">
            <UiIcon name="doc" :size="20" />
          </span>
          <div class="min-w-0">
            <p class="truncate text-[14px] font-bold text-ink-900">{{ document.fileName }}</p>
            <p class="tabular mt-0.5 text-[12px] text-ink-600">
              {{ document.extension.toUpperCase() }} · {{ fileSize(document.size) }} ·
              {{ document.mime || 'application/octet-stream' }}
            </p>
            <p class="tabular mt-0.5 text-[12px] text-ink-500">
              {{ dateShort(document.uploadedAt) }} {{ timeOf(document.uploadedAt) }} ·
              {{ document.uploadedBy }}
            </p>
          </div>
        </div>

        <button
          v-if="!readonly"
          type="button"
          class="grid size-10 shrink-0 place-items-center rounded-field text-ink-500 transition-colors duration-150 hover:bg-white hover:text-danger-600"
          aria-label="Yuklangan hujjatni olib tashlash"
          @click="emit('remove')"
        >
          <UiIcon name="trash" :size="17" />
        </button>
      </div>

      <div class="mt-3 flex flex-wrap items-center gap-2 border-t border-ok-100 pt-3">
        <span class="text-[11.5px] font-semibold uppercase tracking-wide text-ink-500">
          Fayl SHA-256
        </span>
        <code class="tabular min-w-0 truncate rounded-[6px] bg-white px-2 py-1 text-[12px] text-ink-700">
          {{ document.hash.slice(0, 24) }}…{{ document.hash.slice(-8) }}
        </code>
        <button
          type="button"
          class="inline-flex min-h-9 items-center gap-1.5 rounded-field px-2.5 text-[12px] font-semibold text-brand-600 transition-colors duration-150 hover:bg-white"
          aria-label="Nazorat yig‘indisidan nusxa olish"
          @click="copyHash"
        >
          <UiIcon :name="copied ? 'check' : 'clipboard'" :size="14" />
          {{ copied ? 'Nusxalandi' : 'Nusxa olish' }}
        </button>
      </div>
    </div>

    <!-- Yuklash maydoni -->
    <div v-else-if="!readonly">
      <button
        type="button"
        class="flex w-full items-center gap-3.5 rounded-field border border-dashed px-4 py-5 text-left transition-colors duration-150"
        :class="
          error
            ? 'border-danger-300 bg-danger-50 hover:border-danger-400'
            : 'border-ink-300 hover:border-brand-400 hover:bg-brand-50'
        "
        :disabled="busy"
        @click="pick"
      >
        <span
          class="grid size-11 shrink-0 place-items-center rounded-field"
          :class="error ? 'bg-white text-danger-600' : 'bg-ink-100 text-ink-500'"
        >
          <UiIcon :name="busy ? 'refresh' : 'upload'" :size="20" />
        </span>
        <span class="min-w-0">
          <span class="block text-[13.5px] font-semibold text-ink-900">
            {{ busy ? 'Fayl o‘qilmoqda…' : 'Imzolangan hujjatni tanlash' }}
          </span>
          <span class="mt-0.5 block text-[12px] leading-relaxed text-ink-500">
            Didox’dan yuklab olingan PDF yoki DOCX fayl. Tizim fayldan SHA-256 nazorat
            yig‘indisini hisoblaydi.
          </span>
        </span>
      </button>

      <input
        ref="input"
        type="file"
        accept=".pdf,.docx,.doc,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        class="sr-only"
        aria-label="Imzolangan hujjat fayli"
        @change="onChange"
      />

      <p
        v-if="error"
        class="mt-2.5 flex items-start gap-2 rounded-field bg-danger-50 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-danger-700 ring-1 ring-inset ring-danger-100"
        role="alert"
      >
        <UiIcon name="warning" :size="15" class="mt-px shrink-0" />
        {{ error }}
      </p>
    </div>

    <UiEmpty
      v-else
      icon="doc"
      title="Imzolangan hujjat yuklanmagan"
      description="Didox holati «Imzolangan» bo‘lgach, bino rahbari imzolangan nusxani tizimga yuklaydi."
      compact
    />
  </div>
</template>
