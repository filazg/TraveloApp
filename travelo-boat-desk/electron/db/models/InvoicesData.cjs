const Sequelize = require('sequelize');
const { sequelize } = require("../index.cjs")

const invoicesModel = sequelize.define('invoices',{
    id:{
        type: Sequelize.INTEGER,
        primaryKey:true,
        autoIncrement:true
    },
    invoice_uuid:{
        type: Sequelize.STRING,
        allowNull: true
    },
    invoice_no:{
        type: Sequelize.INTEGER,
        allowNull: true
    },
    invoice_code:{
        type: Sequelize.STRING,
        allowNull: true
    },
    invoice_year:{
        type: Sequelize.INTEGER,
        allowNull: true
    },
    invoice_date:{
        type: Sequelize.DATE,
        allowNull: true
    },
    invoice_client_uuid:{
        type: Sequelize.STRING,
        allowNull: true
    },
    invoice_client_name:{
        type: Sequelize.STRING,
        allowNull: true
    },
    invoice_client_address:{
        type: Sequelize.STRING,
        allowNull: true
    },
    invoice_client_postal_code:{
        type: Sequelize.STRING,
        allowNull: true
    },
    invoice_client_town:{
        type: Sequelize.STRING,
        allowNull: true
    },
    invoice_client_country:{
        type: Sequelize.STRING,
        allowNull: true
    },
    invoice_client_oib:{
        type: Sequelize.STRING,
        allowNull: true
    },
    invoice_business_premise_uuid:{
        type: Sequelize.STRING,
        allowNull: true
    },
    invoice_business_premise_name:{
        type: Sequelize.STRING,
        allowNull: true
    },
    invoice_business_premise_address:{
        type: Sequelize.STRING,
        allowNull: true
    },
    invoice_business_premise_postal_code:{
        type: Sequelize.STRING,
        allowNull: true
    },
    invoice_business_premise_postal_town:{
        type: Sequelize.STRING,
        allowNull: true
    },
    invoice_business_premise_fiscal_mark:{
        type: Sequelize.STRING,
        allowNull: true
    },
    invoice_billing_device_uuid:{
        type: Sequelize.STRING,
        allowNull: true
    },
    invoice_billing_device_fiscal_mark:{
        type: Sequelize.STRING,
        allowNull: true
    },
    invoice_is_pay:{
        type: Sequelize.BOOLEAN,
        allowNull: false
    },
    invoice_payment_data_uuid:{
        type: Sequelize.STRING,
        allowNull: true
    },
    invoice_ZKI:{
        type: Sequelize.STRING,
        allowNull: true
    },
    invoice_JIR:{
        type: Sequelize.STRING,
        allowNull: true
    },
    invoice_operator_name:{
        type: Sequelize.STRING,
        allowNull: true
    },
    invoice_operator_id:{
        type: Sequelize.STRING,
        allowNull: true
    },
    invoice_operator_mark:{
        type: Sequelize.STRING,
        allowNull: true
    },
    invoice_payment_method_uuid:{
        type: Sequelize.STRING,
        allowNull: true
    },
    invoice_payment_method_name:{
        type: Sequelize.STRING,
        allowNull: true
    },
    invoice_payment_method_fiscal_mark:{
        type: Sequelize.STRING,
        allowNull: true
    },
    order_number:{
        type: Sequelize.STRING,
        allowNull: true
    },
    buyer_uuid:{
        type: Sequelize.STRING,
        allowNull: true
    },
    buyer_name:{
        type: Sequelize.STRING,
        allowNull: true
    },
    buyer_email:{
        type: Sequelize.STRING,
        allowNull: true
    },
    buyer_tel:{
        type: Sequelize.STRING,
        allowNull: true
    },
    buyer_company_name:{
        type: Sequelize.STRING,
        allowNull: true
    },
    buyer_address:{
        type: Sequelize.STRING,
        allowNull: true
    },
    buyer_oib:{
        type: Sequelize.STRING,
        allowNull: true
    },
    buyer_postal_code:{
        type: Sequelize.STRING,
        allowNull: true
    },
    buyer_town:{
        type: Sequelize.STRING,
        allowNull: true
    },
    buyer_country:{
        type: Sequelize.STRING,
        allowNull: true
    },
    shift_uuid:{
        type: Sequelize.STRING,
        allowNull: true
    },
    invoice_status:{
        type: Sequelize.STRING,
        allowNull: true
    },
    invoice_canceled:{
        type: Sequelize.BOOLEAN,
        allowNull: true
    },
    invoice_canceled_pair:{
        type: Sequelize.BOOLEAN,
        allowNull: true
    },
    invoice_amount:{
        type: Sequelize.DECIMAL,
        allowNull: true
    },
    invoice_vat_base:{
        type: Sequelize.DECIMAL,
        allowNull: true
    },
    invoice_vat:{
        type: Sequelize.DECIMAL,
        allowNull: true
    },
    invoice_harbor_tax:{
        type: Sequelize.DECIMAL,
        allowNull: true
    },
    invoice_send:{
        type: Sequelize.STRING,
        allowNull: true
    },
    payment_data:{
        type: Sequelize.JSON,
        allowNull: true
    },
    fiskal_required:{
        type: Sequelize.BOOLEAN,
        allowNull: true
    },
    // F2 (HRFISK20 e-račun) je odluka operatera, ne posljedica OIB-a — R1 račun
    // bez ove oznake ostaje običan F1 račun s podacima o kupcu. Isto značenje
    // kao `is_f2` na mobilnoj blagajni.
    is_f2:{
        type: Sequelize.BOOLEAN,
        allowNull: true
    },
    invoice_fiskal_no:{
        type: Sequelize.INTEGER,
        allowNull: true
    },
    yescor_document_id:{
        type: Sequelize.STRING,
        allowNull: true
    },
    yescor_status:{
        type: Sequelize.STRING,
        allowNull: true
    },
    yescor_fiscalization_status:{
        type: Sequelize.STRING,
        allowNull: true
    },
    yescor_error_message:{
        type: Sequelize.TEXT,
        allowNull: true
    },
    yescor_last_sync_at:{
        type: Sequelize.DATE,
        allowNull: true
    },
    // Storno karte prodane na drugom prodajnom mjestu. Popunjeno je samo kod
    // takvih storna — po tome se na zaključku smjene odvajaju od storna
    // vlastite prodaje, jer novac izlazi iz ove blagajne, a prihod je bio na
    // tuđoj.
    storno_source_channel:{
        type: Sequelize.STRING,
        allowNull: true
    },
    storno_source_type:{
        type: Sequelize.STRING,
        allowNull: true
    },
    storno_source_ticket_code:{
        type: Sequelize.STRING,
        allowNull: true
    },
},{
    freezeTableName: true
})
const invoiceTaxModel = sequelize.define('invoice_tax',{
    id:{
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    invoice_tax_uuid:{
        type: Sequelize.STRING,
        allowNull: false
    },
    invoice_uuid:{
        type: Sequelize.STRING,
        allowNull: false
    },
    tax_uuid:{
        type: Sequelize.STRING,
        allowNull: false
    },
    tax_name:{
        type: Sequelize.STRING,
        allowNull: false
    },
    tax_rate:{
        type: Sequelize.DECIMAL,
        allowNull: false
    },
    invoice_tax_base:{
        type: Sequelize.DECIMAL,
        allowNull: false
    },
    invoice_tax_amount:{
        type: Sequelize.DECIMAL,
        allowNull: false
    },
},{
    freezeTableName:true
})

const invoiceTransportItemsModel = sequelize.define('invoice_transport_items',{
    id:{
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    item_uuid:{
        type: Sequelize.STRING,
        allowNull: false
    },
    invoice_uuid:{
        type: Sequelize.STRING,
        allowNull: false
    },
    sales_route_uuid:{
        type: Sequelize.STRING,
        allowNull: false
    },
    line_code:{
        type: Sequelize.STRING,
        allowNull: false
    },
    line_name:{
        type: Sequelize.STRING,
        allowNull: false
    },
    departure:{
        type: Sequelize.STRING,
        allowNull: false
    },
    departure_harbor_id:{
        type: Sequelize.STRING,
        allowNull: false
    },
    departure_harbor_name:{
        type: Sequelize.STRING,
        allowNull: false
    },
    arrival:{
        type: Sequelize.STRING,
        allowNull: false
    },
    arrival_harbor_id:{
        type: Sequelize.STRING,
        allowNull: false
    },
    arrival_harbor_name:{
        type: Sequelize.STRING,
        allowNull: false
    },
    item_amount:{
        type: Sequelize.DECIMAL,
        allowNull: false
    },
    item_vat_base:{
        type: Sequelize.DECIMAL,
        allowNull: false
    },
    item_vat:{
        type: Sequelize.DECIMAL,
        allowNull: false
    },
    item_harbor_fee:{
        type: Sequelize.DECIMAL,
        allowNull: false
    },
    order_number:{
        type: Sequelize.STRING,
        allowNull: true
    },
    shift_uuid:{
        type: Sequelize.STRING,
        allowNull: true
    },
},{
    freezeTableName: true
})

module.exports={
    invoicesModel,
    invoiceTaxModel,
    invoiceTransportItemsModel
}