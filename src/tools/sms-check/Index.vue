<script setup lang="ts">
import { ref, computed } from 'vue'
import { analyzeUrl } from '@/features/linkcheck'
import LegalNote from '@/components/LegalNote.vue'

// 常見詐騙話術分類關鍵字
const PATTERNS: { name: string; words: string[] }[] = [
  { name: '製造急迫/恐嚇', words: ['立即', '馬上', '盡速', '逾期', '凍結', '停權', '異常', '違規', '最後通知', '24小時內', '今日'] },
  { name: '假冒帳號/解除設定', words: ['解除分期', '解除約定', '設定錯誤', '重複扣款', '帳號異常', '驗證帳戶', '更新資料', '監管帳戶'] },
  { name: '中獎/退款/補費', words: ['中獎', '得獎', '退款', '退稅', '補運費', '補繳', '免費領取', '紅包', '退費'] },
  { name: '假投資/賺錢', words: ['保證獲利', '穩賺', '高報酬', '飆股', '老師帶單', '內線', '虛擬貨幣', '加碼', '投資群組'] },
  { name: '假檢警/公務', words: ['檢察官', '警官', '涉案', '洗錢', '通緝', '法院', '健保署', '國稅局', '監察'] },
  { name: '包裹/物流', words: ['包裹', '物流', '宅配', '貨運', '海關', '地址有誤', '待領', '配送失敗'] },
  { name: '誘導點擊/下載/加好友', words: ['點擊', '點此', '請點', '下載', '安裝', 'APP', '加LINE', '加賴', '官方客服', '掃描'] },
]

const text = ref('')

const urls = computed(() => {
  const m = text.value.match(/https?:\/\/[^\s，。、）)]+/gi) || []
  // 沒有 http 前綴但像網域的(粗略)
  const bare = text.value.match(/\b[\w-]+\.(?:com|net|org|tw|cc|xyz|top|me|io|info|biz)[^\s，。、）)]*/gi) || []
  return Array.from(new Set([...m, ...bare]))
})

const matched = computed(() =>
  PATTERNS.map((p) => ({ name: p.name, hits: p.words.filter((w) => text.value.includes(w)) })).filter(
    (p) => p.hits.length > 0,
  ),
)

const urlAnalyses = computed(() => urls.value.slice(0, 3).map((u) => ({ url: u, a: analyzeUrl(u) })))

const hasDangerUrl = computed(() => urlAnalyses.value.some((x) => x.a.level === 'danger'))

const level = computed<'danger' | 'warn' | 'safe'>(() => {
  if (!text.value.trim()) return 'safe'
  if (hasDangerUrl.value || matched.value.length >= 3) return 'danger'
  if (matched.value.length >= 1 || urls.value.length > 0) return 'warn'
  return 'safe'
})

const verdict = {
  danger: { emoji: '🚫', title: '高度可疑,極可能是詐騙', klass: 'border-red-300 bg-red-50 text-red-800' },
  warn: { emoji: '⚠️', title: '有可疑特徵,請提高警覺', klass: 'border-amber-300 bg-amber-50 text-amber-800' },
  safe: { emoji: '🙂', title: '沒抓到明顯話術', klass: 'border-brand-300 bg-brand-50 text-brand-800' },
}
const urlColor: Record<string, string> = { danger: 'text-red-600', warn: 'text-amber-600', safe: 'text-brand-700' }
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6">
      <label class="field-label">貼上可疑的簡訊 / LINE 訊息全文</label>
      <textarea
        v-model="text"
        rows="4"
        placeholder="例:【中華郵政】您的包裹地址有誤,請於今日點擊連結更新 https://twpost-tw.xyz/verify 否則退回"
        class="field-input resize-none"
      />
    </div>

    <template v-if="text.trim()">
      <div class="rounded-3xl border p-6" :class="verdict[level].klass">
        <div class="flex items-center gap-3">
          <span class="text-4xl">{{ verdict[level].emoji }}</span>
          <div class="text-xl font-black">{{ verdict[level].title }}</div>
        </div>
      </div>

      <div v-if="matched.length" class="card p-5">
        <div class="mb-3 font-semibold text-ink-900">偵測到的詐騙話術</div>
        <ul class="space-y-2">
          <li v-for="m in matched" :key="m.name" class="text-sm text-ink-700">
            <span class="font-semibold text-red-600">● {{ m.name }}</span>
            <span class="text-ink-500">:{{ m.hits.join('、') }}</span>
          </li>
        </ul>
      </div>

      <div v-if="urlAnalyses.length" class="card p-5">
        <div class="mb-3 font-semibold text-ink-900">訊息中的連結</div>
        <ul class="space-y-2.5">
          <li v-for="x in urlAnalyses" :key="x.url" class="text-sm">
            <div class="break-all font-mono text-ink-700">{{ x.url }}</div>
            <div :class="urlColor[x.a.level]">
              → {{ x.a.level === 'danger' ? '高風險連結' : x.a.level === 'warn' ? '可疑連結' : '未發現明顯特徵' }}
              <span v-if="x.a.findings.length" class="text-ink-500">
                ({{ x.a.findings.filter((f) => f.level !== 'ok').map((f) => f.text)[0] }})
              </span>
            </div>
          </li>
        </ul>
      </div>

      <LegalNote title="該怎麼辦?">
        <ul class="list-disc pl-5 space-y-1">
          <li>不要點訊息裡的連結,不要回撥訊息裡的電話、不加它給的 LINE。</li>
          <li>要確認就<strong>自己打官方電話/開官方 App</strong>查,或撥 <strong>165</strong> 反詐騙專線。</li>
          <li>政府、銀行不會用簡訊要你「解除分期、提供帳密、操作 ATM」。</li>
          <li>本工具是輔助辨識,沒抓到話術也不代表一定安全。</li>
        </ul>
      </LegalNote>
    </template>

    <div v-else class="card p-8 text-center text-ink-500">貼上可疑訊息,馬上幫你看出常見詐騙話術。</div>
  </div>
</template>
