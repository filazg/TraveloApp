import { useState } from 'react';
import {
    Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, Switch,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { authData, unpairTerminalThunk } from '../store/slices/authSlice';
import { syncPendingSalesThunk } from '../store/slices/salesSlice';
import { syncPendingShiftsThunk } from '../store/slices/shiftsSlice';
import { syncPendingValidationsThunk } from '../store/slices/validationSlice';
import { storage } from '../api/client';
import { getDeviceSerialNumber } from '../device/printer';
import { ucitajSlobodnoStorniranje, spremiSlobodnoStorniranje, ROK_NAKON_POLASKA_MIN } from '../services/stornoRok';
import { colors } from '../theme/colors';

// Servisni izbornik za podršku — isti pristupni kod kao na desku: mijenja se
// svaki sat i zna ga samo podrška, pa je ovo brana, ne prijava. Formula mora
// biti identična desku da isti kod otključava oba.
const isoDow = (d = new Date()) => { const x = d.getDay(); return x === 0 ? 7 : x; };
const ocekivaniKod = (d = new Date()) => (d.getHours() + d.getDate() + isoDow(d)) * (d.getMonth() + 1);

export default function ServiceMenu({ visible, onClose }) {
    const dispatch = useDispatch();
    const auth = useSelector(authData);
    const [otkljucano, setOtkljucano] = useState(false);
    const [kod, setKod] = useState('');
    const [greska, setGreska] = useState(false);
    const [info, setInfo] = useState({ serial: null, tid: null, gateway: null });
    const [radi, setRadi] = useState(false);
    const [slobodnoStorniranje, setSlobodnoStorniranje] = useState(false);

    const zatvori = () => {
        setOtkljucano(false); setKod(''); setGreska(false); setRadi(false);
        onClose();
    };

    const otkljucaj = async () => {
        if (Number(kod) !== ocekivaniKod()) { setGreska(true); setKod(''); return; }
        setGreska(false);
        setOtkljucano(true);
        setSlobodnoStorniranje(await ucitajSlobodnoStorniranje());
        // Info se dohvaća tek nakon otključavanja — serijski i gateway mogu biti
        // iz auth stanja ili iz lokalne baze ako auth još nema.
        try {
            const serial = auth.serial || await getDeviceSerialNumber();
            const gateway = await storage.getGateway();
            const tid = auth.tid || await storage.getTid();
            setInfo({ serial, tid, gateway });
        } catch (e) {
            setInfo({ serial: auth.serial, tid: auth.tid, gateway: null });
        }
    };

    const posaljiNespremljeno = async () => {
        setRadi(true);
        try {
            await Promise.allSettled([
                dispatch(syncPendingSalesThunk()),
                dispatch(syncPendingShiftsThunk()),
                dispatch(syncPendingValidationsThunk()),
            ]);
            Alert.alert('Servis', 'Slanje nespremljenih dokumenata je pokrenuto.');
        } finally {
            setRadi(false);
        }
    };

    // Sprema se odmah, bez zasebnog gumba — izbornik nema spremanje, a
    // prekidač koji se vrati na staro kad se izbornik zatvori bi zavaravao.
    const promijeniSlobodnoStorniranje = async (ukljuceno) => {
        setSlobodnoStorniranje(ukljuceno);
        await spremiSlobodnoStorniranje(ukljuceno);
    };

    const ukloniUparivanje = () => {
        Alert.alert(
            'Ukloni uparivanje',
            'Uređaj će se odspojiti i tražiti ponovno uparivanje. Lokalni podaci (prodaje) ostaju. Nastaviti?',
            [
                { text: 'Odustani', style: 'cancel' },
                {
                    text: 'Ukloni', style: 'destructive', onPress: async () => {
                        await dispatch(unpairTerminalThunk());
                        // token je sad null → aplikacija sama prelazi na ekran uparivanja
                        zatvori();
                    },
                },
            ],
        );
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={zatvori}>
            <View style={styles.overlay}>
                <View style={styles.card}>
                    {!otkljucano ? (
                        <View>
                            <Text style={styles.title}>Servisni izbornik</Text>
                            <Text style={styles.sub}>Zaključano — unesi pristupni kod koji ti daje podrška.</Text>
                            <TextInput
                                style={[styles.input, greska && styles.inputError]}
                                value={kod}
                                onChangeText={(t) => { setKod(t.replace(/\D/g, '')); setGreska(false); }}
                                keyboardType="number-pad"
                                secureTextEntry
                                autoFocus
                                placeholder="Kod"
                                placeholderTextColor={colors.textMuted}
                            />
                            {greska ? <Text style={styles.err}>Kod nije točan — zatraži novi od podrške.</Text> : null}
                            <View style={styles.row}>
                                <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={zatvori}>
                                    <Text style={styles.btnGhostText}>Odustani</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.btn, !kod && styles.btnDisabled]} disabled={!kod} onPress={otkljucaj}>
                                    <Text style={styles.btnText}>Otključaj</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : (
                        <ScrollView>
                            <Text style={styles.title}>Servisni izbornik</Text>
                            <View style={styles.infoBox}>
                                <InfoRow k="Serijski broj" v={info.serial || '—'} />
                                <InfoRow k="TID" v={info.tid || '—'} />
                                <InfoRow k="Gateway" v={info.gateway || '—'} />
                            </View>

                            <View style={styles.prekidacRed}>
                                <View style={{ flex: 1, marginRight: 12 }}>
                                    <Text style={styles.prekidacNaziv}>Slobodno storniranje</Text>
                                    <Text style={styles.prekidacOpis}>
                                        {slobodnoStorniranje
                                            ? 'Storno nije vezan uz vrijeme polaska.'
                                            : `Storno je moguć do ${ROK_NAKON_POLASKA_MIN} min nakon polaska.`}
                                    </Text>
                                </View>
                                <Switch value={slobodnoStorniranje} onValueChange={promijeniSlobodnoStorniranje} />
                            </View>

                            <TouchableOpacity style={[styles.action, radi && styles.btnDisabled]} disabled={radi} onPress={posaljiNespremljeno}>
                                {radi ? <ActivityIndicator color={colors.textOnPrimary} /> : <Text style={styles.actionText}>Pošalji nespremljeno</Text>}
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.action, styles.actionDanger]} onPress={ukloniUparivanje}>
                                <Text style={styles.actionText}>Ukloni uparivanje</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={[styles.btn, styles.btnGhost, { marginTop: 10 }]} onPress={zatvori}>
                                <Text style={styles.btnGhostText}>Zatvori</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    )}
                </View>
            </View>
        </Modal>
    );
}

function InfoRow({ k, v }) {
    return (
        <View style={styles.infoRow}>
            <Text style={styles.infoK}>{k}</Text>
            <Text style={styles.infoV} numberOfLines={1}>{v}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', paddingHorizontal: 24 },
    card: { backgroundColor: colors.surface, borderRadius: 16, padding: 20, maxHeight: '85%' },
    title: { fontSize: 20, fontWeight: '800', color: colors.textPrimary, marginBottom: 4 },
    sub: { fontSize: 13, color: colors.textSecondary, marginBottom: 16 },
    input: {
        borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14,
        fontSize: 22, letterSpacing: 6, textAlign: 'center', color: colors.textPrimary, backgroundColor: colors.surfaceAlt,
    },
    inputError: { borderColor: colors.error },
    err: { color: colors.error, fontSize: 12, marginTop: 8 },
    row: { flexDirection: 'row', gap: 12, marginTop: 16 },
    btn: { flex: 1, height: 50, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    btnText: { color: colors.textOnPrimary, fontWeight: '800', fontSize: 15 },
    btnGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
    btnGhostText: { color: colors.textPrimary, fontWeight: '700', fontSize: 15 },
    btnDisabled: { opacity: 0.5 },
    infoBox: { backgroundColor: colors.surfaceAlt, borderRadius: 10, padding: 12, marginVertical: 14 },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
    infoK: { color: colors.textSecondary, fontSize: 13 },
    infoV: { color: colors.textPrimary, fontSize: 13, fontWeight: '700', maxWidth: '62%' },
    action: { height: 56, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
    actionDanger: { backgroundColor: colors.error },
    prekidacRed: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
    prekidacNaziv: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
    prekidacOpis: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
    actionText: { color: colors.textOnPrimary, fontWeight: '800', fontSize: 15 },
});
