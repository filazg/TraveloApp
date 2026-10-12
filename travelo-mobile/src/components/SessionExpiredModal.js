import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { colors } from '../theme/colors';
import { authData, reauthWithOtpThunk } from '../store/slices/authSlice';

// Kredencijali uređaja su istekli (poslužitelj odbija token, a obnova nije
// uspjela). Umjesto pada na uparivanje — gdje bi se upisivao i TID, pa bi s
// krivim TID-om uređaj dobio tuđi token — ovdje se upisuje samo novi OTP za
// isti TID. "Kasnije" pušta rad dalje lokalno; traka na vrhu vraća prozor.
export default function SessionExpiredModal({ onRestored }) {
    const dispatch = useDispatch();
    const auth = useSelector(authData);
    const [otvoren, setOtvoren] = useState(false);
    const [otp, setOtp] = useState('');

    // Svaki novi istek ponovno otvara prozor.
    useEffect(() => { if (auth.sessionExpired) setOtvoren(true); }, [auth.sessionExpired]);

    if (!auth.sessionExpired) return null;

    const potvrdi = async () => {
        const res = await dispatch(reauthWithOtpThunk({ otp }));
        if (!res.error) {
            setOtp('');
            setOtvoren(false);
            onRestored?.();
        }
    };

    return (
        <>
            {!otvoren && (
                <TouchableOpacity style={styles.traka} onPress={() => setOtvoren(true)}>
                    <Text style={styles.trakaText}>Uređaj nije spojen — dodirni i unesi OTP</Text>
                </TouchableOpacity>
            )}
            <Modal visible={otvoren} transparent animationType="fade" onRequestClose={() => setOtvoren(false)}>
                <View style={styles.backdrop}>
                    <View style={styles.card}>
                        <Text style={styles.title}>Kredencijali uređaja su istekli</Text>
                        <Text style={styles.sub}>
                            Za nastavak rada s poslužiteljem unesite novi OTP za ovaj uređaj. Podaci na uređaju ostaju
                            sačuvani; neposlane prodaje i smjene šalju se čim se uređaj ponovno spoji.
                        </Text>
                        <Text style={styles.label}>TID</Text>
                        <View style={[styles.input, styles.inputRo]}>
                            <Text style={styles.roText}>{auth.tid || '—'}</Text>
                        </View>
                        <Text style={styles.label}>OTP</Text>
                        <TextInput
                            style={styles.input}
                            value={otp}
                            onChangeText={setOtp}
                            autoFocus
                            autoCapitalize="none"
                            autoCorrect={false}
                            editable={!auth.reauthing}
                            onSubmitEditing={potvrdi}
                            placeholder="OTP"
                            placeholderTextColor={colors.textMuted}
                        />
                        {!!auth.reauthError && <Text style={styles.error}>{auth.reauthError}</Text>}
                        <View style={styles.actions}>
                            <TouchableOpacity style={styles.ghost} disabled={auth.reauthing} onPress={() => setOtvoren(false)}>
                                <Text style={styles.ghostText}>Kasnije</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.primary, auth.reauthing && styles.off]} disabled={auth.reauthing} onPress={potvrdi}>
                                {auth.reauthing
                                    ? <ActivityIndicator color={colors.textOnPrimary} />
                                    : <Text style={styles.primaryText}>Potvrdi</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    traka: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50, backgroundColor: colors.warning, paddingVertical: 8, paddingHorizontal: 12 },
    trakaText: { color: colors.textOnPrimary, fontWeight: '800', textAlign: 'center' },
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
    card: { backgroundColor: colors.surface, borderRadius: 16, padding: 18 },
    title: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
    sub: { fontSize: 13, color: colors.textSecondary, marginTop: 6, marginBottom: 8 },
    label: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginTop: 10, marginBottom: 4 },
    input: { borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 10, paddingHorizontal: 12, height: 48, fontSize: 17, color: colors.textPrimary, backgroundColor: colors.surface },
    inputRo: { justifyContent: 'center', backgroundColor: colors.surfaceAlt, borderColor: colors.border },
    roText: { fontSize: 17, fontWeight: '700', color: colors.textSecondary },
    error: { color: colors.error, marginTop: 10, fontWeight: '600' },
    actions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 18, gap: 10 },
    ghost: { paddingHorizontal: 16, height: 46, justifyContent: 'center', borderRadius: 10 },
    ghostText: { color: colors.primary, fontWeight: '800', fontSize: 15 },
    primary: { paddingHorizontal: 22, height: 46, justifyContent: 'center', borderRadius: 10, backgroundColor: colors.primary, minWidth: 110, alignItems: 'center' },
    primaryText: { color: colors.textOnPrimary, fontWeight: '800', fontSize: 15 },
    off: { opacity: 0.6 },
});
