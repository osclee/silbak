import { Component, type ReactNode } from "react";
import styles from "./ErrorBoundary.module.css";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: unknown) {
    console.error("Silbak crashed:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className={styles.panel}>
          <p>Something went wrong — reload.</p>
        </div>
      );
    }
    return this.props.children;
  }
}
