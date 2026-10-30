import type { EngineInterface } from 'claude-code'

const CHORD = 'ctrl+x y'
const ACTION = 'command:yank'

type Bindings = { bindings?: { context: string; bindings: Record<string, string | null> }[] }

// Claude Code's config folder: CLAUDE_CONFIG_DIR, else ~/.claude (USERPROFILE on Windows).
async function configDir($: EngineInterface): Promise<string | undefined> {
  const custom = await $.env.get('CLAUDE_CONFIG_DIR')
  if (custom) return custom
  const home = (await $.env.get('HOME')) || (await $.env.get('USERPROFILE'))
  return home ? `${home}/.claude` : undefined
}

// Binds ctrl+x y to /yank in the keybindings file, a copy of the file kept
// beside it first. Answers what it did, in one line for a toast.
export async function bind($: EngineInterface): Promise<string> {
  const dir = await configDir($)
  if (dir === undefined) return 'yank: no home folder found, so no keybindings file to write'
  const path = `${dir}/keybindings.json`

  const before = (await $.fs.exists(path)) ? await $.fs.read(path) : '{ "bindings": [] }'
  let file: Bindings
  try {
    file = JSON.parse(before) as Bindings
  } catch {
    return `yank: ${path} is not plain JSON; add "${CHORD}": "${ACTION}" to its Chat bindings by hand`
  }

  const blocks = (file.bindings ??= [])
  if (blocks.some(b => Object.values(b.bindings).includes(ACTION))) return 'yank: already bound, press ctrl+x y'
  const taken = blocks.find(b => b.context === 'Chat' && b.bindings[CHORD])?.bindings[CHORD]
  if (taken) return `yank: ${CHORD} is ${taken} in your keybindings; bind "${ACTION}" to another key by hand`

  let chat = blocks.find(b => b.context === 'Chat')
  if (chat === undefined) blocks.push((chat = { context: 'Chat', bindings: {} }))
  chat.bindings[CHORD] = ACTION

  await $.fs.write(`${path}.bak-yank`, before)
  await $.fs.write(path, `${JSON.stringify(file, null, 2)}\n`)
  return 'yank: bound ctrl+x y to the palette (your old file is keybindings.json.bak-yank)'
}
