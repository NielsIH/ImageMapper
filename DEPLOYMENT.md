# Deployment Guide - GitHub Pages

## Quick Setup for GitHub Pages

### 1. Create GitHub Repository
1. Go to [GitHub.com](https://github.com) and sign in
2. Click "New repository" (green button)
3. Name it: `quarry-inventory` (or your preferred name)
4. Make it **Public** (required for free GitHub Pages)
5. ✅ Check "Add a README file"
6. Click "Create repository"

### 2. Upload Your App Files
**Option A: Web Interface (Easiest)**
1. In your new repository, click "uploading an existing file"
2. Drag and drop all these files:
   - `index.html`
   - `manifest.json`
   - `service-worker.js`
   - `css/` folder
   - `js/` folder
   - `.gitignore`
3. Scroll down, add commit message: "Add PWA Phase 1A"
4. Click "Commit changes"

**Option B: Git Command Line**
```bash
# Clone the repository
git clone https://github.com/YOURUSERNAME/quarry-inventory.git
cd quarry-inventory

# Copy your app files into this folder
# Then:
git add .
git commit -m "Add PWA Phase 1A - Basic foundation"
git push origin main
```

### 3. Enable GitHub Pages
1. In your repository, go to **Settings** tab
2. Scroll down to **Pages** section (left sidebar)
3. Under "Source", select **Deploy from a branch**
4. Choose **main** branch
5. Choose **/ (root)** folder
6. Click **Save**

### 4. Get Your App URL
- GitHub will show you the URL: `https://YOURUSERNAME.github.io/quarry-inventory`
- It may take 2-10 minutes to become available
- Share this URL with your team

## Team Installation Instructions

### For Team Members:
1. **Visit the app URL** on your device
2. **Open in browser** (Chrome, Safari, Firefox, Edge)
3. **Install the PWA**:
   - **Desktop**: Look for install icon in address bar
   - **Mobile**: Use "Add to Home Screen" from browser menu
4. **Use offline**: Works without internet after installation

### Testing Installation:
1. Visit your GitHub Pages URL
2. Open Developer Tools (F12)
3. Go to Application tab → Service Workers
4. Verify service worker is registered
5. Test offline mode (Network tab → Offline checkbox)

## Updating the App

### When you make changes:
1. **Edit files** in your repository (GitHub web interface or git)
2. **Commit changes** with descriptive message
3. **GitHub Pages auto-deploys** within minutes
4. **Team members**: 
   - May need to refresh browser
   - For major updates, they can re-install the PWA

## Repository Structure
```
quarry-inventory/
├── index.html              # Main app (THIS IS THE ENTRY POINT)
├── manifest.json           # PWA configuration
├── service-worker.js       # Offline functionality
├── css/
│   └── app.css            # Styles
├── js/
│   └── app.js             # Main app logic
├── icons/                 # PWA icons (create this folder)
├── .gitignore             # Git ignore rules
├── README.md              # Project documentation
├── DEPLOYMENT.md          # This guide
└── LICENSE                # Optional: License file
```

## Creating PWA Icons (Recommended)

Create an `icons/` folder and add these icon sizes:
- `icon-72x72.png`
- `icon-96x96.png` 
- `icon-128x128.png`
- `icon-144x144.png`
- `icon-152x152.png`
- `icon-192x192.png`
- `icon-384x384.png`
- `icon-512x512.png`
- `favicon-16x16.png`
- `favicon-32x32.png`
- `apple-touch-icon.png`

You can generate these from a single logo using online tools like:
- [RealFaviconGenerator.net](https://realfavicongenerator.net/)
- [PWABuilder.com](https://www.pwabuilder.com/)

## Troubleshooting

### Common Issues:
1. **404 Error**: Check that `index.html` is in the root folder
2. **PWA not installing**: Ensure HTTPS is working (GitHub Pages provides this)
3. **Service Worker errors**: Check browser console for errors
4. **Updates not showing**: Hard refresh (Ctrl+F5) or clear browser cache

### Verification Steps:
1. **Visit your URL**: Should load the welcome screen
2. **Check manifest**: `yoururl.com/manifest.json` should show JSON
3. **Test offline**: Should work after initial load
4. **Install prompt**: Should appear in supported browsers

## Security Notes

- ✅ GitHub Pages provides HTTPS automatically
- ✅ Service Worker only works over HTTPS
- ✅ All PWA features available
- ⚠️ Don't commit sensitive data (user photos/maps)
- ⚠️ Repository is public (app code is visible)

## Next Steps

After deployment:
1. **Test with team members** on different devices
2. **Gather feedback** on user experience
3. **Plan Phase 1B** (map upload functionality)
4. **Document any issues** for improvement

## Support

If you encounter issues:
1. Check GitHub Pages status
2. Verify all files are committed
3. Test in incognito mode
4. Check browser developer tools for errors