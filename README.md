# Offline Markdown Notes 📝

A privacy-first, 100% offline Markdown notes editor built with React, Vite, TypeScript, and Tailwind CSS.

Zero online connectivity. Zero AI. Zero cloud servers. Your notes remain entirely under your control on your machine.

---

## Key Features 🚀

- **100% Offline & Private**: Runs entirely in your browser with zero network requests or analytics.
- **Local Directory Storage**: Select a folder on your computer to save notes directly as standard `.md` files using the browser File System Access API.
- **AES-256-GCM Encrypted Backups**: Export and restore your notebook encrypted with strong PBKDF2 key derivation (100,000 iterations) and AES-256-GCM encryption.
- **Full Markdown Editor & Preview**: Support for live side-by-side split rendering, task lists, tables, code blocks, blockquotes, and formatting shortcuts.
- **Tag Organization System**: Categorize notes with custom tags and inline `#hashtags` with instant filtering.
- **Command Palette & Keyboard Navigation**: Press `Cmd + K` or `Ctrl + K` to launch instant command search, or use shortcuts like `Cmd + N` (New note), `Cmd + P` (Toggle view), and `Cmd + Shift + D` (Toggle theme).
- **Dark Mode**: High-contrast, clean dark and light themes.

---

## Keyboard Shortcuts ⌨️

| Shortcut | Action |
| :--- | :--- |
| `⌘ + K` / `Ctrl + K` | Open Command Palette |
| `⌘ + N` / `Ctrl + N` | Create New Note |
| `⌘ + F` / `Ctrl + F` | Focus Search Input |
| `⌘ + P` / `Ctrl + P` | Toggle View (Split / Edit / Preview) |
| `⌘ + ⇧ + D` / `Ctrl + Shift + D` | Toggle Dark / Light Theme |
| `⌘ + ⇧ + B` / `Ctrl + Shift + B` | Open Encrypted Backup Modal |
| `⌘ + ⇧ + F` / `Ctrl + Shift + F` | Toggle Focus Mode |
| `?` | Keyboard Shortcuts Cheat Sheet |

---

## Local Development Setup 🛠️

```bash
# Clone repository
git clone https://github.com/your-username/offline-markdown-notes.git

# Navigate to project directory
cd offline-markdown-notes

# Install dependencies
npm install

# Start development server
npm run dev
```

---

## Deploying to Vercel 🌐

This project is optimized for static SPA hosting on **Vercel**:

1. Push your code to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/your-username/offline-markdown-notes.git
   git push -u origin main
   ```
2. Go to [Vercel Dashboard](https://vercel.com) and click **"Add New Project"**.
3. Import your GitHub repository.
4. Select **Vite** as the Framework Preset.
5. Click **Deploy**!

---

## License

Apache-2.0
