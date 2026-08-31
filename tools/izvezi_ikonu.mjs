// Izvoz znaka aplikacije za vanjsku upotrebu — trgovine, stranica, tiskovine.
//
// Isto slovo i isti font kao `napravi_logo.mjs`, samo se ne upisuje u projekte
// nego u `tools/ikona/`, u velicinama koje se obicno traze izvana. Uz prozirne
// inacice ide i jedna na bijeloj podlozi: Google Play za znak aplikacije ne
// prima prozirnost.
//
// Pokretanje:  node tools/izvezi_ikonu.mjs
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import { ponovnoStisni } from './png_ponovno.mjs'

const require = createRequire('file:///C:/Tech4beeZ/Projekti/TraveloApp/travelo-transactions-service/x.js')
const puppeteer = require('puppeteer')

const PLAVA = '#175BD0'
const IZLAZ = 'C:/Tech4beeZ/Projekti/TraveloApp/tools/ikona'

const stranica = (velicina, padding, podloga) => `
<!doctype html>
<html><head><meta charset="utf-8" />
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@800&display=swap" rel="stylesheet">
<style>
  html, body { margin: 0; padding: 0; }
  body {
    width: ${velicina}px; height: ${velicina}px;
    background: ${podloga};
    display: flex; align-items: center; justify-content: center;
  }
  .t {
    font-family: Inter, system-ui, 'Segoe UI', Roboto, Arial, sans-serif;
    font-weight: 800;
    color: ${PLAVA};
    font-size: ${Math.round(velicina * (1 - 2 * padding) * 0.98)}px;
    line-height: 1;
    transform: translateY(${Math.round(velicina * 0.02)}px);
  }
</style></head>
<body><div class="t">T</div></body></html>`

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] })

const nacrtaj = async (velicina, { padding = 0.08, podloga = 'transparent' } = {}) => {
    const page = await browser.newPage()
    await page.setViewport({ width: velicina, height: velicina, deviceScaleFactor: 1 })
    await page.setContent(stranica(velicina, padding, podloga), { waitUntil: 'networkidle0', timeout: 20000 })
    await page.evaluate(() => document.fonts.ready)
    const slika = await page.screenshot({ omitBackground: podloga === 'transparent', type: 'png' })
    await page.close()
    return Buffer.isBuffer(slika) ? slika : Buffer.from(slika)
}

const zapisi = (naziv, podaci) => {
    fs.mkdirSync(IZLAZ, { recursive: true })
    fs.writeFileSync(path.join(IZLAZ, naziv), podaci)
    console.log('  ', naziv, Math.round(podaci.length / 1024) + ' kB')
}

// ICO smije nositi PNG-ove, pa se zaglavlje slaze rucno.
const uIco = (slike) => {
    const zaglavlje = Buffer.alloc(6)
    zaglavlje.writeUInt16LE(0, 0)
    zaglavlje.writeUInt16LE(1, 2)
    zaglavlje.writeUInt16LE(slike.length, 4)
    let odmak = 6 + slike.length * 16
    const stavke = []
    for (const { velicina, podaci } of slike) {
        const s = Buffer.alloc(16)
        s.writeUInt8(velicina >= 256 ? 0 : velicina, 0)
        s.writeUInt8(velicina >= 256 ? 0 : velicina, 1)
        s.writeUInt16LE(1, 4)
        s.writeUInt16LE(32, 6)
        s.writeUInt32LE(podaci.length, 8)
        s.writeUInt32LE(odmak, 12)
        odmak += podaci.length
        stavke.push(s)
    }
    return Buffer.concat([zaglavlje, ...stavke, ...slike.map((s) => s.podaci)])
}

console.log('prozirna podloga:')
for (const v of [1024, 512, 256, 128, 64]) {
    zapisi(`travelo-ikona-${v}.png`, await nacrtaj(v))
}

console.log('bijela podloga (trgovine ne primaju prozirnost):')
zapisi('travelo-ikona-512-bijela.png', await nacrtaj(512, { podloga: '#FFFFFF' }))
zapisi('travelo-ikona-1024-bijela.png', await nacrtaj(1024, { podloga: '#FFFFFF' }))

// Neki alati odbijaju datoteku ispod 10 kB. Plosnat znak — bijela ploha i jedno
// slovo — stisne se na oko 2 kB, pa se za te slucajeve isti pikseli spremaju s
// manjom razinom kompresije. Slika je ista, samo zapis nije stisnut do kraja.
console.log('za alate koji traze vecu datoteku (isti izgled, slabije stisnuto):')
zapisi('travelo-ikona-1024-bijela-velika.png', ponovnoStisni(await nacrtaj(1024, { podloga: '#FFFFFF' }), 1))
zapisi('travelo-ikona-1024-velika.png', ponovnoStisni(await nacrtaj(1024), 1))

console.log('Windows:')
const icoSlike = []
for (const v of [16, 32, 48, 64, 128, 256]) icoSlike.push({ velicina: v, podaci: await nacrtaj(v, { padding: 0.06 }) })
zapisi('travelo-ikona.ico', uIco(icoSlike))

await browser.close()
console.log('gotovo —', IZLAZ)
