import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ChakraProvider, CSSReset, Box, Container } from '@chakra-ui/react';
import Header from './components/Header';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';
import UploadPage from './pages/UploadPage';
import QuizGenerationPage from './pages/QuizGenerationPage';
import QuizAttemptPage from './pages/QuizAttemptPage';
import QuizResultPage from './pages/QuizResultPage';
import SavedQuizzesPage from './pages/SavedQuizzesPage';

function App() {
  return (
    <ChakraProvider>
      <CSSReset />
      <Router>
        <Box minHeight="100vh" display="flex" flexDirection="column">
          <Header />
          <Container maxW="container.xl" flex="1" py={6}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/upload" element={<UploadPage />} />
              <Route path="/generate/:documentId" element={<QuizGenerationPage />} />
              <Route path="/quiz/:quizId" element={<QuizAttemptPage />} />
              <Route path="/quiz/:quizId/results" element={<QuizResultPage />} />
              <Route path="/saved-quizzes" element={<SavedQuizzesPage />} />
            </Routes>
          </Container>
          <Footer />
        </Box>
      </Router>
    </ChakraProvider>
  );
}

export default App;