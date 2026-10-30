import type { SessionMessage } from 'claude-code'
import { expect, test } from 'claude-code/testing'

import { fences, preview, split } from './blocks'
import { numbers, range, select } from './spec'
import { keys, settings } from './settings'
import { indexOf, turnsOf } from './transcript'

const say = (role: SessionMessage['role'], text: string, extra: Partial<SessionMessage> = {}): SessionMessage => ({
  role,
  text,
  toolUses: [],
  ...extra,
})

const REPLY = [
  'Run this:',
  '```bash Rebase onto main',
  'git fetch origin',
  'git rebase origin/main',
  '```',
  '1. Then tell the team:',
  '   ```text',
  '   Hi team, the rebase is done.',
  '   ```',
  'Inline `code` is no block, nor is ```this```.',
  '````md',
  '```js',
  'nested()',
  '```',
  '````',
].join('\n')

const TALK: SessionMessage[] = [
  say('user', 'how do I rebase?'),
  say('assistant', REPLY, {
    toolUses: [{ tool_use_id: 'a', tool: 'Bash', input: { command: 'git status' } }],
  }),
  say('user', '', { toolResults: [{ tool_use_id: 'a', text: 'clean', isError: undefined, result: {} }] as never }),
  say('assistant', 'Done.'),
  say('user', '<command-name>/model</command-name>'),
  say('user', 'and the SQL?'),
  say('assistant', '```sql Count users\nSELECT count(*) FROM users;\n```'),
  say('user', 'thanks'),
  say('assistant', 'Any time.'),
]

const turns = turnsOf(TALK)

test('fences: titled, dedented, nested; inline code is prose', () => {
  expect(fences(REPLY)).toEqual([
    { lang: 'bash', title: 'Rebase onto main', text: 'git fetch origin\ngit rebase origin/main' },
    { lang: 'text', title: '', text: 'Hi team, the rebase is done.' },
    { lang: 'md', title: '', text: '```js\nnested()\n```' },
  ])
  expect(split(REPLY).map(p => p.kind)).toEqual(['prose', 'block', 'prose', 'block', 'prose', 'block'])
  expect(fences('~~~\nunclosed')).toEqual([{ lang: '', title: '', text: 'unclosed' }])
  expect(preview('a'.repeat(40) + '\nmore', 10)).toBe('aaaaaaaaa…')
})

test('turns: prompts, replies across tool calls, commands; engine rows skipped', () => {
  expect(turns.map(t => t.prompt)).toEqual(['how do I rebase?', 'and the SQL?', 'thanks'])
  expect(turns[0]?.reply).toBe(`${REPLY}\n\nDone.`)
  expect(turns[0]?.commands).toEqual(['git status'])
  expect(turns[0]?.blocks.map(b => b.id)).toEqual(['1.1', '1.2', '1.3'])
  expect(turns[1]?.blocks[0]?.title).toBe('Count users')
  expect(indexOf(turns).latest).toEqual([])
})

test('ranges read as written and refuse what is not there', () => {
  expect(range('2-', 4)).toEqual([2, 3, 4])
  expect(range('*', 3)).toEqual([1, 2, 3])
  expect(range('3,1-2,3', 3)).toEqual([3, 1, 2])
  expect(range('5', 3)).toEqual({ error: 'There is no turn 5' })
  expect(range('x', 3)).toEqual({ error: '"x" is not a range: try 3, 2-5, 2- or *' })
  expect(numbers([1, 2, 3, 5, 7, 8])).toBe('1–3, 5, 7–8')
})

test('the grammar picks what it names', () => {
  const items = (spec: string, current?: number) => {
    const got = select(spec, turns, current)
    return 'error' in got ? got.error : got.items
  }
  expect(items('1', 1)).toEqual(['git fetch origin\ngit rebase origin/main'])
  expect(items('1.2')).toEqual(['Hi team, the rebase is done.'])
  expect(items('1.1-2')).toHaveLength(2)
  expect(items('2.1')).toEqual(['SELECT count(*) FROM users;'])
  expect(items('o')).toEqual(['Any time.'])
  expect(items('p2')).toEqual(['and the SQL?'])
  expect(items('o2-3')).toEqual(['## Reply #2\n\n```sql Count users\nSELECT count(*) FROM users;\n```\n\n## Reply #3\n\nAny time.'])
  expect(items('x3')).toEqual(['## #3 · You\n\nthanks\n\n## #3 · Claude\n\nAny time.'])
  expect(items('b*')).toHaveLength(4)
  expect(items('c1')).toEqual(['git status'])
  expect(items('c')).toBe('Claude ran no commands in #3')
  expect(items('2')).toBe('Reply #3 has no blocks')
  expect(items('1.9')).toBe('Reply #1 has no block 9')
  expect(items('q')).toBe('"q" is not a yank word: try 2, o, x1-3, b*')
  expect((select('t', turns) as { items: string[] }).items[0]?.split('\n---\n')).toHaveLength(3)
  expect(select('o', [])).toEqual({ error: 'Nothing to copy yet' })
})

test('settings: a typo falls back, keys remap only when they stay distinct', () => {
  const my = settings({ look: 'fancy', keys: 'prev=k next=j', speakers: 'Me|Bot', stackGapMs: -5 })
  expect(my.look).toBe('card')
  expect([my.keys.prev, my.keys.next, my.keys.reply]).toEqual(['k', 'j', 'o'])
  expect([my.you, my.claude, my.gapMs]).toEqual(['Me', 'Bot', 350])
  expect(keys('reply=p').reply).toBe('o')
  expect(keys('reply=7').reply).toBe('o')
})
