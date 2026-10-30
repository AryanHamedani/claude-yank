import type { EngineInterface, RenderSurface } from 'claude-code'

import type { Selection } from './spec'

export type Put = { surface?: RenderSurface; gapMs: number; quiet?: boolean }

// One item is copied at once. Several go in last-first, a beat apart, so a
// clipboard manager keeps each as its own entry, in order, and the first is
// what pastes now.
export async function put($: EngineInterface, sel: Selection, { surface, gapMs, quiet }: Put): Promise<void> {
  const say = (text: string) => quiet || $.ui.toast(text)
  const order = [...sel.items].reverse()

  if (order.length === 1) {
    const done = await $.ui.copy({ text: order[0] ?? '', surface })
    say(done.isCopied ? `Copied ${sel.label}${size(sel.items)}` : `Could not copy: ${done.reason}`)
    return
  }

  order.forEach((text, i) =>
    $.clock.after(i * gapMs, () => {
      void $.ui.copy({ text, surface }).then(done => {
        if (!done.isCopied) say(`Could not copy: ${done.reason}`)
        else if (i === order.length - 1) say(`Copied ${sel.label}: ${order.length} items, the first on top`)
      })
    }),
  )
}

function size(items: readonly string[]): string {
  const lines = items.join('\n').split('\n').length
  return lines > 1 ? ` (${lines} lines)` : ''
}
