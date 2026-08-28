import React, { useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, shadows } from '../theme/colors';

// Traka s danom prodaje: strelice pomiču za jedan dan, dodir na datum otvara
// kalendar. Prikazuje se samo na uređaju kojem je dopuštena prodaja za buduće
// datume — inače se prodaje isključivo za danas i traka nema svrhe.
//
// Datumi se drže kao tekst "DD/MM/YYYY", isto kao u voznom redu, da se mogu
// izravno uspoređivati bez parsiranja.

const pad = (n) => String(n).padStart(2, '0');
export const uDmy = (d) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
export const izDmy = (s) => {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(s || ''));
    if (!m) return new Date();
    return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
};

const MJESECI = ['Siječanj', 'Veljača', 'Ožujak', 'Travanj', 'Svibanj', 'Lipanj',
    'Srpanj', 'Kolovoz', 'Rujan', 'Listopad', 'Studeni', 'Prosinac'];
const DANI = ['Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub', 'Ned'];

// Dan, mjesec i skraćeni naziv dana — djelatnik gleda "je li ovo sutra", ne
// puni datum, pa naziv dana nosi više od godine.
const DANI_PUNI = ['Nedjelja', 'Ponedjeljak', 'Utorak', 'Srijeda', 'Četvrtak', 'Petak', 'Subota'];
const opisDana = (dmy, danasDmy) => {
    if (dmy === danasDmy) return 'danas';
    const d = izDmy(dmy);
    const sutra = new Date();
    sutra.setDate(sutra.getDate() + 1);
    if (dmy === uDmy(sutra)) return 'sutra';
    return DANI_PUNI[d.getDay()].toLowerCase();
};

export default function DatumProdaje({ datum, danas, onPromjena }) {
    const [kalendar, setKalendar] = useState(false);
    const [mjesec, setMjesec] = useState(() => izDmy(datum));

    const pomakni = (dana) => {
        const d = izDmy(datum);
        d.setDate(d.getDate() + dana);
        // Unatrag se ne ide dalje od danas: karta za jučerašnji polazak se ne
        // prodaje, a i vozni red za prošle dane uređaj više ne drži.
        if (uDmy(d) < danas && izDmy(uDmy(d)) < izDmy(danas)) return;
        onPromjena(uDmy(d));
    };

    const otvoriKalendar = () => {
        setMjesec(izDmy(datum));
        setKalendar(true);
    };

    // Mreža dana za prikazani mjesec, s praznim mjestima do prvog ponedjeljka.
    const dani = () => {
        const prvi = new Date(mjesec.getFullYear(), mjesec.getMonth(), 1);
        const zadnji = new Date(mjesec.getFullYear(), mjesec.getMonth() + 1, 0);
        const prazno = (prvi.getDay() + 6) % 7;
        const out = new Array(prazno).fill(null);
        for (let i = 1; i <= zadnji.getDate(); i += 1) {
            out.push(new Date(mjesec.getFullYear(), mjesec.getMonth(), i));
        }
        return out;
    };

    const danasDatum = izDmy(danas);
    const jePrije = (d) => d < new Date(danasDatum.getFullYear(), danasDatum.getMonth(), danasDatum.getDate());

    return (
        <View style={s.wrap}>
            <TouchableOpacity style={s.strelica} onPress={() => pomakni(-1)}>
                <Text style={s.strelicaText}>◀</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.sredina} onPress={otvoriKalendar} activeOpacity={0.7}>
                <Text style={s.datum}>{datum}</Text>
                <Text style={s.opis}>{opisDana(datum, danas)}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.strelica} onPress={() => pomakni(1)}>
                <Text style={s.strelicaText}>▶</Text>
            </TouchableOpacity>

            <Modal visible={kalendar} transparent animationType="fade" onRequestClose={() => setKalendar(false)}>
                <View style={s.pozadina}>
                    <View style={s.kalendar}>
                        <View style={s.kalendarVrh}>
                            <TouchableOpacity
                                style={s.mjesecBtn}
                                onPress={() => setMjesec(new Date(mjesec.getFullYear(), mjesec.getMonth() - 1, 1))}
                            >
                                <Text style={s.strelicaText}>◀</Text>
                            </TouchableOpacity>
                            <Text style={s.mjesecNaslov}>
                                {MJESECI[mjesec.getMonth()]} {mjesec.getFullYear()}
                            </Text>
                            <TouchableOpacity
                                style={s.mjesecBtn}
                                onPress={() => setMjesec(new Date(mjesec.getFullYear(), mjesec.getMonth() + 1, 1))}
                            >
                                <Text style={s.strelicaText}>▶</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={s.tjedan}>
                            {DANI.map((d) => <Text key={d} style={s.danNaziv}>{d}</Text>)}
                        </View>

                        <View style={s.mreza}>
                            {dani().map((d, i) => {
                                if (!d) return <View key={`p${i}`} style={s.celija} />;
                                const dmy = uDmy(d);
                                const odabran = dmy === datum;
                                const prosli = jePrije(d);
                                return (
                                    <TouchableOpacity
                                        key={dmy}
                                        style={[s.celija, odabran && s.celijaOdabrana]}
                                        disabled={prosli}
                                        onPress={() => { setKalendar(false); onPromjena(dmy); }}
                                    >
                                        <Text style={[
                                            s.celijaText,
                                            odabran && s.celijaTextOdabrana,
                                            prosli && s.celijaTextProsla,
                                        ]}>
                                            {d.getDate()}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        <TouchableOpacity style={s.odustani} onPress={() => setKalendar(false)}>
                            <Text style={s.odustaniText}>Odustani</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const s = StyleSheet.create({
    wrap: {
        flexDirection: 'row', alignItems: 'center',
        marginHorizontal: 12, marginTop: 10,
        backgroundColor: colors.surface, borderRadius: 10,
        borderWidth: 1, borderColor: colors.border,
        ...shadows.card,
    },
    strelica: { width: 56, height: 58, alignItems: 'center', justifyContent: 'center' },
    strelicaText: { color: colors.primary, fontSize: 20, fontWeight: '800' },
    sredina: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
    datum: { color: colors.textPrimary, fontSize: 20, fontWeight: '800' },
    opis: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },

    pozadina: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
    kalendar: {
        width: '90%', backgroundColor: colors.surface, borderRadius: 12, padding: 12,
    },
    kalendarVrh: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    mjesecBtn: { width: 48, height: 44, alignItems: 'center', justifyContent: 'center' },
    mjesecNaslov: { color: colors.textPrimary, fontSize: 17, fontWeight: '800' },
    tjedan: { flexDirection: 'row', marginTop: 8 },
    danNaziv: { flex: 1, textAlign: 'center', color: colors.textSecondary, fontSize: 11, fontWeight: '700' },
    mreza: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
    celija: {
        width: `${100 / 7}%`, height: 44, alignItems: 'center', justifyContent: 'center',
    },
    celijaOdabrana: { backgroundColor: colors.primary, borderRadius: 8 },
    celijaText: { color: colors.textPrimary, fontSize: 16, fontWeight: '600' },
    celijaTextOdabrana: { color: colors.textOnPrimary, fontWeight: '800' },
    celijaTextProsla: { color: colors.textMuted, opacity: 0.4 },
    odustani: {
        marginTop: 8, paddingVertical: 12, alignItems: 'center',
        backgroundColor: colors.surfaceAlt || 'rgba(0,0,0,0.06)', borderRadius: 8,
    },
    odustaniText: { color: colors.textSecondary, fontWeight: '700' },
});
