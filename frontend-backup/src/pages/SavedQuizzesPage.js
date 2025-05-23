import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Container,
  Heading,
  Text,
  Alert,
  AlertIcon,
  SimpleGrid,
  Flex,
  Badge,
  IconButton,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  useToast,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  Spinner
} from '@chakra-ui/react';
import { ChevronRightIcon, ChevronDownIcon, DeleteIcon, RepeatIcon } from '@chakra-ui/icons';
import axios from 'axios';

const QuizCard = ({ quiz, onSelect, onDelete }) => {
  const formattedDate = new Date(quiz.createdAt).toLocaleDateString();
  
  const getBadgeColor = (type) => {
    switch (type) {
      case 'mcq':
        return 'blue';
      case 'truefalse':
        return 'green';
      case 'essay':
        return 'purple';
      case 'mixed':
        return 'orange';
      default:
        return 'gray';
    }
  };

  const getQuizTypeLabel = (type) => {
    switch (type) {
      case 'mcq':
        return 'Multiple Choice';
      case 'truefalse':
        return 'True/False';
      case 'essay':
        return 'Short Answer';
      case 'mixed':
        return 'Mixed Types';
      default:
        return type;
    }
  };

  return (
    <Box 
      borderWidth="1px" 
      borderRadius="lg" 
      overflow="hidden" 
      p={4}
      transition="all 0.2s"
      _hover={{ transform: 'translateY(-4px)', shadow: 'md' }}
    >
      <Flex justify="space-between" align="center">
        <Badge colorScheme={getBadgeColor(quiz.quizType)} mb={2}>
          {getQuizTypeLabel(quiz.quizType)}
        </Badge>
        <Menu>
          <MenuButton
            as={IconButton}
            icon={<ChevronDownIcon />}
            variant="ghost"
            size="sm"
          />
          <MenuList>
            <MenuItem onClick={() => onSelect(quiz.id)}>Take Quiz</MenuItem>
            <MenuItem onClick={() => onDelete(quiz.id)} icon={<DeleteIcon />} color="red.500">
              Delete
            </MenuItem>
          </MenuList>
        </Menu>
      </Flex>

      <Heading as="h3" size="md" mb={2} noOfLines={1}>
        {quiz.title}
      </Heading>
      
      <Text color="gray.600" fontSize="sm" mb={3}>
        Source: {quiz.documentName}
      </Text>
      
      <Flex justify="space-between" fontSize="sm" color="gray.500">
        <Text>{quiz.questionCount} questions</Text>
        <Text>Created: {formattedDate}</Text>
      </Flex>
      
      {quiz.submissionCount > 0 && (
        <Text mt={3} fontSize="sm">
          Taken {quiz.submissionCount} time{quiz.submissionCount > 1 ? 's' : ''}
        </Text>
      )}
    </Box>
  );
};

const SavedQuizzesPage = () => {
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [quizToDelete, setQuizToDelete] = useState(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const navigate = useNavigate();
  const toast = useToast();

  const fetchQuizzes = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/quiz/saved');
      setQuizzes(response.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching saved quizzes:', err);
      setError('Failed to fetch your saved quizzes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuizzes();
  }, []);

  const handleSelectQuiz = (quizId) => {
    navigate(`/quiz/${quizId}`);
  };

  const handleDeleteClick = (quizId) => {
    setQuizToDelete(quizId);
    onOpen();
  };

  const confirmDelete = async () => {
    if (!quizToDelete) return;

    try {
      await axios.delete(`/api/quiz/${quizToDelete}`);
      
      // Update the UI
      setQuizzes(quizzes.filter(quiz => quiz.id !== quizToDelete));
      
      toast({
        title: 'Quiz deleted',
        description: 'The quiz has been successfully deleted',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (err) {
      console.error('Error deleting quiz:', err);
      toast({
        title: 'Deletion failed',
        description: err.response?.data?.message || 'Failed to delete quiz',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setQuizToDelete(null);
      onClose();
    }
  };

  return (
    <Container maxW="container.lg" py={8}>
      <Breadcrumb separator={<ChevronRightIcon color="gray.500" />} mb={6}>
        <BreadcrumbItem>
          <BreadcrumbLink href="/">Home</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbItem isCurrentPage>
          <BreadcrumbLink>My Quizzes</BreadcrumbLink>
        </BreadcrumbItem>
      </Breadcrumb>

      <Flex justify="space-between" align="center" mb={8}>
        <Heading as="h1" size="lg">My Saved Quizzes</Heading>
        <Button 
          leftIcon={<RepeatIcon />} 
          onClick={fetchQuizzes} 
          size="sm"
          isLoading={loading}
        >
          Refresh
        </Button>
      </Flex>

      {loading && !quizzes.length ? (
        <Flex justify="center" align="center" height="200px">
          <Spinner size="xl" color="teal.500" />
        </Flex>
      ) : error ? (
        <Alert status="error" mb={4}>
          <AlertIcon />
          {error}
        </Alert>
      ) : quizzes.length === 0 ? (
        <Box textAlign="center" py={10}>
          <Heading as="h3" size="md" mb={4}>
            No Quizzes Found
          </Heading>
          <Text mb={6}>
            You haven't created any quizzes yet. Upload a PDF document to get started.
          </Text>
          <Button 
            onClick={() => navigate('/upload')} 
            colorScheme="teal"
          >
            Upload Document
          </Button>
        </Box>
      ) : (
        <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
          {quizzes.map(quiz => (
            <QuizCard
              key={quiz.id}
              quiz={quiz}
              onSelect={handleSelectQuiz}
              onDelete={handleDeleteClick}
            />
          ))}
        </SimpleGrid>
      )}

      {/* Confirmation Modal */}
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Confirm Deletion</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            Are you sure you want to delete this quiz? This action cannot be undone.
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>
              Cancel
            </Button>
            <Button colorScheme="red" onClick={confirmDelete}>
              Delete
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Container>
  );
};

export default SavedQuizzesPage;