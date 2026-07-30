plugins {
    id("com.android.application") version "8.9.0"
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.parforthecourse.app"
    compileSdk = 35

    buildFeatures {
        buildConfig = true
    }

    defaultConfig {
        applicationId = "com.parforthecourse.app"
        minSdk = 24
        targetSdk = 35
        // Keep this higher than every production artifact versionCode in Play Console.
        versionCode = 2026072601
        versionName = "3.14.1"
        // Front-end-only production host (GitHub Pages).
        buildConfigField("String", "APP_URL", "\"https://promethean-games.github.io/parforthecoursev2/\"")
        // Startup Diagnostic Mode: enabled by default for all non-release builds.
        // Set to false in the release block below (or manually flip to true for a beta release build).
        buildConfigField("Boolean", "DIAGNOSTIC_MODE", "true")
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    signingConfigs {
        create("release") {
            val keystoreFile = file("keystore.jks")
            if (keystoreFile.exists()) {
                storeFile = keystoreFile
                storePassword = "your-store-password" // Replace with your keystore password
                keyAlias = "your-key-alias" // Replace with your key alias
                keyPassword = "your-key-password" // Replace with your key password
            } else {
                println("Warning: keystore.jks file not found. Release signing configuration will be skipped.")
            }
        }
    }

    buildTypes {
        debug {
            // DIAGNOSTIC_MODE already true from defaultConfig; kept explicit for clarity.
            buildConfigField("Boolean", "DIAGNOSTIC_MODE", "true")
        }
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            signingConfig = signingConfigs.getByName("release")
            // Disable the diagnostic panel in production builds.
            buildConfigField("Boolean", "DIAGNOSTIC_MODE", "false")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }

    kotlinOptions {
        jvmTarget = "11"
    }
}

dependencies {
    implementation("androidx.appcompat:appcompat:1.6.1")
    implementation("androidx.core:core:1.10.1")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.6.1")
    implementation("androidx.activity:activity-compose:1.7.2")
    implementation(platform("androidx.compose:compose-bom:2023.08.00"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.1.5")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.5.1")
    androidTestImplementation(platform("androidx.compose:compose-bom:2023.08.00"))
    androidTestImplementation("androidx.compose.ui:ui-test-junit4")
    debugImplementation("androidx.compose.ui:ui-tooling")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
}