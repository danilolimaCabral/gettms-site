import ScrollStage from "@/components/site/ScrollStage";
import SiteHeader from "@/components/site/SiteHeader";
import Clients from "@/components/site/Clients";
import Manifesto from "@/components/site/Manifesto";
import Segments from "@/components/site/Segments";
import Platform from "@/components/site/Platform";
import Steps from "@/components/site/Steps";
import Maturity from "@/components/site/Maturity";
import Tracking from "@/components/site/Tracking";
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
        <Manifesto />
        <Segments />
        <Platform />
        <Steps />
        <Maturity />
        <Tracking />
        <FinalCta />
      </main>
      <SiteFooter />
      <Mia />
    </div>
  );
}
