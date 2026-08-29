import { AppState } from 'react-native';
import { DEFAULT_GATEWAY_URL } from './config';
import { storage } from './client';

// Poslužitelj javlja uređaju čim se nešto promijeni.
//
// Uređaj radi offline i podatke povlači sam, pa za storno karte ili otkaz
// polaska ne sazna dok korisnik ne pokrene osvježavanje: stornirana karta se do
// tada može validirati, a otkazan polazak prodavati. Ovdje se drži otvorena veza
// prema poslužitelju i sluša njegovo javljanje.
//
// Zašto XMLHttpRequest, a ne fetch: React Native fetch nema tok odgovora, pa se
// poruke ne mogu čitati dok stižu — XHR daje `responseText` koji raste, i to je
// jedini način bez dodatne biblioteke.
const DEV_GATEWAY = 'http://localhost:5100';
const PUTANJA = '/terminals/terminal/sync_stream';
const RAZMAK_PONOVNOG_SPAJANJA_MS = 15 * 1000;

let xhr = null;
let ponovno = null;
let zaustavljen = true;
let zadnjeStanje = null;
let naPromjenu = null;
let pretplataNaStanje = null;

const zapisi = (...dijelovi) => console.log('[sync-stream]', ...dijelovi);

const obradi = (signali) => {
    const prije = zadnjeStanje;
    zadnjeStanje = signali;
    // Prvo stanje je polazna točka; nakon prekida se NE zaboravlja, pa se
    // promjena koja se dogodila dok veza nije stajala ipak primijeti.
    if (!prije) return;
    const promjene = [];
    for (const vrsta of ['tickets', 'transport']) {
        if (Number(signali[vrsta] || 0) !== Number(prije[vrsta] || 0)) promjene.push(vrsta);
    }
    if (!promjene.length) return;
    zapisi('promjena:', promjene.join(', '));
    try {
        naPromjenu?.(promjene);
    } catch (e) {
        zapisi('osvježavanje nije uspjelo:', e?.message || e);
    }
};

// Poruke stižu kao "event: signals\ndata: {...}\n\n"; `responseText` raste, pa se
// pamti dokle je pročitano.
const napraviCitac = () => {
    let procitano = 0;
    let spremnik = '';
    return (tekst) => {
        spremnik += tekst.slice(procitano);
        procitano = tekst.length;
        const poruke = spremnik.split('\n\n');
        spremnik = poruke.pop();
        for (const poruka of poruke) {
            const redci = poruka.split('\n');
            const dogadaj = redci.find((r) => r.startsWith('event:'))?.slice(6).trim();
            const podaci = redci.find((r) => r.startsWith('data:'))?.slice(5).trim();
            if (dogadaj === 'signals' && podaci) {
                try { obradi(JSON.parse(podaci)); } catch (e) { /* nepotpuna poruka */ }
            }
        }
    };
};

const zakaziPonovno = () => {
    if (zaustavljen || ponovno) return;
    ponovno = setTimeout(() => { ponovno = null; spoji(); }, RAZMAK_PONOVNOG_SPAJANJA_MS);
};

const spoji = async () => {
    if (zaustavljen || xhr) return;
    try {
        const token = await storage.getToken();
        if (!token) return zakaziPonovno();
        const gateway = __DEV__ ? DEV_GATEWAY : ((await storage.getGateway()) || DEFAULT_GATEWAY_URL);

        const citaj = napraviCitac();
        xhr = new XMLHttpRequest();
        xhr.open('GET', gateway + PUTANJA);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.setRequestHeader('Accept', 'text/event-stream');
        xhr.onreadystatechange = () => {
            // 3 = stižu podaci, 4 = veza zatvorena.
            if (xhr?.readyState === 3) citaj(xhr.responseText || '');
            if (xhr?.readyState === 4) {
                citaj(xhr.responseText || '');
                xhr = null;
                zakaziPonovno();
            }
        };
        xhr.onerror = () => { xhr = null; zakaziPonovno(); };
        xhr.ontimeout = () => { xhr = null; zakaziPonovno(); };
        // Bez isteka: veza se drži otvorena dok je ima.
        xhr.timeout = 0;
        xhr.send();
        zapisi('otvorena veza prema poslužitelju');
    } catch (e) {
        zapisi('spajanje nije uspjelo:', e?.message || e);
        xhr = null;
        zakaziPonovno();
    }
};

const prekini = () => {
    try { xhr?.abort(); } catch (e) { /* već zatvoreno */ }
    xhr = null;
    if (ponovno) { clearTimeout(ponovno); ponovno = null; }
};

// Veza se drži samo dok je aplikacija u prvom planu: u pozadini je sustav ionako
// prekida, a otvorena veza bi trošila bateriju bez koristi.
const naStanjeAplikacije = (stanje) => {
    if (stanje === 'active') {
        if (!xhr) spoji();
    } else {
        prekini();
    }
};

export const startSyncStream = (rukovatelj) => {
    naPromjenu = rukovatelj;
    zaustavljen = false;
    if (!pretplataNaStanje) pretplataNaStanje = AppState.addEventListener('change', naStanjeAplikacije);
    spoji();
};

export const stopSyncStream = () => {
    zaustavljen = true;
    prekini();
    pretplataNaStanje?.remove?.();
    pretplataNaStanje = null;
    naPromjenu = null;
    zadnjeStanje = null;
};
