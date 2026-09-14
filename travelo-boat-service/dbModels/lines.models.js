const { DataTypes } = require("sequelize");

module.exports =  (sequelize) =>{
    const LinesModel = sequelize.define(
    "lines",
    {
        id:{
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        uuid: {
            type: DataTypes.STRING,
            allowNull: true
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        code: {
            type: DataTypes.STRING,
            allowNull: false
        },
        first_harbor_id: {
            type: DataTypes.STRING,
            allowNull: true
        },
        first_harbor_name: {
            type: DataTypes.STRING,
            allowNull: true
        },
        last_harbor_id: {
            type: DataTypes.STRING,
            allowNull: true
        },
        last_harbor_name: {
            type: DataTypes.STRING,
            allowNull: true
        },
        region: {
            type: DataTypes.STRING,
            allowNull: true
        },
        region_uuid: {
            type: DataTypes.STRING,
            allowNull: true
        },
        type: {
            type: DataTypes.STRING,
            allowNull: false
        },
        subsidised_line: {
            type: DataTypes.BOOLEAN,
            allowNull: true
        },  
        // Prihvacanje povlastenih kartica na ovoj liniji.
        //
        // Nije vezano uz to je li linija drzavna: i komercijalna linija moze
        // prihvacati otocne iskaznice, a subvencionirana ih ne mora.
        //   ne           — otocna iskaznica se ne priznaje
        //   prebivaliste — samo otocani s prebivalistem na otoku linije
        //   svi          — svi nositelji otocnih prava
        seop_mode: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: "ne"
        },
        // Dojavljuje li se prodaja SEOP-u.
        //
        // Brodar ponekad zeli dati povlastenu cijenu otocanima bez da karta ude
        // u SEOP obracun — tada se SEOP koristi samo za provjeru je li iskaznica
        // valjana i ima li pravo, a dojava prodaje i cvikanja se ne salje.
        seop_report_sales: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true
        },
        // Primjenjuje li se postotak popusta sa SEOP-a na otocnu cijenu iz
        // cjenika.
        //
        // Dvije su prakse: cjenik vec sadrzi povlastenu cijenu relacije (tada se
        // postotak ne primjenjuje, on samo kaze ide li karta besplatno), ili
        // cjenik nosi osnovicu na koju se popust racuna. Postavlja se po liniji
        // jer ovisi o tome kako je cjenik slozen.
        seop_apply_discount: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        // MOSI (invalidske povlastice): prihvaca li ih linija i koliki je
        // popust nositelju. Pratnja putuje besplatno, pa za nju popusta nema.
        mosi_accepted: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        mosi_discount_pct: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        mosi_companion_free: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true
        },

        is_active: {
            type: DataTypes.BOOLEAN,
            allowNull: false
        },
         updated_by_uuid:{
            type: DataTypes.STRING,
            allowNull: true
        },
        updated_by_username:{
            type: DataTypes.STRING,
            allowNull: true
        },
        saop_cost_bearer:{
            type: DataTypes.STRING,
            allowNull: true
        },
    },{
        freezeTableName:true, tableName: "lines", timestamps: true
    }
    );
    return{
        LinesModel
    }
}


