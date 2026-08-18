const Sequelize = require('sequelize');
const { sequelize } = require("../index.cjs")

const companyModel = sequelize.define('company',{
    id:{
        type: Sequelize.INTEGER,
        primaryKey:true,
        autoIncrement:true
    },
    basic_data_uuid:{
        type: Sequelize.STRING,
        allowNull: true
    },
    client_uuid:{
        type: Sequelize.STRING,
        allowNull: true
    },
    client_name:{
        type: Sequelize.STRING,
        allowNull: true
    },
    client_address:{
        type: Sequelize.STRING,
        allowNull: true
    },
    client_legal_id:{
        type: Sequelize.STRING,
        allowNull: true
    },
    client_vat_id:{
        type: Sequelize.STRING,
        allowNull: true
    },
    client_postal_code:{
        type: Sequelize.STRING,
        allowNull: true
    },
    client_town:{
        type: Sequelize.STRING,
        allowNull: true
    },
    client_country:{
        type: Sequelize.STRING,
        allowNull: true
    },
    client_email:{
        type: Sequelize.STRING,
        allowNull: true
    },
    business_premise_uuid:{
        type: Sequelize.STRING,
        allowNull: true
    },
    business_premise_name:{
        type: Sequelize.STRING,
        allowNull: true
    },
    business_premise_address:{
        type: Sequelize.STRING,
        allowNull: true
    },
    business_premise_town:{
        type: Sequelize.STRING,
        allowNull: true
    },
    business_premise_working_time:{
        type: Sequelize.STRING,
        allowNull: true
    },
    business_premise_description:{
        type: Sequelize.STRING,
        allowNull: true
    },
    business_premise_country:{
        type: Sequelize.STRING,
        allowNull: true
    },
    business_premise_fiscal_mark:{
        type: Sequelize.STRING,
        allowNull: true
    },
    billing_device_uuid:{
        type: Sequelize.STRING,
        allowNull: true
    },
    billing_device_fiscal_mark:{
        type: Sequelize.STRING,
        allowNull: true
    },
    billing_device_auto_validate:{
        type: Sequelize.BOOLEAN,
        allowNull:true
    }
},{
    freezeTableName: true
})

const usersModel = sequelize.define('users',{
    id:{
        type: Sequelize.INTEGER,
        autoIncrement: true,
        allowNull: false,
        primaryKey: true
    },
    user_uuid:{
        type: Sequelize.STRING,
        allowNull: false
    },
    user_name:{
        type: Sequelize.STRING,
        allowNull: false
    },
    user_surname:{
        type: Sequelize.STRING,
        allowNull: true
    },
    user_username:{
        type: Sequelize.STRING,
        allowNull: false
    },
    user_password:{
        type: Sequelize.STRING,
        allowNull: false
    },
    user_code:{
        type: Sequelize.STRING,
        allowNull: true
    },
    user_mark:{
        type: Sequelize.STRING,
        allowNull: false
    }
},{
    freezeTableName:true
})

const paymentMethodsModel = sequelize.define('payment_methods',{
    id:{
        type:Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    uuid:{
        type:Sequelize.STRING,
        allowNull:false
    },
    name:{
        type:Sequelize.STRING,
        allowNull:false
    },
    is_card_payment:{
        type:Sequelize.BOOLEAN,
        allowNull:false
    },
    // MONRI / OTP_POS / SEVENPAY, postavlja se u portalu. Blagajna pokreće
    // terminal samo za OTP_POS; ostali provideri su tuđi kanali.
    card_provider:{
        type:Sequelize.STRING,
        allowNull:true
    },
    payment_type_uuid:{
        type:Sequelize.STRING,
        allowNull:false
    },
    payment_type_acr:{
        type:Sequelize.STRING,
        allowNull:false
    },
    fiscalization:{
        type:Sequelize.BOOLEAN,
        allowNull:true
    }
},{
    freezeTableName:true
})


module.exports={
    companyModel,
    usersModel,
    paymentMethodsModel
}