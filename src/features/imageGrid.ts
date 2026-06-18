/*
  九宮格切圖引擎 —— 把一張圖切成 cols×rows 塊,貼到 IG 個人檔案會拼回一整張大圖。

  這裡只放「與環境無關」的純幾何計算(來源像素矩形、貼文順序),
  方便用 Node 跑回歸測試;實際畫到 Canvas、輸出 PNG 那段留在 .vue 元件。
*/

export interface CropRect {
  sx: number
  sy: number
  sw: number
  sh: number
}

export interface GridTile {
  /** 顯示位置:第幾列(0 起,由上而下) */
  row: number
  /** 顯示位置:第幾欄(0 起,由左而右) */
  col: number
  /** 在原圖上的來源矩形(像素) */
  src: CropRect
  /** 顯示順序編號(1 起,由左而右、由上而下) */
  displayIndex: number
  /** 貼到 IG 的建議發文順序(1 起;IG 新貼文排在最前,故從最後一格開始貼) */
  postOrder: number
}

/**
 * 取「以中心對齊、符合目標長寬比」的最大內接矩形(cover 裁切)。
 * 目標比例由 cols:rows 決定(每格為正方形時整體即 cols:rows)。
 */
export function computeCoverCrop(
  imgW: number,
  imgH: number,
  aspectW: number,
  aspectH: number,
): CropRect {
  if (imgW <= 0 || imgH <= 0) throw new Error('來源尺寸不正確')
  if (aspectW <= 0 || aspectH <= 0) throw new Error('長寬比不正確')
  const target = aspectW / aspectH
  const imgRatio = imgW / imgH
  let sw: number
  let sh: number
  if (imgRatio > target) {
    // 原圖較寬 → 以高為準,裁掉左右
    sh = imgH
    sw = sh * target
  } else {
    // 原圖較高(或相等)→ 以寬為準,裁掉上下
    sw = imgW
    sh = sw / target
  }
  const sx = (imgW - sw) / 2
  const sy = (imgH - sh) / 2
  return { sx, sy, sw, sh }
}

/**
 * 規劃九宮格切圖:回傳每一格在原圖上的來源矩形與發文順序。
 * @param cols 欄數(IG 一排通常 3)
 * @param rows 列數
 */
export function planGridTiles(
  imgW: number,
  imgH: number,
  cols: number,
  rows: number,
): GridTile[] {
  const c = Math.floor(cols)
  const r = Math.floor(rows)
  if (!Number.isFinite(c) || !Number.isFinite(r) || c < 1 || r < 1) {
    throw new Error('欄數與列數需為正整數')
  }
  const crop = computeCoverCrop(imgW, imgH, c, r)
  const tileW = crop.sw / c
  const tileH = crop.sh / r
  const total = c * r
  const tiles: GridTile[] = []
  for (let row = 0; row < r; row++) {
    for (let col = 0; col < c; col++) {
      const displayIndex = row * c + col + 1
      tiles.push({
        row,
        col,
        src: {
          sx: crop.sx + col * tileW,
          sy: crop.sy + row * tileH,
          sw: tileW,
          sh: tileH,
        },
        displayIndex,
        // IG 最新貼文排最前,要讓格子由左上往右下排好,須從最後一格開始貼
        postOrder: total - displayIndex + 1,
      })
    }
  }
  return tiles
}
