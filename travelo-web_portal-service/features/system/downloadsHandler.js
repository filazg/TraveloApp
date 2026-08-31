const fs = require('fs');
const path = require('path');

// Datoteke za preuzimanje stoje uz servis, ne u bazi — instalacijske pakete i
// upute se jednostavno kopira u ovu mapu. Opisi (naslov, kategorija, verzija)
// mogu se dodati u downloads.json; datoteka bez upisa u manifest se svejedno
// prikaže, samo pod svojim imenom.
const DOWNLOADS_DIR = path.join(__dirname, '..', '..', 'downloads');
const MANIFEST = path.join(DOWNLOADS_DIR, 'downloads.json');
const DEFAULT_CATEGORY = 'Ostalo';

const readManifest = () => {
    try {
        if (!fs.existsSync(MANIFEST)) return [];
        const parsed = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
        return Array.isArray(parsed?.items) ? parsed.items : [];
    } catch (error) {
        console.log('downloads manifest nije čitljiv:', error?.message || error);
        return [];
    }
};

const listFiles = () => {
    if (!fs.existsSync(DOWNLOADS_DIR)) return [];
    return fs.readdirSync(DOWNLOADS_DIR, { withFileTypes: true })
        .filter((e) => e.isFile())
        .map((e) => e.name)
        // Manifest i njegov predložak nisu sadržaj za preuzimanje.
        .filter((name) => name !== 'downloads.json'
            && name !== 'downloads.example.json'
            && !name.startsWith('.'));
};

const handleGetDownloadsFeature = async (req, res) => {
    try {
        const manifest = readManifest();
        const byFile = new Map(manifest.map((m) => [m.file, m]));
        const items = listFiles()
            // `hidden` u manifestu skriva datoteku s popisa, ali je ostavlja na
            // posluzitelju — za izdanja koja se dijele drugim kanalom, a i dalje
            // moraju biti dohvatljiva izravnom poveznicom.
            .filter((name) => byFile.get(name)?.hidden !== true)
            .map((name) => {
                const meta = byFile.get(name) || {};
                const stat = fs.statSync(path.join(DOWNLOADS_DIR, name));
                return {
                    file: name,
                    title: meta.title || name,
                    description: meta.description || '',
                    category: meta.category || DEFAULT_CATEGORY,
                    version: meta.version || '',
                    size: stat.size,
                    updated_at: stat.mtime,
                    order: Number.isFinite(meta.order) ? meta.order : 100,
                    // Redoslijed kategorija se zadaje, ne izvodi iz naziva —
                    // abecedno bi upute dosle prije aplikacija.
                    category_order: Number.isFinite(meta.category_order) ? meta.category_order : 100,
                };
            });
        // Kategorija se poredava po najmanjem `category_order` medu svojim
        // stavkama, da cijela grupa ostane na okupu.
        const redKategorije = new Map();
        for (const i of items) {
            const dosad = redKategorije.get(i.category);
            if (dosad === undefined || i.category_order < dosad) redKategorije.set(i.category, i.category_order);
        }
        items.sort((a, b) => {
            if (a.category !== b.category) {
                return (redKategorije.get(a.category) - redKategorije.get(b.category))
                    || a.category.localeCompare(b.category, 'hr');
            }
            return (a.order - b.order) || a.title.localeCompare(b.title, 'hr');
        });
        return res.send({ status: 200, data: { downloads: items } });
    } catch (error) {
        console.log('handleGetDownloadsFeature error:', error?.message || error);
        return res.status(500).send({ status: 500, data: { message: error?.message || 'downloads failed' } });
    }
};

const handleDownloadFileFeature = async (req, res) => {
    try {
        const requested = decodeURIComponent(req.params.file || '');
        // Ime datoteke, ne putanja — bez ovoga bi se ../ moglo popeti izvan mape.
        const safe = path.basename(requested);
        if (!safe || safe !== requested) {
            return res.status(400).send({ status: 400, data: { message: 'neispravno ime datoteke' } });
        }
        const full = path.join(DOWNLOADS_DIR, safe);
        if (!full.startsWith(DOWNLOADS_DIR) || !fs.existsSync(full) || !fs.statSync(full).isFile()) {
            return res.status(404).send({ status: 404, data: { message: 'datoteka ne postoji' } });
        }
        res.setHeader('content-type', 'application/octet-stream');
        res.setHeader('content-disposition', `attachment; filename="${encodeURIComponent(safe)}"`);
        res.setHeader('content-length', fs.statSync(full).size);
        return fs.createReadStream(full).pipe(res);
    } catch (error) {
        console.log('handleDownloadFileFeature error:', error?.message || error);
        return res.status(500).send({ status: 500, data: { message: error?.message || 'download failed' } });
    }
};

module.exports = { handleGetDownloadsFeature, handleDownloadFileFeature };
