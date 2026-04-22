package com.strengthify.ui.home

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.FitnessCenter
import androidx.compose.material.icons.filled.Whatshot
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.strengthify.data.model.BenchmarkTier
import com.strengthify.ui.components.StreakCalendar
import com.strengthify.ui.theme.*

@Composable
fun HomeScreen(
    contentPadding: PaddingValues,
    onStartWorkout: () -> Unit,
    viewModel: HomeViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    LazyColumn(
        modifier            = Modifier.fillMaxSize(),
        contentPadding      = PaddingValues(
            top    = contentPadding.calculateTopPadding() + 16.dp,
            bottom = contentPadding.calculateBottomPadding() + 16.dp,
            start  = 16.dp,
            end    = 16.dp,
        ),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        // ── Header ──────────────────────────────────────────────────────────
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment     = Alignment.CenterVertically,
            ) {
                Column {
                    Text(
                        text  = "Hey, ${state.profile?.name ?: "Lifter"} 👋",
                        style = MaterialTheme.typography.titleLarge,
                    )
                    Text(
                        text  = "Ready to get stronger?",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                // Streak badge
                if (state.streak > 0) {
                    Surface(
                        shape  = RoundedCornerShape(12.dp),
                        color  = MaterialTheme.colorScheme.surfaceVariant,
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp),
                        ) {
                            Icon(
                                Icons.Default.Whatshot,
                                contentDescription = null,
                                tint   = Peach,
                                modifier = Modifier.size(18.dp),
                            )
                            Text(
                                text  = "${state.streak}",
                                color = Peach,
                                fontWeight = FontWeight.Bold,
                            )
                        }
                    }
                }
            }
        }

        // ── Level card ──────────────────────────────────────────────────────
        item {
            LevelCard(
                level            = state.level,
                xpProgress       = state.xpProgress,
                xpCurrentInLevel = state.xpCurrentInLevel,
                xpToNextLevel    = state.xpToNextLevel,
            )
        }

        // ── Start workout button ─────────────────────────────────────────────
        item {
            Button(
                onClick  = onStartWorkout,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp),
                shape = RoundedCornerShape(14.dp),
            ) {
                Icon(Icons.Default.FitnessCenter, null, modifier = Modifier.size(20.dp))
                Spacer(Modifier.width(8.dp))
                Text("Start Workout", style = MaterialTheme.typography.titleMedium)
            }
        }

        // ── Benchmark cards ──────────────────────────────────────────────────
        item {
            Text("Your Lifts", style = MaterialTheme.typography.titleMedium)
        }

        item {
            LazyRow(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                items(state.benchmarkCards) { card ->
                    BenchmarkCard(card)
                }
            }
        }

        // ── Streak calendar ──────────────────────────────────────────────────
        item {
            StreakCalendar(
                workoutDates = state.workoutDates,
                modifier     = Modifier.fillMaxWidth(),
            )
        }

        // ── Recent sessions ──────────────────────────────────────────────────
        if (state.recentSessions.isNotEmpty()) {
            item {
                Text("Recent Workouts", style = MaterialTheme.typography.titleMedium)
            }
            items(state.recentSessions) { sessionWithSets ->
                RecentSessionRow(sessionWithSets)
            }
        }
    }
}

@Composable
private fun LevelCard(
    level: Int,
    xpProgress: Float,
    xpCurrentInLevel: Int,
    xpToNextLevel: Int,
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column {
                    Text("Level", style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(
                        text  = "$level",
                        style = MaterialTheme.typography.displayLarge,
                        color = MaterialTheme.colorScheme.primary,
                    )
                }
                Text(
                    text  = "$xpToNextLevel XP to next level",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Spacer(Modifier.height(8.dp))
            LinearProgressIndicator(
                progress            = { xpProgress },
                modifier            = Modifier
                    .fillMaxWidth()
                    .height(8.dp)
                    .clip(RoundedCornerShape(4.dp)),
                color               = MaterialTheme.colorScheme.primary,
                trackColor          = MaterialTheme.colorScheme.surfaceVariant,
            )
            Spacer(Modifier.height(4.dp))
            Text(
                text  = "$xpCurrentInLevel XP earned this level",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun BenchmarkCard(card: LiftBenchmarkCard) {
    val tierColor = when (card.tier) {
        BenchmarkTier.BEGINNER     -> Red
        BenchmarkTier.NOVICE       -> Blue
        BenchmarkTier.INTERMEDIATE -> Green
        BenchmarkTier.ADVANCED     -> Yellow
        BenchmarkTier.ELITE        -> Mauve
    }

    Card(
        modifier = Modifier.width(140.dp),
        colors   = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text(
                text  = card.lift.displayName,
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 2,
                lineHeight = 14.sp,
            )
            Spacer(Modifier.height(8.dp))
            Text(
                text  = card.tier.emoji + " " + card.tier.label,
                style = MaterialTheme.typography.bodyMedium,
                color = tierColor,
                fontWeight = FontWeight.Bold,
            )
            Spacer(Modifier.height(4.dp))
            Text(
                text  = "${card.percentOfBenchmark}% of target",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            if (card.estimatedOneRmKg > 0f) {
                Text(
                    text  = "~${"%.1f".format(card.estimatedOneRmKg)} kg",
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
        }
    }
}

@Composable
private fun RecentSessionRow(sessionWithSets: com.strengthify.data.model.WorkoutSessionWithSets) {
    val liftNames = sessionWithSets.sets.map { it.lift }.distinct()
        .mapNotNull { name ->
            com.strengthify.data.model.Lift.entries.find { it.name == name }?.displayName
        }
        .joinToString(", ")

    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape    = RoundedCornerShape(12.dp),
        color    = MaterialTheme.colorScheme.surface,
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column {
                Text(sessionWithSets.session.date, style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(liftNames.ifBlank { "Workout" }, style = MaterialTheme.typography.bodyMedium)
            }
            Text(
                "+${sessionWithSets.session.totalXpEarned} XP",
                color = MaterialTheme.colorScheme.primary,
                fontWeight = FontWeight.Bold,
            )
        }
    }
}
