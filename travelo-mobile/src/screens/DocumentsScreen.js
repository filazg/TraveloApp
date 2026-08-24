import React, { useEffect, useState, useCallback } from 'react';
import {
    Alert, FlatList, Modal, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { resetSection } from '../store/slices/navSlice';
import { loadInvoicesThunk, loadInvoiceDetailThunk, syncPendingSalesThunk, salesData } from '../store/slices/salesSlice';
import { syncData } from '../store/slices/syncSlice';
import { authData } from '../store/slices/authSlice';
import { shiftsData } from '../store/slices/shiftsSlice';
import { printReceipt as printReceiptFn, printTickets as printTicketsFn } from '../device/printSale';
import api from '../api/client';
import { ENDPOINTS } from '../api/config';
import { markTicketsCanceled, markInvoiceCanceled, saveSale, markInvoiceSynced } from '../db/repo';
import { buildLocalStorno } from '../store/localSale';
import { colors, shadows, layout } from '../theme/colors';
import HomeButton from '../components/HomeButton';

const fmtEUR = (n) => `${(Number(n) || 0).toFixed(2)} €`;
const fmtDt = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    const p = (n) => String(n).padStart(2, '0');
    return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

const invoiceRaw = (inv) => inv.raw_response || inv;

export default function DocumentsScreen() {
    const dispatch = useDispatch();
    const sales = useSelector(salesData);
    const sync = useSelector(syncData);
    const auth = useSelector(authData);
    const shifts = useSelector(shiftsData);
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selected, setSelected] = useState(null);
    const [detailTickets, setDetailTickets] = useState([]);
    const [printing, setPrinting] = useState(false);
    // Storno state
    const [stornoOpen, setStornoOpen] = useState(false);
    const [stornoTicketUuids, setStornoTicketUuids] = useState({}); // { ticket_uuid: true }
    const [stornoPaymentUuid, setStornoPaymentUuid] = useState('');
    const [stornoPct, setStornoPct] = useState('100');
    const [stornoSubmitting, setStornoSubmitting] = useState(false);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const list = await dispatch(loadInvoicesThunk(100)).unwrap();
            setInvoices(list || []);
        } finally {
            setLoading(false);
        }
    }, [dispatch]);

    useEffect(() => { refresh(); }, [refresh]);

    const openDetail = async (inv) => {
        setSelected(inv);
        try {
            const r = await dispatch(loadInvoiceDetailThunk(inv.invoice_uuid)).unwrap();
            setDetailTickets(r.tickets || []);
        } catch {
            setDetailTickets([]);
        }
    };

    const closeDetail = () => {
        setSelected(null);
        setDetailTickets([]);
    };

    // Reprint račun + sve karte vezane uz njega — koristi pohranjene podatke iz lokalne baze.
    const handleReprint = async () => {
        if (!selected || printing) return;
        setPrinting(true);
        try {
            const r = invoiceRaw(selected);
            // Vrati items u format koji printReceipt očekuje (qty, unit_price, ticket_type_name).
            const itemsForPrint = (() => {
                if (Array.isArray(selected.cart) && selected.cart.length) return selected.cart;
                // Fallback: rekonstrukcija iz tickets-a (grupirano po type_uuid + cijeni).
                const map = new Map();
                for (const t of detailTickets) {
                    const key = `${t.ticket_type_uuid}|${Number(t.single_price).toFixed(2)}`;
                    const cur = map.get(key) || {
                        ticket_type_uuid: t.ticket_type_uuid,
                        ticket_type_name: t.ticket_type_name,
                        unit_price: Number(t.single_price) || 0,
                        qty: 0,
                    };
                    cur.qty += 1;
                    map.set(key, cur);
                }
                return [...map.values()];
            })();
            await printReceiptFn({
                r,
                items: itemsForPrint,
                paymentName: r.payment_method_name || r.invoice_payment_method_name,
                basicData: sync.basicData,
                operator: { user_name: r.operater_name || '', user_surname: '' },
                voyage: null,
                fromHarbor: { name: detailTickets[0]?.departure_harbor_name || '' },
                toHarbor: { name: detailTickets[0]?.arrival_harbor_name || '' },
                isReprint: true,
            });
            await printTicketsFn({
                tickets: detailTickets,
                basicData: sync.basicData,
                voyage: null,
                isReprint: true,
            });
        } catch (e) {
            Alert.alert('Greška ispisa', e?.message || String(e));
        } finally {
            setPrinting(false);
        }
    };

    // ---- STORNO ----
    const openStorno = () => {
        if (!selected) return;
        const r = invoiceRaw(selected);
        // Storno račun NE može biti dalje storniran (vidi memoriju "Pravila storna").
        if (selected.is_storno || r.is_storno) {
            Alert.alert('Storno', 'Storno račun se ne može dalje stornirati.');
            return;
        }
        if (selected.is_canceled || r.invoice_canceled) {
            Alert.alert('Storno', 'Račun je već storniran.');
            return;
        }
        const stillActive = detailTickets.filter((t) => !t.is_canceled);
        if (!stillActive.length) {
            Alert.alert('Storno', 'Sve karte su već stornirane.');
            return;
        }
        const initial = {};
        for (const t of stillActive) initial[t.ticket_uuid] = true;
        setStornoTicketUuids(initial);
        setStornoPct('100');
        const firstPm = (sync.paymentMethods || []).find((p) => p.is_active !== false);
        setStornoPaymentUuid(firstPm?.uuid || '');
        setStornoOpen(true);
    };

    const closeStorno = () => {
        setStornoOpen(false);
        setStornoTicketUuids({});
        setStornoPct('100');
        setStornoPaymentUuid('');
    };

    const submitStorno = async () => {
        const ticketUuids = Object.keys(stornoTicketUuids).filter((u) => stornoTicketUuids[u]);
        if (!ticketUuids.length) { Alert.alert('Storno', 'Odaberite barem jednu kartu.'); return; }
        const pct = Math.max(0, Math.min(100, parseFloat(stornoPct) || 0));
        if (pct <= 0) { Alert.alert('Storno', 'Postotak povrata mora biti > 0.'); return; }
        if (!stornoPaymentUuid) { Alert.alert('Storno', 'Odaberite način povrata.'); return; }
        const terminalUuid = sync.basicData?.billing_device_uuid;
        if (!terminalUuid) { Alert.alert('Storno', 'Nije postavljen naplatni uređaj.'); return; }

        setStornoSubmitting(true);
        try {
            // 1) LOCAL — generiraj storno račun samostalno (sljedeći broj iz iste
            //    sekvence kao prodajni). Backend NE smije utjecati na izdavanje.
            const ticketsToCancel = detailTickets.filter((t) => stornoTicketUuids[t.ticket_uuid]);
            const pmName = (sync.paymentMethods || []).find((p) => p.uuid === stornoPaymentUuid)?.name || 'Storno';
            const stornoLocal = await buildLocalStorno({
                originalInvoice: selected,
                ticketsToCancel,
                percentage: pct,
                paymentMethodUuid: stornoPaymentUuid,
                paymentMethodName: pmName,
                basicData: sync.basicData,
            });

            const stornoInvoiceLocal = {
                invoice_uuid: stornoLocal.invoice_uuid,
                order_uuid: stornoLocal.order_uuid,
                shift_uuid: shifts.currentOpen?.shift_uuid || selected.shift_uuid || null,
                operator_uuid: auth.operator?.user_uuid || null,
                voyage_key: selected.voyage_key || null,
                amount: stornoLocal.total_amount,
                total_amount: stornoLocal.total_amount,
                total_vat_base: stornoLocal.total_vat_base,
                total_vat: stornoLocal.total_vat,
                total_harbor_tax: stornoLocal.total_harbor_tax,
                payment_method_uuid: stornoPaymentUuid,
                payment_method_name: pmName,
                invoice_no: stornoLocal.invoice_no,
                invoice_year: stornoLocal.invoice_year,
                invoice_fiskal_no: stornoLocal.invoice_fiskal_no,
                invoice_total_no: stornoLocal.invoice_total_no,
                invoice_code: stornoLocal.invoice_code,
                is_f2: !!stornoLocal.is_f2,
                created_at: new Date().toISOString(),
                synced: 0, // čeka backend audit push (nije potrebno za izdavanje)
                cart: stornoLocal.items,
                local: true,
                is_storno: true,
                storno_of_invoice_uuid: selected.invoice_uuid,
                storno_of_invoice_no: selected.invoice_no || null,
                storno_percentage: pct,
                // Payload za sync retry — bez ovoga syncPendingSalesThunk ne zna
                // koji ticket-i se storniraju ako audit POST padne sad.
                _storno_payload: {
                    ticket_uuids: ticketUuids,
                    terminal_uuid: terminalUuid,
                    payment_method_uuid: stornoPaymentUuid,
                    percentage: pct,
                    storno_invoice_uuid: stornoLocal.invoice_uuid,
                    storno_invoice_no: stornoLocal.invoice_no,
                    storno_invoice_code: stornoLocal.invoice_code,
                },
            };
            try {
                await saveSale({ invoice: stornoInvoiceLocal, tickets: [] });
            } catch (e) {
                console.warn('Storno save error:', e?.message || e);
            }

            // 2) NAZNAKA — flag-aj originalne karte i (ako je sve stornirano) original
            //    račun. Iznosi originalnog računa se NE mijenjaju.
            const stornoMeta = {
                storno_invoice_uuid: stornoLocal.invoice_uuid,
                storno_invoice_no: stornoLocal.invoice_no,
                storno_invoice_year: stornoLocal.invoice_year,
                storno_amount: stornoLocal.total_amount,
                percentage: pct,
                ticket_uuids: ticketUuids,
                created_at: new Date().toISOString(),
            };
            await markTicketsCanceled(ticketUuids, stornoMeta);
            const allCanceled = detailTickets.every((t) => t.is_canceled || stornoTicketUuids[t.ticket_uuid]);
            if (allCanceled) await markInvoiceCanceled(selected.invoice_uuid, stornoMeta);

            // 3) BACKEND audit — async (ne blokira UI dalje), na success markiramo
            //    storno račun kao synced=1 da nestane "Pending" badge u Dokumentima.
            //    Ako padne, ostaje 0 i pokupit će ga syncPendingSalesThunk kasnije.
            api.post(ENDPOINTS.cancelTickets, {
                ticket_uuids: ticketUuids,
                terminal_uuid: terminalUuid,
                payment_method_uuid: stornoPaymentUuid,
                percentage: pct,
                storno_invoice_uuid: stornoLocal.invoice_uuid,
                storno_invoice_no: stornoLocal.invoice_no,
                storno_invoice_code: stornoLocal.invoice_code,
            }, { timeout: 20000 })
                .then(async (resp) => {
                    const body = resp?.data?.data ?? resp?.data ?? {};
                    await markInvoiceSynced(stornoLocal.invoice_uuid, body);
                    refresh();
                })
                .catch((e) => console.log('[storno] backend audit failed:', e?.message || e));

            // 4) ISPIS — storno račun (negativni iznosi, naznaka "STORNO RAČUNA #X").
            try {
                const stornoR = {
                    invoice_no: stornoLocal.invoice_no,
                    invoice_year: stornoLocal.invoice_year,
                    invoice_code: stornoLocal.invoice_code,
                    total_amount: stornoLocal.total_amount,
                    total_vat_base: stornoLocal.total_vat_base,
                    total_vat: stornoLocal.total_vat,
                    total_harbor_tax: stornoLocal.total_harbor_tax,
                    payment_method_name: pmName,
                    operater_name: 'STORNO',
                };
                const items = stornoLocal.items;
                await printReceiptFn({
                    r: stornoR,
                    items,
                    paymentName: stornoR.payment_method_name,
                    basicData: sync.basicData,
                    operator: { name: 'STORNO' },
                    voyage: null,
                    fromHarbor: { name: detailTickets[0]?.departure_harbor_name || '' },
                    toHarbor: { name: detailTickets[0]?.arrival_harbor_name || '' },
                    isReprint: false,
                });
            } catch (e) {
                console.warn('Storno print error:', e?.message || e);
            }

            closeStorno();
            closeDetail();
            await refresh();
            const stornoLabel = stornoLocal.is_f2
                ? (stornoLocal.invoice_code || '-')
                : `#${stornoLocal.invoice_no || '-'}`;
            Alert.alert('Storno', `Storno proveden: račun ${stornoLabel}, iznos ${(Number(stornoLocal.total_amount) || 0).toFixed(2)} €.`);
        } catch (e) {
            const msg = e?.response?.data?.data?.message || e?.message || 'Greška u stornu';
            Alert.alert('Greška', msg);
        } finally {
            setStornoSubmitting(false);
        }
    };

    const handleSync = async () => {
        try {
            const r = await dispatch(syncPendingSalesThunk()).unwrap();
            await refresh();
            const reasons = (r.skipReasons || []).join('\n');
            const msg = `Poslano: ${r.pushed}, ostalo: ${r.remaining}` + (reasons ? `\n\nRazlog:\n${reasons}` : '');
            Alert.alert('Sinkronizacija', msg);
        } catch (e) {
            Alert.alert('Greška', e?.message || 'Sinkronizacija nije uspjela');
        }
    };

    const renderItem = ({ item }) => {
        const r = invoiceRaw(item);
        const isSynced = item._synced;
        const isLocal = item.local;
        const hasIsland = (r.tickets || []).some((t) => t.is_island);
        return (
            <TouchableOpacity style={styles.row} onPress={() => openDetail(item)}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>
                        {r.is_f2 || item.is_f2
                            ? `Račun ${r.invoice_code || item.invoice_uuid?.slice(0, 8)}`
                            : `Račun ${r.invoice_no ? `#${r.invoice_no}/${r.invoice_year || ''}` : item.invoice_uuid?.slice(0, 8)}`}
                    </Text>
                    <Text style={styles.rowSub}>{fmtDt(item.created_at)}</Text>
                    {!(r.is_f2 || item.is_f2) && r.invoice_code ? <Text style={styles.rowSub}>{r.invoice_code}</Text> : null}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.rowAmount}>{fmtEUR(item.amount)}</Text>
                    <View style={styles.badgeRow}>
                        {(r.is_f2 || item.is_f2) ? <View style={[styles.badge, { backgroundColor: colors.warning }]}><Text style={styles.badgeText}>F2</Text></View> : null}
                        {hasIsland ? <View style={[styles.badge, { backgroundColor: colors.success }]}><Text style={styles.badgeText}>Otočna</Text></View> : null}
                        <View style={[styles.badge, { backgroundColor: isSynced ? colors.primary : (isLocal ? colors.warning : colors.textMuted) }]}>
                            <Text style={styles.badgeText}>{isSynced ? 'Sync' : (isLocal ? 'Pending' : 'OK')}</Text>
                        </View>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    const total = invoices.reduce((s, i) => s + (Number(i.amount) || 0), 0);

    return (
        <SafeAreaView style={styles.wrap}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => dispatch(resetSection())}>
                    <Text style={styles.backText}>‹</Text>
                </TouchableOpacity>
                <Text style={styles.title}>Dokumenti</Text>
                <TouchableOpacity style={styles.syncBtn} onPress={handleSync} disabled={sales.syncing}>
                    <Text style={styles.syncText}>{sales.syncing ? '...' : `Sync${sales.pendingCount ? ` (${sales.pendingCount})` : ''}`}</Text>
                </TouchableOpacity>
                <HomeButton style={{ marginLeft: 8 }} />
            </View>

            <View style={styles.summary}>
                <Text style={styles.summaryText}>Računa: <Text style={styles.b}>{invoices.length}</Text></Text>
                <Text style={styles.summaryText}>Ukupno: <Text style={styles.b}>{fmtEUR(total)}</Text></Text>
            </View>

            <FlatList
                data={invoices}
                keyExtractor={(it) => it.invoice_uuid}
                renderItem={renderItem}
                refreshing={loading}
                onRefresh={refresh}
                ListEmptyComponent={
                    !loading ? <Text style={styles.empty}>Nema lokalno spremljenih računa.</Text> : null
                }
                contentContainerStyle={invoices.length ? null : { flex: 1, justifyContent: 'center' }}
            />

            <Modal visible={!!selected} transparent animationType="fade" onRequestClose={closeDetail}>
                <View style={styles.modalBackdrop}>
                    <View style={styles.modalCard}>
                        {selected ? (() => {
                            const r = invoiceRaw(selected);
                            return (
                                <>
                                    <Text style={styles.modalTitle}>
                                        {r.is_f2 || selected.is_f2
                                            ? `Račun ${r.invoice_code || ''}`
                                            : `Račun ${r.invoice_no ? `#${r.invoice_no}/${r.invoice_year || ''}` : ''}`}
                                    </Text>
                                    {(r.is_f2 || selected.is_f2) ? (
                                        <Text style={[styles.modalSub, { color: colors.warning, fontWeight: '700' }]}>F2 — R1 fiskalizirani račun</Text>
                                    ) : null}
                                    {!(r.is_f2 || selected.is_f2) && r.invoice_code ? <Text style={styles.modalSub}>{r.invoice_code}</Text> : null}
                                    <Text style={styles.modalSub}>{fmtDt(selected.created_at)}</Text>
                                    <Text style={styles.modalSub}>{r.payment_method_name || ''}</Text>

                                    <ScrollView style={{ maxHeight: 280, marginTop: 12 }}>
                                        {detailTickets.length === 0 ? (
                                            <Text style={styles.empty}>Nema karata.</Text>
                                        ) : detailTickets.map((t) => (
                                            <View key={t.ticket_uuid} style={styles.ticketRow}>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={styles.ticketName}>
                                                        {t.ticket_type_name}{t.is_island && t.seop_card_no ? ` — ${t.seop_card_no}` : ''}
                                                    </Text>
                                                    <Text style={styles.ticketSub}>
                                                        {t.departure_harbor_name} → {t.arrival_harbor_name}
                                                    </Text>
                                                    <Text style={styles.ticketSub}>Kod: {t.ticket_code}</Text>
                                                </View>
                                                <Text style={styles.ticketPrice}>{fmtEUR(t.single_price)}</Text>
                                            </View>
                                        ))}
                                    </ScrollView>

                                    <View style={styles.totalRow}>
                                        <Text style={styles.b}>UKUPNO</Text>
                                        <Text style={styles.b}>{fmtEUR(selected.amount)}</Text>
                                    </View>

                                    <View style={styles.actions}>
                                        <TouchableOpacity
                                            style={[styles.actionBtn, styles.actionBtnNeutral, printing && { opacity: 0.5 }]}
                                            disabled={printing}
                                            onPress={handleReprint}
                                        >
                                            <Text style={[styles.actionText, styles.actionTextNeutral]}>{printing ? 'Ispis…' : 'Ispis'}</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.actionBtn, { backgroundColor: colors.error }, (selected?.is_canceled || invoiceRaw(selected || {}).invoice_canceled || selected?.is_storno || invoiceRaw(selected || {}).is_storno) && { opacity: 0.4 }]}
                                            disabled={selected?.is_canceled || invoiceRaw(selected || {}).invoice_canceled || selected?.is_storno || invoiceRaw(selected || {}).is_storno}
                                            onPress={openStorno}
                                        >
                                            <Text style={styles.actionText}>Storno</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.actionBtn, { backgroundColor: colors.primary }]}
                                            onPress={closeDetail}
                                        >
                                            <Text style={styles.actionText}>Zatvori</Text>
                                        </TouchableOpacity>
                                    </View>
                                </>
                            );
                        })() : null}
                    </View>
                </View>
            </Modal>

            {/* STORNO MODAL */}
            <Modal visible={stornoOpen} transparent animationType="slide" onRequestClose={closeStorno}>
                <View style={styles.modalBackdrop}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>Storno računa</Text>
                        <Text style={styles.modalSub}>Označi karte koje stornirati i unesi postotak povrata.</Text>

                        <ScrollView style={{ maxHeight: 240, marginTop: 12 }}>
                            {detailTickets.filter((t) => !t.is_canceled).map((t) => {
                                const checked = !!stornoTicketUuids[t.ticket_uuid];
                                return (
                                    <TouchableOpacity
                                        key={t.ticket_uuid}
                                        style={styles.ticketRow}
                                        onPress={() => setStornoTicketUuids((m) => ({ ...m, [t.ticket_uuid]: !checked }))}
                                    >
                                        <Text style={[styles.checkbox, checked && styles.checkboxOn]}>{checked ? '☑' : '☐'}</Text>
                                        <View style={{ flex: 1, marginLeft: 8 }}>
                                            <Text style={styles.ticketName}>
                                                {t.ticket_type_name}{t.is_island && t.seop_card_no ? ` — ${t.seop_card_no}` : ''}
                                            </Text>
                                            <Text style={styles.ticketSub}>Kod: {t.ticket_code}</Text>
                                        </View>
                                        <Text style={styles.ticketPrice}>{fmtEUR(t.single_price)}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>

                        <View style={{ marginTop: 12 }}>
                            <Text style={styles.modalSub}>Postotak povrata (%)</Text>
                            <TextInput
                                style={styles.input}
                                keyboardType="number-pad"
                                value={stornoPct}
                                onChangeText={(t) => setStornoPct(t.replace(/[^0-9]/g, ''))}
                                editable={!stornoSubmitting}
                            />
                        </View>

                        <View style={{ marginTop: 12 }}>
                            <Text style={styles.modalSub}>Način povrata</Text>
                            <View style={styles.pmRow}>
                                {(sync.paymentMethods || []).filter((p) => p.is_active !== false).map((p) => (
                                    <TouchableOpacity
                                        key={p.uuid}
                                        style={[styles.pmBtn, stornoPaymentUuid === p.uuid && styles.pmBtnOn]}
                                        onPress={() => setStornoPaymentUuid(p.uuid)}
                                    >
                                        <Text style={[styles.pmText, stornoPaymentUuid === p.uuid && styles.pmTextOn]}>{p.name}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        <View style={styles.actions}>
                            <TouchableOpacity
                                style={[styles.actionBtn, styles.actionBtnNeutral]}
                                onPress={closeStorno}
                                disabled={stornoSubmitting}
                            >
                                <Text style={[styles.actionText, styles.actionTextNeutral]}>Odustani</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.actionBtn, { backgroundColor: colors.error }, stornoSubmitting && { opacity: 0.5 }]}
                                onPress={submitStorno}
                                disabled={stornoSubmitting}
                            >
                                <Text style={styles.actionText}>{stornoSubmitting ? 'Storno…' : 'Provedi storno'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
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
    title: { fontSize: 18, fontWeight: '700', color: colors.textOnPrimary },
    syncBtn: { paddingHorizontal: 12, height: layout.headerButtonHeight, justifyContent: 'center', backgroundColor: colors.secondary, borderRadius: 6 },
    syncText: { color: colors.textOnSecondary, fontWeight: '700' },
    summary: {
        flexDirection: 'row', justifyContent: 'space-between',
        padding: 12, backgroundColor: colors.surfaceAlt,
        borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    summaryText: { color: colors.textSecondary, fontSize: 14 },
    b: { fontWeight: '700', color: colors.textPrimary },

    row: {
        flexDirection: 'row', alignItems: 'center', padding: 12,
        borderBottomWidth: 1, borderBottomColor: colors.border,
        backgroundColor: colors.surface,
    },
    rowTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
    rowSub: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
    rowAmount: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
    badgeRow: { flexDirection: 'row', marginTop: 4 },
    badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 4 },
    badgeText: { color: colors.textOnPrimary, fontSize: 10, fontWeight: '700' },
    empty: { color: colors.textMuted, fontSize: 14, textAlign: 'center', padding: 20 },

    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 },
    modalCard: {
        backgroundColor: colors.surface, borderRadius: 12, padding: 16, width: '100%', maxWidth: 480,
        borderWidth: 1, borderColor: colors.border,
        ...shadows.elevated,
    },
    modalTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '700' },
    modalSub: { color: colors.textSecondary, fontSize: 13, marginTop: 2 },
    ticketRow: { flexDirection: 'row', alignItems: 'center', padding: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
    ticketName: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
    ticketSub: { color: colors.textSecondary, fontSize: 11, marginTop: 1 },
    ticketPrice: { color: colors.textPrimary, fontSize: 14, fontWeight: '700' },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border, marginTop: 6 },
    actions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12, gap: 8 },
    actionBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 6 },
    actionText: { color: colors.textOnPrimary, fontWeight: '700' },
    actionBtnNeutral: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    actionTextNeutral: { color: colors.textPrimary },
    checkbox: { fontSize: 22, color: colors.textMuted },
    checkboxOn: { color: colors.primary },
    input: {
        backgroundColor: colors.surface, color: colors.textPrimary, padding: 10, borderRadius: 6,
        fontSize: 16, marginTop: 4, borderWidth: 1, borderColor: colors.border,
    },
    pmRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
    pmBtn: {
        paddingVertical: 8, paddingHorizontal: 12, backgroundColor: colors.surface,
        borderRadius: 6, marginRight: 8, marginBottom: 4,
        borderWidth: 1, borderColor: colors.border,
    },
    pmBtnOn: { backgroundColor: colors.primary, borderColor: colors.primary },
    pmText: { color: colors.textPrimary, fontSize: 13, fontWeight: '600' },
    pmTextOn: { color: colors.textOnPrimary },
});
