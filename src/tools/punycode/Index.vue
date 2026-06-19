<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { analyzeDomain, type ScriptTag } from '@/features/punycode'

/*
  Punycode / IDN 網域檢視 —— 把 xn-- 開頭的網域解回真正的 Unicode,
  揪出用西里爾/希臘字母假冒英文字母的「形近字釣魚網域」。
  全程在你瀏覽器解析,不連網、不上傳。
*/

const input = ref('')

const result = computed(() => {
  const s = input.value.trim()
  if (s === '') return null
  return analyzeDomain(s)
})

const scriptNames: Record<ScriptTag, string> = {
  latin: '拉丁',
  cyrillic: '西里爾',
  greek: '希臘',
  han: '漢字',
  kana: '日文假名',
  hangul: '韓文',
  arabic: '阿拉伯',
  hebrew: '希伯來',
  digit: '數字',
  other: '其他',
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    /* 忽略 */
  }
}

const examples = ['xn--maana-pta.com', 'xn--80ak6aa92e.com', 'xn--pyoutube-hi9d.com']
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <div>
        <label class="field-label">貼上網域或網址</label>
        <input
          v-model="input"
          class="field-input font-mono"
          placeholder="例如 xn--maana-pta.com 或 https://例子.tw"
          spellcheck="false"
          autocomplete="off"
        />
        <p class="field-hint">
          xn-- 開頭的網域是「國際化網域(IDN)」的 ASCII 編碼,瀏覽器網址列有時只給你這串看不懂的碼。
          貼上來就能看到它<strong>真正顯示成什麼字</strong>。不連網、不上傳。
        </p>
        <div class="mt-2 flex flex-wrap gap-2">
          <button
            v-for="ex in examples"
            :key="ex"
            type="button"
            class="rounded-lg border border-ink-200 px-2.5 py-1 font-mono text-xs text-ink-600 transition hover:bg-ink-50"
            @click="input = ex"
          >
            {{ ex }}
          </button>
        </div>
      </div>

      <template v-if="result">
        <!-- 風險警示 -->
        <div
          v-if="result.risky"
          class="rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800"
        >
          ⚠️ <strong>小心:可能是形近字釣魚網域。</strong>這個網域混用了拉丁字母與長得很像的西里爾/希臘字母,
          肉眼幾乎分不出來,常被用來假冒知名網站。請務必確認來源,別輕易登入或付款。
        </div>
        <div
          v-else-if="result.hasPunycode"
          class="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-800"
        >
          這是國際化網域(IDN),已解回真正的文字如下。確認它<strong>真的是你要去的網站</strong>再前往。
        </div>
        <div
          v-else
          class="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 text-sm text-emerald-800"
        >
          這是一般 ASCII 網域,未偵測到 IDN 編碼或明顯形近字混用。
        </div>

        <!-- 解碼結果 -->
        <div class="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            class="rounded-lg bg-ink-50 px-3 py-2 text-left transition hover:bg-ink-100"
            title="點一下複製"
            @click="copy(result.unicode)"
          >
            <div class="text-xs font-semibold text-ink-400">真正顯示的文字(Unicode)</div>
            <div class="break-all font-mono text-lg text-ink-800">{{ result.unicode }}</div>
          </button>
          <button
            type="button"
            class="rounded-lg bg-ink-50 px-3 py-2 text-left transition hover:bg-ink-100"
            title="點一下複製"
            @click="copy(result.ascii)"
          >
            <div class="text-xs font-semibold text-ink-400">ASCII 編碼(Punycode)</div>
            <div class="break-all font-mono text-ink-800">{{ result.ascii }}</div>
          </button>
        </div>

        <!-- 逐段分析 -->
        <div>
          <div class="field-label">逐段分析</div>
          <div class="space-y-2">
            <div
              v-for="(label, i) in result.labels"
              :key="i"
              class="rounded-lg border px-3 py-2"
              :class="label.mixedConfusable ? 'border-rose-200 bg-rose-50/40' : 'border-ink-200'"
            >
              <div class="flex flex-wrap items-center gap-2">
                <span class="font-mono text-ink-800">{{ label.unicode || '(空)' }}</span>
                <span v-if="label.isPunycode" class="text-xs text-ink-400">← {{ label.original }}</span>
                <span
                  v-for="s in label.scripts"
                  :key="s"
                  class="rounded-full bg-ink-100 px-2 py-0.5 text-xs text-ink-600"
                >
                  {{ scriptNames[s] }}
                </span>
                <span
                  v-if="label.mixedConfusable"
                  class="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700"
                >
                  混用形近字
                </span>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>

    <LegalNote title="為什麼要看 Punycode?">
      <ul class="list-disc pl-5 space-y-1">
        <li>網域可以用各國文字(IDN),系統內部一律轉成 <code>xn--</code> 開頭的 ASCII 編碼。</li>
        <li>詐騙會用<strong>西里爾字母的「а」「е」「о」</strong>等假冒英文,組成幾可亂真的假網域(例:apple→аpple)。</li>
        <li>本工具把 <code>xn--</code> 解回真正的文字,並標出<strong>混用不同文字系統</strong>的可疑網域。</li>
        <li>看到「混用形近字」警示時要特別小心,先用官方 App 或書籤進入,別點不明連結。</li>
        <li>提醒:解碼結果僅供辨識參考,<strong>不代表該網域必為詐騙或安全</strong>;全程在你瀏覽器計算、不上傳。</li>
      </ul>
    </LegalNote>
  </div>
</template>
