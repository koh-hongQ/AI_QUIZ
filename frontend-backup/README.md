# AI Quiz Generator - Frontend

This is the React frontend for the AI Quiz Generator application. It provides a user interface for uploading PDF documents, generating quizzes, taking quizzes, and viewing results.

## 🧱 Component Structure

The application is organized into the following key components:

### Pages

- **HomePage**: Landing page with app description and navigation
- **UploadPage**: Interface for uploading PDF documents
- **QuizGenerationPage**: Settings for quiz generation
- **QuizAttemptPage**: Interface for taking a quiz
- **QuizResultPage**: Display quiz results and feedback
- **SavedQuizzesPage**: List of saved quizzes

### Components

- **Header**: Navigation and app title
- **Footer**: App information
- **FileUpload**: PDF upload component
- **ProcessingStatus**: Display document processing progress
- **QuizGenerator**: Quiz configuration form
- **QuizQuestion**: Individual quiz question display

## 🚀 Getting Started

### Prerequisites

- Node.js (v14+)
- npm or yarn

### Installation

1. Install dependencies:
   ```
   npm install
   ```

2. Configure the proxy (if needed):
   - Edit the `"proxy"` field in `package.json` to point to your backend server
   - Default is `"http://localhost:5000"`

3. Start the development server:
   ```
   npm start
   ```

### Building for Production

To create a production-ready build:
```
npm run build
```

The build artifacts will be stored in the `build` directory.

## 📦 Dependencies

- React: UI library
- React Router: Navigation
- Chakra UI: Component library
- Axios: API client
- React Icons: Icon library
- Framer Motion: Animation library

## 🎨 Styling

The application uses Chakra UI for styling with a responsive design that works on mobile, tablet, and desktop devices. The color scheme is customized in the `theme.js` file.

## 🧪 Testing

Run the test suite with:
```
npm test
```

## 📝 Notes

- The frontend proxy is configured to connect to a backend at `http://localhost:5000`
- In production, the backend serves the built frontend