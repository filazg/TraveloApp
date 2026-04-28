const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "DEV_SECRET";

const checkWebPortalLoginController = async (req, res, next) => {
    console.log(req.cookies)
    const {UsersModel} = req.app.locals.models;
    try {
        const token = req.cookies?.["travelo_session"];
        if (!token) return res.status(401).json({ message: "Missing auth cookie" });
        
        const payload = jwt.verify(token, JWT_SECRET); 
        const user = await UsersModel.findOne({
            where:{
                username:payload.username
            }
        })
        if (!user?.is_active) return res.status(401).json({ message: "Nedozvoljen pristup" });
        req.user = payload; 
        //return next();
        return res.status(200).json({data:user})
    } catch (err) {
        return res.status(401).json({ message: "Invalid or expired session" });
    }
}

async function checkMeController(req, res, next) {
    console.log('GET')
    const {UsersModel, UsersPermissionsModel} = req.app.locals.models;
    const token = req.cookies?.["travelo_session"];
    console.log(token)
    if (!token) {
        return res.status(401).json({ message: "Not authenticated" });
    }

    try {
        const payload = jwt.verify(token, JWT_SECRET);
        // payload = { sub: userId, ver, roles?, iat, exp }

        const user = await UsersModel.findOne({
            where:{
                username:payload.username
            },
            attributes: { exclude: ["password",'createdAt','updatedAt'] },
        })
        const userPermissions = await UsersPermissionsModel.findAll({
            where:{
                user_uuid:user.uuid
            },
            attributes: { exclude: ['createdAt','updatedAt'] },
            order:['id']
        })
        const userToSend = {
            ...user.toJSON(),
            permissions: userPermissions
        };

        if (!user) return res.status(401).json({ message: "User not found" });
        if (!user.is_active) return res.status(403).json({ message: "User disabled" });

        // (opcionalno) token version check
        //if (payload.ver !== user.token_version) {
        //  return res.status(401).json({ message: "Session revoked" });
        //}

        req.user = user;
        //next();

        return res.status(200).json({message:"ME radi", data:userToSend})
    } catch (err) {
        console.log(err)
        return res.status(401).json({ message: "Invalid session" });
    }
}

module.exports = {
    checkWebPortalLoginController,
    checkMeController
}