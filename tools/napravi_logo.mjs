// Jedinstveni znak aplikacije: slovo T u brand plavoj, na prozirnoj podlozi.
//
// Prije je svaka aplikacija imala svoj: desk i mobilna slovo T na svijetloplavoj
// i u drugom fontu, portal i partnerska prodaja sliku wordmarka. Sada se svugdje
// crta isto slovo, istim fontom kojim je pisan i znak na prijavi.
//
// Crta se u Chromiumu jer tako slovo izlazi u istom fontu kao u aplikaciji, a ne
// u priblizno slicnom iz nekog grafickog alata.
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'

const require = createRequire('file:///C:/Tech4beeZ/Projekti/TraveloApp/travelo-transactions-service/x.js')
const puppeteer = require('puppeteer')

const PLAVA = '#175BD0'

// `padding` je udio ruba koji ostaje prazan — Android adaptivni znak resu
// obrezuje u krug, pa slovo mora stajati u sredisnjoj trecini.
const stranica = (velicina, padding, okruglo) => `
<!doctype html>
<html><head><meta charset="utf-8" />
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@800&display=swap" rel="stylesheet">
<style>
  html, body { margin: 0; padding: 0; }
  body {
    width: ${velicina}px; height: ${velicina}px;
    background: transparent;
    display: flex; align-items: center; justify-content: center;
  }
  .t {
    font-family: Inter, system-ui, 'Segoe UI', Roboto, Arial, sans-serif;
    font-weight: 800;
    color: ${PLAVA};
    /* Velicina se racuna iz preostalog prostora, da isti predlozak posluzi i za
       znak bez ruba i za adaptivni s rubom. */
    font-size: ${Math.round(velicina * (1 - 2 * padding) * 0.98)}px;
    line-height: 1;
    /* Slovo T je opticki visoko: bez ovog pomaka sjedi previsoko u kvadratu. */
    transform: translateY(${Math.round(velicina * 0.02)}px);
  }
</style></head>
<body><div class="t">T</div></body></html>`

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] })

const nacrtaj = async (velicina, { padding = 0.1, okruglo = false } = {}) => {
    const page = await browser.newPage()
    await page.setViewport({ width: velicina, height: velicina, deviceScaleFactor: 1 })
    await page.setContent(stranica(velicina, padding, okruglo), { waitUntil: 'networkidle0', timeout: 20000 })
    // Font mora biti ucitan prije snimanja, inace se slika uhvati u fallbacku.
    await page.evaluate(() => document.fonts.ready)
    const slika = await page.screenshot({ omitBackground: true, type: 'png' })
    await page.close()
    return Buffer.isBuffer(slika) ? slika : Buffer.from(slika)
}

const zapisi = (putanja, podaci) => {
    fs.mkdirSync(path.dirname(putanja), { recursive: true })
    fs.writeFileSync(putanja, podaci)
    console.log('  ', putanja.replace('C:/Tech4beeZ/Projekti/TraveloApp/', ''), podaci.length, 'B')
}

// ICO nosi vise velicina odjednom; od Viste naovamo smije sadrzavati PNG-ove,
// pa se zaglavlje slaze rucno umjesto da se vuce jos jedna biblioteka.
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
        s.writeUInt8(0, 2)
        s.writeUInt8(0, 3)
        s.writeUInt16LE(1, 4)
        s.writeUInt16LE(32, 6)
        s.writeUInt32LE(podaci.length, 8)
        s.writeUInt32LE(odmak, 12)
        odmak += podaci.length
        stavke.push(s)
    }
    return Buffer.concat([zaglavlje, ...stavke, ...slike.map((s) => s.podaci)])
}

const KORIJEN = 'C:/Tech4beeZ/Projekti/TraveloApp'

console.log('portal i partnerska prodaja:')
const kvadrat512 = await nacrtaj(512, { padding: 0.08 })
zapisi(`${KORIJEN}/travelo-portal/src/assets/TraveloAppIcon.png`, kvadrat512)
zapisi(`${KORIJEN}/travelo-partner-sales/src/assets/TraveloAppIcon.png`, kvadrat512)

const icoVelicine = [16, 32, 48, 64, 128, 256]
const icoSlike = []
for (const v of icoVelicine) icoSlike.push({ velicina: v, podaci: await nacrtaj(v, { padding: 0.06 }) })
zapisi(`${KORIJEN}/travelo-portal/public/TraveloAppIcon.ico`, uIco(icoSlike))
zapisi(`${KORIJEN}/travelo-partner-sales/public/TraveloAppIcon.ico`, uIco(icoSlike))

console.log('desk:')
zapisi(`${KORIJEN}/travelo-boat-desk/electron/assets/icon.png`, kvadrat512)
zapisi(`${KORIJEN}/travelo-boat-desk/electron/assets/icon.ico`, uIco(icoSlike))

console.log('mobilna (Android):')
// Klasicne velicine launcher ikone po gustoci zaslona.
const MIPMAP = { 'mipmap-mdpi': 48, 'mipmap-hdpi': 72, 'mipmap-xhdpi': 96, 'mipmap-xxhdpi': 144, 'mipmap-xxxhdpi': 192 }
for (const [mapa, v] of Object.entries(MIPMAP)) {
    const puna = await nacrtaj(v, { padding: 0.08 })
    zapisi(`${KORIJEN}/travelo-mobile/android/app/src/main/res/${mapa}/ic_launcher.png`, puna)
    zapisi(`${KORIJEN}/travelo-mobile/android/app/src/main/res/${mapa}/ic_launcher_round.png`, puna)
    // Adaptivni znak: podloga je zaseban sloj, pa je prednji sloj proziran i s
    // vecim rubom — sustav ga obrezuje u krug ili zaobljeni kvadrat.
    const prednji = await nacrtaj(Math.round(v * 1.5), { padding: 0.22 })
    zapisi(`${KORIJEN}/travelo-mobile/android/app/src/main/res/${mapa}/ic_launcher_foreground.png`, prednji)
}

await browser.close()
console.log('gotovo')
