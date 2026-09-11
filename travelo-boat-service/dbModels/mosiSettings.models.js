const { DataTypes } = require("sequelize");

// Postavke veze prema MOSI-ju (AKD) — dojava korištenja invalidskih povlastica.
//
// Za razliku od SEOP-a, MOSI je REST/JSON i ne traži klijentski certifikat za
// spajanje: identifikacija ide API ključem. Certifikat treba samo za potpis
// dojave utroška, a AKD-u se predaje njegov javni ključ.
//
// Jedan redak, uvijek id = 1.
module.exports = (sequelize) => {
    const MosiSettingsModel = sequelize.define(
        "mosi_settings",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                defaultValue: 1,
            },

            // mock — ništa se ne šalje (razvoj)
            // test — demo-mosi-extapi.akd.hr
            // prod — mosi-extapi.akd.hr
            environment: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: "mock",
            },
            // AKD izdaje zaseban ključ za test i za produkciju.
            api_key_test: { type: DataTypes.STRING, allowNull: true },
            api_key_prod: { type: DataTypes.STRING, allowNull: true },

            // OIB ustanove koja šalje dojavu i oznaka osobe u toj ustanovi —
            // oba ulaze i u string koji se potpisuje.
            oib_pu: { type: DataTypes.STRING, allowNull: true },
            id_osoba_pu: { type: DataTypes.STRING, allowNull: true },

            // --- što se šalje ---
            enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
            // Dojava utroška za brodski prijevoz (v2/dojavautroska/brodari).
            send_utrosak: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
            // Storno ide istom metodom, s opisom "STORNO - <oznaka izvorne>".
            send_storno: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
            send_from_date: { type: DataTypes.DATEONLY, allowNull: true },

            // --- izvanmrežni rad ---
            // Crne liste iskaznica i parkirališnih karti; dnevna lista važećih
            // iskaznica dolazi zasebno, sftp-om.
            sync_crna_lista: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
            crna_lista_zadnji_dohvat: { type: DataTypes.DATE, allowNull: true },

            // --- potpisni certifikat ---
            p12_file: { type: DataTypes.STRING, allowNull: true },
            p12_password: { type: DataTypes.STRING, allowNull: true },
            p12_subject: { type: DataTypes.STRING, allowNull: true },
            p12_valid_to: { type: DataTypes.DATE, allowNull: true },
            p12_uploaded_at: { type: DataTypes.DATE, allowNull: true },
        },
        { freezeTableName: true, tableName: "mosi_settings", timestamps: true }
    );

    return { MosiSettingsModel };
};
