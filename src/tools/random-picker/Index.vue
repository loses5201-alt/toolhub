<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { shuffle, drawWinners, makeGroupsByCount } from '@/features/randomDraw'

/*
  抽籤 / 分組 / 隨機排序 —— 用瀏覽器密碼學亂數(crypto.getRandomValues)+ 拒絕取樣做公平洗牌,
  消除取模偏差,機率真正均等(不是可預測的 Math.random)。引擎為共用、可測試的 src/features/randomDraw.ts。
  全程在瀏覽器。聚餐誰請客、分組、抽獎、決定順序都好用。
*/
type Mode = 'pick' | 'group' | 'shuffle'
const raw = ref('')
const mode = ref<Mode>('pick')
const pickN = ref(1)
const groupN = ref(2)
const result = ref<string[][]>([])
const picked = ref(false)

const items = computed(() =>
  raw.value
    .split(/[\n,，、]+/)
    .map((s) => s.trim())
    .filter(Boolean),
)

function run() {
  const list = items.value
  if (!list.length) return
  if (mode.value === 'pick') {
    result.value = [drawWinners(list, pickN.value)]
  } else if (mode.value === 'shuffle') {
    result.value = [shuffle(list)]
  } else {
    result.value = makeGroupsByCount(list, Math.max(2, groupN.value))
  }
  picked.value = true
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <div>
        <label class="field-label">名單(每行一個,或用逗號分隔)</label>
        <textarea v-model="raw" rows="5" placeholder="小明&#10;小華&#10;阿美&#10;…" class="field-input resize-y" />
        <p class="field-hint">目前 {{ items.length }} 個項目。</p>
      </div>

      <div class="flex flex-wrap gap-2">
        <button
          v-for="m in (['pick', 'group', 'shuffle'] as Mode[])"
          :key="m"
          class="rounded-xl border px-4 py-2 font-medium transition"
          :class="mode === m ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-line bg-white text-ink-700'"
          @click="mode = m"
        >
          {{ m === 'pick' ? '抽出' : m === 'group' ? '隨機分組' : '隨機排序' }}
        </button>
      </div>

      <div v-if="mode === 'pick'" class="flex items-center gap-2">
        <span class="text-ink-700">抽出</span>
        <input v-model.number="pickN" type="number" min="1" class="field-input w-24" />
        <span class="text-ink-700">個</span>
      </div>
      <div v-else-if="mode === 'group'" class="flex items-center gap-2">
        <span class="text-ink-700">分成</span>
        <input v-model.number="groupN" type="number" min="2" class="field-input w-24" />
        <span class="text-ink-700">組</span>
      </div>

      <button class="btn-primary w-full sm:w-auto" :disabled="!items.length" @click="run">
        {{ mode === 'pick' ? '開抽!' : mode === 'group' ? '分組!' : '洗牌!' }}
      </button>
    </div>

    <div v-if="picked && result.length" class="space-y-3">
      <div v-for="(g, gi) in result" :key="gi" class="card p-5">
        <div v-if="mode === 'group'" class="mb-2 font-semibold text-brand-700">第 {{ gi + 1 }} 組({{ g.length }} 人)</div>
        <div v-else-if="mode === 'pick'" class="mb-2 font-semibold text-brand-700">🎉 抽中</div>
        <div class="flex flex-wrap gap-2">
          <span
            v-for="(item, i) in g"
            :key="i"
            class="rounded-full bg-brand-50 px-3 py-1.5 text-ink-800"
            :class="{ 'text-lg font-bold': mode === 'pick' }"
          >
            <span v-if="mode === 'shuffle'" class="mr-1 text-ink-400">{{ i + 1 }}.</span>{{ item }}
          </span>
        </div>
      </div>
    </div>

    <LegalNote title="說明">
      <ul class="list-disc pl-5 space-y-1">
        <li>使用瀏覽器的<strong>加密級亂數</strong>洗牌,比一般 <code>Math.random()</code> 更公平、不可預測。</li>
        <li>適合:聚餐抽誰請客、分組、抽獎、決定上台順序。全程在你瀏覽器,名單不上傳。</li>
      </ul>
    </LegalNote>
  </div>
</template>
