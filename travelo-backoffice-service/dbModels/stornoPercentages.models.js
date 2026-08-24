const { DataTypes } = require("sequelize");

// Postotci storniranja koje blagajnik bira pri povratu karte. Prije se postotak
// upisivao slobodno, pa je svaka blagajna mogla vratiti koliko hoće — sada su
// dopuštene vrijednosti šifarnik koji se održava u administraciji i preuzima na
// terminale kroz sync.
module.exports = (sequelize) => {
    const StornoPercentagesModel = sequelize.define(
        "storno_percentages",
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
            // Decimal, ne integer — pravila povrata znaju biti i na pola postotka.
            percentage: {
                type: DataTypes.DECIMAL(5, 2),
                allowNull: false
            },
            // Kratki opis uz postotak (npr. "Otkazano više od 24h prije polaska").
            name: {
                type: DataTypes.STRING,
                allowNull: true
            },
            is_active: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: true
            },
        },
        { freezeTableName: true, tableName: "storno_percentages", timestamps: true }
    )
    return {
        StornoPercentagesModel
    }
}
