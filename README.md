# Markdown Studio & Blog CMS 📝

A privacy-first, lightning-fast Markdown editor and static-site CMS built with React, TypeScript, Vite, and Tailwind CSS. Seamlessly author and manage **Blog Posts**, **Portfolio Projects**, and **Personal Notes** with YAML frontmatter, local folder synchronization, and optional encrypted cloud sync.

---

## 🚀 Key Features

### 📑 Multi-Document Types
- **Blog Posts (`posts/`)**: Full frontmatter support (`title`, `description` / subtitle, `slug`, `date`, `author`, `project`, `tags`, `image`, `pinned`).
- **Portfolio Projects (`projects/`)**: Structured project management (`title`, `description`, `slug`, `status`, `year`, `url`, `github`, `tags`, `order`).
- **Personal Notes (`notes/`)**: Quick scratchpad for everyday writing with tag filtering, pins, and search.

### 💾 Storage & Folder Sync Modes
- **Local Folder Direct Sync**: Connect to your static site repository or local disk folders (`posts/`, `projects/`, `notes/`). Markdown files and embedded image assets are read and written directly to your disk via the File System Access API.
- **Offline-First IndexedDB**: Automatic local persistence in your browser with zero latency.
- **Optional Vercel Cloud Sync**: Sync notes securely across your devices with end-to-end encryption.
- **Encrypted Backups**: Export and import your entire workspace encrypted with **AES-256-GCM** (PBKDF2 key derivation with 100,000 iterations).
- **Import / Export**: Batch import standard `.md` files or zip archives with automatic frontmatter extraction.

### ✍️ Authoring Experience
- **Dual Editor Modes**: Seamlessly switch between rich interactive **WYSIWYG formatting** and **Raw Markdown source** (`⌘ + E` / `Ctrl + E`).
- **Interactive Markdown Toolbar**: Quick buttons for headings, bold, italic, underline, blockquotes, code blocks, checklists, links, images, tables, and horizontal rules.
- **Metadata Drawer**: Slideout inspector to edit frontmatter, tags, author, publication date, project associations, URLs, status, and slugs.
- **Image & Asset Management**: Insert local images or external URLs directly into the editor; local images are stored alongside notes in your configured assets directory.
- **Instant Search**: Press `⌘ + F` or `Ctrl + F` to quickly filter notes, posts, and projects by title, content, or tags.
- **Dark & Light Mode**: High-contrast, clean dark and light themes with instant toggling.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `⌥ + N` / `Alt + N` | Create New Note / Post / Project |
| `⌘ + S` / `Ctrl + S` | Save `.md` to Local Folder |
| `⌘ + O` / `Ctrl + O` | Import / Open `.md` File |
| `⌘ + F` / `Ctrl + F` | Focus Search Input |
| `⌘ + E` / `Ctrl + E` | Toggle WYSIWYG / Raw Markdown |
| `⌘ + ⇧ + D` / `Ctrl + Shift + D` | Toggle Dark / Light Theme |
| `⌘ + ⇧ + B` / `Ctrl + Shift + B` | Open Encrypted Backup Modal |
| `?` / `⇧ + ?` | Show Keyboard Shortcuts Cheat Sheet |
| `Esc` | Close Modals / Clear Search |

---

## 🛠️ Local Development

```bash
# Clone the repository
git clone https://github.com/rmno187/NYK-notes.git

# Navigate to project directory
cd NYK-notes

# Install dependencies
npm install

# Start the local development server
npm run dev
```

The application will be accessible at `http://localhost:3000`.

---

## 🌐 Deployment

### Deploying to Vercel

This application is ready for zero-config static deployment on **Vercel**:

1. Push your repository to GitHub / GitLab / Bitbucket.
2. Import the project in the [Vercel Dashboard](https://vercel.com).
3. Framework Preset: **Vite**.
4. Click **Deploy**.

---

## 📄 License

Apache-2.0

