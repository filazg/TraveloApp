package com.travelomobile

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.load
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.react.soloader.OpenSourceMergedSoMapping
import com.facebook.soloader.SoLoader
import com.travelomobile.sunmi.SunmiScannerPackage
import com.travelomobile.akd.AkdCardPackage
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions

// Dual-host MainApplication — definira i legacy ReactNativeHost i ReactHost koji
// delegira na njega. Ovo je jedini način da `newArchEnabled=false` iz
// gradle.properties stvarno isključi bridgeless/Fabric u RN 0.85+.
//
// Razlog: bridgeless mod (default kad se koristi `getDefaultReactHost(context, packageList)`
// verzija) ruši app na svaki hardware scan key event na Sunmi V2s (ReactHost reload
// cascade). Prijelaz na classic bridge potpuno eliminira tu putanju.
class MainApplication : Application(), ReactApplication {

    override val reactNativeHost: ReactNativeHost =
        object : DefaultReactNativeHost(this) {
            override fun getPackages(): List<ReactPackage> =
                PackageList(this).packages.apply {
                    add(SunmiScannerPackage())
                    add(AkdCardPackage())
                }

            override fun getJSMainModuleName(): String = "index"

            override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

            override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
            override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
        }

    override val reactHost: ReactHost
        get() = getDefaultReactHost(applicationContext, reactNativeHost)

    override fun onCreate() {
        super.onCreate()
        SoLoader.init(this, OpenSourceMergedSoMapping)
        // NXP TapLinx interno zove FirebaseAnalytics.getInstance(...) iz async
        // task-a (telemetry); bez inicijaliziranog FirebaseApp-a baca
        // IllegalStateException u onPostExecute → FATAL u glavnom thread-u.
        // Mi ne koristimo Firebase, ali moramo init-ati s dummy opcijama da
        // SDK ne padne. Bez google-services plugin-a je manualno.
        try {
            if (FirebaseApp.getApps(this).isEmpty()) {
                val opts = FirebaseOptions.Builder()
                    .setApiKey("nokey")
                    .setApplicationId("1:000000000000:android:0000000000000000")
                    .setProjectId("travelo-noop")
                    .build()
                FirebaseApp.initializeApp(this, opts)
            }
        } catch (e: Exception) {
            android.util.Log.w("TraveloMobile", "FirebaseApp init failed: ${e.message}")
        }
        if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
            load()
        }
    }
}
