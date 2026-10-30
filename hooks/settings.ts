import type { PluginOptions } from 'claude-code'

// Every knob yank has, read once from the plugin's options (/config, or
// settings.json `pluginConfigs["yank@…"].options`). A value that does not
// parse falls back to its default, so a typo never breaks the mod.

export type Look = 'card' | 'quiet' | 'off'
export type Keys = Record<(typeof ACTIONS)[number], string>

export const ACTIONS = ['reply', 'prompt', 'both', 'blocks', 'commands', 'all', 'range', 'prev', 'next'] as const
const DEFAULT_KEYS: Keys = { reply: 'o', prompt: 'p', both: 'x', blocks: 'b', commands: 'c', all: 't', range: 'r', prev: 'h', next: 'l' }

export type Settings = {
  look: Look
  border: string
  frameColor: string
  accentColor: string
  paneBackground: string
  ids: boolean
  autoCopy: 'off' | 'single' | 'all'
  band: boolean
  guide: boolean
  confirm: boolean
  gapMs: number
  keys: Keys
  you: string
  claude: string
}

const BORDERS = ['round', 'single', 'double', 'bold', 'dashed', 'classic']

const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback

const text = (value: unknown, fallback: string) => (typeof value === 'string' && value.trim() !== '' ? value.trim() : fallback)

export function settings(options: PluginOptions): Settings {
  const [you = 'You', claude = 'Claude'] = text(options.speakers, 'You|Claude').split('|').map(s => s.trim())
  return {
    look: pick(options.look, ['card', 'quiet', 'off'], 'card'),
    border: pick(options.border, BORDERS, 'round'),
    frameColor: text(options.frameColor, 'subtle'),
    accentColor: text(options.accentColor, 'suggestion'),
    paneBackground: text(options.paneBackground, 'transparent'),
    ids: options.ids !== false,
    autoCopy: pick(options.autoCopy, ['off', 'single', 'all'], 'off'),
    band: options.band === true,
    guide: options.guide !== false,
    confirm: options.confirm !== false,
    gapMs: typeof options.stackGapMs === 'number' && options.stackGapMs >= 0 ? options.stackGapMs : 350,
    keys: keys(options.keys),
    you,
    claude,
  }
}

// "reply=o prompt=p …": any subset; a key must be one lowercase letter, not
// a digit (those are the blocks'), and unique, else the defaults stand.
export function keys(value: unknown): Keys {
  const out = { ...DEFAULT_KEYS }
  if (typeof value !== 'string') return out
  for (const pair of value.split(/[\s,]+/)) {
    const [action, key = ''] = pair.split('=')
    if ((ACTIONS as readonly string[]).includes(action ?? '') && /^[a-z]$/.test(key)) out[action as keyof Keys] = key
  }
  return new Set(Object.values(out)).size === ACTIONS.length ? out : { ...DEFAULT_KEYS }
}
