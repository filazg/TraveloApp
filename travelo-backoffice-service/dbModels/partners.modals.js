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
        // Kako partneru komuniciramo cijenu kad prodaje za SVOJ racun
        // (partner-sale i T4B API). Kod prodaje u nase ime, na partnerskom
        // prodajnom mjestu s nasom blagajnom, ovo ne vrijedi — ondje se prodaje
        // po prodajnoj cijeni kao i svugdje.
        //
        // Ukljuceno: salje se prodajna cijena s PDV-om. Iskljuceno: salje se
        // nasa cijena prema njemu, bez PDV-a ali s luckom pristojbom u sebi.
        // Podrazumijevano je ukljuceno, da vec integriranim partnerima cijene
        // ne odu drugacije bez dogovora.
        prices_with_vat:{
            type:DataTypes.BOOLEAN,
            allowNull:false,
            defaultValue:true
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
            // Sto korisnik smije u partnerskoj prodaji. SALES otvara prodaju i
            // njegove rezervacije, FINANCE obracun provizije i racune. Zapisuje
            // se kao popis odvojen zarezom, jer isti covjek zna raditi oboje.
            // Podrazumijevano SALES — zatecenim korisnicima se time ne mijenja
            // ono sto su dosad imali.
            roles:{
                type:DataTypes.STRING,
                allowNull:false,
                defaultValue:'SALES'
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