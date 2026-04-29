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
                        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Zatvori smjenu</Text>}
                    </TouchableOpacity>
                </View>
            ) : (
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Nema otvorene smjene</Text>
                    <Text style={styles.muted}>
                        Za prodaju i validaciju karata morate otvoriti smjenu.
                    </Text>
                    <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={handleOpen} disabled={busy}>
                        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Otvori smjenu</Text>}
                    </TouchableOpacity>
                </View>
            )}

            {shifts.recent?.length > 0 && (
                <View style={[styles.card, { marginTop: 12 }]}>
                    <Text style={styles.cardTitle}>Zadnje smjene</Text>
                    {shifts.recent.slice(0, 10).map((s) => (
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
                        </View>
                    ))}
                </View>
            )}
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
                    (preview?.finance || []).map((row) => {
                        const a = actuals[row.payment_type_uuid] || {};
                        const diff = a.actual_amount !== undefined && a.actual_amount !== ''
                            ? Number(a.actual_amount) - row.payment_amount
                            : null;
                        return (
                            <View key={row.payment_type_uuid} style={styles.payRow}>
                                <View style={styles.payHead}>
                                    <Text style={styles.payName}>{row.payment_type_name}</Text>
                                    <Text style={styles.payCount}>{row.count} račun(a)</Text>
                                </View>
                                <Row label="Očekivano" value={fmtEUR(row.payment_amount)} />
                                <View style={styles.inputRow}>
                                    <Text style={styles.inputLabel}>Stvarno</Text>
                                    <TextInput
                                        style={styles.input}
                                        keyboardType="numeric"
                                        placeholder="0.00"
                                        placeholderTextColor="#64748b"
                                        value={a.actual_amount ?? ''}
                                        onChangeText={(t) =>
                                            setActuals((prev) => ({
                                                ...prev,
                                                [row.payment_type_uuid]: { ...prev[row.payment_type_uuid], actual_amount: t },
                                            }))
                                        }
                                    />
                                </View>
                                {diff !== null && (
                                    <Text style={[styles.diff, { color: diff === 0 ? '#22c55e' : diff > 0 ? '#fbbf24' : '#ef4444' }]}>
                                        {diff > 0 ? `Višak ${fmtEUR(diff)}` : diff < 0 ? `Manjak ${fmtEUR(-diff)}` : 'Slaže se'}
                                    </Text>
                                )}
                            </View>
                        );
                    })
                )}
            </View>

            <View style={[styles.card, { marginTop: 12 }]}>
                <Text style={styles.cardTitle}>Napomena</Text>
                <TextInput
                    style={[styles.input, { width: '100%' }]}
                    multiline
                    numberOfLines={3}
                    placeholder="Komentar smjene (opcionalno)"
                    placeholderTextColor="#64748b"
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
                    <Text style={styles.btnText}>Natrag</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.btn, styles.btnDanger, { flex: 1 }]}
                    onPress={handleCloseConfirm}
                    disabled={busy}
                >
                    {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Zaključi smjenu</Text>}
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
                <Text style={styles.title}>{view === 'close' ? 'Zatvaranje smjene' : 'Smjene'}</Text>
                <View style={{ width: 80 }} />
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
    wrap: { flex: 1, backgroundColor: '#0f172a' },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 8, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1e293b',
    },
    backBtn: { paddingVertical: 6, paddingHorizontal: 10, minWidth: 80 },
    backText: { color: '#38bdf8', fontSize: 16, fontWeight: '600' },
    title: { fontSize: 18, fontWeight: '700', color: '#fff' },
    card: { backgroundColor: '#1e293b', borderRadius: 12, padding: 16 },
    cardTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 12 },
    row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
    rowLabel: { color: '#94a3b8', fontSize: 14 },
    rowValue: { color: '#e2e8f0', fontSize: 14, fontWeight: '600' },
    rowValueBold: { color: '#fff', fontSize: 16, fontWeight: '800' },
    divider: { height: 1, backgroundColor: '#334155', marginVertical: 8 },
    muted: { color: '#94a3b8', fontSize: 13, marginBottom: 12 },
    btn: { paddingVertical: 14, borderRadius: 8, alignItems: 'center', marginTop: 12 },
    btnPrimary: { backgroundColor: '#7c3aed' },
    btnDanger: { backgroundColor: '#dc2626' },
    btnSecondary: { backgroundColor: '#475569' },
    btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    pendingTag: { color: '#fbbf24', fontSize: 12, marginTop: 6, fontWeight: '600' },
    recentRow: {
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#334155',
    },
    recentTime: { color: '#e2e8f0', fontSize: 13, fontWeight: '600' },
    recentSub: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
    payRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#334155' },
    payHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    payName: { color: '#fff', fontSize: 14, fontWeight: '600' },
    payCount: { color: '#94a3b8', fontSize: 12 },
    inputRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
    inputLabel: { color: '#94a3b8', fontSize: 14, width: 90 },
    input: {
        backgroundColor: '#0f172a', color: '#fff', paddingHorizontal: 10, paddingVertical: 8,
        borderRadius: 6, borderWidth: 1, borderColor: '#334155', flex: 1, fontSize: 14,
    },
    diff: { fontSize: 12, marginTop: 4, fontWeight: '600' },
});
