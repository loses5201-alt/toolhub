<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'

/*
  Base64 / Data URI 圖片互轉 —— 全程在瀏覽器(FileReader / atob),圖片不上傳。
  編碼:圖片檔 → data URI,附 HTML / CSS / Markdown 片段與大小提醒。
  解碼:貼上 data URI 或純 Base64 → 依魔術位元組辨識真實格式 → 預覽與下載。
*/
type Mode = 'encode' | 'decode'
const mode = ref<Mode>('encode')

// ---------- 編碼:圖片 → Base64 ----------
const fileName = ref('')
const fileType = ref('')
const rawBytes = ref(0)
const dataUri = ref('')
const encodeError = ref('')

function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  ;(e.target as HTMLInputElement).value = ''
  encodeError.value = ''
  if (!f) return
  if (!f.type.startsWith('image/')) {
    encodeError.value = '請選擇圖片檔(JPG / PNG / GIF / WebP / SVG 等)。'
    return
  }
  fileName.value = f.name
  fileType.value = f.type
  rawBytes.value = f.size
  const reader = new FileReader()
  reader.onload = () => (dataUri.value = String(reader.result || ''))
  reader.onerror = () => (encodeError.value = '讀取檔案失敗,請換一張試試。')
  reader.readAsDataURL(f)
}

const base64Only = computed(() => {
  const i = dataUri.value.indexOf(',')
  return i >= 0 ? dataUri.value.slice(i + 1) : ''
})
const encodedBytes = computed(() => dataUri.value.length)
const htmlSnippet = computed(() => `<img src="${dataUri.value}" alt="" />`)
const cssSnippet = computed(() => `background-image: url("${dataUri.value}");`)
const mdSnippet = computed(() => `![](${dataUri.value})`)
const tooBig = computed(() => rawBytes.value > 10 * 1024)

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}

// ---------- 解碼:Base64 / Data URI → 圖片 ----------
const decodeInput = ref('')
const decodeUrl = ref('')
const decodeError = ref('')
const decodedMime = ref('')
const decodedExt = ref('')
const decodedBytes = ref(0)

// 依魔術位元組辨識真實圖片格式,比宣告的 MIME 可靠
function sniff(b: Uint8Array): { mime: string; ext: string } | null {
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47)
    return { mime: 'image/png', ext: 'png' }
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff)
    return { mime: 'image/jpeg', ext: 'jpg' }
  if (b.length >= 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46)
    return { mime: 'image/gif', ext: 'gif' }
  if (
    b.length >= 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  )
    return { mime: 'image/webp', ext: 'webp' }
  if (b.length >= 2 && b[0] === 0x42 && b[1] === 0x4d) return { mime: 'image/bmp', ext: 'bmp' }
  // SVG:純文字,找 <svg
  const head = new TextDecoder().decode(b.slice(0, 256)).toLowerCase()
  if (head.includes('<svg')) return { mime: 'image/svg+xml', ext: 'svg' }
  return null
}

function doDecode() {
  decodeError.value = ''
  if (decodeUrl.value) {
    URL.revokeObjectURL(decodeUrl.value)
    decodeUrl.value = ''
  }
  let s = decodeInput.value.trim()
  if (!s) return
  let declaredMime = ''
  const m = s.match(/^data:([^;,]+)?[^,]*,/i)
  if (m) {
    declaredMime = (m[1] || '').toLowerCase()
    s = s.slice(s.indexOf(',') + 1)
  }
  // 去掉換行與空白(貼上時常見)
  s = s.replace(/\s+/g, '')
  let bytes: Uint8Array
  try {
    const bin = atob(s)
    bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  } catch {
    decodeError.value = '看起來不是有效的 Base64。請確認整段都複製到了(可含或不含 data: 開頭)。'
    return
  }
  if (bytes.length === 0) {
    decodeError.value = '解碼後是空的,請檢查輸入內容。'
    return
  }
  const guessed = sniff(bytes)
  const mime = guessed?.mime || declaredMime || 'image/png'
  const ext = guessed?.ext || (declaredMime.split('/')[1] || 'png').replace('+xml', '').replace('jpeg', 'jpg')
  if (!mime.startsWith('image/')) {
    decodeError.value = '這段資料不像圖片(辨識為 ' + mime + ')。本工具只處理圖片。'
    return
  }
  decodedMime.value = mime
  decodedExt.value = ext
  decodedBytes.value = bytes.length
  decodeUrl.value = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime }))
}

function downloadDecoded() {
  if (!decodeUrl.value) return
  const a = document.createElement('a')
  a.href = decodeUrl.value
  a.download = `image.${decodedExt.value || 'png'}`
  document.body.appendChild(a)
  a.click()
  a.remove()
}

// ---------- 複製 ----------
const copiedKey = ref('')
async function copy(text: string, key: string) {
  try {
    await navigator.clipboard.writeText(text)
    copiedKey.value = key
    setTimeout(() => (copiedKey.value = ''), 1500)
  } catch {
    /* 使用者可手動選取 */
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-4 sm:p-6 space-y-5">
      <div class="flex gap-2">
        <button
          class="flex-1 rounded-lg px-3 py-2 text-sm font-medium transition"
          :class="mode === 'encode' ? 'bg-brand-600 text-white' : 'border border-line bg-white hover:border-brand-400'"
          @click="mode = 'encode'"
        >
          圖片 → Base64
        </button>
        <button
          class="flex-1 rounded-lg px-3 py-2 text-sm font-medium transition"
          :class="mode === 'decode' ? 'bg-brand-600 text-white' : 'border border-line bg-white hover:border-brand-400'"
          @click="mode = 'decode'"
        >
          Base64 → 圖片
        </button>
      </div>

      <!-- 編碼 -->
      <template v-if="mode === 'encode'">
        <div>
          <label class="field-label">選擇要轉成 Base64 / Data URI 的圖片</label>
          <input type="file" accept="image/*" class="field-input" @change="onFile" />
          <p class="field-hint">圖片只在你的瀏覽器處理,不會上傳。小圖示、logo 最適合內嵌。</p>
        </div>

        <p v-if="encodeError" class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ encodeError }}</p>

        <template v-if="dataUri">
          <div class="flex flex-wrap items-center gap-4">
            <img :src="dataUri" alt="預覽" class="max-h-28 rounded border border-line bg-brand-50/40" />
            <div class="text-sm text-ink-600">
              <p class="font-medium text-ink-800">{{ fileName }}</p>
              <p>原始檔 {{ fmtBytes(rawBytes) }} → Data URI {{ fmtBytes(encodedBytes) }}</p>
              <p class="text-xs text-ink-500">(Base64 會放大約 33%,故 Data URI 比原檔大)</p>
            </div>
          </div>

          <p
            v-if="tooBig"
            class="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800"
          >
            ⚠️ 這張圖較大(超過 10 KB)。內嵌大圖會讓 HTML/CSS 變肥、無法被瀏覽器快取,建議只對小圖示用 Data URI,大圖仍以外部檔案連結。
          </p>

          <div class="space-y-4">
            <div>
              <div class="flex items-center justify-between">
                <label class="field-label">Data URI(可直接當 img src / CSS url)</label>
                <button class="rounded-md border border-line bg-white px-3 py-1 text-xs hover:border-brand-400" @click="copy(dataUri, 'uri')">{{ copiedKey === 'uri' ? '已複製 ✓' : '複製' }}</button>
              </div>
              <textarea :value="dataUri" rows="4" readonly class="field-input font-mono text-xs"></textarea>
            </div>
            <div>
              <div class="flex items-center justify-between">
                <label class="field-label">純 Base64(不含 data: 前綴)</label>
                <button class="rounded-md border border-line bg-white px-3 py-1 text-xs hover:border-brand-400" @click="copy(base64Only, 'b64')">{{ copiedKey === 'b64' ? '已複製 ✓' : '複製' }}</button>
              </div>
              <textarea :value="base64Only" rows="3" readonly class="field-input font-mono text-xs"></textarea>
            </div>
            <div class="grid gap-3 sm:grid-cols-3">
              <button class="rounded-lg border border-line bg-white px-3 py-2 text-sm hover:border-brand-400" @click="copy(htmlSnippet, 'html')">{{ copiedKey === 'html' ? '已複製 HTML ✓' : '複製 HTML <img>' }}</button>
              <button class="rounded-lg border border-line bg-white px-3 py-2 text-sm hover:border-brand-400" @click="copy(cssSnippet, 'css')">{{ copiedKey === 'css' ? '已複製 CSS ✓' : '複製 CSS background' }}</button>
              <button class="rounded-lg border border-line bg-white px-3 py-2 text-sm hover:border-brand-400" @click="copy(mdSnippet, 'md')">{{ copiedKey === 'md' ? '已複製 Markdown ✓' : '複製 Markdown' }}</button>
            </div>
          </div>
        </template>
      </template>

      <!-- 解碼 -->
      <template v-else>
        <div>
          <label class="field-label">貼上 Data URI 或純 Base64 字串</label>
          <textarea
            v-model="decodeInput"
            rows="5"
            class="field-input font-mono text-xs"
            placeholder="data:image/png;base64,iVBORw0KGgo... 或直接貼 iVBORw0KGgo..."
          ></textarea>
          <p class="field-hint">含換行/空白沒關係,會自動清理。依內容辨識真實格式,不依賴宣告的 MIME。</p>
        </div>
        <button class="btn-primary" @click="doDecode">解碼並預覽</button>

        <p v-if="decodeError" class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ decodeError }}</p>

        <template v-if="decodeUrl">
          <div class="flex flex-wrap items-center gap-4">
            <img :src="decodeUrl" alt="解碼預覽" class="max-h-40 rounded border border-line bg-brand-50/40" />
            <div class="text-sm text-ink-600">
              <p>格式:<span class="font-medium text-ink-800">{{ decodedMime }}</span></p>
              <p>大小:{{ fmtBytes(decodedBytes) }}</p>
            </div>
          </div>
          <button class="btn-primary" @click="downloadDecoded">下載圖片(.{{ decodedExt }})</button>
        </template>
      </template>
    </div>

    <LegalNote title="使用說明與為什麼用這個">
      <ul class="list-disc space-y-1 pl-5">
        <li><strong>不上傳</strong>:多數線上 Base64 圖片工具會把你的圖傳到伺服器、夾廣告;這裡全程在瀏覽器,圖片不離開你的電腦。</li>
        <li><strong>Data URI</strong> 把圖片直接寫進 HTML/CSS/Markdown,適合小圖示、email 簽名、單檔網頁,省一個檔案請求。</li>
        <li>缺點:Base64 比原檔大約 33%,且內嵌的圖<strong>無法被瀏覽器快取</strong>,大圖建議仍用外部連結。</li>
        <li>解碼時依<strong>魔術位元組</strong>辨識 PNG/JPG/GIF/WebP/BMP/SVG 真實格式,即使前綴寫錯也能正確判斷與命名。</li>
      </ul>
    </LegalNote>
  </div>
</template>
