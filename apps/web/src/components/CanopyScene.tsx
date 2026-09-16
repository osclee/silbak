import styles from "./CanopyScene.module.css";

/**
 * Purely decorative (`aria-hidden`) jungle backdrop, mounted once at the app
 * root behind the nav and every route.
 *
 * ## Why this is no longer an SVG `<pattern>`
 *
 * The previous revision drew one 220px tile — two trees, a cloud, a vine —
 * inside `<defs><pattern>` and stamped it across a full-page rect. That
 * approach had three defects, all of which this rewrite exists to fix:
 *
 * - **The animations never ran.** Content inside `<defs>` is not in the
 *   render tree; it's referenced, rasterized once, and stamped. The CSS
 *   animations were registered (`getAnimations()` reported them `running`)
 *   but the computed transform stayed `none` and the mote sat frozen on its
 *   0% keyframe forever. Every "the canopy sways" claim was true of the
 *   source and false of the screen. Anything that must move has to live in
 *   the rendered document, so nothing in this file is inside `<defs>`.
 * - **The tile height had to be measured, and the measurement didn't land.**
 *   A `ResizeObserver` fed the page height into the pattern's `height` so a
 *   single tall tree would span the page exactly once. In practice the
 *   pattern stayed at its initial 800 against a ~1040px page, so the tile
 *   restarted mid-page: a hard ground line across the middle with a cropped
 *   second row of treetops under it.
 * - **It read as wallpaper.** One tile, repeated ~6x across at identical
 *   phase and identical art.
 *
 * ## The replacement: height-agnostic layers, no tiling, no measurement
 *
 * Everything here is positioned in *percentages* or anchored to an edge, so
 * the scene covers whatever height the current route happens to have with no
 * measurement code at all:
 *
 * - **Trunks are vertical**, so `top: 0; bottom: 0` covers any page height
 *   natively — a trunk is the one forest element that never needs tiling.
 * - **Canopy and understory are edge-anchored bands** (top and bottom), with
 *   `preserveAspectRatio` slicing rather than stretching, so shapes keep
 *   their proportions on any width.
 * - **Boughs and motes are placed at `top: X%`**, so they redistribute down
 *   a long archive page and a short daily page alike.
 *
 * ## Composition: a clearing, not a wall
 *
 * DESIGN.md §6 requires `--bark` cards to stay legible against the scene, so
 * density is deliberately pushed to the left/right margins and the top/bottom
 * bands, leaving the center column (the board is 560px, centered) light. The
 * scene frames the content like a clearing seen from inside the treeline —
 * which is also what sells "standing in the jungle" rather than "looking at a
 * picture of trees."
 *
 * ## Depth
 *
 * Atmospheric perspective is carried by `color-mix()` blends of the existing
 * tokens — far foliage washes toward `--paper`, near foliage sits at full
 * `--bark` with `--forest` shading. These are blends, not new tokens; the
 * palette is unchanged and `--banana` stays out of the scene entirely, per
 * §6's reservation.
 *
 * ## Motion: one wind field
 *
 * Every primary motion here runs on a single shared gust profile (the
 * `gust*` keyframes in the stylesheet) at one period, and an element's
 * *phase* is a function of where it sits on the page: `gustDelay(u)` returns
 * a negative `animation-delay` that puts an element at horizontal fraction
 * `u` (0 = left edge, 1 = right) `u * SWEEP` seconds behind the gust front,
 * so a gust visibly rolls across the scene left to right rather than every
 * element pulsing in private. Amplitude scales with depth and size; near,
 * large foliage moves most.
 *
 * Trunks, both bough planes and the canopy band additionally share a
 * whole-forest lean (see `.lean` in the stylesheet) so that a bough's branch
 * root stays welded to its trunk while the tree it is on moves — that weld is
 * the point of the whole model, and the thing the first cut lacked.
 */

/** Seconds per gust cycle. Passed to CSS as `--gust-period` so both sides share it. */
const GUST_PERIOD = 16;
/** Seconds the gust front takes to cross the page from left edge to right. */
const SWEEP = 2.6;

/**
 * Negative `animation-delay` placing an element `lag` seconds behind the gust
 * front, where `lag` grows with horizontal position (`u`, 0–1) plus any extra
 * (depth, per-element jitter). Negative so the loop is mid-cycle at first
 * paint — a positive delay holds the element at its un-animated pose and then
 * snaps it to the 0% keyframe, which is exactly the pop this rewrite removes.
 */
function gustDelay(u: number, extra = 0): string {
  const lag = Math.min(Math.max(u, 0), 1) * SWEEP + extra;
  return `${(-(GUST_PERIOD - lag)).toFixed(2)}s`;
}

/** Negative delay somewhere inside a flutter cycle, so flutters start scattered. */
function flutterDelay(rand: () => number, period: number): string {
  return `${(-rand() * period).toFixed(2)}s`;
}

/**
 * Tiny LCG so generated foliage is stable across re-renders (no reshuffle).
 *
 * The seed is hash-mixed and the stream warmed up before first use, which is
 * not optional bookkeeping: a bare LCG's *first* output is very nearly a
 * linear function of its seed, so callers seeded a fixed distance apart
 * (`900 + i * 17`, or trunks at 11/22/33…) get first values marching in
 * lockstep. That shipped once — the 16 motes seeded this way landed at
 * x = 57.8%, 58.4%, 59.0%, … a perfectly linear ramp, bunching every one of
 * them into a single narrow stripe instead of scattering across the page.
 */
function rng(seed: number) {
  let s = seed >>> 0;
  // Mix the seed so nearby values diverge immediately (xorshift-style avalanche).
  s ^= s << 13;
  s = s >>> 0;
  s ^= s >> 17;
  s ^= s << 5;
  s = s >>> 0;
  const next = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  next();
  next();
  next();
  return next;
}

/**
 * A blocky mass of leaves. Rows follow a sine profile so the silhouette
 * bulges in the middle and tapers at both ends — a round foliage mass on the
 * broadleaf note §6 settled on, never the stacked-pyramid conifer.
 */
function LeafMass({
  cx,
  cy,
  rx,
  ry,
  seed,
  fill,
  shade,
  rows = 7,
}: {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  seed: number;
  fill: string;
  shade?: string;
  rows?: number;
}) {
  const rand = rng(seed);
  const step = (ry * 2) / rows;
  const out = [];
  for (let i = 0; i < rows; i++) {
    const t = (i + 0.5) / rows;
    const profile = Math.sin(t * Math.PI) ** 0.65;
    const half = rx * profile * (0.82 + rand() * 0.34);
    const jitter = (rand() - 0.5) * rx * 0.22;
    const x = cx - half + jitter;
    const y = cy - ry + i * step;
    const w = half * 2;
    out.push(<rect key={`f${i}`} x={x} y={y} width={w} height={step * 1.12} fill={fill} />);
    // A shading strip on one edge gives the block pixel dimensionality.
    if (shade && i > 0 && i < rows - 1 && rand() > 0.35) {
      out.push(
        <rect
          key={`s${i}`}
          x={x + w * 0.74}
          y={y}
          width={w * 0.26}
          height={step * 1.12}
          fill={shade}
          opacity={0.28}
        />,
      );
    }
  }
  return <>{out}</>;
}

/** A pinnate frond: leaflets shrinking toward the tip, drawn up the +Y axis. */
function Frond({
  x,
  y,
  len,
  angle,
  fill,
  shade,
  seed,
}: {
  x: number;
  y: number;
  len: number;
  angle: number;
  fill: string;
  shade?: string;
  seed: number;
}) {
  const rand = rng(seed);
  const segs = 10;
  const segH = len / segs;
  const parts = [];
  for (let i = 0; i < segs; i++) {
    const t = i / (segs - 1);
    // Widest a third of the way up, tapering to a point at the tip.
    const half = len * 0.17 * Math.sin((1 - t) * 2.1 + 0.35) * (0.88 + rand() * 0.24);
    const yy = -t * len;
    parts.push(<rect key={`l${i}`} x={-half} y={yy} width={half * 2} height={segH * 1.15} fill={fill} />);
    if (shade && i % 2 === 0) {
      parts.push(
        <rect key={`d${i}`} x={half * 0.15} y={yy} width={half * 0.85} height={segH * 1.15} fill={shade} opacity={0.22} />,
      );
    }
  }
  // Gust lean grows with length (a taller frond has more sail); the flutter
  // is a fraction of a degree at a short period no two fronds share.
  const amp = 1.8 + len / 90;
  const flutter = 0.6 + rand() * 0.5;
  const flutterPeriod = 2.4 + rand() * 1.5;
  return (
    // Outer group holds the SVG placement transform; the inner groups own the
    // CSS animation transforms. Nesting keeps them from overwriting each
    // other — a CSS `transform` on an element replaces its `transform`
    // attribute outright rather than composing with it, and two animations
    // on one element don't add, which is why gust and flutter are two groups.
    <g transform={`translate(${x} ${y}) rotate(${angle})`}>
      <g
        className={styles.frondGust}
        style={{ animationDelay: gustDelay(x / 1200, rand() * 0.5), ["--amp" as string]: `${amp.toFixed(2)}deg` }}
      >
        <g
          className={styles.frondFlutter}
          style={{
            animationDelay: flutterDelay(rand, flutterPeriod),
            animationDuration: `${flutterPeriod.toFixed(2)}s`,
            ["--flutter" as string]: `${flutter.toFixed(2)}deg`,
          }}
        >
          {parts}
        </g>
      </g>
    </g>
  );
}

/**
 * A hanging vine with leaf nodes. Rendered *inside* the near canopy layer's
 * `<svg>`, before that layer's leaf masses, so it inherits the layer's gust
 * transform exactly (it can't drift relative to the leaves it hangs from) and
 * its top end is hidden under them (the join reads as "emerges from the
 * foliage" rather than "line drawn over it").
 */
function Vine({
  x,
  top,
  len,
  seed,
  color,
  leaf,
}: {
  x: number;
  top: number;
  len: number;
  seed: number;
  color: string;
  leaf: string;
}) {
  const rand = rng(seed);
  const nodes = [];
  // Leaves every ~30px rather than ~46, and paired into two-block clusters.
  // A thin stroke with a few sparse dots is the exact silhouette DESIGN.md
  // records as having read like "a stray line" the first time a vine was
  // tried; what makes it read as a vine is visible foliage along its length.
  const count = Math.floor(len / 30);
  for (let i = 1; i <= count; i++) {
    const t = i / (count + 1);
    const y = top + len * t;
    const side = i % 2 === 0 ? 1 : -1;
    const w = 10 + rand() * 7;
    const h = 6 + rand() * 3;
    nodes.push(
      <rect key={`n${i}`} x={side > 0 ? x + 2 : x - w - 2} y={y} width={w} height={h} fill={leaf} />,
    );
    nodes.push(
      <rect
        key={`m${i}`}
        x={side > 0 ? x + 2 : x - w * 0.6 - 2}
        y={y + h}
        width={w * 0.6}
        height={h * 0.7}
        fill={leaf}
        opacity={0.8}
      />,
    );
  }
  const sway = 5 + rand() * 4;
  // Gust: the tail is pushed downwind. A clockwise rotation about the top
  // moves a hanging tail *left*, so the amplitude is negative to lean +x.
  // Longer vines have more sail and swing further.
  const amp = -(2.4 + len / 120);
  // Pendulum: a longer vine swings slower, as a real one does.
  const pendulum = 1.3 + rand() * 0.7;
  const pendulumPeriod = 3.4 + len / 80;
  // No wrapper transform needed: both groups set `transform-box: fill-box`,
  // so the swing origin resolves from the vine's own bounding box wherever
  // that box happens to sit in the band's coordinate system.
  return (
    <g
      className={styles.vineGust}
      style={{ animationDelay: gustDelay(x / 1200, rand() * 0.4), ["--amp" as string]: `${amp.toFixed(2)}deg` }}
    >
      <g
        className={styles.vinePendulum}
        style={{
          animationDelay: flutterDelay(rand, pendulumPeriod),
          animationDuration: `${pendulumPeriod.toFixed(2)}s`,
          ["--flutter" as string]: `${pendulum.toFixed(2)}deg`,
        }}
      >
        <path
          d={`M${x},${top} q${sway},${len * 0.34} ${-sway * 0.4},${len * 0.62} T${x - 1},${top + len}`}
          stroke={color}
          strokeWidth={4.5}
          // Butt caps leave a flat perpendicular cut at the tip, which on a
          // near-horizontal final segment reads as a stray dash — a broken
          // stroke rather than the end of a vine.
          strokeLinecap="round"
          fill="none"
          opacity={0.9}
        />
        {nodes}
      </g>
    </g>
  );
}

/*
 * Depth ramp. Far things wash toward the page ground, near things sit at full
 * saturation — atmospheric perspective built from existing tokens only.
 *
 * The first cut of this ramp put `FAR` at `mist 74% + paper` while the sky's
 * lowest stop was `mist 72% + paper`. Those are the same color. Distant
 * foliage dissolved into the sky and the whole upper scene read as pale
 * blocky mush rather than leaves — worst on mobile, where the scene is mostly
 * far layers. Every step here now has to stay clear of the sky's range (see
 * `.sky` in the stylesheet, which was lightened at the same time to open the
 * gap from the other side); "lighter with distance" only reads as distance
 * while the shape still separates from what's behind it.
 */
const FAR = "color-mix(in srgb, var(--bark) 16%, var(--mist))";
const MIDBACK = "color-mix(in srgb, var(--bark) 38%, var(--mist))";
const MID = "color-mix(in srgb, var(--bark) 68%, var(--mist))";
const NEAR = "var(--bark)";
const DEEP = "color-mix(in srgb, var(--forest) 55%, var(--bark))";
const SHADE = "var(--forest)";
const WOOD = "var(--rock)";
const WOOD_FAR = "color-mix(in srgb, var(--rock) 72%, var(--paper))";
const BRANCH = "color-mix(in srgb, var(--moss) 55%, var(--bark))";

/**
 * Trunks. `left` is a percentage so they hold position on any width; `depth`
 * drives width, colour and opacity together.
 *
 * Twelve of them, in three tiers keyed to how much margin the 560px centred
 * board leaves. `tier` is what drops out as the viewport narrows:
 *
 *   edge  — always on (1 / 4.5 / 95.5 / 99%), clear even at 1024px
 *   mid   — off below 1024px
 *   inner — off below 1200px, the innermost pair on each side
 *
 * They are deliberately spaced 3.5–5% apart, which at desktop widths is
 * 50–70px — closer than a bough is wide. That is the point: it guarantees
 * foliage crosses neighbouring trunks instead of every element sitting in its
 * own private pocket of background. Density without occlusion still reads as
 * scattered decals; overlap is what makes it read as a thicket.
 */
type Tier = "edge" | "mid" | "inner";

const TRUNKS: { left: string; w: number; depth: "far" | "mid" | "near"; tier: Tier; seed: number }[] = [
  // Below ~14px a trunk stops reading as a tree and starts reading as a stray
  // vertical rule ruled down the page — an earlier pair were 10/11px and did.
  { left: "1%", w: 38, depth: "near", tier: "edge", seed: 11 },
  { left: "4.5%", w: 20, depth: "mid", tier: "edge", seed: 22 },
  { left: "9%", w: 30, depth: "near", tier: "mid", seed: 33 },
  { left: "14%", w: 15, depth: "far", tier: "mid", seed: 44 },
  { left: "19.5%", w: 24, depth: "mid", tier: "inner", seed: 55 },
  { left: "24%", w: 14, depth: "far", tier: "inner", seed: 66 },
  { left: "76%", w: 14, depth: "far", tier: "inner", seed: 77 },
  { left: "81%", w: 24, depth: "mid", tier: "inner", seed: 88 },
  { left: "86%", w: 15, depth: "far", tier: "mid", seed: 99 },
  { left: "91%", w: 30, depth: "near", tier: "mid", seed: 110 },
  { left: "95.5%", w: 20, depth: "mid", tier: "edge", seed: 121 },
  { left: "99%", w: 38, depth: "near", tier: "edge", seed: 132 },
];

function Trunk({
  left,
  w,
  depth,
  seed,
  tier,
}: {
  left: string;
  w: number;
  depth: "far" | "mid" | "near";
  seed: number;
  tier: Tier;
}) {
  const rand = rng(seed);
  const wood = depth === "far" ? WOOD_FAR : WOOD;
  // `far` was 0.4 over an already-pale wood mix, which measured ~1.0:1
  // against the page — the trunk was invisible, and the boughs anchored to it
  // therefore looked like branches floating in empty space. Distance is a
  // value shift, not a fade to nothing.
  const opacity = depth === "far" ? 0.72 : depth === "mid" ? 0.85 : 1;
  // Bark texture: horizontal striations down the trunk, placed by percentage
  // so they distribute over whatever height the page turns out to be.
  // Deliberately wide and shallow — the first cut used small randomly-offset
  // rectangles, which at trunk width read as scattered debris stuck to the
  // tree rather than as grain in it. Bark runs across the trunk, not in
  // patches on it.
  const notches = [];
  for (let i = 0; i < 9; i++) {
    notches.push(
      <span
        key={i}
        className={styles.notch}
        style={{
          top: `${4 + i * 10.5 + rand() * 4}%`,
          height: `${0.5 + rand() * 1.1}%`,
          left: `${rand() * 18}%`,
          width: `${62 + rand() * 34}%`,
          opacity: 0.16 + rand() * 0.16,
        }}
      />,
    );
  }
  // A flat fill plus one hard shadow strip reads as a flat pole (bamboo, or a
  // bar of color). A three-stop gradient across the width gives the trunk a
  // round side, which is most of what makes it read as a tree at all.
  const highlight = `color-mix(in srgb, var(--paper) 30%, ${wood})`;
  const shadow = `color-mix(in srgb, var(--moss) 46%, ${wood})`;
  return (
    <div
      className={styles.trunk}
      data-tier={tier}
      style={{
        left,
        width: w,
        marginLeft: -w / 2,
        background: `linear-gradient(to right, ${highlight} 0%, ${wood} 40%, ${shadow} 100%)`,
        opacity,
      }}
    >
      {notches}
    </div>
  );
}

/**
 * A bough of foliage hanging off to one side, placed at a percentage down the
 * page. These are what fill the mid-page vertical span that the top and
 * bottom bands can't reach.
 */
/**
 * A bough of foliage growing off a trunk, placed at a percentage down the
 * page. These fill the mid-page vertical span the top and bottom bands can't
 * reach.
 *
 * `side`/`offset` anchor the bough's *branch end* to a trunk's percentage
 * position — left-side boughs anchor by `left`, right-side by `right` (the
 * mirror puts their branch on the box's right edge). The first cut positioned
 * every bough by `left` regardless of side, which left the right-hand ones
 * with their branch pointing into open air and the whole clump reading as a
 * pale blob floating in the middle of the page rather than as foliage growing
 * on something. A bough has to touch a trunk or it isn't a bough.
 */
function Bough({
  side,
  offset,
  top,
  scale,
  fill,
  shade,
  branch,
  plane,
  seed,
  opacity,
  tier,
}: {
  side: "left" | "right";
  offset: string;
  top: string;
  scale: number;
  fill: string;
  /** Always supplied, and always depth-appropriate — an unshaded clump reads
      as a flat cloud rather than a mass of leaves. */
  shade: string;
  /** Depth-appropriate too: a dark branch under a pale far clump reads as a
      stick laid across it, which is what a single fixed branch color did. */
  branch: string;
  plane: "behind" | "front";
  seed: number;
  opacity: number;
  tier: Tier;
}) {
  const W = 190;
  const H = 130;
  // The branch's vertical centre, as the rotation origin for the whole bough.
  const BRANCH_Y = 57.5;
  const rand = rng(seed);
  // Horizontal position of the branch root as a page fraction, for phase.
  const pct = parseFloat(offset) / 100;
  const u = side === "left" ? pct : 1 - pct;
  // A gust presses the bough down. Left boughs extend +x, so "down" is a
  // clockwise (positive) rotation; right boughs are mirrored inside the SVG
  // and extend -x, so the same dip is counter-clockwise. Near, large foliage
  // moves most; the pale far plane barely stirs.
  const dir = side === "left" ? 1 : -1;
  const amp = dir * (plane === "front" ? 1.2 + scale * 0.8 : 0.5 + scale * 0.6);
  const flutter = 0.3 + rand() * 0.3;
  const flutterPeriod = 2.8 + rand() * 1.8;
  return (
    // The gust animation runs on this root element (composited), rotating
    // about the branch root. Right-side boughs are mirrored by a plain SVG
    // `transform` attribute on the inner group rather than a CSS `scaleX(-1)`
    // on the root, so the root's transform stays free for the animation and
    // its origin is a simple box edge.
    <svg
      className={styles.bough}
      data-tier={tier}
      data-side={side}
      style={{
        [side]: offset,
        top,
        width: W * scale,
        height: H * scale,
        opacity,
        transformOrigin: `${side === "left" ? "0%" : "100%"} ${((BRANCH_Y / H) * 100).toFixed(1)}%`,
        animationDelay: gustDelay(u, rand() * 0.5),
        ["--amp" as string]: `${amp.toFixed(2)}deg`,
      }}
      viewBox={`0 0 ${W} ${H}`}
      focusable="false"
      aria-hidden="true"
    >
      <g transform={side === "right" ? `matrix(-1 0 0 1 ${W} 0)` : undefined}>
        <g
          className={styles.boughFlutter}
          style={{
            animationDelay: flutterDelay(rand, flutterPeriod),
            animationDuration: `${flutterPeriod.toFixed(2)}s`,
            ["--flutter" as string]: `${flutter.toFixed(2)}deg`,
          }}
        >
          {/* Branch runs from the anchored edge just far enough to meet the
              clump (whose left edge is at x=50), so the bough visibly grows
              out of the trunk it is positioned against. Kept in a wood tone
              rather than `--forest`: at full length and full black it was the
              darkest thing in the entire scene, and read as a stick poking
              out sideways instead of as the branch under a mass of leaves. */}
          <rect x={-4} y={54} width={62} height={7} fill={branch} />
          <rect x={-4} y={61} width={62} height={2.5} fill={shade} opacity={0.22} />
          <LeafMass cx={112} cy={58} rx={62} ry={40} rows={6} seed={seed} fill={fill} shade={shade} />
          <LeafMass cx={68} cy={86} rx={34} ry={24} rows={5} seed={seed + 7} fill={fill} shade={shade} />
        </g>
      </g>
    </svg>
  );
}

/*
 * Offsets mirror the TRUNKS percentages exactly (left-side boughs by `left`,
 * right-side by `right`), so every bough lands on a trunk rather than in open
 * air.
 *
 * `plane` decides whether a bough renders *behind* the trunks or *in front*
 * of them. That split is what buys real occlusion: with a single layer every
 * bough drew over every trunk, so nothing was ever hidden by anything and the
 * scene read as flat decals however many were added. Far/pale clumps go
 * behind, near/dark ones in front, and because trunks are spaced closer than
 * a bough is wide, both planes cross several trunks each.
 */
const BOUGHS: {
  side: "left" | "right";
  offset: string;
  top: string;
  scale: number;
  fill: string;
  shade: string;
  branch: string;
  plane: "behind" | "front";
  tier: Tier;
  seed: number;
  opacity: number;
}[] = [
  // ---- left, behind the trunks -------------------------------------------
  { side: "left", offset: "4.5%", top: "88%", scale: 0.75, fill: MIDBACK, shade: MID, branch: MID, plane: "behind", tier: "edge", seed: 101, opacity: 0.85 },
  { side: "left", offset: "9%", top: "12%", scale: 0.7, fill: MIDBACK, shade: MID, branch: MID, plane: "behind", tier: "mid", seed: 102, opacity: 0.85 },
  { side: "left", offset: "14%", top: "44%", scale: 0.62, fill: MIDBACK, shade: MID, branch: MID, plane: "behind", tier: "mid", seed: 103, opacity: 0.8 },
  { side: "left", offset: "19.5%", top: "26%", scale: 0.55, fill: FAR, shade: MIDBACK, branch: MIDBACK, plane: "behind", tier: "inner", seed: 104, opacity: 0.9 },
  { side: "left", offset: "24%", top: "66%", scale: 0.5, fill: FAR, shade: MIDBACK, branch: MIDBACK, plane: "behind", tier: "inner", seed: 105, opacity: 0.9 },
  // ---- left, in front of the trunks --------------------------------------
  { side: "left", offset: "1%", top: "20%", scale: 1.2, fill: NEAR, shade: SHADE, branch: BRANCH, plane: "front", tier: "edge", seed: 106, opacity: 1 },
  { side: "left", offset: "1%", top: "74%", scale: 1.05, fill: NEAR, shade: SHADE, branch: BRANCH, plane: "front", tier: "edge", seed: 107, opacity: 1 },
  { side: "left", offset: "4.5%", top: "48%", scale: 0.9, fill: MID, shade: DEEP, branch: BRANCH, plane: "front", tier: "edge", seed: 108, opacity: 0.95 },
  { side: "left", offset: "9%", top: "62%", scale: 0.8, fill: MID, shade: DEEP, branch: BRANCH, plane: "front", tier: "mid", seed: 109, opacity: 0.9 },
  { side: "left", offset: "14%", top: "6%", scale: 0.7, fill: MID, shade: DEEP, branch: BRANCH, plane: "front", tier: "mid", seed: 110, opacity: 0.9 },
  // ---- right, behind the trunks ------------------------------------------
  { side: "right", offset: "4.5%", top: "84%", scale: 0.75, fill: MIDBACK, shade: MID, branch: MID, plane: "behind", tier: "edge", seed: 111, opacity: 0.85 },
  { side: "right", offset: "9%", top: "18%", scale: 0.7, fill: MIDBACK, shade: MID, branch: MID, plane: "behind", tier: "mid", seed: 112, opacity: 0.85 },
  { side: "right", offset: "14%", top: "52%", scale: 0.62, fill: MIDBACK, shade: MID, branch: MID, plane: "behind", tier: "mid", seed: 113, opacity: 0.8 },
  { side: "right", offset: "19.5%", top: "32%", scale: 0.55, fill: FAR, shade: MIDBACK, branch: MIDBACK, plane: "behind", tier: "inner", seed: 114, opacity: 0.9 },
  { side: "right", offset: "24%", top: "72%", scale: 0.5, fill: FAR, shade: MIDBACK, branch: MIDBACK, plane: "behind", tier: "inner", seed: 115, opacity: 0.9 },
  // ---- right, in front of the trunks -------------------------------------
  { side: "right", offset: "1%", top: "14%", scale: 1.2, fill: NEAR, shade: SHADE, branch: BRANCH, plane: "front", tier: "edge", seed: 116, opacity: 1 },
  { side: "right", offset: "1%", top: "68%", scale: 1.05, fill: NEAR, shade: SHADE, branch: BRANCH, plane: "front", tier: "edge", seed: 117, opacity: 1 },
  { side: "right", offset: "4.5%", top: "40%", scale: 0.9, fill: MID, shade: DEEP, branch: BRANCH, plane: "front", tier: "edge", seed: 118, opacity: 0.95 },
  { side: "right", offset: "9%", top: "92%", scale: 0.8, fill: MID, shade: DEEP, branch: BRANCH, plane: "front", tier: "mid", seed: 119, opacity: 0.9 },
];

/** Drifting pollen/spore motes. Placed by percentage, so they spread down any page. */
const MOTES = Array.from({ length: 16 }, (_, i) => {
  const rand = rng(900 + i * 17);
  const period = 9 + rand() * 9;
  const wobblePeriod = 3 + rand() * 2.5;
  return {
    left: `${4 + rand() * 92}%`,
    top: `${5 + rand() * 90}%`,
    size: 2 + Math.round(rand() * 2),
    // Negative: already somewhere along its rise at first paint, rather
    // than absent for up to twelve seconds and then fading in.
    delay: `${(-rand() * period).toFixed(2)}s`,
    period: `${period.toFixed(2)}s`,
    drift: `${((rand() * 2 - 1) * 26).toFixed(1)}px`,
    wobble: `${(3 + rand() * 6).toFixed(1)}px`,
    wobblePeriod: `${wobblePeriod.toFixed(2)}s`,
    wobbleDelay: `${(-rand() * wobblePeriod).toFixed(2)}s`,
  };
});

/**
 * Props shared by every canopy depth layer: one viewBox, one slice, so the
 * layers stack in exactly the coordinate system they shared as groups.
 */
const CANOPY_LAYER = {
  viewBox: "0 0 1200 340",
  preserveAspectRatio: "xMidYMin slice",
  focusable: "false",
  "aria-hidden": true,
} as const;

/* The whole forest leans as one piece, so it takes a mid-page lag. */
const LEAN_DELAY = gustDelay(0.45);

export function CanopyScene() {
  return (
    <div className={styles.scene} aria-hidden="true" style={{ ["--gust-period" as string]: `${GUST_PERIOD}s` }}>
      <div className={styles.sky} />

      {/* Sun shafts through the canopy — the strongest "inside the forest" cue. */}
      <div className={styles.shafts}>
        {/* Offset from the centred content column on purpose. A wide shaft
            sitting exactly behind a 560px centred board, at the same width as
            the board, doesn't read as light through a canopy — it reads as
            the page being a sheet of paper. They need to cross the column,
            not align with it. */}
        <span className={styles.shaft} style={{ left: "5%", width: 150, animationDelay: "-3s", animationDuration: "13s" }} />
        <span className={styles.shaft} style={{ left: "33%", width: 205, animationDelay: "-11s", animationDuration: "17s" }} />
        <span className={styles.shaft} style={{ left: "71%", width: 135, animationDelay: "-6.5s", animationDuration: "15s" }} />
      </div>

      {/* Everything that is part of a tree — both bough planes, the trunks
          and the canopy band — shares one full-page container that carries
          the whole-forest lean. One container rather than one per block: the
          blocks are stacked siblings in a fixed z-order anyway, and a single
          leaning layer is one composite per frame instead of four. */}
      <div className={styles.lean} style={{ animationDelay: LEAN_DELAY }}>
        {/* Far foliage sits BEHIND the trunks so the trunks cut across it. */}
        <div className={styles.boughs}>
          {BOUGHS.filter((b) => b.plane === "behind").map((b) => (
            <Bough key={`${b.side}-${b.offset}-${b.top}`} {...b} />
          ))}
        </div>

        {/* Trunks: vertical, so they span any page height with no tiling. */}
        <div className={styles.trunks}>
          {TRUNKS.map((t) => (
            <Trunk key={t.left} {...t} />
          ))}
        </div>

        {/* Top canopy band — the ceiling of the forest, densest at the margins.
            One `<svg>` per depth, stacked in the same coordinate system, so
            each depth's sway runs on its own root element. */}
        <div className={styles.canopyBand}>
          {/* Far layer: pale, barely moving, reads as distance. */}
          <svg className={`${styles.canopyLayer} ${styles.canopyFar}`} style={{ animationDelay: gustDelay(0.5, 0.9) }} {...CANOPY_LAYER}>
            <LeafMass cx={90} cy={40} rx={150} ry={72} rows={7} seed={1} fill={FAR} />
            <LeafMass cx={380} cy={0} rx={170} ry={62} rows={6} seed={2} fill={FAR} />
            <LeafMass cx={700} cy={4} rx={160} ry={60} rows={6} seed={3} fill={FAR} />
            <LeafMass cx={1050} cy={38} rx={175} ry={74} rows={7} seed={4} fill={FAR} />
          </svg>

          {/* Mid layer. */}
          <svg className={`${styles.canopyLayer} ${styles.canopyMid}`} style={{ animationDelay: gustDelay(0.5, 0.4) }} {...CANOPY_LAYER}>
            <LeafMass cx={40} cy={70} rx={150} ry={86} rows={8} seed={5} fill={MIDBACK} />
            <LeafMass cx={300} cy={6} rx={130} ry={58} rows={6} seed={6} fill={MIDBACK} />
            <LeafMass cx={880} cy={8} rx={140} ry={60} rows={6} seed={7} fill={MIDBACK} />
            <LeafMass cx={1170} cy={72} rx={155} ry={88} rows={8} seed={8} fill={MIDBACK} />
          </svg>

          {/* These two sit directly behind the centred nav links. They were
              `MID` and measured 2.05:1 / 2.87:1 against `--moss` nav text —
              a straight §8 contrast failure at every width. Kept pale and
              raised so the nav always lands on light foliage; anything dark
              added to this x-range has to be re-measured against the nav.
              Their own layer so they keep drawing over the mid masses under
              them while the near corners (below) draw over everything. */}
          <svg className={`${styles.canopyLayer} ${styles.canopyNearCenter}`} style={{ animationDelay: gustDelay(0.5) }} {...CANOPY_LAYER}>
            <LeafMass cx={520} cy={-34} rx={130} ry={54} rows={5} seed={11} fill={MIDBACK} />
            <LeafMass cx={820} cy={-32} rx={125} ry={52} rows={5} seed={12} fill={MIDBACK} />
          </svg>

          {/* Near layer: full-strength green with shading, hung at the corners
              so the center of the band stays light over the board. Split left
              and right so the gust reaches the right corner after the left.
              The vines are drawn first, so their tops sit under the leaves. */}
          <svg className={`${styles.canopyLayer} ${styles.canopyNear}`} style={{ animationDelay: gustDelay(0.12) }} {...CANOPY_LAYER}>
            <Vine x={128} top={120} len={210} seed={21} color={DEEP} leaf={NEAR} />
            <Vine x={247} top={78} len={150} seed={22} color={DEEP} leaf={MID} />
            <LeafMass cx={10} cy={78} rx={165} ry={104} rows={8} seed={9} fill={NEAR} shade={SHADE} />
            <LeafMass cx={110} cy={104} rx={92} ry={86} rows={8} seed={15} fill={DEEP} shade={SHADE} />
            <LeafMass cx={175} cy={30} rx={105} ry={66} rows={7} seed={10} fill={NEAR} shade={SHADE} />
            <LeafMass cx={262} cy={52} rx={78} ry={58} rows={6} seed={16} fill={NEAR} shade={SHADE} />
            <LeafMass cx={358} cy={20} rx={70} ry={44} rows={5} seed={17} fill={MID} shade={DEEP} />
          </svg>
          <svg className={`${styles.canopyLayer} ${styles.canopyNear}`} style={{ animationDelay: gustDelay(0.88) }} {...CANOPY_LAYER}>
            <Vine x={962} top={70} len={168} seed={23} color={DEEP} leaf={MID} />
            <Vine x={1088} top={116} len={225} seed={24} color={DEEP} leaf={NEAR} />
            <LeafMass cx={848} cy={22} rx={72} ry={46} rows={5} seed={18} fill={MID} shade={DEEP} />
            <LeafMass cx={946} cy={54} rx={80} ry={60} rows={6} seed={19} fill={NEAR} shade={SHADE} />
            <LeafMass cx={1035} cy={30} rx={110} ry={68} rows={7} seed={13} fill={NEAR} shade={SHADE} />
            <LeafMass cx={1104} cy={102} rx={94} ry={84} rows={8} seed={20} fill={DEEP} shade={SHADE} />
            <LeafMass cx={1195} cy={80} rx={170} ry={106} rows={8} seed={14} fill={NEAR} shade={SHADE} />
          </svg>
        </div>

        {/* Near foliage sits IN FRONT of the trunks, hiding parts of them. */}
        <div className={styles.boughs}>
          {BOUGHS.filter((b) => b.plane === "front").map((b) => (
            <Bough key={`${b.side}-${b.offset}-${b.top}`} {...b} />
          ))}
        </div>
      </div>

      {/* Understory: fronds pushing up from the forest floor. Anchored to the
          bottom edge, where the whole-forest lean is zero, so it sits outside
          the leaning container. */}
      <svg
        className={styles.understory}
        viewBox="0 0 1200 230"
        preserveAspectRatio="xMidYMax slice"
        focusable="false"
        aria-hidden="true"
      >
        {/* The centre of this band sits directly behind the submit button —
            the one `--banana` element on the page and the primary action.
            Centre fronds are kept short so they stay below it; a taller one
            at x=600 was cut outright for rising behind the button itself. */}
        {/* 0.55 over already-pale fills put these near 20% effective, which
            next to the solid foreground fronds read as elements that failed
            to render rather than as distance. */}
        <g opacity={0.85}>
          <Frond x={150} y={232} len={120} angle={-14} fill={MID} shade={SHADE} seed={31} />
          <Frond x={430} y={232} len={62} angle={9} fill={MIDBACK} shade={MID} seed={32} />
          <Frond x={780} y={232} len={66} angle={-7} fill={MIDBACK} shade={MID} seed={33} />
          <Frond x={1050} y={232} len={126} angle={12} fill={MID} shade={SHADE} seed={34} />
        </g>
        {/* Foreground understory. Overlapping deliberately — the fronds cross
            each other and the mid group behind them, which is what a thicket
            does and what a row of evenly-spaced fronds conspicuously doesn't.
            The `DEEP` ones are the darkest thing in the scene and are placed
            at the very bottom corners, cropped by the viewport, because a
            near plane that runs off the edge is the strongest available cue
            that the viewer is standing inside the scene rather than looking
            at it from outside. */}
        <Frond x={-10} y={240} len={210} angle={-24} fill={DEEP} shade={SHADE} seed={42} />
        <Frond x={40} y={236} len={186} angle={-19} fill={NEAR} shade={SHADE} seed={35} />
        <Frond x={78} y={240} len={140} angle={-32} fill={DEEP} shade={SHADE} seed={43} />
        <Frond x={112} y={238} len={150} angle={6} fill={DEEP} shade={SHADE} seed={36} />
        <Frond x={176} y={238} len={166} angle={-9} fill={NEAR} shade={SHADE} seed={44} />
        <Frond x={236} y={238} len={128} angle={22} fill={NEAR} shade={SHADE} seed={37} />
        <Frond x={296} y={240} len={104} angle={14} fill={MID} shade={DEEP} seed={45} />
        <Frond x={906} y={240} len={110} angle={-13} fill={MID} shade={DEEP} seed={46} />
        <Frond x={968} y={238} len={132} angle={-21} fill={NEAR} shade={SHADE} seed={39} />
        <Frond x={1030} y={238} len={172} angle={9} fill={NEAR} shade={SHADE} seed={47} />
        <Frond x={1092} y={238} len={158} angle={-4} fill={DEEP} shade={SHADE} seed={40} />
        <Frond x={1136} y={240} len={144} angle={30} fill={DEEP} shade={SHADE} seed={48} />
        <Frond x={1164} y={236} len={180} angle={17} fill={NEAR} shade={SHADE} seed={41} />
        <Frond x={1214} y={240} len={205} angle={25} fill={DEEP} shade={SHADE} seed={49} />
      </svg>

      {/* Pollen drifting in the shafts. */}
      <div className={styles.motes}>
        {MOTES.map((m, i) => (
          <span
            key={i}
            className={styles.mote}
            style={{
              left: m.left,
              top: m.top,
              width: m.size,
              height: m.size,
              animationDelay: m.delay,
              animationDuration: m.period,
              ["--drift" as string]: m.drift,
              ["--wobble" as string]: m.wobble,
              ["--wobble-period" as string]: m.wobblePeriod,
              ["--wobble-delay" as string]: m.wobbleDelay,
            }}
          />
        ))}
      </div>

      <div className={styles.scanlines} />
    </div>
  );
}
