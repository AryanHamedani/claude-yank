/** A fenced block Claude wrote for you to copy: `id` is `<turn>.<index>`. */
export type Block = {
  id: string
  turn: number
  index: number
  lang: string
  title: string
  text: string
}

/** What the transcript rows need to draw ids without reading the transcript. */
export type Index = {
  /** Prompts seen so far: the next prompt is turn `turns + 1`. */
  turns: number
  /** Block id by the block's content hash. */
  blocks: Record<string, string>
  /** Turn by the prompt row's id, and by `t:<hash of its text>` (0 when two share it). */
  prompts: Record<string, number>
  /** The latest reply's blocks, for the band and auto-copy. */
  latest: Block[]
}

/** The palette's view: one turn at a time, keys or a typed range. */
export type Palette = {
  turn: number
  total: number
  prompt: string
  blocks: Block[]
  mode: 'keys' | 'range'
  draft: string
  /** What the draft would copy, or why it would not. */
  preview: Preview | null
}

/** A typed range, read before it is copied. */
export type Preview =
  | { isError: true; label: string }
  | { isError: false; label: string; items: number; lines: number; chars: number; sample: string[] }

declare module 'claude-code' {
  interface PluginState {
    yank: {
      index: Shaped<Index>
      palette: Shaped<Palette | null>
    }
  }
}
