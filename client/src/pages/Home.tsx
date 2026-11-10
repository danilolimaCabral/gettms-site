import ScrollStage from "@/components/site/ScrollStage";
import SiteHeader from "@/components/site/SiteHeader";
import Segments from "@/components/site/Segments";
import Platform from "@/components/site/Platform";
import Maturity from "@/components/site/Maturity";
import Tracking from "@/components/site/Tracking";
import Steps from "@/components/site/Steps";
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
        <Segments />
        <Platform />
        <Maturity />
        <Tracking />
        <Steps />
        <Clients />
        <FinalCta />
      </main>
      <SiteFooter />
      <Mia />
    </div>
  );
}
