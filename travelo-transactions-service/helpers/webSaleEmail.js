const { Resend } = require('resend');

const API_KEY = process.env.RESEND_API_KEY || 're_eMiQgU7N_71D28aQsG3w1nSpD71CzuwCp';
const FROM = process.env.RESEND_FROM || 'Kapetan Luka <noreply@tech4beez.com>';

const resend = new Resend(API_KEY);

const buildHtml = (lang, buyerName) => {
    if (lang === 'en') {
        return `
            <h3>Hello ${buyerName || ''},</h3>
            <p>Your tickets and invoice are attached to this email.</p>
            <p>Please present the tickets when boarding the vessel. You can print them in A4 format or show them on your mobile device.</p>
            <p>Make sure your screen is bright and clean so the QR code can be scanned properly.</p>
            <p>The QR code is unique and valid only for the first scan!</p>
            <p>Thank you for choosing us, and have calm seas!</p>
            <p><em>This email was generated automatically — replies are not monitored.</em></p>
        `;
    }
    return `
        <h3>Pozdrav ${buyerName || ''},</h3>
        <p>Vaše karte i račun se nalaze u privitku ovog e-maila.</p>
        <p>Karte ste dužni predočiti prilikom ukrcaja na brod. Karte možete isprintati u A4 formatu ili predočiti na mobilnom uređaju.</p>
        <p>Molimo da ekran bude dobro osvijetljen i čist da bi se pravilno skenirao QR kod.</p>
        <p>QR kod je jedinstven i vrijedi samo prilikom prvog skeniranja!</p>
        <p>Hvala na ukazanom povjerenju i mirno more!</p>
        <p><em>E-mail poruka je generirana automatski i odgovor na nju nije moguć.</em></p>
    `;
};

const sendWebSaleEmail = async ({ to, lang = 'hr', buyerName, invoicePdf, ticketsPdf }) => {
    if (!to) {
        console.log('sendWebSaleEmail skipped: no recipient');
        return { skipped: true };
    }
    const attachments = [];
    if (invoicePdf) {
        attachments.push({
            filename: 'invoice.pdf',
            content: invoicePdf.toString('base64'),
            contentType: 'application/pdf',
        });
    }
    if (ticketsPdf) {
        attachments.push({
            filename: 'tickets.pdf',
            content: ticketsPdf.toString('base64'),
            contentType: 'application/pdf',
        });
    }

    try {
        const result = await resend.emails.send({
            from: FROM,
            to,
            subject: lang === 'en' ? 'Kapetan Luka - Your tickets' : 'Kapetan Luka - Vaše karte',
            html: buildHtml(lang, buyerName),
            attachments,
        });
        console.log('Email sent to', to, 'id:', result?.data?.id);
        return { ok: true, id: result?.data?.id };
    } catch (error) {
        console.log('sendWebSaleEmail error:', error?.message || error);
        return { ok: false, error: error?.message };
    }
};

module.exports = { sendWebSaleEmail };
