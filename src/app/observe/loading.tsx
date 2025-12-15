export default function ObserveLoading() {
  return (
    <main className="container">
      <div className="contentFrame">
        <section className="section">
          <span className="metaLabel">Observer Index</span>
          <div className="indexMeta">
            <span className="skeletonLine" style={{ width: 320 }} />
            <span className="skeletonLine" style={{ width: 220 }} />
          </div>

          <div style={{ display: "grid", gap: 14 }}>
            {Array.from({ length: 7 }).map((_, index) => (
              <div
                key={index}
                className="skeletonBlock"
                style={{ height: 44, borderRadius: 10 }}
              />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

