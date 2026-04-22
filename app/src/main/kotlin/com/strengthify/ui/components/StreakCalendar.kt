package com.strengthify.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.strengthify.ui.theme.Green
import com.strengthify.ui.theme.Surface2
import java.time.LocalDate
import java.time.format.DateTimeFormatter

/**
 * Shows a 5-week (35 day) rolling calendar grid with dots for workout days.
 *
 * @param workoutDates  Set of date strings ("YYYY-MM-DD") that had workouts.
 */
@Composable
fun StreakCalendar(
    workoutDates: Set<String>,
    modifier: Modifier = Modifier,
) {
    val today       = LocalDate.now()
    // Start from the Monday of 4 weeks ago so we get a full 5-week grid
    val startDate   = today.minusDays(34)
    val fmt         = DateTimeFormatter.ofPattern("yyyy-MM-dd")
    val dayLabels   = listOf("M", "T", "W", "T", "F", "S", "S")

    val days = (0..34).map { startDate.plusDays(it.toLong()) }

    Surface(
        modifier = modifier,
        shape    = RoundedCornerShape(12.dp),
        color    = MaterialTheme.colorScheme.surface,
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text("Activity", style = MaterialTheme.typography.titleMedium)
            Spacer(Modifier.height(8.dp))

            // Day-of-week header
            Row(modifier = Modifier.fillMaxWidth()) {
                dayLabels.forEach { label ->
                    Text(
                        text      = label,
                        modifier  = Modifier.weight(1f),
                        textAlign = TextAlign.Center,
                        style     = MaterialTheme.typography.labelMedium,
                        color     = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }

            Spacer(Modifier.height(4.dp))

            LazyVerticalGrid(
                columns             = GridCells.Fixed(7),
                userScrollEnabled   = false,
                modifier            = Modifier.heightIn(max = 200.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp),
                horizontalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                items(days) { day ->
                    val dateStr   = day.format(fmt)
                    val hasWorkout = dateStr in workoutDates
                    val isToday   = day == today

                    Box(
                        contentAlignment = Alignment.Center,
                        modifier = Modifier
                            .aspectRatio(1f)
                            .clip(CircleShape)
                            .background(
                                when {
                                    hasWorkout -> Green.copy(alpha = 0.8f)
                                    isToday   -> MaterialTheme.colorScheme.primary.copy(alpha = 0.3f)
                                    else      -> Surface2.copy(alpha = 0.5f)
                                }
                            ),
                    ) {
                        Text(
                            text  = "${day.dayOfMonth}",
                            style = MaterialTheme.typography.labelMedium,
                            color = if (hasWorkout) MaterialTheme.colorScheme.background
                            else MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }

            Spacer(Modifier.height(4.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(
                    Modifier
                        .size(10.dp)
                        .clip(CircleShape)
                        .background(Green)
                )
                Spacer(Modifier.width(4.dp))
                Text("Workout logged", style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}
