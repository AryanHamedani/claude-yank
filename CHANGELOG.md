# Changelog

All notable changes to yank are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/).

## [0.3.1] - 2026-10-31

First public release.

### Added
- Block cards: every fenced block Claude writes for you is framed and captioned with its key, language and title.
- The palette (`/yank`, or `ctrl+x y` after `/yank keys`): one key copies a block, the reply, the prompt, both, every block, the commands Claude ran or the whole conversation; `h`/`l` walk the turns.
- The yank grammar for ranges, in the palette and as `/yank <word>`: `2`, `4.2`, `o2-5`, `p3`, `x1-3`, `b*`, `c`, `t`, with a live preview of what a range copies.
- Faint turn numbers beside prompts.
- Multi-item copies stacked last-first so clipboard managers keep each item, the first on top.
- Optional auto-copy (`single`, `all`) and an optional band of blocks above the prompt.
- A system-prompt guide that asks Claude to fence and title everything meant to be pasted.
- 13 settings in `/config`, and the `customize-yank` skill so an agent can change them for you.
