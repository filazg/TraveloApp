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
import { colors, shadows, layout } from '../theme/colors';
import HomeButton from '../components/HomeButton';

// "DD.MM.YYYY. HH:mm" → "HH:mm". Vremena su tekst i new Date() ih ne parsira.
const timeOnly = (s) => {
    const m = /(\d{1,2}):(\d{2})/.exec(String(s || ''));
    return m ? `${m[1].padStart(2, '0')}:${m[2]}` : '';
};

// "DD.MM.YYYY. HH:mm" → "DD.MM." (za slučaj kad je polazak pomaknut na drugi dan)
const dateOnly = (s) => {
    const m = /^(\d{2})\.(\d{2})\./.exec(String(s || ''));
    return m ? `${m[1]}.${m[2]}.` : '';
};

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
        // Pomaknut polazak: vozni red ostaje u `departure`, stvarno vrijeme je u
        // `actual_departure`. Blagajna mora prodavati po stvarnom vremenu, pa se
        // ono prikazuje, a planirano ostaje vidljivo uz oznaku.
        const prvi = g.legs[0] || {};
        const planirano = prvi.departure || '';
        const stvarno = prvi.actual_departure || '';
        g.is_moved = !!(planirano && stvarno && planirano !== stvarno);
        g.actual_departure = stvarno;
        g.planned_departure = planirano;
        if (g.is_moved) g.first_departure_time = timeOnly(stvarno) || g.first_departure_time;
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
    // Polasci prate dan odabran na prethodnom ekranu. Bez dopustenja za buducu
    // prodaju to je uvijek danasnji dan.
    const smijeBuduce = !!sync.basicData?.billing_device_future_sale;
    const dan = smijeBuduce ? (voyage.date || today) : today;
    const voyages = useMemo(
        () => groupVoyages(
            sync.salesRoutes.filter((r) =>
                r.departure_date === dan &&
                (!line || r.line_code === line.code)
            )
        ),
        [sync.salesRoutes, dan, line]
    );

    const onRefresh = () => dispatch(syncTransportDataThunk());
    const onSelect = (v) => dispatch(setVoyage(v));

    return (
        <SafeAreaView style={styles.wrap}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => dispatch(clearLine())}>
                    <Text style={styles.backText}>‹</Text>
                </TouchableOpacity>
                <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={styles.title}>{line?.code || 'Polazak'}</Text>
                    <Text style={styles.subtitle}>{line?.name || ''} · {dan}</Text>
                </View>
                <View style={{ minWidth: 44, alignItems: 'flex-end' }}>
                    <HomeButton />
                </View>
            </View>

            {sync.transportLoading && !voyages.length ? (
                <View style={styles.center}>
                    <ActivityIndicator color={colors.primary} size="large" />
                    <Text style={styles.hint}>Učitavanje polazaka…</Text>
                </View>
            ) : (
                <FlatList
                    data={voyages}
                    keyExtractor={(v) => v.key}
                    contentContainerStyle={styles.list}
                    refreshControl={<RefreshControl refreshing={sync.transportLoading} onRefresh={onRefresh} tintColor={colors.primary} />}
                    ListEmptyComponent={
                        <View style={styles.center}>
                            <Text style={styles.hint}>Nema polazaka za odabranu liniju danas.</Text>
                        </View>
                    }
                    renderItem={({ item }) => (
                        <TouchableOpacity style={styles.card} onPress={() => onSelect(item)}>
                            <View style={styles.cardRow}>
                                <Text style={styles.cardTime}>{item.first_departure_time}</Text>
                                {item.is_moved && (
                                    <Text style={styles.cardMoved}>
                                        POMAKNUT · po redu {timeOnly(item.planned_departure)}
                                        {dateOnly(item.actual_departure) !== dateOnly(item.planned_departure)
                                            ? ` ${dateOnly(item.planned_departure)}`
                                            : ''}
                                    </Text>
                                )}
                                {item.direction && (
                                    <Text style={styles.cardDir}>smjer {item.direction}</Text>
                                )}
                            </View>
                            <Text style={styles.cardRoute}>
                                {item.start_harbor} → {item.end_harbor}
                            </Text>
                            <Text style={styles.cardMeta}>{item.legs.length} relacija</Text>
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
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: layout.headerPaddingH, paddingVertical: 12,
        backgroundColor: colors.primary,
    },
    backBtn: {
        backgroundColor: colors.secondary, borderRadius: 8,
        width: layout.headerButtonHeight, height: layout.headerButtonHeight,
        alignItems: 'center', justifyContent: 'center',
    },
    backText: { color: colors.textOnSecondary, fontSize: 32, fontWeight: '800', lineHeight: 34 },
    title: { fontSize: 18, fontWeight: '800', color: colors.textOnPrimary },
    subtitle: { fontSize: 11, color: colors.secondary, marginTop: 2 },
    center: { padding: 40, alignItems: 'center' },
    hint: { color: colors.textSecondary, marginTop: 12, fontSize: 14 },
    list: { padding: 16, gap: 12 },
    card: {
        backgroundColor: colors.surface, borderRadius: 10, padding: 16,
        borderLeftWidth: 4, borderLeftColor: colors.primary,
        borderWidth: 1, borderColor: colors.border,
        ...shadows.card,
    },
    cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    cardTime: { fontSize: 24, fontWeight: '800', color: colors.textPrimary },
    cardDir: { fontSize: 11, color: colors.textSecondary },
    // Pomaknut polazak — veliko vrijeme je stvarno, ovdje stoji ono iz voznog reda.
    cardMoved: {
        fontSize: 10, fontWeight: '800', color: colors.textOnPrimary,
        backgroundColor: colors.warning, borderRadius: 4,
        paddingHorizontal: 6, paddingVertical: 2, marginLeft: 8, flexShrink: 1,
    },
    cardRoute: { fontSize: 16, color: colors.textPrimary, marginTop: 6 },
    cardMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
});
