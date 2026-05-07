package com.travelomobile.auth

import at.favre.lib.crypto.bcrypt.BCrypt
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

// Native BCrypt verifier — pure-JS bcryptjs blokira RN JS thread 0.5-1.5s
// na Sunmi V2s ARM CPU. at.favre.lib:bcrypt odradi isti verify u ~50-100ms.
//
// Koristimo favre lib (a ne org.mindrot:jbcrypt) jer jbcrypt 0.4 ne handle-a
// ispravno $2b$ format — vraća false za hashove koje bcryptjs/Node bcrypt
// generira. Favre verifyer() detektira točan version byte iz hasha i primjenjuje
// odgovarajući algoritam.
class AppAuthModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "AppAuth"

    @ReactMethod
    fun checkpw(plain: String?, hashed: String?, promise: Promise) {
        try {
            if (plain == null || hashed == null || hashed.isEmpty()) {
                promise.resolve(false)
                return
            }
            val result = BCrypt.verifyer().verify(plain.toCharArray(), hashed.toCharArray())
            promise.resolve(result.verified)
        } catch (e: IllegalArgumentException) {
            // Neispravan hash format — tretiraj kao mismatch umjesto greške;
            // pozivatelj bira fallback ponašanje.
            promise.resolve(false)
        } catch (e: Exception) {
            promise.reject("AUTH_ERR", e.message)
        }
    }
}
