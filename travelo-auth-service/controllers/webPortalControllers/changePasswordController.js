const jwt = require("jsonwebtoken");
const axios = require("axios");
const { getCoreServiceConfigData } = require("../configSyncController");

const JWT_SECRET = process.env.JWT_SECRET || "DEV_SECRET";

// Promjena vlastite lozinke s portala. Korisnika utvrdujemo iskljucivo iz
// sesijskog kolacica (JWT), NIKAD iz tijela zahtjeva — tako covjek moze mijenjati
// samo svoju lozinku, ne tudju. Sam upis i provjeru stare lozinke radi backoffice
// (izvor istine za korisnike); ovaj servis samo dokazuje identitet i proslijedi.
const changePasswordController = async (req, res) => {
    try {
        const token = req.cookies?.["travelo_session"];
        if (!token) return res.status(401).json({ message: "Not authenticated" });

        let payload;
        try {
            payload = jwt.verify(token, JWT_SECRET);
        } catch (err) {
            return res.status(401).json({ message: "Invalid or expired session" });
        }
        const username = payload?.username;
        if (!username) return res.status(401).json({ message: "Invalid session" });

        const { oldPassword, newPassword } = req.body || {};
        if (!oldPassword || !newPassword) {
            return res.status(400).json({ message: "oldPassword/newPassword required" });
        }

        const coreConfigData = await getCoreServiceConfigData();
        const backofficeUrl = coreConfigData?.services?.backoffice?.url;
        if (!backofficeUrl) return res.status(503).json({ message: "Backoffice nedostupan." });

        const bo = await axios.post(
            backofficeUrl + "/users/password",
            { username, oldPassword, newPassword },
            { validateStatus: () => true }
        );

        // Backoffice vraca svoj status u tijelu; preslikaj ga kupcu, ali bez
        // curenja internih detalja — samo poruka.
        const status = bo.data?.status || bo.status || 500;
        if (status === 200) return res.status(200).json({ message: "Lozinka je promijenjena." });
        return res.status(status).json({ message: bo.data?.msg || "Promjena lozinke nije uspjela." });
    } catch (error) {
        console.log("changePasswordController error:", error?.message || error);
        return res.status(500).json({ message: "Promjena lozinke nije uspjela." });
    }
};

module.exports = { changePasswordController };
