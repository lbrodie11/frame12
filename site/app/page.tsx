import { HomeDashboard } from '@/components/home-dashboard';
import { HowAFrameGetsMade } from '@/components/how-a-frame-gets-made';

// Server component: the hero dashboard is interactive (client), the story's drawing and captions
// are rendered here on the server so only its small Play/scroll shell ships as JavaScript.
export default function HomePage() {
  return <HomeDashboard story={<HowAFrameGetsMade nextId="home-install" />} />;
}
