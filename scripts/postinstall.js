#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('Running postinstall patches...\n');

let totalPatches = 0;

// ============================================================================
// PATCH 1: Fix gradle plugin conflict
// ============================================================================
const projectConfigPath = path.join(
  __dirname,
  '..',
  'node_modules',
  'expo-modules-core',
  'expo-module-gradle-plugin',
  'src',
  'main',
  'kotlin',
  'expo',
  'modules',
  'plugin',
  'ProjectConfiguration.kt'
);

if (!fs.existsSync(projectConfigPath)) {
  console.log('⚠ ProjectConfiguration.kt not found, skipping gradle plugin patch');
} else {
  let content = fs.readFileSync(projectConfigPath, 'utf8');

  if (content.includes('Don\'t apply library plugin if this is an application project')) {
    console.log('✓ Gradle plugin already patched');
  } else {
    applyGradlePluginPatch(content, projectConfigPath);
  }
}

function applyGradlePluginPatch(content, filePath) {
  const patches = [
    {
      name: 'applyDefaultPlugins',
      original: `internal fun Project.applyDefaultPlugins() {
  if (!plugins.hasPlugin("com.android.library")) {
    plugins.apply("com.android.library")
  }`,
      patched: `internal fun Project.applyDefaultPlugins() {
  // Don't apply library plugin if this is an application project
  if (!plugins.hasPlugin("com.android.application") && !plugins.hasPlugin("com.android.library")) {
    plugins.apply("com.android.library")
  }`
    },
    {
      name: 'applyDefaultAndroidSdkVersions',
      original: `internal fun Project.applyDefaultAndroidSdkVersions() {
  with(androidLibraryExtension()) {`,
      patched: `internal fun Project.applyDefaultAndroidSdkVersions() {
  // Skip for application projects
  if (plugins.hasPlugin("com.android.application")) {
    return
  }
  with(androidLibraryExtension()) {`
    },
    {
      name: 'applyPublishing',
      original: `internal fun Project.applyPublishing(expoModulesExtension: ExpoModuleExtension) {
  if (!expoModulesExtension.canBePublished) {`,
      patched: `internal fun Project.applyPublishing(expoModulesExtension: ExpoModuleExtension) {
  // Skip for application projects
  if (plugins.hasPlugin("com.android.application")) {
    return
  }

  if (!expoModulesExtension.canBePublished) {`
    }
  ];

  let patchedCount = 0;
  for (const patch of patches) {
    if (content.includes(patch.original)) {
      content = content.replace(patch.original, patch.patched);
      patchedCount++;
    }
  }

  if (patchedCount > 0) {
    fs.writeFileSync(filePath, content);
    console.log(`✓ Gradle plugin patched (${patchedCount} fixes applied)`);
    totalPatches += patchedCount;
  } else {
    console.log('⚠ Could not find code to patch in ProjectConfiguration.kt');
  }
}

// ============================================================================
// PATCH 2: Fix BoxShadow.parse() signature for React Native 0.76.5
// ============================================================================
const cssPropsPath = path.join(
  __dirname,
  '..',
  'node_modules',
  'expo-modules-core',
  'android',
  'src',
  'main',
  'java',
  'expo',
  'modules',
  'kotlin',
  'views',
  'decorators',
  'CSSProps.kt'
);

if (!fs.existsSync(cssPropsPath)) {
  console.log('⚠ CSSProps.kt not found, skipping BoxShadow patch');
} else {
  let content = fs.readFileSync(cssPropsPath, 'utf8');

  if (content.includes('BoxShadow.parse(shadows.getMap(i))')) {
    console.log('✓ BoxShadow.parse already patched');
  } else {
    const original = 'val shadow = BoxShadow.parse(shadows.getMap(i), view.context) ?: continue';
    const patched = 'val shadow = BoxShadow.parse(shadows.getMap(i)) ?: continue';

    if (content.includes(original)) {
      content = content.replace(original, patched);
      fs.writeFileSync(cssPropsPath, content);
      console.log('✓ BoxShadow.parse patched for RN 0.76.5');
      totalPatches++;
    } else {
      console.log('⚠ Could not find BoxShadow.parse code to patch');
    }
  }
}

// ============================================================================
// PATCH 3: Fix enableBridgelessArchitecture for React Native 0.76.5
// ============================================================================
const featureFlagsPath = path.join(
  __dirname,
  '..',
  'node_modules',
  'expo-modules-core',
  'android',
  'src',
  'main',
  'java',
  'expo',
  'modules',
  'rncompatibility',
  'ReactNativeFeatureFlags.kt'
);

if (!fs.existsSync(featureFlagsPath)) {
  console.log('⚠ ReactNativeFeatureFlags.kt not found, skipping feature flags patch');
} else {
  let content = fs.readFileSync(featureFlagsPath, 'utf8');

  if (content.includes('// Bridgeless architecture removed in RN 0.76.5')) {
    console.log('✓ ReactNativeFeatureFlags already patched');
  } else {
    const original = `object ReactNativeFeatureFlags {
  val enableBridgelessArchitecture = ReactNativeFeatureFlags.enableBridgelessArchitecture()
}`;

    const patched = `object ReactNativeFeatureFlags {
  // Bridgeless architecture removed in RN 0.76.5 - always return false for compatibility
  val enableBridgelessArchitecture = false
}`;

    if (content.includes(original)) {
      content = content.replace(original, patched);
      fs.writeFileSync(featureFlagsPath, content);
      console.log('✓ ReactNativeFeatureFlags patched for RN 0.76.5');
      totalPatches++;
    } else {
      console.log('⚠ Could not find ReactNativeFeatureFlags code to patch');
    }
  }
}

// ============================================================================
// PATCH 4: Fix ReactStylesDiffMap reflection issue for React Native 0.76.5
// ============================================================================
const reactStylesDiffMapPath = path.join(
  __dirname,
  '..',
  'node_modules',
  'react-native',
  'ReactAndroid',
  'src',
  'main',
  'java',
  'com',
  'facebook',
  'react',
  'uimanager',
  'ReactStylesDiffMap.java'
);

if (!fs.existsSync(reactStylesDiffMapPath)) {
  console.log('⚠ ReactStylesDiffMap.java not found, skipping reflection patch');
} else {
  let content = fs.readFileSync(reactStylesDiffMapPath, 'utf8');

  if (content.includes('// PATCHED: Made backingMap accessible via reflection')) {
    console.log('✓ ReactStylesDiffMap reflection already patched');
  } else {
    // Find the backingMap field declaration and make it accessible
    const original = '  /* package */ final ReadableMap mBackingMap;';
    const patched = `  /* package */ final ReadableMap mBackingMap;

  // PATCHED: Made backingMap accessible via reflection
  // Reflection-friendly getter for backingMap field
  public ReadableMap getBackingMap() {
    return mBackingMap;
  }

  // Alternative getter for internal_backingMap reflection compatibility
  public ReadableMap getInternal_backingMap() {
    return mBackingMap;
  }`;

    if (content.includes(original)) {
      content = content.replace(original, patched);
      fs.writeFileSync(reactStylesDiffMapPath, content);
      console.log('✓ ReactStylesDiffMap patched for reflection compatibility');
      totalPatches++;
    } else {
      console.log('⚠ Could not find ReactStylesDiffMap code to patch');
      console.log('   Looking for:', original);
    }
  }
}

// ============================================================================
// Summary
// ============================================================================
console.log(`\n✅ Postinstall complete! Applied ${totalPatches} patches total.`);
