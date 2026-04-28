const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "DEV_SECRET";
const COOKIE_NAME = process.env.JWT_SECRET || "COOKIE_NAME";
const COOKIE_OPTIONS = process.env.JWT_SECRET || "COOKIE_OPTIONS";

const webPortalLoginController = async (req, res) => {
    try {
        
        console.log(req.body)
        const {UsersModel} = req.app.locals.models;
        const { username, password } = req.body
        console.log(req.body)
        if (!username || !password) return res.status(400).json({ message: "username/password required" });
        const user = await UsersModel.findOne({
            where:{
                username:username
            }
        });
        const hash = await bcrypt.hash(password, 10);
        console.log('HASH JE ', hash)
        if (!user) return res.status(401).json({ message: "Bad credentials, USER" });
        const ok = await bcrypt.compare(password, user.password);
        if (!ok) return res.status(401).json({ message: "Bad credentials" });
        
        const token = jwt.sign(
            { sub: user.id, username: user.username, roles: user.roles },
            JWT_SECRET,
            { expiresIn: "1d" }
        );
        
        res.cookie("travelo_session", token, {
            httpOnly: true,
            sameSite: "lax",
            secure: false,
            domain: "localhost"
        });
        return res.json({ ok: true, user: { id: user.id, username: user.username, roles: user.roles } });
    } catch (error) {
        console.log('ERRR', error)
    }
}

module.exports = {
    webPortalLoginController
}