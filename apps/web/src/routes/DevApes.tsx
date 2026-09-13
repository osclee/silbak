import type { Age, Build, Silver } from "@silbak/engine";
import { ApeGlyph } from "../components/ApeGlyph";
import rung from "../components/Rung.module.css";
import styles from "./DevApes.module.css";

/**
 * Dev-only portrait matrix (`/dev/apes`, mounted only when `import.meta.env.DEV`).
 *
 * Renders every trait combination the engine can actually produce, each at the
 * 56px rung size and at the 46px legibility floor from DESIGN.md §6, inside the
 * same --rock disc a real rung uses. Exists because portrait proportions have been
 * got wrong repeatedly; eyeballing the whole matrix is the only test there is.
 *
 * The trait lists and the age→silver cap mirror packages/engine/src/troop.ts.
 * They are display-only here — if the engine's gating changes, update both.
 */
const AGES: readonly Age[] = ["juvenile", "subadult", "prime", "elder"];
const BUILDS: readonly Build[] = ["slight", "solid", "heavy"];
const SILVERS: readonly Silver[] = ["none", "flecked", "part-silver", "full"];
const SILVER_CAP: Record<Age, Silver> = {
  juvenile: "flecked",
  subadult: "part-silver",
  prime: "full",
  elder: "full",
};

export function DevApes() {
  let n = 0;
  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>Portrait matrix</h1>
      <p className={styles.note}>
        Every valid age × build × silver × scar tuple, at 56px (rung size) and 46px (legibility floor).
      </p>
      {AGES.map((age) => {
        const cap = SILVERS.indexOf(SILVER_CAP[age]);
        return (
          <section key={age} className={styles.section}>
            <h2 className={styles.age}>{age}</h2>
            <div className={styles.grid}>
              {BUILDS.map((build) =>
                SILVERS.slice(0, cap + 1).map((silver) =>
                  [false, true].map((scar) => {
                    const id = n++ % 6;
                    return (
                      <div key={`${build}-${silver}-${scar}`} className={styles.cell}>
                        <span className={rung.portrait}>
                          <ApeGlyph id={id} age={age} build={build} silver={silver} scar={scar} size={56} />
                        </span>
                        <span className={rung.portrait} style={{ width: 46, height: 46 }}>
                          <ApeGlyph id={id} age={age} build={build} silver={silver} scar={scar} size={46} />
                        </span>
                        <span className={styles.label}>
                          {build} · {silver}
                          {scar ? " · scar" : ""}
                        </span>
                      </div>
                    );
                  }),
                ),
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export default DevApes;
