const { DataTypes } = require("sequelize");

// Zapis svakog poziva prema AKD-u (SEOP i MOSI) i njihovog odgovora.
//
// Zašto: AKD odgovara porukama koje se ne vide nigdje osim na blagajni u
// trenutku prodaje — „Iskaznica nije pronađena (MXRF1)", SOAP Fault s kodom,
// istek veze. Kad se poslije pita zašto putniku nije priznato pravo ili zašto
// dojava nije prošla, jedini trag bio je `pm2 logs`, koji se rotira i u kojem
// se ne može filtrirati po iskaznici.
//
// Zapis se drži ovdje, uz ostale SEOP postavke, jer akd servis nema svoju bazu
// niti je treba: on je posrednik prema AKD-u, a ne mjesto gdje podaci žive.
// Upis je best-effort — poziv prema AKD-u ne smije pasti zato što se log nije
// zapisao.
module.exports = (sequelize) => {
    const AkdLogModel = sequelize.define(
        "akd_logs",
        {
            id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

            // SEOP ili MOSI — dva različita sustava iza istog servisa.
            sustav: { type: DataTypes.STRING, allowNull: false, defaultValue: "SEOP" },

            // Naziv metode kako je AKD zove: ProvjeriPPP, DojaviProdajuOPKEur,
            // DojaviCvikanje, DohvatiDatVremIzDB…
            metoda: { type: DataTypes.STRING, allowNull: true },

            // Tko je poziv izazvao. Uređaj se zna kad zahtjev dolazi s blagajne
            // ili mobilne; portal i pozadinske radnje nemaju uređaj, pa ostaje
            // prazno i tada vrijedi `izvor`.
            terminal_uuid: { type: DataTypes.STRING, allowNull: true },
            terminal_tid: { type: DataTypes.STRING, allowNull: true },
            terminal_naziv: { type: DataTypes.STRING, allowNull: true },
            // "terminal" | "portal" | "servis" — odakle je poziv krenuo.
            izvor: { type: DataTypes.STRING, allowNull: true },

            // Iskaznica na koju se poziv odnosi, onako kako je unesena ili
            // pročitana. Po njoj se najčešće i traži: putnik se žali da mu pravo
            // nije priznato i zna samo svoj broj.
            iskaznica: { type: DataTypes.STRING, allowNull: true },
            id_vrsta: { type: DataTypes.STRING, allowNull: true },

            // Relacija, da se vidi na kojoj je liniji poziv napravljen.
            line_no: { type: DataTypes.STRING, allowNull: true },
            relacija: { type: DataTypes.STRING, allowNull: true },

            // Ishod. `ok` je izvedena oznaka po kojoj se filtrira „samo greške":
            // AKD greške vraća i kroz SOAP Fault (HTTP 500) i kroz uredan
            // odgovor s poslovnom porukom, pa sam HTTP status nije dovoljan.
            ok: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
            http_status: { type: DataTypes.INTEGER, allowNull: true },
            greska_kod: { type: DataTypes.STRING, allowNull: true },
            greska_opis: { type: DataTypes.TEXT, allowNull: true },
            trajanje_ms: { type: DataTypes.INTEGER, allowNull: true },

            // Okolina (test/prod/mock) — isti poziv drukčije znači ovisno o njoj.
            okolina: { type: DataTypes.STRING, allowNull: true },

            // Poslano i primljeno, skraćeno. Cijeli SOAP odgovor zna biti
            // desetak kilobajta; za dijagnozu je dovoljan početak, a baza ne
            // treba nositi ostatak.
            zahtjev: { type: DataTypes.TEXT, allowNull: true },
            odgovor: { type: DataTypes.TEXT, allowNull: true },
        },
        {
            freezeTableName: true,
            tableName: "akd_logs",
            timestamps: true,
            indexes: [
                { fields: ["createdAt"] },
                { fields: ["terminal_uuid"] },
                { fields: ["iskaznica"] },
                { fields: ["ok"] },
            ],
        }
    );

    return { AkdLogModel };
};
