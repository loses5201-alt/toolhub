<script setup lang="ts">
import { ref, computed } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { parseEinvoiceQr, encodingLabel } from '@/features/einvoiceQr'

/*
  電子發票 QR 解析 —— 貼上左方 QR 掃出的文字,拆成發票號碼、日期、金額、買賣方統編等。
  全程在你的瀏覽器解析,不連網、不上傳。
*/

const input = ref('')
const result = computed(() => (input.value.trim() ? parseEinvoiceQr(input.value) : null))

const money = (n: number) => 'NT$ ' + n.toLocaleString('zh-TW')

const rows = computed(() => {
  const r = result.value
  if (!r || !r.ok) return []
  const list = [
    { label: '發票號碼', value: r.invoiceNumber },
    { label: '開立日期', value: `${r.dateRoc}${r.dateAd ? `(西元 ${r.dateAd})` : ''}` },
    { label: '隨機碼', value: r.randomCode },
    { label: '銷售額(未稅)', value: money(r.amountSalesUntaxed) },
    { label: '總計額(含稅)', value: money(r.amountTotal) },
    { label: '稅額(推估)', value: money(r.amountTotal - r.amountSalesUntaxed) },
    { label: '買方統一編號', value: r.buyerVat || '個人(無統編)' },
    { label: '賣方統一編號', value: r.sellerVat },
  ]
  if (r.itemCountInQr != null) list.push({ label: '本條碼品目筆數', value: String(r.itemCountInQr) })
  if (r.itemCountTotal != null) list.push({ label: '發票品目總筆數', value: String(r.itemCountTotal) })
  if (r.encodingParam != null) list.push({ label: '中文編碼', value: encodingLabel(r.encodingParam) })
  return list
})
</script>

<template>
  <div class="space-y-6">
    <div class="card p-5">
      <label class="block text-sm">
        <span class="text-ink-500">貼上電子發票「左方」QR 條碼掃描出的文字</span>
        <textarea v-model="input" rows="4" class="ei-input font-mono" spellcheck="false" placeholder="例:AB123456781130520..." />
      </label>
      <p class="mt-2 text-xs text-ink-400">
        用手機相機或本站「QR 條碼解碼」工具掃發票上的左邊那個 QR,把掃出的文字貼進來。
      </p>
    </div>

    <p v-if="result && !result.ok" class="card p-4 text-sm text-rose-700 bg-rose-50 border border-rose-200">
      ⚠️ {{ result.error }}
    </p>

    <template v-if="result && result.ok">
      <div class="card p-5">
        <table class="w-full text-sm">
          <tbody>
            <tr v-for="(row, i) in rows" :key="i" class="border-b border-ink-100 last:border-0">
              <td class="py-2 pr-4 text-ink-500 whitespace-nowrap">{{ row.label }}</td>
              <td class="py-2 font-medium text-ink-800 break-all">{{ row.value }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="card p-4 text-xs text-ink-400 space-y-1">
        <div>加密驗證資訊:<span class="font-mono break-all">{{ result.encrypted }}</span>(需財政部金鑰才能驗證,此處僅顯示)</div>
        <div v-if="result.tail">尾段原始資料:<span class="font-mono break-all">{{ result.tail }}</span></div>
      </div>
    </template>

    <LegalNote>
      台灣電子發票證明聯上有兩個 QR 條碼,<strong>左方</strong>那個放發票主要資訊:前 77 個字元為固定欄位
      (發票號碼、開立日期、隨機碼、未稅銷售額與含稅總計額皆為十六進位、買賣方統編、加密驗證碼),
      之後是品項等附加資料。本工具依<strong>財政部電子發票二維條碼規格</strong>解析,僅供核對參考;
      「稅額」為總計額減銷售額的推估值,實際以發票記載為準。加密驗證資訊需財政部金鑰才能驗真偽,本工具不驗證。
      全程在你的瀏覽器解析,不連網、不上傳。
    </LegalNote>
  </div>
</template>

<style scoped>
.ei-input {
  width: 100%;
  margin-top: 0.25rem;
  border: 1px solid var(--color-ink-200, #e2e8f0);
  border-radius: 0.5rem;
  padding: 0.5rem 0.625rem;
  font-size: 0.8125rem;
  line-height: 1.55;
  resize: vertical;
  word-break: break-all;
}
</style>
