import React from 'react';
import { Alert, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { authData, logoutOperator } from '../store/slices/authSlice';
import { syncData } from '../store/slices/syncSlice';
import { setSection } from '../store/slices/navSlice';
import { shiftsData } from '../store/slices/shiftsSlice';
import { colors, shadows, layout } from '../theme/colors';
import BrandMark from '../components/BrandMark';

export default function MainMenuScreen() {
    const dispatch = useDispatch();
    const auth = useSelector(authData);
    const sync = useSelector(syncData);
    const shifts = useSelector(shiftsData);

    // Partnersko prodajno mjesto ne plovi — ondje se karta prodaje na pultu, pa
    // izbornik govori o prodaji. Ako uredaj uz to ne validira, ni podnaslov ne
    // spominje validaciju.
    const partnerskoMjesto = sync.basicData?.business_premise_own === 'PARTNER_BP';
    const smijeValidirati = sync.basicData?.billing_device_can_validate !== false;
    const naslovProdaje = partnerskoMjesto ? 'Prodaja' : 'Plovidba';
    const podnaslovProdaje = smijeValidirati ? 'Prodaja i validacija karata' : 'Prodaja karata';
    const hasOpenShift = !!shifts.currentOpen?.shift_uuid;

    const onVoyagePress = () => {
        if (!hasOpenShift) {
            Alert.alert(
                'Smjena nije otvorena',
                'Prije prodaje ili validacije karata morate otvoriti smjenu.',
                [
                    { text: 'Odustani', style: 'cancel' },
                    { text: 'Otvori smjenu', onPress: () => dispatch(setSection('shifts')) },
                ]
            );
            return;
        }
        dispatch(setSection('voyage'));
    };

    return (
        <SafeAreaView style={styles.wrap}>
            {/* Brand header — primary plava preko cijele širine */}
            <View style={styles.header}>
                <View style={{ flex: 1 }}>
                    <BrandMark style={styles.title} onPrimary />
                    <Text style={styles.subtitle}>
                        {sync.basicData?.business_premise_name} · {sync.basicData?.billing_device_name}
                    </Text>
                </View>
                <TouchableOpacity style={styles.logoutBtn} onPress={() => dispatch(logoutOperator())}>
                    <Text style={styles.logoutText}>Odjava</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.content}>
                {/* Operator card */}
                <View style={styles.opCard}>
                    <Text style={styles.opName}>
                        {auth.operator?.user_name} {auth.operator?.user_surname}
                    </Text>

                    <View style={[styles.shiftBadge, hasOpenShift ? styles.shiftBadgeOpen : styles.shiftBadgeClosed]}>
                        <View style={[styles.shiftDot, { backgroundColor: hasOpenShift ? colors.success : colors.textMuted }]} />
                        <Text style={[styles.shiftBadgeText, { color: hasOpenShift ? colors.success : colors.textSecondary }]}>
                            {hasOpenShift ? 'Smjena otvorena' : 'Smjena nije otvorena'}
                        </Text>
                    </View>
                </View>

                {/* Akcijski tiles */}
                <View style={styles.tilesGrid}>
                    {/* Plovidba — primary CTA */}
                    <TouchableOpacity
                        style={[styles.tile, styles.tilePrimary, !hasOpenShift && styles.tileDisabled]}
                        onPress={onVoyagePress}
                        activeOpacity={0.85}
                    >
                        <Text style={styles.tilePrimaryTitle}>{naslovProdaje}</Text>
                        <Text style={styles.tilePrimarySub}>
                            {hasOpenShift ? podnaslovProdaje : 'Otvorite smjenu za prodaju'}
                        </Text>
                    </TouchableOpacity>

                    {/* Sekundarne akcije — outlined u sekundarnoj plavoj */}
                    <TouchableOpacity
                        style={styles.tileSecondary}
                        onPress={() => dispatch(setSection('shifts'))}
                        activeOpacity={0.85}
                    >
                        <Text style={styles.tileSecondaryTitle}>Zaključci smjena</Text>
                        <Text style={styles.tileSecondarySub}>
                            {hasOpenShift ? 'Zatvori smjenu' : 'Otvori smjenu'}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.tileSecondary}
                        onPress={() => dispatch(setSection('documents'))}
                        activeOpacity={0.85}
                    >
                        <Text style={styles.tileSecondaryTitle}>Dokumenti</Text>
                        <Text style={styles.tileSecondarySub}>Računi i izvještaji</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    wrap: { flex: 1, backgroundColor: colors.bg },

    header: {
        minHeight: layout.headerHeight,
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.primary,
        paddingHorizontal: layout.headerPaddingH, paddingVertical: 12,
    },
    title: { fontSize: 24, fontWeight: '800', color: colors.textOnPrimary, letterSpacing: 0.3 },
    subtitle: { fontSize: 12, color: colors.secondary, marginTop: 2, fontWeight: '500' },
    logoutBtn: {
        paddingHorizontal: 14, height: layout.headerButtonHeight, justifyContent: 'center',
        backgroundColor: colors.secondary, borderRadius: 8,
    },
    logoutText: { color: colors.textOnSecondary, fontSize: 13, fontWeight: '700' },

    content: { flex: 1, padding: 20 },

    opCard: {
        backgroundColor: colors.surface,
        borderRadius: 12, padding: 18, marginBottom: 20,
        borderWidth: 1, borderColor: colors.border,
        ...shadows.card,
    },
    opName: { color: colors.textPrimary, fontSize: 22, fontWeight: '700' },
    opMeta: { color: colors.textSecondary, fontSize: 14, marginTop: 2 },

    shiftBadge: {
        flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
        paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginTop: 12,
        borderWidth: 1,
    },
    shiftBadgeOpen: { backgroundColor: colors.successLight, borderColor: colors.success },
    shiftBadgeClosed: { backgroundColor: colors.bg, borderColor: colors.border },
    shiftDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
    shiftBadgeText: { fontSize: 13, fontWeight: '600' },

    tilesGrid: { gap: 12 },

    tile: {
        borderRadius: 14, padding: 20, justifyContent: 'center', minHeight: 110,
    },
    tilePrimary: {
        backgroundColor: colors.primary,
        ...shadows.elevated,
    },
    tilePrimaryTitle: { color: colors.textOnPrimary, fontSize: 26, fontWeight: '800', letterSpacing: 0.3 },
    tilePrimarySub: { color: colors.secondary, fontSize: 14, marginTop: 6, fontWeight: '500' },
    tileDisabled: { opacity: 0.6 },

    tileSecondary: {
        backgroundColor: colors.surface,
        borderRadius: 14, padding: 18, justifyContent: 'center', minHeight: 96,
        borderWidth: 2, borderColor: colors.secondary,
        ...shadows.card,
    },
    tileSecondaryTitle: { color: colors.primary, fontSize: 20, fontWeight: '700' },
    tileSecondarySub: { color: colors.textSecondary, fontSize: 13, marginTop: 4 },
});
