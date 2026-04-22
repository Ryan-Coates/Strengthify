package com.strengthify.ui.profile

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.FileDownload
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.strengthify.data.model.AchievementId
import com.strengthify.domain.XpEngine
import com.strengthify.ui.theme.Green
import com.strengthify.ui.theme.Mauve

@Composable
fun ProfileScreen(
    contentPadding: PaddingValues,
    viewModel: ProfileViewModel = hiltViewModel(),
) {
    val profile    by viewModel.profile.collectAsStateWithLifecycle()
    val editState  by viewModel.editState.collectAsStateWithLifecycle()
    val achievements by viewModel.achievements.collectAsStateWithLifecycle()

    LaunchedEffect(profile) {
        profile?.let { viewModel.initFrom(it) }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(
                top    = contentPadding.calculateTopPadding() + 16.dp,
                bottom = contentPadding.calculateBottomPadding() + 16.dp,
                start  = 16.dp,
                end    = 16.dp,
            ),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text("Profile", style = MaterialTheme.typography.headlineMedium)

        profile?.let { p ->
            // Identity card
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(p.name, style = MaterialTheme.typography.titleLarge)
                    Text(p.sex.lowercase().replaceFirstChar { it.titlecase() },
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }

            // Level / XP card
            val prevThreshold = XpEngine.thresholdForLevel(p.level)
            val nextThreshold = XpEngine.thresholdForLevel(p.level + 1)

            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(
                        horizontalArrangement = Arrangement.SpaceBetween,
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text("Level ${p.level}", style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.primary)
                        Text("${p.totalXp} XP total", style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    Text("${nextThreshold - p.totalXp} XP to Level ${p.level + 1}",
                        style = MaterialTheme.typography.bodyMedium)
                    if (p.currentStreak > 0) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text("🔥 ${p.currentStreak} day streak",
                                style = MaterialTheme.typography.bodyMedium)
                        }
                    }
                }
            }
        }

        // Editable fields
        HorizontalDivider()
        Text("Update Stats", style = MaterialTheme.typography.titleMedium)

        OutlinedTextField(
            value         = editState.bodyweightInput,
            onValueChange = viewModel::onBodyweightChange,
            label         = { Text("Bodyweight (kg)") },
            singleLine    = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
            modifier      = Modifier.fillMaxWidth(),
        )

        OutlinedTextField(
            value         = editState.ageInput,
            onValueChange = viewModel::onAgeChange,
            label         = { Text("Age (years)") },
            singleLine    = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            modifier      = Modifier.fillMaxWidth(),
        )

        if (editState.saved) {
            Text("✓ Saved — benchmarks recalculated", color = Green,
                style = MaterialTheme.typography.bodyMedium)
        }

        Button(
            onClick  = viewModel::saveChanges,
            enabled  = !editState.isSaving,
            modifier = Modifier.fillMaxWidth().height(52.dp),
        ) {
            if (editState.isSaving) {
                CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp,
                    color = MaterialTheme.colorScheme.onPrimary)
            } else {
                Text("Save Changes")
            }
        }

        // ── Achievements ─────────────────────────────────────────────────────
        HorizontalDivider()
        Text("Achievements (${achievements.size} / ${AchievementId.entries.size})",
            style = MaterialTheme.typography.titleMedium)

        val earnedIds = achievements.map { it.id }.toSet()
        AchievementId.entries.forEach { id ->
            val earned = id.name in earnedIds
            Surface(
                shape    = RoundedCornerShape(12.dp),
                color    = if (earned) MaterialTheme.colorScheme.surface
                           else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Row(
                    modifier = Modifier.padding(12.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(if (earned) id.emoji else "🔒",
                        style = MaterialTheme.typography.titleMedium)
                    Column {
                        Text(id.displayName,
                            style = MaterialTheme.typography.bodyMedium,
                            fontWeight = FontWeight.Medium,
                            color = if (earned) MaterialTheme.colorScheme.onSurface
                                    else MaterialTheme.colorScheme.onSurfaceVariant)
                        Text(id.description,
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        }

        // ── Export ───────────────────────────────────────────────────────────
        HorizontalDivider()
        Text("Data", style = MaterialTheme.typography.titleMedium)

        if (editState.exportFileName != null) {
            Text("✓ Saved to Downloads: ${editState.exportFileName}",
                color = Green, style = MaterialTheme.typography.bodyMedium)
        }
        if (editState.exportError) {
            Text("Export failed. Please try again.",
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodyMedium)
        }

        OutlinedButton(
            onClick  = viewModel::exportWorkouts,
            enabled  = !editState.isExporting,
            modifier = Modifier.fillMaxWidth().height(52.dp),
        ) {
            if (editState.isExporting) {
                CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
            } else {
                Icon(Icons.Default.FileDownload, null, modifier = Modifier.size(20.dp))
                Spacer(Modifier.width(8.dp))
                Text("Export Workouts as CSV")
            }
        }
    }
}
