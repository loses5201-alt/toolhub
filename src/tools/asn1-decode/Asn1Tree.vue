<script setup lang="ts">
import type { Asn1Node } from '@/features/asn1'

/* ASN.1 結構樹的遞迴節點顯示。 */
defineProps<{ nodes: Asn1Node[]; depth: number }>()

function preview(hex: string): string {
  if (hex.length <= 48) return hex
  return hex.slice(0, 48) + '…(' + hex.length / 2 + ' bytes)'
}
</script>

<template>
  <ul class="space-y-1">
    <li v-for="(node, i) in nodes" :key="i">
      <div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5" :style="{ paddingLeft: depth * 14 + 'px' }">
        <span
          class="font-mono text-xs font-semibold"
          :class="node.constructed ? 'text-brand-700' : 'text-ink-700'"
        >{{ node.tagName }}</span>
        <span class="text-[11px] text-ink-400">({{ node.length }} bytes)</span>
        <span v-if="node.value" class="font-mono text-xs text-ink-800 break-all">{{ node.value }}</span>
        <span
          v-else-if="!node.constructed && node.valueHex"
          class="font-mono text-[11px] text-ink-400 break-all"
        >{{ preview(node.valueHex) }}</span>
        <span v-if="node.error" class="text-[11px] text-rose-600">⚠️ {{ node.error }}</span>
      </div>
      <Asn1Tree v-if="node.children && node.children.length" :nodes="node.children" :depth="depth + 1" />
    </li>
  </ul>
</template>
