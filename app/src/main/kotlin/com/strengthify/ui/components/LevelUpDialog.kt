package com.strengthify.ui.components

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.spring
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.strengthify.ui.theme.Mauve
import com.strengthify.ui.theme.Yellow

@Composable
fun LevelUpDialog(newLevel: Int, xpEarned: Int, onDismiss: () -> Unit) {
    val scale = remember { Animatable(0.6f) }

    LaunchedEffect(Unit) {
        scale.animateTo(
            targetValue = 1f,
            animationSpec = spring(dampingRatio = 0.5f, stiffness = 300f),
        )
    }

    Dialog(onDismissRequest = onDismiss) {
        Card(
            modifier = Modifier.scale(scale.value),
            shape    = RoundedCornerShape(24.dp),
        ) {
            Column(
                modifier            = Modifier.padding(32.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Text("🎊", fontSize = 56.sp)
                Text(
                    "LEVEL UP!",
                    style      = MaterialTheme.typography.headlineMedium,
                    color      = Mauve,
                    fontWeight = FontWeight.Bold,
                )
                Text(
                    "You reached Level $newLevel",
                    style = MaterialTheme.typography.titleMedium,
                )
                Text(
                    "+$xpEarned XP this session",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(4.dp))
                Button(onClick = onDismiss, modifier = Modifier.fillMaxWidth()) {
                    Text("Let's go! 💪")
                }
            }
        }
    }
}
