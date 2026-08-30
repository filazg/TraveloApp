const { DataTypes } = require("sequelize");

// Obavijesti za web stranicu.
//
// Stranica ih povlaci kroz web-sales `/web_page_info`. Tekst pise covjek u
// portalu — tipicno prekid plovidbe, izmjena reda ili obavijest o radnom
// vremenu — pa se ne izvodi ni iz cega u sustavu.
//
// Trajanje se vodi ovdje, a ne na stranici: obavijest se objavi unaprijed i
// sama nestane kad prode, bez da je itko mora ici gasiti.
module.exports = (sequelize) => {
    const WebNoticesModel = sequelize.define(
        "web_notices",
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
            title: {
                type: DataTypes.STRING,
                allowNull: false
            },
            text: {
                type: DataTypes.TEXT,
                allowNull: false
            },
            // Koliko je obavijest ozbiljna — stranica po tome bira prikaz.
            // "info" obavijest, "warning" upozorenje, "urgent" hitno.
            severity: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: "info"
            },
            // Prazno znaci bez granice: bez pocetka vrijedi odmah, bez kraja do
            // gasenja rukom.
            valid_from: {
                type: DataTypes.DATE,
                allowNull: true
            },
            valid_to: {
                type: DataTypes.DATE,
                allowNull: true
            },
            is_active: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: true
            },
            updated_by_username: {
                type: DataTypes.STRING,
                allowNull: true
            },
        },
        { freezeTableName: true, tableName: "web_notices", timestamps: true }
    );
    return {
        WebNoticesModel
    };
};
