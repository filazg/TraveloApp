const { DataTypes } = require("sequelize");

// Postavke veze prema SEOP-u (AKD) i odluka o tome što se u SEOP šalje.
//
// Jedan redak, uvijek id = 1. Postavke su dosad stajale u
// `integrations_configs.json` na poslužitelju, pa je svaka promjena tražila
// pristup datoteci i restart. Ovdje ih administrira ured iz portala, a akd
// servis ih čita.
//
// Certifikati NISU ovdje: privatni ključ ostaje datoteka na stroju na kojem
// radi akd servis. U bazi stoji samo ono po čemu se u portalu vidi koji je
// certifikat postavljen i dokad vrijedi.
module.exports = (sequelize) => {
    const SeopSettingsModel = sequelize.define(
        "seop_settings",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                defaultValue: 1,
            },

            // --- veza ---
            // mock — ništa se ne šalje, poziv se samo zabilježi (razvoj)
            // test — SEOP testna okolina
            // prod — produkcija
            environment: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: "mock",
            },
            // Korisničko ime prema SEOP-u je OIB brodara.
            brodarev_oib: { type: DataTypes.STRING, allowNull: true },
            lozinka: { type: DataTypes.STRING, allowNull: true },

            // --- što se šalje ---
            // Glavni prekidač. Ugašen znači da se dojave i dalje pripremaju i
            // pamte, ali ne odlaze — tako se uključenje ne plaća gubitkom
            // prometa koji je nastao dok je veza bila u pripremi.
            enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
            send_opk: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
            send_ppk: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
            send_cvikanje: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
            send_storno: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
            send_isplovljenje: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
            send_ponisti_cvikanje: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },

            // Od kojeg datuma se dojavljuje. Karte izdane prije toga se ne
            // šalju — retroaktivna dojava nije dogovorena s AZOLPP-om.
            send_from_date: { type: DataTypes.DATEONLY, allowNull: true },

            // --- kako se pune parametri ---
            // Oznaka pristupne točke: oznaka naplatnog uređaja s kojeg je
            // prodano, ili jedna fiksna oznaka za cijelu tvrtku.
            ozn_pristup_tocke_source: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: "billing_device", // billing_device | fixed
            },
            ozn_pristup_tocke_fixed: { type: DataTypes.STRING, allowNull: true },
            // Broj linije prema SEOP-u: naš kod linije ili zasebno upisan broj.
            line_no_source: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: "line_code", // line_code | seop_line_no
            },
            // Oznaka plovidbe koja ide u DojaviCvikanje i DojaviIsplovljenje.
            jop_source: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: "departure_uuid", // departure_uuid | voyage_code
            },

            // --- certifikati (samo opis, ne i sadržaj) ---
            p12_file: { type: DataTypes.STRING, allowNull: true },
            p12_password: { type: DataTypes.STRING, allowNull: true },
            p12_subject: { type: DataTypes.STRING, allowNull: true },
            p12_valid_to: { type: DataTypes.DATE, allowNull: true },
            p12_uploaded_at: { type: DataTypes.DATE, allowNull: true },
            ca_file: { type: DataTypes.STRING, allowNull: true },
            sign_cert_file: { type: DataTypes.STRING, allowNull: true },
            // Dok nemamo AKD-ov CA lanac, server se ne provjerava. Prekidač
            // stoji ovdje da se ne zaboravi ugasiti kad lanac stigne.
            tls_reject_unauthorized: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            },
        },
        { freezeTableName: true, tableName: "seop_settings", timestamps: true }
    );

    return { SeopSettingsModel };
};
