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
    syncPendingShiftsThunk,
    previewCloseShiftThunk,
    loadCurrentOpenThunk,
    loadRecentShiftsThunk,
    clearShiftPreview,
    computeShiftBreakdown,
} from '../store/slices/shiftsSlice';
import { loadInvoicesForShift } from '../db/repo';
import { syncAllThunk, syncData } from '../store/slices/syncSlice';
import { syncPendingSalesThunk } from '../store/slices/salesSlice';
import { logoutOperator } from '../store/slices/authSlice';
import { printShiftReport } from '../device/printSale';
import { colors, shadows, layout } from '../theme/colors';
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
            return;
        }
        // Smjena se otvara da bi se krenulo prodavati, pa se odmah ide na
        // izbornik — inače operater ostaje na ekranu smjene i mora se sam
        // vraćati natrag.
        dispatch(resetSection());
    };

    const handlePreviewClose = async () => {
        setBusy(true);
        await dispatch(previewCloseShiftThunk());
        setBusy(false);
        setActuals({});
        setRemark('');
        setView('close');
    };

    // Ponovni ispis zaključka. Smjene zatvorene prije nego je rekapitulacija
    // storna uvedena nemaju shift_storno u spremljenom zapisu, pa se u tom
    // slučaju doračuna iz lokalnih računa te smjene — kopija tako izgleda isto
    // kao original. Ako računa nema (npr. očišćena baza), ispisuje se bez te
    // sekcije umjesto da ispis padne.
    const reprintShift = async (s) => {
        let shift = s;
        if (!Array.isArray(s?.shift_storno)) {
            try {
                const invoices = await loadInvoicesForShift(s.shift_uuid);
                const b = computeShiftBreakdown(invoices);
                shift = {
                    ...s,
                    shift_storno: b.storno,
                    shift_storno_count: b.storno_count,
                    shift_storno_amount: b.storno_amount,
                };
            } catch (e) {
                console.log('[reprintShift] doračun storna nije uspio:', e?.message || e);
            }
        }
        try {
            await printShiftReport({ shift, basicData: sync.basicData, isReprint: true });
        } catch (e) {
            Alert.alert('Ispis', 'Ispis kopije nije uspio.');
        }
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
                            // Zatvaranje smjene je kraj rada na uređaju: prvo se
                            // gura sve što je ostalo lokalno, pa se povlače svježi
                            // podaci za sljedeću smjenu, i tek onda odjava.
                            // Redoslijed je bitan — odjava prekida ekran, a slanje
                            // zaostalog mora proći prije toga.
                            setBusy(true);
                            try {
                                await dispatch(syncPendingSalesThunk());
                                await dispatch(syncPendingShiftsThunk());
                                await dispatch(syncAllThunk());
                            } catch (e) {
                                // Mreža zna pasti — zaostalo ostaje lokalno i ode
                                // pri sljedećoj prilici, odjava se zbog toga ne
                                // zaustavlja.
                            }
                            setBusy(false);
                            dispatch(logoutOperator());
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
                                    onPress={() => reprintShift(s)}
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

            {/* Rekapitulacija storna — isti raspored kao kartica plaćanja, samo
                su iznosi ono što je vraćeno. Storna su već uračunata u očekivane
                iznose ispod (negativan iznos ih umanjuje); ovdje se vide zasebno
                da blagajnik zna koliko je izašlo iz blagajne i po kojem sredstvu. */}
            {(preview?.storno || []).length > 0 ? (
                <View style={[styles.card, { marginTop: 12 }]}>
                    <Text style={styles.cardTitle}>Storno</Text>
                    {(preview?.storno || []).map((row) => (
                        <View key={`storno-${row.payment_type_uuid}`} style={styles.payRow}>
                            <View style={styles.payHead}>
                                <Text style={styles.payName}>{row.payment_type_name}</Text>
                                <Text style={styles.payCount}>{row.count} storno</Text>
                            </View>
                            <Row label="Stornirano" value={fmtEUR(row.payment_amount)} />
                        </View>
                    ))}
                    <View style={styles.divider} />
                    <Row label="Ukupno stornirano" value={fmtEUR(preview?.storno_amount)} bold />
                </View>
            ) : null}

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
                    <Text style={styles.backText}>‹</Text>
                </TouchableOpacity>
                <Text style={styles.title}>{view === 'close' ? 'Detalji smjene' : 'Smjene'}</Text>
                <View style={{ minWidth: 44, alignItems: 'flex-end' }}>
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
        minHeight: layout.headerHeight,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: layout.headerPaddingH, paddingVertical: 12,
        backgroundColor: colors.primary,
    },
    backBtn: {
        backgroundColor: colors.secondary, borderRadius: 8,
        width: layout.headerButtonHeight, height: layout.headerButtonHeight,
        alignItems: 'center', justifyContent: 'center',
    },
    backText: { color: colors.textOnSecondary, fontSize: 32, fontWeight: '800', lineHeight: 34 },
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
