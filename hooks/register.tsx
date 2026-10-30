import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderSurface } from 'claude-code'

import type { Palette } from '../types'
import { hash, split } from './blocks'
import { put } from './clipboard'
import { bind } from './keys'
import { settings, type Settings } from './settings'
import { select } from './spec'
import { EMPTY, indexOf, isPrompt, turnsOf, type Turn } from './transcript'
import { band, framed, palette, tagged } from './views'

const PANE = 'yank'
const index = atom({ plugin: 'yank', key: 'index' } as const, EMPTY, { shape: 'index-1' })
const view = atom({ plugin: 'yank', key: 'palette' } as const, null, { shape: 'palette-2' })

const GUIDE = `# Copyable blocks
The person copies from your replies by keystroke (the yank mod): each fenced block gets a key. Make what they will paste easy to take.
- Put each thing they would paste in its own fenced block: a command, code, config, a query, a message to send to someone (fence that as \`text\`).
- Name each block on its fence line, after the language, in a few words: \`\`\`bash Rebase onto main
- Write a block exactly as it should be pasted: no \`$ \` prompts, no line numbers, no output mixed into a command.
- Keep prose, tables and explanations out of fences; keep commands that run together in one block.`

const turnsNow = async ($: EngineInterface) => turnsOf(await $.session.messages())

const viewOf = (turns: readonly Turn[], n: number): Palette => ({
  turn: n,
  total: turns.length,
  prompt: turns[n - 1]?.prompt ?? '',
  blocks: turns[n - 1]?.blocks ?? [],
  mode: 'keys',
  draft: '',
  preview: null,
})

async function copy($: EngineInterface, my: Settings, spec: string, current?: number, surface?: RenderSurface) {
  const turns = await turnsNow($)
  const chosen = select(spec, turns, current ?? turns.length, my)
  if ('error' in chosen) return $.ui.toast(chosen.error)
  await put($, chosen, { surface, gapMs: my.gapMs, quiet: !my.confirm })
}

async function open($: EngineInterface, my: Settings) {
  const turns = await turnsNow($)
  if (turns.length === 0) return $.ui.toast('Nothing to copy yet: ask Claude something first')
  await update($, view, () => viewOf(turns, turns.length))
  await $.ui.open({ id: PANE, title: 'yank', focus: true, closeOnEscape: true, holdToasts: true, backgroundColor: my.paneBackground })
}

async function rebuild($: EngineInterface) {
  const turns = await turnsNow($)
  // Prompt row ids come from appends alone, so they are kept across rebuilds.
  await update($, index, old =>
    indexOf(turns, Object.fromEntries(Object.entries(old.prompts).filter(([k]) => !k.startsWith('t:')))),
  )
  return turns
}

async function move($: EngineInterface, n: number) {
  const turns = await turnsNow($)
  if (n >= 1 && n <= turns.length) await update($, view, () => viewOf(turns, n))
}

// What a typed range would copy, read before Enter: its name, its size, its first lines.
async function draft($: EngineInterface, my: Settings, text: string, current: number) {
  const chosen = select(text, await turnsNow($), current, my)
  let preview: Palette['preview'] = null
  if (text.trim() !== '' && 'error' in chosen) preview = { isError: true, label: chosen.error }
  else if (text.trim() !== '' && !('error' in chosen)) {
    const all = chosen.items.join('\n\n')
    const lines = all.split('\n')
    preview = { isError: false, label: chosen.label, items: chosen.items.length, lines: lines.length, chars: all.length, sample: lines.slice(0, 6) }
  }
  await update($, view, v => (v === null ? null : { ...v, draft: text, preview }))
}

export const register: Register = (on, options) => {
  const my = settings(options)

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'yank',
      description: 'Copy from the conversation: /yank opens the palette, /yank o2-5 copies replies 2 to 5',
      argumentHint: '[2 | o | p3 | x1-3 | b* | c | t | keys]',
    })
    const ran = await next(e)
    await rebuild($)
    if ((await $.store.get('welcomed')) !== true) {
      await $.store.set('welcomed', true)
      $.ui.toast('yank is on: /yank opens the palette, /yank keys binds ctrl+x y to it')
    }
    return ran
  })

  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear') {
      await update($, index, () => EMPTY)
      await update($, view, () => null)
    }
    return next(e)
  })

  if (my.guide) {
    on('prompt.compose', async ($, e, next) => {
      const { sections } = await next(e)
      return { sections: [...sections, { id: 'yank:guide', text: GUIDE, scope: 'session' }] }
    })
  }

  // A prompt's row id is known only as it is stored: number it then.
  on('session.append', async ($, e, next) => {
    const stored = await next(e)
    const id = stored.uuid
    if (id !== undefined && e.door === 'prompt' && e.agentId === undefined && !e.message.isMeta) {
      const content = e.message.content
      const text = typeof content === 'string' ? content : content.flatMap(b => (b.type === 'text' ? [b.text] : [])).join('\n')
      if (isPrompt(text)) {
        await update($, index, i => ({ ...i, turns: i.turns + 1, prompts: { ...i.prompts, [id]: i.turns + 1 } }))
      }
    }
    return stored
  })

  on('turn.complete', async ($, e, next) => {
    const ran = await next(e)
    if (e.agentId !== undefined) return ran
    const blocks = (await rebuild($)).at(-1)?.blocks ?? []
    const quiet = !my.confirm
    if (my.autoCopy === 'single' && blocks.length === 1) {
      await put($, { label: 'block 1, ready to paste', items: [blocks[0]?.text ?? ''] }, { gapMs: my.gapMs, quiet })
    } else if (my.autoCopy === 'all' && blocks.length > 0) {
      await put($, { label: "the reply's blocks", items: blocks.map(b => b.text) }, { gapMs: my.gapMs, quiet })
    }
    return ran
  })

  on('command.run', { command: 'yank' }, async ($, e) => {
    const args = e.args.trim()
    if (args === '') await open($, my)
    else if (args === 'keys') $.ui.toast(await bind($))
    else await copy($, my, args)
    return {}
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const p = await read($, view)
    const { Text } = $.ui.resolve(e)
    if (p === null) return <Text dimColor>Nothing to copy yet.</Text>
    const actions = {
      copy: (spec: string) => void $.ui.close({ id: PANE }).then(() => copy($, my, spec, p.turn, e.surface)),
      move: (n: number) => void move($, n),
      range: () => void update($, view, v => (v === null ? null : { ...v, mode: 'range' as const })),
      draft: (text: string) => void draft($, my, text, p.turn),
    }
    return palette($, e, p, actions, my)
  })

  if (my.look !== 'off') {
    on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
      if (e.props.isSummary) return next(e)
      const parts = split(e.props.text)
      if (!parts.some(p => p.kind === 'block')) return next(e)
      const prose = (text: string, isFirstOfReply: boolean) => next({ ...e, props: { ...e.props, text, isFirstOfReply } })
      return framed($, e, parts, await read($, index), my, prose)
    })
  }

  if (my.ids) {
    on('ui.render', { component: 'UserMessage' }, async ($, e, next) => {
      const drawn = await next(e)
      if (e.props.origin.kind !== 'composer' || e.props.isExpanded) return drawn
      const i = await read($, index)
      const turn = i.prompts[e.requestId] || i.prompts[`t:${hash(e.props.text.trim())}`]
      return turn ? tagged($, e, drawn, turn) : drawn
    })
  }

  if (my.band) {
    on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
      const { latest } = await read($, index)
      if (e.props.hasSurvey || latest.length === 0) return next(e)
      return band($, e, latest, b => void copy($, my, String(b.index), b.turn, e.surface), my)
    })
  }
}
