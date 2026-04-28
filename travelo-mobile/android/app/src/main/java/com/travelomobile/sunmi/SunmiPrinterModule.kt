package com.travelomobile.sunmi

import android.content.ComponentName
import android.content.Intent
import android.content.ServiceConnection
import android.os.IBinder
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import woyou.aidlservice.jiuiv5.ICallback
import woyou.aidlservice.jiuiv5.IWoyouService

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
}
