import type { SessionMessage } from 'claude-code'

import type { Block, Index } from '../types'
import { blockKey, blocksOf, hash } from './blocks'

/** One exchange: the person's prompt and everything Claude wrote back. */
export type Turn = {
  n: number
  prompt: string
  reply: string
  blocks: Block[]
  /** The shell commands Claude ran while answering, in order. */
  commands: string[]
}

// A prompt row can carry the engine's tagged blocks (a reminder, a hook's
// context) beside what the person typed: those are not theirs to copy.
const TAGGED = /<(system-reminder|user-prompt-submit-hook|local-command-caveat|command-[a-z-]+|local-command-[a-z-]+|task-notification|bash-[a-z-]+)\b[^>]*>[\s\S]*?<\/\1>/g

export const promptText = (text: string) => text.replace(TAGGED, '').trim()

// The engine's own rows (a slash command's record, a task's notification) are
// user rows too; once their tags are gone nothing of the person's is left.
export const isPrompt = (text: string) => {
  const typed = promptText(text)
  return typed !== '' && !typed.startsWith('<')
}

export function turnsOf(messages: readonly SessionMessage[]): Turn[] {
  const turns: Omit<Turn, 'blocks'>[] = []

  for (const m of messages) {
    if (m.role === 'user') {
      if (!m.toolResults?.length && isPrompt(m.text)) {
        turns.push({ n: turns.length + 1, prompt: promptText(m.text), reply: '', commands: [] })
      }
      continue
    }
    const turn = turns.at(-1)
    if (turn === undefined) continue
    if (m.text.trim() !== '') turn.reply = turn.reply === '' ? m.text : `${turn.reply}\n\n${m.text}`
    for (const use of m.toolUses) {
      const command = use.tool === 'Bash' ? use.input.command : undefined
      if (typeof command === 'string') turn.commands.push(command)
    }
  }

  return turns.map(t => ({ ...t, blocks: blocksOf(t.n, t.reply) }))
}

// The index drawn from a transcript, keeping the prompt ids rows were seen
// with (a transcript read gives texts, not ids).
export function indexOf(turns: readonly Turn[], prompts: Index['prompts'] = {}): Index {
  const blocks: Index['blocks'] = {}
  for (const b of turns.flatMap(t => t.blocks)) blocks[blockKey(b)] = b.id

  const byText: Record<string, number> = {}
  for (const t of turns) {
    const key = `t:${hash(t.prompt.trim())}`
    byText[key] = key in byText ? 0 : t.n
  }

  return { turns: turns.length, blocks, prompts: { ...byText, ...prompts }, latest: turns.at(-1)?.blocks ?? [] }
}

export const EMPTY: Index = { turns: 0, blocks: {}, prompts: {}, latest: [] }
