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
    // Portal salje ravan objekt, stariji pozivatelji {header, body} — podnose se
    // oba oblika, inace dodavanje linije puca na nedefiniranim podacima.
    const user = req.body.header || {};
    const data = req.body.body || req.body || {};
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
                    ...povlastice(data),
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

// Prihvacanje povlastenih kartica na liniji. Cita se samo ono sto je poslano,
// da spremanje iz starijeg ekrana ne obrise postavku koju taj ekran ne zna.
//
// Postotak je omeden na 0-100: iznad toga karta bi izasla s negativnom cijenom.
const NACINI_SEOP = ["ne", "prebivaliste", "svi"];

const povlastice = (d) => {
    const o = {};
    if (d.seop_mode !== undefined) {
        o.seop_mode = NACINI_SEOP.includes(d.seop_mode) ? d.seop_mode : "ne";
    }
    if (d.seop_report_sales !== undefined) o.seop_report_sales = !!d.seop_report_sales;
    if (d.seop_apply_discount !== undefined) o.seop_apply_discount = !!d.seop_apply_discount;
    if (d.mosi_accepted !== undefined) o.mosi_accepted = !!d.mosi_accepted;
    if (d.mosi_discount_pct !== undefined) {
        const n = parseInt(d.mosi_discount_pct, 10);
        o.mosi_discount_pct = Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0;
    }
    if (d.mosi_companion_free !== undefined) o.mosi_companion_free = !!d.mosi_companion_free;
    return o;
};

const updateLineDataController = async (req, res) =>{
    const sequelize = getSequelize();
    const { LinesModel } = req.app.locals.models;    
    const lineData = req.body?.body || req.body || {};
    // Ovaj kontroler je dosad citao nepostojecu varijablu , pa je svako
    // azuriranje zavrsavalo u catchu — a odgovor je svejedno bio 200.
    const user = req.body?.header || {};
    let responseData = {
        status:200,
        msg:'Line updated successfully'
    }
    try {
        const result = await sequelize.transaction(async (t)=>{
            // Linija se trazi po `code`; stupca `line_code` u tablici nema, pa je
            // svako azuriranje dosad padalo na upitu.
            const lineExist = await LinesModel.findOne({where:{code:lineData.code}});
            if(lineExist){
                const updatedLine = await LinesModel.update(
                    {
                        name:lineData.name,
                        region:lineData.region,
                        region_uuid:lineData.region_uuid,
                        type:lineData.type,
                        subsidised_line:lineData.subsidised_line,
                        is_active:lineData.is_active,
                        updated_by_uuid: user.uuid || lineData.updated_by_uuid || null,
                        updated_by_username: user.username || lineData.updated_by_username || null,
                        ...(lineData.saop_cost_bearer !== undefined ? { saop_cost_bearer: lineData.saop_cost_bearer || null } : {}),
                        ...povlastice(lineData),
                    },
                    {where:{code:lineData.code}});
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