<script setup lang="ts">
import type { ProtoNode } from '@/features/protobuf'

/* Protobuf 結構樹的遞迴節點顯示。 */
defineProps<{ nodes: ProtoNode[]; depth: number }>()
</script>

<template>
  <ul class="space-y-1.5">
    <li v-for="(node, i) in nodes" :key="i">
      <div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5" :style="{ paddingLeft: depth * 16 + 'px' }">
        <span class="font-mono text-xs font-semibold text-brand-700">#{{ node.fieldNumber }}</span>
        <span class="rounded bg-ink-100 px-1.5 py-0.5 text-[10px] font-medium text-ink-500">{{ node.wireTypeName }}</span>
        <span class="font-mono text-xs text-ink-800 break-all">{{ node.value }}</span>
        <span v-if="node.error" class="text-[11px] text-rose-600">⚠️ {{ node.error }}</span>
      </div>
      <div
        v-if="node.alt && node.alt.length"
        class="font-mono text-[11px] text-ink-400 break-all"
        :style="{ paddingLeft: depth * 16 + 26 + 'px' }"
      >
        {{ node.alt.join('　·　') }}
      </div>
      <div
        v-if="node.asString"
        class="font-mono text-[11px] text-ink-400 break-all"
        :style="{ paddingLeft: depth * 16 + 26 + 'px' }"
      >
        也可當字串:"{{ node.asString }}"
      </div>
      <ProtoTree v-if="node.children && node.children.length" :nodes="node.children" :depth="depth + 1" />
    </li>
  </ul>
</template>
