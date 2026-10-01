import { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { colors } from '../theme/colors';

// Dodatne karte uz kartu roditelja (npr. dojenče uz Redovnu) — bez naplate.
// Koje i koliko po karti određuje vrsta karte u portalu (Dodatne karte).
//
// `roditelji`: [{ tip, naziv, kolicina, dodatne: [{ ticket_type_uuid,
// ticket_type_name, max_qty }] }]; `vrijednosti`: { `${tip}|${dodatna}`: broj }.
export const kljucDodatne = (tip, dodatna) => `${tip}|${dodatna}`;

export default function ExtraTicketsModal({ visible, roditelji, vrijednosti, onSave, onClose }) {
    const [kol, setKol] = useState({});
    useEffect(() => { if (visible) setKol({ ...(vrijednosti || {}) }); }, [visible, vrijednosti]);

    const promijeni = (r, d, za) => {
        const k = kljucDodatne(r.tip, d.ticket_type_uuid);
        const max = (Number(d.max_qty) || 1) * r.kolicina;
        setKol((s) => ({ ...s, [k]: Math.max(0, Math.min(max, (s[k] || 0) + za)) }));
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.backdrop}>
                <View style={styles.card}>
                    <Text style={styles.title}>Dodatne karte</Text>
                    <Text style={styles.sub}>Bez naplate — prijavljuju se SEOP-u uz kartu roditelja.</Text>
                    <ScrollView style={{ maxHeight: 380, marginTop: 8 }}>
                        {(roditelji || []).map((r) => (
                            <View key={r.tip} style={{ marginBottom: 12 }}>
                                <Text style={styles.parent}>Uz: {r.naziv} × {r.kolicina}</Text>
                                {r.dodatne.map((d) => {
                                    const k = kljucDodatne(r.tip, d.ticket_type_uuid);
                                    const max = (Number(d.max_qty) || 1) * r.kolicina;
                                    const q = kol[k] || 0;
                                    return (
                                        <View key={k} style={styles.row}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.name}>{d.ticket_type_name}</Text>
                                                <Text style={styles.hint}>najviše {d.max_qty} po karti — ukupno {max}</Text>
                                            </View>
                                            <TouchableOpacity style={[styles.btn, !q && styles.btnOff]} disabled={!q} onPress={() => promijeni(r, d, -1)}>
                                                <Text style={styles.btnText}>–</Text>
                                            </TouchableOpacity>
                                            <Text style={styles.qty}>{q}</Text>
                                            <TouchableOpacity style={[styles.btn, q >= max && styles.btnOff]} disabled={q >= max} onPress={() => promijeni(r, d, 1)}>
                                                <Text style={styles.btnText}>+</Text>
                                            </TouchableOpacity>
                                        </View>
                                    );
                                })}
                            </View>
                        ))}
                    </ScrollView>
                    <View style={styles.actions}>
                        <TouchableOpacity style={styles.ghost} onPress={onClose}>
                            <Text style={styles.ghostText}>Odustani</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.primary} onPress={() => onSave(kol)}>
                            <Text style={styles.primaryText}>Spremi</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    card: { backgroundColor: colors.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16 },
    title: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
    sub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    parent: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
    row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
    name: { fontSize: 15, color: colors.textPrimary },
    hint: { fontSize: 11, color: colors.textSecondary },
    btn: { width: 44, height: 44, borderRadius: 8, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    btnOff: { opacity: 0.4 },
    btnText: { color: colors.textOnPrimary, fontSize: 22, fontWeight: '800' },
    qty: { width: 36, textAlign: 'center', fontSize: 18, fontWeight: '800', color: colors.textPrimary },
    actions: { flexDirection: 'row', gap: 12, marginTop: 12 },
    ghost: { flex: 1, height: 48, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
    ghostText: { color: colors.textPrimary, fontWeight: '700' },
    primary: { flex: 1, height: 48, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    primaryText: { color: colors.textOnPrimary, fontWeight: '800' },
});
