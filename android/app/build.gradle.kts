import java.util.Properties
plugins { id("com.android.application") }
val sign = Properties().apply { val f = rootProject.file("signing.properties"); if (f.exists()) f.inputStream().use { load(it) } }
android {
    namespace = "mr.driftzone.app"
    compileSdk = 35
    defaultConfig {
        applicationId = "mr.driftzone.app"
        minSdk = 24
        targetSdk = 35
        versionCode = (project.findProperty("dzCode") as String?)?.toInt() ?: 330
        versionName = (project.findProperty("dzName") as String?) ?: "3.3.0"
    }
    signingConfigs {
        create("release") {
            storeFile = file(sign.getProperty("storeFile", "missing.jks"))
            storePassword = sign.getProperty("storePassword", "")
            keyAlias = sign.getProperty("keyAlias", "")
            keyPassword = sign.getProperty("keyPassword", "")
        }
    }
    buildTypes {
        getByName("release") { isMinifyEnabled = false; signingConfig = signingConfigs.getByName("release") }
    }
    androidResources { noCompress += listOf("mp3", "jpg", "png", "woff2") }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
}
dependencies { implementation("androidx.webkit:webkit:1.12.1") }
