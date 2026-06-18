<script setup lang="ts">
import { ref } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { stripMetadata, type ImageType } from '@/features/exifStrip'

/*
  照片個資清除 —— 不重新編碼、直接移除 JPEG/PNG 夾帶的 EXIF/GPS/XMP/IPTC/拍攝資訊,畫質完全不變。
  全程在瀏覽器以位元組運算處理,照片不上傳。核心在 src/features/exifStrip.ts(可測)。
*/
interface Item {
  id: number
  name: string
  ext: string
  type: ImageType
  origSize: number
  removed: number
  outBlob?: Blob
  note: string
}

const items = ref<Item[]>([])
const busy = ref(false)
const error = ref('')
let uid = 0

function fmtSize(n: number): string {
  if (n < 1024) return n + ' B'
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB'
  return (n / 1024 / 1024).toFixed(2) + ' MB'
}

async function onFiles(e: Event) {
  const input = e.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = ''
  if (!files.length) return
  busy.value = true
  error.value = ''
  try {
    for (const f of files) {
      const bytes = new Uint8Array(await f.arrayBuffer())
      const { type, output, removed } = stripMetadata(bytes)
      const ext = (f.name.match(/\.[^.]+$/)?.[0] ?? '').toLowerCase()
      let note = ''
      if (type === null) {
        note = '不是 JPEG/PNG,未處理(此工具只處理這兩種照片格式)'
      } else if (removed === 0) {
        note = '本來就沒有夾帶可移除的中繼資料,已是乾淨檔'
      } else {
        note = `已移除 ${fmtSize(removed)} 中繼資料(含 EXIF/GPS 等)`
      }
      items.value.push({
        id: uid++,
        name: f.name.replace(/\.[^.]+$/, ''),
        ext: ext || (type === 'png' ? '.png' : '.jpg'),
        type,
        origSize: bytes.length,
        removed,
        outBlob: type ? new Blob([output as BlobPart], { type: `image/${type}` }) : undefined,
        note,
      })
    }
  } catch (err) {
    error.value = '讀取失敗:' + (err as Error).message
  } finally {
    busy.value = false
  }
}

function download(it: Item) {
  if (!it.outBlob) return
  const url = URL.createObjectURL(it.outBlob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${it.name}_乾淨${it.ext}`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function downloadAll() {
  for (const it of items.value) if (it.outBlob && it.removed > 0) download(it)
}

function remove(id: number) {
  items.value = items.value.filter((x) => x.id !== id)
}
function clearAll() {
  items.value = []
  error.value = ''
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-4 sm:p-6 space-y-5">
      <div>
        <label class="field-label">選擇照片(JPG／PNG,可多選)</label>
        <input type="file" accept="image/jpeg,image/png" multiple class="field-input" @change="onFiles" />
        <p class="field-hint">
          照片只在你的瀏覽器處理、不會上傳。<strong>不重新壓縮、畫質完全不變</strong>,只把夾帶的個資拿掉。
        </p>
      </div>

      <p v-if="error" class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ error }}</p>

      <div v-if="items.length" class="flex flex-wrap items-center gap-3">
        <button class="btn-primary !py-2 text-sm" :disabled="busy" @click="downloadAll">
          下載全部乾淨檔
        </button>
        <button
          class="text-ink-400 underline text-sm hover:text-red-500 disabled:opacity-40"
          :disabled="busy"
          @click="clearAll"
        >
          清空重來
        </button>
      </div>

      <ul v-if="items.length" class="space-y-2">
        <li
          v-for="it in items"
          :key="it.id"
          class="rounded-xl border border-line bg-white p-3 text-sm"
        >
          <div class="flex items-center gap-2">
            <span class="flex-1 truncate font-medium text-ink-700">{{ it.name }}{{ it.ext }}</span>
            <button class="text-ink-400 hover:text-red-500" title="移除" @click="remove(it.id)">✕</button>
          </div>
          <p
            class="mt-1 text-xs"
            :class="it.type === null ? 'text-amber-700' : it.removed > 0 ? 'text-green-700' : 'text-ink-500'"
          >
            {{ it.note }}
          </p>
          <div v-if="it.outBlob" class="mt-2 flex flex-wrap items-center gap-3">
            <span class="text-xs text-ink-500">
              {{ fmtSize(it.origSize) }} → {{ fmtSize(it.origSize - it.removed) }}
            </span>
            <button class="btn-primary !py-1.5 !px-3 text-xs" @click="download(it)">下載乾淨檔</button>
          </div>
        </li>
      </ul>
    </div>

    <LegalNote title="為什麼要清掉照片裡的個資?">
      <ul class="list-disc pl-5 space-y-1">
        <li>
          手機拍的照片常夾帶 <strong>GPS 定位</strong>(會洩漏住家/公司位置)、拍攝時間、手機型號等;
          直接傳上社群、二手交易、論壇等於把這些一併送出去。
        </li>
        <li>
          想先「看看照片夾帶了什麼」,可用「照片隱私檢視器(EXIF)」;這支則是直接把它<strong>移除</strong>。
        </li>
        <li>
          <strong>不重新編碼</strong>:和「圖片工坊」靠重新壓縮去 EXIF 不同,這支保留原始影像位元、畫質與格式不變,只刪中繼資料段。
        </li>
        <li>保留 ICC 色彩設定檔,顯示顏色不跑掉。處理與下載全程在你的裝置,照片不上傳。</li>
      </ul>
    </LegalNote>
  </div>
</template>
