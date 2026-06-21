// GraphQL 格式化 / 壓縮回歸測試。
// oracle:(1) 往返一致 —— parse(print(x)) 結構應與 parse(x) 相等;
//         (2) 對既定格式規則的快照比對。esbuild 打包 TS 後執行。
import { execSync } from 'node:child_process'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dir = mkdtempSync(join(tmpdir(), 'gqlfmt-'))
const entry = join(dir, 'entry.mjs')
const src = join(process.cwd(), 'src/features/graphqlFormat.ts').replace(/\\/g, '\\\\')
writeFileSync(entry, `export { formatGraphql, minifyGraphql, parseGraphql } from '${src}'`)
const outFile = join(dir, 'bundle.mjs')
execSync(`npx esbuild ${entry} --bundle --format=esm --platform=node --outfile=${outFile}`, {
  stdio: ['ignore', 'ignore', 'inherit'],
})
const { formatGraphql, minifyGraphql, parseGraphql } = await import('file://' + outFile)

let pass = 0
let fail = 0
function eq(actual, expected, msg) {
  if (actual === expected) pass++
  else {
    fail++
    console.error(`✗ ${msg}\n--- 期望 ---\n${expected}\n--- 實得 ---\n${actual}\n`)
  }
}
function ok(cond, msg) {
  if (cond) pass++
  else {
    fail++
    console.error(`✗ ${msg}`)
  }
}
function throws(fn, msg) {
  try {
    fn()
    fail++
    console.error(`✗ ${msg}(應擲錯卻沒有)`)
  } catch {
    pass++
  }
}

const stable = (ast) => JSON.stringify(ast)
function roundTrip(input, label) {
  const a = stable(parseGraphql(input))
  ok(stable(parseGraphql(formatGraphql(input))) === a, `往返(pretty):${label}`)
  ok(stable(parseGraphql(minifyGraphql(input))) === a, `往返(minify):${label}`)
}

// --- 快照:executable ---
const q = 'query Hero($ep: Episode){hero(episode:$ep){name friends{name}}}'
eq(
  formatGraphql(q),
  `query Hero($ep: Episode) {
  hero(episode: $ep) {
    name
    friends {
      name
    }
  }
}`,
  '快照 query pretty',
)
eq(
  minifyGraphql(q),
  'query Hero($ep:Episode){hero(episode:$ep){name friends{name}}}',
  '快照 query minify',
)

// 匿名簡寫
eq(formatGraphql('{ a b }'), `{
  a
  b
}`, '匿名簡寫 pretty')
eq(minifyGraphql('{ a  b }'), '{a b}', '匿名簡寫 minify 保留欄位間空白')

// alias + 指令
eq(minifyGraphql('{ x: field @skip(if: $c) }'), '{x:field@skip(if:$c)}', 'alias 與指令 minify')

// --- 快照:SDL ---
const sdl = 'type User implements Node{id:ID! name:String posts(first:Int=10):[Post!]!}'
eq(
  formatGraphql(sdl),
  `type User implements Node {
  id: ID!
  name: String
  posts(first: Int = 10): [Post!]!
}`,
  '快照 SDL type pretty',
)
eq(
  minifyGraphql(sdl),
  'type User implements Node{id:ID! name:String posts(first:Int=10):[Post!]!}',
  '快照 SDL type minify',
)

eq(formatGraphql('enum Color{RED GREEN BLUE}'), `enum Color {
  RED
  GREEN
  BLUE
}`, '快照 enum pretty')

eq(minifyGraphql('union Media = Photo | Video'), 'union Media=Photo|Video', '快照 union minify')

// 描述字串(區塊字串轉雙引號)
eq(formatGraphql('"""A scalar."""\nscalar DateTime'), `"A scalar."
scalar DateTime`, '描述字串 pretty')

// --- 往返一致 ---
roundTrip(q, 'query 巢狀')
roundTrip(sdl, 'SDL type')
roundTrip(
  'mutation M($id: ID!) { like(id: $id) @optimistic { ...LikeFields ... on Post { title } } } fragment LikeFields on Reaction { count viewerHasLiked }',
  'mutation + 片段 + 行內片段',
)
roundTrip(
  '"""A scalar.""" scalar DateTime enum Color { RED GREEN } input Filter { q: String tags: [String!] = [] } union Media = Photo | Video schema { query: Query mutation: Mutation } directive @auth(role: String!) repeatable on FIELD | OBJECT "User type" type Query { me: User }',
  'SDL 綜合',
)
roundTrip(
  '{ search(filter: {q: "hi", tags: ["a", "b"], n: 3, f: 1.5, ok: true, none: null, e: ACTIVE}) { id } }',
  '各種值:字串/清單/物件/布林/null/列舉/數字',
)
roundTrip('query{a{b{c{d{e}}}}}', '深層巢狀')
roundTrip('interface Node { id: ID! }', 'interface')

// 註解被移除(GraphQL 慣例)
const withComment = '# 開頭註解\nquery { field # 行內註解\n }'
ok(!formatGraphql(withComment).includes('#'), '註解於輸出中移除')
roundTrip(withComment, '含註解仍可往返')

// 字串內特殊字元跳脫往返
roundTrip('{ f(s: "he said \\"hi\\"\\n2nd line") }', '字串跳脫往返')

// minify 後仍可被解析回相同結構(已於 roundTrip 涵蓋),再驗 format(minify)==format(原)
ok(formatGraphql(minifyGraphql(q)) === formatGraphql(q), 'format∘minify 等冪')

// --- 錯誤處理 ---
throws(() => parseGraphql(''), '空輸入報錯')
throws(() => parseGraphql('   '), '純空白報錯')
throws(() => parseGraphql('query {'), '未閉合大括號報錯')
throws(() => parseGraphql('{ }'), '空選擇集合報錯')
throws(() => parseGraphql('query { field(a:) }'), '缺少引數值報錯')
throws(() => parseGraphql('type'), '不完整定義報錯')

console.log(`\ngraphqlFormat: ${pass} 通過, ${fail} 失敗`)
if (fail > 0) process.exit(1)
