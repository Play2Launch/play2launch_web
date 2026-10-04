import { Gamepad2 } from 'lucide-react';

export function ResultGameLabel({ name }: { name: string }) {
  return <span className="result-game-label"><span className="result-game-icon" aria-hidden="true"><Gamepad2 size={17}/></span><span>{name}</span></span>;
}
