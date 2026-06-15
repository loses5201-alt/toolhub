<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import LegalNote from '@/components/LegalNote.vue'

/*
  QR Code 產生器 —— 直接把你的文字/網址/WiFi/聯絡資訊編碼成 QR Code,
  全程在你瀏覽器用 qrcode 函式庫產生,不上傳、不轉址。
  許多線上 QR 產生器會偷偷把你的網址換成「它的短網址」再轉跳,
  這樣它就能記錄誰掃了你的碼、甚至日後改掉目的地;本工具直接編碼原始內容,乾淨可信。
*/
type Mode = 'text' | 'wifi' | 'vcard'
const mode = ref<Mode>('text')

const text = ref('')
const wifi = reactive({ ssid: '', password: '', enc: 'WPA' as 'WPA' | 'WEP' | 'nopass', hidden: false })
const vcard = reactive({ name: '', org: '', tel: '', email: '', url: '' })

const ecLevel = ref<'L' | 'M' | 'Q' | 'H'>('M')
const sizePx = ref(320)

const dataUrl = ref('')
const error = ref('')

// WiFi / vCard 字串需跳脫特殊字元
function escWifi(s: string): string {
  return s.replace(/([\\;,:"])/g, '\\$1')
}
function escVcard(s: string): string {
  return s.replace(/([\\;,])/g, '\\$1').replace(/\n/g, '\\n')
}

// 依模式組出要編碼的最終字串
const payload = computed(() => {
  if (mode.value === 'wifi') {
    if (!wifi.ssid) return ''
    const parts = [`T:${wifi.enc}`, `S:${escWifi(wifi.ssid)}`]
    if (wifi.enc !== 'nopass') parts.push(`P:${escWifi(wifi.password)}`)
    if (wifi.hidden) parts.push('H:true')
    return `WIFI:${parts.join(';')};;`
  }
  if (mode.value === 'vcard') {
    if (!vcard.name && !vcard.tel && !vcard.email) return ''
    const lines = ['BEGIN:VCARD', 'VERSION:3.0']
    if (vcard.name) lines.push(`FN:${escVcard(vcard.name)}`, `N:${escVcard(vcard.name)};;;;`)
    if (vcard.org) lines.push(`ORG:${escVcard(vcard.org)}`)
    if (vcard.tel) lines.push(`TEL;TYPE=CELL:${escVcard(vcard.tel)}`)
    if (vcard.email) lines.push(`EMAIL:${escVcard(vcard.email)}`)
    if (vcard.url) lines.push(`URL:${escVcard(vcard.url)}`)
    lines.push('END:VCARD')
    return lines.join('\n')
  }
  return text.value
})

let genId = 0
async function generate() {
  const content = payload.value
  error.value = ''
  if (!content) {
    dataUrl.value = ''
    return
  }
  const myId = ++genId
  try {
    // 動態載入,讓首頁不必為這支工具背 qrcode 的體積
    const QRCode = (await import('qrcode')).default
    const url = await QRCode.toDataURL(content, {
      errorCorrectionLevel: ecLevel.value,
      width: sizePx.value,
      margin: 2,
      color: { dark: '#1c1a17', light: '#ffffff' },
    })
    if (myId === genId) dataUrl.value = url
  } catch (e) {
    if (myId === genId) {
      dataUrl.value = ''
      error.value = e instanceof Error ? e.message : '無法產生 QR Code(內容可能過長)'
    }
  }
}

// 任一輸入變動就即時重產(輕量,不需按鈕)
watch([payload, ecLevel, sizePx], generate, { immediate: true })

const downloadName = computed(() => {
  if (mode.value === 'wifi') return `wifi-${wifi.ssid || 'qr'}.png`
  if (mode.value === 'vcard') return `contact-${vcard.name || 'qr'}.png`
  return 'qrcode.png'
})
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-5">
      <div>
        <div class="field-label">要做成 QR Code 的內容</div>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="m in (['text','wifi','vcard'] as Mode[])"
            :key="m"
            class="rounded-xl border px-4 py-2 text-sm transition"
            :class="mode === m ? 'border-brand-400 bg-brand-50 text-brand-800 font-semibold' : 'border-line text-ink-700 hover:border-brand-300'"
            @click="mode = m"
          >
            {{ m === 'text' ? '文字 / 網址' : m === 'wifi' ? 'WiFi 連線' : '聯絡資訊' }}
          </button>
        </div>
      </div>

      <!-- 文字 / 網址 -->
      <div v-if="mode === 'text'">
        <label class="field-label" for="qr-text">文字或網址</label>
        <textarea
          id="qr-text"
          v-model="text"
          rows="3"
          placeholder="例:https://example.com 或任意文字"
          class="field-input font-mono"
        ></textarea>
      </div>

      <!-- WiFi -->
      <div v-else-if="mode === 'wifi'" class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="field-label" for="qr-ssid">網路名稱(SSID)</label>
          <input id="qr-ssid" v-model="wifi.ssid" type="text" placeholder="你家 WiFi 名稱" class="field-input" />
        </div>
        <div>
          <label class="field-label" for="qr-pw">WiFi 密碼</label>
          <input id="qr-pw" v-model="wifi.password" type="text" :disabled="wifi.enc === 'nopass'" placeholder="WiFi 密碼" class="field-input" />
        </div>
        <div>
          <label class="field-label">加密方式</label>
          <select v-model="wifi.enc" class="field-input">
            <option value="WPA">WPA / WPA2 / WPA3(最常見)</option>
            <option value="WEP">WEP(舊式)</option>
            <option value="nopass">無密碼(開放網路)</option>
          </select>
        </div>
        <label class="flex items-center gap-2 self-end pb-3 text-sm text-ink-700">
          <input v-model="wifi.hidden" type="checkbox" class="accent-brand-600" />隱藏式網路(不廣播 SSID)
        </label>
      </div>

      <!-- vCard -->
      <div v-else class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="field-label" for="qr-name">姓名</label>
          <input id="qr-name" v-model="vcard.name" type="text" class="field-input" />
        </div>
        <div>
          <label class="field-label" for="qr-org">公司 / 單位(選填)</label>
          <input id="qr-org" v-model="vcard.org" type="text" class="field-input" />
        </div>
        <div>
          <label class="field-label" for="qr-tel">電話</label>
          <input id="qr-tel" v-model="vcard.tel" type="tel" class="field-input" />
        </div>
        <div>
          <label class="field-label" for="qr-email">Email(選填)</label>
          <input id="qr-email" v-model="vcard.email" type="email" class="field-input" />
        </div>
        <div class="sm:col-span-2">
          <label class="field-label" for="qr-url">網站(選填)</label>
          <input id="qr-url" v-model="vcard.url" type="url" class="field-input" />
        </div>
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="field-label">尺寸:{{ sizePx }} px</label>
          <input v-model.number="sizePx" type="range" min="160" max="640" step="40" class="w-full accent-brand-600" />
        </div>
        <div>
          <label class="field-label">容錯等級</label>
          <select v-model="ecLevel" class="field-input">
            <option value="L">L —— 最省、圖最簡單</option>
            <option value="M">M —— 一般建議</option>
            <option value="Q">Q —— 較耐髒污/遮擋</option>
            <option value="H">H —— 最耐損(可印 logo)</option>
          </select>
        </div>
      </div>
    </div>

    <div class="card p-6 text-center">
      <div v-if="dataUrl" class="space-y-4">
        <img :src="dataUrl" alt="產生的 QR Code" class="mx-auto rounded-xl border border-line" :width="sizePx" :height="sizePx" />
        <div>
          <a :href="dataUrl" :download="downloadName" class="btn-primary inline-block">下載 PNG</a>
        </div>
      </div>
      <p v-else-if="error" class="text-sm text-red-600">{{ error }}</p>
      <p v-else class="py-8 text-sm text-ink-500">在上面填入內容,QR Code 會即時顯示在這裡。</p>
    </div>

    <LegalNote title="為什麼用這個,而不是隨便一個線上 QR 產生器?">
      <ul class="list-disc pl-5 space-y-1">
        <li>很多線上產生器會把你的網址換成「<strong>它的短網址</strong>」再轉跳,藉此記錄誰掃了你的碼,甚至日後偷偷改掉目的地。本工具<strong>直接編碼你的原始內容</strong>,不轉址、不追蹤。</li>
        <li>全程在你瀏覽器產生,輸入的 WiFi 密碼、聯絡資訊<strong>不會上傳</strong>到任何伺服器。</li>
        <li>WiFi QR 很適合貼在家裡讓客人/長輩直接掃描連線,不必手動輸入密碼。</li>
        <li>若要印上 logo 或會被弄髒,建議把容錯等級調到 Q 或 H,較不易掃不出來。</li>
        <li>提醒:掃描任何 QR Code 前,先確認連到的網址是否正常,假冒繳費/停車單的詐騙 QR 也很常見。</li>
      </ul>
    </LegalNote>
  </div>
</template>
