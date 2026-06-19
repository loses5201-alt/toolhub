/*
  User-Agent 解析引擎的回歸測試(node 直接跑)。
  執行:node scripts/test-uaparser.mjs
*/
import { build } from 'esbuild'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = join(tmpdir(), `uaparser-test-${Date.now()}.mjs`)
await build({
  entryPoints: ['src/features/uaParser.ts'],
  bundle: true,
  format: 'esm',
  outfile: out,
  logLevel: 'silent',
})
const { parseUA } = await import('file://' + out)

let fail = 0
function eq(note, got, want) {
  if (got === want) console.log(`✓ ${note}`)
  else {
    fail++
    console.error(`✗ ${note}\n   got : ${JSON.stringify(got)}\n   want: ${JSON.stringify(want)}`)
  }
}

// --- Chrome on Windows 10 ---
const chrome =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
let r = parseUA(chrome)
eq('Chrome browser', r.browser, 'Chrome')
eq('Chrome version', r.browserVersion, '120.0.0.0')
eq('Chrome engine', r.engine, 'Blink')
eq('Chrome OS', r.os, 'Windows')
eq('Chrome Windows ver', r.osVersion, '10 / 11')
eq('Chrome device', r.deviceType, 'desktop')
eq('Chrome not bot', r.isBot, false)

// --- Safari on macOS ---
const safari =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15'
r = parseUA(safari)
eq('Safari browser', r.browser, 'Safari')
eq('Safari version', r.browserVersion, '17.1')
eq('Safari engine', r.engine, 'WebKit')
eq('Safari OS', r.os, 'macOS')
eq('Safari mac name', r.osVersion, '10.15.7 (Catalina)')
eq('Safari device', r.deviceType, 'desktop')

// --- Firefox on Linux ---
const ff = 'Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0'
r = parseUA(ff)
eq('Firefox browser', r.browser, 'Firefox')
eq('Firefox version', r.browserVersion, '121.0')
eq('Firefox engine', r.engine, 'Gecko')
eq('Firefox engine ver', r.engineVersion, '121.0')
eq('Firefox OS', r.os, 'Linux')
eq('Firefox device', r.deviceType, 'desktop')

// --- Edge (Chromium) on Windows ---
const edge =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.2210.91'
r = parseUA(edge)
eq('Edge browser', r.browser, 'Microsoft Edge')
eq('Edge version', r.browserVersion, '120.0.2210.91')
eq('Edge engine', r.engine, 'Blink')

// --- iPhone Safari ---
const iphone =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1'
r = parseUA(iphone)
eq('iPhone browser', r.browser, 'Safari')
eq('iPhone OS', r.os, 'iOS')
eq('iPhone OS ver', r.osVersion, '17.1')
eq('iPhone device', r.deviceType, 'mobile')

// --- Android Chrome (mobile) ---
const androidM =
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
r = parseUA(androidM)
eq('Android Chrome browser', r.browser, 'Chrome')
eq('Android OS', r.os, 'Android')
eq('Android OS ver', r.osVersion, '13')
eq('Android mobile device', r.deviceType, 'mobile')

// --- Android tablet (no "Mobile") ---
const androidT =
  'Mozilla/5.0 (Linux; Android 12; SM-T970) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
r = parseUA(androidT)
eq('Android tablet device', r.deviceType, 'tablet')

// --- iPad ---
const ipad =
  'Mozilla/5.0 (iPad; CPU OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1'
r = parseUA(ipad)
eq('iPad OS', r.os, 'iPadOS')
eq('iPad device', r.deviceType, 'tablet')

// --- Chrome on iOS (CriOS) ---
const crios =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/114.0.5735.99 Mobile/15E148 Safari/604.1'
r = parseUA(crios)
eq('CriOS browser', r.browser, 'Chrome (iOS)')
eq('CriOS version', r.browserVersion, '114.0.5735.99')
eq('CriOS engine', r.engine, 'WebKit')

// --- Firefox on iOS (FxiOS) ---
const fxios =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/115.0 Mobile/15E148 Safari/605.1.15'
r = parseUA(fxios)
eq('FxiOS browser', r.browser, 'Firefox')
eq('FxiOS engine', r.engine, 'WebKit')

// --- Samsung Internet ---
const samsung =
  'Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36'
r = parseUA(samsung)
eq('Samsung browser', r.browser, 'Samsung Internet')
eq('Samsung version', r.browserVersion, '23.0')
eq('Samsung engine', r.engine, 'Blink')

// --- Opera ---
const opera =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 OPR/106.0.0.0'
r = parseUA(opera)
eq('Opera browser', r.browser, 'Opera')
eq('Opera version', r.browserVersion, '106.0.0.0')

// --- IE11 ---
const ie11 = 'Mozilla/5.0 (Windows NT 6.1; Trident/7.0; rv:11.0) like Gecko'
r = parseUA(ie11)
eq('IE11 browser', r.browser, 'Internet Explorer')
eq('IE11 version', r.browserVersion, '11.0')
eq('IE11 engine', r.engine, 'Trident')
eq('IE11 Windows ver', r.osVersion, '7')

// --- Googlebot ---
const googlebot =
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
r = parseUA(googlebot)
eq('Googlebot isBot', r.isBot, true)
eq('Googlebot device', r.deviceType, 'bot')

// --- curl ---
r = parseUA('curl/8.4.0')
eq('curl isBot', r.isBot, true)

// --- empty ---
r = parseUA('')
eq('empty browser', r.browser, '')
eq('empty os', r.os, '')
eq('empty device', r.deviceType, 'unknown')
eq('empty not bot', r.isBot, false)

// --- whitespace tolerant ---
r = parseUA('   ' + chrome + '   ')
eq('trim browser', r.browser, 'Chrome')

console.log(fail === 0 ? '\n全部通過 ✅' : `\n${fail} 筆失敗 ❌`)
process.exit(fail ? 1 : 0)
