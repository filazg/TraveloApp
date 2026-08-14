const { DataTypes } = require("sequelize");

// Zaliha serijskih brojeva mobilnih uređaja. Puni se direktno u bazi (INSERT);
// portal ih samo čita kod kreiranja naplatnog uređaja. Kad se SN dodijeli
// uređaju, upisuje se billing_device_uuid i SN ispada iz ponude.
module.exports = (sequelize) => {
    const DeviceSerialNumbersModel = sequelize.define(
        "device_serial_numbers",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            uuid: {
                type: DataTypes.STRING,
                allowNull: false
            },
            // Šifra modela iz DEVICE_MODELS (npr. SUNMI_V2).
            model: {
                type: DataTypes.STRING,
                allowNull: false
            },
            serial_number: {
                type: DataTypes.STRING,
                allowNull: false,
                unique: true
            },
            // Popunjeno kad je SN dodijeljen naplatnom uređaju; null = slobodan.
            billing_device_uuid: {
                type: DataTypes.STRING,
                allowNull: true
            },
            billing_device_name: {
                type: DataTypes.STRING,
                allowNull: true
            },
            description: {
                type: DataTypes.STRING,
                allowNull: true
            },
            is_active: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: true
            },
        },
        { freezeTableName: true, tableName: "device_serial_numbers", timestamps: true }
    );

    return {
        DeviceSerialNumbersModel
    };
};
