import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    NativeModules,
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
import { authData, setOperator } from '../store/slices/authSlice';
import { syncBasicDataThunk, syncData } from '../store/slices/syncSlice';
import { colors, shadows } from '../theme/colors';
import pkg from '../../package.json';
import BrandMark from '../components/BrandMark';

// Native bcrypt verifier (Kotlin jbcrypt) — ~50-100ms umjesto 0.5-1.5s za pure-JS bcryptjs.
// Fallback na bcryptjs ako native modul nije dostupan (npr. starije instalacije bez rebuildanog APK-a).
const { AppAuth } = NativeModules;

const verifyPassword = async (plain, stored) => {
    if (!stored) return false;
    const s = String(stored);
    const isBcrypt = s.startsWith('$2a$') || s.startsWith('$2b$') || s.startsWith('$2y$');
    if (!isBcrypt) return plain === s;
    if (AppAuth?.checkpw) {
        try { return await AppAuth.checkpw(plain, s); } catch { /* fallback na JS */ }
    }
    try { return bcrypt.compareSync(plain, s); } catch { return false; }
};

export default function OperatorLoginScreen() {
    const dispatch = useDispatch();
    const auth = useSelector(authData);
    const sync = useSelector(syncData);
    const [mode, setMode] = useState('username'); // 'username' | 'code'
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [code, setCode] = useState('');
    const [loggingIn, setLoggingIn] = useState(false);

    const onLogin = async () => {
        if (loggingIn) return;
        if (!sync.users?.length) {
            Alert.alert('Prijava', 'Nema sinkroniziranih operatera.');
            return;
        }
        setLoggingIn(true);
        try {
            // Prijava šifrom — brža na terminalu, šifra se u portalu drži
            // jedinstvenom pa jedna vrijednost određuje točno jednog operatera.
            if (mode === 'code') {
                const c = String(code || '').trim();
                const user = sync.users.find((x) => String(x.user_code ?? '').trim() === c && c !== '');
                if (!user) {
                    Alert.alert('Prijava', 'Neispravna šifra.');
                    return;
                }
                dispatch(setOperator(user));
                setCode('');
                return;
            }

            const u = String(username || '').trim().toLowerCase();
            const user = sync.users.find((x) => String(x.user_username || '').trim().toLowerCase() === u);
            if (!user) {
                Alert.alert('Prijava', 'Pogrešno korisničko ime ili lozinka.');
                return;
            }
            const ok = await verifyPassword(password, user.user_password);
            if (!ok) {
                Alert.alert('Prijava', 'Pogrešno korisničko ime ili lozinka.');
                return;
            }
            dispatch(setOperator(user));
        } finally {
            setLoggingIn(false);
        }
    };

    const canLogin = !loggingIn && (mode === 'code' ? !!code.trim() : !!username && !!password);

    // Odjava operatera je prirodan trenutak za osvježavanje: sljedeći operater
    // treba važeće šifre i dozvole. Tiho — ako nema veze, radi se sa spremljenom
    // kopijom.
    const mountRefreshRef = useRef(false);
    useEffect(() => {
        if (mountRefreshRef.current || sync.loading) return;
        mountRefreshRef.current = true;
        dispatch(syncBasicDataThunk());
    }, [dispatch, sync.loading]);

    const onRefresh = async () => {
        if (sync.loading) return;
        const res = await dispatch(syncBasicDataThunk());
        // Ručno osvježavanje je do sada tiho padalo, pa je izgledalo kao da su
        // podaci povučeni iako uređaj nije ni došao do poslužitelja.
        if (res.meta.requestStatus !== 'fulfilled') {
            Alert.alert(
                'Osvježavanje',
                'Podaci nisu osvježeni — nema veze s poslužiteljem. Radi se sa zadnjim spremljenim podacima.',
            );
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.wrap}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
                {/* onPrimary jer podloga nije svijetla: "Travelo" svijetloplavo,
                    "APP" bijelo — ista kombinacija kao na plavoj podlozi. */}
                <BrandMark style={styles.logo} onPrimary />

                <View style={styles.form}>
                    <View style={styles.modeRow}>
                        <TouchableOpacity
                            style={[styles.modeBtn, mode === 'username' && styles.modeBtnActive]}
                            onPress={() => setMode('username')}
                        >
                            <Text style={[styles.modeText, mode === 'username' && styles.modeTextActive]}>
                                Korisničko ime
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.modeBtn, mode === 'code' && styles.modeBtnActive]}
                            onPress={() => setMode('code')}
                        >
                            <Text style={[styles.modeText, mode === 'code' && styles.modeTextActive]}>
                                Šifra
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {mode === 'username' ? (
                        <>
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
                        </>
                    ) : (
                        <>
                            <Text style={styles.label}>Šifra</Text>
                            <TextInput
                                style={styles.input}
                                value={code}
                                onChangeText={setCode}
                                keyboardType="number-pad"
                                secureTextEntry
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                        </>
                    )}

                    <TouchableOpacity
                        style={[styles.btn, !canLogin && styles.btnDisabled]}
                        onPress={onLogin}
                        disabled={!canLogin}
                    >
                        {loggingIn ? (
                            <ActivityIndicator color={colors.textOnPrimary} />
                        ) : (
                            <Text style={styles.btnText}>Prijava</Text>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.btnLink, sync.loading && styles.btnDisabled]}
                        onPress={onRefresh}
                        disabled={sync.loading}
                    >
                        {sync.loading ? (
                            <View style={styles.btnLinkRow}>
                                <ActivityIndicator color={colors.textSecondary} size="small" />
                                <Text style={[styles.btnLinkText, { marginLeft: 8 }]}>Osvježavanje…</Text>
                            </View>
                        ) : (
                            <Text style={styles.btnLinkText}>Osvježi podatke</Text>
                        )}
                    </TouchableOpacity>
                </View>

                {!sync.users.length && (
                    <Text style={styles.warn}>
                        Nema operatera. Provjeri sync podataka (Osvježi podatke).
                    </Text>
                )}

                <View style={styles.deviceInfo}>
                    <Text style={styles.infoLine}>
                        <Text style={styles.infoLabel}>PP/NU: </Text>
                        {(sync.basicData?.business_premise_name || '—')}
                        {sync.basicData?.billing_device_name ? ` / ${sync.basicData.billing_device_name}` : ''}
                        {sync.basicData?.billing_device_fiscal_mark ? `  ·  ${sync.basicData.billing_device_fiscal_mark}` : ''}
                    </Text>
                    <Text style={styles.infoLine}>
                        <Text style={styles.infoLabel}>TID: </Text>
                        {auth.tid || '—'}
                    </Text>
                    <Text style={styles.infoLine}>
                        <Text style={styles.infoLabel}>ver: </Text>
                        {pkg.version}
                    </Text>
                </View>

                <Text style={styles.poweredBy}>powered by Tech4beeZ</Text>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    wrap: { flex: 1, backgroundColor: colors.primary },
    scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
    // Boju ne postavljamo ovdje — BrandMark sam boja "Travelo" i "APP".
    // 48 je gornja granica koja na Sunmi V2s (360 dp sirine, 24 dp padding)
    // jos stane u jedan redak.
    logo: { fontSize: 48, fontWeight: '800', textAlign: 'center', marginBottom: 32 },
    deviceInfo: { marginTop: 24, alignItems: 'center' },
    // Tekst izvan kartice stoji na plavoj podlozi pa ide na bijele neutrale.
    infoLine: { fontSize: 12, color: colors.textOnPrimaryMuted, textAlign: 'center', marginTop: 2 },
    infoLabel: { fontWeight: '700', color: colors.textOnPrimary },
    poweredBy: { fontSize: 14, fontWeight: '700', color: colors.textOnPrimaryMuted, textAlign: 'center', marginTop: 56, fontStyle: 'italic' },
    form: {
        backgroundColor: colors.surface, padding: 20, borderRadius: 12,
        borderWidth: 1, borderColor: colors.border,
        ...shadows.card,
    },
    label: { color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 12 },
    modeRow: { flexDirection: 'row', borderWidth: 1, borderColor: colors.border, borderRadius: 8, overflow: 'hidden' },
    modeBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', backgroundColor: colors.surface },
    modeBtnActive: { backgroundColor: colors.primary },
    modeText: { color: colors.textSecondary, fontWeight: '600', fontSize: 14 },
    modeTextActive: { color: colors.textOnPrimary },
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
    btnLink: { alignItems: 'center', paddingVertical: 12, marginTop: 4 },
    btnLinkRow: { flexDirection: 'row', alignItems: 'center' },
    btnLinkText: { color: colors.textSecondary, fontSize: 14 },
    danger: { color: colors.error },
    warn: { color: colors.warning, textAlign: 'center', marginTop: 16, fontSize: 13 },
});
