<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import {
  encryptText,
  decryptText,
  encryptBytes,
  decryptBytes,
} from '@/features/cryptoBox'

/*
  本機加密保險箱 —— 用瀏覽器 Web Crypto(AES-GCM 256 + PBKDF2)替文字或檔案上密碼。
  密碼與內容全程留在本機,不上傳。把加密結果寄出,另以電話/當面告知密碼,對方才解得開。
*/
type Mode = 'encrypt' | 'decrypt'
type Kind = 'text' | 'file'

const mode = ref<Mode>('encrypt')
const kind = ref<Kind>('text')
const password = ref('')
const confirm = ref('')
const inputText = ref('')
const outputText = ref('')
const file = ref<File | null>(null)
const busy = ref(false)
const error = ref('')
const done = ref('')

const pwMismatch = computed(
  () => mode.value === 'encrypt' && confirm.value.length > 0 && password.value !== confirm.value,
)

function reset() {
  outputText.value = ''
  error.value = ''
  done.value = ''
}

function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0] || null
  file.value = f
  reset()
  ;(e.target as HTMLInputElement).value = ''
}

function downloadBytes(bytes: Uint8Array, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function run() {
  reset()
  if (!password.value) {
    error.value = '請輸入密碼'
    return
  }
  if (mode.value === 'encrypt' && password.value !== confirm.value) {
    error.value = '兩次輸入的密碼不一致'
    return
  }
  busy.value = true
  try {
    if (kind.value === 'text') {
      if (!inputText.value) {
        error.value = mode.value === 'encrypt' ? '請輸入要加密的文字' : '請貼上加密字串'
        return
      }
      outputText.value =
        mode.value === 'encrypt'
          ? await encryptText(inputText.value, password.value)
          : await decryptText(inputText.value, password.value)
      done.value = mode.value === 'encrypt' ? '已加密,複製下方字串傳給對方' : '已成功解密'
    } else {
      if (!file.value) {
        error.value = '請選擇檔案'
        return
      }
      const data = new Uint8Array(await file.value.arrayBuffer())
      if (mode.value === 'encrypt') {
        const out = await encryptBytes(data, password.value)
        downloadBytes(out, file.value.name + '.enc', 'application/octet-stream')
        done.value = '已加密並下載(副檔名 .enc)'
      } else {
        const out = await decryptBytes(data, password.value)
        const name = file.value.name.replace(/\.enc$/i, '') || 'decrypted'
        downloadBytes(out, name, 'application/octet-stream')
        done.value = '已成功解密並下載'
      }
    }
  } catch (e) {
    error.value = (e as Error).message || '處理失敗'
  } finally {
    busy.value = false
  }
}

async function copyOut() {
  try {
    await navigator.clipboard.writeText(outputText.value)
    done.value = '已複製到剪貼簿'
  } catch {
    /* 忽略 */
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-4 sm:p-6 space-y-5">
      <!-- 加密 / 解密 -->
      <div class="grid grid-cols-2 gap-2">
        <button
          v-for="m in (['encrypt', 'decrypt'] as Mode[])"
          :key="m"
          class="rounded-xl border px-3 py-3 font-semibold transition"
          :class="mode === m
            ? 'border-brand-500 bg-brand-50 text-brand-700 ring-1 ring-brand-300'
            : 'border-line bg-white text-ink-700 hover:bg-stone-50'"
          @click="mode = m; reset()"
        >
          {{ m === 'encrypt' ? '🔒 加密' : '🔓 解密' }}
        </button>
      </div>

      <!-- 文字 / 檔案 -->
      <div class="flex gap-2">
        <button
          v-for="k in (['text', 'file'] as Kind[])"
          :key="k"
          class="rounded-full border px-4 py-1.5 text-sm transition"
          :class="kind === k
            ? 'border-brand-400 bg-brand-50 text-brand-700'
            : 'border-line bg-white text-ink-600 hover:bg-stone-50'"
          @click="kind = k; reset()"
        >
          {{ k === 'text' ? '文字' : '檔案' }}
        </button>
      </div>

      <!-- 輸入 -->
      <div v-if="kind === 'text'">
        <label class="field-label">{{ mode === 'encrypt' ? '要加密的文字' : '要解密的加密字串' }}</label>
        <textarea
          v-model="inputText"
          rows="5"
          class="field-input font-mono text-sm"
          :placeholder="mode === 'encrypt' ? '貼上要保護的內容…' : '貼上對方傳來的加密字串…'"
        />
      </div>
      <div v-else>
        <label class="field-label">{{ mode === 'encrypt' ? '要加密的檔案' : '要解密的 .enc 檔案' }}</label>
        <input type="file" class="field-input" @change="onFile" />
        <p class="field-hint">
          <template v-if="file">已選:📎 {{ file.name }}</template>
          <template v-else>檔案只在你的瀏覽器處理,不會上傳。</template>
        </p>
      </div>

      <!-- 密碼 -->
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="field-label">密碼</label>
          <input v-model="password" type="password" autocomplete="off" class="field-input" placeholder="設定一組密碼" />
        </div>
        <div v-if="mode === 'encrypt'">
          <label class="field-label">再次輸入密碼</label>
          <input v-model="confirm" type="password" autocomplete="off" class="field-input" placeholder="確認密碼" />
          <p v-if="pwMismatch" class="mt-1 text-xs text-red-600">兩次密碼不一致</p>
        </div>
      </div>

      <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
      <p v-else-if="done" class="text-sm text-emerald-700">{{ done }}</p>

      <button class="btn-primary w-full sm:w-auto" :disabled="busy" @click="run">
        {{ busy ? '處理中…' : mode === 'encrypt' ? '加密' : '解密' }}
      </button>

      <!-- 文字結果 -->
      <div v-if="kind === 'text' && outputText">
        <label class="field-label">{{ mode === 'encrypt' ? '加密結果(複製傳給對方)' : '解密結果' }}</label>
        <textarea :value="outputText" rows="5" readonly class="field-input font-mono text-sm" />
        <button
          class="mt-2 rounded-lg border border-line bg-white px-4 py-1.5 text-sm font-semibold text-ink-700 transition hover:border-brand-300 hover:text-brand-700"
          @click="copyOut"
        >
          複製
        </button>
      </div>
    </div>

    <LegalNote title="為什麼要用本機加密,而不是線上加密網站?">
      <ul class="list-disc pl-5 space-y-1">
        <li><strong>不上傳</strong>:加密、解密、密碼全部在你自己的瀏覽器完成,內容與密碼都不會送到任何伺服器。</li>
        <li>線上加密網站若把你的內容或密碼記下來,等於把祕密交給陌生人 —— 這類事就該在本機做。</li>
        <li>採用瀏覽器內建、業界標準的 <strong>AES-GCM 256 位元</strong>加密,金鑰由密碼經 PBKDF2(25 萬次)衍生。</li>
        <li>用法:把加密結果(字串或 .enc 檔)寄給對方,<strong>另以電話或當面</strong>告知密碼,對方才解得開。</li>
        <li class="text-red-600"><strong>密碼一旦忘記,內容將無法救回</strong> —— 沒有後門、沒有人能幫你還原。請妥善保管密碼。</li>
      </ul>
    </LegalNote>
  </div>
</template>
