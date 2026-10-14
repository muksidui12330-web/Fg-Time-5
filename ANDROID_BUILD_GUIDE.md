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

## 2. Prerequisites

To build the APK on your computer, ensure you have:
1. **Android Studio** (Hedgehog, Iguana, or Koala) — [Download Android Studio](https://developer.android.com/studio)
2. **Java Development Kit (JDK 17)** (included automatically inside Android Studio)
3. **Android SDK Platform 35** (installed via Android Studio SDK Manager)

---

## 3. Step 1: Open the Project in Android Studio

1. Open **Android Studio**.
2. Click **Open** (or **File > Open**).
3. Select the `android` folder inside this repository:
   ```
   path/to/fgtime/android
   ```
4. Android Studio will automatically sync the Gradle configuration using Gradle 8.7.

---

## 4. Step 2: Create a Release Keystore (One-Time Setup)

To create a signed, tamper-proof release APK for Android devices:

Open your computer's terminal (or Android Studio's built-in Terminal tab) and run:

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

> **Security Note:** Keep your `.keystore` file safe and private. You will use the same keystore for all future updates.

---

## 5. Step 3: Build the Signed Release APK

### Option A: Using the Command Line (Fastest)

Inside the `android` folder, run:

```bash
./gradlew assembleRelease
```

*(On Windows, use `gradlew.bat assembleRelease`)*

### Option B: Using Android Studio GUI

1. In Android Studio's top menu, click **Build > Generate Signed Bundle / APK...**
2. Choose **APK** and click **Next**.
3. Point **Key store path** to `android/app/fgtime-release.keystore`.
4. Enter your passwords (`fgtime2026`) and alias (`fgtime`).
5. Choose destination folder, select **release**, check **V1 (Jar Signature)** & **V2 (Full APK Signature)**, and click **Create**.

---

## 6. Step 4: Where to Find Your Built APK

Once the build finishes successfully, your production APK is located at:

```
android/app/build/outputs/apk/release/app-release.apk
```

Rename it to:
```
FG-TIME-v1.2.0.apk
```

---

## 7. Step 5: Connecting the APK to the FG TIME Web App

1. Upload `FG-TIME-v1.2.0.apk` to your HTTPS hosting (Firebase Storage, GitHub Releases, Cloudflare R2, or AWS S3).
   *Example: `https://storage.googleapis.com/athletic-shade-7hl8x.appspot.com/FG-TIME-v1.2.0.apk`*
2. Configure the URL in the app:
   - **Method A (No-Code In-App):** Open the FG TIME website, click the **APK Coming Soon** button, open **Configure APK Download URL**, paste your HTTPS link, and click **Verify & Save URL**.
   - **Method B (Environment Variable):** Add `VITE_APK_DOWNLOAD_URL=https://your-domain.com/FG-TIME-v1.2.0.apk` to `.env`.
3. The button will immediately change from **"APK Coming Soon"** to **"Download FG TIME APK (18.4 MB)"** across the entire website!
