@AGENTS.md
# Visitor Management

## Project Overview

This project is a personal Visitor Management mobile application built using React Native.

The application is used to record visitors for a private spiritual consultation business.

There is only one user (the owner), so authentication is NOT required.

The application must remain simple, fast, responsive, and easy to use.

---

# Tech Stack

Always use the following technologies unless explicitly instructed otherwise:

- React Native
- Expo
- Expo Router
- TypeScript
- NativeWind
- AsyncStorage

Never introduce another framework without permission.

---

# Storage

Use AsyncStorage for all local data persistence.

Requirements:

- Work completely offline.
- No backend.
- No Firebase.
- No Supabase.
- No SQLite.
- No API calls unless explicitly requested.

All visitor data must remain stored locally.

---

# Categories

The available visitor categories are:

- Regular
- VIP
- Family

Do not add or remove categories unless requested.

---

# Application Features

The application includes:

- Dashboard
- Visitor List
- Visitor Detail
- Add Visitor
- Edit Visitor
- Delete Visitor
- Search Visitor
- Filter Visitor
- Settings

Do not remove existing functionality.

---

# Project Structure

Follow Expo Router conventions.

Keep the project organized.

Example:

app/
components/
constants/
hooks/
storage/
types/
assets/

Separate:

- UI
- Business Logic
- Storage
- Navigation

Avoid mixing responsibilities.

---

# Coding Standards

Always:

- Use TypeScript.
- Use Functional Components.
- Use React Hooks.
- Create reusable components.
- Avoid duplicated code.
- Keep components small.
- Use meaningful naming.
- Follow React Native best practices.
- Follow Expo Router best practices.

Do not create unnecessary complexity.

---

# UI & UX Guidelines

The application should feel like a professionally designed mobile application.

Design principles:

- Modern
- Minimalist
- User Friendly
- Mobile First
- Clean
- Responsive
- Consistent

Use:

- Rounded corners
- Soft shadows
- Consistent spacing
- Clear typography hierarchy
- Comfortable touch targets
- Smooth animations

Avoid cluttered interfaces.

---

# Responsiveness

The UI must work correctly on:

- Android Phones
- Android Tablets
- Expo Web

Requirements:

- No clipped text
- No overlapping components
- No inaccessible buttons
- No broken layouts
- No excessive empty spaces

---

# Colors

Primary Color:

#2563EB

Background:

#F8FAFC

Cards:

#FFFFFF

Text Primary:

#111827

Text Secondary:

#6B7280

Use color consistently throughout the application.

---

# Icons

Use Lucide Icons or Expo Vector Icons.

Icons should:

- Have consistent size.
- Have consistent stroke width.
- Be aligned correctly.
- Match the application's visual style.

---

# Animations

Use lightweight animations only.

Examples:

- Fade
- Scale
- Slide
- Press feedback
- Screen transitions

Animations should feel smooth and professional.

Avoid excessive animation.

---

# Performance

Optimize for performance.

Avoid:

- Unnecessary re-renders
- Deep component nesting
- Heavy animations
- Unoptimized lists

Use FlatList when displaying visitor data.

---

# Code Quality

Before completing any task:

- Remove unused imports.
- Remove dead code.
- Fix TypeScript warnings.
- Fix lint issues.
- Keep files organized.

Always prefer readability over clever code.

---

# Design References

A folder named "desain" exists in the project.

This folder contains UI reference images exported from Stitch.

Before implementing UI changes:

- Inspect every image inside the "desain" folder.
- Use those designs as the primary visual reference.
- Preserve the user flow.
- Improve responsiveness when necessary.

Do NOT blindly recreate every pixel.

If small improvements in spacing, typography, responsiveness, or accessibility are needed, make those improvements while preserving the overall visual style.

---

# Important Rules

Never:

- Remove features without permission.
- Change business logic without permission.
- Replace AsyncStorage.
- Change the project architecture unnecessarily.
- Introduce new dependencies unless required.

Always:

- Preserve existing functionality.
- Improve code quality.
- Improve maintainability.
- Keep the project production-ready.

When requirements are unclear, ask for clarification before making major architectural changes.

## Avatar

Do not use visitor initials as avatars.

Use a simple person/user icon (👤 style icon) instead.

No profile photo upload functionality is required.