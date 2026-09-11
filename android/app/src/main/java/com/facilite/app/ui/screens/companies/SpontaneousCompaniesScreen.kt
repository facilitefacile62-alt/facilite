package com.facilite.app.ui.screens.companies

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.facilite.app.data.models.Company
import com.facilite.app.data.repository.MockDataRepository
import com.facilite.app.ui.theme.*

@Composable
fun SpontaneousCompaniesScreen(
    companies: List<Company> = MockDataRepository.companies,
    onCompanyClick: (Company) -> Unit = {}
) {
    var searchQuery by remember { mutableStateOf("") }
    var selectedFilter by remember { mutableStateOf("All") } // "All", "Stations"

    val filteredCompanies = remember(searchQuery, selectedFilter, companies) {
        companies.filter { comp ->
            (selectedFilter == "All" || comp.sector.contains("Station", ignoreCase = true)) &&
            (searchQuery.isBlank() || comp.name.contains(searchQuery, ignoreCase = true) || comp.sector.contains(searchQuery, ignoreCase = true))
        }
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(ScreenBackground)
            .padding(horizontal = 12.dp, vertical = 10.dp),
        contentPadding = PaddingValues(bottom = 80.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        // 1. Bannière d'en-tête Dégradé
        item {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(20.dp))
                    .background(
                        Brush.linearGradient(
                            colors = listOf(Color(0xFF0D3B34), Color(0xFF0F4F42))
                        )
                    )
                    .padding(18.dp)
            ) {
                Column {
                    Text(
                        text = "CANDIDATURES SPONTANÉES",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF6EE7C9),
                        letterSpacing = 0.5.sp
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        text = "Répertoire Officiel des Entreprises",
                        fontSize = 20.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = Color.White
                    )
                    Spacer(modifier = Modifier.height(10.dp))
                    Text(
                        text = "Envoyez votre profil directement aux entreprises partenaires pour de futures opportunités. Retrouvez la liste complète des canaux et contacts de recrutement direct au Sénégal.",
                        fontSize = 13.sp,
                        color = Color(0xCCFFFFFF),
                        lineHeight = 18.sp
                    )
                }
            }
        }

        // 2. Encadré Journalier & Dépôt physique
        item {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(Color(0xFFEAF1FB))
                    .border(1.dp, RoyalBlue.copy(alpha = 0.15f), RoundedCornerShape(16.dp))
                    .padding(14.dp)
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(
                        verticalAlignment = Alignment.Top,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(34.dp)
                                .clip(CircleShape)
                                .background(Color(0xFFDBE8FC)),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(text = "🧑‍🔧", fontSize = 15.sp)
                        }
                        Column {
                            Text(
                                text = "Vous recherchez plutôt des emplois de journalier ?",
                                fontSize = 13.5.sp,
                                fontWeight = FontWeight.Bold,
                                color = TextPrimary
                            )
                            Text(
                                text = "Découvrez notre répertoire d'entreprises acceptant les candidatures physiques en personne à Dakar.",
                                fontSize = 12.sp,
                                color = TextSecondary,
                                lineHeight = 16.sp,
                                modifier = Modifier.padding(top = 3.dp)
                            )
                        }
                    }

                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(PillShape)
                            .background(RoyalBlue)
                            .padding(vertical = 11.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "🏭 Voir les dépôts physiques",
                            fontSize = 13.5.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                    }
                }
            }
        }

        // 3. Filtres & Champ de recherche
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                CompanyFilterChip(
                    label = "Toutes les entreprises (${companies.size})",
                    isSelected = selectedFilter == "All",
                    onClick = { selectedFilter = "All" }
                )
                CompanyFilterChip(
                    label = "⛽ Stations-Services",
                    isSelected = selectedFilter == "Stations",
                    onClick = { selectedFilter = "Stations" }
                )
            }
        }

        item {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(PillShape)
                    .background(CardSurface)
                    .border(1.dp, Color(0x14000000), PillShape)
                    .padding(horizontal = 16.dp, vertical = 6.dp)
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Search,
                        contentDescription = null,
                        tint = TextMuted,
                        modifier = Modifier.size(16.dp)
                    )
                    OutlinedTextField(
                        value = searchQuery,
                        onValueChange = { searchQuery = it },
                        placeholder = {
                            Text(
                                text = "Rechercher une entreprise ou un domaine",
                                fontSize = 13.sp,
                                color = TextMuted
                            )
                        },
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = Color.Transparent,
                            unfocusedBorderColor = Color.Transparent
                        ),
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }
        }

        item {
            Text(
                text = "${filteredCompanies.size} ENTREPRISES RÉPERTORIÉES",
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = TextMuted,
                letterSpacing = 0.5.sp,
                modifier = Modifier.fillMaxWidth()
            )
        }

        // 4. Liste des entreprises
        items(filteredCompanies) { comp ->
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .shadow(1.dp, RoundedCornerShape(18.dp))
                    .clip(RoundedCornerShape(18.dp))
                    .background(CardSurface)
                    .clickable { onCompanyClick(comp) }
            ) {
                Column {
                    // Bannière Placeholder
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(120.dp)
                            .background(Color(0xFFDCE8F5))
                    ) {
                        Box(
                            modifier = Modifier
                                .align(Alignment.TopEnd)
                                .padding(10.dp)
                                .clip(PillShape)
                                .background(CardSurface)
                                .padding(horizontal = 11.dp, vertical = 5.dp)
                        ) {
                            Text(
                                text = "🌐 Lien Web",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                color = RoyalBlue
                            )
                        }
                    }

                    Column(modifier = Modifier.padding(14.dp)) {
                        Text(
                            text = comp.name,
                            fontSize = 15.sp,
                            fontWeight = FontWeight.ExtraBold,
                            color = TextPrimary
                        )
                        Text(
                            text = comp.domains.joinToString(" · "),
                            fontSize = 12.sp,
                            color = TextSecondary,
                            modifier = Modifier.padding(top = 4.dp)
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun CompanyFilterChip(
    label: String,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .clip(PillShape)
            .background(if (isSelected) TextPrimary else CardSurface)
            .border(1.dp, if (isSelected) Color.Transparent else Color(0x14000000), PillShape)
            .clickable { onClick() }
            .padding(horizontal = 14.dp, vertical = 8.dp)
    ) {
        Text(
            text = label,
            fontSize = 12.5.sp,
            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.SemiBold,
            color = if (isSelected) Color.White else TextPrimary
        )
    }
}
