import type { Turn } from './transcript'

// The yank grammar, one word for anything in the conversation:
//
//   2      block 2 of the reply in view     1-3   blocks 1 to 3, one clipboard item each
//   4.2    block 2 of turn 4                4.1-3 blocks 1 to 3 of turn 4
//   o      the reply                        o3    reply 3        o2-5   replies 2 to 5
//   p      the prompt                       p3    prompt 3       p1,4   prompts 1 and 4
//   x      prompt and reply together        x2-   exchange 2 to the latest
//   b      every block of the reply         b*    every block in the conversation
//   c      the commands Claude ran          t     the whole conversation
//
// A range is `n`, `a-b`, `a-` (to the latest), `*` (all), or a list of them.

export type Selection = { label: string; items: string[] }
export type Result = Selection | { error: string }

const KINDS = {
  o: 'reply',
  p: 'prompt',
  x: 'exchange',
  b: 'blocks',
  c: 'commands',
} as const

export type Speakers = { you: string; claude: string }
const SPEAKERS: Speakers = { you: 'You', claude: 'Claude' }

export function select(spec: string, turns: readonly Turn[], current = turns.length, names = SPEAKERS): Result {
  const word = spec.trim().toLowerCase().replace(/\s+/g, '')
  if (turns.length === 0) return { error: 'Nothing to copy yet' }
  if (word === '') return { error: 'Type what to copy' }
  if (word === 't' || word === 'all') return exchanges(turns, 'the whole conversation', names)

  const inTurn = /^(\d+)\.(.+)$/.exec(word)
  if (inTurn) {
    const turn = turns[Number(inTurn[1]) - 1]
    if (turn === undefined) return { error: `There is no turn ${inTurn[1]}` }
    return blocks(turn, inTurn[2] ?? '')
  }

  if (/^[\d,*-]+$/.test(word)) {
    const turn = turns[current - 1]
    return turn === undefined ? { error: `There is no turn ${current}` } : blocks(turn, word)
  }

  const letter = word[0] as keyof typeof KINDS
  const kind = KINDS[letter]
  if (kind === undefined) return { error: `"${word}" is not a yank word: try 2, o, x1-3, b*` }

  const rest = word.slice(1)
  const picked = rest === '' ? [current] : range(rest, turns.length)
  if ('error' in picked) return picked
  const chosen = picked.map(n => turns[n - 1]).filter(t => t !== undefined)
  const span = numbers(picked)

  switch (kind) {
    case 'reply':
      return joined(chosen.filter(t => t.reply.trim() !== ''), t => t.reply, `reply #${span}`, 'Reply')
    case 'prompt':
      return joined(chosen, t => t.prompt, `prompt #${span}`, 'Prompt')
    case 'exchange':
      return exchanges(chosen, `exchange #${span}`, names)
    case 'blocks': {
      const items = chosen.flatMap(t => t.blocks.map(b => b.text))
      const label = rest === '*' ? 'every block in the conversation' : `every block of #${span}`
      return items.length === 0 ? { error: `No blocks in #${span}` } : { label, items }
    }
    case 'commands': {
      const commands = chosen.flatMap(t => t.commands)
      return commands.length === 0
        ? { error: `Claude ran no commands in #${span}` }
        : { label: `commands of #${span}`, items: [commands.join('\n')] }
    }
  }
}

function blocks(turn: Turn, word: string): Result {
  if (turn.blocks.length === 0) return { error: `Reply #${turn.n} has no blocks` }
  const picked = range(word, turn.blocks.length, n => `Reply #${turn.n} has no block ${n}`)
  if ('error' in picked) return picked
  const ids = numbers(picked)
  return {
    label: picked.length === 1 ? `block ${turn.n}.${ids}` : `blocks ${turn.n}.${ids}`,
    items: picked.map(i => turn.blocks[i - 1]?.text ?? ''),
  }
}

function joined(turns: readonly Turn[], text: (t: Turn) => string, label: string, heading: string): Result {
  if (turns.length === 0) return { error: `Nothing in ${label}` }
  const only = turns.length === 1 ? turns[0] : undefined
  const item = only ? text(only) : turns.map(t => `## ${heading} #${t.n}\n\n${text(t)}`).join('\n\n')
  return { label, items: [item] }
}

function exchanges(turns: readonly Turn[], label: string, { you, claude }: Speakers): Result {
  const item = turns
    .map(t => `## #${t.n} · ${you}\n\n${t.prompt}\n\n## #${t.n} · ${claude}\n\n${t.reply || '_(no reply)_'}`)
    .join('\n\n---\n\n')
  return { label, items: [item] }
}

// `3`, `2-5`, `2-`, `*`, `1,3,5-` against 1..max: the numbers in the order written.
export function range(
  word: string,
  max: number,
  missing = (n: number) => `There is no turn ${n}`,
): number[] | { error: string } {
  const out: number[] = []
  for (const part of word.split(',')) {
    const m = /^(\*)$|^(\d+)(-(\d*))?$/.exec(part)
    if (m === null) return { error: `"${part}" is not a range: try 3, 2-5, 2- or *` }
    const from = m[1] ? 1 : Number(m[2])
    const to = m[1] ? max : m[3] === undefined ? from : m[4] === '' ? max : Number(m[4])
    if (from < 1 || to > max || from > to) return { error: missing(from > max ? from : to) }
    for (let n = from; n <= to; n++) if (!out.includes(n)) out.push(n)
  }
  return out
}

// [2,3,4,7] reads "2–4, 7".
export function numbers(list: readonly number[]): string {
  const runs: string[] = []
  for (let i = 0; i < list.length; i++) {
    let j = i
    while (list[j + 1] === (list[j] ?? 0) + 1) j++
    runs.push(j > i ? `${list[i]}–${list[j]}` : `${list[i]}`)
    i = j
  }
  return runs.join(', ')
}
