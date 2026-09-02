import { BecomeTheLoop } from "@/components/landing/become-the-loop";
import { Capabilities } from "@/components/landing/capabilities";
import { Hero } from "@/components/landing/hero";
import { TeamWorkflows } from "@/components/landing/team-workflows";
import { Trust } from "@/components/landing/trust";
import { SiteFooter } from "@/components/site-footer";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-[1120px] px-7">
      <Hero />
      <Capabilities />
      <BecomeTheLoop />
      <TeamWorkflows />
      <Trust />
      <SiteFooter />
    </main>
  );
}
