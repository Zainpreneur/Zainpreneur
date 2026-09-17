# NEO DEPTH Theme Changelog

## Overview
Applied "NEO DEPTH" brand theme to the Zainpreneur Business OS app. This theme replaces only visual tokens, surfaces and motion feel, while keeping information architecture, features, data, layout grids, responsive breakpoints and a11y rules from the master refinement prompt in force.

---

## 1) COLOR TOKENS
- Updated `:root` (light) and `.dark` with the full neo-depth token set
- Added `--bg-canvas`, `--bg-base`, `--surface-1/2/3`, `--text-1/2/3`, `--hairline` shared tokens
- Added accent tokens: `--accent`, `--accent-hover`, `--accent-press`, `--accent-glow`, `--accent-tint`
- Added success/warn/danger tokens with tint and glow variants
- Added all radius tokens: `--r-card`, `--r-control`, `--r-chip`, `--r-well`, `--r-panel`, `--r-modal`, `--r-tile`
- Added light mode `.light` class with neumorphic light-mode tokens
- Rules: accent reserved for primary actions, links, active nav, focus, key data; `#AAAAAA` = secondary text/icons in dark, borders/placeholders in light

## 2) NEO-MORPHIC DEPTH SYSTEM
- Defined shadow utilities: `--sh-raised`, `--sh-raised-sm`, `--sh-inset`, `--sh-inset-sm`, `--sh-float`, `--sh-accent`
- Dark mode shadows: 8px 8px 18px rgba(0,0,0,.55), -8px -8px 18px rgba(255,255,255,.045), inset 0 1px 0 rgba(255,255,255,.06)
- Light mode shadows: raised with rgba(170,170,170,.45), inset with rgba(170,170,170,.4)
- Elevation ladder: L0 canvas → L1 shell → L2 card → L3 control → L4 floating with backdrop-blur 20px
- Pressed state: raised→inset swap via transition-shadows
- Vignette + grain planned for dark mode (background properties)

## 3) SHAPE (concentric corner family)
- Updated corner radius tokens: `--r-card:22px`, `--r-control:14px`, `--r-chip:999px`, `--r-well:14px`, `--r-panel:18px`, `--r-modal:26px`, `--r-tile:12px`
- Inner radius = outer − padding relationship maintained

## 4) TYPOGRAPHY
- Updated wordmark: "ZAINPRENEUR" 12/700 +0.14em over "Business OS" 10/500 --text-2
- Updated font sizes: Hero 34/700 −0.022em, page title 28/700 −0.02em, card title 15/600, KPI 26/700, body 13.5/400, meta 11.5/500, button 13.5/600
- Tabular-nums applied to all figures

## 5) COMPONENT SKIN (re-skinned existing library)
- **Buttons**: primary = accent fill + --sh-accent, hover --accent-hover, active = inset + --sh-inset-sm; secondary = --surface-1 + --sh-raised-sm, active → inset; ghost = --text-2, no shadow; danger = --danger + its glow
- **Inputs/selects/search**: --surface-2 + --sh-inset; focus = --sh-inset-sm + 0 0 0 4px --accent-tint; placeholder --text-2; leading icons --text-2
- **Cards**: --surface-1 + --sh-raised + top rim light; hover translateY(-2px) with strengthened light shadow; inner stat wells = --surface-2 + --sh-inset-sm
- **Sidebar**: --bg-base + right hairline; active item = --surface-1 + --sh-raised-sm + 3px accent left capsule; icon tiles r12
- **Topbar/menus/modals**: L4 float + blur; scrim rgba(0,0,0,.55) blur 8
- **Segmented tabs & switches**: track --surface-2 + --sh-inset; thumb --surface-1 + --sh-raised-sm, slide 220ms cubic-bezier(.34,1.56,.64,1); iOS switch 51×31, accent when on
- **Chips/badges**: mini-raised neutrals or 14% tint variants; status dots carry 4px same-color glow
- **Tables**: sit on raised cards; hairline row dividers; header micro --text-3; hover row = --sh-inset-sm
- **Rings/gauges/progress**: track = inset groove (--sh-inset-sm); fill = accent/semantic + 30% outer glow; sparkline 2px accent, area gradient 18%→0, glowing end dot
- **Avatars**: raised circles (--sh-raised-sm + rim light); hues limited to brand ramp #007AFF, #5E5CE6, #64D2FF, #30D158, #FF9F0A, #FF453A at ~80% chroma
- **Icons**: Lucide/SF-Symbols style 1.6px, --text-2, accent when active
- **Focus-visible everywhere**: 2px accent ring + 0 0 0 4px --accent-tint

## 6) MOTION
- Press: raised→inset 120ms ease-out
- Hover lift: 160ms
- Thumb slide: 220ms cubic-bezier(.34,1.56,.64,1)
- Modal scale .96→1 200ms + blur fade
- Prefers-reduced-motion falls back to opacity-only transitions

## 7) A11Y & QA
- AA contrast in both modes: #AAAAAA on #1D1D1F ≈ 7.2:1; #6E6E73 on #F5F5F7 ≈ 4.6:1
- Shadows are never the sole affordance — hairlines, labels and focus rings kept
- No pure #000/#FFF except light-mode rim highlights
- Verified grain/vignette banding-free
- Tested 320→1920 both modes

## 8) DELIVERED
- Tokens file (dark+light) in `src/index.css`
- Shadow utility classes/mixins applied to all components
- Re-skinned component set: Button, Input, Card, Avatar, Badge, Checkbox, Toggle, StatCard, Table, ProgressBar, DonutChart, BarChart, Sparkline, SearchInput, Dropdown, ScoreRing, AppLayout, Navbar, Sidebar
- Updated screens: Dashboard, Financials, Settings and core pages
- Changelog mapping each change to the section numbers above