/**
 * AuthCard.tsx — Ornate carved wood auth card
 *
 * Visual stack (outside → in):
 *  1. Outer wrapper — top clearance for the hanging lantern
 *  2. Lantern — detailed SVG lantern with chain, peaked cap, glass panels,
 *               rivets, and animated flame; sways gently from the arch peak
 *  3. Walnut arch frame — dark mahogany, arched top, gold bevel
 *  4. Root/vine border — SVG overlay of gnarled roots tracing the full frame
 *     border with branches and leaves (z behind inner panel)
 *  5. Cherry plank inner panel — warm horizontal planks with lantern glow
 *  6. Title banner — recessed dark-wood header, gold title text
 *  7. Content / footer
 */

import React from 'react';
import type { ReactNode, CSSProperties } from 'react';

/* ── Width map ─────────────────────────────────────────────────────────────── */
const maxWidthMap = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg' };

/* ── Wood backgrounds ──────────────────────────────────────────────────────── */
const WALNUT_FRAME = [
  'repeating-linear-gradient(91.8deg,transparent 0,transparent 2px,rgba(5,1,0,.28) 2px,rgba(5,1,0,.28) 3px,transparent 3px,transparent 5px)',
  'repeating-linear-gradient(90.4deg,transparent 0,transparent 22px,rgba(8,2,0,.08) 22px,rgba(8,2,0,.08) 23px)',
  'linear-gradient(174deg,#3c1407 0%,#260b03 22%,#331008 46%,#1e0802 66%,#301007 86%,#3c1407 100%)',
].join(', ');

const CHERRY_PANEL = [
  'repeating-linear-gradient(0deg,transparent 0px,transparent 38px,rgba(45,12,2,.16) 38px,rgba(45,12,2,.16) 40px)',
  'repeating-linear-gradient(91.2deg,transparent 0,transparent 9px,rgba(65,18,4,.04) 9px,rgba(65,18,4,.04) 10px)',
  'radial-gradient(ellipse 60% 38% at 50% -2%,rgba(255,145,35,.24) 0%,rgba(190,70,15,.09) 55%,transparent 80%)',
  'radial-gradient(ellipse 22% 35% at 3% 38%,rgba(255,120,25,.09) 0%,transparent 65%)',
  'radial-gradient(ellipse 22% 35% at 97% 38%,rgba(255,120,25,.09) 0%,transparent 65%)',
  'linear-gradient(180deg,#7a3112 0%,#9e4018 20%,#b84d1c 42%,#a04218 65%,#7e3414 100%)',
].join(', ');

const BANNER_BG = [
  'repeating-linear-gradient(91.5deg,transparent 0,transparent 3px,rgba(6,1,0,.20) 3px,rgba(6,1,0,.20) 4px)',
  'linear-gradient(180deg,#2e0d04 0%,#220902 50%,#2c0c04 100%)',
].join(', ');

/* ══════════════════════════════════════════════════════════════════════════════
   LANTERN
   ══════════════════════════════════════════════════════════════════════════════ */
function Lantern() {
  const flicker1: CSSProperties = { animation: 'lanternGlow 2.6s ease-in-out infinite' };
  const flicker2: CSSProperties = { animation: 'lanternGlow 2.6s ease-in-out infinite 0.7s' };

  return (
    <div style={{
      position:        'absolute',
      top:             '-42px',
      left:            '50%',
      transform:       'translateX(-50%)',
      transformOrigin: 'top center',
      animation:       'lanternSway 5.5s ease-in-out infinite',
      pointerEvents:   'none',
      zIndex:          30,
      filter:          'drop-shadow(0 8px 28px rgba(255,140,28,.65)) drop-shadow(0 2px 8px rgba(0,0,0,.5))',
    }}>
      <svg width="62" height="138" viewBox="0 0 62 138" fill="none">

        {/* ── Hanging ring ────────────────────────────────────────────── */}
        <ellipse cx="31" cy="7" rx="7" ry="5"
          fill="none" stroke="#7c5214" strokeWidth="2.8"/>
        <ellipse cx="31" cy="7" rx="7" ry="5"
          fill="none" stroke="rgba(210,140,40,.45)" strokeWidth="1"/>

        {/* ── Chain links (3) ─────────────────────────────────────────── */}
        <rect x="28" y="11" width="6" height="9"  rx="2.5" fill="#7c5214"/>
        <rect x="28" y="11" width="6" height="9"  rx="2.5" fill="none"
              stroke="rgba(200,130,35,.4)" strokeWidth=".8"/>
        <rect x="27" y="21" width="8" height="7"  rx="2.5" fill="#6c4210"/>
        <rect x="28" y="29" width="6" height="8"  rx="2.5" fill="#7c5214"/>
        <rect x="28" y="29" width="6" height="8"  rx="2.5" fill="none"
              stroke="rgba(200,130,35,.4)" strokeWidth=".8"/>

        {/* ── Peaked roof (A-frame top cap) ───────────────────────────── */}
        {/* Peak */}
        <path d="M31 37 L14 52 L48 52 Z" fill="#562e0e"/>
        <path d="M31 37 L14 52" stroke="rgba(200,130,30,.55)" strokeWidth="1"/>
        <path d="M31 37 L48 52" stroke="rgba(200,130,30,.55)" strokeWidth="1"/>
        {/* Ridge cap at peak */}
        <rect x="28" y="36" width="6" height="4" rx="1.5" fill="#6a3810"/>
        {/* Lower brim */}
        <rect x="12" y="52" width="38" height="6" rx="2" fill="#5e3210"/>
        <rect x="12" y="52" width="38" height="6" rx="2" fill="none"
              stroke="rgba(210,140,35,.55)" strokeWidth=".9"/>
        {/* Rivet left */}
        <circle cx="15" cy="55" r="2.2" fill="#7a4215"/>
        <circle cx="15" cy="55" r="1"   fill="rgba(220,155,40,.5)"/>
        {/* Rivet right */}
        <circle cx="47" cy="55" r="2.2" fill="#7a4215"/>
        <circle cx="47" cy="55" r="1"   fill="rgba(220,155,40,.5)"/>

        {/* ── Corner posts ────────────────────────────────────────────── */}
        <rect x="12" y="58" width="5" height="62" rx="1.5" fill="#4c2808"/>
        <rect x="45" y="58" width="5" height="62" rx="1.5" fill="#4c2808"/>
        {/* Post highlight edge */}
        <line x1="14" y1="58" x2="14" y2="120" stroke="rgba(170,85,20,.30)" strokeWidth="1"/>
        <line x1="47" y1="58" x2="47" y2="120" stroke="rgba(170,85,20,.30)" strokeWidth="1"/>

        {/* ── Glass body background haze ──────────────────────────────── */}
        <rect x="17" y="58" width="28" height="62" fill="rgba(255,148,38,.07)" style={flicker1}/>

        {/* ── Horizontal mid-bar ──────────────────────────────────────── */}
        <rect x="12" y="89" width="38" height="4" rx="1" fill="#4c2808"/>
        <rect x="12" y="89" width="38" height="4" rx="1" fill="none"
              stroke="rgba(200,120,28,.35)" strokeWidth=".6"/>
        {/* Mid-bar rivets */}
        <circle cx="15" cy="91" r="1.6" fill="#6a3812"/>
        <circle cx="47" cy="91" r="1.6" fill="#6a3812"/>

        {/* ── Vertical centre bar ─────────────────────────────────────── */}
        <line x1="31" y1="58" x2="31" y2="120" stroke="#4c2808" strokeWidth="2.2"/>

        {/* ── Upper glass panel ───────────────────────────────────────── */}
        <rect x="17" y="58" width="28" height="29" fill="rgba(255,162,45,.14)"/>
        {/* Flame in upper panel */}
        <ellipse cx="31" cy="72" rx="9"  ry="13" fill="rgba(255,178,50,.70)" style={flicker1}/>
        <ellipse cx="31" cy="72" rx="5"  ry="7.5" fill="rgba(255,238,145,.95)" style={flicker2}/>
        <ellipse cx="31" cy="68" rx="2.5" ry="4"  fill="rgba(255,255,220,1)"  style={flicker1}/>

        {/* ── Lower glass panel ───────────────────────────────────────── */}
        <rect x="17" y="93" width="28" height="27" fill="rgba(255,148,38,.12)"/>
        {/* Residual lower glow */}
        <ellipse cx="31" cy="106" rx="8" ry="9" fill="rgba(255,148,38,.42)" style={flicker2}/>

        {/* ── Corner rivets (bottom of posts) ─────────────────────────── */}
        <circle cx="15" cy="119" r="2.2" fill="#7a4215"/>
        <circle cx="15" cy="119" r="1"   fill="rgba(220,155,40,.5)"/>
        <circle cx="47" cy="119" r="2.2" fill="#7a4215"/>
        <circle cx="47" cy="119" r="1"   fill="rgba(220,155,40,.5)"/>

        {/* ── Bottom cap brim ─────────────────────────────────────────── */}
        <rect x="12" y="120" width="38" height="6" rx="2" fill="#5e3210"/>
        <rect x="12" y="120" width="38" height="6" rx="2" fill="none"
              stroke="rgba(210,140,35,.50)" strokeWidth=".9"/>

        {/* ── Bottom finial ───────────────────────────────────────────── */}
        <path d="M18 126 L44 126 L42 133 L20 133 Z" fill="#4c2808"/>
        <path d="M23 133 L31 143 L39 133 Z"          fill="#5e3010"/>
        <circle cx="31" cy="144" r="3.8"              fill="#6e3e14"/>
        <circle cx="31" cy="144" r="1.6"              fill="rgba(220,155,40,.5)"/>

      </svg>

      {/* Ambient warm halo around the lantern body */}
      <div style={{
        position:     'absolute',
        top:          '42px',
        left:         '50%',
        transform:    'translateX(-50%)',
        width:        '100px',
        height:       '100px',
        borderRadius: '50%',
        background:   'radial-gradient(circle,rgba(255,155,35,.30) 0%,transparent 68%)',
        animation:    'lanternGlow 2.6s ease-in-out infinite',
        pointerEvents:'none',
      }}/>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   ROOT / VINE BORDER
   Absolutely positioned over the walnut frame, BEHIND the inner panel (z:0).
   Roots trace the full perimeter — arch top, both sides, bottom scrollwork.
   Each path is rendered with 4 stacked strokes (shadow → body → mid → highlight)
   for carved 3-D depth.
   ══════════════════════════════════════════════════════════════════════════════ */
function Root({ d, w = 1 }: { d: string; w?: number }) {
  const lc: CSSProperties['strokeLinecap'] = 'round';
  return (
    <>
      <path d={d} stroke="#0e0301" strokeWidth={11 * w} strokeLinecap={lc} fill="none"/>
      <path d={d} stroke="#3a1205" strokeWidth={7.5 * w} strokeLinecap={lc} fill="none"/>
      <path d={d} stroke="#622010" strokeWidth={3.8 * w} strokeLinecap={lc} fill="none"/>
      <path d={d} stroke="rgba(155,65,18,.42)" strokeWidth={1.2 * w} strokeLinecap={lc} fill="none"/>
    </>
  );
}

function RootLeaf({ cx, cy, rx = 14, ry = 7, angle = 0, shade = '#4a6018' }: {
  cx: number; cy: number; rx?: number; ry?: number; angle?: number; shade?: string;
}) {
  return (
    <g transform={`rotate(${angle},${cx},${cy})`}>
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={shade}/>
      {/* midrib */}
      <line x1={cx - rx * 0.7} y1={cy} x2={cx + rx * 0.7} y2={cy}
            stroke="rgba(30,50,5,.40)" strokeWidth="0.9"/>
    </g>
  );
}

function RootVineFrame() {
  return (
    <svg
      viewBox="0 0 480 700"
      preserveAspectRatio="none"
      width="100%" height="100%"
      style={{
        position:      'absolute',
        inset:         0,
        zIndex:        0,
        pointerEvents: 'none',
        overflow:      'visible',
      }}
    >
      {/* ── TOP ARCH ROOTS ─────────────────────────────────────────────────
          Trace the outer arch (M0 75 ... 480 75) with gnarled root strokes
          and branches growing downward into the frame corners.             */}

      {/* Primary arch root */}
      <Root d="M0 78 C65 18 155 3 240 1 C325 3 415 18 480 78" w={1.2}/>
      {/* Secondary arch (slightly inside) */}
      <Root d="M8 80 C70 24 158 11 240 9 C322 11 410 24 472 80" w={0.75}/>

      {/* Left arch branch curling downward */}
      <Root d="M58 30 C66 48 62 65 54 76" w={0.7}/>
      <Root d="M60 46 C72 50 80 58 78 70" w={0.45}/>
      {/* Leaves on left arch branch */}
      <RootLeaf cx={76} cy={68} rx={12} ry={6} angle={30} shade="#4e6820"/>
      <RootLeaf cx={64} cy={74} rx={10} ry={5} angle={15} shade="#567226"/>

      {/* Right arch branch curling downward */}
      <Root d="M422 30 C414 48 418 65 426 76" w={0.7}/>
      <Root d="M420 46 C408 50 400 58 402 70" w={0.45}/>
      <RootLeaf cx={404} cy={68} rx={12} ry={6} angle={-30} shade="#4e6820"/>
      <RootLeaf cx={416} cy={74} rx={10} ry={5} angle={-15} shade="#567226"/>

      {/* Mid-left arch branch */}
      <Root d="M162 6 C165 22 158 40 152 54" w={0.6}/>
      <Root d="M155 28 C145 34 138 42 140 54" w={0.4}/>
      <RootLeaf cx={148} cy={52} rx={11} ry={5} angle={20} shade="#527020"/>
      <RootLeaf cx={140} cy={56} rx={9}  ry={4} angle={-10} shade="#496018"/>

      {/* Mid-right arch branch */}
      <Root d="M318 6 C315 22 322 40 328 54" w={0.6}/>
      <Root d="M325 28 C335 34 342 42 340 54" w={0.4}/>
      <RootLeaf cx={332} cy={52} rx={11} ry={5} angle={-20} shade="#527020"/>
      <RootLeaf cx={340} cy={56} rx={9}  ry={4} angle={10}  shade="#496018"/>

      {/* Arch crown tuft (centre peak) */}
      <Root d="M240 1 C242 12 246 25 242 36" w={0.5}/>
      <Root d="M240 1 C238 12 234 25 238 36" w={0.5}/>
      <RootLeaf cx={240} cy={34} rx={9} ry={4} angle={0}  shade="#4e6818"/>
      <RootLeaf cx={246} cy={30} rx={7} ry={3} angle={25} shade="#577222"/>
      <RootLeaf cx={234} cy={30} rx={7} ry={3} angle={-25} shade="#577222"/>

      {/* ── LEFT SIDE ROOTS ────────────────────────────────────────────── */}

      {/* Main left root stem */}
      <Root d="M8 82 C15 152 5 218 10 295 C7 358 12 425 7 498 C4 552 9 588 5 635" w={1.1}/>
      {/* Secondary left root */}
      <Root d="M20 82 C24 168 15 235 18 315 C15 378 19 444 16 518" w={0.7}/>

      {/* Left branch 1 (y ≈ 145) */}
      <Root d="M8 148 C24 154 38 166 40 182 C38 198 26 204 16 206" w={0.65}/>
      <RootLeaf cx={36} cy={180} rx={13} ry={6} angle={25}  shade="#4a6318"/>
      <RootLeaf cx={40} cy={194} rx={11} ry={5} angle={-10} shade="#527020"/>
      <RootLeaf cx={20} cy={204} rx={9}  ry={4} angle={5}   shade="#496018"/>

      {/* Left branch 2 (y ≈ 262) */}
      <Root d="M10 265 C28 270 42 284 44 300 C42 316 28 322 18 324" w={0.65}/>
      <Root d="M38 285 C36 300 28 312 20 316" w={0.40}/>
      <RootLeaf cx={40} cy={298} rx={12} ry={5} angle={20}  shade="#4a6318"/>
      <RootLeaf cx={24} cy={320} rx={10} ry={4} angle={-5}  shade="#527020"/>

      {/* Left branch 3 (y ≈ 385) */}
      <Root d="M7 388 C22 393 34 406 32 422 C28 436 18 442 8 442" w={0.60}/>
      <RootLeaf cx={30} cy={418} rx={12} ry={5} angle={18} shade="#496018"/>
      <RootLeaf cx={12} cy={440} rx={9}  ry={4} angle={-8} shade="#4a6318"/>

      {/* Left branch 4 (y ≈ 505) */}
      <Root d="M9 508 C22 513 32 524 30 538" w={0.55}/>
      <RootLeaf cx={28} cy={535} rx={10} ry={4} angle={15} shade="#527020"/>

      {/* ── RIGHT SIDE ROOTS ──────────────────────────────────────── */}

      <Root d="M472 82 C465 152 475 218 470 295 C473 358 468 425 473 498 C476 552 471 588 475 635" w={1.1}/>
      <Root d="M460 82 C456 168 465 235 462 315 C465 378 461 444 464 518" w={0.7}/>

      {/* Right branch 1 */}
      <Root d="M472 148 C456 154 442 166 440 182 C442 198 454 204 464 206" w={0.65}/>
      <RootLeaf cx={444} cy={180} rx={13} ry={6} angle={-25} shade="#4a6318"/>
      <RootLeaf cx={440} cy={194} rx={11} ry={5} angle={10}  shade="#527020"/>
      <RootLeaf cx={460} cy={204} rx={9}  ry={4} angle={-5}  shade="#496018"/>

      {/* Right branch 2 */}
      <Root d="M470 265 C452 270 438 284 436 300 C438 316 452 322 462 324" w={0.65}/>
      <Root d="M442 285 C444 300 452 312 460 316" w={0.40}/>
      <RootLeaf cx={440} cy={298} rx={12} ry={5} angle={-20} shade="#4a6318"/>
      <RootLeaf cx={456} cy={320} rx={10} ry={4} angle={5}   shade="#527020"/>

      {/* Right branch 3 */}
      <Root d="M473 388 C458 393 446 406 448 422 C452 436 462 442 472 442" w={0.60}/>
      <RootLeaf cx={450} cy={418} rx={12} ry={5} angle={-18} shade="#496018"/>
      <RootLeaf cx={468} cy={440} rx={9}  ry={4} angle={8}   shade="#4a6318"/>

      {/* Right branch 4 */}
      <Root d="M471 508 C458 513 448 524 450 538" w={0.55}/>
      <RootLeaf cx={452} cy={535} rx={10} ry={4} angle={-15} shade="#527020"/>

      {/* ── BOTTOM SCROLLWORK ──────────────────────────────────────── */}

      {/* Left bottom scroll */}
      <Root d="M5 598 C20 614 15 638 6 652 C-2 668 8 688 24 684 C38 680 42 664 34 650" w={0.9}/>
      <Root d="M24 684 C36 688 45 680 44 668 C42 658 32 654 26 660" w={0.5}/>
      <RootLeaf cx={38} cy={668} rx={11} ry={5} angle={-30} shade="#4a6018"/>
      <RootLeaf cx={18} cy={686} rx={9}  ry={4} angle={10}  shade="#527020"/>

      {/* Right bottom scroll */}
      <Root d="M475 598 C460 614 465 638 474 652 C482 668 472 688 456 684 C442 680 438 664 446 650" w={0.9}/>
      <Root d="M456 684 C444 688 435 680 436 668 C438 658 448 654 454 660" w={0.5}/>
      <RootLeaf cx={442} cy={668} rx={11} ry={5} angle={30}  shade="#4a6018"/>
      <RootLeaf cx={462} cy={686} rx={9}  ry={4} angle={-10} shade="#527020"/>

      {/* Central bottom root cluster */}
      <Root d="M185 618 C202 634 218 652 240 660 C262 652 278 634 295 618" w={0.85}/>
      <Root d="M212 638 C224 650 236 662 240 666 C244 662 256 650 268 638" w={0.55}/>

      {/* Central bottom branches */}
      <Root d="M220 622 C212 636 206 652 210 668 C214 680 226 684 232 676" w={0.50}/>
      <Root d="M260 622 C268 636 274 652 270 668 C266 680 254 684 248 676" w={0.50}/>
      <RootLeaf cx={224} cy={672} rx={10} ry={4} angle={-20} shade="#496018"/>
      <RootLeaf cx={256} cy={672} rx={10} ry={4} angle={20}  shade="#496018"/>

      {/* Bottom-left outer root */}
      <Root d="M78 618 C94 626 108 642 104 660 C100 674 86 680 76 672" w={0.65}/>
      <RootLeaf cx={102} cy={658} rx={11} ry={5} angle={-15} shade="#4a6018"/>

      {/* Bottom-right outer root */}
      <Root d="M402 618 C386 626 372 642 376 660 C380 674 394 680 404 672" w={0.65}/>
      <RootLeaf cx={378} cy={658} rx={11} ry={5} angle={15} shade="#4a6018"/>

      {/* Tiny accent leaves scattered on side roots */}
      <RootLeaf cx={14}  cy={340} rx={8} ry={3} angle={-35} shade="#3e5812"/>
      <RootLeaf cx={466} cy={340} rx={8} ry={3} angle={35}  shade="#3e5812"/>
      <RootLeaf cx={12}  cy={460} rx={7} ry={3} angle={20}  shade="#486018"/>
      <RootLeaf cx={468} cy={460} rx={7} ry={3} angle={-20} shade="#486018"/>
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   PROPS + COMPONENT
   ══════════════════════════════════════════════════════════════════════════════ */
interface AuthCardProps {
  title:      string;
  subtitle?:  React.ReactNode;
  accentBar?: boolean;
  children:   ReactNode;
  footer?:    ReactNode;
  maxWidth?:  'sm' | 'md' | 'lg';
}

export function AuthCard({
  title,
  subtitle,
  accentBar,
  children,
  footer,
  maxWidth = 'md',
}: AuthCardProps) {
  return (
    <div
      className={`w-full ${maxWidthMap[maxWidth]}`}
      style={{ paddingTop: '38px', position: 'relative' }}
    >

      {/* ── Hanging lantern — outside/above the frame ──────────────── */}
      <Lantern />

      {/* ── Walnut arch frame ─────────────────────────────────────────
          overflow:visible → lantern and any decorations extend beyond. */}
      <div
        className="auth-wood-card"
        style={{
          background:   WALNUT_FRAME,
          borderRadius: '50% 50% 18px 18px / 72px 72px 18px 18px',
          padding:      '18px',
          position:     'relative',
          overflow:     'visible',
          boxShadow: [
            '0 40px 120px rgba(0,0,0,.82)',
            '0 18px 52px rgba(0,0,0,.62)',
            '0 6px 18px rgba(0,0,0,.45)',
            'inset 0 2px 0 rgba(222,152,38,.72)',
            'inset 0 1px 0 rgba(255,215,80,.38)',
            'inset 0 -3px 0 rgba(5,1,0,.82)',
            'inset 0 -1px 0 rgba(24,5,0,.60)',
            'inset 3px 0 8px rgba(160,80,15,.10)',
            'inset -3px 0 8px rgba(160,80,15,.10)',
          ].join(', '),
        }}
      >

        {/* Root/vine border — behind inner panel (z:0) */}
        <RootVineFrame />

        {/* ── Cherry plank inner panel (z:1, on top of roots) ───────── */}
        <div
          style={{
            background:   CHERRY_PANEL,
            borderRadius: '44% 44% 10px 10px / 52px 52px 10px 10px',
            position:     'relative',
            zIndex:        1,
            overflow:     'hidden',
            boxShadow: [
              'inset 0 4px 16px rgba(40,10,2,.42)',
              'inset 0 2px 5px rgba(40,10,2,.22)',
              'inset 0 -2px 8px rgba(20,5,0,.30)',
              '0 2px 0 rgba(218,142,32,.22)',
            ].join(', '),
          }}
        >

          {/* ── Title banner ──────────────────────────────────────────── */}
          <div
            style={{
              background:   BANNER_BG,
              padding:      '24px 40px 18px',
              textAlign:    'center',
              borderBottom: '1px solid rgba(190,105,25,.45)',
              boxShadow: [
                '0 4px 22px rgba(0,0,0,.48)',
                'inset 0 1px 0 rgba(228,158,42,.48)',
                'inset 0 -1px 0 rgba(8,2,0,.52)',
              ].join(', '),
            }}
          >
            <h1
              style={{
                fontSize:      '2.05rem',
                fontWeight:    700,
                color:         '#e8bd58',
                letterSpacing: '0.045em',
                lineHeight:    1.2,
                textShadow: [
                  '0 2px 12px rgba(0,0,0,.72)',
                  '0 1px 0 rgba(255,228,105,.28)',
                  '0 -1px 0 rgba(15,5,0,.40)',
                ].join(', '),
              }}
            >
              {title}
            </h1>

            {accentBar && (
              <div style={{
                width:        '52px',
                height:       '2px',
                margin:       '10px auto 0',
                borderRadius: '2px',
                background:   'linear-gradient(90deg,transparent,rgba(215,145,35,.82),transparent)',
              }}/>
            )}

            {subtitle && (
              <p style={{
                fontSize:   '0.9375rem',
                color:      'rgba(232,188,112,.80)',
                marginTop:  accentBar ? '10px' : '8px',
                lineHeight: 1.45,
                textShadow: '0 1px 5px rgba(0,0,0,.52)',
              }}>
                {subtitle}
              </p>
            )}
          </div>

          {/* ── Form content ──────────────────────────────────────────── */}
          <div style={{ padding: '32px 40px 36px' }}>
            {children}
          </div>

          {/* ── Footer ────────────────────────────────────────────────── */}
          {footer && (
            <div style={{
              padding:    '18px 40px 24px',
              borderTop:  '1px solid rgba(100,40,8,.40)',
              textAlign:  'center',
              fontSize:   '0.9375rem',
              color:      'rgba(232,188,112,.74)',
              background: 'rgba(0,0,0,.12)',
              textShadow: '0 1px 3px rgba(0,0,0,.46)',
            }}>
              {footer}
            </div>
          )}

        </div>{/* /cherry panel */}
      </div>{/* /walnut frame */}
    </div>
  );
}
