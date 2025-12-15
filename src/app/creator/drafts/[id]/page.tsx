import DraftEditorClient from "./ui/DraftEditorClient";

export const metadata = {
  title: "DRAFT // EDITOR",
};

type Props = {
  params: Promise<{ id: string }>;
};

export default async function DraftEditorPage({ params }: Props) {
  const { id } = await params;
  return <DraftEditorClient id={id} />;
}

