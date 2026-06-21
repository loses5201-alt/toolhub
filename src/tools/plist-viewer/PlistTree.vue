<script setup lang="ts">
import type { PlistNode } from '@/features/plist'

/* plist 結構樹的遞迴節點顯示(dict 用 entries、array 用 children)。 */
defineProps<{ nodes: PlistNode[]; depth: number }>()

const TYPE_LABEL: Record<string, string> = {
  dict: 'dict', array: 'array', string: 'string', int: 'int', real: 'real',
  bool: 'bool', data: 'data', date: 'date', uid: 'uid', null: 'null', ref: 'ref',
}
</script>

<template>
  <ul class="space-y-1.5">
    <li v-for="(node, i) in nodes" :key="i">
      <div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5" :style="{ paddingLeft: depth * 16 + 'px' }">
        <span class="rounded bg-ink-100 px-1.5 py-0.5 text-[10px] font-medium text-ink-500">{{ TYPE_LABEL[node.type] || node.type }}</span>
        <span
          class="font-mono text-xs break-all"
          :class="['dict', 'array'].includes(node.type) ? 'font-semibold text-brand-700' : 'text-ink-800'"
        >{{ node.value }}</span>
        <span v-if="node.error" class="text-[11px] text-rose-600">⚠️ {{ node.error }}</span>
      </div>
      <!-- array 的內層項目 -->
      <PlistTree v-if="node.children && node.children.length" :nodes="node.children" :depth="depth + 1" />
      <!-- dict 的 key → value 配對 -->
      <ul v-if="node.entries && node.entries.length" class="space-y-1.5">
        <li v-for="(ent, j) in node.entries" :key="j">
          <div class="flex flex-wrap items-baseline gap-x-1.5" :style="{ paddingLeft: (depth + 1) * 16 + 'px' }">
            <span class="font-mono text-xs font-semibold text-ink-600 break-all">{{ ent.key }}</span>
            <span class="text-ink-400">→</span>
            <template v-if="!ent.value.children && !ent.value.entries">
              <span class="rounded bg-ink-100 px-1.5 py-0.5 text-[10px] font-medium text-ink-500">{{ TYPE_LABEL[ent.value.type] || ent.value.type }}</span>
              <span class="font-mono text-xs text-ink-800 break-all">{{ ent.value.value }}</span>
            </template>
            <span v-else class="text-[11px] text-ink-400">(見下方)</span>
          </div>
          <PlistTree v-if="ent.value.children || ent.value.entries" :nodes="[ent.value]" :depth="depth + 2" />
        </li>
      </ul>
    </li>
  </ul>
</template>
