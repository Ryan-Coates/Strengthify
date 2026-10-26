# 8-week commitments

Two opt-in commitments, each started from a start date (defaults to next Monday).
Both are local-first, included in JSON backups and synced to the cloud when signed in.

## 1. Composible Chaos

Tagline: **Flexible workouts. Daily habits. Your rhythm.**

- 8 weeks, 5 workout types x 2 blocks = 10 blocks per week, 80 in total.
- Two checkboxes per day: **Cardio** and **Nutrition** (225g protein + calories tracked).
- Overall progress counts 192 check-offs: 80 workouts and 112 daily habits.
  Separate weekly bars show 10 workouts and 14 habits.
- The weekly trophy/confetti celebration requires all 10 workouts and all 14 habits.
- Existing commitments keep workout progress and dates; new habits start unchecked.
  Previously celebrated weeks keep their saved marker and will not replay.
- Fun check-off styling: striped confetti block, playful tilt, star and pop animation.
- Source: [web/src/routine.js](web/src/routine.js).

## 2. Glow-Up

Tagline: **Soft life. Strong habits. Absolutely glowing.**

Glam, girly pink-and-gold theme with heart ticks. 8 weeks, tracked day by day.

### Daily non-negotiables (tick per day)

- 5:30am wake up (Monday to Friday only; not required, and not counted, at weekends)
- 2 litres of water
- 10,000 steps
- 100g+ protein
- 30 minute homework
- Morning face care and teeth
- Meditation
- Journaling

### Weekly movement goals (tick per session, per week)

- 2x runs
- 3x weight sessions
- 5x abs sessions

### Little things that make life lovely (tick once per week)

- Tuesday date night
- Friday craft night
- Me and Dylan time

Progress: overall bar, weekly bar and a daily bar. A full day or week shows a
sparkle and a toast. Weekly total is 67 goals (54 daily + 13 weekly); overall 536.
Source: [web/src/glowup.js](web/src/glowup.js).

## "I can't tick anything" is expected before a start date

Check-offs are locked until the period has started: Composible Chaos workouts by week
and habits by day, Glow-Up by day (past days stay editable, future days stay locked)
and by week for weekly goals. When locked, each screen shows a banner that says "Not live yet",
when it unlocks, and that nothing is broken. Locked cards also get a dashed outline
and the boxes are disabled with a matching accessible label.

Example: opting in on Sunday 25 Oct 2026 with the default start of Monday 26 Oct
shows everything locked until Monday.
