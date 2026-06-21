<script setup lang="ts">
import { ref, computed, watchEffect } from 'vue'
import LegalNote from '@/components/LegalNote.vue'
import { parseBencodeInput, decodeBencode, type BencodeNode } from '@/features/bencode'
import BencodeTree from './BencodeTree.vue'

/*
  Bencode 解碼器 —— 貼上 bencode 文字 / hex / base64,拆成可讀的結構樹。看一個 .torrent 包含哪些
  檔案、連去哪些 tracker,並算出 info-hash。全程在你瀏覽器解析,不連網、不上傳。
*/
const raw = ref('')

// 範例:簡化的 .torrent 結構
const SAMPLE = 'd8:announce22:http://tracker.example4:infod6:lengthi1024e4:name8:test.txt12:piece lengthi16384eee'

const result = computed<{ format: string; node: BencodeNode | null; bytes: Uint8Array | null; byteLen: number; error?: string; parsed: boolean }>(() => {
  if (!raw.value.trim()) return { format: '', node: null, bytes: null, byteLen: 0, parsed: false }
  const input = parseBencodeInput(raw.value)
  if (!input.bytes) return { format: input.format, node: null, bytes: null, byteLen: 0, error: input.error, parsed: true }
  const decoded = decodeBencode(input.bytes)
  return { format: input.format, node: decoded.node, bytes: input.bytes, byteLen: input.bytes.length, error: decoded.error, parsed: true }
})

// 若頂層字典含 info 鍵,算出 info-hash(SHA-1 = v1、SHA-256 = v2)供核對 magnet 連結
const infoHashes = ref<{ sha1: string; sha256: string } | null>(null)
watchEffect(async () => {
  infoHashes.value = null
  const r = result.value
  if (!r.node || r.node.type !== 'dict' || !r.bytes || !r.node.entries) return
  const info = r.node.entries.find((e) => e.key === 'info')?.value
  if (!info || typeof crypto === 'undefined' || !crypto.subtle) return
  const slice = r.bytes.slice(info.offset, info.offset + info.byteLength)
  try {
    const [s1, s256] = await Promise.all([
      crypto.subtle.digest('SHA-1', slice),
      crypto.subtle.digest('SHA-256', slice),
    ])
    const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
    infoHashes.value = { sha1: hex(s1), sha256: hex(s256) }
  } catch {
    infoHashes.value = null
  }
})
</script>

<template>
  <div class="space-y-6">
    <div class="card p-6 space-y-3">
      <div>
        <label class="field-label">貼上 bencode(文字 / hex / base64)</label>
        <textarea
          v-model="raw"
          rows="6"
          class="field-input font-mono text-sm"
          placeholder="d8:announce…  或  .torrent 檔的 hex / base64"
          spellcheck="false"
        ></textarea>
        <p class="field-hint">可直接貼 bencode 文字,或 .torrent 檔的 hex / base64。全程在你瀏覽器解析,內容不上傳。</p>
      </div>
      <button type="button" class="text-sm text-brand-700 hover:underline" @click="raw = SAMPLE">
        載入範例(簡化的 .torrent)
      </button>
    </div>

    <div v-if="result.parsed && result.error && !result.node" class="rounded-xl border border-rose-200 bg-rose-50/60 p-3 text-sm text-rose-700">
      ⚠️ {{ result.error }}
    </div>

    <div v-if="infoHashes" class="card p-5 space-y-2">
      <div class="text-sm font-semibold text-ink-700">info-hash(用來核對 magnet 連結 / 找種)</div>
      <div class="text-xs">
        <div class="flex flex-wrap gap-x-2"><span class="w-20 shrink-0 text-ink-500">SHA-1(v1)</span><span class="font-mono break-all text-ink-800">{{ infoHashes.sha1 }}</span></div>
        <div class="mt-1 flex flex-wrap gap-x-2"><span class="w-20 shrink-0 text-ink-500">SHA-256(v2)</span><span class="font-mono break-all text-ink-800">{{ infoHashes.sha256 }}</span></div>
      </div>
    </div>

    <div v-if="result.node" class="card p-5 space-y-3">
      <div class="flex flex-wrap items-center gap-2 text-sm">
        <span class="rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-semibold text-brand-700">{{ result.format }}</span>
        <span class="text-ink-500">{{ result.byteLen }} 位元組</span>
      </div>
      <div v-if="result.error" class="rounded-lg border border-amber-200 bg-amber-50/60 p-2 text-xs text-amber-800">
        ⚠️ {{ result.error }}
      </div>
      <div class="overflow-x-auto">
        <BencodeTree :nodes="[result.node]" :depth="0" />
      </div>
    </div>

    <LegalNote title="這個工具能幫你什麼?">
      <ul class="list-disc pl-5 space-y-1">
        <li>把 <strong>Bencode</strong>(BitTorrent 的 <code>.torrent</code> 與 DHT 用的編碼)拆成看得懂的結構樹 —— 整數、字串、清單、字典一層層攤開,二進位字串(如 pieces 雜湊)以位元組長度顯示不爆版。</li>
        <li>不必開 BitTorrent 軟體就能<strong>看一個 .torrent 到底包含哪些檔案、連去哪些 tracker</strong>、單檔大小、piece 大小 —— 下載來路不明的種子前先檢查內容。</li>
        <li>頂層含 <code>info</code> 時自動算出 <strong>info-hash</strong>(SHA-1 = v1、SHA-256 = v2),可拿去核對 magnet 連結是否一致。</li>
        <li>全程在你瀏覽器解析,<strong>不連網、不上傳</strong>。需要其他二進位格式請用 CBOR / MessagePack / Protobuf 解碼器。</li>
      </ul>
    </LegalNote>
  </div>
</template>
