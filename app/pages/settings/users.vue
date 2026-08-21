<script setup lang="ts">
import { USERS, type UserRow } from "~/data/users";
import { BUILDINGS } from "~/data/buildings";
import { ROLE_META, ROLE_TONE_CLASSES } from "~/constants/roles";
import { ROLES, type Role } from "~/types/rbac";
import { ROUTE_ACCESS } from "~/constants/navigation";

const { t } = useI18n();
const {
  tr,
  field,
  columns: labelColumns,
  roleLabel,
  roleCaption,
  cityLabel,
  districtLabel,
} = useAppLabels();

/** Rol kartochkasidagi daraja, ko‘rish sohasi va cheklov matni */
const roleLevel = (r: Role) => tr(`role.${r}.level`, ROLE_META[r].level);
const roleScope = (r: Role) => tr(`role.${r}.scope`, ROLE_META[r].scope);
const roleLimitation = (r: Role) =>
  tr(`role.${r}.limitation`, ROLE_META[r].limitation);

const SETTINGS_TABS = computed(() => [
  { label: t("nav.settingsUsers"), to: "/settings/users", icon: "users" },
  { label: t("nav.settingsRoles"), to: "/settings/roles", icon: "shield" },
  {
    label: t("nav.settingsIntegrations"),
    to: "/settings/integrations",
    icon: "globe",
  },
  {
    label: t("nav.settingsReference"),
    to: "/settings/reference-data",
    icon: "layers",
  },
  { label: t("nav.settingsSystem"), to: "/settings/system", icon: "gear" },
  { label: t("nav.settingsAudit"), to: "/settings/audit", icon: "clipboard" },
]);
const CURRENT_TAB = "/settings/users";

const users = ref<UserRow[]>(USERS.map((u) => ({ ...u })));

const search = ref("");
const roleFilter = ref("all");
const statusFilter = ref("all");

const roleOptions = computed(() => [
  { value: "all", label: t("filter.allRoles") },
  ...ROLES.map((r) => ({ value: r, label: roleLabel(r) })),
]);

const statusOptions = computed(() => [
  { value: "all", label: t("filter.allStatuses") },
  { value: "ACTIVE", label: t("common.active") },
  { value: "INACTIVE", label: t("common.inactive") },
]);

const buildingOptions = BUILDINGS.map((b) => ({ value: b.id, label: b.name }));

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function scopeLabel(u: UserRow) {
  if (u.scopeAll)
    return t("cfg.scopeAll", { a: BUILDINGS.length, b: BUILDINGS.length });
  if (!u.buildings.length) return t("cfg.scopeNone");
  if (u.buildings.length === 1)
    return (
      BUILDINGS.find((b) => b.id === u.buildings[0])?.name ?? field("object")
    );
  return t("cfg.scopeCount", { n: u.buildings.length });
}

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  return users.value.filter((u) => {
    const matchQ =
      !q ||
      u.fullName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.phone.replace(/\s/g, "").includes(q.replace(/\s/g, ""));
    const matchRole = roleFilter.value === "all" || u.role === roleFilter.value;
    const matchStatus =
      statusFilter.value === "all" || u.status === statusFilter.value;
    return matchQ && matchRole && matchStatus;
  });
});

const columns = computed(() =>
  labelColumns([
    { key: "fullName", field: "fullName" },
    { key: "email", field: "emailPhone" },
    { key: "role", field: "role" },
    { key: "scope", field: "buildingScope" },
    { key: "status", field: "status" },
    { key: "lastLogin", field: "lastLogin", align: "right" },
  ]),
);

const rows = computed(() =>
  filtered.value.map((u) => ({
    ...u,
    scope: scopeLabel(u),
    meta: ROLE_META[u.role],
  })),
);

const flash = ref("");

const editOpen = ref(false);
const editTab = ref("main");
const editTabs = computed(() => [
  { value: "main", label: t("cfg.tabMain") },
  { value: "access", label: t("cfg.tabAccess") },
  { value: "prefs", label: t("nav.settings") },
]);

const draft = reactive({
  id: "",
  fullName: "",
  email: "",
  phone: "",
  position: "",
  role: "BUILDING_MANAGER" as Role,
  scopeAll: false,
  buildings: [] as string[],
  status: "ACTIVE" as "ACTIVE" | "INACTIVE",
  notifyInApp: true,
  notifyDigest: false,
  language: "uz",
});

function openEdit(row: Record<string, unknown>) {
  const u = users.value.find((x) => x.id === row.id);
  if (!u) return;
  draft.id = u.id;
  draft.fullName = u.fullName;
  draft.email = u.email;
  draft.phone = u.phone;
  draft.position = u.position;
  draft.role = u.role;
  draft.scopeAll = u.scopeAll;
  draft.buildings = [...u.buildings];
  draft.status = u.status;
  draft.notifyInApp = u.notifyInApp;
  draft.notifyDigest = u.notifyDigest;
  draft.language = u.language;
  editTab.value = "main";
  editOpen.value = true;
}

/** Boshqa dialoglar kabi Escape bilan yopiladi */
onKeyStroke("Escape", () => {
  if (editOpen.value) editOpen.value = false;
});

function toggleDraftBuilding(id: string) {
  const i = draft.buildings.indexOf(id);
  if (i === -1) draft.buildings.push(id);
  else draft.buildings.splice(i, 1);
  if (draft.buildings.length) draft.scopeAll = false;
}

function setScopeAll(value: boolean) {
  draft.scopeAll = value;
  if (value) draft.buildings = [];
}

const draftValid = computed(
  () =>
    draft.fullName.trim().length > 2 && /.+@.+\..+/.test(draft.email.trim()),
);

function saveEdit() {
  if (!draftValid.value) return;
  const i = users.value.findIndex((u) => u.id === draft.id);
  if (i === -1) return;
  const prev = users.value[i]!;
  users.value[i] = {
    ...prev,
    fullName: draft.fullName.trim(),
    email: draft.email.trim(),
    phone: draft.phone.trim(),
    position: draft.position.trim(),
    role: draft.role,
    scopeAll: draft.scopeAll,
    buildings: draft.scopeAll ? [] : [...draft.buildings],
    status: draft.status,
    notifyInApp: draft.notifyInApp,
    notifyDigest: draft.notifyDigest,
    language: draft.language,
  };
  flash.value = t("cfg.userUpdated", { name: users.value[i]!.fullName });
  editOpen.value = false;
}

const AREA_LABEL_KEY: Record<string, string> = {
  "/dashboard/executive": "nav.dashboardExecutive",
  "/dashboard/building": "cfg.areaBuildingPanel",
  "/objects": "nav.objects",
  "/content": "cfg.areaContent",
  "/applications": "nav.applications",
  "/contracts": "nav.contracts",
  "/billing": "nav.billing",
  "/service-requests": "nav.serviceMonitoring",
  "/facility/materials": "nav.materials",
  "/facility": "section.facility",
  "/warehouse": "nav.warehouse",
  "/settings/audit": "nav.settingsAudit",
  "/meters": "nav.meters",
  "/reports": "nav.reports",
  "/settings": "nav.settings",
  "/cabinet": "cfg.areaTenantCabinet",
};

const roleAreas = computed(() =>
  ROUTE_ACCESS.map((r) => ({
    prefix: r.prefix,
    label: tr(AREA_LABEL_KEY[r.prefix], r.prefix),
    allowed: r.roles.includes(draft.role),
  })),
);

const addOpen = ref(false);
const addForm = reactive({
  fullName: "",
  email: "",
  phone: "",
  position: "",
  role: "BUILDING_MANAGER" as Role,
  scopeAll: false,
  buildings: [] as string[],
});
const addTouched = ref(false);

const addValid = computed(
  () =>
    addForm.fullName.trim().length > 2 &&
    /.+@.+\..+/.test(addForm.email.trim()),
);

function openAdd() {
  addForm.fullName = "";
  addForm.email = "";
  addForm.phone = "+998 ";
  addForm.position = "";
  addForm.role = "BUILDING_MANAGER";
  addForm.scopeAll = false;
  addForm.buildings = [];
  addTouched.value = false;
  addOpen.value = true;
}

function setAddScopeAll(value: boolean) {
  addForm.scopeAll = value;
  if (value) addForm.buildings = [];
}

function toggleAddBuilding(id: string) {
  const i = addForm.buildings.indexOf(id);
  if (i === -1) addForm.buildings.push(id);
  else addForm.buildings.splice(i, 1);
  if (addForm.buildings.length) addForm.scopeAll = false;
}

function submitAdd() {
  addTouched.value = true;
  if (!addValid.value) return;
  const next = users.value.length + 1;
  users.value.unshift({
    id: `u-${String(next).padStart(2, "0")}-n`,
    fullName: addForm.fullName.trim(),
    email: addForm.email.trim(),
    phone: addForm.phone.trim(),
    position: addForm.position.trim() || roleLabel(addForm.role),
    role: addForm.role,
    scopeAll: addForm.scopeAll,
    buildings: addForm.scopeAll ? [] : [...addForm.buildings],
    status: "ACTIVE",
    lastLogin: t("cfg.neverLoggedIn"),
    notifyInApp: true,
    notifyDigest:
      addForm.role === "SUPER_HEAD" || addForm.role === "ACCOUNTANT",
    language: "uz",
  });
  flash.value = t("cfg.userAdded", { name: addForm.fullName.trim() });
  addOpen.value = false;
}

function toggleStatus(id: string) {
  const u = users.value.find((x) => x.id === id);
  if (!u) return;
  u.status = u.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
  flash.value = t("cfg.userStatusChanged", {
    name: u.fullName,
    status: u.status === "ACTIVE" ? t("common.active") : t("common.inactive"),
  });
}
</script>

<template>
  <AppTopbar
    :title="t('nav.settingsUsers')"
    :subtitle="t('cfg.usersCaption')"
    :breadcrumb="[
      { label: t('nav.settings'), to: '/settings/users' },
      { label: t('nav.settingsUsers') },
    ]"
  >
    <template #actions>
      <UiButton size="sm" @click="openAdd">
        <UiIcon name="plus" :size="16" />
        {{ t("cfg.addUser") }}
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
      v-if="flash"
      class="flex items-start gap-2.5 rounded-card bg-ok-50 px-4 py-3 text-[13px] text-ok-700 ring-1 ring-ok-100"
    >
      <UiIcon name="check" :size="17" class="mt-0.5 shrink-0" />
      <span class="min-w-0 flex-1">{{ flash }}</span>
      <button
        type="button"
        class="shrink-0 rounded-[6px] p-1 text-ok-700 transition-colors hover:bg-ok-100"
        :aria-label="t('common.dismiss')"
        @click="flash = ''"
      >
        <UiIcon name="x" :size="15" />
      </button>
    </div>

    <UiCard
      :title="t('cfg.usersList')"
      :subtitle="
        t('cfg.totalShown', { total: users.length, shown: filtered.length })
      "
      flush
    >
      <div
        class="grid gap-3 px-5 pb-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_220px_200px]"
      >
        <UiInput v-model="search" :placeholder="t('cfg.userSearchPlaceholder')">
          <template #prefix><UiIcon name="search" :size="17" /></template>
        </UiInput>
        <UiSelect v-model="roleFilter" :options="roleOptions" />
        <UiSelect v-model="statusFilter" :options="statusOptions" />
      </div>

      <UiTable
        :columns="columns"
        :rows="rows"
        :empty="t('empty.noUsers')"
        @row-click="openEdit"
      >
        <template #cell-fullName="{ row }">
          <span class="flex items-center gap-3">
            <UiAvatar
              :user-id="row.id"
              :full-name="row.fullName"
              :role="row.role"
              size="sm"
            />
            <span class="min-w-0">
              <span
                class="block truncate text-[14px] font-semibold text-ink-900"
              >
                {{ row.fullName }}
              </span>
              <span class="block truncate text-[12px] text-ink-500">{{
                row.position
              }}</span>
            </span>
          </span>
        </template>

        <template #cell-email="{ row }">
          <span class="block text-[13px] text-ink-800">{{ row.email }}</span>
          <span class="tabular block text-[12px] text-ink-500">{{
            row.phone
          }}</span>
        </template>

        <template #cell-role="{ row }">
          <span
            class="inline-flex items-center rounded-pill px-2.5 py-1 text-xs font-semibold ring-1 ring-inset"
            :class="ROLE_TONE_CLASSES[row.meta.tone]"
          >
            {{ roleLabel(row.role) }}
          </span>
        </template>

        <template #cell-scope="{ row }">
          <span class="text-[13px] text-ink-700">{{ row.scope }}</span>
        </template>

        <template #cell-status="{ row }">
          <button
            type="button"
            class="inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs font-semibold ring-1 ring-inset transition-colors"
            :class="
              row.status === 'ACTIVE'
                ? 'bg-ok-50 text-ok-700 ring-ok-100 hover:bg-ok-100'
                : 'bg-ink-100 text-ink-700 ring-ink-200 hover:bg-ink-200'
            "
            :title="
              row.status === 'ACTIVE' ? t('cfg.deactivate') : t('cfg.activate')
            "
            @click.stop="toggleStatus(row.id)"
          >
            <svg class="size-3 shrink-0" viewBox="0 0 12 12" aria-hidden="true">
              <circle
                v-if="row.status === 'ACTIVE'"
                cx="6"
                cy="6"
                r="4"
                fill="currentColor"
              />
              <circle
                v-else
                cx="6"
                cy="6"
                r="3.6"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              />
            </svg>
            {{
              row.status === "ACTIVE"
                ? t("common.active")
                : t("common.inactive")
            }}
          </button>
        </template>

        <template #cell-lastLogin="{ row }">
          <span class="tabular text-[13px] text-ink-600">{{
            row.lastLogin
          }}</span>
        </template>
      </UiTable>
    </UiCard>

    <UiCard
      :title="t('cfg.permissionHierarchy')"
      :subtitle="t('cfg.permissionHierarchyCaption')"
    >
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div
          v-for="r in ROLES"
          :key="r"
          class="rounded-field p-4 ring-1 ring-ink-200"
        >
          <div class="flex items-center gap-2.5">
            <span
              class="inline-flex items-center rounded-pill px-2.5 py-1 text-xs font-semibold ring-1 ring-inset"
              :class="ROLE_TONE_CLASSES[ROLE_META[r].tone]"
            >
              {{ roleLabel(r) }}
            </span>
            <span class="tabular text-[12px] font-semibold text-ink-500">
              {{ users.filter((u) => u.role === r).length }}
              {{ t("unitOf.pcs") }}
            </span>
          </div>
          <p class="mt-2 text-[13px] leading-relaxed text-ink-600">
            {{ roleCaption(r) }}
          </p>
          <button
            type="button"
            class="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-600 transition-colors hover:text-brand-700"
            @click="roleFilter = r"
          >
            {{ t("cfg.showRoleUsers") }}
            <UiIcon name="arrowRight" :size="14" />
          </button>
        </div>
      </div>
    </UiCard>

    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-150 ease-out"
        enter-from-class="opacity-0"
        leave-active-class="transition duration-100 ease-in"
        leave-to-class="opacity-0"
      >
        <div
          v-if="editOpen"
          class="fixed inset-0 z-50 flex justify-end bg-ink-900/40 backdrop-blur-[2px]"
          @click.self="editOpen = false"
        >
          <aside
            class="flex h-full w-full max-w-lg flex-col bg-surface shadow-pop"
            role="dialog"
            aria-modal="true"
            :aria-label="t('cfg.editUser')"
          >
            <header
              class="flex items-start justify-between gap-4 border-b border-ink-200 px-6 py-5"
            >
              <div class="min-w-0">
                <h2 class="text-lg font-bold text-ink-900">
                  {{ t("cfg.editUser") }}
                </h2>
                <p class="mt-0.5 truncate text-[13px] text-ink-500">
                  {{ draft.email }}
                </p>
              </div>
              <button
                type="button"
                class="-mr-1 -mt-1 rounded-lg p-2 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
                :aria-label="t('common.close')"
                @click="editOpen = false"
              >
                <UiIcon name="x" :size="18" />
              </button>
            </header>

            <div
              class="flex items-center gap-3.5 border-b border-ink-100 px-6 py-4"
            >
              <UiAvatar
                :user-id="draft.id"
                :full-name="draft.fullName"
                :role="draft.role"
                size="lg"
                ring
              />
              <div class="min-w-0">
                <p class="truncate text-[16px] font-bold text-ink-900">
                  {{ draft.fullName }}
                </p>
                <div class="mt-1.5 flex flex-wrap items-center gap-2">
                  <span
                    class="inline-flex items-center rounded-pill px-2.5 py-1 text-xs font-semibold ring-1 ring-inset"
                    :class="ROLE_TONE_CLASSES[ROLE_META[draft.role].tone]"
                  >
                    {{ roleLabel(draft.role) }}
                  </span>
                  <span
                    class="inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs font-semibold ring-1 ring-inset"
                    :class="
                      draft.status === 'ACTIVE'
                        ? 'bg-ok-50 text-ok-700 ring-ok-100'
                        : 'bg-ink-100 text-ink-700 ring-ink-200'
                    "
                  >
                    <svg class="size-3" viewBox="0 0 12 12" aria-hidden="true">
                      <circle
                        v-if="draft.status === 'ACTIVE'"
                        cx="6"
                        cy="6"
                        r="4"
                        fill="currentColor"
                      />
                      <circle
                        v-else
                        cx="6"
                        cy="6"
                        r="3.6"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                      />
                    </svg>
                    {{
                      draft.status === "ACTIVE"
                        ? t("common.active")
                        : t("common.inactive")
                    }}
                  </span>
                </div>
              </div>
            </div>

            <div class="px-6 pt-4">
              <UiTabs v-model="editTab" :tabs="editTabs" variant="line" />
            </div>

            <div class="scroll-slim flex-1 space-y-5 overflow-y-auto px-6 py-5">
              <template v-if="editTab === 'main'">
                <UiField
                  :label="field('fullName')"
                  required
                  :error="
                    draft.fullName.trim().length > 2
                      ? ''
                      : t('common.minChars', { n: 3 })
                  "
                >
                  <UiInput v-model="draft.fullName" />
                </UiField>
                <UiField
                  :label="t('common.email')"
                  required
                  :error="
                    /.+@.+\..+/.test(draft.email) ? '' : t('cfg.invalidEmail')
                  "
                >
                  <UiInput v-model="draft.email" type="email" />
                </UiField>
                <UiField :label="t('common.phone')">
                  <UiInput v-model="draft.phone" />
                </UiField>
                <UiField :label="field('position')">
                  <UiInput v-model="draft.position" />
                </UiField>
                <div>
                  <UiField :label="field('role')">
                    <UiSelect
                      v-model="draft.role"
                      :options="
                        ROLES.map((r) => ({ value: r, label: roleLabel(r) }))
                      "
                    />
                  </UiField>
                  <p
                    class="mt-2 flex items-start gap-2 rounded-field bg-warn-50 px-3 py-2.5 text-[13px] leading-relaxed text-warn-700 ring-1 ring-inset ring-warn-100"
                  >
                    <UiIcon name="lock" :size="15" class="mt-0.5 shrink-0" />
                    <span class="min-w-0">
                      <b class="font-semibold">{{ t("cfg.limitation") }}</b>
                      {{ roleLimitation(draft.role) }}
                    </span>
                  </p>
                  <p class="mt-1.5 text-[12px] text-ink-500">
                    {{ roleLevel(draft.role) }} · {{ roleScope(draft.role) }}.
                    {{ t("cfg.roleChangeNote") }}
                  </p>
                </div>
              </template>

              <template v-else-if="editTab === 'access'">
                <div>
                  <p class="text-[13px] font-semibold text-ink-700">
                    {{ field("buildingScope") }}
                  </p>
                  <div class="mt-2.5 space-y-2">
                    <label
                      class="flex cursor-pointer items-start gap-3 rounded-field p-3 ring-1 ring-inset transition-colors"
                      :class="
                        draft.scopeAll
                          ? 'bg-brand-50 ring-brand-300'
                          : 'ring-ink-200 hover:ring-ink-300'
                      "
                    >
                      <input
                        type="radio"
                        class="mt-0.5 size-4 shrink-0 accent-brand-500"
                        :checked="draft.scopeAll"
                        @change="setScopeAll(true)"
                      />
                      <span>
                        <span
                          class="block text-[14px] font-semibold text-ink-900"
                        >
                          {{
                            t("cfg.allObjectsCount", {
                              a: BUILDINGS.length,
                              b: BUILDINGS.length,
                            })
                          }}
                        </span>
                        <span class="block text-[12px] text-ink-500">
                          {{ t("cfg.scopeAllHint") }}
                        </span>
                      </span>
                    </label>

                    <label
                      class="flex cursor-pointer items-start gap-3 rounded-field p-3 ring-1 ring-inset transition-colors"
                      :class="
                        !draft.scopeAll
                          ? 'bg-brand-50 ring-brand-300'
                          : 'ring-ink-200 hover:ring-ink-300'
                      "
                    >
                      <input
                        type="radio"
                        class="mt-0.5 size-4 shrink-0 accent-brand-500"
                        :checked="!draft.scopeAll"
                        @change="setScopeAll(false)"
                      />
                      <span>
                        <span
                          class="block text-[14px] font-semibold text-ink-900"
                        >
                          {{ t("cfg.scopeSelected") }}
                        </span>
                        <span class="block text-[12px] text-ink-500">
                          {{ t("cfg.scopeSelectedHint") }}
                        </span>
                      </span>
                    </label>
                  </div>

                  <ul class="mt-3 space-y-1.5">
                    <li v-for="b in BUILDINGS" :key="b.id">
                      <label
                        class="flex cursor-pointer items-center gap-3 rounded-field px-3 py-2.5 ring-1 ring-inset transition-colors"
                        :class="
                          draft.buildings.includes(b.id)
                            ? 'bg-brand-50/60 ring-brand-200'
                            : 'ring-ink-200 hover:ring-ink-300'
                        "
                      >
                        <input
                          type="checkbox"
                          class="size-4 shrink-0 accent-brand-500"
                          :checked="draft.buildings.includes(b.id)"
                          @change="toggleDraftBuilding(b.id)"
                        />
                        <span class="min-w-0 flex-1">
                          <span
                            class="block truncate text-[13px] font-semibold text-ink-900"
                          >
                            {{ b.name }}
                          </span>
                          <span class="block truncate text-[12px] text-ink-500">
                            {{ cityLabel(b.city) }},
                            {{ districtLabel(b.district) }}
                          </span>
                        </span>
                        <span
                          v-if="draft.buildings.includes(b.id)"
                          class="shrink-0 text-[12px] font-semibold text-brand-600"
                        >
                          {{ t("cfg.attached") }}
                        </span>
                      </label>
                    </li>
                  </ul>

                  <p
                    v-if="draft.scopeAll"
                    class="mt-2.5 text-[12px] text-ink-500"
                  >
                    {{ t("cfg.scopeAllNote") }}
                  </p>
                </div>

                <div>
                  <p class="text-[13px] font-semibold text-ink-700">
                    {{ t("cfg.openAreasFor", { role: roleLabel(draft.role) }) }}
                  </p>
                  <ul class="mt-2.5 grid gap-1.5 sm:grid-cols-2">
                    <li
                      v-for="a in roleAreas"
                      :key="a.prefix"
                      class="flex items-center gap-2 rounded-[8px] px-2.5 py-1.5 text-[13px]"
                      :class="
                        a.allowed
                          ? 'bg-ok-50 text-ok-700'
                          : 'bg-ink-100 text-ink-500'
                      "
                    >
                      <UiIcon :name="a.allowed ? 'check' : 'x'" :size="14" />
                      <span class="truncate">{{ a.label }}</span>
                    </li>
                  </ul>
                  <NuxtLink
                    to="/settings/roles"
                    class="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-600 hover:text-brand-700"
                  >
                    {{ t("cfg.openMatrix") }}
                    <UiIcon name="arrowRight" :size="14" />
                  </NuxtLink>
                </div>
              </template>

              <template v-else>
                <div class="space-y-2">
                  <button
                    type="button"
                    class="flex w-full items-center justify-between gap-3 rounded-field px-4 py-3 text-left ring-1 ring-inset ring-ink-200 transition-colors hover:ring-ink-300"
                    @click="
                      draft.status =
                        draft.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
                    "
                  >
                    <span>
                      <span
                        class="block text-[14px] font-semibold text-ink-900"
                      >
                        {{ t("cfg.accountState") }}
                      </span>
                      <span class="block text-[12px] text-ink-500">
                        {{ t("cfg.inactiveAccountHint") }}
                      </span>
                    </span>
                    <span
                      class="inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs font-semibold ring-1 ring-inset"
                      :class="
                        draft.status === 'ACTIVE'
                          ? 'bg-ok-50 text-ok-700 ring-ok-100'
                          : 'bg-ink-100 text-ink-700 ring-ink-200'
                      "
                    >
                      {{
                        draft.status === "ACTIVE"
                          ? t("common.active")
                          : t("common.inactive")
                      }}
                    </span>
                  </button>

                  <button
                    type="button"
                    class="flex w-full items-center justify-between gap-3 rounded-field px-4 py-3 text-left ring-1 ring-inset ring-ink-200 transition-colors hover:ring-ink-300"
                    @click="draft.notifyInApp = !draft.notifyInApp"
                  >
                    <span class="text-[14px] font-semibold text-ink-900">
                      {{ t("cfg.inAppNotifications") }}
                    </span>
                    <span
                      class="inline-flex h-6 w-11 shrink-0 items-center rounded-pill p-0.5 transition-colors"
                      :class="draft.notifyInApp ? 'bg-brand-500' : 'bg-ink-300'"
                    >
                      <span
                        class="size-5 rounded-full bg-white transition-transform"
                        :class="draft.notifyInApp ? 'translate-x-5' : ''"
                      />
                    </span>
                  </button>

                  <button
                    type="button"
                    class="flex w-full items-center justify-between gap-3 rounded-field px-4 py-3 text-left ring-1 ring-inset ring-ink-200 transition-colors hover:ring-ink-300"
                    @click="draft.notifyDigest = !draft.notifyDigest"
                  >
                    <span>
                      <span
                        class="block text-[14px] font-semibold text-ink-900"
                      >
                        {{ t("cfg.dailyReportDigest") }}
                      </span>
                      <span class="block text-[12px] text-ink-500">{{
                        t("cfg.shownInSystem")
                      }}</span>
                    </span>
                    <span
                      class="inline-flex h-6 w-11 shrink-0 items-center rounded-pill p-0.5 transition-colors"
                      :class="
                        draft.notifyDigest ? 'bg-brand-500' : 'bg-ink-300'
                      "
                    >
                      <span
                        class="size-5 rounded-full bg-white transition-transform"
                        :class="draft.notifyDigest ? 'translate-x-5' : ''"
                      />
                    </span>
                  </button>
                </div>

                <UiField
                  :label="t('common.language')"
                  :hint="t('cfg.userLanguageHint')"
                >
                  <UiSelect
                    v-model="draft.language"
                    :options="[
                      { value: 'uz', label: t('shell.localeUz') },
                      { value: 'ru', label: t('shell.localeRu') },
                    ]"
                  />
                </UiField>
              </template>
            </div>

            <footer
              class="flex items-center justify-end gap-3 border-t border-ink-200 bg-surface-sunken px-6 py-4"
            >
              <UiButton variant="ghost" @click="editOpen = false">{{
                t("common.cancel")
              }}</UiButton>
              <UiButton :disabled="!draftValid" @click="saveEdit">{{
                t("common.save")
              }}</UiButton>
            </footer>
          </aside>
        </div>
      </Transition>
    </Teleport>

    <UiModal
      v-model="addOpen"
      :title="t('cfg.addUser')"
      :subtitle="t('cfg.addUserCaption')"
    >
      <div class="space-y-4">
        <UiField
          :label="field('fullName')"
          required
          :error="
            addTouched && addForm.fullName.trim().length < 3
              ? t('common.minChars', { n: 3 })
              : ''
          "
        >
          <UiInput
            v-model="addForm.fullName"
            :placeholder="t('cfg.nameExample')"
          />
        </UiField>

        <div class="grid gap-4 sm:grid-cols-2">
          <UiField
            :label="t('common.email')"
            required
            :error="
              addTouched && !/.+@.+\..+/.test(addForm.email)
                ? t('cfg.invalidEmail')
                : ''
            "
          >
            <UiInput
              v-model="addForm.email"
              type="email"
              placeholder="a.sobirov@makon.uz"
            />
          </UiField>
          <UiField :label="t('common.phone')">
            <UiInput v-model="addForm.phone" placeholder="+998 90 000 00 00" />
          </UiField>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <UiField :label="field('position')">
            <UiInput
              v-model="addForm.position"
              :placeholder="t('cfg.positionExample')"
            />
          </UiField>
          <UiField :label="field('role')" required>
            <UiSelect
              v-model="addForm.role"
              :options="ROLES.map((r) => ({ value: r, label: roleLabel(r) }))"
            />
          </UiField>
        </div>

        <div>
          <p class="mb-2 text-[13px] font-semibold text-ink-700">
            {{ field("buildingScope") }}
          </p>
          <label
            class="mb-2 flex cursor-pointer items-center gap-2.5 text-[13px] text-ink-700"
          >
            <input
              type="radio"
              class="size-4 accent-brand-500"
              :checked="addForm.scopeAll"
              @change="setAddScopeAll(true)"
            />
            {{ t("landing.allObjects") }}
          </label>
          <label
            class="mb-2 flex cursor-pointer items-center gap-2.5 text-[13px] text-ink-700"
          >
            <input
              type="radio"
              class="size-4 accent-brand-500"
              :checked="!addForm.scopeAll"
              @change="setAddScopeAll(false)"
            />
            {{ t("cfg.scopeSelected") }}
          </label>

          <div class="grid gap-1.5 sm:grid-cols-2">
            <label
              v-for="b in buildingOptions"
              :key="b.value"
              class="flex cursor-pointer items-center gap-2.5 rounded-field px-3 py-2 text-[13px] ring-1 ring-inset transition-colors"
              :class="
                addForm.buildings.includes(b.value)
                  ? 'bg-brand-50/60 text-ink-900 ring-brand-200'
                  : 'text-ink-700 ring-ink-200 hover:ring-ink-300'
              "
            >
              <input
                type="checkbox"
                class="size-4 shrink-0 accent-brand-500"
                :checked="addForm.buildings.includes(b.value)"
                @change="toggleAddBuilding(b.value)"
              />
              <span class="truncate">{{ b.label }}</span>
            </label>
          </div>
        </div>
      </div>

      <template #footer>
        <UiButton variant="ghost" @click="addOpen = false">{{
          t("common.cancel")
        }}</UiButton>
        <UiButton @click="submitAdd">
          <UiIcon name="plus" :size="16" />
          {{ t("common.add") }}
        </UiButton>
      </template>
    </UiModal>
  </main>
</template>
