const { getSequelize } = require("../../config/database")
const { Op } = require("sequelize");
const sequelize = getSequelize();

// Singleton pravilo — tip WEB_OFFICE (Web prodaja) može imati samo jedno AKTIVNO prodajno mjesto.
// Vraća uuid postojećeg ako postoji, inače null.
async function findConflictingActiveWeb(BusinessPremisesModel, { type, is_active, excludeUuid }) {
    if (type !== 'WEB_OFFICE' || !is_active) return null;
    const where = { type: 'WEB_OFFICE', is_active: true };
    if (excludeUuid) where.uuid = { [Op.ne]: excludeUuid };
    return BusinessPremisesModel.findOne({ where });
}

const getBusinessPremisesDataController = async(req,res)=>{
    const { BusinessPremisesModel } = req.app.locals.models;
    try {
        const businessPremisesData = await BusinessPremisesModel.findAll({
            attributes: { exclude: ['createdAt','updatedAt'] },
            order: [["id", "ASC"]],
        })
        res.send({
            status:200,
            data:{
                business_premises:businessPremisesData
            }
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

const addBusinessPremiseDataController = async(req,res)=>{
    const { BusinessPremisesModel } = req.app.locals.models;
    try {
        const data = req.body.body
        const result = sequelize.transaction(async (t)=>{
            const businessPremiseExist = await BusinessPremisesModel.findOne({
                where:{
                    fiskal_mark:data.fiskal_mark,
                }
            })
            if(!businessPremiseExist){
                // Singleton: samo jedan aktivni WEB premise u sustavu.
                const conflict = await findConflictingActiveWeb(BusinessPremisesModel, {
                    type: data.type,
                    is_active: data.is_active,
                });
                if (conflict) {
                    return res.status(409).send({
                        status: 409,
                        msg: `Već postoji aktivno prodajno mjesto tipa Web prodaja: "${conflict.name}". Deaktivirajte ga prije dodavanja novog.`,
                        conflict_uuid: conflict.uuid,
                    });
                }
                const addBusinessPremise = await BusinessPremisesModel.create({
                    uuid:crypto.randomUUID(16),
                    name:data.name,
                    type_uuid:data.type_uuid,
                    type:data.type,
                    address:data.address,
                    postal_code:data.postal_code,
                    town:data.town,
                    country:data.country,
                    description:data.description,
                    fiskal_mark:data.fiskal_mark,
                    working_time:data.working_time,
                    cost_center:data.cost_center,
                    bp_own:data.bp_own,
                    // Partner se pamti samo na partnerskom prodajnom mjestu, da
                    // zaostali odabir ne ostane visjeti na vlastitom.
                    partner_uuid:data.bp_own === 'PARTNER_BP' ? data.partner_uuid : null,
                    partner_name:data.bp_own === 'PARTNER_BP' ? data.partner_name : null,
                    is_active:data.is_active
                })
                res.send({
                    status:201,
                })
            }else{
                res.send({
                    status:208,
                    msg:'Business Premise already exist'
                })
            }
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

const updateBusinessPremiseDataController = async(req,res)=>{
    const { BusinessPremisesModel } = req.app.locals.models;
    try {
        const data = req.body.body
        console.log(data)
        const result = sequelize.transaction(async (t)=>{
            const businessPremiseExist = await BusinessPremisesModel.findOne({
                uuid:data.uuid
            })
            if(businessPremiseExist){
                // Singleton: ako update aktivira WEB premise, mora biti jedini aktivni.
                const targetType = data.type ?? businessPremiseExist.type;
                const targetActive = data.is_active ?? businessPremiseExist.is_active;
                const conflict = await findConflictingActiveWeb(BusinessPremisesModel, {
                    type: targetType,
                    is_active: targetActive,
                    excludeUuid: data.uuid,
                });
                if (conflict) {
                    return res.status(409).send({
                        status: 409,
                        msg: `Već postoji aktivno prodajno mjesto tipa Web prodaja: "${conflict.name}". Deaktivirajte ga prije aktiviranja drugog.`,
                        conflict_uuid: conflict.uuid,
                    });
                }
                const updateBusinessPremise = await BusinessPremisesModel.update({
                    name:data.name,
                    address:data.address,
                    postal_code:data.postal_code,
                    town:data.town,
                    country:data.country,
                    description:data.description,
                    working_time:data.working_time,
                    cost_center:data.cost_center,
                    // Vlasništvo i partner se dosad nisu spremali pri izmjeni, pa
                    // se prodajno mjesto nije moglo naknadno označiti partnerskim
                    // niti mu se moglo promijeniti partnera. Fiskalna oznaka i tip
                    // namjerno ostaju izvan izmjene — mijenjaju fiskalnu sliku.
                    bp_own:data.bp_own,
                    partner_uuid:data.bp_own === 'PARTNER_BP' ? data.partner_uuid : null,
                    partner_name:data.bp_own === 'PARTNER_BP' ? data.partner_name : null,
                    is_active:data.is_active
                },{where:{
                    uuid:data.uuid
                }})
                res.send({
                    status:202,
                })
            }else{
                res.send({
                    status:404,
                    msg:'Business premise not exist'
                })
            }
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
    getBusinessPremisesDataController,
    addBusinessPremiseDataController,
    updateBusinessPremiseDataController
}