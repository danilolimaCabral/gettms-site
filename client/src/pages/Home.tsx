import ScrollStage from "@/components/site/ScrollStage";
import SiteHeader from "@/components/site/SiteHeader";
import TrackingScene from "@/components/site/TrackingScene";
import MaturityScene from "@/components/site/MaturityScene";
import ContactScene from "@/components/site/ContactScene";
import SegmentsScenes from "@/components/site/SegmentsScenes";
import PlatformScenes from "@/components/site/PlatformScenes";
import DesktopScene from "@/components/site/DesktopScene";
import Clients from "@/components/site/Clients";
import SiteFooter from "@/components/site/SiteFooter";
import Mia from "@/components/site/Mia";

export default function Home() {
  return (
    <div id="top" className="relative min-h-screen bg-paper">
      <SiteHeader />
      <main className="relative z-10">
        <ScrollStage />
        <SegmentsScenes />
        <PlatformScenes />
        <DesktopScene />
        <TrackingScene />
        <MaturityScene />
        <ContactScene />
        <Clients />
      </main>
      <SiteFooter />
      <Mia />
    </div>
  );
}
