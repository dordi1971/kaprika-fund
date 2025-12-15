import { Suspense } from "react";
import ConnectClient from "./ConnectClient";

export const metadata = {
  title: "CONNECT // INTERFACE",
};

export default function ConnectPage() {
  return (
    <Suspense
      fallback={
        <main className="container">
          <div className="contentFrame">
            <section className="section">
              <span className="metaLabel">Interface</span>
              <div className="skeletonBlock" style={{ height: 34, width: "50%" }} />
              <div style={{ height: 14 }} />
              <div className="skeletonBlock" style={{ height: 92 }} />
            </section>
          </div>
        </main>
      }
    >
      <ConnectClient />
    </Suspense>
  );
}

