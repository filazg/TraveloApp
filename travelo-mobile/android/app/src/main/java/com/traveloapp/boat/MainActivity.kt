package com.traveloapp.boat

import android.content.Intent
import android.view.KeyEvent
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.traveloapp.boat.akd.AkdCardModule

class MainActivity : ReactActivity() {

    override fun getMainComponentName(): String = "TraveloAppBoatMobile"

    override fun createReactActivityDelegate(): ReactActivityDelegate =
        DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

    // Traka s Android tipkama (natrag, početna, nedavne) skrivena je dok je
    // aplikacija na ekranu; povlačenjem od donjeg ruba pojavi se privremeno.
    // Vrijedi samo za ovaj prozor — u drugim aplikacijama traka je normalna.
    // Postavlja se pri svakom dobivanju fokusa jer je sustav vraća nakon
    // dijaloga, tipkovnice i povratka u aplikaciju.
    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) sakrijTipke()
    }

    private fun sakrijTipke() {
        val ctrl = WindowCompat.getInsetsController(window, window.decorView)
        ctrl.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        ctrl.hide(WindowInsetsCompat.Type.navigationBars())
    }

    // NFC tag intent stiže ovdje — proslijedi modulu da pročita karticu i emit-a JS event.
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        android.util.Log.w("AkdCard", "MainActivity.onNewIntent action=${intent.action}")
        AkdCardModule.getInstance()?.handleNfcIntent(intent)
    }

    // Sunmi V2s hardware scan tipka (function_2) isporučuje Android KeyEvent koji
    // RN DevSupportManager u debug modu prepoznaje kao dev-menu okidač i radi
    // CatalystInstance.destroy() + reload. Progutaj te eventove prije nego
    // ReactActivity ih proslijedi dev support handleru.
    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        android.util.Log.d("TraveloAppBoat", "onKeyDown keyCode=$keyCode")
        if (shouldSwallowKey(keyCode)) return true
        return super.onKeyDown(keyCode, event)
    }

    override fun onKeyUp(keyCode: Int, event: KeyEvent?): Boolean {
        if (shouldSwallowKey(keyCode)) return true
        return super.onKeyUp(keyCode, event)
    }

    private fun shouldSwallowKey(keyCode: Int): Boolean {
        return when (keyCode) {
            KeyEvent.KEYCODE_MENU,          // 82 — dev menu trigger
            KeyEvent.KEYCODE_BUTTON_L1,     // 102
            KeyEvent.KEYCODE_BUTTON_R1,     // 103
            KeyEvent.KEYCODE_FOCUS,         // 80 — camera focus
            285, 286, 287, 288, 289, 290,   // Sunmi scan key custom range
            291, 292, 293, 294, 295, 296 -> true
            else -> false
        }
    }
}
