// Rend scene.html image par image (24 fps, 10 s) puis assemble la vidéo avec ffmpeg.
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const FPS = 24, DURATION = 10;
const dir = __dirname;
const framesDir = process.argv[2];           // dossier temporaire des images
const out = process.argv[3];                 // vidéo de sortie

(async () => {
  fs.mkdirSync(framesDir, { recursive: true });
  if (!process.env.SKIP_FRAMES) {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });
    await page.goto('file://' + path.join(dir, 'scene.html'));
    const n = FPS * DURATION;
    for (let i = 0; i < n; i++) {
      await page.evaluate(t => window.render(t), i / FPS);
      await page.screenshot({ path: path.join(framesDir, `f${String(i).padStart(4, '0')}.png`) });
    }
    await browser.close();
  }

  // bande-son synthétique : ronronnement de cabine + battements au compte à rebours + choc final
  const audio =
    "aevalsrc='" +
    "0.10*sin(2*PI*52*t)+0.05*sin(2*PI*104*t+1)" +
    "+0.55*gte(t,5.0)*exp(-9*(t-5.0))*sin(2*PI*55*(t-5.0))" +
    "+0.55*gte(t,6.2)*exp(-9*(t-6.2))*sin(2*PI*55*(t-6.2))" +
    "+0.65*gte(t,7.4)*exp(-9*(t-7.4))*sin(2*PI*55*(t-7.4))" +
    "+0.30*gte(t,1.0)*exp(-6*(t-1.0))*sin(2*PI*1320*(t-1.0))" +
    "+0.80*gte(t,9.0)*exp(-7*(t-9.0))*sin(2*PI*40*(t-9.0))" +
    `':d=${DURATION}:s=44100`;

  execFileSync('ffmpeg', [
    '-y', '-framerate', String(FPS), '-i', path.join(framesDir, 'f%04d.png'),
    '-f', 'lavfi', '-i', audio,
    '-f', 'lavfi', '-i', `anoisesrc=color=brown:amplitude=0.35:d=${DURATION}:r=44100`,
    '-filter_complex', '[2:a]lowpass=f=420,volume=0.5[n];[1:a][n]amix=inputs=2:normalize=0,afade=t=in:d=0.4,afade=t=out:st=9.5:d=0.5[a]',
    '-map', '0:v', '-map', '[a]',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'medium',
    '-c:a', 'aac', '-b:a', '160k', '-shortest', out
  ], { stdio: 'inherit' });
})();
