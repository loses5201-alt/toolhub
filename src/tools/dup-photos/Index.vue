<script setup lang="ts">
import { ref, computed, onBeforeUnmount } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { toGray, dHash, clusterByHash, HASH_W, HASH_H, type HashItem } from '@/features/imageHash'

/*
  重複 / 相似照片偵測 —— 用感知雜湊(dHash)找出重複或近似(改尺寸、重存、輕壓縮)的照片。
  全程在你瀏覽器讀取與比對,照片不上傳。無法刪除你磁碟上的檔案,但能指出哪些是重複,讓你自行清理。
*/
interface Pic {
  id: number
  name: string
  size: number
  url: string
  hash: number[]
}
const pics = ref<Pic[]>([])
const busy = ref(false)
const progress = ref(0)
const total = ref(0)
const error = ref('')
const threshold = ref(8) // 漢明距離門檻:0 嚴格、越大越寬鬆

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image()
    img.onload = () => res(img)
    img.onerror = () => rej(new Error('讀取失敗'))
    img.src = url
  })
}

async function hashOf(img: HTMLImageElement): Promise<number[]> {
  const canvas = document.createElement('canvas')
  canvas.width = HASH_W
  canvas.height = HASH_H
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0, HASH_W, HASH_H)
  const { data } = ctx.getImageData(0, 0, HASH_W, HASH_H)
  return dHash(toGray(data))
}

async function onFiles(e: Event) {
  const files = Array.from((e.target as HTMLInputElement).files || []).filter((f) => f.type.startsWith('image/'))
  ;(e.target as HTMLInputElement).value = ''
  if (!files.length) return
  error.value = ''
  busy.value = true
  progress.value = 0
  total.value = files.length
  let nextId = pics.value.length
  for (const f of files) {
    const url = URL.createObjectURL(f)
    try {
      const img = await loadImage(url)
      const hash = await hashOf(img)
      pics.value.push({ id: nextId++, name: f.name, size: f.size, url, hash })
    } catch {
      URL.revokeObjectURL(url)
    }
    progress.value++
  }
  busy.value = false
}

// 依目前門檻分群,只保留「成員 ≥ 2」的群(即有重複/相似的)
const groups = computed(() => {
  const items: HashItem[] = pics.value.map((p) => ({ id: p.id, hash: p.hash }))
  const byId = new Map(pics.value.map((p) => [p.id, p]))
  return clusterByHash(items, threshold.value)
    .filter((ids) => ids.length >= 2)
    .map((ids) => ids.map((id) => byId.get(id)!))
})

const dupCount = computed(() => groups.value.reduce((n, g) => n + (g.length - 1), 0))

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

function clearAll() {
  pics.value.forEach((p) => URL.revokeObjectURL(p.url))
  pics.value = []
}
onBeforeUnmount(clearAll)
</script>

<template>
  <div class="space-y-6">
    <div class="card p-4 sm:p-6 space-y-5">
      <div>
        <label class="field-label">選擇要比對的照片(可一次多選)</label>
        <input type="file" accept="image/*" multiple class="field-input" @change="onFiles" />
        <p class="field-hint">照片只在你的瀏覽器讀取與比對,不會上傳。可分批加入,會一起比對。</p>
      </div>

      <p v-if="error" class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{{ error }}</p>
      <p v-if="busy" class="text-sm text-ink-600">比對中… {{ progress }} / {{ total }}</p>

      <template v-if="pics.length">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <p class="text-sm text-ink-700">
            已載入 <strong>{{ pics.length }}</strong> 張,找到 <strong>{{ groups.length }}</strong> 組相似、約
            <strong>{{ dupCount }}</strong> 張可清理。
          </p>
          <button class="rounded-lg border border-line bg-white px-3 py-1.5 text-sm hover:border-brand-400" @click="clearAll">清空重來</button>
        </div>

        <label class="block">
          <span class="field-label">相似度寬鬆度:{{ threshold }}(0 = 幾乎一模一樣;越大連改過的也算)</span>
          <input v-model.number="threshold" type="range" min="0" max="20" class="w-full" />
        </label>

        <div v-if="groups.length === 0 && !busy" class="rounded-lg bg-brand-50/50 px-3 py-4 text-center text-sm text-ink-600">
          目前門檻下沒有發現重複或相似的照片 👍 可把上面的「寬鬆度」調大再看看。
        </div>

        <div v-for="(g, gi) in groups" :key="gi" class="rounded-xl border border-line p-3">
          <p class="mb-2 text-sm font-medium text-ink-700">第 {{ gi + 1 }} 組({{ g.length }} 張相似)</p>
          <div class="flex flex-wrap gap-3">
            <div v-for="(p, pi) in g" :key="p.id" class="w-28 text-center">
              <div class="relative">
                <img :src="p.url" :alt="p.name" class="h-24 w-28 rounded border border-line object-cover" />
                <span
                  v-if="pi === 0"
                  class="absolute left-1 top-1 rounded bg-brand-600 px-1.5 py-0.5 text-[10px] font-medium text-white"
                  >保留建議</span
                >
              </div>
              <p class="mt-1 truncate text-xs text-ink-600" :title="p.name">{{ p.name }}</p>
              <p class="text-[11px] text-ink-400">{{ fmtBytes(p.size) }}</p>
            </div>
          </div>
        </div>
      </template>
    </div>

    <LegalNote title="使用說明與為什麼用這個">
      <ul class="list-disc space-y-1 pl-5">
        <li><strong>不上傳</strong>:相簿是隱私,本工具全程在你瀏覽器讀取與比對,照片不送任何伺服器。</li>
        <li>用<strong>感知雜湊(dHash)</strong>比對「看起來像不像」,所以連改過尺寸、重新存檔、輕微壓縮的同一張照片也找得出來 —— 不只比對完全相同的檔。</li>
        <li>每組第一張標「保留建議」(僅供參考);本工具<strong>無法刪除你磁碟上的檔案</strong>,請依檔名自行到檔案總管刪除多餘的。</li>
        <li>「寬鬆度」越大,連構圖相近但不同的照片也可能被歸在一起,請以縮圖確認後再刪。</li>
      </ul>
    </LegalNote>
  </div>
</template>
