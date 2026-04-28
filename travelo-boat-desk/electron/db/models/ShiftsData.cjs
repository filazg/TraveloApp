const Sequelize = require('sequelize');
const { sequelize } = require("../index.cjs")

const shiftModel = sequelize.define('shifts',{
    id:{
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    shift_uuid:{
        type: Sequelize.STRING,
        allowNull:false
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
    client_oib:{
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
    business_premise_postal_code:{
        type: Sequelize.STRING,
        allowNull: true
    },
    business_premise_postal_town:{
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
    operater_name:{
        type: Sequelize.STRING,
        allowNull:true
    },
    operater_surname:{
        type: Sequelize.STRING,
        allowNull:true
    },
    operater_username:{
        type: Sequelize.STRING,
        allowNull:false
    },
    shift_start:{
        type: Sequelize.DATE,
        allowNull:false
    },
    shift_end:{
        type: Sequelize.DATE,
        allowNull:true
    },
    shift_open:{
        type: Sequelize.BOOLEAN,
        allowNull:false
    },
    remark:{
        type: Sequelize.STRING,
        allowNull:true
    },
    shift_first_invoice:{
        type: Sequelize.STRING,
        allowNull:true
    },
    shift_last_invoice:{
        type: Sequelize.STRING,
        allowNull:true
    },
    shift_no_tickets_sold:{
        type: Sequelize.INTEGER,
        allowNull:true
    },
    shift_no_tickets_cancel:{
        type: Sequelize.INTEGER,
        allowNull:true
    },
    // Agregati prometa smjene — popunjavaju se pri zatvaranju, šalju backendu za
    // financijski pregled na portalu (Financije → Smjene).
    shift_amount:{
        type: Sequelize.DECIMAL,
        allowNull:true
    },
    shift_vat_base:{
        type: Sequelize.DECIMAL,
        allowNull:true
    },
    shift_vat:{
        type: Sequelize.DECIMAL,
        allowNull:true
    },
    shift_harbor_tax:{
        type: Sequelize.DECIMAL,
        allowNull:true
    },
    // Backend sync marker — 'SEND' kad backend potvrdi upsert; null = pending,
    // sync će ga gurnuti idempotentno (po shift_uuid) u idućem prolazu.
    shift_send:{
        type: Sequelize.STRING,
        allowNull:true
    },

},{
    freezeTableName:true
})



const shiftFinancModel = sequelize.define('shift_financ',{
    id:{
        type: Sequelize.INTEGER,
        autoIncrement: true,
        allowNull: false,
        primaryKey: true
    },
    shift_financ_uuid:{
        type: Sequelize.STRING,
        allowNull: false
    },
    shift_uuid:{
        type: Sequelize.STRING,
        allowNull: false
    },
    payment_type_uuid:{
        type: Sequelize.STRING,
        allowNull: false
    },
    payment_type_name:{
        type: Sequelize.STRING,
        allowNull: false
    },
    payment_amount:{
        type: Sequelize.DECIMAL,
        allowNull: false
    }
},{
    freezeTableName:true
})


const shiftSaleModel = sequelize.define('shift_sale',{
    id:{
        type: Sequelize.INTEGER,
        autoIncrement: true,
        allowNull: false,
        primaryKey: true
    },
    shift_sale_uuid:{
        type: Sequelize.STRING,
        allowNull: false
    },
    shift_uuid:{
        type: Sequelize.STRING,
        allowNull: false
    },
    amount:{
        type: Sequelize.DECIMAL,
        allowNull: true
    },
    vat_base:{
        type: Sequelize.DECIMAL,
        allowNull: true
    },
    vat:{
        type: Sequelize.DECIMAL,
        allowNull: true
    },
    harbor_tax:{
        type: Sequelize.DECIMAL,
        allowNull: true
    },
    send:{
        type: Sequelize.STRING,
        allowNull: true
    },
})


const shiftReportPaymentModel = sequelize.define('shift_report_payments',{
    id:{
        type: Sequelize.INTEGER,
        autoIncrement: true,
        allowNull: false,
        primaryKey: true
    },
    shift_uuid:{
        type: Sequelize.STRING,
        allowNull: false
    },
    payment_type_uuid:{
        type: Sequelize.STRING,
        allowNull: false
    },
    payment_type_name:{
        type: Sequelize.STRING,
        allowNull: false
    },
    payment_amount:{
        type: Sequelize.DECIMAL,
        allowNull: false
    },
    card_payment_data_uuid:{
        type: Sequelize.STRING,
        allowNull: true
    }
},{
    freezeTableName:true
})

module.exports={
    shiftModel,
    shiftFinancModel,
    shiftSaleModel,
    shiftReportPaymentModel,
}