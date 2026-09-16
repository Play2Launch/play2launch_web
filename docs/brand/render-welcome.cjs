// Run from repository root with sharp available on NODE_PATH.
const fs = require('node:fs');
const sharp = require('sharp');
const source = fs.readFileSync('docs/brand/play2launch-mark-green.svg', 'utf8');
const paths = [...source.matchAll(/<path d="([^"]+)"\s*\/>/g)].map(m => `<path d="${m[1]}"/>`).join('');
if (!paths) throw new Error('Logo paths missing');
const directory = 'test-results/welcome-frames';
fs.mkdirSync(directory, {recursive:true});
(async () => {
  for (let i=0;i<80;i++) {
    const phase = i/80 * Math.PI*2;
    const float = -4*Math.sin(phase);
    const scale = 1 + .012*Math.sin(phase);
    const sweep = -900+i*30;
    const transform = `translate(320 ${150+float}) scale(${.49*scale}) translate(-256 -256)`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
      <defs>
        <radialGradient id="halo"><stop stop-color="#29351a"/><stop offset="1" stop-color="#0b100a"/></radialGradient>
        <linearGradient id="shine" gradientUnits="userSpaceOnUse" x1="${sweep}" y1="512" x2="${sweep+600}" y2="0"><stop stop-color="#f5ffe0" stop-opacity="0"/><stop offset=".35" stop-color="#f5ffe0" stop-opacity="0"/><stop offset=".5" stop-color="#f5ffe0" stop-opacity=".7"/><stop offset=".65" stop-color="#f5ffe0" stop-opacity="0"/><stop offset="1" stop-color="#f5ffe0" stop-opacity="0"/></linearGradient>
        <clipPath id="mark"><g transform="${transform}">${paths}</g></clipPath>
      </defs>
      <rect width="640" height="360" fill="#0b100a"/>
      <ellipse cx="320" cy="155" rx="230" ry="155" fill="url(#halo)"/>
      <g transform="${transform}" fill="#d2fa69">${paths}</g>
      <g transform="${transform}" fill="url(#shine)">${paths}</g>
      <text x="320" y="293" text-anchor="middle" fill="#f3f4eb" font-family="Arial, sans-serif" font-size="29" font-weight="700" letter-spacing="1.5">PLAY TO LAUNCH</text>
      <path d="M292 319h56" stroke="#d2fa69" stroke-width="3" stroke-linecap="round" opacity=".7"/>
    </svg>`;
    await sharp(Buffer.from(svg)).png().toFile(`${directory}/${String(i).padStart(3,'0')}.png`);
  }
})();
