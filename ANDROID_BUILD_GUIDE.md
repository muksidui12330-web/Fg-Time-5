# FG TIME — Official Android APK Build Guide

This beginner-friendly guide walks you through building, signing, and deploying the native Android APK for **FG TIME** (`com.fgtime.app`).

---

## 1. Project Specifications

| Property | Value |
| :--- | :--- |
| **App Name** | FG TIME |
| **Package Name** | `com.fgtime.app` |
| **Version** | `1.2.0` (versionCode `120`) |
| **Target SDK** | Android 15 (API 35) |
| **Minimum SDK** | Android 8.0 (API 26) |
| **Firebase Project** | `athletic-shade-7hl8x` |
| **Branding Colors** | Primary Green `#00C853`, Dark Green `#12372A` |

---

## 2. Option 1: Automatic Cloud Build via GitHub Actions (Recommended)

You can build the production-signed APK in the cloud with zero software installation on your local machine:

### How It Works
The workflow `.github/workflows/build-android-apk.yml` automatically:
1. Sets up **JDK 17**, **Android SDK 35**, and **Gradle 8.7**.
2. Pre-compiles the web app with Vite and bundles the assets directly into the Android app.
3. Securely handles **release keystore generation** and cryptographically signs the APK (`v1` and `v2` signatures).
4. Verifies the APK binary size and validity.
5. Uploads the finished **`FG-TIME-v1.2.0.apk`** as a downloadable artifact.

### How to Run the Build
1. Push your repository to **GitHub** (or open your GitHub repository page).
2. Go to the **Actions** tab.
3. Select **Build FG TIME Android APK** in the left sidebar.
4. Click **Run workflow** > Select `main` branch > Click the green **Run workflow** button.
5. Once the run completes (typically ~3–4 minutes), scroll down to the **Artifacts** section at the bottom of the summary page.
6. Click **`FG-TIME-v1.2.0-Signed-APK`** to download your signed APK zip file.

### Optional: Configuring Custom Signing Keys in GitHub Secrets
If you have your own custom keystore, add these under **GitHub Repository Settings > Secrets and variables > Actions**:
- `ANDROID_KEYSTORE_BASE64`: Base64-encoded string of your keystore file (`base64 -w 0 fgtime-release.keystore`).
- `KEYSTORE_PASSWORD`: Keystore password.
- `KEY_ALIAS`: Key alias (e.g., `fgtime`).
- `KEY_PASSWORD`: Key password.

*(If you don't configure these secrets, the workflow automatically generates a verified production-grade keystore with alias `fgtime` and password `fgtime2026`.)*

---

## 3. Option 2: Local Build with Android Studio (Offline)

### Prerequisites
1. **Android Studio** (Hedgehog, Iguana, or Koala) — [Download Android Studio](https://developer.android.com/studio)
2. **Java Development Kit (JDK 17)** (included with Android Studio)
3. **Android SDK Platform 35** (installed via Android Studio SDK Manager)

### Step 1: Open the Project
1. Open **Android Studio**.
2. Click **Open** (or **File > Open**).
3. Select the `android` folder in this repository (`path/to/fgtime/android`).
4. Android Studio will automatically sync Gradle using version 8.7.

### Step 2: Generate Keystore (One-Time)
In your terminal:
```bash
keytool -genkey -v -keystore android/app/fgtime-release.keystore \
  -alias fgtime \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -storepass fgtime2026 \
  -keypass fgtime2026 \
  -dname "CN=FG TIME, OU=Engineering, O=FG TIME, L=San Francisco, ST=California, C=US"
```

### Step 3: Build the APK
- **Command Line**: `cd android && ./gradlew assembleRelease`
- **Android Studio GUI**: **Build > Generate Signed Bundle / APK... > APK**

### Step 4: Output File
The built APK will be located at:
```
android/app/build/outputs/apk/release/app-release.apk
```

---

## 4. Connecting the APK to the FG TIME Web App

Once you have your `FG-TIME-v1.2.0.apk`:

1. Upload the APK to any HTTPS hosting:
   - **Firebase Storage**: In Firebase Console (`athletic-shade-7hl8x`), go to Storage > upload to `apks/FG-TIME-v1.2.0.apk`.
   - **GitHub Releases**: Create a release in your repository and attach the file.
   - **Cloudflare R2 / AWS S3**: Upload and copy the public HTTPS URL.
2. Link the URL to the app:
   - **Method A (No-Code In-App)**: Open the FG TIME website, click **APK Coming Soon**, expand **Configure APK Download URL**, paste your HTTPS URL, and click **Verify & Save URL**.
   - **Method B (Environment Variable)**: Set `VITE_APK_DOWNLOAD_URL="https://your-domain.com/FG-TIME-v1.2.0.apk"` in your deployment settings.
3. The button will immediately change across the site to **"Download FG TIME APK (18.4 MB)"**.
