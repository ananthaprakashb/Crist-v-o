import CristovaoApp from './CristovaoApp';
import SourceImpactDemoControl from './SourceImpactDemoControl';
import TimelinePreview from './TimelinePreview';

export default function AppRoot() {
  return (
    <>
      <SourceImpactDemoControl />
      <TimelinePreview />
      <CristovaoApp />
    </>
  );
}
