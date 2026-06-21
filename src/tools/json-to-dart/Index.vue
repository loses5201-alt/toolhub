<script setup lang="ts">
import { ref, computed } from 'vue'
import { RouterLink } from 'vue-router'
import LegalNote from '@/components/LegalNote.vue'
import { jsonToDart } from '@/features/jsonToDart'

/*
  JSON → Dart —— 貼上 JSON,自動推斷出 Dart class,Flutter / Dart 開發省去手刻型別。
  plain 模式自帶 fromJson 工廠 + toJson(免 codegen,直接可用);json_serializable 模式產生
  @JsonSerializable + @JsonKey 標註,搭配 build_runner。屬性採 lowerCamelCase。
  與 json-to-ts / go / python / rust / csharp / kotlin / java / swift 互補。全程在你的瀏覽器處理,不上傳。
*/
const input = ref(
  `{
  "id": 1,
  "user_name": "小明",
  "vip": false,
  "score": 9.5,
  "tags": ["new", "vip"],
  "address": { "city": "台北", "zip": "100" },
  "orders": [
    { "no": "A001", "amount": 1200 },
    { "no": "A002", "amount": 980, "note": "急件" }
  ]
}`,
)
const rootName = ref('Root')
const mode = ref<'plain' | 'serializable'>('plain')

const result = computed(() =>
  jsonToDart(input.value, { rootName: rootName.value.trim() || 'Root', mode: mode.value }),
)

const copied = ref(false)
function copy() {
  if (!result.value.ok || !result.value.code) return
  navigator.clipboard?.writeText(result.value.code)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <div>
        <label class="field-label" for="jd-in">JSON 內容</label>
        <textarea
          id="jd-in"
          v-model="input"
          rows="11"
          class="field-input font-mono text-xs leading-relaxed"
          spellcheck="false"
        />
        <p class="field-hint">貼上 API 回應或任何 JSON。全程在你的瀏覽器處理,不上傳。</p>
      </div>
      <div class="flex flex-wrap gap-4">
        <div class="sm:w-56">
          <label class="field-label" for="jd-root">根類別名稱</label>
          <input id="jd-root" v-model="rootName" class="field-input" placeholder="Root" />
        </div>
        <div>
          <label class="field-label" for="jd-mode">序列化方式</label>
          <select id="jd-mode" v-model="mode" class="field-input">
            <option value="plain">手寫 fromJson / toJson(免 codegen)</option>
            <option value="serializable">json_serializable(@JsonKey + build_runner)</option>
          </select>
        </div>
      </div>
    </div>

    <div v-if="!result.ok" class="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-800">
      ⚠️ {{ result.error }}
    </div>

    <div v-else class="card p-4 space-y-2">
      <div class="flex items-center gap-3">
        <span class="text-sm font-semibold text-emerald-700">✓ 已產生 Dart class</span>
        <button class="ml-auto text-sm text-brand-700 underline hover:text-brand-800" @click="copy">
          {{ copied ? '已複製 ✓' : '複製' }}
        </button>
      </div>
      <pre class="overflow-x-auto rounded-lg bg-ink-900 p-4 text-xs leading-relaxed text-ink-50"><code>{{ result.code }}</code></pre>
    </div>

    <div class="text-sm text-ink-500">
      也可以轉成
      <RouterLink to="/tools/json-to-swift" class="font-semibold text-brand-700 underline hover:text-brand-800">Swift</RouterLink>、
      <RouterLink to="/tools/json-to-kotlin" class="font-semibold text-brand-700 underline hover:text-brand-800">Kotlin</RouterLink>、
      <RouterLink to="/tools/json-to-java" class="font-semibold text-brand-700 underline hover:text-brand-800">Java</RouterLink>
      或
      <RouterLink to="/tools/json-to-ts" class="font-semibold text-brand-700 underline hover:text-brand-800">TypeScript</RouterLink>
      。
    </div>

    <LegalNote title="這個工具能、不能做什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li><strong>能</strong>:從範例 JSON 推斷出 Dart class —— 屬性採 lowerCamelCase。<strong>plain 模式</strong>自帶 <code>fromJson</code> 工廠與 <code>toJson</code>,免 codegen 直接可用;<strong>json_serializable 模式</strong>產生 <code>@JsonSerializable</code> + <code>@JsonKey(name:)</code>,執行 <code>dart run build_runner build</code> 產生序列化碼。巢狀物件各自成 class、陣列合併欄位。</li>
        <li><strong>型別</strong>:整數→<code>int</code>、含小數→<code>double</code>(整數與小數混用也→<code>double</code>)、布林→<code>bool</code>、字串→<code>String</code>;<code>null</code> 或缺鍵→可空 <code>T?</code>(建構子改為非 required);型別衝突或全 <code>null</code>→<code>dynamic</code>;撞 Dart 關鍵字的屬性名自動補底線(plain 模式 fromJson/toJson 仍以原鍵存取)。</li>
        <li><strong>不能</strong>:推斷 <code>DateTime</code> 等語意型別、辨識動態鍵 Map、產生 <code>copyWith</code> / <code>==</code> / <code>hashCode</code>。</li>
        <li>全程<strong>在你的瀏覽器</strong>處理,可能含密鑰的回應<strong>不連網、不上傳</strong>。</li>
      </ul>
    </LegalNote>
  </div>
</template>
