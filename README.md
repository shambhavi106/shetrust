# SheTrust

**SheTrust** is a crowd-sourced women's safety platform designed to help users make informed and safer travel decisions. It leverages community-driven safety ratings, a custom **Safety Trust Index (STI)**, intelligent route planning, and safety-focused cab recommendations to promote safer mobility for women.

## Features

- **Crowd-Sourced Safety Ratings:** Community-driven safety ratings for 35+ locations across Bengaluru, categorized into four daily time slots.
- **Safety Trust Index (STI):** A custom safety scoring system with anonymous, JWT-based submissions.
- **Outlier Detection:** Identifies and filters unusual ratings to improve the reliability of community feedback.
- **OLS Regression Engine:** Implements Ordinary Least Squares (OLS) regression from scratch using Gauss–Jordan matrix inversion to dynamically update STI weights.
- **Safe Route Planner:** Helps users plan safer routes with SOS support to locate the nearest police station.
- **Cab Booking:** Provides safety-focused cab recommendations to support secure travel.
- **AI-Powered Chatbot:** Integrates the Gemini API to provide intelligent, conversational assistance.

## Tech Highlights

- JWT-based authentication for anonymous submissions
- Custom-built OLS regression engine
- Gauss–Jordan matrix inversion
- Community-driven safety intelligence
- Google Gemini API integration

## Getting Started

Follow these steps to run SheTrust locally.

### Prerequisites

- Node.js
- npm
- Git

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/RiyaJayanti/SheTrust.git
   ```

2. **Navigate to the project directory**

   ```bash
   cd SheTrust
   ```

3. **Install dependencies**

   ```bash
   npm install
   ```

4. **Start the development server**

   ```bash
   npm run dev
   ```

5. Open the local URL displayed in your terminal to access the application.

---

**SheTrust — Making safer journeys a community-driven effort.** 💜
