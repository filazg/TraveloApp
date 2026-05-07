const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>{
    const UsersModel = sequelize.define(
        "users",
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
            name:{
                type:DataTypes.STRING,
                allowNull:false
            },
            surname:{
                type:DataTypes.STRING,
                allowNull:false
            },
            legal_id:{
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
            mark:{
                type:DataTypes.STRING,
                allowNull:false
            },
            is_company_employee:{
                type:DataTypes.BOOLEAN,
                allowNull:true
            },
            partner_uuid:{
                type:DataTypes.STRING,
                allowNull:true
            },
            partner_name:{
                type:DataTypes.STRING,
                allowNull:true
            },
            code:{
                type:DataTypes.STRING,
                allowNull:true
            },
            saop_clerk_id:{
                type:DataTypes.STRING,
                allowNull:true
            },
            is_active:{
                type:DataTypes.BOOLEAN,
                allowNull:false
            },
        },
        { freezeTableName:true, tableName: "users", timestamps: true }
    )
    const UsersPermissionsModel = sequelize.define(
        "users_permissions",
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
            user_uuid:{
                type:DataTypes.STRING,
                allowNull:false
            },
            user_name:{
                type:DataTypes.STRING,
                allowNull:false
            },
            user_surname:{
                type:DataTypes.STRING,
                allowNull:false
            },
            user_username:{
                type:DataTypes.STRING,
                allowNull:false
            },
            user_mark:{
                type:DataTypes.STRING,
                allowNull:false
            },
            module_acr:{
                type:DataTypes.STRING,
                allowNull:false
            },
            module_name:{
                type:DataTypes.STRING,
                allowNull:false
            },
            is_active:{
                type:DataTypes.BOOLEAN,
                allowNull:false
            },
        },
        { freezeTableName:true, tableName: "users_permissions", timestamps: true }  
    )
    return {
        UsersModel,
        UsersPermissionsModel
    }
}