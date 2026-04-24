# Contributing to सफल (SAFAL)

Thank you for your interest in contributing to SAFAL! This project helps Nepal Government offices track file movement digitally. Every contribution matters.

---

## 🌱 Ways to Contribute

- 🐛 **Report bugs** — open an issue
- 💡 **Suggest features** — open a discussion
- 🔧 **Fix bugs** — submit a pull request
- 📖 **Improve docs** — update README or add wiki pages
- 🌐 **Translations** — help with Nepali text accuracy
- 📅 **BS Calendar** — extend year coverage beyond 2090
- 🧪 **Testing** — test on different browsers/devices

---

## 🚀 Getting Started

### 1. Fork & Clone

```bash
# Fork on GitHub, then:
git clone https://github.com/YOUR_USERNAME/safal.git
cd safal
```

### 2. Set Up for Development

Since the frontend is a single HTML file, you can open it directly in a browser for UI changes. For full backend testing:

1. Create a Google Apps Script project at [script.google.com](https://script.google.com)
2. Upload `Code.gs` and `index.html`
3. Set up a test Google Sheet (see README for structure)
4. Deploy as Web App (execute as yourself, anyone with link)

### 3. Make Your Changes

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/bug-description
```

### 4. Test Your Changes

- Test in **Chrome, Firefox, Safari** (desktop)
- Test on **Android Chrome** and **iOS Safari** (mobile)
- Test **light, dark, sepia** themes
- Test **Nepali BS date picker** edge cases
- Test **PWA install** flow if you changed manifest/SW

### 5. Submit Pull Request

```bash
git add .
git commit -m "feat: add export to PDF feature"
git push origin feature/your-feature-name
```

Then open a Pull Request on GitHub with:
- Clear description of what changed and why
- Screenshots if UI changed
- Steps to test

---

## 📝 Commit Message Convention

Use conventional commits:

```
feat: add new feature
fix: fix a bug
docs: update documentation
style: formatting, no logic change
refactor: code refactor, no feature change
test: add or update tests
chore: build process or tooling
```

Examples:
```
feat: add PDF export for active files
fix: BS calendar wrong day count in Falgun
docs: add screenshots to README
style: improve mobile table layout
```

---

## 🏗️ Code Style

- **No build tools** — plain HTML/CSS/JS only
- **No frameworks** — vanilla JS preferred (keep it deployable anywhere)
- **Nepali text** — use proper Devanagari Unicode, not transliteration
- **Comments** — add comments for complex BS calendar logic
- **Functions** — keep functions small and focused
- **CSS** — use CSS variables (`--sky`, `--green`, etc.) not hardcoded colors

---

## 🌐 Nepali Language Guidelines

- Use formal Nepali (शिष्ट भाषा), not colloquial
- Prefer established government terminology
- Test Devanagari rendering in Noto Sans Devanagari font
- Use Nepali numerals (०१२३...) for display, ASCII for logic
- Refer to the Improved Nepali Text table in the project docs

---

## 📊 BS Calendar Contributions

If extending the Bikram Sambat calendar data:

1. Use official Nepal Calendar Determination Committee data
2. Verify each year's month lengths against printed पात्रो
3. Test anchor date: BS 2078 Baisakh 1 = AD 2021 April 14
4. Verify today's date conversion before submitting

---

## 🔒 Security

- **Never commit** credentials, Sheet IDs, or API keys
- If you find a security vulnerability, please email directly rather than opening a public issue
- Passwords must remain hashed server-side

---

## 📋 Issue Templates

When opening a bug report, include:

```
**Browser:** Chrome 120 / Firefox 115 / Safari 17
**OS:** Windows 11 / Android 13 / iOS 17
**Device:** Desktop / Mobile
**Steps to reproduce:**
1.
2.
3.
**Expected:** 
**Actual:** 
**Screenshot:** (if applicable)
```

---

## 🙏 Code of Conduct

- Be respectful and constructive
- Welcome newcomers and beginners
- Focus on what is best for Nepal Government users
- Give credit where it's due

---

Thank you for making सफल better for Nepal! 🇳🇵
