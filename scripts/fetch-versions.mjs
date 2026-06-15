// 自動更新下載中心的軟體版本號。
// 設計原則(容錯):每個來源各自 try/catch,單一失敗不影響其他;
// 抓不到就保留舊版本號,絕不把整份資料弄壞。
// 目前支援 GitHub Releases 來源(entry.github = "owner/repo")。
// 其他軟體沒有穩定的版本 API,維持手動維護的官方連結。

import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const dataPath = fileURLToPath(new URL('../public/data/software.json', import.meta.url))

async function latestGithubVersion(repo) {
  const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'toolhub-version-fetcher',
      ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
    },
  })
  if (!res.ok) throw new Error(`GitHub ${repo} -> HTTP ${res.status}`)
  const json = await res.json()
  return (json.tag_name || json.name || '').replace(/^v/, '')
}

async function main() {
  const data = JSON.parse(await readFile(dataPath, 'utf8'))
  let changed = false

  for (const sw of data.software) {
    if (!sw.github) continue
    try {
      const version = await latestGithubVersion(sw.github)
      if (version && version !== sw.version) {
        console.log(`✔ ${sw.name}: ${sw.version || '(空)'} -> ${version}`)
        sw.version = version
        changed = true
      } else {
        console.log(`= ${sw.name}: 已是最新 (${version || '無'})`)
      }
    } catch (err) {
      console.warn(`✖ ${sw.name}: 抓取失敗,保留舊值 — ${err.message}`)
    }
  }

  if (changed) {
    data.updated = new Date().toISOString().slice(0, 10)
    await writeFile(dataPath, JSON.stringify(data, null, 2) + '\n')
    console.log('已更新 software.json')
  } else {
    console.log('沒有變更')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
