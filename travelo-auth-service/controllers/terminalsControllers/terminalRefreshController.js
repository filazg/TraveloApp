const { rotateRefresh } = require("./terminalTokens");

// Tiha obnova access tokena: klijent (desk/mobile) na 401 pošalje refresh_token,
// dobije novi access + rotirani refresh (klizni +30d). Nevaljan/istekao/opozvan
// refresh → 401, klijent tada ide na re-auth (zero-touch/pairing).
const terminalRefreshController = async (req, res) => {
    try {
        const { refresh_token } = req.body || {};
        if (!refresh_token) {
            return res.send({ status: 400, data: { msg: "refresh_token je obavezan" } });
        }
        const rez = await rotateRefresh(req.app.locals.models, refresh_token);
        if (!rez) {
            return res.send({ status: 401, data: { msg: "Refresh token nije valjan ili je istekao" } });
        }
        return res.send({
            status: 200,
            data: { msg: "token obnovljen", token: rez.token, refresh_token: rez.refresh_token },
        });
    } catch (error) {
        console.log("terminalRefreshController error:", error?.message || error);
        res.send({ status: 500, data: { msg: "greška pri obnovi tokena" } });
    }
};

module.exports = { terminalRefreshController };
