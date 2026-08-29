const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
    const PartnerInvoiceModel = sequelize.define(
        "partner_invoices",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            partner_invoice_uuid: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            partner_invoice_no: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            // Numeracija po godini i naplatnom uredaju, isto pravilo kao na
            // blagajni i mobilnoj: partner_invoice_no tece kontinuirano za F1 i
            // F2, a partner_invoice_fiskal_no je sekvenca samo za F1 — F2 je
            // ne trosi, pa ne remeti fiskalni niz.
            partner_invoice_fiskal_no: {
                type: DataTypes.INTEGER,
                allowNull: true,
            },
            // Vidljiva oznaka racuna: "fiskalni_broj/PP/NU" za F1, a za F2
            // osmeroznakovni kod, jer F2 nema tu strukturu.
            partner_invoice_code: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            is_f2: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            },
            invoice_year: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            invoice_date: {
                type: DataTypes.DATE,
                allowNull: false,
            },
            period_from: {
                type: DataTypes.DATE,
                allowNull: false,
            },
            period_to: {
                type: DataTypes.DATE,
                allowNull: false,
            },
            // Izdavatelj u trenutku izdavanja. Racun mora sam nositi tko ga je
            // izdao — podaci tvrtke se s vremenom mijenjaju, a vec izdani racun
            // se ne smije mijenjati zajedno s njima.
            company_name: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            company_address: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            company_postal_code: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            company_town: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            company_legal_id: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            company_iban: {
                type: DataTypes.STRING,
                allowNull: true,
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
            partner_vat_id: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            partner_address: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            partner_postal_code: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            partner_town: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            partner_country: {
                type: DataTypes.STRING,
                allowNull: true,
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
            commission_pct: {
                type: DataTypes.DECIMAL(5, 2),
                allowNull: false,
                defaultValue: 0,
            },
            // Iznos na koji je provizija obračunata: bruto bez lučke pristojbe i
            // bez PDV-a. Stoji na računu jer se inače postotak i iznos provizije
            // ne mogu složiti — na bruto iznos ne daju taj rezultat.
            commission_base: {
                type: DataTypes.DECIMAL(12, 2),
                allowNull: false,
                defaultValue: 0,
            },
            // Lučka pristojba sadržana u naplaćenom iznosu. Partneru se
            // fakturira u cijelosti i ne umanjuje se za proviziju — nije naš
            // prihod nego se prosljeđuje luci.
            harbor_tax_amount: {
                type: DataTypes.DECIMAL(12, 2),
                allowNull: false,
                defaultValue: 0,
            },
            commission_amount: {
                type: DataTypes.DECIMAL(12, 2),
                allowNull: false,
                defaultValue: 0,
            },
            net_amount: {
                type: DataTypes.DECIMAL(12, 2),
                allowNull: false,
                defaultValue: 0,
            },
            vat_rate: {
                type: DataTypes.DECIMAL(5, 2),
                allowNull: false,
                defaultValue: 0,
            },
            vat_base: {
                type: DataTypes.DECIMAL(12, 2),
                allowNull: false,
                defaultValue: 0,
            },
            vat_amount: {
                type: DataTypes.DECIMAL(12, 2),
                allowNull: false,
                defaultValue: 0,
            },
            status: {
                type: DataTypes.STRING,
                allowNull: false,
                defaultValue: "issued",
            },
            // Kontekst izdavanja s postavki kanala (Administracija → Partnerska
            // prodaja). Partnerski računi dosad nisu imali fiskalne oznake.
            business_premise_uuid: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            business_premise_name: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            business_premise_fiscal_mark: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            billing_device_uuid: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            billing_device_fiscal_mark: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            payment_method_uuid: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            payment_method_name: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            cost_center: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            fiskal_required: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            },
            yescor_document_id: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            yescor_status: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            yescor_fiscalization_status: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            yescor_error_message: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            yescor_concurrency_stamp: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            yescor_last_sync_at: {
                type: DataTypes.DATE,
                allowNull: true,
            },
        },
        { freezeTableName: true, tableName: "partner_invoices", timestamps: true }
    );

    const PartnerInvoiceItemModel = sequelize.define(
        "partner_invoice_items",
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            partner_invoice_uuid: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            ticket_uuid: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            order_uuid: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            order_note: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            sale_datetime: {
                type: DataTypes.DATE,
                allowNull: true,
            },
            // Tko je kartu prodao: korisnik partnerske prodaje ili TID terminala
            // kod API prodaje. Bez toga se na racunu ne vidi tko je od
            // partnerovih ljudi koliko prodao.
            sold_by_username: {
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
            line_code: {
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
            departure: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            gross_amount: {
                type: DataTypes.DECIMAL(12, 2),
                allowNull: false,
                defaultValue: 0,
            },
            // Osnovica te karte — bez lučke pristojbe i bez PDV-a.
            commission_base: {
                type: DataTypes.DECIMAL(12, 2),
                allowNull: false,
                defaultValue: 0,
            },
            // Lučka pristojba sadržana u cijeni te karte.
            harbor_tax_amount: {
                type: DataTypes.DECIMAL(12, 2),
                allowNull: false,
                defaultValue: 0,
            },
            commission_amount: {
                type: DataTypes.DECIMAL(12, 2),
                allowNull: false,
                defaultValue: 0,
            },
            net_amount: {
                type: DataTypes.DECIMAL(12, 2),
                allowNull: false,
                defaultValue: 0,
            },
        },
        { freezeTableName: true, tableName: "partner_invoice_items", timestamps: true }
    );

    return {
        PartnerInvoiceModel,
        PartnerInvoiceItemModel,
    };
};
