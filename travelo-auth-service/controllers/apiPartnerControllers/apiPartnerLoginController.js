const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "DEV_SECRET";

const apiPartnerLoginController = async (req, res) => {
    try {
        const { PartnersApiUsersModel } = req.app.locals.models;
        const { tid, otp } = req.body || {};

        if (!tid || !otp) {
            return res.status(400).json({ msg: "tid/otp required" });
        }

        const apiUser = await PartnersApiUsersModel.findOne({
            where: { tid, otp, is_active: true },
        });

        if (!apiUser) {
            return res.status(401).json({ msg: "Bad credentials" });
        }

        const token = jwt.sign(
            {
                sub: apiUser.id,
                api_user_uuid: apiUser.uuid,
                partner_uuid: apiUser.partner_uuid,
                partner_acr: apiUser.partner_acr,
                tid: apiUser.tid,
                k: apiUser.key,
                role: "partner_api_user",
            },
            JWT_SECRET,
            { expiresIn: "1d" }
        );

        return res.status(200).json({
            msg: "token created",
            token,
        });
    } catch (error) {
        console.log("apiPartnerLogin error:", error);
        return res.status(500).json({ msg: "Internal error" });
    }
};

module.exports = {
    apiPartnerLoginController,
};
