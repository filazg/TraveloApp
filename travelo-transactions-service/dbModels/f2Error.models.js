const { DataTypes } = require("sequelize");

// Evidencija neuspjelih F2 (YesCor) slanja — Kontrola → „F2 greške".
//
// Stanje na racunu (`yescor_status`, `yescor_error_message`) pokazuje samo
// zadnji pokusaj i prepisuje se pri svakom sljedecem; ovdje ostaje svaki
// neuspjeh zasebno, s porukom onako kako ju je YesCor vratio. Tako se vidi i
// kad je greska pocela i koliko je racuna zahvatila.
//
// Faza razlikuje dva mjesta gdje F2 pada:
//   slanje        — dokument nije ni prihvacen (token, validacija UBL-a, mreza)
//   fiskalizacija — YesCor ga je primio, ali ga Porezna/posrednik odbija
module.exports = (sequelize) => {
    const F2ErrorModel = sequelize.define(
        "f2_greske",
        {
            id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
            uuid: { type: DataTypes.STRING, allowNull: true },

            // racun | partnerski — zbirni partnerski racun je druga tablica.
            vrsta: { type: DataTypes.STRING, allowNull: false, defaultValue: "racun" },
            // blagajna | sinkronizacija | web | partnerski | status
            izvor: { type: DataTypes.STRING, allowNull: true },
            faza: { type: DataTypes.STRING, allowNull: false, defaultValue: "slanje" },

            invoice_uuid: { type: DataTypes.STRING, allowNull: true },
            invoice_code: { type: DataTypes.STRING, allowNull: true },
            invoice_no: { type: DataTypes.STRING, allowNull: true },
            invoice_date: { type: DataTypes.DATE, allowNull: true },
            iznos: { type: DataTypes.DECIMAL(12, 2), allowNull: true },

            kupac_naziv: { type: DataTypes.STRING, allowNull: true },
            kupac_oib: { type: DataTypes.STRING, allowNull: true },

            terminal_uuid: { type: DataTypes.STRING, allowNull: true },
            terminal_tid: { type: DataTypes.STRING, allowNull: true },
            terminal_name: { type: DataTypes.STRING, allowNull: true },
            operator: { type: DataTypes.STRING, allowNull: true },

            yescor_document_id: { type: DataTypes.STRING, allowNull: true },
            http_status: { type: DataTypes.INTEGER, allowNull: true },
            // Citljiva poruka (detalji + validacijske greske) i sirovi odgovor.
            poruka: { type: DataTypes.TEXT, allowNull: true },
            odgovor: { type: DataTypes.JSONB, allowNull: true },
        },
        { freezeTableName: true, tableName: "f2_greske", timestamps: true }
    );

    return { F2ErrorModel };
};
