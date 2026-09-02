import { Stepper } from "@/components/convergence/stepper";
import {
  Glossary,
  Masthead,
  PipelineCompare,
  Safety,
  SiteFooter,
  WhyItStops,
} from "@/components/convergence/sections";

export default function Home() {
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
