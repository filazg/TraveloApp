const { DataTypes } = require("sequelize");

// Signal da se nesto promijenilo, po vrsti podatka.
//
// Blagajna i mobilna rade offline i podatke povlace same. Kad se karta stornira
// ili polazak otkaze, uredaj to ne sazna dok korisnik sam ne pokrene osvjezavanje
// — pa se stornirana karta jos moze validirati, a otkazani polazak prodavati.
//
// Umjesto da uredaj stalno povlaci cijeli paket (nekoliko megabajta), povlaci
// ovaj zapis: par bajtova s brojacem po vrsti. Kad se brojac promijeni, tek tada
// ide pravo osvjezavanje. Zato ovdje NE stoje maticni podaci (vozni red,
// cjenik) nego samo dogadaji koji zahtijevaju brzu reakciju.
module.exports = (sequelize) => {
    const SyncSignalsModel = sequelize.define(
        "sync_signals",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            // Vrsta podatka koju uredaj treba osvjeziti: "tickets" (storno) ili
            // "transport" (otkaz i pomak polaska).
            kind: {
                type: DataTypes.STRING,
                allowNull: false,
                unique: true,
            },
            // Raste sa svakom promjenom. Uredaj usporeduje broj koji ima s ovim;
            // vrijeme sluzi samo za uvid.
            revision: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
            },
            // Zadnji dogadaj, radi dijagnostike — sto je tocno podiglo brojac.
            last_event: {
                type: DataTypes.STRING,
                allowNull: true,
            },
        },
        { freezeTableName: true, tableName: "sync_signals", timestamps: true }
    );

    return { SyncSignalsModel };
};
