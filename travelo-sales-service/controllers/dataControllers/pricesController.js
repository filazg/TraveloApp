const { getSequelize } = require("../../config/database");
const { bezPdv, zaSvojRacun } = require("../../helpers/cijene");

const getPricesDataController = async (req, res) => {
    const sequelize = getSequelize();
    const { TimetablePricesModel } = req.app.locals.models;    
    try {
        const result = await sequelize.transaction(async (t)=>{
            const pricesData = await TimetablePricesModel.findAll({
                attributes: { exclude: ['createdAt','updatedAt'] },
                order: [["id", "ASC"]],
            })
            // Partneru koji prodaje u svoje ime saljemo nasu cijenu prema
            // njemu: bez PDV-a, s luckom pristojbom u sebi. Koliko ce on
            // naplatiti putniku ne znamo — to je njegova cijena, ne nasa.
            const zaSlanje = zaSvojRacun(req.query.channel)
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