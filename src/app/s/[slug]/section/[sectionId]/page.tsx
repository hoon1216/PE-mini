import { SectionEvaluation } from "@/components/participant/section-evaluation";

type PageProps = {
  params: Promise<{ slug: string; sectionId: string }>;
};

export default async function SectionEvaluationPage({ params }: PageProps) {
  const { slug, sectionId } = await params;

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-lg px-4 py-6 pb-12">
        <SectionEvaluation slug={slug} sectionId={sectionId} />
      </main>
    </div>
  );
}
