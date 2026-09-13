import { Link, Route, Routes } from "react-router-dom";
import { Daily } from "./routes/Daily";
import { Archive } from "./routes/Archive";
import { ArchivePuzzle } from "./routes/ArchivePuzzle";
import { About } from "./routes/About";
import { CanopyScene } from "./components/CanopyScene";
import styles from "./App.module.css";

export function App() {
  return (
    <div className={styles.appRoot}>
      <CanopyScene />
      <nav className={styles.nav}>
        <Link to="/" className={styles.link}>
          Today
        </Link>
        <Link to="/archive" className={styles.link}>
          Archive
        </Link>
        <Link to="/about" className={styles.link}>
          Rules
        </Link>
      </nav>
      <Routes>
        <Route path="/" element={<Daily />} />
        <Route path="/archive" element={<Archive />} />
        <Route path="/archive/:number" element={<ArchivePuzzle />} />
        <Route path="/about" element={<About />} />
      </Routes>
    </div>
  );
}
