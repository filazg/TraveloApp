import React, { useState } from 'react';
import { ActivityIndicator, Alert, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { authData, logoutOperator } from '../store/slices/authSlice';
import { syncData } from '../store/slices/syncSlice';
import { voyageData, clearVoyage } from '../store/slices/voyageSlice';
import { resetSection } from '../store/slices/navSlice';
import {
    ALIGN,
    cutPaper,
    initPrinter,
    lineWrap,
    printQRCode,
    printText,
    setAlignment,
    setFontSize,
    sunmiPrinterAvailable,
} from '../device/printer';
import { colors, shadows } from '../theme/colors';

export default function HomeScreen() {
    const dispatch = useDispatch();
    const auth = useSelector(authData);
    const sync = useSelector(syncData);
    const voyage = useSelector(voyageData);
    const v = voyage.selected;
    const [printing, setPrinting] = useState(false);

    const printTest = async () => {
        if (!sunmiPrinterAvailable) {
            Alert.alert('Printer', 'Sunmi printer nije dostupan na ovom uređaju.');
            return;
        }
        setPrinting(true);
        try {
            await initPrinter();
            await setAlignment(ALIGN.CENTER);
            await setFontSize(28);
            await printText('TRAVELO\n');
            await setFontSize(20);
            await printText('TEST RAČUN\n');
            await lineWrap(1);
            await setAlignment(ALIGN.LEFT);
            await setFontSize(22);
            const bd = sync.basicData || {};
            await printText(`Poslovnica: ${bd.business_premise_name || '-'}\n`);
            await printText(`Uređaj: ${bd.billing_device_name || '-'}\n`);
            await printText(`Operater: ${auth.operator?.user_name || ''} ${auth.operator?.user_surname || ''}\n`);
            await printText(`Vrijeme: ${new Date().toLocaleString('hr-HR')}\n`);
            await lineWrap(1);
            await printText('--------------------------------\n');
            await printText('Karta 1x Split -> Hvar    25.00 EUR\n');
            await printText('--------------------------------\n');
            await printText('UKUPNO:                   25.00 EUR\n');
            await lineWrap(1);
            await setAlignment(ALIGN.CENTER);
            await printQRCode('TRAVELO-TEST-' + Date.now(), 8, 3);
            await lineWrap(1);
            await setFontSize(18);
            await printText('Hvala na povjerenju!\n');
            await lineWrap(3);
            try { await cutPaper(); } catch (_) { /* V2s doesn't always support cut */ }
        } catch (e) {
            Alert.alert('Printer greška', String(e?.message || e));
        } finally {
            setPrinting(false);
        }
    };

    return (
        <SafeAreaView style={styles.wrap}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.logoutBtn} onPress={() => dispatch(resetSection())}>
                    <Text style={styles.logoutText}>‹ Izbornik</Text>
                </TouchableOpacity>
                <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={styles.title}>Plovidba</Text>
                    <Text style={styles.subtitle}>
                        {sync.basicData?.billing_device_name}
                    </Text>
                </View>
                <TouchableOpacity style={styles.logoutBtn} onPress={() => dispatch(logoutOperator())}>
                    <Text style={styles.logoutText}>Odjava</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.content}>
                {/* Selected voyage banner */}
                {v && (
                    <View style={styles.voyageBanner}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.voyageTitle}>
                                {v.first_departure_time} · {v.line_code}
                            </Text>
                            <Text style={styles.voyageRoute}>{v.start_harbor} → {v.end_harbor}</Text>
                            <Text style={styles.voyageMeta}>
                                {v.line_name}{v.direction ? ` · smjer ${v.direction}` : ''} · {v.departure_date}
                            </Text>
                        </View>
                        <TouchableOpacity style={styles.voyageChange} onPress={() => dispatch(clearVoyage())}>
                            <Text style={styles.voyageChangeText}>Promijeni</Text>
                        </TouchableOpacity>
                    </View>
                )}

                <Text style={styles.opName}>
                    {auth.operator?.user_name} {auth.operator?.user_surname}
                </Text>
                <Text style={styles.opMeta}>@{auth.operator?.user_username}</Text>

                <View style={styles.tilesGrid}>
                    <TouchableOpacity
                        style={[styles.tile, styles.tileSale, printing && styles.tileDisabled]}
                        disabled={printing}
                        onPress={printTest}
                    >
                        {printing ? (
                            <ActivityIndicator color={colors.textOnPrimary} />
                        ) : (
                            <>
                                <Text style={styles.tileTitle}>Prodaja</Text>
                                <Text style={styles.tileSub}>Tap za test ispis</Text>
                            </>
                        )}
                    </TouchableOpacity>
                    <View style={[styles.tile, styles.tileScan]}>
                        <Text style={styles.tileTitleAlt}>Validacija</Text>
                        <Text style={styles.tileSubAlt}>(uskoro)</Text>
                    </View>
                    <View style={[styles.tile, styles.tileShift]}>
                        <Text style={styles.tileTitleAlt}>Smjena</Text>
                        <Text style={styles.tileSubAlt}>Zaključak prometa (uskoro)</Text>
                    </View>
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    wrap: { flex: 1, backgroundColor: colors.bg },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: colors.primary,
    },
    title: { fontSize: 22, fontWeight: '800', color: colors.textOnPrimary },
    subtitle: { fontSize: 12, color: colors.secondary, marginTop: 2 },
    logoutBtn: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.secondary, borderRadius: 6 },
    logoutText: { color: colors.textOnSecondary, fontSize: 13, fontWeight: '600' },
    content: { flex: 1, padding: 20 },
    opName: { color: colors.textPrimary, fontSize: 24, fontWeight: '700' },
    opMeta: { color: colors.textSecondary, fontSize: 14, marginBottom: 32 },
    tilesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    tile: {
        flex: 1,
        minWidth: 140,
        height: 120,
        borderRadius: 12,
        padding: 16,
        justifyContent: 'flex-end',
    },
    tileSale: { backgroundColor: colors.primary, ...shadows.elevated },
    tileScan: { backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.secondary, ...shadows.card },
    tileShift: { backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.secondary, ...shadows.card },
    tileDisabled: { opacity: 0.6 },
    tileTitle: { color: colors.textOnPrimary, fontSize: 20, fontWeight: '700' },
    tileSub: { color: colors.secondary, fontSize: 12, marginTop: 4 },
    tileTitleAlt: { color: colors.primary, fontSize: 20, fontWeight: '700' },
    tileSubAlt: { color: colors.textSecondary, fontSize: 12, marginTop: 4 },
    voyageBanner: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: 10,
        padding: 14,
        borderLeftWidth: 4,
        borderLeftColor: colors.primary,
        borderWidth: 1, borderColor: colors.border,
        marginBottom: 20,
        ...shadows.card,
    },
    voyageTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '700' },
    voyageRoute: { color: colors.textSecondary, fontSize: 14, marginTop: 2 },
    voyageMeta: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
    voyageChange: { paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: colors.border, borderRadius: 6 },
    voyageChangeText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
});
