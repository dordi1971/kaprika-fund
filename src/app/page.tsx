import Link from "next/link";
import ObserverCollapse from "@/components/ObserverCollapse";
import { CreatorIcon, MainLogoIcon, ObserverIcon } from "@/components/SystemIcons";

export default function Home() {
  return (
    <main className="container">
      <ObserverCollapse />
      <div className="contentFrame">
        <section className="section sectionHero thresholdHero">
          <div className="superpositionMark" aria-hidden="true">
            <MainLogoIcon className="mainLogo superMark superMarkA" title="System mark" />
            <MainLogoIcon className="mainLogo superMark superMarkB" title="System mark" />
          </div>

          <span className="metaLabel">001 // Threshold</span>
          <h1 className="pageTitle">You are entering a different system.</h1>

          <p>
            Structure first.
            <br />
            Consequences follow.
          </p>
          <p className="muted">
            If this feels uncomfortable,
            <br />
            you are paying attention.
            
          </p>

          <p className="highlight">
            Some call this a rabbit hole.<br />
Not because it deceives —<br />
but because it does not pretend to be simple.
            <br />
            
          </p>
          <span className="metaLabel">002 // Entry Protocol</span>
          <p>Action here is always explicit. <br />Choose how you wish to begin.</p>
          <div className="btnGroup thresholdGate" style={{ marginTop: 22 }}>
            <Link className="actionBtn" href="/observe">
<ObserverIcon className="iconBox" title="Observer" />
              <h3>The Observer</h3>
              <p className="muted">You may begin as an observer.</p>
              <p>
                Observers are not outside the system.
                <br />
                They are simply not acting yet.
              </p>

              <div className="hr" />
              <p className="muted">
                Nothing is hidden from observers.
                <br />
                Nothing is simplified for them.
              </p>
              <p className="muted">
                Observation is not neutrality.
                <br />
                It is preparation.
              </p>
            </Link>
            <Link className="actionBtn" href="/propose">
<CreatorIcon className="iconBox" title="Creator" />
              <h3>The Creator</h3>
              <p className="muted">Some observers decide to speak.</p>
              <p className="muted">
                To propose an idea.
                <br />
                To define a structure.
                <br />
                To accept evaluation.
              </p>
              <div className="hr" />

              <p className="muted">
                What you present is what others evaluate.
                <br />
                No more. No less.
              </p>
            </Link>
          </div>

          <details className="details detailsCompact" style={{ marginTop: 22 }}>
            <summary>Context (optional)</summary>
            <div className="detailsContent">
              <ul className="listPlain" style={{ marginTop: 0 }}>
                <li>&gt; Projects are defined explicitly.</li>
                <li>&gt; Funding rules are visible.</li>
                <li>&gt; Actions are traceable.</li>
                <li>&gt; The interface will not comfort you.</li>
              </ul>
            </div>
          </details>
        </section>
      </div>
    </main>
  );
}
