import ScrollStage from "@/components/site/ScrollStage";
import SiteHeader from "@/components/site/SiteHeader";
import ScrollFlow from "@/components/site/ScrollFlow";
import SegmentsScenes from "@/components/site/SegmentsScenes";
import PlatformScenes from "@/components/site/PlatformScenes";
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
        <SegmentsScenes />
        <PlatformScenes />
        <ScrollFlow id="maturidade">
          <Maturity />
        </ScrollFlow>
        <ScrollFlow id="tracking">
          <Tracking />
        </ScrollFlow>
        <ScrollFlow id="implantacao">
          <Steps />
        </ScrollFlow>
        <ScrollFlow id="clientes">
          <Clients />
        </ScrollFlow>
        <ScrollFlow id="contato">
          <FinalCta />
        </ScrollFlow>
      </main>
      <SiteFooter />
      <Mia />
    </div>
  );
}
