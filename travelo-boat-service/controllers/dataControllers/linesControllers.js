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

const addLineDataController = async (req, res) =>{
    const sequelize = getSequelize();
    console.log(req.body)
    const { LinesModel } = req.app.locals.models;    
    const user = req.body.header
    const data = req.body.body;
    let responseData = {
        status:200,
        msg:'Line added successfully'
    }
    try {
        const result = await sequelize.transaction(async (t)=>{
            const lineExist = await LinesModel.findOne({where:{code:data.code}});
            if(lineExist){
                responseData = {
                    status:400,
                    msg:'Line with that code already exist'
                }
            }else{
                const lineDataToAdd = {
                    uuid:crypto.randomUUID(16),
                    name:data.name,
                    code:data.code,
                    first_harbor_id:data.first_harbor_name.uuid,
                    first_harbor_name:data.first_harbor_name.name,
                    last_harbor_id:data.last_harbor_name.uuid,
                    last_harbor_name:data.last_harbor_name.name,
                    region:data.region,
                    region_uuid:data.region_uuid,
                    type:data.type.name,
                    subsidised_line:data.type.subsidised_line,
                    is_active:true,
                    updated_by_uuid:user.uuid,
                    updated_by_username:user.username,
                    saop_cost_bearer: data.saop_cost_bearer || null,
                }
                const newLine = await LinesModel.create(lineDataToAdd); 
                responseData = {
                    status:200,
                    msg:'Line added successfully'
                }
            }
            const linesData = await LinesModel.findAll({
                attributes: { exclude: ['createdAt','updatedAt'] },
                order: [["id", "ASC"]],
            })
            res.send({
                status:responseData.status,
                msg:responseData.msg,
                data:{
                    lines:linesData
                }
            })
        });
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

const updateLineDataController = async (req, res) =>{
    const sequelize = getSequelize();
    const { LinesModel } = req.app.locals.models;    
    const lineData = req.body;
    let responseData = {
        status:200,
        msg:'Line updated successfully'
    }
    try {
        const result = await sequelize.transaction(async (t)=>{
            const lineExist = await LinesModel.findOne({where:{line_code:lineData.line_code}});
            if(lineExist){
                const updatedLine = await LinesModel.update(
                    {
                        name:lineData.name,
                        region:lineData.region,
                        region_uuid:lineData.region_uuid,
                        type:lineData.type,
                        subsidised_line:lineData.subsidised_line,
                        is_active:lineData.is_active,
                        updated_by_uuid:user.updated_by_uuid,
                        updated_by_username:user.updated_by_username,
                        ...(lineData.saop_cost_bearer !== undefined ? { saop_cost_bearer: lineData.saop_cost_bearer || null } : {}),
                    },
                    {where:{line_code:lineData.line_code}});
                 responseData = {
                    status:200,
                    msg:'Line updated successfully'
                }
            }else{
                responseData = {
                    status:400,
                    msg:'Line with that code does not exist'
                }
            }
            const linesData = await LinesModel.findAll({
                attributes: { exclude: ['createdAt','updatedAt'] },
                order: [["id", "ASC"]],
            })
            res.send({
                status:responseData.status,
                msg:responseData.msg,
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
    getLinesDataController,
    addLineDataController,
    updateLineDataController
}