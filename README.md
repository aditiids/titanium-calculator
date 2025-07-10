# 🧮 Titanium Calculator App

A simple yet modern calculator app built using the **Appcelerator Titanium SDK** (Classic project structure). It demonstrates the use of **ES6 JavaScript**, clean UI practices, modular code, and screen navigation.

---

## ✨ Features

- 🔐 **Login Screen** with email and password validation  
- ➡️ **Navigation** between Login and Calculator screen  
- 🧮 **Calculator** supporting:  
  - Basic arithmetic operations: `+`, `−`, `×`, `÷`  
  - Percentage (`%`), Negation (`±`)  
  - Clear (`C`) and Equal (`=`)  
- 🌙 **Dark Mode UI** using custom styling  
- ✅ **Modular structure** using `require()` (Classic)  
- 🚀 Uses **modern ES6+ JavaScript** (arrow functions, destructuring, template literals, etc.)

---

## 📁 Project Structure

```
HelloWorldApp/
├── Resources/
│   ├── app.js             # Entry point
│   ├── login.js           # Login screen logic
│   └── calculator.js      # Calculator UI and logic
├── tiapp.xml              # App configuration
```

---

## 🛠️ Requirements

- **Titanium SDK**
- **Node.js** and **npm**
- **Xcode** (for iOS development)
- **Android Studio** + SDK (for Android builds)

---

## 🧪 Running the App

### 1. Clone this repo:

```bash
git clone https://github.com/aditiids/titanium-calculator.git
cd titanium-calculator
```

### 2. Build & Run

```bash
ti build -p ios      # For iOS Simulator
ti build -p android  # For Android Emulator
```

You can also enable **LiveView** for auto-refresh:

```bash
ti build -p ios --liveview
```

---

## 🧠 Learnings

This project helped me learn and practice:

- Titanium Classic UI components (`Window`, `View`, `Button`, `Label`, `TextField`)
- ES6 JavaScript features
- Creating reusable screens using `require()`
- Navigation logic (login/logout flow)
- Platform-specific UI adjustments (iOS vs Android)

---


## 📌 Notes

This app does **not use Alloy** — it's built on the **Classic Titanium structure** as per the project requirement.  
Navigation is manually handled using multiple JS modules and window management.
