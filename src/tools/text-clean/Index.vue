<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'

/*
  文字清理工坊 —— 零相依、全程在瀏覽器處理,不上傳任何文字。
  解決從 PDF / 網頁 / LINE 複製貼上時常見的麻煩:多餘空白與空行、
  夾帶的零寬/不可見字元(貼進表單會驗證失敗或搜尋不到)、全形英數字等。
*/
const input = ref('')

const opt = reactive({
  trimLines: true, // 每行去前後空白
  collapseSpaces: true, // 連續空白合併成一個
  removeBlankLines: false, // 移除空白行
  removeZeroWidth: true, // 移除零寬/不可見字元
  fullToHalf: false, // 全形英數標點 → 半形
  halfToFull: false, // 半形英數 → 全形
  caseMode: 'none' as 'none' | 'upper' | 'lower',
  removeBullets: false, // 移除行首項目符號/編號
})

// 全形 → 半形:全形 ASCII 區(U+FF01–U+FF5E)對應半形 -0xFEE0;全形空白 → 半形空白
function fullToHalf(s: string): string {
  return s
    .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/　/g, ' ')
}
// 半形 → 全形(反向)
function halfToFull(s: string): string {
  return s
    .replace(/ /g, '　')
    .replace(/[\x21-\x7E]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0xfee0))
}

const output = computed(() => {
  let s = input.value
  if (!s) return ''

  // 先處理整體字元層級
  // 零寬空白/連接符、零寬不換行、BOM、軟連字號等貼上時常夾帶的不可見字元
  if (opt.removeZeroWidth) s = s.replace(/[​‌‍⁠﻿­]/g, '')
  if (opt.fullToHalf) s = fullToHalf(s)
  else if (opt.halfToFull) s = halfToFull(s)
  if (opt.caseMode === 'upper') s = s.toUpperCase()
  else if (opt.caseMode === 'lower') s = s.toLowerCase()

  // 統一換行,再逐行處理
  let lines = s.replace(/\r\n?/g, '\n').split('\n')
  lines = lines.map((line) => {
    let l = line
    if (opt.removeBullets) l = l.replace(/^\s*([•·*‣◦\-–—]|\d+[.)、]|[(（]\d+[)）])\s+/, '')
    if (opt.collapseSpaces) l = l.replace(/[ \t　]{2,}/g, ' ')
    if (opt.trimLines) l = l.replace(/^[ \t　]+|[ \t　]+$/g, '')
    return l
  })
  if (opt.removeBlankLines) lines = lines.filter((l) => l.trim() !== '')
  return lines.join('\n')
})

// 統計:字元(含/不含空白)、中文字數、英文詞數、行數
const stats = computed(() => {
  const s = output.value
  const chars = s.length
  const noSpace = s.replace(/\s/g, '').length
  const cjk = (s.match(/[一-鿿㐀-䶿]/g) || []).length
  const words = (s.match(/[A-Za-z0-9]+/g) || []).length
  const lines = s === '' ? 0 : s.split('\n').length
  return { chars, noSpace, cjk, words, lines }
})

const copied = ref(false)
async function copyOut() {
  if (!output.value) return
  try {
    await navigator.clipboard.writeText(output.value)
  } catch {
    // 後備:用隱藏 textarea + execCommand
    const ta = document.createElement('textarea')
    ta.value = output.value
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    try { document.execCommand('copy') } catch { /* 忽略 */ }
    document.body.removeChild(ta)
  }
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}

function clearAll() {
  input.value = ''
}

// 互斥:全形↔半形只能擇一
function pickFull() {
  if (opt.fullToHalf) opt.halfToFull = false
}
function pickHalf() {
  if (opt.halfToFull) opt.fullToHalf = false
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <div>
        <label class="field-label">貼上文字</label>
        <textarea
          v-model="input"
          rows="7"
          placeholder="把從 PDF、網頁、LINE 複製來的文字貼進來…全程在你的瀏覽器處理,不會上傳。"
          class="field-input font-mono text-sm leading-relaxed"
        ></textarea>
      </div>

      <div>
        <div class="field-label">要做的清理(可複選,即時套用)</div>
        <div class="grid gap-2 sm:grid-cols-2">
          <label class="flex items-center gap-2 text-sm text-ink-700"><input v-model="opt.trimLines" type="checkbox" class="accent-brand-600" />每行去除前後空白</label>
          <label class="flex items-center gap-2 text-sm text-ink-700"><input v-model="opt.collapseSpaces" type="checkbox" class="accent-brand-600" />連續空白合併成一個</label>
          <label class="flex items-center gap-2 text-sm text-ink-700"><input v-model="opt.removeBlankLines" type="checkbox" class="accent-brand-600" />移除空白行</label>
          <label class="flex items-center gap-2 text-sm text-ink-700"><input v-model="opt.removeZeroWidth" type="checkbox" class="accent-brand-600" />移除零寬/不可見字元</label>
          <label class="flex items-center gap-2 text-sm text-ink-700"><input v-model="opt.removeBullets" type="checkbox" class="accent-brand-600" />移除行首項目符號/編號</label>
          <label class="flex items-center gap-2 text-sm text-ink-700"><input v-model="opt.fullToHalf" type="checkbox" class="accent-brand-600" @change="pickFull" />全形英數標點 → 半形</label>
          <label class="flex items-center gap-2 text-sm text-ink-700"><input v-model="opt.halfToFull" type="checkbox" class="accent-brand-600" @change="pickHalf" />半形英數 → 全形</label>
        </div>
        <div class="mt-3 flex items-center gap-2">
          <span class="text-sm text-ink-700">大小寫:</span>
          <select v-model="opt.caseMode" class="field-input !w-auto !py-1.5 text-sm">
            <option value="none">不變更</option>
            <option value="upper">全部大寫</option>
            <option value="lower">全部小寫</option>
          </select>
        </div>
      </div>
    </div>

    <div class="card p-6 space-y-3">
      <div class="flex items-center justify-between">
        <label class="field-label !mb-0">清理結果</label>
        <div class="flex gap-2">
          <button class="text-sm text-ink-500 underline hover:text-brand-700" @click="clearAll">清空</button>
          <button class="btn-primary !py-1.5 text-sm" :disabled="!output" @click="copyOut">
            {{ copied ? '已複製 ✓' : '複製結果' }}
          </button>
        </div>
      </div>
      <textarea
        :value="output"
        rows="7"
        readonly
        placeholder="清理後的文字會即時顯示在這裡。"
        class="field-input bg-ink-50/40 font-mono text-sm leading-relaxed"
      ></textarea>
      <div class="flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-500">
        <span>字元:{{ stats.chars }}</span>
        <span>不含空白:{{ stats.noSpace }}</span>
        <span>中文字:{{ stats.cjk }}</span>
        <span>英數詞:{{ stats.words }}</span>
        <span>行數:{{ stats.lines }}</span>
      </div>
    </div>

    <LegalNote title="為什麼需要這個?">
      <ul class="list-disc pl-5 space-y-1">
        <li>從 PDF、網頁、LINE 複製文字時,常夾帶<strong>看不見的零寬字元</strong>,貼進表單會驗證失敗、或之後搜尋不到 —— 一鍵清掉。</li>
        <li><strong>全形/半形</strong>英數字混用是台灣表單常見地雷(全形「１２３」常被擋),可一鍵轉成半形。</li>
        <li>整理大量貼上的清單、地址、姓名時,去多餘空白與空行很省事。</li>
        <li><strong>全程在你瀏覽器處理、不上傳</strong>,文字可能含個資也安心,無廣告、免註冊。</li>
      </ul>
    </LegalNote>
  </div>
</template>
