<script setup lang="ts">
import { buildFloorPlan } from '~/utils/floorPlan'
import { unitsOfFloor } from '~/data/units'
import { UNIT_STATUS_COLOR } from '~/constants/statuses'

/**
 * Qavat rejasining ixcham ko'rinishi.
 *
 * Ommaviy sahifada tashrifchi taklif qilinayotgan maydonni haqiqiy reja
 * ustida ko'radi: qaysi qavatda, qaysi burchakda, qo'shnilari kim. Reja
 * tizimdagi bilan bitta generatordan chiqadi, shuning uchun bu chizma
 * bezak emas, o'sha qavatning o'zi.
 */
const props = withDefaults(
  defineProps<{
    buildingId: string
    buildingType: string
    floor: number
    /** Ajratib ko'rsatiladigan unit */
    unitId?: string
    heightClass?: string
  }>(),
  { heightClass: 'h-[92px]' },
)

const units = computed(() => unitsOfFloor(props.buildingId, props.floor))

const plan = computed(() =>
  buildFloorPlan({
    units: units.value.map((u) => ({ id: u.id, code: u.code, area: u.area })),
    buildingType: props.buildingType,
    floor: props.floor,
    underground: props.floor < 0,
  }),
)

const statusOf = computed(() => new Map(units.value.map((u) => [u.id, u.status])))

const shapes = computed(() =>
  plan.value.units.map((u) => ({
    id: u.id,
    points: u.points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' '),
    fill: UNIT_STATUS_COLOR[statusOf.value.get(u.id) ?? 'VACANT'] ?? '#94A2B8',
    active: u.id === props.unitId,
  })),
)

const box = computed(() => `0 0 ${plan.value.width.toFixed(1)} ${plan.value.height.toFixed(1)}`)

/** Chiziq qalinligi qavat o'lchamiga moslashadi */
const stroke = computed(() => Math.max(plan.value.width, plan.value.height) / 260)
</script>

<template>
  <div v-if="shapes.length" :class="heightClass" class="w-full">
    <svg
      :viewBox="box"
      class="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      :aria-label="`${floor}-qavat rejasi`"
    >
      <!-- Qavat plitasi va tashqi devor -->
      <rect
        x="0"
        y="0"
        :width="plan.width"
        :height="plan.height"
        fill="#FFFFFF"
        stroke="#1F2A3A"
        :stroke-width="plan.wallOuter"
      />

      <rect
        v-for="(c, i) in plan.corridors"
        :key="`c-${i}`"
        :x="c.x"
        :y="c.y"
        :width="c.w"
        :height="c.h"
        fill="#EDF1F7"
      />

      <rect
        v-for="(c, i) in plan.core"
        :key="`k-${i}`"
        :x="c.rect.x"
        :y="c.rect.y"
        :width="c.rect.w"
        :height="c.rect.h"
        fill="#E3E9F2"
      />

      <polygon
        v-for="s in shapes"
        :key="s.id"
        :points="s.points"
        :fill="s.fill"
        :fill-opacity="s.active ? 0.55 : 0.14"
        :stroke="s.active ? '#0256F7' : '#54617A'"
        :stroke-width="s.active ? stroke * 3.2 : stroke"
      />
    </svg>
  </div>
</template>
