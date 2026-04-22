package com.strengthify.ui.logging

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Timer
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.strengthify.ui.theme.Blue
import com.strengthify.ui.theme.Green

/** Compact banner that appears at the top of the set-logging screen during rest. */
@Composable
fun RestTimerBanner(
    state: RestTimerState,
    onCancel: () -> Unit,
    modifier: Modifier = Modifier,
) {
    AnimatedVisibility(
        visible = state.isRunning,
        enter   = slideInVertically() + fadeIn(),
        exit    = slideOutVertically() + fadeOut(),
        modifier = modifier,
    ) {
        val progress = if (state.durationSeconds > 0)
            state.secondsRemaining.toFloat() / state.durationSeconds else 0f

        val timerColor = when {
            state.secondsRemaining > 30 -> Blue
            state.secondsRemaining > 10 -> MaterialTheme.colorScheme.tertiary
            else                        -> MaterialTheme.colorScheme.error
        }

        Surface(
            shape = RoundedCornerShape(12.dp),
            color = MaterialTheme.colorScheme.surface,
        ) {
            Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 10.dp)) {
                Row(
                    modifier              = Modifier.fillMaxWidth(),
                    verticalAlignment     = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Row(
                        verticalAlignment     = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Icon(Icons.Default.Timer, null, tint = timerColor, modifier = Modifier.size(20.dp))
                        Text(
                            text       = "Rest: ${formatSeconds(state.secondsRemaining)}",
                            color      = timerColor,
                            fontWeight = FontWeight.Bold,
                            style      = MaterialTheme.typography.titleMedium,
                        )
                    }
                    IconButton(onClick = onCancel, modifier = Modifier.size(32.dp)) {
                        Icon(Icons.Default.Close, "Cancel timer",
                            modifier = Modifier.size(18.dp),
                            tint     = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
                Spacer(Modifier.height(6.dp))
                LinearProgressIndicator(
                    progress  = { progress },
                    modifier  = Modifier
                        .fillMaxWidth()
                        .height(6.dp)
                        .clip(RoundedCornerShape(3.dp)),
                    color     = timerColor,
                    trackColor = MaterialTheme.colorScheme.surfaceVariant,
                )
            }
        }
    }
}

/** Row of quick-start duration buttons. */
@Composable
fun RestTimerButtons(
    onStart: (Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier              = modifier,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalAlignment     = Alignment.CenterVertically,
    ) {
        Icon(Icons.Default.Timer, null,
            modifier = Modifier.size(16.dp),
            tint     = MaterialTheme.colorScheme.onSurfaceVariant)
        listOf(60, 90, 120, 180).forEach { secs ->
            val label = if (secs < 60) "${secs}s" else "${secs / 60}m${if (secs % 60 > 0) "${secs % 60}s" else ""}"
            AssistChip(
                onClick = { onStart(secs) },
                label   = { Text(label, style = MaterialTheme.typography.labelMedium) },
            )
        }
    }
}

private fun formatSeconds(s: Int): String =
    "${s / 60}:${"%02d".format(s % 60)}"
