/*
  干支 / 生肖 / 納音 引擎的回歸測試(node 直接跑)。
  執行:node scripts/test-ganzhi.mjs
  oracle:已知對照 —— 1984=甲子鼠(海中金)、2024=甲辰龍(覆燈火)、2025=乙巳蛇、
  1911(辛亥革命)=辛亥豬、公元 4 年=甲子。六十甲子循環與納音 30 種定義。
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `ganzhi-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/ganzhi.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const {
  HEAVENLY_STEMS,
  EARTHLY_BRANCHES,
  ZODIACS,
  ganzhiOfYear,
  rocToAd,
  yearsForGanzhi,
  sexagenaryIndexOf,
} = await import('file://' + out)

let fail = 0
function eq(note, got, want) {
  const g = JSON.stringify(got)
  const w = JSON.stringify(want)
  if (g === w) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}\n   got : ${g}\n   want: ${w}`)
  }
}

// ── 常數 ──
eq('天干 10', HEAVENLY_STEMS.length, 10)
eq('地支 12', EARTHLY_BRANCHES.length, 12)
eq('生肖 12', ZODIACS.length, 12)
eq('甲為首', HEAVENLY_STEMS[0], '甲')
eq('子為首', EARTHLY_BRANCHES[0], '子')
eq('鼠對子', ZODIACS[0], '鼠')

// ── 已知年份對照 ──
{
  const g = ganzhiOfYear(1984)
  eq('1984 干支', g.ganzhi, '甲子')
  eq('1984 生肖', g.zodiac, '鼠')
  eq('1984 納音', g.nayin, '海中金')
  eq('1984 六十甲子序', g.sexagenaryIndex, 0)
  eq('1984 天干五行', g.stemElement, '木')
}
{
  const g = ganzhiOfYear(2024)
  eq('2024 干支', g.ganzhi, '甲辰')
  eq('2024 生肖', g.zodiac, '龍')
  eq('2024 納音', g.nayin, '覆燈火')
  eq('2024 民國年', g.rocYear, 113)
}
{
  const g = ganzhiOfYear(2025)
  eq('2025 干支', g.ganzhi, '乙巳')
  eq('2025 生肖', g.zodiac, '蛇')
  eq('2025 民國年', g.rocYear, 114)
}
eq('1911 辛亥', ganzhiOfYear(1911).ganzhi, '辛亥')
eq('1911 生肖豬', ganzhiOfYear(1911).zodiac, '豬')
eq('公元 4 年甲子', ganzhiOfYear(4).ganzhi, '甲子')
eq('公元 1 年辛酉', ganzhiOfYear(1).ganzhi, '辛酉')

// ── 六十甲子循環:相隔 60 年同干支 ──
eq('1984 與 2044 同干支', ganzhiOfYear(1984).ganzhi, ganzhiOfYear(2044).ganzhi)
eq('生肖每 12 年循環', ganzhiOfYear(2024).zodiac, ganzhiOfYear(2012).zodiac)

// ── 納音每兩年一變、共 30 種、循環 60 ──
{
  const set = new Set()
  for (let y = 1984; y < 1984 + 60; y++) set.add(ganzhiOfYear(y).nayin)
  eq('60 年內納音共 30 種', set.size, 30)
  eq('甲子乙丑同納音', ganzhiOfYear(1984).nayin === ganzhiOfYear(1985).nayin, true)
  eq('乙丑丙寅不同納音', ganzhiOfYear(1985).nayin === ganzhiOfYear(1986).nayin, false)
}

// ── 六十甲子序在 60 年內互異 ──
{
  const set = new Set()
  for (let y = 1984; y < 1984 + 60; y++) set.add(ganzhiOfYear(y).sexagenaryIndex)
  eq('60 年內甲子序皆不同', set.size, 60)
}

// ── rocToAd ──
eq('民國 113 = 2024', rocToAd(113), 2024)
eq('民國 1 = 1912', rocToAd(1), 1912)

// ── sexagenaryIndexOf ──
eq('甲子序=0', sexagenaryIndexOf(0, 0), 0)
eq('乙丑序=1', sexagenaryIndexOf(1, 1), 1)
eq('不相容組合=-1', sexagenaryIndexOf(0, 1), -1) // 甲(偶)配丑(奇)不存在

// ── yearsForGanzhi ──
{
  const ys = yearsForGanzhi('甲辰', 2024, 4)
  eq('甲辰含 2024', ys.includes(2024), true)
  eq('甲辰相隔 60', ys[1] - ys[0], 60)
}
eq('甲子近 2000 含 1984', yearsForGanzhi('甲子', 2000, 2).includes(1984), true)
eq('不相容干支回空', yearsForGanzhi('甲丑', 2024, 4), [])
eq('非法干支回空', yearsForGanzhi('XX', 2024, 4), [])

console.log(fail === 0 ? '\n✅ 全數通過' : `\n❌ ${fail} 筆失敗`)
process.exit(fail === 0 ? 0 : 1)
