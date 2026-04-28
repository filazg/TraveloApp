package com.travelomobile.sunmi

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule

// Native bridge for Sunmi V2s hardware barcode/QR scanner.
// The device broadcasts scan results via two well-known intent actions:
//   com.sunmi.scanner.ACTION_DATA_CODE_RECEIVED   — extras: "data" (String)
//   com.sumni.scanner.ACTION_DATA_CODE_RECEIVED   — alias on some firmwares
// We emit the scanned string to JS as a "SunmiScan" event, which the RN
// layer listens for via DeviceEventEmitter.
class SunmiScannerModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private var receiver: BroadcastReceiver? = null

    override fun getName(): String = "SunmiScanner"

    @ReactMethod
    fun addListener(eventName: String) {
        // Required stub for NativeEventEmitter compatibility.
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // Required stub for NativeEventEmitter compatibility.
    }

    @ReactMethod
    fun start() {
        if (receiver != null) return
        receiver = object : BroadcastReceiver() {
            override fun onReceive(ctx: Context?, intent: Intent?) {
                val data = intent?.getStringExtra("data") ?: return
                if (data.isEmpty()) return
                reactApplicationContext
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    .emit("SunmiScan", data)
            }
        }
        val filter = IntentFilter().apply {
            addAction("com.sunmi.scanner.ACTION_DATA_CODE_RECEIVED")
            // fallback for legacy firmware with typo
            addAction("com.sumni.scanner.ACTION_DATA_CODE_RECEIVED")
        }
        // Use exported=false for security on Android 12+ by default, but Sunmi
        // broadcasts come from the platform service so we must register as exported.
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
            reactApplicationContext.registerReceiver(receiver, filter, Context.RECEIVER_EXPORTED)
        } else {
            reactApplicationContext.registerReceiver(receiver, filter)
        }
    }

    @ReactMethod
    fun stop() {
        receiver?.let {
            try {
                reactApplicationContext.unregisterReceiver(it)
            } catch (_: Exception) {
            }
        }
        receiver = null
    }
}
