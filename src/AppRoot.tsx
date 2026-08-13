import CristovaoApp from './CristovaoApp';
import SourceImpactDemoControl from './SourceImpactDemoControl';
import TimelinePreview from './TimelinePreview';
import CheckpointPanel from './CheckpointPanel';

export default function AppRoot() {
  return (
    <>
      <SourceImpactDemoControl />
      <CheckpointPanel />
      <TimelinePreview />
      <CristovaoApp />
    </>
  );
}
