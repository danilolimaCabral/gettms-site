import ScrollStage from "@/components/site/ScrollStage";
import SiteHeader from "@/components/site/SiteHeader";
import Clients from "@/components/site/Clients";
import FinalCta from "@/components/site/FinalCta";
import SiteFooter from "@/components/site/SiteFooter";
import Mia from "@/components/site/Mia";

export default function Home() {
  return (
    <div id="top" className="relative min-h-screen bg-paper">
      <SiteHeader />
      <main>
        <ScrollStage />
        <Clients />
        <FinalCta />
      </main>
      <SiteFooter />
      <Mia />
    </div>
  );
}
