package com.facilite.app.ui.screens.search

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.facilite.app.data.models.JobOffer
import com.facilite.app.data.repository.MockDataRepository
import com.facilite.app.ui.theme.*

@Composable
fun SearchScreen(
    onOfferClick: (JobOffer) -> Unit = {},
    onCloseClick: () -> Unit = {}
) {
    var query by remember { mutableStateOf("") }
    val allOffers = MockDataRepository.jobOffers

    val recentSearches = remember {
        listOf("Conducteur d'engins", "Comptabilité", "TotalEnergies", "Stage Juriste", "Dakar")
    }

    val popularCategories = remember {
        listOf(
            CategoryItem("BTP & Logistique", "BTP", MintGreen),
            CategoryItem("Finance & Audit", "FIN", AmberAccent),
            CategoryItem("Relation Client", "REL", RoyalBlue),
            CategoryItem("Télécoms & Tech", "TEC", PurpleAvatar),
            CategoryItem("Santé & Social", "SAN", Color(0xFFEC4899)),
            CategoryItem("Administration", "ADM", OrangeAdmin)
        )
    }

    val searchResults = remember(query) {
        if (query.isBlank()) emptyList()
        else allOffers.filter {
            it.title.contains(query, ignoreCase = true) ||
            it.companyName.contains(query, ignoreCase = true) ||
            it.location.contains(query, ignoreCase = true)
        }
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(DarkFrameBackground)
            .padding(horizontal = 20.dp),
        contentPadding = PaddingValues(top = 20.dp, bottom = 40.dp)
    ) {
        // En-tête : Titre + Bouton fermer
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Rechercher",
                    fontSize = 20.sp,
                    fontWeight = FontWeight.ExtraBold,
                    color = Color.White
                )
                IconButton(onClick = onCloseClick) {
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = "Fermer",
                        tint = Color.White
                    )
                }
            }
        }

        // Champ de recherche
        item {
            Spacer(modifier = Modifier.height(8.dp))
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(PillShape)
                    .background(DarkSurface)
                    .border(1.dp, Color(0x14FFFFFF), PillShape)
                    .padding(horizontal = 16.dp, vertical = 12.dp)
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Search,
                        contentDescription = null,
                        tint = Color(0x66F5F6F7),
                        modifier = Modifier.size(18.dp)
                    )
                    OutlinedTextField(
                        value = query,
                        onValueChange = { query = it },
                        placeholder = {
                            Text(
                                text = "Titre, entreprise, secteur...",
                                fontSize = 14.5.sp,
                                color = Color(0x66F5F6F7)
                            )
                        },
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = Color.Transparent,
                            unfocusedBorderColor = Color.Transparent,
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White
                        ),
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }
        }

        // Si recherche active : Résultats
        if (query.isNotBlank()) {
            item {
                Spacer(modifier = Modifier.height(16.dp))
                Text(
                    text = "Résultats (${searchResults.size})",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color(0x80F5F6F7),
                    letterSpacing = 0.5.sp
                )
            }

            if (searchResults.isEmpty()) {
                item {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 40.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "Aucun résultat trouvé pour « $query »",
                            fontSize = 14.sp,
                            color = Color(0x66F5F6F7)
                        )
                    }
                }
            } else {
                items(searchResults) { job ->
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 6.dp)
                            .clip(RoundedCornerShape(20.dp))
                            .background(DarkSurface)
                            .border(1.dp, Color(0x10FFFFFF), RoundedCornerShape(20.dp))
                            .clickable { onOfferClick(job) }
                            .padding(14.dp)
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(40.dp)
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(MintGreen),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = job.companyName.take(2).uppercase(),
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 14.sp,
                                    color = DarkFrameBackground
                                )
                            }
                            Column {
                                Text(
                                    text = job.title,
                                    fontSize = 14.5.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color.White
                                )
                                Text(
                                    text = "${job.companyName} · ${job.location}",
                                    fontSize = 12.5.sp,
                                    color = Color(0x8CF5F6F7),
                                    modifier = Modifier.padding(top = 2.dp)
                                )
                            }
                        }
                    }
                }
            }
        } else {
            // Recherches récentes
            item {
                Spacer(modifier = Modifier.height(20.dp))
                Text(
                    text = "RECHERCHES RÉCENTES",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color(0x80F5F6F7),
                    letterSpacing = 0.5.sp
                )
                Spacer(modifier = Modifier.height(10.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    recentSearches.take(3).forEach { term ->
                        Box(
                            modifier = Modifier
                                .clip(PillShape)
                                .background(DarkSurface)
                                .border(1.dp, Color(0x12FFFFFF), PillShape)
                                .clickable { query = term }
                                .padding(horizontal = 14.dp, vertical = 8.dp)
                        ) {
                            Text(
                                text = term,
                                fontSize = 12.5.sp,
                                color = Color.White
                            )
                        }
                    }
                }
            }

            // Catégories populaires
            item {
                Spacer(modifier = Modifier.height(24.dp))
                Text(
                    text = "CATÉGORIES POPULAIRES",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color(0x80F5F6F7),
                    letterSpacing = 0.5.sp
                )
                Spacer(modifier = Modifier.height(12.dp))
            }

            items(popularCategories.chunked(2)) { pair ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 6.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    pair.forEach { cat ->
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(20.dp))
                                .background(DarkSurface)
                                .border(1.dp, Color(0x10FFFFFF), RoundedCornerShape(20.dp))
                                .clickable { query = cat.label }
                                .padding(16.dp)
                        ) {
                            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                                Box(
                                    modifier = Modifier
                                        .size(36.dp)
                                        .clip(RoundedCornerShape(11.dp))
                                        .background(cat.color),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(
                                        text = cat.code,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 12.sp,
                                        color = DarkFrameBackground
                                    )
                                }
                                Text(
                                    text = cat.label,
                                    fontSize = 13.5.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    color = Color.White
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

private data class CategoryItem(
    val label: String,
    val code: String,
    val color: Color
)
