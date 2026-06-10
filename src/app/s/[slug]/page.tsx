import { EvaluationHome } from "@/components/participant/evaluation-home";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function ParticipantHomePage({ params }: PageProps) {
  const { slug } = await params;

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-lg px-4 py-6 pb-12">
        <EvaluationHome slug={slug} />
      </main>
    </div>
  );
}
