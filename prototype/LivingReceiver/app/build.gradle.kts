plugins {
    id("com.android.application") version "8.9.2"
    id("org.jetbrains.kotlin.android") version "2.1.20"
    id("org.jetbrains.kotlin.plugin.compose") version "2.1.20"
}
android {
    namespace = "org.abundent.receiver"
    compileSdk = 35
    defaultConfig {
        applicationId = "org.abundent.receiver"
        minSdk = 26
        targetSdk = 35
        versionCode = 2
        versionName = "0.2.0-test"
        manifestPlaceholders["receiverLabel"] = "HUMKIN Living Receiver"
    }
    buildTypes {
        create("cloudHouse") {
            initWith(getByName("debug"))
            applicationIdSuffix = ".cloudhouse"
            versionNameSuffix = "-cloud-house"
            manifestPlaceholders["receiverLabel"] = "HUMKIN Cloud HOUSE Preview"
        }
    }
    buildFeatures { compose = true }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
kotlin { jvmToolchain(17) }
dependencies {
    implementation("androidx.activity:activity-compose:1.10.1")
    implementation("androidx.compose.material3:material3:1.3.2")
    implementation("androidx.media3:media3-exoplayer:1.6.1")
    implementation("androidx.media3:media3-exoplayer-hls:1.6.1")
    implementation("androidx.media3:media3-session:1.6.1")
    testImplementation("junit:junit:4.13.2")
}
