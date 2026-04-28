const { Sequelize } = require('sequelize');

const getBusinesPremisessData = async(req,res)=>{
    const {BusinessPremisesModel} = req.app.locals.models; 
    try {
        const businessPremisesData = await BusinessPremisesModel.findAll({
            where:{
                is_active:true
            },
            attributes: { exclude: ['uuid','type_uuid', 'partner_uuid','is_active','bp_own','fiskal_mark','description', 'createdAt','updatedAt'] },
            order: [["id", "ASC"]],
        })
        res.send({
            business_premises:businessPremisesData         
        })
    } catch (error) {
        console.log('ERROR' , error)
        res.send({
            status:500             
        })
    }
}

module.exports = {
    getBusinesPremisessData
}