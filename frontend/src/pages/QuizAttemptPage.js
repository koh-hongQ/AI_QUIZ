import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Container,
  Heading,
  Text,
  Alert,
  AlertIcon,
  Progress,
  Flex,
  Spacer,
  Badge,
  useToast,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  useDisclosure
} from '@chakra-ui/react';
import { ChevronRightIcon, ChevronLeftIcon, ChevronRightIcon as ChevronNext } from '@chakra-ui/icons';
import QuizQuestion from '../components/QuizQuestion';
import axios from 'axios';

const QuizAttemptPage = () => {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();
  
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchQuiz = async () => {
      try {
        const response = await axios.get(`/api/quiz/${quizId}`);
        setQuiz(response.data);
        
        // Initialize answers object with empty values
        const initialAnswers = {};
        response.data.questions.forEach(question => {
          initialAnswers[question.id] = undefined;
        });
        setUserAnswers(initialAnswers);
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching quiz:', err);
        setError('Failed to fetch quiz');
        setLoading(false);
      }
    };

    if (quizId) {
      fetchQuiz();
    }
  }, [quizId]);

  const handleAnswerChange = (answer) => {
    if (!quiz) return;
    
    const currentQuestion = quiz.questions[currentQuestionIndex];
    setUserAnswers(prev => ({
      ...prev,
      [currentQuestion.id]: answer
    }));
  };

  const goToNextQuestion = () => {
    if (currentQuestionIndex < quiz.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const goToPreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleSubmitQuiz = async () => {
    try {
      setSubmitting(true);
      
      // Filter out empty/undefined answers
      const answersToSubmit = {};
      Object.entries(userAnswers).forEach(([id, answer]) => {
        if (answer !== undefined) {
          answersToSubmit[id] = answer;
        }
      });
      
      const response = await axios.post(`/api/quiz/${quizId}/submit`, {
        answers: answersToSubmit
      });
      
      toast({
        title: 'Quiz submitted',
        description: 'Your answers have been submitted successfully',
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
      
      // Navigate to results page
      navigate(`/quiz/${quizId}/results`, { state: { results: response.data, answers: userAnswers } });
    } catch (err) {
      console.error('Error submitting quiz:', err);
      toast({
        title: 'Submission failed',
        description: err.response?.data?.message || 'Failed to submit quiz',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setSubmitting(false);
      onClose();
    }
  };

  if (loading) {
    return (
      <Container maxW="container.md" py={8}>
        <Text textAlign="center">Loading quiz...</Text>
        <Progress isIndeterminate size="sm" colorScheme="teal" mt={2} />
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxW="container.md" py={8}>
        <Alert status="error">
          <AlertIcon />
          {error}
        </Alert>
        <Button mt={4} onClick={() => navigate('/')} colorScheme="teal">
          Back to Home
        </Button>
      </Container>
    );
  }

  if (!quiz) return null;

  const currentQuestion = quiz.questions[currentQuestionIndex];
  const answeredCount = Object.values(userAnswers).filter(v => v !== undefined).length;
  const totalQuestions = quiz.questions.length;
  const progress = (answeredCount / totalQuestions) * 100;

  return (
    <Container maxW="container.md" py={8}>
      <Breadcrumb separator={<ChevronRightIcon color="gray.500" />} mb={6}>
        <BreadcrumbItem>
          <BreadcrumbLink href="/">Home</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbItem>
          <BreadcrumbLink>Quizzes</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbItem isCurrentPage>
          <BreadcrumbLink>Take Quiz</BreadcrumbLink>
        </BreadcrumbItem>
      </Breadcrumb>

      <Box mb={6}>
        <Flex align="center" mb={2}>
          <Heading as="h1" size="lg">{quiz.title}</Heading>
          <Spacer />
          <Badge colorScheme="green" fontSize="sm" px={2} py={1}>
            {quiz.quizType === 'mixed' ? 'Mixed' : 
              quiz.quizType === 'mcq' ? 'Multiple Choice' : 
              quiz.quizType === 'truefalse' ? 'True/False' : 
              'Short Answer'}
          </Badge>
        </Flex>
        <Text color="gray.600">Document: {quiz.documentName}</Text>
      </Box>
      
      <Box mb={6}>
        <Flex align="center" mb={2}>
          <Text>Progress: {answeredCount} of {totalQuestions} questions answered</Text>
          <Spacer />
          <Text>Question {currentQuestionIndex + 1} of {totalQuestions}</Text>
        </Flex>
        <Progress value={progress} size="sm" colorScheme="teal" borderRadius="md" />
      </Box>

      <QuizQuestion
        question={currentQuestion}
        questionNumber={currentQuestionIndex + 1}
        totalQuestions={totalQuestions}
        userAnswer={userAnswers[currentQuestion.id]}
        onAnswerChange={handleAnswerChange}
      />

      <Flex justify="space-between" mt={6}>
        <Button
          leftIcon={<ChevronLeftIcon />}
          onClick={goToPreviousQuestion}
          isDisabled={currentQuestionIndex === 0}
        >
          Previous
        </Button>

        {currentQuestionIndex < totalQuestions - 1 ? (
          <Button
            rightIcon={<ChevronNext />}
            colorScheme="teal"
            onClick={goToNextQuestion}
          >
            Next
          </Button>
        ) : (
          <Button
            colorScheme="blue"
            onClick={onOpen}
          >
            Submit Quiz
          </Button>
        )}
      </Flex>

      {/* Confirmation Modal */}
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Submit Quiz</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text>
              You've answered {answeredCount} out of {totalQuestions} questions.
            </Text>
            {answeredCount < totalQuestions && (
              <Alert status="warning" mt={4}>
                <AlertIcon />
                You still have {totalQuestions - answeredCount} unanswered questions. Are you sure you want to submit?
              </Alert>
            )}
          </ModalBody>

          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>
              Cancel
            </Button>
            <Button 
              colorScheme="blue" 
              onClick={handleSubmitQuiz}
              isLoading={submitting}
              loadingText="Submitting..."
            >
              Submit Quiz
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Container>
  );
};

export default QuizAttemptPage;