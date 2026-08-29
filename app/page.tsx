import Link from "next/link";
import { ArrowRight, ClipboardCheck, Highlighter, ScanText, Sparkles, type LucideIcon } from "lucide-react";
import TopBar from "@/components/TopBar";

function FeatureCard({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-4 text-left">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600">
        <Icon size={16} />
      </span>
      <span className="text-xs font-medium text-neutral-600">{label}</span>
    </div>
  );
}

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-neutral-50">
      <TopBar />

      <main className="flex flex-1 items-center justify-center px-4 py-14 sm:px-8">
        <div className="w-full max-w-2xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FBEAD3] px-3 py-1 text-xs font-semibold text-[#D9782F]">
            <Sparkles size={13} />
            AI Teacher&apos;s Toolkit
          </span>

          <h1 className="mt-5 text-3xl font-bold leading-snug text-neutral-900 sm:text-4xl">Welcome to VedaAI</h1>

          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-neutral-500 sm:text-base">
            Upload a question paper and a student&apos;s handwritten answer sheet. VedaAI extracts the questions and
            answers, maps them together, highlights exactly where each answer appears, and generates AI-powered
            grading and feedback.
          </p>

          <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <FeatureCard icon={ScanText} label="Extracts questions & answers" />
            <FeatureCard icon={Highlighter} label="Highlights where each answer appears" />
            <FeatureCard icon={ClipboardCheck} label="AI grading & feedback" />
          </div>

          <Link
            href="/exams"
            className="mt-10 inline-flex items-center gap-2 rounded-full bg-neutral-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-neutral-800"
          >
            Start New Evaluation
            <ArrowRight size={16} />
          </Link>
        </div>
      </main>
    </div>
  );
}
