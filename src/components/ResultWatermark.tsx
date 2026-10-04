import { useState } from 'react';
import { publicAvatarURL } from '../lib/avatar';

export function ResultWatermark({ src }: { src?: string }) {
  const [failed, setFailed] = useState('');
  const safe = src && /^\/(?!\/)/.test(src) && !/[\\\s]/.test(src) ? src : publicAvatarURL(src);
  if (!safe || failed === safe) return null;
  return <img className="result-watermark" src={safe} alt="" aria-hidden="true" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(safe)}/>;
}
