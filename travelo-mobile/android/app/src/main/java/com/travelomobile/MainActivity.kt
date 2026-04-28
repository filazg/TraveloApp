package com.travelomobile

import android.content.Intent
import android.view.KeyEvent
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.travelomobile.akd.AkdCardModule

class MainActivity : ReactActivity() {

    override fun getMainComponentName(): String = "TraveloMobile"

    override fun createReactActivityDelegate(): ReactActivityDelegate =
        DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

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
        android.util.Log.d("TraveloMobile", "onKeyDown keyCode=$keyCode")
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
