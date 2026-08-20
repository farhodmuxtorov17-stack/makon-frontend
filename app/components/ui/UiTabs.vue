<script setup lang="ts">
withDefaults(
  defineProps<{
    tabs: Array<{ value: string; label: string; count?: number }>;
    /** segment: maketdagi kulrang yo‘lakda oq pill; line, pastki chiziqli */
    variant?: "segment" | "line";
  }>(),
  { variant: "segment" },
);

const model = defineModel<string>({ required: true });
</script>

<template>
  <!--
    Tor ekranda yorliqlar qatori sig‘masa, qator o‘zi siljiydi. Ilgari na
    o‘ram, na siljish bor edi: olti yorliqli ro‘yxat telefonda kesilardi va
    oxirgi yorliqqa umuman yetib bo‘lmasdi. `w-max` bo‘lmasa `overflow-x`
    ichidagi `inline-flex` qisqarib ketadi.
  -->
  <div
    v-if="variant === 'segment'"
    class="scroll-slim -mx-1 overflow-x-auto px-1"
  >
    <div
      role="tablist"
      class="inline-flex w-max gap-1 rounded-field bg-ink-100 p-1"
    >
      <button
        v-for="t in tabs"
        :key="t.value"
        role="tab"
        type="button"
        :aria-selected="model === t.value"
        class="inline-flex min-h-11 items-center gap-2 rounded-[8px] px-4 py-2 text-[13px] font-semibold transition-colors md:min-h-9"
        :class="
          model === t.value
            ? 'bg-white text-brand-600 shadow-card'
            : 'text-ink-600 hover:text-ink-800'
        "
        @click="model = t.value"
      >
        {{ t.label }}
        <span
          v-if="t.count !== undefined"
          class="rounded-pill px-1.5 py-0.5 text-[11px] font-bold"
          :class="
            model === t.value
              ? 'bg-brand-50 text-brand-600'
              : 'bg-ink-200 text-ink-600'
          "
        >
          {{ t.count }}
        </span>
      </button>
    </div>
  </div>

  <div v-else class="scroll-slim overflow-x-auto border-b border-ink-200">
    <div role="tablist" class="flex w-max gap-6">
      <button
        v-for="t in tabs"
        :key="t.value"
        role="tab"
        type="button"
        :aria-selected="model === t.value"
        class="relative -mb-px inline-flex min-h-11 items-center gap-2 border-b-2 pb-3 text-sm font-semibold transition-colors md:min-h-0"
        :class="
          model === t.value
            ? 'border-brand-500 text-brand-600'
            : 'border-transparent text-ink-500 hover:text-ink-800'
        "
        @click="model = t.value"
      >
        {{ t.label }}
        <span
          v-if="t.count !== undefined"
          class="rounded-pill bg-ink-100 px-1.5 py-0.5 text-[11px] font-bold text-ink-600"
        >
          {{ t.count }}
        </span>
      </button>
    </div>
  </div>
</template>
