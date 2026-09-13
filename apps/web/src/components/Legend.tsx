import styles from "./Legend.module.css";

export function Legend() {
  return (
    <div className={styles.legend} aria-hidden="true">
      <span className={styles.item}>
        <span className={`${styles.swatch} ${styles.exact}`} /> right rung
      </span>
      <span className={styles.item}>
        <span className={styles.wrong}>○</span> wrong rung
      </span>
    </div>
  );
}
