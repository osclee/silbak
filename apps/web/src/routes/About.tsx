import styles from "./About.module.css";

export function About() {
  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>How to play</h1>

      <section className={styles.section}>
        <h2>The board</h2>
        <p>
          Six apes stand on a vertical ladder. Rung 1 is the <strong>silverback</strong>, the troop's most
          dominant ape. Rung 6 is the <strong>omega</strong>, the least. Tap an ape, then tap a second to swap
          them. Tap the same ape again to deselect.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Feedback</h2>
        <p className={styles.legend}>■ right rung</p>
        <p className={styles.legend}>○ wrong rung — no hint which way to move it</p>
        <p>Every rung always returns one of the two on every guess. You get six guesses.</p>
      </section>

      <section className={styles.section}>
        <h2>Field notes</h2>
        <p>
          Before your first guess, a handful of true observations narrow the possibilities — but never enough to
          solve the puzzle outright. Traits (age, build, silvering) correlate with rank, but not perfectly:
          reading the room gets you close, the guesses get you the rest of the way.
        </p>
        <p className={styles.legend}>Age — prime ranks highest, elder close behind, then subadult, then juvenile</p>
        <p className={styles.legend}>Silvering — more silver usually means higher rank</p>
        <p className={styles.legend}>Build — heavier usually ranks higher, but it's a smaller factor</p>
        <p className={styles.legend}>Scar — flavor only, doesn't reliably indicate rank</p>
      </section>

      <section className={styles.section}>
        <h2>Sharing</h2>
        <p>Your result copies as a grid of 🍌 and 🪨 — no names, no arrows, nothing that spoils the answer.</p>
      </section>
    </div>
  );
}
