const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "DEV_SECRET";
const COOKIE_NAME = process.env.JWT_SECRET || "COOKIE_NAME";
const COOKIE_OPTIONS = process.env.JWT_SECRET || "COOKIE_OPTIONS";

// Best-effort IP: iza gatewaya/nginxa stvarni klijent je u X-Forwarded-For;
// ako ga nema, ostaje ono što auth-service vidi (može biti interni IP).
const klijentIp = (req) => {
    const xff = String(req.headers?.["x-forwarded-for"] || "").split(",")[0].trim();
    return xff || req.socket?.remoteAddress || req.ip || null;
};

// Upis u log prijava. Nikad ne baca — logiranje ne smije srušiti prijavu.
const zapisiPrijavu = async (models, { username, success, reason, req }) => {
    try {
        await models.LoginLogsModel.create({
            username: username || "(prazno)",
            success,
            reason,
            ip_address: klijentIp(req),
        });
    } catch (e) {
        console.log("login_logs upis nije uspio:", e?.message || e);
    }
};

const webPortalLoginController = async (req, res) => {
    try {
        const models = req.app.locals.models;
        const { UsersModel } = models;
        const { username, password } = req.body
        if (!username || !password) return res.status(400).json({ message: "username/password required" });
        const user = await UsersModel.findOne({
            where:{
                username:username
            }
        });
        if (!user) {
            await zapisiPrijavu(models, { username, success: false, reason: "bad_user", req });
            return res.status(401).json({ message: "Bad credentials, USER" });
        }
        const ok = await bcrypt.compare(password, user.password);
        if (!ok) {
            await zapisiPrijavu(models, { username, success: false, reason: "bad_password", req });
            return res.status(401).json({ message: "Bad credentials" });
        }
        await zapisiPrijavu(models, { username, success: true, reason: "ok", req });

        const token = jwt.sign(
            { sub: user.id, username: user.username, roles: user.roles },
            JWT_SECRET,
            { expiresIn: "1d" }
        );
        
        res.cookie("travelo_session", token, {
            httpOnly: true,
            sameSite: "lax",
            secure: false,
        });
        return res.json({ ok: true, user: { id: user.id, username: user.username, roles: user.roles } });
    } catch (error) {
        console.log('ERRR', error)
    }
}

module.exports = {
    webPortalLoginController
}