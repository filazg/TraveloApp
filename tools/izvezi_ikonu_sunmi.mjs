// Set ikona za Sunmi Partner Store: bijela podloga, plavo slovo, bez alfa
// kanala, u vise uobicajenih velicina — pa se odabere ona koju portal trazi.
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { ponovnoStisni } from 'file:///C:/Tech4beeZ/Projekti/TraveloApp/tools/png_ponovno.mjs'

const require = createRequire('file:///C:/Tech4beeZ/Projekti/TraveloApp/travelo-transactions-service/x.js')
const puppeteer = require('puppeteer')

const PLAVA = '#175BD0'
const IZLAZ = 'C:/Tech4beeZ/Projekti/TraveloApp/tools/ikona/sunmi'

const stranica = (v) => `
<!doctype html><html><head><meta charset="utf-8" />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@800&display=swap" rel="stylesheet">
<style>
 html,body{margin:0;padding:0}
 body{width:${v}px;height:${v}px;background:#FFFFFF;display:flex;align-items:center;justify-content:center}
 .t{font-family:Inter,system-ui,sans-serif;font-weight:800;color:${PLAVA};
    font-size:${Math.round(v*0.84*0.98)}px;line-height:1;transform:translateY(${Math.round(v*0.02)}px)}
</style></head><body><div class="t">T</div></body></html>`

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
fs.mkdirSync(IZLAZ, { recursive: true })
const RLE = { level: 1, strategy: zlib.constants.Z_RLE, memLevel: 1, bezAlfe: true }

for (const v of [108, 192, 216, 256, 288, 512, 1024]) {
    const page = await browser.newPage()
    await page.setViewport({ width: v, height: v, deviceScaleFactor: 1 })
    await page.setContent(stranica(v), { waitUntil: 'networkidle0' })
    await page.evaluate(() => document.fonts.ready)
    const slika = Buffer.from(await page.screenshot({ type: 'png' }))
    await page.close()
    const izlaz = ponovnoStisni(slika, RLE)
    const naziv = `travelo-${v}x${v}.png`
    fs.writeFileSync(path.join(IZLAZ, naziv), izlaz)
    console.log(`${naziv.padEnd(22)} ${(izlaz.length / 1024).toFixed(1).padStart(7)} kB   bez alfe`)
}
await browser.close()
