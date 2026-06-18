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
