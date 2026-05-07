const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "DEV_SECRET";
const PARTNER_COOKIE = "travelo_partner_session";

const cookieOptions = {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
};

const comparePassword = async (plain, stored) => {
    if (!stored) return false;
    // Support both bcrypt-hashed and plain-text stored passwords
    // (portal currently stores partners_web_users passwords in plain text).
    if (stored.startsWith("$2")) return bcrypt.compare(plain, stored);
    return plain === stored;
};

const partnerPortalLoginController = async (req, res) => {
    try {
        const { PartnersWebUsersModel } = req.app.locals.models;
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ message: "username/password required" });
        }

        const user = await PartnersWebUsersModel.findOne({ where: { username, is_active: true } });
        if (!user) return res.status(401).json({ message: "Bad credentials" });

        const ok = await comparePassword(password, user.password);
        if (!ok) return res.status(401).json({ message: "Bad credentials" });

        const token = jwt.sign(
            {
                sub: user.id,
                uuid: user.uuid,
                username: user.username,
                partner_uuid: user.partner_uuid,
                partner_name: user.partner_name,
                partner_acr: user.partner_acr,
                role: "partner_web_user",
            },
            JWT_SECRET,
            { expiresIn: "1d" }
        );

        res.cookie(PARTNER_COOKIE, token, cookieOptions);

        return res.json({
            ok: true,
            user: {
                id: user.id,
                uuid: user.uuid,
                username: user.username,
                partner_uuid: user.partner_uuid,
                partner_name: user.partner_name,
                partner_acr: user.partner_acr,
            },
        });
    } catch (error) {
        console.log("partner login error:", error);
        return res.status(500).json({ message: "Internal error" });
    }
};

const partnerCheckLoginController = async (req, res) => {
    try {
        const { PartnersWebUsersModel } = req.app.locals.models;
        const token = req.cookies?.[PARTNER_COOKIE];
        if (!token) return res.status(401).json({ message: "Missing partner session" });

        const payload = jwt.verify(token, JWT_SECRET);
        const user = await PartnersWebUsersModel.findOne({
            where: { uuid: payload.uuid, is_active: true },
        });

        if (!user) return res.status(401).json({ message: "User no longer active" });

        return res.status(200).json({
            data: {
                id: user.id,
                uuid: user.uuid,
                username: user.username,
                partner_uuid: user.partner_uuid,
                partner_name: user.partner_name,
                partner_acr: user.partner_acr,
            },
        });
    } catch (err) {
        return res.status(401).json({ message: "Invalid or expired session" });
    }
};

const partnerMeController = partnerCheckLoginController;

const partnerLogoutController = async (req, res) => {
    res.clearCookie(PARTNER_COOKIE, cookieOptions);
    return res.json({ ok: true });
};

module.exports = {
    partnerPortalLoginController,
    partnerCheckLoginController,
    partnerMeController,
    partnerLogoutController,
};
