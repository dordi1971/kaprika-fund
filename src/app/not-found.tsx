import Link from "next/link";

export default function NotFound() {
  return (
    <main className="container">
      <div className="contentFrame">
        <section className="section">
          <span className="metaLabel">{"// RECORD NOT FOUND"}</span>
          <h1 className="pageTitle">No record matches this address.</h1>
          <p className="muted">
            Nothing is hidden. This record simply does not exist in the current index.
          </p>
          <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
            <Link className="ghostBtn" href="/observe">
              Return to index
            </Link>
            <Link className="neutralBtn" href="/">
              Threshold
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
