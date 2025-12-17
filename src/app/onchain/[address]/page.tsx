import OnchainProjectClient from "./ui/OnchainProjectClient";

export default async function Page({ params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  return <OnchainProjectClient address={address} />;
}
