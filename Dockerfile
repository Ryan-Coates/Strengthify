# ─────────────────────────────────────────────────────────────────────────────
# Strengthify — Android build environment
# Requires only Docker Desktop for Windows. No Android Studio or SDK on host.
#
# Base: official Gradle image (includes JDK 17 + Gradle 8.7 on PATH)
# usage:
#   docker compose build
#   docker compose run --rm build
# ─────────────────────────────────────────────────────────────────────────────

# gradle:8.7-jdk17 ships JDK 17 (Eclipse Temurin) + Gradle 8.7
FROM gradle:8.7-jdk17

# Run as root for SDK install, then switch back to the 'gradle' user
USER root

# ── Android SDK paths ─────────────────────────────────────────────────────────
ENV ANDROID_SDK_ROOT=/opt/android-sdk
ENV ANDROID_HOME=${ANDROID_SDK_ROOT}
ENV PATH="${PATH}:\
${ANDROID_SDK_ROOT}/cmdline-tools/latest/bin:\
${ANDROID_SDK_ROOT}/platform-tools:\
${ANDROID_SDK_ROOT}/build-tools/34.0.0"

# ── System packages ───────────────────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    unzip \
    curl \
    locales \
    ca-certificates \
    && locale-gen en_US.UTF-8 \
    && rm -rf /var/lib/apt/lists/*

# ── Android command-line tools ────────────────────────────────────────────────
# Pin this version. To upgrade, find the latest build number at:
#   https://developer.android.com/studio#command-tools
ARG CMDLINE_TOOLS_VERSION=11076708
ARG CMDLINE_TOOLS_SHA256=2d2d50857e4eb553af5a6dc3ad507a17adf43d115264b1afc116f95c92e5e258

RUN mkdir -p "${ANDROID_SDK_ROOT}/cmdline-tools" \
    && wget -q \
       "https://dl.google.com/android/repository/commandlinetools-linux-${CMDLINE_TOOLS_VERSION}_latest.zip" \
       -O /tmp/cmdlinetools.zip \
    && echo "${CMDLINE_TOOLS_SHA256}  /tmp/cmdlinetools.zip" | sha256sum --check \
    && unzip -q /tmp/cmdlinetools.zip -d "${ANDROID_SDK_ROOT}/cmdline-tools" \
    # sdkmanager expects tools at cmdline-tools/latest/
    && mv "${ANDROID_SDK_ROOT}/cmdline-tools/cmdline-tools" \
          "${ANDROID_SDK_ROOT}/cmdline-tools/latest" \
    && rm /tmp/cmdlinetools.zip

# ── Accept all SDK licences (non-interactive) ─────────────────────────────────
RUN yes | sdkmanager --licenses > /dev/null 2>&1

# ── Install SDK components ────────────────────────────────────────────────────
# platform-tools  → adb (used for device deployment)
# build-tools     → aapt2, dx/d8, apksigner
# platforms       → compile against API 34; also include API 26 (min SDK)
RUN sdkmanager --install \
    "platform-tools" \
    "build-tools;34.0.0" \
    "platforms;android-34" \
    "platforms;android-26"

# ── SDK ownership ────────────────────────────────────────────────────────────
# The gradle base image already has a 'gradle' user (uid 1000); give it the SDK.
RUN chown -R gradle:gradle "${ANDROID_SDK_ROOT}"

USER gradle

# ── Working directory (project is bind-mounted here at runtime) ───────────────
WORKDIR /workspace

# Default: print SDK version info (useful to verify image is healthy)
CMD ["sdkmanager", "--version"]
