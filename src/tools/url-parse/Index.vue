<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { parseUrl, buildUrl, type UrlParam } from '@/features/urlParse'

/*
  網址解析 / 查詢字串編輯器 —— 把網址拆成各部位、查詢參數列成可編輯表格,
  改完即時組回。看清楚一條長網址連去哪、帶了哪些參數、刪掉追蹤碼。
  全程在你的瀏覽器解析,不連網、不上傳。
*/

const input = ref('')
// 使用者在表格裡編輯的參數(與解析結果分離,改了才動)
const editedParams = ref<UrlParam[] | null>(null)

const parsed = computed(() => parseUrl(input.value))

// 重新解析時,丟掉舊的編輯內容
const lastHref = ref('')
const params = computed<UrlParam[]>(() => {
  if (!parsed.value.ok) return []
  if (parsed.value.href !== lastHref.value) {
    lastHref.value = parsed.value.href!
    editedParams.value = parsed.value.params!.map((p) => ({ ...p }))
  }
  return editedParams.value ?? []
})

const partRows = computed(() => {
  if (!parsed.value.ok || !parsed.value.parts) return []
  const p = parsed.value.parts
  return [
    { k: '協定 (protocol)', v: p.protocol },
    { k: '主機 (host)', v: p.hostname },
    { k: '埠 (port)', v: p.port || '(預設)' },
    { k: '路徑 (path)', v: p.pathname || '/' },
    { k: '錨點 (hash)', v: p.hash || '(無)' },
    ...(p.username ? [{ k: '使用者', v: p.username }] : []),
  ]
})

const rebuilt = computed(() => {
  if (!parsed.value.ok || !parsed.value.parts) return ''
  return buildUrl(parsed.value.parts, params.value)
})

function removeParam(i: number) {
  if (editedParams.value) editedParams.value.splice(i, 1)
}
function addParam() {
  if (editedParams.value) editedParams.value.push({ key: '', value: '' })
}
function stripTracking() {
  if (!editedParams.value) return
  const junk = /^(utm_|fbclid$|gclid$|gad_|mc_|ref$|ref_src$|igshid$|si$|spm$|yclid$|_hsenc$|_hsmi$)/i
  editedParams.value = editedParams.value.filter((p) => !junk.test(p.key))
}

const hasTracking = computed(() =>
  params.value.some((p) =>
    /^(utm_|fbclid$|gclid$|gad_|mc_|ref$|ref_src$|igshid$|si$|spm$|yclid$|_hsenc$|_hsmi$)/i.test(p.key),
  ),
)

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    /* 忽略 */
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <div>
        <label class="field-label">貼上網址</label>
        <textarea
          v-model="input"
          rows="3"
          class="field-input font-mono text-sm"
          placeholder="例如 https://shop.example.com/item?id=42&utm_source=fb&utm_medium=cpc"
          spellcheck="false"
          autocomplete="off"
        ></textarea>
        <p class="field-hint">
          沒寫 <code>https://</code> 也行,系統會自動補上。全程在你瀏覽器解析,<strong>不連網、不上傳</strong>。
        </p>
      </div>

      <div
        v-if="input.trim() !== '' && !parsed.ok"
        class="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-800"
      >
        ⚠️ {{ parsed.error }}
      </div>

      <template v-else-if="parsed.ok">
        <div
          v-if="parsed.assumedProtocol"
          class="rounded-xl border border-brand-200 bg-brand-50/60 p-3 text-sm text-brand-800"
        >
          原輸入沒有協定,已自動以 <strong>https://</strong> 解析。
        </div>

        <!-- 各部位 -->
        <div>
          <div class="field-label">網址各部位</div>
          <div class="grid gap-2 sm:grid-cols-2">
            <div
              v-for="row in partRows"
              :key="row.k"
              class="rounded-lg bg-ink-50 px-3 py-2"
            >
              <div class="text-xs font-semibold text-ink-400">{{ row.k }}</div>
              <div class="break-all font-mono text-ink-800">{{ row.v }}</div>
            </div>
          </div>
        </div>

        <!-- 查詢參數 -->
        <div>
          <div class="mb-1 flex flex-wrap items-center justify-between gap-2">
            <div class="field-label !mb-0">查詢參數(可編輯)</div>
            <div class="flex gap-2">
              <button
                v-if="hasTracking"
                type="button"
                class="rounded-lg border border-rose-300 bg-rose-50 px-2.5 py-1 text-xs text-rose-700 transition hover:bg-rose-100"
                @click="stripTracking"
              >
                清掉追蹤碼
              </button>
              <button
                type="button"
                class="rounded-lg border border-ink-200 px-2.5 py-1 text-xs text-ink-600 transition hover:bg-ink-50"
                @click="addParam"
              >
                ＋ 新增參數
              </button>
            </div>
          </div>

          <p v-if="params.length === 0" class="text-sm text-ink-400">這個網址沒有查詢參數。</p>
          <div v-else class="space-y-2">
            <div v-for="(p, i) in params" :key="i" class="flex items-center gap-2">
              <input
                v-model="p.key"
                class="w-1/3 rounded-lg border border-ink-200 px-2 py-1.5 font-mono text-sm"
                placeholder="鍵"
                spellcheck="false"
              />
              <span class="text-ink-400">=</span>
              <input
                v-model="p.value"
                class="flex-1 rounded-lg border border-ink-200 px-2 py-1.5 font-mono text-sm"
                placeholder="值"
                spellcheck="false"
              />
              <button
                type="button"
                class="shrink-0 rounded-lg px-2 py-1.5 text-ink-400 transition hover:bg-rose-50 hover:text-rose-600"
                title="移除"
                @click="removeParam(i)"
              >
                ✕
              </button>
            </div>
          </div>
        </div>

        <!-- 組回的網址 -->
        <div>
          <div class="field-label">組回的網址</div>
          <button
            type="button"
            class="block w-full break-all rounded-lg bg-ink-50 px-3 py-2 text-left font-mono text-sm text-ink-800 transition hover:bg-ink-100"
            title="點一下複製"
            @click="copy(rebuilt)"
          >
            {{ rebuilt }}
          </button>
          <p class="mt-1 text-xs text-ink-400">改了上面的參數會即時反映;點一下可複製。</p>
        </div>
      </template>
    </div>

    <LegalNote title="這個工具能幫你什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li>把一條落落長的網址拆成<strong>協定、主機、路徑、查詢參數、錨點</strong>,一眼看懂結構。</li>
        <li>查詢參數列成表格,<strong>自動解碼</strong>(中文、空白都還原),想刪想改直接動手。</li>
        <li>一鍵<strong>清掉 utm、fbclid、gclid</strong> 等追蹤碼,分享連結更乾淨、不外洩來源。</li>
        <li>與「網址清理 / 看穿轉址」互補:那支拆轉址包裝,這支讓你細看與重組。</li>
        <li>本工具<strong>不連網、不上傳</strong>,全部在你的裝置上解析。</li>
      </ul>
    </LegalNote>
  </div>
</template>
