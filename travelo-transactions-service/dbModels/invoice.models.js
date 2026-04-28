const { DataTypes } = require("sequelize");

module.exports =  (sequelize) =>{
    const InvoiceModel = sequelize.define(
    "invoices",
    {
       id:{
            type: DataTypes.INTEGER,
            primaryKey:true,
            autoIncrement:true
        },
        company_name:{
            type:DataTypes.STRING,
            allowNull:true
        },
        company_address:{
            type:DataTypes.STRING,
            allowNull:true
        },
        company_postal_code:{
            type:DataTypes.STRING,
            allowNull:true
        },
        company_town:{
            type:DataTypes.STRING,
            allowNull:true
        },
        company_id:{
            type:DataTypes.STRING,
            allowNull:true
        },
        company_vatid:{
            type:DataTypes.STRING,
            allowNull:true
        },
        operater_uuid:{
            type:DataTypes.STRING,
            allowNull:true
        },
        operater_name:{
            type:DataTypes.STRING,
            allowNull:true
        },
        operator_id:{
            type:DataTypes.STRING,
            allowNull:true
        },
        operator_mark:{
            type:DataTypes.STRING,
            allowNull:true
        },
        invoice_uuid:{
            type: DataTypes.STRING,
            allowNull: true
        },
        invoice_no:{
            type: DataTypes.INTEGER,
            allowNull: false
        },
        invoice_fiskal_no:{
            type: DataTypes.INTEGER,
            allowNull: true
        },
        invoice_code:{
            type: DataTypes.STRING,
            allowNull: true
        },
        invoice_year:{
            type: DataTypes.INTEGER,
            allowNull: true
        },
        invoice_date:{
            type: DataTypes.DATE,
            allowNull: true
        },
        invoice_business_premise_uuid:{
            type: DataTypes.STRING,
            allowNull: true
        },
        invoice_business_premise_name:{
            type: DataTypes.STRING,
            allowNull: true
        },
        invoice_business_premise_fiscal_mark:{
            type: DataTypes.STRING,
            allowNull: true
        },
        invoice_billing_device_uuid:{
            type: DataTypes.STRING,
            allowNull: true
        },
        invoice_billing_device_fiscal_mark:{
            type: DataTypes.STRING,
            allowNull: true
        },
        invoice_is_pay:{
            type: DataTypes.BOOLEAN,
            allowNull: false
        },
        invoice_payment_data_uuid:{
            type: DataTypes.STRING,
            allowNull: true
        },
        invoice_payment_data:{
            type: DataTypes.JSONB,
            allowNull: true
        },
        invoice_ZKI:{
            type: DataTypes.STRING,
            allowNull: true
        },
        invoice_JIR:{
            type: DataTypes.STRING,
            allowNull: true
        },
        invoice_operator_name:{
            type: DataTypes.STRING,
            allowNull: true
        },
        invoice_payment_method_uuid:{
            type: DataTypes.STRING,
            allowNull: true
        },
        invoice_payment_method_name:{
            type: DataTypes.STRING,
            allowNull: true
        },
        invoice_payment_method_fiscal_mark:{
            type: DataTypes.STRING,
            allowNull: true
        },
        buyer_uuid:{
            type: DataTypes.STRING,
            allowNull: true
        },
        buyer_name:{
            type: DataTypes.STRING,
            allowNull: true
        },
        buyer_email:{
            type: DataTypes.STRING,
            allowNull: true
        },
        buyer_tel:{
            type: DataTypes.STRING,
            allowNull: true
        },
        buyer_company_name:{
            type: DataTypes.STRING,
            allowNull: true
        },
        buyer_address:{
            type: DataTypes.STRING,
            allowNull: true
        },
        buyer_oib:{
            type: DataTypes.STRING,
            allowNull: true
        },
        buyer_postal_code:{
            type: DataTypes.STRING,
            allowNull: true
        },
        buyer_town:{
            type: DataTypes.STRING,
            allowNull: true
        },
        buyer_country:{
            type: DataTypes.STRING,
            allowNull: true
        },
        shift_uuid:{
            type: DataTypes.STRING,
            allowNull: true
        },
        invoice_status:{
            type: DataTypes.STRING,
            allowNull: true
        },
        invoice_canceled:{
            type: DataTypes.BOOLEAN,
            allowNull: true
        },
        invoice_canceled_pair:{
            type: DataTypes.STRING,
            allowNull: true
        },
        invoice_amount:{
            type: DataTypes.DECIMAL,
            allowNull: true
        },
        invoice_vat_base:{
            type: DataTypes.DECIMAL,
            allowNull: true
        },
        invoice_vat:{
            type: DataTypes.DECIMAL,
            allowNull: true
        },
        invoice_harbor_tax:{
            type: DataTypes.DECIMAL,
            allowNull: true
        },
        order_uuid:{
            type: DataTypes.STRING,
            allowNull: true
        },
        language:{
            type: DataTypes.STRING,
            allowNull: true
        },
        fiskal_required:{
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        yescor_document_id:{
            type: DataTypes.STRING,
            allowNull: true
        },
        yescor_status:{
            type: DataTypes.STRING,
            allowNull: true
        },
        yescor_fiscalization_status:{
            type: DataTypes.STRING,
            allowNull: true
        },
        yescor_error_message:{
            type: DataTypes.TEXT,
            allowNull: true
        },
        yescor_concurrency_stamp:{
            type: DataTypes.STRING,
            allowNull: true
        },
        yescor_last_sync_at:{
            type: DataTypes.DATE,
            allowNull: true
        },
        yescor_raw_response:{
            type: DataTypes.JSONB,
            allowNull: true
        },
    },{
        freezeTableName:true, tableName: "invoices", timestamps: true
    },
    );
    const InvoiceItemsModel = sequelize.define(
        "invoice_items",
    {
       id:{
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        item_uuid:{
            type: DataTypes.STRING,
            allowNull: false
        },
        invoice_uuid:{
            type: DataTypes.STRING,
            allowNull: false
        },
        route_uuid:{
            type: DataTypes.STRING,
            allowNull: false
        },
        line_code:{
            type: DataTypes.STRING,
            allowNull: false
        },
        line_name:{
            type: DataTypes.STRING,
            allowNull: false
        },
        departure:{
            type: DataTypes.STRING,
            allowNull: false
        },
        departure_harbor_id:{
            type: DataTypes.STRING,
            allowNull: false
        },
        departure_harbor_name:{
            type: DataTypes.STRING,
            allowNull: false
        },
        arrival:{
            type: DataTypes.STRING,
            allowNull: false
        },
        arrival_harbor_id:{
            type: DataTypes.STRING,
            allowNull: false
        },
        arrival_harbor_name:{
            type: DataTypes.STRING,
            allowNull: false
        },
        item_amount:{
            type: DataTypes.DECIMAL,
            allowNull: false
        },
        item_vat_base:{
            type: DataTypes.DECIMAL,
            allowNull: false
        },
        item_vat:{
            type: DataTypes.DECIMAL,
            allowNull: false
        },
        item_harbor_fee:{
            type: DataTypes.DECIMAL,
            allowNull: false
        },
        order_number:{
            type: DataTypes.STRING,
            allowNull: true
        },
        shift_uuid:{
            type: DataTypes.STRING,
            allowNull: true
        },
    },{
        freezeTableName:true, tableName: "invoice_items", timestamps: true
    },
    );
    const InvoiceItemDetailsModel = sequelize.define(
        "invoice_item_details",
    {
       id:{
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        item_details_uuid:{
            type: DataTypes.STRING,
            allowNull: false
        },
        item_uuid:{
            type: DataTypes.STRING,
            allowNull: false
        },
        order_number:{
            type: DataTypes.STRING,
            allowNull: true
        },
        ticket_type_name:{
            type: DataTypes.STRING,
            allowNull: false
        },
        ticket_type_uuid:{
            type: DataTypes.STRING,
            allowNull: false
        },
        quantity:{
            type: DataTypes.DECIMAL,
            allowNull: false
        },
        single_price:{
            type: DataTypes.DECIMAL,
            allowNull: false
        },
        item_amount:{
            type: DataTypes.DECIMAL,
            allowNull: false
        },
        item_vat_base:{
            type: DataTypes.DECIMAL,
            allowNull: false
        },
        item_vat:{
            type: DataTypes.DECIMAL,
            allowNull: false
        },
        item_harbor_fee:{
            type: DataTypes.DECIMAL,
            allowNull: false
        },
    },{
        freezeTableName:true, tableName: "invoice_item_details", timestamps: true
    },
    )
    return{
        InvoiceModel,
        InvoiceItemsModel,
        InvoiceItemDetailsModel
    }
}