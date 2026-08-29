const { DataTypes } = require("sequelize");

module.exports =  (sequelize) =>{
    const TicketsModel = sequelize.define(
        "tickets",
        {
             id:{
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            ticket_uuid:{
                type: DataTypes.STRING,
                allowNull: true
            },
            ticket_code:{
                type: DataTypes.STRING,
                allowNull: true
            },
            order_uuid:{
                type: DataTypes.STRING,
                allowNull: true
            },
            ticket_group_uuid:{
                type: DataTypes.STRING,
                allowNull: true
            },
            ticket_type_name:{
                type: DataTypes.STRING,
                allowNull: true
            },
            ticket_type_uuid:{
                type: DataTypes.STRING,
                allowNull: true
            },
            single_price:{
                type: DataTypes.DECIMAL,
                allowNull: true
            },
            is_active:{
                type: DataTypes.BOOLEAN,
                allowNull: true
            },
            is_canceled:{
                type: DataTypes.BOOLEAN,
                allowNull: true
            },
            route_uuid:{
                type: DataTypes.STRING,
                allowNull: true
            },
            departure_planed:{
                type: DataTypes.STRING,
                allowNull: true
            },
            departure:{
                type: DataTypes.STRING,
                allowNull: true
            },
            line_code:{
                type: DataTypes.STRING,
                allowNull: true
            },
            line_name:{
                type: DataTypes.STRING,
                allowNull: true
            },
            departure_harbor_id:{
                type: DataTypes.STRING,
                allowNull: true
            },
            departure_harbor_name:{
                type: DataTypes.STRING,
                allowNull: true
            },
            arrival_planed:{
                type: DataTypes.STRING,
                allowNull: true
            },
            arrival:{
                type: DataTypes.STRING,
                allowNull: true
            },
            arrival_harbor_id:{
                type: DataTypes.STRING,
                allowNull: true
            },
            arrival_harbor_name:{
                type: DataTypes.STRING,
                allowNull: true
            },
            deactivate_order_no:{
                type: DataTypes.STRING,
                allowNull: true
            },
            deactivate:{
                type: DataTypes.BOOLEAN,
                allowNull: true
            },
            validate_data:{
                type: DataTypes.DATE,
                allowNull: true
            },
            deactivate_data:{
                type: DataTypes.DATE,
                allowNull: true
            },
            shift_uuid:{
                type: DataTypes.STRING,
                allowNull: true
            },
            order_number:{
                type: DataTypes.STRING,
                allowNull: true
            },
            status:{
                type: DataTypes.STRING,
                allowNull: true
            },
            ticket_qr:{
                type: DataTypes.STRING,
                allowNull: true
            },
            passanger_email:{
                type: DataTypes.STRING,
                allowNull: true
            },
            passanger_name:{
                type: DataTypes.STRING,
                allowNull: true
            },
            partner_uuid:{
                type: DataTypes.STRING,
                allowNull: true
            },
            // Tko je kartu prodao kroz partnersku prodaju. Partner ima vise
            // korisnika, a obracun im razraduje promet po osobi — bez ovoga se
            // zna samo da je prodao "partner".
            sold_by_username:{
                type: DataTypes.STRING,
                allowNull: true
            },
            partner_invoice_uuid:{
                type: DataTypes.STRING,
                allowNull: true
            },
            order_note:{
                type: DataTypes.STRING,
                allowNull: true
            },
            // SEOP / otočne kartice — podaci uz povlaštenu kartu, koriste se
            // pri ukrcaju (gate) za vizualnu provjeru i uz dojavu prodaje SEOP-u.
            is_island:{
                type: DataTypes.BOOLEAN,
                allowNull: true,
                defaultValue: false
            },
            seop_card_no:{
                type: DataTypes.STRING,
                allowNull: true
            },
            seop_pravo:{
                type: DataTypes.STRING,
                allowNull: true
            },
            seop_otok:{
                type: DataTypes.STRING,
                allowNull: true
            },
            seop_discount_pct:{
                type: DataTypes.INTEGER,
                allowNull: true
            },
            seop_ipk:{
                type: DataTypes.STRING,
                allowNull: true
            },
            // Račun s kojeg je karta prodana. Kanal prodaje i sredstvo plaćanja
            // stoje na računu, a ne na karti — bez ove veze se po njima ne može
            // ni filtrirati ni izvještavati. `order_uuid` za to ne služi: POS
            // računi ga ostavljaju prazan, a karte ondje nose lokalni broj
            // narudžbe koji ne odgovara nijednom računu.
            invoice_uuid:{
                type: DataTypes.STRING,
                allowNull: true
            },
            // --- Prebacivanje karte na drugi polazak ---
            // Stara karta prestaje vrijediti i pokazuje na novu; nova pokazuje
            // natrag. Bez te veze promjena se u izvještajima ne razlikuje od
            // običnog storna, a upravo se po tome i naplaćuje drukčije.
            transferred_to_ticket_uuid:{
                type: DataTypes.STRING,
                allowNull: true
            },
            transferred_from_ticket_uuid:{
                type: DataTypes.STRING,
                allowNull: true
            },
            // Postotak izvorne cijene koji je priznat pri promjeni, i iznos koji
            // iz njega proizlazi. Čuva se na staroj karti jer je to podatak o
            // toj prodaji, a treba i kad se cjenik u međuvremenu promijeni.
            transfer_percentage:{
                type: DataTypes.FLOAT,
                allowNull: true
            },
            transfer_credit:{
                type: DataTypes.FLOAT,
                allowNull: true
            },
        },{
            freezeTableName:true, tableName: "tickets", timestamps: true
        },
    );
    return{
        TicketsModel
    }
}