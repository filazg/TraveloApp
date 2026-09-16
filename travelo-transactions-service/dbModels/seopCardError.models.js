const { DataTypes } = require("sequelize");

// Evidencija otočnih karata izdanih BEZ potvrđenog prava — kad se iskaznica nije
// mogla očitati ili provjeriti (oštećena, kvar opreme, prekid veze…), djelatnik
// svejedno izda povlaštenu kartu na povjerenje, ali mora upisati razlog. Kontrola
// na portalu to pregledava u zasebnoj kartici „Greške s povlaštenim karticama".
//
// Ovo NIJE odbijena provjera (putnik nema pravo) — to je slučaj kad se pravo nije
// moglo utvrditi, a karta je ipak izdana. Razlog je obavezan; napomena slobodna.
module.exports = (sequelize) => {
    const SeopCardErrorModel = sequelize.define(
        "seop_greske_kartica",
        {
            id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
            uuid: { type: DataTypes.STRING, allowNull: true },

            // Karta koja je izdana uz razlog.
            ticket_uuid: { type: DataTypes.STRING, allowNull: true },
            ticket_code: { type: DataTypes.STRING, allowNull: true },
            invoice_uuid: { type: DataTypes.STRING, allowNull: true },

            // Tko i gdje je izdao.
            terminal_uuid: { type: DataTypes.STRING, allowNull: true },
            operator: { type: DataTypes.STRING, allowNull: true },

            // Relacija — da se u Kontroli vidi na kojoj je liniji izdana.
            line_code: { type: DataTypes.STRING, allowNull: true },
            line_name: { type: DataTypes.STRING, allowNull: true },
            departure_harbor_id: { type: DataTypes.STRING, allowNull: true },
            departure_harbor_name: { type: DataTypes.STRING, allowNull: true },
            arrival_harbor_id: { type: DataTypes.STRING, allowNull: true },
            arrival_harbor_name: { type: DataTypes.STRING, allowNull: true },

            // Iskaznica onako kako je unesena/pročitana (broj + vrsta identifikatora).
            card_no: { type: DataTypes.STRING, allowNull: true },
            id_type: { type: DataTypes.STRING, allowNull: true },

            // Obavezni razlog izdavanja bez provjere:
            //   nemoguce_ocitati | kartica_ostecena | greska_oprema | prekid_komunikacije
            razlog: { type: DataTypes.STRING, allowNull: false },
            napomena: { type: DataTypes.TEXT, allowNull: true },

            // Trenutak izdavanja s uređaja (uređaj radi i offline).
            izdano_u: { type: DataTypes.DATE, allowNull: true },
        },
        { freezeTableName: true, tableName: "seop_greske_kartica", timestamps: true }
    );

    return { SeopCardErrorModel };
};
