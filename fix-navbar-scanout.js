const fs = require('fs');

function fixScanOut(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // 1. Extract the permission block
  const permissionRegex = /  if \(!hasPermission\) \{\s+return \(\s+<LinearGradient colors={\[(.*?)\]} style=\{styles\.container\}>\s+<View style=\{styles\.permissionContainer\}>\s+<Ionicons name="camera-outline" size=\{64\} color="white" \/>\s+<Text style=\{styles\.permissionTitle\}>Camera Permission Required<\/Text>\s+<Text style=\{styles\.permissionText\}>([\s\S]*?)<\/Text>\s+<TouchableOpacity style=\{styles\.permissionButton\} onPress=\{requestPermission\}>\s+<Text style=\{styles\.permissionButtonText\}>Grant Permission<\/Text>\s+<\/TouchableOpacity>\s+<\/View>\s+<\/LinearGradient>\s+\);\s+\}\s*/m;
  
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
  const containerRegex = /(      <\/View>\n\s+<View style=\{styles\.container\}>)/;
  
  const newContainer = `      </View>\n\n      {!hasPermission ? (\n        <LinearGradient colors={[${colors}]} style={styles.container}>\n          <View style={styles.permissionContainer}>\n            <Ionicons name="camera-outline" size={64} color="white" />\n            <Text style={styles.permissionTitle}>Camera Permission Required</Text>\n            <Text style={styles.permissionText}>${text}</Text>\n            <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>\n              <Text style={styles.permissionButtonText}>Grant Permission</Text>\n            </TouchableOpacity>\n          </View>\n        </LinearGradient>\n      ) : (\n      <View style={styles.container}>`;
  
  content = content.replace(containerRegex, newContainer);
  
  // 4. Close the ternary at the end before </SafeAreaView>
  const safeAreaEndRegex = /(    <\/SafeAreaView>)/;
  content = content.replace(safeAreaEndRegex, '      )}\n    </SafeAreaView>');
  
  fs.writeFileSync(filePath, content);
  console.log("Fixed " + filePath);
}

try { fixScanOut('screens/scanout/ScanOutScreen.tsx'); } catch(e) { console.error(e) }
