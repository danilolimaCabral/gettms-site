import ScrollStage from "@/components/site/ScrollStage";
import SiteHeader from "@/components/site/SiteHeader";
import TrackingScene from "@/components/site/TrackingScene";
import MaturityScene from "@/components/site/MaturityScene";
import ContactScene from "@/components/site/ContactScene";
import SegmentsScenes from "@/components/site/SegmentsScenes";
import PlatformScenes from "@/components/site/PlatformScenes";
import DesktopScene from "@/components/site/DesktopScene";
import ControlTower from "@/components/site/ControlTower";
import Steps from "@/components/site/Steps";
import JourneyRecap from "@/components/site/JourneyRecap";
import Modalities from "@/components/site/Modalities";
import Faq from "@/components/site/Faq";
import Clients from "@/components/site/Clients";
import SiteFooter from "@/components/site/SiteFooter";
import Mia from "@/components/site/Mia";

export default function Home() {
  return (
    <div id="top" className="relative min-h-screen bg-paper">
      <SiteHeader />
      <main id="conteudo" className="relative z-10">
        <ScrollStage />
        <SegmentsScenes />
        <Modalities />
        <PlatformScenes />
        <ControlTower />
        <DesktopScene />
        <TrackingScene />
        <MaturityScene />
        <Steps />
        <Clients />
        <JourneyRecap />
        <Faq />
        <ContactScene />
      </main>
      <SiteFooter />
      <Mia />
    </div>
  );
}
