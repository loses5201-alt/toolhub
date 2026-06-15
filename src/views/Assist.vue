<script setup lang="ts">
import { ref, nextTick, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { sendChat, checkBackend, type ChatMsg } from '@/features/assistant'

const messages = ref<ChatMsg[]>([])
const input = ref('')
const loading = ref(false)
const error = ref('')
const backendReady = ref<boolean | null>(null)
const listEl = ref<HTMLElement | null>(null)

const examples = [
  '幫我找 3 個適合做簡報的免費 AI 工具,各自優缺點',
  '最近有什麼適合全家一起玩的 Switch 遊戲?',
  '我要從台北帶長輩去花蓮玩三天,幫我排行程和預算',
  '幫我把這段話寫成正式的請假 email',
]

onMounted(async () => {
  const h = await checkBackend()
  backendReady.value = h.configured
})

async function scrollDown() {
  await nextTick()
  listEl.value?.scrollTo({ top: listEl.value.scrollHeight, behavior: 'smooth' })
}

async function send(text?: string) {
  const content = (text ?? input.value).trim()
  if (!content || loading.value) return
  error.value = ''
  messages.value.push({ role: 'user', content })
  input.value = ''
  loading.value = true
  scrollDown()
  try {
    const reply = await sendChat(messages.value)
    messages.value.push({ role: 'assistant', content: reply })
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
    scrollDown()
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    send()
  }
}
</script>

<template>
  <div class="flex flex-col" style="min-height: 70vh">
    <!-- 空畫面:介紹 + 範例 -->
    <div v-if="!messages.length" class="flex-1 flex flex-col items-center justify-center text-center py-6">
      <div class="text-5xl">🤖</div>
      <h1 class="mt-4 text-3xl sm:text-4xl font-black text-ink-900">
        想完成什麼?<span class="text-brand-600">交給我</span>
      </h1>
      <p class="mt-3 max-w-xl text-lg text-ink-500">
        我會幫你查網路、跨來源彙整、給出可直接用的結果 —— 找工具、找遊戲、規劃、整理、寫東西都行。
      </p>
      <div class="mt-6 grid w-full max-w-2xl gap-3 sm:grid-cols-2">
        <button
          v-for="e in examples"
          :key="e"
          class="card p-4 text-left text-ink-700 transition hover:border-brand-300 hover:shadow-md"
          @click="send(e)"
        >
          {{ e }}
        </button>
      </div>
      <p class="mt-5 text-sm text-ink-400">
        也可以看 <RouterLink to="/tools" class="text-brand-600 underline">實用工具</RouterLink>
        與 <RouterLink to="/downloads" class="text-brand-600 underline">防詐騙下載中心</RouterLink>
      </p>
    </div>

    <!-- 對話 -->
    <div v-else ref="listEl" class="flex-1 space-y-4 overflow-y-auto py-2" style="max-height: 70vh">
      <div v-for="(m, i) in messages" :key="i" class="flex" :class="m.role === 'user' ? 'justify-end' : 'justify-start'">
        <div
          class="max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 leading-relaxed"
          :class="m.role === 'user' ? 'bg-brand-600 text-white' : 'card text-ink-800'"
        >
          {{ m.content }}
        </div>
      </div>
      <div v-if="loading" class="flex justify-start">
        <div class="card px-4 py-3 text-ink-500">查資料、思考中…</div>
      </div>
    </div>

    <!-- 後端未設定提示 -->
    <div v-if="backendReady === false" class="mt-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
      ⚙️ AI 助手後端尚未啟動或未設定金鑰。請在專案根目錄建立 <code>.env</code>(填入 ANTHROPIC_API_KEY)後
      <code>docker compose up --build</code>,再用 <strong>http://localhost:8080</strong> 開啟即可對話。
    </div>
    <div v-if="error" class="mt-3 rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-800">
      {{ error }}
    </div>

    <!-- 輸入框 -->
    <div class="mt-4 sticky bottom-4">
      <div class="card flex items-end gap-2 p-2">
        <textarea
          v-model="input"
          rows="1"
          placeholder="輸入你想完成的事,按 Enter 送出…"
          class="max-h-40 flex-1 resize-none bg-transparent px-3 py-2.5 text-lg outline-none"
          @keydown="onKeydown"
        />
        <button class="btn-primary shrink-0" :disabled="loading || !input.trim()" @click="send()">
          送出
        </button>
      </div>
      <p class="mt-2 text-center text-xs text-ink-400">AI 可能會出錯,重要決定請向官方/專業查證。</p>
    </div>
  </div>
</template>
