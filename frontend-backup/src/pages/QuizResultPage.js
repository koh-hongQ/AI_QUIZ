import React, { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
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
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  StatGroup,
  Badge,
  Divider,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  CircularProgress,
  CircularProgressLabel,
  useColorModeValue
} from '@chakra-ui/react';
import { ChevronRightIcon, CheckCircleIcon, WarningIcon } from '@chakra-ui/icons';
import QuizQuestion from '../components/QuizQuestion';
import axios from 'axios';

const QuizResultPage = () => {
  const { quizId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Get results from state or fetch them
  const [results, setResults] = useState(location.state?.results || null);
  const [userAnswers, setUserAnswers] = useState(location.state?.answers || {});
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const bgColor = useColorModeValue('gray.50', 'gray.700');

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch quiz details if not already present
        const quizResponse = await axios.get(`/api/quiz/${quizId}`);
        setQuiz(quizResponse.data);
        
        // If results weren't passed via state, we'd need to fetch them
        if (!results) {
          // This endpoint would need to exist in a real implementation
          const resultsResponse = await axios.get(`/api/quiz/${quizId}/results`);
          setResults(resultsResponse.data);
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching quiz results:', err);
        setError('Failed to fetch quiz results');
        setLoading(false);
      }
    };

    fetchData();
  }, [quizId, results]);

  if (loading) {
    return (
      <Container maxW="container.md" py={8}>
        <Text textAlign="center">Loading results...</Text>
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

  if (!quiz || !results) return null;

  // Calculate performance
  const scorePercentage = results.score.percentage;
  const scoreColor = scorePercentage >= 80 ? 'green' : 
                     scorePercentage >= 60 ? 'yellow' : 'red';

  // Filter out essay questions which are not scored
  const gradableQuestions = quiz.questions.filter(q => q.type !== 'essay');

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
          <BreadcrumbLink>Results</BreadcrumbLink>
        </BreadcrumbItem>
      </Breadcrumb>

      <Box mb={6}>
        <Heading as="h1" size="lg" mb={2}>Quiz Results</Heading>
        <Text color="gray.600">{quiz.title}</Text>
      </Box>
      
      <Box bg={bgColor} p={6} borderRadius="lg" mb={8} boxShadow="sm">
        <Flex 
          direction={{ base: 'column', md: 'row' }} 
          align="center" 
          justify="space-between"
        >
          <CircularProgress 
            value={scorePercentage} 
            color={`${scoreColor}.500`}
            size="120px"
            thickness="8px"
          >
            <CircularProgressLabel fontWeight="bold" fontSize="xl">
              {Math.round(scorePercentage)}%
            </CircularProgressLabel>
          </CircularProgress>
          
          <StatGroup flex="1" ml={{ md: 8 }} mt={{ base: 6, md: 0 }}>
            <Stat>
              <StatLabel>Correct Answers</StatLabel>
              <StatNumber>{results.score.correct}</StatNumber>
              <StatHelpText>
                <CheckCircleIcon color="green.500" mr={1} />
                out of {results.score.total}
              </StatHelpText>
            </Stat>
            
            {gradableQuestions.length !== quiz.questions.length && (
              <Stat>
                <StatLabel>Essay Questions</StatLabel>
                <StatNumber>{quiz.questions.length - gradableQuestions.length}</StatNumber>
                <StatHelpText>Not auto-graded</StatHelpText>
              </Stat>
            )}
          </StatGroup>
        </Flex>
        
        <Divider my={6} />
        
        <Box>
          <Heading as="h3" size="md" mb={4}>Performance Summary</Heading>
          <Text>
            {scorePercentage >= 80 ? 
              'Excellent! You have a strong understanding of the material.' :
              scorePercentage >= 60 ?
              'Good job! You understand most of the key concepts.' :
              'You might want to review the material again to improve your understanding.'}
          </Text>
        </Box>
      </Box>
      
      <Heading as="h2" size="md" mb={4}>
        Question Review
      </Heading>
      
      {quiz.questions.map((question, index) => (
        <QuizQuestion
          key={question.id}
          question={question}
          questionNumber={index + 1}
          totalQuestions={quiz.questions.length}
          userAnswer={userAnswers[question.id]}
          onAnswerChange={() => {}} // No changes allowed in review mode
          showAnswer={true}
        />
      ))}
      
      <Flex justify="space-between" mt={8}>
        <Button 
          onClick={() => navigate('/upload')} 
          colorScheme="teal" 
          variant="outline"
        >
          Upload New Document
        </Button>
        <Button 
          onClick={() => navigate('/saved-quizzes')} 
          colorScheme="blue"
        >
          My Quizzes
        </Button>
      </Flex>
    </Container>
  );
};

export default QuizResultPage;