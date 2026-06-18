/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}

// gifenc 無內建型別宣告 —— 補上動圖工坊用到的部分 API
declare module 'gifenc' {
  type PaletteFormat = 'rgb565' | 'rgb444' | 'rgba4444'
  interface WriteFrameOptions {
    palette?: number[][]
    delay?: number
    repeat?: number
    transparent?: boolean
    dispose?: number
  }
  interface Encoder {
    writeFrame(index: Uint8Array, width: number, height: number, opts?: WriteFrameOptions): void
    finish(): void
    bytes(): Uint8Array
  }
  export function GIFEncoder(): Encoder
  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    opts?: { format?: PaletteFormat },
  ): number[][]
  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: number[][],
    format?: PaletteFormat,
  ): Uint8Array
}

// JsBarcode 套件雖附 jsbarcode.d.ts,但 package.json 未宣告 types 欄位,
// TS(moduleResolution: bundler)找不到 → 在此補上條碼工坊用到的最小宣告。
declare module 'jsbarcode' {
  interface BarcodeOptions {
    format?: string
    width?: number
    height?: number
    displayValue?: boolean
    text?: string
    fontSize?: number
    textMargin?: number
    margin?: number
    background?: string
    lineColor?: string
    valid?: (valid: boolean) => void
  }
  function JsBarcode(
    element: SVGElement | HTMLCanvasElement | string,
    data: string,
    options?: BarcodeOptions,
  ): void
  export default JsBarcode
}
