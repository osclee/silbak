import styles from "./About.module.css";

const NAMED_NOTES: [string, string][] = [
  ["Kivu steps aside when Chui approaches.", "Chui ranks above Kivu — anywhere above."],
  ["Mvua and Uzuri — no one ranks in between.", "They hold neighbouring rungs, in either order."],
  ["3 of the troop groom below Bahati.", "Bahati is on rung 3 exactly."],
  ["Enzi is not the silverback.", "Rules out rung 1 for Enzi and nothing else."],
  ["Nkosi ranks in the top three.", "Rung 1, 2 or 3."],
  ["Tembo ranks below Dogora but above Nkosi.", "Dogora, then Tembo, then Nkosi — not necessarily adjacent."],
  ["Fahari is the silverback.", "Rung 1, done."],
];

const TRAIT_NOTES: [string, string][] = [
  ["Every elder outranks every subadult.", "Find the elders and the subadults on the ladder; each elder sits above all the subadults."],
  ["Every scarred ape ranks outside the top two.", "None of the scarred apes is on rung 1 or 2."],
  ["The omega is a juvenile.", "Rung 6 holds one of the juveniles — it doesn't say which."],
  ["The silverback is not full-silver.", "Rules out every full-silver ape for rung 1."],
  ["The two heavy apes hold neighbouring rungs.", "Somewhere on the ladder they sit one directly above the other."],
  ["Exactly one of the three flecked apes ranks in the top three.", "One in the top half, the other two in the bottom half."],
  ["A prime stands directly above a part-silver ape.", "At least one such neighbouring pair exists — maybe more."],
];

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
        <p>
          After each guess the troop tells you <strong>how many</strong> apes stand on their true rung —{" "}
          <em>not which ones</em>. "4 of 6" means four are right and two are swapped somewhere; "0 of 6"
          means every ape on that guess is on the wrong rung. You get six guesses.
        </p>
        <p>
          Working out <em>which</em> apes were right is the game. Compare guesses that differ by one swap, and
          write what you learn into the <strong>ledger</strong> under the board (✗ ruled out, ✓ confirmed) —
          the ledger is yours, nothing in it is checked for you, except that a 0 fills itself in.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Field notes</h2>
        <p>
          Before your first guess, a handful of true observations narrow the possibilities — but never enough to
          solve the puzzle outright. Some name apes; some talk about a <em>kind</em> of ape, and the first job
          is working out which apes that is.
        </p>
        <h3>Named notes</h3>
        <dl className={styles.examples}>
          {NAMED_NOTES.map(([note, meaning]) => (
            <div key={note}>
              <dt>{note}</dt>
              <dd>{meaning}</dd>
            </div>
          ))}
        </dl>
        <h3>Notes about a kind of ape</h3>
        <p>
          "Every", "the two", "exactly one of the three" — these count apes by a trait you can read off the
          ladder. A kind always has at least two apes in it, and never the whole troop.
        </p>
        <dl className={styles.examples}>
          {TRAIT_NOTES.map(([note, meaning]) => (
            <div key={note}>
              <dt>{note}</dt>
              <dd>{meaning}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className={styles.section}>
        <h2>Reading the room</h2>
        <p>
          Traits correlate with rank, but not perfectly: reading the room gets you close, the guesses get you
          the rest of the way. A trait-perfect first guess is right only about one day in seven.
        </p>
        <p className={styles.legend}>Age — juvenile · subadult · prime · elder. Prime ranks highest, elder close behind.</p>
        <p className={styles.legend}>Silvering — no silver · flecked · part-silver · full silver. More silver, higher rank.</p>
        <p className={styles.legend}>Build — slight · solid · heavy. Heavier ranks higher, but it's a smaller factor.</p>
        <p className={styles.legend}>Scar — flavour only, doesn't reliably indicate rank.</p>
      </section>

      <section className={styles.section}>
        <h2>Par and sharing</h2>
        <p>
          Each weekday has a <strong>par</strong> — the number of guesses a careful player needs. Mondays and
          Sundays are gentler, Saturdays are not. Your result copies as a grid of 🍌 and 🪨 with the par on the first line —
          no names, no positions, nothing that spoils the answer. Solve in one and the line earns a 🥇.
        </p>
      </section>
    </div>
  );
}
