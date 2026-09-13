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
 * The body, head and near limbs are all drawn in one value so the animal reads as a
 * single mass at 40px; separation comes from thin --forest contours, not from filling
 * parts in different colors. Two earlier passes failed here: a lighter torso fill
 * broke the silhouette into a shell sitting on tubes, and stroking the whole limb
 * outline — including the part buried in the chest — made the limbs read as boots.
 * So limb contours are clipped to the area *outside* the torso.
 *
 * Geometry lives in one 100x100 viewBox. Traits are applied as transforms and swaps
 * over a fixed base pose rather than by rebuilding paths, so the silhouette stays
 * consistent across the whole trait matrix.
 */

/** Bulk of the torso and limbs. */
const BUILD_SCALE: Record<Build, { sx: number; sy: number; limb: number }> = {
  slight: { sx: 0.95, sy: 0.86, limb: 0.87 },
  solid: { sx: 1, sy: 1, limb: 1 },
  heavy: { sx: 1.06, sy: 1.15, limb: 1.14 },
};

/** Sagittal crest height and half-width — the clearest age tell in profile. */
const CREST: Record<Age, { height: number; halfWidth: number }> = {
  juvenile: { height: 0, halfWidth: 14 },
  subadult: { height: 1.5, halfWidth: 14 },
  prime: { height: 3, halfWidth: 15 },
  elder: { height: 5, halfWidth: 16 },
};

/** Muzzle length, applied as a horizontal scale about the neck joint. */
const FACE_LENGTH: Record<Age, number> = { juvenile: 0.85, subadult: 0.93, prime: 1, elder: 1.06 };

/** Juveniles carry a proportionally larger cranium on a smaller frame. */
const HEAD_SCALE: Record<Age, number> = { juvenile: 0.74, subadult: 0.77, prime: 0.8, elder: 0.83 };

/**
 * The silver saddle, as a gradient mantle over the back rather than a filled band:
 * `solid` is where the silver is still at full strength and `fade` where it has gone,
 * both as fractions along an axis running down from the withers. A hard-edged band
 * reads as a waterline across the body; the whole point is that it look like fur.
 */
const SADDLE: Record<Silver, { solid: number; fade: number; opacity: number; light: boolean } | null> = {
  none: null,
  flecked: { solid: 0.0, fade: 0.3, opacity: 0.26, light: false },
  "part-silver": { solid: 0.12, fade: 0.55, opacity: 0.44, light: false },
  full: { solid: 0.15, fade: 0.62, opacity: 0.55, light: true },
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
function crestPath(height: number, halfWidth: number): string {
  if (height <= 0) return "";
  const cx = 26;
  const left = cx - halfWidth;
  const right = cx + halfWidth;
  const base = 28;
  const peak = 14 - height;
  const top = base + (peak - base) / 0.75;
  return `M${left} ${base} C${left} ${top} ${right} ${top} ${right} ${base} Z`;
}

export function ApeGlyph({ id, age, build, silver, scar, size = 56 }: ApeGlyphProps) {
  const { sx, sy, limb } = BUILD_SCALE[build];
  const crest = CREST[age];
  const saddle = SADDLE[silver];

  const uid = `ape-${id}-${age}-${build}-${silver}`;
  const torsoClip = `${uid}-torso`;
  const outsideClip = `${uid}-outside`;
  const headClip = `${uid}-head`;
  const saddleFill = `${uid}-saddle`;

  const bark = "var(--bark)";
  const forest = "var(--forest)";
  const mist = "var(--mist)";
  const paper = "var(--paper)";
  const blood = "var(--blood)";

  // Build scales the torso about the belly line, so bulk grows upward into the
  // shoulder hump rather than sinking the animal through the ground.
  const torsoTransform = `translate(58 72) scale(${sx} ${sy}) translate(-58 -72)`;
  // Age scales the face about the neck joint, so only the muzzle lengthens. The joint
  // is pinned inside the chest, which is what keeps the neck from showing.
  const hs = HEAD_SCALE[age];
  const headTransform = `translate(40 30) scale(${FACE_LENGTH[age] * hs} ${hs}) translate(-40 -30)`;
  // Limb thickness scales about each limb's own long axis, feet staying on the ground.
  const limbTransform = (cx: number) =>
    `translate(${cx} 88) scale(${limb} ${1 + (limb - 1) * 0.3}) translate(-${cx} -88)`;

  const crestD = crestPath(crest.height, crest.halfWidth);

  // Fur texture: a few flecks over the back so same-trait apes still read as
  // individuals. Clipped to the torso, so they never escape the silhouette.
  const fleckCount = silver === "flecked" ? 30 : 14;
  const speckles: Array<[number, number, number]> = [];
  for (let i = 0; i < fleckCount; i++) {
    const x = 38 + speckleNoise(id + 17, i * 3) * 48;
    const y = 32 + speckleNoise(id + 43, i * 3 + 1) * 34;
    const r = 0.5 + speckleNoise(id + 71, i * 3 + 2) * 0.8;
    speckles.push([x, y, r]);
  }

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <defs>
        <clipPath id={torsoClip}>
          <path d={TORSO} transform={torsoTransform} />
        </clipPath>
        {/* Everything except the torso, via an even-odd compound path. Limb contours
            are clipped to this so no outline is drawn where a limb is buried. */}
        <clipPath id={outsideClip}>
          <path d={`M-200 -200H300V300H-200Z ${TORSO}`} clipRule="evenodd" transform={torsoTransform} />
        </clipPath>
        <clipPath id={headClip}>
          <g transform={headTransform}>
            <path d={CRANIUM} />
            <path d={MUZZLE} />
            {crestD ? <path d={crestD} /> : null}
          </g>
        </clipPath>
        {saddle ? (
          // Axis runs down and slightly forward from the withers, i.e. across the
          // back rather than straight down the page.
          <linearGradient id={saddleFill} gradientUnits="userSpaceOnUse" x1={58} y1={29} x2={46} y2={72}>
            <stop offset={0} stopColor={saddle.light ? paper : mist} stopOpacity={saddle.opacity} />
            <stop offset={saddle.solid} stopColor={saddle.light ? paper : mist} stopOpacity={saddle.opacity} />
            <stop offset={saddle.fade} stopColor={saddle.light ? paper : mist} stopOpacity={0} />
          </linearGradient>
        ) : null}
      </defs>

      {/* Far-side limbs sit behind the body in the darkest value so they recede. */}
      <g fill={forest}>
        <path d={FAR_FORELIMB} transform={limbTransform(42)} />
        <path d={FAR_HINDLIMB} transform={limbTransform(76)} />
      </g>

      {/* Torso */}
      <path d={TORSO} transform={torsoTransform} fill={bark} />

      {/* Near limbs are filled before the saddle so the mantle washes over the part of
          each limb that is buried in the chest. Filling them afterwards leaves the
          limb's straight buried edge showing as a rectangle across the silver. */}
      <g fill={bark}>
        <path d={HINDLIMB} transform={limbTransform(64)} />
        <path d={FORELIMB} transform={limbTransform(36)} />
      </g>

      {/* Silver mantle over the back, plus fur flecks. */}
      <g clipPath={`url(#${torsoClip})`}>
        {saddle ? <rect x={0} y={0} width={100} height={100} fill={`url(#${saddleFill})`} /> : null}
        {speckles.map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r} fill={paper} opacity={silver === "flecked" ? 0.26 : 0.1} />
        ))}
      </g>

      {/* Limb contours, only where a limb actually emerges from the body. */}
      <g fill="none" stroke={forest} strokeWidth={1.8} strokeLinejoin="round" clipPath={`url(#${outsideClip})`}>
        <path d={HINDLIMB} transform={limbTransform(64)} />
        <path d={FORELIMB} transform={limbTransform(36)} />
      </g>

      {/* Head */}
      <g transform={headTransform} fill={bark}>
        {crestD ? <path d={crestD} /> : null}
        <path d={CRANIUM} />
        <path d={MUZZLE} />
      </g>

      {/* Crown cap: the emoji's darker skull patch, stopping above the brow. */}
      <g clipPath={`url(#${headClip})`}>
        <ellipse cx={27} cy={10} rx={20} ry={18} fill={forest} opacity={0.8} />
      </g>

      {/* Face: brow shelf, deep-set eye, broad nose, mouth line, small ear. */}
      <g transform={headTransform}>
        <path d="M9 34 C13 30 20 29 26 31" stroke={forest} strokeWidth={2.6} fill="none" strokeLinecap="round" />
        <circle cx={14.5} cy={36.5} r={1.5} fill={paper} />
        <path d="M6.5 42.5 C8.5 41.5 10.5 41.5 12 42.5" stroke={forest} strokeWidth={1.6} fill="none" strokeLinecap="round" />
        <path d="M7 47 C11 49.5 16 50 20 49" stroke={forest} strokeWidth={1.5} fill="none" strokeLinecap="round" />
        <path d="M35 29 A3.2 3.2 0 1 1 35 35.5" stroke={forest} strokeWidth={1.6} fill="none" />

        {/* Scar: one diagonal stroke across the crown, brow and cheek. Drawn in head
            space so it scales with the skull, and routed wide of the eye at (14.5,36.5)
            — it must never paint over it. */}
        {scar ? (
          <path d="M27 21 L18 39" stroke={blood} strokeWidth={2.3} strokeLinecap="round" fill="none" />
        ) : null}
      </g>
    </svg>
  );
}
