import React from 'react';
import {
  Box,
  Text,
  Radio,
  RadioGroup,
  Stack,
  Textarea,
  Flex,
  Button,
  Divider,
  FormControl,
  FormLabel,
  Badge
} from '@chakra-ui/react';

const QuizQuestion = ({ 
  question, 
  questionNumber, 
  totalQuestions,
  userAnswer, 
  onAnswerChange,
  showAnswer = false
}) => {
  const getBadgeColor = (type) => {
    switch (type) {
      case 'mcq':
        return 'blue';
      case 'truefalse':
        return 'green';
      case 'essay':
        return 'purple';
      default:
        return 'gray';
    }
  };

  const getQuestionTypeLabel = (type) => {
    switch (type) {
      case 'mcq':
        return 'Multiple Choice';
      case 'truefalse':
        return 'True/False';
      case 'essay':
        return 'Short Answer';
      default:
        return type;
    }
  };

  const renderQuestion = () => {
    return (
      <Box mb={4}>
        <Flex align="center" mb={2}>
          <Badge colorScheme={getBadgeColor(question.type)} mr={2}>
            {getQuestionTypeLabel(question.type)}
          </Badge>
          <Text fontSize="sm" color="gray.500">
            Question {questionNumber} of {totalQuestions}
          </Text>
        </Flex>
        <Text fontSize="lg" fontWeight="medium">
          {question.question}
        </Text>
      </Box>
    );
  };

  const renderMultipleChoice = () => {
    return (
      <FormControl isDisabled={showAnswer}>
        <RadioGroup
          value={userAnswer !== undefined ? userAnswer.toString() : ''}
          onChange={(value) => onAnswerChange(parseInt(value))}
        >
          <Stack spacing={2}>
            {question.options.map((option, idx) => (
              <Radio 
                key={idx} 
                value={idx.toString()}
                colorScheme={
                  showAnswer && idx === question.correctAnswer 
                    ? 'green' 
                    : showAnswer && userAnswer === idx && idx !== question.correctAnswer 
                      ? 'red' 
                      : 'blue'
                }
              >
                <Text>
                  {option}
                  {showAnswer && idx === question.correctAnswer && (
                    <Badge ml={2} colorScheme="green">Correct</Badge>
                  )}
                </Text>
              </Radio>
            ))}
          </Stack>
        </RadioGroup>
      </FormControl>
    );
  };

  const renderTrueFalse = () => {
    return (
      <FormControl isDisabled={showAnswer}>
        <RadioGroup
          value={userAnswer !== undefined ? userAnswer.toString() : ''}
          onChange={(value) => onAnswerChange(value === 'true')}
        >
          <Stack spacing={2}>
            <Radio 
              value="true"
              colorScheme={
                showAnswer && question.correctAnswer === true
                  ? 'green'
                  : showAnswer && userAnswer === true && question.correctAnswer !== true
                    ? 'red'
                    : 'blue'
              }
            >
              <Text>
                True
                {showAnswer && question.correctAnswer === true && (
                  <Badge ml={2} colorScheme="green">Correct</Badge>
                )}
              </Text>
            </Radio>
            <Radio 
              value="false"
              colorScheme={
                showAnswer && question.correctAnswer === false
                  ? 'green'
                  : showAnswer && userAnswer === false && question.correctAnswer !== false
                    ? 'red'
                    : 'blue'
              }
            >
              <Text>
                False
                {showAnswer && question.correctAnswer === false && (
                  <Badge ml={2} colorScheme="green">Correct</Badge>
                )}
              </Text>
            </Radio>
          </Stack>
        </RadioGroup>
      </FormControl>
    );
  };

  const renderEssay = () => {
    return (
      <FormControl isDisabled={showAnswer}>
        <Textarea
          value={userAnswer || ''}
          onChange={(e) => onAnswerChange(e.target.value)}
          placeholder="Type your answer here..."
          rows={5}
          resize="vertical"
        />
      </FormControl>
    );
  };

  const renderAnswerExplanation = () => {
    if (!showAnswer) return null;

    return (
      <Box mt={4} p={4} bg="gray.50" borderRadius="md">
        <Text fontWeight="bold" mb={2}>
          Explanation:
        </Text>
        <Text>
          {question.explanation || question.sampleAnswer || 'No explanation available.'}
        </Text>
      </Box>
    );
  };

  return (
    <Box
      borderWidth="1px"
      borderRadius="lg"
      p={6}
      my={4}
      boxShadow="sm"
      bg="white"
    >
      {renderQuestion()}
      
      {question.type === 'mcq' && renderMultipleChoice()}
      {question.type === 'truefalse' && renderTrueFalse()}
      {question.type === 'essay' && renderEssay()}
      
      {renderAnswerExplanation()}
    </Box>
  );
};

export default QuizQuestion;