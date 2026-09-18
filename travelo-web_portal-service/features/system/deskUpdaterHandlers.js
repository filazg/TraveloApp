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
function nazivDozvoljen(name) {
    return /^latest\.yml$/i.test(name)
        || /^[\w .()-]+\.exe$/i.test(name)
        || /^[\w .()-]+\.exe\.blockmap$/i.test(name);
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
            const finalPath = path.join(DESK_UPDATES_DIR, filename);
            // rename je atomično i unutar istog filesystema; preko postojeće prvo makni.
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

        // Objavljena verzija iz latest.yml (informativno).
        let version = null;
        const ymlPath = path.join(DESK_UPDATES_DIR, 'latest.yml');
        if (fs.existsSync(ymlPath)) {
            const m = fs.readFileSync(ymlPath, 'utf-8').match(/^version:\s*(.+)$/m);
            if (m) version = m[1].trim();
        }
        return res.send({ status: 200, data: { files, version } });
    } catch (error) {
        console.log('handleDeskUpdaterList error:', error?.message || error);
        return res.status(500).send({ status: 500, data: { message: error?.message || 'Greška pri dohvatu popisa.' } });
    }
};

module.exports = { handleDeskUpdaterUpload, handleDeskUpdaterList };
