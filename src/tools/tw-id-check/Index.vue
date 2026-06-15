<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'

/*
  身分證字號檢核 —— 用內政部公布的檢查碼規則,在瀏覽器端驗算字號是否「格式正確」。
  可抓出打錯一碼的輸入,或一眼看出亂編的假號碼。注意:檢查碼正確 ≠ 真的有這個人,
  只代表「符合編碼規則」。全程本機運算、不上傳。
*/
const input = ref('')

// 首碼英文字母對應的兩位數(內政部規定,非單純 A=10 連號:I/O/W/X/Z 等跳號)
const LETTER: Record<string, number> = {
  A: 10, B: 11, C: 12, D: 13, E: 14, F: 15, G: 16, H: 17, I: 34, J: 18,
  K: 19, L: 20, M: 21, N: 22, O: 35, P: 23, Q: 24, R: 25, S: 26, T: 27,
  U: 28, V: 29, W: 32, X: 30, Y: 31, Z: 33,
}
const REGION: Record<string, string> = {
  A: '臺北市', B: '臺中市', C: '基隆市', D: '臺南市', E: '高雄市', F: '新北市',
  G: '宜蘭縣', H: '桃園市', I: '嘉義市', J: '新竹縣', K: '苗栗縣', L: '臺中縣',
  M: '南投縣', N: '彰化縣', O: '新竹市', P: '雲林縣', Q: '嘉義縣', R: '臺南縣',
  S: '高雄縣', T: '屏東縣', U: '花蓮縣', V: '臺東縣', W: '金門縣', X: '澎湖縣',
  Y: '陽明山管理局', Z: '連江縣',
}

interface Result {
  valid: boolean
  reason: string
  region?: string
  gender?: string
}

const result = computed<Result | null>(() => {
  const raw = input.value.trim().toUpperCase()
  if (!raw) return null
  if (!/^[A-Z][0-9]{9}$/.test(raw)) {
    return { valid: false, reason: '格式不符:應為 1 個英文字母 + 9 個數字(共 10 碼)。' }
  }
  const letter = raw[0]
  const code = LETTER[letter]
  // 第 2 碼(性別碼):1=男、2=女;新式外來人口號碼會用 8/9,此處針對國民身分證
  const g = raw[1]
  if (g !== '1' && g !== '2') {
    return { valid: false, reason: '第 2 碼(性別碼)應為 1(男)或 2(女)。', region: REGION[letter] }
  }
  // 加權總和:字母兩位數權重 1、9,後 9 碼權重 8,7,6,5,4,3,2,1,1
  const digits = raw.slice(1).split('').map(Number)
  let sum = Math.floor(code / 10) * 1 + (code % 10) * 9
  const weights = [8, 7, 6, 5, 4, 3, 2, 1, 1]
  for (let i = 0; i < 9; i++) sum += digits[i] * weights[i]
  const valid = sum % 10 === 0
  return {
    valid,
    reason: valid ? '檢查碼正確,符合身分證字號編碼規則。' : '檢查碼錯誤,可能是打錯一碼或號碼無效。',
    region: REGION[letter],
    gender: g === '1' ? '男' : '女',
  }
})
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <div>
        <label class="field-label">輸入身分證字號</label>
        <input
          v-model="input"
          type="text"
          maxlength="10"
          autocapitalize="characters"
          placeholder="例:A123456789"
          class="field-input font-mono text-lg tracking-widest uppercase"
        />
        <p class="field-hint">全程在你的瀏覽器計算,不會上傳,也不會儲存。</p>
      </div>

      <div v-if="result" class="rounded-2xl border p-5"
        :class="result.valid ? 'border-emerald-200 bg-emerald-50/60' : 'border-red-200 bg-red-50/60'">
        <div class="flex items-center gap-2 text-lg font-bold"
          :class="result.valid ? 'text-emerald-700' : 'text-red-700'">
          <span>{{ result.valid ? '✅' : '❌' }}</span>
          <span>{{ result.valid ? '檢查碼正確' : '檢查碼不正確' }}</span>
        </div>
        <p class="mt-1.5 text-sm text-ink-700">{{ result.reason }}</p>
        <div v-if="result.valid" class="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-ink-600">
          <span v-if="result.region">📍 初領地:{{ result.region }}</span>
          <span v-if="result.gender">🧑 性別碼:{{ result.gender }}</span>
        </div>
      </div>
    </div>

    <LegalNote title="這個檢核能做什麼、不能做什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li><strong>能</strong>:用內政部公布的檢查碼公式,抓出輸入時打錯一碼,或一眼看穿隨便亂編的假號碼。</li>
        <li><strong>不能</strong>:檢查碼正確<strong>不代表真的有這個人</strong>,也無法查到任何個資 —— 只代表「符合編碼規則」。</li>
        <li>「初領地」是首碼字母對應的縣市,反映第一次請領的地點,不一定是現在的戶籍地。</li>
        <li>本工具<strong>不連網、不上傳、不儲存</strong>任何輸入。請勿用於非法用途。</li>
      </ul>
    </LegalNote>
  </div>
</template>
