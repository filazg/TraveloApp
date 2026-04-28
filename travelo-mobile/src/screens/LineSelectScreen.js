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
                    <Text style={styles.backText}>‹ Izbornik</Text>
                </TouchableOpacity>
                <Text style={styles.title}>Odabir linije</Text>
                <View style={{ width: 80 }} />
            </View>
            <Text style={styles.sub}>Linije aktivne {today}</Text>

            {sync.transportLoading && !lines.length ? (
                <View style={styles.center}>
                    <ActivityIndicator color="#0ea5e9" size="large" />
                </View>
            ) : (
                <FlatList
                    data={lines}
                    keyExtractor={(l) => l.uuid || l.code}
                    contentContainerStyle={styles.list}
                    refreshControl={<RefreshControl refreshing={sync.transportLoading} onRefresh={() => dispatch(syncTransportDataThunk())} tintColor="#0ea5e9" />}
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
    wrap: { flex: 1, backgroundColor: '#0f172a' },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1e293b',
    },
    backBtn: { paddingVertical: 6, paddingHorizontal: 10 },
    backText: { color: '#38bdf8', fontSize: 16, fontWeight: '600' },
    title: { color: '#fff', fontSize: 18, fontWeight: '700' },
    sub: { color: '#94a3b8', fontSize: 12, textAlign: 'center', marginTop: 8 },
    center: { padding: 40, alignItems: 'center' },
    list: { padding: 16, gap: 12 },
    empty: { color: '#94a3b8', textAlign: 'center', padding: 40 },
    card: {
        backgroundColor: '#1e293b', borderRadius: 10, padding: 16,
        borderLeftWidth: 4, borderLeftColor: '#38bdf8',
    },
    cardCode: { color: '#38bdf8', fontSize: 14, fontWeight: '700' },
    cardName: { color: '#fff', fontSize: 18, fontWeight: '700', marginTop: 2 },
    cardMeta: { color: '#94a3b8', fontSize: 12, marginTop: 6 },
});
