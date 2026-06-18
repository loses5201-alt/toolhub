<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { checkCard, type Brand } from '@/features/cardCheck'

/*
  信用卡 / 金融卡卡號檢核 —— 用 Luhn 檢查碼驗證卡號有沒有打對(抓少打/多打/錯一碼),
  並判斷發卡組織(Visa / Mastercard / JCB…)。全程本機計算、不上傳、不儲存。
  明確聲明:檢查碼正確 ≠ 真有這張卡、≠ 卡片有效,只是格式核對。
*/
const input = ref('')

const result = computed(() => (input.value.trim() ? checkCard(input.value) : null))

const brandLabel: Record<Brand, string> = {
  Visa: 'Visa',
  Mastercard: 'Mastercard 萬事達',
  'American Express': 'American Express 美國運通',
  JCB: 'JCB',
  UnionPay: 'UnionPay 銀聯',
  Discover: 'Discover',
  'Diners Club': 'Diners Club 大來',
  Unknown: '無法辨識(可能非主流卡別或卡號有誤)',
}
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-4">
      <div>
        <label class="field-label" for="card-input">卡號(可含空白或連字號)</label>
        <input
          id="card-input"
          v-model="input"
          type="text"
          inputmode="numeric"
          autocomplete="off"
          placeholder="例:4111 1111 1111 1111"
          class="field-input font-mono text-lg tracking-wide"
        />
        <p class="mt-2 text-sm text-ink-500">輸入後即時檢核;此頁不會儲存或送出你的卡號。</p>
      </div>

      <div
        v-if="result"
        class="rounded-2xl border p-5"
        :class="result.ok
          ? 'border-brand-300 bg-brand-50'
          : 'border-amber-300 bg-amber-50'"
      >
        <div class="flex items-center gap-2 text-lg font-bold" :class="result.ok ? 'text-brand-800' : 'text-amber-800'">
          <span>{{ result.ok ? '✓' : '✗' }}</span>
          <span>{{ result.message }}</span>
        </div>

        <dl class="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div class="flex justify-between gap-3 border-b border-line/70 pb-1">
            <dt class="text-ink-500">發卡組織</dt>
            <dd class="font-medium text-ink-900">{{ brandLabel[result.brand] }}</dd>
          </div>
          <div class="flex justify-between gap-3 border-b border-line/70 pb-1">
            <dt class="text-ink-500">檢查碼(Luhn)</dt>
            <dd class="font-medium" :class="result.luhn ? 'text-brand-700' : 'text-red-600'">
              {{ result.luhn ? '通過' : '不通過' }}
            </dd>
          </div>
          <div class="flex justify-between gap-3 border-b border-line/70 pb-1">
            <dt class="text-ink-500">卡號長度</dt>
            <dd class="font-medium" :class="result.lengthOk ? 'text-ink-900' : 'text-red-600'">
              {{ result.digits.length }} 碼{{ result.lengthOk ? '' : '(不符)' }}
            </dd>
          </div>
          <div class="flex justify-between gap-3 border-b border-line/70 pb-1">
            <dt class="text-ink-500">分組顯示</dt>
            <dd class="font-mono text-ink-900">{{ result.formatted }}</dd>
          </div>
        </dl>
      </div>
      <p v-else class="text-sm text-ink-500">在上面輸入卡號,檢核結果會即時顯示在這裡。</p>
    </div>

    <LegalNote title="重要說明（請務必看)">
      <ul class="list-disc pl-5 space-y-1">
        <li><strong>檢查碼正確 ≠ 真的有這張卡,也 ≠ 卡片有效或還有額度。</strong>Luhn 只能抓出「卡號打錯」(少打、多打、某一碼錯),用來在輸入前自我核對。</li>
        <li>計算<strong>全程在你的瀏覽器</strong>完成,卡號<strong>不會上傳、不會儲存</strong>,關掉頁面就消失。</li>
        <li>請<strong>不要</strong>把完整卡號連同有效期限、背面末三碼(CVV/CVC)交給任何人或網站 —— 這三者湊齊就能盜刷。正規店家不會用 LINE / 電話索取這些。</li>
        <li>常見詐騙:假客服稱「卡片有問題」要你報出完整卡號與 OTP 簡訊驗證碼。<strong>OTP 絕不可給任何人。</strong>有疑問請打卡片背面的銀行客服或撥 165。</li>
        <li>需要在分享截圖前把卡號遮起來,可用「文字個資遮蔽」或「圖片遮蔽」。</li>
      </ul>
    </LegalNote>
  </div>
</template>
