export function getHelpKey(pathname: string): string {
  if (!pathname) return "home";
  if (pathname === "/" || pathname.startsWith("/home")) return "home";
  if (pathname.startsWith("/observe")) return "observe";
  if (pathname.startsWith("/projects")) return "observe";
  if (pathname.startsWith("/desk")) return "desk";
  if (pathname.startsWith("/propose")) return "propose";
  if (pathname.startsWith("/creator")) return "propose";
  if (pathname.startsWith("/onchain/")) return "onchainProject";
  return "home";
}
