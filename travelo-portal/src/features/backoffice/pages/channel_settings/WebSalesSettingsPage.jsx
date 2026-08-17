import ChannelSettingsPage from "./ChannelSettingsPage";

export default function WebSalesSettingsPage() {
    return (
        <ChannelSettingsPage
            channel="web"
            title="Web prodaja"
            subtitle="Postavke izdavanja računa za prodaju putem web kanala"
            hint="Ovdje se izdvojeno postavlja kontekst računa za web prodaju. Dok ovo nije popunjeno, web prodaja koristi zatečeno pravilo — prvo aktivno prodajno mjesto tipa Web prodaja i njegov aktivni uređaj."
        />
    );
}
