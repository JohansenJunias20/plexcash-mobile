const fs = require('fs');

const content = fs.readFileSync('c:\\plexcash-mobile\\screens\\ecommerce\\ReturOnlineScreen.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, index) => {
    if (line.includes('isPrinted') || line.includes('isScanned') || line.includes('isPacked')) {
        console.log(`Line ${index + 1}: ${line.trim()}`);
    }
});
