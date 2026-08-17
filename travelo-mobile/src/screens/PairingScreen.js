import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { allowAutoPair, authData, autoPairThunk, clearError, pairTerminalThunk } from '../store/slices/authSlice';
import { syncBasicDataThunk } from '../store/slices/syncSlice';
import { DEFAULT_GATEWAY_URL } from '../api/config';
import { storage } from '../api/client';
import { colors, shadows } from '../theme/colors';

export default function PairingScreen() {
    const dispatch = useDispatch();
    const auth = useSelector(authData);
    const [gateway, setGateway] = useState(auth.gateway || DEFAULT_GATEWAY_URL);
    // TID zna doći iz zero-touch provjere: SN je prepoznat, ali uređaj nije
    // označen za automatsko uparivanje pa se traži samo OTP.
    const [tid, setTid] = useState(auth.suggestedTid || '');
    const [otp, setOtp] = useState('');

    useEffect(() => {
        if (auth.suggestedTid) setTid((prev) => prev || auth.suggestedTid);
    }, [auth.suggestedTid]);

    useEffect(() => {
        if (auth.error) {
            Alert.alert('Pairing', auth.error, [
                { text: 'OK', onPress: () => dispatch(clearError()) },
            ]);
        }
    }, [auth.error, dispatch]);

    // Ručno pokretanje zero-touch provjere — koristi se kad se serijski broj
    // uređaja u međuvremenu upiše ili ispravi u portalu.
    const onRetryAuto = async () => {
        // Prvo spremi upisani poslužitelj, inače provjera ide na stari.
        if (gateway) await storage.setGateway(gateway);
        dispatch(allowAutoPair());
        const res = await dispatch(autoPairThunk());
        if (res.payload?.mode !== 'auto') {
            Alert.alert('Uparivanje', 'Uređaj nije označen za automatsko uparivanje. Upišite TID i OTP.');
        }
    };

    const onSubmit = async () => {
        if (!tid || !otp) return;
        const res = await dispatch(pairTerminalThunk({ tid, otp, gatewayUrl: gateway }));
        if (res.meta.requestStatus === 'fulfilled') {
            // Pull master data right after successful pairing.
            await dispatch(syncBasicDataThunk());
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.wrap}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
                <Text style={styles.logo}>Travelo Mobile</Text>
                <Text style={[styles.subtitle, !auth.serial && styles.subtitleAlone]}>Uparivanje uređaja</Text>
                {!!auth.serial && (
                    <Text style={styles.serial}>Serijski broj: {auth.serial}</Text>
                )}

                <View style={styles.form}>
                    <Text style={styles.label}>Poslužitelj</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="http://192.168.0.100:5100"
                        value={gateway}
                        onChangeText={setGateway}
                        autoCapitalize="none"
                        autoCorrect={false}
                    />

                    <Text style={styles.label}>TID</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Terminal ID"
                        value={tid}
                        onChangeText={setTid}
                        autoCapitalize="characters"
                        autoCorrect={false}
                    />

                    <Text style={styles.label}>OTP</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Jednokratni kod"
                        value={otp}
                        onChangeText={setOtp}
                        autoCapitalize="none"
                        secureTextEntry
                    />

                    <TouchableOpacity
                        style={[styles.btn, (!tid || !otp || auth.pairing) && styles.btnDisabled]}
                        onPress={onSubmit}
                        disabled={!tid || !otp || auth.pairing}
                    >
                        {auth.pairing ? (
                            <ActivityIndicator color={colors.textOnPrimary} />
                        ) : (
                            <Text style={styles.btnText}>Upari uređaj</Text>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.btnGhost, auth.autoPairing && styles.btnDisabled]}
                        onPress={onRetryAuto}
                        disabled={auth.autoPairing}
                    >
                        {auth.autoPairing ? (
                            <ActivityIndicator color={colors.primary} />
                        ) : (
                            <Text style={styles.btnGhostText}>Pokušaj automatsko uparivanje</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    wrap: { flex: 1, backgroundColor: colors.bg },
    scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
    logo: { fontSize: 32, fontWeight: '800', color: colors.primary, textAlign: 'center' },
    subtitle: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', marginTop: 4, marginBottom: 8 },
    subtitleAlone: { marginBottom: 32 },
    serial: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginBottom: 24 },
    form: {
        backgroundColor: colors.surface, padding: 20, borderRadius: 12,
        borderWidth: 1, borderColor: colors.border,
        ...shadows.card,
    },
    label: { color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 12 },
    input: {
        backgroundColor: colors.surface,
        color: colors.textPrimary,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 8,
        fontSize: 16,
        borderWidth: 1,
        borderColor: colors.border,
    },
    btn: {
        marginTop: 24,
        backgroundColor: colors.primary,
        paddingVertical: 16,
        borderRadius: 8,
        alignItems: 'center',
    },
    btnGhost: {
        marginTop: 12,
        paddingVertical: 14,
        borderRadius: 8,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },
    btnGhostText: { color: colors.primary, fontWeight: '600', fontSize: 15 },
    btnDisabled: { opacity: 0.5 },
    btnText: { color: colors.textOnPrimary, fontWeight: '700', fontSize: 16 },
});
