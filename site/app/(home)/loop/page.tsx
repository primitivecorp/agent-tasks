import type { Metadata } from "next";
import { Stepper } from "@/components/convergence/stepper";
import {
  Glossary,
  Masthead,
  PipelineCompare,
  Safety,
  SiteFooter,
  WhyItStops,
} from "@/components/convergence/sections";

export const metadata: Metadata = {
  title: "The Convergence Loop · agent-tasks",
  description:
    "One bug ticket, from the agent’s first edit to a change that is ready to merge — nine steps, every check shown as it happens.",
};

export default function LoopPage() {
  return (
    <main className="mx-auto w-full max-w-[1120px] px-7">
      <Masthead />
      <Stepper />
      <WhyItStops />
      <PipelineCompare />
      <Safety />
      <Glossary />
      <SiteFooter />
    </main>
  );
}
