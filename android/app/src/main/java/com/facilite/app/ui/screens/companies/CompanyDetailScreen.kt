package com.facilite.app.ui.screens.companies

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.facilite.app.data.models.Company
import com.facilite.app.ui.theme.*

@Composable
fun CompanyDetailScreen(
    company: Company,
    onBackClick: () -> Unit = {},
    onApplyDirect: (Company) -> Unit = {}
) {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(ScreenBackground)
    ) {
        // En-tête : Bouton retour
        item {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(CardSurface)
                    .clickable { onBackClick() }
                    .padding(horizontal = 16.dp, vertical = 14.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.ArrowBack,
                    contentDescription = "Retour",
                    tint = TextPrimary,
                    modifier = Modifier.size(16.dp)
                )
                Text(
                    text = "Retour",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    color = TextPrimary
                )
            }
        }

        // Bannière visuelle
        item {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(180.dp)
                    .background(Color(0xFFDCE8F5))
            )
        }

        // Détails de l'entreprise
        item {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(18.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                Box(
                    modifier = Modifier
                        .clip(PillShape)
                        .background(Color(0xFFD7F2EA))
                        .padding(horizontal = 11.dp, vertical = 5.dp)
                ) {
                    Text(
                        text = company.sector,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF0D3B34)
                    )
                }

                Text(
                    text = company.name,
                    fontSize = 22.sp,
                    fontWeight = FontWeight.ExtraBold,
                    color = TextPrimary
                )

                Text(
                    text = "DOMAINES & POSTES :",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFF0D3B34),
                    letterSpacing = 0.5.sp
                )

                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(CardSurface)
                        .padding(12.dp)
                ) {
                    Text(
                        text = company.domains.joinToString(", "),
                        fontSize = 13.5.sp,
                        color = TextPrimary,
                        lineHeight = 19.sp
                    )
                }

                Text(
                    text = "📄 DOCUMENTS REQUIS :",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFF0D3B34),
                    letterSpacing = 0.5.sp
                )

                Text(
                    text = company.requiredDocuments.joinToString(" • "),
                    fontSize = 13.5.sp,
                    color = TextPrimary
                )

                // Canal de candidature direct
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .background(Color(0xFFD7F2EA))
                        .padding(14.dp)
                ) {
                    Column {
                        Text(
                            text = "CANAL DE CANDIDATURE DIRECT :",
                            fontSize = 10.5.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF0D3B34),
                            letterSpacing = 0.5.sp
                        )
                        Text(
                            text = company.applicationEmail,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF0D3B34),
                            modifier = Modifier.padding(top = 4.dp)
                        )
                    }
                }

                Spacer(modifier = Modifier.height(6.dp))

                // Boutons d'action
                Button(
                    onClick = { onApplyDirect(company) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(48.dp),
                    shape = PillShape,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MintGreen,
                        contentColor = Color.White
                    )
                ) {
                    Text(
                        text = "↗ Postuler sur le site officiel",
                        fontSize = 14.5.sp,
                        fontWeight = FontWeight.Bold
                    )
                }

                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(PillShape)
                        .background(CardSurface)
                        .clickable { /* Mail client */ }
                        .padding(vertical = 12.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "✉ Email Direct (${company.applicationEmail})",
                        fontSize = 13.5.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF0D3B34)
                    )
                }
            }
        }
    }
}
