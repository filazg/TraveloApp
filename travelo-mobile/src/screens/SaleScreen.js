import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Keyboard,
    Modal,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { syncData, syncBuyersThunk } from '../store/slices/syncSlice';
import { voyageData, clearVoyage } from '../store/slices/voyageSlice';
import { authData } from '../store/slices/authSlice';
import { finalizeSaleThunk, salesData, clearLastInvoice, syncPendingSalesThunk, refreshPendingCountThunk } from '../store/slices/salesSlice';
import {
    fetchVoyageTicketsThunk, validateScanThunk, validationData, clearScanResult,
    getCachedTicket, updateCachedTicket, findRelatedTickets, addTicketsToCache,
    listCachedTickets, countCachedValidated,
} from '../store/slices/validationSlice';
import api from '../api/client';
import { ENDPOINTS } from '../api/config';
import { loadRecentBuyers, saveBuyer, findTicketByUuidOrCode } from '../db/repo';
import { scanOnce, onScan } from '../device/scanner';
import { startScan as akdStartScan, stopScan as akdStopScan, onCardRead as akdOnCardRead, hideKeyboard as akdHideKeyboard, akdCardAvailable } from '../device/akdCard';
import { printReceipt as printReceiptFn, printTickets as printTicketsFn } from '../device/printSale';
import { playSuccess as soundSuccess, playPrompt as soundPrompt, playError as soundError } from '../device/sound';
import HomeButton from '../components/HomeButton';
import {
    ALIGN, STYLE, bindPrinter, commitPrinterBuffer, cutPaper, enterPrinterBuffer, exitPrinterBuffer,
    getPrinterStatus, initPrinter, lineWrap, printQRCode, printRawQR, printText, setAlignment, setFontSize,
    setHeatingParams, setPrinterStyle, sunmiPrinterAvailable, waitPrinterIdle,
} from '../device/printer';
import { colors, shadows } from '../theme/colors';

const fmtEUR = (n) => `${(Number(n) || 0).toFixed(2)} €`;

// Extract HH:MM from string like "DD/MM/YYYY HH:MM" or "DD.MM.YYYY.HH:MM" or already "HH:MM".
const timeOnly = (s) => {
    if (!s) return '';
    const m = /(\d{1,2}):(\d{2})/.exec(String(s));
    return m ? `${m[1].padStart(2, '0')}:${m[2]}` : '';
};

// Extract ordered unique harbors from a voyage's legs.
// Returns [{ id, name, order }] sorted by leg departure order.
const harborsFromVoyage = (voyage) => {
    if (!voyage?.legs?.length) return [];
    const legs = voyage.legs.slice().sort(
        (a, b) => Number(a.departure_harbor_order) - Number(b.departure_harbor_order)
    );
    const out = [];
    const seen = new Set();
    const push = (id, name, order) => {
        if (seen.has(id)) return;
        seen.add(id);
        out.push({ id, name, order });
    };
    legs.forEach((l, i) => {
        if (i === 0) push(l.departure_harbor_id, l.departure_harbor_name, Number(l.departure_harbor_order));
        push(l.arrival_harbor_id, l.arrival_harbor_name, Number(l.arrival_harbor_order));
    });
    return out;
};

export default function SaleScreen() {
    const dispatch = useDispatch();
    const sync = useSelector(syncData);
    const voyage = useSelector(voyageData);
    const auth = useSelector(authData);
    const sales = useSelector(salesData);
    const validation = useSelector(validationData);
    const v = voyage.selected;

    // Mode: 'sale' = prodaja karata; 'validate' = ulazna validacija pri ukrcaju.
    const [mode, setMode] = useState('sale');

    const harbors = useMemo(() => harborsFromVoyage(v), [v]);
    const [fromIdx, setFromIdx] = useState(0);
    const [toIdx, setToIdx] = useState(harbors.length > 1 ? 1 : 0);
    const [qtyByType, setQtyByType] = useState({});
    const [scanResult, setScanResult] = useState(null); // { code, at }
    const [paymentMethodUuid, setPaymentMethodUuid] = useState(null);
    // Otočne karte u košarici — svaka kao zaseban entry s SEOP metadata.
    const [islandTickets, setIslandTickets] = useState([]);
    const [islandModalOpen, setIslandModalOpen] = useState(false);
    const islandInputRef = useRef(null);
    const [islandCardNo, setIslandCardNo] = useState('');
    const [islandChecking, setIslandChecking] = useState(false);
    const [islandResult, setIslandResult] = useState(null);
    const [islandError, setIslandError] = useState(null);

    // Sve route_uuid-ovi koji pripadaju odabranom polasku — koristi se za fetch
    // svih karata polaska iz svih prodajnih kanala (validacija scope).
    const voyageRouteUuids = useMemo(() => {
        if (!v) return [];
        return (sync.salesRoutes || [])
            .filter((r) => r.timetable_uuid === v.timetable_uuid
                && r.sequence === v.sequence
                && r.departure_date === v.departure_date)
            .map((r) => r.uuid);
    }, [v, sync.salesRoutes]);

    // Default payment method = first active sync'd one.
    useEffect(() => {
        if (!paymentMethodUuid && sync.paymentMethods?.length) {
            setPaymentMethodUuid(sync.paymentMethods[0].uuid);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sync.paymentMethods]);

    // Background scanner lifecycle. Routes scan po trenutnom modu — sale samo
    // pokaže kod, validate dispatcha validateScanThunk.
    const modeRef = useRef(mode);
    useEffect(() => { modeRef.current = mode; }, [mode]);

    useEffect(() => {
        dispatch(refreshPendingCountThunk());
        // NAPOMENA: background onScan (broadcast) listener je uklonjen. Sunmi V2s
        // u keyboard output modu emitira I broadcast I keystrokes za isti scan —
        // broadcast stigne prvi, keystrokes ~1-2s kasnije, što je u validaciji
        // rezultiralo sa "VALIDIRANO" pa "VEĆ VALIDIRANO" pop-upima. Sad koristimo
        // samo TextInput keystroke pristup (u ValidationPanel).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Izdvojena logika obrade scan-a — koristi se iz hardware listener-a i
    // iz kamera-based scanOnce() gumba.
    const processScan = async (code) => {
        if (!code) return;
        // Dok je otvoren modal "Otočna iskaznica", ignoriraj sve scan eventove —
        // Sunmi V2s NFC dispatch može emitirati UID čipa u hidden scan TextInput
        // što bi pucalo u "Karta nije pronađena" reject. NFC modul (TapLinx) ima
        // vlastiti put za otočne iskaznice, ne kroz scan listener.
        if (islandModalOpen) return;
        try {
            const ticketUuid = String(code || '').split(';')[0].trim();
            let local = getCachedTicket(ticketUuid);
            // Fallback: ako u memory cache-u nema (Validacija tab ne uključuje
            // svjeze prodane karte ili je polazak prebačen), pogledaj lokalnu
            // SQLite bazu — tu su SVE mobile prodaje od ovog terminala.
            if (!local) {
                try {
                    const dbTicket = await findTicketByUuidOrCode(ticketUuid);
                    if (dbTicket) {
                        local = dbTicket;
                        addTicketsToCache([dbTicket]); // ubaci u memory za sljedeći put
                    }
                } catch (_) {}
            }
            // Provjera pripada li karta TRENUTNOM polasku. SQLite fallback
            // (findTicketByUuidOrCode) vraća bilo koju kartu koju je terminal
            // prodao — može biti za drugi datum/liniju, pa moramo dodatno filtrirati.
            // voyageRouteUuids je već filtriran po (timetable_uuid, sequence, date)
            // pa match na route_uuid implicitno potvrđuje i polazak i datum.
            const voyageMismatch = Boolean(
                local
                && voyageRouteUuids.length
                && local.route_uuid
                && !voyageRouteUuids.includes(String(local.route_uuid))
            );
            // Date fallback: ako karta nema route_uuid, usporedi datum polaska.
            const dateMismatch = Boolean(
                local
                && !local.route_uuid
                && local.departure_planed
                && v?.departure_date
                && String(local.departure_planed).slice(0, 10) !== String(v.departure_date).slice(0, 10)
            );

            let result;
            if (!local) {
                result = { kind: 'reject', message: 'Karta nije pronađena za ovaj polazak.' };
                soundError();
            } else if (voyageMismatch || dateMismatch) {
                result = { kind: 'reject', message: 'Karta nije za ovaj polazak.', ticket: local };
                soundError();
            } else if (local.is_canceled) {
                result = { kind: 'reject', message: 'Karta je stornirana.', ticket: local };
                soundError();
            } else if (local.status === 'validated' || local.validate_data) {
                result = { kind: 'already', ticket: local };
                soundError();
            } else {
                // Uvijek tražimo ručnu potvrdu — scan samo prikaže info, user tap-ne
                // gumb za validaciju. Harbor mismatch je flag koji mijenja boju/poruku.
                const selectedHarbor = fromHarbor;
                const harborMismatch = Boolean(
                    selectedHarbor
                    && local.departure_harbor_id
                    && String(local.departure_harbor_id) !== String(selectedHarbor.id)
                );
                const related = findRelatedTickets(local.order_uuid, local.ticket_uuid);
                result = {
                    kind: 'confirm',
                    ticket: local,
                    harborMismatch,
                    expectedHarborName: local.departure_harbor_name,
                    selectedHarborName: selectedHarbor?.name || '',
                    related,
                };
                soundPrompt();
            }
            setScanResult({ code, at: new Date(), result });
        } catch (err) {
            console.warn('[processScan] error:', err?.message || err);
        }
    };

    // Validira jednu ili više karata — lokalni cache + backend POST (fire-and-forget).
    const doValidate = (tickets) => {
        soundSuccess();
        const nowIso = new Date().toISOString();
        const operator = auth.operator ? {
            uuid: auth.operator.user_uuid,
            name: `${auth.operator.user_name || ''} ${auth.operator.user_surname || ''}`.trim(),
        } : null;
        const terminalUuid = sync.basicData?.billing_device_uuid;
        for (const t of tickets) {
            updateCachedTicket(t.ticket_uuid, { status: 'validated', validate_data: nowIso });
            try {
                api.post(ENDPOINTS.validateTicket, {
                    ticket_uuid: t.ticket_uuid,
                    terminal_uuid: terminalUuid,
                    operator,
                }, { timeout: 8000 })
                    .then(() => console.log('[doValidate] backend OK', t.ticket_uuid))
                    .catch((e) => console.log('[doValidate] POST failed:', e?.message || e));
            } catch (e) {
                console.log('[doValidate] sync error:', e?.message || e);
            }
        }
    };

    // Handler za gumbe u Choice overlay-u.
    const onValidateOnlyOne = () => {
        const t = scanResult?.result?.ticket;
        if (!t) { setScanResult(null); return; }
        doValidate([t]);
        setScanResult({
            ...scanResult,
            result: { kind: 'validated', ticket: { ...t, status: 'validated', validate_data: new Date().toISOString() } },
        });
    };

    const onValidateAll = () => {
        const r = scanResult?.result;
        if (!r?.ticket) { setScanResult(null); return; }
        const all = [r.ticket, ...(r.related || [])];
        doValidate(all);
        setScanResult({
            ...scanResult,
            result: { kind: 'validated', ticket: r.ticket, validatedCount: all.length },
        });
    };


    // Kamera-based fallback scan (poziva Sunmi QR scanner Activity).
    const handleScan = async () => {
        const code = await scanOnce();
        if (!code) return;
        processScan(code);
    };

    // Pri odabiru polaska odmah povuci sve karte (koristi se i u sale modu za
    // background validaciju preko scanner-a).
    useEffect(() => {
        if (!v || !voyageRouteUuids.length) return;
        dispatch(fetchVoyageTicketsThunk({
            date: v.departure_date,
            routeUuids: voyageRouteUuids,
        }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [v?.timetable_uuid, v?.sequence, v?.departure_date]);

    // Keep to-index at or after from-index.
    useEffect(() => {
        if (toIdx <= fromIdx) setToIdx(Math.min(fromIdx + 1, harbors.length - 1));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fromIdx]);

    const fromHarbor = harbors[fromIdx];
    const toHarbor = harbors[toIdx];

    // Scheduled times at the selected harbors.
    const fromLeg = v?.legs?.find((l) => l.departure_harbor_id === fromHarbor?.id);
    const toLeg = v?.legs?.find((l) => l.arrival_harbor_id === toHarbor?.id);
    const fromTime = timeOnly(fromLeg?.departure_time || fromLeg?.departure);
    const toTime = timeOnly(toLeg?.arrival || toLeg?.actual_arrival);

    // Prices for this voyage + selected (from → to) pair.
    // Otočne cijene (is_island=true) izvlačimo zasebno — ne pojavljuju se u
    // standardnoj listi tipova; dolaze samo kroz "Kupi otočnu kartu" modal.
    const pricesForPairAll = useMemo(() => {
        if (!v || !fromHarbor || !toHarbor) return [];
        const ttUuid = v.timetable_uuid;
        const matches = sync.tripsPrices.filter(
            (p) => p.timetable_uuid === ttUuid
                && ((p.harbor_from_code === fromHarbor.id && p.harbor_to_code === toHarbor.id)
                    || (p.harbor_to_code === fromHarbor.id && p.harbor_from_code === toHarbor.id))
                && (p.is_active !== false)
        );
        const seen = new Map();
        for (const p of matches) {
            if (!seen.has(p.ticket_type_uuid)) seen.set(p.ticket_type_uuid, p);
        }
        return [...seen.values()];
    }, [v, fromHarbor, toHarbor, sync.tripsPrices]);

    const pricesForPair = useMemo(
        () => pricesForPairAll.filter((p) => p.is_island !== true),
        [pricesForPairAll]
    );
    const islandPriceRow = useMemo(
        () => pricesForPairAll.find((p) => p.is_island === true) || null,
        [pricesForPairAll]
    );

    const total = useMemo(() => {
        const reg = pricesForPair.reduce((sum, p) => sum + (qtyByType[p.ticket_type_uuid] || 0) * Number(p.price || 0), 0);
        const isl = islandTickets.reduce((sum, t) => sum + Number(t.single_price || 0), 0);
        return reg + isl;
    }, [pricesForPair, qtyByType, islandTickets]);

    const anyQty = Object.values(qtyByType).some((n) => n > 0) || islandTickets.length > 0;

    const bumpQty = (uuid, delta) =>
        setQtyByType((q) => ({ ...q, [uuid]: Math.max(0, (q[uuid] || 0) + delta) }));

    // Otočna karta — modal flow (kao web). Provjeri pravo preko gateway-a, primjeni
    // SEOP popust na otočnu osnovicu iz cjenika i dodaj kao zaseban ticket u košaricu.
    const closeIslandModal = () => {
        // RN Keyboard.dismiss() na Sunmi ne radi kad je modal full-screen Window.
        // Native hideSoftInputFromWindow + clearFocus je pouzdaniji.
        try { islandInputRef.current?.blur(); } catch (_) {}
        akdHideKeyboard().catch(() => {});
        setTimeout(() => {
            setIslandModalOpen(false);
            setIslandCardNo('');
            setIslandResult(null);
            setIslandError(null);
            setIslandChecking(false);
            if (akdCardAvailable) akdStopScan().catch(() => {});
            // Još jedan native hide nakon unmount-a (re-fokus na hidden scan).
            setTimeout(() => { akdHideKeyboard().catch(() => {}); }, 150);
        }, 60);
    };

    // Dok je modal otvoren, slušaj NFC i auto-fill broj iskaznice.
    useEffect(() => {
        console.log('[island modal] open=', islandModalOpen, 'akdAvailable=', akdCardAvailable);
        if (!islandModalOpen) {
            // Pri zatvaranju očisti scan buffer da leftover NFC keystrokes
            // ne trigger-aju validaciju ("Karta nije pronađena").
            setScanBuffer('');
            return;
        }
        // Isto i pri otvaranju — buffer možda već sadrži parcijalne keystrokes.
        setScanBuffer('');
        if (!akdCardAvailable) return;
        let unsub = () => {};
        akdStartScan()
            .then((r) => console.log('[island] akdStartScan resolved:', r))
            .catch((err) => console.warn('[island] akdStartScan err', err?.message, err?.code));
        unsub = akdOnCardRead((payload) => {
            console.log('[island] akdCardRead', JSON.stringify(payload));
            if (payload?.error) {
                setIslandError(payload.error);
                return;
            }
            const num = String(payload?.cardNumber || '').trim();
            if (!num) {
                setIslandError('Kartica pročitana ali nema broja iskaznice');
                return;
            }
            // Popuni input + odmah pokreni SEOP provjeru — korisnik ne mora ništa klikati.
            setIslandCardNo(num);
            setIslandError(null);
            setIslandResult(null);
            verifyIslandFor(num);
        });
        return () => {
            unsub();
            akdStopScan().catch(() => {});
        };
    }, [islandModalOpen]);

    const verifyIslandFor = async (cardNoArg) => {
        const cardNo = String(cardNoArg || '').trim();
        if (!cardNo || !matchingRoute) return;
        setIslandChecking(true);
        setIslandError(null);
        setIslandResult(null);
        try {
            const resp = await api.post(ENDPOINTS.checkIslandCard, {
                card_no: cardNo,
                route: {
                    line_no: matchingRoute.line_code,
                    departure_harbor_code: matchingRoute.departure_harbor_id,
                    arrival_harbor_code: matchingRoute.arrival_harbor_id,
                },
                date: matchingRoute.departure || `${matchingRoute.departure_date} ${matchingRoute.departure_time}`,
            });
            setIslandResult(resp.data?.data || resp.data);
        } catch (err) {
            setIslandError(err?.response?.data?.data?.message || err?.message || 'Greška u provjeri');
        } finally {
            setIslandChecking(false);
        }
    };

    const handleVerifyIsland = () => verifyIslandFor(islandCardNo);

    const confirmIslandPurchase = () => {
        if (!islandResult?.ima_pravo || !islandPriceRow) return;
        const pct = Number(islandResult.popust_postotak || 0);
        const factor = 1 - pct / 100;
        const unit = +(Number(islandPriceRow.price) * factor).toFixed(2);
        const newTicket = {
            ticket_type_uuid: islandPriceRow.ticket_type_uuid,
            ticket_type_name: islandPriceRow.ticket_type_name || 'Otočna karta',
            single_price: unit,
            seop_card_no: islandCardNo,
            seop_pravo: islandResult.pravo_na_pp || null,
            seop_otok: islandResult.otok || null,
            seop_discount_pct: pct,
        };
        setIslandTickets((arr) => [...arr, newTicket]);
        closeIslandModal();
    };

    const removeIslandTicket = (idx) => {
        setIslandTickets((arr) => arr.filter((_, i) => i !== idx));
    };

    // Find the matching sales_route uuid for selected (from→to) pair on this voyage.
    const matchingRoute = useMemo(() => {
        if (!v || !fromHarbor || !toHarbor) return null;
        return sync.salesRoutes.find(
            (r) => r.timetable_uuid === v.timetable_uuid
                && r.sequence === v.sequence
                && r.departure_date === v.departure_date
                && r.departure_harbor_id === fromHarbor.id
                && r.arrival_harbor_id === toHarbor.id
        );
    }, [v, fromHarbor, toHarbor, sync.salesRoutes]);

    // Print račun + karte preko zajedničkog modula (src/device/printSale.js).
    // Iste funkcije koristi i DocumentsScreen za reprint.
    const printReceipt = async (r, items, paymentName) => {
        await printReceiptFn({
            r,
            items,
            paymentName,
            basicData: sync.basicData,
            operator: auth.operator,
            voyage: v,
            fromHarbor,
            toHarbor,
            isReprint: false,
        });
    };
    const printTickets = async (tickets) => {
        await printTicketsFn({
            tickets,
            basicData: sync.basicData,
            voyage: v,
            isReprint: false,
        });
    };


    const [issueModalOpen, setIssueModalOpen] = useState(false);

    // Otvara modal s izborom plaćanja i podacima kupca.
    const onIssue = () => {
        if (!matchingRoute) {
            Alert.alert('Prodaja', 'Nema rute za odabrane luke.');
            return;
        }
        if (!sync.basicData?.billing_device_uuid) {
            Alert.alert('Prodaja', 'Nedostaje podatak o naplatnom uređaju (basic_data).');
            return;
        }
        if (!(sync.paymentMethods || []).length) {
            Alert.alert('Prodaja', 'Nema sinkroniziranih načina plaćanja.');
            return;
        }
        if (!anyQty) return;
        // Fire-and-forget sync adresara sa backenda pred otvaranje modala.
        dispatch(syncBuyersThunk());
        setIssueModalOpen(true);
    };

    const [printing, setPrinting] = useState(false);
    const [printingLabel, setPrintingLabel] = useState('');

    // Finalizira sale s odabranim plaćanjem i (opcionalno) podacima kupca iz modala.
    const submitIssue = async ({ pm, buyer }) => {
        const terminalUuid = sync.basicData?.billing_device_uuid;
        const route = {
            route_uuid: matchingRoute.uuid,
            line_code: matchingRoute.line_code,
            line_name: matchingRoute.line_name,
            departure_harbor_id: matchingRoute.departure_harbor_id,
            departure_harbor_name: matchingRoute.departure_harbor_name,
            arrival_harbor_id: matchingRoute.arrival_harbor_id,
            arrival_harbor_name: matchingRoute.arrival_harbor_name,
            departure_planned: matchingRoute.departure || `${matchingRoute.departure_date} ${matchingRoute.departure_time}`,
            arrival_planned: matchingRoute.arrival
                || (matchingRoute.arrival_date && matchingRoute.arrival_time
                    ? `${matchingRoute.arrival_date} ${matchingRoute.arrival_time}`
                    : (matchingRoute.arrival_time
                        ? `${matchingRoute.departure_date} ${matchingRoute.arrival_time}`
                        : '')),
        };
        const items = pricesForPair
            .map((p) => ({
                ticket_type_uuid: p.ticket_type_uuid,
                ticket_type_name: p.ticket_type_name,
                qty: qtyByType[p.ticket_type_uuid] || 0,
                unit_price: Number(p.price),
                route,
            }))
            .filter((i) => i.qty > 0);
        // Otočne karte: svaka iskaznica je svoj item (qty=1) sa SEOP metadata.
        for (const it of islandTickets) {
            items.push({
                ticket_type_uuid: it.ticket_type_uuid,
                ticket_type_name: it.ticket_type_name,
                qty: 1,
                unit_price: Number(it.single_price),
                is_island: true,
                seop_card_no: it.seop_card_no,
                seop_pravo: it.seop_pravo,
                seop_otok: it.seop_otok,
                seop_discount_pct: it.seop_discount_pct,
                route,
            });
        }
        if (!items.length) return;

        const op = auth.operator || {};
        const payload = {
            items,
            terminal_uuid: terminalUuid,
            payment_method_uuid: pm.uuid,
            operator: {
                uuid: op.user_uuid,
                username: op.user_username,
                name: `${op.user_name || ''} ${op.user_surname || ''}`.trim(),
                mark: op.user_mark,
                oib: op.user_legal_id || op.legal_id || null,
            },
            buyer: buyer || {},
            _voyageKey: v ? `${v.timetable_uuid}|${v.sequence}|${v.departure_date}` : null,
        };

        setIssueModalOpen(false);
        setPrinting(true);
        setPrintingLabel('Generiranje računa…');
        try {
            const res = await dispatch(finalizeSaleThunk(payload));
            if (res.meta.requestStatus === 'fulfilled') {
                const r = res.payload;
                // Dodaj novoizdane karte u validation cache — pojavit će se
                // na Validacija tabu bez potrebe za ručnim Refresh-om.
                addTicketsToCache(r.tickets || []);
                setPrintingLabel('Ispis računa…');
                await printReceipt(r, items, pm.name);
                setPrintingLabel(`Ispis karata… (${(r.tickets || []).length})`);
                await printTickets(r.tickets || []);
                setQtyByType({});
                setIslandTickets([]);
                dispatch(clearLastInvoice());
                if (!r._local && sales.pendingCount > 0) {
                    dispatch(syncPendingSalesThunk());
                }
            } else {
                Alert.alert('Greška', res.payload?.message || 'Izdavanje nije uspjelo');
            }
        } finally {
            setPrinting(false);
            setPrintingLabel('');
        }
    };

    // Background scan capture — hidden autofocused TextInput na ROOT-u SaleScreen-a.
    // Sunmi V2s scanner u keyboard modu tipka QR + ENTER; TextInput proguta sve
    // keystrokes (pa i u Prodaji) i zove processScan. Overlay pokriva cijeli ekran.
    const scanInputRef = useRef(null);
    const [scanBuffer, setScanBuffer] = useState('');
    // Kad user tipka u druge input polja (search u Validacija, itd.), pauziraj
    // auto-re-focus na scan input (inače svake 400ms krade focus i scan TextInput
    // hvata normalnu tipkovnicu → loading overlay "PROVJERA KARTE").
    const userTypingRef = useRef(false);

    useEffect(() => {
        const t = setInterval(() => {
            if (scanResult?.result) return;
            if (userTypingRef.current) return;
            if (issueModalOpen) return;     // ne krade fokus dok je R1 modal otvoren
            if (printing) return;           // ne krade fokus dok traje ispis
            try { scanInputRef.current?.focus(); } catch (_) {}
        }, 400);
        return () => clearInterval(t);
    }, [scanResult, issueModalOpen, printing]);

    const handleScanSubmit = (e) => {
        const text = (e?.nativeEvent?.text || scanBuffer || '').trim();
        setScanBuffer('');
        if (text) processScan(text);
    };

    if (!v) return null;

    return (
        <SafeAreaView style={styles.wrap}>
            {/* Background scan capture (hidden TextInput) — disable-an dok je
                otočni modal otvoren da ne preuzme fokus i ne otvori IME. */}
            <TextInput
                ref={scanInputRef}
                value={scanBuffer}
                onChangeText={setScanBuffer}
                onSubmitEditing={handleScanSubmit}
                blurOnSubmit={false}
                autoFocus={!islandModalOpen}
                editable={!islandModalOpen}
                showSoftInputOnFocus={false}
                caretHidden
                style={styles.hiddenScanInput}
            />

            {/* Loading overlay dok scanner tipka sadržaj (prije ENTER-a) */}
            {scanBuffer.length > 0 && !scanResult?.result && (
                <ScanLoadingOverlay />
            )}

            {/* Full-screen scan result overlay */}
            {scanResult?.result && (
                <ScanResultOverlay
                    result={scanResult.result}
                    onDismiss={() => {
                        setScanResult(null);
                        setTimeout(() => { try { scanInputRef.current?.focus(); } catch (_) {} }, 50);
                    }}
                    onValidateOnlyOne={onValidateOnlyOne}
                    onValidateAll={onValidateAll}
                />
            )}

            {/* HEADER */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => {
                    console.log('[backBtn] tapped — dispatching clearVoyage');
                    dispatch(clearVoyage());
                }}>
                    <Text style={styles.backText} numberOfLines={1}>‹ Polasci</Text>
                </TouchableOpacity>
                {/* MODE TOGGLE — Prodaja / Validacija */}
                <View style={styles.modeToggle}>
                    <TouchableOpacity
                        style={[styles.modeBtn, mode === 'sale' && styles.modeBtnActive]}
                        onPress={() => setMode('sale')}
                    >
                        <Text style={[styles.modeBtnText, mode === 'sale' && styles.modeBtnTextActive]}>Prodaja</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.modeBtn, mode === 'validate' && styles.modeBtnActive]}
                        onPress={() => setMode('validate')}
                    >
                        <Text style={[styles.modeBtnText, mode === 'validate' && styles.modeBtnTextActive]}>Validacija</Text>
                    </TouchableOpacity>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', minWidth: 100 }}>
                    {sales.pendingCount > 0 ? (
                        <TouchableOpacity
                            style={styles.pendingBadge}
                            onPress={() => dispatch(syncPendingSalesThunk())}
                            disabled={sales.syncing}
                        >
                            {sales.syncing
                                ? <ActivityIndicator color={colors.textOnPrimary} size="small" />
                                : <Text style={styles.pendingText}>↑ {sales.pendingCount}</Text>}
                        </TouchableOpacity>
                    ) : null}
                    <HomeButton style={{ marginLeft: 8 }} />
                </View>
            </View>

            {mode === 'validate' ? (
                <ValidationPanel
                    voyage={v}
                    validation={validation}
                    scanResult={scanResult}
                    onScan={handleScan}
                    onClearScan={() => setScanResult(null)}
                    onRefresh={() => dispatch(fetchVoyageTicketsThunk({
                        date: v.departure_date,
                        routeUuids: voyageRouteUuids,
                    }))}
                    onTicketTap={(ticketUuid) => processScan(ticketUuid)}
                    userTypingRef={userTypingRef}
                    fromHarbor={fromHarbor}
                    harbors={harbors}
                    fromIdx={fromIdx}
                    setFromIdx={setFromIdx}
                />
            ) : (
            <ScrollView contentContainerStyle={{ paddingBottom: 160 }}>
                {/* VOYAGE INFO — slim */}
                <View style={styles.voyageBoxSlim}>
                    <Text style={styles.voyageLineSlim}>{v.line_code} · {v.line_name}</Text>
                </View>

                {/* FROM HARBOR */}
                <Text style={styles.sectionLabel}>OD LUKE</Text>
                <View style={styles.selectorRow}>
                    <TouchableOpacity
                        style={[styles.arrow, fromIdx === 0 && styles.arrowDisabled]}
                        disabled={fromIdx === 0}
                        onPress={() => setFromIdx((i) => Math.max(0, i - 1))}
                    >
                        <Text style={styles.arrowText}>◀</Text>
                    </TouchableOpacity>
                    <View style={styles.selectorValue}>
                        <Text style={styles.selectorText} numberOfLines={1}>{fromHarbor?.name || '—'}</Text>
                        {fromTime ? <Text style={styles.selectorTime}>{fromTime}</Text> : null}
                    </View>
                    <TouchableOpacity
                        style={[styles.arrow, fromIdx >= harbors.length - 2 && styles.arrowDisabled]}
                        disabled={fromIdx >= harbors.length - 2}
                        onPress={() => setFromIdx((i) => Math.min(harbors.length - 2, i + 1))}
                    >
                        <Text style={styles.arrowText}>▶</Text>
                    </TouchableOpacity>
                </View>

                {/* TO HARBOR */}
                <Text style={styles.sectionLabel}>DO LUKE</Text>
                <View style={styles.selectorRow}>
                    <TouchableOpacity
                        style={[styles.arrow, toIdx <= fromIdx + 1 && styles.arrowDisabled]}
                        disabled={toIdx <= fromIdx + 1}
                        onPress={() => setToIdx((i) => Math.max(fromIdx + 1, i - 1))}
                    >
                        <Text style={styles.arrowText}>◀</Text>
                    </TouchableOpacity>
                    <View style={styles.selectorValue}>
                        <Text style={styles.selectorText} numberOfLines={1}>{toHarbor?.name || '—'}</Text>
                        {toTime ? <Text style={styles.selectorTime}>{toTime}</Text> : null}
                    </View>
                    <TouchableOpacity
                        style={[styles.arrow, toIdx >= harbors.length - 1 && styles.arrowDisabled]}
                        disabled={toIdx >= harbors.length - 1}
                        onPress={() => setToIdx((i) => Math.min(harbors.length - 1, i + 1))}
                    >
                        <Text style={styles.arrowText}>▶</Text>
                    </TouchableOpacity>
                </View>

                {/* CATEGORIES */}
                <Text style={styles.sectionLabel}>TIPOVI KARATA</Text>
                {pricesForPair.length === 0 ? (
                    <View style={styles.emptyCat}>
                        <Text style={styles.emptyCatText}>Nema cjenika za ovu relaciju.</Text>
                    </View>
                ) : (
                    pricesForPair.map((p) => {
                        const q = qtyByType[p.ticket_type_uuid] || 0;
                        return (
                            <View key={p.uuid} style={styles.catRow}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.catName}>{p.ticket_type_name}</Text>
                                    <Text style={styles.catPrice}>{fmtEUR(p.price)}</Text>
                                </View>
                                <View style={styles.qtyRow}>
                                    <TouchableOpacity
                                        style={[styles.qtyBtn, q === 0 && styles.qtyBtnDisabled]}
                                        disabled={q === 0}
                                        onPress={() => bumpQty(p.ticket_type_uuid, -1)}
                                    >
                                        <Text style={styles.qtyBtnText}>–</Text>
                                    </TouchableOpacity>
                                    <Text style={styles.qtyValue}>{q}</Text>
                                    <TouchableOpacity
                                        style={styles.qtyBtn}
                                        onPress={() => bumpQty(p.ticket_type_uuid, 1)}
                                    >
                                        <Text style={styles.qtyBtnText}>+</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        );
                    })
                )}

                {/* OTOČNA KARTA — gumb i lista dodanih otočnih karata u košarici */}
                {islandPriceRow && (
                    <View style={styles.islandSection}>
                        <Text style={styles.sectionLabel}>OTOČNA KARTA</Text>
                        <TouchableOpacity
                            style={styles.islandBtn}
                            onPress={() => setIslandModalOpen(true)}
                        >
                            <Text style={styles.islandBtnText}>+ Kupi otočnu kartu</Text>
                        </TouchableOpacity>
                        {islandTickets.map((t, i) => (
                            <View key={`${t.seop_card_no}-${i}`} style={styles.islandRow}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.islandRowTitle}>Otočna karta — {t.seop_card_no}</Text>
                                    <Text style={styles.islandRowSub}>
                                        {[t.seop_otok, t.seop_pravo, `-${t.seop_discount_pct}%`].filter(Boolean).join(' · ')}
                                    </Text>
                                </View>
                                <Text style={styles.islandRowPrice}>{fmtEUR(t.single_price)}</Text>
                                <TouchableOpacity
                                    style={[styles.qtyBtn, { marginLeft: 8 }]}
                                    onPress={() => removeIslandTicket(i)}
                                >
                                    <Text style={styles.qtyBtnText}>×</Text>
                                </TouchableOpacity>
                            </View>
                        ))}
                    </View>
                )}
            </ScrollView>
            )}

            {/* BOTTOM (samo prodaja): total + Izdaj račun (otvara IssueReceiptModal) */}
            {mode === 'sale' && (
            <View style={styles.bottom}>
                <View style={styles.bottomRow}>
                    <View style={styles.totalBox}>
                        <Text style={styles.totalLabel}>UKUPNO</Text>
                        <Text style={styles.totalValue}>{fmtEUR(total)}</Text>
                    </View>
                    <TouchableOpacity
                        style={[styles.issueBtn, (!anyQty || sales.finalizing) && styles.issueBtnDisabled]}
                        disabled={!anyQty || sales.finalizing}
                        onPress={onIssue}
                    >
                        {sales.finalizing
                            ? <ActivityIndicator color={colors.textOnPrimary} />
                            : <Text style={styles.issueBtnText}>Izdaj račun</Text>}
                    </TouchableOpacity>
                </View>
            </View>
            )}

            {/* Printing overlay — tijekom ispisa računa + karata */}
            {printing && (
                <View style={[overlayStyles.full, { backgroundColor: colors.primaryDark }]} pointerEvents="none">
                    <View style={overlayStyles.content}>
                        <ActivityIndicator size="large" color={colors.textOnPrimary} />
                        <Text style={[overlayStyles.bigLine, { marginTop: 24 }]}>ISPIS U TIJEKU</Text>
                        <Text style={overlayStyles.line}>{printingLabel || 'Pričekaj…'}</Text>
                    </View>
                </View>
            )}

            {/* Issue receipt modal — payment + buyer info, pokreće finalize */}
            {issueModalOpen && (
                <IssueReceiptModal
                    total={total}
                    paymentMethods={(sync.paymentMethods || []).filter((p) => p.is_active !== false)}
                    initialPaymentUuid={paymentMethodUuid}
                    finalizing={sales.finalizing}
                    userTypingRef={userTypingRef}
                    onCancel={() => setIssueModalOpen(false)}
                    onSubmit={(pm, buyer) => {
                        setPaymentMethodUuid(pm.uuid);
                        submitIssue({ pm, buyer });
                    }}
                />
            )}

            {/* Success modal uklonjen — nakon print-a automatski se briše lastInvoice. */}

            <Modal visible={islandModalOpen} transparent animationType="fade" onRequestClose={closeIslandModal}>
                <View style={islandStyles.backdrop}>
                    <View style={islandStyles.card}>
                        <Text style={islandStyles.title}>Otočna iskaznica</Text>

                        {!islandResult && (
                            <>
                                <Text style={islandStyles.help}>
                                    {akdCardAvailable
                                        ? 'Prislonite otočnu iskaznicu na poleđinu uređaja ili upišite broj ručno.'
                                        : 'Upišite serijski broj otočne iskaznice. Sustav provjerava pravo i izračunava cijenu.'}
                                </Text>
                                <TextInput
                                    ref={islandInputRef}
                                    style={islandStyles.input}
                                    placeholder="Broj iskaznice"
                                    keyboardType="number-pad"
                                    value={islandCardNo}
                                    onChangeText={(t) => setIslandCardNo(t.replace(/[^0-9]/g, ''))}
                                    editable={!islandChecking}
                                />
                                {islandError && <Text style={islandStyles.error}>{islandError}</Text>}
                            </>
                        )}

                        {islandResult && !islandResult.ima_pravo && (
                            <View style={islandStyles.resultErr}>
                                <Text style={islandStyles.resultErrTitle}>Iskaznica nema pravo na povlašteni prijevoz.</Text>
                                {!!islandResult.poruka && <Text style={islandStyles.resultMsg}>{islandResult.poruka}</Text>}
                            </View>
                        )}

                        {islandResult && islandResult.ima_pravo && (
                            <View style={islandStyles.resultOk}>
                                <Text style={islandStyles.resultOkTitle}>
                                    Pravo potvrđeno — popust {islandResult.popust_postotak}%
                                    {islandResult.mock ? ' (MOCK)' : ''}
                                </Text>
                                {!!islandResult.otok && (
                                    <Text style={islandStyles.resultLine}>Otok: <Text style={islandStyles.b}>{islandResult.otok}</Text></Text>
                                )}
                                {!!islandResult.pravo_na_pp && (
                                    <Text style={islandStyles.resultLine}>Pravo: <Text style={islandStyles.b}>{islandResult.pravo_na_pp}</Text></Text>
                                )}
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                                    <Text style={{ marginRight: 8 }}>Cijena:</Text>
                                    <Text style={[islandStyles.priceOld, islandResult.popust_postotak > 0 && { textDecorationLine: 'line-through' }]}>
                                        {Number(islandPriceRow?.price || 0).toFixed(2)} €
                                    </Text>
                                    {islandResult.popust_postotak > 0 && (
                                        <Text style={islandStyles.priceNew}>
                                            {(Number(islandPriceRow?.price || 0) * (1 - islandResult.popust_postotak / 100)).toFixed(2)} €
                                        </Text>
                                    )}
                                </View>
                            </View>
                        )}

                        <View style={islandStyles.actions}>
                            <TouchableOpacity style={islandStyles.btnGhost} onPress={closeIslandModal}>
                                <Text style={islandStyles.btnGhostText}>Zatvori</Text>
                            </TouchableOpacity>
                            {!islandResult && (
                                <TouchableOpacity
                                    style={[islandStyles.btnPrimary, (!islandCardNo || islandChecking) && { opacity: 0.5 }]}
                                    disabled={!islandCardNo || islandChecking}
                                    onPress={handleVerifyIsland}
                                >
                                    <Text style={islandStyles.btnPrimaryText}>{islandChecking ? 'Provjera…' : 'Provjeri pravo'}</Text>
                                </TouchableOpacity>
                            )}
                            {islandResult && islandResult.ima_pravo && (
                                <TouchableOpacity style={islandStyles.btnPrimary} onPress={confirmIslandPurchase}>
                                    <Text style={islandStyles.btnPrimaryText}>Potvrdi</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const islandStyles = StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
    card: {
        backgroundColor: colors.surface, borderRadius: 12, padding: 20, width: '100%', maxWidth: 460,
        borderWidth: 1, borderColor: colors.border,
        ...shadows.elevated,
    },
    title: { fontSize: 18, fontWeight: 'bold', marginBottom: 12, color: colors.success },
    help: { fontSize: 14, color: colors.textSecondary, marginBottom: 12 },
    input: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, fontSize: 18, marginBottom: 8, color: colors.textPrimary, backgroundColor: colors.surface },
    error: { color: colors.error, marginTop: 8 },
    resultOk: { backgroundColor: colors.successLight, borderColor: colors.success, borderWidth: 1, padding: 12, borderRadius: 8 },
    resultOkTitle: { color: colors.success, fontWeight: 'bold', marginBottom: 4 },
    resultErr: { backgroundColor: colors.errorLight, borderColor: colors.error, borderWidth: 1, padding: 12, borderRadius: 8 },
    resultErrTitle: { color: colors.error, fontWeight: 'bold' },
    resultMsg: { color: colors.textSecondary, fontStyle: 'italic', marginTop: 4 },
    resultLine: { fontSize: 14, color: colors.textPrimary },
    b: { fontWeight: 'bold' },
    priceOld: { fontSize: 16, color: colors.textMuted, marginRight: 8 },
    priceNew: { fontSize: 18, fontWeight: 'bold', color: colors.success },
    actions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16, gap: 8 },
    btnGhost: { paddingVertical: 10, paddingHorizontal: 16 },
    btnGhostText: { color: colors.textSecondary, fontSize: 16 },
    btnPrimary: { backgroundColor: colors.success, paddingVertical: 10, paddingHorizontal: 18, borderRadius: 8 },
    btnPrimaryText: { color: colors.textOnPrimary, fontSize: 16, fontWeight: 'bold' },
});

const COUNTRIES = [
    { code: 'HR', name: 'Hrvatska' },
    { code: 'SI', name: 'Slovenija' },
    { code: 'AT', name: 'Austrija' },
    { code: 'DE', name: 'Njemačka' },
    { code: 'IT', name: 'Italija' },
    { code: 'HU', name: 'Mađarska' },
    { code: 'CZ', name: 'Češka' },
    { code: 'SK', name: 'Slovačka' },
    { code: 'PL', name: 'Poljska' },
    { code: 'FR', name: 'Francuska' },
    { code: 'NL', name: 'Nizozemska' },
    { code: 'BE', name: 'Belgija' },
    { code: 'CH', name: 'Švicarska' },
    { code: 'GB', name: 'Velika Britanija' },
    { code: 'IE', name: 'Irska' },
    { code: 'ES', name: 'Španjolska' },
    { code: 'PT', name: 'Portugal' },
    { code: 'SE', name: 'Švedska' },
    { code: 'NO', name: 'Norveška' },
    { code: 'DK', name: 'Danska' },
    { code: 'FI', name: 'Finska' },
    { code: 'BA', name: 'Bosna i Hercegovina' },
    { code: 'RS', name: 'Srbija' },
    { code: 'ME', name: 'Crna Gora' },
    { code: 'MK', name: 'Sjeverna Makedonija' },
    { code: 'AL', name: 'Albanija' },
    { code: 'GR', name: 'Grčka' },
    { code: 'BG', name: 'Bugarska' },
    { code: 'RO', name: 'Rumunjska' },
    { code: 'US', name: 'SAD' },
    { code: 'CA', name: 'Kanada' },
    { code: 'OTHER', name: 'Ostalo' },
];

function CountryPicker({ value, onChange }) {
    const [open, setOpen] = useState(false);
    const current = COUNTRIES.find((c) => c.code === value) || COUNTRIES[0];
    return (
        <View>
            <TouchableOpacity style={issueStyles.input} onPress={() => setOpen((v) => !v)}>
                <Text style={{ color: colors.textPrimary, fontSize: 14 }}>
                    {current.code} — {current.name}
                </Text>
            </TouchableOpacity>
            {open && (
                <View style={issueStyles.countryList}>
                    <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled>
                        {COUNTRIES.map((c) => (
                            <TouchableOpacity
                                key={c.code}
                                style={[
                                    issueStyles.countryItem,
                                    c.code === value && issueStyles.countryItemSel,
                                ]}
                                onPress={() => { onChange(c.code); setOpen(false); }}
                            >
                                <Text style={issueStyles.countryCode}>{c.code}</Text>
                                <Text style={issueStyles.countryName}>{c.name}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            )}
        </View>
    );
}

// Modal za izdavanje računa: izbor plaćanja + F2 flag + opcionalni R1 podaci kupca.
function IssueReceiptModal({ total, paymentMethods, initialPaymentUuid, finalizing, userTypingRef, onCancel, onSubmit }) {
    const [pmUuid, setPmUuid] = useState(initialPaymentUuid || paymentMethods[0]?.uuid);
    const [f2Required, setF2Required] = useState(false);
    const [r1Open, setR1Open] = useState(false);
    const [buyerName, setBuyerName] = useState('');
    const [buyerOib, setBuyerOib] = useState('');
    const [buyerAddress, setBuyerAddress] = useState('');
    const [buyerPostal, setBuyerPostal] = useState('');
    const [buyerTown, setBuyerTown] = useState('');
    const [buyerCountry, setBuyerCountry] = useState('HR');
    const [buyerEmail, setBuyerEmail] = useState('');
    const [addrOpen, setAddrOpen] = useState(false);
    const [recentBuyers, setRecentBuyers] = useState([]);

    useEffect(() => {
        loadRecentBuyers(500).then(setRecentBuyers).catch(() => setRecentBuyers([]));
    }, []);

    const applyBuyer = (b) => {
        setBuyerName(b.name || '');
        setBuyerOib(b.oib || '');
        setBuyerAddress(b.address || '');
        setBuyerPostal(b.postal_code || '');
        setBuyerTown(b.town || '');
        setBuyerEmail(b.email || '');
        setR1Open(true);
        setF2Required(true);
        setAddrOpen(false);
    };

    const markTyping = () => { if (userTypingRef) userTypingRef.current = true; };
    const endTyping = () => {
        if (userTypingRef) setTimeout(() => { userTypingRef.current = false; }, 300);
    };

    // OIB/VAT ID — strani kupci mogu imati slova i različitu dužinu.
    const oibValid = !r1Open || (buyerOib.trim().length >= 3);
    const canIssue = pmUuid && (!r1Open || (buyerName.trim() && oibValid));

    const handleSubmit = () => {
        const pm = paymentMethods.find((p) => p.uuid === pmUuid);
        if (!pm) return;
        const buyer = r1Open ? {
            buyer_name: buyerName.trim(),
            buyer_company_name: buyerName.trim(),
            buyer_oib: buyerOib.trim(),
            buyer_address: buyerAddress.trim(),
            buyer_postal_code: buyerPostal.trim(),
            buyer_town: buyerTown.trim(),
            buyer_country: buyerCountry.trim(),
            buyer_email: buyerEmail.trim(),
            f2_required: Boolean(f2Required),
        } : {};
        // Spremi u adresar (fire-and-forget) ako je R1 s OIB-om.
        if (r1Open && buyer.buyer_oib) {
            saveBuyer(buyer).catch(() => {});
        }
        onSubmit(pm, buyer);
    };

    return (
        <View style={issueStyles.backdrop}>
            <ScrollView
                style={issueStyles.modalScroll}
                contentContainerStyle={issueStyles.modalContent}
                keyboardShouldPersistTaps="handled"
            >
                <Text style={issueStyles.title}>Izdavanje računa</Text>
                <Text style={issueStyles.total}>{(Number(total) || 0).toFixed(2)} €</Text>

                <Text style={issueStyles.sectionLabel}>NAČIN PLAĆANJA</Text>
                <View style={issueStyles.pmGrid}>
                    {paymentMethods.map((p) => {
                        const sel = p.uuid === pmUuid;
                        return (
                            <TouchableOpacity
                                key={p.uuid}
                                style={[issueStyles.pmBtn, sel && issueStyles.pmBtnActive]}
                                onPress={() => setPmUuid(p.uuid)}
                            >
                                <Text style={[issueStyles.pmBtnText, sel && issueStyles.pmBtnTextActive]}>
                                    {p.name}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity
                        style={[issueStyles.r1Toggle, { flex: 1 }]}
                        onPress={() => setR1Open((v) => !v)}
                    >
                        <View style={[issueStyles.checkbox, r1Open && issueStyles.checkboxChecked]}>
                            {r1Open ? <Text style={issueStyles.checkmark}>✓</Text> : null}
                        </View>
                        <Text style={issueStyles.r1ToggleText}>R1 račun</Text>
                    </TouchableOpacity>
                    {r1Open ? (
                        <TouchableOpacity
                            style={issueStyles.addrBtn}
                            onPress={() => setAddrOpen((v) => !v)}
                        >
                            <Text style={issueStyles.addrBtnText}>📖 Adresar ({recentBuyers.length})</Text>
                        </TouchableOpacity>
                    ) : null}
                </View>

                {addrOpen && (
                    <View style={issueStyles.addrBox}>
                        <Text style={issueStyles.fieldLabel}>Odaberi iz adresara:</Text>
                        <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                            {recentBuyers.map((b) => (
                                <TouchableOpacity
                                    key={b.oib}
                                    style={issueStyles.addrItem}
                                    onPress={() => applyBuyer(b)}
                                >
                                    <Text style={issueStyles.addrItemName}>{b.name || '(bez imena)'}</Text>
                                    <Text style={issueStyles.addrItemMeta}>
                                        OIB: {b.oib}{b.town ? ` · ${b.town}` : ''}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                )}

                {r1Open && (
                    <View style={issueStyles.r1Box}>
                        <Text style={issueStyles.fieldLabel}>Naziv / Ime kupca</Text>
                        <TextInput
                            value={buyerName}
                            onChangeText={setBuyerName}
                            onFocus={markTyping} onBlur={endTyping}
                            style={issueStyles.input}
                            placeholder="Tvrtka d.o.o."
                            placeholderTextColor={colors.textMuted}
                        />
                        <Text style={issueStyles.fieldLabel}>
                            OIB / VAT ID {buyerOib && !oibValid ? <Text style={issueStyles.err}>(min 3 znaka)</Text> : null}
                        </Text>
                        <TextInput
                            value={buyerOib}
                            onChangeText={setBuyerOib}
                            onFocus={markTyping} onBlur={endTyping}
                            autoCapitalize="characters"
                            autoCorrect={false}
                            style={issueStyles.input}
                            placeholder="12345678901 ili ATU12345678"
                            placeholderTextColor={colors.textMuted}
                            maxLength={20}
                        />
                        <Text style={issueStyles.fieldLabel}>Adresa</Text>
                        <TextInput
                            value={buyerAddress}
                            onChangeText={setBuyerAddress}
                            onFocus={markTyping} onBlur={endTyping}
                            style={issueStyles.input}
                            placeholder="Ulica i broj"
                            placeholderTextColor={colors.textMuted}
                        />
                        <View style={{ flexDirection: 'row' }}>
                            <View style={{ width: 100, marginRight: 8 }}>
                                <Text style={issueStyles.fieldLabel}>Poštanski</Text>
                                <TextInput
                                    value={buyerPostal}
                                    onChangeText={(t) => setBuyerPostal(t.replace(/\D/g, '').slice(0, 5))}
                                    onFocus={markTyping} onBlur={endTyping}
                                    keyboardType="number-pad"
                                    style={issueStyles.input}
                                    placeholder="10000"
                                    placeholderTextColor={colors.textMuted}
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={issueStyles.fieldLabel}>Grad</Text>
                                <TextInput
                                    value={buyerTown}
                                    onChangeText={setBuyerTown}
                                    onFocus={markTyping} onBlur={endTyping}
                                    style={issueStyles.input}
                                    placeholder="Zagreb"
                                    placeholderTextColor={colors.textMuted}
                                />
                            </View>
                        </View>
                        <Text style={issueStyles.fieldLabel}>Država</Text>
                        <CountryPicker value={buyerCountry} onChange={setBuyerCountry} />
                        <Text style={issueStyles.fieldLabel}>E-mail (opcionalno)</Text>
                        <TextInput
                            value={buyerEmail}
                            onChangeText={setBuyerEmail}
                            onFocus={markTyping} onBlur={endTyping}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            style={issueStyles.input}
                            placeholder="kupac@example.com"
                            placeholderTextColor={colors.textMuted}
                        />
                        <TouchableOpacity
                            style={[issueStyles.r1Toggle, { marginTop: 12, paddingVertical: 6 }]}
                            onPress={() => setF2Required((v) => !v)}
                        >
                            <View style={[issueStyles.checkbox, f2Required && issueStyles.checkboxChecked]}>
                                {f2Required ? <Text style={issueStyles.checkmark}>✓</Text> : null}
                            </View>
                            <Text style={issueStyles.r1ToggleText}>F2 fiskalizacija</Text>
                        </TouchableOpacity>
                    </View>
                )}

                <View style={issueStyles.actionsRow}>
                    <TouchableOpacity style={[issueStyles.actionBtn, issueStyles.actionBtnNeutral]} onPress={onCancel}>
                        <Text style={[issueStyles.actionBtnText, issueStyles.actionBtnTextNeutral]}>Odustani</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[issueStyles.actionBtn, { backgroundColor: colors.success, opacity: canIssue && !finalizing ? 1 : 0.5 }]}
                        onPress={handleSubmit}
                        disabled={!canIssue || finalizing}
                    >
                        {finalizing
                            ? <ActivityIndicator color={colors.textOnPrimary} />
                            : <Text style={issueStyles.actionBtnText}>Izdaj</Text>}
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </View>
    );
}

const issueStyles = StyleSheet.create({
    backdrop: {
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 800, elevation: 18,
        justifyContent: 'center',
        paddingHorizontal: 12,
    },
    modalScroll: {
        flexGrow: 0, maxHeight: '95%',
        backgroundColor: colors.surface,
        borderRadius: 14,
        borderWidth: 1, borderColor: colors.border,
        ...shadows.elevated,
    },
    modalContent: { padding: 18 },
    title: { color: colors.textPrimary, fontSize: 18, fontWeight: '800', textAlign: 'center' },
    total: { color: colors.primary, fontSize: 44, fontWeight: '900', textAlign: 'center', marginTop: 4, marginBottom: 16 },
    sectionLabel: { color: colors.textSecondary, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginTop: 6 },
    pmGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
    pmBtn: {
        paddingHorizontal: 16, paddingVertical: 12,
        backgroundColor: colors.surface, borderRadius: 8,
        marginRight: 8, marginBottom: 8,
        borderWidth: 2, borderColor: colors.border,
    },
    pmBtnActive: { borderColor: colors.primary, backgroundColor: colors.primaryAlpha },
    pmBtnText: { color: colors.textSecondary, fontSize: 14, fontWeight: '700' },
    pmBtnTextActive: { color: colors.primary },
    r1Toggle: {
        flexDirection: 'row', alignItems: 'center',
        marginTop: 18, paddingVertical: 10,
    },
    checkbox: {
        width: 24, height: 24, borderRadius: 4,
        borderWidth: 2, borderColor: colors.borderStrong,
        marginRight: 10, alignItems: 'center', justifyContent: 'center',
    },
    checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
    checkmark: { color: colors.textOnPrimary, fontSize: 16, fontWeight: '800' },
    r1ToggleText: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
    r1Box: {
        backgroundColor: colors.surfaceAlt, borderRadius: 8,
        padding: 12, marginBottom: 12,
        borderWidth: 1, borderColor: colors.border,
    },
    addrBtn: {
        backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 8,
        borderRadius: 6, marginLeft: 8,
    },
    addrBtnText: { color: colors.textOnPrimary, fontWeight: '800', fontSize: 13 },
    addrBox: {
        backgroundColor: colors.surfaceAlt, borderRadius: 8,
        padding: 10, marginBottom: 12,
        borderWidth: 1, borderColor: colors.border,
    },
    addrItem: {
        backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 10,
        borderRadius: 6, marginVertical: 3,
        borderWidth: 1, borderColor: colors.border,
    },
    addrItemName: { color: colors.textPrimary, fontWeight: '700', fontSize: 14 },
    addrItemMeta: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
    countryList: {
        backgroundColor: colors.surface, borderRadius: 6, marginTop: 4,
        borderWidth: 1, borderColor: colors.border,
    },
    countryItem: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 12, paddingVertical: 10,
        borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    countryItemSel: { backgroundColor: colors.primaryAlpha },
    countryCode: { color: colors.primary, fontSize: 14, fontWeight: '800', width: 50 },
    countryName: { color: colors.textPrimary, fontSize: 14 },
    fieldLabel: { color: colors.textSecondary, fontSize: 11, fontWeight: '700', marginTop: 8, marginBottom: 4 },
    err: { color: colors.error },
    input: {
        backgroundColor: colors.surface, color: colors.textPrimary,
        borderRadius: 6, paddingHorizontal: 12, paddingVertical: 10,
        fontSize: 14,
        borderWidth: 1, borderColor: colors.border,
    },
    actionsRow: { flexDirection: 'row', marginTop: 16 },
    actionBtn: {
        flex: 1, marginHorizontal: 4, paddingVertical: 16,
        borderRadius: 8, alignItems: 'center', justifyContent: 'center',
    },
    actionBtnText: { color: colors.textOnPrimary, fontSize: 16, fontWeight: '800' },
    actionBtnNeutral: { backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.border },
    actionBtnTextNeutral: { color: colors.textPrimary },
});

// Full-screen loading overlay dok scanner tipka QR sadržaj (između prvog znaka
// i ENTER-a). Obojen tamno-plavo da user vidi da je skeniranje u tijeku.
function ScanLoadingOverlay() {
    return (
        <View style={[overlayStyles.full, { backgroundColor: colors.primaryDark }]} pointerEvents="none">
            <View style={overlayStyles.content}>
                <ActivityIndicator size="large" color={colors.textOnPrimary} />
                <Text style={[overlayStyles.bigLine, { marginTop: 24 }]}>PROVJERA KARTE</Text>
                <Text style={overlayStyles.line}>skeniranje u tijeku…</Text>
            </View>
        </View>
    );
}

// Full-screen overlay koji pokrije sav ekran u boji statusa.
// Tap bilo gdje → onDismiss (osim na confirm gdje user mora tapnuti neki gumb).
function ScanResultOverlay({ result, onDismiss, onValidateOnlyOne, onValidateAll }) {
    // Confirm overlay — karta je valjana, user mora tapnuti za validaciju.
    // Background: žuto ako harborMismatch, plavo inače.
    // Gumbe: "VALIDIRAJ SAMO OVU" + "VALIDIRAJ SVE (N+1)" ako ima povezanih, inače samo "VALIDIRAJ".
    if (result.kind === 'confirm') {
        const t = result.ticket || {};
        const related = result.related || [];
        const hasRelated = related.length > 0;
        const bg = result.harborMismatch ? colors.warning : colors.primaryDark;
        const title = result.harborMismatch ? '⚠ KRIVA LUKA UKRCAJA' : '✓ KARTA VALJANA';
        return (
            <View style={[overlayStyles.full, { backgroundColor: bg }]}>
                <View style={overlayStyles.choiceHeader}>
                    <Text style={overlayStyles.choiceTitle}>{title}</Text>
                    <Text style={overlayStyles.choiceBig}>{String(t.ticket_type_name || '')}</Text>
                    <Text style={overlayStyles.choiceCode}>{String(t.ticket_code || '')}</Text>
                </View>

                {result.harborMismatch ? (
                    <View style={overlayStyles.harborInfo}>
                        <View style={overlayStyles.harborRow}>
                            <Text style={overlayStyles.harborLabel}>Karta vrijedi za:</Text>
                            <Text style={overlayStyles.harborValue}>{String(result.expectedHarborName || '—')}</Text>
                        </View>
                        <View style={overlayStyles.harborRow}>
                            <Text style={overlayStyles.harborLabel}>Odabrana luka:</Text>
                            <Text style={overlayStyles.harborValue}>{String(result.selectedHarborName || '—')}</Text>
                        </View>
                    </View>
                ) : null}

                {hasRelated ? (
                    <View style={overlayStyles.relatedBox}>
                        <Text style={overlayStyles.relatedHeader}>
                            Povezane nevalidirane karte iste narudžbe ({related.length}):
                        </Text>
                        <ScrollView style={overlayStyles.relatedList}>
                            {related.map((rt) => (
                                <View key={rt.ticket_uuid} style={overlayStyles.relatedItem}>
                                    <Text style={overlayStyles.relatedCode}>{String(rt.ticket_code || '')}</Text>
                                    <Text style={overlayStyles.relatedType}>{String(rt.ticket_type_name || '')}</Text>
                                </View>
                            ))}
                        </ScrollView>
                    </View>
                ) : null}

                {hasRelated ? (
                    <View style={overlayStyles.choiceRow}>
                        <TouchableOpacity style={[overlayStyles.choiceBtn, { backgroundColor: colors.primaryDark }]} onPress={onValidateOnlyOne}>
                            <Text style={overlayStyles.choiceBtnText}>VALIDIRAJ</Text>
                            <Text style={overlayStyles.choiceBtnSub}>SAMO OVU</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[overlayStyles.choiceBtn, { backgroundColor: colors.success }]} onPress={onValidateAll}>
                            <Text style={overlayStyles.choiceBtnText}>VALIDIRAJ</Text>
                            <Text style={overlayStyles.choiceBtnSub}>SVE ({related.length + 1})</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={overlayStyles.choiceRow}>
                        <TouchableOpacity style={[overlayStyles.choiceBtn, { backgroundColor: colors.success, flex: 1 }]} onPress={onValidateOnlyOne}>
                            <Text style={overlayStyles.choiceBtnText}>VALIDIRAJ</Text>
                        </TouchableOpacity>
                    </View>
                )}
                <TouchableOpacity style={overlayStyles.cancelBtn} onPress={onDismiss}>
                    <Text style={overlayStyles.cancelBtnText}>Odustani</Text>
                </TouchableOpacity>
            </View>
        );
    }

    let bg = colors.success;
    let title = '✓ VALIDIRANO';
    if (result.kind === 'already') { bg = colors.warning; title = '⚠ VEĆ VALIDIRANO'; }
    if (result.kind === 'reject')  { bg = colors.error; title = '✗ ODBIJENO'; }
    const t = result.ticket || {};
    return (
        <TouchableOpacity
            activeOpacity={1}
            style={[overlayStyles.full, { backgroundColor: bg }]}
            onPress={onDismiss}
        >
            <View style={overlayStyles.content}>
                <Text style={overlayStyles.title}>{title}</Text>
                {result.validatedCount > 1 ? (
                    <Text style={overlayStyles.bigLine}>{result.validatedCount} karte</Text>
                ) : null}
                {result.kind === 'reject' && result.message ? (
                    <Text style={overlayStyles.line}>{String(result.message)}</Text>
                ) : null}
                {t.ticket_type_name ? (
                    <Text style={overlayStyles.bigLine}>{String(t.ticket_type_name)}</Text>
                ) : null}
                {t.departure_harbor_name ? (
                    <Text style={overlayStyles.line}>
                        {String(t.departure_harbor_name)} → {String(t.arrival_harbor_name || '')}
                    </Text>
                ) : null}
                {t.ticket_code ? (
                    <Text style={overlayStyles.code}>{String(t.ticket_code)}</Text>
                ) : null}
                <Text style={overlayStyles.hint}>Tapni za zatvaranje</Text>
            </View>
        </TouchableOpacity>
    );
}

const overlayStyles = StyleSheet.create({
    full: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 1000, elevation: 20,
        alignItems: 'center', justifyContent: 'center',
    },
    content: { alignItems: 'center', paddingHorizontal: 24 },
    title: { color: colors.textOnPrimary, fontSize: 48, fontWeight: '900', marginBottom: 24, letterSpacing: 2, textAlign: 'center' },
    bigLine: { color: colors.textOnPrimary, fontSize: 28, fontWeight: '800', marginVertical: 8, textAlign: 'center' },
    line: { color: colors.textOnPrimary, fontSize: 22, marginVertical: 4, textAlign: 'center' },
    code: { color: colors.textOnPrimary, fontSize: 18, fontFamily: 'monospace', marginTop: 18, opacity: 0.85 },
    hint: { color: colors.textOnPrimary, fontSize: 12, marginTop: 40, opacity: 0.7 },
    choiceHeader: {
        alignItems: 'center', paddingTop: 30, paddingHorizontal: 20,
    },
    choiceTitle: { color: colors.textOnPrimary, fontSize: 32, fontWeight: '900', marginBottom: 8, letterSpacing: 2 },
    choiceBig: { color: colors.textOnPrimary, fontSize: 22, fontWeight: '800', marginVertical: 4, textAlign: 'center' },
    choiceCode: { color: colors.textOnPrimary, fontSize: 16, fontFamily: 'monospace', opacity: 0.85 },
    relatedBox: {
        flex: 1,
        marginHorizontal: 16, marginTop: 20,
        backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 10,
        paddingVertical: 12,
    },
    relatedHeader: {
        color: colors.textOnPrimary, fontSize: 14, fontWeight: '700',
        paddingHorizontal: 14, paddingBottom: 8,
    },
    relatedList: { flex: 1, paddingHorizontal: 10 },
    relatedItem: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 3,
        paddingHorizontal: 12, paddingVertical: 10, borderRadius: 6,
    },
    relatedCode: { color: colors.textOnPrimary, fontSize: 14, fontFamily: 'monospace', fontWeight: '700' },
    relatedType: { color: colors.textOnPrimary, fontSize: 14, fontWeight: '600', flex: 1, textAlign: 'right' },
    choiceRow: {
        flexDirection: 'row',
        marginTop: 16, marginHorizontal: 20,
    },
    choiceBtn: {
        flex: 1, marginHorizontal: 6,
        paddingVertical: 28, borderRadius: 14,
        alignItems: 'center', justifyContent: 'center',
    },
    choiceBtnText: { color: colors.textOnPrimary, fontSize: 22, fontWeight: '900', letterSpacing: 1 },
    choiceBtnSub: { color: colors.textOnPrimary, fontSize: 18, fontWeight: '700', marginTop: 4, letterSpacing: 1 },
    cancelBtn: {
        marginTop: 24, paddingVertical: 12, paddingHorizontal: 32,
        alignSelf: 'center', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 8,
    },
    cancelBtnText: { color: colors.textOnPrimary, fontSize: 14, fontWeight: '700' },
    harborInfo: {
        marginHorizontal: 16, marginTop: 30,
        backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 10,
        padding: 16,
    },
    harborRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 6 },
    harborLabel: { color: colors.warningLight, fontSize: 14, fontWeight: '600' },
    harborValue: { color: colors.textOnPrimary, fontSize: 16, fontWeight: '800' },
});

// Status validacije — prikazuje LocalValidationStatus iz lokalnog scan rezultata
// (NE iz Redux state-a, jer Redux dispatchevi okidaju bridgeless RN reload).
function LocalValidationStatus({ result }) {
    if (!result) return null;
    if (result.kind === 'reject') {
        return (
            <View style={[vs.statusBox, { backgroundColor: colors.error }]}>
                <Text style={vs.statusTitle}>✗ ODBIJENO</Text>
                <Text style={vs.statusText}>{String(result.message || 'Greška')}</Text>
            </View>
        );
    }
    const bg = result.kind === 'already' ? colors.warning : colors.success;
    const title = result.kind === 'already' ? '⚠ VEĆ VALIDIRANO' : '✓ VALIDIRANO';
    const t = result.ticket || {};
    return (
        <View style={[vs.statusBox, { backgroundColor: bg }]}>
            <Text style={vs.statusTitle}>{title}</Text>
            {t.ticket_type_name ? <Text style={vs.statusText}>{String(t.ticket_type_name)}</Text> : null}
            {t.ticket_code ? <Text style={vs.statusText}>{String(t.ticket_code)}</Text> : null}
            {t.departure_harbor_name ? (
                <Text style={vs.statusText}>
                    {String(t.departure_harbor_name)} → {String(t.arrival_harbor_name || '')}
                </Text>
            ) : null}
        </View>
    );
}

// ----------------------------------------------------------------------------
// Validacija polaska. Scan output prikazujemo inline u TextInputu — Modal
// komponenta je rušila app na Sunmi V2s 3s nakon scan-a (čak i bez ikakvih
// drugih akcija), a TextInput je stabilan.
function ValidationPanel({ voyage, validation, scanResult, onScan, onClearScan, onRefresh, onTicketTap, userTypingRef, fromHarbor, harbors, fromIdx, setFromIdx }) {
    const [search, setSearch] = useState('');

    // Re-komputiramo listu i brojila na svaki render — cache se ažurira tijekom
    // scan-a pa će parent re-render (zbog scanResult promjene) osvježiti prikaz.
    const allTickets = listCachedTickets();
    const total = allTickets.length;
    const validatedCount = countCachedValidated();

    const filtered = search.trim()
        ? allTickets.filter((t) => {
            const q = search.trim().toLowerCase();
            return (t.ticket_code || '').toLowerCase().includes(q)
                || (t.ticket_type_name || '').toLowerCase().includes(q);
        })
        : allTickets;

    // Sortiraj: nevalidirane prvo, pa validirane; unutar grupe po ticket_code.
    const sorted = [...filtered].sort((a, b) => {
        const aVal = a.status === 'validated' || a.validate_data ? 1 : 0;
        const bVal = b.status === 'validated' || b.validate_data ? 1 : 0;
        if (aVal !== bVal) return aVal - bVal;
        return (a.ticket_code || '').localeCompare(b.ticket_code || '');
    });

    return (
        <View style={{ flex: 1 }}>
            {/* Odabir ulazne luke — usporedba protiv ticket-ove departure_harbor */}
            <View style={vs.harborSelector}>
                <Text style={vs.harborSelectorLabel}>ULAZNA LUKA</Text>
                <View style={vs.harborSelectorRow}>
                    <TouchableOpacity
                        style={[vs.harborArrow, (fromIdx || 0) === 0 && vs.harborArrowDisabled]}
                        disabled={(fromIdx || 0) === 0}
                        onPress={() => setFromIdx?.((i) => Math.max(0, i - 1))}
                    >
                        <Text style={vs.harborArrowText}>◀</Text>
                    </TouchableOpacity>
                    <Text style={vs.harborSelectorValue} numberOfLines={1}>
                        {fromHarbor?.name || '—'}
                    </Text>
                    <TouchableOpacity
                        style={[vs.harborArrow, (fromIdx || 0) >= (harbors?.length || 1) - 2 && vs.harborArrowDisabled]}
                        disabled={(fromIdx || 0) >= (harbors?.length || 1) - 2}
                        onPress={() => setFromIdx?.((i) => Math.min((harbors?.length || 1) - 2, i + 1))}
                    >
                        <Text style={vs.harborArrowText}>▶</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <View style={vs.statsRow}>
                <View style={vs.statBox}>
                    <Text style={vs.statLabel}>Karte (ukupno / validirano)</Text>
                    <Text style={vs.statValue}>{total}/{validatedCount}</Text>
                </View>
                <TouchableOpacity
                    style={vs.refreshBtn}
                    onPress={onRefresh}
                    disabled={validation.loading}
                >
                    {validation.loading
                        ? <ActivityIndicator color={colors.textOnPrimary} />
                        : <Text style={vs.refreshText}>↻ Osvježi</Text>}
                </TouchableOpacity>
            </View>

            <View style={vs.searchBox}>
                <TextInput
                    value={search}
                    onChangeText={setSearch}
                    onFocus={() => { if (userTypingRef) userTypingRef.current = true; }}
                    onBlur={() => {
                        if (userTypingRef) {
                            setTimeout(() => { userTypingRef.current = false; }, 300);
                        }
                    }}
                    placeholder="Pretraga po oznaci karte ili tipu..."
                    placeholderTextColor={colors.textMuted}
                    style={vs.searchInput}
                    autoCapitalize="characters"
                    autoCorrect={false}
                />
                {search ? (
                    <TouchableOpacity style={vs.searchClear} onPress={() => setSearch('')}>
                        <Text style={vs.searchClearText}>✕</Text>
                    </TouchableOpacity>
                ) : null}
            </View>

            <ScrollView
                style={vs.ticketList}
                keyboardShouldPersistTaps="handled"
            >
                {sorted.length === 0 ? (
                    <Text style={vs.emptyText}>
                        {search ? 'Nema karata koje odgovaraju pretraživanju.' : 'Nema sinkroniziranih karata za ovaj polazak.'}
                    </Text>
                ) : (
                    sorted.map((t) => {
                        const isValidated = t.status === 'validated' || t.validate_data;
                        const markerColor = isValidated ? colors.error : colors.primary;
                        const Row = isValidated ? View : TouchableOpacity;
                        return (
                            <Row
                                key={t.ticket_uuid}
                                style={vs.ticketRow}
                                onPress={isValidated ? undefined : () => onTicketTap?.(t.ticket_uuid)}
                                activeOpacity={0.7}
                            >
                                <View style={[vs.ticketMarker, { backgroundColor: markerColor }]} />
                                <View style={{ flex: 1 }}>
                                    <Text style={vs.ticketCode}>{String(t.ticket_code || '')}</Text>
                                    <Text style={vs.ticketType}>{String(t.ticket_type_name || '')}</Text>
                                </View>
                                <Text style={vs.ticketStatus}>
                                    {isValidated ? 'VALIDIRANO' : 'AKTIVNA'}
                                </Text>
                            </Row>
                        );
                    })
                )}
            </ScrollView>

            {validation.lastFetched && (
                <Text style={vs.lastSync}>
                    Zadnja sinkronizacija: {new Date(validation.lastFetched).toLocaleTimeString('hr-HR')}
                </Text>
            )}
        </View>
    );
}

const vs = StyleSheet.create({
    headerBox: {
        padding: 12, backgroundColor: colors.surface, marginHorizontal: 12, marginTop: 10, borderRadius: 8,
        borderWidth: 1, borderColor: colors.border,
    },
    lineCode: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
    dateText: { color: colors.textSecondary, fontSize: 13, marginTop: 2 },
    harborSelector: {
        marginHorizontal: 12, marginTop: 10,
        backgroundColor: colors.surface, borderRadius: 8,
        padding: 10,
        borderWidth: 1, borderColor: colors.border,
    },
    harborSelectorLabel: {
        color: colors.textSecondary, fontSize: 10, fontWeight: '800',
        letterSpacing: 1, marginBottom: 6, marginLeft: 4,
    },
    harborSelectorRow: { flexDirection: 'row', alignItems: 'center' },
    harborArrow: {
        width: 44, height: 44, borderRadius: 6,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: colors.primary,
    },
    harborArrowDisabled: { opacity: 0.5 },
    harborArrowText: { color: colors.textOnPrimary, fontSize: 18, fontWeight: '700' },
    harborSelectorValue: {
        flex: 1, color: colors.textPrimary, fontSize: 18, fontWeight: '700',
        textAlign: 'center', paddingHorizontal: 8,
    },
    statsRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 12, marginTop: 10 },
    statBox: {
        flex: 1, backgroundColor: colors.surface, padding: 12, borderRadius: 8,
        borderWidth: 1, borderColor: colors.border,
    },
    statLabel: { color: colors.textSecondary, fontSize: 11, fontWeight: '700' },
    statValue: { color: colors.textPrimary, fontSize: 24, fontWeight: '800', marginTop: 4 },
    refreshBtn: { backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 8, marginLeft: 10 },
    refreshText: { color: colors.textOnPrimary, fontWeight: '700' },
    searchBox: {
        flexDirection: 'row', alignItems: 'center',
        marginHorizontal: 12, marginTop: 10,
        backgroundColor: colors.surface, borderRadius: 8,
        paddingHorizontal: 10,
        borderWidth: 1, borderColor: colors.border,
    },
    searchInput: {
        flex: 1, color: colors.textPrimary, fontSize: 15,
        paddingVertical: 10,
    },
    searchClear: { padding: 6, marginLeft: 4 },
    searchClearText: { color: colors.textSecondary, fontSize: 16, fontWeight: '700' },
    ticketList: { flex: 1, marginHorizontal: 12, marginTop: 8 },
    ticketRow: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.surface,
        paddingVertical: 10, paddingRight: 12,
        marginVertical: 3, borderRadius: 6,
        overflow: 'hidden',
        borderWidth: 1, borderColor: colors.border,
    },
    ticketMarker: { width: 6, alignSelf: 'stretch', marginRight: 10 },
    ticketCode: { color: colors.textPrimary, fontSize: 15, fontWeight: '700', fontFamily: 'monospace' },
    ticketType: { color: colors.textSecondary, fontSize: 13, marginTop: 2 },
    ticketStatus: { color: colors.textSecondary, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
    emptyText: { color: colors.textMuted, textAlign: 'center', padding: 30, fontStyle: 'italic' },
    scanBtn: {
        marginHorizontal: 12, marginTop: 14,
        backgroundColor: colors.primary, paddingVertical: 18, borderRadius: 10,
        alignItems: 'center',
    },
    scanBtnText: { color: colors.textOnPrimary, fontSize: 18, fontWeight: '800', letterSpacing: 1 },
    scanArea: { flex: 1, alignItems: 'stretch', justifyContent: 'flex-start', padding: 20 },
    scanHint: { color: colors.textSecondary, fontSize: 14, fontWeight: '700', marginBottom: 8 },
    scanInput: {
        backgroundColor: colors.surface, color: colors.textPrimary,
        borderWidth: 1, borderColor: colors.border,
        borderRadius: 8, padding: 12, minHeight: 100,
        fontSize: 13, fontFamily: 'monospace',
    },
    clearBtn: {
        marginTop: 8, alignSelf: 'flex-end',
        backgroundColor: colors.surface, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6,
        borderWidth: 1, borderColor: colors.border,
    },
    clearBtnText: { color: colors.textPrimary, fontWeight: '700' },
    statusBox: { marginTop: 12, padding: 12, borderRadius: 8 },
    statusTitle: { color: colors.textOnPrimary, fontSize: 18, fontWeight: '800', marginBottom: 4, textAlign: 'center' },
    statusText: { color: colors.textOnPrimary, fontSize: 14, textAlign: 'center', marginVertical: 1 },
    statusInfo: { color: colors.textSecondary, fontStyle: 'italic', marginTop: 8, textAlign: 'center' },
    hiddenInput: {
        position: 'absolute', top: -1000, left: 0,
        width: 1, height: 1, opacity: 0,
    },
    lastSync: { color: colors.textMuted, fontSize: 11, marginTop: 12, textAlign: 'center' },
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
    resultCard: { width: '85%', borderRadius: 14, padding: 24, alignItems: 'center' },
    resultTitle: { color: colors.textOnPrimary, fontSize: 28, fontWeight: '800', marginBottom: 16, letterSpacing: 1 },
    resultLine: { color: colors.textOnPrimary, fontSize: 18, fontWeight: '700', marginVertical: 4, textAlign: 'center' },
    resultMeta: { color: colors.textOnPrimary, fontSize: 13, marginTop: 4 },
    resultBtn: { marginTop: 18, backgroundColor: colors.surface, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 8 },
    resultBtnText: { color: colors.primary, fontSize: 16, fontWeight: '800' },
});

const styles = StyleSheet.create({
    wrap: { flex: 1, backgroundColor: colors.bg },
    hiddenScanInput: {
        position: 'absolute', top: -1000, left: 0,
        width: 1, height: 1, opacity: 0,
    },

    header: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 8, paddingVertical: 12,
        backgroundColor: colors.primary,
    },
    backBtn: { paddingVertical: 6, paddingHorizontal: 10, width: 100 },
    backText: { color: colors.secondary, fontSize: 16, fontWeight: '600' },
    headerTitle: { flex: 1, textAlign: 'center', color: colors.textOnPrimary, fontSize: 18, fontWeight: '700' },
    modeToggle: {
        flex: 1, flexDirection: 'row', backgroundColor: colors.primaryDark,
        borderRadius: 8, padding: 3, marginHorizontal: 4,
    },
    modeBtn: {
        flex: 1, paddingVertical: 8, borderRadius: 6,
        alignItems: 'center', justifyContent: 'center',
    },
    modeBtnActive: { backgroundColor: colors.surface },
    modeBtnText: { color: colors.secondary, fontSize: 13, fontWeight: '700' },
    modeBtnTextActive: { color: colors.primary },
    pendingBadge: {
        width: 100, height: 32,
        backgroundColor: colors.warning,
        borderRadius: 16,
        alignItems: 'center', justifyContent: 'center',
        marginRight: 8,
    },
    pendingText: { color: colors.textOnPrimary, fontSize: 13, fontWeight: '800' },

    voyageBoxSlim: {
        backgroundColor: colors.surface,
        marginHorizontal: 12,
        marginTop: 10,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8,
        borderLeftWidth: 3,
        borderLeftColor: colors.primary,
        borderWidth: 1, borderColor: colors.border,
    },
    voyageLineSlim: { color: colors.textPrimary, fontSize: 14, fontWeight: '700' },

    sectionLabel: { color: colors.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginLeft: 16, marginTop: 14, marginBottom: 6 },

    selectorRow: {
        flexDirection: 'row', alignItems: 'center',
        marginHorizontal: 12, backgroundColor: colors.surface,
        borderRadius: 10, padding: 8,
        borderWidth: 1, borderColor: colors.border,
    },
    arrow: {
        width: 52, height: 52, borderRadius: 8,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: colors.primary,
    },
    arrowDisabled: { opacity: 0.5 },
    arrowText: { color: colors.textOnPrimary, fontSize: 22, fontWeight: '700' },
    selectorValue: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
    selectorText: { color: colors.textPrimary, fontSize: 20, fontWeight: '700' },
    selectorTime: { color: colors.primary, fontSize: 13, fontWeight: '600', marginTop: 2 },

    emptyCat: { padding: 24, alignItems: 'center' },
    emptyCatText: { color: colors.textSecondary },

    catRow: {
        flexDirection: 'row', alignItems: 'center',
        marginHorizontal: 12, marginTop: 8,
        backgroundColor: colors.surface, borderRadius: 10,
        padding: 12,
        borderWidth: 1, borderColor: colors.border,
    },
    catName: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
    catPrice: { color: colors.textSecondary, fontSize: 13, marginTop: 2 },
    qtyRow: { flexDirection: 'row', alignItems: 'center' },
    qtyBtn: {
        width: 44, height: 44, borderRadius: 8,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: colors.primary,
    },
    qtyBtnDisabled: { opacity: 0.5 },
    qtyBtnText: { color: colors.textOnPrimary, fontSize: 22, fontWeight: '800' },
    qtyValue: { color: colors.textPrimary, fontSize: 20, fontWeight: '800', width: 44, textAlign: 'center' },

    bottom: {
        position: 'absolute', left: 0, right: 0, bottom: 0,
        backgroundColor: colors.surface,
        borderTopWidth: 1, borderTopColor: colors.border,
        paddingTop: 8, paddingHorizontal: 12, paddingBottom: 12,
        ...shadows.elevated,
    },
    pmRow: { paddingVertical: 4, gap: 6 },
    pmChip: {
        paddingHorizontal: 14, paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: colors.surface,
        borderWidth: 1, borderColor: colors.border,
        marginRight: 6,
    },
    pmChipActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    pmChipText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
    pmChipTextActive: { color: colors.textOnPrimary },
    bottomRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
    totalBox: { flex: 1 },
    totalLabel: { color: colors.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
    totalValue: { color: colors.textPrimary, fontSize: 24, fontWeight: '800' },
    issueBtn: {
        backgroundColor: colors.success, paddingHorizontal: 24, paddingVertical: 14,
        borderRadius: 10,
    },
    issueBtnDisabled: { opacity: 0.5 },
    issueBtnText: { color: colors.textOnPrimary, fontSize: 16, fontWeight: '800' },

    modalBackdrop: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center', justifyContent: 'center',
    },
    modalCard: {
        backgroundColor: colors.surface, padding: 24, borderRadius: 12,
        width: '85%', alignItems: 'center',
        borderWidth: 1, borderColor: colors.border,
        ...shadows.elevated,
    },
    modalTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: '800', marginBottom: 12 },
    modalCode: { color: colors.primary, fontSize: 14, marginBottom: 10, textAlign: 'center' },
    modalHint: { color: colors.textSecondary, fontSize: 12, textAlign: 'center' },
    modalBtn: { marginTop: 20, backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
    modalBtnText: { color: colors.textOnPrimary, fontWeight: '700', fontSize: 14 },
    islandSection: {
        marginHorizontal: 16, marginTop: 14, padding: 12, borderRadius: 12,
        borderWidth: 2, borderStyle: 'dashed', borderColor: colors.success,
        backgroundColor: colors.successLight,
    },
    islandBtn: { backgroundColor: colors.success, paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginTop: 4 },
    islandBtnText: { color: colors.textOnPrimary, fontWeight: 'bold', fontSize: 16 },
    islandRow: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.surface, padding: 10, borderRadius: 8, marginTop: 8,
        borderWidth: 1, borderColor: colors.success,
    },
    islandRowTitle: { fontWeight: '700', color: colors.success, fontSize: 14 },
    islandRowSub: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
    islandRowPrice: { fontWeight: '700', fontSize: 16, color: colors.success },
});
