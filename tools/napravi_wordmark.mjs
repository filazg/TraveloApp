// Wordmark "TraveloAPP" kao slika.
//
// Znak u aplikacijama nije slika nego tekst (BrandMark), pa za dokumente i
// tisak nije postojalo nista sto se moze ubaciti. Ovdje se isti znak iscrta u
// Chromiumu — istim fontom i bojama kao u portalu — i snimi kao PNG s
// prozirnom podlogom.
//
// Crta se u pregledniku, ne u grafickom alatu, iz istog razloga kao i ikona:
// tako slova izadju u pravom Interu, a ne u priblizno slicnom fontu.
//
// Pokretanje:  node tools/napravi_wordmark.mjs [sirina]
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'

const require = createRequire('file:///C:/Tech4beeZ/Projekti/TraveloApp/travelo-transactions-service/x.js')
const puppeteer = require('puppeteer')

const PLAVA = '#175BD0'        // brand primarna — nosi "Travelo"
const TAMNA = '#383E42'        // brand tekst — nosi "APP"
const SVIJETLA = '#96D1F2'     // brand sekundarna — "Travelo" na plavoj podlozi

const SIRINA = Number(process.argv[2]) || 1200
const KORIJEN = 'C:/Tech4beeZ/Projekti/TraveloApp'
const IZLAZ = `${KORIJEN}/docs/brand`

const stranica = (fontPx, naPlavoj) => `
<!doctype html>
<html><head><meta charset="utf-8" />
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@800&display=swap" rel="stylesheet">
<style>
  html, body { margin: 0; padding: 0; background: transparent; }
  #znak {
    display: inline-block;
    font-family: Inter, system-ui, 'Segoe UI', Roboto, Arial, sans-serif;
    font-weight: 800;
    /* Isti razmak kao u BrandMark-u, preracunat u udio velicine slova da
       ostane isti odnos na svakoj sirini. */
    letter-spacing: ${(0.5 / 20).toFixed(4)}em;
    font-size: ${fontPx}px;
    line-height: 1;
    white-space: nowrap;
  }
  .brand { color: ${naPlavoj ? SVIJETLA : PLAVA}; }
  .neutral { color: ${naPlavoj ? '#FFFFFF' : TAMNA}; }
</style></head>
<body><span id="znak"><span class="brand">Travelo</span><span class="neutral">APP</span></span></body></html>`

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] })

const nacrtaj = async (sirina, { naPlavoj = false } = {}) => {
    const page = await browser.newPage()
    await page.setViewport({ width: Math.max(sirina + 200, 600), height: 600, deviceScaleFactor: 1 })

    // Velicina slova se ne pogadja nego mjeri: iscrta se probni ispis, izmjeri
    // sirina i skalira na trazenu. Drugi prolaz jer letter-spacing zadnjeg
    // slova ulazi u sirinu pa prvi izracun promasi za koji piksel.
    let fontPx = 100
    for (let i = 0; i < 3; i++) {
        await page.setContent(stranica(fontPx, naPlavoj), { waitUntil: 'domcontentloaded', timeout: 60000 })
        // Font se ceka izrijekom: networkidle zna visjeti na Google Fonts vezi,
        // a bez ucitanog Intera slova izadju u fallbacku i sirina promasi.
        await page.evaluate(async () => {
            try { await document.fonts.load('800 100px Inter') } catch (_) {}
            try { await document.fonts.ready } catch (_) {}
        })
        const izmjereno = await page.evaluate(() => document.getElementById('znak').getBoundingClientRect().width)
        if (Math.abs(izmjereno - sirina) < 0.5) break
        fontPx = fontPx * (sirina / izmjereno)
    }

    const imaInter = await page.evaluate(() => document.fonts.check('800 100px Inter'))
    if (!imaInter) { throw new Error('Inter nije ucitan — slika bi izasla u zamjenskom fontu') }

    const okvir = await page.evaluate(() => {
        const r = document.getElementById('znak').getBoundingClientRect()
        return { x: r.x, y: r.y, width: r.width, height: r.height }
    })
    const slika = await page.screenshot({
        omitBackground: true,
        type: 'png',
        clip: {
            x: Math.round(okvir.x),
            y: Math.round(okvir.y),
            width: sirina,
            height: Math.ceil(okvir.height),
        },
    })
    await page.close()
    return { podaci: Buffer.isBuffer(slika) ? slika : Buffer.from(slika), visina: Math.ceil(okvir.height) }
}

const zapisi = (putanja, podaci) => {
    fs.mkdirSync(path.dirname(putanja), { recursive: true })
    fs.writeFileSync(putanja, podaci)
    console.log('  ', putanja.replace(KORIJEN + '/', ''), podaci.length, 'B')
}

console.log(`wordmark ${SIRINA} px, prozirna podloga:`)
const svijetla = await nacrtaj(SIRINA)
zapisi(`${IZLAZ}/TraveloAPP-wordmark-${SIRINA}.png`, svijetla.podaci)
console.log('   visina:', svijetla.visina, 'px')

const tamna = await nacrtaj(SIRINA, { naPlavoj: true })
zapisi(`${IZLAZ}/TraveloAPP-wordmark-na-plavoj-${SIRINA}.png`, tamna.podaci)

await browser.close()
