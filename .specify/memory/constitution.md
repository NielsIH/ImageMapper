<!-- 
SYNC IMPACT REPORT
==================
Version Change: 1.0.0 (initial)
Ratification Date: 2025-10-28
Last Amended: 2025-10-28

Principles Established:
- I. Clean Code & JavaScript Standards
- II. Simple & Intuitive UX
- III. Responsive Design
- IV. Minimal Dependencies
- V. No Testing (NON-NEGOTIABLE)
- VI. Offline-First PWA
- VII. Single Page Application
- VIII. Cross-Platform Mobile & Desktop

Sections Added:
- Technical Stack & Architecture
- Development Workflow & Code Review

Templates Updated:
- ✅ plan-template.md (Constitution Check section aligns with principles)
- ✅ spec-template.md (No testing requirements in acceptance scenarios)
- ✅ tasks-template.md (No test tasks included by default)

Follow-up TODOs: None - all placeholders resolved
-->

# SnapSpot Constitution

## Core Principles

### I. Clean Code & JavaScript Standards

All JavaScript code MUST adhere to JavaScript Standard Style (StandardJS) rules and ES6+ syntax. Code MUST use a modular approach with clear separation of concerns. Each module MUST have a single, well-defined responsibility. Code MUST be readable, maintainable, and self-documenting through clear naming conventions and logical organization.

**Rationale**: Clean code reduces bugs, improves maintainability, and enables rapid feature development. StandardJS provides consistent formatting without configuration overhead. Modularity enables independent feature development and testing.

### II. Simple & Intuitive User Experience

The application and its UX MUST be simple and intuitive. Every feature MUST prioritize user clarity over feature richness. Navigation MUST be obvious without documentation. Visual hierarchy MUST guide users naturally through workflows. Complexity MUST be hidden from end users.

**Rationale**: Simplicity reduces user errors, accelerates adoption, and minimizes support burden. Intuitive design works across skill levels and languages.

### III. Responsive Design

The application MUST work seamlessly on Android and iOS mobile devices (phones and tablets) as well as desktop computers. All UI elements MUST adapt fluidly to different screen sizes. Touch interactions MUST be optimized for mobile. Desktop features MUST not compromise mobile usability.

**Rationale**: Users access the app across multiple devices and contexts. Responsive design ensures consistent experience and maximizes addressable user base.

### IV. Minimal Dependencies

The project MUST minimize external dependencies. Every dependency addition MUST be justified by significant functionality gain or critical bug fixes. Prefer built-in browser APIs and vanilla JavaScript over libraries when feasible. Dependencies MUST be actively maintained and have clear licensing.

**Rationale**: Fewer dependencies reduce bundle size, improve offline reliability, decrease security surface, and simplify maintenance. Minimal dependencies align with PWA offline-first goals.

### V. No Testing (NON-NEGOTIABLE)

This principle SUPERSEDES all other guidance. The project MUST NOT include unit tests, integration tests, end-to-end tests, or any other automated testing framework. Manual testing and user validation are the only acceptable verification methods. No testing infrastructure, test runners, or test utilities MUST be added to the codebase.

**Rationale**: Testing infrastructure adds complexity and maintenance burden. For a single-page offline-first application with simple UX, manual testing and user feedback provide sufficient quality assurance. This principle prioritizes simplicity and rapid iteration.

### VI. Offline-First Progressive Web App

The application MUST work offline using PWA techniques. Service Workers MUST cache essential assets and data. The app MUST function fully without network connectivity. Sync MUST occur transparently when connectivity returns. Users MUST be informed of connectivity status.

**Rationale**: Offline capability enables use in environments with poor connectivity (construction sites, remote locations). PWA techniques provide native app-like experience without app store distribution.

### VII. Single Page Application

The application MUST be a Single Page Application (SPA). All navigation MUST occur client-side without full page reloads. State MUST be managed in memory with persistence to local storage. URL routing MUST reflect current application state for bookmarking and sharing.

**Rationale**: SPA provides smooth, responsive user experience. Client-side routing eliminates server dependency and enables offline operation. Reduced network requests improve performance.

### VIII. Cross-Platform Mobile & Desktop Support

The application MUST work on Android phones, Android tablets, iOS phones, iOS tablets, and desktop computers (Windows, macOS, Linux). All features MUST be accessible on all platforms. Platform-specific optimizations MUST not create feature gaps.

**Rationale**: Maximizes addressable user base. Consistent feature set across platforms simplifies development and user expectations.

## Technical Stack & Architecture

**Language**: JavaScript (ES6+)  
**Architecture**: Single Page Application (SPA)  
**Offline Capability**: Progressive Web App (PWA) with Service Workers  
**Storage**: Browser Local Storage and IndexedDB  
**UI Framework**: Vanilla JavaScript (no framework dependency)  
**Styling**: CSS3 with responsive design patterns  
**Build Process**: Minimal - no build step required for core functionality  
**Code Style**: JavaScript Standard Style (StandardJS)

## Development Workflow & Code Review

All code changes MUST:
1. Adhere to JavaScript Standard Style rules
2. Maintain or improve code simplicity
3. Preserve offline functionality
4. Work across all target platforms (mobile and desktop)
5. Not introduce new dependencies without explicit justification
6. Not add testing infrastructure or test code

Code review MUST verify compliance with all principles above. Complexity MUST be justified by user value. When principles conflict, the No Testing principle (V) SUPERSEDES all others.

## Governance

This Constitution is the authoritative guide for SnapSpot development. All decisions, code reviews, and feature implementations MUST align with these principles. When guidance conflicts with these principles, the principles take precedence.

**Amendment Procedure**: Constitution changes require documentation of the rationale, affected principles, and migration plan. Version bumps follow semantic versioning: MAJOR for principle removals/redefinitions, MINOR for new principles or expanded guidance, PATCH for clarifications.

**Compliance Review**: All pull requests MUST include a brief note confirming alignment with applicable principles. Principle violations MUST be explicitly justified or the PR MUST be revised.

**Version**: 1.0.0 | **Ratified**: 2025-10-28 | **Last Amended**: 2025-10-28
