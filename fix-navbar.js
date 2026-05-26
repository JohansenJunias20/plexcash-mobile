const fs = require('fs');

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // 1. Extract the permission block
  const permissionRegex = /  if \(!hasPermission\) \{\s+return \(\s+<LinearGradient colors={\[(.*?)\]} style=\{styles\.container\}>\s+<View style=\{styles\.permissionContainer\}>\s+<Ionicons name="camera-outline" size=\{64\} color="white" \/>\s+<Text style=\{styles\.permissionTitle\}>Izin Kamera Diperlukan<\/Text>\s+<Text style=\{styles\.permissionText\}>([\s\S]*?)<\/Text>\s+<TouchableOpacity style=\{styles\.permissionButton\} onPress=\{requestPermission\}>\s+<Text style=\{styles\.permissionButtonText\}>Berikan Izin<\/Text>\s+<\/TouchableOpacity>\s+<\/View>\s+<\/LinearGradient>\s+\);\s+\}?;?/m;
  
  const match = content.match(permissionRegex);
  if (!match) {
    console.log("Could not find permission block in " + filePath);
    return;
  }
  
  const colors = match[1];
  const text = match[2];
  
  // 2. Remove the permission block
  content = content.replace(permissionRegex, '');
  
  // 3. Inject it back after topHeader ends, wrapping the main container
  // For ScanIn and ScanOut, it is `<View style={styles.container}>`
  // For ScanSearch, it might have infoBanner before cameraContainer, but it's inside `<View style={styles.container}>`.
  // Wait, let's just find the first `<View style={styles.container}>` after topHeader
  const containerRegex = /(      <\/View>\n\s+<View style=\{styles\.container\}>)/;
  
  const newContainer = `      </View>\n\n      {!hasPermission ? (\n        <LinearGradient colors={[${colors}]} style={styles.container}>\n          <View style={styles.permissionContainer}>\n            <Ionicons name="camera-outline" size={64} color="white" />\n            <Text style={styles.permissionTitle}>Izin Kamera Diperlukan</Text>\n            <Text style={styles.permissionText}>${text}</Text>\n            <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>\n              <Text style={styles.permissionButtonText}>Berikan Izin</Text>\n            </TouchableOpacity>\n          </View>\n        </LinearGradient>\n      ) : (\n      <View style={styles.container}>`;
  
  content = content.replace(containerRegex, newContainer);
  
  // 4. Close the ternary at the end before </SafeAreaView>
  // Search for the last </SafeAreaView>
  const safeAreaEndRegex = /(    <\/SafeAreaView>)/;
  content = content.replace(safeAreaEndRegex, '      )}\n    </SafeAreaView>');
  
  fs.writeFileSync(filePath, content);
  console.log("Fixed " + filePath);
}

try { fixFile('screens/scanout/ScanSearchScreen.tsx'); } catch(e) { console.error(e) }
try { fixFile('screens/scanout/ScanOutScreen.tsx'); } catch(e) { console.error(e) }
try { fixFile('screens/scanin/ScanInScreen.tsx'); } catch(e) { console.error(e) }
