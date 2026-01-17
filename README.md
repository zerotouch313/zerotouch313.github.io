# Zero Touch Printing Portal

Remote document printing service for students.

## Features

- **File Upload**: Upload PDF and image files for printing
- **Color Detection**: Automatic color analysis for intelligent pricing
- **Payment Integration**: Nagad and bKash mobile payment support
- **Collect Later**: Option to collect prints at a later time
- **Real-time Status**: Live printer status monitoring
- **Maintenance Mode**: Easy maintenance screen toggle

## Maintenance Mode

To enable maintenance mode, simply edit `app.js`:

```javascript
// Line 20 in app.js
const MAINTENANCE_MODE = true;  // Change to true to enable maintenance
```

When maintenance mode is enabled:
- All users will see a maintenance screen
- Normal application functionality is hidden
- Contact information remains accessible
- Professional wrench icon animation displays

To disable maintenance mode, set it back to `false`.

## File Structure

- `index.html` - Main HTML structure with comprehensive comments
- `app.js` - Application logic with detailed comments explaining each function
- `styles.css` - Styling with organized sections and comments
- `assets/` - Images and icons

## Key Sections (All Fully Commented)

### HTML (index.html)
- Maintenance screen overlay
- Header with logo and social links
- File upload form with collect later option
- Payment verification modal
- WhatsApp contact section

### JavaScript (app.js)
- Server configuration
- Maintenance mode control
- PDF page counting with PDF.js
- Printer status monitoring
- Color analysis for pricing
- Payment verification flow
- File upload handling

### CSS (styles.css)
- CSS variables for theming
- Maintenance overlay styling
- Premium glassmorphism effects
- Responsive design
- Smooth animations

## How It Works

1. **Upload Files**: Users select PDF or image files
2. **Configure Settings**: Set copies, page ranges, and print mode (B&W or Color)
3. **Color Analysis**: Automatic detection of color usage for pricing
4. **Cost Calculation**: Real-time cost estimation
5. **Payment**: Send money via Nagad or bKash
6. **Verification**: Enter transaction ID to verify payment
7. **Upload**: Files are sent to the printer server

## Pricing Tiers

- **Black & White**: 2 tk/page
- **Light Color** (0-40% color): 3 tk/page
- **Medium Color** (40-70% color): 4 tk/page
- **Heavy Color** (70-90% color): 5 tk/page
- **Full Color** (>90% color): 6 tk/page

## Contact

For support, contact via WhatsApp:
- 01771080238
- 01568550778
- 01716897644
