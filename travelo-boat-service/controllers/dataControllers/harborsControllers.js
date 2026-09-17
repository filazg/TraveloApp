const { getSequelize } = require("../../config/database");

const getHarborsDataController = async (req, res) => {
    const sequelize = getSequelize();
    const { HarborsModel } = req.app.locals.models;    
    try {
        const result = await sequelize.transaction(async (t)=>{
            const harborsData = await HarborsModel.findAll({
                attributes: { exclude: ['createdAt','updatedAt'] },
                order: [["id", "ASC"]],
            })
            res.send({
                status:200,
                data:{
                    harbors:harborsData
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

const addHarborDataController = async (req, res) =>{
    console.log(req.body)
    const sequelize = getSequelize();
    const { HarborsModel } = req.app.locals.models;   
    const user = req.body.header
    const data = req.body.body;
    let responseData = {
        status:200,
        msg:'Harbor added successfully'
    }
    try {
        const result = await sequelize.transaction(async (t)=>{
            const harborExist = await HarborsModel.findOne({where:{code:data.code}});
            if(harborExist){
                responseData = {
                    status:400,
                    msg:'Harbor with that code already exist'
                }
            }else{
                const harborDataToAdd = {
                    uuid:crypto.randomUUID(16),
                    name:data.name,
                    code:data.code,
                    longitude:data.longitude,
                    latitude:data.latitude,
                    city:data.city,
                    region:data.region,
                    country:data.country,
                    seop_island:data.seop_island,
                    is_active:data.is_active ?? true,
                    updated_by_uuid:user.updated_by_uuid,
                    updated_by_username:user.updated_by_username
                }
                const newHarbor = await HarborsModel.create(harborDataToAdd);
                responseData = {
                    status:200,
                    msg:'Harbor added successfully'
                }
            }
            const harborData = await HarborsModel.findAll({
                attributes: { exclude: ['createdAt','updatedAt'] },
                order: [["id", "ASC"]],
            });
            res.send({
                status:responseData.status,
                msg:responseData.msg,
                data:{
                    harbors:harborData
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

const updateHarborDataController = async (req, res) =>{
    const sequelize = getSequelize();
    const { HarborsModel, RoutesModel, DeparturesModel, TimetablePricesModel, LinesModel } = req.app.locals.models;
    const user = req.body.header
    const data = req.body.body;
    let responseData = {
        status:200,
        msg:'Harbor updated successfully'
    }
    try {
        const result = await sequelize.transaction(async (t)=>{
            const harborExist = await HarborsModel.findOne({where:{code:data.code}});
            if(harborExist){
                const updatedHarbor = await HarborsModel.update(
                    {
                        name:data.name,
                        longitude:data.longitude,
                        latitude:data.latitude,
                        city:data.city,
                        region:data.region,
                        region_uuid:data.region_uuid,
                        country:data.country,
                        seop_island:data.seop_island,
                        is_active:data.is_active,
                        updated_by_uuid:user.updated_by_uuid,
                        updated_by_username:user.updated_by_username
                    },
                    {where:{code:data.code}, transaction:t});

                    // Naziv luke stoji denormalizirano na vise mjesta koja ga
                    // prikazuju bez zivog dohvata iz `harbors`: plovidbeni red
                    // (routes/departures) i cijene (timetable_prices) vezu luku
                    // po KODU, a linije po UUID-u. Bez ovoga preimenovanje ostane
                    // samo na luci, a plovidbeni red pokazuje stari naziv.
                    const kod = data.code;
                    const noviNaziv = data.name;
                    const uuid = harborExist.uuid;
                    await RoutesModel.update({ departure_harbor_name: noviNaziv }, { where:{ departure_harbor_id: kod }, transaction:t });
                    await RoutesModel.update({ arrival_harbor_name: noviNaziv }, { where:{ arrival_harbor_id: kod }, transaction:t });
                    await DeparturesModel.update({ departure_harbor_name: noviNaziv }, { where:{ departure_harbor_id: kod }, transaction:t });
                    await DeparturesModel.update({ arrival_harbor_name: noviNaziv }, { where:{ arrival_harbor_id: kod }, transaction:t });
                    await TimetablePricesModel.update({ harbor_from: noviNaziv }, { where:{ harbor_from_code: kod }, transaction:t });
                    await TimetablePricesModel.update({ harbor_to: noviNaziv }, { where:{ harbor_to_code: kod }, transaction:t });
                    await LinesModel.update({ first_harbor_name: noviNaziv }, { where:{ first_harbor_id: uuid }, transaction:t });
                    await LinesModel.update({ last_harbor_name: noviNaziv }, { where:{ last_harbor_id: uuid }, transaction:t });

                    responseData = {
                        status:200,
                        msg:'Harbor updated successfully'
                    }
            }else{
                responseData = {
                    status:400,
                    msg:'Harbor with that code does not exist'
                }
            }
            const harborData = await HarborsModel.findAll({
                attributes: { exclude: ['createdAt','updatedAt'] },
                order: [["id", "ASC"]],
            });
            res.send({
                status:responseData.status,
                msg:responseData.msg,
                data:{
                    harbors:harborData
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
    getHarborsDataController,
    addHarborDataController,
    updateHarborDataController
}