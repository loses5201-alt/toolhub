/*
  字幕引擎的回歸測試(無需測試框架,node 直接跑)。
  執行:node scripts/test-subtitle.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `subtitle-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/subtitle.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { parseSubtitles, parseTime, formatTime, shiftCues, scaleCues, toSrt, toVtt } = await import(
  'file://' + out
)

let fail = 0
function check(note, cond) {
  if (cond) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}`)
  }
}

// 時間解析
check('SRT 時間(逗號)解析', parseTime('00:00:01,500') === 1500)
check('VTT 時間(點)解析', parseTime('00:01:02.250') === 62250)
check('VTT 省略小時解析', parseTime('01:02.250') === 62250)
check('非法時間回 null', parseTime('aa:bb') === null)
check('秒數超過 59 視為非法', parseTime('00:00:61,000') === null)

// 時間格式化
check('格式化為 SRT', formatTime(62250, ',') === '00:01:02,250')
check('格式化為 VTT', formatTime(1500, '.') === '00:00:01.500')
check('負時間夾到 0', formatTime(-100, ',') === '00:00:00,000')

const srt = `1
00:00:01,000 --> 00:00:04,000
你好,世界
第二行

2
00:00:05,500 --> 00:00:07,000
最後一句`

const cues = parseSubtitles(srt)
check('SRT 解析出 2 句', cues.length === 2)
check('第一句起始 1000ms', cues[0].start === 1000)
check('多行字幕文字保留', cues[0].text === '你好,世界\n第二行')
check('第二句結束 7000ms', cues[1].end === 7000)

const vtt = `WEBVTT

NOTE 這是註解,應略過

00:00:01.000 --> 00:00:04.000 align:start position:0%
Hello

00:00:05.500 --> 00:00:07.000
World`
const vcues = parseSubtitles(vtt)
check('VTT 略過標頭與 NOTE,解析出 2 句', vcues.length === 2)
check('VTT 略過 cue 設定仍正確解析結束時間', vcues[0].end === 4000)
check('VTT 文字正確', vcues[1].text === 'World')

// 平移
const shifted = shiftCues(cues, 2000)
check('平移 +2s', shifted[0].start === 3000 && shifted[0].end === 6000)
const back = shiftCues(cues, -2000)
check('平移 -2s 第一句起始夾到 0(原 1000)', back[0].start === 0)

// 縮放
const scaled = scaleCues(cues, 2)
check('縮放 ×2', scaled[1].start === 11000)

// 互轉
const asVtt = toVtt(cues)
check('轉 VTT 含標頭', asVtt.startsWith('WEBVTT'))
check('轉 VTT 用點分隔毫秒', asVtt.includes('00:00:01.000 --> 00:00:04.000'))
const roundTrip = parseSubtitles(toSrt(parseSubtitles(asVtt)))
check('VTT→SRT→再解析 句數不變', roundTrip.length === 2)
check('重新編號:轉 SRT 第一筆序號為 1', toSrt(cues).startsWith('1\n'))

if (fail) {
  console.error(`\n${fail} 筆測試失敗`)
  process.exit(1)
} else {
  console.log('\n全部通過')
}
