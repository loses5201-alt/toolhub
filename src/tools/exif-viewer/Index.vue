<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'

/*
  EXIF 隱私檢視器 —— 看一張照片偷偷夾帶了什麼:拍攝時間、相機/手機型號,
  甚至「拍攝地點的 GPS 經緯度」。歹徒能從你 PO 出去的照片定位你家或孩子的學校。
  本工具用 exifr 在你瀏覽器本機解析,照片不上傳;看完想清乾淨可到「圖片工坊」批次去 EXIF。
*/
interface Row { label: string; value: string }
const fileName = ref('')
const loading = ref(false)
const error = ref('')
const rows = ref<Row[]>([])
const gps = ref<{ lat: number; lon: number } | null>(null)
const parsed = ref(false) // 是否成功解析過(用來區分「沒夾帶」與「還沒選檔」)

function fmtDate(v: unknown): string {
  if (v instanceof Date && !isNaN(v.getTime())) {
    return v.toLocaleString('zh-TW', { hour12: false })
  }
  return String(v)
}

async function onFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  fileName.value = file.name
  loading.value = true
  error.value = ''
  rows.value = []
  gps.value = null
  parsed.value = false
  try {
    const exifr = (await import('exifr')).default
    const data = await exifr.parse(file, {
      tiff: true, exif: true, gps: true,
      translateKeys: true, translateValues: true, reviveValues: true, mergeOutput: true,
    }).catch(() => null)

    const out: Row[] = []
    const push = (label: string, v: unknown) => {
      if (v === undefined || v === null || v === '') return
      out.push({ label, value: typeof v === 'object' ? fmtDate(v) : String(v) })
    }
    if (data) {
      push('拍攝時間', data.DateTimeOriginal ?? data.CreateDate ?? data.ModifyDate)
      push('相機 / 手機品牌', data.Make)
      push('型號', data.Model)
      push('鏡頭', data.LensModel)
      if (data.ImageWidth && data.ImageHeight) push('原始尺寸', `${data.ImageWidth} × ${data.ImageHeight}`)
      push('光圈', data.FNumber ? `f/${data.FNumber}` : undefined)
      push('快門', data.ExposureTime ? `${data.ExposureTime} 秒` : undefined)
      push('ISO', data.ISO)
      push('焦距', data.FocalLength ? `${data.FocalLength} mm` : undefined)
      push('編輯軟體', data.Software)
      if (typeof data.latitude === 'number' && typeof data.longitude === 'number') {
        gps.value = { lat: data.latitude, lon: data.longitude }
      }
    }
    rows.value = out
    parsed.value = true
  } catch (err) {
    error.value = err instanceof Error ? err.message : '解析失敗'
  } finally {
    loading.value = false
  }
}

const mapUrl = computed(() =>
  gps.value ? `https://www.google.com/maps?q=${gps.value.lat},${gps.value.lon}` : '',
)
const gpsText = computed(() =>
  gps.value ? `${gps.value.lat.toFixed(6)}, ${gps.value.lon.toFixed(6)}` : '',
)
const hasAny = computed(() => rows.value.length > 0 || gps.value)
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <div>
        <label class="field-label" for="exif-file">選擇一張照片</label>
        <input id="exif-file" type="file" accept="image/*" class="field-input" @change="onFile" />
        <p class="field-hint">照片只在你的瀏覽器解析,不會上傳到任何伺服器。</p>
      </div>
      <p v-if="fileName" class="text-sm text-ink-500">檔案:{{ fileName }}</p>
      <p v-if="loading" class="text-sm text-ink-500">解析中…</p>
      <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
    </div>

    <!-- GPS 警示(最重要) -->
    <div v-if="gps" class="rounded-2xl border-2 border-red-300 bg-red-50 p-5">
      <div class="mb-2 flex items-center gap-2 font-semibold text-red-700">
        <span>📍</span><span>這張照片夾帶了「拍攝地點」!</span>
      </div>
      <p class="text-sm text-ink-700">
        經緯度:<code class="font-mono">{{ gpsText }}</code>
      </p>
      <p class="mt-1 text-sm text-ink-700">
        任何拿到原圖的人都能據此找到你拍照的位置。直接分享前,強烈建議先清除定位資訊。
      </p>
      <a :href="mapUrl" target="_blank" rel="noopener noreferrer"
         class="mt-3 inline-block text-sm font-medium text-brand-700 underline">在地圖上查看這個位置 ↗</a>
    </div>

    <!-- 其他 EXIF -->
    <div v-if="rows.length" class="card p-4">
      <dl class="divide-y divide-line">
        <div v-for="r in rows" :key="r.label" class="flex gap-4 px-1 py-2.5">
          <dt class="w-32 shrink-0 text-sm text-ink-500">{{ r.label }}</dt>
          <dd class="min-w-0 flex-1 break-words text-sm text-ink-900">{{ r.value }}</dd>
        </div>
      </dl>
    </div>

    <!-- 沒有夾帶任何資訊 -->
    <div v-else-if="parsed && !hasAny" class="card p-6 text-center text-sm text-ink-600">
      ✅ 這張照片沒有夾帶可讀的 EXIF 資訊(可能來自截圖、已被通訊軟體壓縮,或已清除)。分享相對安全。
    </div>

    <LegalNote title="EXIF 是什麼?為什麼要在意?">
      <ul class="list-disc pl-5 space-y-1">
        <li>EXIF 是相機/手機拍照時<strong>自動寫進照片裡的隱藏資訊</strong>,可能包含拍攝時間、裝置型號,以及最敏感的<strong>GPS 拍攝座標</strong>。</li>
        <li>把含定位的照片 PO 上網或傳給陌生人,等於告訴對方你家、公司或孩子學校的位置 —— 這是真實發生過的跟蹤與詐騙手法。</li>
        <li>多數社群平台(FB、IG、LINE)上傳時會自動移除 EXIF,但<strong>原圖檔、雲端連結、AirDrop、email 附件通常保留</strong>。</li>
        <li>想清乾淨:到本站「<router-link to="/tools/image-studio" class="text-brand-700 underline">圖片工坊</router-link>」轉檔/壓縮即可一併去除 EXIF(可批次)。</li>
        <li>全程在你瀏覽器用 exifr 解析,照片<strong>不上傳</strong>。</li>
      </ul>
    </LegalNote>
  </div>
</template>
