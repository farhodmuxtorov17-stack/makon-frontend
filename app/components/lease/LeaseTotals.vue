<script setup lang="ts">
import { scheduleTotals, serviceTotalOf, type LeaseCase } from "~/stores/lease";
import { num } from "~/utils/format";

const { money, t } = useAppLabels();

const props = defineProps<{ item: LeaseCase }>();

const tiles = computed(() => {
  const offer = props.item.offer;
  if (!offer) return [];
  const totals = scheduleTotals(props.item.schedule);
  const service = serviceTotalOf(offer, props.item.area);
  const yearly = (offer.monthlyRent + service) * 12;

  return [
    {
      label: t("lease.monthlyRent"),
      value: money(offer.monthlyRent),
      tone: "text-ink-900",
    },
    {
      label: t("lease.serviceMonthly"),
      value: money(service),
      hint: `${num(offer.servicePerSqm)} ${t("priceUnit.perSqm")} × ${num(props.item.area, 2)} m²`,
      tone: "text-ink-900",
    },
    {
      label: t("lease.deposit"),
      value: money(offer.deposit),
      tone: "text-warn-700",
    },
    {
      label: t("lease.yearlyTotal"),
      value: money(yearly),
      tone: "text-ink-900",
    },
    {
      label: t("lease.contractTotal", { months: props.item.request.term }),
      value: money(totals.total),
      tone: "text-brand-700",
    },
    {
      label: "To‘lov davriyligi",
      value: offer.periodicity,
      tone: "text-ink-900",
    },
  ];
});
</script>

<template>
  <dl v-if="tiles.length" class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
    <div
      v-for="t in tiles"
      :key="t.label"
      class="rounded-field bg-surface-sunken px-4 py-3 ring-1 ring-inset ring-ink-200"
    >
      <dt
        class="text-[12px] font-semibold uppercase tracking-wide text-ink-500"
      >
        {{ t.label }}
      </dt>
      <dd
        class="tabular mt-1 text-[16px] font-bold leading-tight"
        :class="t.tone"
      >
        {{ t.value }}
      </dd>
      <dd v-if="t.hint" class="tabular mt-0.5 text-[12px] text-ink-500">
        {{ t.hint }}
      </dd>
    </div>
  </dl>

  <UiEmpty
    v-else
    icon="wallet"
    title="Kommersiya taklifi tuzilmagan"
    description="Bino rahbari shartlarni kiritgach, moliyaviy jamlanma shu yerda ko‘rinadi."
    compact
  />
</template>
