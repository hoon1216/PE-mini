import { SurveyEditShell } from "@/components/admin/survey-edit-shell";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function SurveyEditPage({ params }: PageProps) {
  const { id } = await params;

  return <SurveyEditShell surveyId={id} />;
}
