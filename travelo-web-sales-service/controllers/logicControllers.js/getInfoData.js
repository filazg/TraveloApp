const axios = require('axios');
const { getCoreServiceConfigData } = require('../configSyncController');

// Obavijesti koje web stranica prikazuje posjetiteljima.
//
// Tekst se pise u portalu i cuva u backofficeu; ovdje se samo posreduje, u
// obliku dogovorenom s izradjivacem stranice ("informations").
//
// Backoffice vraca vec samo one koje trenutno vrijede — pravilo o razdoblju
// prikaza stoji na jednom mjestu, da ga stranica ne mora ponavljati.
const TRAJANJE_KESA_MS = 60 * 1000;

let kes = { vrijeme: 0, podaci: [] };

const dohvatiIzBackofficea = async () => {
    const coreConfigData = await getCoreServiceConfigData();
    const url = coreConfigData?.services?.backoffice?.url;
    if (!url) throw new Error('u konfiguraciji nema adrese backoffice servisa');
    const response = await axios.get(`${url}/web_notices/active`, { timeout: 8000 });
    return response.data?.data?.web_notices || [];
};

const getInfoData = async (req, res) => {
    try {
        const sada = Date.now();
        if (sada - kes.vrijeme < TRAJANJE_KESA_MS) {
            return res.send({ status: 200, informations: kes.podaci });
        }
        try {
            const podaci = await dohvatiIzBackofficea();
            kes = { vrijeme: sada, podaci };
        } catch (error) {
            // Obavijesti nisu kriticne za rad stranice, pa se pad backofficea ne
            // prenosi dalje: ide zadnje poznato stanje. Prazno tek ako nikad
            // nista nije dohvaceno.
            console.log('obavijesti se ne mogu dohvatiti, ide zadnje poznato stanje:', error?.message || error);
        }
        res.send({ status: 200, informations: kes.podaci });
    } catch (error) {
        console.log('ERROR', error);
        res.send({ status: 500 });
    }
};

module.exports = {
    getInfoData
};
