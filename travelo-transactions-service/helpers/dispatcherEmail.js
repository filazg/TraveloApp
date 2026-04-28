const { Resend } = require('resend');

const API_KEY = process.env.RESEND_API_KEY || 're_eMiQgU7N_71D28aQsG3w1nSpD71CzuwCp';
const FROM = process.env.RESEND_FROM || 'Kapetan Luka <noreply@tech4beez.com>';

const resend = new Resend(API_KEY);

const buildHtml = ({ body, signature = "" }) => `
    <div style="font-family:sans-serif;color:#1e293b;line-height:1.5">
        <div style="white-space:pre-wrap">${String(body || "").replace(/</g, "&lt;")}</div>
        ${signature ? `<p style="margin-top:24px;color:#64748b"><em>${signature}</em></p>` : ""}
        <hr style="margin-top:24px;border:none;border-top:1px solid #e2e8f0" />
        <p style="color:#94a3b8;font-size:12px">
            E-mail poruka je generirana automatski — odgovor na nju nije moguć.
        </p>
    </div>
`;

const sendDispatcherEmail = async ({ to, subject, body, signature }) => {
    if (!to) return { ok: false, skipped: true, reason: "no recipient" };
    try {
        const result = await resend.emails.send({
            from: FROM,
            to,
            subject: subject || "Kapetan Luka - Info",
            html: buildHtml({ body, signature }),
        });
        return { ok: true, id: result?.data?.id };
    } catch (error) {
        return { ok: false, error: error?.message };
    }
};

module.exports = { sendDispatcherEmail };
