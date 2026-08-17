import ChannelSettingsPage from "./ChannelSettingsPage";

export default function PartnerSalesSettingsPage() {
    return (
        <ChannelSettingsPage
            channel="partner"
            title="Partnerska prodaja"
            subtitle="Postavke izdavanja zbirnih računa partnerima"
            hint="Provizija, stopa PDV-a i dinamika izdavanja postavljaju se po partneru (Administracija → Partneri). Ovdje se postavlja samo kako se izdaje sam račun."
        />
    );
}
