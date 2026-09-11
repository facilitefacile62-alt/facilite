package com.facilite.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.BookmarkBorder
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.facilite.app.data.models.JobOffer
import com.facilite.app.ui.theme.*

@Composable
fun JobCard(
    offer: JobOffer,
    onOfferClick: (JobOffer) -> Unit,
    onApplyClick: (JobOffer) -> Unit = {},
    onShareClick: (JobOffer) -> Unit = {},
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .shadow(1.dp, RoundedCornerShape(16.dp))
            .clip(RoundedCornerShape(16.dp))
            .background(CardSurface)
            .clickable { onOfferClick(offer) }
            .padding(14.dp)
    ) {
        Column(
            modifier = Modifier.fillMaxWidth()
        ) {
            // En-tête : Logo entreprise + Nom + Date
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                // Placeholder Logo Entreprise
                Box(
                    modifier = Modifier
                        .size(38.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .background(Color(0xFFE5E2DA)),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = offer.companyName.take(2).uppercase(),
                        fontWeight = FontWeight.Bold,
                        fontSize = 12.sp,
                        color = TextPrimary
                    )
                }

                Column(
                    modifier = Modifier.weight(1f)
                ) {
                    Text(
                        text = offer.companyName,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        color = RoyalBlue,
                        lineHeight = 18.sp
                    )
                    Text(
                        text = offer.publicationDate,
                        fontSize = 11.5.sp,
                        color = TextMuted
                    )
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            // Titre du poste
            Text(
                text = offer.title,
                fontSize = 15.5.sp,
                fontWeight = FontWeight.Black,
                color = TextPrimary,
                lineHeight = 21.sp
            )

            // Localisation & Type de contrat
            Text(
                text = "💼 ${offer.location} · ${offer.category} · ${offer.contractType}",
                fontSize = 12.5.sp,
                color = TextSecondary,
                modifier = Modifier.padding(top = 5.dp)
            )

            // Description courte avec mention "Voir plus"
            Spacer(modifier = Modifier.height(10.dp))
            Column {
                Text(
                    text = "🔴 AVIS DE RECRUTEMENT",
                    fontSize = 13.5.sp,
                    fontWeight = FontWeight.ExtraBold,
                    color = TextPrimary
                )
                Text(
                    text = offer.descriptionShort,
                    fontSize = 13.5.sp,
                    color = TextPrimary,
                    lineHeight = 19.sp,
                    modifier = Modifier.padding(top = 4.dp)
                )
            }

            // Flyer d'annonce avec bouton Agrandir
            Spacer(modifier = Modifier.height(12.dp))
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(190.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .border(1.dp, Color(0x14000000), RoundedCornerShape(12.dp))
                    .background(Color(0xFFDCE8F5)),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "[ flyer de recrutement — ${offer.title} ]",
                    fontSize = 11.sp,
                    color = TextSecondary,
                    modifier = Modifier.padding(16.dp)
                )

                // Pastille Agrandir
                Box(
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(8.dp)
                        .clip(PillShape)
                        .background(Color(0x8C000000))
                        .padding(horizontal = 9.dp, vertical = 4.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Search,
                            contentDescription = "Agrandir",
                            tint = Color.White,
                            modifier = Modifier.size(12.dp)
                        )
                        Text(
                            text = "Agrandir",
                            color = Color.White,
                            fontSize = 10.5.sp,
                            fontWeight = FontWeight.Medium
                        )
                    }
                }
            }

            // Boutons d'action : Postuler en 1 clic + Partage + Sauvegarder
            Spacer(modifier = Modifier.height(14.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Button(
                    onClick = { onApplyClick(offer) },
                    modifier = Modifier
                        .weight(1f)
                        .height(42.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (offer.isApplied) MintGreenLight else RoyalBlue,
                        contentColor = if (offer.isApplied) MintGreenDark else Color.White
                    )
                ) {
                    if (offer.isApplied) {
                        Icon(
                            imageVector = Icons.Default.Check,
                            contentDescription = "Postulé",
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "Candidature envoyée",
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.sp
                        )
                    } else {
                        Text(
                            text = "Postuler en 1 clic",
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.sp
                        )
                    }
                }

                // Bouton Partage
                Box(
                    modifier = Modifier
                        .size(42.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .border(1.dp, BorderLight, RoundedCornerShape(12.dp))
                        .clickable { onShareClick(offer) },
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Share,
                        contentDescription = "Partager",
                        tint = TextSecondary,
                        modifier = Modifier.size(18.dp)
                    )
                }

                // Bouton Sauvegarder
                Box(
                    modifier = Modifier
                        .size(42.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .border(1.dp, BorderLight, RoundedCornerShape(12.dp))
                        .clickable { /* Toggle save */ },
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.BookmarkBorder,
                        contentDescription = "Sauvegarder",
                        tint = TextSecondary,
                        modifier = Modifier.size(18.dp)
                    )
                }
            }
        }
    }
}
