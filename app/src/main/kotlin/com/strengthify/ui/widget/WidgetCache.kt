package com.strengthify.ui.widget

import android.content.Context
import com.strengthify.domain.XpEngine

/**
 * Lightweight SharedPreferences cache so the AppWidget can read
 * the latest profile data without touching Room on the main thread.
 *
 * Updated by LoggingViewModel after every completed session.
 */
object WidgetCache {

    private const val PREFS = "strengthify_widget"

    fun update(context: Context, level: Int, totalXp: Int, streak: Int) {
        val prevThreshold  = XpEngine.thresholdForLevel(level)
        val nextThreshold  = XpEngine.thresholdForLevel(level + 1)
        val xpInLevel      = (totalXp - prevThreshold).coerceAtLeast(0)
        val rangeForLevel  = (nextThreshold - prevThreshold).coerceAtLeast(1)
        val xpPercent      = xpInLevel.toFloat() / rangeForLevel

        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putInt("level", level)
            .putFloat("xp_percent", xpPercent)
            .putInt("streak", streak)
            .apply()

        // Request widget redraw
        StrengthifyWidget.requestUpdate(context)
    }

    fun read(context: Context): WidgetData {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        return WidgetData(
            level      = prefs.getInt("level", 1),
            xpPercent  = prefs.getFloat("xp_percent", 0f),
            streak     = prefs.getInt("streak", 0),
        )
    }

    data class WidgetData(val level: Int, val xpPercent: Float, val streak: Int)
}
