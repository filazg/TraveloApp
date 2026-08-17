const { DataTypes } = require("sequelize");

module.exports =  (sequelize) =>{

    const BillingDevicesModel = sequelize.define(
    "billing_devices",
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
        business_premise_uuid:{
            type:DataTypes.STRING,
            allowNull:false
        },
        business_premise_name:{
            type:DataTypes.STRING,
            allowNull:true
        },
        name:{
            type:DataTypes.STRING,
            allowNull:false
        },
        tid:{
            type:DataTypes.STRING,
            allowNull:true
        },
        otp:{
            type:DataTypes.STRING,
            allowNull:true
        },
        fiscal_mark:{
            type:DataTypes.STRING,
            allowNull:true
        },
        cost_center:{
            type:DataTypes.STRING,
            allowNull:true
        },
        // Šifra modela uređaja (DEVICE_MODELS u helpers/deviceModels.js) — bira se
        // samo za mobilne blagajne.
        device_model:{
            type:DataTypes.STRING,
            allowNull:true
        },
        serial_number:{
            type:DataTypes.STRING,
            allowNull:true
        },
        auto_validate:{
            type:DataTypes.BOOLEAN,
            allowNull:true
        },
        // Zero-touch uparivanje: uređaj s ovom zastavicom i upisanim serijskim
        // brojem dobiva token po SN-u, bez unosa TID-a i OTP-a.
        auto_pair:{
            type:DataTypes.BOOLEAN,
            allowNull:false,
            defaultValue:false
        },
        description:{
            type:DataTypes.STRING,
            allowNull:true
        },
        type_uuid:{
            type:DataTypes.STRING,
            allowNull:false
        },
        type_name:{
            type:DataTypes.STRING,
            allowNull:false
        },
        header:{
            type:DataTypes.STRING,
            allowNull:true
        },
        footer:{
            type:DataTypes.STRING,
            allowNull:true
        },
        is_active:{
            type:DataTypes.BOOLEAN,
            allowNull:false
        },
    },
    { freezeTableName:true, tableName: "billing_devices", timestamps: true }
  );

  const BillingDevicesPermissionsModel = sequelize.define(
        "billing_devices_permissions",
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
            billing_device_uuid:{
                type:DataTypes.STRING,
                allowNull:false
            },
            name:{
                type:DataTypes.STRING,
                allowNull:false
            },
            surname:{
                type:DataTypes.STRING,
                allowNull:false
            },
            username:{
                type:DataTypes.STRING,
                allowNull:false
            },
            mark:{
                type:DataTypes.STRING,
                allowNull:false
            },
            is_active:{
                type:DataTypes.BOOLEAN,
                allowNull:false
            }
        },
        { freezeTableName:true, tableName: "billing_devices_permissions", timestamps: true }
  );
  
    const BillingDevicesPaymentMethodsModel = sequelize.define(
            "billing_devices_payment_methods",
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
                billing_device_uuid:{
                    type:DataTypes.STRING,
                    allowNull:false
                },
                name:{
                    type:DataTypes.STRING,
                    allowNull:false
                },
                is_card_payment:{
                    type:DataTypes.BOOLEAN,
                    allowNull:false
                },
                payment_type_uuid:{
                    type:DataTypes.STRING,
                    allowNull:false
                },
                payment_type_acr:{
                    type:DataTypes.STRING,
                    allowNull:false
                },
                fiscalization:{
                    type:DataTypes.BOOLEAN,
                    allowNull:true
                },
                is_active:{
                    type:DataTypes.BOOLEAN,
                    allowNull:false
                }
            },
            { freezeTableName:true, tableName: "billing_devices_payment_methods", timestamps: true }
  );

return{
        BillingDevicesModel,
        BillingDevicesPermissionsModel,
        BillingDevicesPaymentMethodsModel
    }
}


