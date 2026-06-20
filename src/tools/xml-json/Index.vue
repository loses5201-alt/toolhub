<script setup lang="ts">
import { ref, computed } from 'vue'
import { RouterLink } from 'vue-router'
import LegalNote from '@/components/LegalNote.vue'
import { xmlToJson, jsonToXml } from '@/features/xmlJson'

/*
  XML ↔ JSON 轉換 —— 把 SOAP 回應 / RSS / pom.xml / Android 版面 / 各式設定檔轉成方便程式
  處理的 JSON,或反向還原成 XML。慣例:屬性 → "@" 前綴鍵、純文字 → 直接是值、混合文字放
  "#text"、同名重複子元素 → 陣列。全程在你的瀏覽器執行、不連網、不上傳(設定常含密鑰)。
*/

const direction = ref<'x2j' | 'j2x'>('x2j')
const parseValues = ref(false)
const indent = ref(2)

const xmlSample =
  '<note priority="high"><to>家人</to><from>我</from><tags><tag>提醒</tag><tag>重要</tag></tags><body>記得帶傘</body></note>'
const jsonSample = JSON.stringify(
  { note: { '@priority': 'high', to: '家人', from: '我', tags: { tag: ['提醒', '重要'] }, body: '記得帶傘' } },
  null,
  2,
)

const xmlInput = ref(xmlSample)
const jsonInput = ref(jsonSample)

const result = computed(() =>
  direction.value === 'x2j'
    ? xmlToJson(xmlInput.value, { parseValues: parseValues.value, indent: indent.value })
    : jsonToXml(jsonInput.value, { indent: indent.value }),
)

const copied = ref(false)
function copy() {
  if (!result.value.ok || !result.value.output) return
  navigator.clipboard?.writeText(result.value.output)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <div class="flex items-center gap-2 text-sm">
        <span class="text-ink-600">方向</span>
        <div class="inline-flex overflow-hidden rounded-lg border border-ink-200">
          <button
            class="px-3 py-1"
            :class="direction === 'x2j' ? 'bg-brand-600 text-white' : 'bg-white text-ink-600'"
            @click="direction = 'x2j'"
          >
            XML → JSON
          </button>
          <button
            class="px-3 py-1"
            :class="direction === 'j2x' ? 'bg-brand-600 text-white' : 'bg-white text-ink-600'"
            @click="direction = 'j2x'"
          >
            JSON → XML
          </button>
        </div>
      </div>

      <div v-if="direction === 'x2j'">
        <label class="field-label">貼上 XML</label>
        <textarea
          v-model="xmlInput"
          rows="8"
          class="field-input font-mono text-xs leading-relaxed"
          spellcheck="false"
          placeholder='<root><item id="1">x</item></root>'
        />
        <p class="field-hint">支援 SOAP、RSS/Atom、pom.xml、Android 版面等。屬性轉成 <code>@</code> 前綴鍵、同名子元素合併成陣列。</p>
      </div>
      <div v-else>
        <label class="field-label">貼上 JSON</label>
        <textarea
          v-model="jsonInput"
          rows="8"
          class="field-input font-mono text-xs leading-relaxed"
          spellcheck="false"
          placeholder='{ "root": { "@id": "1", "#text": "x" } }'
        />
        <p class="field-hint"><code>@</code> 開頭的鍵變成屬性、<code>#text</code> 變成文字內容、陣列展開成多個同名元素。</p>
      </div>

      <div class="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
        <label class="flex items-center gap-2">
          <span class="text-ink-600">縮排</span>
          <select v-model.number="indent" class="field-input !w-auto !py-1">
            <option :value="2">2 空格</option>
            <option :value="4">4 空格</option>
          </select>
        </label>
        <label v-if="direction === 'x2j'" class="flex items-center gap-2">
          <input v-model="parseValues" type="checkbox" class="h-4 w-4" />
          <span class="text-ink-600">把數字 / true / false 轉成對應型別</span>
        </label>
      </div>
    </div>

    <div v-if="!result.ok" class="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-800">
      ⚠️ {{ direction === 'x2j' ? 'XML' : 'JSON' }} 格式有誤:{{ result.error }}
    </div>

    <div v-else-if="result.output" class="card p-4 space-y-2">
      <div class="flex items-center gap-3">
        <span class="text-sm font-semibold text-emerald-700">✓ 已轉成 {{ direction === 'x2j' ? 'JSON' : 'XML' }}</span>
        <button class="ml-auto text-sm text-brand-700 underline hover:text-brand-800" @click="copy">
          {{ copied ? '已複製 ✓' : '複製' }}
        </button>
      </div>
      <pre class="overflow-x-auto rounded-lg bg-ink-900 p-4 text-xs leading-relaxed text-ink-50"><code>{{ result.output }}</code></pre>
    </div>

    <div class="text-sm text-ink-500">
      只想<RouterLink to="/tools/xml-format" class="font-semibold text-brand-700 underline hover:text-brand-800">美化 XML</RouterLink>、轉
      <RouterLink to="/tools/json-yaml" class="font-semibold text-brand-700 underline hover:text-brand-800">JSON ↔ YAML</RouterLink>,
      或整理
      <RouterLink to="/tools/json-repair" class="font-semibold text-brand-700 underline hover:text-brand-800">JSON</RouterLink>?
    </div>

    <LegalNote title="慣例與限制">
      <ul class="list-disc pl-5 space-y-1">
        <li><strong>屬性</strong>:<code>&lt;book id="1"&gt;</code> → <code>{ "book": { "@id": "1" } }</code>(以 <code>@</code> 為前綴)。</li>
        <li><strong>純文字元素</strong>直接變成字串;同時有屬性或子元素時,文字放在 <code>#text</code>。</li>
        <li><strong>同名重複的子元素</strong>會收斂成<strong>陣列</strong>(例:多筆 <code>&lt;item&gt;</code> → <code>item: [...]</code>)。</li>
        <li>CDATA 視為文字;<strong>註解、<code>&lt;?xml?&gt;</code> 宣告、DOCTYPE 在轉 JSON 時略過</strong>。實體(<code>&amp;amp;</code> 等)會正確解碼 / 重新跳脫。</li>
        <li><strong>不能</strong>:不做 schema(DTD/XSD)驗證;命名空間前綴(<code>ns:tag</code>)原樣保留為鍵名。標籤不相符會誠實報錯。</li>
        <li>全程<strong>在你的瀏覽器</strong>處理,含密鑰的設定<strong>不連網、不上傳</strong>。</li>
      </ul>
    </LegalNote>
  </div>
</template>
