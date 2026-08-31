// Ista slika, samo slabije stisnuta.
//
// Plosnati znak (bijela ploha + jedno slovo) PNG stisne na ~2 kB. Ako se trazi
// datoteka preko 10 kB, a izgled se ne smije mijenjati, jedino sto preostaje je
// spremiti iste piksele s manjom razinom kompresije.
import zlib from 'node:zlib'

const raspakiraj = (buf) => {
    let i = 8, sirina = 0, visina = 0, dubina = 0, tip = 0
    const dijelovi = []
    while (i < buf.length) {
        const duljina = buf.readUInt32BE(i)
        const oznaka = buf.toString('ascii', i + 4, i + 8)
        const podaci = buf.subarray(i + 8, i + 8 + duljina)
        if (oznaka === 'IHDR') {
            sirina = podaci.readUInt32BE(0); visina = podaci.readUInt32BE(4)
            dubina = podaci[8]; tip = podaci[9]
        } else if (oznaka === 'IDAT') dijelovi.push(podaci)
        else if (oznaka === 'IEND') break
        i += 12 + duljina
    }
    if (dubina !== 8 || (tip !== 6 && tip !== 2)) throw new Error(`nepodrzan PNG (dubina ${dubina}, tip ${tip})`)
    const kanala = tip === 6 ? 4 : 3
    const sirovo = zlib.inflateSync(Buffer.concat(dijelovi))
    const redak = sirina * kanala
    const piksel = Buffer.alloc(visina * redak)
    let p = 0
    for (let y = 0; y < visina; y++) {
        const filtar = sirovo[p++]
        const red = sirovo.subarray(p, p + redak); p += redak
        const izlaz = piksel.subarray(y * redak, (y + 1) * redak)
        for (let x = 0; x < redak; x++) {
            const a = x >= kanala ? izlaz[x - kanala] : 0
            const b = y > 0 ? piksel[(y - 1) * redak + x] : 0
            const c = (x >= kanala && y > 0) ? piksel[(y - 1) * redak + x - kanala] : 0
            let v = red[x]
            if (filtar === 1) v += a
            else if (filtar === 2) v += b
            else if (filtar === 3) v += (a + b) >> 1
            else if (filtar === 4) {
                const pp = a + b - c
                const pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c)
                v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c)
            }
            izlaz[x] = v & 0xff
        }
    }
    return { sirina, visina, kanala, piksel }
}

const crc = (buf) => {
    let c = ~0
    for (const b of buf) { c ^= b; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)) }
    return ~c >>> 0
}

const dio = (oznaka, podaci) => {
    const duljina = Buffer.alloc(4); duljina.writeUInt32BE(podaci.length)
    const tijelo = Buffer.concat([Buffer.from(oznaka, 'ascii'), podaci])
    const kontrola = Buffer.alloc(4); kontrola.writeUInt32BE(crc(tijelo))
    return Buffer.concat([duljina, tijelo, kontrola])
}

// `postavke` su opcije zlib deflate-a. Razina sama ne pomaze uvijek: plosnata
// slika i na razini 1 padne ispod 10 kB, a razina 0 skoci na 769 kB. Strategija
// RLE gleda samo ponavljanje susjednih bajtova, pa istu sliku zapise oko 42 kB —
// izmedu trazenih granica, bez ijednog promijenjenog piksela.
export const ponovnoStisni = (png, postavke = {}) => {
    const opcije = typeof postavke === 'number' ? { level: postavke } : postavke
    const { sirina, visina, kanala, piksel } = raspakiraj(png)
    const redak = sirina * kanala
    const sirovo = Buffer.alloc(visina * (redak + 1))
    for (let y = 0; y < visina; y++) {
        sirovo[y * (redak + 1)] = 0                       // bez filtra
        piksel.copy(sirovo, y * (redak + 1) + 1, y * redak, (y + 1) * redak)
    }
    const ihdr = Buffer.alloc(13)
    ihdr.writeUInt32BE(sirina, 0); ihdr.writeUInt32BE(visina, 4)
    ihdr[8] = 8; ihdr[9] = kanala === 4 ? 6 : 2
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        dio('IHDR', ihdr),
        dio('IDAT', zlib.deflateSync(sirovo, opcije)),
        dio('IEND', Buffer.alloc(0)),
    ])
}
