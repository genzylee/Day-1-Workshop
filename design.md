# Snip Design System

Source of truth for future styling: a quiet dark canvas, warm full-width light,
centered typography, and a rounded composer. Borrow visual principles only;
retain Snip's identity and copy. No new dependencies or behavior changes.

## Tokens

| Token | Value |
| --- | --- |
| Background | `--background: #101013` |
| Surfaces | `--surface: #1c1b20`; `--surface-raised: #25232a` |
| Text / muted | `--text: #faf7f5`; `--muted: #b9b1b8` |
| Accent / error | `--accent: #ffb7a5`; `--danger: #ffaaaa` |
| Accent gradient | `linear-gradient(110deg, #ed867a, #df88a0 48%, #efad7c)` |
| Font stack | Existing DM Sans, sans-serif; Courier New, monospace for codes |
| Type scale | Hero 64px (48px mobile), subline 18px (16px mobile), section 18px, input 16px (14px mobile), body 14px, labels 12-13px. Letter spacing 0. |
| Spacing | 8, 12, 16, 20, 24, 28, 32, 40, 48, 64, 88px |
| Radii | Cards 24px; composer 32px; notices 16px; controls 999px |
| Borders | 1px `#ffffff1f`; composer `#ffffff30`; focused composer `#df88a0` |
| Shadows | `0 20px 60px #00000038`; composer adds `0 0 36px #df88a00c` |
| Focus | 2px accent outline, offset 4px; preserve visible keyboard focus |

## Glow

`body::before` is a fixed band: `top: 0; left: 0; right: 0; height: 640px;
pointer-events: none; z-index: -1`. Body uses `isolation: isolate` so it sits
behind content but above the root background. Never put the glow inside main.

Layer a vertical fade (`#101013a6` at 0%, `#10101352` at 30%, background at 100%)
over a 110-degree gradient: `#39202b` 0%, `#703c48` 42%, `#754632` 73%,
`#3b2727` 100%. This creates a continuous coral/pink/orange band across wide
viewports, fading into the dark page rather than discrete decorative blobs.

## Element Mapping

- Header: centered Snip identity and muted subline; no hero card. Main max-width
  1000px, desktop top padding 88px; mobile top padding 56px.
- URL form: max-width 800px chat-style composer, minimum 88px high, integrated
  light pill action. Stack the action below the input at 540px and narrower.
  Keep the original label and section heading accessible.
- Result: warm subtle tint, accent rule, bold wrapping short link.
- Errors: translucent red tint, subtle border, readable pink text; preserve alerts.
- Links table: one 24px-radius surface with 28px padding (20px/12px mobile),
  understated separators, muted headers, and tabular hit counts. Do not frame
  each row or nest cards. Preserve empty/loading states and refresh behavior.
- Footer: centered, muted 12px. Keep content and controls usable at narrow widths.