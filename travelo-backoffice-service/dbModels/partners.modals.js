const { DataTypes } = require("sequelize");

module.exports =  (sequelize) =>{
    const PartnersModel = sequelize.define(
    "partners",
    {
        id:{
            type:DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        uuid:{
            type:DataTypes.STRING,
            allowNull:false
        },
        partner_name:{
            type:DataTypes.STRING,
            allowNull:false
        },
        partner_acr:{
            type:DataTypes.STRING,
            allowNull:true
        },
        partner_legal_id:{
            type:DataTypes.STRING,
            allowNull:false
        },
        partner_vat_id:{
            type:DataTypes.STRING,
            allowNull:true
        },
        partner_address:{
            type:DataTypes.STRING,
            allowNull:true
        },
        partner_postal_code:{
            type:DataTypes.STRING,
            allowNull:true
        },
        partner_town:{
            type:DataTypes.STRING,
            allowNull:true
        },
        partner_country:{
            type:DataTypes.STRING,
            allowNull:true
        },
        partner_email:{
            type:DataTypes.STRING,
            allowNull:true
        },
        partner_contact_person:{
            type:DataTypes.STRING,
            allowNull:true
        },
        is_active:{
            type:DataTypes.BOOLEAN,
            allowNull:true
        },
        commission_pct:{
            type:DataTypes.DECIMAL(5,2),
            allowNull:false,
            defaultValue:0
        },
        vat_rate:{
            type:DataTypes.DECIMAL(5,2),
            allowNull:false,
            defaultValue:25
        },
        f2_required:{
            type:DataTypes.BOOLEAN,
            allowNull:false,
            defaultValue:false
        },
        // Dinamika naplate — kada se partneru radi obračun provizije.
        // MONTHLY: 1. u mjesecu, za prethodni mjesec.
        // SEMI_MONTHLY: 1. i 16. u mjesecu, za prethodnu polovicu.
        // WEEKLY: odabrani dan u tjednu, za prethodnih sedam dana.
        billing_cycle:{
            type:DataTypes.STRING,
            allowNull:true,
            defaultValue:'MONTHLY'
        },
        // Dan u tjednu za WEEKLY (1 = ponedjeljak … 7 = nedjelja). Kod ostalih
        // dinamika je prazan — dan je određen samom dinamikom.
        billing_weekday:{
            type:DataTypes.INTEGER,
            allowNull:true
        }
    },
    { freezeTableName:true, tableName: "partners", timestamps: true }
    );
    const PartnersWebUsersModel = sequelize.define(
        "partners_web_users",
        {
            id:{
                type:DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            uuid:{
                type:DataTypes.STRING,
                allowNull:false
            },
            partner_uuid:{
                type:DataTypes.STRING,
                allowNull:false
            },
            username:{
                type:DataTypes.STRING,
                allowNull:false
            },
            password:{
                type:DataTypes.STRING,
                allowNull:false
            },
            partner_acr:{
                type:DataTypes.STRING,
                allowNull:true
            },
            is_active:{
                type:DataTypes.BOOLEAN,
                allowNull:false
            },
        },
        { freezeTableName:true, tableName: "partners_web_users", timestamps: true }
    )
    const PartnersAPIUsersModel = sequelize.define(
        "partners_api_users",
        {
            id:{
                type:DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            uuid:{
                type:DataTypes.STRING,
                allowNull:false
            },
            partner_uuid:{
                type:DataTypes.STRING,
                allowNull:false
            },
            partner_acr:{
                type:DataTypes.STRING,
                allowNull:true
            },
            tid:{
                type:DataTypes.STRING,
                allowNull:false
            },
            otp:{
                type:DataTypes.STRING,
                allowNull:false
            },
            key:{
                type:DataTypes.STRING,
                allowNull:false
            },
            is_active:{
                type:DataTypes.BOOLEAN,
                allowNull:false
            }
        },
    { freezeTableName:true, tableName: "partners_api_users", timestamps: true }
    )
    return {
        PartnersModel,
        PartnersWebUsersModel,
        PartnersAPIUsersModel
    }
}