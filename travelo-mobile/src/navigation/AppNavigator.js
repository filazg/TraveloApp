import React, { useEffect } from 'react';
import { ActivityIndicator, StatusBar, StyleSheet, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { colors } from '../theme/colors';
import { authData, restoreTokenThunk } from '../store/slices/authSlice';
import { syncBasicDataThunk, syncTransportDataThunk, syncData, hydrateFromDbThunk } from '../store/slices/syncSlice';
import { loadCurrentOpenThunk, loadRecentShiftsThunk, syncPendingShiftsThunk } from '../store/slices/shiftsSlice';
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

export default function AppNavigator() {
    const dispatch = useDispatch();
    const auth = useSelector(authData);
    const sync = useSelector(syncData);
    const voyage = useSelector(voyageData);
    const nav = useSelector(navData);

    // Cold-boot: open SQLite, hydrate redux, then attempt token restore.
    useEffect(() => {
        (async () => {
            await openDb();
            await dispatch(hydrateFromDbThunk());
            dispatch(restoreTokenThunk());
        })();
    }, [dispatch]);

    // Network-backed refresh of master data when a token is available but
    // either we have nothing or the last sync looks stale.
    useEffect(() => {
        if (!sync.hydrated) return;
        if (auth.token && !sync.basicData && !sync.loading) dispatch(syncBasicDataThunk());
        if (auth.token && !sync.salesRoutes.length && !sync.transportLoading) dispatch(syncTransportDataThunk());
    }, [auth.token, sync.hydrated, sync.basicData, sync.loading, sync.salesRoutes.length, sync.transportLoading, dispatch]);

    // Load operator's open shift + recent shifts after operator login. Also push pending
    // (offline-saved) snapshots to backend best-effort whenever auth+basic_data are ready.
    useEffect(() => {
        if (!sync.hydrated || !auth.operator || !sync.basicData) return;
        dispatch(loadCurrentOpenThunk());
        dispatch(loadRecentShiftsThunk());
        dispatch(syncPendingShiftsThunk());
    }, [sync.hydrated, auth.operator, sync.basicData, dispatch]);

    if (auth.booting) {
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
