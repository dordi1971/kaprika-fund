import ProjectRecordClient from "./ui/ProjectRecordClient";

export const metadata = {
  title: "PROJECT RECORD // CREATOR",
};

type Props = {
  params: Promise<{ id: string }>;
};

export default async function CreatorProjectRecordPage({ params }: Props) {
  const { id } = await params;
  return <ProjectRecordClient id={id} />;
}

