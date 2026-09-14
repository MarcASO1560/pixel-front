<script setup lang="ts">
import paintbrushIcon from "@iconify-icons/mdi/paintbrush";
import { Icon } from "@iconify/vue";
import { computed, ref } from "vue";

import type { ProjectPresenceMember } from "../../../lib/realtime";

const props = defineProps<{
  members: ProjectPresenceMember[];
}>();

const failedAvatarIds = ref(new Set<string>());

const displayName = (member: ProjectPresenceMember) =>
  member.username?.trim() || member.email || "Project member";

const initials = (member: ProjectPresenceMember) => {
  const source = member.username?.trim() || member.email.split("@")[0] || "?";
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0]?.[0] || ""}${parts[1]?.[0] || ""}` : source.slice(0, 2))
    .toUpperCase();
};

const hasPixelAvatar = (member: ProjectPresenceMember) =>
  Boolean(member.avatar_pixel_art?.pixels?.length && member.avatar_pixel_art.size > 0);

const canShowImageAvatar = (member: ProjectPresenceMember) =>
  Boolean(member.avatar_url && !failedAvatarIds.value.has(member.id));

const markAvatarFailed = (member: ProjectPresenceMember) => {
  failedAvatarIds.value = new Set([...failedAvatarIds.value, member.id]);
};

const groupLabel = computed(() => {
  if (props.members.length === 1) {
    return `${displayName(props.members[0]!)} is editing this document`;
  }
  return `${props.members.length} people are editing this document`;
});
</script>

<template>
  <span class="project-presence-avatars" role="group" :aria-label="groupLabel">
    <span
      v-for="(member, index) in members"
      :key="member.id"
      class="project-presence-avatar"
      :style="{ zIndex: index + 1 }"
      :title="`${displayName(member)} is editing`"
      role="img"
      :aria-label="`${displayName(member)} is editing`"
    >
      <svg
        v-if="hasPixelAvatar(member)"
        class="project-presence-avatar__pixels"
        :viewBox="`0 0 ${member.avatar_pixel_art?.size || 16} ${member.avatar_pixel_art?.size || 16}`"
        aria-hidden="true"
        shape-rendering="crispEdges"
      >
        <rect
          v-for="(pixel, pixelIndex) in member.avatar_pixel_art?.pixels || []"
          v-show="pixel"
          :key="pixelIndex"
          :x="pixelIndex % (member.avatar_pixel_art?.size || 16)"
          :y="Math.floor(pixelIndex / (member.avatar_pixel_art?.size || 16))"
          width="1"
          height="1"
          :fill="pixel || 'transparent'"
        />
      </svg>
      <img
        v-else-if="canShowImageAvatar(member)"
        :src="member.avatar_url || ''"
        alt=""
        draggable="false"
        referrerpolicy="no-referrer"
        @error="markAvatarFailed(member)"
      />
      <span v-else class="project-presence-avatar__initials" aria-hidden="true">
        {{ initials(member) }}
      </span>
      <Icon
        class="project-presence-avatar__status"
        :icon="paintbrushIcon"
        width="18"
        height="18"
        aria-hidden="true"
      />
    </span>
  </span>
</template>

<style scoped>
  .project-presence-avatars {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    min-width: 0;
    padding-left: 4px;
    isolation: isolate;
  }

  .project-presence-avatar {
    position: relative;
    display: grid;
    flex: 0 0 auto;
    place-items: center;
    width: 32px;
    height: 32px;
    overflow: visible;
    color: #171817;
    background: #c9f56a;
    border: 2px solid #111212;
    border-radius: 50%;
    box-shadow: 0 0 0 1px rgba(255, 252, 244, 0.22);
    transition: transform 140ms ease;
  }

  .project-presence-avatar + .project-presence-avatar {
    margin-left: -9px;
  }

  .project-presence-avatar:hover {
    z-index: 40 !important;
    transform: translateY(-2px);
  }

  .project-presence-avatar img,
  .project-presence-avatar__pixels {
    display: block;
    width: 100%;
    height: 100%;
    overflow: hidden;
    border-radius: inherit;
  }

  .project-presence-avatar img {
    object-fit: cover;
  }

  .project-presence-avatar__initials {
    font-size: 0.58rem;
    font-weight: 900;
    letter-spacing: -0.03em;
    line-height: 1;
  }

  .project-presence-avatar__status {
    position: absolute;
    right: -7px;
    bottom: -6px;
    color: #6ef3a5;
    display: block;
    overflow: visible;
    transform: rotate(180deg);
    filter:
      drop-shadow(0 1px 0 #050605)
      drop-shadow(1px 0 0 #050605)
      drop-shadow(-1px 0 0 #050605);
  }

  @media (max-width: 720px) {
    .project-presence-avatar {
      width: 28px;
      height: 28px;
    }

    .project-presence-avatar + .project-presence-avatar {
      margin-left: -8px;
    }
  }
</style>
