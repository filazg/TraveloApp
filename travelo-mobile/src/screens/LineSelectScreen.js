import React, { useEffect, useMemo } from 'react';
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { todayDmy } from '../api/config';
import { syncTransportDataThunk, syncData } from '../store/slices/syncSlice';
import { setLine } from '../store/slices/voyageSlice';
import { resetSection } from '../store/slices/navSlice';
import { colors, shadows, layout } from '../theme/colors';
import HomeButton from '../components/HomeButton';

export default function LineSelectScreen() {
    const dispatch = useDispatch();
    const sync = useSelector(syncData);
    const today = todayDmy();

    useEffect(() => {
        if (!sync.salesRoutes.length && !sync.transportLoading) {
            dispatch(syncTransportDataThunk());
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dispatch]);

    // Only lines that have at least one active route today.
    const lines = useMemo(() => {
        const codesToday = new Set(
            sync.salesRoutes.filter((r) => r.is_active && r.departure_date === today).map((r) => r.line_code)
        );
        return sync.lines.filter((l) => codesToday.has(l.code));
    }, [sync.lines, sync.salesRoutes, today]);

    return (
        <SafeAreaView style={styles.wrap}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => dispatch(resetSection())}>
                    <Text style={styles.backText}>‹</Text>
                </TouchableOpacity>
                <Text style={styles.title}>Odabir linije</Text>
                <View style={{ minWidth: 44, alignItems: 'flex-end' }}>
                    <HomeButton />
                </View>
            </View>
            <Text style={styles.sub}>Linije aktivne {today}</Text>

            {sync.transportLoading && !lines.length ? (
                <View style={styles.center}>
                    <ActivityIndicator color={colors.primary} size="large" />
                </View>
            ) : (
                <FlatList
                    data={lines}
                    keyExtractor={(l) => l.uuid || l.code}
                    contentContainerStyle={styles.list}
                    refreshControl={<RefreshControl refreshing={sync.transportLoading} onRefresh={() => dispatch(syncTransportDataThunk())} tintColor={colors.primary} />}
                    ListEmptyComponent={<Text style={styles.empty}>Nema linija za današnji dan.</Text>}
                    renderItem={({ item }) => (
                        <TouchableOpacity style={styles.card} onPress={() => dispatch(setLine(item))}>
                            <Text style={styles.cardCode}>{item.code}</Text>
                            <Text style={styles.cardName}>{item.name}</Text>
                            {(item.first_harbor_name || item.last_harbor_name) && (
                                <Text style={styles.cardMeta}>
                                    {item.first_harbor_name} → {item.last_harbor_name}
                                </Text>
                            )}
                        </TouchableOpacity>
                    )}
                />
            )}
        </SafeAreaView>
    );
}

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
    title: { color: colors.textOnPrimary, fontSize: 18, fontWeight: '700' },
    sub: { color: colors.textSecondary, fontSize: 12, textAlign: 'center', marginTop: 8 },
    center: { padding: 40, alignItems: 'center' },
    list: { padding: 16, gap: 12 },
    empty: { color: colors.textSecondary, textAlign: 'center', padding: 40 },
    card: {
        backgroundColor: colors.surface, borderRadius: 10, padding: 16,
        borderLeftWidth: 4, borderLeftColor: colors.primary,
        borderWidth: 1, borderColor: colors.border,
        ...shadows.card,
    },
    cardCode: { color: colors.primary, fontSize: 14, fontWeight: '700' },
    cardName: { color: colors.textPrimary, fontSize: 18, fontWeight: '700', marginTop: 2 },
    cardMeta: { color: colors.textSecondary, fontSize: 12, marginTop: 6 },
});
