"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";
import { MainLogoIcon } from "@/components/SystemIcons";
import WalletButton from "@/components/WalletButton";

function isObservePath(pathname: string) {
  return pathname === "/observe" || pathname.startsWith("/projects/");
}

function isProposePath(pathname: string) {
  return pathname === "/propose" || pathname.startsWith("/propose/") || pathname.startsWith("/creator");
}

export default function TopBar() {
  const pathname = usePathname() ?? "/";

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

        <div className="topBarCenter" aria-hidden="true" />

        <div className="topBarActions">
          <nav className="topBarNav" aria-label="Primary">
            <Link
              className={`topBarLink ${isObservePath(pathname) ? "active" : ""}`}
              href="/observe"
            >
              Observe
            </Link>
            <Link
              className={`topBarLink ${isProposePath(pathname) ? "active" : ""}`}
              href="/propose"
            >
              Propose
            </Link>
          </nav>
          <WalletButton />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
