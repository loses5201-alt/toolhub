<script setup lang="ts">
import type { PhpNode } from '@/features/phpSerialize'

/* PHP serialize 結構樹的遞迴節點顯示(array / object 用 entries 鍵值對)。 */
defineProps<{ nodes: PhpNode[]; depth: number }>()

const isContainer = (n: PhpNode) => n.type === 'array' || n.type === 'object'
</script>

<template>
  <ul class="space-y-1.5">
    <li v-for="(node, i) in nodes" :key="i">
      <div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5" :style="{ paddingLeft: depth * 16 + 'px' }">
        <span class="rounded bg-ink-100 px-1.5 py-0.5 text-[10px] font-medium text-ink-500">{{ node.type }}</span>
        <span
          class="font-mono text-xs break-all"
          :class="isContainer(node) ? 'font-semibold text-brand-700' : 'text-ink-800'"
        >{{ node.value }}</span>
        <span v-if="node.error" class="text-[11px] text-rose-600">⚠️ {{ node.error }}</span>
      </div>
      <ul v-if="node.entries && node.entries.length" class="space-y-1.5">
        <li v-for="(ent, j) in node.entries" :key="j">
          <div class="flex flex-wrap items-baseline gap-x-1.5" :style="{ paddingLeft: (depth + 1) * 16 + 'px' }">
            <span class="font-mono text-xs font-semibold text-ink-600 break-all">{{ ent.key.value }}</span>
            <span
              v-if="ent.visibility"
              class="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700"
            >{{ ent.visibility }}</span>
            <span class="text-ink-400">→</span>
            <template v-if="!ent.value.entries">
              <span class="rounded bg-ink-100 px-1.5 py-0.5 text-[10px] font-medium text-ink-500">{{ ent.value.type }}</span>
              <span class="font-mono text-xs text-ink-800 break-all">{{ ent.value.value }}</span>
              <span v-if="ent.value.error" class="text-[11px] text-rose-600">⚠️ {{ ent.value.error }}</span>
            </template>
            <span v-else class="text-[11px] text-ink-400">(見下方)</span>
          </div>
          <PhpTree v-if="ent.value.entries" :nodes="[ent.value]" :depth="depth + 2" />
        </li>
      </ul>
    </li>
  </ul>
</template>
