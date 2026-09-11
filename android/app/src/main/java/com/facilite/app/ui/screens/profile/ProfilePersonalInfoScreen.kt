package com.facilite.app.ui.screens.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.filled.Public
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.facilite.app.data.repository.MockDataRepository
import com.facilite.app.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfilePersonalInfoScreen(
    onNavigateBack: () -> Unit,
    onTabSelected: (String) -> Unit = {}
) {
    val initialProfile = remember { MockDataRepository.userProfile }
    var firstName by remember { mutableStateOf("Moussa") }
    var lastName by remember { mutableStateOf("Diop") }
    var email by remember { mutableStateOf(initialProfile.email) }
    var phone by remember { mutableStateOf(initialProfile.phone) }
    var location by remember { mutableStateOf(initialProfile.location) }
    var birthDate by remember { mutableStateOf("15/04/1996") }
    var nationality by remember { mutableStateOf("Sénégalaise") }
    var isSaved by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        "Informations personnelles",
                        fontWeight = FontWeight.Bold,
                        fontSize = 17.sp,
                        color = TextPrimary
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Retour",
                            tint = TextPrimary
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = ScreenBackground)
            )
        },
        containerColor = ScreenBackground
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Profile Sub-navigation tabs
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                ProfileTabChip("À propos", isSelected = false) { onTabSelected("a-propos") }
                ProfileTabChip("Infos perso", isSelected = true) { onTabSelected("infos-perso") }
                ProfileTabChip("Langues", isSelected = false) { onTabSelected("langues") }
                ProfileTabChip("Expériences", isSelected = false) { onTabSelected("experiences") }
                ProfileTabChip("Formation", isSelected = false) { onTabSelected("formation") }
            }

            // Avatar Preview Card
            Card(
                shape = RoundedCornerShape(20.dp),
                colors = CardDefaults.cardColors(containerColor = CardSurface),
                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(60.dp)
                            .clip(CircleShape)
                            .background(RoyalBlue),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = initialProfile.avatarInitial,
                            fontWeight = FontWeight.Bold,
                            color = Color.White,
                            fontSize = 22.sp
                        )
                    }
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "$firstName $lastName",
                            fontWeight = FontWeight.Bold,
                            fontSize = 17.sp,
                            color = TextPrimary
                        )
                        Text(
                            text = "Profil complété à 85%",
                            fontSize = 13.sp,
                            color = MintGreen,
                            fontWeight = FontWeight.Medium
                        )
                    }
                }
            }

            // Input Fields Card
            Card(
                shape = RoundedCornerShape(20.dp),
                colors = CardDefaults.cardColors(containerColor = CardSurface),
                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(18.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    Text(
                        "Modifier vos coordonnées",
                        fontWeight = FontWeight.Bold,
                        fontSize = 15.sp,
                        color = TextPrimary
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        ProfileInputField(
                            label = "Prénom",
                            value = firstName,
                            onValueChange = { firstName = it },
                            icon = Icons.Default.Person,
                            modifier = Modifier.weight(1f)
                        )
                        ProfileInputField(
                            label = "Nom",
                            value = lastName,
                            onValueChange = { lastName = it },
                            icon = Icons.Default.Person,
                            modifier = Modifier.weight(1f)
                        )
                    }

                    ProfileInputField(
                        label = "Email professionnel",
                        value = email,
                        onValueChange = { email = it },
                        icon = Icons.Default.Email,
                        keyboardType = KeyboardType.Email
                    )

                    ProfileInputField(
                        label = "Numéro de téléphone",
                        value = phone,
                        onValueChange = { phone = it },
                        icon = Icons.Default.Phone,
                        keyboardType = KeyboardType.Phone
                    )

                    ProfileInputField(
                        label = "Localisation / Ville",
                        value = location,
                        onValueChange = { location = it },
                        icon = Icons.Default.LocationOn
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        ProfileInputField(
                            label = "Date de naissance",
                            value = birthDate,
                            onValueChange = { birthDate = it },
                            icon = Icons.Default.CalendarMonth,
                            modifier = Modifier.weight(1f)
                        )
                        ProfileInputField(
                            label = "Nationalité",
                            value = nationality,
                            onValueChange = { nationality = it },
                            icon = Icons.Default.Public,
                            modifier = Modifier.weight(1f)
                        )
                    }

                    Spacer(modifier = Modifier.height(6.dp))

                    Button(
                        onClick = { isSaved = true },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (isSaved) MintGreen else RoyalBlue
                        ),
                        shape = RoundedCornerShape(14.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(50.dp)
                    ) {
                        if (isSaved) {
                            Icon(Icons.Default.Check, contentDescription = null, tint = Color.White)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Informations enregistrées !", color = Color.White, fontWeight = FontWeight.Bold)
                        } else {
                            Text("Enregistrer les modifications", color = Color.White, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun ProfileTabChip(
    title: String,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(12.dp))
            .background(if (isSelected) RoyalBlue else CardSurface)
            .border(
                1.dp,
                if (isSelected) RoyalBlue else BorderLight,
                RoundedCornerShape(12.dp)
            )
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 7.dp)
    ) {
        Text(
            text = title,
            fontSize = 12.sp,
            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
            color = if (isSelected) Color.White else TextMuted
        )
    }
}

@Composable
fun ProfileInputField(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    icon: ImageVector,
    modifier: Modifier = Modifier,
    keyboardType: KeyboardType = KeyboardType.Text
) {
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(label, fontSize = 12.sp, fontWeight = FontWeight.Medium, color = TextMuted)
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            leadingIcon = {
                Icon(icon, contentDescription = null, tint = TextMuted, modifier = Modifier.size(18.dp))
            },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
            shape = RoundedCornerShape(12.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedContainerColor = Color.White,
                unfocusedContainerColor = Color.White,
                focusedBorderColor = RoyalBlue,
                unfocusedBorderColor = BorderLight
            ),
            modifier = Modifier.fillMaxWidth()
        )
    }
}
