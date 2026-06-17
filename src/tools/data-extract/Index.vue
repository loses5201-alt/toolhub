<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { extractAll } from '@/features/dataExtract'

/*
  文字資料抽取 —— 從一大段雜亂文字裡抽出 Email、網址、台灣手機、有效統一編號,
  各自去重。統編經檢查碼驗證(高精度)。全程瀏覽器、不上傳。
*/
const input = ref('')
const result = computed(() => extractAll(input.value))
const hasAny = computed(() => {
  const r = result.value
  return r.emails.length + r.urls.length + r.mobiles.length + r.vats.length > 0
})

const groups = computed(() => [
  { key: 'emails', label: 'Email', icon: '✉️', items: result.value.emails },
  { key: 'urls', label: '網址', icon: '🔗', items: result.value.urls },
  { key: 'mobiles', label: '台灣手機', icon: '📱', items: result.value.mobiles },
  { key: 'vats', label: '統一編號', icon: '🏢', items: result.value.vats },
])

const copied = ref<string | null>(null)
async function copyGroup(key: string, items: string[]) {
  if (!items.length) return
  try {
    await navigator.clipboard.writeText(items.join('\n'))
    copied.value = key
    setTimeout(() => (copied.value = null), 1500)
  } catch {
    /* 使用者可手動選取 */
  }
}

const sample = `各位好,專案聯絡資訊整理如下:
王小明 a.ming@acme.com.tw / 0912-345-678
李大華 dahua@example.org,手機 +886 933 222 111
請款請開立發票,公司統編 22099131(Acme 股份有限公司)
官網 https://acme.com.tw/contact 與 https://acme.com.tw/contact(重複)
備用市話 02-2712-3456`
function loadSample() {
  input.value = sample
}
function clearAll() {
  input.value = ''
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-4 sm:p-6 space-y-5">
      <div>
        <div class="mb-1.5 flex items-center justify-between">
          <label class="field-label !mb-0">貼上文字(信件、文件、網頁內容…)</label>
          <div class="flex gap-3 text-sm">
            <button class="text-brand-700 underline" @click="loadSample">載入範例</button>
            <button v-if="input" class="text-ink-400 underline hover:text-red-500" @click="clearAll">清空</button>
          </div>
        </div>
        <textarea
          v-model="input"
          rows="8"
          spellcheck="false"
          placeholder="把一大段文字貼進來,自動抓出裡面的 Email、網址、手機、統編…"
          class="field-input !text-sm leading-relaxed"
        ></textarea>
        <p class="field-hint">文字只在你的瀏覽器處理,不會上傳到任何伺服器。</p>
      </div>

      <div v-if="input.trim() && !hasAny" class="rounded-lg bg-stone-100 px-3 py-2 text-sm text-ink-600">
        沒有抓到 Email、網址、台灣手機或有效統編。
      </div>

      <div v-if="hasAny" class="grid gap-4 sm:grid-cols-2">
        <div v-for="g in groups" :key="g.key" class="rounded-xl border border-line p-4">
          <div class="mb-2 flex items-center justify-between">
            <span class="font-semibold text-ink-800">{{ g.icon }} {{ g.label }}<span class="ml-2 text-sm font-normal text-ink-400">{{ g.items.length }}</span></span>
            <button
              v-if="g.items.length"
              class="text-sm text-brand-700 underline"
              @click="copyGroup(g.key, g.items)"
            >{{ copied === g.key ? '已複製 ✓' : '複製' }}</button>
          </div>
          <ul v-if="g.items.length" class="space-y-1 text-sm">
            <li v-for="(it, i) in g.items" :key="i" class="break-all font-mono text-ink-700">{{ it }}</li>
          </ul>
          <p v-else class="text-sm text-ink-300">—</p>
        </div>
      </div>
    </div>

    <LegalNote title="它能幫你什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li>從<strong>轉寄的信、會議記錄、PDF 複製出的文字、貼上的網頁</strong>裡,一次把 Email、網址、手機、統編全撈出來,免逐行找。</li>
        <li>每類<strong>自動去重</strong>(Email 忽略大小寫、手機統一成 09 開頭 10 碼)。</li>
        <li><strong>統一編號經檢查碼驗證</strong>才列出,不會把隨便 8 個數字當成統編;市話不會被誤認成手機。</li>
        <li><strong>不上傳</strong>:含個資的文字全程留在你電腦。想把抓到的個資<em>遮蔽</em>而非抽出,請改用「文字遮蔽」。</li>
        <li>抓取依常見格式,僅供整理參考;務必再核對一次,尤其是要寄送或建檔的名單。</li>
      </ul>
    </LegalNote>
  </div>
</template>
