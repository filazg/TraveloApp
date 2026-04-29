const crypto = require("node:crypto");

// Per spec — control_code = SHA512(k + concat of body fields in given order).
// Numeric fields (length, totals) are concatenated as their decimal string form.
const validateControlCode = (fieldOrder) => (req, res, next) => {
    try {
        if (!req.partner || !req.partner.k) {
            return res.status(401).json({ msg: "Unauthorized" });
        }
        const body = req.body || {};
        const submitted = body.control_code;
        if (!submitted || typeof submitted !== "string") {
            return res.status(400).json({ msg: "control_code required" });
        }

        let raw = req.partner.k;
        for (const field of fieldOrder) {
            const value = field(body);
            if (value === undefined || value === null) {
                return res.status(400).json({ msg: "Missing field for control_code" });
            }
            raw += String(value);
        }

        const expected = crypto.createHash("sha512").update(raw).digest("hex");
        if (expected !== submitted) {
            return res.status(400).json({ msg: "Invalid control_code" });
        }
        return next();
    } catch (err) {
        console.log("validateControlCode error:", err);
        return res.status(500).json({ msg: "Internal error" });
    }
};

module.exports = { validateControlCode };
