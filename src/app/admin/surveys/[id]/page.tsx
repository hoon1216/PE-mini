import { SurveyDashboardShell } from "@/components/admin/survey-dashboard-shell";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function SurveyDashboardPage({ params }: PageProps) {
  const { id } = await params;

  return <SurveyDashboardShell surveyId={id} />;
}
