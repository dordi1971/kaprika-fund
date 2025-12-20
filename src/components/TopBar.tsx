"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";
import { MainLogoIcon } from "@/components/SystemIcons";
import WalletButton from "@/components/WalletButton";
import HelpButton from "@/components/help/HelpButton";
import MobileTopActions from "@/components/MobileTopActions";
import { useAccount } from "wagmi";

function isDeskPath(pathname: string) {
  return pathname === "/desk" || pathname.startsWith("/desk/");
}
function isObservePath(pathname: string) {
  return pathname === "/observe" || pathname.startsWith("/projects/");
}

function isProposePath(pathname: string) {
  return pathname === "/propose" || pathname.startsWith("/propose/") || pathname.startsWith("/creator");
}

function getMobileLabel(pathname: string) {
  if (!pathname) return "Home";
  if (pathname === "/" || pathname.startsWith("/home")) return "Home";
  if (pathname.startsWith("/observe") || pathname.startsWith("/projects")) return "Observe";
  if (pathname.startsWith("/desk")) return "Desk";
  if (pathname.startsWith("/propose") || pathname.startsWith("/creator")) return "Propose";
  if (pathname.startsWith("/onchain/")) return "Project";
  if (pathname.startsWith("/connect")) return "Connect";
  return "Home";
}

export default function TopBar() {
  const pathname = usePathname() ?? "/";
  const { isConnected } = useAccount();
  const mobileLabel = getMobileLabel(pathname);

  return (
    <header className="topBar" role="banner">
      <div className="topBarInner container">
        <div className="topBarBrand">
          <Link href="/" aria-label="System entry">
            <span className="topBarBrandRow">
              <MainLogoIcon className="topBarMark" size={22} />
              <span className="topBarBrandText">System_Index // Prototype</span>
            </span>
          </Link>
        </div>

        <div className="topBarCenter" style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
          <div className="mobileOnly" style={{ alignItems: "center" }}>
            <span className="topBarBrandText">{mobileLabel}</span>
          </div>
        </div>

        <div className="topBarActions">
          <nav className="topBarNav desktopOnly">
            <Link className={`topBarLink ${isObservePath(pathname) ? "active" : ""}`} href="/observe">
              Observe
            </Link>

            {isConnected && (
              <Link className={`topBarLink ${isDeskPath(pathname) ? "active" : ""}`} href="/desk">
                Desk
              </Link>
            )}

            <Link className={`topBarLink ${isProposePath(pathname) ? "active" : ""}`} href="/propose">
              Propose
            </Link>
          </nav>
          <div style={{ display: "inline-flex", gap: 10, alignItems: "center" }}>
            <HelpButton />
            <div className="mobileOnly">
              <MobileTopActions />
            </div>
            <div className="desktopOnly topBarUtilityGroup">
              <WalletButton />
              <ThemeToggle />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
