import OnchainProjectsTable from "@/components/OnchainProjectsTable";
import { getOnchainObserverIndex } from "@/lib/observe/onchainIndex";

export const metadata = {
  title: "OBSERVER INDEX // RAW_DATA",
};

export const revalidate = 15;

export default async function ObservePage() {
  const projects = await getOnchainObserverIndex();

  return (
    <main className="container">
      <div className="contentFrame">
        <section className="section">
          <span className="metaLabel">Observer Index</span>
          <div className="indexMeta">
            <span>SHOWING ON-CHAIN PROJECTS ONLY // FACTORY INDEX</span>
            <span>SORT: CHRONOLOGICAL_DESC</span>
          </div>
          {projects.length ? (
            <OnchainProjectsTable projects={projects} />
          ) : (
            <div className="muted" style={{ marginTop: 12 }}>
              No on-chain projects found (or factory not configured).
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
