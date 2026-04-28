const { getSequelize } = require("../../config/database");

const getLinesDataController = async (req, res) => {
    const sequelize = getSequelize();
    const { LinesModel } = req.app.locals.models;    
    try {
        const result = await sequelize.transaction(async (t)=>{
            const linesData = await LinesModel.findAll({
                attributes: { exclude: ['createdAt','updatedAt'] },
                order: [["id", "ASC"]],
            })
            res.send({
                status:200,
                data:{
                    lines:linesData
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
    getLinesDataController
}