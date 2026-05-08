const { Resend } = require('resend');

const API_KEY = process.env.RESEND_API_KEY || 're_eMiQgU7N_71D28aQsG3w1nSpD71CzuwCp';
const FROM = process.env.RESEND_FROM || 'Kapetan Luka <noreply@tech4beez.com>';

const resend = new Resend(API_KEY);

const escapeHtml = (s) => String(s || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const buildSailingDetails = (sailing) => {
    if (!sailing || typeof sailing !== "object") return "";
    const line = [sailing.line_code, sailing.line_name].filter(Boolean).join(" · ");
    const route = [sailing.start_harbor, sailing.end_harbor].filter(Boolean).join(" → ");
    const dt = [sailing.departure_date, sailing.departure_time].filter(Boolean).join(" ");
    const rows = [
        line && `<tr><td style="padding:4px 12px 4px 0;color:#64748b">Linija</td><td style="padding:4px 0">${escapeHtml(line)}</td></tr>`,
        route && `<tr><td style="padding:4px 12px 4px 0;color:#64748b">Relacija</td><td style="padding:4px 0">${escapeHtml(route)}</td></tr>`,
        dt && `<tr><td style="padding:4px 12px 4px 0;color:#64748b">Datum / vrijeme</td><td style="padding:4px 0">${escapeHtml(dt)}</td></tr>`,
    ].filter(Boolean).join("");
    if (!rows) return "";
    return `
        <div style="margin:0 0 20px;padding:14px 16px;background:#f8fafc;border-left:3px solid #2E53A0;border-radius:4px">
            <div style="font-size:13px;font-weight:600;color:#0f172a;margin-bottom:8px">Detalji putovanja</div>
            <table style="font-size:14px;color:#1e293b;border-collapse:collapse">${rows}</table>
        </div>
    `;
};

const buildHtml = ({ body, signature = "", sailing }) => `
    <div style="font-family:sans-serif;color:#1e293b;line-height:1.5">
        ${buildSailingDetails(sailing)}
        <div style="white-space:pre-wrap">${escapeHtml(body)}</div>
        ${signature ? `<p style="margin-top:24px;color:#64748b"><em>${signature}</em></p>` : ""}
        <hr style="margin-top:24px;border:none;border-top:1px solid #e2e8f0" />
        <p style="color:#94a3b8;font-size:12px">
            E-mail poruka je generirana automatski — odgovor na nju nije moguć.
        </p>
    </div>
`;

const sendDispatcherEmail = async ({ to, subject, body, signature, sailing }) => {
    if (!to) return { ok: false, skipped: true, reason: "no recipient" };
    try {
        const result = await resend.emails.send({
            from: FROM,
            to,
            subject: subject || "Kapetan Luka - Info",
            html: buildHtml({ body, signature, sailing }),
        });
        return { ok: true, id: result?.data?.id };
    } catch (error) {
        return { ok: false, error: error?.message };
    }
};

module.exports = { sendDispatcherEmail };
