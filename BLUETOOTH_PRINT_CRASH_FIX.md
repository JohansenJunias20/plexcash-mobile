# Bluetooth Print Crash Fix

## Problem
The mobile app was crashing immediately when clicking "Yes, Print" after completing a POS transaction. The crash occurred with no error logs, and the last log showed:
```
✍️ [BT-SERVICE] Writing to characteristic: 00002a00-0000-1000-8000-00805f9b34fb
🔗 [AUTH] Global signOut reference cleared
```

**Update:** After fixing the characteristic selection, the app still crashed when printing receipts (528 bytes) even though test prints (smaller data) worked fine.

## Root Causes

### 1. Wrong Characteristic Selection (Initial Issue)
The Bluetooth service was attempting to write receipt data to the **wrong characteristic**. The UUID `00002a00-0000-1000-8000-00805f9b34fb` is the **Generic Access Profile (GAP) Device Name characteristic**, which is:
1. **Read-only** or has very limited write capabilities
2. **Not designed for printing** - it's for device identification
3. **Has a small maximum write size** (typically 20-30 bytes)

### 2. BLE MTU Limit (Second Issue)
Even after finding the correct printer characteristic (`00002af1`), the app crashed because:
1. **BLE has a Maximum Transmission Unit (MTU) limit** - default is 23 bytes (20 bytes payload after overhead)
2. **The code was trying to send 528 bytes in one write operation**
3. **This exceeded the MTU limit and caused a native crash**
4. **Test prints worked because they were small enough** to fit in one MTU packet

## Solution

### 1. Smart Characteristic Selection (`services/BluetoothPrinterService.ts`)

Added intelligent characteristic selection that:
- **Prioritizes known printer characteristics** (common thermal printer UUIDs)
- **Skips known non-printer characteristics** (Device Name, Appearance, etc.)
- **Only falls back to generic writable characteristics** if no known printer characteristic is found

```typescript
// Common printer characteristic UUIDs (in order of priority)
const PRINTER_CHAR_UUIDS = [
  '00002af1-0000-1000-8000-00805f9b34fb', // Common thermal printer write characteristic
  '0000ff02-0000-1000-8000-00805f9b34fb', // Another common write characteristic
  '49535343-8841-43f4-a8d4-ecbe34729bb3', // HM-10 write characteristic
];

// Skip known non-printer characteristics
const SKIP_CHAR_UUIDS = [
  '00002a00-0000-1000-8000-00805f9b34fb', // Device Name (read-only)
  '00002a01-0000-1000-8000-00805f9b34fb', // Appearance
  '00002a04-0000-1000-8000-00805f9b34fb', // Peripheral Preferred Connection Parameters
  '00002a05-0000-1000-8000-00805f9b34fb', // Service Changed
];
```

### 2. Data Chunking for BLE MTU Limit (CRITICAL FIX)

**This is the key fix that prevents crashes with larger receipts.**

The code now splits data into 20-byte chunks to respect BLE MTU limits:

```typescript
// Use conservative chunk size to avoid BLE MTU issues
// Default BLE MTU is 23 bytes, minus 3 bytes overhead = 20 bytes payload
const chunkSize = 20; // Safe size that works with all BLE devices

// Split data into chunks and send
const dataBytes = new TextEncoder().encode(data);
const totalChunks = Math.ceil(dataBytes.length / chunkSize);

for (let i = 0; i < totalChunks; i++) {
  const start = i * chunkSize;
  const end = Math.min(start + chunkSize, dataBytes.length);
  const chunk = dataBytes.slice(start, end);

  // Convert chunk to base64 for BLE transmission
  const base64Chunk = btoa(String.fromCharCode(...chunk));

  if (printCharacteristic.isWritableWithoutResponse) {
    await printCharacteristic.writeWithoutResponse(base64Chunk);
    // Small delay between chunks to prevent buffer overflow
    await new Promise(resolve => setTimeout(resolve, 10));
  } else {
    await printCharacteristic.writeWithResponse(base64Chunk);
  }
}
```

**Why this works:**
- BLE default MTU is 23 bytes (20 bytes usable after 3-byte overhead)
- Sending data larger than MTU in one write causes native crashes
- Chunking ensures each write stays within MTU limits
- 10ms delay between chunks prevents printer buffer overflow

### 3. Enhanced Error Handling

Added comprehensive error handling to prevent crashes:

**In `BluetoothPrinterService.ts`:**
- Wrapped write operations in try-catch blocks
- Added specific error messages for different failure types (GATT errors, MTU size errors, etc.)
- Added timeout protection (30 seconds) to prevent hanging
- Better logging at each step

**In `POSKasirScreen.tsx`:**
- Added detailed logging throughout the print process
- Added try-catch-finally blocks to ensure cleanup
- Improved error messages shown to users
- Added Bluetooth status check before attempting to print

### 4. Timeout Protection

Added timeout protection to prevent the app from hanging if the printer doesn't respond:

```typescript
// Send with timeout protection
const printPromise = this.sendDataToPrinter(data);
const timeoutPromise = new Promise((_, reject) => 
  setTimeout(() => reject(new Error('Print timeout after 30 seconds')), 30000)
);

await Promise.race([printPromise, timeoutPromise]);
```

## Files Changed

1. **`services/BluetoothPrinterService.ts`**
   - Updated `sendDataToPrinter()` method with smart characteristic selection
   - Enhanced `printReceipt()` with timeout protection and better error handling
   - Enhanced `testPrint()` with timeout protection and better error handling

2. **`screens/pos/POSKasirScreen.tsx`**
   - Enhanced `printReceipt()` with comprehensive logging and error handling
   - Enhanced `testPrint()` with comprehensive logging and error handling

## Testing

To test the fix:
1. Complete a POS transaction
2. Click "Yes, Print" when prompted
3. The app should now:
   - Connect to the correct printer characteristic
   - Send the receipt data without crashing
   - Show appropriate error messages if something goes wrong
   - Not crash even if the print fails

## Additional Notes

- The fix maintains backward compatibility with existing printer configurations
- If your specific printer uses a different characteristic UUID, the code will still find it (as long as it's writable and not in the skip list)
- All Bluetooth operations now have proper error handling to prevent app crashes
- Detailed logging helps diagnose any future issues

## Next Steps

If you still experience issues:
1. Check the logs to see which characteristic UUID is being used
2. If it's a different UUID, you can add it to the `PRINTER_CHAR_UUIDS` list
3. Test with the "Test Print" button in the printer settings to verify connectivity

