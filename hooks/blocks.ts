import type { Block } from '../types'

export type Fence = { lang: string; title: string; text: string }
export type Part = { kind: 'prose'; text: string } | ({ kind: 'block' } & Fence)

// Markdown split into prose and fenced blocks (``` or ~~~, CommonMark rules).
// A block's body is dedented by its opening fence's indent, so a block nested
// in a list copies clean. The fence line's words after the language are the
// block's title: ```bash Rebase onto main
export function split(markdown: string): Part[] {
  const parts: Part[] = []
  let prose: string[] = []
  let open: { indent: number; fence: string; lang: string; title: string; body: string[] } | null = null

  const flushProse = () => {
    if (prose.join('').trim() !== '') parts.push({ kind: 'prose', text: prose.join('\n') })
    prose = []
  }
  const flushBlock = () => {
    if (open === null) return
    const text = open.body.join('\n')
    if (text.trim() !== '') parts.push({ kind: 'block', lang: open.lang, title: open.title, text })
    open = null
  }

  for (const line of markdown.split('\n')) {
    if (open === null) {
      const m = /^(\s*)(`{3,}|~{3,})\s*(.*)$/.exec(line)
      const [, indent = '', fence = '', info = ''] = m ?? []
      if (m === null || (fence.startsWith('`') && info.includes('`'))) {
        prose.push(line)
        continue
      }
      flushProse()
      const [lang = '', ...title] = info.trim().split(/\s+/)
      open = { indent: indent.length, fence, lang, title: title.join(' '), body: [] }
      continue
    }
    const close = /^\s*(`{3,}|~{3,})\s*$/.exec(line)?.[1] ?? ''
    if (close[0] === open.fence[0] && close.length >= open.fence.length) {
      flushBlock()
      continue
    }
    const lead = line.length - line.trimStart().length
    open.body.push(line.slice(Math.min(lead, open.indent)))
  }
  // An unclosed fence runs to the end, as CommonMark reads it.
  flushBlock()
  flushProse()

  return parts
}

export function fences(markdown: string): Fence[] {
  return split(markdown).flatMap(p => (p.kind === 'block' ? [{ lang: p.lang, title: p.title, text: p.text }] : []))
}

export function blocksOf(turn: number, reply: string): Block[] {
  return fences(reply).map((f, i) => ({ ...f, id: `${turn}.${i + 1}`, turn, index: i + 1 }))
}

// FNV-1a: a short, stable key for a block's content or a prompt's text.
export function hash(text: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36)
}

export const blockKey = (f: Fence) => hash(`${f.lang}\n${f.text}`)

// One line of a text, cut to `width` cells, with a mark when there is more.
export function preview(text: string, width: number): string {
  const lines = text.split('\n')
  const first = lines.find(l => l.trim() !== '')?.trim() ?? ''
  const line = lines.length > 1 && first !== text.trim() ? `${first} …` : first
  const room = Math.max(8, width)
  return line.length > room ? `${line.slice(0, room - 1)}…` : line
}
