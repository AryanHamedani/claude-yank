---
name: customize-yank
description: Changes the yank mod's look and behaviour by editing its plugin options - card frames, borders and colors, matching the terminal theme, the palette background, prompt numbers, auto-copy, the band above the prompt, the copy toast, the fencing note in Claude's prompt, palette keys, speaker names, clipboard-manager timing, and the ctrl+x y shortcut. Use when the person wants to restyle, recolor, theme, quiet, turn on or off, or rebind any part of yank, says yank does not match their terminal, or says their clipboard manager misses copies.
---

# Customize yank

yank reads every setting from its plugin options, and reloads with new values as soon as they change. No code change is ever needed.

## Where the settings live

- `/config` lists each yank setting as a row: the simplest route for the person.
- The settings file: `settings.json` in Claude Code's config folder (`$CLAUDE_CONFIG_DIR`, else `~/.claude`), under `pluginConfigs`, in the entry whose key starts with `yank@`, inside `options`. With no such entry, add `yank@<marketplace>`, the marketplace `claude plugin list` shows yank under (`claude-yank` when installed from GitHub). Copy the file to `settings.json.bak-<timestamp>` first, and change only the keys asked for.

```json
"pluginConfigs": {
  "yank@claude-yank": {
    "options": { "look": "quiet", "ids": false, "autoCopy": "single" }
  }
}
```

## The settings

| Key | Values | Default | What it changes |
|---|---|---|---|
| `look` | `card`, `quiet`, `off` | `card` | card: a frame captioned with the block's key; quiet: the caption line only; off: Claude Code's own drawing |
| `border` | `round`, `single`, `double`, `bold`, `dashed`, `classic` | `round` | the card's line |
| `frameColor` | a theme key or `#rrggbb` | `subtle` | the card's line color |
| `accentColor` | a theme key or `#rrggbb` | `suggestion` | block keys and range words |
| `paneBackground` | `transparent`, a theme key or `#rrggbb` | `transparent` | what the palette paints behind itself; transparent shows the terminal's own background |
| `ids` | `true`, `false` | `true` | the faint `#n` beside each prompt |
| `autoCopy` | `off`, `single`, `all` | `off` | copy unasked: a reply's only block, or all its blocks |
| `band` | `true`, `false` | `false` | the latest reply's blocks in a row above the prompt; a bare digit in an empty prompt copies one |
| `confirm` | `true`, `false` | `true` | the toast after a copy |
| `guide` | `true`, `false` | `true` | the note in Claude's system prompt that makes it fence and title what the person will paste |
| `keys` | any subset of `action=letter` pairs, space or comma separated | `reply=o prompt=p both=x blocks=b commands=c all=t range=r prev=h next=l` | the palette's keys |
| `speakers` | `<person's name>\|<Claude's name>` | `You\|Claude` | the two names in a copied exchange or transcript |
| `stackGapMs` | a number, 0 or more | `350` | the pause between stacked copies; raise it when a clipboard manager keeps only some of them |

Rules the values follow, since yank never reports a bad one:

- Write booleans as `true`/`false` and `stackGapMs` as a number, never as strings: `"false"` leaves `ids`, `guide` and `confirm` on, and `"true"` leaves `band` off.
- A value outside a key's list returns that key to its default, silently. Use only the listed values.
- `keys` is merged over the defaults, and the merged set must give each action its own letter (a to z; digits belong to blocks). One clash throws the whole remap away: `reply=p` alone does nothing, as `prompt` holds `p`; write `reply=p prompt=o`.
- Colors are passed through as written: spell theme keys exactly (`promptBorder`, not `prompt-border`).

Common theme keys, which follow the person's Claude Code theme: `text`, `subtle`, `inactive`, `suggestion`, `claude`, `permission`, `promptBorder`, `success`, `warning`, `error`, `planMode`, `autoAccept`, `remember`, `ide`, `merged`, `bashBorder`.

After a change, ask the person to look (open `/yank`, or see the next reply's cards): a value yank could not use shows nothing but the default.

## Match the terminal's theme

Claude Code draws the palette's frame itself: its hotkey letters and the pane's edge in the theme's `suggestion` color, lines in `subtle`. yank's defaults are those same keys, so yank always matches Claude Code. Whether yank matches the terminal is therefore whether **Claude Code's theme** matches it. Never answer a mismatch with hex colors in yank's options while the theme differs: the pane then mixes the two.

1. If `frameColor`, `accentColor` or `paneBackground` hold hex values, ask whether they are a deliberate contrast. If not, remove them, so yank follows the theme again.
2. Read the terminal's palette from its config; do not guess it from the theme's name. A config often pulls its palette from another file (`config-file =`, `include`, `import`, `theme =`): follow it.
   - Linux: `~/.config/ghostty/config`, `~/.config/alacritty/*.toml`, `~/.config/kitty/*.conf`, `~/.config/foot/foot.ini`, `~/.config/wezterm/*.lua`; desktop theme folders such as Omarchy's `~/.local/state/omarchy/current/theme/`.
   - macOS: `~/Library/Application Support/com.mitchellh.ghostty/config`, iTerm2's profile (Settings, Profiles, Colors, or `~/Library/Preferences/com.googlecode.iterm2.plist`), Terminal.app's profile, and the Linux paths above for alacritty, kitty and wezterm.
   - Windows: Windows Terminal's `settings.json` under `%LOCALAPPDATA%\Packages\Microsoft.WindowsTerminal_*\LocalState\` (its `schemes`), and wezterm or alacritty under `%APPDATA%`.
3. Compare it with Claude Code's active theme: `/theme` names it; custom themes are JSON files in the config folder's `themes/`. If the theme already uses the terminal's colors, yank matches: say so.
4. If not, offer a custom Claude Code theme made from the terminal's palette, then have the person pick it in `/theme`. The file is `themes/<name>.json`:

   ```json
   {
     "name": "My terminal",
     "base": "dark",
     "overrides": { "suggestion": "#449dab", "claude": "#7aa2f7", "promptBorder": "#7aa2f7", "subtle": "#414868", "text": "#a9b1d6" }
   }
   ```

   `base` is `dark` or `light`, after the terminal's background; `overrides` takes the theme keys above, each a hex color from the palette (the accent for `suggestion`, `claude` and `promptBorder`; the muted line color, often color 8, for `subtle`; the foreground for `text`). Everything, yank included, then matches.

Hex values in yank's own color options are for a deliberate contrast only: a person who wants the cards to stand out in a color of their choosing.

## Presets people ask for

- Quieter: `look: "quiet"`, `ids: false`.
- Claude Code's own look, keys only: `look: "off"`; the palette and `/yank` still work.
- Hands-free: `autoCopy: "single"`.
- Vim-minded palette: `keys: "prev=k next=j"`.
- Clipboard manager drops items: `stackGapMs: 700`.

## The shortcut

`/yank keys` binds `ctrl+x y` to the palette in the config folder's `keybindings.json`, keeping a `keybindings.json.bak-yank` copy. It declines when the file is not plain JSON (comments) or `ctrl+x y` is taken in the `Chat` context; then add a free chord to that file's `Chat` bindings by hand: `"<chord>": "command:yank"`.
