import ConnectGate from "@/components/ConnectGate";

export const metadata = {
  title: "PROPOSE // PREFACE",
};

export default function ProposePrefacePage() {
  return (
    <main className="container">
      <div className="contentFrame">
        <section className="section sectionHero">
          <span className="metaLabel">Creator Preface</span>
          <h1 className="pageTitle">Propose</h1>
          <p className="callout">
            Proposing a project is not publishing content.
            <br />
            It is defining a structure others may choose to support.
          </p>
          <p className="muted">
            Nothing will be promoted for you.
            <br />
            Nothing will be hidden either.
          </p>
          <div style={{ marginTop: 22, display: "flex", justifyContent: "center" }}>
            <ConnectGate
              buttonLabel="Continue to define your project"
              connectHref="/connect?next=/creator"
            />
          </div>
        </section>
      </div>
    </main>
  );
}
