/*
  字幕解析 / 轉換引擎 —— 純函式、無 DOM、無相依,方便回歸測試。
  支援 SRT 與 WebVTT 互轉、整體時間平移、速率縮放、重新編號。
  時間一律以「毫秒」為內部單位。
*/
export interface Cue {
  start: number // ms
  end: number // ms
  text: string
}

const TIME_RE = /^(?:(\d+):)?(\d{1,2}):(\d{2})[.,](\d{1,3})$/

function pad(n: number, len = 2): string {
  return String(n).padStart(len, '0')
}

/** 把 "HH:MM:SS,mmm" 或 "MM:SS.mmm" 解析成毫秒;格式不符回 null */
export function parseTime(s: string): number | null {
  const m = s.trim().match(TIME_RE)
  if (!m) return null
  const h = m[1] ? parseInt(m[1], 10) : 0
  const min = parseInt(m[2], 10)
  const sec = parseInt(m[3], 10)
  const ms = parseInt(m[4].padEnd(3, '0'), 10)
  if (min > 59 || sec > 59) return null
  return ((h * 60 + min) * 60 + sec) * 1000 + ms
}

/** 把毫秒格式化成時間字串。sep=',' → SRT;sep='.' → VTT */
export function formatTime(msTotal: number, sep: ',' | '.'): string {
  let ms = Math.max(0, Math.round(msTotal))
  const h = Math.floor(ms / 3600000)
  ms %= 3600000
  const min = Math.floor(ms / 60000)
  ms %= 60000
  const sec = Math.floor(ms / 1000)
  const mil = ms % 1000
  return `${pad(h)}:${pad(min)}:${pad(sec)}${sep}${pad(mil, 3)}`
}

/**
  解析 SRT 或 VTT 文字成 Cue 陣列。
  以空白行切塊,塊內找含 "-->" 的行解析起訖,其後各行為字幕文字;
  自動略過 WEBVTT 標頭、NOTE / STYLE / REGION 區塊與序號/識別行。
*/
export function parseSubtitles(raw: string): Cue[] {
  const text = raw.replace(/^﻿/, '').replace(/\r\n?/g, '\n')
  const blocks = text.split(/\n[ \t]*\n/)
  const cues: Cue[] = []
  for (const block of blocks) {
    const lines = block.split('\n')
    const arrowIdx = lines.findIndex((l) => l.includes('-->'))
    if (arrowIdx === -1) continue // 標頭 / NOTE / STYLE / 空塊
    const arrow = lines[arrowIdx]
    const parts = arrow.split('-->')
    if (parts.length < 2) continue
    const start = parseTime(parts[0])
    // 右側可能附 VTT cue 設定(align/position…),只取第一個 token
    const end = parseTime(parts[1].trim().split(/\s+/)[0] || '')
    if (start === null || end === null) continue
    const body = lines
      .slice(arrowIdx + 1)
      .join('\n')
      .replace(/\s+$/, '')
    cues.push({ start, end, text: body })
  }
  return cues
}

/** 整體平移(deltaMs 可為負)。負時間夾到 0。 */
export function shiftCues(cues: Cue[], deltaMs: number): Cue[] {
  return cues.map((c) => ({
    ...c,
    start: Math.max(0, c.start + deltaMs),
    end: Math.max(0, c.end + deltaMs),
  }))
}

/** 速率縮放(factor>1 變慢、<1 變快),用於影片影格率不同造成的漸進偏移 */
export function scaleCues(cues: Cue[], factor: number): Cue[] {
  return cues.map((c) => ({
    ...c,
    start: Math.max(0, c.start * factor),
    end: Math.max(0, c.end * factor),
  }))
}

export function toSrt(cues: Cue[]): string {
  return (
    cues
      .map((c, i) => `${i + 1}\n${formatTime(c.start, ',')} --> ${formatTime(c.end, ',')}\n${c.text}`)
      .join('\n\n') + '\n'
  )
}

export function toVtt(cues: Cue[]): string {
  const body = cues
    .map((c) => `${formatTime(c.start, '.')} --> ${formatTime(c.end, '.')}\n${c.text}`)
    .join('\n\n')
  return `WEBVTT\n\n${body}\n`
}
