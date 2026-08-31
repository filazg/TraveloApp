const { DataTypes } = require("sequelize");

// Izvjestaj za proviziju — dokument koji partner dobiva u ruke i po kojem nam
// ispostavlja svoj racun. Dosad se racunao samo u trenutku otvaranja ekrana, pa
// su se brojke mijenjale kako je prodaja tekla dalje. Ovdje se zamrzavaju: kad
// razdoblje po dinamici partnera zatvori, izvjestaj se generira i vise se ne
// mijenja, bez obzira na kasniji storno ili nove prodaje.
//
// Nije isto sto i partnerski racun (partner_invoices): racun je nas obracun
// prema partneru, izvjestaj je podloga koju partner koristi za svoj racun nama.
module.exports = (sequelize) => {
    const PartnerCommissionReportModel = sequelize.define(
        "partner_commission_reports",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            report_uuid: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            // Numeracija tece po godini, neovisno o partneru — jedan niz za sve
            // izvjestaje, kao sto partner_invoice_no tece za racune.
            report_no: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            report_year: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            partner_uuid: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            partner_name: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            partner_legal_id: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            company_name: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            // Dinamika po kojoj je razdoblje odredeno, prepisana s partnera u
            // trenutku generiranja. Ako se partneru kasnije promijeni dinamika,
            // stari izvjestaji i dalje govore po cemu su nastali.
            billing_cycle: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            billing_weekday: {
                type: DataTypes.INTEGER,
                allowNull: true,
            },
            // Granice razdoblja su datumi (YYYY-MM-DD), isti oblik koji vraca
            // razdobljePoDinamici — po njima se i provjerava je li izvjestaj za
            // to razdoblje vec napravljen.
            period_from: {
                type: DataTypes.DATEONLY,
                allowNull: false,
            },
            period_to: {
                type: DataTypes.DATEONLY,
                allowNull: false,
            },
            tickets_count: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
            },
            gross_amount: {
                type: DataTypes.DECIMAL(12, 2),
                allowNull: false,
                defaultValue: 0,
            },
            base_amount: {
                type: DataTypes.DECIMAL(12, 2),
                allowNull: false,
                defaultValue: 0,
            },
            commission_pct: {
                type: DataTypes.DECIMAL(5, 2),
                allowNull: false,
                defaultValue: 0,
            },
            commission_amount: {
                type: DataTypes.DECIMAL(12, 2),
                allowNull: false,
                defaultValue: 0,
            },
            status: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: "generated",
            },
            generated_at: {
                type: DataTypes.DATE,
                allowNull: true,
            },
        },
        { freezeTableName: true, tableName: "partner_commission_reports", timestamps: true }
    );

    // Stavke su karte onakve kakve su bile u trenutku generiranja. Cuvaju se da
    // se izvjestaj moze ponovno ispisati identican i kad karta u meduvremenu
    // bude stornirana ili joj se promijeni polazak.
    //
    // Nazivi polja prate redak koji vraca prikupiDetalje, da se snimka moze
    // ispisati bez prevodenja u drugi oblik.
    const PartnerCommissionReportItemModel = sequelize.define(
        "partner_commission_report_items",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            report_uuid: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            // "company" = prodaja u nase ime na partnerskom prodajnom mjestu,
            // "channel" = partnerova vlastita prodaja (partner-sale, T4B API).
            scope: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            business_premise_name: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            billing_device: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            operator: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            username: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            // Partnerova vlastita prodaja se cita po narudzbi, a ne po karti, pa
            // uz kartu ide i cime je vezana.
            order_uuid: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            order_number: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            order_note: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            passanger_name: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            ticket_code: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            ticket_type_name: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            route_uuid: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            line_name: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            departure_harbor_name: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            arrival_harbor_name: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            // Polazak je tekst "DD.MM.YYYY. HH:mm" kao i svugdje drugdje.
            departure_planed: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            sold_at: {
                type: DataTypes.DATE,
                allowNull: true,
            },
            gross_amount: {
                type: DataTypes.DECIMAL(12, 2),
                allowNull: false,
                defaultValue: 0,
            },
            base_amount: {
                type: DataTypes.DECIMAL(12, 2),
                allowNull: false,
                defaultValue: 0,
            },
            commission_amount: {
                type: DataTypes.DECIMAL(12, 2),
                allowNull: false,
                defaultValue: 0,
            },
        },
        { freezeTableName: true, tableName: "partner_commission_report_items", timestamps: true }
    );

    return { PartnerCommissionReportModel, PartnerCommissionReportItemModel };
};
