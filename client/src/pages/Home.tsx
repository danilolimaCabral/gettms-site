import ScrollStage from "@/components/site/ScrollStage";
import SiteHeader from "@/components/site/SiteHeader";
import SceneShell from "@/components/site/SceneShell";
import SegmentsScenes from "@/components/site/SegmentsScenes";
import PlatformScenes from "@/components/site/PlatformScenes";
import Maturity from "@/components/site/Maturity";
import Tracking from "@/components/site/Tracking";
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
        <SceneShell id="maturidade" height={150} dark={false} className="[&_section]:!py-0">
          <Maturity />
        </SceneShell>
        <SceneShell id="tracking" height={170} dark={false} className="[&_section]:!py-0">
          <Tracking />
        </SceneShell>
        <SceneShell id="contato" height={160} dark={false} className="[&_section]:!py-0">
          <FinalCta />
        </SceneShell>
        <Clients />
      </main>
      <SiteFooter />
      <Mia />
    </div>
  );
}
