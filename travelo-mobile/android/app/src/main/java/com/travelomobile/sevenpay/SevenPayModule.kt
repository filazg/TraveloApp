package com.travelomobile.sevenpay

import android.app.Activity
import android.content.Intent
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

// Kartično plaćanje preko 7pay SoftPOS aplikacije na terminalu.
//
// 7pay se ne poziva servisom nego intentom: pošalje se JSON zahtjev u extri
// `softpos_ecr`, njihova aplikacija preuzme ekran, provede transakciju i vrati
// rezultat u istoj extri kroz onActivityResult. Zahtjev slaže JS (vidi
// src/services/cardPayment.js) jer traži Firebase idToken i podatke o trgovcu.
//
// Paket 7pay aplikacije se šalje iz JS-a — na terminalu postoje i testna
// (com.sevenpay.tnp_test) i produkcijska (com.sevenpay.tnp_prod) varijanta, pa
// izbor ide iz konfiguracije umjesto da bude zakovan u kodu. Oba paketa moraju
// biti navedena u <queries> u AndroidManifestu, inače ih Android 11+ ne vidi.
//
// Isto vrijedi i za oznaku pošiljatelja: stara terminalska aplikacija se zvala
// com.t4bc_m_terminal i pod tim je imenom prijavljena kod 7pay-a, pa se i mi
// predstavljamo tako iako nam je package drugi.
class SevenPayModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private val ctx: ReactApplicationContext = reactContext
    private var paymentPromise: Promise? = null

    companion object {
        private const val SOFTPOS_REQUEST = 1001
        private const val EXTRA_ECR = "softpos_ecr"
    }

    private val activityListener: ActivityEventListener = object : BaseActivityEventListener() {
        override fun onActivityResult(activity: Activity?, requestCode: Int, resultCode: Int, data: Intent?) {
            if (requestCode != SOFTPOS_REQUEST) return
            val promise = paymentPromise ?: return
            paymentPromise = null

            if (data == null) {
                // Korisnik je izašao iz 7pay-a bez dovršetka.
                promise.reject("SOFTPOS_CANCELED", "7pay nije vratio rezultat")
                return
            }
            val resultJson = data.getStringExtra(EXTRA_ECR)
            if (resultCode == Activity.RESULT_OK && resultJson != null) {
                promise.resolve(resultJson)
            } else {
                // I odbijena transakcija nosi JSON s responseCode — proslijedi ga
                // kakav jest da JS može prikazati konkretan razlog.
                promise.reject("SOFTPOS_ERROR", resultJson ?: "Plaćanje nije uspjelo")
            }
        }
    }

    init {
        ctx.addActivityEventListener(activityListener)
    }

    override fun getName(): String = "SevenPay"

    // Je li 7pay aplikacija uopće instalirana — da prodajni ekran može ranije
    // javiti problem, umjesto da padne tek na naplati.
    @ReactMethod
    fun isAvailable(packageName: String, promise: Promise) {
        try {
            val intent = ctx.packageManager.getLaunchIntentForPackage(packageName)
            promise.resolve(intent != null)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    // senderAppId je oznaka pod kojom se predstavljamo 7pay-u. Nije nuzno nas
    // vlastiti package: 7pay ima registriranu aplikaciju pod kojom je terminal
    // prijavljen, a nasa je zbog TapLinx kljuca preimenovana u hr.koris.roko.
    // Zato vrijednost dolazi iz konfiguracije; prazno znaci "koristi vlastiti".
    @ReactMethod
    fun startPayment(packageName: String, requestJson: String, senderAppId: String?, promise: Promise) {
        if (paymentPromise != null) {
            promise.reject("PAYMENT_IN_PROGRESS", "Kartično plaćanje je već u tijeku")
            return
        }
        val current = currentActivity
        if (current == null) {
            promise.reject("NO_ACTIVITY", "Nema aktivne aktivnosti")
            return
        }
        try {
            val intent = ctx.packageManager.getLaunchIntentForPackage(packageName)
            if (intent == null) {
                promise.reject("APP_NOT_FOUND", "7pay aplikacija ($packageName) nije instalirana")
                return
            }
            paymentPromise = promise
            intent.flags = Intent.FLAG_ACTIVITY_CLEAR_TOP
            intent.putExtra("activity_for_result", 2)
            intent.putExtra(EXTRA_ECR, requestJson)
            intent.putExtra("senderAppID", if (senderAppId.isNullOrBlank()) ctx.packageName else senderAppId)
            current.startActivityForResult(intent, SOFTPOS_REQUEST)
        } catch (e: Exception) {
            paymentPromise = null
            promise.reject("SOFTPOS_ERROR", e.message)
        }
    }
}
