package com.strengthify.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable

private val DarkColorScheme = darkColorScheme(
    primary          = Mauve,
    onPrimary        = Surface,
    secondary        = Blue,
    onSecondary      = Surface,
    tertiary         = Peach,
    background       = Surface,
    onBackground     = TextMain,
    surface          = Surface1,
    onSurface        = TextMain,
    surfaceVariant   = Surface2,
    onSurfaceVariant = TextSub,
    error            = Red,
    outline          = Overlay,
)

@Composable
fun StrengthifyTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = DarkColorScheme,
        typography  = StrengthifyTypography,
        content     = content,
    )
}
