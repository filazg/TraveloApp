package com.travelomobile.akd

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.media.AudioManager
import android.media.RingtoneManager
import android.media.ToneGenerator
import android.util.Log
import android.view.inputmethod.InputMethodManager
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.nxp.nfclib.NxpNfcLib
import hr.akd.tessera.Card
import hr.akd.tessera.CardController
import hr.akd.tessera.kartice.akd.mosi.MosiCard
import hr.akd.tessera.kartice.akd.seop.SeopCardPersonal
import hr.akd.tessera.kartice.akd.seop.SeopCardVehicle
import hr.akd.tesserapojos.CardKeys

// AKD otočne iskaznice (SEOP) i MOSI invalidske kartice — čitanje preko ugrađenog
// NFC-a. Roko demo zove `registerActivity` + `startForeGroundDispatch` u SVAKI
// onResume jer TapLinx ne tolerira stale Activity reference. Mi postižemo isto
// pozivajući oba u svakom `startScan` (i ne predmemoriranjem instance-a libe).
class AkdCardModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "AkdCard"
        // Roko demo TapLinx key — vrijedi za 'hr.koris.roko' i, prema testovima,
        // i za druge package name-ove jer ovaj ključ ne stiže do NXP-ovih servera
        // u offline mode-u. Za produkciju registriraj vlastiti na mifare.net.
        private const val TAP_LINX_KEY = "ac75501790398e556bc059d8cdf1de30"
        private var instance: AkdCardModule? = null
        @JvmStatic
        fun getInstance(): AkdCardModule? = instance
    }

    private var scanning: Boolean = false

    init {
        instance = this
    }

    override fun getName(): String = "AkdCard"

    @ReactMethod
    fun startScan(promise: Promise) {
        try {
            val activity: Activity = currentActivity ?: run {
                promise.reject("NO_ACTIVITY", "No current activity")
                return
            }
            activity.runOnUiThread {
                try {
                    val lib = NxpNfcLib.getInstance()
                    // Re-registriraj svaki put — Activity može biti recreated.
                    lib.registerActivity(activity, TAP_LINX_KEY)
                    lib.startForeGroundDispatch()
                    scanning = true
                    Log.d(TAG, "startScan ok pkg=${activity.packageName} actClass=${activity.javaClass.simpleName}")
                    promise.resolve(true)
                } catch (e: Exception) {
                    Log.e(TAG, "startScan FAIL", e)
                    promise.reject("START_FAIL", e.message ?: e.javaClass.simpleName, e)
                }
            }
        } catch (e: Exception) {
            promise.reject("START_FAIL", e.message, e)
        }
    }

    @ReactMethod
    fun hideKeyboard(promise: Promise) {
        try {
            val activity = currentActivity ?: run {
                promise.resolve(false)
                return
            }
            activity.runOnUiThread {
                try {
                    val imm = activity.getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
                    val view = activity.currentFocus ?: activity.window.decorView
                    imm.hideSoftInputFromWindow(view.windowToken, 0)
                    activity.window.decorView.clearFocus()
                    promise.resolve(true)
                } catch (e: Exception) {
                    promise.reject("HIDE_FAIL", e.message, e)
                }
            }
        } catch (e: Exception) {
            promise.reject("HIDE_FAIL", e.message, e)
        }
    }

    @ReactMethod
    fun stopScan(promise: Promise) {
        try {
            scanning = false
            currentActivity?.runOnUiThread {
                try { NxpNfcLib.getInstance().stopForeGroundDispatch() } catch (_: Exception) {}
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("STOP_FAIL", e.message, e)
        }
    }

    // Pozvano iz MainActivity.onNewIntent kada stigne NFC tag intent dok je scanning aktivan.
    fun handleNfcIntent(intent: Intent) {
        Log.d(TAG, "onNewIntent action=${intent.action} scanning=$scanning")
        if (!scanning) return
        val keys = CardKeys().apply {
            MosiKeyF2 = CardKeys.TEST_MOSI_F2_BASIC_DATA_KEY
            SeopKeyF2 = CardKeys.TEST_SEOP_F2_BASIC_DATA_KEY
            SeopKeyF3 = CardKeys.TEST_SEOP_F3_ADDON_DATA_KEY
            JL2GoKey  = CardKeys.TEST_JL2GO_KEY
        }
        try {
            val card: Card? = CardController.cardLogic(intent, NxpNfcLib.getInstance(), keys)
            if (card == null) {
                Log.w(TAG, "cardLogic returned null")
                playFeedback(false)
                emit(Arguments.createMap().apply { putString("error", "Kartica nije prepoznata") })
                return
            }
            Log.d(TAG, "Card read: ${card.javaClass.simpleName}")
            playFeedback(true)
            emit(serializeCard(card))
        } catch (e: Exception) {
            Log.e(TAG, "cardLogic FAIL: ${e.javaClass.simpleName} - ${e.message}", e)
            playFeedback(false)
            // Detaljna poruka za dijagnostiku — JS prikazuje ispod input-a.
            val msg = "${e.javaClass.simpleName}: ${e.message ?: "unknown"}"
            emit(Arguments.createMap().apply { putString("error", msg) })
        }
    }

    private fun playFeedback(success: Boolean) {
        try {
            if (success) {
                val uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
                RingtoneManager.getRingtone(reactApplicationContext, uri)?.play()
            } else {
                val tg = ToneGenerator(AudioManager.STREAM_NOTIFICATION, 80)
                tg.startTone(ToneGenerator.TONE_PROP_BEEP2, 200)
                Thread { Thread.sleep(300); tg.release() }.start()
            }
        } catch (_: Exception) {}
    }

    private fun emit(payload: WritableMap) {
        try {
            reactApplicationContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit("akdCardRead", payload)
        } catch (_: Exception) {}
    }

    private fun serializeCard(card: Card): WritableMap {
        val out = Arguments.createMap()
        when (card) {
            is SeopCardPersonal -> {
                val f2 = card.F2
                out.putString("cardFamily", "SEOP_P")
                out.putString("cardNumber", f2?.CardNumber ?: "")
                out.putString("firstName", f2?.FirstName ?: "")
                out.putString("surname", f2?.Surname ?: "")
                out.putString("oib", f2?.OIB ?: "")
                out.putString("islandName", f2?.IslandName ?: "")
                out.putString("basicRight", f2?.BasicRight ?: "")
            }
            is SeopCardVehicle -> {
                val f2 = card.F2
                out.putString("cardFamily", "SEOP_V")
                out.putString("cardNumber", f2?.CardNumber ?: "")
                out.putString("regOzn", f2?.LicensePlateNumber ?: "")
                out.putString("ownerOib", f2?.OwnerOIB ?: "")
                out.putString("basicRight", f2?.BasicRight ?: "")
            }
            is MosiCard -> {
                val f2 = card.F2
                out.putString("cardFamily", "MOSI")
                out.putString("cardNumber", f2?.SBr ?: "")
                out.putString("firstName", f2?.Ime ?: "")
                out.putString("surname", f2?.Prezime ?: "")
                out.putString("oib", f2?.OIB ?: "")
            }
            else -> out.putString("cardFamily", card::class.java.simpleName)
        }
        return out
    }
}
