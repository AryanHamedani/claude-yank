import type { On, SessionMessage } from 'claude-code'
import { expect, test } from 'claude-code/testing'

const TALK: SessionMessage[] = [
  { role: 'user', text: 'how do I rebase?', toolUses: [] },
  { role: 'assistant', text: 'Run:\n```bash Rebase onto main\ngit rebase origin/main\n```\nThen tell the team:\n```text\nDone!\n```', toolUses: [] },
]

// The engine beneath the plugin, as far as these views reach it.
function engine(on: On, copied: string[], toasts: string[] = []) {
  on('command.register', () => ({ value: { command: 'yank' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.messages', () => ({ value: TALK }))
  on('store.get', () => ({ value: true }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.close', () => ({ value: undefined }))
  on('ui.toast', (_, e) => {
    toasts.push(String(e.text))
    return { value: undefined }
  })
  on('ui.copy', (_, e) => {
    copied.push(e.text)
    return { value: { isCopied: true } }
  })
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>{`engine:${'text' in e.props ? String(e.props.text) : ''}`}</Text>
  })
}

// A /yank the person typed.
const typed = (args: string) =>
  ({ command: 'yank', args, origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 120 } }) as const

const PANE = {
  plugin: 'yank',
  component: 'Pane',
  requestId: 'yank',
  props: { title: 'yank', isFocused: true, bodyColumns: 70, placement: 'dock', scroll: { offset: 0, bodyRows: 20 }, view: {} },
} as const

test('the palette copies a block, a reply, an exchange, on every surface that takes keys', async ($, on) => {
  const copied: string[] = []
  engine(on, copied)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  for (const surface of ['terminal', 'desktop'] as const) {
    for (const key of ['block-2', 'reply', 'both']) {
      await $.command.run(typed(''))
      const ui = await $.ui.mount({ ...PANE, surface })
      expect(await ui.find({ type: 'Text', text: /^Turn 1 of 1$/ })).toBeDefined()
      await ui.press({ key })
      await ui.unmount()
    }
  }

  expect(copied.slice(0, 3)).toEqual([
    'Done!',
    TALK[1]?.text,
    `## #1 · You\n\nhow do I rebase?\n\n## #1 · Claude\n\n${TALK[1]?.text}`,
  ])
  expect(copied).toHaveLength(6)
})

test('a typed range previews what it would copy, then copies it', async ($, on) => {
  const copied: string[] = []
  engine(on, copied)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.command.run(typed(''))

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'range' })
  await ui.input({ key: 'range', text: 'p1', kind: 'change' })
  expect((await ui.find({ type: 'Text', text: /^prompt #1/ }))?.text).toBe('prompt #1  1 item · 1 line · 16 chars')
  expect(await ui.find({ type: 'Text', text: /^how do I rebase\?$/ })).toBeDefined()
  await ui.input({ key: 'range', text: 'q', kind: 'change' })
  expect((await ui.find({ type: 'Text', text: /not a yank word/ }))?.text).toContain('"q"')
  await ui.input({ key: 'range', text: 'p1' })
  expect(copied).toEqual(['how do I rebase?'])
  await ui.unmount()
})

test('/yank <word> copies without opening anything; a bad word says why', async ($, on) => {
  const copied: string[] = []
  const toasts: string[] = []
  engine(on, copied, toasts)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  await $.command.run(typed('1'))
  await $.command.run(typed('z'))
  expect(copied).toEqual(['git rebase origin/main'])
  expect(toasts.at(-1)).toBe('"z" is not a yank word: try 2, o, x1-3, b*')
})

test('a reply with blocks is drawn as prose from the engine and framed blocks', async ($, on) => {
  engine(on, [])
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({
    plugin: 'yank',
    surface: 'terminal',
    component: 'AssistantMessage',
    requestId: 'm1',
    props: { text: TALK[1]?.text ?? '', isFirstOfReply: true },
  })
  expect((await ui.find({ type: 'Text', text: /engine:Run:/ }))?.text).toBe('engine:Run:')
  expect((await ui.find({ type: 'Text', text: /Rebase onto main/ }))?.text).toContain('Rebase onto main')
  expect(await ui.find({ type: 'Code' })).toBeDefined()
  await ui.unmount()
})
