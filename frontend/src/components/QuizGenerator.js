import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Select,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  Textarea,
  Heading,
  Text,
  Stack,
  Flex,
  Alert,
  AlertIcon,
  useToast,
  Radio,
  RadioGroup,
  HStack,
  VStack,
  Icon,
  Badge,
  Divider,
  FormHelperText,
  Tooltip,
  Progress,
  Collapse,
  useDisclosure
} from '@chakra-ui/react';
import { InfoIcon, QuestionIcon, EditIcon, ChevronDownIcon, ChevronUpIcon } from '@chakra-ui/icons';
import { FiCpu, FiZap, FiTarget } from 'react-icons/fi';
import { generateQuiz, apiUtils } from '../api';

const QuizGenerator = ({ documentId, documentInfo }) => {
  const [quizType, setQuizType] = useState('mixed');
  const [questionCount, setQuestionCount] = useState(5);
  const [customQuery, setCustomQuery] = useState('');
  const [useCustomQuery, setUseCustomQuery] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [error, setError] = useState(null);
  const { isOpen: isAdvancedOpen, onToggle: onAdvancedToggle } = useDisclosure();
  const navigate = useNavigate();
  const toast = useToast();

  const handleGenerate = async () => {
    try {
      setIsGenerating(true);
      setError(null);
      setGenerationProgress(10);

      const requestData = {
        documentId,
        quizType,
        questionCount: parseInt(questionCount),
        customQuery: useCustomQuery ? customQuery.trim() : ''
      };

      setGenerationProgress(30);

      const response = await generateQuiz(requestData);

      setGenerationProgress(100);

      toast({
        title: 'Quiz Generated Successfully!',
        description: `Created ${response.quiz.questionCount} questions. Redirecting to quiz...`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      // Navigate to the quiz page after a short delay
      setTimeout(() => {
        navigate(`/quiz/${response.quizId}`);
      }, 1000);
    } catch (err) {
      console.error('Quiz generation error:', err);
      const errorMessage = apiUtils.formatErrorMessage(err);
      setError(errorMessage);
      
      toast({
        title: 'Quiz Generation Failed',
        description: errorMessage,
        status: 'error',
        duration: 7000,
        isClosable: true,
      });
    } finally {
      setIsGenerating(false);
      setGenerationProgress(0);
    }
  };

  const quizTypeOptions = [
    { 
      value: 'mixed', 
      label: 'Mixed Question Types',
      description: 'Combination of multiple choice, true/false, and essay questions',
      icon: FiZap,
      color: 'blue'
    },
    { 
      value: 'mcq', 
      label: 'Multiple Choice Questions',
      description: 'Questions with multiple options to choose from',
      icon: QuestionIcon,
      color: 'green'
    },
    { 
      value: 'truefalse', 
      label: 'True/False Questions',
      description: 'Binary choice questions to test understanding',
      icon: FiTarget,
      color: 'orange'
    },
    { 
      value: 'essay', 
      label: 'Short Answer Questions',
      description: 'Open-ended questions requiring written responses',
      icon: EditIcon,
      color: 'purple'
    }
  ];

  const selectedOption = quizTypeOptions.find(opt => opt.value === quizType);

  return (
    <Box borderWidth="1px" borderRadius="lg" p={6} bg="white" shadow="sm">
      <VStack spacing={6} align="stretch">
        {/* Header */}
        <HStack justify="space-between" align="center">
          <Heading as="h2" size="lg" color="gray.700">
            Configure Your Quiz
          </Heading>
          <Badge colorScheme="blue" size="lg" px={3} py={1}>
            <Icon as={FiCpu} mr={2} />
            AI-Powered
          </Badge>
        </HStack>
        
        {/* Document Info Summary */}
        {documentInfo && (
          <Box bg="gray.50" p={4} borderRadius="md" border="1px" borderColor="gray.200">
            <HStack wrap="wrap" spacing={4}>
              <Text fontSize="sm">
                <strong>Document:</strong> {documentInfo.originalFilename || documentInfo.filename}
              </Text>
              <Text fontSize="sm">
                <strong>Pages:</strong> {documentInfo.pageCount}
              </Text>
              <Text fontSize="sm">
                <strong>Chunks:</strong> {documentInfo.chunkCount}
              </Text>
            </HStack>
          </Box>
        )}
        
        {error && (
          <Alert status="error" borderRadius="md">
            <AlertIcon />
            <VStack align="start" spacing={1}>
              <Text fontWeight="bold">Generation Failed</Text>
              <Text fontSize="sm">{error}</Text>
            </VStack>
          </Alert>
        )}

        <Stack spacing={5}>
          {/* Quiz Type Selection */}
          <FormControl>
            <FormLabel fontWeight="semibold">Quiz Type</FormLabel>
            <VStack spacing={3}>
              {quizTypeOptions.map(option => (
                <Box
                  key={option.value}
                  w="100%"
                  p={4}
                  borderWidth="2px"
                  borderColor={quizType === option.value ? `${option.color}.300` : "gray.200"}
                  borderRadius="md"
                  bg={quizType === option.value ? `${option.color}.50` : "white"}
                  cursor="pointer"
                  onClick={() => setQuizType(option.value)}
                  transition="all 0.2s"
                  _hover={{ borderColor: `${option.color}.300`, bg: `${option.color}.50` }}
                >
                  <HStack spacing={3}>
                    <Box
                      p={2}
                      borderRadius="md"
                      bg={quizType === option.value ? `${option.color}.100` : "gray.100"}
                    >
                      <Icon as={option.icon} color={`${option.color}.500`} boxSize={5} />
                    </Box>
                    <VStack align="start" spacing={1} flex="1">
                      <Text fontWeight="semibold" color="gray.700">
                        {option.label}
                      </Text>
                      <Text fontSize="sm" color="gray.600">
                        {option.description}
                      </Text>
                    </VStack>
                  </HStack>
                </Box>
              ))}
            </VStack>
          </FormControl>

          {/* Question Count */}
          <FormControl>
            <FormLabel fontWeight="semibold">Number of Questions</FormLabel>
            <NumberInput 
              min={1} 
              max={20} 
              value={questionCount}
              onChange={(valueString) => setQuestionCount(valueString)}
              size="lg"
            >
              <NumberInputField />
              <NumberInputStepper>
                <NumberIncrementStepper />
                <NumberDecrementStepper />
              </NumberInputStepper>
            </NumberInput>
            <FormHelperText>Choose between 1-20 questions for your quiz</FormHelperText>
          </FormControl>

          {/* Advanced Options */}
          <Box>
            <Button
              leftIcon={isAdvancedOpen ? <ChevronUpIcon /> : <ChevronDownIcon />}
              onClick={onAdvancedToggle}
              variant="ghost"
              size="sm"
              fontWeight="semibold"
            >
              Advanced Options
            </Button>
            
            <Collapse in={isAdvancedOpen} animateOpacity>
              <Box mt={4} p={4} border="1px" borderColor="gray.200" borderRadius="md">
                <FormControl>
                  <FormLabel fontWeight="semibold" mb={3}>
                    Question Focus
                    <Tooltip label="Choose how to generate quiz questions from your document">
                      <InfoIcon ml={2} boxSize={3} color="gray.400" />
                    </Tooltip>
                  </FormLabel>
                  <RadioGroup 
                    value={useCustomQuery ? 'custom' : 'general'} 
                    onChange={(value) => setUseCustomQuery(value === 'custom')}
                  >
                    <VStack align="start" spacing={3}>
                      <Radio value="general" size="lg">
                        <VStack align="start" spacing={1}>
                          <Text fontWeight="medium">General Quiz</Text>
                          <Text fontSize="sm" color="gray.600">
                            AI will generate diverse questions covering the entire document
                          </Text>
                        </VStack>
                      </Radio>
                      <Radio value="custom" size="lg">
                        <VStack align="start" spacing={1}>
                          <Text fontWeight="medium">Custom Focus</Text>
                          <Text fontSize="sm" color="gray.600">
                            Specify a topic or theme to focus the quiz content
                          </Text>
                        </VStack>
                      </Radio>
                    </VStack>
                  </RadioGroup>
                </FormControl>

                {useCustomQuery && (
                  <FormControl mt={4}>
                    <FormLabel fontWeight="semibold">Custom Query</FormLabel>
                    <Textarea
                      value={customQuery}
                      onChange={(e) => setCustomQuery(e.target.value)}
                      placeholder="Example: 'Create questions about machine learning algorithms' or 'Focus on chapter 3 concepts'"
                      rows={3}
                      size="lg"
                    />
                    <FormHelperText>
                      Describe what you want the quiz to focus on. The AI will use this to find relevant content.
                    </FormHelperText>
                  </FormControl>
                )}
              </Box>
            </Collapse>
          </Box>
        </Stack>

        <Divider />

        {/* Generation Button and Progress */}
        <VStack spacing={4}>
          {isGenerating && (
            <Box w="100%">
              <Text fontSize="sm" color="gray.600" mb={2}>
                Generating quiz with AI... This may take up to 30 seconds.
              </Text>
              <Progress
                value={generationProgress}
                size="lg"
                colorScheme="blue"
                hasStripe
                isAnimated
                borderRadius="md"
              />
            </Box>
          )}
          
          <Button
            colorScheme="blue"
            isLoading={isGenerating}
            loadingText="Generating Quiz with AI..."
            onClick={handleGenerate}
            size="lg"
            leftIcon={<Icon as={FiZap} />}
            isFullWidth
            disabled={!documentId || (useCustomQuery && !customQuery.trim())}
          >
            Generate Quiz
          </Button>
          
          <Text fontSize="sm" color="gray.500" textAlign="center">
            Your quiz will be created using advanced AI to analyze the document content
          </Text>
        </VStack>
      </VStack>
    </Box>
  );
};

export default QuizGenerator;