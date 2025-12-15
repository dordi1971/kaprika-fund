export default function ProjectRecordLoading() {
  return (
    <main className="container">
      <div className="contentFrame">
        <section className="section">
          <span className="metaLabel">Project Record</span>
          <div className="skeletonBlock" style={{ height: 34, width: "70%" }} />
          <div style={{ height: 12 }} />
          <div className="skeletonLine" style={{ width: 420 }} />
          <div style={{ height: 18 }} />
          <div className="card" style={{ background: "var(--surface)" }}>
            <div className="skeletonBlock" style={{ height: 90 }} />
          </div>
        </section>

        {Array.from({ length: 6 }).map((_, index) => (
          <section key={index} className="section">
            <div className="skeletonLine" style={{ width: 220 }} />
            <div style={{ height: 14 }} />
            <div className="skeletonBlock" style={{ height: 72 }} />
          </section>
        ))}
      </div>
    </main>
  );
}

