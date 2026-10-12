const { getSequelize } = require("../../config/database");
const { bezPdv, saljeBezPdva } = require("../../helpers/cijene");

const getPricesDataController = async (req, res) => {
    const sequelize = getSequelize();
    const { TimetablePricesModel } = req.app.locals.models;    
    try {
        const result = await sequelize.transaction(async (t)=>{
            const pricesData = await TimetablePricesModel.findAll({
                attributes: { exclude: ['createdAt','updatedAt'] },
                // Vrste karata redom zadanim na plovidbenom redu.
                order: [["timetable_uuid", "ASC"], ["ticket_type_order", "ASC NULLS LAST"], ["id", "ASC"]],
            })
            // Partneru koji prodaje u svoje ime saljemo nasu cijenu prema
            // njemu: bez PDV-a, s luckom pristojbom u sebi. Koliko ce on
            // naplatiti putniku ne znamo — to je njegova cijena, ne nasa.
            const zaSlanje = await saljeBezPdva(req.query.channel, req.query.partner_uuid)
                ? pricesData.map((p) => ({ ...p.dataValues || p, price: bezPdv(p.price) }))
                : pricesData;
            res.send({
                status:200,
                data:{
                    prices:zaSlanje
                }
            })
        })
    } catch (error) {
        console.log(error)
        res.send({
            status:500,
            data:{
                error
            }
        })
    }
}

module.exports = {
    getPricesDataController
}