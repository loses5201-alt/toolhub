<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import {
  parseGrid,
  solve,
  countSolutions,
  findConflicts,
  generate,
  gridToLines,
  type Grid,
  type Difficulty,
} from '@/features/sudoku'

/*
  數獨(Sudoku)解題 / 出題 —— 全程在你瀏覽器運算,不連網、不上傳。
  解題用回溯法 + MRV(最少候選優先),瞬間求解並判斷是否唯一解;
  出題先排滿合法終盤再挖洞,每挖一格都確認仍為唯一解,所以每道題都「保證只有一個答案」。
  與抽籤/分組等生活工具同屬離線小工具。
*/

const SIZE = 9
const cells = reactive<number[]>(new Array(81).fill(0)) // 目前盤面,0 = 空
const given = reactive<boolean[]>(new Array(81).fill(false)) // 是否為題目原始提示(鎖定)
const solved = reactive<boolean[]>(new Array(81).fill(false)) // 是否為程式填入的答案
const message = ref<{ type: 'ok' | 'warn' | 'err'; text: string } | null>(null)
const difficulty = ref<Difficulty>('medium')

const conflicts = computed(() => findConflicts(cells as unknown as Grid))
const filledCount = computed(() => cells.filter((v) => v !== 0).length)

function setCell(i: number, raw: string) {
  const ch = raw.replace(/[^1-9]/g, '').slice(-1)
  cells[i] = ch ? Number(ch) : 0
  solved[i] = false
  message.value = null
}

function clearAll() {
  for (let i = 0; i < 81; i++) {
    cells[i] = 0
    given[i] = false
    solved[i] = false
  }
  message.value = null
}

function onSolve() {
  if (filledCount.value === 0) {
    message.value = { type: 'warn', text: '盤面是空的,請先填入題目,或按「出一題」。' }
    return
  }
  if (conflicts.value.size > 0) {
    message.value = { type: 'err', text: '盤面有衝突(同列/行/宮出現重複數字),請先修正標紅的格子。' }
    return
  }
  const n = countSolutions(cells as unknown as Grid, 2)
  if (n === 0) {
    message.value = { type: 'err', text: '這個盤面無解 —— 沒有任何填法能滿足數獨規則。' }
    return
  }
  const ans = solve(cells as unknown as Grid)!
  for (let i = 0; i < 81; i++) {
    if (cells[i] === 0) {
      cells[i] = ans[i]
      solved[i] = true
    }
  }
  message.value =
    n === 1
      ? { type: 'ok', text: '已解出唯一解(藍色為自動填入的答案)。' }
      : { type: 'warn', text: '此題有多組解,已填入其中一組可行解。' }
}

function onGenerate() {
  const { puzzle } = generate(difficulty.value)
  for (let i = 0; i < 81; i++) {
    cells[i] = puzzle[i]
    given[i] = puzzle[i] !== 0
    solved[i] = false
  }
  const labelMap: Record<Difficulty, string> = { easy: '簡單', medium: '中等', hard: '困難' }
  message.value = {
    type: 'ok',
    text: `已出一題（${labelMap[difficulty.value]}，${filledCount.value} 個提示，保證唯一解）。`,
  }
}

const pasteText = ref('')
function onPaste() {
  const r = parseGrid(pasteText.value)
  if (r.error || !r.grid) {
    message.value = { type: 'err', text: r.error ?? '無法解析盤面' }
    return
  }
  for (let i = 0; i < 81; i++) {
    cells[i] = r.grid[i]
    given[i] = r.grid[i] !== 0
    solved[i] = false
  }
  message.value = { type: 'ok', text: `已載入盤面(${r.filled} 個提示)。` }
}

const copied = ref(false)
async function copyGrid() {
  try {
    await navigator.clipboard.writeText(gridToLines(cells as unknown as Grid))
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch {
    /* 忽略 */
  }
}

// 九宮格的粗邊框:每 3 格加一條較粗的線
function cellClass(i: number) {
  const r = Math.floor(i / SIZE)
  const c = i % SIZE
  return [
    conflicts.value.has(i) ? 'sudoku-cell-bad' : '',
    given[i] ? 'sudoku-cell-given' : solved[i] ? 'sudoku-cell-solved' : '',
    r % 3 === 0 ? 'border-t-2 border-t-ink-400' : '',
    c % 3 === 0 ? 'border-l-2 border-l-ink-400' : '',
    r === 8 ? 'border-b-2 border-b-ink-400' : '',
    c === 8 ? 'border-r-2 border-r-ink-400' : '',
  ]
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-5 sm:p-6 space-y-5">
      <!-- 盤面 -->
      <div class="mx-auto w-full max-w-md">
        <div class="grid grid-cols-9 overflow-hidden rounded-lg border-2 border-ink-400">
          <input
            v-for="(_, i) in cells"
            :key="i"
            :value="cells[i] === 0 ? '' : cells[i]"
            type="text"
            inputmode="numeric"
            maxlength="1"
            :readonly="given[i]"
            :aria-label="`第 ${Math.floor(i / 9) + 1} 列第 ${(i % 9) + 1} 行`"
            class="sudoku-cell border border-line"
            :class="cellClass(i)"
            @input="setCell(i, ($event.target as HTMLInputElement).value)"
          />
        </div>
      </div>

      <div
        v-if="message"
        class="rounded-xl px-4 py-3 text-sm"
        :class="{
          'bg-green-50 text-green-800': message.type === 'ok',
          'bg-amber-50 text-amber-800': message.type === 'warn',
          'bg-red-50 text-red-700': message.type === 'err',
        }"
        role="status"
      >
        {{ message.text }}
      </div>

      <!-- 操作 -->
      <div class="flex flex-wrap items-center gap-3">
        <button type="button" class="btn-primary" @click="onSolve">解題</button>
        <div class="inline-flex items-center gap-2">
          <select v-model="difficulty" class="field-input w-auto" aria-label="難度">
            <option value="easy">簡單</option>
            <option value="medium">中等</option>
            <option value="hard">困難</option>
          </select>
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2 text-sm text-ink-700 transition hover:border-brand-300"
            @click="onGenerate"
          >
            出一題
          </button>
        </div>
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2 text-sm text-ink-700 transition hover:border-brand-300"
          @click="copyGrid"
        >
          {{ copied ? '已複製 ✓' : '複製盤面' }}
        </button>
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2 text-sm text-ink-700 transition hover:border-brand-300"
          @click="clearAll"
        >
          清空
        </button>
        <span class="text-sm text-ink-500">已填 {{ filledCount }} / 81</span>
      </div>
    </div>

    <!-- 貼上盤面 -->
    <details class="card p-5">
      <summary class="cursor-pointer font-medium text-ink-800">貼上盤面文字(81 格)</summary>
      <div class="mt-3 space-y-3">
        <p class="text-sm text-ink-500">
          支援每列 9 個數字、空格用 <code>0</code> 或 <code>.</code> 表示;換行、分隔線會自動忽略。
        </p>
        <textarea
          v-model="pasteText"
          rows="5"
          class="field-input w-full font-mono text-sm"
          placeholder="53..7....&#10;6..195...&#10;.98....6.&#10;..."
        />
        <button type="button" class="btn-primary" @click="onPaste">載入這個盤面</button>
      </div>
    </details>

    <LegalNote title="關於這個數獨工具">
      <ul class="list-disc pl-5 space-y-1">
        <li>規則:把空格填滿 1–9,使每一列、每一行、每一個 3×3 九宮格內 1–9 都恰好出現一次。</li>
        <li><strong>解題</strong>:用回溯法搭配「最少候選優先(MRV)」求解,並會先判斷盤面是無解、唯一解還是多組解。標紅的格子代表與同列/行/宮的數字重複。</li>
        <li><strong>出一題</strong>:先隨機排滿一個合法終盤,再隨機挖洞,而且<strong>每挖掉一格都會驗證盤面仍只有唯一解</strong>,所以產生的每一題都保證只有一個答案。難度以保留的提示數區分(簡單較多、困難較少)。</li>
        <li>畫面上<strong>黑色是題目提示、藍色是自動解出的答案</strong>;你也可以直接在格子裡輸入數字自己玩。</li>
        <li>全程在你的瀏覽器運算,<strong>不連網、不上傳</strong>。</li>
      </ul>
    </LegalNote>
  </div>
</template>

<style scoped>
.sudoku-cell {
  aspect-ratio: 1 / 1;
  width: 100%;
  text-align: center;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--color-ink-900, #111827);
  background: #fff;
  outline: none;
}
.sudoku-cell:focus {
  background: #eff6ff;
  position: relative;
  z-index: 1;
  box-shadow: inset 0 0 0 2px var(--color-brand-400, #60a5fa);
}
.sudoku-cell-given {
  background: #f8fafc;
  color: #0f172a;
}
.sudoku-cell-solved {
  color: #2563eb;
  font-weight: 700;
}
.sudoku-cell-bad {
  background: #fef2f2 !important;
  color: #dc2626 !important;
}
</style>
