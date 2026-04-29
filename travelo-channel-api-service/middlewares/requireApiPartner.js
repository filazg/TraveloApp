const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "DEV_SECRET";

const requireApiPartner = (req, res, next) => {
    try {
        const authHeader = req.headers["authorization"] || req.headers["Authorization"];
        if (!authHeader || typeof authHeader !== "string") {
            return res.status(401).json({ msg: "Unauthorized" });
        }
        const parts = authHeader.split(" ");
        if (parts.length !== 2 || parts[0] !== "Bearer") {
            return res.status(401).json({ msg: "Unauthorized" });
        }
        const token = parts[1];
        const payload = jwt.verify(token, JWT_SECRET);
        if (payload.role !== "partner_api_user") {
            return res.status(401).json({ msg: "Unauthorized" });
        }
        req.partner = {
            api_user_uuid: payload.api_user_uuid,
            partner_uuid: payload.partner_uuid,
            partner_acr: payload.partner_acr,
            tid: payload.tid,
            k: payload.k,
        };
        return next();
    } catch (err) {
        return res.status(401).json({ msg: "Invalid or expired token" });
    }
};

module.exports = { requireApiPartner };
