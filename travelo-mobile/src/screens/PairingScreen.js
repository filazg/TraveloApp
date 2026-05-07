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
import { authData, clearError, pairTerminalThunk } from '../store/slices/authSlice';
import { syncBasicDataThunk } from '../store/slices/syncSlice';
import { DEFAULT_GATEWAY_URL } from '../api/config';
import { colors, shadows } from '../theme/colors';

export default function PairingScreen() {
    const dispatch = useDispatch();
    const auth = useSelector(authData);
    const [gateway, setGateway] = useState(auth.gateway || DEFAULT_GATEWAY_URL);
    const [tid, setTid] = useState('');
    const [otp, setOtp] = useState('');

    useEffect(() => {
        if (auth.error) {
            Alert.alert('Pairing', auth.error, [
                { text: 'OK', onPress: () => dispatch(clearError()) },
            ]);
        }
    }, [auth.error, dispatch]);

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
                <Text style={styles.subtitle}>Uparivanje uređaja</Text>

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
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    wrap: { flex: 1, backgroundColor: colors.bg },
    scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
    logo: { fontSize: 32, fontWeight: '800', color: colors.primary, textAlign: 'center' },
    subtitle: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', marginTop: 4, marginBottom: 32 },
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
    btnDisabled: { opacity: 0.5 },
    btnText: { color: colors.textOnPrimary, fontWeight: '700', fontSize: 16 },
});
