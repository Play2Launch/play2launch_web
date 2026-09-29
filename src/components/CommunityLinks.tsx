import { ArrowUpRight, Radio, Users } from 'lucide-react';

export function CommunityLinks() {
  return <nav className="community-links" aria-label="P2L community">
    <a href="https://t.me/play2launch_G" target="_blank" rel="noopener noreferrer"><Users size={15} />Join TG Group<ArrowUpRight size={13} /></a>
    <a href="https://t.me/play2launch_C" target="_blank" rel="noopener noreferrer"><Radio size={15} />Join TG Channel<ArrowUpRight size={13} /></a>
    <a href="https://x.com/play2launch" target="_blank" rel="noopener noreferrer"><span aria-hidden="true">𝕏</span>Follow our X<ArrowUpRight size={13} /></a>
  </nav>;
}
