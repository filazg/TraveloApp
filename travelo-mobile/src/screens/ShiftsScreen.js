import React from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useDispatch } from 'react-redux';
import { resetSection } from '../store/slices/navSlice';

export default function ShiftsScreen() {
    const dispatch = useDispatch();
    return (
        <SafeAreaView style={styles.wrap}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => dispatch(resetSection())}>
                    <Text style={styles.backText}>‹ Izbornik</Text>
                </TouchableOpacity>
                <Text style={styles.title}>Zaključci smjena</Text>
                <View style={{ width: 80 }} />
            </View>
            <View style={styles.center}>
                <Text style={styles.placeholder}>Modul u izradi</Text>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    wrap: { flex: 1, backgroundColor: '#0f172a' },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 8, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1e293b',
    },
    backBtn: { paddingVertical: 6, paddingHorizontal: 10 },
    backText: { color: '#38bdf8', fontSize: 16, fontWeight: '600' },
    title: { fontSize: 18, fontWeight: '700', color: '#fff' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    placeholder: { color: '#64748b', fontSize: 16 },
});
