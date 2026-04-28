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
import { setVoyage, clearLine, voyageData } from '../store/slices/voyageSlice';

// Group sales_routes by (timetable_uuid, sequence, departure_date) → one voyage per group.
const groupVoyages = (routes) => {
    const groups = new Map();
    for (const r of routes) {
        if (!r.is_active) continue;
        const key = `${r.timetable_uuid}|${r.sequence}|${r.departure_date}`;
        if (!groups.has(key)) {
            groups.set(key, {
                key,
                timetable_uuid: r.timetable_uuid,
                sequence: r.sequence,
                departure_date: r.departure_date,
                line_code: r.line_code,
                line_name: r.line_name,
                direction: r.direction,
                legs: [],
            });
        }
        groups.get(key).legs.push(r);
    }
    return [...groups.values()].map((g) => {
        g.legs.sort((a, b) => Number(a.departure_harbor_order) - Number(b.departure_harbor_order));
        g.first_departure_time = g.legs[0]?.departure_time || '';
        g.start_harbor = g.legs[0]?.departure_harbor_name || '';
        g.end_harbor = g.legs[g.legs.length - 1]?.arrival_harbor_name || '';
        return g;
    }).sort((a, b) => (a.first_departure_time || '').localeCompare(b.first_departure_time || ''));
};

export default function VoyageSelectScreen() {
    const dispatch = useDispatch();
    const sync = useSelector(syncData);
    const voyage = useSelector(voyageData);
    const line = voyage.selectedLine;

    useEffect(() => {
        if (!sync.salesRoutes.length && !sync.transportLoading) {
            dispatch(syncTransportDataThunk());
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dispatch]);

    const today = todayDmy();
    const voyages = useMemo(
        () => groupVoyages(
            sync.salesRoutes.filter((r) =>
                r.departure_date === today &&
                (!line || r.line_code === line.code)
            )
        ),
        [sync.salesRoutes, today, line]
    );

    const onRefresh = () => dispatch(syncTransportDataThunk());
    const onSelect = (v) => dispatch(setVoyage(v));

    return (
        <SafeAreaView style={styles.wrap}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => dispatch(clearLine())}>
                    <Text style={styles.backText}>‹ Linije</Text>
                </TouchableOpacity>
                <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={styles.title}>{line?.code || 'Polazak'}</Text>
                    <Text style={styles.subtitle}>{line?.name || ''} · {today}</Text>
                </View>
                <View style={{ width: 80 }} />
            </View>

            {sync.transportLoading && !voyages.length ? (
                <View style={styles.center}>
                    <ActivityIndicator color="#0ea5e9" size="large" />
                    <Text style={styles.hint}>Učitavanje polazaka…</Text>
                </View>
            ) : (
                <FlatList
                    data={voyages}
                    keyExtractor={(v) => v.key}
                    contentContainerStyle={styles.list}
                    refreshControl={<RefreshControl refreshing={sync.transportLoading} onRefresh={onRefresh} tintColor="#0ea5e9" />}
                    ListEmptyComponent={
                        <View style={styles.center}>
                            <Text style={styles.hint}>Nema polazaka za odabranu liniju danas.</Text>
                        </View>
                    }
                    renderItem={({ item }) => (
                        <TouchableOpacity style={styles.card} onPress={() => onSelect(item)}>
                            <View style={styles.cardRow}>
                                <Text style={styles.cardTime}>{item.first_departure_time}</Text>
                                {item.direction && (
                                    <Text style={styles.cardDir}>smjer {item.direction}</Text>
                                )}
                            </View>
                            <Text style={styles.cardRoute}>
                                {item.start_harbor} → {item.end_harbor}
                            </Text>
                            <Text style={styles.cardMeta}>{item.legs.length} etapa · sekvenca #{item.sequence}</Text>
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
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 8, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1e293b',
    },
    backBtn: { paddingVertical: 6, paddingHorizontal: 10, width: 80 },
    backText: { color: '#38bdf8', fontSize: 16, fontWeight: '600' },
    title: { fontSize: 18, fontWeight: '800', color: '#fff' },
    subtitle: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
    center: { padding: 40, alignItems: 'center' },
    hint: { color: '#94a3b8', marginTop: 12, fontSize: 14 },
    list: { padding: 16, gap: 12 },
    card: {
        backgroundColor: '#1e293b', borderRadius: 10, padding: 16,
        borderLeftWidth: 4, borderLeftColor: '#0ea5e9',
    },
    cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    cardTime: { fontSize: 24, fontWeight: '800', color: '#fff' },
    cardDir: { fontSize: 11, color: '#94a3b8' },
    cardRoute: { fontSize: 16, color: '#e2e8f0', marginTop: 6 },
    cardMeta: { fontSize: 12, color: '#94a3b8', marginTop: 4 },
});
