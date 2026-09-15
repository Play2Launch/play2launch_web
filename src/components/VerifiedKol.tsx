import { BadgeCheck } from 'lucide-react';
export function VerifiedKol({ avatar = false }: { avatar?: boolean }) {
  return <span className={avatar ? 'kol-avatar-badge' : 'kol-name-badge'} role="img" aria-label="Verified KOL" title="Verified KOL · Community identity verified, not an investment endorsement">
    <BadgeCheck size={avatar ? 20 : 15} aria-hidden="true" />{!avatar && <span>KOL</span>}
  </span>;
}
