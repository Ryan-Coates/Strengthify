package com.strengthify.ui.results

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.strengthify.data.model.AchievementId
import com.strengthify.data.model.Lift
import com.strengthify.ui.components.LevelUpDialog
import com.strengthify.ui.theme.Green
import com.strengthify.ui.theme.Mauve
import com.strengthify.ui.theme.Yellow

@Composable
fun ResultsScreen(
    sessionId: Long,
    onDone: () -> Unit,
    viewModel: ResultsViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    var showLevelUp by remember { mutableStateOf(true) }

    if (state.isLoading) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator()
        }
        return
    }

    // Level-up celebration dialog
    if (state.leveledUp && showLevelUp) {
        LevelUpDialog(
            newLevel  = state.newLevel,
            xpEarned  = state.xpEarned,
            onDismiss = { showLevelUp = false },
        )
    }

    LazyColumn(
        modifier            = Modifier.fillMaxSize(),
        contentPadding      = PaddingValues(24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        item {
            Spacer(Modifier.height(24.dp))
            Text("🎉", style = MaterialTheme.typography.displayLarge)
            Spacer(Modifier.height(8.dp))
            Text("Workout Complete!", style = MaterialTheme.typography.headlineMedium)
            Text(
                state.sessionWithSets?.session?.date ?: "",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        // XP earned
        item {
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(
                    modifier = Modifier.padding(20.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text(
                        "+${state.xpEarned} XP",
                        style      = MaterialTheme.typography.displayLarge,
                        color      = Mauve,
                        fontWeight = FontWeight.Bold,
                    )
                    Text("earned this session", style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }

        // Level (if leveled up this would animate; note for future)
        item {
            Surface(
                shape = RoundedCornerShape(12.dp),
                color = MaterialTheme.colorScheme.surface,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Row(
                    modifier = Modifier.padding(16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text("Current Level", style = MaterialTheme.typography.bodyMedium)
                    Text(
                        "${state.newLevel}",
                        style      = MaterialTheme.typography.titleLarge,
                        color      = MaterialTheme.colorScheme.primary,
                        fontWeight = FontWeight.Bold,
                    )
                }
            }
        }

        // Personal bests
        if (state.newPbLifts.isNotEmpty()) {
            item {
                Text("🏆 Personal Bests", style = MaterialTheme.typography.titleMedium)
            }
            items(state.newPbLifts) { liftName ->
                val displayName = Lift.entries.find { it.name == liftName }?.displayName ?: liftName
                Surface(
                    shape  = RoundedCornerShape(12.dp),
                    color  = MaterialTheme.colorScheme.surface,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(displayName, style = MaterialTheme.typography.bodyMedium)
                        Icon(Icons.Default.EmojiEvents, "PB", tint = Yellow,
                            modifier = Modifier.size(20.dp))
                    }
                }
            }
        }

        // Achievements unlocked this session
        if (state.newAchievements.isNotEmpty()) {
            item {
                Text("🏅 Achievements Unlocked!", style = MaterialTheme.typography.titleMedium)
            }
            items(state.newAchievements) { achievement ->
                Surface(
                    shape  = RoundedCornerShape(12.dp),
                    color  = MaterialTheme.colorScheme.surface,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(achievement.emoji, style = MaterialTheme.typography.titleMedium)
                        Column {
                            Text(achievement.displayName,
                                style = MaterialTheme.typography.bodyMedium,
                                fontWeight = FontWeight.Medium)
                            Text(achievement.description,
                                style = MaterialTheme.typography.labelMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                }
            }
        }

        // Sets summary
        state.sessionWithSets?.let { session ->
            item {
                Text("Sets Logged", style = MaterialTheme.typography.titleMedium)
            }
            item {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        session.sets.groupBy { it.lift }.forEach { (liftName, liftSets) ->
                            val displayName = Lift.entries.find { it.name == liftName }?.displayName ?: liftName
                            Text(displayName, style = MaterialTheme.typography.bodyMedium,
                                fontWeight = FontWeight.Medium)
                            liftSets.forEachIndexed { i, set ->
                                Text(
                                    "  Set ${i + 1}: ${set.weightKg} kg × ${set.reps} reps",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                            Spacer(Modifier.height(4.dp))
                        }
                    }
                }
            }
        }

        item {
            Spacer(Modifier.height(8.dp))
            Button(
                onClick  = onDone,
                modifier = Modifier.fillMaxWidth().height(52.dp),
            ) {
                Text("Done", style = MaterialTheme.typography.titleMedium)
            }
        }
    }
}
