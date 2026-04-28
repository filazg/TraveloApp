const { getSequelize } = require("../../config/database");

const getRegionsDataController = async (req, res) => {
    const sequelize = getSequelize();
    const { RegionsModel } = req.app.locals.models;
    try {
        const result = await sequelize.transaction(async (t)=>{
            const regionsData = await RegionsModel.findAll({
                attributes: { exclude: ['createdAt','updatedAt'] },
                order: [["id", "ASC"]],
            })
            res.send({
                status:200,
                data:{
                    regions:regionsData
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

const addRegionDataController = async (req, res) =>{
    const sequelize = getSequelize();
    const { RegionsModel } = req.app.locals.models;
    const regionData = req.body?.body || req.body || {};
    let responseData = { status:200, msg:'Region added successfully' }
    try {
        await sequelize.transaction(async (t)=>{
            const exists = await RegionsModel.findOne({ where:{ name: regionData.name } });
            if (exists) {
                responseData = { status:400, msg:'Region with that name already exists' }
            } else {
                await RegionsModel.create({
                    uuid: require('crypto').randomUUID(),
                    name: regionData.name,
                    code: regionData.code || null,
                });
            }
            const regionsData = await RegionsModel.findAll({
                attributes: { exclude: ['createdAt','updatedAt'] },
                order: [["id", "ASC"]],
            })
            res.send({
                status: responseData.status,
                msg: responseData.msg,
                data: { regions: regionsData },
            })
        });
    } catch (error) {
        console.log('addRegionDataController error:', error?.message || error);
        res.status(500).send({ status:500, data:{ error: error.message } })
    }
}

const updateRegionDataController = async (req, res) =>{
    const sequelize = getSequelize();
    const { RegionsModel } = req.app.locals.models;
    const regionData = req.body?.body || req.body || {};
    let responseData = { status:200, msg:'Region updated successfully' }
    try {
        await sequelize.transaction(async (t)=>{
            if (!regionData.uuid) {
                responseData = { status:400, msg:'uuid required' }
            } else {
                const exists = await RegionsModel.findOne({ where:{ uuid: regionData.uuid } });
                if (!exists) {
                    responseData = { status:404, msg:'Region does not exist' }
                } else {
                    await RegionsModel.update(
                        { name: regionData.name ?? exists.name, code: regionData.code ?? exists.code },
                        { where: { uuid: regionData.uuid } }
                    );
                }
            }
            const regionsData = await RegionsModel.findAll({
                attributes: { exclude: ['createdAt','updatedAt'] },
                order: [["id", "ASC"]],
            })
            res.send({
                status: responseData.status,
                msg: responseData.msg,
                data: { regions: regionsData },
            })
        });
    } catch (error) {
        console.log('updateRegionDataController error:', error?.message || error);
        res.status(500).send({ status:500, data:{ error: error.message } })
    }
}

module.exports = {
    getRegionsDataController,
    addRegionDataController,
    updateRegionDataController
}