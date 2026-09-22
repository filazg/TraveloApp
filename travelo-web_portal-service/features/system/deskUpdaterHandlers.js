// Objava nove verzije desktop aplikacije (electron-updater feed).
//
// Portal (samo korisnik nfilipec) uploada tri datoteke feeda:
//   - Travelo Boat Desk Setup <v>.exe   (instalacijski paket)
//   - <isti naziv>.exe.blockmap          (za diferencijalni download)
//   - latest.yml                         (manifest s verzijom)
// pa se serviraju kao https://bookingtest.krilo.hr/desk-updates/ (nginx alias na
// DESK_UPDATES_DIR — vidi nginx snippet u komentaru dolje).
//
// Zašto chunked base64 preko običnog JSON-a, a ne multipart: portal ide kroz
// gateway koji tijelo pakira u {header, body} i prosljeđuje axiosom kao JSON, uz
// limit 10 MB. Multipart ne preživi, a .exe je ~110 MB — pa ga šaljemo u
// komadima (~5 MB binarno / ~6.7 MB base64, ispod limita) koje ovdje spajamo.
//
// nginx (na VM-u, unutar server bloka za bookingtest.krilo.hr):
//   location /desk-updates/ {
//       alias /opt/TraveloApp/travelo-web_portal-service/desk_updates/;
//       autoindex off;
//   }

const fs = require('fs');
const path = require('path');

// Tko smije objavljivati verzije. Namjerno uzak popis (zahtjev: samo nfilipec).
const ALLOWED_USERS = (process.env.DESK_UPDATER_USERS || 'nfilipec')
    .split(',').map((s) => s.trim()).filter(Boolean);

// Mapa iz koje nginx servira /desk-updates/. Override kroz env po potrebi.
const DESK_UPDATES_DIR = process.env.DESK_UPDATES_DIR
    || path.join(__dirname, '..', '..', 'desk_updates');
const TMP_DIR = path.join(DESK_UPDATES_DIR, '.uploading');

// Dozvoljeni nazivi datoteka feeda — sve ostalo se odbija (nema pisanja izvan
// ovih obrazaca, ni path-traversala: uzima se samo basename).
//
// Uz same datoteke nadogradnje stoji i javni certifikat (.cer) kojim su
// potpisane: blagajna koja ga jos nema ne moze primiti auto-update, pa mora
// postojati mjesto s kojeg se skine i posadi rucno. Certifikat je javan podatak
// — privatni kljuc (.pfx) ostaje na build stroju i ovdje se nikad ne salje.
function nazivDozvoljen(name) {
    return /^latest\.yml$/i.test(name)
        || /^[\w .()-]+\.exe$/i.test(name)
        || /^[\w .()-]+\.exe\.blockmap$/i.test(name)
        || /^[\w .()-]+\.cer$/i.test(name);
}

// Certifikat nije dio manifesta: ne govori koja je verzija aktualna, nego cime
// je potpisana. Zato prezivljava praznjenje feeda — inace bi se uklanjanjem
// stare verzije izgubio i jedini nacin da stroj bez certa uopce dode do njega.
function jeCertifikat(name) {
    return /\.cer$/i.test(name);
}

function jeAdmin(req) {
    const username = req.body?.header?.username;
    return !!username && ALLOWED_USERS.includes(username);
}

function osiguran(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// Prima jedan komad datoteke. Tijelo (req.body.body): { filename, index, total,
// dataB64, reset }. Prvi komad (index 0 ili reset) kreira temp, ostali dopisuju;
// zadnji (index === total-1) preseli temp u finalnu mapu.
const handleDeskUpdaterUpload = async (req, res) => {
    try {
        if (!jeAdmin(req)) {
            return res.status(403).send({ status: 403, data: { message: 'Pristup ograničen.' } });
        }
        const payload = req.body?.body || req.body || {};
        const rawName = String(payload.filename || '');
        const filename = path.basename(rawName);
        const index = Number(payload.index);
        const total = Number(payload.total);
        const dataB64 = payload.dataB64;

        if (!nazivDozvoljen(filename)) {
            return res.status(400).send({ status: 400, data: { message: `Nedozvoljen naziv datoteke: ${filename}` } });
        }
        if (!Number.isInteger(index) || !Number.isInteger(total) || index < 0 || total < 1 || index >= total) {
            return res.status(400).send({ status: 400, data: { message: 'Neispravan index/total komada.' } });
        }
        if (typeof dataB64 !== 'string') {
            return res.status(400).send({ status: 400, data: { message: 'Nedostaje sadržaj komada.' } });
        }

        osiguran(DESK_UPDATES_DIR);
        osiguran(TMP_DIR);
        const tmpPath = path.join(TMP_DIR, filename + '.part');
        const buf = Buffer.from(dataB64, 'base64');

        if (index === 0 || payload.reset) {
            fs.writeFileSync(tmpPath, buf);
        } else {
            fs.appendFileSync(tmpPath, buf);
        }

        let finished = false;
        if (index === total - 1) {
            let finalPath = path.join(DESK_UPDATES_DIR, filename);
            // latest.yml se sprema kao STAGED (latest.yml.staged) — objava je
            // inicijalno NEAKTIVNA dok se ne uključi prekidačem (aktivacija je
            // preimenuje u latest.yml koju electron-updater onda vidi). exe i
            // blockmap idu normalno (serviraju se, ali bez latest.yml nema update-a).
            if (filename.toLowerCase() === 'latest.yml') {
                finalPath = path.join(DESK_UPDATES_DIR, 'latest.yml.staged');
            }
            if (fs.existsSync(finalPath)) fs.rmSync(finalPath, { force: true });
            fs.renameSync(tmpPath, finalPath);
            finished = true;
        }

        return res.send({
            status: 200,
            data: { message: finished ? `Spremljeno: ${filename}` : 'ok', filename, received: index + 1, total, finished },
        });
    } catch (error) {
        console.log('handleDeskUpdaterUpload error:', error?.message || error);
        return res.status(500).send({ status: 500, data: { message: error?.message || 'Greška pri uploadu.' } });
    }
};

// Popis trenutnih datoteka feeda (za prikaz što je objavljeno).
const handleDeskUpdaterList = async (req, res) => {
    try {
        if (!jeAdmin(req)) {
            return res.status(403).send({ status: 403, data: { message: 'Pristup ograničen.' } });
        }
        if (!fs.existsSync(DESK_UPDATES_DIR)) {
            return res.send({ status: 200, data: { files: [], version: null } });
        }
        const files = fs.readdirSync(DESK_UPDATES_DIR)
            .filter((f) => !f.startsWith('.') && fs.statSync(path.join(DESK_UPDATES_DIR, f)).isFile())
            .map((f) => {
                const st = fs.statSync(path.join(DESK_UPDATES_DIR, f));
                return { name: f, size: st.size, updated_at: st.mtime };
            })
            .sort((a, b) => a.name.localeCompare(b.name));

        // Aktivno = servirana latest.yml postoji (electron-updater je vidi).
        // Verziju čitamo iz aktivne, a ako nije aktivna, iz staged kopije.
        const liveYml = path.join(DESK_UPDATES_DIR, 'latest.yml');
        const stagedYml = path.join(DESK_UPDATES_DIR, 'latest.yml.staged');
        const active = fs.existsSync(liveYml);
        let version = null;
        const ymlToRead = active ? liveYml : (fs.existsSync(stagedYml) ? stagedYml : null);
        if (ymlToRead) {
            const m = fs.readFileSync(ymlToRead, 'utf-8').match(/^version:\s*(.+)$/m);
            if (m) version = m[1].trim();
        }
        return res.send({ status: 200, data: { files, version, active } });
    } catch (error) {
        console.log('handleDeskUpdaterList error:', error?.message || error);
        return res.status(500).send({ status: 500, data: { message: error?.message || 'Greška pri dohvatu popisa.' } });
    }
};

// Uklanjanje s feeda (deaktivacija). Tijelo (req.body.body): { filename } za
// jednu datoteku, ili { all: true } da se feed potpuno isprazni. Micanjem
// latest.yml electron-updater više ne nudi update; ostale se brišu da ne visi
// veliki .exe. Instalirane blagajne ostaju na svojoj verziji (nema downgrade-a).
const handleDeskUpdaterDelete = async (req, res) => {
    try {
        if (!jeAdmin(req)) {
            return res.status(403).send({ status: 403, data: { message: 'Pristup ograničen.' } });
        }
        if (!fs.existsSync(DESK_UPDATES_DIR)) {
            return res.send({ status: 200, data: { message: 'Feed je već prazan.', removed: [] } });
        }
        const payload = req.body?.body || req.body || {};
        const removed = [];

        if (payload.all) {
            for (const f of fs.readdirSync(DESK_UPDATES_DIR)) {
                const p = path.join(DESK_UPDATES_DIR, f);
                if (!fs.statSync(p).isFile()) continue;
                // Certifikat ostaje: on nije verzija nego preduvjet da ijedna
                // verzija prode. Uklanja se pojedinacno, kad se mijenja cert.
                if (jeCertifikat(f)) continue;
                fs.rmSync(p, { force: true });
                removed.push(f);
            }
            return res.send({ status: 200, data: { message: 'Feed je ispražnjen (aplikacija deaktivirana); certifikat je ostao.', removed } });
        }

        const filename = path.basename(String(payload.filename || ''));
        if (!nazivDozvoljen(filename)) {
            return res.status(400).send({ status: 400, data: { message: `Nedozvoljen naziv datoteke: ${filename}` } });
        }
        const p = path.join(DESK_UPDATES_DIR, filename);
        if (fs.existsSync(p)) { fs.rmSync(p, { force: true }); removed.push(filename); }
        return res.send({ status: 200, data: { message: removed.length ? `Uklonjeno: ${filename}` : 'Datoteka ne postoji.', removed } });
    } catch (error) {
        console.log('handleDeskUpdaterDelete error:', error?.message || error);
        return res.status(500).send({ status: 500, data: { message: error?.message || 'Greška pri uklanjanju.' } });
    }
};

// Aktivacija/deaktivacija objave BEZ ponovnog uploada. Tijelo: { active }.
// active=true: latest.yml.staged -> latest.yml (electron-updater je vidi).
// active=false: latest.yml -> latest.yml.staged (nadogradnja se više ne nudi;
// exe/blockmap ostaju, pa ponovna aktivacija ne traži novi upload).
const handleDeskUpdaterActivate = async (req, res) => {
    try {
        if (!jeAdmin(req)) {
            return res.status(403).send({ status: 403, data: { message: 'Pristup ograničen.' } });
        }
        osiguran(DESK_UPDATES_DIR);
        const live = path.join(DESK_UPDATES_DIR, 'latest.yml');
        const staged = path.join(DESK_UPDATES_DIR, 'latest.yml.staged');
        const wantActive = !!(req.body?.body || req.body || {}).active;

        if (wantActive) {
            if (fs.existsSync(staged)) {
                if (fs.existsSync(live)) fs.rmSync(live, { force: true });
                fs.renameSync(staged, live);
            } else if (!fs.existsSync(live)) {
                return res.status(400).send({ status: 400, data: { message: 'Nema objavljene verzije za aktivaciju.' } });
            }
            return res.send({ status: 200, data: { message: 'Aktivirano — blagajne će povući verziju kod prijave.', active: true } });
        }

        if (fs.existsSync(live)) {
            if (fs.existsSync(staged)) fs.rmSync(staged, { force: true });
            fs.renameSync(live, staged);
        }
        return res.send({ status: 200, data: { message: 'Deaktivirano — nadogradnja se više ne nudi.', active: false } });
    } catch (error) {
        console.log('handleDeskUpdaterActivate error:', error?.message || error);
        return res.status(500).send({ status: 500, data: { message: error?.message || 'Greška pri promjeni statusa.' } });
    }
};

module.exports = { handleDeskUpdaterUpload, handleDeskUpdaterList, handleDeskUpdaterDelete, handleDeskUpdaterActivate };
