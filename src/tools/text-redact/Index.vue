<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { maskPii, type PiiKind, type MaskOpts } from '@/features/piiMask'

/*
  文字個資遮蔽 —— 貼上對話/單據文字,自動找出身分證、手機、信用卡、Email 並打碼。
  分享截圖文字、轉貼客服對話前先遮個資。全程在本機以正規式比對,不上傳。
*/
const input = ref('')
const keepTail = ref(false)
const copied = ref(false)

const kinds = reactive<Record<PiiKind, boolean>>({
  id: true,
  mobile: true,
  creditcard: true,
  email: true,
})

const labels: Record<PiiKind, string> = {
  id: '身分證字號',
  mobile: '手機號碼',
  creditcard: '信用卡卡號',
  email: 'Email',
}

const result = computed(() => {
  const opts: MaskOpts = { kinds: { ...kinds }, keepTail: keepTail.value }
  return maskPii(input.value, opts)
})

const totalMasked = computed(() =>
  (Object.values(result.value.counts) as number[]).reduce((a, b) => a + b, 0),
)

watch([input, keepTail, () => ({ ...kinds })], () => (copied.value = false))

function loadSample() {
  input.value =
    '客服您好,我是王小明,身分證 A123456789,手機 0912-345-678,\n' +
    'Email wang.ming@example.com,信用卡 4111 1111 1111 1111,\n' +
    '訂單編號 20240615001 想詢問退款進度,謝謝。'
}

async function copyOut() {
  try {
    await navigator.clipboard.writeText(result.value.text)
    copied.value = true
  } catch {
    /* 忽略 */
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-4 sm:p-6 space-y-5">
      <div>
        <div class="mb-1 flex items-center justify-between">
          <label class="field-label mb-0">貼上要遮蔽的文字</label>
          <button
            type="button"
            class="text-sm text-brand-600 hover:underline"
            @click="loadSample"
          >
            載入範例
          </button>
        </div>
        <textarea
          v-model="input"
          rows="6"
          class="field-input font-mono text-sm"
          placeholder="把對話、單據、表單內容貼進來…"
        />
      </div>

      <div>
        <span class="field-label">要遮蔽的個資類型</span>
        <div class="flex flex-wrap gap-2">
          <label
            v-for="(label, k) in labels"
            :key="k"
            class="flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition"
            :class="kinds[k]
              ? 'border-brand-400 bg-brand-50 text-brand-700'
              : 'border-line bg-white text-ink-600'"
          >
            <input v-model="kinds[k]" type="checkbox" class="h-4 w-4 accent-brand-600" />
            {{ label }}
          </label>
        </div>
        <label class="mt-3 flex items-center gap-2 text-sm text-ink-700">
          <input v-model="keepTail" type="checkbox" class="h-4 w-4 accent-brand-600" />
          保留末 4 碼(方便對方核對,例:●●●●5678)
        </label>
      </div>

      <div v-if="input">
        <div class="mb-1 flex items-center justify-between">
          <label class="field-label mb-0">遮蔽結果</label>
          <button
            type="button"
            class="rounded-lg border border-line bg-white px-3 py-1 text-sm font-semibold text-ink-700 transition hover:border-brand-300 hover:text-brand-700"
            @click="copyOut"
          >
            {{ copied ? '已複製 ✓' : '複製' }}
          </button>
        </div>
        <textarea :value="result.text" rows="6" readonly class="field-input font-mono text-sm" />
        <p class="mt-2 text-sm" :class="totalMasked ? 'text-emerald-700' : 'text-ink-500'">
          <template v-if="totalMasked">
            已遮蔽 {{ totalMasked }} 處：
            <template v-for="(label, k) in labels" :key="k">
              <span v-if="result.counts[k]" class="mr-2">{{ label }} {{ result.counts[k] }}</span>
            </template>
          </template>
          <template v-else>未偵測到可辨識的個資(或對應類型未勾選)。</template>
        </p>
      </div>
    </div>

    <LegalNote title="使用須知">
      <ul class="list-disc pl-5 space-y-1">
        <li><strong>不上傳</strong>:全程在你的瀏覽器以規則比對,文字不會送到任何伺服器。</li>
        <li>為避免「把不是個資的數字也遮掉」,身分證會用內政部檢查碼、信用卡用 Luhn 驗證,通過才遮。</li>
        <li class="text-amber-700">這代表<strong>仍可能有漏網之魚</strong>:銀行帳號、地址、市話、護照號等格式太多變,不會自動偵測。送出前請務必再人工檢查一遍。</li>
        <li>遮蔽是直接改寫文字內容,不是可還原的圖層;複製出去的就是已遮蔽的版本。</li>
        <li>分享「圖片」要遮個資,請改用「圖片遮蔽」工具把像素塗掉。</li>
      </ul>
    </LegalNote>
  </div>
</template>
