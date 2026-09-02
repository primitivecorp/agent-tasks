import { BecomeTheLoop } from "@/components/landing/become-the-loop";
import { Hero } from "@/components/landing/hero";
import { Lifecycle } from "@/components/landing/lifecycle";
import { Trust } from "@/components/landing/trust";
import { SiteFooter } from "@/components/site-footer";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-[1120px] px-7">
      <Hero />
      <Lifecycle />
      <BecomeTheLoop />
      <Trust />
      <SiteFooter />
    </main>
  );
}
