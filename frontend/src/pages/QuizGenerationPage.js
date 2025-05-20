import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Heading,
  Text,
  Container,
  Alert,
  AlertIcon,
  Button,
  Spinner,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  Flex,
  VStack,
  Badge,
  HStack,
  Icon,
  useToast
} from '@chakra-ui/react';
import { ChevronRightIcon } from '@chakra-ui/icons';
import { FiFileText, FiClock, FiAlignLeft } from 'react-icons/fi';
import QuizGenerator from '../components/QuizGenerator';
import { getDocumentInfo, apiUtils } from '../api';

const QuizGenerationPage = () => {
  const { documentId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [documentInfo, setDocumentInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDocumentInfo = async () => {
      try {
        const response = await getDocumentInfo(documentId);
        
        // Check if document processing is complete
        if (response.status !== 'completed') {
          toast({
            title: 'Document Still Processing',
            description: 'Please wait for the document to finish processing before generating a quiz.',
            status: 'warning',
            duration: 5000,
            isClosable: true,
          });
          navigate(`/upload`);
          return;
        }
        
        setDocumentInfo(response);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching document info:', err);
        const errorMessage = apiUtils.formatErrorMessage(err);
        setError(errorMessage);
        setLoading(false);
        
        toast({
          title: 'Error Loading Document',
          description: errorMessage,
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      }
    };

    if (documentId) {
      fetchDocumentInfo();
    }
  }, [documentId, navigate, toast]);

  if (loading) {
    return (
      <Container maxW="container.md">
        <Flex justify="center" align="center" height="400px" direction="column">
          <Spinner size="xl" color="blue.500" thickness="4px" />
          <VStack spacing={2} mt={6}>
            <Text fontSize="lg" fontWeight="semibold">Loading document information...</Text>
            <Text fontSize="sm" color="gray.600">
              This may take a moment while we retrieve your document details.
            </Text>
          </VStack>
        </Flex>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxW="container.md">
        <VStack spacing={6} py={10}>
          <Alert status="error" borderRadius="lg" p={6}>
            <AlertIcon boxSize={6} />
            <VStack align="start" spacing={2}>
              <Text fontWeight="bold" fontSize="lg">Unable to Load Document</Text>
              <Text>{error}</Text>
            </VStack>
          </Alert>
          
          <HStack spacing={4}>
            <Button onClick={() => navigate('/upload')} colorScheme="blue" variant="solid">
              Upload New Document
            </Button>
            <Button onClick={() => window.location.reload()} variant="outline">
              Try Again
            </Button>
          </HStack>
        </VStack>
      </Container>
    );
  }

  return (
    <Container maxW="container.lg">
      <Breadcrumb 
        separator={<ChevronRightIcon color="gray.500" />} 
        mb={8} 
        fontSize="sm"
      >
        <BreadcrumbItem>
          <BreadcrumbLink href="/" _hover={{ color: 'blue.500' }}>Home</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbItem>
          <BreadcrumbLink href="/upload" _hover={{ color: 'blue.500' }}>Upload</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbItem isCurrentPage>
          <BreadcrumbLink color="blue.500" fontWeight="semibold">Generate Quiz</BreadcrumbLink>
        </BreadcrumbItem>
      </Breadcrumb>

      <VStack spacing={8} align="stretch">
        {/* Header Section */}
        <Box textAlign="center">
          <Heading as="h1" size="xl" color="blue.600">
            Generate AI-Powered Quiz
          </Heading>
          <Text mt={3} color="gray.600" fontSize="lg">
            Create customized quizzes from your uploaded document using advanced AI
          </Text>
        </Box>

        {/* Document Info Card */}
        {documentInfo && (
          <Box
            bg="blue.50"
            borderWidth="1px"
            borderColor="blue.200"
            borderRadius="lg"
            p={6}
          >
            <VStack spacing={4} align="start">
              <Flex justify="space-between" align="center" w="100%">
                <Heading size="md" color="blue.700">
                  Document Information
                </Heading>
                <Badge colorScheme="green" size="lg" px={3} py={1}>
                  Ready for Quiz Generation
                </Badge>
              </Flex>
              
              <HStack spacing={6} wrap="wrap">
                <HStack>
                  <Icon as={FiFileText} color="blue.500" />
                  <VStack align="start" spacing={0}>
                    <Text fontSize="sm" color="gray.600">Filename</Text>
                    <Text fontWeight="semibold">{documentInfo.originalFilename || documentInfo.filename}</Text>
                  </VStack>
                </HStack>
                
                <HStack>
                  <Icon as={FiAlignLeft} color="green.500" />
                  <VStack align="start" spacing={0}>
                    <Text fontSize="sm" color="gray.600">Pages</Text>
                    <Text fontWeight="semibold">{documentInfo.pageCount}</Text>
                  </VStack>
                </HStack>
                
                <HStack>
                  <Icon as={FiAlignLeft} color="purple.500" />
                  <VStack align="start" spacing={0}>
                    <Text fontSize="sm" color="gray.600">Content Chunks</Text>
                    <Text fontWeight="semibold">{documentInfo.chunkCount}</Text>
                  </VStack>
                </HStack>
                
                <HStack>
                  <Icon as={FiClock} color="orange.500" />
                  <VStack align="start" spacing={0}>
                    <Text fontSize="sm" color="gray.600">Processed</Text>
                    <Text fontWeight="semibold">
                      {new Date(documentInfo.createdAt).toLocaleDateString()}
                    </Text>
                  </VStack>
                </HStack>
              </HStack>
              
              {documentInfo.processing && (
                <Box>
                  <Text fontSize="sm" color="gray.600" mb={2}>Processing Details:</Text>
                  <HStack spacing={4} wrap="wrap">
                    <Badge colorScheme="blue" size="sm">
                      {documentInfo.processing.usedLLMCleaning ? 'LLM Text Cleaning' : 'Basic Cleaning'}
                    </Badge>
                    <Badge colorScheme="purple" size="sm">
                      {documentInfo.processing.validatedChunks ? 'Validated Chunks' : 'Standard Chunks'}
                    </Badge>
                    <Badge colorScheme="green" size="sm">
                      Chunk Size: {documentInfo.processing.chunkSize} tokens
                    </Badge>
                  </HStack>
                </Box>
              )}
            </VStack>
          </Box>
        )}

        {/* Quiz Generator Component */}
        <QuizGenerator 
          documentId={documentId} 
          documentInfo={documentInfo} 
        />
      </VStack>
    </Container>
  );
};

export default QuizGenerationPage;