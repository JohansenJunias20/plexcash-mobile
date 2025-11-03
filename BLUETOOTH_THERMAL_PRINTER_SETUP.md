# Bluetooth Thermal Printer Setup for POS Kasir

## Current Implementation

The POS Kasir feature is currently using **expo-print** which provides:
- **iOS**: AirPrint support
- **Android**: System print dialog

This works for standard printers but **does not support Bluetooth thermal printers** in the Expo managed workflow.

## Why Bluetooth Thermal Printing Doesn't Work Yet

Bluetooth thermal printer libraries like `react-native-bluetooth-escpos-printer` require **native modules** that are not available in Expo's managed workflow. To use Bluetooth thermal printers, you need to create a **custom development build**.

## How to Enable Bluetooth Thermal Printing

### Option 1: Create a Custom Development Build (Recommended)

Follow these steps to enable Bluetooth thermal printing:

#### Step 1: Install expo-dev-client

```bash
npx expo install expo-dev-client
```

#### Step 2: Install Bluetooth Printer Library

```bash
npm install react-native-bluetooth-escpos-printer
```

#### Step 3: Update app.json

Add the Bluetooth printer plugin to your `app.json`:

```json
{
  "expo": {
    "plugins": [
      "react-native-bluetooth-escpos-printer"
    ],
    "android": {
      "permissions": [
        "BLUETOOTH",
        "BLUETOOTH_ADMIN",
        "BLUETOOTH_CONNECT",
        "BLUETOOTH_SCAN",
        "ACCESS_FINE_LOCATION"
      ]
    },
    "ios": {
      "infoPlist": {
        "NSBluetoothAlwaysUsageDescription": "This app needs Bluetooth to connect to thermal printers",
        "NSBluetoothPeripheralUsageDescription": "This app needs Bluetooth to connect to thermal printers"
      }
    }
  }
}
```

#### Step 4: Generate Native Code

```bash
npx expo prebuild
```

This will create the `android` and `ios` directories with native code.

#### Step 5: Replace BluetoothPrinterService.ts

Replace the current `services/BluetoothPrinterService.ts` with the full Bluetooth implementation:

```typescript
import { BluetoothManager, BluetoothEscposPrinter } from 'react-native-bluetooth-escpos-printer';
import { Platform, PermissionsAndroid } from 'react-native';

// ... (use the full implementation from the original file)
```

You can find the full implementation in the git history or ask for it.

#### Step 6: Build and Run

For Android:
```bash
npx expo run:android
```

For iOS:
```bash
npx expo run:ios
```

### Option 2: Use Expo Application Services (EAS)

If you want to keep using Expo Go for development but need Bluetooth printing in production:

1. Set up EAS Build:
```bash
npm install -g eas-cli
eas login
eas build:configure
```

2. Create a development build:
```bash
eas build --profile development --platform android
```

3. Install the development build on your device and use it instead of Expo Go.

## Testing the Current Implementation

While Bluetooth thermal printing is not yet enabled, you can still test the POS Kasir feature:

1. **Run the app**: `npm start`
2. **Navigate to POS Kasir** from the main menu
3. **Add products to cart** and process a transaction
4. **When printing**, the app will use:
   - **iOS**: AirPrint dialog (works with AirPrint-enabled printers)
   - **Android**: System print dialog (can save as PDF or print to network printers)

## Features Currently Working

✅ Product search by SKU, barcode, or name
✅ Shopping cart management
✅ Wholesale pricing
✅ Customer selection
✅ PPN/Tax calculation
✅ Payment processing
✅ Transaction saving to backend
✅ Receipt generation (HTML format)
✅ Standard printing (AirPrint/System dialog)

## Features Requiring Custom Build

⏳ Bluetooth thermal printer connection
⏳ ESC/POS command printing
⏳ 58mm/80mm thermal paper support
⏳ Bluetooth device scanning and pairing

## Alternative Solutions

### 1. Network Thermal Printers

Many modern thermal printers support network printing (WiFi/Ethernet). These can work with the current implementation through the system print dialog.

### 2. Cloud Printing Services

Use services like Google Cloud Print (deprecated) or similar alternatives that work through standard print dialogs.

### 3. External Printing Apps

Some thermal printer manufacturers provide their own apps that can receive print jobs through intents (Android) or share sheets (iOS).

## Next Steps

1. **For Development**: Continue using the current implementation with standard printing
2. **For Production**: Create a custom development build following Option 1 above
3. **For Testing**: Use the mock Bluetooth devices that appear in the printer settings

## Support

If you need help setting up Bluetooth thermal printing:
1. Check the [Expo documentation](https://docs.expo.dev/workflow/customizing/)
2. Review the [react-native-bluetooth-escpos-printer](https://github.com/januslo/react-native-bluetooth-escpos-printer) documentation
3. See the Expo forums for custom development build questions

## File Locations

- **POS Screen**: `screens/pos/POSKasirScreen.tsx`
- **Printer Service**: `services/BluetoothPrinterService.ts`
- **Navigation**: `navigation/RootNavigator.tsx`
- **Main Menu**: `components/MainScreen.tsx`

