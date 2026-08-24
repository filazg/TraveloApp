package com.travelomobile.sunmi

import android.content.ComponentName
import android.content.Intent
import android.content.ServiceConnection
import android.os.IBinder
import android.util.Log
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType
import woyou.aidlservice.jiuiv5.ICallback
import woyou.aidlservice.jiuiv5.IWoyouService
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

// Native bridge for the Sunmi V2s internal thermal printer.
// Binds to the `woyou.aidlservice.jiuiv5.IWoyouService` AIDL service and
// exposes a minimal set of print commands to JS.
class SunmiPrinterModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private var printer: IWoyouService? = null
    private var connected = false
    private var pendingBind: Promise? = null
    private var binding = false

    private val connection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, service: IBinder?) {
            printer = IWoyouService.Stub.asInterface(service)
            connected = true
            binding = false
            pendingBind?.resolve(true)
            pendingBind = null
        }
        override fun onServiceDisconnected(name: ComponentName?) {
            printer = null
            connected = false
            binding = false
        }
    }

    override fun getName(): String = "SunmiPrinter"

    /**
     * Serijski broj uređaja — koristi se za zero-touch uparivanje terminala.
     * Ne traži bind na printer servis; čita se iz system propertyja.
     */
    @ReactMethod
    fun getSerialNumber(promise: Promise) {
        try {
            var sn = getSystemProperty("ro.sunmi.serial")
            if (sn.isNullOrEmpty()) sn = getSystemProperty("ro.serialno")
            if (sn.isNullOrEmpty()) {
                // Build.getSerial traži READ_PHONE_STATE na nekim uređajima.
                sn = try { android.os.Build.getSerial() } catch (t: Throwable) { null }
            }
            if (sn.isNullOrEmpty()) sn = android.os.Build.SERIAL
            if (sn.isNullOrEmpty() || sn.equals("unknown", ignoreCase = true)) {
                promise.reject("NO_SERIAL", "Serijski broj nije dostupan")
                return
            }
            promise.resolve(sn)
        } catch (e: Exception) {
            promise.reject("SERIAL_ERROR", e.message)
        }
    }

    /** Čita Android system property (npr. ro.sunmi.serial) preko refleksije. */
    private fun getSystemProperty(key: String): String? {
        return try {
            val sp = Class.forName("android.os.SystemProperties")
            val get = sp.getMethod("get", String::class.java)
            get.invoke(null, key) as? String
        } catch (t: Throwable) {
            null
        }
    }

    @ReactMethod
    fun bind(promise: Promise) {
        if (connected && printer != null) { promise.resolve(true); return }
        // If already binding, queue this promise.
        if (binding) { pendingBind = promise; return }
        try {
            val intent = Intent()
            intent.setPackage("woyou.aidlservice.jiuiv5")
            intent.action = "woyou.aidlservice.jiuiv5.IWoyouService"
            val ok = reactApplicationContext.bindService(intent, connection, android.content.Context.BIND_AUTO_CREATE)
            if (!ok) {
                promise.reject("BIND_ERR", "bindService returned false — is the Sunmi printer service installed?")
                return
            }
            binding = true
            pendingBind = promise
            // onServiceConnected will resolve the promise.
        } catch (e: Exception) {
            promise.reject("BIND_ERR", e.message)
        }
    }

    private fun requirePrinter(): IWoyouService? {
        if (!connected || printer == null) return null
        return printer
    }

    private fun simpleCallback(promise: Promise) = object : ICallback.Stub() {
        private var resolved = false
        override fun onRunResult(isSuccess: Boolean) {
            if (resolved) return
            resolved = true
            promise.resolve(isSuccess)
        }
        override fun onReturnString(result: String?) {
            if (resolved) return
            resolved = true
            promise.resolve(result ?: "")
        }
        override fun onRaiseException(code: Int, msg: String?) {
            if (resolved) return
            resolved = true
            promise.reject("E_$code", msg ?: "printer error")
        }
        override fun onPrintResult(code: Int, msg: String?) {
            if (resolved) return
            resolved = true
            if (code == 0) promise.resolve(true)
            else promise.reject("PRINT_$code", msg ?: "print failed")
        }
    }

    // Fire-and-forget: these setup calls often don't trigger a callback reliably
    // across different Sunmi firmware versions. Resolve immediately after dispatch.
    @ReactMethod
    fun initPrinter(promise: Promise) {
        val p = requirePrinter() ?: return promise.reject("NO_PRINTER", "Printer service not bound. Call bind() first.")
        try { p.printerInit(null); promise.resolve(true) } catch (e: Exception) { promise.reject("INIT_ERR", e.message) }
    }

    // align: 0=LEFT, 1=CENTER, 2=RIGHT
    @ReactMethod
    fun setAlignment(align: Int, promise: Promise) {
        val p = requirePrinter() ?: return promise.reject("NO_PRINTER", "not bound")
        try { p.setAlignment(align, null); promise.resolve(true) } catch (e: Exception) { promise.reject("ALIGN_ERR", e.message) }
    }

    @ReactMethod
    fun setFontSize(size: Float, promise: Promise) {
        val p = requirePrinter() ?: return promise.reject("NO_PRINTER", "not bound")
        try { p.setFontSize(size, null); promise.resolve(true) } catch (e: Exception) { promise.reject("FONT_ERR", e.message) }
    }

    @ReactMethod
    fun printText(text: String, promise: Promise) {
        val p = requirePrinter() ?: return promise.reject("NO_PRINTER", "not bound")
        try { p.printText(text, null); promise.resolve(true) } catch (e: Exception) { promise.reject("PRINT_ERR", e.message) }
    }

    @ReactMethod
    fun printQRCode(data: String, moduleSize: Int, errorLevel: Int, promise: Promise) {
        val p = requirePrinter() ?: return promise.reject("NO_PRINTER", "not bound")
        try { p.printQRCode(data, moduleSize, errorLevel, null); promise.resolve(true) } catch (e: Exception) { promise.reject("QR_ERR", e.message) }
    }

    @ReactMethod
    fun lineWrap(n: Int, promise: Promise) {
        val p = requirePrinter() ?: return promise.reject("NO_PRINTER", "not bound")
        try { p.lineWrap(n, null); promise.resolve(true) } catch (e: Exception) { promise.reject("WRAP_ERR", e.message) }
    }

    @ReactMethod
    fun cutPaper(promise: Promise) {
        val p = requirePrinter() ?: return promise.reject("NO_PRINTER", "not bound")
        try { p.cutPaper(null); promise.resolve(true) } catch (e: Exception) { promise.reject("CUT_ERR", e.message) }
    }

    @ReactMethod
    fun getPrinterStatus(promise: Promise) {
        val p = requirePrinter() ?: return promise.reject("NO_PRINTER", "not bound")
        try { promise.resolve(p.getPrinterStatus()) } catch (e: Exception) { promise.reject("STATUS_ERR", e.message) }
    }

    // Sunmi WoyouConsts style keys: 1000 = ENABLE_BOLD (value 0=off, 1=on),
    // 1001 = ENABLE_UNDERLINE, 2003 = SET_LINE_SPACING, etc.
    // Raw ESC/POS bytes — used for vendor-specific commands that aren't exposed
    // via dedicated AIDL methods (e.g. ESC 7 to set thermal head heating time).
    @ReactMethod
    fun sendRAWData(bytes: ReadableArray, promise: Promise) {
        val p = requirePrinter() ?: return promise.reject("NO_PRINTER", "not bound")
        try {
            val arr = ByteArray(bytes.size())
            for (i in 0 until bytes.size()) arr[i] = (bytes.getInt(i) and 0xFF).toByte()
            p.sendRAWData(arr, null)
            promise.resolve(true)
        } catch (e: Exception) { promise.reject("RAW_ERR", e.message) }
    }

    @ReactMethod
    fun setPrinterStyle(key: Int, value: Int, promise: Promise) {
        val p = requirePrinter() ?: return promise.reject("NO_PRINTER", "not bound")
        try { p.setPrinterStyle(key, value); promise.resolve(true) } catch (e: Exception) { promise.reject("STYLE_ERR", e.message) }
    }

    @ReactMethod
    fun enterPrinterBuffer(clean: Boolean, promise: Promise) {
        val p = requirePrinter() ?: return promise.reject("NO_PRINTER", "not bound")
        try { p.enterPrinterBuffer(clean); promise.resolve(true) } catch (e: Exception) { promise.reject("BUF_ENTER_ERR", e.message) }
    }

    @ReactMethod
    fun commitPrinterBuffer(promise: Promise) {
        val p = requirePrinter() ?: return promise.reject("NO_PRINTER", "not bound")
        try { p.commitPrinterBuffer(); promise.resolve(true) } catch (e: Exception) { promise.reject("BUF_COMMIT_ERR", e.message) }
    }

    @ReactMethod
    fun exitPrinterBuffer(commit: Boolean, promise: Promise) {
        val p = requirePrinter() ?: return promise.reject("NO_PRINTER", "not bound")
        try { p.exitPrinterBuffer(commit); promise.resolve(true) } catch (e: Exception) { promise.reject("BUF_EXIT_ERR", e.message) }
    }

    @ReactMethod
    fun printColumnsString(textArr: ReadableArray, widthArr: ReadableArray, alignArr: ReadableArray, promise: Promise) {
        val p = requirePrinter() ?: return promise.reject("NO_PRINTER", "not bound")
        try {
            val texts = Array(textArr.size()) { i -> textArr.getString(i) ?: "" }
            val widths = IntArray(widthArr.size()) { i -> widthArr.getInt(i) }
            val aligns = IntArray(alignArr.size()) { i -> alignArr.getInt(i) }
            p.printColumnsString(texts, widths, aligns, null)
            promise.resolve(true)
        } catch (e: Exception) { promise.reject("COLS_ERR", e.message) }
    }

    // ESC 7 (heating params 13/240/4) + ESC E 1 (emphasis) + ESC G 1 (double-strike).
    // Maksimalno tamniji ispis bez mijenjanja drivera. Pozvati unutar buffer batch-a.
    private fun applyHeavyPrintMode(p: IWoyouService) {
        try { p.sendRAWData(byteArrayOf(0x1B, 0x37, 0x0D, 0xF0.toByte(), 0x04), null) } catch (_: Exception) {}
        try { p.sendRAWData(byteArrayOf(0x1B, 0x45, 0x01), null) } catch (_: Exception) {}
        try { p.sendRAWData(byteArrayOf(0x1B, 0x47, 0x01), null) } catch (_: Exception) {}
    }
    private fun clearHeavyPrintMode(p: IWoyouService) {
        try { p.sendRAWData(byteArrayOf(0x1B, 0x47, 0x00), null) } catch (_: Exception) {}
        try { p.sendRAWData(byteArrayOf(0x1B, 0x45, 0x00), null) } catch (_: Exception) {}
    }

    // Raw ESC/POS QR preko sendRAWData — pouzdanije od AIDL printQRCode na nekim firmware verzijama.
    // moduleSize: 1-16 (točke po modulu), errorLevel: 48=L, 49=M, 50=Q, 51=H.
    private fun printRawQR(p: IWoyouService, data: String, moduleSize: Int = 8, errorLevel: Int = 49) {
        if (data.isEmpty()) return
        // 1) Model 2
        p.sendRAWData(byteArrayOf(0x1D, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00), null)
        // 2) Module size
        p.sendRAWData(byteArrayOf(0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, (moduleSize and 0xFF).toByte()), null)
        // 3) Error correction
        p.sendRAWData(byteArrayOf(0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, (errorLevel and 0xFF).toByte()), null)
        // 4) Store data: GS ( k pL pH cn fn m d1...dk
        val dataBytes = data.toByteArray(Charsets.UTF_8)
        val storeLen = dataBytes.size + 3
        val pL = (storeLen and 0xFF).toByte()
        val pH = ((storeLen shr 8) and 0xFF).toByte()
        val storeCmd = ByteArray(8 + dataBytes.size)
        storeCmd[0] = 0x1D; storeCmd[1] = 0x28; storeCmd[2] = 0x6B
        storeCmd[3] = pL; storeCmd[4] = pH
        storeCmd[5] = 0x31; storeCmd[6] = 0x50; storeCmd[7] = 0x30
        System.arraycopy(dataBytes, 0, storeCmd, 8, dataBytes.size)
        p.sendRAWData(storeCmd, null)
        // 5) Print
        p.sendRAWData(byteArrayOf(0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30), null)
    }

    // Helpers used by high-level print methods.
    // safeString tolerira da JS pošalje polje kao Number ili Boolean (npr. invoice_no
    // dolazi kao Int) — RN bridge inače baci ClassCastException u getString().
    private fun safeString(map: ReadableMap?, key: String): String {
        if (map == null || !map.hasKey(key) || map.isNull(key)) return ""
        return try {
            when (map.getType(key)) {
                ReadableType.String -> map.getString(key) ?: ""
                ReadableType.Number -> {
                    val d = map.getDouble(key)
                    if (d == d.toLong().toDouble()) d.toLong().toString() else d.toString()
                }
                ReadableType.Boolean -> map.getBoolean(key).toString()
                else -> ""
            }
        } catch (_: Exception) { "" }
    }
    private fun safeDouble(map: ReadableMap?, key: String): Double {
        if (map == null || !map.hasKey(key) || map.isNull(key)) return 0.0
        return try { map.getDouble(key) } catch (_: Exception) {
            try { (map.getString(key) ?: "0").toDouble() } catch (_: Exception) { 0.0 }
        }
    }
    private fun safeBool(map: ReadableMap?, key: String): Boolean {
        if (map == null || !map.hasKey(key) || map.isNull(key)) return false
        return try { map.getBoolean(key) } catch (_: Exception) { false }
    }

    // ===== Layout helpers — Sunmi V2s 58mm thermal, ~32 chars/line @ font 22-24. =====
    private val W = 32
    private val LINE_HARD = "================================\n"
    private val LINE_SOFT = "--------------------------------\n"

    private fun hline(p: IWoyouService) { p.printText(LINE_HARD, null) }
    private fun dline(p: IWoyouService) { p.printText(LINE_SOFT, null) }

    // label lijevo, value desno (široki print: stupci 16+16 jedinica).
    // Printer skalira interno po trenutnom fontu pa se odnos održava i pri 28-32f.
    private fun lr(p: IWoyouService, label: String, value: String, leftW: Int = 16, rightW: Int = 16) {
        p.printColumnsString(arrayOf(label, value), intArrayOf(leftW, rightW), intArrayOf(0, 2), null)
    }

    // Word-wrap text na ≤ max chars po retku. Lomi po razmacima; predugu riječ
    // ostavlja samostalno (printer ju onda wrapa pixelima).
    private fun wrapLines(text: String, max: Int): List<String> {
        if (text.isEmpty()) return emptyList()
        val out = mutableListOf<String>()
        var current = StringBuilder()
        for (word in text.split(" ")) {
            if (word.isEmpty()) continue
            val candidate = if (current.isEmpty()) word else "$current $word"
            if (candidate.length <= max) {
                current.setLength(0); current.append(candidate)
            } else {
                if (current.isNotEmpty()) out.add(current.toString())
                current.setLength(0); current.append(word)
            }
        }
        if (current.isNotEmpty()) out.add(current.toString())
        return out
    }

    // ===== Char-padding helpers — pre-formatiraju cijelu liniju u Kotlinu, =====
    // ===== printer samo renderira (bez ovisnosti o printColumnsString koji =====
    // ===== zna glitch-ati pri promjeni fonta ili double-strike modu).      =====

    // Skrati string na max chars — u suprotnom bi padR/padL razbio izlaznu širinu.
    private fun trunc(s: String, max: Int): String =
        if (s.length <= max) s else s.substring(0, max)

    // padR("Datum", 16) → "Datum           "
    private fun padR(s: String, w: Int): String {
        val t = trunc(s, w)
        return t + " ".repeat(w - t.length)
    }

    // padL("12.50", 16) → "           12.50"
    private fun padL(s: String, w: Int): String {
        val t = trunc(s, w)
        return " ".repeat(w - t.length) + t
    }

    // Centrira string u širini W=32: "    naslov     "
    private fun center(s: String, w: Int = W): String {
        val t = trunc(s, w)
        val pad = (w - t.length) / 2
        return " ".repeat(pad) + t
    }

    // Label lijevo, vrijednost desno — ukupna širina W. Default 16+16.
    private fun lrLine(label: String, value: String, leftW: Int = 16, rightW: Int = W - 16): String {
        return padR(label, leftW) + padL(value, rightW)
    }

    // ISO "yyyy-MM-dd'T'HH:mm:ss[.…]" → različiti formati za prikaz.
    private fun fmtIsoDate(iso: String): String {
        if (iso.isEmpty()) return ""
        return try {
            val src = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault())
            val dst = SimpleDateFormat("dd.MM.yyyy", Locale.getDefault())
            dst.format(src.parse(iso.substring(0, minOf(19, iso.length)))!!)
        } catch (_: Exception) { iso }
    }
    private fun fmtIsoTime(iso: String): String {
        if (iso.isEmpty()) return ""
        return try {
            val src = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault())
            val dst = SimpleDateFormat("HH:mm:ss", Locale.getDefault())
            dst.format(src.parse(iso.substring(0, minOf(19, iso.length)))!!)
        } catch (_: Exception) { iso }
    }

    // Strukturirani POS račun. Sav layout je u nativnom sloju radi pravilnog
    // poravnanja po pixelima — JS samo pakira podatke u ReadableMap.
    // Layout slijedi travelo-boat-desk invoicePrintHelper.cjs, prilagođeno na 32-char.
    // Layout je 1:1 boat-desk invoicePrintHelper.printInvoice, prilagođeno na 32-char.
    // Sve linije se pre-formatiraju u Kotlinu (padR/padL/center/lrLine) pa printer
    // samo renderira fiksne stringove uz alignment LEFT — ne oslanja se na
    // printColumnsString ni heavy-ink ESC sekvence koje znaju glitch-ati alignment.
    @ReactMethod
    fun printReceipt(data: ReadableMap, promise: Promise) {
        val p = requirePrinter() ?: return promise.reject("NO_PRINTER", "not bound")
        try {
            // Defensive: prijašnji print koji je visio ostavlja Sunmi servis u
            // dirty buffer state-u (servis = zaseban proces, ne umre s appom).
            // Forsirani exit prije enter čisti zaostale frame-ove.
            try { p.exitPrinterBuffer(false) } catch (_: Exception) {}
            Log.d("SunmiPrint", "printReceipt: enter buffer")
            p.enterPrinterBuffer(true)
            Log.d("SunmiPrint", "printReceipt: buffer entered")

            // ESC 7 — pojačaj heating params za tamniji ispis.
            // ESC E 1 — hardware emphasis (bold) — pouzdaniji od setPrinterStyle.
            // Sve nakon ovoga je bold cijelo vrijeme (user feedback: "slabo se vidi").
            try { p.sendRAWData(byteArrayOf(0x1B, 0x37, 0x0B, 0xC8.toByte(), 0x02), null) } catch (_: Exception) {}
            try { p.sendRAWData(byteArrayOf(0x1B, 0x45, 0x01), null) } catch (_: Exception) {}
            p.setPrinterStyle(1000, 1)

            val r = if (data.hasKey("invoice")) data.getMap("invoice") else null
            val bd = if (data.hasKey("basicData")) data.getMap("basicData") else null
            val operator = if (data.hasKey("operator")) data.getMap("operator") else null
            val items = if (data.hasKey("items")) data.getArray("items") else null
            val isReprint = safeBool(data, "isReprint")
            val paymentName = safeString(data, "paymentName")

            // Sve renderiramo s LEFT alignment-om — sve "centrirano" izvedeno padding-om.
            p.setAlignment(0, null)
            p.setFontSize(24f, null)

            // ----- KLIJENT (centrirano) -----
            val clientName = safeString(bd, "client_name").ifEmpty { "TRAVELO" }
            p.printText(center(clientName) + "\n", null)
            val clientAddr = safeString(bd, "client_address")
            if (clientAddr.isNotEmpty()) p.printText(center(clientAddr) + "\n", null)
            val clientCity = (safeString(bd, "client_postal_code") + " " + safeString(bd, "client_town")).trim()
            if (clientCity.isNotEmpty()) p.printText(center(clientCity) + "\n", null)
            val clientCountry = safeString(bd, "client_country")
            if (clientCountry.isNotEmpty()) p.printText(center(clientCountry) + "\n", null)
            val clientOib = safeString(bd, "client_legal_id")
            if (clientOib.isNotEmpty()) p.printText(center("OIB: $clientOib") + "\n", null)
            dline(p)

            // ----- POSLOVNI PROSTOR (centrirano) -----
            val bpName = safeString(bd, "business_premise_name")
            if (bpName.isNotEmpty()) p.printText(center(bpName) + "\n", null)
            val bpAddr = safeString(bd, "business_premise_address")
            if (bpAddr.isNotEmpty()) p.printText(center(bpAddr) + "\n", null)
            val bpCity = (safeString(bd, "business_premise_postal_code") + " " + safeString(bd, "business_premise_postal_town")).trim()
            if (bpCity.isNotEmpty()) p.printText(center(bpCity) + "\n", null)
            dline(p)
            dline(p)

            // ----- STATUS markeri -----
            if (isReprint) {
                p.printText(center("KOPIJA RAČUNA") + "\n", null)
                dline(p)
            }
            if (safeBool(r, "fiskal_required")) p.printText(center("FISKALIZACIJA 2.0") + "\n", null)
            if (safeBool(r, "_local")) p.printText(center("* OFFLINE — sync u tijeku *") + "\n", null)

            // ----- RAČUN BR (bold, doubleHeight, double-strike, centrirano) -----
            // ESC G 1 = double-strike (printer fizički printa svaki redak 2x — najtamnije).
            try { p.sendRAWData(byteArrayOf(0x1B, 0x47, 0x01), null) } catch (_: Exception) {}
            p.setPrinterStyle(1000, 1)
            p.setFontSize(34f, null)
            // U doubleHeight font-u manje char-ova stane po retku — koristimo prazan
            // string + alignment CENTER da printer sam centrira (jer naš `center()`
            // kalkulira prema W=32 char-a koji vrijede samo za default font).
            p.setAlignment(1, null)
            val buyerOib = safeString(r, "buyer_oib")
            val isF2 = safeBool(r, "is_f2")
            val isR1 = buyerOib.isNotEmpty()
            val invoiceCode = safeString(r, "invoice_code")
            when {
                // F2 (R1 + f2_required) — vidljivi "Račun br" je 8-znamenkasti random kod
                // u invoice_code (NE koristi NO/PP/NU sekvencu). Napomena ispod oznake
                // jasno daje do znanja da je račun R1 fiskaliziran (HRFISK20 / e-račun).
                isF2 -> {
                    p.printText("F2 RAČUN BR:\n", null)
                    p.printText("$invoiceCode\n", null)
                    // Napomena (manji font, bez double-strike-a, ne dira gornju oznaku).
                    try { p.sendRAWData(byteArrayOf(0x1B, 0x47, 0x00), null) } catch (_: Exception) {}
                    p.setFontSize(22f, null)
                    p.printText("R1 fiskalizirani račun (HRFISK20)\n", null)
                    p.setFontSize(34f, null)
                    try { p.sendRAWData(byteArrayOf(0x1B, 0x47, 0x01), null) } catch (_: Exception) {}
                }
                // R1 bez F2 ide u istu fiskalnu sekvencu kao B2C račun, pa nosi i
                // istu oznaku NO/PP/NU — od običnog računa razlikuje ga samo blok
                // s podacima o kupcu nize.
                else -> {
                    val fiscalCode = if (invoiceCode.isNotEmpty()) invoiceCode
                        else "${safeString(r, "invoice_no")}/${safeString(bd, "business_premise_fiscal_mark")}/${safeString(bd, "billing_device_fiscal_mark")}"
                    p.printText("RAČUN BR:\n", null)
                    p.printText("$fiscalCode\n", null)
                }
            }
            // Isključi double-strike, vrati font/alignment. Bold ostaje ON.
            try { p.sendRAWData(byteArrayOf(0x1B, 0x47, 0x00), null) } catch (_: Exception) {}
            p.setFontSize(24f, null)
            p.setAlignment(0, null)
            dline(p)

            // ----- META (leftRight 16+16) -----
            val now = Date()
            val createdAt = safeString(r, "created_at")
            val invDate = if (createdAt.isNotEmpty()) fmtIsoDate(createdAt)
                else SimpleDateFormat("dd.MM.yyyy", Locale.getDefault()).format(now)
            val invTime = if (createdAt.isNotEmpty()) fmtIsoTime(createdAt)
                else SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(now)
            p.printText(lrLine("Datum izdavanja", invDate) + "\n", null)
            p.printText(lrLine("Vrijeme izdavanja", invTime) + "\n", null)
            val opName = (safeString(operator, "user_name") + " " + safeString(operator, "user_surname")).trim()
                .ifEmpty { safeString(operator, "name") }
                .ifEmpty { safeString(r, "operater_name") }
            if (opName.isNotEmpty()) p.printText(lrLine("Izdao", opName) + "\n", null)
            val payName = paymentName.ifEmpty { safeString(r, "payment_method_name") }
            if (payName.isNotEmpty()) p.printText(lrLine("Sredstvo plaćanja", payName) + "\n", null)
            dline(p)

            // ----- STAVKE -----
            // Po liniji bold heading "${line_name} / ${dep} -- ${arr}/${dep_planned}",
            // pa po vrsti karte 3 stupca (vrsta 14 | qty x cij 10 | iznos 8) = 32.
            if (items != null) {
                for (i in 0 until items.size()) {
                    val it = items.getMap(i) ?: continue
                    val qty = safeDouble(it, "qty").toInt()
                    if (qty == 0) continue
                    val unit = safeDouble(it, "unit_price")
                    val total = unit * qty
                    val name = safeString(it, "ticket_type_name")
                    val route = if (it.hasKey("route")) it.getMap("route") else null
                    val lineName = safeString(route, "line_name").ifEmpty { safeString(it, "line_name") }
                    val depHarbor = safeString(route, "departure_harbor_name").ifEmpty { safeString(it, "departure_harbor_name") }
                    val arrHarbor = safeString(route, "arrival_harbor_name").ifEmpty { safeString(it, "arrival_harbor_name") }
                    val depPlanned = safeString(route, "departure_planned").ifEmpty { safeString(it, "departure_planned") }

                    // Bold heading: "line_name / depHarbor -- arrHarbor/depPlanned"
                    p.setPrinterStyle(1000, 1)
                    val heading = buildString {
                        if (lineName.isNotEmpty()) append(lineName)
                        if (depHarbor.isNotEmpty() || arrHarbor.isNotEmpty()) {
                            if (isNotEmpty()) append(" / ")
                            append("$depHarbor -- $arrHarbor")
                        }
                        if (depPlanned.isNotEmpty()) {
                            if (isNotEmpty()) append("/")
                            append(depPlanned)
                        }
                    }
                    if (heading.isNotEmpty()) {
                        for (line in wrapLines(heading, W)) p.printText("$line\n", null)
                    }
                    // Heading je već bold (globalno) — ostavi ON.

                    // 3-stupčana stavka: name(14) | "qty x cijena"(10) | iznos(8)
                    val priceCol = "${qty}x${"%.2f".format(unit)}"
                    val totalCol = "%.2f".format(total)
                    val nameCol = padR(trunc(name, 14), 14)
                    p.printText("$nameCol${padL(priceCol, 10)}${padL(totalCol, 8)}\n", null)
                }
            }
            dline(p)

            // ----- TOTALI (rightAlign u boat-desk; ovdje leftRight) -----
            p.printText(lrLine("Osnovice", "%.2f EUR".format(safeDouble(r, "total_vat_base"))) + "\n", null)
            p.printText(lrLine("PDV 25%", "%.2f EUR".format(safeDouble(r, "total_vat"))) + "\n", null)
            p.printText(lrLine("Luč. naknada", "%.2f EUR".format(safeDouble(r, "total_harbor_tax"))) + "\n", null)
            p.lineWrap(1, null)

            // ----- IZNOS (bold, doubleHeight, double-strike) -----
            try { p.sendRAWData(byteArrayOf(0x1B, 0x47, 0x01), null) } catch (_: Exception) {}
            p.setFontSize(34f, null)
            val totalAmount = if (safeDouble(r, "total_amount") != 0.0) safeDouble(r, "total_amount") else safeDouble(r, "amount")
            // Pri double-height fontu retak je ~22 chars. Koristimo lrLine s leftW=10, rightW=12.
            p.printText(lrLine("Iznos", "%.2f EUR".format(totalAmount), 10, 12) + "\n", null)
            // Isključi double-strike, vrati font. Bold ostaje ON.
            try { p.sendRAWData(byteArrayOf(0x1B, 0x47, 0x00), null) } catch (_: Exception) {}
            p.setFontSize(24f, null)
            dline(p)
            if (safeBool(r, "auto_validated")) {
                p.printText("Karte VALIDIRANE pri prodaji\n", null)
                dline(p)
            }

            // ----- KUPAC (R1) -----
            if (isR1) {
                p.printText("Kupac:\n", null)
                val bName = safeString(r, "buyer_name")
                if (bName.isNotEmpty()) p.printText("$bName\n", null)
                val bEmail = safeString(r, "buyer_email")
                if (bEmail.isNotEmpty()) p.printText("$bEmail\n", null)
                val bCompany = safeString(r, "buyer_company_name")
                if (bCompany.isNotEmpty()) p.printText("$bCompany\n", null)
                val bAddr = safeString(r, "buyer_address")
                if (bAddr.isNotEmpty()) p.printText("$bAddr\n", null)
                p.printText("OIB: $buyerOib\n", null)
                dline(p)
            }

            // ----- FOOTER (lučka taksa, čl. 33) -----
            for (line in wrapLines("U cijenu je uračunato 6% naknade za lučku taksu.", W)) p.printText("$line\n", null)
            for (line in wrapLines("The price includes 6% of the port tax fee.", W)) p.printText("$line\n", null)
            for (line in wrapLines("Lučke takse u cijeni su prolazne stavke. Oslobođeno PDV-a prema čl. 33 st.3 zakona i PDV-u.", W)) p.printText("$line\n", null)
            for (line in wrapLines("Port taxes in the price are a passing item. Exempt from VAT according to Art. 33 paragraf 3 of the Law on VAT.", W)) p.printText("$line\n", null)

            p.lineWrap(3, null)
            try { p.cutPaper(null) } catch (_: Exception) {}
            Log.d("SunmiPrint", "printReceipt: exit buffer (commit)")
            p.exitPrinterBuffer(true)
            Log.d("SunmiPrint", "printReceipt: DONE")
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e("SunmiPrint", "printReceipt FAILED", e)
            try { p.cutPaper(null) } catch (_: Exception) {}
            try { p.exitPrinterBuffer(true) } catch (_: Exception) {}
            promise.reject("PRINT_RECEIPT_ERR", e.message)
        }
    }

    // Zaključak smjene 1:1 boat-desk shiftPrintHelper.cjs, prilagođeno na 32-char.
    // Sve linije se pre-formatiraju u Kotlinu (padR/padL/center/lrLine).
    @ReactMethod
    fun printShiftReport(data: ReadableMap, promise: Promise) {
        val p = requirePrinter() ?: return promise.reject("NO_PRINTER", "not bound")
        try {
            val shift = if (data.hasKey("shift")) data.getMap("shift") else null
            val bd = if (data.hasKey("basicData")) data.getMap("basicData") else null
            val isReprint = safeBool(data, "isReprint")
            if (shift == null) { promise.reject("NO_SHIFT", "shift required"); return }

            try { p.exitPrinterBuffer(false) } catch (_: Exception) {}
            Log.d("SunmiPrint", "printShiftReport: enter buffer")
            p.enterPrinterBuffer(true)
            p.setAlignment(0, null)
            p.setFontSize(24f, null)
            // Globalni heating boost + bold (isto kao u printReceipt — sav tekst tamniji).
            try { p.sendRAWData(byteArrayOf(0x1B, 0x37, 0x0B, 0xC8.toByte(), 0x02), null) } catch (_: Exception) {}
            try { p.sendRAWData(byteArrayOf(0x1B, 0x45, 0x01), null) } catch (_: Exception) {}
            p.setPrinterStyle(1000, 1)

            // ----- KLIJENT (centrirano) -----
            val clientName = safeString(bd, "client_name").ifEmpty { "TRAVELO" }
            p.printText(center(clientName) + "\n", null)
            val clientAddr = safeString(bd, "client_address")
            if (clientAddr.isNotEmpty()) p.printText(center(clientAddr) + "\n", null)
            val clientCity = (safeString(bd, "client_postal_code") + " " + safeString(bd, "client_town")).trim()
            if (clientCity.isNotEmpty()) p.printText(center(clientCity) + "\n", null)
            val clientCountry = safeString(bd, "client_country")
            if (clientCountry.isNotEmpty()) p.printText(center(clientCountry) + "\n", null)
            val clientOib = safeString(bd, "client_legal_id")
            if (clientOib.isNotEmpty()) p.printText(center("OIB: $clientOib") + "\n", null)
            dline(p)

            // ----- POSLOVNI PROSTOR -----
            p.printText("POSLOVNI PROSTOR:\n", null)
            val bpName = safeString(bd, "business_premise_name")
            if (bpName.isNotEmpty()) p.printText(lrLine("Naziv:", bpName) + "\n", null)
            val bpAddr = safeString(bd, "business_premise_address")
            if (bpAddr.isNotEmpty()) p.printText(lrLine("Adresa:", bpAddr) + "\n", null)
            val bpCity = (safeString(bd, "business_premise_postal_code") + " " + safeString(bd, "business_premise_postal_town")).trim()
            if (bpCity.isNotEmpty()) p.printText(lrLine("Mjesto:", bpCity) + "\n", null)
            val bpMark = safeString(bd, "business_premise_fiscal_mark")
            if (bpMark.isNotEmpty()) p.printText(lrLine("Oznaka posl.:", bpMark) + "\n", null)
            val bdMark = safeString(bd, "billing_device_fiscal_mark").ifEmpty { safeString(shift, "billing_device_fiscal_mark") }
            if (bdMark.isNotEmpty()) p.printText(lrLine("Oznaka blagajne:", bdMark) + "\n", null)
            dline(p)

            // ----- NAPOMENA -----
            p.printText("NAPOMENA:\n", null)
            val remark = safeString(shift, "remark")
            if (remark.isNotEmpty()) {
                for (line in wrapLines(remark, W)) p.printText("$line\n", null)
            }
            dline(p)

            // ----- ZAKLJUČAK BR (bold, doubleHeight, double-strike, centrirano) -----
            if (isReprint) {
                p.setFontSize(28f, null)
                p.setAlignment(1, null)
                p.printText("KOPIJA\n", null)
                p.setFontSize(24f, null)
                p.setAlignment(0, null)
            }
            try { p.sendRAWData(byteArrayOf(0x1B, 0x47, 0x01), null) } catch (_: Exception) {}
            p.setFontSize(34f, null)
            p.setAlignment(1, null)
            val shiftId = safeString(shift, "id").ifEmpty {
                val u = safeString(shift, "shift_uuid")
                if (u.length > 8) u.substring(u.length - 8) else u
            }
            p.printText("ZAKLJUČAK BR:\n", null)
            p.printText("$shiftId\n", null)
            try { p.sendRAWData(byteArrayOf(0x1B, 0x47, 0x00), null) } catch (_: Exception) {}
            p.setFontSize(24f, null)
            p.setAlignment(0, null)
            dline(p)

            // ----- META -----
            val opName = (safeString(shift, "operater_name") + " " + safeString(shift, "operater_surname")).trim()
            if (opName.isNotEmpty()) p.printText(lrLine("Operater", opName) + "\n", null)
            dline(p)
            val shiftStart = safeString(shift, "shift_start")
            if (shiftStart.isNotEmpty()) {
                p.printText(lrLine("Datum otv.", fmtIsoDate(shiftStart)) + "\n", null)
                p.printText(lrLine("Vrijeme otv.", fmtIsoTime(shiftStart)) + "\n", null)
            }
            val shiftEnd = safeString(shift, "shift_end")
            if (shiftEnd.isNotEmpty()) {
                p.printText(lrLine("Datum zatv.", fmtIsoDate(shiftEnd)) + "\n", null)
                p.printText(lrLine("Vrijeme zatv.", fmtIsoTime(shiftEnd)) + "\n", null)
            }
            val firstInv = safeString(shift, "shift_first_invoice")
            if (firstInv.isNotEmpty()) p.printText(lrLine("Br. prvog rač.", firstInv) + "\n", null)
            val lastInv = safeString(shift, "shift_last_invoice")
            if (lastInv.isNotEmpty()) p.printText(lrLine("Br. zadnjeg rač.", lastInv) + "\n", null)
            dline(p)

            // ----- PRODANE KARTE (line_details ako postoje) -----
            val lineDetails = if (shift.hasKey("line_details")) shift.getArray("line_details") else null
            if (lineDetails != null && lineDetails.size() > 0) {
                p.lineWrap(1, null)
                p.printText(center("PRODANE KARTE") + "\n", null)
                p.printText(lrLine("Kategorija (kol):", "Iznos") + "\n", null)
                for (n in 0 until lineDetails.size()) {
                    val ld = lineDetails.getMap(n) ?: continue
                    dline(p)
                    val lc = safeString(ld, "line_code")
                    val ln = safeString(ld, "line_name")
                    val head = if (lc.isNotEmpty()) "($lc) - $ln" else ln
                    for (line in wrapLines(head, W)) p.printText("$line\n", null)
                    val td = if (ld.hasKey("tickets_details")) ld.getArray("tickets_details") else null
                    if (td != null) {
                        for (c in 0 until td.size()) {
                            val row = td.getMap(c) ?: continue
                            val cat = safeString(row, "category_name")
                            val q = safeDouble(row, "ticket_quantity").toInt()
                            val amt = safeDouble(row, "tickets_amount")
                            p.printText(lrLine("$cat($q)", "%.2f EUR".format(amt)) + "\n", null)
                        }
                    }
                }
                dline(p)
            }

            // ----- STORNIRANE KARTE -----
            val deactiveDetails = if (shift.hasKey("deacttive_line_detials")) shift.getArray("deacttive_line_detials") else null
            if (deactiveDetails != null && deactiveDetails.size() > 0) {
                p.lineWrap(1, null)
                p.printText(center("STORNIRANE KARTE") + "\n", null)
                p.printText(lrLine("Kategorija (kol):", "Iznos") + "\n", null)
                for (n in 0 until deactiveDetails.size()) {
                    val ld = deactiveDetails.getMap(n) ?: continue
                    dline(p)
                    val lc = safeString(ld, "line_code")
                    val ln = safeString(ld, "line_name")
                    val head = if (lc.isNotEmpty()) "($lc) - $ln" else ln
                    for (line in wrapLines(head, W)) p.printText("$line\n", null)
                    val td = if (ld.hasKey("tickets_details")) ld.getArray("tickets_details") else null
                    if (td != null) {
                        for (c in 0 until td.size()) {
                            val row = td.getMap(c) ?: continue
                            val cat = safeString(row, "category_name")
                            val q = safeDouble(row, "ticket_quantity").toInt()
                            val amt = safeDouble(row, "tickets_amount")
                            p.printText(lrLine("$cat($q)", "%.2f EUR".format(-amt)) + "\n", null)
                        }
                    }
                }
                dline(p)
            }

            // ----- STORNO -----
            // Isti raspored kao sekcija plaćanja ispod, samo su iznosi ono što je
            // vraćeno. Storna su već uračunata u iznose po sredstvu (negativan
            // iznos ih umanjuje) — ovo je pregled koliko je izašlo iz blagajne.
            // Razlikuje se od gornje sekcije STORNIRANE KARTE, koja je razrada po
            // linijama i kategorijama.
            val stornoFinance = if (shift.hasKey("shift_storno")) shift.getArray("shift_storno") else null
            if (stornoFinance != null && stornoFinance.size() > 0) {
                p.lineWrap(1, null)
                p.printText(center("STORNO") + "\n", null)
                p.printText(lrLine("Sredstvo plaćanja", "Iznos") + "\n", null)
                dline(p)
                for (n in 0 until stornoFinance.size()) {
                    val row = stornoFinance.getMap(n) ?: continue
                    val name = safeString(row, "payment_type_name").ifEmpty { "-" }
                    val cnt = safeDouble(row, "count").toInt()
                    val amt = safeDouble(row, "payment_amount")
                    val label = if (cnt > 0) "$name ($cnt)" else name
                    p.printText(lrLine(label, "%.2f EUR".format(amt)) + "\n", null)
                }
                dline(p)
                p.printText(lrLine("UKUPNO STORNIRANO", "%.2f EUR".format(safeDouble(shift, "shift_storno_amount"))) + "\n", null)
                dline(p)
            }

            // ----- SREDSTVA PLAĆANJA -----
            val finance = if (shift.hasKey("shift_finance")) shift.getArray("shift_finance") else null
            if (finance != null && finance.size() > 0) {
                p.lineWrap(1, null)
                p.printText(center("SREDSTVA PLAĆANJA") + "\n", null)
                p.printText(lrLine("Sredstvo plaćanja", "Iznos") + "\n", null)
                dline(p)
                for (n in 0 until finance.size()) {
                    val row = finance.getMap(n) ?: continue
                    val name = safeString(row, "payment_type_name").ifEmpty { "-" }
                    val expected = safeDouble(row, "payment_amount")
                    p.printText(lrLine(name, "%.2f EUR".format(expected)) + "\n", null)
                    val actualKey = "actual_amount"
                    val hasActual = row.hasKey(actualKey) && !row.isNull(actualKey)
                    if (hasActual) {
                        val actual = safeDouble(row, actualKey)
                        p.printText(lrLine("  Stvarno", "%.2f EUR".format(actual)) + "\n", null)
                        val diff = actual - expected
                        if (Math.abs(diff) >= 0.005) {
                            if (diff > 0) p.printText(lrLine("  Višak", "%.2f EUR".format(diff)) + "\n", null)
                            else p.printText(lrLine("  Manjak", "%.2f EUR".format(-diff)) + "\n", null)
                        }
                    }
                }
                dline(p)
            }

            // ----- UKUPNO (bold, doubleHeight, double-strike) -----
            p.lineWrap(1, null)
            dline(p)
            try { p.sendRAWData(byteArrayOf(0x1B, 0x47, 0x01), null) } catch (_: Exception) {}
            p.setFontSize(34f, null)
            val totalAmount = safeDouble(shift, "shift_amount").let { if (it != 0.0) it else safeDouble(shift, "amount") }
            // Pri double-height fontu retak je ~22 chars. lrLine s leftW=10, rightW=12.
            p.printText(lrLine("UKUPNO:", "%.2f EUR".format(totalAmount), 10, 12) + "\n", null)
            try { p.sendRAWData(byteArrayOf(0x1B, 0x47, 0x00), null) } catch (_: Exception) {}
            p.setFontSize(24f, null)
            dline(p)

            // ----- FOOTER -----
            p.lineWrap(1, null)
            p.setFontSize(20f, null)
            val sdfNow = SimpleDateFormat("dd.MM.yyyy HH:mm:ss", Locale.getDefault())
            p.printText(center("Ispisano: ${sdfNow.format(Date())}") + "\n", null)
            if (!safeBool(shift, "_synced")) p.printText(center("* OFFLINE — sync u tijeku *") + "\n", null)

            p.lineWrap(3, null)
            try { p.cutPaper(null) } catch (_: Exception) {}
            p.exitPrinterBuffer(true)
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e("SunmiPrint", "printShiftReport FAILED", e)
            try { p.cutPaper(null) } catch (_: Exception) {}
            try { p.exitPrinterBuffer(true) } catch (_: Exception) {}
            promise.reject("PRINT_SHIFT_ERR", e.message)
        }
    }

    // Ispis pojedinačnih karata po uzoru na travelo-boat-desk printTickets.
    // Svaka karta dobiva svoj buffer batch + cut paper. Layout 1:1 boat-desk,
    // prilagođeno na 32-char Sunmi V2s. Sve linije se pre-formatiraju u Kotlinu.
    @ReactMethod
    fun printTickets(data: ReadableMap, promise: Promise) {
        val p = requirePrinter() ?: return promise.reject("NO_PRINTER", "not bound")
        val tickets = if (data.hasKey("tickets")) data.getArray("tickets") else null
        if (tickets == null || tickets.size() == 0) { promise.resolve(true); return }
        val bd = if (data.hasKey("basicData")) data.getMap("basicData") else null
        val isReprint = safeBool(data, "isReprint")
        try {
            for (i in 0 until tickets.size()) {
                val t = tickets.getMap(i) ?: continue
                try { p.exitPrinterBuffer(false) } catch (_: Exception) {}
                Log.d("SunmiPrint", "printTickets[$i]: enter buffer")
                p.enterPrinterBuffer(true)
                try {
                    p.setAlignment(0, null)
                    p.setFontSize(24f, null)
                    // Globalni bold + heating boost za cijelu kartu (user feedback).
                    try { p.sendRAWData(byteArrayOf(0x1B, 0x37, 0x0B, 0xC8.toByte(), 0x02), null) } catch (_: Exception) {}
                    try { p.sendRAWData(byteArrayOf(0x1B, 0x45, 0x01), null) } catch (_: Exception) {}
                    p.setPrinterStyle(1000, 1)

                    // ----- HEADER (tvrtka + PRIJEVOZNA KARTA — bold + double-strike) -----
                    try { p.sendRAWData(byteArrayOf(0x1B, 0x47, 0x01), null) } catch (_: Exception) {}
                    val clientName = safeString(bd, "client_name").ifEmpty { "TRAVELO" }
                    p.setFontSize(30f, null)
                    p.setAlignment(1, null)
                    p.printText("$clientName\n", null)
                    p.setFontSize(24f, null)
                    p.printText(center("P R I J E V O Z N A   K A R T A") + "\n", null)
                    try { p.sendRAWData(byteArrayOf(0x1B, 0x47, 0x00), null) } catch (_: Exception) {}
                    p.setAlignment(0, null)
                    dline(p)

                    // ----- STATUS markeri -----
                    if (isReprint) {
                        p.setPrinterStyle(1000, 1)
                        p.setFontSize(28f, null)
                        p.setAlignment(1, null)
                        p.printText("KOPIJA KARTE\n", null)
                        p.setPrinterStyle(1000, 0)
                        p.setFontSize(24f, null)
                        p.setAlignment(0, null)
                    }
                    if (safeBool(t, "ticket_deactivate")) {
                        p.setPrinterStyle(1000, 1)
                        p.setFontSize(28f, null)
                        p.setAlignment(1, null)
                        p.printText("KARTA STORNIRANA\n", null)
                        p.setPrinterStyle(1000, 0)
                        p.setFontSize(24f, null)
                        p.setAlignment(0, null)
                    }

                    // ----- RUTA -----
                    val depHarbor = safeString(t, "departure_harbor_name")
                    val depPlanned = safeString(t, "departure_planed").ifEmpty { safeString(t, "departure_planned") }
                    val arrHarbor = safeString(t, "arrival_harbor_name")
                    val arrPlanned = safeString(t, "arrival_planed").ifEmpty { safeString(t, "arrival_planned") }

                    // Polazak — label small, vrijednosti veće + bold + double-strike.
                    p.printText("Departure / Polazak\n", null)
                    try { p.sendRAWData(byteArrayOf(0x1B, 0x47, 0x01), null) } catch (_: Exception) {}
                    p.setFontSize(30f, null)
                    if (depHarbor.isNotEmpty()) {
                        for (line in wrapLines(depHarbor, W)) p.printText("$line\n", null)
                    }
                    if (depPlanned.isNotEmpty()) {
                        for (line in wrapLines(depPlanned, W)) p.printText("$line\n", null)
                    }
                    p.setFontSize(24f, null)
                    try { p.sendRAWData(byteArrayOf(0x1B, 0x47, 0x00), null) } catch (_: Exception) {}

                    p.printText("Arrival / Dolazak\n", null)
                    try { p.sendRAWData(byteArrayOf(0x1B, 0x47, 0x01), null) } catch (_: Exception) {}
                    p.setFontSize(30f, null)
                    if (arrHarbor.isNotEmpty()) {
                        for (line in wrapLines(arrHarbor, W)) p.printText("$line\n", null)
                    }
                    if (arrPlanned.isNotEmpty()) {
                        for (line in wrapLines(arrPlanned, W)) p.printText("$line\n", null)
                    }
                    p.setFontSize(24f, null)
                    try { p.sendRAWData(byteArrayOf(0x1B, 0x47, 0x00), null) } catch (_: Exception) {}
                    dline(p)

                    // ----- PUTNIK / LINIJA -----
                    p.printText(lrLine("Putnik / Passanger", safeString(t, "ticket_type_name")) + "\n", null)
                    dline(p)
                    val lineLabel = safeString(t, "line_name").ifEmpty { safeString(t, "line_code") }
                    p.printText(lrLine("Linija / Line", lineLabel) + "\n", null)
                    dline(p)

                    // ----- POVLAŠTENA KARTA -----
                    // Mobile API šalje SEOP polja direktno na ticket objektu (is_island,
                    // seop_card_no, seop_otok, seop_pravo) — boat-desk koristi card_data.F2
                    // koji popunjava akdCard reader. Podržavamo oba oblika.
                    val ticketTypeUpper = safeString(t, "ticket_type_name").uppercase()
                    val cardData = if (t.hasKey("card_data") && !t.isNull("card_data")) t.getMap("card_data") else null
                    val cardF2 = if (cardData != null && cardData.hasKey("F2") && !cardData.isNull("F2")) cardData.getMap("F2") else null

                    val isSeop = safeBool(t, "is_island") || ticketTypeUpper.contains("SEOP")
                    val seopCardNo = safeString(t, "seop_card_no")
                    val seopOtok = safeString(t, "seop_otok")
                    val seopPravo = safeString(t, "seop_pravo")

                    if (cardF2 != null && ticketTypeUpper.contains("MOSI")) {
                        p.setAlignment(1, null)
                        p.printText("PODACI O POVLAŠTENOJ KARTI\n", null)
                        p.printText("MOSI\n", null)
                        p.setAlignment(0, null)
                        val name = (safeString(cardF2, "Ime") + " " + safeString(cardF2, "Prezime")).trim()
                        if (name.isNotEmpty()) p.printText(lrLine("Ime i prezime:", name) + "\n", null)
                        val oib = safeString(cardF2, "OIB"); if (oib.isNotEmpty()) p.printText(lrLine("OIB:", oib) + "\n", null)
                        val sbr = safeString(cardF2, "SBr"); if (sbr.isNotEmpty()) p.printText(lrLine("Ser. br. iskaznice:", sbr) + "\n", null)
                        val di = if (cardF2.hasKey("DatIzdavanja") && !cardF2.isNull("DatIzdavanja")) cardF2.getMap("DatIzdavanja") else null
                        if (di != null) p.printText(lrLine("Dat. izdavanja:", "${safeString(di, "Day")}/${safeString(di, "Month")}/${safeString(di, "Year")}") + "\n", null)
                        val de = if (cardF2.hasKey("DatIsteka") && !cardF2.isNull("DatIsteka")) cardF2.getMap("DatIsteka") else null
                        if (de != null) p.printText(lrLine("Vrijedi do:", "${safeString(de, "Day")}/${safeString(de, "Month")}/${safeString(de, "Year")}") + "\n", null)
                        p.lineWrap(1, null)
                        dline(p)
                    } else if (isSeop && (cardF2 != null || seopCardNo.isNotEmpty() || seopOtok.isNotEmpty())) {
                        p.setAlignment(1, null)
                        p.printText("PODACI O POVLAŠTENOJ KARTI\n", null)
                        p.printText("SEOP\n", null)
                        p.setAlignment(0, null)
                        if (cardF2 != null) {
                            // Bogati card_data oblik (sa akdCard reader-a)
                            val name = (safeString(cardF2, "FirstName") + " " + safeString(cardF2, "Surname")).trim()
                            if (name.isNotEmpty()) p.printText(lrLine("Ime i prezime:", name) + "\n", null)
                            val oib = safeString(cardF2, "OIB"); if (oib.isNotEmpty()) p.printText(lrLine("OIB:", oib) + "\n", null)
                            val addr = safeString(cardF2, "PermResAddress"); if (addr.isNotEmpty()) p.printText(lrLine("Adresa:", addr) + "\n", null)
                            val mjesto = safeString(cardF2, "PermResName"); if (mjesto.isNotEmpty()) p.printText(lrLine("Mjesto:", mjesto) + "\n", null)
                            val otok = safeString(cardF2, "IslandName"); if (otok.isNotEmpty()) p.printText(lrLine("Otok:", otok) + "\n", null)
                            val sbr = safeString(cardF2, "CardNumber"); if (sbr.isNotEmpty()) p.printText(lrLine("Ser. br.:", sbr) + "\n", null)
                            val pravo = safeString(cardF2, "BasicRight"); if (pravo.isNotEmpty()) p.printText(lrLine("Osnovno pravo:", pravo) + "\n", null)
                            val di = if (cardF2.hasKey("IssuanceDate") && !cardF2.isNull("IssuanceDate")) cardF2.getMap("IssuanceDate") else null
                            if (di != null) p.printText(lrLine("Dat. izdavanja:", "${safeString(di, "Day")}/${safeString(di, "Month")}/${safeString(di, "Year")}") + "\n", null)
                            val de = if (cardF2.hasKey("ExpirationDate") && !cardF2.isNull("ExpirationDate")) cardF2.getMap("ExpirationDate") else null
                            if (de != null) p.printText(lrLine("Vrijedi do:", "${safeString(de, "Day")}/${safeString(de, "Month")}/${safeString(de, "Year")}") + "\n", null)
                        } else {
                            // Plain mobile oblik — minimalna polja iz transactions-service
                            if (seopCardNo.isNotEmpty()) p.printText(lrLine("Ser. br. iskaznice:", seopCardNo) + "\n", null)
                            if (seopOtok.isNotEmpty()) p.printText(lrLine("Otok:", seopOtok) + "\n", null)
                            if (seopPravo.isNotEmpty()) p.printText(lrLine("Osnovno pravo:", seopPravo) + "\n", null)
                        }
                        p.lineWrap(1, null)
                        dline(p)
                    } else if (cardData != null && ticketTypeUpper.contains("VIRTUAL")) {
                        p.setAlignment(1, null)
                        p.printText("PODACI O POVLAŠTENOJ KARTI\n", null)
                        p.printText("VIRTUALNA KARTICA\n", null)
                        p.setAlignment(0, null)
                        val kod = safeString(cardData, "code"); if (kod.isNotEmpty()) p.printText(lrLine("Kod:", kod) + "\n", null)
                        val pravo = safeString(cardData, "label"); if (pravo.isNotEmpty()) p.printText(lrLine("Osnovno pravo:", pravo) + "\n", null)
                        val odob = safeString(cardData, "odobrenje"); if (odob.isNotEmpty()) p.printText(lrLine("Br. odobrenja:", odob) + "\n", null)
                        val opis = safeString(cardData, "description")
                        if (opis.isNotEmpty()) {
                            p.printText("Opis:\n", null)
                            for (line in wrapLines(opis, W)) p.printText("$line\n", null)
                        }
                        p.lineWrap(1, null)
                        dline(p)
                    }

                    // ----- QR + ticket_code -----
                    p.setAlignment(1, null)
                    val qrData = listOf(
                        safeString(t, "ticket_qr"),
                        safeString(t, "ticket_uuid")
                    ).firstOrNull { it.isNotEmpty() } ?: ""
                    if (qrData.isNotEmpty()) {
                        try { printRawQR(p, qrData, 5, 49) } catch (_: Exception) {}
                    }
                    val ticketCode = safeString(t, "ticket_code")
                    if (ticketCode.isNotEmpty()) {
                        // Bold + double-strike + double-height — kod karte mora biti najuočljiviji.
                        try { p.sendRAWData(byteArrayOf(0x1B, 0x47, 0x01), null) } catch (_: Exception) {}
                        p.setFontSize(34f, null)
                        p.printText("$ticketCode\n", null)
                        try { p.sendRAWData(byteArrayOf(0x1B, 0x47, 0x00), null) } catch (_: Exception) {}
                        p.setFontSize(24f, null)
                    }
                    if (safeString(t, "status") == "validated") {
                        p.setPrinterStyle(1000, 1)
                        p.setFontSize(28f, null)
                        p.printText("VALIDIRANO\n", null)
                        p.setPrinterStyle(1000, 0)
                        p.setFontSize(24f, null)
                    }
                    p.setAlignment(0, null)
                    dline(p)

                    // ----- FOOTER -----
                    p.setFontSize(20f, null)
                    for (line in wrapLines("Dozvoljena osobna prtljaga do 23kg / Maximum luggage weight up to 23kg", W)) p.printText("$line\n", null)
                    for (line in wrapLines("Dužni ste predočiti kartu s kodom prilikom ukrcaja / You are obligated to present the code printed on the ticket while boarding", W)) p.printText("$line\n", null)

                    p.lineWrap(1, null)
                    try { p.cutPaper(null) } catch (_: Exception) {}
                    p.exitPrinterBuffer(true)
                } catch (e: Exception) {
                    Log.e("SunmiPrint", "printTickets ticket #$i FAILED", e)
                    try { p.cutPaper(null) } catch (_: Exception) {}
                    try { p.exitPrinterBuffer(true) } catch (_: Exception) {}
                    throw e
                }
            }
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e("SunmiPrint", "printTickets FAILED", e)
            promise.reject("PRINT_TICKETS_ERR", e.message)
        }
    }
}
