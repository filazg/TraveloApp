import React from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { authData, logoutOperator } from '../store/slices/authSlice';
import { syncData } from '../store/slices/syncSlice';
import { setSection } from '../store/slices/navSlice';

export default function MainMenuScreen() {
    const dispatch = useDispatch();
    const auth = useSelector(authData);
    const sync = useSelector(syncData);

    return (
        <SafeAreaView style={styles.wrap}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.title}>Travelo</Text>
                    <Text style={styles.subtitle}>
                        {sync.basicData?.business_premise_name} · {sync.basicData?.billing_device_name}
                    </Text>
                </View>
                <TouchableOpacity style={styles.logoutBtn} onPress={() => dispatch(logoutOperator())}>
                    <Text style={styles.logoutText}>Odjava</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.content}>
                <Text style={styles.opName}>
                    {auth.operator?.user_name} {auth.operator?.user_surname}
                </Text>
                <Text style={styles.opMeta}>@{auth.operator?.user_username}</Text>

                <View style={styles.tilesGrid}>
                    <TouchableOpacity
                        style={[styles.tile, styles.tileVoyage]}
                        onPress={() => dispatch(setSection('voyage'))}
                    >
                        <Text style={styles.tileTitle}>Plovidba</Text>
                        <Text style={styles.tileSub}>Prodaja i validacija karata</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tile, styles.tileShifts]}
                        onPress={() => dispatch(setSection('shifts'))}
                    >
                        <Text style={styles.tileTitle}>Zaključci smjena</Text>
                        <Text style={styles.tileSub}>Pregled i zatvaranje</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tile, styles.tileDocs]}
                        onPress={() => dispatch(setSection('documents'))}
                    >
                        <Text style={styles.tileTitle}>Dokumenti</Text>
                        <Text style={styles.tileSub}>Računi i izvještaji</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    wrap: { flex: 1, backgroundColor: '#0f172a' },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 20, paddingVertical: 16,
        borderBottomWidth: 1, borderBottomColor: '#1e293b',
    },
    title: { fontSize: 22, fontWeight: '800', color: '#fff' },
    subtitle: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
    logoutBtn: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#334155', borderRadius: 6 },
    logoutText: { color: '#fff', fontSize: 13, fontWeight: '600' },
    content: { flex: 1, padding: 20 },
    opName: { color: '#fff', fontSize: 24, fontWeight: '700' },
    opMeta: { color: '#94a3b8', fontSize: 14, marginBottom: 28 },
    tilesGrid: { gap: 12 },
    tile: { borderRadius: 12, padding: 18, justifyContent: 'center', minHeight: 96 },
    tileVoyage: { backgroundColor: '#0284c7' },
    tileShifts: { backgroundColor: '#7c3aed' },
    tileDocs: { backgroundColor: '#059669' },
    tileTitle: { color: '#fff', fontSize: 22, fontWeight: '700' },
    tileSub: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 4 },
});
