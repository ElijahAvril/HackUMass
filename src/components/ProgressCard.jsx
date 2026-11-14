// ---------------------------------------------------------------------------
// PROGRESS CARD
// ---------------------------------------------------------------------------
// Shows the same number three ways on purpose:
//   1. a big numeral  ("3 of 10 items")   - instant glance
//   2. a row of tick boxes                - the paper-checklist metaphor
//   3. a real progress bar with a %       - precise, and the thing screen
//                                           readers and assistive tech read
// Redundancy is the point: a user who can't judge a bar's fill reads the
// number; a user who skims reads the bar.
//
// The <progress>-style bar uses role="progressbar" with aria-valuenow so it is
// announced as "37 percent" rather than as a meaningless div.
// ---------------------------------------------------------------------------
import React from 'react'
import { Icon } from './Icon.jsx'
import './Panels.css'

export function ProgressCard({ progress, title }) {
  const { packed, total, remaining, percent } = progress
  // Cap the tick-box row so a 60-item list doesn't blow up the layout; past
  // the cap the numeral and bar carry the information on their own.
  const MAX_TICKS = 12
  const ticks = Array.from({ length: Math.min(total, MAX_TICKS) })

  return (
    <section className="panel card" aria-labelledby="progress-heading">
      <h2 className="panel__title" id="progress-heading">Packed so far</h2>

      <p className="progress__headline">
        <strong className="progress__big">{packed}</strong>
        <span className="progress__of">of {total} item{total === 1 ? '' : 's'}</span>
      </p>

      {/* Decorative tick row - aria-hidden because the bar below already
          conveys the same value, and duplicate announcements are noise. */}
      <div className="progress__ticks" aria-hidden="true">
        {ticks.map((_, i) => (
          <span key={i} className={`progress__tick ${i < packed ? 'is-on' : ''}`}>
            {i < packed ? <Icon name="check" size={13} strokeWidth={3} /> : null}
          </span>
        ))}
        {total > MAX_TICKS ? <span className="progress__more">+{total - MAX_TICKS}</span> : null}
      </div>

      <div
        className="progress__bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={`${packed} of ${total} items packed, ${percent} percent`}
        aria-label={title ? `Packing progress for ${title}` : 'Packing progress'}
      >
        <span className="progress__fill" style={{ width: `${percent}%` }} />
      </div>

      <p className="progress__caption">
        {total === 0
          ? 'No items on this list yet.'
          : remaining === 0
            ? 'All packed. Nothing left.'
            : `${remaining} still to pack`}
      </p>
    </section>
  )
}
