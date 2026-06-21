<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { evaluateGitignore } from '@/features/gitignore'

/*
  .gitignore 測試器 —— 貼上 .gitignore 內容與要測的路徑,逐一判斷哪些被忽略、
  哪些被追蹤,並指出「最後命中」的是哪一條規則(git 採 last match wins)。
  正確處理反向 !、目錄專屬 /、錨定、** 與「父目錄被忽略無法重新納入子檔」。
  全程在你的瀏覽器解析,不連網、不上傳。
*/

const gitignore = ref(`# 範例規則
node_modules/
*.log
!important.log
build/
dist/*
!dist/keep.txt
**/.DS_Store`)

const paths = ref(`node_modules/
node_modules/react/index.js
src/app.js
debug.log
important.log
build/
build/out.js
dist/bundle.js
dist/keep.txt
docs/.DS_Store`)

const result = computed(() => evaluateGitignore(gitignore.value, paths.value))
const ignoredCount = computed(() => result.value.rows.filter((r) => r.ignored).length)
</script>

<template>
  <div class="space-y-6">
    <div class="grid gap-4 sm:grid-cols-2">
      <label class="block text-sm">
        <span class="text-ink-500">.gitignore 內容</span>
        <textarea v-model="gitignore" rows="10" class="field-input font-mono text-xs leading-relaxed" spellcheck="false" />
      </label>
      <label class="block text-sm">
        <span class="text-ink-500">要測試的路徑(每行一個,結尾 / 視為目錄)</span>
        <textarea v-model="paths" rows="10" class="field-input font-mono text-xs leading-relaxed" spellcheck="false" />
      </label>
    </div>

    <div class="card p-4">
      <div class="mb-3 flex items-center gap-3">
        <span class="text-sm font-semibold text-ink-700">判定結果</span>
        <span class="ml-auto text-sm text-ink-500">{{ ignoredCount }} / {{ result.rows.length }} 個被忽略</span>
      </div>
      <div v-if="!result.rows.length" class="text-sm text-ink-400">在右上方輸入要測試的路徑。</div>
      <table v-else class="w-full text-sm">
        <thead>
          <tr class="border-b border-ink-200 text-left text-xs text-ink-500">
            <th class="py-1.5 pr-2">路徑</th>
            <th class="py-1.5 pr-2 w-24">結果</th>
            <th class="py-1.5">決定的規則</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, i) in result.rows" :key="i" class="border-b border-ink-100 last:border-0">
            <td class="py-1.5 pr-2 font-mono text-xs">
              {{ row.path }}<span v-if="row.isDir" class="text-ink-400">/</span>
            </td>
            <td class="py-1.5 pr-2">
              <span
                v-if="row.ignored"
                class="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700"
              >🚫 忽略</span>
              <span
                v-else
                class="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700"
              >✓ 追蹤</span>
            </td>
            <td class="py-1.5 font-mono text-xs text-ink-500">
              <template v-if="row.rule">
                <span class="text-ink-400">第 {{ row.rule.line }} 行</span>
                <span class="ml-1" :class="row.rule.negate ? 'text-emerald-700' : 'text-rose-600'">
                  {{ row.rule.negate ? '!' : '' }}{{ row.rule.pattern }}{{ row.rule.dirOnly ? '/' : '' }}
                </span>
              </template>
              <span v-else class="text-ink-300">(無規則命中)</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <LegalNote title="這個工具能、不能做什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li><strong>能</strong>:依 git 官方 gitignore 規則判斷每個路徑是否被忽略,並指出「最後命中(last match wins)」的規則 —— 正確處理 <code>!</code> 反向、結尾 <code>/</code> 只比對目錄、開頭/中間 <code>/</code> 錨定根、<code>*</code> 不跨 <code>/</code>、<code>?</code>、<code>[abc]</code>、<code>**</code>(任意層),以及「父目錄被忽略時無法用 <code>!</code> 重新納入其下檔案」這個常見陷阱。</li>
        <li><strong>用法</strong>:路徑請相對於 .gitignore 所在(通常是 repo 根);路徑結尾加 <code>/</code> 表示它是目錄(影響「只比對目錄」的規則)。</li>
        <li><strong>不能</strong>:不讀取你的實際檔案系統、不處理多層子目錄各自的 .gitignore 疊加、不套用 git 全域 <code>core.excludesFile</code> 與 <code>.git/info/exclude</code>。</li>
        <li>全程<strong>在你的瀏覽器</strong>解析,<strong>不連網、不上傳</strong>。</li>
      </ul>
    </LegalNote>
  </div>
</template>
