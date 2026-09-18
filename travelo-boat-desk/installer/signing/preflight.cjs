// electron-builder `beforePack` hook — zaustavlja build ako potpis/cert nisu
// spremni, da nijedna verzija ne ode van nepotpisana ili bez javnog certa.
//
// Zašto: cert (.cer) i ključ (.pfx) su gitignored. Bez njih build tiho ispadne
// NEPOTPISAN i bez certa u sebi → na novom kompu prva instalacija ne posadi cert
// u Trusted Root, pa SmartScreen upozorava i auto-update pada na provjeri potpisa.
// Cert se sadi samo pri prvoj (ručnoj) instalaciji; sve verzije MORAJU biti
// potpisane istim certom i nositi javni .cer.
//
// Namjerno nepotpisan (lokalni) build: TRAVELO_ALLOW_UNSIGNED=1.

const fs = require('fs');
const path = require('path');

exports.default = async function preflight() {
    const cert = path.join(__dirname, 'dist-cert', 'travelo-desk-signing.cer');
    const allowUnsigned = process.env.TRAVELO_ALLOW_UNSIGNED === '1';
    const problems = [];

    if (!fs.existsSync(cert)) {
        problems.push('Nedostaje javni cert: installer/signing/dist-cert/travelo-desk-signing.cer '
            + '(installer ga tada NEĆE posaditi u Trusted Root).');
    }
    if (!process.env.CSC_LINK) {
        problems.push('CSC_LINK nije postavljen — build NE bi bio potpisan.');
    } else if (!fs.existsSync(process.env.CSC_LINK)) {
        problems.push('CSC_LINK pokazuje na nepostojeći .pfx: ' + process.env.CSC_LINK);
    }
    if (!process.env.CSC_KEY_PASSWORD) {
        problems.push('CSC_KEY_PASSWORD nije postavljen.');
    }

    if (problems.length === 0) {
        console.log('  • preflight OK: javni cert spakiran + potpis konfiguriran.');
        return;
    }

    const poruka = 'POTPIS/CERT NISU SPREMNI:\n   - ' + problems.join('\n   - ');
    if (allowUnsigned) {
        console.warn('  • UPOZORENJE (TRAVELO_ALLOW_UNSIGNED=1) — nastavljam:\n   ' + poruka);
        return;
    }
    throw new Error(
        poruka
        + '\n\n   Rješenje: postavi CSC_LINK (put do .pfx) i CSC_KEY_PASSWORD te kopiraj'
        + '\n   javni cert u installer/signing/dist-cert/ (vidi installer/signing/README.md).'
        + '\n   Za namjerno nepotpisan lokalni build: TRAVELO_ALLOW_UNSIGNED=1.'
    );
};
