/*
  Python pickle 反組譯器 —— 純函式、無 DOM 依賴(只用標準 TextDecoder / DataView),可在 Node 直接測試。

  ⚠️ 安全重點:pickle.load() 會在反序列化時「執行」資料裡指定的程式碼,載入來路不明的 .pkl
  足以被植入惡意程式。本工具「只讀不執行」—— 把 pickle 位元組逐個 opcode 拆給你看(等同 Python 的
  pickletools.dis),並在不呼叫任何建構式的前提下重建出資料結構,讓你在「不執行」的情況下先看清楚
  一個 pickle 到底裝了什麼、會去 import 哪些模組、呼叫哪些函式(GLOBAL / REDUCE)。

  支援 pickle protocol 0~5 的 opcode。全程在你瀏覽器解析,不連網、不上傳。
*/
import { hexToBytes } from './baseEncode'
import { base64ToBytes } from './encodedWord'

export interface PickleOp { offset: number; name: string; arg: string }
export interface PickleNode {
  type: string // int / float / bool / none / string / bytes / list / tuple / dict / set / global / reduce / object / mark / memo
  value: string
  children?: PickleNode[]
  entries?: { key: PickleNode; value: PickleNode }[]
  error?: string
}
export interface PickleResult {
  ops: PickleOp[]
  protocol: number | null
  value: PickleNode | null
  error?: string
}

class PickleError extends Error {}
const MARK = Symbol('mark')

/** 把貼上的文字轉成 pickle 位元組(hex / base64,否則當作 latin1 原始位元組以容納 protocol 0 文字 pickle)。 */
export function parsePickleInput(text: string): { bytes: Uint8Array | null; format: string; error?: string } {
  const raw = (text || '').trim()
  if (!raw) return { bytes: null, format: '', error: '請貼上 pickle 的 hex / base64,或上傳 .pkl 檔' }
  if (/^(0x)?[0-9a-f\s]+$/i.test(raw) && raw.replace(/\s|0x/gi, '').length % 2 === 0) {
    const h = hexToBytes(raw)
    if (h && h.length) return { bytes: h, format: 'hex' }
  }
  if (/^[A-Za-z0-9+/_=\s]+$/.test(raw) && raw.replace(/\s+/g, '').length >= 4) {
    const b = base64ToBytes(raw.replace(/\s+/g, ''))
    if (b.length) return { bytes: b, format: 'base64' }
  }
  // 退回:把文字當 latin1 位元組(protocol 0 文字 pickle)
  const out = new Uint8Array(text.length)
  for (let i = 0; i < text.length; i++) out[i] = text.charCodeAt(i) & 0xff
  return { bytes: out, format: 'text' }
}

interface R { b: Uint8Array; pos: number }
function u8(r: R) { if (r.pos >= r.b.length) throw new PickleError('資料提早結束'); return r.b[r.pos++] }
function take(r: R, n: number) { if (r.pos + n > r.b.length) throw new PickleError('長度超出資料範圍'); const s = r.pos; r.pos += n; return r.b.subarray(s, s + n) }
function readLine(r: R) { let s = ''; for (;;) { const c = u8(r); if (c === 0x0a) break; s += String.fromCharCode(c) } return s }
function u32le(r: R) { const b = take(r, 4); return (b[0] | (b[1] << 8) | (b[2] << 16) | (b[3] << 24)) >>> 0 }
function i32le(r: R) { const b = take(r, 4); return b[0] | (b[1] << 8) | (b[2] << 16) | (b[3] << 24) }
function u64le(r: R) { const b = take(r, 8); let v = 0n; for (let i = 7; i >= 0; i--) v = (v << 8n) | BigInt(b[i]); return v }
function bytesPreview(b: Uint8Array) { const cap = 24; let h = ''; for (let i = 0; i < Math.min(b.length, cap); i++) h += b[i].toString(16).padStart(2, '0'); return `${b.length} 位元組${h ? ` h'${h}${b.length > cap ? '…' : ''}'` : ''}` }
function decodeLong(b: Uint8Array): bigint { // 小端、二補數帶號
  if (b.length === 0) return 0n
  let v = 0n; for (let i = b.length - 1; i >= 0; i--) v = (v << 8n) | BigInt(b[i])
  if (b[b.length - 1] & 0x80) v -= 1n << BigInt(b.length * 8)
  return v
}
function unquote(s: string): string { // S'...' / S"..." (protocol 0 STRING)
  s = s.trim()
  if (s.length >= 2 && (s[0] === "'" || s[0] === '"') && s[s.length - 1] === s[0]) s = s.slice(1, -1)
  return s.replace(/\\x([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16))).replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\\\/g, '\\').replace(/\\'/g, "'").replace(/\\"/g, '"')
}

const N = (type: string, value: string): PickleNode => ({ type, value })

/** 反組譯 pickle 位元組:回 opcode 清單 + 重建的資料結構(全程不執行任何程式碼)。 */
export function disassemblePickle(bytes: Uint8Array): PickleResult {
  const r: R = { b: bytes, pos: 0 }
  const ops: PickleOp[] = []
  const stack: (PickleNode | typeof MARK)[] = []
  const memo = new Map<string, PickleNode>()
  let protocol: number | null = null
  let result: PickleNode | null = null

  const pop = (): PickleNode => { const v = stack.pop(); if (v === undefined || v === MARK) throw new PickleError('堆疊不足'); return v }
  const popToMark = (): PickleNode[] => {
    const items: PickleNode[] = []
    for (;;) { const v = stack.pop(); if (v === undefined) throw new PickleError('找不到 MARK'); if (v === MARK) break; items.unshift(v) }
    return items
  }

  try {
    for (;;) {
      const offset = r.pos
      if (r.pos >= bytes.length) throw new PickleError('缺少 STOP(.)opcode')
      const op = u8(r)
      let name = ''
      let arg = ''
      switch (op) {
        case 0x80: { const p = u8(r); protocol = p; name = 'PROTO'; arg = String(p); break }
        case 0x95: { u64le(r); name = 'FRAME'; break } // 框架長度,僅略過
        case 0x2e: name = 'STOP'; ops.push({ offset, name, arg }); result = stack.length ? pop() : null; return { ops, protocol, value: result }
        case 0x28: name = 'MARK'; stack.push(MARK); break
        case 0x4e: name = 'NONE'; stack.push(N('none', 'None')); break
        case 0x88: name = 'NEWTRUE'; stack.push(N('bool', 'True')); break
        case 0x89: name = 'NEWFALSE'; stack.push(N('bool', 'False')); break
        // 整數
        case 0x4b: { const v = u8(r); name = 'BININT1'; arg = String(v); stack.push(N('int', String(v))); break }
        case 0x4d: { const b = take(r, 2); const v = b[0] | (b[1] << 8); name = 'BININT2'; arg = String(v); stack.push(N('int', String(v))); break }
        case 0x4a: { const v = i32le(r); name = 'BININT'; arg = String(v); stack.push(N('int', String(v))); break }
        case 0x49: { const s = readLine(r); name = 'INT'; arg = s; stack.push(s === '01' ? N('bool', 'True') : s === '00' ? N('bool', 'False') : N('int', s.trim())); break }
        case 0x4c: { const s = readLine(r); name = 'LONG'; arg = s; stack.push(N('int', s.replace(/L$/, '').trim())); break }
        case 0x8a: { const len = u8(r); const v = decodeLong(take(r, len)); name = 'LONG1'; arg = v.toString(); stack.push(N('int', v.toString())); break }
        case 0x8b: { const len = u32le(r); const v = decodeLong(take(r, len)); name = 'LONG4'; arg = v.toString(); stack.push(N('int', v.toString())); break }
        case 0x46: { const s = readLine(r); name = 'FLOAT'; arg = s; stack.push(N('float', s.trim())); break }
        case 0x47: { const dv = new DataView(bytes.buffer, bytes.byteOffset + r.pos, 8); const v = dv.getFloat64(0, false); r.pos += 8; name = 'BINFLOAT'; arg = String(v); stack.push(N('float', String(v))); break }
        // 字串 / bytes / unicode
        case 0x53: { const s = unquote(readLine(r)); name = 'STRING'; arg = s; stack.push(N('string', `"${s}"`)); break }
        case 0x54: { const len = u32le(r); const s = new TextDecoder('latin1').decode(take(r, len)); name = 'BINSTRING'; arg = s; stack.push(N('string', `"${s}"`)); break }
        case 0x55: { const len = u8(r); const s = new TextDecoder('latin1').decode(take(r, len)); name = 'SHORT_BINSTRING'; arg = s; stack.push(N('string', `"${s}"`)); break }
        case 0x56: { const s = readLine(r); name = 'UNICODE'; arg = s; stack.push(N('string', `"${s}"`)); break }
        case 0x58: { const len = u32le(r); const s = new TextDecoder('utf-8').decode(take(r, len)); name = 'BINUNICODE'; arg = s; stack.push(N('string', `"${s}"`)); break }
        case 0x8c: { const len = u8(r); const s = new TextDecoder('utf-8').decode(take(r, len)); name = 'SHORT_BINUNICODE'; arg = s; stack.push(N('string', `"${s}"`)); break }
        case 0x8d: { const len = Number(u64le(r)); const s = new TextDecoder('utf-8').decode(take(r, len)); name = 'BINUNICODE8'; stack.push(N('string', `"${s}"`)); break }
        case 0x42: { const len = u32le(r); const b = take(r, len); name = 'BINBYTES'; arg = bytesPreview(b); stack.push(N('bytes', `b ${bytesPreview(b)}`)); break }
        case 0x43: { const len = u8(r); const b = take(r, len); name = 'SHORT_BINBYTES'; arg = bytesPreview(b); stack.push(N('bytes', `b ${bytesPreview(b)}`)); break }
        case 0x8e: { const len = Number(u64le(r)); const b = take(r, len); name = 'BINBYTES8'; arg = bytesPreview(b); stack.push(N('bytes', `b ${bytesPreview(b)}`)); break }
        case 0x96: { const len = Number(u64le(r)); const b = take(r, len); name = 'BYTEARRAY8'; arg = bytesPreview(b); stack.push(N('bytes', `bytearray ${bytesPreview(b)}`)); break }
        // 容器
        case 0x5d: name = 'EMPTY_LIST'; stack.push({ type: 'list', value: 'list', children: [] }); break
        case 0x29: name = 'EMPTY_TUPLE'; stack.push({ type: 'tuple', value: 'tuple()', children: [] }); break
        case 0x7d: name = 'EMPTY_DICT'; stack.push({ type: 'dict', value: 'dict', entries: [] }); break
        case 0x8f: name = 'EMPTY_SET'; stack.push({ type: 'set', value: 'set', children: [] }); break
        case 0x6c: { const items = popToMark(); name = 'LIST'; stack.push({ type: 'list', value: `list(${items.length})`, children: items }); break }
        case 0x74: { const items = popToMark(); name = 'TUPLE'; stack.push({ type: 'tuple', value: `tuple(${items.length})`, children: items }); break }
        case 0x85: { const a = pop(); name = 'TUPLE1'; stack.push({ type: 'tuple', value: 'tuple(1)', children: [a] }); break }
        case 0x86: { const b = pop(), a = pop(); name = 'TUPLE2'; stack.push({ type: 'tuple', value: 'tuple(2)', children: [a, b] }); break }
        case 0x87: { const c = pop(), b = pop(), a = pop(); name = 'TUPLE3'; stack.push({ type: 'tuple', value: 'tuple(3)', children: [a, b, c] }); break }
        case 0x64: { const items = popToMark(); name = 'DICT'; const e = []; for (let i = 0; i + 1 < items.length; i += 2) e.push({ key: items[i], value: items[i + 1] }); stack.push({ type: 'dict', value: `dict(${e.length})`, entries: e }); break }
        case 0x91: { const items = popToMark(); name = 'FROZENSET'; stack.push({ type: 'set', value: `frozenset(${items.length})`, children: items }); break }
        // 加入元素(就地修改容器,反組譯時附加到子節點)
        case 0x61: { const v = pop(); const c = pop(); name = 'APPEND'; if (c.children) c.children.push(v); stack.push(c); break }
        case 0x65: { const items = popToMark(); const c = pop(); name = 'APPENDS'; if (c.children) c.children.push(...items); stack.push(c); break }
        case 0x90: { const items = popToMark(); const c = pop(); name = 'ADDITEMS'; if (c.children) c.children.push(...items); stack.push(c); break }
        case 0x73: { const v = pop(); const k = pop(); const c = pop(); name = 'SETITEM'; if (c.entries) c.entries.push({ key: k, value: v }); stack.push(c); break }
        case 0x75: { const items = popToMark(); const c = pop(); name = 'SETITEMS'; if (c.entries) for (let i = 0; i + 1 < items.length; i += 2) c.entries.push({ key: items[i], value: items[i + 1] }); stack.push(c); break }
        // memo
        case 0x70: { const i = readLine(r); name = 'PUT'; arg = i; memo.set(i.trim(), stack[stack.length - 1] as PickleNode); break }
        case 0x71: { const i = u8(r); name = 'BINPUT'; arg = String(i); memo.set(String(i), stack[stack.length - 1] as PickleNode); break }
        case 0x72: { const i = u32le(r); name = 'LONG_BINPUT'; arg = String(i); memo.set(String(i), stack[stack.length - 1] as PickleNode); break }
        case 0x94: { name = 'MEMOIZE'; memo.set(String(memo.size), stack[stack.length - 1] as PickleNode); break }
        case 0x67: { const i = readLine(r).trim(); name = 'GET'; arg = i; stack.push(memo.get(i) || N('memo', `memo[${i}]`)); break }
        case 0x68: { const i = u8(r); name = 'BINGET'; arg = String(i); stack.push(memo.get(String(i)) || N('memo', `memo[${i}]`)); break }
        case 0x6a: { const i = u32le(r); name = 'LONG_BINGET'; arg = String(i); stack.push(memo.get(String(i)) || N('memo', `memo[${i}]`)); break }
        // 全域名稱 / 物件建構(⚠️ 真正執行時這些會 import 並呼叫)
        case 0x63: { const mod = readLine(r); const nm = readLine(r); name = 'GLOBAL'; arg = `${mod} ${nm}`; stack.push(N('global', `${mod}.${nm}`)); break }
        case 0x93: { const nm = pop(); const mod = pop(); name = 'STACK_GLOBAL'; stack.push(N('global', `${mod.value.replace(/^"|"$/g, '')}.${nm.value.replace(/^"|"$/g, '')}`)); break }
        case 0x52: { const args = pop(); const fn = pop(); name = 'REDUCE'; stack.push({ type: 'reduce', value: `${fn.value}(…)`, children: [fn, args] }); break }
        case 0x81: { const args = pop(); const cls = pop(); name = 'NEWOBJ'; stack.push({ type: 'object', value: `${cls.value}(new)`, children: [cls, args] }); break }
        case 0x92: { pop(); const args = pop(); const cls = pop(); name = 'NEWOBJ_EX'; stack.push({ type: 'object', value: `${cls.value}(new)`, children: [cls, args] }); break }
        case 0x62: { const state = pop(); const obj = pop(); name = 'BUILD'; if (obj.children) obj.children.push(state); stack.push(obj); break }
        case 0x6f: { const items = popToMark(); name = 'OBJ'; stack.push({ type: 'object', value: 'object()', children: items }); break }
        case 0x69: { const mod = readLine(r); const nm = readLine(r); popToMark(); name = 'INST'; stack.push(N('object', `${mod}.${nm}()`)); break }
        // 其他控制 opcode
        case 0x30: name = 'POP'; stack.pop(); break
        case 0x31: name = 'POP_MARK'; popToMark(); break
        case 0x32: { name = 'DUP'; const t = stack[stack.length - 1]; if (t !== undefined) stack.push(t); break }
        case 0x50: { const s = readLine(r); name = 'PERSID'; arg = s; stack.push(N('global', `persid:${s}`)); break }
        case 0x51: { name = 'BINPERSID'; const v = pop(); stack.push(N('global', `persid:${v.value}`)); break }
        case 0x97: name = 'NEXT_BUFFER'; stack.push(N('bytes', 'out-of-band buffer')); break
        case 0x98: name = 'READONLY_BUFFER'; break
        default:
          throw new PickleError(`未知或不支援的 opcode 0x${op.toString(16).padStart(2, '0')}(offset ${offset})`)
      }
      ops.push({ offset, name, arg })
    }
  } catch (e) {
    return { ops, protocol, value: result, error: e instanceof PickleError ? e.message : '解析失敗' }
  }
}
