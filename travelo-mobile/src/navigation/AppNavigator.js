import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, AppState, StatusBar, StyleSheet, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { colors } from '../theme/colors';
import { authData, autoPairThunk, logoutOperator, restoreTokenThunk } from '../store/slices/authSlice';
import { syncBasicDataThunk, syncTransportDataThunk, syncAllThunk, syncData, hydrateFromDbThunk } from '../store/slices/syncSlice';
import { startSyncStream, stopSyncStream } from '../api/syncStream';
import { autoCloseStaleShiftThunk, loadCurrentOpenThunk, loadRecentShiftsThunk, shiftsData, syncPendingShiftsThunk } from '../store/slices/shiftsSlice';
import { syncPendingSalesThunk } from '../store/slices/salesSlice';
import { refreshOpenVoyageTicketsThunk } from '../store/slices/validationSlice';
import { openDb } from '../db/db';
import { voyageData } from '../store/slices/voyageSlice';
import { navData } from '../store/slices/navSlice';
import PairingScreen from '../screens/PairingScreen';
import OperatorLoginScreen from '../screens/OperatorLoginScreen';
import MainMenuScreen from '../screens/MainMenuScreen';
import LineSelectScreen from '../screens/LineSelectScreen';
import VoyageSelectScreen from '../screens/VoyageSelectScreen';
import ShiftsScreen from '../screens/ShiftsScreen';
import DocumentsScreen from '../screens/DocumentsScreen';
import SaleScreen from '../screens/SaleScreen';

// Koliko često terminal sam pokušava gurnuti zaostale prodaje.
const SYNC_RETRY_MS = 2 * 60 * 1000;

export default function AppNavigator() {
    const dispatch = useDispatch();
    const auth = useSelector(authData);
    const sync = useSelector(syncData);
    const voyage = useSelector(voyageData);
    const nav = useSelector(navData);
    const shifts = useSelector(shiftsData);

    // Cold-boot: open SQLite, hydrate redux, then attempt token restore.
    useEffect(() => {
        (async () => {
            await openDb();
            await dispatch(hydrateFromDbThunk());
            dispatch(restoreTokenThunk());
        })();
    }, [dispatch]);

    // Zero-touch: uređaj bez tokena prvo pokuša uparivanje po serijskom broju.
    // Tek ako to ne prođe, prikazuje se ekran za ručno uparivanje.
    useEffect(() => {
        if (auth.booting || auth.token || auth.autoPairChecked || auth.autoPairing) return;
        dispatch(autoPairThunk());
    }, [auth.booting, auth.token, auth.autoPairChecked, auth.autoPairing, dispatch]);

    // App često ostane u memoriji, pa se boot ne ponovi kad je operater samo
    // minimizira. Zato neuparen uređaj ponovi provjeru pri povratku u prvi plan
    // — tako se upari čim se u portalu ispravi serijski broj ili uključi
    // zastavica, bez ubijanja aplikacije.
    useEffect(() => {
        const sub = AppState.addEventListener('change', (state) => {
            if (state !== 'active') return;
            if (auth.token || auth.autoPairing || auth.autoPairSuppressed) return;
            dispatch(autoPairThunk());
        });
        return () => sub.remove();
    }, [auth.token, auth.autoPairing, auth.autoPairSuppressed, dispatch]);

    // Podaci o operaterima (šifre, lozinke, dozvole) mijenjaju se u portalu, a
    // terminal ih samo povlači. Zato pri svakom pokretanju povučemo basic_data i
    // kad ga već imamo — inače nova šifra ne dođe na uređaj dok netko ručno ne
    // pritisne "Osvježi podatke". Ako povlačenje ne uspije, ostaje zadnja
    // spremljena kopija pa se i offline može prijaviti.
    const bootRefreshRef = useRef(false);
    useEffect(() => {
        if (!sync.hydrated || !auth.token || bootRefreshRef.current) return;
        bootRefreshRef.current = true;
        dispatch(syncBasicDataThunk());
    }, [sync.hydrated, auth.token, dispatch]);

    // Network-backed refresh of master data when a token is available but
    // either we have nothing or the last sync looks stale.
    useEffect(() => {
        if (!sync.hydrated) return;
        if (auth.token && !sync.basicData && !sync.loading) dispatch(syncBasicDataThunk());
        if (auth.token && !sync.salesRoutes.length && !sync.transportLoading) dispatch(syncTransportDataThunk());
    }, [auth.token, sync.hydrated, sync.basicData, sync.loading, sync.salesRoutes.length, sync.transportLoading, dispatch]);

    // Poslužitelj javlja kad se nešto promijeni — storno karte, otkaz ili pomak
    // polaska — pa uređaj povuče podatke odmah, umjesto da ih čeka do sljedećeg
    // ručnog osvježavanja. Do tada se stornirana karta mogla validirati, a
    // otkazan polazak prodavati.
    useEffect(() => {
        if (!auth.token) return undefined;
        startSyncStream((promjene) => {
            if (promjene.includes('transport')) dispatch(syncTransportDataThunk());
            // Karte se ne drže u zalihi nego se povlače po polasku; osvježi se
            // ono što je trenutno otvoreno, pa storno s drugog uređaja odmah
            // vrijedi i ovdje.
            if (promjene.includes('tickets')) dispatch(refreshOpenVoyageTicketsThunk());
        });
        return () => stopSyncStream();
    }, [auth.token, dispatch]);

    // Load operator's open shift + recent shifts after operator login. Also push pending
    // (offline-saved) snapshots to backend best-effort whenever auth+basic_data are ready.
    useEffect(() => {
        if (!sync.hydrated || !auth.operator || !sync.basicData) return;
        dispatch(loadCurrentOpenThunk());
        dispatch(loadRecentShiftsThunk());
        dispatch(syncPendingShiftsThunk());
    }, [sync.hydrated, auth.operator, sync.basicData, dispatch]);

    // Smjena se ne prenosi u sljedeći dan — ono što u 01:00 još stoji otvoreno
    // zatvara se samo. Provjerava se pri pokretanju i povratku u prvi plan, jer
    // je uređaj preko noći najčešće ugašen ili uspavan, pa granica prođe dok
    // aplikacija ne radi. Uz to periodično, za slučaj da ostane upaljen.
    useEffect(() => {
        if (!sync.hydrated || !auth.operator || !sync.basicData) return;
        // Nakon automatskog zatvaranja vrijedi isto kao kod ručnog: zaostalo
        // ode u sustav, podaci se osvježe za sljedeću smjenu, a operater se
        // odjavljuje — uređaj ujutro dočeka prijavni ekran, ne tuđu smjenu.
        const provjeri = async () => {
            const res = await dispatch(autoCloseStaleShiftThunk());
            if (!res?.payload?.closed) return;
            try {
                await dispatch(syncPendingSalesThunk());
                await dispatch(syncPendingShiftsThunk());
                await dispatch(syncAllThunk());
            } catch (e) {
                // Mreža zna biti nedostupna — zaostalo ostaje lokalno i ode
                // pri sljedećoj prilici; odjava se zbog toga ne zaustavlja.
            }
            dispatch(logoutOperator());
        };
        provjeri();
        const timer = setInterval(provjeri, 5 * 60 * 1000);
        const sub = AppState.addEventListener('change', (state) => {
            if (state === 'active') provjeri();
        });
        return () => { clearInterval(timer); sub.remove(); };
        // Otvorena smjena stiže asinkrono, pa se provjera ponavlja čim je učitana —
        // inače bi jutarnje pokretanje čekalo prvi tik od pet minuta.
    }, [sync.hydrated, auth.operator, sync.basicData, shifts.currentOpen?.shift_uuid, dispatch]);

    // Zaostale prodaje (synced=0) guraju se same, u pozadini. Terminal radi
    // offline-first — račun se uvijek izda i spremi lokalno, a slanje je
    // najbolji trud — pa bez ovoga zaostatak visi dok ga netko ne primijeti na
    // gumbu Sync u Dokumentima. Pokušava se i pri povratku aplikacije u prvi
    // plan, jer je mreža tada najčešće opet dostupna.
    useEffect(() => {
        if (!sync.hydrated || !auth.token || !sync.basicData) return;
        const push = () => dispatch(syncPendingSalesThunk());
        push();
        const timer = setInterval(push, SYNC_RETRY_MS);
        const sub = AppState.addEventListener('change', (state) => {
            if (state === 'active') push();
        });
        return () => { clearInterval(timer); sub.remove(); };
    }, [sync.hydrated, auth.token, sync.basicData, dispatch]);

    // Dok traje provjera zero-touch uparivanja držimo spinner, da ekran za ručno
    // uparivanje ne bljesne na trenutak prije nego uređaj sam dobije token.
    if (auth.booting || (!auth.token && !auth.autoPairChecked)) {
        return (
            <View style={styles.center}>
                <StatusBar barStyle="light-content" />
                <ActivityIndicator color={colors.primary} size="large" />
            </View>
        );
    }

    const wrap = (child) => <><StatusBar barStyle="light-content" />{child}</>;

    if (!auth.token) return wrap(<PairingScreen />);
    if (!auth.operator) return wrap(<OperatorLoginScreen />);

    // Main menu before any section is chosen.
    if (!nav.section) return wrap(<MainMenuScreen />);

    if (nav.section === 'shifts') return wrap(<ShiftsScreen />);
    if (nav.section === 'documents') return wrap(<DocumentsScreen />);

    // 'voyage' section: line → voyage → sale (with background validation)
    if (!voyage.selectedLine) return wrap(<LineSelectScreen />);
    if (!voyage.selected) return wrap(<VoyageSelectScreen />);
    return wrap(<SaleScreen />);
}

const styles = StyleSheet.create({
    center: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' },
});
