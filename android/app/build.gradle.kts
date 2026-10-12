plugins {
    id("com.android.application") version "8.9.0"
    id("org.jetbrains.kotlin.android")
}

val webAssetsSourceDir = layout.projectDirectory.dir("../../dist/public")
val generatedWebAssetsRootDir = layout.buildDirectory.dir("generated/web-assets")
val generatedWebAssetsDir = generatedWebAssetsRootDir.map { it.dir("web") }
val releaseKeystoreFile = file("keystore.jks")
val signingStoreFileEnv = System.getenv("PFTC_SIGNING_STORE_FILE")
val signingStorePasswordEnv = System.getenv("PFTC_SIGNING_STORE_PASSWORD")
val signingKeyAliasEnv = System.getenv("PFTC_SIGNING_KEY_ALIAS")
val signingKeyPasswordEnv = System.getenv("PFTC_SIGNING_KEY_PASSWORD")
val envKeystoreFile = signingStoreFileEnv?.let { file(it) }
val configuredReleaseKeystore = when {
    envKeystoreFile != null && envKeystoreFile.exists() -> envKeystoreFile
    releaseKeystoreFile.exists() -> releaseKeystoreFile
    else -> null
}

val syncWebAssets by tasks.registering(Copy::class) {
    from(webAssetsSourceDir)
    into(generatedWebAssetsDir)
    includeEmptyDirs = false

    doFirst {
        if (!webAssetsSourceDir.asFile.exists()) {
            throw GradleException("Web assets not found at ${webAssetsSourceDir.asFile}. Run `npm run build` before assembling the Android app.")
        }
    }
}

android {
    namespace = "com.parforthecourse.app"
    compileSdk = 36

    buildFeatures {
        buildConfig = true
    }

    sourceSets.getByName("main").assets.srcDir(generatedWebAssetsRootDir)

    defaultConfig {
        applicationId = "com.parforthecourse.app"
        minSdk = 24
        targetSdk = 36
        // Keep this higher than every production artifact versionCode in Play Console.
        versionCode = 2026101201
        versionName = "3.14.5"
        buildConfigField("String", "APP_URL", "\"https://appassets.androidplatform.net/assets/web/index.html\"")
        // Startup Diagnostic Mode: enabled by default for all non-release builds.
        // Set to false in the release block below (or manually flip to true for a beta release build).
        buildConfigField("Boolean", "DIAGNOSTIC_MODE", "true")
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    signingConfigs {
        create("release") {
            if (configuredReleaseKeystore != null) {
                storeFile = configuredReleaseKeystore
                if (!signingStorePasswordEnv.isNullOrBlank()) {
                    storePassword = signingStorePasswordEnv
                }
                if (!signingKeyAliasEnv.isNullOrBlank()) {
                    keyAlias = signingKeyAliasEnv
                }
                if (!signingKeyPasswordEnv.isNullOrBlank()) {
                    keyPassword = signingKeyPasswordEnv
                }
            } else {
                println("Warning: release keystore not found. Release signing configuration will be skipped.")
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
            signingConfig = if (configuredReleaseKeystore != null) {
                signingConfigs.getByName("release")
            } else {
                signingConfigs.getByName("debug")
            }
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

tasks.matching { task ->
    task.name.startsWith("merge") && task.name.endsWith("Assets")
}.configureEach {
    dependsOn(syncWebAssets)
}

tasks.matching { task ->
    task.name.contains("LintVitalReportModel")
}.configureEach {
    dependsOn(syncWebAssets)
}

tasks.matching { task ->
    task.name.contains("lint", ignoreCase = true)
}.configureEach {
    dependsOn(syncWebAssets)
}

dependencies {
    implementation("androidx.appcompat:appcompat:1.6.1")
    implementation("androidx.core:core:1.10.1")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.6.1")
    implementation("androidx.activity:activity-compose:1.7.2")
    implementation("androidx.webkit:webkit:1.11.0")
    implementation("com.android.billingclient:billing-ktx:8.0.0")
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