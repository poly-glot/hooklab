import styles from './AppFooter.module.css';

export function AppFooter() {
  return (
    <footer className={styles.appFooter}>
      <span className={styles.appFooterText}>
        Usual copyright notice
      </span>
    </footer>
  );
}
