"""Run after render-welcome.cjs; needs Pillow. No application dependencies change."""
from pathlib import Path
from PIL import Image

frames = [Image.open(p).convert('RGB') for p in sorted(Path('test-results/welcome-frames').glob('[0-9][0-9][0-9].png'))]
assert len(frames) == 80 and all(f.size == (640, 360) for f in frames)
# One shared palette prevents color flicker between frames.
sheet = Image.new('RGB', (640, 360 * 8))
for i in range(8):
    sheet.paste(frames[i*10], (0, i*360))
palette = sheet.quantize(colors=128)
indexed = [f.quantize(palette=palette, dither=Image.Dither.NONE) for f in frames]
output = Path('docs/brand/play2launch-bot-welcome.gif')
indexed[0].save(output, save_all=True, append_images=indexed[1:], duration=50, loop=0, optimize=True, disposal=1)
frames[0].save('docs/brand/play2launch-bot-welcome.png')
with Image.open(output) as check:
    assert check.size == (640, 360) and check.n_frames == 80 and check.info['loop'] == 0
    print(f'{output}: {check.size}, {check.n_frames} frames, 4s loop, {output.stat().st_size} bytes')
