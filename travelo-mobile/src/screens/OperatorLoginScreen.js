import React, { useState } from 'react';
import {
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
import bcrypt from 'bcryptjs';
import { authData, setOperator, unpairTerminalThunk } from '../store/slices/authSlice';
import { syncBasicDataThunk, syncData } from '../store/slices/syncSlice';

// Checks plain password against stored hash. Supports bcrypt ($2a/$2b) and
// falls back to plain-string match for legacy unhashed passwords.
const verifyPassword = (plain, stored) => {
    if (!stored) return false;
    const s = String(stored);
    if (s.startsWith('$2a$') || s.startsWith('$2b$') || s.startsWith('$2y$')) {
        try { return bcrypt.compareSync(plain, s); } catch { return false; }
    }
    return plain === s;
};

export default function OperatorLoginScreen() {
    const dispatch = useDispatch();
    const auth = useSelector(authData);
    const sync = useSelector(syncData);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    const onLogin = () => {
        // TEMP: auth disabled for development — log in as first sync'd operator.
        const user = sync.users[0];
        if (!user) {
            Alert.alert('Prijava', 'Nema sinkroniziranih operatera.');
            return;
        }
        dispatch(setOperator(user));
    };

    const onRefresh = async () => {
        await dispatch(syncBasicDataThunk());
    };

    const onUnpair = () => {
        Alert.alert('Odspajanje', 'Uređaj će biti odspojen. Nastavi?', [
            { text: 'Odustani', style: 'cancel' },
            { text: 'Odspoji', style: 'destructive', onPress: () => dispatch(unpairTerminalThunk()) },
        ]);
    };

    return (
        <KeyboardAvoidingView
            style={styles.wrap}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
                <Text style={styles.logo}>Travelo</Text>
                <Text style={styles.subtitle}>{sync.basicData?.business_premise_name || '—'}</Text>
                <Text style={styles.device}>
                    {sync.basicData?.billing_device_name}
                    {sync.basicData?.billing_device_fiscal_mark ? ` · ${sync.basicData.billing_device_fiscal_mark}` : ''}
                </Text>

                <View style={styles.form}>
                    <Text style={styles.label}>Korisničko ime</Text>
                    <TextInput
                        style={styles.input}
                        value={username}
                        onChangeText={setUsername}
                        autoCapitalize="none"
                        autoCorrect={false}
                    />

                    <Text style={styles.label}>Lozinka</Text>
                    <TextInput
                        style={styles.input}
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                        autoCapitalize="none"
                    />

                    <TouchableOpacity
                        style={[styles.btn, (!username || !password) && styles.btnDisabled]}
                        onPress={onLogin}
                        disabled={!username || !password}
                    >
                        <Text style={styles.btnText}>Prijava</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.btnLink} onPress={onRefresh}>
                        <Text style={styles.btnLinkText}>Osvježi podatke</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.btnLink} onPress={onUnpair}>
                        <Text style={[styles.btnLinkText, styles.danger]}>Odspoji uređaj</Text>
                    </TouchableOpacity>
                </View>

                {!sync.users.length && (
                    <Text style={styles.warn}>
                        Nema operatera. Provjeri sync podataka (Osvježi podatke).
                    </Text>
                )}
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    wrap: { flex: 1, backgroundColor: '#0f172a' },
    scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
    logo: { fontSize: 36, fontWeight: '800', color: '#fff', textAlign: 'center' },
    subtitle: { fontSize: 16, color: '#cbd5e1', textAlign: 'center', marginTop: 8 },
    device: { fontSize: 12, color: '#64748b', textAlign: 'center', marginBottom: 32 },
    form: { backgroundColor: '#1e293b', padding: 20, borderRadius: 12 },
    label: { color: '#cbd5e1', fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 12 },
    input: {
        backgroundColor: '#0f172a',
        color: '#fff',
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 8,
        fontSize: 16,
        borderWidth: 1,
        borderColor: '#334155',
    },
    btn: {
        marginTop: 24,
        backgroundColor: '#10b981',
        paddingVertical: 16,
        borderRadius: 8,
        alignItems: 'center',
    },
    btnDisabled: { backgroundColor: '#475569' },
    btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
    btnLink: { alignItems: 'center', paddingVertical: 12, marginTop: 4 },
    btnLinkText: { color: '#94a3b8', fontSize: 14 },
    danger: { color: '#f87171' },
    warn: { color: '#fbbf24', textAlign: 'center', marginTop: 16, fontSize: 13 },
});
