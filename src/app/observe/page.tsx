import ProjectsTable from "@/components/ProjectsTable";
import { PROJECTS } from "@/lib/projects";

export const metadata = {
  title: "OBSERVER INDEX // RAW_DATA",
};

export default function ObservePage() {
  return (
    <main className="container">
      <div className="contentFrame">
        <section className="section">
          <span className="metaLabel">Observer Index</span>
          <div className="indexMeta">
            <span>SHOWING ALL RECORDS // NO FILTERS APPLIED</span>
            <span>SORT: CHRONOLOGICAL_DESC</span>
          </div>
          <ProjectsTable projects={PROJECTS} />
        </section>
      </div>
    </main>
  );
}

