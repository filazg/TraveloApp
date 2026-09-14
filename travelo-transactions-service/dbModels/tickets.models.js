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
            // Polazak NA KOJEM je karta ocitana. Za vecinu karata je to njihov
            // vlastiti polazak, ali putnik koji je propustio brod ude na
            // sljedeci sa starom kartom — i tada karta na svom polasku izgleda
            // kao obican ukrcaj, iako covjeka ondje nema. Bez ovog zapisa se ta
            // razlika iz same karte ne vidi.
            validated_route_uuid:{
                type: DataTypes.STRING,
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
            // Tri znaka koja se dopisuju uz broj karte pri ispisu i idu u QR.
            // Srednji znak razlikuje original od kopije (vidi
            // helpers/ticketCopyMark.js). Stoji odvojeno od ticket_code-a da
            // traženje i validacija po broju karte ostanu netaknuti — sufiks se
            // nikad ne uspoređuje.
            ticket_code_suffix:{
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
            // Odakle karta dolazi. Prazno je nasa prodaja; "OLD" su karte
            // preuzete iz starog sustava pri zamjeni: njih se samo validira, ne
            // prodaje se i ne stornira, a u izvjestajima prometa ne smiju se
            // mijesati s nasom prodajom.
            origin:{
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
            // Ostatak onoga što dojava prodaje traži, a zna se tek na blagajni.
            // Bez ovih polja se DojaviProdajuPPK_3Eur poslije nema iz čega
            // složiti: cijena na karti je već umanjena, pa se redovna ne može
            // izračunati unatrag, a ni jedan drugi zapis ne pamti je li
            // blagajnik prodao kartu unatoč odbijenoj provjeri.
            seop_sustav:{                 // SEOP ili MOSI
                type: DataTypes.STRING,
                allowNull: true
            },
            seop_id_vrsta:{               // card_no | oib | iks | uid | reg_oznaka
                type: DataTypes.STRING,
                allowNull: true
            },
            seop_token:{                  // zapečaćeni zapis provjere iz akd servisa
                type: DataTypes.TEXT,
                allowNull: true
            },
            seop_namjena:{                // šifra namjene karte (`namjena` iz specifikacije)
                type: DataTypes.STRING,
                allowNull: true
            },
            seop_redovna_cijena:{         // redovCijenaEur — cijena bez povlastice
                type: DataTypes.DECIMAL(10, 2),
                allowNull: true
            },
            seop_odobrenje:{              // oznOdobrenja, za virtualne iskaznice
                type: DataTypes.STRING,
                allowNull: true
            },
            seop_uvijek_prodaj:{          // uvijekProdaj — prodano i bez potvrđenog prava
                type: DataTypes.BOOLEAN,
                allowNull: true,
                defaultValue: false
            },
            seop_offline:{                // provjera nije bila moguća u trenutku prodaje
                type: DataTypes.BOOLEAN,
                allowNull: true,
                defaultValue: false
            },
            seop_pratnja:{                // MOSI: karta pratnje uz vlasnika kartice
                type: DataTypes.BOOLEAN,
                allowNull: true,
                defaultValue: false
            },
            // Ide li prodaja u SEOP. Linija moze koristiti SEOP samo za provjeru
            // iskaznice, bez dojave — tada karta postoji kod nas, a u SEOP
            // obracun ne ulazi. Red cekanja to cita odavde.
            seop_dojava:{
                type: DataTypes.BOOLEAN,
                allowNull: true,
                defaultValue: true
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