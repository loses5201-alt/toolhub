/*
  Snowflake ID 解析引擎的回歸測試(node 直接跑)。
  執行:node scripts/test-snowflake.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `snowflake-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/snowflake.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { parseId, parseSnowflake, parseByPlatform, snowflakeForTime, platformMap, PLATFORMS } =
  await import('file://' + out)

let fail = 0
function eq(note, got, want) {
  if (got === want) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}\n   got : ${JSON.stringify(got)}\n   want: ${JSON.stringify(want)}`)
  }
}

// --- Discord 官方文件範例:175928847299117063 ---
const d = parseByPlatform('175928847299117063', 'discord')
eq('Discord 範例 timestampMs', d.timestampMs, 1462015105796)
eq('Discord 範例 ISO', d.iso, '2016-04-30T11:18:25.796Z')
eq('Discord 範例 Worker ID = 1', d.field1, 1)
eq('Discord 範例 Process ID = 0', d.field2, 0)
eq('Discord 範例 Increment = 7', d.sequence, 7)
eq('Discord 範例 binary 長度 64', d.binary.length, 64)

// --- Twitter epoch ---
const t = parseByPlatform('1541815603606036480', 'twitter')
eq('Twitter timestampMs', t.timestampMs, 1656432460105)
eq('Twitter ISO', t.iso, '2022-06-28T16:07:40.105Z')

// --- 自訂 epoch:epoch=0 時 timestampMs = id>>22 ---
const c = parseSnowflake('4194304', 0) // 4194304 = 1<<22 → ts=1
eq('epoch 0, id=1<<22 → ts 1', c.timestampMs, 1)
eq('epoch 0, sequence 0', c.sequence, 0)

// --- 欄位拆解:手工組一個 id ---
// ts部分=5, field1=3, field2=2, seq=9
const built = (5n << 22n) | (3n << 17n) | (2n << 12n) | 9n
const b = parseSnowflake(built.toString(), 0)
eq('組合 id timestampMs', b.timestampMs, 5)
eq('組合 id field1', b.field1, 3)
eq('組合 id field2', b.field2, 2)
eq('組合 id sequence', b.sequence, 9)

// --- parseId 驗證 ---
eq('parseId 純數字', parseId('123'), 123n)
eq('parseId 去空白', parseId('  456 '), 456n)
eq('parseId 非數字回 null', parseId('12a'), null)
eq('parseId 空回 null', parseId(''), null)
eq('parseId 負數回 null', parseId('-1'), null)
eq('parseId 64 位元上限可', parseId(((1n << 64n) - 1n).toString()), (1n << 64n) - 1n)
eq('parseId 超過 64 位元回 null', parseId((1n << 64n).toString()), null)

// --- parseSnowflake 非法輸入 ---
eq('parseSnowflake 非法回 null', parseSnowflake('abc', 0), null)
eq('parseByPlatform 未知平台回 null', parseByPlatform('123', 'nope'), null)

// --- snowflakeForTime 與 parseSnowflake 往返 ---
const sf = snowflakeForTime(1462015105796, 1420070400000)
const back = parseSnowflake(sf, 1420070400000)
eq('snowflakeForTime 往返 timestampMs', back.timestampMs, 1462015105796)
eq('snowflakeForTime 序號為 0', back.sequence, 0)
eq('時間早於 epoch 回 0', snowflakeForTime(1000, 1420070400000), '0')

// --- 平台表 ---
eq('平台數 >= 3', PLATFORMS.length >= 3, true)
eq('discord epoch', platformMap.discord.epoch, 1420070400000)
eq('twitter epoch', platformMap.twitter.epoch, 1288834974657)

if (fail) {
  console.error(`\n${fail} 個測試未通過`)
  process.exit(1)
} else {
  console.log('\n全部 snowflake 測試通過')
}
