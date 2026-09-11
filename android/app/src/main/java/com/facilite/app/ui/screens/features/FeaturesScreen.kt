package com.facilite.app.ui.screens.features

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Home
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.facilite.app.data.models.FeatureTool
import com.facilite.app.data.repository.MockDataRepository
import com.facilite.app.ui.components.MicFabButton
import com.facilite.app.ui.theme.*

@Composable
fun FeaturesScreen(
    tools: List<FeatureTool> = MockDataRepository.featureTools,
    onToolClick: (FeatureTool) -> Unit = {},
    onHomeClick: () -> Unit = {},
    onMicClick: () -> Unit = {}
) {
    var selectedCategory by remember { mutableStateOf("All") } // "All", "PDF", "IA"

    val filteredTools = remember(selectedCategory, tools) {
        if (selectedCategory == "All") tools
        else tools.filter { it.category.equals(selectedCategory, ignoreCase = true) }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(ScreenBackground)
    ) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(bottom = 80.dp)
        ) {
            // 1. En-tête avec titre + badge OUTILS ACTIFS + bouton Accueil
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(CardSurface)
                        .padding(horizontal = 16.dp, vertical = 14.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(38.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(ScreenBackground),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(text = "🛠️", fontSize = 17.sp)
                        }
                        Column {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Text(
                                    text = "Fonctionnalités",
                                    fontSize = 16.sp,
                                    fontWeight = FontWeight.ExtraBold,
                                    color = TextPrimary
                                )
                                Box(
                                    modifier = Modifier
                                        .clip(PillShape)
                                        .background(Color(0xFFE7E5E4))
                                        .padding(horizontal = 8.dp, vertical = 3.dp)
                                ) {
                                    Text(
                                        text = "OUTILS ACTIFS",
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = Color(0xFF44403C)
                                    )
                                }
                            }
                        }
                    }

                    // Bouton Accueil
                    Box(
                        modifier = Modifier
                            .clip(PillShape)
                            .background(ScreenBackground)
                            .clickable { onHomeClick() }
                            .padding(horizontal = 14.dp, vertical = 8.dp)
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Home,
                                contentDescription = "Accueil",
                                tint = TextPrimary,
                                modifier = Modifier.size(15.dp)
                            )
                            Text(
                                text = "Accueil",
                                fontSize = 12.5.sp,
                                fontWeight = FontWeight.Bold,
                                color = TextPrimary
                            )
                        }
                    }
                }
            }

            // 2. Sélecteur d'onglets (Tous les outils, Outils PDF, Outils IA)
            item {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(CardSurface)
                        .padding(horizontal = 16.dp, vertical = 10.dp)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(PillShape)
                            .background(ScreenBackground)
                            .padding(4.dp),
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        CategoryTabItem(
                            label = "Tous les outils",
                            isSelected = selectedCategory == "All",
                            onClick = { selectedCategory = "All" },
                            modifier = Modifier.weight(1f)
                        )
                        CategoryTabItem(
                            label = "Outils PDF",
                            isSelected = selectedCategory == "PDF",
                            onClick = { selectedCategory = "PDF" },
                            modifier = Modifier.weight(1f)
                        )
                        CategoryTabItem(
                            label = "Outils IA",
                            isSelected = selectedCategory == "IA",
                            onClick = { selectedCategory = "IA" },
                            modifier = Modifier.weight(1f)
                        )
                    }
                }
            }

            // 3. Liste des cartes d'outils
            items(filteredTools) { tool ->
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 5.dp)
                        .shadow(1.dp, RoundedCornerShape(16.dp))
                        .clip(RoundedCornerShape(16.dp))
                        .background(CardSurface)
                        .clickable { onToolClick(tool) }
                        .padding(14.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(40.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(MintGreenLight),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = if (tool.category == "IA") "⚡" else "📄",
                                fontSize = 18.sp
                            )
                        }

                        Column(modifier = Modifier.weight(1f)) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                Text(
                                    text = tool.title,
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = TextPrimary
                                )
                                if (tool.badge != null) {
                                    Box(
                                        modifier = Modifier
                                            .clip(PillShape)
                                            .background(AmberAccent.copy(alpha = 0.2f))
                                            .padding(horizontal = 6.dp, vertical = 2.dp)
                                    ) {
                                        Text(
                                            text = tool.badge,
                                            fontSize = 9.5.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = AmberAccent
                                        )
                                    }
                                }
                            }
                            Text(
                                text = tool.description,
                                fontSize = 12.sp,
                                color = TextSecondary,
                                lineHeight = 16.sp,
                                modifier = Modifier.padding(top = 2.dp)
                            )
                        }

                        Icon(
                            imageVector = Icons.Default.ChevronRight,
                            contentDescription = null,
                            tint = Color(0x4D000000),
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }
            }
        }

        // Bouton flottant Micro IA
        MicFabButton(
            onClick = onMicClick,
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(end = 16.dp, bottom = 16.dp)
        )
    }
}

@Composable
private fun CategoryTabItem(
    label: String,
    isSelected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .clip(PillShape)
            .background(if (isSelected) CardSurface else Color.Transparent)
            .clickable { onClick() }
            .padding(vertical = 7.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = label,
            fontSize = 11.5.sp,
            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.SemiBold,
            color = if (isSelected) TextPrimary else TextSecondary
        )
    }
}
