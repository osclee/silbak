import { useId } from "react";
import type { Age, Build, Silver } from "@silbak/engine";

interface ApeGlyphProps {
  id: number;
  age: Age;
  build: Build;
  silver: Silver;
  scar: boolean;
  size?: number;
}

/**
 * Portraits are generated from traits, never picked from a library — DESIGN.md §6.
 *
 * The pose is the knuckle-walking quadruped profile of the gorilla emoji (U+1F98D),
 * and the layout below is measured off it rather than eyeballed. As fractions of the
 * animal's total height, with the ground at 1.0:
 *
 *     crown 0.00 · shoulder hump 0.22 · jaw 0.34 · belly 0.71 · ground 1.00
 *
 * and as fractions of its total length: head 0..0.27, torso 0.22..1.0. Two of those
 * are counter-intuitive and were got wrong twice before being measured:
 *   - The *head* is the highest point, not the shoulder hump. The hump sits behind it
 *     and about a fifth of the body's height lower.
 *   - The torso is far wider than it is deep (roughly 1.75:1). Anything approaching
 *     circular reads as a bear no matter what the head and limbs are doing.
 * The rest: the head overlaps the chest so no neck shows, the forelimb is long and
 * drops from directly under the jaw, and the hind foot is a flat plantigrade pad.
 *
 * Rendering is a retro-vector cel: one ink outline, one base fur value, then flat
 * shadow and highlight masses clipped inside each part, lit from the upper left.
 *
 *   1. Every part (torso + hump, near limbs, head) is drawn once as an *underlay* —
 *      filled AND stroked in --fur-deep — and then again on top filled in --fur with
 *      no stroke. The union of the underlays is the silhouette's ink outline; the
 *      union of the fills covers every interior seam. Where a limb is buried in the
 *      chest its stroke is simply painted over, so no contour is ever drawn there
 *      (stroking a buried limb edge makes the limbs read as boots — learned the hard
 *      way, DESIGN.md §6).
 *   2. Shading is clipped to the part it belongs to, in that part's own coordinate
 *      space, so it rides along with the build/age transforms for free.
 *   3. --silver is luminance-matched to the --rock frame the portrait sits in. The
 *      saddle is therefore clipped to the torso and an inner rim of --fur-deep is
 *      re-stroked along the back after it, so silver never touches the frame.
 *
 * Geometry lives in one 100x100 viewBox. Traits are applied as transforms and swaps
 * over a fixed base pose rather than by rebuilding paths, so the silhouette stays
 * consistent across the whole trait matrix.
 */

/** Bulk of the torso and limbs, plus how far the shoulder hump rises off the withers. */
const BUILD_SCALE: Record<Build, { sx: number; sy: number; limb: number; hump: number }> = {
  slight: { sx: 0.93, sy: 0.86, limb: 0.85, hump: 0.7 },
  solid: { sx: 1, sy: 1, limb: 1, hump: 1 },
  heavy: { sx: 1.08, sy: 1.12, limb: 1.18, hump: 1.4 },
};

/**
 * Age: whole-animal scale, head size relative to that, sagittal crest height, muzzle
 * length, eye size, and whether the brow and crest have greyed. Juveniles are a
 * smaller animal carrying a proportionally larger head with big eyes and no crest;
 * elders carry the tallest crest and go grey around the face.
 */
const AGE: Record<
  Age,
  { body: number; head: number; crest: number; muzzle: number; eye: number; greying: boolean }
> = {
  juvenile: { body: 0.9, head: 0.88, crest: 0, muzzle: 0.82, eye: 2.6, greying: false },
  subadult: { body: 0.96, head: 0.8, crest: 2, muzzle: 0.92, eye: 2.3, greying: false },
  prime: { body: 1, head: 0.8, crest: 4, muzzle: 1, eye: 2.1, greying: false },
  elder: { body: 1, head: 0.83, crest: 6.5, muzzle: 1.1, eye: 2.1, greying: true },
};

/**
 * The silver saddle, as a patch that grows *in area* along the withers→rump axis
 * rather than only in opacity: `extent` is how far back and down it reaches, `patch`
 * its opacity, `flecks` how many silver hairs are scattered around it, and `thigh`
 * whether it continues onto the near hind leg (real silverbacks carry it onto the
 * hips). Four levels have to stay distinguishable at 46px.
 */
const SADDLE: Record<Silver, { extent: number; patch: number; flecks: number; thigh: boolean } | null> = {
  none: null,
  flecked: { extent: 0.28, patch: 0.3, flecks: 26, thigh: false },
  "part-silver": { extent: 0.55, patch: 0.88, flecks: 10, thigh: false },
  full: { extent: 0.92, patch: 1, flecks: 8, thigh: true },
};

/** Chest, shoulder hump, the long shallow decline of the back, rump, belly. */
const TORSO =
  "M24 56 C23 44 29 30 46 25 C60 26 73 31 81 40 C88 47 91 53 90 60 C88 66 78 69 65 69 C48 69 32 66 27 61 C24 59 24 58 24 56 Z";

/** Forelimb and its knuckle as one closed column — no seam between leg and hand.
 *  It runs more than half the animal's height, dropping from under the jaw: the long
 *  forelimb is the single most gorilla-specific thing in the silhouette. */
const FORELIMB =
  "M26 44 C24 56 24 70 25 79 C25 84 30 87 36 87 C42 87 45 84 45 79 C46 66 46 54 45 44 Z";

/** Hind limb: thigh, ankle, and a flat plantigrade foot, again as one closed shape. */
const HINDLIMB =
  "M58 48 C55 60 55 70 56 77 C54 78 53 80 53 83 C53 86 57 87 64 87 C71 87 76 86 76 83 C76 79 74 77 72 75 C75 64 76 56 76 48 Z";

/** Far-side limbs are separate shorter paths rather than offset copies: an offset copy
 *  pokes its square top edge out above the back. These start below the shoulder line. */
const FAR_FORELIMB =
  "M36 52 C34 62 34 72 35 80 C35 84 38 86 42 86 C46 86 49 84 49 80 C50 70 50 60 49 52 Z";
const FAR_HINDLIMB =
  "M70 54 C68 64 68 72 69 78 C67 79 66 81 66 83 C66 86 70 87 76 87 C82 87 85 86 85 83 C85 80 83 78 81 76 C84 66 85 60 85 54 Z";

/** Cranium and projecting muzzle, drawn as two merged shapes rather than one outline —
 *  the brow/bridge/snout sequence is easier to keep honest when they move separately.
 *  Head space is anchored at (40,30), the neck joint. */
const CRANIUM = "M40 30 C41 21 34 14 24 15 C15 16 10 22 10 31 C10 38 15 43 24 44 C33 45 40 39 40 30 Z";
const MUZZLE = "M20 33 C12 34 5 39 6 44 C7 49 13 51 19 50 C26 49 28 43 27 37 Z";

/** The bare-skinned face: brow shelf, eye socket, cheek and the whole muzzle. Drawn
 *  in head space and clipped to the head so it can be generous at the edges. */
const FACE = "M8 31 C13 28.5 20 28.5 25 31.5 C26.5 36 25 41 23 46 C21 50.5 14 52 9 50 C5 48 3.5 42 5 36 Z";

/** Shoulder hump: an ellipse riding on the withers, part of the torso silhouette.
 *  Its vertical radius is the build tell. */
const HUMP = { cx: 52, cy: 30, rx: 13, ry: 6 };

/** The hump ellipse as path data, for even-odd compound clips. */
function humpPath(ry: number): string {
  const { cx, cy, rx } = HUMP;
  return `M${cx - rx} ${cy} a${rx} ${ry} 0 1 0 ${2 * rx} 0 a${rx} ${ry} 0 1 0 ${-2 * rx} 0 Z`;
}

/** A big square with a hole cut out, for "everything except this shape" clips. */
const EVERYTHING = "M-50 -50 H150 V150 H-50 Z";

/** Ink weight of the silhouette outline, in viewBox units (≈1.1px at 56px). */
const INK = 4;

/** Cheap deterministic hash (display-only fur texture, not gameplay RNG). */
function speckleNoise(seed: number, i: number): number {
  let h = seed ^ Math.imul(i + 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 15), 1 | h);
  h = (h + Math.imul(h ^ (h >>> 7), 61 | h)) ^ h;
  return ((h ^ (h >>> 14)) >>> 0) / 4294967296;
}

/**
 * The sagittal crest, as a dome rising off the top of the cranium (which tops out at
 * y=14 in head space). `height` is how far above that the crest actually peaks, so the
 * control points are solved back from the peak — a cubic with both controls at `top`
 * only reaches three quarters of the way there, and setting `top` directly made every
 * age look crestless.
 */
function crestPath(height: number): string {
  if (height <= 0) return "";
  const cx = 26;
  const halfWidth = 14 + height * 0.35;
  const left = cx - halfWidth;
  const right = cx + halfWidth;
  const base = 28;
  const peak = 14 - height;
  const top = base + (peak - base) / 0.75;
  return `M${left} ${base} C${left} ${top} ${right} ${top} ${right} ${base} Z`;
}

/**
 * A polyline redrawn as a run of small outward-bulging quadratic arcs, so the
 * saddle's edge reads as tufts of fur rather than a waterline across the body.
 * "Outward" is the right-hand side of the direction of travel (screen coordinates).
 */
function scalloped(points: Array<[number, number]>, step: number, amp: number): string {
  let d = "";
  for (let s = 0; s < points.length - 1; s++) {
    const [x0, y0] = points[s];
    const [x1, y1] = points[s + 1];
    const len = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.max(1, Math.round(len / step));
    const nx = -(y1 - y0) / len;
    const ny = (x1 - x0) / len;
    for (let i = 0; i < n; i++) {
      const ax = x0 + ((x1 - x0) * (i + 0.5)) / n + nx * amp;
      const ay = y0 + ((y1 - y0) * (i + 0.5)) / n + ny * amp;
      const bx = x0 + ((x1 - x0) * (i + 1)) / n;
      const by = y0 + ((y1 - y0) * (i + 1)) / n;
      d += `Q${ax.toFixed(1)} ${ay.toFixed(1)} ${bx.toFixed(1)} ${by.toFixed(1)} `;
    }
  }
  return d;
}

/**
 * The saddle region in torso space: everything above and in front of a scalloped
 * boundary that starts at the shoulders, runs back along the flank, and turns up to
 * the back line. `extent` 0..1 moves the boundary from just behind the withers to the
 * rump and hips. The region overshoots the torso deliberately; it is clipped.
 */
function saddlePath(extent: number): string {
  const xFront = 38 + extent * 10;
  const xEnd = 46 + extent * 46;
  const yBottom = 25 + extent * 40;
  const r = 6;
  const boundary = scalloped(
    [
      [34, 6],
      [xFront, yBottom],
      [xEnd - r, yBottom],
      [xEnd, yBottom - r],
      [xEnd, 4],
    ],
    5,
    1.7,
  );
  return `M34 6 ${boundary}Z`;
}

/** The saddle's continuation onto the near thigh, in hind-limb space. */
const THIGH_SADDLE = `M48 40 L82 40 L82 55 ${scalloped(
  [
    [82, 55],
    [48, 58],
  ],
  5,
  1.7,
)}Z`;

export function ApeGlyph({ id, age, build, silver, scar, size = 56 }: ApeGlyphProps) {
  const { sx, sy, limb, hump } = BUILD_SCALE[build];
  const a = AGE[age];
  const saddle = SADDLE[silver];

  // useId keeps clipPath ids unique across every glyph on the page (a rung ladder
  // renders six; the dev matrix renders the same ape id dozens of times).
  const uid = useId().replace(/:/g, "");
  const torsoClip = `${uid}-torso`;
  const headClip = `${uid}-head`;
  const foreClip = `${uid}-fore`;
  const hindClip = `${uid}-hind`;
  const rimClip = `${uid}-rim`;
  const noHumpClip = `${uid}-nohump`;
  const noTorsoClip = `${uid}-notorso`;
  const silverFill = `${uid}-silver`;

  const furDeep = "var(--fur-deep)";
  const fur = "var(--fur)";
  const furLight = "var(--fur-light)";
  const skin = "var(--skin)";
  const silverInk = "var(--silver)";
  const paper = "var(--paper)";
  const blood = "var(--blood)";

  // Age scales the whole animal about its footprint, so juveniles stand shorter.
  const bodyTransform = `translate(50 88) scale(${a.body}) translate(-50 -88)`;
  // Build scales the torso about the belly line, so bulk grows upward into the
  // shoulder hump rather than sinking the animal through the ground.
  const torsoTransform = `translate(58 72) scale(${sx} ${sy}) translate(-58 -72)`;
  // Age scales the face about the neck joint, so only the muzzle lengthens. The joint
  // is pinned inside the chest, which is what keeps the neck from showing.
  const headTransform = `translate(40 30) scale(${a.muzzle * a.head} ${a.head}) translate(-40 -30)`;
  // Limb thickness scales about each limb's own long axis, feet staying on the ground.
  const limbTransform = (cx: number) =>
    `translate(${cx} 88) scale(${limb} ${1 + (limb - 1) * 0.3}) translate(-${cx} -88)`;

  const crestD = crestPath(a.crest);
  const humpRy = HUMP.ry * hump;

  // Fur texture. With no silver: a few darker-on-dark hairs so same-trait apes still
  // read as individuals. With silver: light hairs scattered around the patch edge so
  // the saddle looks like it is growing in, not painted on.
  const flecks: Array<[number, number, number]> = [];
  if (saddle) {
    const xFront = 38 + saddle.extent * 10;
    const xEnd = 46 + saddle.extent * 46;
    const yBottom = 25 + saddle.extent * 40;
    for (let i = 0; i < saddle.flecks; i++) {
      const t = speckleNoise(id + 17, i * 3);
      const x = xFront - 2 + t * (xEnd + 4 - xFront);
      const y = yBottom - 10 + speckleNoise(id + 43, i * 3 + 1) * 15;
      const r = 0.6 + speckleNoise(id + 71, i * 3 + 2) * 0.7;
      flecks.push([x, y, r]);
    }
  } else {
    for (let i = 0; i < 8; i++) {
      const x = 42 + speckleNoise(id + 17, i * 3) * 44;
      const y = 30 + speckleNoise(id + 43, i * 3 + 1) * 30;
      const r = 0.6 + speckleNoise(id + 71, i * 3 + 2) * 0.7;
      flecks.push([x, y, r]);
    }
  }

  // Every part of the near silhouette, drawn identically for the ink underlay and
  // for the base fill. Order within the group does not matter for either pass.
  const silhouette = (
    <>
      <g transform={torsoTransform}>
        <path d={TORSO} />
        <ellipse cx={HUMP.cx} cy={HUMP.cy} rx={HUMP.rx} ry={humpRy} />
      </g>
      <path d={HINDLIMB} transform={limbTransform(64)} />
      <path d={FORELIMB} transform={limbTransform(36)} />
      <g transform={headTransform}>
        {crestD ? <path d={crestD} /> : null}
        <path d={CRANIUM} />
        <path d={MUZZLE} />
      </g>
    </>
  );

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <defs>
        {/* Part clips are defined in each part's own space and referenced from inside
            that part's transformed group, so they follow the trait transforms. */}
        <clipPath id={torsoClip}>
          <path d={TORSO} />
          <ellipse cx={HUMP.cx} cy={HUMP.cy} rx={HUMP.rx} ry={humpRy} />
        </clipPath>
        <clipPath id={rimClip}>
          <rect x={0} y={0} width={100} height={58} />
        </clipPath>
        {/* The inner rim must trace the *union* of torso and hump, never the part of
            either edge buried inside the other — a stroked ellipse inside the back
            reads as a ring painted on the fur. */}
        <clipPath id={noHumpClip}>
          <path d={`${EVERYTHING} ${humpPath(humpRy)}`} clipRule="evenodd" />
        </clipPath>
        <clipPath id={noTorsoClip}>
          <path d={`${EVERYTHING} ${TORSO}`} clipRule="evenodd" />
        </clipPath>
        <clipPath id={foreClip}>
          <path d={FORELIMB} />
        </clipPath>
        <clipPath id={hindClip}>
          <path d={HINDLIMB} />
        </clipPath>
        <clipPath id={headClip}>
          {crestD ? <path d={crestD} /> : null}
          <path d={CRANIUM} />
          <path d={MUZZLE} />
        </clipPath>
        <linearGradient id={silverFill} gradientUnits="userSpaceOnUse" x1={0} y1={18} x2={0} y2={66}>
          <stop offset={0} stopColor={silverInk} stopOpacity={1} />
          <stop offset={1} stopColor={silverInk} stopOpacity={0.72} />
        </linearGradient>
      </defs>

      <g transform={bodyTransform}>
        {/* Far-side limbs: outlined like everything else, then washed darker so they
            recede behind the body. */}
        <g fill={fur} stroke={furDeep} strokeWidth={INK} strokeLinejoin="round">
          <path d={FAR_FORELIMB} transform={limbTransform(42)} />
          <path d={FAR_HINDLIMB} transform={limbTransform(76)} />
        </g>
        <g fill={furDeep} opacity={0.5}>
          <path d={FAR_FORELIMB} transform={limbTransform(42)} />
          <path d={FAR_HINDLIMB} transform={limbTransform(76)} />
        </g>

        {/* Ink underlay: the silhouette's outline, as one union. */}
        <g fill={furDeep} stroke={furDeep} strokeWidth={INK} strokeLinejoin="round">
          {silhouette}
        </g>
        {/* Base fill over it, covering every interior seam. */}
        <g fill={fur}>{silhouette}</g>

        {/* Torso: belly shadow, jaw shadow, hump and back highlights, then the saddle,
            fur flecks, and the inner rim that keeps silver off the frame. */}
        <g transform={torsoTransform}>
          <g clipPath={`url(#${torsoClip})`}>
            <path d="M20 54 C34 63 62 66 94 55 L94 80 L20 80 Z" fill={furDeep} opacity={0.45} />
            <ellipse cx={37} cy={46} rx={12} ry={7} fill={furDeep} opacity={0.35} />
            <ellipse cx={48} cy={26.5} rx={9} ry={3.6 + humpRy * 0.25} fill={furLight} opacity={0.8} />
            <path
              d="M56 28.5 C66 30 76 35 83 41"
              stroke={furLight}
              strokeWidth={3}
              strokeLinecap="round"
              fill="none"
              opacity={0.5}
            />
            <ellipse cx={84} cy={47} rx={5} ry={6} fill={furLight} opacity={0.45} />
            {saddle ? (
              <path d={saddlePath(saddle.extent)} fill={`url(#${silverFill})`} opacity={saddle.patch} />
            ) : null}
            {flecks.map(([x, y, r], i) => (
              <circle
                key={i}
                cx={x}
                cy={y}
                r={r}
                fill={saddle ? silverInk : furLight}
                opacity={saddle ? 0.8 : 0.5}
              />
            ))}
            <g clipPath={`url(#${rimClip})`} fill="none" stroke={furDeep} strokeWidth={3}>
              <path d={TORSO} clipPath={`url(#${noHumpClip})`} />
              <path d={humpPath(humpRy)} clipPath={`url(#${noTorsoClip})`} />
            </g>
          </g>
        </g>

        {/* Near hind limb: lit shin, shadowed hamstring, dark-skinned sole. */}
        <g transform={limbTransform(64)}>
          <g clipPath={`url(#${hindClip})`}>
            <path
              d="M56.5 58 C55.6 64 55.3 71 56 77 L61.5 77 C60.8 71 61 64 62 58 C61 55.5 57.5 55.5 56.5 58 Z"
              fill={furLight}
              opacity={0.55}
            />
            <path d="M72 46 L80 46 L80 90 L70 90 C75 74 77 62 72 46 Z" fill={furDeep} opacity={0.4} />
            {saddle?.thigh ? <path d={THIGH_SADDLE} fill={`url(#${silverFill})`} opacity={0.9} /> : null}
            <ellipse cx={65} cy={85.5} rx={10} ry={2.6} fill={skin} />
          </g>
        </g>

        {/* Near forelimb: lit forearm, shadowed inner edge, knuckle pad. */}
        <g transform={limbTransform(36)}>
          <g clipPath={`url(#${foreClip})`}>
            <path
              d="M25 54 C24.3 62 24.2 71 25 79 L30.5 79 C29.8 71 29.8 62 30.5 54 C29.5 51.5 26 51.5 25 54 Z"
              fill={furLight}
              opacity={0.55}
            />
            <path d="M40 40 L50 40 L50 90 L40 90 C44 74 44 58 40 40 Z" fill={furDeep} opacity={0.4} />
            <ellipse cx={35} cy={85} rx={9} ry={2.8} fill={skin} />
            <path d="M30 83.5 L30 86 M35 83 L35 86" stroke={furDeep} strokeWidth={1} opacity={0.6} />
          </g>
        </g>

        {/* Head: crown highlight, shadow where it meets the chest, then the bare face,
            ear, and features. Drawn last so it sits in front of the shoulder. */}
        <g transform={headTransform}>
          <g clipPath={`url(#${headClip})`}>
            <ellipse cx={24} cy={19 - a.crest * 0.6} rx={10} ry={5} fill={furLight} opacity={0.7} />
            <ellipse cx={39} cy={37} rx={8} ry={8} fill={furDeep} opacity={0.35} />
            <path d={FACE} fill={skin} />
            {a.greying ? (
              <>
                <ellipse cx={32} cy={26} rx={4.5} ry={3} fill={silverInk} opacity={0.45} />
                <ellipse cx={26} cy={14 - a.crest + 2.5} rx={6} ry={2.5} fill={silverInk} opacity={0.5} />
              </>
            ) : null}
          </g>
          {/* Ear */}
          <circle cx={36.5} cy={31.5} r={3.2} fill={skin} stroke={furDeep} strokeWidth={1.2} />
          <circle cx={36.5} cy={31.5} r={1.3} fill={furDeep} opacity={0.6} />
          {/* Brow ridge, heavy. */}
          <path
            d="M8 33 C13 29.5 20 29.5 25.5 32"
            stroke={furDeep}
            strokeWidth={3}
            fill="none"
            strokeLinecap="round"
          />
          {a.greying ? (
            <path
              d="M9 32 C14 29 20 29 25 31.5"
              stroke={silverInk}
              strokeWidth={1.4}
              fill="none"
              strokeLinecap="round"
              opacity={0.6}
            />
          ) : null}
          {/* Eye: deep-set, dark, with one glint. */}
          <ellipse cx={14.5} cy={37} rx={a.eye * 1.1} ry={a.eye} fill={furDeep} />
          <circle
            cx={14.5 - a.eye * 0.35}
            cy={37 - a.eye * 0.35}
            r={a.eye * 0.38}
            fill={paper}
            opacity={0.9}
          />
          {/* Nostril, mouth, cheek crease. */}
          <path
            d="M6.5 42.5 C8.5 41.3 10.5 41.3 12 42.5"
            stroke={furDeep}
            strokeWidth={1.7}
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M7 47.5 C11 49.8 16 49.8 20 48.2"
            stroke={furDeep}
            strokeWidth={1.6}
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M22.5 39 C23.5 43 23 46 21.5 48.5"
            stroke={furDeep}
            strokeWidth={1}
            fill="none"
            strokeLinecap="round"
            opacity={0.55}
          />

          {/* Scar: one short diagonal cut down the bare cheek, under the brow and
              behind the eye. It lives on the --skin mask on purpose — a red stroke
              over near-black fur reads as a painted bar, over grey skin it reads as
              a healed wound. A faint dark edge gives it depth. Drawn in head space so
              it scales with the skull, and kept clear of the eye at (14.5,37). */}
          {scar ? (
            <>
              <path
                d="M23.5 38 L19 47.5"
                stroke={furDeep}
                strokeWidth={3.4}
                strokeLinecap="round"
                fill="none"
                opacity={0.45}
              />
              <path
                d="M23.5 38 L19 47.5"
                stroke={blood}
                strokeWidth={2.1}
                strokeLinecap="round"
                fill="none"
                opacity={0.92}
              />
            </>
          ) : null}
        </g>
      </g>
    </svg>
  );
}
