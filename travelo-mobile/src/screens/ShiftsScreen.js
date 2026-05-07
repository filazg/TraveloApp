import React, { useEffect, useState } from 'react';
import {
    Alert,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    ActivityIndicator,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { resetSection } from '../store/slices/navSlice';
import {
    shiftsData,
    openShiftThunk,
    closeShiftThunk,
    previewCloseShiftThunk,
    loadCurrentOpenThunk,
    loadRecentShiftsThunk,
    clearShiftPreview,
} from '../store/slices/shiftsSlice';
import { syncData } from '../store/slices/syncSlice';
import { printShiftReport } from '../device/printSale';
import { colors, shadows } from '../theme/colors';
import HomeButton from '../components/HomeButton';

const fmtEUR = (n) => `${(Number(n) || 0).toFixed(2)} €`;
const fmtTime = (iso) => {
    if (!iso) return '–';
    try {
        const d = new Date(iso);
        const pad = (n) => String(n).padStart(2, '0');
        return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}. ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch (_) {
        return iso;
    }
};

export default function ShiftsScreen() {
    const dispatch = useDispatch();
    const shifts = useSelector(shiftsData);
    const sync = useSelector(syncData);
    const [view, setView] = useState('home'); // 'home' | 'close'
    const [remark, setRemark] = useState('');
    const [actuals, setActuals] = useState({}); // { [payment_type_uuid]: { actual_amount, note } }
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        dispatch(loadCurrentOpenThunk());
        dispatch(loadRecentShiftsThunk());
    }, [dispatch]);

    const open = shifts.currentOpen;

    const handleOpen = async () => {
        setBusy(true);
        const res = await dispatch(openShiftThunk());
        setBusy(false);
        if (res.meta.requestStatus !== 'fulfilled') {
            Alert.alert('Greška', res.payload?.message || 'Otvaranje smjene nije uspjelo');
        }
    };

    const handlePreviewClose = async () => {
        setBusy(true);
        await dispatch(previewCloseShiftThunk());
        setBusy(false);
        setActuals({});
        setRemark('');
        setView('close');
    };

    const handleCloseConfirm = () => {
        Alert.alert(
            'Zatvori smjenu?',
            'Smjena će biti zaključena i poslana u sustav. Ova akcija se ne može poništiti.',
            [
                { text: 'Odustani', style: 'cancel' },
                {
                    text: 'Zatvori',
                    style: 'destructive',
                    onPress: async () => {
                        setBusy(true);
                        const res = await dispatch(closeShiftThunk({ remark, actuals }));
                        setBusy(false);
                        if (res.meta.requestStatus === 'fulfilled') {
                            setView('home');
                            dispatch(loadRecentShiftsThunk());
                            // Auto-ispis zaključka smjene odmah po zatvaranju.
                            try {
                                await printShiftReport({ shift: res.payload, basicData: sync.basicData });
                            } catch (e) {
                                Alert.alert('Ispis', 'Smjena je zatvorena, ali ispis nije uspio.');
                            }
                        } else {
                            Alert.alert('Greška', res.payload?.message || 'Zatvaranje nije uspjelo');
                        }
                    },
                },
            ]
        );
    };

    const renderHome = () => (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
            {open ? (
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Otvorena smjena</Text>
                    <Row label="Operater" value={`${open.operater_name || ''} ${open.operater_surname || ''}`.trim()} />
                    <Row label="Početak" value={fmtTime(open.shift_start)} />
                    <Row label="Uređaj" value={open.billing_device_fiscal_mark || '–'} />
                    {!open._synced && <Text style={styles.pendingTag}>● Čeka sinkronizaciju</Text>}
                    <TouchableOpacity style={[styles.btn, styles.btnDanger]} onPress={handlePreviewClose} disabled={busy}>
                        {busy ? <ActivityIndicator color={colors.textOnPrimary} /> : <Text style={styles.btnText}>Detalji smjene</Text>}
                    </TouchableOpacity>
                </View>
            ) : (
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Nema otvorene smjene</Text>
                    <Text style={styles.muted}>
                        Za prodaju i validaciju karata morate otvoriti smjenu.
                    </Text>
                    <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={handleOpen} disabled={busy}>
                        {busy ? <ActivityIndicator color={colors.textOnPrimary} /> : <Text style={styles.btnText}>Otvori smjenu</Text>}
                    </TouchableOpacity>
                </View>
            )}

            {(() => {
                // Otvorena smjena se već prikazuje gore u svojoj kartici, izbacimo je
                // iz "Zadnje smjene" da se ne duplira.
                const closed = (shifts.recent || []).filter((s) => s.shift_end);
                if (!closed.length) return null;
                return (
                <View style={[styles.card, { marginTop: 12 }]}>
                    <Text style={styles.cardTitle}>Zadnje smjene</Text>
                    {closed.slice(0, 10).map((s) => (
                        <View key={s.shift_uuid} style={styles.recentRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.recentTime}>
                                    {fmtTime(s.shift_start)} {s.shift_end ? `→ ${fmtTime(s.shift_end)}` : '(otvorena)'}
                                </Text>
                                <Text style={styles.recentSub}>
                                    {fmtEUR(s.shift_amount)} · {s.shift_first_invoice ? `R ${s.shift_first_invoice}–${s.shift_last_invoice}` : 'bez računa'}
                                </Text>
                            </View>
                            {!s._synced && <Text style={styles.pendingTag}>●</Text>}
                            {s.shift_end && (
                                <TouchableOpacity
                                    style={styles.printBtn}
                                    onPress={() => printShiftReport({ shift: s, basicData: sync.basicData, isReprint: true })}
                                >
                                    <Text style={styles.printBtnText}>Ispiši</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    ))}
                </View>
                );
            })()}
        </ScrollView>
    );

    const preview = shifts.preview;
    const renderClose = () => (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
            <View style={styles.card}>
                <Text style={styles.cardTitle}>Pregled prije zatvaranja</Text>
                <Row label="Početak" value={fmtTime(open?.shift_start)} />
                <Row label="Računa" value={String(preview?.invoiceCount ?? 0)} />
                <Row
                    label="Brojevi"
                    value={preview?.shift_first_invoice ? `${preview.shift_first_invoice} – ${preview.shift_last_invoice}` : '–'}
                />
                <View style={styles.divider} />
                <Row label="PDV osnovica" value={fmtEUR(preview?.shift_vat_base)} />
                <Row label="PDV" value={fmtEUR(preview?.shift_vat)} />
                <Row label="Lučka pristojba" value={fmtEUR(preview?.shift_harbor_tax)} />
                <Row label="Ukupno" value={fmtEUR(preview?.shift_amount)} bold />
            </View>

            <View style={[styles.card, { marginTop: 12 }]}>
                <Text style={styles.cardTitle}>Po vrsti plaćanja</Text>
                {(preview?.finance || []).length === 0 ? (
                    <Text style={styles.muted}>Nema prodaja u ovoj smjeni.</Text>
                ) : (
                    (preview?.finance || []).map((row) => (
                        <View key={row.payment_type_uuid} style={styles.payRow}>
                            <View style={styles.payHead}>
                                <Text style={styles.payName}>{row.payment_type_name}</Text>
                                <Text style={styles.payCount}>{row.count} račun(a)</Text>
                            </View>
                            <Row label="Očekivano" value={fmtEUR(row.payment_amount)} />
                        </View>
                    ))
                )}
            </View>

            <View style={[styles.card, { marginTop: 12 }]}>
                <Text style={styles.cardTitle}>Napomena</Text>
                <TextInput
                    style={[styles.input, { width: '100%' }]}
                    multiline
                    numberOfLines={3}
                    placeholder="Komentar smjene (opcionalno)"
                    placeholderTextColor={colors.textMuted}
                    value={remark}
                    onChangeText={setRemark}
                />
            </View>

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                <TouchableOpacity
                    style={[styles.btn, styles.btnSecondary, { flex: 1 }]}
                    onPress={() => { setView('home'); dispatch(clearShiftPreview()); }}
                    disabled={busy}
                >
                    <Text style={[styles.btnText, styles.btnSecondaryText]}>Natrag</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.btn, styles.btnDanger, { flex: 1 }]}
                    onPress={handleCloseConfirm}
                    disabled={busy}
                >
                    {busy ? <ActivityIndicator color={colors.textOnPrimary} /> : <Text style={styles.btnText}>Zaključi smjenu</Text>}
                </TouchableOpacity>
            </View>
        </ScrollView>
    );

    return (
        <SafeAreaView style={styles.wrap}>
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backBtn}
                    onPress={() => (view === 'close' ? setView('home') : dispatch(resetSection()))}
                >
                    <Text style={styles.backText}>‹ {view === 'close' ? 'Pregled' : 'Izbornik'}</Text>
                </TouchableOpacity>
                <Text style={styles.title}>{view === 'close' ? 'Detalji smjene' : 'Smjene'}</Text>
                <View style={{ width: 80, alignItems: 'flex-end', paddingRight: 8 }}>
                    <HomeButton />
                </View>
            </View>
            {view === 'home' ? renderHome() : renderClose()}
        </SafeAreaView>
    );
}

const Row = ({ label, value, bold }) => (
    <View style={styles.row}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={[styles.rowValue, bold && styles.rowValueBold]}>{value}</Text>
    </View>
);

const styles = StyleSheet.create({
    wrap: { flex: 1, backgroundColor: colors.bg },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 8, paddingVertical: 12,
        backgroundColor: colors.primary,
    },
    backBtn: { paddingVertical: 6, paddingHorizontal: 10, minWidth: 80 },
    backText: { color: colors.secondary, fontSize: 16, fontWeight: '600' },
    title: { fontSize: 18, fontWeight: '700', color: colors.textOnPrimary },
    card: {
        backgroundColor: colors.surface, borderRadius: 12, padding: 16,
        borderWidth: 1, borderColor: colors.border,
        ...shadows.card,
    },
    cardTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '700', marginBottom: 12 },
    row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
    rowLabel: { color: colors.textSecondary, fontSize: 14 },
    rowValue: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
    rowValueBold: { color: colors.textPrimary, fontSize: 16, fontWeight: '800' },
    divider: { height: 1, backgroundColor: colors.border, marginVertical: 8 },
    muted: { color: colors.textSecondary, fontSize: 13, marginBottom: 12 },
    btn: { paddingVertical: 14, borderRadius: 8, alignItems: 'center', marginTop: 12 },
    btnPrimary: { backgroundColor: colors.primary },
    btnDanger: { backgroundColor: colors.error },
    btnSecondary: { backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.secondary },
    btnText: { color: colors.textOnPrimary, fontSize: 16, fontWeight: '700' },
    btnSecondaryText: { color: colors.primary },
    pendingTag: { color: colors.warning, fontSize: 12, marginTop: 6, fontWeight: '600' },
    recentRow: {
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    recentTime: { color: colors.textPrimary, fontSize: 13, fontWeight: '600' },
    recentSub: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
    payRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
    payHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    payName: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
    payCount: { color: colors.textSecondary, fontSize: 12 },
    inputRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
    inputLabel: { color: colors.textSecondary, fontSize: 14, width: 90 },
    input: {
        backgroundColor: colors.surface, color: colors.textPrimary, paddingHorizontal: 10, paddingVertical: 8,
        borderRadius: 6, borderWidth: 1, borderColor: colors.border, flex: 1, fontSize: 14,
    },
    diff: { fontSize: 12, marginTop: 4, fontWeight: '600' },
    printBtn: {
        marginLeft: 8, paddingHorizontal: 12, paddingVertical: 6,
        backgroundColor: colors.primary, borderRadius: 6,
    },
    printBtnText: { color: colors.textOnPrimary, fontSize: 12, fontWeight: '600' },
});
