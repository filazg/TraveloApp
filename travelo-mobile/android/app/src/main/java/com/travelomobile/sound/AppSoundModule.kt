package com.travelomobile.sound

import android.content.Context
import android.media.AudioManager
import android.media.ToneGenerator
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

// Built-in DTMF/proprietary toneovi preko Android ToneGenerator-a — bez asset
// fajlova, radi na svim uređajima uključujući Sunmi V2s. Tri semantička zvuka:
//  - success: kratak afirmativan (TONE_PROP_ACK, ~200ms)
//  - prompt:  dvostruki kratki beep (TONE_PROP_BEEP2, ~70ms+70ms — "treba akcija")
//  - error:   niski produženi (TONE_PROP_NACK, ~500ms)
class AppSoundModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private val ctx: ReactApplicationContext = reactContext

    // STREAM_MUSIC je najpouzdaniji "loud" stream na Sunmi V2s — nije pod kontrolom
    // notification/ring volume slidera koji su često spušteni. Plus, prije svakog
    // poziva forsiramo taj stream na max kako toneovi uvijek izađu glasno.
    private val tone: ToneGenerator by lazy {
        ToneGenerator(AudioManager.STREAM_MUSIC, 100)
    }

    private fun maxMusicStream() {
        try {
            val am = ctx.getSystemService(Context.AUDIO_SERVICE) as AudioManager
            val max = am.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
            if (am.getStreamVolume(AudioManager.STREAM_MUSIC) < max) {
                am.setStreamVolume(AudioManager.STREAM_MUSIC, max, 0)
            }
        } catch (_: Exception) { /* nastavi — tone će izaći na trenutnom volume-u */ }
    }

    override fun getName(): String = "AppSound"

    @ReactMethod
    fun playSuccess(promise: Promise) {
        try {
            maxMusicStream()
            tone.startTone(ToneGenerator.TONE_PROP_ACK, 200)
            promise.resolve(true)
        } catch (e: Exception) { promise.reject("SOUND_ERR", e.message) }
    }

    @ReactMethod
    fun playPrompt(promise: Promise) {
        try {
            maxMusicStream()
            tone.startTone(ToneGenerator.TONE_PROP_BEEP2, 200)
            promise.resolve(true)
        } catch (e: Exception) { promise.reject("SOUND_ERR", e.message) }
    }

    @ReactMethod
    fun playError(promise: Promise) {
        try {
            maxMusicStream()
            tone.startTone(ToneGenerator.TONE_PROP_NACK, 500)
            promise.resolve(true)
        } catch (e: Exception) { promise.reject("SOUND_ERR", e.message) }
    }
}
