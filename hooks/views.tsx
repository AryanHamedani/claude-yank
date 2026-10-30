import type { EngineInterface, RenderChildren, RenderElement, RenderInput } from 'claude-code'

import type { Block, Index, Palette } from '../types'
import { blockKey, preview, type Fence, type Part } from './blocks'
import type { Settings } from './settings'

// What the palette's keys do; the views draw, register.tsx decides.
export type Actions = {
  copy: (spec: string) => void
  move: (turn: number) => void
  range: () => void
  draft: (text: string) => void
}

const LEGEND = [
  ['reply', 'reply'],
  ['prompt', 'prompt'],
  ['both', 'both'],
  ['blocks', 'blocks'],
  ['commands', 'commands'],
  ['all', 'all'],
  ['range', 'range…'],
] as const

// What the letters mean in a typed range; the palette's own keys may differ.
const GRAMMAR: readonly (readonly [string, string])[] = [
  ['2', 'block'],
  ['4.2', 'block of #4'],
  ['o', 'reply'],
  ['p', 'prompt'],
  ['x', 'both'],
  ['b', 'blocks'],
  ['c', 'commands'],
  ['t', 'all'],
]

export function palette($: EngineInterface, e: RenderInput<'Pane'>, p: Palette, act: Actions, my: Settings): RenderElement {
  const ui = $.ui.resolve(e)
  const { Box, Button, Text } = ui
  const width = Math.max(30, e.props.bodyColumns - 2)
  const titleWidth = Math.min(28, Math.max(0, ...p.blocks.map(b => b.title.length)))

  const header = (
    <Box flexDirection="row" justifyContent="space-between">
      <Text>{`Turn ${p.turn} of ${p.total}`}</Text>
      <Box flexDirection="row" columnGap={2}>
        <Button key="prev" plain hotkey={my.keys.prev} dimColor onPress={() => act.move(p.turn - 1)}>older</Button>
        <Button key="next" plain hotkey={my.keys.next} dimColor onPress={() => act.move(p.turn + 1)}>newer</Button>
      </Box>
    </Box>
  )
  const prompt = <Text dimColor wrap="truncate-end">{preview(p.prompt, width)}</Text>

  const blocks = (
    <Box flexDirection="column" marginY={1}>
      {p.blocks.length === 0 && <Text dimColor>No blocks in this reply; the keys below still copy it.</Text>}
      {p.blocks.map(b => (
        <Button key={`block-${b.index}`} plain hotkey={b.index <= 9 ? String(b.index) : undefined} onPress={() => act.copy(String(b.index))}>
          <Text dimColor>{(b.lang || 'text').padEnd(7)}</Text>
          {titleWidth > 0 ? `${cut(b.title, titleWidth).padEnd(titleWidth)}  ` : ''}
          <Text dimColor>{preview(b.text, width - titleWidth - 14)}</Text>
        </Button>
      ))}
    </Box>
  )

  if (p.mode === 'keys' || !('Input' in ui)) {
    return (
      <Box flexDirection="column" paddingX={1}>
        {header}
        {prompt}
        {blocks}
        <Box flexDirection="row" flexWrap="wrap" columnGap={2}>
          {LEGEND.map(([action, label]) => (
            <Button key={action} plain hotkey={my.keys[action]} onPress={() => (action === 'range' ? act.range() : act.copy(SPEC[action]))}>
              {label}
            </Button>
          ))}
        </Box>
      </Box>
    )
  }

  const shown = p.preview
  return (
    <Box flexDirection="column" paddingX={1}>
      {header}
      {prompt}
      <Box marginTop={1}>
        <ui.Input key="range" autoFocus label="range" placeholder="o2-5" submitLabel="copy" value={p.draft} onInput={act.draft} onSubmit={act.copy} />
      </Box>
      {shown === null && (
        <Box flexDirection="column" marginTop={1}>
          <Box flexDirection="row" flexWrap="wrap" columnGap={2}>
            {GRAMMAR.map(([word, meaning]) => (
              <Text>
                <Text color={my.accentColor}>{word}</Text> <Text dimColor>{meaning}</Text>
              </Text>
            ))}
          </Box>
          <Text dimColor>then a turn: 3 · 2-5 · 2- to now · * every · 1,3</Text>
        </Box>
      )}
      {shown?.isError === true && <Text color="error">{shown.label}</Text>}
      {shown?.isError === false && (
        <Box flexDirection="column" marginTop={1}>
          <Text>
            <Text>{shown.label}</Text>
            <Text dimColor>{`  ${count(shown.items, 'item')} · ${count(shown.lines, 'line')} · ${size(shown.chars)}`}</Text>
          </Text>
          <Box flexDirection="column" borderStyle={my.border} borderColor={my.frameColor} paddingX={1}>
            {shown.sample.map(line => <Text dimColor wrap="truncate-end">{line || ' '}</Text>)}
          </Box>
          <Text dimColor>enter copies · esc closes</Text>
        </Box>
      )}
    </Box>
  )
}

// A palette key's word in the grammar.
const SPEC = { reply: 'o', prompt: 'p', both: 'x', blocks: 'b', commands: 'c', all: 't', range: '' } as const

// A reply laid out as Claude Code lays one out (a 2-column bullet gutter on
// its first block), its prose drawn by the engine, each fence as a block
// card that carries its key.
export async function framed(
  $: EngineInterface,
  e: RenderInput<'AssistantMessage'>,
  parts: readonly Part[],
  index: Index,
  my: Settings,
  prose: (text: string, isFirst: boolean) => Promise<RenderElement>,
): Promise<RenderElement> {
  const { Box, Text } = $.ui.resolve(e)
  const gutter = e.props.isFirstOfReply ? 2 : 0
  const kids: RenderChildren[] = []

  for (const [i, part] of parts.entries()) {
    const isFirst = i === 0 && e.props.isFirstOfReply
    if (part.kind === 'prose') {
      const drawn = await prose(part.text, isFirst)
      kids.push(isFirst ? drawn : <Box marginLeft={gutter}>{drawn}</Box>)
      continue
    }
    const block = card($, e, part, label(index.blocks[blockKey(part)], index.turns), my)
    kids.push(
      isFirst ? (
        <Box flexDirection="row">
          <Box minWidth={2}><Text color="text">●</Text></Box>
          {block}
        </Box>
      ) : (
        <Box marginLeft={gutter}>{block}</Box>
      ),
    )
  }

  return <Box flexDirection="column">{kids}</Box>
}

function card($: EngineInterface, e: RenderInput<'AssistantMessage'>, fence: Fence, id: string, my: Settings): RenderElement {
  const { Box, Code, Text } = $.ui.resolve(e)
  const caption = (
    <Text>
      {id !== '' && <Text color={my.accentColor} bold>{`${id}  `}</Text>}
      <Text dimColor>{fence.lang || 'text'}</Text>
      {fence.title !== '' && <Text>{`  ${fence.title}`}</Text>}
    </Text>
  )
  const code = <Code source={fence.text} language={fence.lang || undefined} />

  if (my.look === 'quiet') {
    return (
      <Box flexDirection="column" marginTop={1} flexGrow={1}>
        {caption}
        {code}
      </Box>
    )
  }
  return (
    <Box flexDirection="column" marginTop={1} flexGrow={1} borderStyle={my.border} borderColor={my.frameColor} paddingX={1}>
      {caption}
      {code}
    </Box>
  )
}

// A block of the latest reply goes by its number alone, an older one by turn.number.
function label(id: string | undefined, latest: number): string {
  if (id === undefined) return ''
  const [turn, index] = id.split('.')
  return Number(turn) === latest ? `${index}` : id
}

export function tagged($: EngineInterface, e: RenderInput<'UserMessage'>, drawn: RenderElement, turn: number): RenderElement {
  const { Box, Text } = $.ui.resolve(e)
  return (
    <Box flexDirection="row">
      <Box flexGrow={1} flexShrink={1}>{drawn}</Box>
      <Text dimColor>{` #${turn}`}</Text>
    </Box>
  )
}

export function band($: EngineInterface, e: RenderInput<'AbovePrompt'>, blocks: readonly Block[], copy: (b: Block) => void, my: Settings): RenderElement {
  const { Box, Button, Text } = $.ui.resolve(e)
  const room = Math.max(12, Math.floor(e.props.bodyColumns / Math.min(blocks.length, 3)) - 12)
  return (
    <Box flexDirection="row" flexWrap="wrap" columnGap={2}>
      {blocks.slice(0, 9).map(b => (
        <Button key={`band-${b.index}`} plain hotkey={String(b.index)} onPress={() => copy(b)}>
          <Text color={my.accentColor}>{b.lang || 'text'}</Text> {preview(b.title || b.text, room)}
        </Button>
      ))}
      <Text dimColor>/yank for more</Text>
    </Box>
  )
}

const cut = (text: string, width: number) => (text.length > width ? `${text.slice(0, width - 1)}…` : text)
const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`
const size = (chars: number) => (chars < 1000 ? `${chars} chars` : `${(chars / 1000).toFixed(1)}k chars`)
