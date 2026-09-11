package com.facilite.app.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Shapes
import androidx.compose.ui.unit.dp

// Rayons de courbure arrondis (16-24dp)
val Shapes = Shapes(
    extraSmall = RoundedCornerShape(8.dp),
    small = RoundedCornerShape(12.dp),
    medium = RoundedCornerShape(16.dp),
    large = RoundedCornerShape(20.dp),
    extraLarge = RoundedCornerShape(24.dp)
)

val PillShape = RoundedCornerShape(999.dp)
val CardShape = RoundedCornerShape(16.dp)
val SheetShape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp)
