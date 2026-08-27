import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.main}>
      <h1>Next.js + GitHub Actions</h1>
      <p>This app is built and tested automatically by GitHub Actions.</p>
    </main>
  );
}