import { SurveyList } from "@/components/admin/survey-list";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-6xl px-6 py-5">
          <p className="text-sm font-medium text-primary">PE-mini</p>
          <h1 className="text-2xl font-bold">조사 관리</h1>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <SurveyList />
      </main>
    </div>
  );
}
