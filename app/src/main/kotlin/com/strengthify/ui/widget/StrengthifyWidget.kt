package com.strengthify.ui.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import com.strengthify.MainActivity
import com.strengthify.R

class StrengthifyWidget : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        manager: AppWidgetManager,
        appWidgetIds: IntArray,
    ) {
        appWidgetIds.forEach { updateWidget(context, manager, it) }
    }

    companion object {
        fun requestUpdate(context: Context) {
            val ids = AppWidgetManager.getInstance(context)
                .getAppWidgetIds(ComponentName(context, StrengthifyWidget::class.java))
            if (ids.isEmpty()) return
            val intent = Intent(AppWidgetManager.ACTION_APPWIDGET_UPDATE).apply {
                setComponent(ComponentName(context, StrengthifyWidget::class.java))
                putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
            }
            context.sendBroadcast(intent)
        }

        fun updateWidget(context: Context, manager: AppWidgetManager, widgetId: Int) {
            val data   = WidgetCache.read(context)
            val views  = RemoteViews(context.packageName, R.layout.widget_strengthify)

            // Level
            views.setTextViewText(R.id.widget_level, "Lvl ${data.level}")

            // XP progress bar (max = 100)
            val progress = (data.xpPercent * 100).toInt().coerceIn(0, 100)
            views.setProgressBar(R.id.widget_xp_bar, 100, progress, false)
            views.setTextViewText(R.id.widget_xp_label, "${progress}% XP")

            // Streak
            val streakText = if (data.streak > 0) "🔥 ${data.streak} day streak" else "Start your streak!"
            views.setTextViewText(R.id.widget_streak, streakText)

            // Tap → open app
            val pendingIntent = PendingIntent.getActivity(
                context, 0,
                Intent(context, MainActivity::class.java),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
            views.setOnClickPendingIntent(R.id.widget_root, pendingIntent)

            manager.updateAppWidget(widgetId, views)
        }
    }
}
